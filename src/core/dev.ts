// Spielerentwicklung (Paket C): positionsspezifische Kompetenzprofile mit Einschätzung durch Trainerteam und Spieler,
// messbare Ziele mit automatischem Fortschritt, Entwicklungsgespräche (Vorbereitung aus den Daten), Saisonrückblick
// und Individualtraining-Anfragen. Reine Logik ohne UI und ohne Datenbank.
//
// Grundlagen: Zielsetzung nach Locke & Latham (2002) – konkrete, herausfordernde, erreichbare Ziele mit Rückmeldung;
// Prozessziele sind für junge Spieler besser kontrollierbar als Ergebnisziele (Kingston & Hardy 1997); Selbsteinschätzung
// und Mitsprache stärken Autonomie und Motivation (Selbstbestimmungstheorie, Deci & Ryan 2000); Unterschiede zwischen
// Selbst- und Fremdbild sind Gesprächsanlässe, keine Urteile.
import { addDays, clamp, diff, sum } from "./dates";
import type { Engine } from "./engine";
import { seasonStart } from "./kasse";
import { allTests, customsOf, isCustomTest, resultsOf, testDef } from "./perf";
import { isGoalkeeper } from "./units";
import type {
  Agreement, Assessment, DayUnit, DevArea, DevTalk, Goal, GoalEntry, GoalStat, Group, IndivRequest, IndivTopic, Player, StaffProfile, TeamData, TestKey, UnitArt,
} from "./types";

export const DEV_AREAS: DevArea[] = ["tech", "takt", "ath", "ment"];

// ---------- Kompetenzprofil ----------
/** Positionsgruppen: Torhüter, Innenverteidiger, Außenverteidiger, zentrales Mittelfeld, Flügel, Sturm; Kinder (U11) einheitlich */
export type PosGroup = "tw" | "iv" | "av" | "zm" | "fl" | "st" | "kid";
export const POS_GROUPS: PosGroup[] = ["tw", "iv", "av", "zm", "fl", "st", "kid"];
/** Je Positionsgruppe vier (Kinder: zwei bis fünf) Kompetenzen pro Bereich – Schlüssel für Texte cp_* (Trainer) und cps_* (Ich-Form) */
export const COMPETENCIES: Record<PosGroup, Record<DevArea, string[]>> = {
  tw: { tech: ["tw_fang", "tw_fall", "tw_hoch", "tw_fuss", "tw_abw"], takt: ["tw_stell", "tw_raum", "tw_1v1", "aufbau"], ath: ["reakt", "sprung", "schnell", "koord"], ment: ["komm", "fehler", "mut", "konz"] },
  iv: { tech: ["ballan", "pass", "kopf", "beid"], takt: ["zweik", "kette", "aufbau", "absich"], ath: ["schnell", "kraft", "sprung", "ausd"], ment: ["komm", "fuehr", "konz", "fehler"] },
  av: { tech: ["ballan", "pass", "flanke", "dribb"], takt: ["zweik", "kette", "hinterl", "umschalt"], ath: ["ausd", "schnell", "kraft", "koord"], ment: ["einsatz", "konz", "komm", "lern"] },
  zm: { tech: ["ballan", "pass", "dribb", "schuss"], takt: ["orient", "raum", "entsch", "gegenpr"], ath: ["ausd", "schnell", "koord", "kraft"], ment: ["komm", "einsatz", "mut", "lern"] },
  fl: { tech: ["dribb", "flanke", "schuss", "beid"], takt: ["tiefe", "umschalt", "rueckw", "entsch"], ath: ["schnell", "ausd", "koord", "kraft"], ment: ["mut", "einsatz", "fehler", "lern"] },
  st: { tech: ["abschl", "kopf", "festm", "beid"], takt: ["laufweg", "tiefe", "gegenpr", "entsch"], ath: ["schnell", "kraft", "sprung", "koord"], ment: ["mut", "fehler", "einsatz", "konz"] },
  kid: { tech: ["ballan", "dribb", "pass", "schuss", "beid"], takt: ["anbieten", "zweik"], ath: ["schnell", "koord"], ment: ["einsatz", "team", "mut", "lern"] },
};
/** Positionsgruppe eines Spielers (U11: einheitliches Kinderprofil) */
export function posGroupOf(D: Pick<TeamData, "groups">, p: Player, grp: Group): PosGroup {
  if (grp === "u11") return "kid";
  if (isGoalkeeper(D, p)) return "tw";
  switch (p.pos) {
    case "IV": return "iv";
    case "RV": case "LV": return "av";
    case "LM": case "RM": return "fl";
    case "ST": return "st";
    default: return "zm";
  }
}
export const compsOf = (pg: PosGroup): { area: DevArea; key: string }[] => DEV_AREAS.flatMap(area => COMPETENCIES[pg][area].map(key => ({ area, key })));
/** Stufen 1–5 (relativ zur Altersklasse): Grundlagen, in Entwicklung, solide, Stärke, herausragend */
export const LEVELS = [1, 2, 3, 4, 5] as const;

/** Neueste Einschätzung (Trainerteam bzw. selbst); `before` = vorherige */
export function assessmentsOf(D: Pick<TeamData, "assessments">, pid: string, by: "coach" | "self", onlyVisible = false): Assessment[] {
  return D.assessments.filter(a => a.pid === pid && a.by === by && (!onlyVisible || by === "self" || a.vis)).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
/** Mittel eines Bereichs (nur bewertete Kompetenzen) */
export function areaAvg(a: Assessment | undefined, pg: PosGroup, area: DevArea): number | null {
  if (!a) return null;
  const v = COMPETENCIES[pg][area].map(k => a.scores[k]).filter((x): x is number => typeof x === "number" && x >= 1 && x <= 5);
  return v.length ? sum(v) / v.length : null;
}
export interface Gap { key: string; area: DevArea; coach: number; self: number; diff: number }
/**
 * Unterschiede zwischen Selbst- und Fremdbild (ab 2 Stufen): Gesprächsanlässe. Positiv = Spieler schätzt sich höher ein.
 * Sortiert nach Größe des Unterschieds.
 */
export function gapsOf(coach: Assessment | undefined, self: Assessment | undefined, pg: PosGroup, min = 2): Gap[] {
  if (!coach || !self) return [];
  return compsOf(pg).map(({ area, key }) => ({ key, area, coach: coach.scores[key], self: self.scores[key] }))
    .filter((x): x is { key: string; area: DevArea; coach: number; self: number } => typeof x.coach === "number" && typeof x.self === "number")
    .map(x => ({ ...x, diff: x.self - x.coach })).filter(x => Math.abs(x.diff) >= min).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}
/** Nur gültige Werte 1–5 für Kompetenzen der Positionsgruppe */
export function cleanScores(scores: Record<string, number>, pg: PosGroup): Record<string, number> {
  const keys = new Set(compsOf(pg).map(x => x.key)), out: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores || {})) if (keys.has(k) && Number.isInteger(v) && v >= 1 && v <= 5) out[k] = v;
  return out;
}

// ---------- Ziele ----------
export interface GoalState {
  /** aktueller Wert (null = noch keine Messung) */ cur: number | null;
  start: number | null; target: number | null;
  /** Fortschritt 0–1 */ pct: number | null; reached: boolean;
  /** erwarteter Fortschritt nach der verstrichenen Zeit (0–1) und ob das Ziel deutlich hinterherhinkt */ expected: number | null; behind: boolean;
}
/** Spielstatistik seit einem Datum (Torhüter: Spiele zu null ab 60 Minuten) */
export function statSince(D: Pick<TeamData, "matches" | "stats">, pid: string, stat: GoalStat, from: string, today: string): number {
  const L = D.matches.filter(m => m.date >= from && m.date <= today).map(m => D.stats[m.id]?.[pid]).filter((x): x is NonNullable<typeof x> => !!x);
  switch (stat) {
    case "goals": return sum(L.map(x => x.goals));
    case "assists": return sum(L.map(x => x.assists));
    case "minutes": return sum(L.map(x => x.min));
    case "games": return L.filter(x => x.min > 0).length;
    case "starts": return L.filter(x => x.min > 0 && x.start).length;
    case "clean": return L.filter(x => x.min >= 60 && x.conceded === 0).length;
  }
}
/** Beteiligung in % seit einem Datum (verletzt/krank zählt nicht mit) */
export function attSince(D: Pick<TeamData, "sessions" | "att" | "absences">, pid: string, from: string, today: string): number | null {
  const ab = (d: string) => D.absences.find(a => a.pid === pid && a.von <= d && (!a.bis || d <= a.bis) && (a.typ === "verletzung" || a.typ === "krank"));
  const ss = D.sessions.filter(s => s.date >= from && s.date <= today && !ab(s.date));
  if (!ss.length) return null;
  return Math.round(ss.filter(s => D.att[s.date]?.[pid] === "da").length / ss.length * 100);
}
export function goalProgress(D: TeamData, g: Goal, today: string): GoalState {
  const entries = D.goalEntries.filter(e => e.goalId === g.id).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  let cur: number | null = null, start = g.start, target = g.target;
  switch (g.metric) {
    case "test": {
      const L = g.test ? resultsOf(D, g.pid, g.test).filter(r => r.date >= g.from) : [];
      cur = L.length ? L[0].value : null; break;
    }
    case "stat": cur = g.stat ? statSince(D, g.pid, g.stat, g.from, today) : null; start = start ?? 0; break;
    case "att": cur = attSince(D, g.pid, g.from, today); break;
    case "count": cur = sum(entries.map(e => e.value)); start = start ?? 0; break;
    case "value": cur = entries.length ? entries[entries.length - 1].value : null; break;
    case "check": cur = g.steps.filter(s => s.done).length; start = 0; target = g.steps.length || 1; break;
  }
  const lower = g.metric === "test" && g.test ? testDef(g.test, customsOf(D)).lower : g.lower;
  let pct: number | null = null, reached = false;
  if (cur != null && target != null) {
    reached = lower ? cur <= target : cur >= target;
    if (start != null && start !== target) pct = clamp(lower ? (start - cur) / (start - target) : (cur - start) / (target - start), 0, 1);
    else pct = reached ? 1 : 0;
  }
  let expected: number | null = null;
  if (g.due && g.due > g.from) expected = clamp(diff(g.from, today) / diff(g.from, g.due), 0, 1);
  const behind = g.status === "active" && expected != null && expected >= 0.25 && (pct ?? 0) < expected - 0.2 && !reached;
  return { cur, start, target, pct, reached, expected, behind };
}
/** Startwert für ein neues Ziel aus vorhandenen Daten (Test: letzter Wert, Statistik: 0, Beteiligung: letzte 4 Wochen) */
export function suggestStart(D: TeamData, pid: string, metric: Goal["metric"], test: TestKey | null, today: string): number | null {
  if (metric === "test" && test) return resultsOf(D, pid, test)[0]?.value ?? null;
  if (metric === "att") return attSince(D, pid, addDays(today, -28), today);
  if (metric === "stat" || metric === "count") return 0;
  return null;
}
export const goalsOf = (D: Pick<TeamData, "goals">, pid: string, onlyVisible = false): Goal[] =>
  D.goals.filter(g => g.pid === pid && (!onlyVisible || g.vis)).sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || (a.due || "9999") .localeCompare(b.due || "9999"));
/** Einheit/Anzeige des Ziels: Test-Einheit, %, eigene Einheit */
export function goalUnit(g: Goal): string {
  // eigener Test: Einheit steht im Ziel (beim Anlegen übernommen)
  if (g.metric === "test" && g.test) return isCustomTest(g.test) ? g.unit : testDef(g.test).unit;
  if (g.metric === "att") return "%";
  return g.unit;
}
/** Höchstens so viele aktive Ziele je Spieler (Fokus statt Liste) */
export const MAX_ACTIVE_GOALS = 5;

// ---------- Entwicklungsgespräch ----------
export interface TalkPrep {
  strengths: string[]; focus: string[]; gaps: Gap[]; open: Agreement[]; goals: { g: Goal; s: GoalState }[];
  last: DevTalk | null; selfFresh: boolean;
}
/**
 * Vorbereitung eines Gesprächs aus den Daten: Stärken (beste Kompetenzen, Bestleistungen, gute Trainingseindrücke),
 * Entwicklungsfelder (schwächste Kompetenzen, Beteiligung, Belastung), Unterschiede Selbst-/Fremdbild,
 * offene Vereinbarungen und Ziele. Texte sind i18n-Schlüssel mit Platzhaltern („key|a=b“) – die Oberfläche übersetzt.
 */
export function prepTalk(E: Engine, pid: string): TalkPrep {
  const D = E.D, p = E.P(pid)!, pg = posGroupOf(D, p, E.grp);
  const coach = assessmentsOf(D, pid, "coach")[0], self = assessmentsOf(D, pid, "self")[0];
  const strengths: string[] = [], focus: string[] = [];
  if (coach) {
    const sc = compsOf(pg).map(x => ({ ...x, v: coach.scores[x.key] })).filter(x => typeof x.v === "number");
    sc.filter(x => x.v >= 4).sort((a, b) => b.v - a.v).slice(0, 3).forEach(x => strengths.push(`dv_pComp|k=${x.key}|v=${x.v}`));
    sc.filter(x => x.v <= 2).sort((a, b) => a.v - b.v).slice(0, 3).forEach(x => focus.push(`dv_pComp|k=${x.key}|v=${x.v}`));
  }
  for (const d of allTests(D)) {
    const L = resultsOf(D, pid, d.key); if (L.length < 2 || !L[L.length - 1].value) continue;
    const ch = (L[0].value - L[L.length - 1].value) / L[L.length - 1].value * (d.lower ? -1 : 1);
    if (ch >= 0.03) strengths.push(`dv_pTest|t=${d.key}|p=${Math.round(ch * 100)}`);
  }
  const f = E.trainForm(pid);
  if (f.good >= 2) strengths.push(`dv_pGood|n=${f.good}`);
  if (f.poor >= 2) focus.push(`dv_pPoor|n=${f.poor}`);
  const att = E.mods.beteiligung ? E.attendance(pid) : null;
  if (att != null && att >= 0.9) strengths.push(`dv_pAtt|a=${Math.round(att * 100)}`);
  if (att != null && att < 0.75) focus.push(`dv_pAttLow|a=${Math.round(att * 100)}`);
  const goals = goalsOf(D, pid).filter(g => g.status === "active").map(g => ({ g, s: goalProgress(D, g, E.TODAY) }));
  goals.filter(x => x.s.reached).forEach(x => strengths.push(`dv_pGoal|t=${x.g.title}`));
  goals.filter(x => x.s.behind).forEach(x => focus.push(`dv_pGoalBehind|t=${x.g.title}`));
  const talks = D.talks.filter(t => t.pid === pid).sort((a, b) => a.date < b.date ? 1 : -1), last = talks[0] || null;
  const open = last ? last.agreements.filter(a => !a.done) : [];
  return { strengths, focus, gaps: gapsOf(coach, self, pg), open, goals, last, selfFresh: !!self && diff(self.date, E.TODAY) <= 30 };
}

// ---------- Saisonrückblick ----------
export interface SeasonReview {
  from: string; sessions: number; attended: number; att: number | null;
  games: number; minutes: number; goals: number; assists: number; clean: number | null;
  good: number; poor: number;
  tests: { key: TestKey; first: number; last: number; better: boolean; pct: number }[];
  goalsDone: number; goalsTotal: number; challenges: number;
  areas: { area: DevArea; first: number | null; last: number | null }[];
  talks: number; closing: DevTalk | null;
}
/** Rückblick auf die laufende Saison (ab 1. Juli) – auch „Saison bisher“; Spieler sehen nur Freigegebenes */
export function seasonReview(E: Engine, pid: string, forPlayer = false): SeasonReview {
  const D = E.D, today = E.TODAY, from = seasonStart(today), p = E.P(pid)!, pg = posGroupOf(D, p, E.grp);
  const ss = D.sessions.filter(s => s.date >= from && s.date <= today);
  const attended = ss.filter(s => D.att[s.date]?.[pid] === "da").length;
  const marks = D.ratings.filter(r => r.pid === pid && r.kind === "training" && r.mark && r.date >= from && (!forPlayer || r.vis));
  const tests = allTests(D).map(d => {
    const L = resultsOf(D, pid, d.key).filter(r => r.date >= from); if (L.length < 2 || !L[L.length - 1].value) return null;
    const first = L[L.length - 1].value, last = L[0].value, better = d.lower ? last < first : last > first;
    return { key: d.key, first, last, better, pct: Math.round(Math.abs(last - first) / first * 1000) / 10 };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const goals = D.goals.filter(g => g.pid === pid && (g.from >= from || g.status === "active") && (!forPlayer || g.vis));
  const coach = assessmentsOf(D, pid, "coach", forPlayer).filter(a => a.date >= from);
  const gk = isGoalkeeper(D, p);
  const talks = D.talks.filter(t => t.pid === pid && t.date >= from && (!forPlayer || t.vis)).sort((a, b) => a.date < b.date ? 1 : -1);
  return {
    from, sessions: ss.length, attended, att: ss.length ? Math.round(attended / ss.length * 100) : null,
    games: statSince(D, pid, "games", from, today), minutes: statSince(D, pid, "minutes", from, today),
    goals: statSince(D, pid, "goals", from, today), assists: statSince(D, pid, "assists", from, today),
    clean: gk ? statSince(D, pid, "clean", from, today) : null,
    good: marks.filter(r => r.mark === "good").length, poor: marks.filter(r => r.mark === "poor").length,
    tests, goalsDone: goals.filter(g => g.status === "done").length, goalsTotal: goals.length,
    challenges: D.chEntries.filter(e => e.pid === pid && e.done && D.challenges.find(c => c.id === e.cid && c.ws >= addDays(from, -6))).length,
    areas: DEV_AREAS.map(area => ({ area, first: areaAvg(coach[coach.length - 1], pg, area), last: areaAvg(coach[0], pg, area) })),
    talks: talks.length, closing: talks.find(t => t.kind === "end") || null,
  };
}

// ---------- Individualtraining ----------
export const INDIV_TOPICS: IndivTopic[] = ["technik", "schuss", "kopf", "schwach", "athletik", "tw", "taktik", "video", "reha", "mental", "sonst"];
const TOPIC_ART: Record<IndivTopic, UnitArt> = {
  technik: "technik", schuss: "technik", kopf: "technik", schwach: "technik", athletik: "athletik", tw: "tw", taktik: "taktik", video: "taktik", reha: "reha", mental: "sonst", sonst: "sonst",
};
/** Einheit für eine angenommene Anfrage (nur für diesen Spieler; Belastung über die normale RPE je Einheit) */
export function indivUnit(r: IndivRequest, slot: number, zeit: string, dauer: number, staffId: string | null, title: string): DayUnit {
  const art = TOPIC_ART[r.topic] || "sonst";
  return { slot, art, title: title.slice(0, 60), zeit, dauer, rpe: art === "athletik" ? 6 : art === "reha" ? 3 : 4, groupId: null, staffId, inhalt: r.note.slice(0, 2000), themes: [], pids: [r.pid] };
}
/** Offene Anfragen (älteste zuerst) */
export const openRequests = (D: Pick<TeamData, "indiv">): IndivRequest[] => D.indiv.filter(r => r.status === "open").sort((a, b) => a.created < b.created ? -1 : 1);
/** Höchstens so viele offene Anfragen je Spieler */
export const MAX_OPEN_REQUESTS = 2;
/** Passender Trainer für ein Thema (Vorauswahl beim Anfragen): Torwart → TW-Trainer, Athletik → Athletiktrainer, Reha → Physio */
export function suggestStaff(topic: IndivTopic, staff: Pick<StaffProfile, "id" | "role">[]): string | null {
  const by = (...roles: string[]) => { for (const r of roles) { const s = staff.find(x => x.role === r); if (s) return s.id; } return null; };
  return topic === "tw" ? by("tw") : topic === "athletik" ? by("athletik", "physio") : topic === "reha" ? by("physio", "athletik") : null;
}

/** Gültiges Ziel (Grenzen wie in der Datenbank) */
export function cleanGoal(g: Goal): Goal {
  const num = (v: number | null): number | null => v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100;
  return {
    ...g, title: g.title.trim().slice(0, 120), unit: (g.unit || "").trim().slice(0, 20), why: (g.why || "").slice(0, 1000),
    start: num(g.start), target: g.metric === "check" ? null : num(g.target),
    steps: (g.steps || []).filter(s => s.text.trim()).slice(0, 10).map(s => ({ text: s.text.trim().slice(0, 200), done: !!s.done })),
    test: g.metric === "test" ? g.test : null, stat: g.metric === "stat" ? g.stat : null,
  };
}
export const agreementId = (): string => "a" + Math.random().toString(36).slice(2, 10);
/** Einträge eines Ziels (neueste zuerst) */
export const entriesOfGoal = (D: Pick<TeamData, "goalEntries">, goalId: string): GoalEntry[] => D.goalEntries.filter(e => e.goalId === goalId).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
