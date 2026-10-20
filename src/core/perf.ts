// Leistungsdiagnostik: Testkatalog (eingebaut + eigene Tests des Teams), Orientierungswerte, Bewertung,
// CMJ-Ermüdungscheck, Fitnessfaktor, Laufvorgaben. Reine Berechnung auf TeamData – ohne UI und ohne Datenbank.
import { diff } from "./dates";
import type { BuiltinTestKey, CustomTest, Group, TeamData, TestKey, TestRank, TestResult } from "./types";

export interface TestDef {
  key: TestKey;
  unit: string;
  /** true: kleinerer Wert ist besser (Zeiten) */
  lower: boolean;
  dec: number;
  min: number; max: number;
  /** Für welche Altersgruppen der Test empfohlen ist */
  groups: Group[];
  /** nur für Torhüter (Torwartdiagnostik) */
  gk?: boolean;
  /** eigener Test: Name und Durchführung (eingebaute Tests: Texte ts_/tsd_/tsp_) */
  custom?: boolean; name?: string; how?: string;
}

export const TESTS: TestDef[] = [
  { key: "sprint10", unit: "s", lower: true, dec: 2, min: 1.3, max: 3.5, groups: ["u11", "u15", "u19", "akt"] },
  { key: "sprint30", unit: "s", lower: true, dec: 2, min: 3.4, max: 7.5, groups: ["u15", "u19", "akt"] },
  { key: "cmj", unit: "cm", lower: false, dec: 1, min: 10, max: 80, groups: ["u15", "u19", "akt"] },
  { key: "ift", unit: "km/h", lower: false, dec: 1, min: 10, max: 25, groups: ["u15", "u19", "akt"] },
  { key: "yoyo", unit: "m", lower: false, dec: 0, min: 80, max: 3600, groups: ["u15", "u19", "akt"] },
  { key: "agility505", unit: "s", lower: true, dec: 2, min: 1.8, max: 4.0, groups: ["u15", "u19", "akt"] },
  { key: "slalom", unit: "s", lower: true, dec: 1, min: 5, max: 40, groups: ["u11"] },
  { key: "standweit", unit: "cm", lower: false, dec: 0, min: 60, max: 320, groups: ["u11", "u15"] },
  // Torhüter: seitliche Sprungkraft (Abdruck zum Ball) und Weite des Abschlags/Abstoßes
  { key: "tw_lateral", unit: "cm", lower: false, dec: 0, min: 60, max: 400, groups: ["u15", "u19", "akt"], gk: true },
  { key: "tw_kick", unit: "m", lower: false, dec: 0, min: 10, max: 90, groups: ["u15", "u19", "akt"], gk: true },
];

// ---------- Eigene Tests ----------
export const CUSTOM_TEST_MAX = 12;
export const CT_LIMITS = { name: 40, unit: 12, how: 300 };
const ALL_GROUPS: Group[] = ["u11", "u15", "u19", "akt"];
export const isCustomTest = (k: string): k is `c:${string}` => typeof k === "string" && k.startsWith("c:");
/** Eigener Test als Katalogeintrag (gilt für alle Altersgruppen, Werte 0 … 99 999) */
export const customDef = (x: CustomTest): TestDef => ({ key: `c:${x.id}`, unit: x.unit, lower: x.lower, dec: x.dec, min: 0, max: 99999, groups: ALL_GROUPS,
  gk: x.gk || undefined, custom: true, name: x.name, how: x.how || "" });
/** Eigene Tests aus den Team-Einstellungen */
export const customsOf = (D: Pick<TeamData, "team"> | null | undefined): CustomTest[] => D?.team?.settings?.customTests || [];
type Cx = CustomTest[] | undefined;
/** Katalogeintrag zu einem Schlüssel; ein gelöschter eigener Test bleibt lesbar (Name „?“) */
export function testDef(k: TestKey, cx?: Cx): TestDef {
  if (isCustomTest(k)) {
    const c = (cx || []).find(x => "c:" + x.id === k);
    return c ? customDef(c) : { key: k, unit: "", lower: false, dec: 2, min: 0, max: 99999, groups: ALL_GROUPS, custom: true, name: "?", how: "" };
  }
  return TESTS.find(x => x.key === k) || TESTS[0];
}
/** Tests einer Altersgruppe: eingebaute (empfohlen für die Gruppe) und alle eigenen */
export const testsFor = (g: Group, cx?: Cx): TestDef[] => [...TESTS.filter(x => x.groups.includes(g)), ...(cx || []).map(customDef)];
/** Alle Tests (eingebaut und eigene) – z. B. für Rückblick und Gesprächsvorbereitung */
export const allTests = (D: Pick<TeamData, "team">): TestDef[] => [...TESTS, ...customsOf(D).map(customDef)];
/** Name eines Tests (eingebaut: Übersetzung ts_<key>) */
export const testName = (k: TestKey, t: (key: string) => string, cx?: Cx): string => isCustomTest(k) ? testDef(k, cx).name || "?" : t("ts_" + k);

/** Gespeicherte eigene Tests bereinigen: gültige Kennung, Name Pflicht, Längen begrenzt, höchstens 12 */
export function cleanCustomTests(raw: unknown): CustomTest[] {
  const ids = new Set<string>(), out: CustomTest[] = [];
  const str = (v: unknown, n: number) => typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
  for (const r of Array.isArray(raw) ? raw as Partial<CustomTest>[] : []) {
    if (!r || typeof r !== "object" || typeof r.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(r.id) || ids.has(r.id)) continue;
    const name = str(r.name, CT_LIMITS.name); if (!name) continue;
    const x: CustomTest = { id: r.id, name, unit: str(r.unit, CT_LIMITS.unit), lower: !!r.lower, dec: r.dec === 0 || r.dec === 1 ? r.dec : 2 };
    const how = typeof r.how === "string" ? r.how.trim().slice(0, CT_LIMITS.how) : ""; if (how) x.how = how;
    if (r.gk) x.gk = true;
    ids.add(r.id); out.push(x);
    if (out.length >= CUSTOM_TEST_MAX) break;
  }
  return out;
}

/**
 * Orientierungswerte (männlich, ambitionierter Nachwuchs-/Amateurbereich): Grenzen zu
 * [sehr gut, gut, mittel] – schlechter als die dritte Grenze = „ausbaufähig“.
 * Werte nach Lichtschranke; Handstopp misst meist 0,1–0,2 s zu schnell.
 */
const NORMS: Partial<Record<BuiltinTestKey, Partial<Record<Group, [number, number, number]>>>> = {
  sprint10: { u11: [2.15, 2.3, 2.45], u15: [1.9, 2.0, 2.1], u19: [1.75, 1.85, 1.95], akt: [1.73, 1.82, 1.92] },
  sprint30: { u15: [4.6, 4.85, 5.1], u19: [4.15, 4.35, 4.55], akt: [4.1, 4.3, 4.5] },
  cmj: { u15: [36, 31, 26], u19: [42, 37, 32], akt: [44, 38, 33] },
  ift: { u15: [19, 18, 17], u19: [20.5, 19.5, 18.5], akt: [20.5, 19.5, 18.5] },
  yoyo: { u15: [1600, 1250, 950], u19: [2200, 1800, 1400], akt: [2300, 1900, 1500] },
  agility505: { u15: [2.5, 2.65, 2.8], u19: [2.3, 2.42, 2.55], akt: [2.28, 2.4, 2.52] },
  slalom: { u11: [13, 15, 17] },
  standweit: { u11: [165, 150, 135], u15: [215, 195, 175] },
};
export type Band = "top" | "gut" | "mittel" | "basis" | "none";
export function bandOfValue(k: TestKey, g: Group, v: number): Band {
  if (isCustomTest(k)) return "none";
  const n = NORMS[k]?.[g]; if (!n) return "none";
  const lo = testDef(k).lower;
  const better = (a: number, b: number) => lo ? a <= b : a >= b;
  return better(v, n[0]) ? "top" : better(v, n[1]) ? "gut" : better(v, n[2]) ? "mittel" : "basis";
}
export const normOf = (k: TestKey, g: Group): [number, number, number] | null => isCustomTest(k) ? null : NORMS[k]?.[g] || null;

/** Ergebnisse eines Spielers für einen Test (neueste zuerst). */
export const resultsOf = (D: TeamData, pid: string, k: TestKey): TestResult[] =>
  D.tests.filter(x => x.pid === pid && x.test === k).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
/** Bester Wert (persönliche Bestleistung). */
export function bestOf(D: TeamData, pid: string, k: TestKey): TestResult | null {
  const L = resultsOf(D, pid, k); if (!L.length) return null;
  const lo = testDef(k, customsOf(D)).lower; return L.reduce((a, b) => (lo ? b.value < a.value : b.value > a.value) ? b : a);
}
/** Veränderung zum vorherigen Test in Prozent (positiv = besser). */
export function trendOf(D: TeamData, pid: string, k: TestKey): number | null {
  const L = resultsOf(D, pid, k); if (L.length < 2) return null;
  if (!L[1].value) return null;
  const d = (L[0].value - L[1].value) / L[1].value; return testDef(k, customsOf(D)).lower ? -d : d;
}

/**
 * CMJ-Ermüdungscheck: neuester Wert (höchstens 3 Tage alt) im Vergleich zum persönlichen Normalwert
 * (Mittel der bis zu 6 vorherigen Werte der letzten 60 Tage, mindestens 3). Rückgabe: Abfall in Prozent (0–1) oder null.
 * Grundlage: Abfälle der CMJ-Sprunghöhe zeigen neuromuskuläre Ermüdung an (Claudino et al. 2017, Metaanalyse).
 */
export function cmjDrop(D: TeamData, pid: string, today: string): number | null {
  const L = resultsOf(D, pid, "cmj"); if (L.length < 4) return null;
  const last = L[0]; if (diff(last.date, today) > 3) return null;
  const prev = L.slice(1).filter(x => diff(x.date, last.date) <= 60).slice(0, 6); if (prev.length < 3) return null;
  const base = prev.reduce((a, b) => a + b.value, 0) / prev.length;
  return Math.max(0, (base - last.value) / base);
}

/** Ausdauer-Fitnessfaktor (0,85–1,15) aus 30-15 IFT oder Yo-Yo IR1 (höchstens 180 Tage alt) relativ zum Orientierungswert „gut“. */
export function fitnessIndex(D: TeamData, pid: string, g: Group, today: string): { fi: number; test: TestKey } | null {
  for (const k of ["ift", "yoyo"] as TestKey[]) {
    const r = resultsOf(D, pid, k)[0], n = normOf(k, g);
    if (!r || !n || diff(r.date, today) > 180) continue;
    return { fi: Math.max(0.85, Math.min(1.15, r.value / n[1])), test: k };
  }
  return null;
}

/** Laufvorgaben aus der 30-15-IFT-Geschwindigkeit (V_IFT): Strecken für 15 s / 15 s und 30 s Intervalle (Buchheit). */
export function runTargets(D: TeamData, pid: string): { vift: number; d15_90: number; d15_95: number; d30_85: number; date: string } | null {
  const r = resultsOf(D, pid, "ift")[0]; if (!r) return null;
  const m = (pct: number, sec: number) => Math.round(r.value / 3.6 * pct * sec);
  return { vift: r.value, d15_90: m(0.9, 15), d15_95: m(0.95, 15), d30_85: m(0.85, 30), date: r.date };
}

/** Mindestzahl Spieler mit Wert, ab der eine Platzierung gezeigt wird (sonst ließen sich Werte anderer erschließen) */
export const RANK_MIN = 5;
/**
 * Platzierung eines Spielers im Team: jeweils letzter Wert der letzten 365 Tage je aktivem Spieler.
 * Gleiche Werte teilen sich den Platz. `null` bei zu wenigen Werten oder ohne eigenen Wert.
 */
export function testRank(D: TeamData, pid: string, key: TestKey, today: string, withBest: boolean): TestRank | null {
  const lo = testDef(key, customsOf(D)).lower;
  const latest = D.players.map(p => resultsOf(D, p.id, key).find(r => diff(r.date, today) <= 365)).filter((r): r is TestResult => !!r);
  if (latest.length < RANK_MIN) return null;
  const mine = latest.find(r => r.pid === pid); if (!mine) return null;
  const better = latest.filter(r => lo ? r.value < mine.value : r.value > mine.value).length;
  const best = lo ? Math.min(...latest.map(r => r.value)) : Math.max(...latest.map(r => r.value));
  return { rank: better + 1, n: latest.length, best: withBest ? best : null };
}
