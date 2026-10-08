// Fachlogik der Trainerbank: Spieltags-Bezug, Wochenplan, Erholung, Kennzahlen, Empfehlungen.
// Alles hier ist reine Berechnung auf einem TeamData-Objekt – ohne UI und ohne Datenbank.

import { CONTENT } from "./content";
import {
  BANDS, KIND_RPE, MATCHMIN, MDS, PLAYER_VIEW, bandOf, capOf, classDef, classLabel, groupOf, isGrowthAge, sleepTarget, DEPTH, teamLabel,
} from "./classes";
import { addDays, ageOn, at, clamp, diff, iso, monday, parse, sum } from "./dates";
import { translator } from "./i18n";
import { cmjDrop, fitnessIndex } from "./perf";
import { phaseOn } from "./prep";
import { headCoach } from "./people";
import type {
  Absence, AttStatus, CoachMsg, Complaint, CustomKind, Kind, Lang, Match, Pitch, Player, PotCat, Session, Status,
  TeamData, TeamEvent, Wellness, WeekMode, MsgType, PlayerViewKey, Rating, Video,
} from "./types";

export interface EngineOptions {
  lang: Lang;
  /** Aktueller Zeitpunkt (für Tests überschreibbar). */
  now?: Date;
}

export interface Change { what: string; from: number | string; to: number | string; short?: string }
export interface PlanTrain {
  date: string; md: string; kind: Kind; rpe: number; dauer: number; platz: Pitch; spielfrei: boolean; coach: boolean;
  notes: string[]; changes: Change[]; ck: string; inhalt: string; keptRest?: boolean; adjusted?: boolean; notReady: Player[];
}
export interface PlanItem {
  date: string; md: string; match: Match | null; events: TeamEvent[]; train: PlanTrain | null; cancelled: boolean; trainDay: boolean;
  /** Tag liegt in einer geplanten Pause (kein Mannschaftstraining, Spielerprogramm) */
  brk?: boolean;
}
export interface WeekPlan {
  ws: string; mode: WeekMode; items: PlanItem[]; tr: PlanTrain[];
  limit: { congested?: boolean; blocked?: string[] } | null;
  baseAU: number; trainAU: number; matchAU: number;
}
export interface Metrics {
  series: { d: string; L: number; acwr: number | null }[];
  days: number; wk: number; delta: number | null; chronic: number; acwr: number | null; mono: number | null;
}
export interface RecoveryNeed { h: number; lines: [string, number][] }
export interface IntenseEvent { date: string; typ: "Training" | "Spiel"; rpe: number; min: number; start: Date; dauer: number }
export interface Recovery {
  none?: boolean;
  ev?: IntenseEvent; need?: RecoveryNeed; ready?: Date; remaining: number; pct: number;
  next?: { date: string; start: Date; match: Match | null; rpe: number } | null; notReady: boolean;
}
export interface Profile {
  p: Player; m: Metrics | null; st: Status; att: number | null; sl: number | null; w0: Wellness | null;
  rec: Recovery | null; gr: { cm: number; rate: number; spurt: boolean } | null; tg: [number, number];
  reasons: [string, string][]; ab: Absence | undefined;
}
export interface Hint { cat: PotCat; text: string }
export interface RecSuggestion { typ: MsgType; text: string; bis: string }
export interface PlayerState { k: "ready" | "easy" | "pause"; why: string }
export interface Tip { head: string; items: string[]; source?: string }

const COMPLAINT_CLEAR: Complaint = "clear";

export type Engine = ReturnType<typeof createEngine>;

export function createEngine(D: TeamData, opts: EngineOptions) {
  const NOW = opts.now || new Date();
  const TODAY = iso(NOW);
  const tr8 = translator(opts.lang);
  const { t, tf, tl, num } = tr8;
  const team = D.team;
  const S = team.settings;
  const grp = groupOf(team.cls);
  const CAP = capOf(team.cls);
  const lvl = (n: number): boolean => DEPTH[team.depth] >= n;
  const mods = team.modules;

  // ---------- Trainingsarten ----------
  const isCustom = (k: string): k is `c:${string}` => typeof k === "string" && k.startsWith("c:");
  const customOf = (k: string): CustomKind | undefined => D.kinds.find(x => "c:" + x.id === k);
  const kn = (k: Kind | string): string => isCustom(k) ? (customOf(k)?.name || "?") : t("k_" + k);
  const allKinds = (): Kind[] => [...(["regen", "frei", "aktiv", "schnell", "taktik", "extensiv", "intensiv", "aufbau"] as Kind[]), ...D.kinds.map(x => ("c:" + x.id) as Kind)];
  const kindRpe = (k: Kind): number => Math.min(CAP, isCustom(k) ? (customOf(k)?.rpe || 5) : (KIND_RPE[k as keyof typeof KIND_RPE] ?? 5));
  const contentOf = (ck: string): string => isCustom(ck) ? (customOf(ck)?.inhalt || "") : (CONTENT[ck] || CONTENT.taktik)[opts.lang];
  function contentKey(kind: Kind, platz: Pitch): string {
    if (isCustom(kind)) return kind;
    if (kind === "intensiv" && grp === "u15") return "intensiv_u15";
    return CONTENT[kind + "_" + platz] ? kind + "_" + platz : kind;
  }
  const intWord = (r: number): string => !r ? t("i_0") : r <= 3 ? t("i_easy") : r <= 5 ? t("i_mid") : r <= 7 ? t("i_high") : t("i_max");

  // ---------- Spiel ----------
  const matchMin = (): number => MATCHMIN[team.cls] || 90;
  const matchRpe = (): number => team.principles.MD?.rpe || (grp === "u15" ? 7 : 8);
  const matchLoad = (): number => matchMin() * matchRpe();

  // ---------- Kalender ----------
  const matchOn = (d: string): Match | undefined => D.matches.find(m => m.date === d);
  const eventsOn = (d: string): TeamEvent[] => D.events.filter(e => e.date === d);
  const regularDay = (d: string): boolean => !!S.days[parse(d).getDay()];
  const dayCfg = (d: string) => S.days[parse(d).getDay()] || { zeit: "19:30", platz: "halb" as Pitch, dauer: S.dauer };
  const zeitOf = (d: string): string => D.cal[d]?.zeit || dayCfg(d).zeit;
  const durOf = (d: string): number => D.cal[d]?.dauer || dayCfg(d).dauer || S.dauer;
  const inBreak = (d: string): boolean => !!mods.vorbereitung && phaseOn(D, d)?.kind === "break";
  function isTraining(d: string): boolean {
    const c = D.cal[d] || {};
    if (matchOn(d)) return false;
    if (c.extra) return true;
    if (c.cancel) return false;
    if (eventsOn(d).some(e => e.ersetzt)) return false;
    if (inBreak(d)) return false;
    return regularDay(d);
  }
  const absenceOn = (pid: string, d: string): Absence | undefined => D.absences.find(a => a.pid === pid && a.von <= d && (!a.bis || d <= a.bis));
  const absentOn = (d: string): Player[] => D.players.filter(p => absenceOn(p.id, d));
  function mdOf(d: string): { md: string; after: number; before: number } {
    const ms = D.matches.map(m => m.date).sort();
    const prev = ms.filter(x => x < d).at(-1), next = ms.find(x => x > d);
    const after = prev ? diff(prev, d) : 99, before = next ? diff(d, next) : 99;
    if (matchOn(d)) return { md: "MD", after: 0, before: 0 };
    if (after <= 2 && after < before) return { md: "MD+" + after, after, before };
    if (before <= 6) return { md: "MD-" + before, after, before };
    if (after <= 3) return { md: "MD+" + after, after, before };
    return { md: "", after, before };
  }

  // ---------- Personen ----------
  const P = (id: string): Player | undefined => D.players.find(p => p.id === id);
  const age = (p: Player): number => ageOn(p.geb, NOW);
  const name = (p: Player): string => (p.vn + " " + (p.nn || "")).trim();

  // ---------- Kennzahlen ----------
  function daily(pid: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [d, e] of Object.entries(D.rpe[pid] || {})) if (d <= TODAY) out[d] = (out[d] || 0) + e.rpe * e.min;
    for (const x of (D.extra[pid] || [])) if (x.date <= TODAY) out[x.date] = (out[x.date] || 0) + x.rpe * x.min;
    return out;
  }
  const lastSessionDate = (): string => D.sessions.length ? D.sessions.reduce((a, s) => s.date > a && s.date <= TODAY ? s.date : a, "") || TODAY : TODAY;
  function metrics(pid: string): Metrics | null {
    const dl = daily(pid), dates = Object.keys(dl).sort(); if (!dates.length) return null;
    const first = dates[0], n = diff(first, TODAY), all: { d: string; L: number }[] = [];
    for (let i = 0; i <= n; i++) { const d = addDays(first, i); all.push({ d, L: dl[d] || 0 }); }
    const Ls = Array(27).fill(0).concat(all.map(x => x.L)) as number[];
    // ACWR „entkoppelt“ (uncoupled): akute Woche (7 Tage) im Verhältnis zum Wochenmittel der drei Wochen davor
    // (Tage 8–28). Die gekoppelte Variante (akute Woche in der chronischen enthalten) verzerrt das Verhältnis
    // mathematisch (Lolli et al. 2019; Windt & Gabbett 2018).
    const series = all.map((x, i) => { const j = i + 27, a7 = sum(Ls.slice(j - 6, j + 1)), c21 = sum(Ls.slice(j - 27, j - 6)) / 3; return { d: x.d, L: x.L, acwr: i >= 6 && c21 > 0 ? a7 / c21 : null }; });
    // Bezugstag = letzte Teameinheit, damit Ruhetage die Werte nicht verzerren
    const ref = lastSessionDate(), cut = Ls.length - Math.max(0, diff(ref, TODAY));
    const loads = Ls.slice(cut - 28, cut), l7 = loads.slice(-7), p7 = loads.slice(-14, -7), wk = sum(l7), mean = wk / 7, pwk = sum(p7), chronic = sum(loads.slice(0, 21)) / 3;
    const sd = Math.sqrt(sum(l7.map(x => (x - mean) ** 2)) / 7);
    return { series, days: n + 1, wk, delta: pwk > 0 ? (wk - pwk) / pwk : null, chronic, acwr: chronic > 0 ? wk / chronic : null, mono: sd > 0 ? mean / sd : null };
  }
  const injuryOf = (pid: string): Absence | null => { const a = absenceOn(pid, TODAY); return a && ["verletzung", "krank"].includes(a.typ) ? a : null; };
  const returning = (pid: string): Absence | undefined => D.absences.find(a => a.pid === pid && a.typ === "verletzung" && !!a.bis && a.bis < TODAY && diff(a.bis, TODAY) <= 21);
  function status(pid: string, m: Metrics | null): Status {
    if (injuryOf(pid)) return "inj";
    if (!mods.belastung || !m) return "none";
    if (m.days < 21) return "build";
    const a = m.acwr || 0; return a > 1.5 ? "crit" : a > 1.3 ? "warn" : a >= 0.8 ? "ok" : "low";
  }
  function attStatus(d: string, pid: string): AttStatus | "offen" | `abs:${string}` {
    const v = D.att[d]?.[pid]; if (v) return v;
    const a = absenceOn(pid, d); return a ? (("abs:" + a.typ) as `abs:${string}`) : "offen";
  }
  /** Erster Tag mit Anwesenheit/RPE (neue Spieler zählen erst ab da). */
  function firstSeen(pid: string): string | null {
    let f: string | null = null;
    for (const d of Object.keys(D.att)) if (D.att[d][pid] && (!f || d < f)) f = d;
    for (const d of Object.keys(D.rpe[pid] || {})) if (!f || d < f) f = d;
    return f;
  }
  function attendance(pid: string): number | null {
    const first = firstSeen(pid); if (!first) return null;
    const ss = D.sessions.filter(s => s.date >= first && s.date <= TODAY && diff(s.date, TODAY) <= 28 && !["abs:verletzung", "abs:krank"].includes(attStatus(s.date, pid)));
    if (!ss.length) return null; return ss.filter(s => attStatus(s.date, pid) === "da").length / ss.length;
  }
  function sleep7(pid: string): number | null { const v: number[] = []; for (let k = 0; k < 7; k++) { const w = D.well[pid]?.[addDays(TODAY, -k)]; if (w) v.push(w.schlaf); } return v.length ? sum(v) / v.length : null; }
  function growthInfo(pid: string) {
    const g = D.growth[pid]; if (!mods.wachstum || !g || g.length < 2) return null;
    const s = [...g].sort((a, b) => a.date < b.date ? -1 : 1), a = s[s.length - 1], b = s.find(x => diff(x.date, a.date) >= 330) || s[0];
    const days = diff(b.date, a.date); if (days <= 0) return null;
    const rate = (a.cm - b.cm) / (days / 365); return { cm: a.cm, rate, spurt: rate >= 7 };
  }
  function teamChronic(): number | null {
    const all = D.players.map(p => ({ m: metrics(p.id), a: attendance(p.id) })).filter(x => x.m && x.m.days >= 21);
    const reg = all.filter(x => x.a == null || x.a >= 0.8), v = (reg.length >= 5 ? reg : all).map(x => x.m!.chronic);
    return v.length ? sum(v) / v.length : null;
  }

  // ---------- Erholung ----------
  function lastIntenseBefore(p: Player, start: Date, items?: PlanItem[]): IntenseEvent | null {
    const ev: IntenseEvent[] = [];
    for (const [d, e] of Object.entries(D.rpe[p.id] || {})) {
      const s = D.sessions.find(x => x.date === d);
      if (e.rpe >= 7) ev.push({ date: d, typ: s ? s.typ : "Training", rpe: e.rpe, min: e.min, start: at(d, s ? s.zeit : zeitOf(d)), dauer: s ? s.dauer : 90 });
    }
    const sd = iso(start);
    for (let d = addDays(sd, -6) > TODAY ? addDays(sd, -6) : TODAY; d <= sd; d = addDays(d, 1)) {
      if (absenceOn(p.id, d)) continue;
      const m = matchOn(d);
      if (m) { ev.push({ date: d, typ: "Spiel", rpe: matchRpe(), min: matchMin(), start: at(d, m.zeit), dauer: matchMin() + 15 }); continue; }
      if (!isTraining(d)) continue;
      const it = (items || []).find(x => x.date === d);
      let tr: { rpe: number; dauer: number } | null = it && it.train ? it.train : null;
      if (!tr) { const md = mdOf(d).md, pr = team.principles[md]; tr = { rpe: pr ? Math.min(CAP, pr.rpe) : 6, dauer: durOf(d) }; }
      if (tr.rpe >= 7) ev.push({ date: d, typ: "Training", rpe: tr.rpe, min: tr.dauer, start: at(d, zeitOf(d)), dauer: tr.dauer });
    }
    return ev.filter(e => e.start < start).sort((a, b) => b.start.getTime() - a.start.getTime())[0] || null;
  }
  function recoveryNeed(p: Player, ev: { typ: "Training" | "Spiel"; rpe: number; min: number }): RecoveryNeed {
    const a = age(p), b = BANDS[Math.max(0, bandOf(a))], lines: [string, number][] = []; let base: number;
    if (ev.typ === "Spiel" && ev.min >= 30) {
      base = b[2]; lines.push([t("base") + ": " + t("it_match") + ", " + a + " " + t("years"), base]);
      if (ev.min < 60) { const r = -Math.round(base * 0.25); lines.push([t("mod_short"), r]); base += r; }
    } else {
      base = b[1]; lines.push([t("base") + ": " + t("it_training") + ", " + a + " " + t("years"), base]);
      if (ev.rpe >= 9) { const r = Math.round(base * 0.2); lines.push([t("mod_rpe"), r]); base += r; }
    }
    const sl = sleep7(p.id), tg = sleepTarget(a);
    if (sl != null && sl < tg[0]) { const r = Math.round(base * 0.1); lines.push([t("mod_sleep"), r]); base += r; }
    if (mods.leistung) {
      // Ausdauer aus Leistungstests: fittere Spieler erholen sich etwas schneller (max. ±10 %)
      const fit = fitnessIndex(D, p.id, grp, TODAY);
      if (fit && Math.abs(fit.fi - 1) >= 0.03) { const r = -Math.round(base * Math.max(-0.1, Math.min(0.1, fit.fi - 1))); if (r) { lines.push([tf(r < 0 ? "mod_fitHi" : "mod_fitLo", { t: t("ts_" + fit.test) }), r]); base += r; } }
      const drop = cmjDrop(D, p.id, TODAY);
      if (drop != null && drop >= 0.05) { const r = drop >= 0.08 ? 24 : 12; lines.push([tf("mod_cmj", { p: Math.round(drop * 100) }), r]); base += r; }
    }
    const w = D.well[p.id]?.[TODAY] || D.well[p.id]?.[addDays(TODAY, -1)];
    if (w && w.beschw === COMPLAINT_CLEAR) { lines.push([t("mod_sore"), 12]); base += 12; }
    if (returning(p.id)) { lines.push([t("mod_return"), 12]); base += 12; }
    const g = growthInfo(p.id); if (g && g.spurt) { lines.push([t("mod_spurt"), 6]); base += 6; }
    return { h: base, lines };
  }
  function notReadyFor(plan: { date: string }, items: PlanItem[]): Player[] {
    const start = at(plan.date, zeitOf(plan.date));
    return D.players.filter(p => !absenceOn(p.id, plan.date)).filter(p => {
      const ev = lastIntenseBefore(p, start, items); if (!ev) return false;
      const end = new Date(ev.start.getTime() + ev.dauer * 60000);
      return end.getTime() + recoveryNeed(p, ev).h * 3600e3 > start.getTime();
    });
  }

  // ---------- Wochenplan ----------
  const WP: Record<string, WeekPlan> = {};
  const weekPlan = (ws: string): WeekPlan => WP[ws] ||= weekPlanCalc(ws);

  function weekPlanCalc(ws: string): WeekPlan {
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const mode: WeekMode = D.wkMode[ws] || "normal", cap = CAP;
    const items: PlanItem[] = days.map(d => {
      const m = matchOn(d), ev = eventsOn(d), trd = isTraining(d), mdx = mdOf(d);
      const brk = !trd && !m && inBreak(d);
      return { date: d, md: mdx.md, match: m || null, events: ev, train: null, cancelled: !trd && regularDay(d) && !m && !brk, trainDay: trd, brk };
    });
    // 1. Vorschlag aus den Prinzipien
    const free: [Kind, number][] = [["intensiv", cap], ["taktik", 5], ["extensiv", Math.min(7, cap)], ["aufbau", 6]];
    let fi = 0, ki = 0;
    items.forEach(x => {
      if (!x.trainDay) return;
      let kind: Kind, rpe: number, spielfrei = false, coach = false; const o = D.over[x.date];
      if (o && o.kind) { kind = o.kind; rpe = o.rpe != null ? o.rpe : kindRpe(kind); coach = true; spielfrei = !x.md; }
      else if (grp === "u11") { kind = "kids"; rpe = 5; }
      else if (x.md && team.principles[x.md]) { kind = team.principles[x.md].kind; rpe = team.principles[x.md].rpe; }
      else { const f = free[fi++ % free.length]; kind = f[0]; rpe = f[1]; spielfrei = true; }
      const platz = dayCfg(x.date).platz, dur = durOf(x.date);
      x.train = {
        date: x.date, md: x.md, kind, rpe, dauer: kind === "frei" ? 0 : dur, platz, spielfrei, coach, notes: [], changes: [],
        ck: kind === "kids" ? "kids" + (ki++ % 2) : contentKey(kind, platz), inhalt: "", notReady: [],
      };
      if (kind === "frei" && o?.keepRest) { Object.assign(x.train, { kind: "regen", rpe: 2, dauer: Math.min(60, dur), ck: contentKey("regen", platz), keptRest: true }); }
    });
    const tr = items.filter(x => x.train).map(x => x.train!) as PlanTrain[];
    let limit: WeekPlan["limit"] = null; let baseAUv: number | null = null;
    if (grp !== "u11") {
      tr.forEach(p => { if (p.rpe > cap && !p.coach) { p.rpe = cap; p.notes.push("au_cap"); } });
      const AU = (): number => sum(tr.map(p => p.dauer * p.rpe));
      const baseAU = AU(); baseAUv = baseAU;
      const change = (p: PlanTrain, what: string, from: number | string, to: number | string): void => { p.changes.push({ what, from, to }); };
      const blocked = new Set<string>();
      const avail = (p: PlanTrain): number => D.players.filter(x => !absenceOn(x.id, p.date)).length;
      // Erhöhung nur, wenn der Kader bis dahin erholt ist – sonst würde der Erholungscheck sie wieder zurücknehmen
      const up = (p: PlanTrain, max: number): boolean => {
        if (p.rpe >= max) return false; p.rpe++;
        if (p.rpe >= 7 && mods.regeneration && notReadyFor(p, items).length > 0.4 * avail(p)) { p.rpe--; blocked.add(p.date); return false; }
        change(p, "RPE", p.rpe - 1, p.rpe); return true;
      };
      const steps = (dir: number): (() => boolean | void)[] => {
        const L: (() => boolean | void)[] = [];
        const byKind = (k: Kind): PlanTrain[] => tr.filter(p => p.kind === k && !p.keptRest && !p.coach);
        const customs = (): PlanTrain[] => tr.filter(p => isCustom(p.kind) && !p.coach && p.rpe > 4);
        if (dir > 0) {
          byKind("extensiv").forEach(p => L.push(() => up(p, Math.min(7, cap))));
          byKind("aufbau").forEach(p => L.push(() => up(p, Math.min(7, cap))));
          byKind("taktik").forEach(p => L.push(() => up(p, 6)));
          byKind("intensiv").forEach(p => L.push(() => up(p, cap)));
          if (!S.fix) {
            byKind("intensiv").forEach(p => L.push(() => { change(p, t("minutes"), p.dauer, p.dauer + 15); p.dauer += 15; return true; }));
            byKind("extensiv").forEach(p => L.push(() => { change(p, t("minutes"), p.dauer, p.dauer + 15); p.dauer += 15; return true; }));
          }
          byKind("schnell").forEach(p => L.push(() => up(p, 5)));
        } else if (!S.fix) {
          tr.filter(p => p.dauer > 60).forEach(p => L.push(() => { const n = Math.max(60, Math.round(p.dauer * 0.7 / 5) * 5); if (n < p.dauer) { change(p, t("minutes"), p.dauer, n); p.dauer = n; return true; } }));
          byKind("intensiv").forEach(p => L.push(() => { if (p.rpe > 7) { change(p, "RPE", p.rpe, p.rpe - 1); p.rpe--; return true; } }));
          customs().forEach(p => L.push(() => { if (p.rpe > 4) { change(p, "RPE", p.rpe, p.rpe - 1); p.rpe--; return true; } }));
        } else {
          customs().forEach(p => L.push(() => { const n = Math.max(3, p.rpe - 2); if (n < p.rpe) { change(p, "RPE", p.rpe, n); p.rpe = n; return true; } }));
          const set = (k: Kind, lim: number): void => byKind(k).forEach(p => L.push(() => { if (p.rpe > lim) { change(p, "RPE", p.rpe, lim); p.rpe = lim; return true; } }));
          set("intensiv", 6); set("extensiv", 4); set("aufbau", 4); set("regen", 2); set("schnell", 3); set("taktik", 4);
        }
        return L;
      };
      const run = (dir: number, done: () => boolean): void => { for (const s of steps(dir)) { if (done()) break; s(); } };
      // Normalwoche: in kleinen Schritten senken, Nebentage zuerst, der intensive Schlüsseltag zuletzt
      const gentleDown = (done: () => boolean): void => {
        const order: [Kind, number][] = [["extensiv", 4], ["aufbau", 4], ["taktik", 4], ["schnell", 3], ["intensiv", 6]];
        for (let pass = 0; pass < 4; pass++) for (const [k, min] of order) for (const p of tr.filter(q => q.kind === k && !q.keptRest && !q.coach)) {
          if (done()) return; if (p.rpe > min) { change(p, "RPE", p.rpe, p.rpe - 1); p.rpe--; }
        }
      };
      if (mode === "aufbau") {
        if (items.filter(x => x.match).length >= 2) limit = { congested: true };
        else { run(+1, () => AU() >= baseAU * 1.10); if (AU() < baseAU * 1.10) limit = { blocked: [...blocked].sort() }; }
        // Ergänzungstraining am Tag nach dem Spiel für Spieler mit wenig Einsatzzeit
        tr.filter(p => p.kind === "regen" && p.md === "MD+1").forEach(p => { p.changes.push({ what: t("comp_what"), from: "", to: "30 " + t("min") + " · RPE 7", short: t("comp_short") }); p.notes.push("au_comp"); });
      }
      if (mode === "entlastung") run(-1, () => AU() <= baseAU * 0.70);
      tr.forEach(p => { if (p.changes.length) p.notes.push("au_mode"); });
      // Abgleich mit der gewohnten Teamlast (nur Normalwoche)
      const chronic = teamChronic(), matchAU = items.filter(x => x.match).length * matchLoad();
      if (chronic && mode === "normal") {
        const r = (AU() + matchAU) / chronic;
        if (r > 1.25) { const before = tr.map(p => p.rpe); gentleDown(() => (AU() + matchAU) / chronic <= 1.2); tr.forEach((p, i) => { if (p.rpe !== before[i]) p.notes.push("au_down"); }); }
        else if (r < 0.85) { const before = tr.map(p => p.rpe); run(+1, () => (AU() + matchAU) / chronic >= 0.9); tr.forEach((p, i) => { if (p.rpe !== before[i]) p.notes.push("au_up"); }); }
      }
      // zwei sehr harte Tage hintereinander vermeiden
      tr.forEach(p => { const pv = tr.find(q => q.date === addDays(p.date, -1)); if (pv && pv.rpe >= 8 && p.rpe >= 8 && !p.coach) { p.changes.push({ what: "RPE", from: p.rpe, to: 7 }); p.rpe = 7; p.notes.push("au_cons"); } });
      // Erholungscheck pro Spieler
      tr.forEach(p => {
        p.notReady = [];
        if (p.rpe >= 7 && mods.regeneration) {
          p.notReady = notReadyFor(p, items);
          const av = D.players.filter(x => !absenceOn(x.id, p.date)).length;
          if (p.notReady.length > 0.4 * av && !p.coach) { p.changes.push({ what: "RPE", from: p.rpe, to: p.rpe - 1 }); p.rpe--; p.notes.push("au_ready"); p.notReady = p.rpe >= 7 ? notReadyFor(p, items) : []; }
        }
      });
    }
    // 2. Anpassungen des Trainers
    tr.forEach(p => {
      const o = D.over[p.date];
      if (o && (o.rpe != null || o.dauer != null || o.inhalt != null || o.kind)) {
        if (o.rpe != null) p.rpe = o.rpe; if (o.dauer != null) p.dauer = o.dauer; if (o.inhalt != null) p.inhalt = o.inhalt; p.adjusted = true;
        if (grp !== "u11" && mods.regeneration) p.notReady = p.rpe >= 7 ? notReadyFor(p, items) : [];
      }
      if (!p.inhalt) p.inhalt = contentOf(p.ck);
    });
    const trainAU = sum(tr.map(p => p.dauer * p.rpe));
    return { ws, mode, items, tr, limit, baseAU: baseAUv ?? trainAU, trainAU, matchAU: items.filter(x => x.match).length * matchLoad() };
  }
  const whyOf = (p: PlanTrain): string => grp === "u11" ? t("w_kids") : isCustom(p.kind) ? tf("w_custom", { n: kn(p.kind) }) : t(p.spielfrei ? "w_spielfrei" : "w_" + p.kind);

  function recovery(p: Player): Recovery | null {
    if (!mods.regeneration) return null;
    const items = weekPlan(monday(TODAY)).items.concat(weekPlan(addDays(monday(TODAY), 7)).items);
    const ev = lastIntenseBefore(p, NOW, []); if (!ev) return { none: true, remaining: 0, pct: 100, notReady: false };
    const end = new Date(ev.start.getTime() + ev.dauer * 60000), need = recoveryNeed(p, ev), ready = new Date(end.getTime() + need.h * 3600e3);
    const nx = items.filter(x => x.date >= TODAY && ((x.train && x.train.rpe >= 7) || x.match))
      .map(x => ({ date: x.date, start: at(x.date, x.match ? x.match.zeit : zeitOf(x.date)), match: x.match, rpe: x.train ? x.train.rpe : matchRpe() }))
      .find(x => x.start > NOW) || null;
    return {
      ev, need, ready, remaining: Math.max(0, (ready.getTime() - NOW.getTime()) / 3600e3),
      pct: Math.min(100, Math.max(0, (NOW.getTime() - end.getTime()) / (ready.getTime() - end.getTime()) * 100)), next: nx, notReady: nx ? ready > nx.start : false,
    };
  }

  // ---------- Profil & Empfehlungen ----------
  function profile(pid: string): Profile {
    const p = P(pid)!;
    const m = mods.belastung ? metrics(pid) : null, st = status(pid, m), att = mods.beteiligung ? attendance(pid) : null;
    const sl = mods.belastung ? sleep7(pid) : null, w0 = mods.belastung ? (D.well[pid]?.[TODAY] || D.well[pid]?.[addDays(TODAY, -1)] || null) : null;
    const rec = st !== "inj" ? recovery(p) : null, gr = growthInfo(pid), tg = sleepTarget(age(p)), ab = absenceOn(pid, TODAY), reasons: [string, string][] = [];
    if (st === "crit") reasons.push(["crit", lvl(2) ? "ACWR " + num(m!.acwr!, 2) : t("st_crit")]);
    if (st === "warn") reasons.push(["warn", lvl(2) ? "ACWR " + num(m!.acwr!, 2) : t("st_warn")]);
    if (st === "low") reasons.push(["low", t("st_low")]);
    if (st === "inj" && ab) reasons.push(["inj", ab.typ === "verletzung" && ab.stufe ? t("r_rehab") + " " + ab.stufe : t("ab_" + ab.typ)]);
    else if (ab) reasons.push(["build", t("ab_" + ab.typ)]);
    if (returning(pid) && lvl(1)) reasons.push(["warn", t("r_return")]);
    if (rec && rec.notReady) reasons.push(["crit", t("r_notrec")]);
    if (w0 && w0.beschw !== "none") reasons.push(["crit", t("r_sore")]);
    if (sl != null && sl < tg[0]) reasons.push(["warn", t("r_sleep") + " " + num(sl, 1) + " h"]);
    if (gr && gr.spurt) reasons.push(["warn", t("r_spurt")]);
    if (att != null && att < 0.8 && st !== "inj") reasons.push(["warn", t("r_att") + " " + Math.round(att * 100) + " %"]);
    const drop = mods.leistung ? cmjDrop(D, pid, TODAY) : null;
    if (drop != null && drop >= 0.05) reasons.push([drop >= 0.08 ? "crit" : "warn", "CMJ −" + Math.round(drop * 100) + " %"]);
    return { p, m, st, att, sl, w0, rec, gr, tg, reasons, ab };
  }
  function advice(pr: Profile): string {
    if (pr.st === "inj") return t("a_inj");
    const x: string[] = [];
    if (pr.w0 && pr.w0.beschw === COMPLAINT_CLEAR) x.push(t("a_sore"));
    if (pr.rec && pr.rec.notReady) x.push(t("a_notrec"));
    if (returning(pr.p.id) && lvl(1)) x.push(t("a_return"));
    if (mods.belastung && t("a_" + pr.st)) x.push(t("a_" + pr.st));
    if (pr.sl != null && pr.sl < pr.tg[0]) x.push(t("a_sleep").replace("{t}", pr.tg[0] + "–" + pr.tg[1] + " h"));
    if (pr.gr && pr.gr.spurt) x.push(t("a_spurt"));
    return x.filter(Boolean).join(" ");
  }
  function nextItem(): { date: string; i: number; match?: Match; train?: PlanTrain } | null {
    for (let i = 0; i <= 21; i++) {
      const d = addDays(TODAY, i), m = matchOn(d);
      if (m && at(d, m.zeit) > NOW) return { date: d, i, match: m };
      if (isTraining(d) && at(d, zeitOf(d)) > NOW) {
        const trn = weekPlan(monday(d)).items.find(x => x.date === d)!.train!;
        if (trn.kind === "frei") continue; return { date: d, i, train: trn };
      }
    }
    return null;
  }
  const sessAvg = (d: string): number | null => { const v = D.players.map(p => D.rpe[p.id]?.[d]).filter(Boolean).map(e => e!.rpe); return v.length ? sum(v) / v.length : null; };

  function dataHints(p: Player): Hint[] {
    const pr = profile(p.id), out: Hint[] = [];
    if (pr.att != null && pr.att >= 0.9 && ["ok", "low"].includes(pr.st) && !D.absences.some(a => a.pid === p.id && a.typ === "verletzung" && diff(a.von, TODAY) <= 120)) out.push({ cat: "verf", text: tf("ph1", { a: Math.round(pr.att * 100) }) });
    if (pr.st === "low" && pr.att != null && pr.att >= 0.7) out.push({ cat: "ath", text: t("ph2") });
    const ds = Object.keys(D.rpe[p.id] || {}).filter(d => diff(d, TODAY) <= 28 && D.sessions.find(s => s.date === d)?.typ === "Training");
    if (ds.length >= 6) {
      const dif = sum(ds.map(d => { const own = D.rpe[p.id][d].rpe, tm = D.players.filter(q => q.id !== p.id && D.rpe[q.id]?.[d]).map(q => D.rpe[q.id][d].rpe); return tm.length ? own - sum(tm) / tm.length : 0; })) / ds.length;
      if (dif <= -1) out.push({ cat: "ath", text: tf("ph3", { d: num(-dif, 1) }) });
    }
    const ms = D.sessions.filter(s => s.typ === "Spiel" && diff(s.date, TODAY) <= 42).map(s => D.rpe[p.id]?.[s.date]?.min || 0);
    if (ms.length >= 3 && sum(ms) / ms.length < 35 && pr.att != null && pr.att >= 0.85) out.push({ cat: "ment", text: t("ph4") });
    if (pr.gr && pr.gr.spurt) out.push({ cat: "ath", text: t("ph5") });
    if (pr.sl != null && pr.sl < pr.tg[0]) out.push({ cat: "verf", text: tf("ph6", { s: num(pr.sl, 1), a: pr.tg[0], b: pr.tg[1] }) });
    if ((D.extra[p.id] || []).filter(x => diff(x.date, TODAY) <= 14).length >= 2) out.push({ cat: "ment", text: t("ph7") });
    if (returning(p.id)) out.push({ cat: "verf", text: t("ph8") });
    return out;
  }
  // ---------- Spiele & Bewertungen ----------
  function seasonStats(pid: string) {
    const st = D.matches.filter(m => m.date <= TODAY && D.stats[m.id]?.[pid]).map(m => D.stats[m.id][pid]);
    const rs = D.ratings.filter(r => r.pid === pid && r.rating != null);
    const played = st.filter(x => x.min > 0);
    return {
      games: played.length, starts: played.filter(x => x.start).length, min: sum(played.map(x => x.min)),
      goals: sum(st.map(x => x.goals)), assists: sum(st.map(x => x.assists)),
      avg: rs.length ? sum(rs.map(r => r.rating!)) / rs.length : null, best: rs.length ? Math.max(...rs.map(r => r.rating!)) : null,
    };
  }
  const ratingsOf = (pid: string): Rating[] => D.ratings.filter(r => r.pid === pid).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  /** Videos für einen Spieler (ohne Zuordnung = für alle) bzw. alle Videos. */
  const videosFor = (pid?: string): Video[] => D.videos.filter(v => !pid || !v.pids.length || v.pids.includes(pid)).sort((a, b) => (a.date || "") < (b.date || "") ? 1 : -1);

  /** Darf der Spieler diesen Bereich sehen? (Baukasten: Modul aktiv + Freigabe für Spieler) */
  const playerSees = (key: PlayerViewKey): boolean => {
    const def = PLAYER_VIEW.find(x => x.key === key); if (!def) return true;
    if (def.needs && !mods[def.needs]) return false;
    const v = S.playerView?.[key]; return v == null ? def.def : v;
  };
  const activeMsgs = (pid: string): CoachMsg[] => (D.msgs[pid] || []).filter(m => !m.bis || m.bis >= TODAY);
  function suggestRec(p: Player): RecSuggestion {
    const pr = profile(p.id), tg = pr.tg, sun = addDays(monday(TODAY), 6);
    if (pr.st === "inj") return { typ: "prog", text: t("rs_inj"), bis: addDays(TODAY, 7) };
    if (pr.w0 && pr.w0.beschw === COMPLAINT_CLEAR) return { typ: "pause", text: t("rs_sore"), bis: addDays(TODAY, 1) };
    if (pr.rec && pr.rec.notReady) return { typ: "pause", text: t("rs_pause"), bis: TODAY };
    if (pr.st === "crit") return { typ: "regen", text: t("rs_crit"), bis: sun };
    if (pr.rec && !pr.rec.none && pr.rec.remaining > 0) return { typ: "regen", text: tf("rs_regen", { a: tg[0] }), bis: addDays(TODAY, 1) };
    if (pr.st === "low") return { typ: "zusatz", text: t("rs_low"), bis: sun };
    if (pr.sl != null && pr.sl < tg[0]) return { typ: "info", text: tf("rs_sleep", { a: tg[0], b: tg[1] }), bis: addDays(TODAY, 7) };
    return { typ: "info", text: t("rs_ok"), bis: addDays(TODAY, 7) };
  }

  // ---------- Spieler-App ----------
  function playerState(p: Player): PlayerState {
    const pr = profile(p.id), w = D.well[p.id]?.[TODAY];
    if (pr.st === "inj" && pr.ab) return { k: "pause", why: t("ab_" + pr.ab.typ) };
    if (activeMsgs(p.id).some(m => m.typ === "pause")) return { k: "pause", why: t("ph_coachPause") };
    if (w && w.beschw === COMPLAINT_CLEAR) return { k: "pause", why: t("r_sore") };
    const rem = pr.rec && !pr.rec.none ? pr.rec.remaining : 0;
    if (pr.st === "crit") return { k: "easy", why: t("pd_load_crit") };
    const drop = mods.leistung ? cmjDrop(D, p.id, TODAY) : null;
    if (drop != null && drop >= 0.08) return { k: "easy", why: t("ph_cmj") };
    if (rem > 0) return { k: "easy", why: tf("ph_recIn", { h: Math.round(rem) }) };
    if (pr.sl != null && pr.sl < pr.tg[0]) return { k: "easy", why: t("r_sleep") + " " + num(pr.sl, 1) + " h" };
    return { k: "ready", why: "" };
  }
  /** Einheiten, für die der Spieler seine RPE eintragen kann (letzte 10 Tage + heute). */
  function playerSessions(p: Player): (Session & { today?: boolean })[] {
    const L: (Session & { today?: boolean })[] = D.sessions.filter(s => s.date <= TODAY && diff(s.date, TODAY) <= 10 && !absenceOn(p.id, s.date)).slice(-5);
    const hasToday = L.some(s => s.date === TODAY);
    if (!hasToday && isTraining(TODAY) && !absenceOn(p.id, TODAY)) L.push({ date: TODAY, typ: "Training", dauer: durOf(TODAY), zeit: zeitOf(TODAY), md: mdOf(TODAY).md, ziel: 0, today: true });
    if (!hasToday && matchOn(TODAY) && !absenceOn(p.id, TODAY)) L.push({ date: TODAY, typ: "Spiel", dauer: matchMin(), zeit: matchOn(TODAY)!.zeit, md: "MD", ziel: matchRpe(), today: true });
    return L.reverse();
  }
  const playerOpenSession = (p: Player) => playerSessions(p).find(s => !s.today && !D.rpe[p.id]?.[s.date] && !["ent", "unent"].includes(attStatus(s.date, p.id)) && diff(s.date, TODAY) <= 3);

  function tipRegen(p: Player, pr: Profile): Tip {
    let head = ""; const L: string[] = [], tg = pr.tg, md = mdOf(TODAY).md;
    if (pr.st === "inj") head = t("tr_inj");
    else if (!pr.rec) L.push(t("tr1"), t("tr2"), t("tr3"), tf("tr4", { a: tg[0], b: tg[1] }));
    else {
      const rem = !pr.rec.none ? pr.rec.remaining : 0;
      if (pr.w0 && pr.w0.beschw === COMPLAINT_CLEAR) head = t("tr_sore") + " ";
      if (rem > 0) {
        head += tf("tr_open", { h: Math.round(rem) }); L.push(t("tr1"), t("tr2"), t("tr3"), tf("tr4", { a: tg[0], b: tg[1] }));
        if (md === "MD+1" || (pr.rec.ev && pr.rec.ev.typ === "Spiel" && diff(pr.rec.ev.date, TODAY) <= 1)) L.push(t("tr5"));
        L.push(t("tr6"));
      } else { head += t("tr_done"); L.push(t("tr7"), tf("tr4", { a: tg[0], b: tg[1] })); }
    }
    return { head, items: L, source: t("rt_note") };
  }
  function tipGym(p: Player, pr: Profile): Tip & { program: string[]; note: string; best: string } {
    const md = mdOf(TODAY).md, ps = playerState(p);
    if (grp === "u11") return { head: t("tg_kids"), items: [], program: [], note: "", best: "" };
    const notRec = !!(pr.rec && !pr.rec.none && pr.rec.remaining > 0); let today: string;
    if (pr.st === "inj") today = t("tx_inj");
    else if (ps.k === "pause") today = tf("tg_no", { why: ps.why });
    else if (["MD", "MD-1", "MD-2"].includes(md)) today = tf("tg_no", { why: t("tg_md") });
    else if (pr.st === "crit") today = tf("tg_no", { why: t("tg_crit") });
    else if (md === "MD+1") today = t("tg_md1");
    else if (notRec) today = tf("tg_no", { why: t("tg_rec") });
    else if (md === "MD-3") today = t("tg_short");
    else if (!md) today = t("tg_free");
    else today = t("tg_good");
    const program = grp === "u15" ? [t("tg_u15")] : [t("tg_a"), t("tg_b")];
    return { head: today, items: [], program, note: grp === "u15" ? "" : t(grp === "u19" ? "tg_youth" : "tg_adult"), best: t("tg_best"), source: t("tg_src") };
  }
  function tipExtra(p: Player, pr: Profile): Tip & { budget: string; done: string } | null {
    if (!mods.belastung || grp === "u11") return null;
    const ps = playerState(p);
    if (ps.k === "pause" && pr.st !== "inj") return { head: tf("tx_pause", { why: ps.why }), items: [], budget: "", done: "", source: t("tx_src") };
    const k = ({ crit: "tx_crit", warn: "tx_warn", ok: "tx_ok", low: "tx_low", build: "tx_build", none: "tx_build", inj: "tx_inj" } as Record<Status, string>)[pr.st] || "tx_build";
    let budget = "", noRoom = false;
    if (pr.m && pr.m.days >= 21 && ["ok", "low"].includes(pr.st)) {
      const ws = monday(TODAY), dl = daily(p.id), done = sum(Object.keys(dl).filter(d => d >= ws && d <= TODAY).map(d => dl[d]));
      // persönlicher Faktor: Wie viel der geplanten Last kommt bei diesem Spieler erfahrungsgemäß an?
      const own = D.rpe[p.id] || {};
      const ts = D.sessions.filter(z => z.typ === "Training" && diff(z.date, TODAY) <= 28 && own[z.date] && z.ziel), ms = D.sessions.filter(z => z.typ === "Spiel" && diff(z.date, TODAY) <= 42);
      const fT = ts.length >= 4 ? clamp(sum(ts.map(z => own[z.date].rpe * own[z.date].min / (z.ziel * z.dauer))) / ts.length, 0.5, 1.3) : 1;
      const fM = ms.length >= 2 ? clamp(sum(ms.map(z => own[z.date] ? own[z.date].rpe * own[z.date].min : 0)) / ms.length / matchLoad(), 0, 1.2) : 1;
      const plan = sum(weekPlan(ws).items.filter(x => x.date > TODAY && !absenceOn(p.id, x.date)).map(x => x.match ? matchLoad() * fM : x.train ? x.train.rpe * x.train.dauer * fT : 0));
      const room = pr.m.chronic * 1.3 - (done + plan), min = Math.min(120, Math.max(0, Math.round(room / 6 / 5) * 5));
      if (min >= 15) budget = tf("tx_budget", { m: min }); else { budget = t("tx_noBudget"); noRoom = true; }
    }
    const exMin = sum((D.extra[p.id] || []).filter(x => x.date >= monday(TODAY) && x.date <= TODAY).map(x => x.min));
    return { head: t(noRoom ? "tx_warn" : k), items: [t("px_note")], budget, done: exMin ? tf("tx_done", { m: exMin }) : "", source: t("tx_src") };
  }
  function tipFood(p: Player): Tip {
    const kg = Number(p.kg) || null, md = mdOf(TODAY).md, x = weekPlan(monday(TODAY)).items.find(i => i.date === TODAY), hard = !!(x && x.train && x.train.rpe >= 7), L: string[] = [];
    const carb = kg ? tf("tf_kgCarb", { a: Math.round(kg * 6), b: Math.round(kg * 8) }) : "", pro = kg ? tf("tf_kgPro", { p: Math.round(kg * 0.3) }) : "";
    if (md === "MD-1") L.push(tf("tf_md1", { kg: carb }));
    else if (md === "MD") { L.push(t("tf_md")); L.push(tf("tf_post", { pro })); }
    else if (hard) { L.push(t("tf_hard")); L.push(tf("tf_post", { pro })); }
    else L.push(t("tf_rest"));
    L.push(tf("tf_drink", { ml: kg ? tf("tf_ml", { a: Math.round(kg * 5 / 50) * 50, b: Math.round(kg * 7 / 50) * 50 }) : t("tf_mlGen") }));
    L.push(t("tf_supp"));
    return { head: "", items: L, source: t("tf_src") };
  }
  function tipSleep(pr: Profile): Tip {
    const tg = pr.tg;
    return { head: tf("ts_t", { a: tg[0], b: tg[1] }) + (pr.sl != null ? " " + tf("ts_avg", { s: num(pr.sl, 1) }) : ""), items: [t("ts1"), t("ts2"), t("ts3")] };
  }

  // ---------- KI-Kontext (ohne Nachnamen, nur Vornamen der Spieler, die zugestimmt haben) ----------
  function aiContext(aiOk: (pid: string) => boolean): string {
    const wp = weekPlan(monday(TODAY)), c = classDef(team.cls);
    const plan = wp.items.map(x => `${wt(x.date)} ${de(x.date)}: ${x.match ? "Spiel " + t("vs") + " " + x.match.gegner : x.train ? (x.train.md || "-") + ", " + kn(x.train.kind) + ", RPE " + x.train.rpe + ", " + x.train.dauer + " Min., " + t("p_" + x.train.platz) : "frei"}`).join("\n");
    const flagged = D.players.map(p => profile(p.id)).filter(x => x.reasons.length).slice(0, 10)
      .map((x, i) => `${aiOk(x.p.id) ? x.p.vn : "Spieler " + (i + 1)} (${age(x.p)} J., ${x.p.pos}): ${x.reasons.map(r => r[1]).join(", ")}`).join("\n");
    return `Mannschaft: ${teamLabel(team)}, Altersklasse ${classLabel(c, opts.lang)}, ${D.players.length} Spieler.
Infotiefe des Trainers: ${t("dp_" + team.depth)}.
Trainingstage: ${Object.entries(S.days).map(([d, v]) => tl("wd")[+d] + " " + v.zeit + ", " + (v.dauer || S.dauer) + " Min. (" + t("p_" + v.platz) + ")").join("; ")}.
Trainingsprinzipien: ${["MD", ...MDS].filter(md => team.principles[md]).map(md => md + " " + kn(team.principles[md].kind) + " RPE " + team.principles[md].rpe).join("; ")}.
${D.kinds.length ? "Eigene Trainingsarten: " + D.kinds.map(k => k.name + " (RPE " + k.rpe + "): " + k.inhalt).join(" | ") + "\n" : ""}Spieldauer: ${matchMin()} Min.
Wochenplan aktuelle Woche:
${plan}
Auffällige Spieler:
${flagged || "keine"}`;
  }
  function aiSessionPrompt(date: string): string {
    const wp = weekPlan(monday(date)), x = wp.items.find(i => i.date === date)!, p = x.train!;
    const avail = D.players.filter(q => !absenceOn(q.id, date)), tw = avail.filter(q => q.pos === "TW").length;
    return `Arbeite diese Trainingseinheit konkret aus:
Datum: ${wt(date)} ${de(date)}, ${zeitOf(date)}, Spieltags-Bezug: ${p.md || "keiner (spielfreie Woche)"}
Schwerpunkt: ${kn(p.kind)} – ${p.inhalt}
Ziel-Intensität: RPE ${p.rpe} (CR-10), Dauer: ${p.dauer} Min., Platz: ${t("p_" + p.platz)}
Verfügbare Spieler: ${avail.length} (davon ${tw} Torhüter). Abwesend: ${absentOn(date).length}.
${p.notReady.length ? "Bis dahin nicht voll erholt: " + p.notReady.length + " Spieler." : ""}
Gliedere in Blöcke mit Minutenangabe (Summe = ${p.dauer} Min.): Aufwärmen, Hauptteil(e), Abschluss. Pro Block: Organisation (Feldgröße, Spielerzahl), Belastung (Dauer × Serien, Pausen), 2–3 Coachingpunkte. Ende mit einem kurzen Hinweis zur Dosierung für nicht erholte oder zurückkehrende Spieler.`;
  }
  function potPrompt(p: Player): string {
    const pr = profile(p.id), m = pr.m;
    const mins = D.sessions.filter(s => s.typ === "Spiel").slice(-5).map(s => (D.rpe[p.id]?.[s.date]?.min || 0) + " Min.").join(", ");
    const ex = (D.extra[p.id] || []).filter(x => diff(x.date, TODAY) <= 14).map(x => t("px_" + x.art) + " " + x.min + " Min. RPE " + x.rpe).join("; ");
    return `Analysiere die Daten dieses Spielers und nenne 3–5 konkrete Entwicklungspotenziale oder Ziele, die sich aus den Daten ableiten lassen (Belastbarkeit, Athletik, Regeneration, Mentales). Technik und Taktik nur, wenn die Notizen des Trainers etwas hergeben.
Spieler: ${age(p)} Jahre, Position ${p.pos}, Altersklasse ${classLabel(classDef(team.cls), opts.lang)}.
Beteiligung 28 Tage: ${pr.att != null ? Math.round(pr.att * 100) + " %" : "–"}. Status: ${t("st_" + pr.st)}. ACWR: ${m && m.acwr != null ? num(m.acwr, 2) : "–"}. Ø Woche: ${m ? Math.round(m.chronic) + " AU" : "–"}.
Schlaf Ø 7 Tage: ${pr.sl != null ? num(pr.sl, 1) + " h" : "–"} (Ziel ${pr.tg[0]}–${pr.tg[1]} h). Wachstum: ${pr.gr ? num(pr.gr.rate, 1) + " cm/Jahr" : "–"}.
Spielminuten letzte Spiele: ${mins || "–"}. Zusatzsport 14 Tage: ${ex || "keiner"}.
Notizen des Trainers: ${D.notes[p.id] || "keine"}.
Hinweise der App: ${dataHints(p).map(h => h.text).join(" | ") || "keine"}.`;
  }
  function playerAiContext(p: Player): string {
    const pr = profile(p.id), wp = weekPlan(monday(TODAY));
    return `Spieler: ${p.vn}, ${age(p)} Jahre, Position ${p.pos}, Altersklasse ${classLabel(classDef(team.cls), opts.lang)}${p.kg ? ", Gewicht " + p.kg + " kg" : ""}.
Heute: ${wt(TODAY)} ${de(TODAY)}, Spieltags-Bezug: ${mdOf(TODAY).md || "keiner"}.
Woche: ${wp.items.map(x => `${wt(x.date)} ${x.match ? "Spiel" : x.train ? kn(x.train.kind) + " (RPE " + x.train.rpe + ", " + x.train.dauer + " Min.)" : "frei"}`).join("; ")}.
Status: ${t("st_" + pr.st)}. Erholung: ${pr.rec && !pr.rec.none ? (pr.rec.remaining > 0 ? "voll erholt in ca. " + Math.round(pr.rec.remaining) + " Std." : "erholt") : "–"}. Schlaf Ø ${pr.sl != null ? num(pr.sl, 1) : "–"} h (Ziel ${pr.tg[0]}–${pr.tg[1]} h). Beschwerden heute: ${pr.w0 ? pr.w0.beschw : "–"}.
Empfehlung des Trainers: ${activeMsgs(p.id).map(m => t("ry_" + m.typ) + ": " + m.text).join(" | ") || "keine"}.`;
  }

  // ---------- Anzeige-Helfer ----------
  const wt = (s: string): string => tl("wd")[parse(s).getDay()];
  const de = (s: string): string => { const d = parse(s), dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0"); return opts.lang === "en" ? dd + "/" + mm : dd + "." + mm + "."; };

  return {
    TODAY, NOW, team, D, tr: tr8, t, tf, tl, num, int: tr8.int, lvl, grp, CAP, mods,
    isCustom, customOf, kn, allKinds, kindRpe, contentOf, intWord, whyOf,
    matchMin, matchRpe, matchLoad,
    matchOn, eventsOn, regularDay, dayCfg, zeitOf, durOf, isTraining, inBreak, absenceOn, absentOn, mdOf,
    P, age, name, daily, metrics, injuryOf, returning, status, attStatus, attendance, sleep7, growthInfo, teamChronic,
    lastIntenseBefore, recoveryNeed, notReadyFor, recovery, weekPlan,
    profile, advice, nextItem, sessAvg, dataHints, activeMsgs, suggestRec,
    playerState, playerSessions, playerOpenSession, tipRegen, tipGym, tipExtra, tipFood, tipSleep,
    aiContext, aiSessionPrompt, potPrompt, playerAiContext,
    wt, de, isGrowthAge: () => isGrowthAge(team.cls), playerSees, seasonStats, ratingsOf, videosFor,
    /** Name des Cheftrainers (für die Spieler-App), leer wenn unbekannt */
    coachName: (): string => headCoach(D)?.name || "",
  };
}

/** KI-Antwort für Potenziale in einzelne Vorschläge zerlegen ("- Kategorie: Text"). */
export function parsePotentials(text: string): Hint[] {
  const labels: Record<string, PotCat> = {
    athletik: "ath", athletic: "ath", technik: "tech", technical: "tech", technique: "tech", taktik: "takt", tactical: "takt", tactics: "takt",
    mental: "ment", belastbarkeit: "verf", verfügbarkeit: "verf", availability: "verf", durability: "verf",
  };
  return String(text || "").split(/\n/)
    .map(l => l.match(/^\s*[-*•]\s*\**([^:*]{3,24})\**\s*:\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map(m => ({ cat: labels[m[1].trim().toLowerCase()] || "ath", text: m[2].replace(/\*\*/g, "").trim() }))
    .slice(0, 6);
}

/** Farbe nach Intensität (für UI). */
export const rpeColorKey = (r: number | null | undefined): "line" | "crit" | "hot" | "warn" | "ok" =>
  r == null ? "line" : r >= 8 ? "crit" : r >= 7 ? "hot" : r >= 5 ? "warn" : r > 0 ? "ok" : "line";

export type { Session, Wellness, Complaint, Kind };
