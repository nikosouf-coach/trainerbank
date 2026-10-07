// Zeichentool (Taktiktafel) für Übungen: Spielfeld wählen, Spieler/Hütchen/Bälle/Tore setzen,
// Pass-, Lauf- und Dribbelwege sowie Zonen ziehen, verschieben, löschen. Koordinaten in Metern.
import React, { useRef, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { BoardItem, BoardKind, Drawing } from "../core/types";
import { useStore } from "../data/store";
import { Btn, Row, Seg } from "./kit";
import { radius, useTheme } from "./theme";

const PITCH: Record<Drawing["pitch"], [number, number]> = { full: [105, 68], half: [68, 52.5], box: [50, 30], free: [40, 30] };
const M = 2; // Rand in Metern
const COL: Record<string, string> = { a: "#e03131", b: "#1c7ed6", gk: "#f59f00", cone: "#ff922b", zone: "#ffd43b" };
const LINES: BoardKind[] = ["pass", "run", "drib", "zone"];
type Tool = BoardKind | "move" | "del";

/** Spielfeldmarkierungen. */
function Markings({ pitch }: { pitch: Drawing["pitch"] }) {
  const [W, H] = PITCH[pitch], s = { stroke: "rgba(255,255,255,0.85)", strokeWidth: W / 260, fill: "none" };
  const box = (x: number, y: number, w: number, h: number, k: string) => <Rect key={k} x={x} y={y} width={w} height={h} {...s} />;
  if (pitch === "full") {
    const pa = (left: boolean) => {
      const x0 = left ? 0 : W - 16.5, g0 = left ? 0 : W - 5.5, sx = left ? 11 : W - 11;
      return (
        <G key={left ? "l" : "r"}>
          {box(x0, 13.84, 16.5, 40.32, "pa")}{box(g0, 24.84, 5.5, 18.32, "ga")}
          <Circle cx={sx} cy={34} r={0.3} fill="rgba(255,255,255,0.85)" />
          <Rect x={left ? -1.6 : W} y={30.34} width={1.6} height={7.32} {...s} />
        </G>
      );
    };
    return <G><Rect x={0} y={0} width={W} height={H} {...s} /><Line x1={W / 2} y1={0} x2={W / 2} y2={H} {...s} /><Circle cx={W / 2} cy={H / 2} r={9.15} {...s} />{pa(true)}{pa(false)}</G>;
  }
  if (pitch === "half") {
    return <G><Rect x={0} y={0} width={W} height={H} {...s} />{box(13.84, 0, 40.32, 16.5, "pa")}{box(24.84, 0, 18.32, 5.5, "ga")}
      <Path d={`M ${34 - 9.15} ${H} A 9.15 9.15 0 0 1 ${34 + 9.15} ${H}`} {...s} /><Circle cx={34} cy={11} r={0.3} fill="rgba(255,255,255,0.85)" /><Rect x={30.34} y={-1.6} width={7.32} height={1.6} {...s} /></G>;
  }
  if (pitch === "box") {
    return <G><Line x1={0} y1={0} x2={W} y2={0} {...s} />{box(4.84, 0, 40.32, 16.5, "pa")}{box(15.84, 0, 18.32, 5.5, "ga")}
      <Circle cx={25} cy={11} r={0.25} fill="rgba(255,255,255,0.85)" /><Rect x={21.34} y={-1.6} width={7.32} height={1.6} {...s} /></G>;
  }
  return <Rect x={0} y={0} width={W} height={H} {...s} strokeDasharray={`${W / 60} ${W / 60}`} />;
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1), l = size;
  const p1 = [x2 - l * Math.cos(a - 0.45), y2 - l * Math.sin(a - 0.45)], p2 = [x2 - l * Math.cos(a + 0.45), y2 - l * Math.sin(a + 0.45)];
  return `${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
}
function wave(x1: number, y1: number, x2: number, y2: number, amp: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(6, Math.round(len / (amp * 1.6))), a = Math.atan2(y2 - y1, x2 - x1), pts: string[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, off = i === 0 || i === n ? 0 : amp * (i % 2 ? 1 : -1); pts.push(`${x1 + (x2 - x1) * t - Math.sin(a) * off},${y1 + (y2 - y1) * t + Math.cos(a) * off}`); }
  return pts.join(" ");
}

/** Ein Element der Zeichnung. */
function Item({ it, W }: { it: BoardItem; W: number }) {
  const r = W * 0.022, sw = W / 220;
  switch (it.t) {
    case "a": case "b": case "gk":
      return <G><Circle cx={it.x} cy={it.y} r={r} fill={COL[it.t]} stroke="#fff" strokeWidth={sw} />{it.n != null ? <SvgText x={it.x} y={it.y + r * 0.42} fontSize={r * 1.15} fontWeight="bold" fill="#fff" textAnchor="middle">{String(it.n)}</SvgText> : null}</G>;
    case "cone": return <Path d={`M ${it.x} ${it.y - r * 0.8} L ${it.x + r * 0.7} ${it.y + r * 0.6} L ${it.x - r * 0.7} ${it.y + r * 0.6} Z`} fill={COL.cone} stroke="#fff" strokeWidth={sw * 0.6} />;
    case "ball": return <Circle cx={it.x} cy={it.y} r={r * 0.5} fill="#fff" stroke="#111" strokeWidth={sw} />;
    case "goal": return <Rect x={it.x - r * 1.6} y={it.y - r * 0.5} width={r * 3.2} height={r} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={sw * 1.4} />;
    case "zone": { const x = Math.min(it.x, it.x2 ?? it.x), y = Math.min(it.y, it.y2 ?? it.y); return <Rect x={x} y={y} width={Math.abs((it.x2 ?? it.x) - it.x)} height={Math.abs((it.y2 ?? it.y) - it.y)} fill="rgba(255,212,59,0.28)" stroke="#ffd43b" strokeWidth={sw} strokeDasharray={`${r * 0.6} ${r * 0.4}`} />; }
    default: {
      const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, col = it.t === "pass" ? "#fff" : it.t === "run" ? "#ffe066" : "#ffffff";
      return (
        <G>
          {it.t === "drib" ? <Polyline points={wave(it.x, it.y, x2, y2, r * 0.45)} fill="none" stroke={col} strokeWidth={sw * 1.3} />
            : <Line x1={it.x} y1={it.y} x2={x2} y2={y2} stroke={col} strokeWidth={sw * 1.5} strokeDasharray={it.t === "run" ? `${r * 0.7} ${r * 0.5}` : undefined} />}
          <Polyline points={arrowHead(it.x, it.y, x2, y2, r * 1.1)} fill={col} stroke={col} strokeWidth={sw * 0.5} />
        </G>
      );
    }
  }
}

/** Zeichnung anzeigen (ohne Bedienung), z. B. als Vorschau in Listen. */
export function BoardView({ value, testID }: { value: Drawing; testID?: string }) {
  const [W, H] = PITCH[value.pitch];
  return (
    <View testID={testID} style={{ width: "100%", aspectRatio: (W + 2 * M) / (H + 2 * M), borderRadius: radius.m, overflow: "hidden", backgroundColor: "#2b8a3e" }}>
      <Svg width="100%" height="100%" viewBox={`${-M} ${-M} ${W + 2 * M} ${H + 2 * M}`}>
        {Array.from({ length: 8 }).map((_, i) => <Rect key={i} x={-M + i * (W + 2 * M) / 8} y={-M} width={(W + 2 * M) / 16} height={H + 2 * M} fill="rgba(255,255,255,0.04)" />)}
        <Markings pitch={value.pitch} />
        {value.items.map(it => <Item key={it.id} it={it} W={W} />)}
      </Svg>
    </View>
  );
}

let seq = 1;
const nid = () => "i" + Date.now().toString(36) + (seq++);

/** Zeichentool mit Werkzeugleiste. */
export function BoardEditor({ value, onChange, testID = "board" }: { value: Drawing; onChange: (d: Drawing) => void; testID?: string }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const [tool, setTool] = useState<Tool>("a");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const hist = useRef<Drawing[]>([]);
  const drag = useRef<{ id: string; mode: "new" | "move"; dx: number; dy: number } | null>(null);
  const [W, H] = PITCH[value.pitch];
  const toM = (e: GestureResponderEvent) => {
    const fx = size.w ? e.nativeEvent.locationX / size.w : 0, fy = size.h ? e.nativeEvent.locationY / size.h : 0;
    return { x: Math.round((fx * (W + 2 * M) - M) * 10) / 10, y: Math.round((fy * (H + 2 * M) - M) * 10) / 10 };
  };
  const clampP = (p: { x: number; y: number }) => ({ x: Math.max(-M, Math.min(W + M, p.x)), y: Math.max(-M, Math.min(H + M, p.y)) });
  const push = (items: BoardItem[], pitch: Drawing["pitch"] = value.pitch) => { hist.current.push(value); if (hist.current.length > 40) hist.current.shift(); onChange({ pitch, items }); };
  const hit = (p: { x: number; y: number }): BoardItem | null => {
    const r = W * 0.04; let best: BoardItem | null = null, bd = r;
    for (const it of value.items) {
      const pts = LINES.includes(it.t) ? [[it.x, it.y], [it.x2 ?? it.x, it.y2 ?? it.y], [((it.x2 ?? it.x) + it.x) / 2, ((it.y2 ?? it.y) + it.y) / 2]] : [[it.x, it.y]];
      for (const [x, y] of pts) { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = it; } }
    }
    return best;
  };
  const nextNo = (k: BoardKind) => Math.max(0, ...value.items.filter(x => x.t === k).map(x => x.n || 0)) + 1;
  const grant = (e: GestureResponderEvent) => {
    const p = clampP(toM(e));
    if (tool === "del") { const h = hit(p); if (h) push(value.items.filter(x => x.id !== h.id)); return; }
    if (tool === "move") { const h = hit(p); if (h) { hist.current.push(value); drag.current = { id: h.id, mode: "move", dx: p.x - h.x, dy: p.y - h.y }; } return; }
    const it: BoardItem = { id: nid(), t: tool, x: p.x, y: p.y };
    if (LINES.includes(tool)) { it.x2 = p.x; it.y2 = p.y; drag.current = { id: it.id, mode: "new", dx: 0, dy: 0 }; }
    if (tool === "a" || tool === "b" || tool === "gk") it.n = tool === "gk" ? 1 : nextNo(tool);
    push([...value.items, it]);
  };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current; if (!d) return; const p = clampP(toM(e));
    onChange({ ...value, items: value.items.map(it => {
      if (it.id !== d.id) return it;
      if (d.mode === "new") return { ...it, x2: p.x, y2: p.y };
      const nx = p.x - d.dx, ny = p.y - d.dy, ox = nx - it.x, oy = ny - it.y;
      return LINES.includes(it.t) ? { ...it, x: nx, y: ny, x2: (it.x2 ?? it.x) + ox, y2: (it.y2 ?? it.y) + oy } : { ...it, x: nx, y: ny };
    }) });
  };
  const release = () => {
    const d = drag.current; drag.current = null;
    if (d?.mode === "new") { const it = value.items.find(x => x.id === d.id); if (it && Math.hypot((it.x2 ?? it.x) - it.x, (it.y2 ?? it.y) - it.y) < W * 0.02) onChange({ ...value, items: value.items.filter(x => x.id !== d.id) }); }
  };
  const tools: { k: Tool; label: string; col?: string }[] = [
    { k: "a", label: "A", col: COL.a }, { k: "b", label: "B", col: COL.b }, { k: "gk", label: "TW", col: COL.gk }, { k: "cone", label: "▲", col: COL.cone },
    { k: "ball", label: "⚽" }, { k: "goal", label: "▭" }, { k: "pass", label: "→" }, { k: "run", label: "⇢" }, { k: "drib", label: "∿" }, { k: "zone", label: "▢" },
    { k: "move", label: "✥" }, { k: "del", label: "✕" },
  ];
  return (
    <View testID={testID} style={{ gap: 8 }}>
      <Seg testID={testID + "-pitch"} value={value.pitch} onChange={pitch => {
        // Feldwechsel: Positionen proportional übertragen, damit die Aufstellung erhalten bleibt.
        const [w0, h0] = PITCH[value.pitch], [w, h] = PITCH[pitch], fx = w / w0, fy = h / h0;
        const r1 = (n: number) => Math.round(n * 10) / 10;
        push(value.items.map(it => ({ ...it, x: r1(it.x * fx), y: r1(it.y * fy), x2: it.x2 != null ? r1(it.x2 * fx) : undefined, y2: it.y2 != null ? r1(it.y2 * fy) : undefined })), pitch);
      }}
        options={(["full", "half", "box", "free"] as const).map(k => ({ key: k, label: t("bd_" + k) }))} wrap />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {tools.map(x => (
          <Pressable key={x.k} testID={testID + "-tool-" + x.k} accessibilityRole="radio" accessibilityState={{ checked: tool === x.k }} accessibilityLabel={t("bd_t_" + x.k)} onPress={() => setTool(x.k)}
            style={{ minWidth: 40, height: 36, borderRadius: radius.s, borderWidth: 1.5, borderColor: tool === x.k ? c.accent : c.line, backgroundColor: tool === x.k ? c.accentSoft : c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: x.col || c.ink }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ width: "100%" }}>
        <View pointerEvents="none"><BoardView value={value} /></View>
        <View testID={testID + "-surface"} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
          onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} />
      </View>
      <Row gap={8}>
        <Btn small label={t("bd_undo")} disabled={!hist.current.length} onPress={() => { const prev = hist.current.pop(); if (prev) onChange(prev); }} />
        <Btn small kind="ghost" label={t("bd_clear")} disabled={!value.items.length} onPress={() => push([])} />
        <Text style={{ flex: 1, fontSize: 12, color: c.muted, textAlign: "right" }}>{t("bd_t_" + tool)}</Text>
      </Row>
    </View>
  );
}

export const emptyDrawing = (): Drawing => ({ pitch: "half", items: [] });
