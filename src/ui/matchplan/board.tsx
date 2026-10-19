// Matchplan: Taktiktafel einer Folie – Spielfeld mit Bedienung. Werkzeuge: Auswählen, eigene Spieler, Gegner, Ball,
// Hütchen, Text, Löschen sowie Pass, Laufweg, Dribbling, Linie, Freihand, Zone und Kreis. Ausgewählte Elemente zeigen
// Griffe (Start, Ziel, Bogen, Ecken, Radius) und eine Leiste mit schnellen Aktionen (Art, Farbe, Bogen, Schritt,
// Kopieren, Löschen). Pfeile rasten an Spielern ein. Gezogen wird lokal (flüssig, ohne die ganze Seite neu zu zeichnen);
// übernommen wird beim Loslassen – ein Schritt im Verlauf je Bewegung. Im Ausschnitt-Modus verschiebt Ziehen den
// Ausschnitt, zwei Finger zoomen. Auf einer scrollbaren Seite (hold) startet Ziehen erst nach kurzem Halten oder
// waagerecht – senkrechtes Wischen scrollt die Seite.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path, Polyline, Rect } from "react-native-svg";
import { MP_COLORS, MP_LIMITS, bendCtrl, bendThrough, clampX, clampY, frameOf, isArea, isArrow, isLine, linePoint, mpId, panFrame, shiftItem, thinPoints, withFrame, zoomFrame } from "../../core/matchplan";
import type { MpColor, MpContent, MpFrame, MpItem, MpSlide, MpTool } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Icon, type IconName } from "../icons";
import { Btn, Col, Field, NumField, Picker, Row, Seg, ToggleRow, useScrollLock } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { useTokenInfo } from "./common";
import { OPP_COL, Pitch, decoScale, geom, lineCol, tokenPx, usePitchWidth } from "./pitch";

export type Tool = "move" | MpTool | "del";
/** Werkzeuge in zwei Reihen: Figuren und Bearbeiten, Linien und Flächen */
export const TOOL_ROWS: Tool[][] = [["move", "own", "opp", "ball", "cone", "text", "del"], ["pass", "run", "drib", "line", "free", "zone", "circle"]];
/** Werkzeuge bzw. Elemente mit Farbe */
export const hasColor = (t: Tool): boolean => isLine(t as MpTool) || t === "free" || t === "text";
/** Elemente mit Schrittnummer (Ablauf 1, 2, 3 …) */
const stepped = (t: MpTool): boolean => isArrow(t) || t === "free";
/** Standardfarbe einer Art (Laufwege und Flächen gelb) */
export const defCol = (t: MpTool): MpColor => t === "run" || isArea(t) ? "y" : "w";

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

/** Symbol eines Werkzeugs bzw. einer Elementart (24 × 24) */
export function ToolIcon({ k, size = 24, color, accent }: { k: Tool; size?: number; color: string; accent: string }) {
  const st = { stroke: color, strokeWidth: 2.1, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode = null;
  if (k === "move") body = <Path d="M6.5 3.5 V18.6 L10.3 14.9 L12.9 20.6 L15.4 19.5 L12.8 13.9 H18.2 Z" fill={color} stroke={color} strokeWidth={1.1} strokeLinejoin="round" />;
  else if (k === "own") body = <Circle cx={12} cy={12} r={7.6} fill={accent} stroke="#ffffff" strokeWidth={2} />;
  else if (k === "opp") body = <Circle cx={12} cy={12} r={7.6} fill={OPP_COL} stroke="#ffffff" strokeWidth={2} />;
  else if (k === "ball") body = <><Circle cx={12} cy={12} r={7.6} fill="#ffffff" stroke={color} strokeWidth={1.6} /><Path d="M12 8.7 L15.1 10.9 L13.9 14.6 L10.1 14.6 L8.9 10.9 Z" fill={color} /></>;
  else if (k === "cone") body = <Path d="M12 3.8 L19.4 19 H4.6 Z" fill="#ff922b" stroke="#ffffff" strokeWidth={1.3} strokeLinejoin="round" />;
  else if (k === "text") body = <Path d="M5.5 6 H18.5 M12 6 V19 M9.2 19 H14.8" {...st} strokeWidth={2.4} />;
  else if (k === "del") body = <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" {...st} />;
  else if (k === "pass" || k === "run") body = <><Path d="M4 20 L15.6 8.4" {...st} strokeWidth={2.3} strokeDasharray={k === "run" ? "3.2 2.6" : undefined} strokeLinecap={k === "run" ? "butt" : "round"} /><Polyline points={headPts(4, 20, 19.8, 4.2)} fill={color} /></>;
  else if (k === "drib") body = <><Path d={zig} {...st} strokeWidth={2} /><Polyline points={headPts(12, 12, 19.8, 4.2)} fill={color} /></>;
  else if (k === "line") body = <Path d="M3.5 18 L20.5 6" {...st} strokeWidth={3.2} />;
  else if (k === "free") body = <><Path d="M3.5 18.5 C 6.5 9, 10 22.5, 12.6 13.4 C 13.8 9.3, 15.4 8, 16.6 7.4" {...st} strokeWidth={2.1} /><Polyline points={headPts(13.2, 9.6, 20.2, 5.2)} fill={color} /></>;
  else if (k === "zone") body = <Rect x={3.8} y={6} width={16.4} height={12} rx={1.6} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.8} strokeDasharray="2.8 2" />;
  else if (k === "circle") body = <Circle cx={12} cy={12} r={8.2} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.8} strokeDasharray="2.8 2" />;
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}

/** Stand für Rückgängig/Wiederholen */
type Snap = Pick<MpSlide, "items" | "view" | "frame">;
const snapOf = (s: MpSlide): Snap => ({ items: s.items, view: s.view, frame: s.frame ?? null });

/** Verlauf, Werkzeug, Farbe, Auswahl und Ausschnitt-Modus einer Tafel */
export function useBoard(slide: MpSlide, onChange: (s: MpSlide) => void) {
  const undo = useRef<Snap[]>([]), redo = useRef<Snap[]>([]);
  const [tool, setToolRaw] = useState<Tool>("move");
  const [color, setColor] = useState<MpColor | null>(null);
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
    tool, color, setColor, framing, sel, setSel, commit,
    setTool: (k: Tool) => { setToolRaw(k); if (k === "del") setSel(null); },
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
  | { k: "move"; id: string; p0: Pt; it0: MpItem; isNew: boolean; wasSel: boolean }
  | { k: "handle"; id: string; h: Handle; it0: MpItem }
  | { k: "new"; it: MpItem; p0: Pt }
  | { k: "free"; it: MpItem; pts: Pt[]; p0: Pt }
  | { k: "tap"; p0: Pt };
type Cur = { act: Act; x0: number; y0: number; moved: boolean; armed: boolean; timer: ReturnType<typeof setTimeout> | null };
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
/** Kopie eines Elements (versetzt) */
export function dupItem(it: MpItem): MpItem { const c = shiftItem({ ...it, id: mpId("i") }, 3, 3); if (it.t === "own") delete c.pid; return c; }

/**
 * Spielfeld einer Folie mit Bedienung (ohne Werkzeugleiste). maxH/maxW begrenzen die Größe; der Ausschnitt füllt die
 * verfügbare Breite. onEdit: ausgewähltes Element erneut antippen (Formular), onText: Stelle für einen neuen Text.
 * hold: Tafel liegt auf einer scrollbaren Seite (Ziehen erst nach kurzem Halten bzw. waagerecht).
 */
export function BoardCanvas({ slide, c, B, ro, testID = "mp-board", maxH, maxW = 560, onEdit, onText, hold }: {
  slide: MpSlide; c: Pick<MpContent, "mode" | "size" | "captain" | "look">; B: BoardState; ro?: boolean; testID?: string; maxH?: number; maxW?: number;
  onEdit?: (it: MpItem) => void; onText?: (p: Pt) => void; hold?: boolean;
}) {
  const { c: col } = useTheme(); const info = useTokenInfo(); const lock = useScrollLock(); const st = useStore();
  const [W, setW] = useState(0);
  const [live, setLive] = useState<MpItem | null>(null);
  const [liveFrame, setLiveFrame] = useState<MpFrame | null>(null);
  const f = liveFrame || frameOf(slide);
  const pw = usePitchWidth(f, W, maxH, maxW), g = geom(f, pw), ox = Math.max(0, (W - pw) / 2), size = slide.size || c.size, d = tokenPx(pw, size, f), s = decoScale(g.k);
  const cur = useRef<Cur | null>(null), gest = useRef<Gesture | null>(null), off = useRef({ x: 0, y: 0 });
  const tool = B.tool;
  const items = useMemo(() => !live ? slide.items : slide.items.some(x => x.id === live.id) ? slide.items.map(x => x.id === live.id ? live : x) : [...slide.items, live], [slide.items, live]);
  useEffect(() => () => { if (cur.current?.timer) clearTimeout(cur.current.timer); }, []);

  const toM = (lx: number, ly: number): Pt => { const m = g.m(lx - ox, ly); return { x: clampX(m.x), y: clampY(m.y) }; };
  const inside = (e: GestureResponderEvent) => { const x = e.nativeEvent.locationX - ox, y = e.nativeEvent.locationY; return x >= 0 && x <= pw && y >= 0 && y <= g.h; };
  // ---------- Treffer ----------
  const tol = Math.max(1.5, 13 / g.k);
  const tokR = (it: MpItem): number => it.t === "own" ? d / 2 / g.k : it.t === "opp" ? (d * 0.41) / g.k : it.t === "ball" ? 1.1 * s : it.t === "cone" ? 1.4 * s : 0;
  /** Abstand zum Element im Verhältnis zur Trefferweite (< 1 = getroffen); Flächen nachrangig */
  const near = (it: MpItem, p: Pt): number => {
    if (it.t === "own" || it.t === "opp" || it.t === "ball" || it.t === "cone") return Math.hypot(it.x - p.x, it.y - p.y) / (tokR(it) + 6 / g.k);
    if (it.t === "text") { const hw = Math.max(2.6, (it.label || "").length * 1.05 * s), hh = 2.4 * s + 4 / g.k; return Math.max(Math.abs(p.x - it.x) / hw, Math.abs(p.y - it.y) / hh); }
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
  const selIt = B.sel ? items.find(x => x.id === B.sel) || null : null;
  const handleAt = (p: Pt): Handle | null => {
    if (!selIt || ro) return null;
    const r = Math.max(2.2, 20 / g.k); let best: Handle | null = null, bd = r;
    for (const h of handlesOf(selIt)) { const dist = Math.hypot(h.p.x - p.x, h.p.y - p.y); if (dist < bd) { bd = dist; best = h.h; } }
    return best;
  };
  // ---------- Einrasten an Spielern ----------
  const tokens = slide.items.filter(x => x.t === "own" || x.t === "opp" || x.t === "ball");
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
  const nextStep = (): number | null => {
    const ns = slide.items.filter(x => stepped(x.t) && x.n).map(x => x.n as number);
    return ns.length ? Math.min(20, Math.max(...ns) + 1) : null;
  };
  const touches = (e: GestureResponderEvent): Touch[] => ((e.nativeEvent as unknown as { touches?: Touch[] }).touches || []);
  /** Element übernehmen (neu oder geändert); false = Folie voll */
  const upsert = (it: MpItem): boolean => {
    const known = slide.items.some(x => x.id === it.id), bl = known ? null : addBlock(slide, it.t);
    if (bl) { st.toast(st.tr.tf(bl.k, { n: bl.n })); return false; }
    B.commit({ ...slide, items: known ? slide.items.map(x => x.id === it.id ? it : x) : [...slide.items, it] });
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

  // ---------- Zeichnen, Auswählen, Bewegen ----------
  const holdMode = !!hold && Platform.OS !== "web";
  const arm = () => {
    const C = cur.current; if (!C || C.armed || C.act.k === "tap") return;
    C.armed = true; if (holdMode) lock(true);
    if (C.act.k === "move") B.setSel(C.act.id);
  };
  const end = () => { const C = cur.current; if (C?.timer) clearTimeout(C.timer); if (C?.armed && holdMode) lock(false); cur.current = null; setLive(null); };
  const start = (e: GestureResponderEvent): boolean => {
    if (ro || !inside(e)) return false;
    if (B.framing) return true;
    const p = toM(e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (tool === "move" || tool === "del") return !!handleAt(p) || !!hit(p) || (tool === "move" && !!B.sel);
    return true;
  };
  const grant = (e: GestureResponderEvent) => {
    if (B.framing) { frameStart(e); return; }
    const x0 = e.nativeEvent.locationX, y0 = e.nativeEvent.locationY, p = toM(x0, y0);
    const begin = (act: Act) => {
      cur.current = { act, x0, y0, moved: false, armed: !holdMode, timer: null };
      if (holdMode) cur.current.timer = setTimeout(() => { if (cur.current && !cur.current.moved) arm(); }, 170);
      else if (act.k === "move" && !act.isNew) B.setSel(act.id);
    };
    const h = tool !== "del" ? handleAt(p) : null;
    if (h && selIt) { begin({ k: "handle", id: selIt.id, h, it0: selIt }); return; }
    if (tool === "del") { const x = hit(p); if (x) { B.commit({ ...slide, items: slide.items.filter(y => y.id !== x.id) }); if (B.sel === x.id) B.setSel(null); } return; }
    if (tool === "move") { const x = hit(p); begin(x ? { k: "move", id: x.id, p0: p, it0: x, isNew: false, wasSel: B.sel === x.id } : { k: "tap", p0: p }); return; }
    if (tool === "text") { onText?.(p); return; }
    const t = tool as MpTool;
    if (t === "own" || t === "opp" || t === "ball" || t === "cone") {
      const it: MpItem = { id: mpId("i"), t, x: p.x, y: p.y };
      begin({ k: "move", id: it.id, p0: p, it0: it, isNew: true, wasSel: false }); setLive(it); return;
    }
    const colr = B.color || defCol(t);
    if (t === "free") { const it: MpItem = { id: mpId("i"), t, x: p.x, y: p.y, x2: p.x, y2: p.y, col: colr, pts: [p.x, p.y] }; begin({ k: "free", it, pts: [p], p0: p }); return; }
    const s0 = isArrow(t) ? snapStart(p) : p;
    begin({ k: "new", it: { id: mpId("i"), t, x: s0.x, y: s0.y, x2: s0.x, y2: s0.y, col: colr }, p0: p });
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
        // Seite scrollt (senkrecht, ohne Halten): Ziehen abbrechen
        if (Math.abs(dx) > Math.abs(dy) * 1.2) arm(); else { end(); return; }
      }
      C.moved = true;
    }
    const p = toM(lx, ly), A = C.act;
    if (A.k === "move") setLive(shiftItem(A.it0, p.x - A.p0.x, p.y - A.p0.y));
    else if (A.k === "handle") setLive(dragHandle(A.it0, A.h, p));
    else if (A.k === "new") setLive({ ...A.it, x2: p.x, y2: p.y });
    else if (A.k === "free") {
      const last = A.pts[A.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= Math.max(0.3, 3 / g.k)) A.pts.push(p);
      const P = [...A.pts, p];
      setLive({ ...A.it, pts: P.flatMap(q => [q.x, q.y]), x2: p.x, y2: p.y });
    }
  };
  const release = () => {
    if (B.framing) { frameEnd(); return; }
    const C = cur.current; if (!C) return;
    const A = C.act, L = live;
    end();
    /** Antippen mit einem Zeichenwerkzeug: Element darunter auswählen */
    const tapSelect = (p: Pt) => { const x = hit(p); B.setSel(x ? x.id : null); };
    if (A.k === "tap") { if (!C.moved) B.setSel(null); return; }
    if (A.k === "move") {
      if (A.isNew) { const it = L || A.it0; if (upsert(it)) B.setSel(it.id); return; }
      if (C.moved && L) { upsert(L); B.setSel(L.id); return; }
      // Antippen: auswählen; ein ausgewähltes Element erneut antippen öffnet das Formular
      if (!C.moved) { if (A.wasSel) onEdit?.(A.it0); else B.setSel(A.id); }
      return;
    }
    if (A.k === "handle") { if (C.moved && L) upsert(isArrow(L.t) && A.h === "p2" ? snapEnd(L) : isArrow(L.t) && A.h === "p1" ? { ...L, ...snapStart({ x: L.x, y: L.y }) } : L); return; }
    if (A.k === "new") {
      const it = L; if (!C.moved || !it) { tapSelect(A.p0); return; }
      const len = Math.hypot((it.x2 ?? it.x) - it.x, (it.y2 ?? it.y) - it.y);
      if (len < (it.t === "circle" ? 1.2 : 2)) { tapSelect(A.p0); return; }
      const n = stepped(it.t) ? nextStep() : null, fin = snapEnd(n ? { ...it, n } : it);
      if (upsert(fin)) B.setSel(fin.id); return;
    }
    if (A.k === "free") {
      const P = L?.pts ? ptsOf(L) : A.pts;
      if (!C.moved || pathLen(P) < 2.5) { tapSelect(A.p0); return; }
      const pts = thinPoints(P, Math.max(0.6, 9 / g.k)), n = nextStep();
      const it: MpItem = { ...A.it, pts, x: pts[0], y: pts[1], x2: pts[pts.length - 2], y2: pts[pts.length - 1] };
      if (n) it.n = n;
      if (upsert(it)) B.setSel(it.id);
    }
  };

  const selDraw = selIt && !ro && !B.framing ? handlesOf(selIt) : [];
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", height: W ? g.h : 260 }}>
      {W ? <>
        <View pointerEvents="none" style={{ position: "absolute", left: ox, top: 0 }}>
          <Pitch frame={f} items={items} width={pw} mode={slide.mode || c.mode} size={size} accent={col.accent} accentInk={col.accentInk} info={info} captain={c.captain} look={c.look}
            selected={B.sel} testID={testID + "-pitch"} />
          {B.framing ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: pw, height: g.h, borderRadius: 12, borderWidth: 3, borderColor: "#ffd43b", borderStyle: "dashed" }} /> : null}
          {selDraw.map(({ h, p }) => {
            const q = g.px(p.x, p.y), z = h === "bend" ? 16 : 20, bend = h === "bend";
            return <View key={h} testID={testID + "-h-" + h} pointerEvents="none" style={{ position: "absolute", left: q.left - z / 2, top: q.top - z / 2, width: z, height: z, borderRadius: z / 2,
              backgroundColor: bend ? "#ffe066" : "#ffffff", borderWidth: 2.5, borderColor: bend ? "#7a5c00" : col.accent }} />;
          })}
        </View>
        <View testID={testID + "-surface"} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          onStartShouldSetResponder={start} onMoveShouldSetResponder={() => !!cur.current || !!gest.current}
          onResponderTerminationRequest={() => !!holdMode && !cur.current?.armed}
          onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={() => { end(); gest.current = null; setLiveFrame(null); }} />
      </> : null}
    </View>
  );
}

/** Werkzeuge (zwei Reihen); schmal nur Symbole – der Name steht in der Hinweiszeile */
export function ToolGrid({ B, testID = "mp-board", only, labels }: { B: BoardState; testID?: string; only?: Tool[]; labels?: boolean }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  return (
    <Col gap={6} testID={testID + "-tools"}>
      {TOOL_ROWS.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 5 }}>
          {row.filter(k => !only || only.includes(k)).map(k => {
            const on = B.tool === k && !B.framing;
            return (
              <Pressable key={k} testID={testID + "-tool-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t("mpt_" + k)} onPress={() => { B.setFraming(false); B.setTool(k); }}
                style={({ pressed }) => ({ flex: 1, minWidth: 0, height: labels ? 52 : 44, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col.accent : col.line,
                  backgroundColor: on ? col.accentSoft : pressed ? col.sunk : col.surface, alignItems: "center", justifyContent: "center", gap: 1 })}>
                <ToolIcon k={k} size={labels ? 22 : 24} color={k === "del" ? col.crit : on ? col.accentTx : col.ink} accent={col.accent} />
                {labels ? <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: "700", color: on ? col.accentTx : col.muted }}>{t("mpts_" + k)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Col>
  );
}

/** Linienfarben (passend zum Spielfeld-Design) */
export function ColorRow({ value, onChange, look, testID, small }: { value: MpColor; onChange: (k: MpColor) => void; look?: MpContent["look"]; testID: string; small?: boolean }) {
  const E = useEngine(); const { c } = useTheme(); const z = small ? 26 : 30;
  return (
    <Row gap={small ? 6 : 8} testID={testID}>
      {MP_COLORS.map(k => <Pressable key={k} testID={testID + "-" + k} accessibilityRole="radio" accessibilityState={{ checked: value === k }} accessibilityLabel={E.t(k === "w" && look === "white" ? "mpc_wd" : "mpc_" + k)} onPress={() => onChange(k)} hitSlop={4}
        style={{ width: z, height: z, borderRadius: z / 2, backgroundColor: lineCol(look, k), borderWidth: value === k ? 3 : 1, borderColor: value === k ? c.accent : c.line }} />)}
    </Row>
  );
}

function SelBtn({ testID, label, icon, tool, onPress, on, disabled, danger, primary, wide }: {
  testID: string; label: string; icon?: IconName; tool?: Tool; onPress: () => void; on?: boolean; disabled?: boolean; danger?: boolean; primary?: boolean; wide?: string;
}) {
  const { c } = useTheme();
  const fg = primary ? c.accentInk : danger ? c.crit : on ? c.accentTx : c.ink;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on, disabled: !!disabled }} disabled={disabled} onPress={onPress} hitSlop={3}
      style={({ pressed }) => ({ height: 38, minWidth: 38, paddingHorizontal: wide ? 11 : 0, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: radius.m,
        borderWidth: 1.5, borderColor: primary ? c.accent : on ? c.accent : c.line, backgroundColor: primary ? c.accent : on ? c.accentSoft : pressed ? c.sunk : c.surface, opacity: disabled ? 0.4 : 1 })}>
      {tool ? <ToolIcon k={tool} size={22} color={fg} accent={c.accent} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      {wide ? <Text numberOfLines={1} style={{ fontWeight: "800", fontSize: 13, color: fg, maxWidth: 150 }}>{wide}</Text> : null}
    </Pressable>
  );
}
const Sep = () => { const { c } = useTheme(); return <View style={{ width: 1, height: 26, backgroundColor: c.line, marginHorizontal: 2 }} />; };

/**
 * Leiste für das ausgewählte Element: Spieler wählen, bearbeiten, Art, Farbe, Bogen, Schritt, Kopieren, Löschen.
 * onPick: Spieler zuweisen (eigene Spieler); onEdit: Formular (Nummer, Text, Kürzel).
 */
export function SelBar({ it, look, onUpdate, onDelete, onDup, onEdit, onPick, onClose, testID = "mp-sel" }: {
  it: MpItem; look?: MpContent["look"]; onUpdate: (x: MpItem) => void; onDelete: () => void; onDup?: () => void; onEdit?: () => void; onPick?: () => void; onClose: () => void; testID?: string;
}) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  const inf = it.t === "own" && it.pid ? info(it.pid) : null;
  const colr = it.col || defCol(it.t);
  const setN = (n: number) => { const x = { ...it }; delete x.n; onUpdate(n > 0 ? { ...x, n: Math.min(20, n) } : x); };
  return (
    <View testID={testID + "-bar"} style={{ height: 50, borderRadius: radius.l, borderWidth: 1, borderColor: withAlpha(col.accent, 0.45), backgroundColor: withAlpha(col.accent, 0.07) }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center", gap: 6, paddingHorizontal: 6, height: 48 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingRight: 2 }}>
          <ToolIcon k={it.t} size={20} color={col.accentTx} accent={col.accent} />
          <Text testID={testID + "-kind"} numberOfLines={1} style={{ fontWeight: "800", fontSize: 12.5, color: col.accentTx }}>{t("mpts_" + it.t)}</Text>
        </View>
        {it.t === "own" && onPick ? <SelBtn testID={testID + "-player"} primary={!it.pid} icon="person" label={t("mp_pick")} wide={inf?.p ? `${inf.nr != null ? inf.nr + " " : ""}${inf.label}` : t("mp_pick")} onPress={onPick} /> : null}
        {onEdit && (it.t === "own" || it.t === "opp" || it.t === "text") ? <SelBtn testID={testID + "-edit"} icon="pen" label={t("mp_itemEdit")} onPress={onEdit} /> : null}
        {isArrow(it.t) ? <><Sep />{(["pass", "run", "drib", "line"] as const).map(k => <SelBtn key={k} testID={testID + "-kind-" + k} tool={k} label={t("mpt_" + k)} on={it.t === k}
          onPress={() => onUpdate({ ...it, t: k, col: it.col || (k === "run" ? "y" : "w") })} />)}</> : null}
        {hasColor(it.t) ? <><Sep /><ColorRow small testID={testID + "-col"} value={colr} onChange={k => onUpdate({ ...it, col: k })} look={look} /></> : null}
        {isArrow(it.t) ? <><Sep />{it.bend ? <SelBtn testID={testID + "-straight"} icon="minus" label={t("mp_straight")} wide={t("mp_straight")} onPress={() => { const x = { ...it }; delete x.bend; onUpdate(x); }} />
          : <SelBtn testID={testID + "-curve"} icon="curve" label={t("mp_bend")} wide={t("mp_bend")} onPress={() => onUpdate({ ...it, bend: 1.5 })} />}</> : null}
        {it.t === "free" ? <><Sep /><SelBtn testID={testID + "-solid"} on={!!it.solid} tool={it.solid ? "pass" : "run"} label={t(it.solid ? "mp_solid" : "mp_dashed")} wide={t(it.solid ? "mp_solid" : "mp_dashed")}
          onPress={() => { const x = { ...it }; delete x.solid; onUpdate(it.solid ? x : { ...x, solid: true }); }} /></> : null}
        {stepped(it.t) ? <><Sep />
          <SelBtn testID={testID + "-step-minus"} icon="minus" label={t("mp_stepLess")} disabled={!it.n} onPress={() => setN((it.n || 0) - 1)} />
          <View testID={testID + "-step"} accessibilityLabel={t("mp_step")} style={{ minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: it.n ? col.ink : "transparent", borderWidth: it.n ? 0 : 1.5, borderColor: col.line, borderStyle: "dashed" }}>
            <Text style={{ fontWeight: "900", fontSize: 13, color: it.n ? col.bg : col.muted }}>{it.n ? String(it.n) : "#"}</Text>
          </View>
          <SelBtn testID={testID + "-step-plus"} icon="plus" label={t("mp_stepMore")} disabled={(it.n || 0) >= 20} onPress={() => setN((it.n || 0) + 1)} />
        </> : null}
        <Sep />
        {onDup ? <SelBtn testID={testID + "-dup"} icon="copy" label={t("mp_itemDup")} onPress={onDup} /> : null}
        <SelBtn testID={testID + "-del"} icon="trash" danger label={t("mp_itemDel")} onPress={onDelete} />
        <SelBtn testID={testID + "-x"} icon="close" label={t("mp_selDone")} onPress={onClose} />
      </ScrollView>
    </View>
  );
}

/** Element bearbeiten: Spieler, Rückennummer, Text, Art, Bogen, Schritt und Farbe */
export function ItemForm({ it, squad, look, onSave, onDelete }: { it: MpItem; squad: string[]; look?: MpContent["look"]; onSave: (x: MpItem) => void; onDelete: () => void }) {
  const E = useEngine(); const { t } = E; const info = useTokenInfo();
  const [x, setX] = useState<MpItem>(it);
  const bendKey = String(Math.max(-2, Math.min(2, Math.round(x.bend || 0))));
  return (
    <Col gap={12}>
      {it.t === "own" ? <Picker testID="mp-item-player" label={t("mp_player")} value={x.pid || ""} onChange={k => setX({ ...x, pid: k || null })}
        options={[{ key: "", label: t("mp_noPlayer") }, ...[...new Set([...squad, ...E.D.players.map(p => p.id)])].map(pid => ({ key: pid, label: (info(pid)?.nr != null ? info(pid)!.nr + " " : "") + (info(pid)?.p ? E.name(info(pid)!.p!) : "?") }))]} /> : null}
      {it.t === "own" && !x.pid ? <Field testID="mp-item-pos" label={t("mp_posShort")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 4) })} maxLength={4} style={{ width: 110 }} /> : null}
      {it.t === "opp" ? <Row gap={10} wrap>
        <NumField testID="mp-item-n" label={t("mp_oppNr")} value={x.n ?? null} min={0} max={99} onChange={n => setX({ ...x, n })} style={{ width: 110 }} />
        <Field testID="mp-item-label" label={t("mp_posShort")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 4) })} maxLength={4} style={{ width: 110 }} />
      </Row> : null}
      {it.t === "text" ? <Field testID="mp-item-text" label={t("mpt_text")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 40) })} maxLength={40} /> : null}
      {isArrow(it.t) ? <Seg testID="mp-item-kind" value={x.t} onChange={k => setX({ ...x, t: k })} options={(["pass", "run", "drib", "line"] as const).map(k => ({ key: k, label: t("mpt_" + k) }))} wrap /> : null}
      {isArrow(it.t) ? <Col gap={4}><T2 text={t("mp_bend")} />
        <Seg testID="mp-item-bend" value={bendKey} onChange={k => { const v = Number(k), y = { ...x }; delete y.bend; setX(v ? { ...y, bend: v } : y); }}
          options={BENDS.map(b => ({ key: b.k, label: b.icon }))} />
      </Col> : null}
      {it.t === "free" ? <ToggleRow testID="mp-item-solid" label={t("mp_solid")} value={!!x.solid} onChange={v => { const y = { ...x }; delete y.solid; setX(v ? { ...y, solid: true } : y); }} /> : null}
      {stepped(it.t) ? <NumField testID="mp-item-step" label={t("mp_step")} value={x.n ?? null} min={1} max={20} onChange={n => { const y = { ...x }; delete y.n; setX(n ? { ...y, n } : y); }} style={{ width: 130 }} /> : null}
      {hasColor(it.t) ? <ColorRow testID="mp-item-col" value={x.col || defCol(x.t)} onChange={k => setX({ ...x, col: k })} look={look} /> : null}
      <Row gap={8} wrap>
        {it.t !== "ball" && it.t !== "cone" ? <Btn testID="mp-item-save" kind="primary" label={t("save")} onPress={() => onSave(x)} /> : null}
        <Btn testID="mp-item-del" kind="danger" label={t("mp_itemDel")} onPress={onDelete} />
      </Row>
    </Col>
  );
}
/** Bogen einer Linie: stark links … stark rechts (in Laufrichtung) */
export const BENDS: { k: string; v: number; icon: string }[] = [{ k: "2", v: 2, icon: "↶↶" }, { k: "1", v: 1, icon: "↶" }, { k: "0", v: 0, icon: "—" }, { k: "-1", v: -1, icon: "↷" }, { k: "-2", v: -2, icon: "↷↷" }];
function T2({ text }: { text: string }) { const { c } = useTheme(); return <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.muted }}>{text}</Text>; }

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
