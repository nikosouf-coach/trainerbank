// Matchplan: Spielfeld hochkant (eigenes Tor unten) mit beliebigem Ausschnitt – der Ausschnitt füllt immer die Breite,
// ein kleiner Ausschnitt (z. B. der 16er) wird also größer dargestellt. Auf Wunsch quer (Präsentation, eigenes Tor
// links), drei Designs (Rasen, Taktiktafel, weiß). Linien und Pfeile (auch gebogen, mit Schrittnummer), Freihand,
// Zonen, Kreise, Ball, Hütchen, Text und Spieler-Icons (Nummer, Nummer + Name, Foto + Name; Größe einstellbar).
// Editor, Spieleransicht, Vorschaubilder. Alle Teile sind memoisiert: Beim Ziehen wird nur Geändertes neu gezeichnet.
import React from "react";
import { Image, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { FRAME_MAX, MP_VIEWS, PL, PW, bendCtrl, dashOf, isArea, isLine, isMaterial, linePoint } from "../../core/matchplan";
import type { MpColor, MpDash, MpFrame, MpItem, MpLook, MpMode, Player } from "../../core/types";
import { usePhotoUrl } from "../playerAvatar";
import { isLight } from "../theme";

/** Farben eines Designs: Untergrund, Streifen, Feldlinien, Linienfarben, Rand von Texten, leere Position */
export interface Look { bg: string; stripe: string; mark: string; lines: Record<MpColor, string>; halo: string; empty: string; emptyBorder: string; emptyText: string }
export const LOOKS: Record<MpLook, Look> = {
  grass: { bg: "#2f8a46", stripe: "#33944b", mark: "rgba(255,255,255,0.85)", lines: { w: "#ffffff", y: "#ffe066", r: "#ff8787", b: "#74c0fc", g: "#b2f2bb", o: "#ffa94d", k: "#111111" },
    halo: "rgba(0,0,0,0.55)", empty: "rgba(255,255,255,0.12)", emptyBorder: "#ffffff", emptyText: "#ffffff" },
  dark: { bg: "#1c2531", stripe: "#202a37", mark: "rgba(255,255,255,0.6)", lines: { w: "#ffffff", y: "#ffd43b", r: "#ff6b6b", b: "#4dabf7", g: "#69db7c", o: "#ffa94d", k: "#868e96" },
    halo: "rgba(0,0,0,0.6)", empty: "rgba(255,255,255,0.1)", emptyBorder: "rgba(255,255,255,0.8)", emptyText: "#ffffff" },
  white: { bg: "#ffffff", stripe: "#f3f5f7", mark: "rgba(40,52,68,0.55)", lines: { w: "#1f2937", y: "#e8890c", r: "#e03131", b: "#1971c2", g: "#2b8a3e", o: "#e8590c", k: "#111111" },
    halo: "rgba(255,255,255,0.85)", empty: "rgba(31,41,55,0.06)", emptyBorder: "#8a94a3", emptyText: "#4a5565" },
};
export const lookOf = (l?: MpLook | null): Look => (l && LOOKS[l]) || LOOKS.grass;
/** Linienfarbe in einem Design */
export const lineCol = (l: MpLook | null | undefined, k: MpColor): string => lookOf(l).lines[k];
export const OPP_COL = "#c92a2a";
/** Joker / neutrale Spieler */
export const NEU_COL = "#fab005";
/** Strichstärke je Stufe (dünn, mittel, dick) */
export const W_MUL: Record<1 | 2 | 3, number> = { 1: 0.6, 2: 1, 3: 1.65 };
/** Strichmuster eines Linienstils (Meter, s = Größe der Striche, w = Strichstärke) */
export function dashArray(ls: MpDash, s: number, w: number): string | undefined {
  if (ls === "solid") return undefined;
  if (ls === "dot") return `0.01 ${r2(Math.max(w * 2.3, 0.75 * s))}`;
  return ls === "long" ? `${r2(2.8 * s)} ${r2(1.3 * s)}` : `${r2(1.5 * s)} ${r2(1.05 * s)}`;
}
/** Linienenden: Striche gerade, Punkte und durchgezogene Linien rund */
export const capOf = (ls: MpDash): "round" | "butt" => ls === "solid" || ls === "dot" ? "round" : "butt";
export const FULL: MpFrame = MP_VIEWS.full;

/** Zoom gegenüber der ganzen Feldbreite (≥ 1) */
const zoomF = (f: MpFrame): number => Math.max(1, FRAME_MAX.w / f.w);
/** Größe eines Spieler-Icons in Pixeln: abhängig von der Breite, der Einstellung und – leicht – vom Zoom */
export const tokenPx = (w: number, size: number, f: MpFrame = FULL): number =>
  Math.round(Math.max(26, Math.min(54, w * 0.084)) * size * Math.min(1.35, Math.pow(zoomF(f), 0.3)));
/** Icons in Vorschaubildern: kleine Punkte */
const miniPx = (w: number, h: number, f: MpFrame): number => Math.round(Math.max(6, Math.min(15, Math.min(w, h * 1.5) * 0.07 * Math.pow(zoomF(f), 0.3))));

/**
 * Breite der Anzeige: ganze verfügbare Breite, aber nicht höher als maxH (Standard ~78 % des Bildschirms) und höchstens
 * maxW. `rot` = quer (Länge des Feldes waagerecht).
 */
export function usePitchWidth(f: MpFrame, avail: number, maxH?: number, maxW = 560, rot = false): number {
  const { height } = useWindowDimensions();
  const ratio = rot ? f.h / f.w : f.w / f.h;
  const byH = (maxH ?? height * 0.78) * ratio;
  return Math.max(160, Math.floor(Math.min(avail || 360, maxW, byH)));
}
/** Umrechnung Meter ↔ Pixel für einen Ausschnitt (hochkant oder quer) */
export function geom(f: MpFrame, w: number, rot = false) {
  const k = w / (rot ? f.h : f.w);
  return {
    f, k, w, rot, h: Math.round((rot ? f.w : f.h) * k),
    px: (x: number, y: number) => rot ? { left: (f.y + f.h - y) * k, top: (x - f.x) * k } : { left: (x - f.x) * k, top: (y - f.y) * k },
    m: (left: number, top: number) => rot ? { x: top / k + f.x, y: f.y + f.h - left / k } : { x: left / k + f.x, y: top / k + f.y },
  };
}
/** Strichstärken, Pfeilspitzen, Ball und Text wachsen beim Zoomen nur wenig mit (bezogen auf ~5 px je Meter) */
export const decoScale = (k: number): number => Math.max(0.3, Math.min(1.6, Math.pow(4.95 / k, 0.65)));

/** Feldmarkierungen hochkant (68 × 105) */
const Markings = React.memo(function Markings({ s, col }: { s: number; col: string }) {
  const st = { stroke: col, strokeWidth: 0.35 * s, fill: "none" };
  const dx = Math.sqrt(9.15 * 9.15 - 5.5 * 5.5);
  return (
    <G>
      <Rect x={0} y={0} width={PW} height={PL} {...st} />
      <Line x1={0} y1={PL / 2} x2={PW} y2={PL / 2} {...st} />
      <Circle cx={PW / 2} cy={PL / 2} r={9.15} {...st} />
      <Circle cx={PW / 2} cy={PL / 2} r={0.35} fill={col} />
      {/* oben: gegnerisches Tor */}
      <Rect x={13.84} y={0} width={40.32} height={16.5} {...st} />
      <Rect x={24.84} y={0} width={18.32} height={5.5} {...st} />
      <Circle cx={34} cy={11} r={0.3} fill={col} />
      <Path d={`M ${34 - dx} 16.5 A 9.15 9.15 0 0 0 ${34 + dx} 16.5`} {...st} />
      <Rect x={30.34} y={-1.6} width={7.32} height={1.6} {...st} />
      {/* unten: eigenes Tor */}
      <Rect x={13.84} y={PL - 16.5} width={40.32} height={16.5} {...st} />
      <Rect x={24.84} y={PL - 5.5} width={18.32} height={5.5} {...st} />
      <Circle cx={34} cy={PL - 11} r={0.3} fill={col} />
      <Path d={`M ${34 - dx} ${PL - 16.5} A 9.15 9.15 0 0 1 ${34 + dx} ${PL - 16.5}`} {...st} />
      <Rect x={30.34} y={PL} width={7.32} height={1.6} {...st} />
      {/* Eckbögen */}
      <Path d="M 1 0 A 1 1 0 0 1 0 1" {...st} /><Path d={`M ${PW - 1} 0 A 1 1 0 0 0 ${PW} 1`} {...st} />
      <Path d={`M 0 ${PL - 1} A 1 1 0 0 1 1 ${PL}`} {...st} /><Path d={`M ${PW} ${PL - 1} A 1 1 0 0 0 ${PW - 1} ${PL}`} {...st} />
    </G>
  );
});
/** Rasen bzw. Untergrund mit Streifen (Meter) */
const Ground = React.memo(function Ground({ f, look }: { f: MpFrame; look: Look }) {
  const stripes = 10, sh = PL / stripes;
  return (
    <G>
      <Rect x={f.x - 1} y={f.y - 1} width={f.w + 2} height={f.h + 2} fill={look.bg} />
      {Array.from({ length: stripes }).map((_, i) => i % 2 ? <Rect key={i} x={-8} y={i * sh} width={PW + 16} height={sh} fill={look.stripe} /> : null)}
    </G>
  );
});

/** Nur das Spielfeld (Rasen und Linien), ganzes Feld hochkant – z. B. als Hintergrund für den Schattenkader */
export function PitchSurface({ width, height, testID }: { width: number; height: number; testID?: string }) {
  const L = LOOKS.grass, f = { x: -2, y: -3, w: PW + 4, h: PL + 6 };
  return (
    <View testID={testID} pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height, borderRadius: 12, overflow: "hidden", backgroundColor: L.bg }}>
      <Svg width={width} height={height} viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} preserveAspectRatio="none">
        <Ground f={f} look={L} />
        <Markings s={1} col={L.mark} />
      </Svg>
    </View>
  );
}

/**
 * Kleines ganzes Feld, auf dem ein Ausschnitt hervorgehoben ist (Auswahl der Voreinstellungen, Übersicht beim Zoomen).
 * Außerhalb des Ausschnitts abgedunkelt.
 */
export function FrameThumb({ frame, width, look, accent, testID }: { frame: MpFrame; width: number; look?: MpLook | null; accent: string; testID?: string }) {
  const L = lookOf(look), f = FULL, h = Math.round(width * f.h / f.w);
  const fx = Math.max(f.x, frame.x), fy = Math.max(f.y, frame.y), fw = Math.min(f.x + f.w, frame.x + frame.w) - fx, fh = Math.min(f.y + f.h, frame.y + frame.h) - fy;
  return (
    <View testID={testID} pointerEvents="none" style={{ width, height: h, borderRadius: 6, overflow: "hidden", backgroundColor: L.bg }}>
      <Svg width={width} height={h} viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`}>
        <Ground f={f} look={L} />
        <Markings s={2.2} col={L.mark} />
        <Path d={`M ${f.x} ${f.y} H ${f.x + f.w} V ${f.y + f.h} H ${f.x} Z M ${fx} ${fy} H ${fx + fw} V ${fy + fh} H ${fx} Z`} fill="rgba(0,0,0,0.42)" fillRule="evenodd" />
        <Rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke={accent} strokeWidth={2.4} />
      </Svg>
    </View>
  );
}

type Pt = { x: number; y: number };
const r2 = (v: number): number => Math.round(v * 100) / 100;
/** Pfeilspitze als Dreieck (Spitze bei x2/y2, Richtung von x1/y1) */
function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p1 = [x2 - size * Math.cos(a - 0.42), y2 - size * Math.sin(a - 0.42)], p2 = [x2 - size * Math.cos(a + 0.42), y2 - size * Math.sin(a + 0.42)];
  return `${r2(x2)},${r2(y2)} ${r2(p1[0])},${r2(p1[1])} ${r2(p2[0])},${r2(p2[1])}`;
}
/** Punkt einer quadratischen Kurve */
const qPt = (a: Pt, c: Pt, b: Pt, t: number): Pt => { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; };
/** Wellenlinie (Dribbling) entlang einer geraden oder gebogenen Linie bis t1 */
function wave(it: MpItem, amp: number, t1: number): string {
  const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, c = bendCtrl(it);
  const len = (c ? Math.hypot(c.x - it.x, c.y - it.y) + Math.hypot(x2 - c.x, y2 - c.y) : Math.hypot(x2 - it.x, y2 - it.y)) * t1;
  const n = Math.max(6, Math.round(len / (amp * 1.6))), pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * t1, p = linePoint(it, t), off = i === 0 || i === n ? 0 : amp * (i % 2 ? 1 : -1);
    // Richtung der Linie an dieser Stelle (Ableitung der Kurve)
    const tx = c ? 2 * (1 - t) * (c.x - it.x) + 2 * t * (x2 - c.x) : x2 - it.x, ty = c ? 2 * (1 - t) * (c.y - it.y) + 2 * t * (y2 - c.y) : y2 - it.y;
    const tl = Math.hypot(tx, ty) || 1;
    pts.push(`${i ? "L" : "M"} ${r2(p.x - (ty / tl) * off)} ${r2(p.y + (tx / tl) * off)}`);
  }
  return pts.join(" ");
}
/** Freihandlinie: weich durch die Punkte (Mitten als Stützpunkte), Ende auf `end` */
function freePath(P: number[], end: Pt): string {
  const n = P.length / 2;
  let d = `M ${r2(P[0])} ${r2(P[1])}`;
  for (let i = 1; i < n - 1; i++) {
    const x = P[i * 2], y = P[i * 2 + 1], nx = i + 1 < n - 1 ? (x + P[i * 2 + 2]) / 2 : end.x, ny = i + 1 < n - 1 ? (y + P[i * 2 + 3]) / 2 : end.y;
    d += ` Q ${r2(x)} ${r2(y)} ${r2(nx)} ${r2(ny)}`;
  }
  return n <= 2 ? d + ` L ${r2(end.x)} ${r2(end.y)}` : d;
}
/**
 * Form eines Pfeils bzw. einer Linie: Strich (endet vor der Spitze, damit sie sauber bleibt) und Spitze.
 * Für Freihand: Punkte, Spitze in Richtung der letzten Strecke.
 */
function arrowGeo(it: MpItem, s: number, wk = 1): { d: string; head: string | null; mid: Pt } {
  const hs = 2.15 * s * Math.sqrt(wk), x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, b = { x: x2, y: y2 }, a = { x: it.x, y: it.y };
  const withHead = it.t !== "line";
  if (it.t === "free" && it.pts && it.pts.length >= 4) {
    const P = it.pts, n = P.length / 2, e = { x: P[(n - 1) * 2], y: P[(n - 1) * 2 + 1] };
    // Richtung: Punkt etwa eine Spitzenlänge vor dem Ende
    let back = { x: P[0], y: P[1] }, i = n - 2;
    for (; i >= 0; i--) { const q = { x: P[i * 2], y: P[i * 2 + 1] }; if (Math.hypot(e.x - q.x, e.y - q.y) >= hs * 1.2) { back = q; break; } }
    const L = Math.hypot(e.x - back.x, e.y - back.y) || 1, base = { x: e.x - (e.x - back.x) / L * hs * 0.7, y: e.y - (e.y - back.y) / L * hs * 0.7 };
    // Punkte nach dem Rückpunkt fallen weg (sonst knickt der Strich unter der Spitze)
    const keep = i >= 0 ? P.slice(0, (i + 1) * 2) : P.slice(0, 2);
    const mi = Math.floor((n - 1) / 2);
    return { d: freePath([...keep, base.x, base.y], base), head: arrowHead(back.x, back.y, e.x, e.y, hs), mid: { x: P[mi * 2], y: P[mi * 2 + 1] } };
  }
  const c = bendCtrl(it), len = c ? Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y) : Math.hypot(b.x - a.x, b.y - a.y);
  const trim = withHead && len > hs * 1.6 ? 1 - (hs * 0.7) / len : 1;
  const mid = linePoint(it, 0.5), head = withHead ? arrowHead((c || a).x, (c || a).y, b.x, b.y, hs) : null;
  if (it.t === "drib") return { d: wave(it, 0.8 * s, trim), head, mid };
  if (!c) { const e = { x: a.x + (b.x - a.x) * trim, y: a.y + (b.y - a.y) * trim }; return { d: `M ${r2(a.x)} ${r2(a.y)} L ${r2(e.x)} ${r2(e.y)}`, head, mid }; }
  const c1 = { x: a.x + trim * (c.x - a.x), y: a.y + trim * (c.y - a.y) }, e = qPt(a, c, b, trim);
  return { d: `M ${r2(a.x)} ${r2(a.y)} Q ${r2(c1.x)} ${r2(c1.y)} ${r2(e.x)} ${r2(e.y)}`, head, mid };
}

/**
 * Größe von Trainingsmaterial im Verhältnis zur Größe der Spieler-Icons (tok = Icon-Durchmesser in Metern), damit
 * Material in jedem Ausschnitt gut erkennbar bleibt; Großtore mindestens in echter Größe (7,32 m).
 */
function matDims(t: MpItem["t"], tok: number): { w: number; h: number } {
  if (t === "goal") return { w: Math.max(7.32, 1.5 * tok), h: Math.max(2, 0.42 * tok) };
  if (t === "mgoal") return { w: Math.min(5.5, Math.max(2, 1.2 * tok)), h: Math.max(0.8, 0.36 * tok) };
  if (t === "ladder") return { w: Math.max(4, 1.9 * tok), h: Math.max(0.6, 0.42 * tok) };
  if (t === "hurdle") return { w: Math.max(1, 0.75 * tok), h: 0.3 * tok };
  if (t === "dummy") return { w: 0.85 * tok, h: 0.42 * tok };
  if (t === "pole") return { w: 0.36 * tok, h: 0.36 * tok };
  return { w: 0.62 * tok, h: 0.62 * tok };
}
/** Ungefähre Größe eines Materials (Radius in Metern) – für Auswahl und Treffer */
export function materialR(t: MpItem["t"], tok: number): number { const d = matDims(t, tok); return Math.max(d.w, d.h) / 2; }
/** Trainingsmaterial von oben: Tor, Minitor, Stange, Dummy, Koordinationsleiter, Hürde, Reifen (drehbar über rot) */
function Material({ it, sel, tok, halo }: { it: MpItem; sel: boolean; tok: number; halo: string }) {
  const { x, y } = it, rot = it.rot || 0, { w, h } = matDims(it.t, tok), lw = Math.max(0.12, tok * 0.06);
  let body: React.ReactNode = null;
  if (it.t === "goal" || it.t === "mgoal") {
    const n = it.t === "goal" ? 7 : 3, net = Array.from({ length: n }, (_, i) => x - w / 2 + (w / (n + 1)) * (i + 1));
    body = <G>
      <Rect x={x - w / 2} y={y - h} width={w} height={h} fill="rgba(255,255,255,0.18)" stroke="none" />
      {net.map((nx, i) => <Line key={i} x1={nx} y1={y - h} x2={nx} y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth={lw * 0.4} />)}
      <Path d={`M ${x - w / 2} ${y} V ${y - h} H ${x + w / 2} V ${y}`} fill="none" stroke="#ffffff" strokeWidth={lw} strokeLinejoin="round" />
      <Line x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke="#ffffff" strokeWidth={lw * 1.5} strokeLinecap="round" />
    </G>;
  } else if (it.t === "pole") {
    body = <G><Circle cx={x} cy={y} r={w / 2} fill="#ffd43b" stroke="#1f2937" strokeWidth={lw * 0.7} /><Circle cx={x} cy={y} r={w * 0.16} fill="#1f2937" /></G>;
  } else if (it.t === "dummy") {
    body = <G><Rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill="#339af0" stroke="#ffffff" strokeWidth={lw * 0.7} /><Circle cx={x} cy={y} r={h * 0.36} fill="#ffffff" /></G>;
  } else if (it.t === "ladder") {
    const rungs = Array.from({ length: 9 }, (_, i) => x - w / 2 + (w / 8) * i);
    body = <G>
      <Line x1={x - w / 2} y1={y - h / 2} x2={x + w / 2} y2={y - h / 2} stroke="#ffd43b" strokeWidth={lw} />
      <Line x1={x - w / 2} y1={y + h / 2} x2={x + w / 2} y2={y + h / 2} stroke="#ffd43b" strokeWidth={lw} />
      {rungs.map((rx, i) => <Line key={i} x1={rx} y1={y - h / 2} x2={rx} y2={y + h / 2} stroke="#ffd43b" strokeWidth={lw * 0.8} />)}
    </G>;
  } else if (it.t === "hurdle") {
    body = <G><Line x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke="#fa5252" strokeWidth={lw * 1.6} strokeLinecap="round" />
      <Line x1={x - w / 2} y1={y - h / 2} x2={x - w / 2} y2={y + h / 2} stroke="#ffffff" strokeWidth={lw} strokeLinecap="round" />
      <Line x1={x + w / 2} y1={y - h / 2} x2={x + w / 2} y2={y + h / 2} stroke="#ffffff" strokeWidth={lw} strokeLinecap="round" /></G>;
  } else if (it.t === "ring") {
    body = <Circle cx={x} cy={y} r={w / 2} fill="none" stroke="#20c997" strokeWidth={lw * 1.3} />;
  }
  return (
    <G transform={rot ? `rotate(${rot} ${x} ${y})` : undefined}>
      {sel ? <Circle cx={x} cy={y} r={materialR(it.t, tok) * 1.15} fill={halo} fillOpacity={0.35} /> : null}
      {body}
    </G>
  );
}

/** Linien, Pfeile, Freihand, Zonen, Kreise, Ball, Hütchen, Material und Texte (in Metern; s = Größe der Striche und Symbole) */
const Drawn = React.memo(function Drawn({ it, sel, s, look, rot, tok }: { it: MpItem; sel: boolean; s: number; look: Look; rot: boolean; tok: number }) {
  const col = look.lines[it.col || (it.t === "run" ? "y" : "w")], sw = (sel ? 0.62 : 0.5) * s, halo = "#ffe066";
  const wk = W_MUL[it.w || 2], ls = dashOf(it);
  if (it.t === "zone" || it.t === "circle") {
    const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, zc = look.lines[it.col || "y"], dash = dashArray(ls, s * 0.9, sw * wk);
    const shape = (p: Record<string, unknown>) => it.t === "zone"
      ? <Rect x={Math.min(it.x, x2)} y={Math.min(it.y, y2)} width={Math.abs(x2 - it.x)} height={Math.abs(y2 - it.y)} {...p} />
      : <Circle cx={it.x} cy={it.y} r={Math.max(0.5, Math.hypot(x2 - it.x, y2 - it.y))} {...p} />;
    return (
      <G>
        {sel ? shape({ fill: "none", stroke: halo, strokeOpacity: 0.55, strokeWidth: sw * 3.4 }) : null}
        {shape({ fill: zc, fillOpacity: 0.22, stroke: zc, strokeWidth: sw * wk, strokeDasharray: dash, strokeLinecap: capOf(ls) })}
      </G>
    );
  }
  if (isLine(it.t) || it.t === "free") {
    const g = arrowGeo(it, s, wk), w = (it.t === "line" ? sw * 1.4 : sw) * wk;
    const dash = dashArray(ls, s, w);
    const br = 1.55 * s, light = look.bg === LOOKS.white.bg;
    return (
      <G>
        {sel ? <Path d={g.d} fill="none" stroke={halo} strokeOpacity={0.55} strokeWidth={Math.max(w * 3.6, sw * 2.6)} strokeLinecap="round" strokeLinejoin="round" /> : null}
        <Path d={g.d} fill="none" stroke={col} strokeWidth={w} strokeDasharray={dash} strokeLinecap={capOf(ls)} strokeLinejoin="round" />
        {g.head ? <Polyline points={g.head} fill={col} stroke={col} strokeWidth={0.22 * s} strokeLinejoin="round" /> : null}
        {it.n ? <G>
          <Circle cx={g.mid.x} cy={g.mid.y} r={br} fill={col} stroke={look.halo} strokeWidth={0.25 * s} />
          <SvgText x={g.mid.x} y={g.mid.y + br * 0.42} fontSize={br * 1.25} fontWeight="bold" fill={light ? "#ffffff" : "#111111"} textAnchor="middle"
            transform={rot ? `rotate(-90 ${g.mid.x} ${g.mid.y})` : undefined}>{String(it.n)}</SvgText>
        </G> : null}
      </G>
    );
  }
  if (it.t === "ball") return <G>{sel ? <Circle cx={it.x} cy={it.y} r={1.7 * s} fill={halo} fillOpacity={0.5} /> : null}<Circle cx={it.x} cy={it.y} r={0.95 * s} fill="#ffffff" stroke="#111" strokeWidth={0.3 * s} /><Circle cx={it.x} cy={it.y} r={0.35 * s} fill="#111" /></G>;
  if (it.t === "cone") return <G>{sel ? <Circle cx={it.x} cy={it.y} r={1.9 * s} fill={halo} fillOpacity={0.5} /> : null}<Path d={`M ${it.x} ${it.y - 1.3 * s} L ${it.x + 1.1 * s} ${it.y + 0.9 * s} L ${it.x - 1.1 * s} ${it.y + 0.9 * s} Z`} fill="#ff922b" stroke="#fff" strokeWidth={0.2 * s} /></G>;
  if (isMaterial(it.t)) return <Material it={it} sel={sel} tok={tok} halo={halo} />;
  if (it.t === "text") return (
    <SvgText x={it.x} y={it.y + 1 * s} fontSize={3.2 * s} fontWeight="bold" fill={look.lines[it.col || "w"]} stroke={sel ? halo : look.halo} strokeWidth={(sel ? 0.5 : 0.25) * s} textAnchor="middle"
      transform={rot ? `rotate(-90 ${it.x} ${it.y})` : undefined}>{it.label || ""}</SvgText>
  );
  return null;
});

export interface TokenInfo { p: Player | null; label: string; nr: number | null }

/** Spieler-Icon (eigene Mannschaft): Nummer bzw. Foto im Kreis, Name darunter */
const OwnToken = React.memo(function OwnToken({ info, d, mode, accent, ink, captain, ring, dot, empty, pos, look }: {
  info: TokenInfo | null; d: number; mode: MpMode; accent: string; ink: string; captain: boolean; ring: string | null; dot: string | null; empty: boolean; pos: string; look: Look;
}) {
  const url = usePhotoUrl(mode === "photo" ? info?.p?.photo : null);
  const nr = info?.nr ?? null;
  const showName = mode !== "num" && !!info;
  return (
    <View style={{ width: d, alignItems: "center" }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: empty ? look.empty : accent, borderWidth: ring ? 3 : 2,
        borderColor: ring || (empty ? look.emptyBorder : isLight(accent) ? "#7b8591" : "#ffffff"), borderStyle: empty ? "dashed" : "solid", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {url ? <Image source={{ uri: url }} style={{ width: d, height: d }} />
          : <Text style={{ color: empty ? look.emptyText : ink, fontWeight: "800", fontSize: Math.max(10, d * (empty ? 0.32 : nr != null && nr >= 10 ? 0.4 : 0.46)) }}>
            {empty ? pos : nr != null ? String(nr) : (info?.p?.vn || "?").slice(0, 1).toUpperCase()}</Text>}
      </View>
      {captain ? <View style={{ position: "absolute", top: -3, right: -3, width: d * 0.42, height: d * 0.42, borderRadius: d, backgroundColor: "#ffd43b", borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: Math.max(8, d * 0.24), fontWeight: "900", color: "#111" }}>C</Text></View> : null}
      {dot ? <View style={{ position: "absolute", top: d - d * 0.32, left: -2, width: d * 0.32, height: d * 0.32, borderRadius: d, backgroundColor: dot, borderWidth: 1.5, borderColor: "#fff" }} /> : null}
      {showName || (mode === "photo" && nr != null) ? <View style={{ marginTop: 2, maxWidth: d * 2.5, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: Math.max(9.5, Math.min(12.5, d * 0.3)), fontWeight: "700" }}>{mode === "photo" && nr != null ? `${nr} ${info?.label || ""}` : info?.label}</Text>
      </View> : null}
    </View>
  );
});

export interface PitchProps {
  /** Ausschnitt in Metern (z. B. MP_VIEWS.full oder frameOf(Folie)) */
  frame: MpFrame;
  items: MpItem[]; width: number; mode: MpMode; size: number; accent: string; accentInk: string;
  info: (pid: string) => TokenInfo | null;
  captain?: string | null;
  /** hervorgehoben (z. B. „Du“ in der Spieleransicht) */
  highlight?: string | null;
  selected?: string | null;
  /** gerade gezogenes Element (wird ausgeblendet; die App zeigt es am Finger) */
  hidden?: string | null;
  dot?: (pid: string) => string | null;
  /** Spielfeld-Design */
  look?: MpLook | null;
  /** quer: eigenes Tor links, Angriff nach rechts */
  rot?: boolean;
  /** Vorschaubild: kleine Punkte ohne Namen */
  mini?: boolean;
  /** Übungsskizze: eigene Spieler ohne Zuordnung als ausgefüllte Icons mit Nummer bzw. Kürzel */
  sketch?: boolean;
  /** ohne Feldlinien (freie Fläche) */
  plain?: boolean;
  testID?: string;
}

/** Spielfeld mit allen Elementen eines Ausschnitts (ohne Bedienung); neu gezeichnet nur bei geänderten Angaben */
export const Pitch = React.memo(function Pitch({ frame, items, width, mode, size, accent, accentInk, info, captain, highlight, selected, hidden, dot, look, rot = false, mini = false, sketch = false, plain = false, testID }: PitchProps) {
  const L = lookOf(look), g = geom(frame, width, rot), f = frame, s = decoScale(g.k);
  const d = mini ? miniPx(g.w, g.h, f) : tokenPx(rot ? Math.min(g.w, g.h * 1.5) : g.w, size, f);
  const tokens = items.filter(it => (it.t === "own" || it.t === "opp" || it.t === "neu") && it.id !== hidden);
  const body = (
    <G>
      <Ground f={f} look={L} />
      {plain ? null : <Markings s={s} col={L.mark} />}
      {items.filter(it => it.t !== "own" && it.t !== "opp" && it.t !== "neu" && it.id !== hidden).sort((a, b) => (isArea(a.t) ? -1 : 0) - (isArea(b.t) ? -1 : 0))
        .map(it => <Drawn key={it.id} it={it} sel={it.id === selected} s={s} look={L} rot={rot} tok={(mini ? tokenPx(g.w, size, f) : d) / g.k} />)}
    </G>
  );
  return (
    <View testID={testID} style={{ width: g.w, height: g.h, borderRadius: mini ? 6 : 12, overflow: "hidden", backgroundColor: L.bg }}>
      <Svg width={g.w} height={g.h} viewBox={rot ? `0 0 ${f.h} ${f.w}` : `${f.x} ${f.y} ${f.w} ${f.h}`}>
        {rot ? <G transform={`matrix(0 1 -1 0 ${f.y + f.h} ${-f.x})`}>{body}</G> : body}
      </Svg>
      {tokens.map(it => {
        const pt = g.px(it.x, it.y);
        // Gegner, Joker und (Übungsskizze) eigene Spieler ohne Zuordnung: ausgefüllter Kreis mit Nummer bzw. Kürzel
        if (it.t === "opp" || it.t === "neu" || (sketch && it.t === "own" && !it.pid)) {
          const od = mini ? d : Math.round(d * 0.82), sel = it.id === selected;
          const bg = it.t === "opp" ? OPP_COL : it.t === "neu" ? NEU_COL : accent, fg = it.t === "neu" ? "#111111" : it.t === "own" ? accentInk : "#ffffff";
          return (
            <View key={it.id} testID={mini ? undefined : it.t + "-" + it.id} pointerEvents="none" style={{ position: "absolute", left: pt.left - od / 2, top: pt.top - od / 2, width: od, height: od, borderRadius: od / 2,
              backgroundColor: bg, borderWidth: mini ? 1 : sel ? 3 : 1.5, borderColor: sel ? "#ffe066" : "#ffffff", alignItems: "center", justifyContent: "center" }}>
              {!mini || od >= 12 ? <Text style={{ color: fg, fontWeight: "800", fontSize: Math.max(mini ? 6 : 9, od * (it.n != null ? 0.44 : 0.32)) }}>{it.n != null ? String(it.n) : mini ? "" : it.label || ""}</Text> : null}
            </View>
          );
        }
        const inf = it.pid ? info(it.pid) : null;
        if (mini) {
          const nr = inf?.nr ?? null;
          return (
            <View key={it.id} pointerEvents="none" style={{ position: "absolute", left: pt.left - d / 2, top: pt.top - d / 2, width: d, height: d, borderRadius: d / 2,
              backgroundColor: it.pid ? accent : L.empty, borderWidth: 1, borderColor: it.pid ? "#ffffff" : L.emptyBorder, alignItems: "center", justifyContent: "center" }}>
              {d >= 12 && nr != null ? <Text style={{ color: accentInk, fontWeight: "800", fontSize: d * 0.5 }}>{String(nr)}</Text> : null}
            </View>
          );
        }
        const ring = it.id === selected ? "#ffe066" : it.pid && it.pid === highlight ? "#ffe066" : null;
        return (
          <View key={it.id} testID={"tok-" + (it.pid || it.id)} pointerEvents="none" style={{ position: "absolute", left: pt.left - d / 2, top: pt.top - d / 2 }}>
            <OwnToken info={inf} d={d} mode={mode} accent={accent} ink={accentInk} captain={!!it.pid && it.pid === captain} ring={ring}
              dot={it.pid && dot ? dot(it.pid) : null} empty={!it.pid} pos={it.label || ""} look={L} />
          </View>
        );
      })}
    </View>
  );
});

/** Ein einzelnes Icon (z. B. am Finger beim Ziehen oder in der Liste) */
export function TokenGhost({ info, d, mode, accent, accentInk, opp }: { info: TokenInfo | null; d: number; mode: MpMode; accent: string; accentInk: string; opp?: boolean }) {
  if (opp) return <View style={{ width: d * 0.82, height: d * 0.82, borderRadius: d, backgroundColor: OPP_COL, borderWidth: 2, borderColor: "#fff" }} />;
  return <OwnToken info={info} d={d} mode={mode} accent={accent} ink={accentInk} captain={false} ring="#ffe066" dot={null} empty={!info} pos="" look={LOOKS.grass} />;
}
