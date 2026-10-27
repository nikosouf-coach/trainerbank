// Matchplan und Übungsskizzen: Taktiktafel – Spielfeld mit Bedienung und Zustand der Werkzeuge.
// Werkzeuge in zwei Ebenen (Leiste: tools.tsx): erst die Art (Auswahl, Spieler, Pfeile, Linien, Formen, Material,
// Text), dann ihre Optionen (Linie durchgezogen/gestrichelt/gepunktet/Welle, Verlauf automatisch/frei, Stärke,
// Farbe, Füllung). Pfeile und Linien („automatisch“) malt man mit dem Finger; beim Loslassen werden sie gerade oder ein
// gleichmäßiger Bogen (strokeBend). Gezeichnete Elemente bleiben nicht ausgewählt – so gelten Optionen immer für das nächste Element;
// Antippen eines Elements wählt es aus (Griffe für Start, Ziel, Bogen, Ecken, Radius). Mit Spieler-, Material- und
// Textwerkzeug wird ein vorhandenes Element (statt ein neues darauf) verschoben. Pfeile rasten an Spielern ein.
// Gezogen wird lokal (flüssig), übernommen beim Loslassen – ein Schritt im Verlauf je Bewegung. Radierer: antippen oder
// darüberwischen. Im Ausschnitt-Modus verschiebt Ziehen den Ausschnitt, zwei Finger zoomen.
// Touch: im Vollbild scrollt nichts; auf einer scrollbaren Seite (hold) scrollt Wischen über freie Fläche die Seite,
// Ziehen beginnt nur auf einem Element (App: nach kurzem Halten).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path, Polyline, Rect } from "react-native-svg";
import { MP_LIMITS, bendCtrl, bendThrough, clampX, clampY, dashOf, frameOf, isArea, isArrow, isLine, isMaterial, linePoint, mpId, panFrame, shiftItem, strokeBend, textScale, thinPoints, withFrame, zoomFrame } from "../../core/matchplan";
import type { MpColor, MpContent, MpDash, MpFrame, MpItem, MpSlide, MpTool } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Btn, Col, Field, useScrollLock } from "../kit";
import { radius, useTheme } from "../theme";
import { useTouchSurface } from "../touch";
import { useTokenInfo } from "./common";
import { NEU_COL, OPP_COL, Pitch, decoScale, geom, materialR, tokenPx, usePitchWidth } from "./pitch";

// ---------- Werkzeuge: Arten und Optionen ----------
/** Wirksames Werkzeug auf der Tafel */
export type Tool = "move" | MpTool | "del";
/** Erste Ebene: Art */
export type Cat = "select" | "players" | "arrows" | "lines" | "shapes" | "material" | "text";
export const CATS: Cat[] = ["select", "players", "arrows", "lines", "shapes", "material", "text"];
/** Linie: durchgezogen, gestrichelt, gepunktet, Welle (nur Pfeile, gerade/gebogen: Dribbling) */
export type Dash = "solid" | "dash" | "dot" | "wave";
/** Verlauf: automatisch (gemalter Strich wird gerade oder ein gleichmäßiger Bogen) bzw. frei gemalt (Strich bleibt) */
export type PathKind = "auto" | "free";
export type Width = 1 | 2 | 3;
export interface LineStyle { path: PathKind; dash: Dash; w: Width; col: MpColor | null }
export interface ShapeStyle { dash: Exclude<Dash, "wave">; w: Width; fill: boolean; col: MpColor | null }
/** Zustand der Werkzeugleiste: gewählte Art und je Art die Optionen (bleiben beim Wechsel erhalten) */
export interface Tools {
  cat: Cat; selMode: "move" | "del"; player: "own" | "opp" | "neu"; mat: MpTool; shape: "zone" | "circle";
  arrows: LineStyle; lines: LineStyle; shapes: ShapeStyle; textCol: MpColor | null; textW: Width;
}
export const MATERIAL_TOOLS: MpTool[] = ["ball", "cone", "goal", "mgoal", "pole", "dummy", "ladder", "hurdle", "ring"];
export const DEF_TOOLS: Tools = {
  cat: "select", selMode: "move", player: "own", mat: "cone", shape: "zone",
  arrows: { path: "auto", dash: "solid", w: 2, col: null }, lines: { path: "auto", dash: "solid", w: 2, col: null },
  shapes: { dash: "dash", w: 2, fill: true, col: null }, textCol: null, textW: 2,
};
/** Bogen der Schnellwahl „Bogen links/rechts“ beim ausgewählten Pfeil */
export const CURVE = 1.5;

/** Element an einem Punkt (Spieler, Ball, Hütchen, Material) */
const pointTool = (t: MpTool): boolean => t === "own" || t === "opp" || t === "neu" || t === "ball" || t === "cone" || isMaterial(t);
/** Elemente mit Schrittnummer (Ablauf 1, 2, 3 …) */
export const stepped = (t: MpTool): boolean => isArrow(t) || t === "free";
/** Standardfarbe einer Art (Laufwege und Flächen gelb) */
export const defCol = (t: MpTool): MpColor => t === "run" || isArea(t) ? "y" : "w";
/** Linienstil der Oberfläche → gespeicherter Stil */
const lsOf = (d: Dash): MpDash => d === "dash" ? "short" : d === "dot" ? "dot" : "solid";
/** Pfeil nach Linie: durchgezogen = Pass, Welle = Dribbling, sonst Laufweg */
export const arrowKind = (d: Dash): MpTool => d === "wave" ? "drib" : d === "solid" ? "pass" : "run";

/** Wirksames Werkzeug der gewählten Art */
export function toolOf(ts: Tools): Tool {
  switch (ts.cat) {
    case "select": return ts.selMode;
    case "players": return ts.player;
    case "arrows": return ts.arrows.path === "free" ? "free" : arrowKind(ts.arrows.dash);
    case "lines": return ts.lines.path === "free" ? "free" : "line";
    case "shapes": return ts.shape;
    case "material": return ts.mat;
    default: return "text";
  }
}
/** Art eines Elements (für die Optionen beim Auswählen) */
export const catOf = (it: Pick<MpItem, "t" | "nh">): Cat => it.t === "own" || it.t === "opp" || it.t === "neu" ? "players" : it.t === "text" ? "text"
  : isArea(it.t) ? "shapes" : it.t === "line" || (it.t === "free" && it.nh) ? "lines" : isLine(it.t) || it.t === "free" ? "arrows" : "material";

/** Stil für ein neues Element (Standardwerte werden nicht gespeichert) */
export function styleProps(ts: Tools, t: MpTool): Partial<MpItem> {
  if (t === "text") return ts.textW !== 2 ? { col: ts.textCol || "w", w: ts.textW } : { col: ts.textCol || "w" };
  if (isArea(t)) {
    const s = ts.shapes, o: Partial<MpItem> = { col: s.col || defCol(t) }, ls = lsOf(s.dash);
    if (ls !== dashOf({ t })) o.ls = ls;
    if (s.w !== 2) o.w = s.w;
    if (!s.fill) o.nf = true;
    return o;
  }
  if (!isLine(t) && t !== "free") return {};
  const lines = ts.cat === "lines", s = lines ? ts.lines : ts.arrows, o: Partial<MpItem> = { col: s.col || defCol(t) };
  if (t !== "drib") { const ls = lsOf(s.dash); if (ls !== dashOf({ t })) o.ls = ls; }
  if (s.w !== 2) o.w = s.w;
  if (t === "free" && lines) o.nh = true;
  return o;
}
/** Optionen, die ein Element zeigt (für die Leiste beim Auswählen) */
export function styleOfItem(it: MpItem): { dash: Dash; w: Width; col: MpColor; fill: boolean } {
  const ls = dashOf(it);
  return { dash: it.t === "drib" ? "wave" : ls === "solid" ? "solid" : ls === "dot" ? "dot" : "dash", w: it.w || 2, col: it.col || defCol(it.t), fill: !it.nf };
}
/** Stil eines Elements ändern (Linie, Stärke, Farbe, Füllung, Bogen, Spitze) */
export function restyle(it: MpItem, ch: { dash?: Dash; w?: Width; col?: MpColor; fill?: boolean; bend?: number; head?: boolean }): MpItem {
  const n: MpItem = { ...it };
  if (ch.dash) {
    // Pfeile wechseln dabei die Art (Pass, Laufweg, Dribbling); die sichtbare Farbe bleibt
    if (it.t === "pass" || it.t === "run" || it.t === "drib") { const t = arrowKind(ch.dash); if (t !== it.t) { n.t = t; n.col = it.col || defCol(it.t); } }
    delete n.ls; delete n.solid;
    if (n.t !== "drib") { const ls = lsOf(ch.dash); if (ls !== dashOf({ t: n.t })) n.ls = ls; }
  }
  if (ch.w) { delete n.w; if (ch.w !== 2) n.w = ch.w; }
  if (ch.col) n.col = ch.col;
  if (ch.fill != null && isArea(it.t)) { delete n.nf; if (!ch.fill) n.nf = true; }
  if (ch.bend != null && isArrow(it.t)) { delete n.bend; if (ch.bend) n.bend = ch.bend; }
  if (ch.head != null && it.t === "free") { delete n.nh; if (!ch.head) n.nh = true; }
  return n;
}

type Pt = { x: number; y: number };
const headPts = (x1: number, y1: number, x2: number, y2: number, L = 6.4, a = 0.5): string => {
  const g = Math.atan2(y2 - y1, x2 - x1);
  return `${x2},${y2} ${x2 - L * Math.cos(g - a)},${y2 - L * Math.sin(g - a)} ${x2 - L * Math.cos(g + a)},${y2 - L * Math.sin(g + a)}`;
};
/** Welle für das Dribbling-Symbol */
const zig = (() => {
  const a = { x: 3.6, y: 20.4 }, b = { x: 15.4, y: 8.6 }, n = 4, dx = (b.x - a.x) / n, dy = (b.y - a.y) / n;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 0; i < n; i++) { const o = i % 2 ? -2.7 : 2.7; d += ` Q ${a.x + dx * (i + 0.5) + o * 0.707} ${a.y + dy * (i + 0.5) + o * 0.707} ${a.x + dx * (i + 1)} ${a.y + dy * (i + 1)}`; }
  return d;
})();

/** Symbol eines Werkzeugs bzw. einer Elementart (24 × 24); head: Freihand mit Spitze */
export function ToolIcon({ k, size = 24, color, accent, head = true }: { k: Tool; size?: number; color: string; accent: string; head?: boolean }) {
  const st = { stroke: color, strokeWidth: 2.1, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode = null;
  if (k === "move") body = <Path d="M6.5 3.5 V18.6 L10.3 14.9 L12.9 20.6 L15.4 19.5 L12.8 13.9 H18.2 Z" fill={color} stroke={color} strokeWidth={1.1} strokeLinejoin="round" />;
  else if (k === "own") body = <Circle cx={12} cy={12} r={7.6} fill={accent} stroke="#ffffff" strokeWidth={2} />;
  else if (k === "opp") body = <Circle cx={12} cy={12} r={7.6} fill={OPP_COL} stroke="#ffffff" strokeWidth={2} />;
  else if (k === "ball") body = <><Circle cx={12} cy={12} r={7.6} fill="#ffffff" stroke={color} strokeWidth={1.6} /><Path d="M12 8.7 L15.1 10.9 L13.9 14.6 L10.1 14.6 L8.9 10.9 Z" fill={color} /></>;
  else if (k === "cone") body = <Path d="M12 3.8 L19.4 19 H4.6 Z" fill="#ff922b" stroke="#ffffff" strokeWidth={1.3} strokeLinejoin="round" />;
  else if (k === "text") body = <Path d="M5.5 6 H18.5 M12 6 V19 M9.2 19 H14.8" {...st} strokeWidth={2.4} />;
  else if (k === "del") body = <><Path d="M8.5 19.5H20" {...st} /><Path d="M4.6 14.6l9.2-9.2a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8L12 17.6a4.8 4.8 0 0 1-6.8 0l-.6-.6a1.7 1.7 0 0 1 0-2.4z" {...st} /><Path d="M9.4 9.8l4.8 4.8" {...st} /></>;
  else if (k === "pass" || k === "run") body = <><Path d="M4 20 L15.6 8.4" {...st} strokeWidth={2.3} strokeDasharray={k === "run" ? "3.2 2.6" : undefined} strokeLinecap={k === "run" ? "butt" : "round"} /><Polyline points={headPts(4, 20, 19.8, 4.2)} fill={color} /></>;
  else if (k === "drib") body = <><Path d={zig} {...st} strokeWidth={2} /><Polyline points={headPts(12, 12, 19.8, 4.2)} fill={color} /></>;
  else if (k === "line") body = <Path d="M3.5 18 L20.5 6" {...st} strokeWidth={3.2} />;
  else if (k === "free") body = head ? <><Path d="M3.5 18.5 C 6.5 9, 10 22.5, 12.6 13.4 C 13.8 9.3, 15.4 8, 16.6 7.4" {...st} strokeWidth={2.1} /><Polyline points={headPts(13.2, 9.6, 20.2, 5.2)} fill={color} /></>
    : <Path d="M3.5 18.5 C 6.5 9, 10 22.5, 12.6 13.4 C 13.8 9.3, 16.4 6.5, 20.5 5.5" {...st} strokeWidth={2.4} />;
  else if (k === "zone") body = <Rect x={3.8} y={6} width={16.4} height={12} rx={1.6} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.8} strokeDasharray="2.8 2" />;
  else if (k === "circle") body = <Circle cx={12} cy={12} r={8.2} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.8} strokeDasharray="2.8 2" />;
  else if (k === "neu") body = <Circle cx={12} cy={12} r={7.6} fill={NEU_COL} stroke="#ffffff" strokeWidth={2} />;
  else if (k === "goal") body = <><Path d="M3.5 17 V8 H20.5 V17" {...st} strokeWidth={2.2} /><Path d="M7.7 8V17M12 8V17M16.3 8V17" {...st} strokeWidth={1} /><Path d="M2.5 17 H21.5" {...st} strokeWidth={2.4} /></>;
  else if (k === "mgoal") body = <><Path d="M7 16 V10.5 H17 V16" {...st} strokeWidth={2.2} /><Path d="M12 10.5V16" {...st} strokeWidth={1} /><Path d="M6 16 H18" {...st} strokeWidth={2.4} /></>;
  else if (k === "pole") body = <><Circle cx={12} cy={12} r={5.4} fill="#ffd43b" stroke={color} strokeWidth={1.4} /><Circle cx={12} cy={12} r={1.8} fill={color} /></>;
  else if (k === "dummy") body = <><Rect x={4} y={9} width={16} height={6.4} rx={3.2} fill="#339af0" stroke="#ffffff" strokeWidth={1.2} /><Circle cx={12} cy={12.2} r={2.3} fill="#ffffff" /></>;
  else if (k === "ladder") body = <><Path d="M3 8.5 H21 M3 15.5 H21" stroke="#e8a400" strokeWidth={1.8} strokeLinecap="round" /><Path d="M5 8.5V15.5M9 8.5V15.5M13 8.5V15.5M17 8.5V15.5M21 8.5V15.5" stroke="#e8a400" strokeWidth={1.4} /></>;
  else if (k === "hurdle") body = <><Path d="M5 12 H19" stroke="#fa5252" strokeWidth={2.6} strokeLinecap="round" /><Path d="M5 8.5V15.5M19 8.5V15.5" {...st} strokeWidth={1.8} /></>;
  else if (k === "ring") body = <Circle cx={12} cy={12} r={7} fill="none" stroke="#20c997" strokeWidth={2.4} />;
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}

/** Stand für Rückgängig/Wiederholen */
type Snap = Pick<MpSlide, "items" | "view" | "frame">;
const snapOf = (s: MpSlide): Snap => ({ items: s.items, view: s.view, frame: s.frame ?? null });

/** Verlauf, Werkzeuge (Art und Optionen), Auswahl und Ausschnitt-Modus einer Tafel */
export function useBoard(slide: MpSlide, onChange: (s: MpSlide) => void) {
  const undo = useRef<Snap[]>([]), redo = useRef<Snap[]>([]);
  const [ts, setTs] = useState<Tools>(DEF_TOOLS);
  const [framing, setFramingRaw] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [, bump] = useState(0);
  const cur = useRef(slide); cur.current = slide;
  /** Änderung übernehmen; record = im Verlauf merken */
  const commit = (next: MpSlide, record = true) => {
    if (record) { undo.current.push(snapOf(cur.current)); if (undo.current.length > 80) undo.current.shift(); redo.current = []; bump(x => x + 1); }
    onChange(next);
  };
  const step = (from: { current: Snap[] }, to: { current: Snap[] }) => {
    const s = from.current.pop(); if (!s) return;
    to.current.push(snapOf(cur.current));
    onChange({ ...cur.current, ...s }); bump(x => x + 1);
  };
  return {
    tools: ts, tool: toolOf(ts), framing, sel, setSel, commit,
    /** Art wählen (Auswahl aufheben, Ausschnitt beenden) */
    setCat: (k: Cat) => { setTs(x => ({ ...x, cat: k })); setSel(null); setFramingRaw(false); },
    /** Optionen ändern (gelten für die nächsten Elemente) */
    setTools: (p: Partial<Tools>) => setTs(x => ({ ...x, ...p })),
    /** Auswählen bzw. Radierer */
    setTool: (k: "move" | "del") => { setTs(x => ({ ...x, cat: "select", selMode: k })); if (k !== "move") setSel(null); },
    /** Stil für ein neues Element dieser Art */
    newProps: (t: MpTool) => styleProps(ts, t),
    setFraming: (on: boolean) => { setFramingRaw(on); if (on) setSel(null); },
    canUndo: undo.current.length > 0, canRedo: redo.current.length > 0,
    undo: () => step(undo, redo), redo: () => step(redo, undo),
    /** neue Folie: Verlauf und Auswahl leeren */
    reset: () => { undo.current = []; redo.current = []; setSel(null); bump(x => x + 1); },
  };
}
export type BoardState = ReturnType<typeof useBoard>;

type Handle = "p1" | "p2" | "bend" | "c3" | "c4" | "r";
type Act =
  | { k: "move"; id: string; p0: Pt; it0: MpItem; isNew: boolean; wasSel: boolean; sel: boolean }
  | { k: "handle"; id: string; h: Handle; it0: MpItem }
  | { k: "new"; it: MpItem; p0: Pt }
  | { k: "free"; it: MpItem; pts: Pt[]; p0: Pt }
  /** Pfeil oder Linie mit dem Finger malen (beim Loslassen gerade oder gleichmäßiger Bogen) */
  | { k: "stroke"; it: MpItem; pts: Pt[]; p0: Pt }
  | { k: "erase"; ids: Set<string>; p0: Pt; last: Pt; tap: string | null }
  | { k: "tap"; p0: Pt };
/** hold: Ziehen erst nach kurzem Halten oder waagerecht (Tafel auf einer scrollbaren Seite, Finger) */
type Cur = { act: Act; x0: number; y0: number; moved: boolean; armed: boolean; hold: boolean; timer: ReturnType<typeof setTimeout> | null };
type Gesture = { kind: "pan"; x0: number; y0: number; f0: MpFrame; moved: boolean } | { kind: "pinch"; d0: number; mx0: number; my0: number; m0: Pt; f0: MpFrame; moved: boolean };
type Touch = { pageX: number; pageY: number };

/** Griffe eines ausgewählten Elements */
function handlesOf(it: MpItem): { h: Handle; p: Pt }[] {
  const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y;
  if (isArrow(it.t)) return [{ h: "p1", p: { x: it.x, y: it.y } }, { h: "p2", p: { x: x2, y: y2 } }, { h: "bend", p: linePoint(it, 0.5) }];
  if (it.t === "zone") return [{ h: "p1", p: { x: it.x, y: it.y } }, { h: "p2", p: { x: x2, y: y2 } }, { h: "c3", p: { x: x2, y: it.y } }, { h: "c4", p: { x: it.x, y: y2 } }];
  if (it.t === "circle") return [{ h: "r", p: { x: x2, y: y2 } }];
  return [];
}
/** Element an einem Griff ziehen */
function dragHandle(it0: MpItem, h: Handle, p: Pt): MpItem {
  if (h === "p1") return { ...it0, x: p.x, y: p.y };
  if (h === "p2" || h === "r") return { ...it0, x2: p.x, y2: p.y };
  if (h === "c3") return { ...it0, x2: p.x, y: p.y };
  if (h === "c4") return { ...it0, x: p.x, y2: p.y };
  const b = bendThrough(it0, p), n = { ...it0 }; delete n.bend;
  return b ? { ...n, bend: b } : n;
}
const distSeg = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const distPoly = (p: Pt, P: Pt[]): number => { let m = Infinity; for (let i = 1; i < P.length; i++) m = Math.min(m, distSeg(p, P[i - 1], P[i])); return P.length === 1 ? Math.hypot(p.x - P[0].x, p.y - P[0].y) : m; };
const ptsOf = (it: MpItem): Pt[] => {
  if (it.t === "free" && it.pts) { const L: Pt[] = []; for (let i = 0; i + 1 < it.pts.length; i += 2) L.push({ x: it.pts[i], y: it.pts[i + 1] }); return L; }
  return Array.from({ length: 21 }, (_, i) => linePoint(it, i / 20));
};
/** Länge eines Weges */
const pathLen = (P: Pt[]): number => P.reduce((s, p, i) => i ? s + Math.hypot(p.x - P[i - 1].x, p.y - P[i - 1].y) : 0, 0);
/** Passt ein weiteres Element dieser Art auf die Folie? Sonst der Hinweis (Schlüssel und Zahl) */
export function addBlock(slide: MpSlide, t: MpTool): { k: string; n: number } | null {
  if (slide.items.length >= MP_LIMITS.items) return { k: "mp_itemsFull", n: MP_LIMITS.items };
  if (t === "free" && slide.items.filter(x => x.t === "free").length >= MP_LIMITS.free) return { k: "mp_freeFull", n: MP_LIMITS.free };
  return null;
}
/** Kopie eines Elements (versetzt); by = wer kopiert hat */
export function dupItem(it: MpItem, by?: string | null): MpItem {
  const c = shiftItem({ ...it, id: mpId("i") }, 3, 3); if (it.t === "own") delete c.pid;
  if (by) c.by = by; else delete c.by;
  return c;
}

/**
 * Spielfeld einer Folie mit Bedienung (ohne Werkzeugleiste). maxH/maxW begrenzen die Größe; der Ausschnitt füllt die
 * verfügbare Breite. onEdit: ausgewähltes Element erneut antippen (Formular), onText: Stelle für einen neuen Text.
 * hold: Tafel liegt auf einer scrollbaren Seite (Wischen über freie Fläche scrollt; App: Ziehen nach kurzem Halten).
 */
export function BoardCanvas({ slide, c, B, ro, testID = "mp-board", maxH, maxW = 560, onEdit, onText, hold, sketch, plain }: {
  slide: MpSlide; c: Pick<MpContent, "mode" | "size" | "captain" | "look">; B: BoardState; ro?: boolean; testID?: string; maxH?: number; maxW?: number;
  onEdit?: (it: MpItem) => void; onText?: (p: Pt) => void; hold?: boolean;
  /** Übungsskizze (eigene Spieler ohne Zuordnung ausgefüllt) bzw. ohne Feldlinien */
  sketch?: boolean; plain?: boolean;
}) {
  const { c: col } = useTheme(); const info = useTokenInfo(); const lock = useScrollLock(); const st = useStore();
  const [W, setW] = useState(0);
  const [live, setLive] = useState<MpItem | null>(null);
  const [gone, setGone] = useState<Set<string> | null>(null);
  const [liveFrame, setLiveFrame] = useState<MpFrame | null>(null);
  const f = liveFrame || frameOf(slide);
  const pw = usePitchWidth(f, W, maxH, maxW), g = geom(f, pw), ox = Math.max(0, (W - pw) / 2), size = slide.size || c.size, d = tokenPx(pw, size, f), s = decoScale(g.k);
  const cur = useRef<Cur | null>(null), gest = useRef<Gesture | null>(null), off = useRef({ x: 0, y: 0 });
  const tool = B.tool;
  const items = useMemo(() => {
    const L = gone ? slide.items.filter(x => !gone.has(x.id)) : slide.items;
    return !live ? L : L.some(x => x.id === live.id) ? L.map(x => x.id === live.id ? live : x) : [...L, live];
  }, [slide.items, live, gone]);
  useEffect(() => () => { if (cur.current?.timer) clearTimeout(cur.current.timer); }, []);
  // Browser: im Vollbild nie scrollen; auf einer Seite nur blockieren, solange ein Element gezogen wird
  const surf = useTouchSurface(!hold, () => (!!cur.current && cur.current.armed && cur.current.act.k !== "tap") || !!gest.current);

  const toM = (lx: number, ly: number): Pt => { const m = g.m(lx - ox, ly); return { x: clampX(m.x), y: clampY(m.y) }; };
  const inside = (e: GestureResponderEvent) => { const x = e.nativeEvent.locationX - ox, y = e.nativeEvent.locationY; return x >= 0 && x <= pw && y >= 0 && y <= g.h; };
  // ---------- Treffer ----------
  const tol = Math.max(1.5, 13 / g.k);
  const tokR = (it: MpItem): number => it.t === "own" ? (sketch && !it.pid ? d * 0.41 : d / 2) / g.k : it.t === "opp" || it.t === "neu" ? (d * 0.41) / g.k
    : it.t === "ball" ? 1.1 * s : it.t === "cone" ? 1.4 * s : isMaterial(it.t) ? materialR(it.t, d / g.k) : 0;
  /** Abstand zum Element im Verhältnis zur Trefferweite (< 1 = getroffen); Flächen nachrangig */
  const near = (it: MpItem, p: Pt): number => {
    if (pointTool(it.t)) return Math.hypot(it.x - p.x, it.y - p.y) / (tokR(it) + 6 / g.k);
    if (it.t === "text") { const z = textScale(it) * s, hw = Math.max(2.6, (it.label || "").length * 1.05 * z), hh = 2.4 * z + 4 / g.k; return Math.max(Math.abs(p.x - it.x) / hw, Math.abs(p.y - it.y) / hh); }
    const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y;
    if (it.t === "zone") {
      const inX = p.x >= Math.min(it.x, x2) && p.x <= Math.max(it.x, x2), inY = p.y >= Math.min(it.y, y2) && p.y <= Math.max(it.y, y2);
      return inX && inY ? 0.95 : 9;
    }
    if (it.t === "circle") return Math.hypot(p.x - it.x, p.y - it.y) <= Math.hypot(x2 - it.x, y2 - it.y) + tol * 0.5 ? 0.95 : 9;
    return distPoly(p, ptsOf(it)) / tol;
  };
  const hit = (p: Pt, L: MpItem[] = slide.items): MpItem | null => {
    let best: MpItem | null = null, bd = 1;
    for (let i = L.length - 1; i >= 0; i--) { const v = near(L[i], p); if (v < bd) { bd = v; best = L[i]; } }
    return best;
  };
  /**
   * Radierer beim Wischen: Flächen zählen nur an ihrem Rand – so lassen sich Pfeile in einer Zone wegwischen, ohne die
   * Zone mit zu löschen (antippen löscht auch Flächen).
   */
  const nearWipe = (it: MpItem, p: Pt): number => {
    if (!isArea(it.t)) return near(it, p);
    const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y;
    if (it.t === "circle") return Math.abs(Math.hypot(p.x - it.x, p.y - it.y) - Math.hypot(x2 - it.x, y2 - it.y)) / tol;
    return distPoly(p, [{ x: it.x, y: it.y }, { x: x2, y: it.y }, { x: x2, y: y2 }, { x: it.x, y: y2 }, { x: it.x, y: it.y }]) / tol;
  };
  const wipeHit = (p: Pt, ids: Set<string>): MpItem | null => {
    let best: MpItem | null = null, bd = 1;
    for (let i = slide.items.length - 1; i >= 0; i--) { const it = slide.items[i]; if (ids.has(it.id)) continue; const v = nearWipe(it, p); if (v < bd) { bd = v; best = it; } }
    return best;
  };
  /** Spieler, Material oder Text unter dem Finger (Flächen und Linien zählen nicht – darauf wird gesetzt) */
  const hitPoint = (p: Pt): MpItem | null => hit(p, slide.items.filter(x => pointTool(x.t) || x.t === "text"));
  const selIt = B.sel ? items.find(x => x.id === B.sel) || null : null;
  const handleAt = (p: Pt): Handle | null => {
    if (!selIt || ro) return null;
    const r = Math.max(2.2, 20 / g.k); let best: Handle | null = null, bd = r;
    for (const h of handlesOf(selIt)) { const dist = Math.hypot(h.p.x - p.x, h.p.y - p.y); if (dist < bd) { bd = dist; best = h.h; } }
    return best;
  };
  // ---------- Einrasten an Spielern ----------
  const tokens = slide.items.filter(x => x.t === "own" || x.t === "opp" || x.t === "neu" || x.t === "ball");
  const tokenNear = (p: Pt, extra: number): MpItem | null => {
    let best: MpItem | null = null, bd = Infinity;
    for (const k of tokens) { const dist = Math.hypot(k.x - p.x, k.y - p.y); if (dist < tokR(k) + extra && dist < bd) { bd = dist; best = k; } }
    return best;
  };
  /** Start auf einem Spieler: in dessen Mitte; Ziel auf einem Spieler: Spitze an dessen Rand */
  const snapStart = (p: Pt): Pt => { const k = tokenNear(p, 0.6); return k ? { x: k.x, y: k.y } : p; };
  const snapEnd = (it: MpItem): MpItem => {
    if (!isArrow(it.t)) return it;
    const e = { x: it.x2 ?? it.x, y: it.y2 ?? it.y }, k = tokenNear(e, 1.2);
    if (!k || (Math.abs(k.x - it.x) < 0.01 && Math.abs(k.y - it.y) < 0.01)) return it;
    const from = bendCtrl({ ...it, x2: k.x, y2: k.y }) || { x: it.x, y: it.y }, vx = k.x - from.x, vy = k.y - from.y, L = Math.hypot(vx, vy), r = tokR(k) + 0.35;
    if (L < r * 1.6) return it;
    return { ...it, x2: clampX(k.x - vx / L * r), y2: clampY(k.y - vy / L * r) };
  };
  /** Übungsskizze: nächste freie Rückennummer je Spielerart (1, 2, 3 …) */
  const nextNo = (t: MpTool): number | null => { const ns = slide.items.filter(x => x.t === t && x.n != null).map(x => x.n as number); const n = (ns.length ? Math.max(...ns) : 0) + 1; return n <= 99 ? n : null; };
  const nextStep = (): number | null => {
    const ns = slide.items.filter(x => stepped(x.t) && x.n).map(x => x.n as number);
    return ns.length ? Math.min(20, Math.max(...ns) + 1) : null;
  };
  /** Fingerspur beim Malen eines Pfeils bzw. einer Linie: Freihand im Stil des Elements (Dribbling: durchgezogen) */
  const trail = (it: MpItem, P: Pt[]): MpItem => {
    const tr: MpItem = { id: it.id, t: "free", x: P[0].x, y: P[0].y, x2: P[P.length - 1].x, y2: P[P.length - 1].y, pts: P.flatMap(q => [q.x, q.y]),
      col: it.col || defCol(it.t), ls: it.t === "drib" ? "solid" : dashOf(it) };
    if (it.w) tr.w = it.w;
    if (it.t === "line") tr.nh = true;
    return tr;
  };
  const touches = (e: GestureResponderEvent): Touch[] => ((e.nativeEvent as unknown as { touches?: Touch[] }).touches || []);
  /** Element übernehmen (neu oder geändert); false = Folie voll */
  const me = st.myStaff?.id || null;
  const upsert = (it: MpItem): boolean => {
    const known = slide.items.some(x => x.id === it.id), bl = known ? null : addBlock(slide, it.t);
    if (bl) { st.toast(st.tr.tf(bl.k, { n: bl.n })); return false; }
    // neu: „hinzugefügt von“ (eigenes Trainerprofil)
    const x = !known && me && !it.by ? { ...it, by: me } : it;
    B.commit({ ...slide, items: known ? slide.items.map(y => y.id === x.id ? x : y) : [...slide.items, x] });
    // neu gezeichnet: eine bestehende Auswahl endet (unten stehen wieder die Optionen des Werkzeugs)
    if (!known && B.sel) B.setSel(null);
    return true;
  };

  // ---------- Ausschnitt verschieben / zoomen (lokal, übernommen beim Loslassen) ----------
  const frameStart = (e: GestureResponderEvent) => {
    off.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY };
    const T = touches(e);
    if (T.length >= 2) {
      const [a, b] = T, mx = (a.pageX + b.pageX) / 2 - off.current.x, my = (a.pageY + b.pageY) / 2 - off.current.y;
      gest.current = { kind: "pinch", d0: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1, mx0: mx, my0: my, m0: g.m(mx - ox, my), f0: f, moved: false };
    } else gest.current = { kind: "pan", x0: e.nativeEvent.locationX, y0: e.nativeEvent.locationY, f0: f, moved: false };
  };
  const frameMove = (e: GestureResponderEvent) => {
    let G = gest.current; if (!G) return;
    const T = touches(e);
    // zweiter Finger kommt dazu: auf Zoomen umschalten
    if (T.length >= 2 && G.kind === "pan") { frameStart(e); G = gest.current!; G.moved = true; return; }
    let nf: MpFrame;
    if (G.kind === "pinch" && T.length >= 2) {
      const [a, b] = T, dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY), mx = (a.pageX + b.pageX) / 2 - off.current.x, my = (a.pageY + b.pageY) / 2 - off.current.y;
      const z = zoomFrame(G.f0, dist / G.d0, G.m0.x, G.m0.y), k1 = pw / z.w;
      nf = panFrame(z, -(mx - G.mx0) / k1, -(my - G.my0) / k1);
    } else if (G.kind === "pan") {
      const dx = e.nativeEvent.locationX - G.x0, dy = e.nativeEvent.locationY - G.y0;
      if (!G.moved && Math.hypot(dx, dy) < 4) return;
      nf = panFrame(G.f0, -dx / g.k, -dy / g.k);
    } else return;
    G.moved = true; setLiveFrame(nf);
  };
  const frameEnd = () => { gest.current = null; if (liveFrame) B.commit(withFrame(slide, liveFrame)); setLiveFrame(null); };

  // ---------- Zeichnen, Auswählen, Bewegen, Radieren ----------
  // App: Seite sperren, solange gezogen wird (Browser: die Fläche blockiert das Scrollen selbst)
  const native = Platform.OS !== "web";
  const arm = () => {
    const C = cur.current; if (!C || C.armed || C.act.k === "tap") return;
    C.armed = true; if (C.hold && native) lock(true);
    if (C.act.k === "move" && C.act.sel) B.setSel(C.act.id);
  };
  const end = () => { const C = cur.current; if (C?.timer) clearTimeout(C.timer); if (C?.armed && C.hold && native) lock(false); cur.current = null; setLive(null); setGone(null); };
  const start = (e: GestureResponderEvent): boolean => {
    if (ro || !inside(e)) return false;
    if (B.framing) return true;
    const p = toM(e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (tool === "del") return true;
    if (tool === "move") return !!handleAt(p) || !!hit(p) || !!B.sel;
    return true;
  };
  const grant = (e: GestureResponderEvent) => {
    if (B.framing) { frameStart(e); return; }
    const x0 = e.nativeEvent.locationX, y0 = e.nativeEvent.locationY, p = toM(x0, y0);
    // auf einer Seite: in der App immer, im Browser bei Fingereingabe erst halten (sonst scrollt Wischen nicht)
    const holdIt = !!hold && (native || surf.isTouch());
    const begin = (act: Act) => {
      cur.current = { act, x0, y0, moved: false, armed: !holdIt, hold: holdIt, timer: null };
      if (holdIt) cur.current.timer = setTimeout(() => { if (cur.current && !cur.current.moved) arm(); }, 170);
      else if (act.k === "move" && act.sel) B.setSel(act.id);
    };
    // Radierer: Element unter dem Finger und alles, worüber gewischt wird (ein Schritt im Verlauf)
    if (tool === "del") {
      // sofort weg, was am Startpunkt liegt (Flächen erst beim Loslassen ohne Wischen – Antippen)
      const ids = new Set<string>(), x = wipeHit(p, ids), tp = hit(p);
      if (x) ids.add(x.id);
      begin({ k: "erase", ids, p0: p, last: p, tap: tp ? tp.id : null }); setGone(new Set(ids)); return;
    }
    const h = handleAt(p);
    if (h && selIt) { begin({ k: "handle", id: selIt.id, h, it0: selIt }); return; }
    if (tool === "move") { const x = hit(p); begin(x ? { k: "move", id: x.id, p0: p, it0: x, isNew: false, wasSel: B.sel === x.id, sel: true } : { k: "tap", p0: p }); return; }
    const t = tool as MpTool;
    // Spieler, Material, Text: auf einem vorhandenen Element antippen = auswählen, ziehen = verschieben
    if (pointTool(t) || t === "text") {
      const x = hitPoint(p);
      if (x) { begin({ k: "move", id: x.id, p0: p, it0: x, isNew: false, wasSel: B.sel === x.id, sel: false }); return; }
    }
    if (t === "text") { onText?.(p); return; }
    if (pointTool(t)) {
      const it: MpItem = { id: mpId("i"), t, x: p.x, y: p.y };
      if (sketch && (t === "own" || t === "opp" || t === "neu")) { const n = nextNo(t); if (n) it.n = n; }
      begin({ k: "move", id: it.id, p0: p, it0: it, isNew: true, wasSel: false, sel: false }); setLive(it); return;
    }
    const props = B.newProps(t);
    if (t === "free") { const it: MpItem = { id: mpId("i"), t, x: p.x, y: p.y, x2: p.x, y2: p.y, pts: [p.x, p.y], ...props }; begin({ k: "free", it, pts: [p], p0: p }); return; }
    // Pfeile und Linien: Strich malen (Start auf einem Spieler: in dessen Mitte)
    if (isArrow(t)) { const s0 = snapStart(p); begin({ k: "stroke", it: { id: mpId("i"), t, x: s0.x, y: s0.y, x2: s0.x, y2: s0.y, ...props }, pts: [s0], p0: p }); return; }
    begin({ k: "new", it: { id: mpId("i"), t, x: p.x, y: p.y, x2: p.x, y2: p.y, ...props }, p0: p });
  };
  const move = (e: GestureResponderEvent) => {
    if (B.framing) { frameMove(e); return; }
    const C = cur.current; if (!C) return;
    const lx = e.nativeEvent.locationX, ly = e.nativeEvent.locationY, dx = lx - C.x0, dy = ly - C.y0;
    if (!C.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      // Wischen über freie Fläche: nichts tun (auf einer Seite scrollt sie)
      if (C.act.k === "tap") { end(); return; }
      if (!C.armed) {
        // App, Seite scrollt (senkrecht, ohne Halten): Ziehen abbrechen
        if (Math.abs(dx) > Math.abs(dy) * 1.2) arm(); else { end(); return; }
      }
      C.moved = true;
    }
    const p = toM(lx, ly), A = C.act;
    if (A.k === "erase") {
      // auch zwischen zwei Fingerpositionen prüfen (schnelles Wischen überspringt sonst dünne Linien)
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - A.last.x, p.y - A.last.y) / (tol * 0.6))), before = A.ids.size;
      for (let i = 1; i <= n; i++) { const x = wipeHit({ x: A.last.x + (p.x - A.last.x) * i / n, y: A.last.y + (p.y - A.last.y) * i / n }, A.ids); if (x) A.ids.add(x.id); }
      A.last = p;
      if (A.ids.size !== before) setGone(new Set(A.ids));
    }
    else if (A.k === "move") setLive(shiftItem(A.it0, p.x - A.p0.x, p.y - A.p0.y));
    else if (A.k === "handle") setLive(dragHandle(A.it0, A.h, p));
    else if (A.k === "new") setLive({ ...A.it, x2: p.x, y2: p.y });
    else if (A.k === "free" || A.k === "stroke") {
      const last = A.pts[A.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= Math.max(0.3, 3 / g.k)) A.pts.push(p);
      const P = [...A.pts, p];
      // beim Malen zeigt die Tafel die Fingerspur (im Stil des Pfeils); erst beim Loslassen wird sie geglättet
      setLive(A.k === "free" ? { ...A.it, pts: P.flatMap(q => [q.x, q.y]), x2: p.x, y2: p.y } : trail(A.it, P));
    }
  };
  const release = () => {
    if (B.framing) { frameEnd(); return; }
    const C = cur.current; if (!C) return;
    const A = C.act, L = live;
    end();
    /** Antippen mit einem Zeichenwerkzeug: Element darunter auswählen */
    const tapSelect = (p: Pt) => { const x = hit(p); B.setSel(x ? x.id : null); };
    if (A.k === "erase") {
      // Antippen: das Element unter dem Finger (auch eine Fläche)
      const ids = C.moved ? A.ids : new Set(A.tap ? [A.tap] : []);
      if (ids.size) { B.commit({ ...slide, items: slide.items.filter(y => !ids.has(y.id)) }); if (B.sel && ids.has(B.sel)) B.setSel(null); }
      return;
    }
    if (A.k === "tap") { if (!C.moved) B.setSel(null); return; }
    if (A.k === "move") {
      // neu gesetzt: bleibt nicht ausgewählt (die Optionen gelten fürs nächste Element)
      if (A.isNew) { upsert(L || A.it0); return; }
      if (C.moved && L) { upsert(L); if (A.sel) B.setSel(L.id); return; }
      // Antippen: auswählen; ein ausgewähltes Element erneut antippen öffnet das Formular
      if (!C.moved) { if (A.wasSel) onEdit?.(A.it0); else B.setSel(A.id); }
      return;
    }
    if (A.k === "handle") { if (C.moved && L) upsert(isArrow(L.t) && A.h === "p2" ? snapEnd(L) : isArrow(L.t) && A.h === "p1" ? { ...L, ...snapStart({ x: L.x, y: L.y }) } : L); return; }
    if (A.k === "new") {
      const it = L; if (!C.moved || !it) { tapSelect(A.p0); return; }
      const len = Math.hypot((it.x2 ?? it.x) - it.x, (it.y2 ?? it.y) - it.y);
      if (len < (it.t === "circle" ? 1.2 : 2)) { tapSelect(A.p0); return; }
      upsert(it); return;
    }
    if (A.k === "stroke") {
      const P = L?.pts ? ptsOf(L) : A.pts;
      if (!C.moved || pathLen(P) < 2) { tapSelect(A.p0); return; }
      // Ziel auf einem Spieler: zu dessen Mitte (die Spitze setzt snapEnd danach an den Rand)
      const a = { x: A.it.x, y: A.it.y }, e0 = P[P.length - 1], tk = tokenNear(e0, 1.2);
      const e = tk && Math.hypot(tk.x - a.x, tk.y - a.y) > 0.01 ? { x: tk.x, y: tk.y } : e0;
      if (Math.hypot(e.x - a.x, e.y - a.y) < 2) { tapSelect(A.p0); return; }
      // Form aus dem Strich, wie gezeichnet (ohne Einrasten – sonst entstünde durch das Einrasten ein Bogen)
      const raw = [A.p0, ...P.slice(1)], bend = strokeBend(A.p0, e0, raw, 10 / g.k);
      const it: MpItem = { ...A.it, x2: e.x, y2: e.y };
      if (bend) it.bend = bend;
      // Schritt im Ablauf weiterzählen – nur Pfeile (eine Linie, z. B. Abwehrlinie, bleibt immer sichtbar)
      const n = it.t !== "line" ? nextStep() : null;
      upsert(snapEnd(n ? { ...it, n } : it)); return;
    }
    if (A.k === "free") {
      const P = L?.pts ? ptsOf(L) : A.pts;
      if (!C.moved || pathLen(P) < 2.5) { tapSelect(A.p0); return; }
      const pts = thinPoints(P, Math.max(0.6, 9 / g.k)), n = A.it.nh ? null : nextStep();
      const it: MpItem = { ...A.it, pts, x: pts[0], y: pts[1], x2: pts[pts.length - 2], y2: pts[pts.length - 1] };
      if (n) it.n = n;
      upsert(it);
    }
  };

  const selDraw = selIt && !ro && !B.framing ? handlesOf(selIt) : [];
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", height: W ? g.h : 260 }}>
      {W ? <>
        <View pointerEvents="none" style={{ position: "absolute", left: ox, top: 0 }}>
          <Pitch frame={f} items={items} width={pw} mode={slide.mode || c.mode} size={size} accent={col.club} accentInk={col.clubInk} info={info} captain={c.captain} look={c.look}
            selected={B.sel} testID={testID + "-pitch"} sketch={sketch} plain={plain} />
          {B.framing ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: pw, height: g.h, borderRadius: 12, borderWidth: 3, borderColor: "#ffd43b", borderStyle: "dashed" }} /> : null}
          {selDraw.map(({ h, p }) => {
            const q = g.px(p.x, p.y), z = h === "bend" ? 16 : 20, bend = h === "bend";
            return <View key={h} testID={testID + "-h-" + h} pointerEvents="none" style={{ position: "absolute", left: q.left - z / 2, top: q.top - z / 2, width: z, height: z, borderRadius: z / 2,
              backgroundColor: bend ? "#ffe066" : "#ffffff", borderWidth: 2.5, borderColor: bend ? "#7a5c00" : col.accent }} />;
          })}
        </View>
        <View ref={surf.ref} testID={testID + "-surface"} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          onStartShouldSetResponder={start} onMoveShouldSetResponder={() => !!cur.current || !!gest.current}
          onResponderTerminationRequest={() => !!cur.current?.hold && !cur.current?.armed}
          onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={() => { end(); gest.current = null; setLiveFrame(null); }} />
      </> : null}
    </View>
  );
}

export function TextForm({ onSave, initial = "" }: { onSave: (t: string) => void; initial?: string }) {
  const E = useEngine(); const [txt, setTxt] = useState(initial);
  return <Col gap={10}>
    <Field testID="mp-text" label={E.t("mpt_text")} value={txt} onChangeText={setTxt} maxLength={40} placeholder={E.t("mp_textPh")} />
    <Btn testID="mp-text-save" kind="primary" label={E.t("save")} disabled={!txt.trim()} onPress={() => onSave(txt.trim())} />
  </Col>;
}

/** Spieler für ein Icon wählen: Kader zuerst, bereits auf der Folie gesetzte markiert */
export function PlayerPick({ squad, used, current, onPick }: { squad: string[]; used: string[]; current: string | null; onPick: (pid: string | null) => void }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  const [all, setAll] = useState(false);
  const ids = [...new Set([...squad, ...(all ? E.D.players.map(p => p.id) : [])])].filter(pid => info(pid)?.p);
  const chip = (pid: string) => {
    const inf = info(pid)!, on = pid === current, u = used.includes(pid) && !on;
    return (
      <Pressable key={pid} testID={"mp-pick-" + pid} accessibilityRole="button" accessibilityLabel={E.name(inf.p!)} onPress={() => onPick(pid)}
        style={({ pressed }) => ({ width: "31%", minWidth: 96, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 7, paddingHorizontal: 8, borderRadius: radius.m,
          borderWidth: on ? 2 : 1, borderColor: on ? col.accent : col.line, backgroundColor: on ? col.accentSoft : pressed ? col.sunk : col.surface, opacity: u ? 0.5 : 1 })}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: col.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: col.accentInk, fontWeight: "900", fontSize: 12 }}>{inf.nr != null ? String(inf.nr) : (inf.p!.vn || "?").slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 13, color: col.ink }}>{inf.label}</Text>
          <Text numberOfLines={1} style={{ fontSize: 10.5, color: col.muted }}>{u ? t("mp_pickUsed") : inf.p!.pos || ""}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <Col gap={10}>
      <Btn testID="mp-pick-none" kind={current ? "default" : "primary"} label={t("mp_pickNone")} onPress={() => onPick(null)} style={{ alignSelf: "flex-start" }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{ids.map(chip)}</View>
      {!all && E.D.players.length > squad.length ? <Btn small kind="ghost" testID="mp-pick-all" label={t("mp_pickAll")} onPress={() => setAll(true)} style={{ alignSelf: "flex-start" }} /> : null}
    </Col>
  );
}
