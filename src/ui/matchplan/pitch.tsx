// Matchplan: Spielfeld hochkant (eigenes Tor unten) mit beliebigem Ausschnitt – der Ausschnitt füllt immer die Breite,
// ein kleiner Ausschnitt (z. B. der 16er) wird also größer dargestellt. Auf Wunsch quer (Präsentation, eigenes Tor
// links), drei Designs (Rasen, Taktiktafel, weiß). Linien, Pfeile (auch gebogen), Zonen, Ball, Hütchen, Text und
// Spieler-Icons (Nummer, Nummer + Name, Foto + Name; Größe einstellbar). Editor, Spieleransicht, Vorschaubilder.
import React from "react";
import { Image, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { FRAME_MAX, MP_VIEWS, PL, PW, bendCtrl, isLine, linePoint } from "../../core/matchplan";
import type { MpColor, MpFrame, MpItem, MpLook, MpMode, Player } from "../../core/types";
import { usePhotoUrl } from "../playerAvatar";

/** Farben eines Designs: Untergrund, Streifen, Feldlinien, Linienfarben, Rand von Texten, leere Position */
export interface Look { bg: string; stripe: string; mark: string; lines: Record<MpColor, string>; halo: string; empty: string; emptyBorder: string; emptyText: string }
export const LOOKS: Record<MpLook, Look> = {
  grass: { bg: "#2f8a46", stripe: "#33944b", mark: "rgba(255,255,255,0.85)", lines: { w: "#ffffff", y: "#ffe066", r: "#ff8787", b: "#74c0fc" },
    halo: "rgba(0,0,0,0.55)", empty: "rgba(255,255,255,0.12)", emptyBorder: "#ffffff", emptyText: "#ffffff" },
  dark: { bg: "#1c2531", stripe: "#202a37", mark: "rgba(255,255,255,0.6)", lines: { w: "#ffffff", y: "#ffd43b", r: "#ff6b6b", b: "#4dabf7" },
    halo: "rgba(0,0,0,0.6)", empty: "rgba(255,255,255,0.1)", emptyBorder: "rgba(255,255,255,0.8)", emptyText: "#ffffff" },
  white: { bg: "#ffffff", stripe: "#f3f5f7", mark: "rgba(40,52,68,0.55)", lines: { w: "#1f2937", y: "#e8890c", r: "#e03131", b: "#1971c2" },
    halo: "rgba(255,255,255,0.85)", empty: "rgba(31,41,55,0.06)", emptyBorder: "#8a94a3", emptyText: "#4a5565" },
};
export const lookOf = (l?: MpLook | null): Look => (l && LOOKS[l]) || LOOKS.grass;
/** Linienfarbe in einem Design */
export const lineCol = (l: MpLook | null | undefined, k: MpColor): string => lookOf(l).lines[k];
export const OPP_COL = "#c92a2a";
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
function Markings({ s, col }: { s: number; col: string }) {
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
}
/** Rasen bzw. Untergrund mit Streifen (Meter) */
function Ground({ f, look }: { f: MpFrame; look: Look }) {
  const stripes = 10, sh = PL / stripes;
  return (
    <G>
      <Rect x={f.x - 1} y={f.y - 1} width={f.w + 2} height={f.h + 2} fill={look.bg} />
      {Array.from({ length: stripes }).map((_, i) => i % 2 ? <Rect key={i} x={-8} y={i * sh} width={PW + 16} height={sh} fill={look.stripe} /> : null)}
    </G>
  );
}

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

function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p1 = [x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45)], p2 = [x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45)];
  return `${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
}
/** Wellenlinie (Dribbling) entlang einer geraden oder gebogenen Linie */
function wave(it: MpItem, amp: number): string {
  const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, c = bendCtrl(it);
  const len = c ? Math.hypot(c.x - it.x, c.y - it.y) + Math.hypot(x2 - c.x, y2 - c.y) : Math.hypot(x2 - it.x, y2 - it.y);
  const n = Math.max(6, Math.round(len / (amp * 1.6))), pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = linePoint(it, t), off = i === 0 || i === n ? 0 : amp * (i % 2 ? 1 : -1);
    // Richtung der Linie an dieser Stelle (Ableitung der Kurve)
    const tx = c ? 2 * (1 - t) * (c.x - it.x) + 2 * t * (x2 - c.x) : x2 - it.x, ty = c ? 2 * (1 - t) * (c.y - it.y) + 2 * t * (y2 - c.y) : y2 - it.y;
    const tl = Math.hypot(tx, ty) || 1;
    pts.push(`${p.x - (ty / tl) * off},${p.y + (tx / tl) * off}`);
  }
  return pts.join(" ");
}

/** Linien, Pfeile, Zonen, Ball, Hütchen und Texte (in Metern; s = Größe der Striche und Symbole) */
function Drawn({ it, sel, s, look, rot }: { it: MpItem; sel: boolean; s: number; look: Look; rot: boolean }) {
  const col = look.lines[it.col || (it.t === "run" ? "y" : "w")], sw = (sel ? 0.75 : 0.5) * s;
  if (isLine(it.t)) {
    const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y;
    if (it.t === "zone") {
      const x = Math.min(it.x, x2), y = Math.min(it.y, y2), zc = look.lines[it.col || "y"];
      return <Rect x={x} y={y} width={Math.abs(x2 - it.x)} height={Math.abs(y2 - it.y)} fill={zc} fillOpacity={0.22} stroke={zc} strokeWidth={sw} strokeDasharray={`${1.4 * s} ${0.9 * s}`} />;
    }
    const c = bendCtrl(it);
    const from = c || { x: it.x, y: it.y };
    const dash = it.t === "run" ? `${1.6 * s} ${1.1 * s}` : undefined, w = it.t === "line" ? sw * 1.4 : sw;
    return (
      <G>
        {it.t === "drib" ? <Polyline points={wave(it, 0.8 * s)} fill="none" stroke={col} strokeWidth={sw} strokeLinejoin="round" />
          : c ? <Path d={`M ${it.x} ${it.y} Q ${c.x} ${c.y} ${x2} ${y2}`} fill="none" stroke={col} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" />
            : <Line x1={it.x} y1={it.y} x2={x2} y2={y2} stroke={col} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" />}
        {it.t !== "line" ? <Polyline points={arrowHead(from.x, from.y, x2, y2, 2.2 * s)} fill={col} stroke={col} strokeWidth={0.2 * s} /> : null}
      </G>
    );
  }
  if (it.t === "ball") return <G><Circle cx={it.x} cy={it.y} r={0.95 * s} fill="#ffffff" stroke="#111" strokeWidth={0.3 * s} /><Circle cx={it.x} cy={it.y} r={0.35 * s} fill="#111" /></G>;
  if (it.t === "cone") return <Path d={`M ${it.x} ${it.y - 1.3 * s} L ${it.x + 1.1 * s} ${it.y + 0.9 * s} L ${it.x - 1.1 * s} ${it.y + 0.9 * s} Z`} fill="#ff922b" stroke="#fff" strokeWidth={0.2 * s} />;
  if (it.t === "text") return (
    <SvgText x={it.x} y={it.y + 1 * s} fontSize={3.2 * s} fontWeight="bold" fill={look.lines[it.col || "w"]} stroke={look.halo} strokeWidth={0.25 * s} textAnchor="middle"
      transform={rot ? `rotate(-90 ${it.x} ${it.y})` : undefined}>{it.label || ""}</SvgText>
  );
  return null;
}

export interface TokenInfo { p: Player | null; label: string; nr: number | null }

/** Spieler-Icon (eigene Mannschaft): Nummer bzw. Foto im Kreis, Name darunter */
function OwnToken({ info, d, mode, accent, ink, captain, ring, dot, empty, pos, look }: {
  info: TokenInfo | null; d: number; mode: MpMode; accent: string; ink: string; captain: boolean; ring: string | null; dot: string | null; empty: boolean; pos: string; look: Look;
}) {
  const url = usePhotoUrl(mode === "photo" ? info?.p?.photo : null);
  const nr = info?.nr ?? null;
  const showName = mode !== "num" && !!info;
  return (
    <View style={{ width: d, alignItems: "center" }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: empty ? look.empty : accent, borderWidth: ring ? 3 : 2,
        borderColor: ring || (empty ? look.emptyBorder : "#ffffff"), borderStyle: empty ? "dashed" : "solid", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
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
}

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
  testID?: string;
}

/** Spielfeld mit allen Elementen eines Ausschnitts (ohne Bedienung) */
export function Pitch({ frame, items, width, mode, size, accent, accentInk, info, captain, highlight, selected, hidden, dot, look, rot = false, mini = false, testID }: PitchProps) {
  const L = lookOf(look), g = geom(frame, width, rot), f = frame, s = decoScale(g.k);
  const d = mini ? miniPx(g.w, g.h, f) : tokenPx(rot ? Math.min(g.w, g.h * 1.5) : g.w, size, f);
  const tokens = items.filter(it => (it.t === "own" || it.t === "opp") && it.id !== hidden);
  const body = (
    <G>
      <Ground f={f} look={L} />
      <Markings s={s} col={L.mark} />
      {items.filter(it => it.t !== "own" && it.t !== "opp" && it.id !== hidden).sort((a, b) => (a.t === "zone" ? -1 : 0) - (b.t === "zone" ? -1 : 0))
        .map(it => <Drawn key={it.id} it={it} sel={it.id === selected} s={s} look={L} rot={rot} />)}
    </G>
  );
  return (
    <View testID={testID} style={{ width: g.w, height: g.h, borderRadius: mini ? 6 : 12, overflow: "hidden", backgroundColor: L.bg }}>
      <Svg width={g.w} height={g.h} viewBox={rot ? `0 0 ${f.h} ${f.w}` : `${f.x} ${f.y} ${f.w} ${f.h}`}>
        {rot ? <G transform={`matrix(0 1 -1 0 ${f.y + f.h} ${-f.x})`}>{body}</G> : body}
      </Svg>
      {tokens.map(it => {
        const pt = g.px(it.x, it.y);
        if (it.t === "opp") {
          const od = mini ? d : Math.round(d * 0.82), sel = it.id === selected;
          return (
            <View key={it.id} testID={"opp-" + it.id} pointerEvents="none" style={{ position: "absolute", left: pt.left - od / 2, top: pt.top - od / 2, width: od, height: od, borderRadius: od / 2,
              backgroundColor: OPP_COL, borderWidth: mini ? 1 : sel ? 3 : 1.5, borderColor: sel ? "#ffe066" : "#ffffff", alignItems: "center", justifyContent: "center" }}>
              {!mini || od >= 12 ? <Text style={{ color: "#fff", fontWeight: "800", fontSize: Math.max(mini ? 6 : 9, od * (it.n != null ? 0.44 : 0.32)) }}>{it.n != null ? String(it.n) : mini ? "" : it.label || ""}</Text> : null}
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
}

/** Ein einzelnes Icon (z. B. am Finger beim Ziehen oder in der Liste) */
export function TokenGhost({ info, d, mode, accent, accentInk, opp }: { info: TokenInfo | null; d: number; mode: MpMode; accent: string; accentInk: string; opp?: boolean }) {
  if (opp) return <View style={{ width: d * 0.82, height: d * 0.82, borderRadius: d, backgroundColor: OPP_COL, borderWidth: 2, borderColor: "#fff" }} />;
  return <OwnToken info={info} d={d} mode={mode} accent={accent} ink={accentInk} captain={false} ring="#ffe066" dot={null} empty={!info} pos="" look={LOOKS.grass} />;
}
