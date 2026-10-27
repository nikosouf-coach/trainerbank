// Übungsskizzen (Übungsarchiv, Ablauf des Trainingstags): dieselbe Tafel wie im Matchplan – Spieler (Team A/B,
// Joker), Ball, Hütchen, Trainingsmaterial (Tore, Minitore, Stangen, Dummys, Leitern, Hürden, Reifen), Pässe,
// Laufwege, Dribblings und Linien (gerade oder gebogen, Stil, Stärke, Farbe), Freihand, Zonen, Kreise und Text.
// Bearbeitet wird im Vollbild (nichts scrollt beim Zeichnen), Ausschnitt frei wählbar, auf Wunsch ohne Feldlinien.
import React, { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MP_LIMITS, frameOf, mpId } from "../core/matchplan";
import { emptySketch, toSketch } from "../core/sketch";
import type { Drawing, MpContent, MpItem, MpLook, MpSlide, Sketch } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { Btn, Col, Muted, Row, Seg, Sheet, ToggleRow } from "./kit";
import { BoardCanvas, TextForm, addBlock, dupItem, useBoard } from "./matchplan/board";
import { Pitch } from "./matchplan/pitch";
import { FramePanel, HeadBtn } from "./matchplan/slides";
import { EditorPanel, ItemForm } from "./matchplan/tools";
import { radius, useTheme } from "./theme";
import { useTouchSurface } from "./touch";

const DISP = (look: MpLook | null | undefined): Pick<MpContent, "mode" | "size" | "captain" | "look"> => ({ mode: "num", size: 1, captain: null, look: look || undefined });
/** Skizze ↔ Folie (die Tafel arbeitet mit Folien) */
const toSlide = (s: Sketch): MpSlide => ({ id: "sketch", cat: "sonst", title: "", view: s.view, frame: s.frame ?? null, items: s.items, note: "", vis: true });
function fromSlide(sl: MpSlide, base: Sketch): Sketch {
  const s: Sketch = { v: 2, view: sl.view, items: sl.items };
  if (sl.frame) s.frame = sl.frame;
  if (base.look) s.look = base.look;
  if (base.plain) s.plain = true;
  return s;
}

/** Skizze anzeigen (ohne Bedienung): volle Breite bzw. feste Breite (Vorschaubild) */
export function SketchView({ value, width, testID, mini }: { value: Drawing; width?: number; testID?: string; mini?: boolean }) {
  const { c } = useTheme();
  const [W, setW] = useState(width || 0);
  const sk = toSketch(value);
  if (!sk) return null;
  const f = frameOf(toSlide(sk)), w = width || Math.min(W, 520);
  return (
    <View testID={testID} onLayout={width ? undefined : (e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: width || "100%", alignItems: "center" }}>
      {w ? <Pitch frame={f} items={sk.items} width={w} mode="num" size={1} accent={c.club} accentInk={c.clubInk} info={() => null} look={sk.look} sketch plain={!!sk.plain} mini={mini} /> : <View style={{ height: 120 }} />}
    </View>
  );
}

/**
 * Skizze im Formular: Vorschau (antippen = bearbeiten), Zeichnen/Bearbeiten, Entfernen.
 * deferred: erst beim Schließen speichern (z. B. direkt am Block des Trainingstags) – eine leere neue Skizze wird
 * dann gar nicht angelegt, eine geleerte entfernt.
 */
export function SketchField({ value, onChange, testID = "sketch", labels, deferred }: {
  value: Drawing | null; onChange: (d: Sketch | null) => void; testID?: string; labels: { add: string; edit: string; del: string }; deferred?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Sketch | null>(null);
  const sk = value ? toSketch(value) : null;
  const draftRef = useRef(draft); draftRef.current = draft;
  const start = () => { if (deferred) setDraft(sk || emptySketch()); else if (!sk) onChange(emptySketch()); setOpen(true); };
  const close = () => {
    setOpen(false);
    const d = draftRef.current; if (!deferred || !d) return;
    setDraft(null);
    const next = d.items.length ? d : null;
    if (JSON.stringify(next) !== JSON.stringify(sk)) onChange(next);
  };
  return (
    <Col gap={8} testID={testID}>
      {sk ? <Pressable testID={testID + "-preview"} accessibilityRole="button" accessibilityLabel={labels.edit} onPress={start}><SketchView value={sk} /></Pressable> : null}
      <Row gap={8} wrap>
        <Btn small testID={testID + "-edit"} icon={sk ? "pen" : "plus"} label={sk ? labels.edit : labels.add} onPress={start} />
        {sk ? <Btn small kind="ghost" testID={testID + "-del"} label={labels.del} onPress={() => onChange(null)} /> : null}
      </Row>
      {open ? <SketchEditor value={(deferred ? draft : null) || sk || emptySketch()} onChange={deferred ? setDraft : onChange} onClose={close} testID={testID} /> : null}
    </Col>
  );
}

/**
 * Skizze im Vollbild bearbeiten (gleiche Bedienung wie Matchplan-Folien): Kopf mit Fertig, Rückgängig/Wiederholen und
 * Mehr (Darstellung, ohne Feldlinien, Alles löschen); Tafel; Werkzeugleiste in zwei Ebenen.
 */
export function SketchEditor({ value, onChange, onClose, testID = "sketch" }: { value: Sketch; onChange: (s: Sketch) => void; onClose: () => void; testID?: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme(); const ins = useSafeAreaInsets(); const { width: SW } = useWindowDimensions();
  const [sk, setSk] = useState<Sketch>(value);
  const latest = useRef(sk); latest.current = sk;
  const sl = toSlide(sk), disp = DISP(sk.look);
  const save = (n: Sketch) => { setSk(n); onChange(n); };
  const B = useBoard(sl, x => save(fromSlide(x, latest.current)));
  const [edit, setEdit] = useState<MpItem | null>(null);
  const [textAt, setTextAt] = useState<{ x: number; y: number; id?: string; init?: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  // Browser: Kopf, Rand der Tafel und Leiste scrollen nie (sonst rutscht auf dem Handy die Seite dahinter mit)
  const headRef = useTouchSurface(true).ref, areaRef = useTouchSurface(true).ref, panelRef = useTouchSurface(true).ref;
  const selIt = B.sel ? sl.items.find(x => x.id === B.sel) || null : null;
  const setItem = (it: MpItem | null, iid: string) => { B.commit({ ...sl, items: it ? sl.items.map(x => x.id === iid ? it : x) : sl.items.filter(x => x.id !== iid) }); if (!it) B.setSel(null); };
  const back = useRef(() => undefined as void);
  back.current = () => { if (edit || textAt || settings) return; if (B.sel) B.setSel(null); else if (B.framing) B.setFraming(false); else onClose(); };
  // Web: Strg+Z / Strg+Umschalt+Z, Entf löscht das ausgewählte Element
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const g = globalThis as unknown as { addEventListener?: (t: string, f: (e: KbEvent) => void) => void; removeEventListener?: (t: string, f: (e: KbEvent) => void) => void };
    const k = (e: KbEvent) => {
      const tag = String(e.target?.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault?.(); if (e.shiftKey) B.redo(); else B.undo(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selIt && !edit && !settings) { e.preventDefault?.(); setItem(null, selIt.id); }
      if (e.key === "Escape") back.current();
    };
    g.addEventListener?.("keydown", k); return () => g.removeEventListener?.("keydown", k);
  });
  const wide = SW >= 900;
  const openForm = (it: MpItem) => it.t === "text" ? setTextAt({ x: it.x, y: it.y, id: it.id, init: it.label || "" }) : setEdit(it);
  const board = area.w ? <BoardCanvas slide={sl} c={disp} B={B} testID={testID + "-board"} sketch plain={!!sk.plain} maxW={Math.min(area.w - 12, 900)} maxH={Math.max(200, area.h - 12)}
    onEdit={openForm} onText={p => setTextAt(p)} /> : null;
  const selProps = selIt ? {
    it: selIt, testID: testID + "-sel", onUpdate: (x: MpItem) => setItem(x, selIt.id), onDelete: () => setItem(null, selIt.id),
    onDup: () => { const bl = addBlock(sl, selIt.t); if (bl) { s.toast(tf(bl.k, { n: bl.n })); return; } const cp = dupItem(selIt, s.myStaff?.id); B.commit({ ...sl, items: [...sl.items, cp] }); B.setSel(cp.id); },
    onEdit: () => openForm(selIt),
  } : null;
  const panel = <EditorPanel B={B} look={disp.look} sketch sel={selProps} wide={wide} testID={testID + "-board"} frame={<FramePanel sl={sl} c={disp} B={B} compact={!wide} />} />;
  const boardArea = (
    <View ref={areaRef} testID={testID + "-area"} style={{ flex: 1, justifyContent: "center", padding: 6 }}
      onLayout={(e: LayoutChangeEvent) => { const { width: w, height: h } = e.nativeEvent.layout; if (Math.abs(w - area.w) > 1 || Math.abs(h - area.h) > 1) setArea({ w: Math.floor(w), h: Math.floor(h) }); }}>
      {board}
    </View>
  );
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()} supportedOrientations={["portrait", "landscape"]}>
      <View testID={testID + "-editor"} style={{ flex: 1, backgroundColor: col.bg, paddingTop: ins.top }}>
        <View ref={headRef} style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: col.line, backgroundColor: col.surface }}>
          <Btn small kind="primary" testID={testID + "-done"} label={t("done")} onPress={onClose} />
          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
            <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 15, color: col.ink }}>{t("bd_draw")}</Text>
            <Text testID={testID + "-count"} numberOfLines={1} style={{ fontSize: 12, color: col.muted }}>{tf("sk_items", { n: sk.items.length, m: MP_LIMITS.items })}</Text>
          </View>
          <HeadBtn testID={testID + "-undo"} icon="undo" a11y={t("bd_undo")} disabled={!B.canUndo} onPress={B.undo} />
          <HeadBtn testID={testID + "-redo"} icon="redo" a11y={t("mp_redo")} disabled={!B.canRedo} onPress={B.redo} />
          <HeadBtn testID={testID + "-settings"} icon="mehr" a11y={t("sk_settings")} onPress={() => setSettings(true)} />
        </View>
        {wide ? (
          <View style={{ flex: 1, flexDirection: "row" }}>
            {boardArea}
            <ScrollView style={{ width: 380, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: col.line }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 + ins.bottom }} keyboardShouldPersistTaps="handled">
              {panel}
            </ScrollView>
          </View>
        ) : (
          <>
            {boardArea}
            <View ref={panelRef} testID={testID + "-panel-wrap"} style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 + ins.bottom, borderTopWidth: 1, borderTopColor: col.line, backgroundColor: col.surface }}>{panel}</View>
          </>
        )}
        <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit ? t("mpt_" + edit.t) : ""} testID="mp-item-sheet" closeLabel={t("cancel")}>
          {edit ? <ItemForm key={edit.id} it={edit} squad={[]} look={disp.look} sketch onSave={x => { setItem(x, edit.id); setEdit(null); }} onDelete={() => { setItem(null, edit.id); setEdit(null); }} /> : null}
        </Sheet>
        <Sheet visible={!!textAt} onClose={() => setTextAt(null)} title={t("mpt_text")} testID="mp-text-sheet" closeLabel={t("cancel")}>
          {textAt ? <TextForm key={textAt.id || "new"} initial={textAt.init || ""} onSave={txt => {
            const at = textAt; setTextAt(null);
            const old = at.id ? sl.items.find(x => x.id === at.id) : null;
            if (old) { setItem({ ...old, label: txt.slice(0, 40) }, old.id); return; }
            const bl = addBlock(sl, "text"); if (bl) { s.toast(tf(bl.k, { n: bl.n })); return; }
            const it: MpItem = { id: mpId("i"), t: "text", x: at.x, y: at.y, label: txt.slice(0, 40), ...B.newProps("text") };
            if (s.myStaff?.id) it.by = s.myStaff.id;
            B.commit({ ...sl, items: [...sl.items, it] });
          }} /> : null}
        </Sheet>
        <Sheet visible={settings} onClose={() => setSettings(false)} title={t("sk_settings")} testID={testID + "-settings-sheet"} closeLabel={t("done")}>
          <Col gap={4}><Muted small>{t("mp_look")}</Muted>
            <Seg testID={testID + "-look"} value={sk.look || "grass"} onChange={k => save({ ...sk, look: k === "grass" ? null : k })}
              options={(["grass", "dark", "white"] as const).map(k => ({ key: k, label: t("mpl_" + k) }))} /></Col>
          <ToggleRow testID={testID + "-plain"} label={t("sk_plain")} desc={t("sk_plainD")} value={!!sk.plain} onChange={v => { const n = { ...sk }; if (v) n.plain = true; else delete n.plain; save(n); }} />
          <Btn testID={testID + "-frame"} icon="frame" label={t("mp_frame")} onPress={() => { setSettings(false); B.setCat("select"); B.setFraming(true); }} style={{ alignSelf: "flex-start" }} />
          <Row gap={8} wrap>
            <Btn testID={testID + "-clear"} kind="ghost" label={t("bd_clear")} disabled={!sk.items.length} onPress={() => { B.commit({ ...sl, items: [] }); setSettings(false); }} />
            <Btn kind="primary" label={t("done")} onPress={() => setSettings(false)} />
          </Row>
          <View style={{ padding: 10, borderRadius: radius.m, backgroundColor: col.sunk }}><Muted small>{t("sk_help")}</Muted></View>
        </Sheet>
      </View>
    </Modal>
  );
}
type KbEvent = { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; target?: { tagName?: string } | null; preventDefault?: () => void };
