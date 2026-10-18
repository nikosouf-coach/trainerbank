// Matchplan: Taktik- und Standardfolien – mehrere Folien je Plan, Ausschnitt (z. B. nur der Strafraum für Ecken),
// eigene Spieler und Gegner verschieben, Pässe, Laufwege, Dribblings, Linien, Zonen, Ball, Hütchen und Text.
import React, { useRef, useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { MP_COLORS, MP_VIEW_KEYS, SLIDE_CATS, catView, clampX, clampY, fitToView, isLine, isSetPiece, mpId, newSlide, squadOf } from "../../core/matchplan";
import type { MpColor, MpContent, MpItem, MpSlide, MpSlideCat, MpTool, MpView } from "../../core/types";
import { useEngine } from "../../data/store";
import { Btn, Card, Check, Col, Field, Muted, NumField, Picker, Row, Seg, Sheet, T, ToggleRow } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { useTokenInfo } from "./common";
import { LINE_COL, Pitch, geom, tokenPx, usePitchWidth } from "./pitch";

export type Tool = "move" | MpTool | "del";
const TOOLS: { k: Tool; icon: string; col?: string }[] = [
  { k: "move", icon: "✥" }, { k: "pass", icon: "→" }, { k: "run", icon: "⇢" }, { k: "drib", icon: "∿" }, { k: "line", icon: "—" }, { k: "zone", icon: "▢" },
  { k: "own", icon: "●" }, { k: "opp", icon: "●", col: "#c92a2a" }, { k: "ball", icon: "⚽" }, { k: "cone", icon: "▲", col: "#ff922b" }, { k: "text", icon: "T" }, { k: "del", icon: "✕" },
];
type DragMode = { id: string; mode: "move" | "p1" | "p2" | "new"; dx: number; dy: number; moved: boolean; x0: number; y0: number };

/** Taktiktafel einer Folie */
export function SlideBoard({ slide, c, onChange, ro, testID = "mp-board", only }: { slide: MpSlide; c: MpContent; onChange: (s: MpSlide) => void; ro?: boolean; testID?: string; only?: Tool[] }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  const info = useTokenInfo();
  const [W, setW] = useState(0);
  const [tool, setTool] = useState<Tool>("move");
  const [color, setColor] = useState<MpColor>("w");
  const [edit, setEdit] = useState<MpItem | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const hist = useRef<MpItem[][]>([]);
  const drag = useRef<DragMode | null>(null);
  const pw = usePitchWidth(slide.view, W), g = geom(slide.view, pw), ox = Math.max(0, (W - pw) / 2), d = tokenPx(pw, c.size);

  const setItems = (items: MpItem[], keep = false) => { if (!keep) { hist.current.push(slide.items); if (hist.current.length > 40) hist.current.shift(); } onChange({ ...slide, items }); };
  const toM = (e: GestureResponderEvent) => { const m = g.m(e.nativeEvent.locationX - ox, e.nativeEvent.locationY); return { x: clampX(m.x), y: clampY(m.y) }; };
  const inside = (e: GestureResponderEvent) => { const x = e.nativeEvent.locationX - ox, y = e.nativeEvent.locationY; return x >= 0 && x <= pw && y >= 0 && y <= g.h; };
  const hitR = (it: MpItem): number => it.t === "own" ? (d / 2 + 6) / g.k : it.t === "opp" ? (d * 0.41 + 6) / g.k : it.t === "text" ? 4 : 2.2;
  const hit = (p: { x: number; y: number }): { it: MpItem; part: "move" | "p1" | "p2" } | null => {
    let best: { it: MpItem; part: "move" | "p1" | "p2" } | null = null, bd = Infinity;
    for (const it of [...slide.items].reverse()) {
      if (isLine(it.t)) {
        const x2 = it.x2 ?? it.x, y2 = it.y2 ?? it.y, r = 2.6;
        const cand: [number, "move" | "p1" | "p2"][] = [[Math.hypot(it.x - p.x, it.y - p.y), "p1"], [Math.hypot(x2 - p.x, y2 - p.y), "p2"], [Math.hypot((it.x + x2) / 2 - p.x, (it.y + y2) / 2 - p.y), "move"]];
        for (const [dist, part] of cand) if (dist < r && dist < bd) { bd = dist; best = { it, part }; }
        if (it.t === "zone" && !best && p.x >= Math.min(it.x, x2) && p.x <= Math.max(it.x, x2) && p.y >= Math.min(it.y, y2) && p.y <= Math.max(it.y, y2)) best = { it, part: "move" };
      } else { const dist = Math.hypot(it.x - p.x, it.y - p.y); if (dist < hitR(it) && dist < bd) { bd = dist; best = { it, part: "move" }; } }
    }
    return best;
  };
  const start = (e: GestureResponderEvent): boolean => {
    if (ro || !inside(e)) return false;
    return tool === "move" || tool === "del" ? !!hit(toM(e)) : true;
  };
  const grant = (e: GestureResponderEvent) => {
    const p = toM(e), x0 = e.nativeEvent.locationX, y0 = e.nativeEvent.locationY;
    if (tool === "move") { const h = hit(p); if (h) drag.current = { id: h.it.id, mode: h.part, dx: p.x - h.it.x, dy: p.y - h.it.y, moved: false, x0, y0 }; return; }
    if (tool === "del") { const h = hit(p); if (h) setItems(slide.items.filter(x => x.id !== h.it.id)); return; }
    if (tool === "text") { setTextAt(p); return; }
    const it: MpItem = { id: mpId("i"), t: tool as MpTool, x: p.x, y: p.y };
    if (isLine(it.t)) { it.x2 = p.x; it.y2 = p.y; it.col = tool === "run" && color === "w" ? "y" : color; drag.current = { id: it.id, mode: "new", dx: 0, dy: 0, moved: false, x0, y0 }; }
    else drag.current = { id: it.id, mode: "move", dx: 0, dy: 0, moved: true, x0, y0 };
    setItems([...slide.items, it]);
  };
  const move = (e: GestureResponderEvent) => {
    const dr = drag.current; if (!dr) return;
    if (!dr.moved && Math.hypot(e.nativeEvent.locationX - dr.x0, e.nativeEvent.locationY - dr.y0) < 6) return;
    if (!dr.moved && dr.mode !== "new") hist.current.push(slide.items);
    dr.moved = true;
    const p = toM(e);
    setItems(slide.items.map(it => {
      if (it.id !== dr.id) return it;
      if (dr.mode === "new" || dr.mode === "p2") return { ...it, x2: p.x, y2: p.y };
      if (dr.mode === "p1") return { ...it, x: p.x, y: p.y };
      const nx = clampX(p.x - dr.dx), ny = clampY(p.y - dr.dy);
      return isLine(it.t) ? { ...it, x: nx, y: ny, x2: clampX((it.x2 ?? it.x) + nx - it.x), y2: clampY((it.y2 ?? it.y) + ny - it.y) } : { ...it, x: nx, y: ny };
    }), true);
  };
  const release = () => {
    const dr = drag.current; drag.current = null; if (!dr) return;
    const it = slide.items.find(x => x.id === dr.id); if (!it) return;
    if (dr.mode === "new" && Math.hypot((it.x2 ?? it.x) - it.x, (it.y2 ?? it.y) - it.y) < 2) { onChange({ ...slide, items: slide.items.filter(x => x.id !== dr.id) }); hist.current.pop(); return; }
    if (tool === "move" && !dr.moved) setEdit(it);
  };
  const updItem = (it: MpItem | null, del = false) => {
    if (!edit) return;
    setItems(del || !it ? slide.items.filter(x => x.id !== edit.id) : slide.items.map(x => x.id === edit.id ? it : x)); setEdit(null);
  };
  const squad = squadOf(c);
  return (
    <Col gap={10}>
      {!ro ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }} testID={testID + "-tools"}>
        {TOOLS.filter(x => !only || only.includes(x.k)).map(x => (
          <Pressable key={x.k} testID={testID + "-tool-" + x.k} accessibilityRole="radio" accessibilityState={{ checked: tool === x.k }} accessibilityLabel={t("mpt_" + x.k)} onPress={() => setTool(x.k)}
            style={{ minWidth: 40, height: 36, borderRadius: radius.s, borderWidth: 1.5, borderColor: tool === x.k ? col.accent : col.line, backgroundColor: tool === x.k ? col.accentSoft : col.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: x.col || (x.k === "own" ? col.accent : col.ink) }}>{x.icon}</Text>
          </Pressable>
        ))}
      </View> : null}
      {!ro && (isLine(tool as MpTool) || tool === "text") ? <Row gap={6} testID={testID + "-colors"}>
        {MP_COLORS.map(k => <Pressable key={k} testID={testID + "-col-" + k} accessibilityRole="radio" accessibilityState={{ checked: color === k }} accessibilityLabel={t("mpc_" + k)} onPress={() => setColor(k)}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: LINE_COL[k], borderWidth: color === k ? 3 : 1, borderColor: color === k ? col.accent : col.line }} />)}
      </Row> : null}
      <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", height: W ? g.h : 260 }}>
        {W ? <>
          <View pointerEvents="none" style={{ position: "absolute", left: ox, top: 0 }}>
            <Pitch view={slide.view} items={slide.items} width={pw} mode={c.mode} size={c.size} accent={col.accent} accentInk={col.accentInk} info={info} captain={c.captain} selected={edit?.id || null} testID={testID + "-pitch"} />
          </View>
          <View testID={testID + "-surface"} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
            onStartShouldSetResponder={start} onMoveShouldSetResponder={() => !!drag.current} onResponderTerminationRequest={() => false}
            onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={() => { drag.current = null; }} />
        </> : null}
      </View>
      {!ro ? <Row gap={8} wrap>
        <Btn small testID={testID + "-undo"} label={t("bd_undo")} disabled={!hist.current.length} onPress={() => { const prev = hist.current.pop(); if (prev) onChange({ ...slide, items: prev }); }} />
        <Muted small style={{ flex: 1, textAlign: "right" }}>{t("mpt_" + tool + "_h")}</Muted>
      </Row> : null}
      {/* Element bearbeiten (Antippen im Modus „Bewegen“) */}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit ? t("mpt_" + edit.t) : ""} testID="mp-item-sheet" closeLabel={t("cancel")}>
        {edit ? <ItemForm key={edit.id} it={edit} squad={squad} onSave={x => updItem(x)} onDelete={() => updItem(null, true)} /> : null}
      </Sheet>
      <Sheet visible={!!textAt} onClose={() => setTextAt(null)} title={t("mpt_text")} testID="mp-text-sheet" closeLabel={t("cancel")}>
        {textAt ? <TextForm onSave={txt => { setItems([...slide.items, { id: mpId("i"), t: "text", x: textAt.x, y: textAt.y, label: txt.slice(0, 40), col: color }]); setTextAt(null); }} /> : null}
      </Sheet>
    </Col>
  );
}

function TextForm({ onSave }: { onSave: (t: string) => void }) {
  const E = useEngine(); const [txt, setTxt] = useState("");
  return <Col gap={10}>
    <Field testID="mp-text" label={E.t("mpt_text")} value={txt} onChangeText={setTxt} maxLength={40} placeholder={E.t("mp_textPh")} />
    <Btn testID="mp-text-save" kind="primary" label={E.t("save")} disabled={!txt.trim()} onPress={() => onSave(txt.trim())} />
  </Col>;
}

function ItemForm({ it, squad, onSave, onDelete }: { it: MpItem; squad: string[]; onSave: (x: MpItem) => void; onDelete: () => void }) {
  const E = useEngine(); const { t } = E; const info = useTokenInfo(); const { c } = useTheme();
  const [x, setX] = useState<MpItem>(it);
  return (
    <Col gap={12}>
      {it.t === "own" ? <Picker testID="mp-item-player" label={t("mp_player")} value={x.pid || ""} onChange={k => setX({ ...x, pid: k || null })}
        options={[{ key: "", label: t("mp_noPlayer") }, ...[...new Set([...squad, ...E.D.players.map(p => p.id)])].map(pid => ({ key: pid, label: (info(pid)?.nr != null ? info(pid)!.nr + " " : "") + (info(pid)?.p ? E.name(info(pid)!.p!) : "?") }))]} /> : null}
      {it.t === "opp" ? <Row gap={10} wrap>
        <NumField testID="mp-item-n" label={t("mp_oppNr")} value={x.n ?? null} min={0} max={99} onChange={n => setX({ ...x, n })} style={{ width: 110 }} />
        <Field testID="mp-item-label" label={t("mp_posShort")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 4) })} maxLength={4} style={{ width: 110 }} />
      </Row> : null}
      {it.t === "text" ? <Field testID="mp-item-text" label={t("mpt_text")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 40) })} maxLength={40} /> : null}
      {isLine(it.t) ? <Col gap={8}>
        {it.t !== "zone" ? <Seg testID="mp-item-kind" value={x.t} onChange={k => setX({ ...x, t: k })} options={(["pass", "run", "drib", "line"] as const).map(k => ({ key: k, label: t("mpt_" + k) }))} wrap /> : null}
        <Row gap={6}>{MP_COLORS.map(k => <Pressable key={k} testID={"mp-item-col-" + k} accessibilityRole="radio" accessibilityState={{ checked: (x.col || "w") === k }} accessibilityLabel={t("mpc_" + k)} onPress={() => setX({ ...x, col: k })}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: LINE_COL[k], borderWidth: (x.col || "w") === k ? 3 : 1, borderColor: (x.col || "w") === k ? c.accent : c.line }} />)}</Row>
      </Col> : null}
      <Row gap={8} wrap>
        {it.t !== "ball" && it.t !== "cone" ? <Btn testID="mp-item-save" kind="primary" label={t("save")} onPress={() => onSave(x)} /> : null}
        <Btn testID="mp-item-del" kind="danger" label={t("mp_itemDel")} onPress={onDelete} />
      </Row>
    </Col>
  );
}

/** Folienliste mit aktueller Folie: anlegen, umbenennen, Ausschnitt, für Spieler sichtbar, verschieben, kopieren, löschen */
export function SlidesPanel({ c, onChange, ro }: { c: MpContent; onChange: (c: MpContent) => void; ro?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme();
  const [cur, setCur] = useState<string | null>(c.slides[0]?.id || null);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const i = Math.max(0, c.slides.findIndex(x => x.id === cur)), sl = c.slides[i] || null;
  const setSlide = (x: MpSlide) => onChange({ ...c, slides: c.slides.map(y => y.id === x.id ? x : y) });
  const moveSlide = (dir: number) => { const L = [...c.slides], j = i + dir; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; onChange({ ...c, slides: L }); };
  const label = (x: MpSlide) => x.title || t("msc_" + x.cat);
  return (
    <Col gap={14}>
      <Row wrap gap={6} testID="mp-slides">
        {c.slides.map(x => {
          const on = sl?.id === x.id;
          return (
            <Pressable key={x.id} testID={"mp-slide-" + x.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setCur(x.id); setConfirmDel(false); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.m, borderWidth: 1.5,
                borderColor: on ? col.accent : col.line, backgroundColor: on ? col.accentSoft : col.surface, opacity: x.vis ? 1 : 0.6 }}>
              <Text style={{ fontSize: 10.5, fontWeight: "800", color: isSetPiece(x.cat) ? col.event : col.accentTx }}>{isSetPiece(x.cat) ? t("mp_sp") : t("mp_tac")}</Text>
              <Text numberOfLines={1} style={{ maxWidth: 170, fontWeight: "700", fontSize: 13, color: col.ink }}>{label(x)}</Text>
              {!x.vis ? <Text style={{ fontSize: 11, color: col.muted }}>🔒</Text> : null}
            </Pressable>
          );
        })}
        {!ro && c.slides.length < 20 ? <Btn small icon="plus" testID="mp-slide-add" label={t("mp_slideAdd")} onPress={() => setAdding(true)} /> : null}
      </Row>
      {!c.slides.length ? <Card><Muted>{t("mp_slidesNone")}</Muted></Card> : null}
      {sl ? <Card testID="mp-slide-card">
        <Row between wrap gap={8}>
          <T v="h3" style={{ flexShrink: 1 }}>{label(sl)}</T>
          <Muted small>{tf("mp_slideN", { i: i + 1, n: c.slides.length })}</Muted>
        </Row>
        {!ro ? <Row wrap gap={10} align="flex-end">
          <Field testID="mp-slide-title" label={t("mp_slideTitle")} value={sl.title} onChangeText={v => setSlide({ ...sl, title: v.slice(0, 60) })} maxLength={60} style={{ flex: 1, minWidth: 180 }} />
          <Picker testID="mp-slide-cat" label={t("mp_slideCat")} value={sl.cat} onChange={k => setSlide({ ...sl, cat: k })} options={SLIDE_CATS.map(k => ({ key: k, label: t("msc_" + k) }))} style={{ width: 200 }} />
        </Row> : null}
        <Seg testID="mp-slide-view" value={sl.view} onChange={(v: MpView) => setSlide(ro ? sl : { ...sl, view: v, items: fitToView(sl.items, v) })} options={MP_VIEW_KEYS.map(k => ({ key: k, label: t("mpv_" + k) }))} wrap />
        <SlideBoard key={sl.id} slide={sl} c={c} onChange={setSlide} ro={ro} />
        {!ro ? <Field testID="mp-slide-note" label={t("mp_slideNote")} value={sl.note} onChangeText={v => setSlide({ ...sl, note: v.slice(0, 1500) })} multiline maxLength={1500} placeholder={t("mp_slideNotePh")} />
          : sl.note ? <T>{sl.note}</T> : null}
        {!ro ? <>
          <ToggleRow testID="mp-slide-vis" label={t("mp_slideVis")} desc={t("mp_slideVisD")} value={sl.vis} onChange={v => setSlide({ ...sl, vis: v })} />
          <Row wrap gap={6}>
            <Btn small testID="mp-slide-left" label="←" a11y={t("mp_slideLeft")} disabled={i === 0} onPress={() => moveSlide(-1)} />
            <Btn small testID="mp-slide-right" label="→" a11y={t("mp_slideRight")} disabled={i >= c.slides.length - 1} onPress={() => moveSlide(1)} />
            <Btn small testID="mp-slide-dup" label={t("mp_slideDup")} disabled={c.slides.length >= 20} onPress={() => {
              const cp: MpSlide = { ...sl, id: mpId("s"), title: (sl.title || label(sl)).slice(0, 52) + " (2)", items: sl.items.map(x => ({ ...x, id: mpId("i") })) };
              const L = [...c.slides]; L.splice(i + 1, 0, cp); onChange({ ...c, slides: L }); setCur(cp.id);
            }} />
            <Btn small testID="mp-slide-lineup" label={t("mp_slideFromLineup")} onPress={() => {
              const own = c.lineup.filter(x => x.pid || x.label).map(x => ({ ...x, id: mpId("i") }));
              setSlide({ ...sl, items: [...fitToView(own, sl.view), ...sl.items.filter(x => x.t !== "own")] });
            }} />
            {!confirmDel ? <Btn small kind="ghost" testID="mp-slide-del" label={t("mp_slideDel")} onPress={() => setConfirmDel(true)} />
              : <Btn small kind="danger" testID="mp-slide-del-yes" label={t("mp_slideDelQ")} onPress={() => { onChange({ ...c, slides: c.slides.filter(x => x.id !== sl.id) }); setCur(c.slides[i + 1]?.id || c.slides[i - 1]?.id || null); setConfirmDel(false); }} />}
          </Row>
        </> : null}
      </Card> : null}
      <Sheet visible={adding} onClose={() => setAdding(false)} title={t("mp_slideNew")} testID="mp-slide-sheet" closeLabel={t("cancel")}>
        {adding ? <NewSlideForm c={c} onCreate={x => { onChange({ ...c, slides: [...c.slides, x] }); setCur(x.id); setAdding(false); }} /> : null}
      </Sheet>
    </Col>
  );
}

function NewSlideForm({ c, onCreate }: { c: MpContent; onCreate: (s: MpSlide) => void }) {
  const E = useEngine(); const { t } = E;
  const [cat, setCat] = useState<MpSlideCat>("grund");
  const [title, setTitle] = useState("");
  const [opp, setOpp] = useState(c.opp.items.length > 0);
  const groups: [string, MpSlideCat[]][] = [["mp_tac", SLIDE_CATS.filter(k => !isSetPiece(k))], ["mp_sp", SLIDE_CATS.filter(isSetPiece)]];
  return (
    <Col gap={12}>
      {groups.map(([k, L]) => <Col key={k} gap={6}><T v="small" bold>{t(k + "L")}</T>
        <Row wrap gap={6}>{L.map(x => <Btn key={x} small kind={cat === x ? "primary" : "default"} testID={"mp-new-cat-" + x} label={t("msc_" + x)} onPress={() => setCat(x)} />)}</Row>
      </Col>)}
      <Muted small>{t("mpv_" + catView(cat))}</Muted>
      <Field testID="mp-new-title" label={t("mp_slideTitle")} value={title} onChangeText={setTitle} placeholder={t("msc_" + cat)} maxLength={60} />
      {c.opp.items.length ? <Check testID="mp-new-opp" label={t("mp_withOpp")} value={opp} onChange={setOpp} /> : <Muted small>{t("mp_withOppNone")}</Muted>}
      <Btn testID="mp-new-create" kind="primary" label={t("mp_slideCreate")} onPress={() => onCreate(newSlide(c, cat, title.trim() || t("msc_" + cat), opp))} />
    </Col>
  );
}

/** Folien nur ansehen (Spieleransicht, Vorschau): Auswahl oben, Tafel, Notiz */
export function SlidesView({ slides, c, testID = "pv-slides" }: { slides: MpSlide[]; c: Pick<MpContent, "mode" | "size" | "captain">; testID?: string }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  const [i, setI] = useState(0); const [W, setW] = useState(0);
  const sl = slides[Math.min(i, slides.length - 1)];
  const pw = usePitchWidth(sl?.view || "full", W);
  if (!sl) return null;
  return (
    <Col gap={10} testID={testID}>
      <Row wrap gap={6}>
        {slides.map((x, k) => <Pressable key={x.id} testID={testID + "-" + k} accessibilityRole="tab" accessibilityState={{ selected: k === i }} onPress={() => setI(k)}
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.m, borderWidth: 1.5, borderColor: k === i ? col.accent : col.line, backgroundColor: k === i ? col.accentSoft : col.surface }}>
          <Text numberOfLines={1} style={{ maxWidth: 190, fontWeight: "700", fontSize: 13, color: col.ink }}>{x.title || t("msc_" + x.cat)}</Text>
        </Pressable>)}
      </Row>
      <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", alignItems: "center" }}>
        {W ? <Pitch view={sl.view} items={sl.items} width={pw} mode={c.mode} size={c.size} accent={col.accent} accentInk={col.accentInk} info={info} captain={c.captain} /> : null}
      </View>
      {sl.note ? <View style={{ padding: 12, borderRadius: radius.m, backgroundColor: withAlpha(col.accent, 0.07) }}><T>{sl.note}</T></View> : null}
    </Col>
  );
}
