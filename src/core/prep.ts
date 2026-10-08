// Vorbereitung & längere Pausen: Periodisierung, Spielerprogramm, Umsetzung (reine Berechnung).
//
// Sportwissenschaftliche Grundlagen (Kurzfassung, Details in den Info-Texten der App):
// - Pause: Ohne Training sinkt die Ausdauerleistung nach ca. 2–4 Wochen spürbar (Mujika & Padilla 2000).
//   2–3 Einheiten pro Woche mit erhaltener Intensität reichen, um den Großteil zu bewahren (Bangsbo 2008).
//   Erste 1–2 Wochen bewusst aktive Erholung, letzte 1–2 Wochen „Anlauf“ mit Sprints, damit der Einstieg
//   in die Vorbereitung nicht aus dem Stand erfolgt (Verletzungsrisiko bei plötzlicher Last, Gabbett 2016).
// - Vorbereitung: Einstiegswoche moderat, dann stufenweise Steigerung (≤ 10–15 % pro Woche),
//   nach zwei Aufbauwochen eine Entlastungswoche (3:1-Muster), letzte Woche vor dem ersten Pflichtspiel
//   Umfang reduzieren und Intensität halten (Tapering, Mujika 2003). Eingangs- und Ausgangstest.
import { groupOf } from "./classes";
import { addDays, diff, monday } from "./dates";
import { inKind } from "./groups";
import { fitnessIndex } from "./perf";
import type { ExtraType, FreeKey, Group, Phase, PhaseKind, ProgItem, TeamData, WeekMode } from "./types";

export type FreeCat = "erholung" | "ausdauer" | "kraft" | "schnell" | "technik";
export interface FreeDef { key: Exclude<FreeKey, "eigen">; art: ExtraType; min: number; rpe: number; cat: FreeCat }

/** Bausteine für das Training in der freien Zeit (Titel/Anleitung in i18n: fl_<key>, fl_<key>_d). */
export const FREE_LIB: FreeDef[] = [
  { key: "andere", art: "sonst", min: 45, rpe: 4, cat: "erholung" },
  { key: "mobility", art: "sonst", min: 20, rpe: 2, cat: "erholung" },
  { key: "locker", art: "lauf", min: 35, rpe: 4, cat: "ausdauer" },
  { key: "fahrtspiel", art: "lauf", min: 30, rpe: 6, cat: "ausdauer" },
  { key: "intervall", art: "lauf", min: 30, rpe: 8, cat: "ausdauer" },
  { key: "kraft", art: "gym", min: 35, rpe: 6, cat: "kraft" },
  { key: "sprint", art: "lauf", min: 25, rpe: 6, cat: "schnell" },
  { key: "ball", art: "sonst", min: 30, rpe: 4, cat: "technik" },
];
export const freeDef = (k: FreeKey): FreeDef | null => FREE_LIB.find(x => x.key === k) || null;
export const CAT_COLOR: Record<FreeCat, string> = { erholung: "#16a3a3", ausdauer: "#3a6db5", kraft: "#f0762b", schnell: "#d6336c", technik: "#2f9e44" };
export const catOf = (it: ProgItem): FreeCat => freeDef(it.key)?.cat || "technik";
export const artOf = (it: ProgItem): ExtraType => freeDef(it.key)?.art || "sonst";

/** Montage aller Wochen, die die Phase berührt. */
export function phaseWeeks(from: string, to: string): string[] {
  const out: string[] = [];
  if (!from || !to || to < from) return out;
  for (let ws = monday(from); ws <= to && out.length < 30; ws = addDays(ws, 7)) out.push(ws);
  return out;
}
/** Phasenwoche (1-basiert) eines Datums. */
export const weekIndex = (ph: Phase, date: string): number => Math.floor(diff(monday(ph.from), monday(date)) / 7) + 1;

export type WeekRole = "rest" | "keep" | "ramp" | "entry" | "build" | "deload" | "taper";
export interface WeekSkel { ws: string; i: number; role: WeekRole; mode: WeekMode; pct: number; test: boolean }

/** Grundgerüst der Wochen: Rolle, Wochenmodus für die Planung, Ziel-Last in % einer Saisonwoche, Testwoche. */
export function skeleton(kind: PhaseKind, from: string, to: string): WeekSkel[] {
  const W = phaseWeeks(from, to), n = W.length;
  if (kind === "break") {
    const rest = n >= 5 ? 2 : n >= 2 ? 1 : n, ramp = n >= 7 ? 2 : n >= 3 ? 1 : 0;
    return W.map((ws, k): WeekSkel => {
      const i = k + 1, role: WeekRole = i <= rest ? "rest" : i > n - ramp ? "ramp" : "keep";
      return { ws, i, role, mode: "normal", pct: 0, test: false };
    });
  }
  let builds = 0, since = 0;
  const lastMid = n >= 3 ? n - 1 : n;
  return W.map((ws, k): WeekSkel => {
    const i = k + 1;
    // Einstieg: in der Planung als Entlastungswoche (ca. −30 % gegenüber einer normalen Woche ≈ 75 %)
    if (i === 1) return { ws, i, role: "entry", mode: "entlastung", pct: 75, test: true };
    if (i === n && n >= 3) return { ws, i, role: "taper", mode: "entlastung", pct: 80, test: false };
    if (since >= 2 && lastMid - i >= 1) { since = 0; return { ws, i, role: "deload", mode: "entlastung", pct: 80, test: false }; }
    const pct = Math.min(115, 90 + 10 * builds); builds++; since++;
    return { ws, i, role: "build", mode: "aufbau", pct, test: n >= 5 && i === lastMid };
  });
}

/** Vorschlag für das Spielerprogramm. U11: Spielen und Bewegen statt Trainingsplan. */
export function defaultProgram(kind: PhaseKind, from: string, to: string, grp: Group, idf: () => string): ProgItem[] {
  const sk = skeleton(kind, from, to), n = sk.length, L: ProgItem[] = [];
  if (!n) return L;
  const span = (roles: WeekRole[]): [number, number] | null => {
    const ix = sk.filter(w => roles.includes(w.role)).map(w => w.i); return ix.length ? [Math.min(...ix), Math.max(...ix)] : null;
  };
  const add = (key: Exclude<FreeKey, "eigen">, perWeek: number, r: [number, number] | null): void => {
    if (!r) return; const d = freeDef(key)!;
    L.push({ id: idf(), key, min: d.min, rpe: d.rpe, perWeek, from: r[0], to: r[1] });
  };
  if (grp === "u11") { add("andere", 2, [1, n]); add("ball", 2, [1, n]); return L; }
  if (kind === "break") {
    add("andere", 2, span(["rest"]));
    add("mobility", 1, [1, n]);
    const work = span(["keep", "ramp"]);
    add("locker", 1, work);
    add(grp === "u15" ? "fahrtspiel" : "intervall", 1, work);
    add("kraft", 1, work);
    add("ball", 1, span(["keep"]));
    add("sprint", 1, span(["ramp"]));
  } else {
    // Vorbereitung: Mannschaftstraining ist der Hauptreiz; zu Hause nur Prävention und Beweglichkeit.
    add("kraft", 1, [1, Math.max(1, n - 1)]);
    add("mobility", 1, [1, n]);
  }
  return L;
}

/** Phase an einem Tag (Pause hat Vorrang vor Vorbereitung). */
export function phaseOn(D: TeamData, d: string): Phase | null {
  const L = (D.phases || []).filter(p => p.from <= d && d <= p.to);
  return L.find(p => p.kind === "break") || L[0] || null;
}
/** Nächste oder laufende Phase innerhalb von `days` Tagen. */
export function upcomingPhase(D: TeamData, today: string, days = 14): Phase | null {
  return [...(D.phases || [])].filter(p => p.to >= today && diff(today, p.from) <= days).sort((a, b) => a.from < b.from ? -1 : 1)[0] || null;
}

export const itemsInWeek = (ph: Phase, i: number): ProgItem[] => ph.program.filter(x => x.from <= i && i <= x.to);
/** Wichtigste Reize zuerst – bei angebrochenen Wochen fallen leichte Bausteine weg. */
const PRIO: FreeKey[] = ["intervall", "fahrtspiel", "kraft", "sprint", "locker", "ball", "andere", "eigen", "mobility"];
/** Tage einer Woche, die in der Phase liegen. */
export const daysIn = (ph: Phase, ws: string): number => { let n = 0; for (let k = 0; k < 7; k++) { const d = addDays(ws, k); if (d >= ph.from && d <= ph.to) n++; } return n; };
/** Programm einer Woche mit der Anzahl je Baustein. Angebrochene Wochen (unter 5 Tagen) werden anteilig gekürzt,
 *  höchstens eine Einheit pro Tag – wichtigste Reize zuerst. */
export function weekItems(ph: Phase, ws: string): ProgItem[] {
  const L = itemsInWeek(ph, weekIndex(ph, ws)), d = daysIn(ph, ws);
  if (d >= 5) return L;
  let left = d;
  return [...L].sort((a, b) => PRIO.indexOf(a.key) - PRIO.indexOf(b.key))
    .map(it => { const n = Math.min(left, Math.max(1, Math.round(it.perWeek * d / 7))); left -= n; return { ...it, perWeek: n }; })
    .filter(it => it.perWeek > 0)
    .sort((a, b) => L.findIndex(x => x.id === a.id) - L.findIndex(x => x.id === b.id));
}
export const weekTotal = (ph: Phase, ws: string): number => weekItems(ph, ws).reduce((a, x) => a + x.perWeek, 0);

// ---------- Persönliche Anpassung des Programms ----------
export type PersonalLevel = "basis" | "standard" | "plus";
export interface Personal { level: PersonalLevel; why: string[]; growth: boolean; tw: boolean }
/**
 * Stufe für das Programm eines Spielers: Basis (kürzer, Fahrtspiel statt harter Intervalle) nach Verletzung,
 * bei Belastungsaufbau, für Neue oder mit Ausdauerwerten unter dem Richtwert; Plus bei Werten darüber.
 * Wachstumsschub: Technik und Fahrtspiel statt Sprints und harter Intervalle. Torhüter: Fahrtspiel statt Intervallen.
 */
export function personalFor(D: TeamData, pid: string, today: string): Personal {
  const p = D.players.find(x => x.id === pid) || D.inactive.find(x => x.id === pid);
  const why: string[] = [];
  if (!p) return { level: "standard", why, growth: false, tw: false };
  const ret = D.absences.some(a => a.pid === pid && a.typ === "verletzung" && !!a.bis && a.bis < today && diff(a.bis, today) <= 28);
  const fit = fitnessIndex(D, pid, groupOf(D.team.cls), today)?.fi ?? null;
  let level: PersonalLevel = "standard";
  if (ret) { level = "basis"; why.push("pp_why_return"); }
  else if (inKind(D.groups, p, "build")) { level = "basis"; why.push("pp_why_build"); }
  else if (p.neu) { level = "basis"; why.push("pp_why_new"); }
  else if (fit != null && fit < 0.95) { level = "basis"; why.push("pp_why_fitLow"); }
  else if (fit != null && fit > 1.05) { level = "plus"; why.push("pp_why_fitHigh"); }
  const g = [...(D.growth[pid] || [])].sort((a, b) => a.date < b.date ? -1 : 1), last = g[g.length - 1], first = g.find(x => last && diff(x.date, last.date) >= 330) || g[0];
  const rate = last && first && diff(first.date, last.date) > 0 ? (last.cm - first.cm) / (diff(first.date, last.date) / 365) : 0;
  const growth = (!!D.team.modules.wachstum && rate >= 7) || inKind(D.groups, p, "growth");
  const tw = p.pos === "TW" || inKind(D.groups, p, "tw");
  if (growth) why.push("pp_why_growth");
  if (tw) why.push("pp_why_tw");
  return { level, why, growth, tw };
}
const r5 = (x: number): number => Math.max(15, Math.round(x / 5) * 5);
/** Bausteine einer Woche an den Spieler anpassen (IDs bleiben – Einträge zählen weiter zum Programm). */
export function personalize(items: ProgItem[], per: Personal): ProgItem[] {
  return items.map(it => {
    let x: ProgItem = { ...it };
    const swap = !x.title && ((per.growth && (x.key === "sprint" || x.key === "intervall")) || (per.tw && x.key === "intervall") || (per.level === "basis" && x.key === "intervall"));
    if (swap) { const nk: Exclude<FreeKey, "eigen"> = x.key === "sprint" ? "ball" : "fahrtspiel", d = freeDef(nk)!; x = { ...x, key: nk, min: d.min, rpe: d.rpe }; }
    if (per.level === "basis" && x.key !== "mobility") x.min = r5(x.min * 0.8);
    if (per.level === "plus" && ["locker", "fahrtspiel", "intervall", "kraft"].includes(x.key)) x.min = Math.min(x.min + 10, r5(x.min * 1.15));
    return x;
  });
}
/** Mindestens 4 Tage der Woche verletzt oder krank → statt Programm gilt der Reha-Plan. */
export function injuredWeek(D: TeamData, pid: string, ws: string): boolean {
  let n = 0;
  for (let k = 0; k < 7; k++) { const d = addDays(ws, k); if (D.absences.some(a => a.pid === pid && (a.typ === "verletzung" || a.typ === "krank") && a.von <= d && (!a.bis || d <= a.bis))) n++; }
  return n >= 4;
}

export interface ProgWeek { ws: string; i: number; items: { it: ProgItem; done: number }[]; done: number; total: number; ownMin: number; injured: boolean; personal: Personal }
/** Programm einer Woche mit erledigten Einheiten (Zusatzeinträge mit prog-Verweis). */
export function progWeek(D: TeamData, pid: string, ph: Phase, ws: string, today: string = ws): ProgWeek {
  const i = weekIndex(ph, ws), we = addDays(ws, 6);
  const ex = (D.extra[pid] || []).filter(x => x.date >= ws && x.date <= we && x.date >= ph.from && x.date <= ph.to);
  // persönliche Anpassung nach dem Stand zu Beginn der Woche (bzw. heute, wenn die Woche schon läuft)
  const ref = ws < today ? ws : today, personal = personalFor(D, pid, ref), injured = injuredWeek(D, pid, ws);
  const items = injured ? [] : personalize(weekItems(ph, ws), personal).map(it => ({ it, done: Math.min(it.perWeek, ex.filter(x => x.prog === it.id).length) }));
  const ownMin = ex.filter(x => !x.prog || !items.some(y => y.it.id === x.prog)).reduce((a, x) => a + x.min, 0);
  return { ws, i, items, done: items.reduce((a, x) => a + x.done, 0), total: items.reduce((a, x) => a + x.it.perWeek, 0), ownMin, injured, personal };
}

/** Umsetzung des Programms bis heute (laufende Woche anteilig nach vergangenen Tagen). */
export function compliance(D: TeamData, pid: string, ph: Phase, today: string): { done: number; due: number; pct: number | null; ownMin: number } {
  let done = 0, due = 0, ownMin = 0;
  for (const ws of phaseWeeks(ph.from, ph.to)) {
    if (ws > today) break;
    const w = progWeek(D, pid, ph, ws, today), we = addDays(ws, 6);
    const share = we <= today ? 1 : (diff(ws, today) + 1) / 7;
    done += w.done; ownMin += w.ownMin; due += Math.floor(w.total * share + 1e-9);
  }
  return { done, due, pct: due ? Math.min(1, done / due) : null, ownMin };
}
