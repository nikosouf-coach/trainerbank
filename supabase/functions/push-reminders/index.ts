// Edge Function "push-reminders" – zeitgesteuerte Push-Erinnerungen.
//
// Aufruf: alle 15 Minuten per pg_cron/pg_net (Migration *_cron.sql), POST mit
// Header x-cron-secret = Secret CRON_SECRET. verify_jwt ist in config.toml aus.
//
// Pro Team wird die Ortszeit in teams.timezone berechnet:
//  (a) Session-Erinnerung "rpe": eine heutige Einheit (Spiel aus matches bzw.
//      Training aus settings.days / calendar_overrides) endete vor 30–44 Minuten
//      → aktive Spieler mit Push-Token, ohne RPE-Eintrag heute, ohne Abwesenheit
//      heute und nicht als entschuldigt/unentschuldigt geführt.
//  (b) Morgen-Check "wellness" zwischen 08:00 und 08:14 Ortszeit → aktive Spieler
//      mit Push-Token ohne Wellness-Eintrag heute.
// Module lassen sich je Team abschalten: modules.rpe === false bzw. modules.wellness === false.
// Deduplizierung über push_log (user_id, kind, day): pro Konto, Art und Tag höchstens eine Nachricht.
// Versand über die Expo Push API in Blöcken zu 100; ungültige Tokens werden gelöscht.
//
// Secrets: CRON_SECRET (Pflicht), EXPO_ACCESS_TOKEN (optional, falls Push-Security aktiv ist)
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { json, safeEqual } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import {
  absenceCovers,
  localNow,
  type LocalNow,
  morningCheckDue,
  pushText,
  type ReminderKind,
  rpeReminderDue,
  sessionsForDay,
} from '../_shared/schedule.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;
const PAGE = 1000; // max. Zeilen pro PostgREST-Abfrage (Supabase-Standard)
const IN_CHUNK = 150; // IDs pro in()-Filter (URL-Länge)
const PUSH_LOG_RETENTION_DAYS = 14;

interface TeamRow {
  id: string;
  age_class: string | null;
  settings: unknown;
  modules: Record<string, unknown> | null;
  timezone: string | null;
}

interface PlayerRow {
  id: string;
  team_id: string;
  user_id: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  data: Record<string, unknown>;
}

type Query<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Liest alle Seiten einer Abfrage (PostgREST begrenzt auf PAGE Zeilen pro Antwort). */
async function fetchAll<T>(build: (from: number, to: number) => Query<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Führt eine Abfrage für ID-Blöcke aus (in()-Filter) und sammelt alle Zeilen. */
async function fetchByIds<T>(ids: string[], build: (chunk: string[], from: number, to: number) => Query<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    rows.push(...(await fetchAll<T>((from, to) => build(chunk, from, to))));
  }
  return rows;
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const key = (a: string, b: string) => `${a}|${b}`;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sendet Nachrichten an Expo; gibt Tokens zurück, die Expo als nicht registriert meldet. */
async function sendExpo(messages: ExpoMessage[]): Promise<{ sent: number; invalidTokens: string[] }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let sent = 0;
  const invalidTokens: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.error('Expo push error', res.status, (await res.text()).slice(0, 500));
        continue;
      }
      const result = (await res.json()) as {
        data?: Array<{ status: 'ok' | 'error'; details?: { error?: string } }>;
      };
      (result.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent++;
        else if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[idx].to);
      });
    } catch (err) {
      console.error('Expo push request failed', err);
    }
  }
  return { sent, invalidTokens };
}

/** Entfernt push_log-Zeilen, die älter als PUSH_LOG_RETENTION_DAYS sind (Fehler nur loggen). */
async function cleanupPushLog(admin: SupabaseClient, now: Date): Promise<void> {
  const cutoff = addDays(now.toISOString().slice(0, 10), -PUSH_LOG_RETENTION_DAYS);
  const { error } = await admin.from('push_log').delete().lt('day', cutoff);
  if (error) console.error('push_log cleanup failed', error);
}

async function run(admin: SupabaseClient, now: Date) {
  // ---- 1. Teams und Ortszeit --------------------------------------------
  const teams = await fetchAll<TeamRow>((from, to) =>
    admin.from('teams').select('id, age_class, settings, modules, timezone').order('id').range(from, to)
  );
  const local = new Map<string, LocalNow>(teams.map((t) => [t.id, localNow(now, t.timezone)]));
  const dates = unique([...local.values()].map((l) => l.date));
  if (teams.length === 0) return { teams: 0, rpe: 0, wellness: 0, sent: 0 };

  // ---- 2. Kalender der betroffenen Tage ----------------------------------
  const [matches, overrides, replacing] = await Promise.all([
    fetchAll<{ team_id: string; date: string; time: string | null }>((from, to) =>
      admin.from('matches').select('team_id, date, time').in('date', dates).order('id').range(from, to)
    ),
    fetchAll<{ team_id: string; date: string; cancel: boolean; extra: boolean; time: string | null; duration: number | null }>(
      (from, to) =>
        admin
          .from('calendar_overrides')
          .select('team_id, date, cancel, extra, time, duration')
          .in('date', dates)
          .order('team_id')
          .order('date')
          .range(from, to),
    ),
    fetchAll<{ team_id: string; date: string }>((from, to) =>
      admin
        .from('team_events')
        .select('team_id, date')
        .in('date', dates)
        .eq('replaces_training', true)
        .order('id')
        .range(from, to)
    ),
  ]);

  const matchesByDay = new Map<string, { time: string | null }[]>();
  for (const m of matches) {
    const k = key(m.team_id, m.date);
    matchesByDay.set(k, [...(matchesByDay.get(k) ?? []), { time: m.time }]);
  }
  const overrideByDay = new Map(overrides.map((o) => [key(o.team_id, o.date), o]));
  const replacedDays = new Set(replacing.map((e) => key(e.team_id, e.date)));

  // ---- 3. Welche Teams sind jetzt dran? -----------------------------------
  const due = new Map<string, ReminderKind[]>(); // team_id → Arten
  for (const team of teams) {
    const l = local.get(team.id)!;
    const modules = team.modules ?? {};
    const kinds: ReminderKind[] = [];

    if (modules.rpe !== false) {
      const k = key(team.id, l.date);
      const sessions = sessionsForDay({
        settings: team.settings,
        ageClass: team.age_class,
        weekday: l.weekday,
        matches: matchesByDay.get(k) ?? [],
        override: overrideByDay.get(k) ?? null,
        replacesTraining: replacedDays.has(k),
      });
      if (rpeReminderDue(sessions, l.minutes)) kinds.push('rpe');
    }
    if (modules.wellness !== false && morningCheckDue(l.minutes)) kinds.push('wellness');
    if (kinds.length) due.set(team.id, kinds);
  }
  if (due.size === 0) return { teams: teams.length, rpe: 0, wellness: 0, sent: 0 };

  // ---- 4. Spieler mit Konto und Push-Token --------------------------------
  const players = await fetchByIds<PlayerRow>([...due.keys()], (chunk, from, to) =>
    admin
      .from('players')
      .select('id, team_id, user_id')
      .in('team_id', chunk)
      .eq('active', true)
      .not('user_id', 'is', null)
      .order('id')
      .range(from, to)
  );
  const userIds = unique(players.map((p) => p.user_id));
  const [tokens, profiles] = await Promise.all([
    fetchByIds<{ token: string; user_id: string }>(userIds, (chunk, from, to) =>
      admin.from('push_tokens').select('token, user_id').in('user_id', chunk).order('token').range(from, to)
    ),
    fetchByIds<{ id: string; lang: string }>(userIds, (chunk, from, to) =>
      admin.from('profiles').select('id, lang').in('id', chunk).order('id').range(from, to)
    ),
  ]);
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens) tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
  const langByUser = new Map(profiles.map((p) => [p.id, p.lang]));

  const reachable = players.filter((p) => tokensByUser.has(p.user_id));
  const rpePlayers = reachable.filter((p) => due.get(p.team_id)!.includes('rpe'));
  const wellnessPlayers = reachable.filter((p) => due.get(p.team_id)!.includes('wellness'));
  const dayOf = (p: PlayerRow) => local.get(p.team_id)!.date;

  // ---- 5. Wer hat schon eingetragen / ist abwesend? ------------------------
  const rpeIds = rpePlayers.map((p) => p.id);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  const [rpeDone, absences, attendance, wellnessDone] = await Promise.all([
    fetchByIds<{ player_id: string; date: string }>(rpeIds, (chunk, from, to) =>
      admin.from('rpe_entries').select('player_id, date').in('player_id', chunk).in('date', dates)
        .order('player_id').order('date').range(from, to)
    ),
    fetchByIds<{ player_id: string; from_date: string; to_date: string | null }>(rpeIds, (chunk, from, to) =>
      admin
        .from('absences')
        .select('player_id, from_date, to_date')
        .in('player_id', chunk)
        .lte('from_date', maxDate)
        .or(`to_date.is.null,to_date.gte.${minDate}`)
        .order('id')
        .range(from, to)
    ),
    fetchByIds<{ player_id: string; date: string }>(rpeIds, (chunk, from, to) =>
      admin.from('attendance').select('player_id, date').in('player_id', chunk).in('date', dates)
        .neq('status', 'da').order('player_id').order('date').range(from, to)
    ),
    fetchByIds<{ player_id: string; date: string }>(wellnessPlayers.map((p) => p.id), (chunk, from, to) =>
      admin.from('wellness_entries').select('player_id, date').in('player_id', chunk).in('date', dates)
        .order('player_id').order('date').range(from, to)
    ),
  ]);
  const rpeDoneSet = new Set(rpeDone.map((r) => key(r.player_id, r.date)));
  const notThereSet = new Set(attendance.map((a) => key(a.player_id, a.date)));
  const wellnessDoneSet = new Set(wellnessDone.map((w) => key(w.player_id, w.date)));
  const absencesByPlayer = new Map<string, { from_date: string; to_date: string | null }[]>();
  for (const a of absences) absencesByPlayer.set(a.player_id, [...(absencesByPlayer.get(a.player_id) ?? []), a]);

  // ---- 6. Empfänger bestimmen (ein Eintrag pro Konto, Art und Tag) ---------
  const candidates = new Map<string, { user_id: string; kind: ReminderKind; day: string }>();
  for (const p of rpePlayers) {
    const day = dayOf(p);
    if (rpeDoneSet.has(key(p.id, day)) || notThereSet.has(key(p.id, day))) continue;
    if ((absencesByPlayer.get(p.id) ?? []).some((a) => absenceCovers(a, day))) continue;
    candidates.set(`${p.user_id}|rpe|${day}`, { user_id: p.user_id, kind: 'rpe', day });
  }
  for (const p of wellnessPlayers) {
    const day = dayOf(p);
    if (wellnessDoneSet.has(key(p.id, day))) continue;
    candidates.set(`${p.user_id}|wellness|${day}`, { user_id: p.user_id, kind: 'wellness', day });
  }

  // ---- 7. Deduplizieren: push_log-Zeilen beanspruchen (ON CONFLICT DO NOTHING) ----
  const claimed: { user_id: string; kind: ReminderKind; day: string }[] = [];
  const rows = [...candidates.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await admin
      .from('push_log')
      .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,kind,day', ignoreDuplicates: true })
      .select('user_id, kind, day');
    if (error) throw error;
    claimed.push(...((data ?? []) as typeof claimed));
  }

  // ---- 8. Versenden ------------------------------------------------------
  const messages: ExpoMessage[] = [];
  for (const c of claimed) {
    const text = pushText(c.kind, langByUser.get(c.user_id));
    for (const token of tokensByUser.get(c.user_id) ?? []) {
      messages.push({
        to: token,
        title: text.title,
        body: text.body,
        sound: 'default',
        priority: 'high',
        data: { type: c.kind, date: c.day },
      });
    }
  }
  const { sent, invalidTokens } = await sendExpo(messages);

  if (invalidTokens.length) {
    const { error } = await admin.from('push_tokens').delete().in('token', invalidTokens);
    if (error) console.error('could not delete invalid push tokens', error);
  }

  return {
    teams: teams.length,
    rpe: claimed.filter((c) => c.kind === 'rpe').length,
    wellness: claimed.filter((c) => c.kind === 'wellness').length,
    sent,
    invalid_tokens: invalidTokens.length,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('CRON_SECRET') ?? '';
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!secret || !safeEqual(given, secret)) return json({ error: 'unauthorized' }, 401);

  try {
    const admin = adminClient();
    const now = new Date();
    const result = await run(admin, now);
    await cleanupPushLog(admin, now);
    return json({ ok: true, ...result });
  } catch (err) {
    console.error('push-reminders failed', err);
    return json({ error: 'internal' }, 500);
  }
});
