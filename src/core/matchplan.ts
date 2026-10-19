// Matchplan (Paket B): Aufstellung per Ziehen, Taktik- und Standardfolien mit Ausschnitt, Spielidee,
// Gegneranalyse, Spieleraufgaben, Wechselplan und Freigabe für Spieler. Reine Logik ohne UI und ohne Datenbank.
//
// Koordinaten in Metern auf einem Hochkant-Spielfeld (68 × 105): x = Breite (0 = links), y = Länge
// (0 = gegnerisches Tor oben, 105 = eigenes Tor unten). Die eigene Mannschaft spielt nach oben.
// Ein Ausschnitt (z. B. nur der 16er bei Standards) ist nur ein anderer Bildausschnitt – die Positionen bleiben. Er
// füllt immer die volle Breite der Anzeige: ein kleiner Ausschnitt wird also größer dargestellt (Zoom).
import { posGroup } from "./classes";
import type {
  ClassKey, Match, MatchPlan, MpAvail, MpColor, MpContent, MpFmt, MpFrame, MpIdea, MpItem, MpLook, MpMode, MpOpp, MpPublished, MpSection, MpShare, MpSlide, MpSlideCat, MpSub, MpTool, MpView, Player,
} from "./types";

export const PW = 68, PL = 105;
/**
 * Voreingestellte Ausschnitte (Meter, mit Rand). Der 16er ist gezoomt (ca. 1,6-fach), die Ecken zeigen eine Seite mit
 * Eckfahne und Strafraum, „Strafraum (breit)“ beide Ecken.
 */
export const MP_VIEWS: Record<MpView, MpFrame> = {
  full: { x: -3, y: -3, w: 74, h: 111 },
  att: { x: -3, y: -3, w: 74, h: 59 },
  def: { x: -3, y: 49, w: 74, h: 59 },
  third: { x: -3, y: -3, w: 74, h: 42 },
  pen_att: { x: 11, y: -4, w: 46, h: 34 },
  pen_def: { x: 11, y: 75, w: 46, h: 34 },
  cor_al: { x: -3, y: -4, w: 60, h: 35 },
  cor_ar: { x: 11, y: -4, w: 60, h: 35 },
  cor_dl: { x: -3, y: 74, w: 60, h: 35 },
  cor_dr: { x: 11, y: 74, w: 60, h: 35 },
  box_att: { x: -3, y: -4, w: 74, h: 37 },
  box_def: { x: -3, y: 72, w: 74, h: 37 },
};
/** Reihenfolge in der Auswahl (je drei: Feld, 16er, Ecken vorne, Ecken hinten) */
export const MP_VIEW_KEYS: MpView[] = ["full", "att", "def", "third", "pen_att", "pen_def", "cor_al", "cor_ar", "box_att", "cor_dl", "cor_dr", "box_def"];
export const SLIDE_CATS: MpSlideCat[] = ["grund", "ball", "gegen", "umschalt", "ecke_off", "ecke_def", "frei_off", "frei_def", "einwurf", "anstoss", "sonst"];
/** Passender Ausschnitt je Folienart (Ecken: Eckfahne und Strafraum, gezoomt) */
export const catView = (c: MpSlideCat): MpView =>
  c === "ecke_off" ? "cor_ar" : c === "ecke_def" ? "cor_dl" : c === "frei_off" ? "att" : c === "frei_def" ? "def" : "full";

// ---------- Ausschnitt: Zoom, Verschieben, Format ----------
/** Größter Ausschnitt (ganzes Feld mit Rand) und kleinster (ca. 4-fach gezoomt) */
export const FRAME_MAX = { w: PW + 6, h: PL + 6 };
export const FRAME_MIN_W = 18;
/** Formate (Höhe : Breite): hochkant wie das ganze Feld, quadratisch, breit wie der 16er */
export const FRAME_FORMATS: { k: "tall" | "square" | "wide"; r: number }[] = [{ k: "tall", r: 1.5 }, { k: "square", r: 1 }, { k: "wide", r: 0.6 }];
const fr = (n: number): number => Math.round(n * 10) / 10;
/** Größe begrenzen (Seitenverhältnis 0,4 … 1,6 bleibt erhalten) */
function sizeFrame(w0: number, h0: number): { w: number; h: number } {
  const r = Math.max(0.4, Math.min(1.6, h0 / w0));
  const w = Math.max(FRAME_MIN_W, Math.min(w0, FRAME_MAX.w, FRAME_MAX.h / r));
  return { w, h: w * r };
}
/** Ausschnitt in den Grenzen halten: Mindest-/Höchstgröße, höchstens 5 m (seitlich) bzw. 6 m (hinter dem Tor) neben dem Feld */
export function clampFrame(f: MpFrame): MpFrame {
  const w0 = Number(f.w), h0 = Number(f.h);
  if (!(w0 > 0) || !(h0 > 0) || !isFinite(w0) || !isFinite(h0)) return { ...MP_VIEWS.full };
  const { w, h } = sizeFrame(w0, h0);
  const x = Math.max(-5, Math.min(PW + 5 - w, Number(f.x) || 0)), y = Math.max(-6, Math.min(PL + 6 - h, Number(f.y) || 0));
  return { x: fr(x), y: fr(y), w: fr(w), h: fr(h) };
}
/** Zoomen um einen Punkt (Faktor > 1 = näher heran); der Punkt bleibt an seiner Stelle, das Format bleibt */
export function zoomFrame(f: MpFrame, factor: number, cx = f.x + f.w / 2, cy = f.y + f.h / 2): MpFrame {
  const { w, h } = sizeFrame(f.w / factor, f.h / factor), k = w / f.w;
  return clampFrame({ x: cx - (cx - f.x) * k, y: cy - (cy - f.y) * k, w, h });
}
/** Ausschnitt verschieben (Meter) */
export const panFrame = (f: MpFrame, dx: number, dy: number): MpFrame => clampFrame({ ...f, x: f.x + dx, y: f.y + dy });
/** Format ändern (Höhe : Breite); die Mitte bleibt */
export function formatFrame(f: MpFrame, ratio: number): MpFrame {
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  let w = f.w, h = w * ratio;
  if (h > FRAME_MAX.h) { h = FRAME_MAX.h; w = h / ratio; }
  return clampFrame({ x: cx - w / 2, y: cy - h / 2, w, h });
}
/** Nächstliegendes Format eines Ausschnitts */
export const formatOf = (f: MpFrame): "tall" | "square" | "wide" =>
  FRAME_FORMATS.reduce((a, b) => Math.abs(Math.log(b.r) - Math.log(f.h / f.w)) < Math.abs(Math.log(a.r) - Math.log(f.h / f.w)) ? b : a).k;
/** Zoom gegenüber der ganzen Feldbreite (1 = ganze Breite) */
export const zoomOf = (f: MpFrame): number => Math.round((FRAME_MAX.w / f.w) * 100) / 100;
/** Ausschnitt einer Folie: eigener Ausschnitt oder die Voreinstellung */
export const frameOf = (sl: Pick<MpSlide, "view" | "frame">): MpFrame => sl.frame || MP_VIEWS[sl.view] || MP_VIEWS.full;
/** Voreinstellung, die genau diesem Ausschnitt entspricht (sonst null = eigener Ausschnitt) */
export function presetOf(f: MpFrame): MpView | null {
  for (const k of MP_VIEW_KEYS) { const v = MP_VIEWS[k]; if (Math.abs(v.x - f.x) < 0.3 && Math.abs(v.y - f.y) < 0.3 && Math.abs(v.w - f.w) < 0.3 && Math.abs(v.h - f.h) < 0.3) return k; }
  return null;
}
/** Ausschnitt einer Folie setzen: entspricht er einer Voreinstellung, wird nur sie gespeichert */
export function withFrame<T extends Pick<MpSlide, "view" | "frame">>(sl: T, f: MpFrame): T {
  const c = clampFrame(f), p = presetOf(c);
  return p ? { ...sl, view: p, frame: null } : { ...sl, frame: c };
}
/** Liegt der Punkt im Ausschnitt (mit Abstand m zum Rand)? */
export const inFrame = (f: MpFrame, x: number, y: number, m = 0): boolean => x >= f.x + m && x <= f.x + f.w - m && y >= f.y + m && y <= f.y + f.h - m;
/** Feldspieler (eigene und Gegner) außerhalb des Ausschnitts – Torhüter bleiben ohnehin im Tor */
export const outsideFrame = (items: MpItem[], f: MpFrame): MpItem[] => items.filter(it => (it.t === "own" || it.t === "opp") && it.label !== "TW" && !inFrame(f, it.x, it.y, 0.5));

// ---------- Linien mit Bogen ----------
/** Kontrollpunkt einer gebogenen Linie (quadratische Kurve); null = gerade */
export function bendCtrl(it: Pick<MpItem, "x" | "y" | "x2" | "y2" | "bend">): { x: number; y: number } | null {
  const b = it.bend || 0; if (!b) return null;
  const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, dx = x2 - it.x, dy = y2 - it.y;
  if (Math.hypot(dx, dy) < 0.5) return null;
  // positiv = nach links in Laufrichtung (Bildschirm: y nach unten)
  const k = b * 0.25;
  return { x: (it.x + x2) / 2 + dy * k, y: (it.y + y2) / 2 - dx * k };
}
/** Punkt auf der Linie (t = 0 … 1), auch für gebogene Linien */
export function linePoint(it: Pick<MpItem, "x" | "y" | "x2" | "y2" | "bend">, t: number): { x: number; y: number } {
  const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, c = bendCtrl(it);
  if (!c) return { x: it.x + (x2 - it.x) * t, y: it.y + (y2 - it.y) * t };
  const u = 1 - t;
  return { x: u * u * it.x + 2 * u * t * c.x + t * t * x2, y: u * u * it.y + 2 * u * t * c.y + t * t * y2 };
}

/** Bogen so setzen, dass der Scheitel der Kurve durch den Punkt p geht (Ziehen am Mittelgriff); nahe 0 = gerade */
export function bendThrough(it: Pick<MpItem, "x" | "y" | "x2" | "y2">, p: { x: number; y: number }): number {
  const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, dx = x2 - it.x, dy = y2 - it.y, L2 = dx * dx + dy * dy;
  if (L2 < 0.25) return 0;
  const mx = (it.x + x2) / 2, my = (it.y + y2) / 2;
  // Scheitel = Mitte + ½·(Kontrollpunkt − Mitte); Kontrollpunkt − Mitte = k·(dy, −dx), bend = k / 0,25
  const k = 2 * ((p.x - mx) * dy - (p.y - my) * dx) / L2, b = Math.round((k / 0.25) * 10) / 10;
  return Math.abs(b) < 0.15 ? 0 : Math.max(-3, Math.min(3, b));
}
/** Freihand: Punkte ausdünnen (Mindestabstand in Metern), Anfang und Ende bleiben; höchstens FREE_MAX Punkte */
export function thinPoints(P: { x: number; y: number }[], tol = 1.2): number[] {
  if (!P.length) return [];
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) { const a = out[out.length - 1]; if (Math.hypot(P[i].x - a.x, P[i].y - a.y) >= tol) out.push(P[i]); }
  if (P.length > 1) out.push(P[P.length - 1]);
  // zu viele Punkte: gleichmäßig auswählen
  const keep = out.length > FREE_MAX ? Array.from({ length: FREE_MAX }, (_, i) => out[Math.round(i * (out.length - 1) / (FREE_MAX - 1))]) : out;
  return keep.flatMap(p => [clampX(p.x), clampY(p.y)]);
}
/** Element verschieben (Meter); Linien, Flächen und Freihand als Ganzes */
export function shiftItem(it: MpItem, dx: number, dy: number): MpItem {
  const nx = clampX(it.x + dx), ny = clampY(it.y + dy), ddx = nx - it.x, ddy = ny - it.y;
  if (it.t === "free" && it.pts) {
    const pts = it.pts.map((v, i) => i % 2 ? clampY(v + ddy) : clampX(v + ddx));
    return { ...it, pts, x: pts[0], y: pts[1], x2: pts[pts.length - 2], y2: pts[pts.length - 1] };
  }
  if (isLine(it.t)) return { ...it, x: nx, y: ny, x2: clampX((it.x2 ?? it.x) + ddx), y2: clampY((it.y2 ?? it.y) + ddy) };
  return { ...it, x: nx, y: ny };
}
/** Mittelpunkt einer Linie/Freihandlinie (für Schrittnummer und Griff) */
export function itemMid(it: MpItem): { x: number; y: number } {
  if (it.t === "free" && it.pts && it.pts.length >= 4) { const n = it.pts.length / 2, i = Math.floor((n - 1) / 2); return { x: it.pts[i * 2], y: it.pts[i * 2 + 1] }; }
  return linePoint(it, 0.5);
}

// ---------- Spielfeld-Design ----------
export const MP_LOOKS: MpLook[] = ["grass", "dark", "white"];
/** Standardsituationen (eigener Bereich in der Folienliste) */
export const isSetPiece = (c: MpSlideCat): boolean => ["ecke_off", "ecke_def", "frei_off", "frei_def", "einwurf", "anstoss"].includes(c);

export const MP_SECTIONS: MpSection[] = ["lineup", "slides", "idea", "opp", "tasks", "subs"];
/** Standard der Freigabe: alles außer dem Wechselplan (der bleibt im Trainerteam) */
export const DEFAULT_SECTIONS: MpSection[] = ["lineup", "slides", "idea", "opp", "tasks"];
export const MP_TOOLS: MpTool[] = ["own", "opp", "ball", "cone", "text", "pass", "run", "drib", "line", "zone", "circle", "free"];
/** Elemente aus zwei Punkten (Start/Ziel bzw. Ecken, Mitte/Rand) */
export const LINE_TOOLS: MpTool[] = ["pass", "run", "drib", "line", "zone", "circle"];
export const isLine = (t: MpTool): boolean => LINE_TOOLS.includes(t);
/** Pfeile und Linien (mit Bogen und Schrittnummer) */
export const ARROW_TOOLS: MpTool[] = ["pass", "run", "drib", "line"];
export const isArrow = (t: MpTool): boolean => ARROW_TOOLS.includes(t);
/** Flächen (Zone, Kreis) */
export const isArea = (t: MpTool): boolean => t === "zone" || t === "circle";
/** Größte Zahl an Punkten einer Freihandlinie */
export const FREE_MAX = 40;
export const MP_COLORS: MpColor[] = ["w", "y", "r", "b"];
export const MP_MODES: MpMode[] = ["num", "name", "photo"];
/** Grenzen (u. a. damit ein Plan klein bleibt: Freihandlinien je Folie, je höchstens FREE_MAX Punkte) */
export const MP_LIMITS = { slides: 20, items: 80, free: 8, keys: 3, task: 300, subs: 12, oppKeys: 8, text: 1500, title: 80, slideTitle: 60, bench: 20, tasks: 40 };
export const FMTS: MpFmt[] = [11, 9, 7, 5];

// ---------- Grundordnungen ----------
export interface Slot { pos: string; x: number; y: number }
const s = (pos: string, x: number, y: number): Slot => ({ pos, x, y });
const GK = s("TW", 34, 98);
const D4 = [s("LV", 10, 80), s("IV", 26, 83), s("IV", 42, 83), s("RV", 58, 80)];
const D3 = [s("IV", 18, 82), s("IV", 34, 84), s("IV", 50, 82)];
const D5 = [s("LV", 6, 74), s("IV", 20, 82), s("IV", 34, 84), s("IV", 48, 82), s("RV", 62, 74)];
/** Feldspieler je Spielform (11er, 9er D-Jugend, 7er E-Jugend, 5er F-Jugend); der Torwart kommt dazu */
export const FORMATIONS: Record<MpFmt, Record<string, Slot[]>> = {
  11: {
    "4-2-3-1": [...D4, s("DM", 25, 67), s("DM", 43, 67), s("LA", 11, 46), s("OM", 34, 49), s("RA", 57, 46), s("ST", 34, 30)],
    "4-4-2": [...D4, s("LM", 10, 58), s("ZM", 26, 62), s("ZM", 42, 62), s("RM", 58, 58), s("ST", 26, 34), s("ST", 42, 34)],
    "4-3-3": [...D4, s("DM", 34, 69), s("ZM", 21, 58), s("ZM", 47, 58), s("LA", 12, 37), s("ST", 34, 30), s("RA", 56, 37)],
    "4-1-4-1": [...D4, s("DM", 34, 70), s("LM", 10, 54), s("ZM", 26, 57), s("ZM", 42, 57), s("RM", 58, 54), s("ST", 34, 31)],
    "4-1-2-1-2": [...D4, s("DM", 34, 70), s("ZM", 20, 60), s("ZM", 48, 60), s("OM", 34, 49), s("ST", 26, 32), s("ST", 42, 32)],
    "3-5-2": [...D3, s("LM", 8, 58), s("DM", 26, 66), s("DM", 42, 66), s("RM", 60, 58), s("OM", 34, 50), s("ST", 26, 32), s("ST", 42, 32)],
    "3-4-3": [...D3, s("LM", 8, 60), s("ZM", 26, 64), s("ZM", 42, 64), s("RM", 60, 60), s("LA", 13, 38), s("ST", 34, 31), s("RA", 55, 38)],
    "5-3-2": [...D5, s("ZM", 20, 60), s("DM", 34, 64), s("ZM", 48, 60), s("ST", 26, 34), s("ST", 42, 34)],
    "5-4-1": [...D5, s("LM", 10, 56), s("ZM", 26, 60), s("ZM", 42, 60), s("RM", 58, 56), s("ST", 34, 33)],
  },
  9: {
    "3-3-2": [...D3, s("LM", 12, 60), s("ZM", 34, 62), s("RM", 56, 60), s("ST", 25, 36), s("ST", 43, 36)],
    "3-2-3": [...D3, s("ZM", 24, 64), s("ZM", 44, 64), s("LA", 12, 42), s("ST", 34, 36), s("RA", 56, 42)],
    "3-1-3-1": [...D3, s("DM", 34, 68), s("LM", 12, 54), s("OM", 34, 52), s("RM", 56, 54), s("ST", 34, 34)],
  },
  7: {
    "2-3-1": [s("IV", 22, 80), s("IV", 46, 80), s("LM", 12, 60), s("ZM", 34, 62), s("RM", 56, 60), s("ST", 34, 38)],
    "3-2-1": [s("IV", 14, 78), s("IV", 34, 81), s("IV", 54, 78), s("ZM", 24, 60), s("ZM", 44, 60), s("ST", 34, 38)],
    "3-1-2": [s("IV", 14, 78), s("IV", 34, 81), s("IV", 54, 78), s("ZM", 34, 62), s("ST", 24, 40), s("ST", 44, 40)],
    "2-1-2-1": [s("IV", 22, 80), s("IV", 46, 80), s("DM", 34, 68), s("LM", 14, 54), s("RM", 54, 54), s("ST", 34, 38)],
  },
  5: {
    "1-2-1": [s("IV", 34, 80), s("LM", 14, 62), s("RM", 54, 62), s("ST", 34, 44)],
    "2-2": [s("IV", 22, 78), s("IV", 46, 78), s("ST", 22, 48), s("ST", 46, 48)],
    "2-1-1": [s("IV", 22, 80), s("IV", 46, 80), s("ZM", 34, 62), s("ST", 34, 44)],
  },
};
export const DEFAULT_FORMATION: Record<MpFmt, string> = { 11: "4-2-3-1", 9: "3-3-2", 7: "2-3-1", 5: "1-2-1" };
/** Ersatzbank-Richtwert je Spielform (nur Vorschlag) */
export const BENCH_DEF: Record<MpFmt, number> = { 11: 7, 9: 5, 7: 4, 5: 3 };
/** Spielform nach Altersklasse (DFB-Spielformen: F-Jugend 5er, E-Jugend 7er, D-Jugend 9er) */
export function fmtOf(cls: ClassKey): MpFmt {
  if (["u7", "u8", "u9"].includes(cls)) return 5;
  if (["u10", "u11"].includes(cls)) return 7;
  if (["u12", "u13"].includes(cls)) return 9;
  return 11;
}
export const formationsOf = (fmt: MpFmt): string[] => Object.keys(FORMATIONS[fmt]);
export const validFormation = (fmt: MpFmt, key: string | null | undefined): string => key && FORMATIONS[fmt][key] ? key : DEFAULT_FORMATION[fmt];
/** Positionen einer Grundordnung inkl. Torwart */
export const slotsOf = (fmt: MpFmt, key: string): Slot[] => [GK, ...FORMATIONS[fmt][validFormation(fmt, key)]];
/** Naheliegende Ausweichpositionen (z. B. Rechtsaußen: zuerst rechtes Mittelfeld, dann Linksaußen …) */
export const ALT_POS: Record<string, string[]> = {
  LA: ["LM", "RA", "RM", "OM", "ST"], RA: ["RM", "LA", "LM", "OM", "ST"], LM: ["LA", "RM", "ZM"], RM: ["RA", "LM", "ZM"],
  OM: ["ZM", "LA", "RA"], DM: ["ZM", "IV"], ZM: ["DM", "OM"], LV: ["RV", "IV"], RV: ["LV", "IV"], IV: ["DM", "LV", "RV"], ST: ["OM", "LA", "RA"],
};
/** Positionsgruppe eines Kürzels (TW, Abwehr, Mittelfeld, Sturm) */
export const slotGroup = (pos: string): string => ["LA", "RA", "ST"].includes(pos) ? "Sturm" : posGroup(pos);

let seq = 0;
/** Neue, eindeutige ID für Elemente, Folien und Wechsel */
export const mpId = (prefix: string): string => prefix + Date.now().toString(36) + (seq++).toString(36);

const r1 = (n: number): number => Math.round(n * 10) / 10;
export const clampX = (x: number): number => r1(Math.max(-2, Math.min(PW + 2, Number(x) || 0)));
export const clampY = (y: number): number => r1(Math.max(-3, Math.min(PL + 3, Number(y) || 0)));

/**
 * Grundordnung anwenden: Spieler behalten möglichst ihre Position (gleiches Kürzel, sonst gleiche Gruppe, sonst
 * die nächste freie Position). Wer keinen Platz mehr hat (kleinere Spielform), kommt in `out` (→ Ersatzbank).
 */
export function lineupFor(fmt: MpFmt, key: string, prev: MpItem[] = []): { lineup: MpItem[]; out: string[] } {
  const slots = slotsOf(fmt, key), taken: (string | null)[] = slots.map(() => null), out: string[] = [];
  const placed = prev.filter(x => x.t === "own" && x.pid);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = (it: MpItem, ok: (sl: Slot) => boolean): number => {
    let best = -1, bd = Infinity;
    slots.forEach((sl, i) => { if (taken[i] == null && ok(sl)) { const d = dist(sl, it); if (d < bd) { bd = d; best = i; } } });
    return best;
  };
  let rest = placed;
  const pass = (ok: (sl: Slot, it: MpItem) => boolean) => { const next: MpItem[] = []; for (const it of rest) { const i = pick(it, sl => ok(sl, it)); if (i >= 0) taken[i] = it.pid!; else next.push(it); } rest = next; };
  pass((sl, it) => sl.pos === it.label);
  pass((sl, it) => (ALT_POS[sl.pos] || []).includes(it.label || ""));
  pass((sl, it) => slotGroup(sl.pos) === slotGroup(it.label || ""));
  pass(() => true);
  out.push(...rest.map(it => it.pid!));
  return { lineup: slots.map((sl, i) => ({ id: mpId("l"), t: "own" as const, x: sl.x, y: sl.y, pid: taken[i], label: sl.pos })), out };
}

/** Gegner in seiner Grundordnung (gespiegelt: er spielt nach unten) */
export function oppLineup(fmt: MpFmt, key: string): MpItem[] {
  return slotsOf(fmt, key).map(sl => ({ id: mpId("o"), t: "opp" as const, x: r1(PW - sl.x), y: r1(PL - sl.y), label: sl.pos }));
}

export const emptyIdea = (): MpIdea => ({ motto: "", keys: [], ball: "", gegen: "", umschalt: "" });
export const emptyOpp = (): MpOpp => ({ formation: null, items: [], style: "", strong: "", weak: "", keys: [], plan: "" });
export function emptyContent(cls: ClassKey, fmt: MpFmt = fmtOf(cls)): MpContent {
  const formation = DEFAULT_FORMATION[fmt];
  return { fmt, formation, lineup: lineupFor(fmt, formation).lineup, bench: [], captain: null, slides: [], idea: emptyIdea(), opp: emptyOpp(), tasks: {}, subs: [], subsNote: "", mode: "name", size: 1 };
}
export function newPlan(id: string, match: Match | null, cls: ClassKey, title: string): MatchPlan {
  return { id, matchId: match?.id || null, title: title.slice(0, MP_LIMITS.title), c: emptyContent(cls), share: null, published: null, publishedAt: null, updatedAt: null };
}
/**
 * Neuer Plan auf Basis eines früheren: Aufstellung, Bank, Folien (Taktik und Standards), Spielidee und Aufgaben
 * werden übernommen – Gegneranalyse und Wechselplan sind spielbezogen und starten leer.
 */
export function copyPlan(id: string, prev: MatchPlan, match: Match | null, title: string): MatchPlan {
  const c = JSON.parse(JSON.stringify(prev.c)) as MpContent;
  c.slides = c.slides.map(sl => ({ ...sl, id: mpId("s"), items: sl.items.map(it => ({ ...it, id: mpId("i") })) }));
  c.lineup = c.lineup.map(it => ({ ...it, id: mpId("l") }));
  c.opp = emptyOpp(); c.subs = []; c.subsNote = "";
  return { id, matchId: match?.id || null, title: title.slice(0, MP_LIMITS.title), c, share: null, published: null, publishedAt: null, updatedAt: null };
}

// ---------- Aufstellung ----------
export const onPitch = (c: Pick<MpContent, "lineup">): string[] => c.lineup.filter(x => x.t === "own" && x.pid).map(x => x.pid!);
/** Kader = Startelf + Ersatzbank */
export const squadOf = (c: Pick<MpContent, "lineup" | "bench">): string[] => [...new Set([...onPitch(c), ...c.bench])];
export type MpWhere = { k: "pitch"; id: string } | { k: "bench" } | { k: "out" };
export function whereIs(c: MpContent, pid: string): MpWhere {
  const it = c.lineup.find(x => x.pid === pid); if (it) return { k: "pitch", id: it.id };
  return c.bench.includes(pid) ? { k: "bench" } : { k: "out" };
}
/** Ziel beim Ziehen: Position auf dem Feld, freie Stelle auf dem Feld, Ersatzbank, nicht im Kader */
export type MpDrop = { k: "slot"; id: string } | { k: "free"; x: number; y: number } | { k: "bench" } | { k: "out" };
/** Größter Abstand (m), in dem ein losgelassener Spieler auf einer Position einrastet */
export const SNAP = 7;
/** Nächste Position (eigener Marker) zum Punkt innerhalb von SNAP Metern */
export function nearestSlot(c: MpContent, x: number, y: number, skip?: string): MpItem | null {
  let best: MpItem | null = null, bd = SNAP;
  for (const it of c.lineup) { if (it.id === skip) continue; const d = Math.hypot(it.x - x, it.y - y); if (d < bd) { bd = d; best = it; } }
  return best;
}
/**
 * Spieler setzen (Ziehen oder Antippen): auf eine Position (Besetzte tauschen; wer von der Bank oder von außen kommt,
 * schickt den bisherigen Spieler auf die Bank), frei aufs Feld (eigener Marker wird verschoben bzw. eine freie
 * Position übernommen), auf die Bank oder aus dem Kader. Gibt den neuen Inhalt zurück (unverändert, wenn nichts geht).
 */
export function placePlayer(c: MpContent, pid: string, to: MpDrop): MpContent {
  const from = whereIs(c, pid);
  const lineup = c.lineup.map(x => ({ ...x }));
  let bench = c.bench.filter(x => x !== pid);
  const A = from.k === "pitch" ? lineup.find(x => x.id === from.id)! : null;
  const toBench = (q: string | null | undefined, at = c.bench.indexOf(pid)) => { if (!q || bench.includes(q)) return; if (at >= 0 && at <= bench.length) bench.splice(at, 0, q); else bench.push(q); };
  const done = (): MpContent => ({ ...c, lineup, bench: bench.slice(0, MP_LIMITS.bench), captain: c.captain && squadOf({ lineup, bench }).includes(c.captain) ? c.captain : null });
  if (to.k === "free") {
    const x = clampX(to.x), y = clampY(to.y);
    const hit = nearestSlot(c, x, y, A?.id);
    if (hit) return placePlayer(c, pid, { k: "slot", id: hit.id });
    if (A) { A.x = x; A.y = y; return done(); }
    const free = lineup.filter(z => !z.pid).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (free) { free.pid = pid; free.x = x; free.y = y; return done(); }
    if (lineup.length < c.fmt) { lineup.push({ id: mpId("l"), t: "own", x, y, pid, label: "" }); return done(); }
    return c;
  }
  if (to.k === "slot") {
    const B = lineup.find(x => x.id === to.id); if (!B) return c;
    if (B.pid === pid) return c;
    const q = B.pid || null; B.pid = pid;
    if (A) A.pid = q;
    else toBench(q);
    return done();
  }
  if (A) A.pid = null;
  if (to.k === "bench") { if (from.k === "bench") return c; bench.push(pid); }
  return done();
}
/** Marker auf dem Feld verschieben (Position anpassen, z. B. höher stehender Außenverteidiger) */
export function moveItem<T extends MpItem>(items: T[], id: string, x: number, y: number): T[] {
  return items.map(it => {
    if (it.id !== id) return it;
    const nx = clampX(x), ny = clampY(y);
    return shiftItem(it, nx - it.x, ny - it.y) as T;
  });
}

/**
 * Aufstellungsvorschlag: freie Positionen mit verfügbaren Spielern passender Positionsgruppe besetzen, Rest
 * (bis zum Richtwert) auf die Bank. `rank` ordnet die Kandidaten (kleiner = bevorzugt), z. B. Startelf im letzten Spiel.
 */
export function suggestLineup(c: MpContent, players: Player[], avail: (pid: string) => boolean, rank: (pid: string) => number = () => 0, isGk: (p: Player) => boolean = p => p.pos === "TW"): MpContent {
  const used = new Set(squadOf(c)), lineup = c.lineup.map(x => ({ ...x })), bench = [...c.bench];
  const cand = players.filter(p => avail(p.id) && !used.has(p.id)).sort((a, b) => rank(a.id) - rank(b.id) || (a.nr ?? 99) - (b.nr ?? 99));
  const grpOf = (p: Player): string => isGk(p) ? "TW" : posGroup(p.pos) === "TW" ? "Abwehr" : posGroup(p.pos);
  const take = (ok: (p: Player) => boolean): Player | null => { const i = cand.findIndex(ok); return i >= 0 ? cand.splice(i, 1)[0] : null; };
  // Reihenfolge: genaue Position, Ausweichposition, gleiche Positionsgruppe, sonst jeder Feldspieler
  const fill = (ok: (q: Player, pos: string) => boolean) => { for (const it of lineup) if (!it.pid) { const p = take(q => ok(q, it.label || "")); if (p) it.pid = p.id; } };
  fill((q, pos) => pos === "TW" ? grpOf(q) === "TW" : grpOf(q) !== "TW" && q.pos === pos);
  fill((q, pos) => grpOf(q) !== "TW" && (ALT_POS[pos] || []).includes(q.pos));
  fill((q, pos) => grpOf(q) === slotGroup(pos));
  fill((q, pos) => pos !== "TW" && grpOf(q) !== "TW");
  // Bank: zuerst ein zweiter Torwart, dann nach Rang
  const want = BENCH_DEF[c.fmt];
  if (bench.length < want) { const g = take(q => grpOf(q) === "TW"); if (g) bench.push(g.id); }
  while (bench.length < want && cand.length) bench.push(cand.shift()!.id);
  return { ...c, lineup, bench };
}

// ---------- Wechselplan und Spielminuten ----------
export type SubIssue = "out_not_on" | "in_on" | "in_not_squad" | "late" | "same";
/**
 * Geplante Spielminuten aus Startelf und Wechselplan (Wiedereinwechseln wie im Jugendfußball möglich).
 * Probleme: Auszuwechselnder steht nicht auf dem Feld, Einzuwechselnder steht schon drauf, nicht im Kader, nach Spielende.
 */
export function plannedMinutes(c: MpContent, total: number): { min: Record<string, number>; issues: { id: string; k: SubIssue }[] } {
  const start = new Map<string, number>(), acc: Record<string, number> = {}, issues: { id: string; k: SubIssue }[] = [];
  for (const pid of onPitch(c)) start.set(pid, 0);
  const squad = new Set(squadOf(c));
  for (const sb of [...c.subs].sort((a, b) => a.min - b.min)) {
    if (sb.min > total) issues.push({ id: sb.id, k: "late" });
    const m = Math.max(0, Math.min(total, sb.min));
    if (sb.out && sb.in && sb.out === sb.in) { issues.push({ id: sb.id, k: "same" }); continue; }
    if (sb.out) {
      if (!start.has(sb.out)) issues.push({ id: sb.id, k: "out_not_on" });
      else { acc[sb.out] = (acc[sb.out] || 0) + m - start.get(sb.out)!; start.delete(sb.out); }
    }
    if (sb.in) {
      if (start.has(sb.in)) { issues.push({ id: sb.id, k: "in_on" }); continue; }
      if (!squad.has(sb.in)) issues.push({ id: sb.id, k: "in_not_squad" });
      start.set(sb.in, m);
    }
  }
  for (const [pid, m] of start) acc[pid] = (acc[pid] || 0) + total - m;
  for (const pid of squad) acc[pid] ||= 0;
  return { min: acc, issues };
}
export const newSub = (min: number): MpSub => ({ id: mpId("w"), min, out: null, in: null, note: "" });

// ---------- Folien ----------
/**
 * Neue Folie: eigene Spieler aus der Aufstellung (optional der Gegner aus der Gegneranalyse) und ein Ball.
 * Wer außerhalb des Ausschnitts stünde (z. B. bei Ecken), wird am Rand aufgereiht und kann von dort gezogen werden.
 */
/**
 * Gegner, die (fast) auf einem eigenen Spieler stünden, etwas Richtung gegnerisches Tor setzen (der eigene Spieler
 * steht torseitig) – sonst überdecken sich die Icons.
 */
export function separate(own: MpItem[], opp: MpItem[], gap = 3.4): MpItem[] {
  return opp.map(o => {
    const hit = own.find(x => Math.hypot(x.x - o.x, x.y - o.y) < gap);
    return hit ? { ...o, y: clampY(hit.y - gap) } : o;
  });
}
export function newSlide(c: MpContent, cat: MpSlideCat, title: string, withOpp: boolean, withOwn = true): MpSlide {
  const view = catView(cat), v = MP_VIEWS[view];
  const own = withOwn ? c.lineup.filter(x => x.pid || x.label).map(x => ({ ...x, id: mpId("i") })) : [];
  const opp = separate(own, withOpp ? c.opp.items.map(x => ({ ...x, id: mpId("i") })) : []);
  const ball: MpItem = cat === "ecke_off" ? { id: mpId("i"), t: "ball", x: 67, y: 0 } : cat === "ecke_def" ? { id: mpId("i"), t: "ball", x: 1, y: 105 }
    : cat === "anstoss" ? { id: mpId("i"), t: "ball", x: 34, y: 52.5 } : { id: mpId("i"), t: "ball", x: r1(v.x + v.w / 2), y: r1(v.y + v.h / 2) };
  return { id: mpId("s"), cat, title: title.slice(0, MP_LIMITS.slideTitle), view, items: [...fitToView([...own, ...opp], view), ball], note: "", vis: true };
}
/**
 * Spieler, die außerhalb des Ausschnitts stünden (z. B. bei Ecken), am Rand des Ausschnitts aufreihen – eigene und
 * Gegner je eine Reihe (zur Feldmitte hin). Torhüter bleiben im eigenen Tor, wenn es außerhalb liegt. Linien und Ball
 * bleiben unverändert.
 */
export function fitToView(items: MpItem[], target: MpView | MpFrame): MpItem[] {
  const v = typeof target === "string" ? MP_VIEWS[target] || MP_VIEWS.full : target;
  if (v.w >= FRAME_MAX.w - 0.5 && v.h >= FRAME_MAX.h - 0.5) return items;
  const top = v.y + v.h / 2 > PL / 2;
  const inside = (it: MpItem) => inFrame(v, it.x, it.y, 1);
  const moved = new Map<string, { x: number; y: number }>();
  // Abstand zum Rand (Platz für den Namen unter dem Icon) und zwischen den Reihen – wächst mit dem Ausschnitt
  const edge = Math.max(3.5, Math.min(6, v.h * 0.12)), gap = Math.max(4.5, Math.min(6, v.h * 0.15));
  const park = (L: MpItem[], row: number, keeperHome: boolean) => {
    const out = L.filter(it => !inside(it) && !(keeperHome && it.label === "TW")); if (!out.length) return;
    const y = top ? v.y + edge + row * gap : v.y + v.h - edge - row * gap;
    const step = out.length > 1 ? Math.min(6.5, Math.max(0, v.w - 8) / (out.length - 1)) : 0;
    const x0 = v.x + v.w / 2 - step * (out.length - 1) / 2;
    out.forEach((it, i) => moved.set(it.id, { x: clampX(x0 + i * step), y: clampY(y) }));
  };
  park(items.filter(x => x.t === "own"), 0, !top);
  park(items.filter(x => x.t === "opp"), 1, top);
  return items.map(it => moved.has(it.id) ? { ...it, ...moved.get(it.id)! } : it);
}

// ---------- Freigabe ----------
/** Anstoß als Zeitpunkt (lokale Zeit) */
export function kickoff(m: Pick<Match, "date" | "zeit">): Date {
  const [y, mo, d] = m.date.split("-").map(Number), [h, mi] = (m.zeit || "15:00").split(":").map(Number);
  return new Date(y, mo - 1, d, h || 0, mi || 0);
}
/** Ende der Freigabe: Spielende (Anstoß + Spielzeit + Pause) plus 30 Minuten; ohne Spiel drei Tage */
export function defaultUntil(m: Pick<Match, "date" | "zeit"> | null, matchMin: number, now: Date): string {
  if (!m) return new Date(now.getTime() + 3 * 86400e3).toISOString();
  return new Date(kickoff(m).getTime() + (matchMin + 15 + 30) * 60e3).toISOString();
}
export type ShareState = "draft" | "scheduled" | "live" | "ended";
export function shareState(p: Pick<MatchPlan, "published" | "share">, now: Date): ShareState {
  if (!p.published || !p.share) return "draft";
  if (p.share.from && now < new Date(p.share.from)) return "scheduled";
  return now < new Date(p.share.until) ? "live" : "ended";
}
/** Für Spieler veröffentlichter Stand: nur freigegebene Bereiche und für Spieler sichtbare Folien */
export function publishedOf(c: MpContent, sections: MpSection[]): MpPublished {
  const has = (k: MpSection) => sections.includes(k);
  const P: MpPublished = { sections: MP_SECTIONS.filter(has), fmt: c.fmt, mode: c.mode, size: c.size };
  if (c.look && c.look !== "grass") P.look = c.look;
  if (has("lineup")) { P.formation = c.formation; P.lineup = c.lineup; P.bench = c.bench; P.captain = c.captain; }
  if (has("slides")) P.slides = c.slides.filter(x => x.vis);
  if (has("idea")) P.idea = c.idea;
  if (has("opp")) P.opp = c.opp;
  if (has("tasks")) P.tasks = Object.fromEntries(Object.entries(c.tasks).filter(([, v]) => v.trim()));
  if (has("subs")) { P.subs = c.subs; P.subsNote = c.subsNote; }
  return P;
}
/** JSON mit sortierten Schlüsseln (die Datenbank ordnet Schlüssel um) */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v as object).filter(k => (v as Record<string, unknown>)[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + stableJson((v as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(v ?? null);
}
/** Wurde seit der Freigabe etwas geändert, das Spieler sehen würden? */
export const changedSincePublish = (p: MatchPlan): boolean =>
  !!p.published && !!p.share && stableJson(publishedOf(p.c, p.share.sections)) !== stableJson(p.published);
/** Ansicht eines Spielers: Aufgaben nur die eigene (wenn so freigegeben) */
export function forPlayer(pub: MpPublished, pid: string, ownTasks: boolean): MpPublished {
  if (!ownTasks || !pub.tasks) return pub;
  return { ...pub, tasks: pub.tasks[pid] ? { [pid]: pub.tasks[pid] } : {} };
}
/** Darf der Spieler den Plan jetzt sehen? (wie public.match_plan_open) */
export function visibleTo(p: MatchPlan, pid: string, now: Date): boolean {
  if (shareState(p, now) !== "live") return false;
  return !p.share!.squadOnly || squadOf(p.published?.lineup ? { lineup: p.published.lineup, bench: p.published.bench || [] } : p.c).includes(pid);
}
/** Spieler: jetzt freigegebene Pläne (wie public.my_match_plans) */
export function availFor(plans: MatchPlan[], logs: Record<string, { pid: string; kind: string; at: string }[]>, pid: string, now: Date): MpAvail[] {
  return plans.filter(p => visibleTo(p, pid, now)).sort((a, b) => a.share!.until < b.share!.until ? -1 : 1).map(p => ({
    id: p.id, matchId: p.matchId, title: p.title, until: p.share!.until, at: p.publishedAt || "",
    seen: (logs[p.id] || []).some(l => l.pid === pid && l.kind === "open" && (!p.publishedAt || l.at >= p.publishedAt)),
  }));
}
/** Gesehen / nicht gesehen (Zugriffsprotokoll) für die Empfänger der Freigabe */
export function seenStats(logs: { pid: string; kind: string }[], recipients: string[]): { seen: string[]; open: string[]; shots: number } {
  const seen = new Set(logs.filter(l => l.kind === "open").map(l => l.pid));
  return { seen: recipients.filter(p => seen.has(p)), open: recipients.filter(p => !seen.has(p)), shots: logs.filter(l => l.kind === "shot").length };
}

// ---------- Bereinigen (wie die Prüfungen in der Datenbank) ----------
const str = (v: unknown, max: number): string => String(v ?? "").slice(0, max);
const idOk = (v: unknown): string => /^[A-Za-z0-9_-]{1,40}$/.test(String(v)) ? String(v) : mpId("x");
function cleanItem(v: Partial<MpItem>, only?: MpTool): MpItem | null {
  const t = (only || v.t) as MpTool;
  if (!MP_TOOLS.includes(t) || (only && v.t && v.t !== only)) return null;
  const it: MpItem = { id: idOk(v.id), t, x: clampX(v.x ?? 0), y: clampY(v.y ?? 0) };
  if (isLine(t)) { it.x2 = clampX(v.x2 ?? it.x); it.y2 = clampY(v.y2 ?? it.y); }
  if (t === "own") it.pid = v.pid ? String(v.pid).slice(0, 40) : null;
  if (t === "opp" || t === "own") { const n = v.n == null ? null : Math.round(Number(v.n)); if (n != null && n >= 0 && n <= 99) it.n = n; }
  // Schritt eines Ablaufs (1, 2, 3 …) an Pfeilen und Freihandlinien
  if (isArrow(t) || t === "free") { const n = v.n == null ? null : Math.round(Number(v.n)); if (n != null && n >= 1 && n <= 20) it.n = n; }
  if (t === "free") {
    const P = Array.isArray(v.pts) ? v.pts.map(Number) : [], pts: number[] = [];
    // paarweise (x, y); ungültige Paare fallen weg
    for (let i = 0; i + 1 < P.length && pts.length < FREE_MAX * 2; i += 2) if (isFinite(P[i]) && isFinite(P[i + 1])) pts.push(clampX(P[i]), clampY(P[i + 1]));
    if (pts.length < 4) return null;
    it.pts = pts; it.x = pts[0]; it.y = pts[1]; it.x2 = pts[pts.length - 2]; it.y2 = pts[pts.length - 1];
    if (v.solid) it.solid = true;
  }
  if (v.label) it.label = str(v.label, t === "text" ? 40 : 4);
  if (v.col && MP_COLORS.includes(v.col)) it.col = v.col;
  if (isArrow(t)) { const b = Math.round((Number(v.bend) || 0) * 10) / 10; if (b) it.bend = Math.max(-3, Math.min(3, b)); }
  return it;
}
/** Ausschnitt aus gespeicherten Daten (ungültig → null) */
function cleanFrame(v: unknown): MpFrame | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Partial<MpFrame>, n = [f.x, f.y, f.w, f.h].map(Number);
  return n.every(isFinite) && n[2] > 0 && n[3] > 0 ? clampFrame({ x: n[0], y: n[1], w: n[2], h: n[3] }) : null;
}
function cleanSlide(sl: Partial<MpSlide>): MpSlide {
  const out: MpSlide = {
    id: idOk(sl.id), cat: SLIDE_CATS.includes(sl.cat as MpSlideCat) ? sl.cat as MpSlideCat : "sonst", title: str(sl.title, MP_LIMITS.slideTitle),
    view: MP_VIEW_KEYS.includes(sl.view as MpView) ? sl.view as MpView : "full", items: limitFree(items(sl.items, MP_LIMITS.items)), note: str(sl.note, MP_LIMITS.text), vis: sl.vis !== false,
  };
  const f = cleanFrame(sl.frame);
  if (f) { const p = presetOf(f); if (p) out.view = p; else out.frame = f; }
  const sz = Number(sl.size);
  if (sl.size != null && sz > 0) out.size = Math.max(0.6, Math.min(1.8, Math.round(sz * 10) / 10));
  if (sl.mode && MP_MODES.includes(sl.mode)) out.mode = sl.mode;
  return out;
}
/** höchstens MP_LIMITS.free Freihandlinien je Folie */
const limitFree = (L: MpItem[]): MpItem[] => { let n = 0; return L.filter(x => x.t !== "free" || ++n <= MP_LIMITS.free); };
const items = (L: unknown, max: number, only?: MpTool): MpItem[] => (Array.isArray(L) ? L : []).slice(0, max).map(x => cleanItem(x || {}, only)).filter((x): x is MpItem => !!x);
export function cleanContent(v: Partial<MpContent>, cls: ClassKey): MpContent {
  const fmt: MpFmt = FMTS.includes(v.fmt as MpFmt) ? v.fmt as MpFmt : fmtOf(cls);
  const lineup = items(v.lineup, fmt, "own");
  const seen = new Set<string>();
  for (const it of lineup) { if (it.pid && seen.has(it.pid)) it.pid = null; else if (it.pid) seen.add(it.pid); }
  const bench = [...new Set((Array.isArray(v.bench) ? v.bench : []).map(x => String(x).slice(0, 40)))].filter(x => !seen.has(x)).slice(0, MP_LIMITS.bench);
  const squad = new Set([...seen, ...bench]);
  const idea = v.idea || emptyIdea(), opp = v.opp || emptyOpp();
  return {
    fmt, formation: validFormation(fmt, v.formation), lineup, bench,
    captain: v.captain && squad.has(v.captain) ? v.captain : null,
    slides: (Array.isArray(v.slides) ? v.slides : []).slice(0, MP_LIMITS.slides).map((sl: Partial<MpSlide>) => cleanSlide(sl || {})),
    idea: { motto: str(idea.motto, 120), keys: (Array.isArray(idea.keys) ? idea.keys : []).map(k => str(k, 120).trim()).filter(Boolean).slice(0, MP_LIMITS.keys),
      ball: str(idea.ball, MP_LIMITS.text), gegen: str(idea.gegen, MP_LIMITS.text), umschalt: str(idea.umschalt, MP_LIMITS.text) },
    opp: { formation: opp.formation && FORMATIONS[fmt][opp.formation] ? opp.formation : null, items: items(opp.items, fmt, "opp"),
      style: str(opp.style, MP_LIMITS.text), strong: str(opp.strong, MP_LIMITS.text), weak: str(opp.weak, MP_LIMITS.text), plan: str(opp.plan, MP_LIMITS.text),
      keys: (Array.isArray(opp.keys) ? opp.keys : []).slice(0, MP_LIMITS.oppKeys).map(k => ({ n: k?.n == null || !(Number(k.n) >= 0 && Number(k.n) <= 99) ? null : Math.round(Number(k.n)), name: str(k?.name, 40), note: str(k?.note, 200) })) },
    tasks: Object.fromEntries(Object.entries(v.tasks || {}).map(([k, x]) => [String(k).slice(0, 40), str(x, MP_LIMITS.task).trim()] as const).filter(([, x]) => x).slice(0, MP_LIMITS.tasks)),
    subs: (Array.isArray(v.subs) ? v.subs : []).slice(0, MP_LIMITS.subs).map((sb: Partial<MpSub>) => ({
      id: idOk(sb.id), min: Math.max(0, Math.min(150, Math.round(Number(sb.min) || 0))), out: sb.out ? String(sb.out).slice(0, 40) : null, in: sb.in ? String(sb.in).slice(0, 40) : null, note: str(sb.note, 120),
    })),
    subsNote: str(v.subsNote, 600),
    mode: MP_MODES.includes(v.mode as MpMode) ? v.mode as MpMode : "name",
    size: Math.max(0.7, Math.min(1.6, Math.round((Number(v.size) || 1) * 10) / 10)),
    // Rasen ist der Standard und wird nicht gespeichert (ältere Freigaben bleiben unverändert)
    ...(v.look && v.look !== "grass" && MP_LOOKS.includes(v.look) ? { look: v.look } : {}),
  };
}
/** Folie (z. B. aus einem anderen Matchplan) mit neuen IDs kopieren */
export function copySlide(sl: MpSlide, title?: string): MpSlide {
  return { ...JSON.parse(JSON.stringify(sl)) as MpSlide, id: mpId("s"), ...(title != null ? { title: title.slice(0, MP_LIMITS.slideTitle) } : {}), items: sl.items.map(x => ({ ...x, id: mpId("i") })) };
}
export const cleanShare = (x: MpShare): MpShare => ({
  sections: MP_SECTIONS.filter(k => x.sections.includes(k)), from: x.from || null, until: x.until, squadOnly: !!x.squadOnly, ownTasks: x.ownTasks !== false,
});
