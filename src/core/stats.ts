// Statistik für das Trainerteam (Seite „Statistik“ und der Wert neben dem Namen im Kader): Kennzahlen je Spieler in
// einem Zeitraum – Trainingsbeteiligung, Belastung und RPE, Morgen-Check, Benotungen, Spiele, Leistungsdiagnostik,
// Entwicklung und Ausfälle. Welche Kennzahlen es gibt, hängt von Modulen, Infotiefe und Rechten ab (statsFor) – wer
// ein Recht nicht hat, für den wirken die Module schon in der Engine ausgeschaltet (core/perms.viewFor).
// Reine Berechnung: Anzeige (Zahlen, Farben, Texte) in src/ui/stats.tsx.
import { sleepTarget } from "./classes";
import { addDays, ageOn, diff, parse, sum } from "./dates";
import { COMPETENCIES, DEV_AREAS, posGroupOf } from "./dev";
import type { Engine } from "./engine";
import { seasonStart } from "./kasse";
import { bandOfValue, resultsOf } from "./perf";
import type { Assessment, RpeEntry, TestKey } from "./types";

export type StatCat = "att" | "load" | "well" | "rate" | "games" | "tests" | "dev" | "health";
export const STAT_CATS: StatCat[] = ["att", "load", "well", "rate", "games", "tests", "dev", "health"];
/** Zeitraum: 7 Tage, 4 Wochen, Saison (ab 1. Juli), Hinrunde (Juli–Dezember), Rückrunde (ab Januar) */
export type StatPeriod = "7" | "28" | "season" | "h1" | "h2";
export const STAT_PERIODS: StatPeriod[] = ["7", "28", "season", "h1", "h2"];
/** Bewertung eines Werts: sehr gut, gut, auffällig, kritisch, niedrig (z. B. ACWR unter 0,8) */
export type Tone = "top" | "ok" | "warn" | "crit" | "low";

export interface StatDef {
  /** z. B. „att“, „rpe“, „t:sprint10“ (Leistungstest) */
  key: string; cat: StatCat;
  /** größer besser (high), kleiner besser (low) oder neutral – für „beste zuerst“ */
  better: "high" | "low" | null;
  /** Teamzeile: Mittelwert oder Summe */
  agg: "avg" | "sum";
  /** Nachkommastellen */ dec: number;
  /** Einheit hinter der Zahl (%, AU, h, Min., s, cm …) */ unit?: string;
  /** aktueller Stand statt Zeitraum (ACWR, letzter Testwert, Kompetenzprofil) – bis zum Ende des Zeitraums */ now?: boolean;
  /** nur für Torhüter */ gk?: boolean;
  test?: TestKey;
}
export interface StatVal {
  v: number | null;
  /** n von of (z. B. 12 von 14 Einheiten) bzw. Anzahl der Werte */ n?: number; of?: number;
  /** Veränderung zum vorherigen Testwert (positiv = besser) */ trend?: number | null;
  /** Datum des Werts (Test, Einschätzung) */ date?: string | null;
  /** Trainingseindruck: besonders gut / besonders schwach */ good?: number; poor?: number;
  /** Minuten (Zusatzeinheiten) */ min?: number;
  tone?: Tone | null;
}
export interface Range { from: string; to: string }

/** Zeitraum als Datum von–bis (bis höchstens heute); null = Rückrunde hat noch nicht begonnen */
export function periodRange(p: StatPeriod, today: string): Range | null {
  const s0 = seasonStart(today), y = +s0.slice(0, 4);
  switch (p) {
    case "7": return { from: addDays(today, -6), to: today };
    case "28": return { from: addDays(today, -27), to: today };
    case "season": return { from: s0, to: today };
    case "h1": { const end = `${y}-12-31`; return { from: s0, to: today < end ? today : end }; }
    case "h2": { const st = `${y + 1}-01-01`; return today < st ? null : { from: st, to: today }; }
  }
}

const D_ = (k: string, cat: StatCat, better: StatDef["better"], agg: StatDef["agg"], dec: number, x: Partial<StatDef> = {}): StatDef => ({ key: k, cat, better, agg, dec, ...x });
/** Alle Kennzahlen ohne Leistungstests (die kommen je Team dazu) */
const BASE: StatDef[] = [
  D_("att", "att", "high", "avg", 0, { unit: "%" }),
  D_("unexc", "att", "low", "sum", 0),
  D_("acwr", "load", null, "avg", 2, { now: true }),
  D_("load", "load", null, "avg", 0, { unit: "AU" }),
  D_("rpe", "load", null, "avg", 1),
  D_("rpeRate", "load", "high", "avg", 0, { unit: "%" }),
  D_("extra", "load", null, "sum", 0),
  D_("well", "well", "low", "avg", 1),
  D_("sleep", "well", "high", "avg", 1, { unit: "h" }),
  D_("wellRate", "well", "high", "avg", 0, { unit: "%" }),
  D_("rateG", "rate", "high", "avg", 1),
  D_("marks", "rate", "high", "sum", 0),
  D_("games", "games", "high", "avg", 0),
  D_("starts", "games", "high", "avg", 0),
  D_("min", "games", "high", "avg", 0, { unit: "min" }),
  D_("minPct", "games", "high", "avg", 0, { unit: "%" }),
  D_("goals", "games", "high", "sum", 0),
  D_("assists", "games", "high", "sum", 0),
  D_("scorer", "games", "high", "sum", 0),
  D_("clean", "games", "high", "sum", 0, { gk: true }),
  D_("conc", "games", "low", "sum", 0, { gk: true }),
  D_("saves", "games", "high", "sum", 0, { gk: true }),
  D_("devC", "dev", "high", "avg", 1, { now: true }),
  D_("devS", "dev", "high", "avg", 1, { now: true }),
  D_("absDays", "health", "low", "avg", 0),
  D_("inj", "health", "low", "sum", 0),
];

/**
 * Verfügbare Kennzahlen in fester Reihenfolge: Beteiligung (Modul Beteiligung), Belastung und Morgen-Check (Belastung;
 * ACWR ab Infotiefe 2), Spielnote und Spiele (Spiele & Statistik), Trainingseindruck (immer), Leistungstests des
 * Teams (Leistungsdiagnostik, Auswahl in den Einstellungen), Entwicklung (Spielerentwicklung), Ausfälle (Recht
 * Gesundheit).
 */
export function statsFor(E: Engine, health: boolean): StatDef[] {
  const m = E.mods;
  const on: Record<string, boolean> = {
    att: !!m.beteiligung, unexc: !!m.beteiligung,
    acwr: !!m.belastung && E.lvl(2), load: !!m.belastung, rpe: !!m.belastung, rpeRate: !!m.belastung && !!m.beteiligung, extra: !!m.belastung,
    well: !!m.belastung, sleep: !!m.belastung, wellRate: !!m.belastung,
    rateG: !!m.spielanalyse, marks: true,
    games: !!m.spielanalyse, starts: !!m.spielanalyse, min: !!m.spielanalyse, minPct: !!m.spielanalyse, goals: !!m.spielanalyse, assists: !!m.spielanalyse, scorer: !!m.spielanalyse, clean: !!m.spielanalyse, conc: !!m.spielanalyse, saves: !!m.spielanalyse,
    devC: !!m.entwicklung, devS: !!m.entwicklung,
    absDays: health, inj: health,
  };
  const tests: StatDef[] = m.leistung ? E.testsFor(true).map(d => D_("t:" + d.key, "tests", d.lower ? "low" : "high", "avg", d.dec, { unit: d.unit, now: true, gk: d.gk, test: d.key })) : [];
  const base = BASE.filter(d => on[d.key]);
  // Leistungstests nach der Kategorie „Spiele“
  const at = base.findIndex(d => d.cat === "dev" || d.cat === "health");
  return at < 0 ? [...base, ...tests] : [...base.slice(0, at), ...tests, ...base.slice(at)];
}

// ---------- Berechnung ----------
const inR = (d: string, r: Range): boolean => d >= r.from && d <= r.to;

/** Erster Tag mit Anwesenheit oder RPE (neue Spieler zählen erst ab da) */
function firstSeen(E: Engine, pid: string): string | null {
  const D = E.D; let f: string | null = null;
  for (const d of Object.keys(D.att)) if (D.att[d][pid] && (!f || d < f)) f = d;
  for (const d of Object.keys(D.rpe[pid] || {})) if (!f || d < f) f = d;
  for (const d of Object.keys(D.rpeU[pid] || {})) if (!f || d < f) f = d;
  return f;
}
/** Anwesenheit für diese Einheit erfasst (mindestens ein Eintrag) – sonst zählt sie für niemanden */
const attTaken = (E: Engine, d: string): boolean => { const a = E.D.att[d]; return !!a && Object.keys(a).length > 0; };
/** verletzt oder krank an diesem Tag (zählt bei der Beteiligung nicht mit) */
const sickOn = (E: Engine, pid: string, d: string): boolean => { const a = E.absenceOn(pid, d); return !!a && (a.typ === "verletzung" || a.typ === "krank"); };
/** RPE-Einträge im Zeitraum (Mannschaftstraining/Spiel und weitere Einheiten) */
function rpeIn(E: Engine, pid: string, r: Range): RpeEntry[] {
  const out: RpeEntry[] = [];
  for (const [d, e] of Object.entries(E.D.rpe[pid] || {})) if (inR(d, r)) out.push(e);
  for (const [d, m] of Object.entries(E.D.rpeU[pid] || {})) if (inR(d, r)) out.push(...Object.values(m));
  return out;
}
const avg = (a: number[]): number | null => a.length ? sum(a) / a.length : null;
/** Mittel aller Kompetenzen einer Einschätzung (Kompetenzen der Positionsgruppe des Spielers) */
function assessAvg(E: Engine, a: Assessment | undefined, pid: string): number | null {
  const p = E.P(pid); if (!a || !p) return null;
  const pg = posGroupOf(E.D, p, E.grp);
  return avg(DEV_AREAS.flatMap(area => COMPETENCIES[pg][area].map(k => a.scores[k])).filter((x): x is number => typeof x === "number" && x >= 1 && x <= 5));
}

/**
 * Wert einer Kennzahl für einen Spieler im Zeitraum. v = null: keine Daten (Anzeige „–“). Kennzahlen mit `now`
 * gelten zum Ende des Zeitraums (letzter Test bis dahin usw.).
 */
export function statValue(E: Engine, pid: string, def: StatDef, r: Range): StatVal {
  const D = E.D, today = E.TODAY, end = r.to < today ? r.to : today, p = E.P(pid);
  if (!p) return { v: null };
  if (def.gk && !E.isGK(p)) return { v: null };
  if (def.test) {
    const L = resultsOf(D, pid, def.test).filter(x => x.date <= end), a = L[0], b = L[1];
    if (!a) return { v: null };
    const raw = b && b.value ? (a.value - b.value) / b.value : null, trend = raw == null ? null : def.better === "low" ? -raw : raw;
    const band = bandOfValue(def.test, E.grp, a.value);
    return { v: a.value, date: a.date, trend, tone: band === "top" ? "top" : band === "gut" ? "ok" : band === "basis" ? "warn" : null };
  }
  switch (def.key) {
    case "att": {
      const f = firstSeen(E, pid); if (!f) return { v: null };
      const from = f > r.from ? f : r.from;
      // nur Einheiten mit erfasster Anwesenheit; Tage mit Verletzung oder Krankheit zählen nicht (außer er war da)
      const ss = D.sessions.filter(s => s.typ === "Training" && s.date >= from && s.date <= end && attTaken(E, s.date)
        && (D.att[s.date][pid] === "da" || !sickOn(E, pid, s.date)));
      if (!ss.length) return { v: null };
      const n = ss.filter(s => D.att[s.date]?.[pid] === "da").length, v = n / ss.length * 100;
      return { v, n, of: ss.length, tone: v < 70 ? "crit" : v < 80 ? "warn" : null };
    }
    case "unexc": {
      if (!firstSeen(E, pid)) return { v: null };
      const n = D.sessions.filter(s => inR(s.date, { from: r.from, to: end }) && D.att[s.date]?.[pid] === "unent").length;
      return { v: n, tone: n >= 3 ? "crit" : n >= 2 ? "warn" : null };
    }
    case "acwr": {
      // aktueller Stand: nur für Zeiträume bis heute (Hinrunde in der Rückrunde: „–“)
      if (end < today || E.injuryOf(pid)) return { v: null };
      const m = E.metrics(pid); if (!m || m.days < 21 || m.acwr == null) return { v: null };
      const a = m.acwr; return { v: a, tone: a > 1.5 ? "crit" : a > 1.3 ? "warn" : a < 0.8 ? "low" : null };
    }
    case "load": {
      const f = firstSeen(E, pid); if (!f) return { v: null };
      const from = f > r.from ? f : r.from, days = diff(from, end) + 1; if (days <= 0) return { v: null };
      const dl = E.daily(pid), total = sum(Object.keys(dl).filter(d => d >= from && d <= end).map(d => dl[d]));
      return { v: total / Math.max(7, days) * 7 };
    }
    case "rpe": {
      const L = rpeIn(E, pid, { from: r.from, to: end }); const v = avg(L.map(e => e.rpe));
      return { v, n: L.length };
    }
    case "rpeRate": {
      // Mannschaftstrainings, bei denen der Spieler da war: wie oft hat er sein RPE eingetragen?
      const ss = D.sessions.filter(s => s.typ === "Training" && inR(s.date, { from: r.from, to: end }) && D.att[s.date]?.[pid] === "da");
      if (!ss.length) return { v: null };
      const n = ss.filter(s => !!D.rpe[pid]?.[s.date]).length, v = n / ss.length * 100;
      return { v, n, of: ss.length, tone: v < 60 ? "crit" : v < 80 ? "warn" : null };
    }
    case "extra": {
      const L = (D.extra[pid] || []).filter(x => inR(x.date, { from: r.from, to: end }));
      return { v: L.length, min: sum(L.map(x => x.min)) };
    }
    case "well": case "sleep": case "wellRate": {
      const ws = Object.entries(D.well[pid] || {}).filter(([d]) => inR(d, { from: r.from, to: end }));
      if (def.key === "wellRate") {
        // ab dem ersten Morgen-Check überhaupt (wer die App nicht nutzt: „–“ statt 0 %)
        const all = Object.keys(D.well[pid] || {}).sort(); if (!all.length) return { v: null };
        const f = all[0] > r.from ? all[0] : r.from, days = diff(f, end) + 1; if (days <= 0) return { v: null };
        const v = Math.min(100, ws.length / days * 100);
        return { v, n: ws.length, of: days, tone: v < 50 ? "crit" : v < 75 ? "warn" : null };
      }
      if (!ws.length) return { v: null };
      if (def.key === "well") { const v = avg(ws.map(([, w]) => w.sum))!; return { v, n: ws.length, tone: v >= 19 ? "crit" : v >= 15 ? "warn" : null }; }
      const v = avg(ws.map(([, w]) => w.schlaf))!, tg = sleepTarget(ageOn(p.geb, parse(today)));
      return { v, n: ws.length, tone: v < tg[0] - 1 ? "crit" : v < tg[0] ? "warn" : null };
    }
    case "rateG": {
      const L = D.ratings.filter(x => x.pid === pid && x.kind === "spiel" && x.rating != null && inR(x.date, { from: r.from, to: end }));
      return { v: avg(L.map(x => x.rating!)), n: L.length };
    }
    case "marks": {
      const L = D.ratings.filter(x => x.pid === pid && x.kind === "training" && x.mark && inR(x.date, { from: r.from, to: end }));
      const good = L.filter(x => x.mark === "good").length, poor = L.length - good;
      return { v: good - poor, good, poor, tone: good > poor ? "ok" : poor > good ? "warn" : null };
    }
    case "devC": case "devS": {
      const by = def.key === "devC" ? "coach" : "self";
      const a = D.assessments.filter(x => x.pid === pid && x.by === by && x.date <= end).sort((x, y) => x.date < y.date ? 1 : -1)[0];
      return { v: assessAvg(E, a, pid), date: a?.date || null };
    }
    case "absDays": {
      let n = 0; for (let d = r.from; d <= end; d = addDays(d, 1)) if (sickOn(E, pid, d)) n++;
      return { v: n, tone: n >= 14 ? "crit" : n >= 5 ? "warn" : null };
    }
    case "inj": {
      const n = D.absences.filter(a => a.pid === pid && a.typ === "verletzung" && inR(a.von, { from: r.from, to: end })).length;
      return { v: n, tone: n >= 2 ? "warn" : null };
    }
  }
  // Spiele: nur wenn das Team im Zeitraum Spiele mit Spieldaten hat (sonst „–“ statt 0)
  const ms = D.matches.filter(m => inR(m.date, { from: r.from, to: end }) && D.stats[m.id] && Object.keys(D.stats[m.id]).length);
  if (!ms.length) return { v: null };
  const L = ms.map(m => D.stats[m.id][pid]).filter((x): x is NonNullable<typeof x> => !!x), played = L.filter(x => x.min > 0);
  switch (def.key) {
    case "games": return { v: played.length, of: ms.length };
    case "starts": return { v: played.filter(x => x.start).length, of: ms.length };
    case "min": return { v: sum(L.map(x => x.min)) };
    case "minPct": { const v = sum(L.map(x => x.min)) / (ms.length * E.matchMin()) * 100; return { v: Math.min(100, v) }; }
    case "goals": return { v: sum(L.map(x => x.goals)) };
    case "assists": return { v: sum(L.map(x => x.assists)) };
    case "scorer": return { v: sum(L.map(x => x.goals + x.assists)) };
    // Torhüter: nur Spiele, in denen Gegentore bzw. Paraden erfasst sind (sonst „–“ statt 0)
    case "clean": { const L2 = played.filter(x => x.conceded != null); return { v: L2.length ? L2.filter(x => x.min >= Math.min(60, E.matchMin()) && x.conceded === 0).length : null }; }
    case "conc": { const L2 = played.filter(x => x.conceded != null); return { v: L2.length ? sum(L2.map(x => x.conceded!)) : null, n: L2.length }; }
    case "saves": { const L2 = played.filter(x => x.saves != null); return { v: L2.length ? sum(L2.map(x => x.saves!)) : null, n: L2.length }; }
  }
  return { v: null };
}

/** Teamwert einer Spalte: Mittelwert bzw. Summe der vorhandenen Werte (null = keine Werte) */
export function teamValue(def: StatDef, vals: (number | null)[]): number | null {
  const L = vals.filter((x): x is number => x != null); if (!L.length) return null;
  return def.agg === "sum" ? sum(L) : sum(L) / L.length;
}
/** Sortierung: beste zuerst (bei neutralen Kennzahlen: größte zuerst), fehlende Werte immer am Ende */
export function compareStat(def: StatDef, a: number | null, b: number | null, dir: 1 | -1 = 1): number {
  if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
  const best = def.better === "low" ? a - b : b - a;
  return best * dir;
}
/** Tage im Zeitraum */
export const rangeDays = (r: Range): number => diff(r.from, r.to) + 1;
