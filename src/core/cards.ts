// Karten und Sperren: Karte je Spieler und Spiel (match_stats.card: Gelb, Gelb-Rot, Rot) und daraus Sperren nach den
// Regeln des Teams (teams.settings.cards, Voreinstellung nach Altersklasse) – dazu eingetragene Sperren (Urteil,
// aufgehoben, sonstige). Eine Sperre gilt für die nächsten Spiele des Teams nach dem Auslöser: die Gelbsperre nur für
// Meisterschaftsspiele, sonst für alle Pflichtspiele (Meisterschaft und Pokal); Freundschaftsspiele zählen nie.
// Die Regeln der Verbände unterscheiden sich – deshalb ist alles einstellbar. Reine Logik.
import { groupOf } from "./classes";
import { seasonStart } from "./kasse";
import { oneLine } from "./text";
import type { CardKind, CardRules, ClassKey, Match, MatchStat, Suspension, SuspKind, Team, TeamData } from "./types";

export const CARD_KINDS: CardKind[] = ["y", "yr", "r"];
export const SUSP_KINDS: SuspKind[] = ["yellow", "yellow_red", "red", "other"];
export const SUSP_LIMITS = { games: 30, note: 200 } as const;

/**
 * Voreinstellung nach WDFV/FVN: Senioren Gelbsperre nach 5 Gelben in Meisterschaftsspielen (1 Meisterschaftsspiel),
 * Gelb-Rot 1 Spiel, Rot 2 Spiele; Jugend (Gelb-Rot statt Zeitstrafe seit 1.8.2025): keine Gelbsperre, Gelb-Rot ohne
 * Folgesperre, Rot bis zum Urteil
 */
export function defaultCardRules(cls: ClassKey): CardRules {
  return groupOf(cls) === "akt" ? { yellowLimit: 5, yellowGames: 1, yrGames: 1, redGames: 2 } : { yellowLimit: 0, yellowGames: 1, yrGames: 0, redGames: null };
}
const int = (v: unknown, lo: number, hi: number, d: number): number => { const n = Math.round(Number(v)); return v !== null && v !== "" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
/** Regeln bereinigen (Grenzen); fehlende Werte aus der Voreinstellung der Altersklasse */
export function cleanCardRules(x: unknown, cls: ClassKey): CardRules {
  const d = defaultCardRules(cls), o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    yellowLimit: int(o.yellowLimit, 0, 15, d.yellowLimit),
    yellowGames: int(o.yellowGames, 1, 5, d.yellowGames),
    yrGames: int(o.yrGames, 0, 5, d.yrGames),
    redGames: o.redGames === null ? null : o.redGames === undefined ? d.redGames : int(o.redGames, 1, SUSP_LIMITS.games, 2),
  };
}
/** Regeln des Teams */
export const cardRules = (team: Pick<Team, "cls" | "settings">): CardRules => cleanCardRules(team.settings.cards, team.cls);
/** Stimmen die Regeln mit der Voreinstellung überein? */
export const isDefaultRules = (r: CardRules, cls: ClassKey): boolean => JSON.stringify(r) === JSON.stringify(defaultCardRules(cls));

/** Karte bereinigen */
export const cleanCard = (v: unknown): CardKind | null => v === "y" || v === "yr" || v === "r" ? v : null;

/** Sperre bereinigen: entweder Spiele (0 = aufgehoben) oder „bis“ (Tag) oder offen (bis zum Urteil) */
export function cleanSuspension(x: { [K in keyof Suspension]?: unknown } & { id: string; pid: string; start: string }): Suspension {
  const kind = SUSP_KINDS.includes(x.kind as SuspKind) ? x.kind as SuspKind : "other";
  const until = typeof x.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.until) && x.until >= x.start ? x.until : null;
  return {
    id: x.id, pid: x.pid, kind, matchId: typeof x.matchId === "string" && x.matchId ? x.matchId : null, start: x.start,
    games: until || x.games == null || x.games === "" ? null : int(x.games, 0, SUSP_LIMITS.games, 1),
    until, scope: x.scope === "league" ? "league" : "all", note: oneLine(x.note, SUSP_LIMITS.note),
  };
}

const ord = (m: Pick<Match, "date" | "zeit">): string => m.date + " " + (m.zeit || "99:99");
const byOrd = (a: Match, b: Match): number => ord(a).localeCompare(ord(b)) || a.id.localeCompare(b.id);
/** Zählt ein Spiel für die Sperre? Meisterschaft immer, Pokal bei „alle Pflichtspiele“, Freundschaftsspiele nie */
export const countsFor = (scope: Suspension["scope"], m: Pick<Match, "comp">): boolean => m.comp === "liga" || (scope === "all" && m.comp === "pokal");
/** Gilt als gespielt (Sperre verbüßt): Ergebnis eingetragen oder Tag vorbei */
const played = (m: Match, today: string): boolean => !!m.result || m.date < today;

export interface CardEntry { m: Match; card: CardKind }
/** Karten eines Spielers (nach Datum), optional ab einem Tag */
export function cardsOf(D: Pick<TeamData, "matches" | "stats">, pid: string, from = ""): CardEntry[] {
  return D.matches.filter(m => m.date >= from && !!cleanCard(D.stats[m.id]?.[pid]?.card)).sort(byOrd).map(m => ({ m, card: cleanCard(D.stats[m.id][pid].card)! }));
}
/** Karten einer Saison: Gelb (davon in Meisterschaftsspielen), Gelb-Rot, Rot */
export interface CardTally { y: number; yLeague: number; yr: number; r: number }
export function cardTally(D: Pick<TeamData, "matches" | "stats">, pid: string, today: string): CardTally {
  const L = cardsOf(D, pid, seasonStart(today)).filter(x => x.m.date < seasonEnd(today));
  return { y: L.filter(x => x.card === "y").length, yLeague: L.filter(x => x.card === "y" && x.m.comp === "liga").length, yr: L.filter(x => x.card === "yr").length, r: L.filter(x => x.card === "r").length };
}
const seasonEnd = (today: string): string => `${+seasonStart(today).slice(0, 4) + 1}-07-01`;
/** Spieler mit Karten (in einem der Spiele) */
const carded = (D: Pick<TeamData, "stats">): string[] => {
  const s = new Set<string>();
  for (const m of Object.values(D.stats)) for (const [pid, x] of Object.entries(m)) if (cleanCard(x?.card)) s.add(pid);
  return [...s];
};

/**
 * Sperren aus den Karten nach den Regeln: Gelbsperre bei jeder x-ten Gelben in Meisterschaftsspielen einer Saison (die
 * Zählung beginnt danach von vorn, Gelb-Rot zählt nicht als Gelbe), Sperre nach Gelb-Rot (wenn eingestellt) und nach
 * Rot (Spiele oder bis zum Urteil)
 */
export function derivedSuspensions(D: Pick<TeamData, "matches" | "stats">, rules: CardRules): Suspension[] {
  const out: Suspension[] = [];
  const add = (pid: string, kind: SuspKind, m: Match, games: number | null, scope: Suspension["scope"]) =>
    out.push({ id: `auto:${kind}:${m.id}:${pid}`, pid, kind, matchId: m.id, start: m.date, games, until: null, scope, note: "", auto: true });
  for (const pid of carded(D)) {
    let season = "", count = 0;
    for (const { m, card } of cardsOf(D, pid)) {
      const ss = seasonStart(m.date);
      if (ss !== season) { season = ss; count = 0; }
      if (card === "y" && m.comp === "liga" && rules.yellowLimit > 0 && ++count % rules.yellowLimit === 0) add(pid, "yellow", m, rules.yellowGames, "league");
      if (card === "yr" && rules.yrGames > 0) add(pid, "yellow_red", m, rules.yrGames, "all");
      if (card === "r") add(pid, "red", m, rules.redGames, "all");
    }
  }
  return out;
}

const key = (s: Pick<Suspension, "kind" | "matchId" | "pid">) => `${s.kind}:${s.matchId}:${s.pid}`;
/** Alle Sperren: eingetragene und abgeleitete – eine eingetragene mit gleichem Auslöser, Grund und Spieler ersetzt die abgeleitete */
export function allSuspensions(D: Pick<TeamData, "matches" | "stats" | "suspensions">, rules: CardRules): Suspension[] {
  const taken = new Set(D.suspensions.filter(s => s.matchId).map(key));
  return [...D.suspensions, ...derivedSuspensions(D, rules).filter(s => !taken.has(key(s)))];
}

/** Stand einer Sperre: betroffene Spiele, wie viele noch offen sind, ob sie gilt, nächstes betroffenes Spiel */
export interface SuspState { s: Suspension; covered: Match[]; left: number | null; active: boolean; pending: boolean; next: Match | null }
export function suspState(D: Pick<TeamData, "matches">, s: Suspension, today: string): SuspState {
  const trigger = s.matchId ? D.matches.find(m => m.id === s.matchId) : undefined;
  const after = D.matches.filter(m => m.id !== s.matchId && countsFor(s.scope, m) && (trigger ? byOrd(m, trigger) > 0 : m.date >= s.start)).sort(byOrd);
  const nextOf = (L: Match[]) => L.find(m => !played(m, today)) || null;
  if (s.until) { const covered = after.filter(m => m.date <= s.until!); return { s, covered, left: null, active: s.until >= today, pending: false, next: nextOf(covered) }; }
  if (s.games == null) return { s, covered: after, left: null, active: true, pending: true, next: nextOf(after) };
  const covered = after.slice(0, s.games), left = Math.max(0, s.games - covered.filter(m => played(m, today)).length);
  return { s, covered, left, active: left > 0, pending: false, next: nextOf(covered) };
}

/** Sperren, die gerade gelten (nach nächstem betroffenen Spiel, dann Name) */
export function activeSuspensions(D: Pick<TeamData, "matches" | "stats" | "suspensions">, rules: CardRules, today: string): SuspState[] {
  return allSuspensions(D, rules).map(s => suspState(D, s, today)).filter(x => x.active)
    .sort((a, b) => (a.next ? ord(a.next) : "9").localeCompare(b.next ? ord(b.next) : "9") || a.s.start.localeCompare(b.s.start));
}
/** Sperren der Saison, die nicht mehr gelten (verbüßt, abgelaufen oder aufgehoben) */
export function pastSuspensions(D: Pick<TeamData, "matches" | "stats" | "suspensions">, rules: CardRules, today: string): SuspState[] {
  const from = seasonStart(today);
  return allSuspensions(D, rules).filter(s => s.start >= from).map(s => suspState(D, s, today)).filter(x => !x.active).sort((a, b) => b.s.start.localeCompare(a.s.start));
}
/** Gesperrt für dieses Spiel? (gültige Sperren, die das Spiel umfassen) */
export function suspendedFor(D: Pick<TeamData, "matches" | "stats" | "suspensions">, rules: CardRules, pid: string, matchId: string, today: string): SuspState[] {
  return allSuspensions(D, rules).filter(s => s.pid === pid).map(s => suspState(D, s, today)).filter(x => x.covered.some(m => m.id === matchId));
}
/** Alle für ein Spiel gesperrten Spieler (ID → Sperre) */
export function suspendedIn(D: Pick<TeamData, "matches" | "stats" | "suspensions">, rules: CardRules, matchId: string, today: string): Map<string, SuspState> {
  const out = new Map<string, SuspState>();
  for (const s of allSuspensions(D, rules)) { const x = suspState(D, s, today); if (x.covered.some(m => m.id === matchId) && !out.has(s.pid)) out.set(s.pid, x); }
  return out;
}

/** Gelb-Warnung: Spieler, die bei der nächsten Gelben in einem Meisterschaftsspiel gesperrt sind (aktuelle Saison) */
export function yellowWarnings(D: Pick<TeamData, "matches" | "stats">, rules: CardRules, today: string): { pid: string; count: number }[] {
  if (rules.yellowLimit < 2) return [];
  return carded(D).map(pid => ({ pid, count: cardTally(D, pid, today).yLeague })).filter(x => x.count % rules.yellowLimit === rules.yellowLimit - 1);
}

/** Karte im Spielbericht setzen: vorhandene Werte bleiben; ohne Karte und ohne Werte wird der Eintrag gelöscht (null) */
export function withCard(st: MatchStat | undefined, card: CardKind | null): MatchStat | null {
  if (st) { const x: MatchStat = { ...st, card }; return card || x.min || x.goals || x.assists || x.pre ? x : null; }
  return card ? { min: 0, goals: 0, assists: 0, start: false, card } : null;
}
