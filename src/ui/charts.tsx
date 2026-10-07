// Kleine Diagramme (SVG): Wochenlast, Tageslast mit ACWR, Erholungsring, Wochenstreifen.
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { radius, rpeColor, useTheme } from "./theme";

/** Balken je Woche (z. B. Ø AU pro Spieler). Letzter Balken = laufende Woche (heller). */
export function WeekBars({ data, label, height = 150 }: { data: { label: string; v: number }[]; label: string; height?: number }) {
  const { c } = useTheme();
  const W = 360, H = height, L = 34, B = 22, T = 10, top = Math.ceil(Math.max(1000, ...data.map(d => d.v)) / 500) * 500, ih = H - T - B, bw = (W - L - 6) / Math.max(1, data.length);
  const y = (v: number): number => T + ih - v / top * ih;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={label}>
      {[0, top / 2, top].map(v => <React.Fragment key={v}><Line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} stroke={c.line} /><SvgText x={L - 5} y={y(v) + 3} fontSize={10} fill={c.muted} textAnchor="end">{String(v)}</SvgText></React.Fragment>)}
      {data.map((d, i) => { const x = L + i * bw + bw * 0.22, w = bw * 0.56; return (
        <React.Fragment key={i}>
          <Rect x={x} y={y(d.v)} width={w} height={Math.max(0, T + ih - y(d.v))} rx={3} fill={c.accent} opacity={i === data.length - 1 ? 0.45 : 0.9} />
          <SvgText x={x + w / 2} y={H - 6} fontSize={10} fill={c.muted} textAnchor="middle">{d.label}</SvgText>
        </React.Fragment>); })}
    </Svg>
  );
}

/** Tageslast (Balken) und ACWR (Linie) mit Sweet-Spot-Band 0,8–1,3. */
export function LoadChart({ series, label, dateLabel }: { series: { d: string; L: number; acwr: number | null }[]; label: string; dateLabel: (d: string) => string }) {
  const { c } = useTheme();
  const W = 640, H = 200, L = 40, R = 34, T = 10, B = 24, iw = W - L - R, ih = H - T - B, top = Math.ceil(Math.max(800, ...series.map(s => s.L)) / 200) * 200;
  const y = (v: number): number => T + ih - v / top * ih, ya = (a: number): number => T + ih - Math.min(a, 2) / 2 * ih, bw = iw / Math.max(1, series.length);
  const pts = series.map((s, i) => s.acwr == null ? null : `${L + i * bw + bw / 2},${ya(s.acwr)}`).filter(Boolean) as string[];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={label}>
      <Rect x={L} y={ya(1.3)} width={iw} height={ya(0.8) - ya(1.3)} fill={c.ok} opacity={0.13} />
      {[0, 1, 2, 3, 4].map(k => { const v = top / 4 * k; return <React.Fragment key={k}><Line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} /><SvgText x={L - 5} y={y(v) + 3} fontSize={10} fill={c.muted} textAnchor="end">{String(v)}</SvgText></React.Fragment>; })}
      {[0, 1, 2].map(a => <SvgText key={a} x={W - R + 5} y={ya(a) + 3} fontSize={10} fill={c.muted}>{String(a)}</SvgText>)}
      {series.map((s, i) => s.L ? <Rect key={i} x={L + i * bw + bw * 0.2} y={y(s.L)} width={bw * 0.6} height={T + ih - y(s.L)} rx={2} fill={c.accent} opacity={0.85} /> : null)}
      {series.map((s, i) => (i % 7 === 0 || i === series.length - 1) ? <SvgText key={"d" + i} x={L + i * bw + bw / 2} y={H - 6} fontSize={10} fill={c.muted} textAnchor="middle">{dateLabel(s.d)}</SvgText> : null)}
      {pts.length > 1 ? <Polyline points={pts.join(" ")} fill="none" stroke={c.ink} strokeWidth={2} /> : null}
      {pts.length ? <Circle cx={Number(pts[pts.length - 1].split(",")[0])} cy={Number(pts[pts.length - 1].split(",")[1])} r={4} fill={c.ink} /> : null}
    </Svg>
  );
}

/** Erholungsring in Prozent. */
export function Ring({ pct, color, size = 58 }: { pct: number; color: string; size?: number }) {
  const { c } = useTheme(); const r = size / 2 - 5, C = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.sunk} strokeWidth={7} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none" strokeDasharray={`${C * p / 100} ${C}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontWeight: "800", fontSize: 13, color: c.ink }}>{Math.round(p)}%</Text>
    </View>
  );
}

/** Wochenstreifen: Höhe/Farbe = Intensität, Spiel in Vereinsfarbe. */
export function WeekStrip({ days }: { days: { label: string; md: string; rpe: number; match: boolean; today: boolean }[] }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {days.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <View style={{ width: "100%", height: 46, borderRadius: 7, backgroundColor: c.sunk, overflow: "hidden", justifyContent: "flex-end" }}>
            <View style={{ height: d.match ? "100%" : d.rpe ? `${Math.max(15, d.rpe * 10)}%` : 0, backgroundColor: d.match ? c.accent : rpeColor(c, d.rpe), borderRadius: 7 }} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: d.today ? "800" : "500", color: d.today ? c.ink : c.muted }}>{d.label}</Text>
          <Text style={{ fontSize: 9.5, color: c.muted }}>{d.md || " "}</Text>
        </View>
      ))}
    </View>
  );
}

/** Verteilung hart/mittel/leicht als gestapelter Balken. */
export function Dist({ hard, mid, easy }: { hard: number; mid: number; easy: number }) {
  const { c } = useTheme(); const n = Math.max(1, hard + mid + easy);
  return (
    <View style={{ flexDirection: "row", height: 12, borderRadius: radius.pill, overflow: "hidden", backgroundColor: c.sunk }}>
      <View style={{ width: `${hard / n * 100}%`, backgroundColor: c.crit }} />
      <View style={{ width: `${mid / n * 100}%`, backgroundColor: c.warn }} />
      <View style={{ width: `${easy / n * 100}%`, backgroundColor: c.ok }} />
    </View>
  );
}
