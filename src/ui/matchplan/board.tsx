// Matchplan: Taktiktafel einer Folie – Spielfeld mit Bedienung. Werkzeuge: Bewegen, eigene Spieler, Gegner, Ball,
// Hütchen, Text, Pass, Laufweg, Dribbling, Linie, Zone, Löschen. Im Ausschnitt-Modus verschiebt Ziehen den
// Ausschnitt, zwei Finger zoomen. Rückgängig/Wiederholen über einen Verlauf (Elemente und Ausschnitt).
import React, { useRef, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { MP_COLORS, clampX, clampY, frameOf, isLine, linePoint, mpId, panFrame, withFrame, zoomFrame } from "../../core/matchplan";
import type { MpColor, MpContent, MpFrame, MpItem, MpSlide, MpTool } from "../../core/types";
import { useEngine } from "../../data/store";
import { Btn, Col, Field, NumField, Picker, Row, Seg } from "../kit";
import { radius, useTheme } from "../theme";
import { useTokenInfo } from "./common";
import { Pitch, geom, lineCol, tokenPx, usePitchWidth } from "./pitch";

export type Tool = "move" | MpTool | "del";
/** Werkzeuge in zwei Reihen: Figuren und Bearbeiten, Linien und Löschen */
export const TOOL_ROWS: Tool[][] = [["move", "own", "opp", "ball", "cone", "text"], ["pass", "run", "drib", "line", "zone", "del"]];
const ICON: Record<Tool, { icon: string; col?: string }> = {
  move: { icon: "✥" }, own: { icon: "●" }, opp: { icon: "●", col: "#c92a2a" }, ball: { icon: "⚽" }, cone: { icon: "▲", col: "#ff922b" }, text: { icon: "T" },
  pass: { icon: "→" }, run: { icon: "⇢" }, drib: { icon: "∿" }, line: { icon: "—" }, zone: { icon: "▢" }, del: { icon: "✕" },
};
/** Bogen einer Linie: stark links … stark rechts (in Laufrichtung) */
export const BENDS: { k: string; v: number; icon: string }[] = [{ k: "2", v: 2, icon: "↶↶" }, { k: "1", v: 1, icon: "↶" }, { k: "0", v: 0, icon: "—" }, { k: "-1", v: -1, icon: "↷" }, { k: "-2", v: -2, icon: "↷↷" }];

/** Stand für Rückgängig/Wiederholen */
type Snap = Pick<MpSlide, "items" | "view" | "frame">;
const snapOf = (s: MpSlide): Snap => ({ items: s.items, view: s.view, frame: s.frame ?? null });

/** Verlauf, Werkzeug, Farbe und Ausschnitt-Modus einer Tafel */
export function useBoard(slide: MpSlide, onChange: (s: MpSlide) => void) {
  const undo = useRef<Snap[]>([]), redo = useRef<Snap[]>([]);
  const [tool, setTool] = useState<Tool>("move");
  const [color, setColor] = useState<MpColor>("w");
  const [framing, setFraming] = useState(false);
  const [, bump] = useState(0);
  const cur = useRef(slide); cur.current = slide;
  /** Änderung übernehmen; record = im Verlauf merken (beim Ziehen nur beim ersten Schritt) */
  const commit = (next: MpSlide, record = true) => {
    if (record) { undo.current.push(snapOf(cur.current)); if (undo.current.length > 60) undo.current.shift(); redo.current = []; bump(x => x + 1); }
    onChange(next);
  };
  const step = (from: { current: Snap[] }, to: { current: Snap[] }) => {
    const s = from.current.pop(); if (!s) return;
    to.current.push(snapOf(cur.current));
    onChange({ ...cur.current, ...s }); bump(x => x + 1);
  };
  return {
    tool, setTool, color, setColor, framing, setFraming, commit,
    canUndo: undo.current.length > 0, canRedo: redo.current.length > 0,
    undo: () => step(undo, redo), redo: () => step(redo, undo),
    /** letzte Änderung verwerfen (ohne Wiederholen), z. B. eine zu kurze neue Linie */
    discard: () => { const s = undo.current.pop(); if (s) { onChange({ ...cur.current, ...s }); bump(x => x + 1); } },
    /** neue Folie: Verlauf leeren */
    reset: () => { undo.current = []; redo.current = []; bump(x => x + 1); },
  };
}
export type BoardState = ReturnType<typeof useBoard>;

type DragMode = { id: string; mode: "move" | "p1" | "p2" | "new"; dx: number; dy: number; moved: boolean; x0: number; y0: number };
type Gesture = { kind: "pan"; x0: number; y0: number; f0: MpFrame; moved: boolean } | { kind: "pinch"; d0: number; mx0: number; my0: number; m0: { x: number; y: number }; f0: MpFrame; moved: boolean };
type Touch = { pageX: number; pageY: number };

/**
 * Spielfeld einer Folie mit Bedienung (ohne Werkzeugleiste). maxH/maxW begrenzen die Größe; der Ausschnitt füllt die
 * verfügbare Breite. onEdit: Element antippen (Bewegen), onText: Stelle für einen neuen Text.
 */
export function BoardCanvas({ slide, c, B, ro, testID = "mp-board", maxH, maxW = 560, onEdit, onText, selected }: {
  slide: MpSlide; c: Pick<MpContent, "mode" | "size" | "captain" | "look">; B: BoardState; ro?: boolean; testID?: string; maxH?: number; maxW?: number;
  onEdit?: (it: MpItem) => void; onText?: (p: { x: number; y: number }) => void; selected?: string | null;
}) {
  const { c: col } = useTheme(); const info = useTokenInfo();
  const [W, setW] = useState(0);
  const f = frameOf(slide);
  const pw = usePitchWidth(f, W, maxH, maxW), g = geom(f, pw), ox = Math.max(0, (W - pw) / 2), size = slide.size || c.size, d = tokenPx(pw, size, f);
  const drag = useRef<DragMode | null>(null), gest = useRef<Gesture | null>(null), off = useRef({ x: 0, y: 0 });
  const tool = B.tool;

  const toM = (lx: number, ly: number) => { const m = g.m(lx - ox, ly); return { x: clampX(m.x), y: clampY(m.y) }; };
  const inside = (e: GestureResponderEvent) => { const x = e.nativeEvent.locationX - ox, y = e.nativeEvent.locationY; return x >= 0 && x <= pw && y >= 0 && y <= g.h; };
  const hitR = (it: MpItem): number => it.t === "own" ? (d / 2 + 6) / g.k : it.t === "opp" ? (d * 0.41 + 6) / g.k : it.t === "text" ? 4 : Math.max(1.6, 12 / g.k);
  const hit = (p: { x: number; y: number }): { it: MpItem; part: "move" | "p1" | "p2" } | null => {
    let best: { it: MpItem; part: "move" | "p1" | "p2" } | null = null, bd = Infinity;
    for (const it of [...slide.items].reverse()) {
      if (isLine(it.t)) {
        const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, r = Math.max(2.2, 16 / g.k), mid = linePoint(it, 0.5);
        const cand: [number, "move" | "p1" | "p2"][] = [[Math.hypot(it.x - p.x, it.y - p.y), "p1"], [Math.hypot(x2 - p.x, y2 - p.y), "p2"], [Math.hypot(mid.x - p.x, mid.y - p.y), "move"]];
        for (const [dist, part] of cand) if (dist < r && dist < bd) { bd = dist; best = { it, part }; }
        if (it.t === "zone" && !best && p.x >= Math.min(it.x, x2) && p.x <= Math.max(it.x, x2) && p.y >= Math.min(it.y, y2) && p.y <= Math.max(it.y, y2)) best = { it, part: "move" };
      } else { const dist = Math.hypot(it.x - p.x, it.y - p.y); if (dist < hitR(it) && dist < bd) { bd = dist; best = { it, part: "move" }; } }
    }
    return best;
  };
  const touches = (e: GestureResponderEvent): Touch[] => ((e.nativeEvent as unknown as { touches?: Touch[] }).touches || []);
  const setItems = (items: MpItem[], record = true) => B.commit({ ...slide, items }, record);

  // ---------- Ausschnitt verschieben / zoomen ----------
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
    if (T.length >= 2 && G.kind === "pan") { frameStart(e); G = gest.current!; G.moved = true; G.f0 = f; return; }
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
    const first = !G.moved; G.moved = true;
    B.commit(withFrame(slide, nf), first);
  };

  // ---------- Zeichnen und Bewegen ----------
  const start = (e: GestureResponderEvent): boolean => {
    if (ro || !inside(e)) return false;
    if (B.framing) return true;
    return tool === "move" || tool === "del" ? !!hit(toM(e.nativeEvent.locationX, e.nativeEvent.locationY)) : true;
  };
  const grant = (e: GestureResponderEvent) => {
    if (B.framing) { frameStart(e); return; }
    const p = toM(e.nativeEvent.locationX, e.nativeEvent.locationY), x0 = e.nativeEvent.locationX, y0 = e.nativeEvent.locationY;
    if (tool === "move") { const h = hit(p); if (h) drag.current = { id: h.it.id, mode: h.part, dx: p.x - h.it.x, dy: p.y - h.it.y, moved: false, x0, y0 }; return; }
    if (tool === "del") { const h = hit(p); if (h) setItems(slide.items.filter(x => x.id !== h.it.id)); return; }
    if (tool === "text") { onText?.(p); return; }
    const it: MpItem = { id: mpId("i"), t: tool as MpTool, x: p.x, y: p.y };
    if (isLine(it.t)) { it.x2 = p.x; it.y2 = p.y; it.col = tool === "run" && B.color === "w" ? "y" : B.color; drag.current = { id: it.id, mode: "new", dx: 0, dy: 0, moved: false, x0, y0 }; }
    else drag.current = { id: it.id, mode: "move", dx: 0, dy: 0, moved: true, x0, y0 };
    setItems([...slide.items, it]);
  };
  const move = (e: GestureResponderEvent) => {
    if (B.framing) { frameMove(e); return; }
    const dr = drag.current; if (!dr) return;
    if (!dr.moved && Math.hypot(e.nativeEvent.locationX - dr.x0, e.nativeEvent.locationY - dr.y0) < 6) return;
    const first = !dr.moved && dr.mode !== "new";
    dr.moved = true;
    const p = toM(e.nativeEvent.locationX, e.nativeEvent.locationY);
    setItems(slide.items.map(it => {
      if (it.id !== dr.id) return it;
      if (dr.mode === "new" || dr.mode === "p2") return { ...it, x2: p.x, y2: p.y };
      if (dr.mode === "p1") return { ...it, x: p.x, y: p.y };
      const nx = clampX(p.x - dr.dx), ny = clampY(p.y - dr.dy);
      return isLine(it.t) ? { ...it, x: nx, y: ny, x2: clampX((it.x2 ?? it.x) + nx - it.x), y2: clampY((it.y2 ?? it.y) + ny - it.y) } : { ...it, x: nx, y: ny };
    }), first);
  };
  const release = () => {
    if (B.framing) { gest.current = null; return; }
    const dr = drag.current; drag.current = null; if (!dr) return;
    const it = slide.items.find(x => x.id === dr.id); if (!it) return;
    // zu kurze neue Linie: verwerfen (ohne Spur im Verlauf)
    if (dr.mode === "new" && Math.hypot((it.x2 ?? it.x) - it.x, (it.y2 ?? it.y) - it.y) < 2) { B.discard(); return; }
    if (tool === "move" && !dr.moved) onEdit?.(it);
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", height: W ? g.h : 260 }}>
      {W ? <>
        <View pointerEvents="none" style={{ position: "absolute", left: ox, top: 0 }}>
          <Pitch frame={f} items={slide.items} width={pw} mode={slide.mode || c.mode} size={size} accent={col.accent} accentInk={col.accentInk} info={info} captain={c.captain} look={c.look}
            selected={selected || null} testID={testID + "-pitch"} />
          {B.framing ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: pw, height: g.h, borderRadius: 12, borderWidth: 3, borderColor: "#ffd43b", borderStyle: "dashed" }} /> : null}
        </View>
        <View testID={testID + "-surface"} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          onStartShouldSetResponder={start} onMoveShouldSetResponder={() => !!drag.current || !!gest.current} onResponderTerminationRequest={() => false}
          onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={() => { drag.current = null; gest.current = null; }} />
      </> : null}
    </View>
  );
}

/** Werkzeuge mit Beschriftung (zwei Reihen) */
export function ToolGrid({ B, testID = "mp-board", only }: { B: BoardState; testID?: string; only?: Tool[] }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  return (
    <Col gap={6} testID={testID + "-tools"}>
      {TOOL_ROWS.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 6 }}>
          {row.filter(k => !only || only.includes(k)).map(k => {
            const on = B.tool === k && !B.framing;
            return (
              <Pressable key={k} testID={testID + "-tool-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t("mpt_" + k)} onPress={() => { B.setFraming(false); B.setTool(k); }}
                style={{ flex: 1, minWidth: 0, height: 52, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col.accent : col.line, backgroundColor: on ? col.accentSoft : col.surface, alignItems: "center", justifyContent: "center", gap: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 16, color: ICON[k].col || (k === "own" ? col.accent : k === "del" ? col.crit : col.ink) }}>{ICON[k].icon}</Text>
                <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: "700", color: on ? col.accentTx : col.muted }}>{t("mpts_" + k)}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Col>
  );
}

/** Linienfarben (passend zum Spielfeld-Design) */
export function ColorRow({ value, onChange, look, testID }: { value: MpColor; onChange: (k: MpColor) => void; look?: MpContent["look"]; testID: string }) {
  const E = useEngine(); const { c } = useTheme();
  return (
    <Row gap={8} testID={testID}>
      {MP_COLORS.map(k => <Pressable key={k} testID={testID + "-" + k} accessibilityRole="radio" accessibilityState={{ checked: value === k }} accessibilityLabel={E.t(k === "w" && look === "white" ? "mpc_wd" : "mpc_" + k)} onPress={() => onChange(k)}
        style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: lineCol(look, k), borderWidth: value === k ? 3 : 1, borderColor: value === k ? c.accent : c.line }} />)}
    </Row>
  );
}

/** Element bearbeiten (Antippen im Modus „Bewegen“): Spieler, Rückennummer, Text, Art, Bogen und Farbe der Linie */
export function ItemForm({ it, squad, look, onSave, onDelete }: { it: MpItem; squad: string[]; look?: MpContent["look"]; onSave: (x: MpItem) => void; onDelete: () => void }) {
  const E = useEngine(); const { t } = E; const info = useTokenInfo();
  const [x, setX] = useState<MpItem>(it);
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
      {isLine(it.t) ? <Col gap={10}>
        {it.t !== "zone" ? <Seg testID="mp-item-kind" value={x.t} onChange={k => setX({ ...x, t: k })} options={(["pass", "run", "drib", "line"] as const).map(k => ({ key: k, label: t("mpt_" + k) }))} wrap /> : null}
        {it.t !== "zone" ? <Col gap={4}><T2 text={t("mp_bend")} />
          <Seg testID="mp-item-bend" value={String(x.bend || 0)} onChange={k => { const v = Number(k), y = { ...x }; delete y.bend; setX(v ? { ...y, bend: v } : y); }}
            options={BENDS.map(b => ({ key: b.k, label: b.icon }))} />
        </Col> : null}
        <ColorRow testID="mp-item-col" value={x.col || (x.t === "run" ? "y" : "w")} onChange={k => setX({ ...x, col: k })} look={look} />
      </Col> : null}
      <Row gap={8} wrap>
        {it.t !== "ball" && it.t !== "cone" ? <Btn testID="mp-item-save" kind="primary" label={t("save")} onPress={() => onSave(x)} /> : null}
        <Btn testID="mp-item-del" kind="danger" label={t("mp_itemDel")} onPress={onDelete} />
      </Row>
    </Col>
  );
}
function T2({ text }: { text: string }) { const { c } = useTheme(); return <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.muted }}>{text}</Text>; }

export function TextForm({ onSave }: { onSave: (t: string) => void }) {
  const E = useEngine(); const [txt, setTxt] = useState("");
  return <Col gap={10}>
    <Field testID="mp-text" label={E.t("mpt_text")} value={txt} onChangeText={setTxt} maxLength={40} placeholder={E.t("mp_textPh")} />
    <Btn testID="mp-text-save" kind="primary" label={E.t("save")} disabled={!txt.trim()} onPress={() => onSave(txt.trim())} />
  </Col>;
}

