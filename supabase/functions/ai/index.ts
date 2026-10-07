// Edge Function "ai" – KI-Coach (Claude API serverseitig).
//
// Aufruf (App): supabase.functions.invoke('ai', { body: { mode, prompt, context, lang, team_id } })
//   mode     'coach' | 'player' | 'session' | 'potentials' | 'kind'
//   prompt   Frage / Auftrag (max. 4 000 Zeichen)
//   context  von der App aufbereitete Daten (max. 24 000 Zeichen)
//   lang     'de' | 'en'
//   team_id  Team, in dessen Namen gefragt wird
// Antwort:  200 { text }
// Fehler:   401 unauthorized · 403 not_member · 403 ki_disabled · 403 consent_required (nur mode
//           'player') · 429 limit · 502 upstream (zusätzlich 400 bad_request, 405 method_not_allowed,
//           500 internal)
//
// Ablauf: JWT prüfen → Mitgliedschaft (RPC is_team_member, RLS-Client) → Modul
// teams.modules.ki === true → bei mode 'player' aktive Einwilligung kind 'ai'
// (RPC has_consent) → Tageslimit (ai_usage, service_role, atomar) →
// Claude API. Bei Fehlern der Claude API wird der Zähler wieder gutgeschrieben.
//
// Secrets: ANTHROPIC_API_KEY (Pflicht), ANTHROPIC_MODEL (Standard claude-sonnet-5-5),
//          AI_DAILY_LIMIT (Standard 40 Anfragen pro Nutzer und Tag, Europe/Berlin)
import { json, preflight, readJson } from '../_shared/http.ts';
import { adminClient, authenticate } from '../_shared/supabase.ts';
import { AI_MODES, type AiMode, buildSystemPrompt, buildUserMessage, type Lang } from '../_shared/prompts.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 1200;
const MAX_PROMPT = 4_000;
const MAX_CONTEXT = 24_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AiRequest {
  mode: AiMode;
  prompt: string;
  context: string;
  lang: Lang;
  team_id: string;
}

/** Prüft und normalisiert den Request-Body; null bei ungültiger Eingabe. */
function parseBody(raw: unknown): AiRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const mode = b.mode as AiMode;
  const lang: Lang = b.lang === 'en' ? 'en' : 'de';
  const prompt = typeof b.prompt === 'string' ? b.prompt : '';
  const context = typeof b.context === 'string' ? b.context : '';
  const teamId = typeof b.team_id === 'string' ? b.team_id : '';

  if (!AI_MODES.includes(mode)) return null;
  if (!prompt.trim() || prompt.length > MAX_PROMPT || context.length > MAX_CONTEXT) return null;
  if (!UUID_RE.test(teamId)) return null;
  return { mode, prompt, context, lang, team_id: teamId };
}

function dailyLimit(): number {
  const n = Number.parseInt(Deno.env.get('AI_DAILY_LIMIT') ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 40;
}

/** Ruft die Claude API auf und gibt den Text der Antwort zurück (wirft bei Fehlern). */
async function callClaude(system: string, userMessage: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: Deno.env.get('ANTHROPIC_MODEL') || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    // Fehlertext nur loggen, nicht an den Client geben
    console.error('Claude API error', res.status, (await res.text()).slice(0, 500));
    throw new Error(`Claude API status ${res.status}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Claude API returned no text');
  return text;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // 1. Anmeldung
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const { user, client } = auth;

  // 2. Eingabe
  const body = parseBody(await readJson(req));
  if (!body) return json({ error: 'bad_request' }, 400);

  try {
    // 3. Mitgliedschaft (läuft mit dem JWT des Nutzers)
    const { data: isMember, error: memberError } = await client.rpc('is_team_member', { team: body.team_id });
    if (memberError) throw memberError;
    if (isMember !== true) return json({ error: 'not_member' }, 403);

    // 4. KI-Modul im Team aktiviert? (RLS: Mitglieder dürfen das Team lesen)
    const { data: team, error: teamError } = await client
      .from('teams')
      .select('modules')
      .eq('id', body.team_id)
      .maybeSingle();
    if (teamError) throw teamError;
    const modules = (team?.modules ?? {}) as Record<string, unknown>;
    if (modules.ki !== true) return json({ error: 'ki_disabled' }, 403);

    // 4b. Spieler-Modus: aktive KI-Einwilligung des Aufrufers nötig (Trainer-Modi nicht betroffen).
    //     has_consent prüft consents (kind 'ai', withdrawn_at is null) für das eigene Konto.
    if (body.mode === 'player') {
      const { data: hasAiConsent, error: consentError } = await client.rpc('has_consent', {
        p_user: user.id,
        p_kind: 'ai',
      });
      if (consentError) throw consentError;
      if (hasAiConsent !== true) return json({ error: 'consent_required' }, 403);
    }

    // 5. Tageslimit atomar reservieren (service_role; Clients dürfen ai_usage nicht schreiben)
    const admin = adminClient();
    const limit = dailyLimit();
    const { data: count, error: usageError } = await admin.rpc('ai_usage_bump', {
      p_user: user.id,
      p_delta: 1,
      p_limit: limit,
    });
    if (usageError) throw usageError;
    if (count === null || count === undefined) return json({ error: 'limit', limit }, 429);

    // 6. Claude API
    try {
      const text = await callClaude(
        buildSystemPrompt(body.mode, body.lang),
        buildUserMessage(body.context, body.prompt),
      );
      return json({ text });
    } catch (err) {
      console.error('ai upstream failure', err);
      // Fehlgeschlagene Anfrage nicht auf das Tageslimit anrechnen
      await admin.rpc('ai_usage_bump', { p_user: user.id, p_delta: -1, p_limit: limit });
      return json({ error: 'upstream' }, 502);
    }
  } catch (err) {
    console.error('ai internal error', err);
    return json({ error: 'internal' }, 500);
  }
});
