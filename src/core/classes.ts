import type { BuiltinKind, ClassKey, Depth, Group, Lang, Modules, Pitch, Principles, TeamSettings } from "./types";

export interface ClassDef { k: ClassKey; grp: Group; ages: [number, number]; de?: string; en?: string; team?: { de: string; en: string } }

export const CLASSES: ClassDef[] = [
  { k: "sen", de: "Senioren", en: "Seniors", grp: "akt", ages: [19, 34], team: { de: "1. Mannschaft", en: "1st team" } },
  { k: "ue32", de: "Ü32 / Alte Herren", en: "Over-32 / Veterans", grp: "akt", ages: [32, 47], team: { de: "Alte Herren", en: "Veterans" } },
  { k: "u19", grp: "u19", ages: [17, 18] }, { k: "u18", grp: "u19", ages: [16, 17] }, { k: "u17", grp: "u19", ages: [15, 16] }, { k: "u16", grp: "u19", ages: [14, 15] },
  { k: "u15", grp: "u15", ages: [13, 14] }, { k: "u14", grp: "u15", ages: [12, 13] }, { k: "u13", grp: "u15", ages: [11, 12] }, { k: "u12", grp: "u15", ages: [10, 11] },
  { k: "u11", grp: "u11", ages: [9, 10] }, { k: "u10", grp: "u11", ages: [8, 9] }, { k: "u9", grp: "u11", ages: [7, 8] }, { k: "u8", grp: "u11", ages: [6, 7] }, { k: "u7", grp: "u11", ages: [5, 6] },
];
export const classDef = (k: ClassKey): ClassDef => CLASSES.find(c => c.k === k) || CLASSES[2];
export const classLabel = (c: ClassDef, lang: Lang): string => (lang === "en" ? c.en : c.de) || c.k.toUpperCase();
export const groupOf = (k: ClassKey): Group => classDef(k).grp;
/** Höchste geplante Intensität (RPE) je Altersgruppe. */
export const capOf = (k: ClassKey): number => ({ akt: 8, u19: 8, u15: 7, u11: 5 } as const)[groupOf(k)];
export const isGrowthAge = (k: ClassKey): boolean => ["u16", "u15", "u14", "u13", "u12"].includes(k);
export const DEPTH: Record<Depth, number> = { org: 0, basis: 1, pro: 2 };

export function modsFor(depth: Depth, k: ClassKey): Modules {
  const grp = groupOf(k);
  const m: Modules = {
    beteiligung: true, planung: depth !== "org", belastung: depth !== "org", regeneration: depth !== "org",
    wachstum: depth !== "org" && isGrowthAge(k), ki: true, matchplan: false, kaderplanung: false,
  };
  if (grp === "u11") { m.belastung = false; m.regeneration = false; m.wachstum = false; }
  return m;
}

export const KINDS: BuiltinKind[] = ["regen", "frei", "aktiv", "schnell", "taktik", "extensiv", "intensiv", "aufbau"];
/** Spieltags-Bezüge der Trainingstage (ohne den Spieltag selbst). */
export const MDS = ["MD+1", "MD+2", "MD-6", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1"];
export const PR_ROWS = ["MD", ...MDS];
export const PITCH: Pitch[] = ["ganz", "halb", "viertel", "halle"];

export function defaultPrinciples(grp: Group): Principles {
  if (grp === "u11") {
    const p: Principles = { MD: { kind: "spiel", rpe: 5 } };
    MDS.forEach(md => { p[md] = { kind: "kids", rpe: 5 }; });
    return p;
  }
  const cap = grp === "u15" ? 7 : 8;
  return {
    "MD": { kind: "spiel", rpe: grp === "u15" ? 7 : 8 },
    "MD+1": { kind: "regen", rpe: 3 }, "MD+2": { kind: "frei", rpe: 0 },
    "MD-6": { kind: "aufbau", rpe: 5 }, "MD-5": { kind: "aufbau", rpe: 6 },
    "MD-4": { kind: "intensiv", rpe: cap }, "MD-3": { kind: "extensiv", rpe: 6 },
    "MD-2": { kind: "schnell", rpe: 4 }, "MD-1": { kind: "aktiv", rpe: 3 },
  };
}

export function defaultSettings(): TeamSettings {
  return {
    days: { 1: { zeit: "19:30", platz: "ganz", dauer: 90 }, 3: { zeit: "19:30", platz: "halb", dauer: 90 }, 4: { zeit: "19:30", platz: "halb", dauer: 90 }, 5: { zeit: "19:30", platz: "halb", dauer: 90 } },
    dauer: 90, fix: true, spieltag: 0, anstoss: "15:00",
  };
}

/** Erholungsmodell: [bis Alter, Std. nach hartem Training (RPE 7+), Std. nach Spiel 60+ Min.]. */
export const BANDS: [number, number, number][] = [[11, 24, 36], [14, 30, 48], [17, 36, 54], [22, 42, 60], [27, 48, 66], [31, 48, 72], [35, 54, 78], [39, 60, 84], [120, 72, 96]];
export const bandLabel = (i: number): string => i === 0 ? "≤ 11" : i === BANDS.length - 1 ? "40+" : (BANDS[i - 1][0] + 1) + "–" + BANDS[i][0];
export const bandOf = (a: number): number => BANDS.findIndex(b => a <= b[0]);
/** Schlafempfehlung nach Alter (Stunden). */
export const sleepTarget = (a: number): [number, number] => a < 13 ? [9, 12] : a < 18 ? [8, 10] : [7, 9];

/** Spieldauer nach Altersklasse (DFB-Spielzeiten). */
export const MATCHMIN: Record<ClassKey, number> = { sen: 90, ue32: 80, u19: 90, u18: 90, u17: 80, u16: 80, u15: 70, u14: 70, u13: 60, u12: 60, u11: 50, u10: 50, u9: 40, u8: 40, u7: 40 };

export const KIND_RPE: Record<BuiltinKind, number> = { regen: 3, frei: 0, aktiv: 3, schnell: 4, taktik: 5, extensiv: 6, intensiv: 8, aufbau: 6, kids: 5, spiel: 8 };

export const NAV_COACH = ["heute", "kalender", "plan", "kader", "module"] as const;
export const NAV_PLAYER = ["heute", "eintragen", "daten", "tipps", "ich"] as const;
export const POS = ["TW", "IV", "AV", "ZM", "OM", "Flügel", "ST"];
