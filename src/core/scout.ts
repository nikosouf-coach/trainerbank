// Kaderplanung & Scouting (Paket E): Saisonplanung mit Schattenkader je Position, Jahrgänge und Altersgrenze,
// Stand der eigenen Spieler (fest, Perspektive, unsicher, Abgang), Aufrücker aus dem Verein, Scouting-Datenbank mit
// Status-Pipeline, Berichten und Bewertungen; Datenschutz für externe Spieler (Art. 14 DSGVO, Löschfristen).
// Reine Logik ohne UI und ohne Datenbank (Zugriffsregeln: supabase/migrations/…26_scouting.sql).
import { POS, classDef } from "./classes";
import { addDays, ageOn, diff, iso, parse } from "./dates";
import { DEV_AREAS } from "./dev";
import { ALT_POS, slotGroup, slotsOf, validFormation, type Slot } from "./matchplan";
import type {
  ClassKey, DevArea, Foot, MpFmt, PlanStatus, Player, ReportKind, Riser, ScoutPlayer, ScoutPrio, ScoutReport, ScoutStatus, SpContent, SpSlot, TeamData, Verdict,
} from "./types";

// ---------- Konstanten ----------
/** Positionen in der Scouting-Datenbank (wie die Grundordnungen, inkl. Flügelstürmer) */
export const SCOUT_POS = ["TW", "LV", "IV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
/** Pipeline in der Reihenfolge; abgeschlossen: Absage (Spieler) bzw. kein Interesse (wir) */
export const PIPELINE: ScoutStatus[] = ["watch", "scout", "trial", "talks", "signed"];
export const CLOSED: ScoutStatus[] = ["declined", "dropped"];
export const isClosed = (s: ScoutStatus): boolean => CLOSED.includes(s);
export const PRIOS: ScoutPrio[] = ["a", "b", "c"];
export const FEET: Foot[] = ["r", "l", "b"];
export const REPORT_KINDS: ReportKind[] = ["match", "tournament", "training", "video", "trial", "other"];
export const VERDICTS: Verdict[] = ["sign", "watch", "no"];
export const PLAN_STATUS: PlanStatus[] = ["fix", "persp", "unsure", "leave"];
/** Bewertungsbereiche (wie im Kompetenzprofil der Spielerentwicklung) */
export const SCOUT_AREAS: DevArea[] = [...DEV_AREAS];
export const SCOUT_LIMITS = { name: 60, club: 80, tags: 10, tag: 30, note: 2000, contact: 200, source: 80, nextNote: 120, text: 1000, summary: 2000, event: 120, lists: 20, listName: 40 };
export const SP_LIMITS = { own: 8, shadow: 10, need: 120, notes: 2000, note: 200 };
/** Löschfristen (wie public.purge_stale_health_data): abgeschlossen 6 Monate, sonst 24 Monate ohne Aktivität; Info nach Art. 14 spätestens nach einem Monat */
export const RETENTION = { closedMonths: 6, months: 24, infoDays: 30 };
export const DEFAULT_TARGET = 2;

// ---------- Saison und Jahrgänge ----------
/** Beginn der laufenden Saison (1. Juli) */
export const seasonOfDate = (now: Date): number => now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
export const seasonLabel = (y: number): string => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
/** Wählbare Spielzeiten: laufende und die zwei folgenden */
export const planSeasons = (now: Date): number[] => { const y = seasonOfDate(now); return [y, y + 1, y + 2]; };
/** Standard: die nächste Saison (Kaderplanung schaut nach vorn) */
export const defaultSeason = (now: Date): number => seasonOfDate(now) + 1;
/** Stichtag für das Alter in einer Saison */
export const seasonStartIso = (season: number): string => `${season}-07-01`;

/** Spielberechtigte Jahrgänge der Altersklasse in der Saison (Senioren/Ü32: null = keine Altersgrenze nach oben) */
export function eligibleYears(cls: ClassKey, season: number): { min: number; max: number } | null {
  const c = classDef(cls);
  if (c.grp === "akt") return null;
  return { min: season - c.ages[1], max: season - c.ages[0] };
}
export const yearOf = (p: { geb?: string | null; year?: number | null }): number | null =>
  p.year ?? (p.geb && /^\d{4}/.test(p.geb) ? Number(p.geb.slice(0, 4)) : null);
/** Zu alt für die Altersklasse (wechselt in der Saison in die nächste Altersklasse) */
export function agesOut(p: { geb?: string | null; year?: number | null }, cls: ClassKey, season: number): boolean {
  const e = eligibleYears(cls, season), y = yearOf(p);
  return !!e && y != null && y < e.min;
}
/** Jünger als die Altersklasse (spielt hoch) */
export function playsUp(p: { geb?: string | null; year?: number | null }, cls: ClassKey, season: number): boolean {
  const e = eligibleYears(cls, season), y = yearOf(p);
  return !!e && y != null && y > e.max;
}
/** Jahrgänge, aus denen Aufrücker kommen: Jugend = spielberechtigte Jahrgänge, Senioren = die aus der A-Jugend herauswachsen */
export function riserYears(cls: ClassKey, season: number): number[] {
  const e = eligibleYears(cls, season);
  if (e) { const out: number[] = []; for (let y = e.min; y <= e.max; y++) out.push(y); return out; }
  return cls === "sen" ? [season - classDef("u19").ages[1] - 1] : [];
}
const midAge = (k: ClassKey): number => { const a = classDef(k).ages; return (a[0] + a[1]) / 2; };
/** Nur Teams jüngerer Altersklassen liefern Aufrücker (Ü32 ist nie jünger als die Senioren) */
export const isYounger = (other: ClassKey, mine: ClassKey): boolean => midAge(other) < midAge(mine);

// ---------- Positionen der Planung ----------
export interface PlanSlot extends Slot { key: string; side: "l" | "c" | "r" | "" }
/** Positionen einer Grundordnung mit eindeutigem Schlüssel (z. B. IV-l, IV-r, DM-l) – unabhängig vom Index */
export function planSlots(fmt: MpFmt, formation: string): PlanSlot[] {
  const S = slotsOf(fmt, formation), seen = new Set<string>();
  return S.map(x => {
    const many = S.filter(y => y.pos === x.pos).length > 1;
    const side: PlanSlot["side"] = many ? (x.x < 31 ? "l" : x.x > 37 ? "r" : "c") : "";
    let key = side ? `${x.pos}-${side}` : x.pos;
    for (let i = 2; seen.has(key); i++) key = `${x.pos}-${i}`;
    seen.add(key);
    return { ...x, side, key };
  });
}

// ---------- Verweise ----------
export type RefKind = "p" | "r" | "s";
export const refOf = (k: RefKind, id: string): string => `${k}:${id}`;
export function parseRef(r: string): { k: RefKind; id: string } | null {
  const m = /^([prs]):([\w:-]{1,80})$/.exec(r || "");
  return m ? { k: m[1] as RefKind, id: m[2] } : null;
}

// ---------- Inhalt der Planung ----------
const emptySlot = (): SpSlot => ({ own: [], shadow: [], target: DEFAULT_TARGET, need: "" });
export function emptyPlanContent(fmt: MpFmt, formation: string): SpContent {
  const f = validFormation(fmt, formation);
  return { formation: f, slots: Object.fromEntries(planSlots(fmt, f).map(s => [s.key, emptySlot()])), status: {}, notes: "", ext: {} };
}
/** Alle Verweise der Planung (Kader und Schatten) */
export const refsIn = (c: SpContent): string[] => [...new Set(Object.values(c.slots).flatMap(s => [...s.own, ...s.shadow]))];
/** Positionen, auf denen ein Verweis steht */
export const slotsWith = (c: SpContent, ref: string): { key: string; kind: "own" | "shadow"; rank: number }[] =>
  Object.entries(c.slots).flatMap(([key, s]) => [
    ...(s.own.includes(ref) ? [{ key, kind: "own" as const, rank: s.own.indexOf(ref) + 1 }] : []),
    ...(s.shadow.includes(ref) ? [{ key, kind: "shadow" as const, rank: s.shadow.indexOf(ref) + 1 }] : []),
  ]);
export function removeRef(c: SpContent, ref: string): SpContent {
  const slots: Record<string, SpSlot> = {};
  for (const [k, s] of Object.entries(c.slots)) slots[k] = { ...s, own: s.own.filter(x => x !== ref), shadow: s.shadow.filter(x => x !== ref) };
  const ext = { ...(c.ext || {}) }; delete ext[ref];
  return { ...c, slots, ext };
}
/** Verweis auf eine Position setzen (Kader oder Schatten; am Ende oder an Position `at`) – aus der jeweils anderen Liste der Position entfernt */
export function addRef(c: SpContent, key: string, kind: "own" | "shadow", ref: string, at?: number): SpContent {
  const s = c.slots[key]; if (!s || !parseRef(ref)) return c;
  const max = kind === "own" ? SP_LIMITS.own : SP_LIMITS.shadow;
  const other = kind === "own" ? "shadow" : "own";
  const L = s[kind].filter(x => x !== ref);
  if (L.length >= max) return c;
  L.splice(at == null ? L.length : Math.max(0, Math.min(at, L.length)), 0, ref);
  return { ...c, slots: { ...c.slots, [key]: { ...s, [kind]: L, [other]: s[other].filter(x => x !== ref) } } };
}
/** Reihenfolge ändern (Stamm/Ersatz bzw. Rang der Schattenkandidaten) */
export function moveRef(c: SpContent, key: string, kind: "own" | "shadow", ref: string, delta: number): SpContent {
  const s = c.slots[key]; if (!s) return c;
  const L = [...s[kind]], i = L.indexOf(ref), j = i + delta;
  if (i < 0 || j < 0 || j >= L.length) return c;
  [L[i], L[j]] = [L[j], L[i]];
  return { ...c, slots: { ...c.slots, [key]: { ...s, [kind]: L } } };
}
export function setSlot(c: SpContent, key: string, patch: Partial<Pick<SpSlot, "target" | "need">>): SpContent {
  const s = c.slots[key]; if (!s) return c;
  const target = patch.target != null ? Math.max(1, Math.min(5, Math.round(patch.target))) : s.target;
  return { ...c, slots: { ...c.slots, [key]: { ...s, target, need: patch.need != null ? patch.need.slice(0, SP_LIMITS.need) : s.need } } };
}
export function setPlayerStatus(c: SpContent, pid: string, s: PlanStatus | null, note?: string): SpContent {
  const status = { ...c.status };
  if (!s) delete status[pid];
  else status[pid] = { s, note: (note ?? status[pid]?.note ?? "").slice(0, SP_LIMITS.note) };
  return { ...c, status };
}

/** Verteilung eigener Spieler auf die Positionen: genaue Position, Ausweichposition, Positionsgruppe – möglichst gleichmäßig */
export function autoAssign(c: SpContent, fmt: MpFmt, people: { ref: string; pos: string; gk: boolean }[]): SpContent {
  const slots = planSlots(fmt, c.formation), used = new Set(refsIn(c));
  let out = c;
  for (const p of people) {
    if (used.has(p.ref)) continue;
    const cands = slots.filter(s => p.gk ? s.pos === "TW" : s.pos !== "TW");
    if (!cands.length) continue;
    const score = (s: PlanSlot): number => {
      if (p.gk) return 0;
      if (s.pos === p.pos) return 0;
      const alt = (ALT_POS[s.pos] || []).indexOf(p.pos);
      if (alt >= 0) return 1 + alt;
      const back = (ALT_POS[p.pos] || []).indexOf(s.pos);
      if (back >= 0) return 4 + back;
      return slotGroup(s.pos) === slotGroup(p.pos) ? 10 : 50;
    };
    const best = cands.map(s => ({ s, v: score(s) * 100 + out.slots[s.key].own.length })).sort((a, b) => a.v - b.v)[0].s;
    out = addRef(out, best.key, "own", p.ref); used.add(p.ref);
  }
  return out;
}

/** Andere Grundordnung: Positionen übertragen (gleicher Schlüssel, gleiche Position, sonst die nächstgelegene) – niemand geht verloren */
export function remapPlan(c: SpContent, fmt: MpFmt, formation: string): SpContent {
  const f = validFormation(fmt, formation);
  if (f === c.formation) return c;
  const oldS = planSlots(fmt, c.formation), newS = planSlots(fmt, f);
  const out = emptyPlanContent(fmt, f);
  // Seite zählt mehr als Höhe (Außenverteidiger → Flügel derselben Seite, nicht in die Innenverteidigung)
  const dist = (a: Slot, b: Slot): number => Math.abs(a.x - b.x) * 2 + Math.abs(a.y - b.y) * 0.5;
  for (const o of oldS) {
    const src = c.slots[o.key]; if (!src) continue;
    const tgt = newS.find(n => n.key === o.key)
      || newS.filter(n => n.pos === o.pos).sort((a, b) => dist(a, o) - dist(b, o))[0]
      || newS.filter(n => (o.pos === "TW") === (n.pos === "TW")).sort((a, b) => dist(a, o) - dist(b, o))[0];
    if (!tgt) continue;
    const t = out.slots[tgt.key];
    t.own = [...new Set([...t.own, ...src.own])].slice(0, SP_LIMITS.own);
    t.shadow = [...new Set([...t.shadow, ...src.shadow])].filter(x => !t.own.includes(x)).slice(0, SP_LIMITS.shadow);
    t.target = Math.max(t.target === DEFAULT_TARGET && !t.need ? 1 : t.target, src.target);
    t.need = [t.need, src.need].filter(Boolean).join(" · ").slice(0, SP_LIMITS.need);
  }
  return { ...out, status: c.status, notes: c.notes, ext: c.ext || {} };
}

/** Bereinigung (Inhalt kommt als JSON aus der Datenbank bzw. aus der App) */
export function cleanPlanContent(raw: unknown, fmt: MpFmt): SpContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SpContent> & Record<string, unknown>;
  const formation = validFormation(fmt, typeof r.formation === "string" ? r.formation : null);
  const base = emptyPlanContent(fmt, formation);
  const refs = (a: unknown, max: number): string[] => [...new Set((Array.isArray(a) ? a : []).filter((x): x is string => typeof x === "string" && !!parseRef(x)))].slice(0, max);
  const src = (r.slots && typeof r.slots === "object" ? r.slots : {}) as Record<string, Partial<SpSlot>>;
  for (const key of Object.keys(base.slots)) {
    const s = src[key]; if (!s || typeof s !== "object") continue;
    const own = refs(s.own, SP_LIMITS.own), shadow = refs(s.shadow, SP_LIMITS.shadow).filter(x => !own.includes(x));
    const target = Number.isFinite(Number(s.target)) ? Math.max(1, Math.min(5, Math.round(Number(s.target)))) : DEFAULT_TARGET;
    base.slots[key] = { own, shadow, target, need: typeof s.need === "string" ? s.need.slice(0, SP_LIMITS.need) : "" };
  }
  const st = (r.status && typeof r.status === "object" ? r.status : {}) as Record<string, { s?: unknown; note?: unknown }>;
  for (const [pid, v] of Object.entries(st)) {
    if (!/^[\w:-]{1,80}$/.test(pid) || !v || !PLAN_STATUS.includes(v.s as PlanStatus)) continue;
    base.status[pid] = { s: v.s as PlanStatus, note: typeof v.note === "string" ? v.note.slice(0, SP_LIMITS.note) : "" };
  }
  base.notes = typeof r.notes === "string" ? r.notes.slice(0, SP_LIMITS.notes) : "";
  const ext = (r.ext && typeof r.ext === "object" ? r.ext : {}) as Record<string, Partial<RiserSnap>>;
  const inPlan = new Set(refsIn(base));
  for (const [k, v] of Object.entries(ext)) {
    if (!inPlan.has(k) || parseRef(k)?.k !== "r" || !v) continue;
    base.ext![k] = { n: String(v.n || "").slice(0, 80), pos: String(v.pos || "").slice(0, 4), y: Number.isFinite(Number(v.y)) ? Number(v.y) : null, t: String(v.t || "").slice(0, 80) };
  }
  return base;
}
/** Angaben zu Aufrückern in der Planung (falls die Liste aus dem Verein gerade nicht geladen ist) */
export type RiserSnap = NonNullable<SpContent["ext"]>[string];
export const riserSnap = (r: Riser): RiserSnap => ({ n: `${r.vn} ${r.nn}`.trim(), pos: r.pos, y: r.year, t: r.team });

// ---------- Auflösen und Tiefe ----------
export type RefState = "fix" | "persp" | "open" | "unsure" | "leave" | "ageout" | "riser" | "signed" | "pending" | "gone";
export interface RefInfo {
  ref: string; k: RefKind; id: string; name: string; pos: string; year: number | null; state: RefState;
  /** Kandidat: Status, Priorität, Ø Gesamteindruck; Aufrücker: Team */
  status?: ScoutStatus; prio?: ScoutPrio | null; grade?: number | null; team?: string; nr?: number | null; note?: string;
}
/** Zählt fest für die Saison (Kader) */
export const FIRM: RefState[] = ["fix", "persp", "open", "riser", "signed"];
export const MAYBE: RefState[] = ["unsure", "pending"];
export const isOut = (s: RefState): boolean => s === "leave" || s === "ageout" || s === "gone";

/** Stand eines eigenen Spielers in der Saison */
export function playerState(p: Player, c: SpContent, cls: ClassKey, season: number): RefState {
  if (p.active === false) return "gone";
  if (agesOut(p, cls, season)) return "ageout";
  return c.status[p.id]?.s ?? "open";
}

export function makeResolver(D: Pick<TeamData, "players" | "inactive" | "scouts" | "scoutReports" | "team">, c: SpContent, season: number, risers: Riser[]): (ref: string) => RefInfo | null {
  const pl = new Map([...D.players, ...D.inactive].map(p => [p.id, p])), sc = new Map(D.scouts.map(x => [x.id, x])), rs = new Map(risers.map(x => [x.id, x]));
  const grades = new Map<string, number | null>();
  for (const s of D.scouts) grades.set(s.id, reportStats(D.scoutReports.filter(r => r.sid === s.id)).grade);
  return (ref: string): RefInfo | null => {
    const x = parseRef(ref); if (!x) return null;
    if (x.k === "p") {
      const p = pl.get(x.id); if (!p) return null;
      return { ref, ...x, name: `${p.vn} ${p.nn}`.trim(), pos: p.pos, year: yearOf(p), state: playerState(p, c, D.team.cls, season), nr: p.nr, note: c.status[p.id]?.note || "" };
    }
    if (x.k === "s") {
      const s = sc.get(x.id); if (!s) return null;
      return { ref, ...x, name: scoutName(s), pos: s.pos[0] || "", year: yearOf(s), state: s.status === "signed" ? "signed" : isClosed(s.status) ? "gone" : "pending",
        status: s.status, prio: s.prio, grade: grades.get(s.id) ?? null, team: s.club };
    }
    const r = rs.get(x.id), snap = c.ext?.[ref];
    if (!r && !snap) return null;
    return r ? { ref, ...x, name: `${r.vn} ${r.nn}`.trim(), pos: r.pos, year: r.year, state: "riser", team: r.team }
      : { ref, ...x, name: snap!.n, pos: snap!.pos, year: snap!.y, state: "riser", team: snap!.t };
  };
}

export type DepthLevel = "ok" | "risk" | "need";
/** Besetzung einer Position: fest Eingeplante gegen Soll; unsichere/offene Zugänge zählen als Risiko */
export function slotDepth(s: SpSlot, info: (ref: string) => RefInfo | null): { firm: number; maybe: number; out: number; level: DepthLevel } {
  let firm = 0, maybe = 0, out = 0;
  for (const r of s.own) {
    const i = info(r); if (!i) continue;
    if (FIRM.includes(i.state)) firm++; else if (MAYBE.includes(i.state)) maybe++; else out++;
  }
  return { firm, maybe, out, level: firm >= s.target ? "ok" : firm + maybe >= s.target ? "risk" : "need" };
}

/** Überblick: geplante Spieler (eindeutig), Abgänge, Zugänge, Positionen mit Bedarf, nicht zugeordnete eigene Spieler */
export function planOverview(D: Pick<TeamData, "players" | "inactive" | "scouts" | "scoutReports" | "team">, c: SpContent, season: number, risers: Riser[]) {
  const info = makeResolver(D, c, season, risers), refs = refsIn(c), inPlanOwn = new Set(Object.values(c.slots).flatMap(s => s.own));
  const states = D.players.map(p => ({ p, state: playerState(p, c, D.team.cls, season) }));
  const leaving = states.filter(x => x.state === "leave" || x.state === "ageout");
  const planned = new Set<string>();
  for (const r of [...inPlanOwn]) { const i = info(r); if (i && FIRM.includes(i.state)) planned.add(r); }
  // eigene Spieler, die bleiben, zählen auch ohne Position
  for (const x of states) if (FIRM.includes(x.state)) planned.add(refOf("p", x.p.id));
  const arrivals = refs.map(info).filter((i): i is RefInfo => !!i && (i.state === "signed" || i.state === "riser") && inPlanOwn.has(i.ref));
  const slots = Object.entries(c.slots).map(([key, s]) => ({ key, ...slotDepth(s, info), target: s.target }));
  const unassigned = states.filter(x => !isOut(x.state) && !inPlanOwn.has(refOf("p", x.p.id))).map(x => x.p);
  return { info, planned: planned.size, leaving, arrivals, needs: slots.filter(x => x.level !== "ok"), slots, unassigned };
}

/** Jahrgänge (Jugend) bzw. Altersgruppen (Senioren) der für die Saison fest Eingeplanten */
export function yearBuckets(c: SpContent, cls: ClassKey, season: number, info: (ref: string) => RefInfo | null, players: Player[]):
  { key: string; label: string; n: number; kind: "year" | "older" | "younger" | "band" }[] {
  const firm = new Map<string, RefInfo>();
  for (const p of players) { const i = info(refOf("p", p.id)); if (i && FIRM.includes(i.state)) firm.set(i.ref, i); }
  for (const r of Object.values(c.slots).flatMap(s => s.own)) { const i = info(r); if (i && FIRM.includes(i.state)) firm.set(r, i); }
  const L = [...firm.values()], e = eligibleYears(cls, season);
  if (e) {
    const out: { key: string; label: string; n: number; kind: "year" | "older" | "younger" | "band" }[] = [];
    for (let y = e.min; y <= e.max; y++) out.push({ key: String(y), label: String(y), n: L.filter(i => i.year === y).length, kind: "year" });
    const younger = L.filter(i => i.year != null && i.year > e.max).length;
    if (younger) out.push({ key: "younger", label: "", n: younger, kind: "younger" });
    return out;
  }
  const bands: [string, number, number][] = [["u21", 0, 21], ["22", 22, 25], ["26", 26, 29], ["30", 30, 33], ["34", 34, 99]];
  const ref = parse(seasonStartIso(season));
  return bands.map(([key, lo, hi]) => ({ key, label: hi >= 99 ? `${lo}+` : lo === 0 ? `≤ ${hi}` : `${lo}–${hi}`, kind: "band" as const,
    n: L.filter(i => i.year != null && (ref.getFullYear() - i.year!) >= lo && (ref.getFullYear() - i.year!) <= hi).length }));
}

// ---------- Scouting-Datenbank ----------
export const scoutName = (s: Pick<ScoutPlayer, "vn" | "nn">): string => `${s.vn} ${s.nn}`.trim();
/** Alter heute (aus Geburtsdatum; nur Jahrgang: ungefähr) */
export function scoutAge(s: Pick<ScoutPlayer, "geb" | "year">, now: Date): { age: number; approx: boolean } | null {
  if (s.geb) return { age: ageOn(s.geb, now), approx: false };
  if (s.year) return { age: now.getFullYear() - s.year, approx: true };
  return null;
}
export interface ReportStats { n: number; grade: number | null; areas: Record<DevArea, number | null>; last: string | null; trend: number | null; verdicts: Record<Verdict, number> }
const avg = (a: number[]): number | null => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
export function reportStats(reports: ScoutReport[]): ReportStats {
  const L = [...reports].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt < b.createdAt ? -1 : 1);
  const graded = L.filter(r => r.grade != null);
  const areas = Object.fromEntries(SCOUT_AREAS.map(a => [a, avg(L.map(r => r.scores[a]).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5))])) as Record<DevArea, number | null>;
  const verdicts: Record<Verdict, number> = { sign: 0, watch: 0, no: 0 };
  for (const r of L) if (r.verdict) verdicts[r.verdict]++;
  return {
    n: L.length, grade: avg(graded.map(r => r.grade!)), areas, last: L.length ? L[L.length - 1].date : null, verdicts,
    trend: graded.length >= 2 ? graded[graded.length - 1].grade! - graded[graded.length - 2].grade! : null,
  };
}
/** Statistik je Kandidat */
export function statsBy(reports: ScoutReport[]): Map<string, ReportStats> {
  const by = new Map<string, ScoutReport[]>();
  for (const r of reports) { const L = by.get(r.sid); if (L) L.push(r); else by.set(r.sid, [r]); }
  return new Map([...by].map(([k, L]) => [k, reportStats(L)]));
}

/** Passt ein Kandidat zur Position? 0 = Hauptposition, 1 = weitere Position, 2 = Ausweichposition, 3 = gleiche Gruppe, 9 = nein */
export function posMatch(pos: string[], slotPos: string): number {
  if (!pos.length) return 9;
  if (pos[0] === slotPos) return 0;
  if (pos.includes(slotPos)) return 1;
  if (pos.some(p => (ALT_POS[slotPos] || []).includes(p))) return 2;
  if (pos.some(p => (p === "TW") === (slotPos === "TW") && slotGroup(p) === slotGroup(slotPos))) return 3;
  return 9;
}
const prioRank = (p: ScoutPrio | null): number => p === "a" ? 0 : p === "b" ? 1 : p === "c" ? 2 : 3;
/** Kandidaten für eine Position: passend zuerst, dann Priorität und Bewertung; abgeschlossene nicht */
export function candidatesFor(slotPos: string, scouts: ScoutPlayer[], stats: Map<string, ReportStats>, all = false): ScoutPlayer[] {
  return scouts.filter(s => !isClosed(s.status) && (all || posMatch(s.pos, slotPos) <= 3))
    .sort((a, b) => Math.min(posMatch(a.pos, slotPos), 3) - Math.min(posMatch(b.pos, slotPos), 3) || prioRank(a.prio) - prioRank(b.prio)
      || (stats.get(b.id)?.grade ?? 0) - (stats.get(a.id)?.grade ?? 0) || scoutName(a).localeCompare(scoutName(b)));
}

export type PosArea = "TW" | "Abwehr" | "Mittelfeld" | "Sturm";
export const POS_AREAS: PosArea[] = ["TW", "Abwehr", "Mittelfeld", "Sturm"];
export const areaOfPos = (p: string): PosArea => p === "TW" ? "TW" : slotGroup(p) as PosArea;
export interface ScoutFilter {
  q: string; status: ScoutStatus | "open" | "closed" | "all"; area: PosArea | null; prio: ScoutPrio | null; year: number | null;
  list: string | null; foot: Foot | null; infoDue: boolean; minGrade: number | null;
}
export const emptyFilter = (): ScoutFilter => ({ q: "", status: "open", area: null, prio: null, year: null, list: null, foot: null, infoDue: false, minGrade: null });
/** Anzahl gesetzter Zusatzfilter (für den Filter-Knopf) */
export const filterCount = (f: ScoutFilter): number => [f.prio, f.year, f.list, f.foot, f.minGrade].filter(x => x != null).length + (f.infoDue ? 1 : 0);
const norm = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function filterScouts(list: ScoutPlayer[], f: ScoutFilter, stats: Map<string, ReportStats>, now: Date): ScoutPlayer[] {
  const q = norm(f.q.trim());
  return list.filter(s => {
    if (f.status === "open" && isClosed(s.status)) return false;
    if (f.status === "closed" && !isClosed(s.status)) return false;
    if (f.status !== "open" && f.status !== "closed" && f.status !== "all" && s.status !== f.status) return false;
    if (f.area && !s.pos.some(p => areaOfPos(p) === f.area)) return false;
    if (f.prio && s.prio !== f.prio) return false;
    if (f.year && yearOf(s) !== f.year) return false;
    if (f.list && !s.lists.includes(f.list)) return false;
    if (f.foot && s.foot !== f.foot) return false;
    if (f.infoDue && infoState(s, now).state !== "due") return false;
    if (f.minGrade != null && (stats.get(s.id)?.grade ?? 0) < f.minGrade) return false;
    if (q && !norm([s.vn, s.nn, s.club, s.clubTeam, s.source, ...s.tags].join(" ")).includes(q)) return false;
    return true;
  });
}
export type ScoutSort = "prio" | "grade" | "recent" | "name" | "age";
export const SCOUT_SORTS: ScoutSort[] = ["prio", "grade", "recent", "name", "age"];
export function sortScouts(list: ScoutPlayer[], key: ScoutSort, stats: Map<string, ReportStats>): ScoutPlayer[] {
  const g = (s: ScoutPlayer) => stats.get(s.id)?.grade ?? -1;
  const by: Record<ScoutSort, (a: ScoutPlayer, b: ScoutPlayer) => number> = {
    prio: (a, b) => prioRank(a.prio) - prioRank(b.prio) || PIPELINE.indexOf(b.status) - PIPELINE.indexOf(a.status) || g(b) - g(a),
    grade: (a, b) => g(b) - g(a) || ((b.potential ?? 0) - (a.potential ?? 0)) || prioRank(a.prio) - prioRank(b.prio),
    recent: (a, b) => a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
    name: (a, b) => scoutName(a).localeCompare(scoutName(b)),
    // jünger zuerst (höherer Jahrgang)
    age: (a, b) => (yearOf(b) ?? 0) - (yearOf(a) ?? 0),
  };
  return [...list].sort((a, b) => by[key](a, b) || scoutName(a).localeCompare(scoutName(b)));
}
/** Anzahl je Status der Pipeline (offen = alle nicht abgeschlossenen) */
export function pipelineCounts(list: ScoutPlayer[]): Record<ScoutStatus | "open" | "closed" | "all", number> {
  const out = { all: list.length, open: 0, closed: 0, watch: 0, scout: 0, trial: 0, talks: 0, signed: 0, declined: 0, dropped: 0 } as Record<ScoutStatus | "open" | "closed" | "all", number>;
  for (const s of list) { out[s.status]++; if (isClosed(s.status)) out.closed++; else out.open++; }
  return out;
}

// ---------- Datenschutz (externe, oft minderjährige Spieler) ----------
/**
 * Information nach Art. 14 DSGVO: spätestens einen Monat nach der Erfassung bzw. beim ersten Kontakt (Sichtung,
 * Probetraining, Gespräch). ok = informiert, due = jetzt fällig, soon = noch `days` Tage.
 */
/** Status mit Kontakt zum Spieler (bzw. den Eltern): spätestens jetzt informieren (Art. 14 Abs. 3 lit. b DSGVO) */
export const CONTACT: ScoutStatus[] = ["trial", "talks", "signed"];
export function infoState(s: Pick<ScoutPlayer, "informed" | "status" | "createdAt">, now: Date): { state: "ok" | "due" | "soon"; days: number } {
  if (s.informed) return { state: "ok", days: 0 };
  const since = diff(s.createdAt ? iso(new Date(s.createdAt)) : iso(now), iso(now));
  if (CONTACT.includes(s.status) || since >= RETENTION.infoDays) return { state: "due", days: 0 };
  return { state: "soon", days: RETENTION.infoDays - since };
}
/** Automatische Löschung ohne weitere Aktivität (ISO-Datum) */
export function deleteAt(s: Pick<ScoutPlayer, "status" | "updatedAt">): string {
  const d = parse(s.updatedAt ? iso(new Date(s.updatedAt)) : iso(new Date()));
  d.setMonth(d.getMonth() + (isClosed(s.status) ? RETENTION.closedMonths : RETENTION.months));
  return iso(d);
}

// ---------- Anlegen und Bereinigen ----------
export function newScout(id: string, now: Date): ScoutPlayer {
  const t = now.toISOString();
  return { id, vn: "", nn: "", year: null, geb: null, pos: [], foot: null, cm: null, club: "", clubTeam: "", status: "watch", prio: null, level: null, potential: null,
    tags: [], lists: [], source: "", contact: "", video: null, note: "", next: null, nextNote: "", informed: null, playerId: null, createdAt: t, updatedAt: t };
}
const txt = (v: unknown, max: number): string => (typeof v === "string" ? v : "").slice(0, max);
const lvl = (v: unknown): number | null => { const n = Number(v); return v != null && v !== "" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
const isoOrNull = (v: unknown): string | null => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
export function cleanScout(x: ScoutPlayer): ScoutPlayer {
  const geb = isoOrNull(x.geb);
  const year = geb ? Number(geb.slice(0, 4)) : Number.isInteger(Number(x.year)) && Number(x.year) >= 1950 && Number(x.year) <= 2035 ? Number(x.year) : null;
  const video = typeof x.video === "string" && /^https?:\/\/\S+$/i.test(x.video.trim()) ? x.video.trim().slice(0, 500) : null;
  return {
    ...x, vn: txt(x.vn, SCOUT_LIMITS.name).trim(), nn: txt(x.nn, SCOUT_LIMITS.name).trim(), geb, year,
    pos: [...new Set((x.pos || []).filter(p => SCOUT_POS.includes(p)))].slice(0, 3),
    foot: FEET.includes(x.foot as Foot) ? x.foot : null,
    cm: Number.isInteger(Number(x.cm)) && Number(x.cm) >= 100 && Number(x.cm) <= 230 ? Number(x.cm) : null,
    club: txt(x.club, SCOUT_LIMITS.club).trim(), clubTeam: txt(x.clubTeam, SCOUT_LIMITS.club).trim(),
    status: [...PIPELINE, ...CLOSED].includes(x.status) ? x.status : "watch", prio: PRIOS.includes(x.prio as ScoutPrio) ? x.prio : null,
    level: lvl(x.level), potential: lvl(x.potential),
    tags: [...new Set((x.tags || []).map(t => txt(t, SCOUT_LIMITS.tag).trim()).filter(Boolean))].slice(0, SCOUT_LIMITS.tags),
    lists: [...new Set(x.lists || [])].slice(0, SCOUT_LIMITS.lists),
    source: txt(x.source, SCOUT_LIMITS.source).trim(), contact: txt(x.contact, SCOUT_LIMITS.contact).trim(), video, note: txt(x.note, SCOUT_LIMITS.note),
    next: isoOrNull(x.next), nextNote: txt(x.nextNote, SCOUT_LIMITS.nextNote).trim(), informed: isoOrNull(x.informed),
  };
}
export function newReport(id: string, sid: string, date: string, pos: string | null): ScoutReport {
  return { id, sid, date, event: "", kind: "match", min: null, pos, scores: {}, grade: null, verdict: null, strengths: "", weaknesses: "", summary: "", author: null, authorName: "", createdAt: new Date().toISOString() };
}
export function cleanReport(r: ScoutReport): ScoutReport {
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.scores || {})) if (/^[a-z_]{2,20}$/.test(k) && Number.isInteger(v) && v >= 1 && v <= 5) scores[k] = v;
  return {
    ...r, date: isoOrNull(r.date) || iso(new Date()), event: txt(r.event, SCOUT_LIMITS.event).trim(), kind: REPORT_KINDS.includes(r.kind) ? r.kind : "other",
    min: Number.isInteger(Number(r.min)) && r.min != null && Number(r.min) >= 0 && Number(r.min) <= 300 ? Number(r.min) : null,
    pos: r.pos && SCOUT_POS.includes(r.pos) ? r.pos : null, scores, grade: lvl(r.grade), verdict: VERDICTS.includes(r.verdict as Verdict) ? r.verdict : null,
    strengths: txt(r.strengths, SCOUT_LIMITS.text), weaknesses: txt(r.weaknesses, SCOUT_LIMITS.text), summary: txt(r.summary, SCOUT_LIMITS.summary),
  };
}
/** Bereichswert aus den Einzelkompetenzen (gerundet), wenn Details bewertet wurden */
export function areaFromDetails(scores: Record<string, number>, keys: string[]): number | null {
  const v = keys.map(k => scores[k]).filter((x): x is number => typeof x === "number" && x >= 1 && x <= 5);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/** Nach der Zusage: Spielerprofil für den eigenen Kader (Flügelstürmer → linkes/rechtes Mittelfeld) */
export function takeoverPlayer(s: ScoutPlayer, id: string): Player {
  const p0 = s.pos[0] || "", pos = p0 === "LA" ? "LM" : p0 === "RA" ? "RM" : POS.includes(p0) ? p0 : "";
  return { id, vn: s.vn, nn: s.nn, pos, nr: null, geb: s.geb || "", kg: null, photo: null, userId: null, active: true, groups: [] };
}
/** Fällig: nächster Schritt heute oder überfällig */
export const nextDue = (s: Pick<ScoutPlayer, "next">, today: string): boolean => !!s.next && s.next <= today;
export const nextSoon = (s: Pick<ScoutPlayer, "next">, today: string, days = 7): boolean => !!s.next && s.next > today && s.next <= addDays(today, days);
