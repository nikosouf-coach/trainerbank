// Matchplan: Spielfeld hochkant (eigenes Tor unten) mit Ausschnitt, Linien/Pfeilen/Zonen (SVG) und Spieler-Icons
// (Nummer, Nummer + Name, Foto + Name; Größe einstellbar). Wird im Editor, in der Spieleransicht und als Vorschau genutzt.
import React from "react";
import { Image, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { MP_VIEWS, PL, PW, isLine } from "../../core/matchplan";
import type { MpColor, MpItem, MpMode, MpView, Player } from "../../core/types";
import { usePhotoUrl } from "../playerAvatar";

export const LINE_COL: Record<MpColor, string> = { w: "#ffffff", y: "#ffe066", r: "#ff8787", b: "#74c0fc" };
export const OPP_COL = "#c92a2a";
const GRASS = "#2f8a46", GRASS2 = "#33944b", MARK = "rgba(255,255,255,0.85)";

/** Größe eines Spieler-Icons in Pixeln (abhängig von der Breite und der eingestellten Größe) */
export const tokenPx = (w: number, size: number): number => Math.round(Math.max(26, Math.min(54, w * 0.084)) * size);
/** Breite des Spielfelds: ganze Breite, aber nicht höher als ~78 % des Bildschirms und höchstens 560 px */
export function usePitchWidth(view: MpView, avail: number, maxH?: number): number {
  const { height } = useWindowDimensions(), v = MP_VIEWS[view];
  const byH = ((maxH ?? height * 0.78) * v.w) / v.h;
  return Math.max(200, Math.floor(Math.min(avail || 360, 560, byH)));
}
/** Umrechnung Meter ↔ Pixel für einen Ausschnitt */
export function geom(view: MpView, w: number) {
  const v = MP_VIEWS[view], k = w / v.w;
  return {
    v, k, w, h: Math.round(v.h * k),
    px: (x: number, y: number) => ({ left: (x - v.x) * k, top: (y - v.y) * k }),
    m: (left: number, top: number) => ({ x: left / k + v.x, y: top / k + v.y }),
  };
}

/** Feldmarkierungen hochkant (68 × 105) */
function Markings() {
  const s = { stroke: MARK, strokeWidth: 0.35, fill: "none" };
  const dx = Math.sqrt(9.15 * 9.15 - 5.5 * 5.5);
  return (
    <G>
      <Rect x={0} y={0} width={PW} height={PL} {...s} />
      <Line x1={0} y1={PL / 2} x2={PW} y2={PL / 2} {...s} />
      <Circle cx={PW / 2} cy={PL / 2} r={9.15} {...s} />
      <Circle cx={PW / 2} cy={PL / 2} r={0.35} fill={MARK} />
      {/* oben: gegnerisches Tor */}
      <Rect x={13.84} y={0} width={40.32} height={16.5} {...s} />
      <Rect x={24.84} y={0} width={18.32} height={5.5} {...s} />
      <Circle cx={34} cy={11} r={0.3} fill={MARK} />
      <Path d={`M ${34 - dx} 16.5 A 9.15 9.15 0 0 0 ${34 + dx} 16.5`} {...s} />
      <Rect x={30.34} y={-1.6} width={7.32} height={1.6} {...s} />
      {/* unten: eigenes Tor */}
      <Rect x={13.84} y={PL - 16.5} width={40.32} height={16.5} {...s} />
      <Rect x={24.84} y={PL - 5.5} width={18.32} height={5.5} {...s} />
      <Circle cx={34} cy={PL - 11} r={0.3} fill={MARK} />
      <Path d={`M ${34 - dx} ${PL - 16.5} A 9.15 9.15 0 0 1 ${34 + dx} ${PL - 16.5}`} {...s} />
      <Rect x={30.34} y={PL} width={7.32} height={1.6} {...s} />
      {/* Eckbögen */}
      <Path d="M 1 0 A 1 1 0 0 1 0 1" {...s} /><Path d={`M ${PW - 1} 0 A 1 1 0 0 0 ${PW} 1`} {...s} />
      <Path d={`M 0 ${PL - 1} A 1 1 0 0 1 1 ${PL}`} {...s} /><Path d={`M ${PW} ${PL - 1} A 1 1 0 0 0 ${PW - 1} ${PL}`} {...s} />
    </G>
  );
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p1 = [x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45)], p2 = [x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45)];
  return `${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
}
function wave(x1: number, y1: number, x2: number, y2: number, amp: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(6, Math.round(len / (amp * 1.6))), a = Math.atan2(y2 - y1, x2 - x1), pts: string[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, off = i === 0 || i === n ? 0 : amp * (i % 2 ? 1 : -1); pts.push(`${x1 + (x2 - x1) * t - Math.sin(a) * off},${y1 + (y2 - y1) * t + Math.cos(a) * off}`); }
  return pts.join(" ");
}

/** Linien, Pfeile, Zonen, Ball, Hütchen und Texte (in Metern) */
function Drawn({ it, sel }: { it: MpItem; sel: boolean }) {
  const col = LINE_COL[it.col || (it.t === "run" ? "y" : "w")], sw = sel ? 0.75 : 0.5;
  if (isLine(it.t)) {
    const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y;
    if (it.t === "zone") {
      const x = Math.min(it.x, x2), y = Math.min(it.y, y2), zc = LINE_COL[it.col || "y"];
      return <Rect x={x} y={y} width={Math.abs(x2 - it.x)} height={Math.abs(y2 - it.y)} fill={zc} fillOpacity={0.22} stroke={zc} strokeWidth={sw} strokeDasharray="1.4 0.9" />;
    }
    return (
      <G>
        {it.t === "drib" ? <Polyline points={wave(it.x, it.y, x2, y2, 0.8)} fill="none" stroke={col} strokeWidth={sw} />
          : <Line x1={it.x} y1={it.y} x2={x2} y2={y2} stroke={col} strokeWidth={it.t === "line" ? sw * 1.4 : sw} strokeDasharray={it.t === "run" ? "1.6 1.1" : undefined} strokeLinecap="round" />}
        {it.t !== "line" ? <Polyline points={arrowHead(it.x, it.y, x2, y2, 2.2)} fill={col} stroke={col} strokeWidth={0.2} /> : null}
      </G>
    );
  }
  if (it.t === "ball") return <G><Circle cx={it.x} cy={it.y} r={0.95} fill="#ffffff" stroke="#111" strokeWidth={0.3} /><Circle cx={it.x} cy={it.y} r={0.35} fill="#111" /></G>;
  if (it.t === "cone") return <Path d={`M ${it.x} ${it.y - 1.3} L ${it.x + 1.1} ${it.y + 0.9} L ${it.x - 1.1} ${it.y + 0.9} Z`} fill="#ff922b" stroke="#fff" strokeWidth={0.2} />;
  if (it.t === "text") return <SvgText x={it.x} y={it.y + 1} fontSize={3.2} fontWeight="bold" fill={LINE_COL[it.col || "w"]} stroke="rgba(0,0,0,0.55)" strokeWidth={0.25} textAnchor="middle">{it.label || ""}</SvgText>;
  return null;
}

export interface TokenInfo { p: Player | null; label: string; nr: number | null }

/** Spieler-Icon (eigene Mannschaft): Nummer bzw. Foto im Kreis, Name darunter */
function OwnToken({ info, d, mode, accent, ink, captain, ring, dot, empty, pos }: {
  info: TokenInfo | null; d: number; mode: MpMode; accent: string; ink: string; captain: boolean; ring: string | null; dot: string | null; empty: boolean; pos: string;
}) {
  const url = usePhotoUrl(mode === "photo" ? info?.p?.photo : null);
  const nr = info?.nr ?? null;
  const showName = mode !== "num" && !!info;
  return (
    <View style={{ width: d, alignItems: "center" }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: empty ? "rgba(255,255,255,0.12)" : accent, borderWidth: ring ? 3 : 2,
        borderColor: ring || "#ffffff", borderStyle: empty ? "dashed" : "solid", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {url ? <Image source={{ uri: url }} style={{ width: d, height: d }} />
          : <Text style={{ color: empty ? "#ffffff" : ink, fontWeight: "800", fontSize: Math.max(10, d * (empty ? 0.32 : nr != null && nr >= 10 ? 0.4 : 0.46)) }}>
            {empty ? pos : nr != null ? String(nr) : (info?.p?.vn || "?").slice(0, 1).toUpperCase()}</Text>}
      </View>
      {captain ? <View style={{ position: "absolute", top: -3, right: -3, width: d * 0.42, height: d * 0.42, borderRadius: d, backgroundColor: "#ffd43b", borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: Math.max(8, d * 0.24), fontWeight: "900", color: "#111" }}>C</Text></View> : null}
      {dot ? <View style={{ position: "absolute", top: d - d * 0.32, left: -2, width: d * 0.32, height: d * 0.32, borderRadius: d, backgroundColor: dot, borderWidth: 1.5, borderColor: "#fff" }} /> : null}
      {showName || (mode === "photo" && nr != null) ? <View style={{ marginTop: 2, maxWidth: d * 2.5, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: Math.max(9.5, Math.min(12.5, d * 0.3)), fontWeight: "700" }}>{mode === "photo" && nr != null ? `${nr} ${info?.label || ""}` : info?.label}</Text>
      </View> : null}
    </View>
  );
}

export interface PitchProps {
  view: MpView; items: MpItem[]; width: number; mode: MpMode; size: number; accent: string; accentInk: string;
  info: (pid: string) => TokenInfo | null;
  captain?: string | null;
  /** hervorgehoben (z. B. „Du“ in der Spieleransicht) */
  highlight?: string | null;
  selected?: string | null;
  /** gerade gezogenes Element (wird ausgeblendet; die App zeigt es am Finger) */
  hidden?: string | null;
  dot?: (pid: string) => string | null;
  testID?: string;
}

/** Spielfeld mit allen Elementen eines Ausschnitts (ohne Bedienung) */
export function Pitch({ view, items, width, mode, size, accent, accentInk, info, captain, highlight, selected, hidden, dot, testID }: PitchProps) {
  const g = geom(view, width), d = tokenPx(width, size);
  const stripes = 10, sh = PL / stripes;
  const tokens = items.filter(it => (it.t === "own" || it.t === "opp") && it.id !== hidden);
  return (
    <View testID={testID} style={{ width: g.w, height: g.h, borderRadius: 12, overflow: "hidden", backgroundColor: GRASS }}>
      <Svg width={g.w} height={g.h} viewBox={`${g.v.x} ${g.v.y} ${g.v.w} ${g.v.h}`}>
        <Rect x={g.v.x} y={g.v.y} width={g.v.w} height={g.v.h} fill={GRASS} />
        {Array.from({ length: stripes }).map((_, i) => i % 2 ? <Rect key={i} x={-4} y={i * sh} width={PW + 8} height={sh} fill={GRASS2} /> : null)}
        <Markings />
        {items.filter(it => it.t !== "own" && it.t !== "opp" && it.id !== hidden).sort((a, b) => (a.t === "zone" ? -1 : 0) - (b.t === "zone" ? -1 : 0)).map(it => <Drawn key={it.id} it={it} sel={it.id === selected} />)}
      </Svg>
      {tokens.map(it => {
        const pt = g.px(it.x, it.y);
        if (it.t === "opp") {
          const od = Math.round(d * 0.82);
          return (
            <View key={it.id} testID={"opp-" + it.id} pointerEvents="none" style={{ position: "absolute", left: pt.left - od / 2, top: pt.top - od / 2, width: od, height: od, borderRadius: od / 2,
              backgroundColor: OPP_COL, borderWidth: it.id === selected ? 3 : 1.5, borderColor: it.id === selected ? "#ffe066" : "#ffffff", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: Math.max(9, od * (it.n != null ? 0.44 : 0.32)) }}>{it.n != null ? String(it.n) : it.label || ""}</Text>
            </View>
          );
        }
        const inf = it.pid ? info(it.pid) : null;
        const ring = it.id === selected ? "#ffe066" : it.pid && it.pid === highlight ? "#ffe066" : null;
        return (
          <View key={it.id} testID={"tok-" + (it.pid || it.id)} pointerEvents="none" style={{ position: "absolute", left: pt.left - d / 2, top: pt.top - d / 2 }}>
            <OwnToken info={inf} d={d} mode={mode} accent={accent} ink={accentInk} captain={!!it.pid && it.pid === captain} ring={ring}
              dot={it.pid && dot ? dot(it.pid) : null} empty={!it.pid} pos={it.label || ""} />
          </View>
        );
      })}
    </View>
  );
}

/** Ein einzelnes Icon (z. B. am Finger beim Ziehen oder in der Liste) */
export function TokenGhost({ info, d, mode, accent, accentInk, opp }: { info: TokenInfo | null; d: number; mode: MpMode; accent: string; accentInk: string; opp?: boolean }) {
  if (opp) return <View style={{ width: d * 0.82, height: d * 0.82, borderRadius: d, backgroundColor: OPP_COL, borderWidth: 2, borderColor: "#fff" }} />;
  return <OwnToken info={info} d={d} mode={mode} accent={accent} ink={accentInk} captain={false} ring="#ffe066" dot={null} empty={!info} pos="" />;
}
