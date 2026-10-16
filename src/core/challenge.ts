// Wochenchallenge (optional): kleine Aufgaben für zu Hause – Technik, Ballgefühl, Gewohnheiten –, besonders für jüngere
// Spieler. Bewertet wird die persönliche Verbesserung und ein gemeinsames Teamziel, nicht der Vergleich untereinander
// (aufgabenorientiertes Motivationsklima, Ames 1992; Duda 2001). Eine Bestenliste ist nur auf Wunsch des Trainerteams an.
import { monday } from "./dates";
import type { Challenge, ChallengeEntry, ChallengeKind, ChallengeTotals, Group, Player, TeamData } from "./types";

export interface ChallengeDef { key: string; kind: ChallengeKind; unit: string; target: number | null; teamTarget: number | null; lower?: boolean; groups: Group[] }
/** Vorschläge je Altersgruppe (Texte: chk_<key> Titel, chkd_<key> Anleitung) – bewusst ohne maximale Kraftbelastung für Kinder */
export const CHALLENGES: ChallengeDef[] = [
  { key: "jonglier", kind: "best", unit: "x", target: null, teamTarget: null, groups: ["u11", "u15"] },
  { key: "jonglierSchwach", kind: "best", unit: "x", target: null, teamTarget: null, groups: ["u15", "u19", "akt"] },
  { key: "wand60", kind: "best", unit: "x", target: null, teamTarget: null, groups: ["u11", "u15", "u19"] },
  { key: "mastery", kind: "days", unit: "d", target: 5, teamTarget: null, groups: ["u11", "u15", "u19", "akt"] },
  { key: "schwach100", kind: "count", unit: "x", target: 100, teamTarget: 2000, groups: ["u11", "u15"] },
  { key: "schwach1000", kind: "count", unit: "x", target: 1000, teamTarget: 15000, groups: ["u19", "akt"] },
  { key: "trick", kind: "check", unit: "", target: null, teamTarget: null, groups: ["u11", "u15"] },
  { key: "ecken", kind: "best", unit: "x", target: 5, teamTarget: null, groups: ["u11", "u15", "u19"] },
  { key: "seil", kind: "best", unit: "x", target: null, teamTarget: null, groups: ["u11", "u15"] },
  { key: "fair", kind: "check", unit: "", target: null, teamTarget: null, groups: ["u11", "u15"] },
  { key: "schlaf", kind: "days", unit: "d", target: 5, teamTarget: null, groups: ["u15", "u19", "akt"] },
  { key: "mobility", kind: "days", unit: "d", target: 4, teamTarget: null, groups: ["u15", "u19", "akt"] },
  { key: "copenhagen", kind: "best", unit: "s", target: 30, teamTarget: null, groups: ["u19", "akt"] },
  { key: "video", kind: "check", unit: "", target: null, teamTarget: null, groups: ["u15", "u19", "akt"] },
  { key: "trinken", kind: "days", unit: "d", target: 5, teamTarget: null, groups: ["u15", "u19", "akt"] },
];
export const challengeDefsFor = (g: Group): ChallengeDef[] => CHALLENGES.filter(c => c.groups.includes(g));

/** Challenges einer Woche (Montag), die für den Spieler gelten (Gruppe oder alle) */
export function weekChallenges(D: Pick<TeamData, "challenges">, date: string, p?: Player): Challenge[] {
  const ws = monday(date);
  return D.challenges.filter(c => c.ws === ws && (!p || !c.groupId || (p.groups || []).includes(c.groupId)));
}
export const entryOf = (D: Pick<TeamData, "chEntries">, cid: string, pid: string): ChallengeEntry | undefined => D.chEntries.find(e => e.cid === cid && e.pid === pid);

/** Geschafft? Bestleistung: Ziel erreicht (ohne Ziel: ein Versuch eingetragen); Menge/Tage: Ziel erreicht; Abhaken: erledigt */
export function isDone(c: Challenge, e: ChallengeEntry | undefined): boolean {
  if (!e) return false;
  switch (c.kind) {
    case "check": return e.done;
    case "days": return e.days.length >= (c.target || 1);
    case "count": return (e.value || 0) >= (c.target || 1);
    case "best": return e.value != null && (c.target == null || (c.lower ? e.value <= c.target : e.value >= c.target));
  }
}
/** Fortschritt 0–1 für die Anzeige */
export function progressOf(c: Challenge, e: ChallengeEntry | undefined): number {
  if (!e) return 0;
  if (isDone(c, e)) return 1;
  switch (c.kind) {
    case "days": return Math.min(1, e.days.length / (c.target || 1));
    case "count": return Math.min(1, (e.value || 0) / (c.target || 1));
    case "best": return c.target && e.value != null && !c.lower ? Math.min(1, e.value / c.target) : e.value != null ? 0.5 : 0;
    default: return 0;
  }
}
/** Neuer Eintrag: Bestleistung behält den besseren Wert, Menge addiert, Tage zählen je Tag einmal, Abhaken setzt erledigt */
export function applyChallenge(c: Challenge, e: ChallengeEntry | undefined, pid: string, input: { value?: number | null; day?: string; done?: boolean }, now: string): ChallengeEntry {
  const base: ChallengeEntry = e ? { ...e, days: [...e.days] } : { cid: c.id, pid, value: null, days: [], done: false, at: now };
  if (c.kind === "best" && input.value != null) base.value = base.value == null ? input.value : c.lower ? Math.min(base.value, input.value) : Math.max(base.value, input.value);
  if (c.kind === "count" && input.value != null) base.value = Math.max(0, (base.value || 0) + input.value);
  if (c.kind === "days" && input.day) base.days = base.days.includes(input.day) ? base.days.filter(d => d !== input.day) : [...base.days, input.day].sort();
  if (c.kind === "check" && input.done != null) base.done = input.done;
  if (c.kind === "days") base.value = base.days.length;
  base.done = isDone(c, base); base.at = now;
  return base;
}
/** Teamsumme (Trainerteam rechnet selbst; Spieler bekommen sie vom Server) */
export function totalsOf(D: Pick<TeamData, "chEntries" | "players" | "chTotals">, c: Challenge, withTop: boolean): ChallengeTotals {
  if (D.chTotals[c.id]) return D.chTotals[c.id];
  const L = D.chEntries.filter(e => e.cid === c.id && D.players.some(p => p.id === e.pid));
  const top = withTop && c.kind === "best" ? L.filter(e => e.value != null).sort((a, b) => c.lower ? a.value! - b.value! : b.value! - a.value!).slice(0, 3)
    .map(e => { const p = D.players.find(q => q.id === e.pid)!; return { name: p.vn + (p.nn ? " " + p.nn[0] + "." : ""), value: e.value! }; }) : [];
  return { cid: c.id, players: L.length, done: L.filter(e => isDone(c, e)).length, sum: L.reduce((a, e) => a + (e.value || 0), 0), top };
}
/** Neue Challenge aus einem Vorschlag (Texte übersetzt die Oberfläche) */
export function fromDef(def: ChallengeDef, ws: string, id: string, title: string, text: string): Challenge {
  return { id, ws, title: title.slice(0, 80), text: text.slice(0, 600), kind: def.kind, unit: def.unit, target: def.target, teamTarget: def.teamTarget, lower: !!def.lower, groupId: null, key: def.key };
}
/** Serie: Wochen in Folge mit geschaffter Challenge (bis zur letzten Woche mit Challenge) */
export function challengeStreak(D: Pick<TeamData, "challenges" | "chEntries">, pid: string, today: string): number {
  const weeks = [...new Set(D.challenges.filter(c => c.ws <= monday(today)).map(c => c.ws))].sort().reverse();
  let n = 0;
  for (const ws of weeks) {
    const done = D.challenges.filter(c => c.ws === ws).some(c => isDone(c, entryOf(D, c.id, pid)));
    if (done) n++; else if (ws < monday(today)) break;
  }
  return n;
}
