// Verein (Vereinsabo, Paket D): mehrere Teams eines Vereins in einer Übersicht, Funktionäre mit Rechten,
// Spieler hochziehen bzw. wechseln und Ankündigungen an die Teams.
// Durchgesetzt wird serverseitig (supabase/migrations/…25_verein.sql): Der Zugriff eines Funktionärs ist eine
// Zeile im Trainerteam des jeweiligen Teams (verwaltet vom Verein) – damit gelten alle Zugriffsregeln unverändert.
import { addDays, iso } from "./dates";
import { shareState } from "./matchplan";
import { effectivePerms, PERMS, type Perm } from "./perms";
import type { ClassKey, TeamData } from "./types";

/** Funktionen im Verein (Reihenfolge = Anzeige); „team“ = Trainerteam eines verbundenen Teams, „pending“ = Anfrage */
export type ClubRole = "admin" | "leiter" | "nlz" | "koord";
export type ClubAccess = ClubRole | "team" | "pending";
export const CLUB_ROLES: ClubRole[] = ["admin", "leiter", "nlz", "koord"];

/** Standardrechte je Funktion in den Teams (identisch mit public.club_default_perms) – sparsam: keine Gesundheitsdaten */
export const CLUB_PERMS: Record<ClubRole, Perm[]> = {
  admin: ["plan", "squad"],
  leiter: ["plan", "squad", "perf", "notes", "tasks"],
  nlz: ["plan", "squad", "perf", "notes", "tasks"],
  koord: ["plan", "squad"],
};

export interface ClubInfo {
  id: string; name: string; accent: string;
  /** eigene Funktion */
  role: ClubAccess; title: string;
  /** Codes nur für Vereinsadmins */
  linkCode: string | null; staffCode: string | null;
  /** Anzahl Teams im Verein */
  teams: number;
}
export interface ClubStaffEntry { userId: string; role: ClubRole | "pending"; title: string; perms: Perm[]; /** null = alle Teams */ teams: string[] | null; displayName: string }
export interface ClubTeam { teamId: string; club: string; name: string; cls: ClassKey; /** eigener Zugriff auf das Team */ access: boolean }
export type PlanState = "none" | "draft" | "scheduled" | "live" | "ended";
/** Kennzahlen eines Teams für die Vereinsübersicht – nur Zahlen, keine Daten einzelner Spieler */
export interface TeamSummary {
  teamId: string; name: string; cls: ClassKey; players: number; coach: string | null;
  next: { date: string; time: string; opp: string; home: boolean } | null;
  last: { date: string; opp: string; own: number; against: number } | null;
  won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number;
  /** nur mit Recht „Kader“ (sonst null) */
  injured: number | null; sick: number | null; absent: number | null;
  /** Anwesenheit der letzten 28 Tage (0–1; null = ohne Recht oder keine Einträge) */
  attRate: number | null;
  sessions28: number;
  /** Matchplan zum nächsten Spiel (nur mit Recht „Matchplan & Planung“) */
  planState: PlanState | null;
}

export const isClubRole = (r: string | null | undefined): r is ClubRole => !!r && (CLUB_ROLES as string[]).includes(r);
/** Funktionär (nicht nur Trainerteam eines verbundenen Teams, keine offene Anfrage) */
export const isOfficial = (c: Pick<ClubInfo, "role"> | null | undefined): boolean => !!c && isClubRole(c.role);
export const isClubAdmin = (c: Pick<ClubInfo, "role"> | null | undefined): boolean => c?.role === "admin";
/** Nur bekannte Rechte, sortiert wie PERMS */
export const cleanClubPerms = (p: readonly string[] | null | undefined): Perm[] => PERMS.filter(x => (p || []).includes(x));

/** Saisonbeginn (1. Juli) zum Datum – wie in public.club_overview */
export function seasonOf(today: string): string {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  return `${m < 7 ? y - 1 : y}-07-01`;
}

/** Kennzahlen eines Teams aus den Teamdaten (Demo; der Server rechnet dasselbe in club_overview) */
export function teamSummary(D: TeamData, now: Date, o: { squad: boolean; plan: boolean }): TeamSummary {
  const today = iso(now), season = seasonOf(today), from28 = addDays(today, -28);
  const active = new Set(D.players.map(p => p.id));
  const ms = [...D.matches].sort((a, b) => a.date === b.date ? (a.zeit < b.zeit ? -1 : 1) : a.date < b.date ? -1 : 1);
  const nm = ms.find(m => m.date >= today) || null;
  const played = ms.filter(m => m.date <= today && m.result);
  const lm = played.length ? played[played.length - 1] : null;
  const inSeason = played.filter(m => m.date >= season);
  const absNow = (typ: (t: string) => boolean): number => new Set(D.absences.filter(a => active.has(a.pid) && typ(a.typ) && a.von <= today && (!a.bis || a.bis >= today)).map(a => a.pid)).size;
  let att: number | null = null;
  if (o.squad) {
    let n = 0, da = 0;
    for (const [d, row] of Object.entries(D.att)) if (d > from28 && d <= today) for (const st of Object.values(row)) { n++; if (st === "da") da++; }
    att = n ? Math.round(da / n * 1000) / 1000 : null;
  }
  let planState: PlanState | null = null;
  if (o.plan && nm) { const p = D.plans.find(x => x.matchId === nm.id); planState = p ? shareState(p, now) : "none"; }
  return {
    teamId: D.team.id, name: D.team.name, cls: D.team.cls, players: D.players.length,
    coach: D.staff.find(x => x.role === "chef")?.name || null,
    next: nm ? { date: nm.date, time: nm.zeit, opp: nm.gegner, home: nm.heim } : null,
    last: lm && lm.result ? { date: lm.date, opp: lm.gegner, own: lm.result.own, against: lm.result.opp } : null,
    won: inSeason.filter(m => m.result!.own > m.result!.opp).length,
    drawn: inSeason.filter(m => m.result!.own === m.result!.opp).length,
    lost: inSeason.filter(m => m.result!.own < m.result!.opp).length,
    goalsFor: inSeason.reduce((a, m) => a + m.result!.own, 0), goalsAgainst: inSeason.reduce((a, m) => a + m.result!.opp, 0),
    injured: o.squad ? absNow(t => t === "verletzung") : null,
    sick: o.squad ? absNow(t => t === "krank") : null,
    absent: o.squad ? absNow(t => t !== "verletzung" && t !== "krank") : null,
    attRate: att,
    sessions28: D.sessions.filter(s => s.typ === "Training" && s.date > from28 && s.date <= today).length,
    planState,
  };
}

/** Summen für den Kopf der Vereinsübersicht */
export function clubTotals(list: TeamSummary[], today: string): { teams: number; players: number; injured: number | null; matches7: number } {
  const known = list.filter(x => x.injured != null);
  return {
    teams: list.length,
    players: list.reduce((a, x) => a + x.players, 0),
    injured: known.length ? known.reduce((a, x) => a + (x.injured || 0), 0) : null,
    matches7: list.filter(x => x.next && x.next.date <= addDays(today, 6)).length,
  };
}

/** Ziel für Hochziehen/Wechsel: Teams, in denen man den Kader verwalten darf (gleicher Verein oder beide eigene Teams) */
export interface MoveTarget { teamId: string; club: string; name: string; role: string; perms?: string[] | null; clubId?: string | null }
export function moveTargets<M extends MoveTarget>(ms: M[], current: { teamId: string; role: string; clubId?: string | null }): M[] {
  return ms.filter(m => m.teamId !== current.teamId && (m.role === "owner" || m.role === "coach" || m.role === "physio")
    && effectivePerms(m.role, m.perms).has("squad")
    && ((!!current.clubId && m.clubId === current.clubId) || (current.role === "owner" && m.role === "owner")));
}
/** Belastung, Morgen-Checks und Ausfälle mitnehmen: Recht „Gesundheitsdaten“ in beiden Teams */
export const canCopyHealth = (from: { role: string; perms?: string[] | null }, to: { role: string; perms?: string[] | null }): boolean =>
  effectivePerms(from.role, from.perms).has("health") && effectivePerms(to.role, to.perms).has("health");
