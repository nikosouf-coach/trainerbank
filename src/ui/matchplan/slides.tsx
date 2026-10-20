// Matchplan: Taktik- und Standardfolien. Übersicht mit Vorschaubildern (Taktik / Standards), Editor im Vollbild
// (Tafel fest – nichts scrollt beim Zeichnen; Werkzeuge, Auswahl mit Griffen und Schnellaktionen, Ausschnitt mit Zoom
// und Voreinstellungen wie „16er vorne“, Coachingpunkte, Einstellungen je Folie), neue Folie (Vorlage je Art oder aus
// einem anderen Matchplan), Präsentation (auf Wunsch quer) und Spieleransicht.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FRAME_FORMATS, FRAME_MIN_W, MP_LIMITS, MP_VIEWS, MP_VIEW_KEYS, SLIDE_CATS, catView, copySlide, dashOf, fitToView, formatFrame, formatOf, frameOf, isArrow, isLine, isSetPiece, mpId,
  newSlide, outsideFrame, squadOf, withFrame, zoomFrame, zoomOf,
} from "../../core/matchplan";
import type { MpContent, MpItem, MpMode, MpSlide, MpSlideCat, MpTool, MpView } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Banner, Btn, Card, CardTitle, Check, Col, Field, Muted, Picker, Row, Seg, Sheet, T, ToggleRow } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { BoardCanvas, ColorRow, ItemForm, PlayerPick, SelBar, StrokeRow, TextForm, ToolGrid, addBlock, defCol, dupItem, hasColor, hasStroke, useBoard, type BoardState, type Tool } from "./board";
import { useTokenInfo } from "./common";
import { DisplayControls, SIZES, sizeKey } from "./lineup";
import { FrameThumb, Pitch } from "./pitch";
import { Watermark } from "./watermark";

type Disp = Pick<MpContent, "mode" | "size" | "captain" | "look">;
const slideLabel = (t: (k: string) => string, x: MpSlide): string => x.title || t("msc_" + x.cat);
/** Pfeil oder Freihandlinie mit Schrittnummer (Ablauf) */
const isStepped = (x: MpItem): boolean => !!x.n && (isArrow(x.t) || x.t === "free");
/** Ausschnitt als Text: Voreinstellung oder „Eigener Ausschnitt · 160 %“ */
const frameLabel = (t: (k: string) => string, x: MpSlide): string => x.frame ? `${t("mpv_custom")} · ${Math.round(zoomOf(x.frame) * 100)} %` : t("mpv_" + x.view);

// ---------- Einfache Tafel (z. B. Gegner verschieben) ----------
/** Tafel mit eigener Werkzeugleiste auf einer scrollbaren Seite (z. B. Gegneranalyse: only = ["move"]) */
export function SlideBoard({ slide, c, onChange, ro, testID = "mp-board", only }: { slide: MpSlide; c: MpContent; onChange: (s: MpSlide) => void; ro?: boolean; testID?: string; only?: Tool[] }) {
  const E = useEngine(); const { t } = E;
  const B = useBoard(slide, onChange);
  const [edit, setEdit] = useState<MpItem | null>(null);
  useEffect(() => { if (only?.length) B.setTool(only[0]); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selIt = B.sel ? slide.items.find(x => x.id === B.sel) || null : null;
  const setItem = (it: MpItem | null, id: string) => { B.commit({ ...slide, items: it ? slide.items.map(x => x.id === id ? it : x) : slide.items.filter(x => x.id !== id) }); if (!it) B.setSel(null); };
  const upd = (it: MpItem | null) => { if (!edit) return; setItem(it, edit.id); setEdit(null); };
  return (
    <Col gap={10}>
      {!ro && (!only || only.length > 1) ? <ToolGrid B={B} testID={testID} only={only} labels /> : null}
      <BoardCanvas slide={slide} c={c} B={B} ro={ro} testID={testID} onEdit={setEdit} hold />
      {!ro && selIt ? <SelBar it={selIt} look={c.look} testID={testID + "-sel"} onUpdate={x => setItem(x, selIt.id)} onDelete={() => setItem(null, selIt.id)}
        onEdit={() => setEdit(selIt)} onClose={() => B.setSel(null)} /> : null}
      {!ro ? <Row gap={8}><Btn small testID={testID + "-undo"} icon="undo" label={t("bd_undo")} disabled={!B.canUndo} onPress={B.undo} /></Row> : null}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit ? t("mpt_" + edit.t) : ""} testID="mp-item-sheet" closeLabel={t("cancel")}>
        {edit ? <ItemForm key={edit.id} it={edit} squad={squadOf(c)} look={c.look} onSave={upd} onDelete={() => upd(null)} /> : null}
      </Sheet>
    </Col>
  );
}

// ---------- Übersicht ----------
/** Folien des Plans: Vorschaubilder nach Taktik und Standards, neue Folie, Präsentieren, Darstellung */
export function SlidesPanel({ c, onChange, ro, planId }: { c: MpContent; onChange: (c: MpContent) => void; ro?: boolean; planId?: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  const [W, setW] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [present, setPresent] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const cols = W >= 900 ? 4 : W >= 600 ? 3 : 2, gap = 10, cw = W ? Math.floor((W - gap * (cols - 1)) / cols) : 160;
  const idx = (id: string) => c.slides.findIndex(x => x.id === id);
  const groups: [string, MpSlide[]][] = [["mp_tacL", c.slides.filter(x => !isSetPiece(x.cat))], ["mp_spL", c.slides.filter(x => isSetPiece(x.cat))]];
  // gleichbleibender Verweis: Vorschaubilder werden nur neu gezeichnet, wenn sich ihre Folie ändert
  const tap = useRef((sid: string) => { void sid; }); tap.current = (sid: string) => ro ? setPresent(idx(sid)) : setOpen(sid);
  const onCard = useCallback((sid: string) => tap.current(sid), []);
  return (
    <Col gap={14}>
      <Row between wrap gap={8}>
        <Muted small testID="mp-slides-count">{tf("mp_slidesSum", { n: c.slides.length, v: c.slides.filter(x => x.vis).length })}</Muted>
        <Row gap={8} wrap>
          {c.slides.length ? <Btn small testID="mp-present" label={"▶ " + t("mp_present")} onPress={() => setPresent(0)} /> : null}
          {!ro && c.slides.length < MP_LIMITS.slides ? <Btn small kind="primary" icon="plus" testID="mp-slide-add" label={t("mp_slideNew")} onPress={() => setAdding(true)} /> : null}
        </Row>
      </Row>
      {!c.slides.length ? <Card><Muted>{t("mp_slidesNone")}</Muted></Card> : null}
      <View testID="mp-slides" onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ gap: 16 }}>
        {W ? groups.map(([k, L]) => L.length ? (
          <Col key={k} gap={8}>
            <Row gap={8}>
              <T v="eyebrow">{t(k)}</T>
              <Text style={{ fontWeight: "800", fontSize: 11, color: col.muted }}>{L.length}</Text>
            </Row>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
              {L.map(x => <SlideCard key={x.id} sl={x} n={idx(x.id) + 1} look={c.look} info={info} width={cw} onPress={onCard} />)}
            </View>
          </Col>
        ) : null) : null}
      </View>
      {c.slides.length && !ro ? <Muted small>{t("mp_slidesHint")}</Muted> : null}
      {!ro ? <Card testID="mp-display"><CardTitle title={t("mp_display")} /><DisplayControls c={c} onChange={onChange} testID="mp-sl" /></Card> : null}

      {open && !ro ? <SlideEditor c={c} onChange={onChange} id={open} onOpen={setOpen} onClose={() => setOpen(null)} onPresent={i => { setOpen(null); setPresent(i); }} /> : null}
      {present != null && c.slides.length ? <Presenter slides={c.slides} start={present} c={c} onClose={() => setPresent(null)} showHidden /> : null}
      <Sheet visible={adding} onClose={() => setAdding(false)} title={t("mp_slideNew")} testID="mp-slide-sheet" closeLabel={t("cancel")}>
        {adding ? <NewSlideForm c={c} planId={planId} onCreate={x0 => {
          // „angelegt von“: wer die Folie erstellt bzw. übernommen hat
          const x: MpSlide = { ...x0 }; if (s.myStaff?.id) x.by = s.myStaff.id; else delete x.by;
          onChange({ ...c, slides: [...c.slides, x] }); setAdding(false); setOpen(x.id); }} /> : null}
      </Sheet>
    </Col>
  );
}

/** Vorschaubild einer Folie mit Nummer, Art, Titel und Ausschnitt */
const SlideCard = React.memo(function SlideCard({ sl, n, look, info, width, onPress }: { sl: MpSlide; n: number; look: MpContent["look"]; info: ReturnType<typeof useTokenInfo>; width: number; onPress: (id: string) => void }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  const f = frameOf(sl), areaH = Math.round(width * 0.8), pw = Math.max(40, Math.floor(Math.min(width - 12, (areaH - 12) * f.w / f.h)));
  const sp = isSetPiece(sl.cat), by = sl.by ? E.D.staff.find(x => x.id === sl.by)?.name || null : null;
  return (
    <Pressable testID={"mp-slide-" + sl.id} accessibilityRole="button" accessibilityLabel={`${n}. ${slideLabel(t, sl)}`} onPress={() => onPress(sl.id)}
      style={({ pressed }) => ({ width, borderRadius: radius.l, borderWidth: 1, borderColor: col.line, backgroundColor: col.surface, overflow: "hidden", opacity: pressed ? 0.85 : 1 })}>
      <View style={{ height: areaH, alignItems: "center", justifyContent: "center", backgroundColor: col.sunk }}>
        <Pitch mini frame={f} items={sl.items} width={pw} mode="num" size={1} accent={col.club} accentInk={col.clubInk} info={info} look={look} />
        {!sl.vis ? <View style={{ position: "absolute", right: 6, top: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "800" }}>🔒 {t("mp_staffOnly")}</Text></View> : null}
      </View>
      <View style={{ padding: 10, gap: 3 }}>
        <Row gap={6}>
          <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: withAlpha(sp ? col.event : col.accent, 0.15), alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: sp ? col.event : col.accentTx }}>{n}</Text>
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: "800", color: sp ? col.event : col.accentTx, textTransform: "uppercase", letterSpacing: 0.4 }}>{t("msc_" + sl.cat)}</Text>
        </Row>
        <Text numberOfLines={2} style={{ fontWeight: "800", fontSize: 14, color: col.ink }}>{slideLabel(t, sl)}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11.5, color: col.muted }}>{frameLabel(t, sl)}{sl.note ? " · " + t("mp_noteShort") : ""}</Text>
        {by ? <Text testID={"mp-slide-by-" + sl.id} numberOfLines={1} style={{ fontSize: 11, color: col.muted }}>{E.tf("mp_by", { n: by })}</Text> : null}
      </View>
    </Pressable>
  );
});

// ---------- Neue Folie ----------
function NewSlideForm({ c, planId, onCreate }: { c: MpContent; planId?: string; onCreate: (s: MpSlide) => void }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  const [cat, setCat] = useState<MpSlideCat>("grund");
  const [title, setTitle] = useState("");
  const [own, setOwn] = useState(true);
  const [opp, setOpp] = useState(c.opp.items.length > 0);
  const [imp, setImp] = useState(false);
  const groups: [string, MpSlideCat[]][] = [["mp_tac", SLIDE_CATS.filter(k => !isSetPiece(k))], ["mp_sp", SLIDE_CATS.filter(isSetPiece)]];
  // Folien aus anderen Matchplänen (neueste zuerst)
  const others = useMemo(() => E.D.plans.filter(p => p.id !== planId && p.c.slides.length)
    .sort((a, b) => (b.updatedAt || "") < (a.updatedAt || "") ? -1 : 1), [E, planId]);
  return (
    <Col gap={12}>
      {groups.map(([k, L]) => <Col key={k} gap={6}><T v="small" bold>{t(k + "L")}</T>
        <Row wrap gap={6}>{L.map(x => <Btn key={x} small kind={cat === x ? "primary" : "default"} testID={"mp-new-cat-" + x} label={t("msc_" + x)} onPress={() => setCat(x)} />)}</Row>
      </Col>)}
      <Row gap={8}><FrameThumb frame={MP_VIEWS[catView(cat)]} width={30} look={c.look} accent="#ffd43b" /><Muted small>{t("mp_newView")} {t("mpv_" + catView(cat))}</Muted></Row>
      <Field testID="mp-new-title" label={t("mp_slideTitle")} value={title} onChangeText={setTitle} placeholder={t("msc_" + cat)} maxLength={MP_LIMITS.slideTitle} />
      <Check testID="mp-new-own" label={t("mp_withOwn")} value={own} onChange={setOwn} />
      {c.opp.items.length ? <Check testID="mp-new-opp" label={t("mp_withOpp")} value={opp} onChange={setOpp} /> : <Muted small>{t("mp_withOppNone")}</Muted>}
      <Btn testID="mp-new-create" kind="primary" label={t("mp_slideCreate")} onPress={() => onCreate(newSlide(c, cat, title.trim() || t("msc_" + cat), opp && c.opp.items.length > 0, own))} />
      {others.length ? <Col gap={8} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: col.line }}>
        <Pressable testID="mp-import-toggle" accessibilityRole="button" accessibilityState={{ expanded: imp }} onPress={() => setImp(!imp)}>
          <Row between><T v="small" bold>{t("mp_import")}</T><Text style={{ color: col.accentTx, fontWeight: "800" }}>{imp ? "▲" : "▼"}</Text></Row>
          <Muted small>{t("mp_importD")}</Muted>
        </Pressable>
        {imp ? others.slice(0, 12).map(p => (
          <Col key={p.id} gap={4}>
            <Muted small>{p.title}</Muted>
            {p.c.slides.map(x => (
              <Row key={x.id} gap={8} style={{ paddingVertical: 4 }}>
                <Col gap={1} style={{ flex: 1 }}><T v="small" bold numberOfLines={1}>{slideLabel(t, x)}</T><Muted small>{t("msc_" + x.cat)} · {frameLabel(t, x)}</Muted></Col>
                <Btn small testID={"mp-import-" + x.id} label={t("mp_importGo")} onPress={() => onCreate(copySlide(x))} />
              </Row>
            ))}
          </Col>
        )) : null}
      </Col> : null}
    </Col>
  );
}

// ---------- Editor ----------
/**
 * Zeile über den Werkzeugen ohne Auswahl: Name und Hinweis des Werkzeugs; bei Linien und Flächen Farbe, Linienstil
 * und Strichstärke für neue Elemente (waagerecht scrollbar).
 */
export function BoardCtx({ B, look }: { B: BoardState; look?: MpContent["look"] }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  const colr = hasColor(B.tool), str = hasStroke(B.tool);
  const head = (
    <View style={{ minWidth: 0, flexShrink: 1 }}>
      <Text numberOfLines={1} style={{ fontWeight: "800", fontSize: 13, color: col.ink }}>{t("mpt_" + B.tool)}</Text>
      <Text testID="mp-board-hint" numberOfLines={colr ? 1 : 2} style={{ fontSize: 11.5, lineHeight: 15, color: col.muted }}>{t("mpt_" + B.tool + "_h")}</Text>
    </View>
  );
  // gleiche Struktur mit und ohne Farbleiste (sonst wechseln Stile beim Werkzeugwechsel)
  return (
    <View testID="mp-board-ctx" style={{ minHeight: 50, justifyContent: "center", gap: 4 }}>
      {colr ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center", gap: 10, minHeight: 36 }}>
        <ColorRow small testID="mp-board-colors" value={B.color || (B.tool === "text" ? "w" : defCol(B.tool as MpTool))} onChange={B.setColor} look={look} />
        {str ? <StrokeRow testID="mp-board-stroke" ls={B.stroke.ls || dashOfTool(B.tool as MpTool)} w={B.stroke.w || 2} onChange={x => B.setStroke(x)} /> : null}
      </ScrollView> : null}
      {head}
    </View>
  );
}
/** Standard-Linienstil eines Werkzeugs */
const dashOfTool = (t: MpTool) => dashOf({ t });
const EMPTY: MpSlide = { id: "-", cat: "sonst", title: "", view: "full", items: [], note: "", vis: true };

/**
 * Folie bearbeiten im Vollbild. Schmal: oben die Tafel (so groß wie möglich, nichts scrollt – Zeichnen und Ziehen
 * bleiben flüssig), darunter die Leiste des ausgewählten Elements bzw. Farbe und Hinweis, die Werkzeuge und
 * Rückgängig/Wiederholen, Ausschnitt, Notizen und Folien-Einstellungen (als Blätter). Breit: Tafel links, rechts alles.
 */
function SlideEditor({ c, onChange, id, onOpen, onClose, onPresent }: { c: MpContent; onChange: (c: MpContent) => void; id: string; onOpen: (id: string) => void; onClose: () => void; onPresent: (i: number) => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme(); const ins = useSafeAreaInsets(); const { width: SW } = useWindowDimensions();
  const i = c.slides.findIndex(x => x.id === id), sl = c.slides[i] || EMPTY;
  const latest = useRef(c); latest.current = c;
  const setSlide = (x: MpSlide) => { const cc = latest.current; onChange({ ...cc, slides: cc.slides.map(y => y.id === x.id ? x : y) }); };
  const B = useBoard(sl, setSlide);
  const [edit, setEdit] = useState<MpItem | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number; id?: string; init?: string } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"note" | "settings" | null>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  /** dritte Werkzeugreihe (Joker, Trainingsmaterial) */
  const [mat, setMat] = useState(false);
  useEffect(() => { B.reset(); B.setFraming(false); setEdit(null); setPick(null); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (i < 0) onClose(); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const selIt = B.sel ? sl.items.find(x => x.id === B.sel) || null : null;
  const setItem = (it: MpItem | null, iid: string) => { B.commit({ ...sl, items: it ? sl.items.map(x => x.id === iid ? it : x) : sl.items.filter(x => x.id !== iid) }); if (!it) B.setSel(null); };
  /** Zurück (Android) bzw. Esc: erst Auswahl aufheben, dann Ausschnitt beenden, dann schließen; offene Blätter schließen sich selbst */
  const back = useRef(() => undefined as void);
  back.current = () => { if (edit || textAt || pick || sheet) return; if (B.sel) B.setSel(null); else if (B.framing) B.setFraming(false); else onClose(); };
  // Web: Strg+Z / Strg+Umschalt+Z, Entf löscht das ausgewählte Element (nicht beim Schreiben)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const g = globalThis as unknown as { addEventListener?: (t: string, f: (e: KbEvent) => void) => void; removeEventListener?: (t: string, f: (e: KbEvent) => void) => void };
    const k = (e: KbEvent) => {
      const tag = String(e.target?.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault?.(); if (e.shiftKey) B.redo(); else B.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault?.(); B.redo(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selIt && !sheet && !edit) { e.preventDefault?.(); setItem(null, selIt.id); }
    };
    g.addEventListener?.("keydown", k); return () => g.removeEventListener?.("keydown", k);
  });
  if (i < 0) return null;
  const wide = SW >= 900, side = 380;
  const upd = (it: MpItem | null) => { if (!edit) return; setItem(it, edit.id); setEdit(null); };
  /** Formular je Art: Text → Textfeld, sonst Element-Formular */
  const openForm = (it: MpItem) => it.t === "text" ? setTextAt({ x: it.x, y: it.y, id: it.id, init: it.label || "" }) : setEdit(it);
  const board = area.w ? <BoardCanvas slide={sl} c={c} B={B} testID="mp-board" maxW={Math.min(area.w - 12, wide ? 1100 : 900)} maxH={Math.max(200, area.h - 12)}
    onEdit={it => it.t === "own" ? setPick(it.id) : openForm(it)} onText={p => setTextAt(p)} /> : null;
  const ctx = selIt ? <SelBar it={selIt} look={c.look} onUpdate={x => setItem(x, selIt.id)} onDelete={() => setItem(null, selIt.id)}
    onDup={() => { const bl = addBlock(sl, selIt.t); if (bl) { s.toast(tf(bl.k, { n: bl.n })); return; } const cp = dupItem(selIt, s.myStaff?.id); B.commit({ ...sl, items: [...sl.items, cp] }); B.setSel(cp.id); }}
    onEdit={() => openForm(selIt)} onPick={() => setPick(selIt.id)} onClose={() => B.setSel(null)} /> : (
    <BoardCtx B={B} look={c.look} />
  );
  const actions = (
    <Row gap={6}>
      <Btn small testID="mp-board-undo" icon="undo" label="" a11y={t("bd_undo")} disabled={!B.canUndo} onPress={B.undo} style={{ minWidth: 40 }} />
      <Btn small testID="mp-board-redo" icon="redo" label="" a11y={t("mp_redo")} disabled={!B.canRedo} onPress={B.redo} style={{ minWidth: 40 }} />
      <View style={{ flex: 1 }} />
      <Btn small testID="mp-mat" icon="grid" label={wide ? t("mp_material") : ""} a11y={t("mp_material")} kind={mat ? "primary" : "default"} onPress={() => setMat(!mat)} style={{ minWidth: 40 }} />
      <Btn small testID="mp-frame" icon="frame" label={t("mp_frame")} onPress={() => B.setFraming(true)} />
      {!wide ? <Btn small testID="mp-ed-note" icon="note" label={t("mp_noteShort") + (sl.note.trim() ? " •" : "")} onPress={() => setSheet("note")} /> : null}
      {!wide ? <Btn small testID="mp-ed-settings" icon="sliders" label="" a11y={t("mp_slideSettings")} onPress={() => setSheet("settings")} style={{ minWidth: 40 }} /> : null}
    </Row>
  );
  const tools = B.framing ? <FramePanel sl={sl} c={c} B={B} compact={!wide} /> : (
    <Col gap={8}>
      {ctx}
      <ToolGrid B={B} labels={wide} material={mat || /^(neu|goal|mgoal|pole|dummy|ladder|hurdle|ring)$/.test(B.tool)} />
      {actions}
    </Col>
  );
  const note = <Field testID="mp-slide-note" label={t("mp_slideNote")} value={sl.note} onChangeText={v => setSlide({ ...sl, note: v.slice(0, MP_LIMITS.text) })} multiline maxLength={MP_LIMITS.text} placeholder={t("mp_slideNotePh")} />;
  const settings = <SlideSettings c={c} sl={sl} i={i} onChange={onChange} setSlide={setSlide} onOpen={x => { setSheet(null); onOpen(x); }} bare={!wide} />;
  const boardArea = (
    <View testID="mp-board-area" style={{ flex: 1, justifyContent: "center", padding: 6 }}
      onLayout={(e: LayoutChangeEvent) => { const { width: w, height: h } = e.nativeEvent.layout; if (Math.abs(w - area.w) > 1 || Math.abs(h - area.h) > 1) setArea({ w: Math.floor(w), h: Math.floor(h) }); }}>
      {board}
    </View>
  );
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()} supportedOrientations={["portrait", "landscape"]}>
      <View testID="mp-editor" style={{ flex: 1, backgroundColor: col.bg, paddingTop: ins.top }}>
        <View style={{ height: 54, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: col.line, backgroundColor: col.surface }}>
          <Btn small kind="primary" testID="mp-ed-close" label={t("done")} onPress={onClose} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text testID="mp-ed-title" numberOfLines={1} style={{ fontWeight: "800", fontSize: 15, color: col.ink }}>{slideLabel(t, sl)}</Text>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: col.muted }}><Text testID="mp-ed-pos" style={{ fontWeight: "800" }}>{i + 1}/{c.slides.length}</Text> · {t("msc_" + sl.cat)} · {frameLabel(t, sl)}{!sl.vis ? " · 🔒" : ""}</Text>
          </View>
          <NavBtn testID="mp-ed-present" label="▶" a11y={t("mp_present")} onPress={() => onPresent(i)} />
          <NavBtn testID="mp-ed-prev" label="‹" a11y={t("mp_prev")} disabled={i === 0} onPress={() => onOpen(c.slides[i - 1].id)} />
          <NavBtn testID="mp-ed-next" label="›" a11y={t("mp_next")} disabled={i >= c.slides.length - 1} onPress={() => onOpen(c.slides[i + 1].id)} />
        </View>
        {wide ? (
          <View style={{ flex: 1, flexDirection: "row" }}>
            {boardArea}
            <ScrollView style={{ width: side, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: col.line }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 + ins.bottom }} keyboardShouldPersistTaps="handled">
              {tools}
              <Card>{note}</Card>
              {settings}
            </ScrollView>
          </View>
        ) : (
          <>
            {boardArea}
            <View testID="mp-ed-panel" style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 + ins.bottom, borderTopWidth: 1, borderTopColor: col.line, backgroundColor: col.surface }}>{tools}</View>
          </>
        )}
        <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit ? t("mpt_" + edit.t) : ""} testID="mp-item-sheet" closeLabel={t("cancel")}>
          {edit ? <ItemForm key={edit.id} it={edit} squad={squadOf(c)} look={c.look} onSave={upd} onDelete={() => upd(null)} /> : null}
        </Sheet>
        <Sheet visible={!!textAt} onClose={() => setTextAt(null)} title={t("mpt_text")} testID="mp-text-sheet" closeLabel={t("cancel")}>
          {textAt ? <TextForm key={textAt.id || "new"} initial={textAt.init || ""} onSave={txt => {
            const at = textAt; setTextAt(null);
            const old = at.id ? sl.items.find(x => x.id === at.id) : null;
            if (old) { setItem({ ...old, label: txt.slice(0, 40) }, old.id); return; }
            const bl = addBlock(sl, "text"); if (bl) { s.toast(tf(bl.k, { n: bl.n })); return; }
            const it: MpItem = { id: mpId("i"), t: "text", x: at.x, y: at.y, label: txt.slice(0, 40), col: B.color || "w" };
            B.commit({ ...sl, items: [...sl.items, it] }); B.setSel(it.id);
          }} /> : null}
        </Sheet>
        <Sheet visible={!!pick} onClose={() => setPick(null)} title={t("mp_pickT")} testID="mp-pick-sheet" closeLabel={t("cancel")}>
          {pick ? <PlayerPick squad={squadOf(c)} used={sl.items.filter(x => x.t === "own" && x.pid).map(x => x.pid!)} current={sl.items.find(x => x.id === pick)?.pid || null}
            onPick={pid => { const it = sl.items.find(x => x.id === pick); setPick(null); if (it) setItem({ ...it, pid }, it.id); }} /> : null}
        </Sheet>
        {!wide ? <Sheet visible={sheet === "note"} onClose={() => setSheet(null)} title={t("mp_slideNote")} testID="mp-note-sheet" closeLabel={t("done")}>
          {note}
          <Btn testID="mp-note-done" kind="primary" label={t("done")} onPress={() => setSheet(null)} style={{ alignSelf: "flex-start" }} />
        </Sheet> : null}
        {!wide ? <Sheet visible={sheet === "settings"} onClose={() => setSheet(null)} title={t("mp_slideSettings")} testID="mp-settings-sheet" closeLabel={t("done")}>
          {settings}
        </Sheet> : null}
      </View>
    </Modal>
  );
}
type KbEvent = { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; target?: { tagName?: string } | null; preventDefault?: () => void };

function NavBtn({ label, a11y, onPress, disabled, testID, dark }: { label: string; a11y: string; onPress: () => void; disabled?: boolean; testID?: string; dark?: boolean }) {
  const { c } = useTheme(); const z = dark ? 40 : 34;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={onPress} hitSlop={6}
      style={{ width: z, height: z, borderRadius: z / 2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: dark ? "rgba(255,255,255,0.25)" : c.line,
        backgroundColor: dark ? "rgba(255,255,255,0.08)" : c.surface, opacity: disabled ? 0.35 : 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: dark ? "#fff" : c.ink, marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}

/** Ausschnitt: Voreinstellungen, Zoom, Format, Spieler außerhalb an den Rand holen (compact: unter der Tafel) */
export function FramePanel({ sl, c, B, compact }: { sl: MpSlide; c: Disp; B: BoardState; compact?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme();
  const [W, setW] = useState(0);
  const f = frameOf(sl), preset: MpView | null = sl.frame ? null : sl.view, out = outsideFrame(sl.items, f);
  const apply = (nf: typeof f) => B.commit(withFrame(sl, nf));
  const zin = zoomFrame(f, 1.25), zout = zoomFrame(f, 1 / 1.25), same = (a: typeof f, b: typeof f) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  const per = W >= 520 ? 6 : 4, tw = compact ? 66 : W ? Math.floor((W - 8 * (per - 1)) / per) : 80;
  const thumb = (k: MpView) => {
    const on = preset === k;
    return (
      <Pressable key={k} testID={"mp-frame-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t("mpv_" + k)} onPress={() => apply(MP_VIEWS[k])}
        style={{ width: tw, alignItems: "center", gap: 4, paddingVertical: compact ? 5 : 7, paddingHorizontal: 3, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col.accent : col.line, backgroundColor: on ? col.accentSoft : col.surface }}>
        <FrameThumb frame={MP_VIEWS[k]} width={Math.min(compact ? 26 : 40, tw - 16)} look={c.look} accent="#ffd43b" />
        <Text numberOfLines={2} style={{ fontSize: 10, lineHeight: 12.5, fontWeight: "700", textAlign: "center", color: on ? col.accentTx : col.ink }}>{t("mpv_" + k)}</Text>
      </Pressable>
    );
  };
  const zoom = (
    <Row gap={6}>
      <Btn small testID="mp-frame-zoomout" label="−" a11y={t("mp_zoomOut")} disabled={same(zout, f)} onPress={() => apply(zout)} style={{ minWidth: 40 }} />
      <Text testID="mp-frame-zoom" style={{ minWidth: 54, textAlign: "center", fontWeight: "900", fontSize: 15, color: col.ink }}>{Math.round(zoomOf(f) * 100)} %</Text>
      <Btn small testID="mp-frame-zoomin" label="+" a11y={t("mp_zoomIn")} disabled={f.w <= FRAME_MIN_W + 0.05 || same(zin, f)} onPress={() => apply(zin)} style={{ minWidth: 40 }} />
    </Row>
  );
  const fmt = <Seg testID="mp-frame-format" value={formatOf(f)} onChange={k => apply(formatFrame(f, FRAME_FORMATS.find(x => x.k === k)!.r))} options={FRAME_FORMATS.map(x => ({ key: x.k, label: t("mpf_" + x.k) }))} />;
  const outBanner = out.length ? <Banner color={col.warn} testID="mp-frame-out"><Row gap={8} wrap><T v="small" style={{ flex: 1, minWidth: 160 }}>{out.length === 1 ? t("mp_frameOut1") : tf("mp_frameOut", { n: out.length })}</T>
    <Btn small testID="mp-frame-fit" label={t("mp_frameFit")} onPress={() => B.commit({ ...sl, items: fitToView(sl.items, f) })} /></Row></Banner> : null;
  if (compact) return (
    <Col gap={8} testID="mp-frame-panel">
      <Row gap={8}>
        <FrameThumb frame={f} width={26} look={c.look} accent="#ffd43b" testID="mp-frame-map" />
        {zoom}
        <View style={{ flex: 1 }} />
        <Btn small kind="primary" testID="mp-frame-done" label={t("done")} onPress={() => B.setFraming(false)} />
      </Row>
      {fmt}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{MP_VIEW_KEYS.map(thumb)}</ScrollView>
      {outBanner}
      <Muted small>{t("mp_frameHint")}</Muted>
    </Col>
  );
  return (
    <Col gap={12} testID="mp-frame-panel">
      <Row between gap={8}>
        <T v="h3">{t("mp_frame")}</T>
        <Btn small kind="primary" testID="mp-frame-done" label={t("done")} onPress={() => B.setFraming(false)} />
      </Row>
      <Row gap={12} align="center">
        <FrameThumb frame={f} width={46} look={c.look} accent="#ffd43b" testID="mp-frame-map" />
        <Col gap={8} style={{ flex: 1, minWidth: 0 }}>{zoom}{fmt}</Col>
      </Row>
      <Muted small>{t("mp_frameHint")}</Muted>
      {outBanner}
      <T v="small" bold color={col.muted}>{t("mp_framePresets")}</T>
      <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {W ? MP_VIEW_KEYS.map(thumb) : null}
      </View>
    </Col>
  );
}

/** Einstellungen der Folie: Titel, Art, sichtbar, Icongröße; Reihenfolge, Kopieren, Spieler aus Aufstellung, Löschen */
function SlideSettings({ c, sl, i, onChange, setSlide, onOpen, bare }: { c: MpContent; sl: MpSlide; i: number; onChange: (c: MpContent) => void; setSlide: (s: MpSlide) => void; onOpen: (id: string) => void; bare?: boolean }) {
  const E = useEngine(); const { t } = E;
  const [ask, setAsk] = useState(false);
  useEffect(() => setAsk(false), [sl.id]);
  const moveSlide = (dir: number) => { const L = [...c.slides], j = i + dir; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; onChange({ ...c, slides: L }); };
  const body = (
    <>
      <Field testID="mp-slide-title" label={t("mp_slideTitle")} value={sl.title} onChangeText={v => setSlide({ ...sl, title: v.slice(0, MP_LIMITS.slideTitle) })} maxLength={MP_LIMITS.slideTitle} />
      <Picker testID="mp-slide-cat" label={t("mp_slideCat")} value={sl.cat} onChange={k => setSlide({ ...sl, cat: k })} options={SLIDE_CATS.map(k => ({ key: k, label: t("msc_" + k) }))} style={{ maxWidth: 260 }} />
      <ToggleRow testID="mp-slide-vis" label={t("mp_slideVis")} desc={t("mp_slideVisD")} value={sl.vis} onChange={v => setSlide({ ...sl, vis: v })} />
      <Col gap={4}><Muted small>{t("mp_slideSize")}</Muted>
        <Seg testID="mp-slide-size" value={sl.size ? sizeKey(sl.size) : "plan"}
          onChange={k => { const n = { ...sl }; if (k === "plan") delete n.size; else n.size = SIZES.find(x => x.key === k)!.v; setSlide(n); }}
          options={[{ key: "plan", label: t("mp_sizePlan") }, ...SIZES.map(x => ({ key: x.key, label: x.key }))]} />
      </Col>
      <Col gap={4}><Muted small>{t("mp_slideMode")}</Muted>
        <Seg testID="mp-slide-mode" value={sl.mode || "plan"} wrap
          onChange={k => { const n = { ...sl }; if (k === "plan") delete n.mode; else n.mode = k as MpMode; setSlide(n); }}
          options={[{ key: "plan", label: t("mp_sizePlan") }, ...(["num", "name", "photo"] as const).map(k => ({ key: k, label: t("mp_mode_" + k) }))]} />
      </Col>
      <Row wrap gap={6}>
        <Btn small testID="mp-slide-left" label="←" a11y={t("mp_slideLeft")} disabled={i === 0} onPress={() => moveSlide(-1)} />
        <Btn small testID="mp-slide-right" label="→" a11y={t("mp_slideRight")} disabled={i >= c.slides.length - 1} onPress={() => moveSlide(1)} />
        <Btn small testID="mp-slide-dup" icon="copy" label={t("mp_slideDup")} disabled={c.slides.length >= MP_LIMITS.slides} onPress={() => {
          const cp = copySlide(sl, (sl.title || slideLabel(t, sl)).slice(0, MP_LIMITS.slideTitle - 4) + " (2)");
          const L = [...c.slides]; L.splice(i + 1, 0, cp); onChange({ ...c, slides: L }); onOpen(cp.id);
        }} />
        <Btn small testID="mp-slide-lineup" label={t("mp_slideFromLineup")} onPress={() => {
          const own = c.lineup.filter(x => x.pid || x.label).map(x => ({ ...x, id: mpId("i") }));
          setSlide({ ...sl, items: [...fitToView(own, frameOf(sl)), ...sl.items.filter(x => x.t !== "own")] });
        }} />
        <Btn small testID="mp-slide-clearlines" label={t("mp_slideClearLines")} disabled={!sl.items.some(x => isLine(x.t) || x.t === "free" || x.t === "text")}
          onPress={() => setSlide({ ...sl, items: sl.items.filter(x => !isLine(x.t) && x.t !== "free" && x.t !== "text") })} />
        {!ask ? <Btn small kind="ghost" testID="mp-slide-del" label={t("mp_slideDel")} onPress={() => setAsk(true)} />
          : <Btn small kind="danger" testID="mp-slide-del-yes" label={t("mp_slideDelQ")} onPress={() => {
            const next = c.slides[i + 1]?.id || c.slides[i - 1]?.id || null;
            onChange({ ...c, slides: c.slides.filter(x => x.id !== sl.id) }); if (next) onOpen(next);
          }} />}
      </Row>
    </>
  );
  if (bare) return <Col gap={12} testID="mp-slide-card">{body}</Col>;
  return <Card testID="mp-slide-card"><CardTitle title={t("mp_slideSettings")} />{body}</Card>;
}

// ---------- Präsentation ----------
/**
 * Folien im Vollbild zeigen (Besprechung, Kabine, Tablet/Fernseher): so groß wie möglich. Auf breiten Bildschirmen liegt
 * das Feld quer (eigenes Tor links). Am Handy hochkant dreht ⟲ die ganze Ansicht ins Querformat (Handy drehen – auch
 * bei gesperrter Bildschirmdrehung). Wischen oder Pfeile blättern, im Browser auch die Pfeiltasten. Für Spieler mit
 * Wasserzeichen.
 */
export function Presenter({ slides, start, c, onClose, watermark, showHidden, testID = "mp-pres" }: {
  slides: MpSlide[]; start: number; c: Disp; onClose: () => void; watermark?: string; showHidden?: boolean; testID?: string;
}) {
  const E = useEngine(); const { t } = E; const info = useTokenInfo(); const { c: col } = useTheme(); const ins = useSafeAreaInsets(); const { width: SW, height: SH } = useWindowDimensions();
  const [i, setI] = useState(Math.max(0, Math.min(start, slides.length - 1)));
  const [rotPref, setRotPref] = useState<boolean | null>(null);
  const [turn, setTurn] = useState(false);
  const [note, setNote] = useState(false);
  /** Ablauf Schritt für Schritt: nur Pfeile bis zu diesem Schritt (null = alles) */
  const [stp, setStp] = useState<number | null>(null);
  const sw = useRef<{ x: number; y: number } | null>(null);
  const n = slides.length;
  const cur = slides[Math.min(i, n - 1)], maxStep = cur ? Math.max(0, ...cur.items.filter(x => isStepped(x)).map(x => x.n || 0)) : 0;
  const stepRef = useRef({ stp, maxStep }); stepRef.current = { stp, maxStep };
  /** weiter/zurück: im Ablauf erst die Schritte, dann die Folie */
  const go = (d: number) => {
    const { stp: s0, maxStep: mx } = stepRef.current;
    if (s0 != null && d > 0 && s0 < mx) { setStp(s0 + 1); return; }
    if (s0 != null && d < 0 && s0 > 1) { setStp(s0 - 1); return; }
    setStp(null); setI(x => Math.max(0, Math.min(n - 1, x + d)));
  };
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const g = globalThis as unknown as { addEventListener?: (t: string, f: (e: KbEvent) => void) => void; removeEventListener?: (t: string, f: (e: KbEvent) => void) => void };
    const k = (e: KbEvent) => { if (e.key === "ArrowRight" || e.key === "PageDown") go(1); if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1); };
    g.addEventListener?.("keydown", k); return () => g.removeEventListener?.("keydown", k);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const portrait = SH > SW;
  useEffect(() => { if (!portrait) setTurn(false); }, [portrait]);
  const sl = cur;
  if (!sl) return null;
  const shownItems = stp == null ? sl.items : sl.items.filter(x => !isStepped(x) || (x.n || 0) <= stp);
  // gedreht: als wäre der Bildschirm quer (Sicherheitsabstände von oben/unten liegen dann links/rechts)
  const tw = turn && portrait, W0 = tw ? SH : SW, H0 = tw ? SW : SH;
  const pad = tw ? { t: 0, b: 0, l: ins.top, r: ins.bottom } : { t: ins.top, b: ins.bottom, l: 0, r: 0 };
  const f = frameOf(sl);
  // niedrige Bildschirme (quer, gedreht): schmalere Leisten, damit das Feld möglichst groß wird
  const compact = H0 - pad.t - pad.b < 520, topH = compact ? 44 : 56, botH = compact ? 50 : 64;
  const availW = W0 - 24 - pad.l - pad.r, availH = H0 - pad.t - pad.b - topH - botH;
  const kP = Math.min(availW / f.w, availH / f.h), kR = Math.min(availW / f.h, availH / f.w);
  // Feld quer, wenn der (ggf. gedrehte) Bildschirm quer ist und das Feld dadurch deutlich größer wird
  const rot = rotPref ?? (W0 > H0 && kR > kP * 1.12);
  const pw = Math.max(120, Math.floor(rot ? Math.min(availW, availH * f.h / f.w) : Math.min(availW, availH * f.w / f.h)));
  const fg = "#ffffff", dim = "rgba(255,255,255,0.65)";
  const content = (
    <View testID={testID} style={{ width: W0, height: H0, backgroundColor: "#0b1118", paddingTop: pad.t, paddingBottom: pad.b, paddingLeft: pad.l, paddingRight: pad.r }}>
      <View style={{ height: topH, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID={testID + "-title"} numberOfLines={1} style={{ color: fg, fontWeight: "800", fontSize: compact ? 14.5 : 16 }}>{slideLabel(t, sl)}{showHidden && !sl.vis ? "  🔒" : ""}</Text>
          <Text numberOfLines={1} style={{ color: dim, fontSize: 12 }}>{t("msc_" + sl.cat)} · <Text testID={testID + "-pos"}>{i + 1} / {n}</Text></Text>
        </View>
        <NavBtn dark testID={testID + "-rot"} label="⟲" a11y={t(portrait ? "mp_turn" : "mp_rotate")}
          onPress={() => { if (portrait) { setTurn(!turn); setRotPref(null); } else setRotPref(!rot); }} />
        <NavBtn dark testID={testID + "-close"} label="✕" a11y={t("close")} onPress={onClose} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => true}
        onResponderGrant={(e: GestureResponderEvent) => { sw.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }; }}
        onResponderRelease={(e: GestureResponderEvent) => {
          const s0 = sw.current; sw.current = null; if (!s0) return;
          // gedreht: waagerecht in der Ansicht = senkrecht auf dem Bildschirm
          const dx = tw ? e.nativeEvent.pageY - s0.y : e.nativeEvent.pageX - s0.x, dy = tw ? s0.x - e.nativeEvent.pageX : e.nativeEvent.pageY - s0.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        }}>
        <Pitch frame={f} items={shownItems} width={pw} rot={rot} mode={sl.mode || c.mode} size={sl.size || c.size} accent={col.club} accentInk={col.clubInk} info={info} captain={c.captain} look={c.look} testID={testID + "-pitch"} />
      </View>
      <View style={{ height: botH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
        <NavBtn dark testID={testID + "-prev"} label="‹" a11y={t("mp_prev")} disabled={i === 0 && (stp == null || stp <= 1)} onPress={() => go(-1)} />
        <Row gap={8}>
          {maxStep >= 2 ? <Pressable testID={testID + "-steps"} accessibilityRole="button" accessibilityLabel={t("mp_stepsA11y")} onPress={() => setStp(stp == null ? 1 : stp >= maxStep ? null : stp + 1)}
            style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 99, backgroundColor: stp != null ? "#ffe066" : "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: stp != null ? "#111" : fg, fontWeight: "800", fontSize: 13, fontVariant: ["tabular-nums"] }}>{stp == null ? "▶ " + t("mp_steps") : `${t("mp_step")} ${stp}/${maxStep}`}</Text>
          </Pressable> : null}
          {sl.note ? <Pressable testID={testID + "-note-toggle"} accessibilityRole="button" accessibilityState={{ expanded: note }} onPress={() => setNote(!note)}
            style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 99, backgroundColor: note ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: fg, fontWeight: "800", fontSize: 13 }}>{maxStep >= 2 ? t("mp_noteShort") : t("mp_slideNote")} {note ? "▼" : "▲"}</Text>
          </Pressable> : null}
        </Row>
        <NavBtn dark testID={testID + "-next"} label="›" a11y={t("mp_next")} disabled={i >= n - 1 && (stp == null || stp >= maxStep)} onPress={() => go(1)} />
      </View>
      {note && sl.note ? <View testID={testID + "-note"} style={{ position: "absolute", left: 12 + pad.l, right: 12 + pad.r, bottom: botH + pad.b + 8, maxHeight: H0 * 0.45, borderRadius: radius.l, backgroundColor: "rgba(17,24,39,0.95)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
        <ScrollView contentContainerStyle={{ padding: 14 }}><Text style={{ color: fg, fontSize: 15, lineHeight: 21 }}>{sl.note}</Text></ScrollView>
      </View> : null}
      {watermark ? <Watermark text={watermark} height={H0} light testID={testID + "-wm"} /> : null}
    </View>
  );
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={{ flex: 1, backgroundColor: "#0b1118", overflow: "hidden" }}>
        {tw ? <View key="turned" style={{ position: "absolute", left: (SW - W0) / 2, top: (SH - H0) / 2, width: W0, height: H0, transform: [{ rotate: "90deg" }] }}>{content}</View>
          : <React.Fragment key="flat">{content}</React.Fragment>}
      </View>
    </Modal>
  );
}

// ---------- Ansicht (Spieler, Vorschau) ----------
/** Folien nur ansehen: Auswahl oben, Tafel, Coachingpunkte; Vollbild (mit Wasserzeichen) */
export function SlidesView({ slides, c, watermark, testID = "pv-slides" }: { slides: MpSlide[]; c: Disp; watermark?: string; testID?: string }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  const [i, setI] = useState(0); const [W, setW] = useState(0); const [full, setFull] = useState(false);
  const { height } = useWindowDimensions();
  const sl = slides[Math.min(i, slides.length - 1)];
  if (!sl) return null;
  const f = frameOf(sl), pw = Math.max(160, Math.floor(Math.min(W || 360, 640, (height * 0.7) * f.w / f.h)));
  return (
    <Col gap={10} testID={testID}>
      <Row wrap gap={6}>
        {slides.map((x, k) => <Pressable key={x.id} testID={testID + "-" + k} accessibilityRole="tab" accessibilityState={{ selected: k === i }} onPress={() => setI(k)}
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.m, borderWidth: 1.5, borderColor: k === i ? col.accent : col.line, backgroundColor: k === i ? col.accentSoft : col.surface }}>
          <Text numberOfLines={1} style={{ maxWidth: 190, fontWeight: "700", fontSize: 13, color: col.ink }}>{slideLabel(t, x)}</Text>
        </Pressable>)}
      </Row>
      <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", alignItems: "center" }}>
        {W ? <Pressable accessibilityRole="button" accessibilityLabel={t("mp_fullscreen")} onPress={() => setFull(true)}>
          <Pitch frame={f} items={sl.items} width={pw} mode={sl.mode || c.mode} size={sl.size || c.size} accent={col.club} accentInk={col.clubInk} info={info} captain={c.captain} look={c.look} testID={testID + "-pitch"} />
        </Pressable> : null}
      </View>
      <Row between gap={8}>
        <Muted small>{frameLabel(t, sl)}</Muted>
        <Btn small testID={testID + "-full"} label={"⤢ " + t("mp_fullscreen")} onPress={() => setFull(true)} />
      </Row>
      {sl.note ? <View style={{ padding: 12, borderRadius: radius.m, backgroundColor: withAlpha(col.accent, 0.07) }}><T>{sl.note}</T></View> : null}
      {full ? <Presenter slides={slides} start={i} c={c} watermark={watermark} onClose={() => setFull(false)} testID={testID + "-pres"} /> : null}
    </Col>
  );
}
