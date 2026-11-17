// Individuelles Entwicklungsprogramm – das Herzstück der Spielerentwicklung. Ein Programm je Spieler:
// - Spielerkarte: Motto (#FESTMACHEN), X-Faktor (1–3 Waffen), Saisonzahlen und Notenverlauf, stärkster Bereich auf dem Feld
// - Perform: „So mache ich den Unterschied“ – bis zu drei Situationen in Ich-Form
// - Improve: „Arbeite hart und clever an deinem Weg“ – vier Felder (Stärke veredeln, Extraschicht, Fokus, abseits des
//   Platzes), jeweils mit Ort (wo verbessern) und Hilfe (wo nach Hilfe fragen), optional mit messbarem Ziel
// - Sicht von Spieler (Selbstanalyse), Mitspielern (Stärken-Runde) und Trainerteam – daraus der X-Faktor
// Stärkenorientiert: Stärken ausbauen und wenige Felder gezielt entwickeln. Mitspieler nennen nur Stärken aus einem
// festen Katalog (kein Freitext, keine Namen beim Empfänger); was der Spieler davon sieht, wählt das Trainerteam aus.
// Reine Logik ohne UI und ohne Datenbank.
import { addDays } from "./dates";
import { seasonStart } from "./kasse";
import { isGoalkeeper } from "./units";
import type {
  DevArea, DevProgram, DevSelf, ImproveItem, ImproveKind, ImproveWhere, IndivTopic, PeerGift, PeerMate, PeerRound, Player, SkillView, TeamData, TeamSettings,
} from "./types";

// ---------- Stärken-Katalog ----------
/** Für wen eine Stärke passt: alle, nur Feldspieler, nur Torhüter */
export type SkillFor = "all" | "field" | "gk";
export interface SkillDef { key: string; area: DevArea; for: SkillFor }
const S = (area: DevArea, f: SkillFor, ...keys: string[]): SkillDef[] => keys.map(key => ({ key, area, for: f }));
/** Stärken in der Sprache des Platzes (Texte sk_*). Reihenfolge = Anzeige in der Auswahl. */
export const SKILLS: SkillDef[] = [
  ...S("tech", "field", "festmachen"), ...S("tech", "all", "ballkontrolle", "passspiel"),
  ...S("tech", "field", "tiefpass", "letzterpass", "flanken", "dribbling", "schusstechnik", "abschluss", "kopfball"),
  ...S("tech", "all", "flugbaelle", "beidfuss"), ...S("tech", "field", "standards"),
  ...S("tech", "gk", "reflexe", "fangsicherheit", "hohebaelle", "fussspiel", "abwurf"),
  ...S("takt", "all", "spielverstaendnis", "uebersicht"), ...S("takt", "field", "zweikampf"), ...S("takt", "all", "stellungsspiel", "antizipation"),
  ...S("takt", "field", "pressing", "umschalten", "tiefenlaeufe", "freilaufen"), ...S("takt", "all", "spieleroeffnung"),
  ...S("takt", "field", "boxverteidigen"), ...S("takt", "gk", "strafraum", "einsgegeneins"),
  ...S("ath", "all", "physis", "schnelligkeit"), ...S("ath", "field", "antritt", "ausdauer"), ...S("ath", "all", "sprungkraft", "beweglichkeit"),
  ...S("ment", "field", "aggressivitaet"), ...S("ment", "all", "mentalitaet", "mut", "kommunikation", "coaching", "fuehrung", "konzentration", "einsatz", "ruhe", "teamgeist", "ehrgeiz"),
];
const SKILL_MAP = new Map(SKILLS.map((x, i) => [x.key, { ...x, i }]));
export const isSkill = (k: string): boolean => SKILL_MAP.has(k);
/** Eigener Begriff des Trainerteams („t:Flugbälle mit links“) */
export const isCustomSkill = (k: string): boolean => k.startsWith("t:");
export const customSkill = (label: string): string => "t:" + clean(label, 30);
/** Bereich einer Stärke (eigene Begriffe: null) */
export const skillArea = (k: string): DevArea | null => SKILL_MAP.get(k)?.area ?? null;
/** Stärken zur Auswahl – Torhüter sehen Torwart-Stärken statt reiner Feldspieler-Stärken */
export const skillsFor = (gk: boolean): SkillDef[] => SKILLS.filter(x => x.for === "all" || x.for === (gk ? "gk" : "field"));
const order = (k: string): number => SKILL_MAP.get(k)?.i ?? 999;

// ---------- Felder, Orte, Hilfe ----------
export const IMPROVE_KINDS: ImproveKind[] = ["excel", "extra", "focus", "off"];
export const IMPROVE_WHERE: ImproveWhere[] = ["training", "indiv", "extra", "home", "video", "athletik", "spiel"];
/** Hilfe: Trainerteam, Mitspieler oder ein Trainerprofil (ID) */
const HELP_RE = /^(team|mates|[A-Za-z0-9_-]{1,40})$/;
export const LIMITS = { xf: 3, sit: 3, sitLen: 140, tag: 24, weapons: 3, skills: 3, peers: 5, topic: 60, how: 200, help: 4, custom: 30, gift: 3 } as const;

// ---------- Stärkster Bereich: 5 Korridore × 3 Drittel ----------
/** Drittel von oben nach unten (Angriff oben, eigenes Tor unten) */
export const ZONE_ROWS = ["o", "m", "d"] as const;
/** Korridore von links nach rechts (Blick aufs gegnerische Tor): Flügel, Halbraum, Zentrum, Halbraum, Flügel */
export const ZONE_LANES = [1, 2, 3, 4, 5] as const;
export const ZONES: string[] = ZONE_ROWS.flatMap(r => ZONE_LANES.map(l => r + l));
/** Grenzen der Korridore in Metern (Feld 68 m breit): Strafraum- und Torraumbreite wie auf dem Platz */
const LANE_X = [0, 13.84, 24.84, 43.16, 54.16, 68];
/** Zone als Rechteck in Metern auf einem Hochkant-Feld 68 × 105 (y von oben) */
export function zoneRect(z: string): { x: number; y: number; w: number; h: number } | null {
  if (z.length !== 2) return null;
  const r = (ZONE_ROWS as readonly string[]).indexOf(z[0]), l = Number(z[1]) - 1;
  if (r < 0 || !(l >= 0 && l <= 4)) return null;
  return { x: LANE_X[l], y: r * 35, w: Math.round((LANE_X[l + 1] - LANE_X[l]) * 100) / 100, h: 35 };
}

// ---------- Bereinigung (Grenzen wie in der Datenbank) ----------
function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
const arr = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
/** Motto ohne „#“, Leer- und Satzzeichen (Buchstaben, Ziffern, _ und - bleiben) */
export function cleanTag(s: unknown): string {
  return clean(s, 60).replace(/[\s#.,;:!?"'`´()[\]{}<>/\\|@$%^&*+=~§]/g, "").slice(0, LIMITS.tag);
}
/** Stärken-Schlüssel prüfen: nur Katalog (Spieler) bzw. auch eigene Begriffe (Trainerteam); ohne Doppelungen */
export function cleanSkills(L: unknown, max: number, custom: boolean, exclude: string[] = []): string[] {
  const out: string[] = [], seen = new Set(exclude.map(x => x.toLowerCase()));
  for (const x of arr(L)) {
    if (typeof x !== "string") continue;
    let k = x;
    if (isCustomSkill(k)) { if (!custom) continue; const t = clean(k.slice(2), LIMITS.custom); if (!t) continue; k = "t:" + t; }
    else if (!isSkill(k)) continue;
    if (seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase()); out.push(k);
    if (out.length >= max) break;
  }
  return out;
}
export function cleanImprove(L: unknown): ImproveItem[] {
  const out: ImproveItem[] = [];
  for (const kind of IMPROVE_KINDS) {
    const x = arr(L).find(y => !!y && typeof y === "object" && (y as ImproveItem).kind === kind) as Partial<ImproveItem> | undefined;
    if (!x) continue;
    const skill = typeof x.skill === "string" && isSkill(x.skill) ? x.skill : null, topic = clean(x.topic, LIMITS.topic);
    if (!topic && !skill) continue;
    out.push({
      kind, topic, skill,
      where: IMPROVE_WHERE.filter(w => arr(x.where).includes(w)),
      help: [...new Set(arr(x.help).filter((h): h is string => typeof h === "string" && HELP_RE.test(h)))].slice(0, LIMITS.help),
      how: clean(x.how, LIMITS.how),
      goalId: typeof x.goalId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x.goalId) ? x.goalId : null,
    });
  }
  return out;
}
function cleanView(v: Partial<SkillView> | undefined, custom: boolean): SkillView {
  const weapons = cleanSkills(v?.weapons, LIMITS.weapons, custom);
  return { weapons, skills: cleanSkills(v?.skills, LIMITS.skills, custom, weapons) };
}
export function cleanProgram(p: Partial<DevProgram> & { pid: string }): DevProgram {
  return {
    pid: p.pid, tag: cleanTag(p.tag), xf: cleanSkills(p.xf, LIMITS.xf, true),
    sit: arr(p.sit).map(s => clean(s, LIMITS.sitLen)).filter(Boolean).slice(0, LIMITS.sit),
    zones: ZONES.filter(z => arr(p.zones).includes(z)),
    improve: cleanImprove(p.improve), coach: cleanView(p.coach, true),
    peers: cleanSkills(p.peers, LIMITS.peers, false),
    vis: !!p.vis, at: typeof p.at === "string" ? p.at : null,
  };
}
export const emptyProgram = (pid: string): DevProgram => cleanProgram({ pid });
/** Inhalt für die Datenbank (ohne Spieler, Freigabe und Zeitpunkt) */
export function programContent(p: DevProgram): Omit<DevProgram, "pid" | "vis" | "at"> {
  const { tag, xf, sit, zones, improve, coach, peers } = cleanProgram(p);
  return { tag, xf, sit, zones, improve, coach, peers };
}
export function cleanSelf(s: Partial<DevSelf> & { pid: string }): DevSelf {
  const v = cleanView(s, false);
  return { pid: s.pid, weapons: v.weapons, skills: v.skills, at: typeof s.at === "string" ? s.at : null };
}
/** Geschenkte Stärken: 1–3 aus dem Katalog */
export const cleanGift = (skills: unknown): string[] => cleanSkills(skills, LIMITS.gift, false);

/** Thema für „Individualtraining anfragen“ passend zu einem Improve-Feld (Torhüter: Torwarttraining für Technik und Taktik) */
export function indivTopicFor(x: Pick<ImproveItem, "skill" | "where">, gk: boolean): IndivTopic {
  const k = x.skill, d = k ? SKILL_MAP.get(k) : undefined, a = d?.area ?? null;
  if (d?.for === "gk" || (gk && (a === "tech" || a === "takt"))) return "tw";
  if (k === "beidfuss") return "schwach";
  if (k === "kopfball") return "kopf";
  if (k === "abschluss" || k === "schusstechnik") return "schuss";
  if (a === "tech") return "technik";
  if (a === "takt") return x.where.includes("video") ? "video" : "taktik";
  if (a === "ath") return "athletik";
  if (a === "ment") return "mental";
  return x.where.includes("video") ? "video" : "sonst";
}

export const isEmptyProgram = (p: DevProgram): boolean =>
  !p.tag && !p.xf.length && !p.sit.length && !p.zones.length && !p.improve.length && !p.coach.weapons.length && !p.coach.skills.length && !p.peers.length;
export type ProgramStatus = "none" | "draft" | "live";
export const programStatus = (p: DevProgram | null | undefined): ProgramStatus => !p || isEmptyProgram(p) ? "none" : p.vis ? "live" : "draft";
export const programOf = (D: Pick<TeamData, "programs">, pid: string): DevProgram | null => D.programs.find(x => x.pid === pid) || null;
/** Programm, wie der Spieler es sieht (nur freigegeben) */
export const visibleProgram = (D: Pick<TeamData, "programs">, pid: string): DevProgram | null => { const p = programOf(D, pid); return p && p.vis && !isEmptyProgram(p) ? p : null; };
export const selfOf = (D: Pick<TeamData, "selfSkills">, pid: string): DevSelf | null => D.selfSkills.find(x => x.pid === pid) || null;
/** Was fürs Programm noch fehlt (Hinweise für das Trainerteam) */
export function programTodo(p: DevProgram): ("xf" | "sit" | "improve" | "zones" | "coach")[] {
  const out: ("xf" | "sit" | "improve" | "zones" | "coach")[] = [];
  if (!p.xf.length) out.push("xf");
  if (!p.sit.length) out.push("sit");
  if (p.improve.length < 2) out.push("improve");
  if (!p.zones.length) out.push("zones");
  if (!p.coach.weapons.length) out.push("coach");
  return out;
}

// ---------- Stärken-Runde ----------
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const PEER_DAYS = [7, 14, 21] as const;
/** Letzte bzw. laufende Runde (null = noch keine) */
export function peerRoundOf(S: Pick<TeamSettings, "peer">): PeerRound | null {
  const r = S.peer;
  return r && ISO.test(r.since) && ISO.test(r.until) && r.since <= r.until ? r : null;
}
export const peerOpen = (S: Pick<TeamSettings, "peer">, today: string): boolean => { const r = peerRoundOf(S); return !!r && r.since <= today && today <= r.until; };
export const startRound = (today: string, days: number): PeerRound => ({ since: today, until: addDays(today, Math.max(1, Math.min(42, Math.round(days))) - 1) });
/** Runde beenden: endet gestern, bleibt aber für die Auswertung erhalten */
export const endRound = (r: PeerRound, today: string): PeerRound => ({ since: r.since <= addDays(today, -1) ? r.since : addDays(today, -1), until: addDays(today, -1) });

export interface PeerCount { key: string; n: number }
/** Stärken eines Spielers aus der Stärken-Runde: wie oft genannt und von wie vielen Mitspielern (seit `since`) */
export function peerCounts(gifts: PeerGift[], target: string, since: string | null): { givers: number; list: PeerCount[] } {
  const L = gifts.filter(g => g.target === target && g.giver !== target && (!since || g.at.slice(0, 10) >= since));
  const m = new Map<string, number>();
  for (const g of L) for (const k of new Set(g.skills)) if (isSkill(k)) m.set(k, (m.get(k) || 0) + 1);
  return { givers: new Set(L.map(g => g.giver)).size, list: [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || order(a.key) - order(b.key)) };
}
/** Ab so vielen Mitspielern gilt eine Nennung als Muster (Vorschläge); vorher nur Hinweis */
export const PEER_MIN_GIVERS = 3;
/** Teilnahme an der Runde: wer hat wem schon etwas geschenkt (seit `since`) */
export function peerProgress(gifts: PeerGift[], players: Pick<Player, "id">[], since: string | null): { givers: number; received: number; players: number } {
  const ids = new Set(players.map(p => p.id)), L = gifts.filter(g => g.giver !== g.target && ids.has(g.giver) && ids.has(g.target) && (!since || g.at.slice(0, 10) >= since));
  return { givers: new Set(L.map(g => g.giver)).size, received: new Set(L.map(g => g.target)).size, players: ids.size };
}
/** Mitspieler für die Stärken-Runde aus dem Kader (Demo und Tests; im Betrieb liefert sie der Server) */
export const matesOf = (players: Player[], me: string): PeerMate[] =>
  players.filter(p => p.id !== me && p.active !== false).map(p => ({ id: p.id, name: `${p.vn} ${p.nn.slice(0, 1)}.`.trim(), nr: p.nr ?? null, pos: p.pos }));

// ---------- X-Faktor: wo sich die Sichten treffen ----------
export type ViewSource = "self" | "mates" | "coach";
export interface XfSuggestion { key: string; by: ViewSource[]; score: number }
/**
 * Vorschläge für den X-Faktor: Stärken, die mehrere Sichten nennen (Spieler, Mitspieler ab zwei Nennungen,
 * Trainerteam), danach die Waffen des Trainerteams. Waffen zählen mehr als weitere Stärken.
 */
export function xfSuggest(coach: SkillView, self: DevSelf | null, peers: PeerCount[]): XfSuggestion[] {
  const by = new Map<string, Set<ViewSource>>(), score = new Map<string, number>();
  const add = (k: string, src: ViewSource, w: number) => { if (!by.has(k)) by.set(k, new Set()); by.get(k)!.add(src); score.set(k, (score.get(k) || 0) + w); };
  self?.weapons.forEach(k => add(k, "self", 2)); self?.skills.forEach(k => add(k, "self", 1));
  coach.weapons.forEach(k => add(k, "coach", 3)); coach.skills.forEach(k => add(k, "coach", 1));
  peers.filter(x => x.n >= 2).forEach(x => add(x.key, "mates", Math.min(3, 1 + x.n / 2)));
  return [...by].map(([key, s]) => ({ key, by: (["self", "mates", "coach"] as ViewSource[]).filter(v => s.has(v)), score: score.get(key) || 0 }))
    .filter(x => x.by.length >= 2 || coach.weapons.includes(x.key))
    .sort((a, b) => b.by.length - a.by.length || b.score - a.score || order(a.key) - order(b.key));
}

// ---------- Zahlen für die Spielerkarte ----------
export interface CardStats {
  games: number; minutes: number; goals: number; assists: number;
  /** Pre-Assists (null = in keinem Spiel erfasst) */ pre: number | null;
  /** Ø Spielnote 1–10 (null = keine) */ avg: number | null;
  gk: boolean; clean: number | null; conceded: number | null;
  /** Notenverlauf (älteste zuerst) mit Gegner */ series: { date: string; opp: string; rating: number }[];
  /** Spieldaten im Zeitraum vorhanden */ has: boolean; from: string;
}
/**
 * Saisonzahlen (ab 1. Juli) für die Spielerkarte: Einsätze, Minuten, Tore, Vorlagen, Pre-Assists, Ø Note und Notenverlauf.
 * `onlyVisible`: nur für den Spieler freigegebene Noten (Spieler-App und Vorschau „so sieht es der Spieler“).
 */
export function cardStats(D: Pick<TeamData, "matches" | "stats" | "ratings" | "groups">, p: Player, today: string, onlyVisible = true, from = seasonStart(today)): CardStats {
  const ms = D.matches.filter(m => m.date >= from && m.date <= today);
  const st = ms.map(m => D.stats[m.id]?.[p.id]).filter((x): x is NonNullable<typeof x> => !!x);
  const played = st.filter(x => x.min > 0), gk = isGoalkeeper(D, p);
  const pre = st.filter(x => typeof x.pre === "number");
  const kept = played.filter(x => x.conceded != null);
  const series = D.ratings.filter(r => r.pid === p.id && r.kind === "spiel" && r.rating != null && r.date >= from && r.date <= today && (!onlyVisible || r.vis))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    .map(r => ({ date: r.date, opp: ms.find(m => m.date === r.date)?.gegner || "", rating: Math.round(r.rating! * 10) / 10 }));
  const sum = (L: number[]) => L.reduce((a, b) => a + b, 0);
  return {
    games: played.length, minutes: sum(played.map(x => x.min)), goals: sum(st.map(x => x.goals)), assists: sum(st.map(x => x.assists)),
    pre: pre.length ? sum(pre.map(x => x.pre as number)) : null,
    avg: series.length ? Math.round(sum(series.map(x => x.rating)) / series.length * 10) / 10 : null,
    gk, clean: gk && kept.length ? kept.filter(x => x.conceded === 0 && x.min >= 60).length : null, conceded: gk && kept.length ? sum(kept.map(x => x.conceded || 0)) : null,
    series, has: st.length > 0, from,
  };
}
/** Kurzform eines Gegners für den Notenverlauf („SV Nordheim“ → „NOR“, „1. FC Talheim“ → „TAL“) */
export function oppShort(name: string): string {
  const skip = /^(sv|fc|tsv|tus|vfr|vfb|vfl|sc|sg|spvgg|djk|bv|tsg|ssv|fsv|ksv|1\.|rot-weiß|rw|eintracht|borussia|sportfreunde|sf|jsg|fv|ssg|tv|sportverein)$/i;
  const words = name.replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ\s.-]/g, " ").split(/\s+/).filter(Boolean);
  const letters = (w: string) => w.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  // erstes „echtes“ Wort: kein Vereinskürzel, keine Altersklasse (U19), keine Mannschaftsnummer (II)
  const main = words.find(w => !skip.test(w) && !/^u\d+$/i.test(w) && !/^[ivx]+$/i.test(w) && letters(w).length >= 3) || words.find(w => letters(w)) || "";
  return letters(main).slice(0, 3).toUpperCase();
}
