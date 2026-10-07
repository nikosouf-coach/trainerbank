// Edge Function "finding" – KI-Auswertung eines medizinischen Befunds (Foto/PDF) für das Trainerteam.
//
// Aufruf (App): supabase.functions.invoke('finding', { body: { finding_id, team_id, context, lang } })
// Antwort:  200 { text } – der Text wird zusätzlich am Befund gespeichert (findings.ai_text).
// Fehler:   401 unauthorized · 403 forbidden (kein Trainerteam) · 403 ki_disabled · 403 consent_required ·
//           404 not_found · 413 too_large · 429 limit · 502 upstream · 400 bad_request · 500 internal
//
// Ablauf: JWT prüfen → Befund mit RLS laden → Aufrufer ist Staff des Teams → Module „ki“ und „befunde“ aktiv →
// Einwilligung: Spieler mit Konto → has_consent(findings); ohne Konto → vom Trainer bestätigte schriftliche
// Einwilligung (consent_source = 'schriftlich') → Tageslimit → Datei (service_role) → Claude (Bild/PDF) → speichern.
import { json, preflight, readJson } from '../_shared/http.ts';
import { adminClient, authenticate } from '../_shared/supabase.ts';
import { buildFindingPrompt, type Lang } from '../_shared/prompts.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BYTES = 10 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = await authenticate(req);
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const { user, client } = auth;

  const raw = (await readJson(req)) as Record<string, unknown> | null;
  const findingId = typeof raw?.finding_id === 'string' ? raw.finding_id : '';
  const teamId = typeof raw?.team_id === 'string' ? raw.team_id : '';
  const context = typeof raw?.context === 'string' ? raw.context.slice(0, 8000) : '';
  const lang: Lang = raw?.lang === 'en' ? 'en' : 'de';
  if (!UUID_RE.test(findingId) || !UUID_RE.test(teamId)) return json({ error: 'bad_request' }, 400);

  try {
    // Befund mit den Rechten des Nutzers laden (RLS) und Staff-Rolle prüfen
    const { data: f, error: fErr } = await client.from('findings').select('*').eq('id', findingId).eq('team_id', teamId).maybeSingle();
    if (fErr) throw fErr;
    if (!f) return json({ error: 'not_found' }, 404);
    const { data: isStaff, error: sErr } = await client.rpc('is_team_staff', { team: teamId });
    if (sErr) throw sErr;
    if (isStaff !== true) return json({ error: 'forbidden' }, 403);

    const { data: team, error: tErr } = await client.from('teams').select('modules').eq('id', teamId).maybeSingle();
    if (tErr) throw tErr;
    const modules = (team?.modules ?? {}) as Record<string, unknown>;
    if (modules.ki !== true || modules.befunde === false) return json({ error: 'ki_disabled' }, 403);

    const admin = adminClient();
    // Einwilligung des Spielers
    const { data: player, error: pErr } = await admin.from('players').select('user_id').eq('id', f.player_id).maybeSingle();
    if (pErr) throw pErr;
    if (player?.user_id) {
      const { data: ok, error: cErr } = await admin.rpc('has_consent', { p_user: player.user_id, p_kind: 'findings' });
      if (cErr) throw cErr;
      if (ok !== true && f.consent_source !== 'schriftlich') return json({ error: 'consent_required' }, 403);
    } else if (f.consent_source !== 'schriftlich') {
      return json({ error: 'consent_required' }, 403);
    }

    // Tageslimit (gleicher Zähler wie der KI-Coach)
    const limit = Number.parseInt(Deno.env.get('AI_DAILY_LIMIT') ?? '', 10) || 40;
    const { data: count, error: uErr } = await admin.rpc('ai_usage_bump', { p_user: user.id, p_delta: 1, p_limit: limit });
    if (uErr) throw uErr;
    if (count === null || count === undefined) return json({ error: 'limit', limit }, 429);

    const refund = () => admin.rpc('ai_usage_bump', { p_user: user.id, p_delta: -1, p_limit: limit });
    const { data: file, error: dErr } = await admin.storage.from('findings').download(f.path);
    if (dErr || !file) { await refund(); return json({ error: 'not_found' }, 404); }
    const buf = await file.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) { await refund(); return json({ error: 'too_large' }, 413); }
    const data = toBase64(buf);
    const media = f.mime as string;
    const source = media === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: media, data } };

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || DEFAULT_MODEL,
        max_tokens: 1500,
        system: buildFindingPrompt(lang),
        messages: [{ role: 'user', content: [source, { type: 'text', text: `${context.trim()}\n\nBitte werte diesen Befund aus.`.trim() }] }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.error('Claude API error', res.status, (await res.text()).slice(0, 500));
      await refund();
      return json({ error: 'upstream' }, 502);
    }
    const out = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (out.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
    if (!text) { await refund(); return json({ error: 'upstream' }, 502); }

    const { error: wErr } = await client.from('findings').update({ ai_text: text.slice(0, 20000), ai_at: new Date().toISOString() }).eq('id', findingId);
    if (wErr) console.error('could not store ai_text', wErr);
    return json({ text });
  } catch (err) {
    console.error('finding internal error', err);
    return json({ error: 'internal' }, 500);
  }
});
