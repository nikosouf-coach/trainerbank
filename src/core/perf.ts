// Leistungsdiagnostik: Testkatalog, Orientierungswerte, Bewertung, CMJ-Ermüdungscheck, Fitnessfaktor, Laufvorgaben.
// Reine Berechnung auf TeamData – ohne UI und ohne Datenbank.
import { diff } from "./dates";
import type { Group, TeamData, TestKey, TestResult } from "./types";

export interface TestDef {
  key: TestKey;
  unit: string;
  /** true: kleinerer Wert ist besser (Zeiten) */
  lower: boolean;
  dec: number;
  min: number; max: number;
  /** Für welche Altersgruppen der Test empfohlen ist */
  groups: Group[];
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
];
export const testDef = (k: TestKey): TestDef => TESTS.find(x => x.key === k) || TESTS[0];
export const testsFor = (g: Group): TestDef[] => TESTS.filter(x => x.groups.includes(g));

/**
 * Orientierungswerte (männlich, ambitionierter Nachwuchs-/Amateurbereich): Grenzen zu
 * [sehr gut, gut, mittel] – schlechter als die dritte Grenze = „ausbaufähig“.
 * Werte nach Lichtschranke; Handstopp misst meist 0,1–0,2 s zu schnell.
 */
const NORMS: Partial<Record<TestKey, Partial<Record<Group, [number, number, number]>>>> = {
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
  const n = NORMS[k]?.[g]; if (!n) return "none";
  const lo = testDef(k).lower;
  const better = (a: number, b: number) => lo ? a <= b : a >= b;
  return better(v, n[0]) ? "top" : better(v, n[1]) ? "gut" : better(v, n[2]) ? "mittel" : "basis";
}
export const normOf = (k: TestKey, g: Group): [number, number, number] | null => NORMS[k]?.[g] || null;

/** Ergebnisse eines Spielers für einen Test (neueste zuerst). */
export const resultsOf = (D: TeamData, pid: string, k: TestKey): TestResult[] =>
  D.tests.filter(x => x.pid === pid && x.test === k).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
/** Bester Wert (persönliche Bestleistung). */
export function bestOf(D: TeamData, pid: string, k: TestKey): TestResult | null {
  const L = resultsOf(D, pid, k); if (!L.length) return null;
  const lo = testDef(k).lower; return L.reduce((a, b) => (lo ? b.value < a.value : b.value > a.value) ? b : a);
}
/** Veränderung zum vorherigen Test in Prozent (positiv = besser). */
export function trendOf(D: TeamData, pid: string, k: TestKey): number | null {
  const L = resultsOf(D, pid, k); if (L.length < 2) return null;
  const d = (L[0].value - L[1].value) / L[1].value; return testDef(k).lower ? -d : d;
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
