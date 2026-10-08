// Angaben zum Schmerz je Körperregion und was sie für das Training bedeuten.
// Fragen nach dem klinischen Schema SOCRATES (Ort, Beginn, Art, Ausstrahlung, Begleitzeichen, Verlauf, Auslöser,
// Stärke) in sportgerechter Form; Stärke als numerische Schmerzskala 0–10 (NRS, Hawker et al. 2011).
// Warnzeichen: nicht belastbar/instabil → ärztlich abklären (Ottawa Ankle Rules, Stiell et al. 1992),
// plötzlich stechend/ziehend im Sprint → Verdacht Muskelverletzung (Mueller-Wohlfahrt et al. 2013),
// schleichend, nach Belastung, morgens steif → Überlastung von Sehne/Knochen (Cook & Purdam 2009; Warden et al. 2014),
// Ausstrahlen/Taubheit → Nerv, abklären; Kopf nach Zusammenprall → Gehirnerschütterung (Patricios et al. 2023).
// Akutversorgung „PEACE & LOVE“ (Dubois & Esculier 2020). Die App gibt Orientierung, keine Diagnose.
import { bodyDef, cleanAreas, parseArea, regionEffect, type BodyCode, type BodyEffect, type BodyEffectKind } from "./body";
import { addDays } from "./dates";
import { rehaGroupOf, type RehaGroup } from "./reha";
import type { Complaint, PainInfo, PainQuality, PainSign, PainWhen, TeamData, Wellness } from "./types";

export const PAIN_Q: PainQuality[] = ["stab", "pull", "dull", "burn", "throb", "cramp", "radiate", "numb", "stiff"];
export const PAIN_Q_KID: PainQuality[] = ["stab", "pull", "dull"];
export const PAIN_WHEN: PainWhen[] = ["rest", "run", "sprint", "shot", "jump", "cut", "after", "morning", "night"];
export const PAIN_SIGNS: PainSign[] = ["swelling", "bruise", "unstable", "weight", "locked"];
export const PAIN_SIGNS_KID: PainSign[] = ["swelling", "weight"];
const SINCE = ["today", "days", "week", "long"] as const;

/** Nur gültige Werte übernehmen (Eingaben vom Gerät/aus der Datenbank) */
export function cleanPain(x: unknown): PainInfo | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>, out: PainInfo = {};
  const list = <T extends string>(v: unknown, ok: readonly T[]): T[] => Array.isArray(v) ? [...new Set(v.filter((y): y is T => ok.includes(y as T)))] : [];
  if (typeof o.nrs === "number" && Number.isFinite(o.nrs)) out.nrs = Math.max(0, Math.min(10, Math.round(o.nrs)));
  const q = list(o.q, PAIN_Q); if (q.length) out.q = q;
  if (o.onset === "sudden" || o.onset === "gradual") out.onset = o.onset;
  if (SINCE.includes(o.since as typeof SINCE[number])) out.since = o.since as PainInfo["since"];
  const w = list(o.when, PAIN_WHEN); if (w.length) out.when = w;
  if (o.cause === "contact" || o.cause === "noncontact" || o.cause === "none") out.cause = o.cause;
  const sg = list(o.signs, PAIN_SIGNS); if (sg.length) out.signs = sg;
  if (o.train === "full" || o.train === "limited" || o.train === "no") out.train = o.train;
  return Object.keys(out).length ? out : null;
}
/** Angaben aller Regionen bereinigen; nur Regionen, die auch gemeldet sind (Schlüssel ohne Seite) */
export function cleanPainMap(pain: Record<string, unknown> | undefined | null, areas: string[]): Record<string, PainInfo> {
  const keys = new Set(areas.map(a => a.split(":")[0])), out: Record<string, PainInfo> = {};
  for (const [k, v] of Object.entries(pain || {})) { if (!keys.has(k) || !bodyDef(k) || bodyDef(k)!.zone === "ill") continue; const c = cleanPain(v); if (c) out[k] = c; }
  return out;
}

const RANK: Record<BodyEffectKind, number> = { sick: 4, pause: 3, easy: 2, mod: 1 };
const has = <T,>(L: T[] | undefined, ...x: T[]): boolean => !!L && x.some(y => L.includes(y));

export interface PainEffect extends BodyEffect { flags: string[] }

/**
 * Wirkung einer Region mit Angaben zum Schmerz: startet bei der Regel für die Region (core/body) und verschärft sie
 * bei Warnzeichen. `flags` sind i18n-Schlüssel (pf_*) mit kurzen Hinweisen für Spieler und Trainer.
 */
export function painEffect(k: BodyCode, info: PainInfo | null | undefined, level: Exclude<Complaint, "none">, base: number, tw: boolean): PainEffect {
  const d = bodyDef(k)!;
  // Stärke ≥ 5 zählt wie „deutliche“ Beschwerde
  const lv: Exclude<Complaint, "none"> = info?.nrs != null && info.nrs >= 5 ? "clear" : level;
  let ef: BodyEffect = regionEffect(k, lv, base, tw);
  const flags: string[] = [];
  const up = (kind: BodyEffectKind, cap: number | null): void => {
    if (RANK[kind] > RANK[ef.kind] || (RANK[kind] === RANK[ef.kind] && (cap ?? 99) < (ef.cap ?? 99))) ef = { ...ef, kind, cap };
  };
  if (!info) return { ...ef, flags };
  const muscle = d.type === "muscle", overuse = d.type === "tendon" || d.type === "bone" || d.type === "joint";
  if (has(info.signs, "weight", "unstable", "locked")) { up("pause", 0); flags.push("pf_doctor"); }
  if (has(info.signs, "swelling", "bruise") && info.onset === "sudden") { up("pause", 0); flags.push("pf_acute"); }
  if (info.nrs != null && info.nrs >= 7) { up("pause", 0); flags.push("pf_severe"); }
  if (d.type === "head" && info.cause === "contact") { up("pause", 0); flags.push("pf_concussion"); }
  if (muscle && info.onset === "sudden" && has(info.q, "stab", "pull")) { up("pause", 0); flags.push("pf_muscle"); }
  if (has(info.q, "radiate", "numb")) { if (d.type === "back" || d.type === "neck") up("pause", 0); else up("easy", Math.max(2, base - 2)); flags.push("pf_nerve"); }
  if (d.type === "bone" && has(info.when, "night", "rest") && (info.since === "week" || info.since === "long")) { up("pause", 0); flags.push("pf_bone"); }
  if (overuse && info.onset === "gradual" && has(info.when, "after", "morning", "run", "jump")) { up("easy", Math.max(3, base - 2)); flags.push("pf_overuse"); }
  if (info.since === "long" && !flags.includes("pf_bone")) flags.push("pf_long");
  if (info.train === "no") { up("pause", 0); flags.push("pf_selfNo"); }
  else if (info.train === "limited") up("easy", Math.max(3, base - 1));
  return { ...ef, flags };
}

/**
 * Stärkste Wirkung aller gemeldeten Regionen (ohne Regionen: allgemeine Beschwerde) – mit den Angaben zum Schmerz.
 * `flags` sammelt die Hinweise aller Regionen (ohne Doppelte).
 */
export function complaintEffect(w: Wellness | null | undefined, base: number, tw: boolean): PainEffect | null {
  if (!w || w.beschw === "none") return null;
  const level = w.beschw, areas = cleanAreas(w.areas).map(parseArea).filter((a): a is NonNullable<typeof a> => !!a);
  if (!areas.length) return level === "clear" ? { kind: "pause", cap: 0, how: "bd_none_clear", type: null, k: null, flags: [] } : null;
  let best: PainEffect | null = null; const flags = new Set<string>();
  for (const a of areas) {
    const ef = painEffect(a.k, w.pain?.[a.k], level, base, tw);
    ef.flags.forEach(f => flags.add(f));
    if (!best || RANK[ef.kind] > RANK[best.kind] || (RANK[ef.kind] === RANK[best.kind] && (ef.cap ?? 99) < (best.cap ?? 99))) best = ef;
  }
  return best ? { ...best, flags: [...flags] } : null;
}

/** Kurzbeschreibung für Trainer und Spieler: „ziehend · 6/10 · plötzlich · beim Sprint · seit heute“ */
export function painSummary(t: (k: string) => string, info: PainInfo | null | undefined): string {
  if (!info) return "";
  const parts: string[] = [];
  if (info.q?.length) parts.push(info.q.map(q => t("pq_" + q)).join(", "));
  if (info.nrs != null) parts.push(`${info.nrs}/10`);
  if (info.onset) parts.push(t("po_" + info.onset));
  if (info.when?.length) parts.push(info.when.map(w => t("pwh_" + w)).join(", "));
  if (info.since) parts.push(t("ps_" + info.since));
  if (info.cause && info.cause !== "none") parts.push(t("pc_" + info.cause));
  if (info.signs?.length) parts.push(info.signs.map(s => t("pg_" + s)).join(", "));
  if (info.train) parts.push(t("pt_" + info.train));
  return parts.join(" · ");
}

/** Farbton der Schmerzstärke (0–3 grün, 4–6 gelb, 7–10 rot) */
export const nrsLevel = (n: number): "ok" | "warn" | "crit" => n <= 3 ? "ok" : n <= 6 ? "warn" : "crit";

export interface Hotspot { k: BodyCode; group: RehaGroup; players: string[]; clear: number; entries: number }
/**
 * Häufung von Beschwerden im Team (letzte `days` Tage): je Region die Spieler (nicht Einträge),
 * deutliche Beschwerden und Einträge. Sortiert nach Anzahl Spieler.
 */
export function teamHotspots(D: Pick<TeamData, "well" | "players">, today: string, days = 28): Hotspot[] {
  const from = addDays(today, -days + 1), map = new Map<BodyCode, Hotspot>();
  for (const p of D.players) {
    for (const [date, w] of Object.entries(D.well[p.id] || {})) {
      if (date < from || date > today || w.beschw === "none") continue;
      for (const a of cleanAreas(w.areas)) {
        const pa = parseArea(a); if (!pa || bodyDef(pa.k)!.zone === "ill") continue;
        const h = map.get(pa.k) || { k: pa.k, group: rehaGroupOf(pa.k), players: [], clear: 0, entries: 0 };
        if (!h.players.includes(p.id)) h.players.push(p.id);
        h.entries++; if (w.beschw === "clear") h.clear++;
        map.set(pa.k, h);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.players.length - a.players.length || b.clear - a.clear || b.entries - a.entries);
}
/** Präventions-Hinweise für Gruppen mit Häufung (mind. 2 Spieler bzw. 10 % des Kaders) */
export function preventionFor(spots: Hotspot[], squad: number): RehaGroup[] {
  const min = Math.max(2, Math.ceil(squad * 0.1)), byGroup = new Map<RehaGroup, Set<string>>();
  for (const h of spots) { const s = byGroup.get(h.group) || new Set<string>(); h.players.forEach(p => s.add(p)); byGroup.set(h.group, s); }
  return [...byGroup.entries()].filter(([, s]) => s.size >= min).sort((a, b) => b[1].size - a[1].size).map(([g]) => g);
}
