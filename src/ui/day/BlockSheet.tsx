// Trainingstag: Block bearbeiten (Titel, Minuten, Zuständigkeit, Gruppe, Inhalt, Coachingpunkte, Skizze/Foto)
// und Skizzen-Fotos anzeigen.
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import type { DayBlock } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { BoardEditor, BoardView, emptyDrawing } from "../board";
import { Btn, Col, Field, ListItem, Muted, NumField, Picker, Row, Sheet, T } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";

const urlCache = new Map<string, string>();

/** Foto einer Skizze (privater Speicher, signierte Adresse) */
export function SketchImage({ path, testID }: { path: string; testID?: string }) {
  const s = useStore(); const { c } = useTheme();
  const [url, setUrl] = useState<string | null>(urlCache.get(path) || null);
  useEffect(() => {
    let live = true;
    if (!urlCache.has(path)) s.api.sketchUrl(path).then(u => { if (u) urlCache.set(path, u); if (live) setUrl(u); }).catch(() => undefined);
    else setUrl(urlCache.get(path)!);
    return () => { live = false; };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View testID={testID} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.m, overflow: "hidden", backgroundColor: c.sunk, alignItems: "center", justifyContent: "center" }}>
      {url ? <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="contain" /> : <ActivityIndicator color={c.accent} />}
    </View>
  );
}
export const forgetSketch = (path: string): void => { urlCache.delete(path); };

/** Kürzel eines Trainers (Initialen) als farbiger Punkt */
export function StaffDot({ staffId, size = 26 }: { staffId: string | null; size?: number }) {
  const E = useEngine(); const { c } = useTheme();
  const st = staffId ? E.D.staff.find(x => x.id === staffId) : null;
  if (!st) return null;
  const ini = st.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const col = STAFF_COLORS[Math.max(0, E.D.staff.indexOf(st)) % STAFF_COLORS.length];
  return (
    <View accessibilityLabel={st.name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(col, 0.18), borderWidth: 1.5, borderColor: col, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: "800", color: c.ink }}>{ini}</Text>
    </View>
  );
}
export const STAFF_COLORS = ["#0b3d91", "#f0762b", "#16a3a3", "#d6336c", "#7b5fd0", "#2f9e44", "#c9a400"];

/** Blatt: Block anlegen/bearbeiten. `block` = undefined → geschlossen. */
export function BlockSheet({ block, onClose }: { block: DayBlock | undefined; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={!!block} onClose={onClose} title={block && !block.id.startsWith("tmp-") ? t("blk_edit") : t("blk_new")} testID="block-sheet" closeLabel={t("cancel")}>
      {block ? <BlockForm key={block.id} block={block} onDone={onClose} /> : null}
    </Sheet>
  );
}

function BlockForm({ block, onDone }: { block: DayBlock; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [b, setB] = useState<DayBlock>(block);
  const [pick, setPick] = useState(false), [draw, setDraw] = useState(false), [busy, setBusy] = useState(false), [ask, setAsk] = useState(false);
  const set = (p: Partial<DayBlock>) => setB(x => ({ ...x, ...p }));
  const isNew = block.id.startsWith("tmp-");
  const save = async () => {
    setBusy(true);
    try { await s.saveBlock({ ...b, title: b.title.trim() || t("blk_untitled"), points: b.points.map(x => x.trim()).filter(Boolean) }); s.toast(t("t_saved")); onDone(); }
    catch { /* Meldung kommt aus dem Store */ } finally { setBusy(false); }
  };
  const photo = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
      if (r.canceled || !r.assets?.length) return;
      setBusy(true);
      const saved = await s.uploadSketch({ ...b, title: b.title.trim() || t("blk_untitled") }, r.assets[0].uri);
      if (saved.photo) forgetSketch(saved.photo);
      setB(saved); s.toast(t("blk_photoSaved"));
    } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  const staffOpts = [{ key: "", label: t("ex_nobody") }, ...E.D.staff.map(x => ({ key: x.id, label: `${x.name} · ${t("sr_" + x.role)}` }))];
  const groupOpts = [{ key: "", label: t("blk_allTeam") }, ...E.D.groups.map(g => ({ key: g.id, label: g.name }))];
  return (
    <Col gap={12}>
      {E.D.exercises.length ? <Btn small icon="plus" testID="blk-from-ex" label={t("blk_fromEx")} onPress={() => setPick(!pick)} style={{ alignSelf: "flex-start" }} /> : null}
      {pick ? <Col gap={0} testID="blk-pick">
        {E.D.exercises.map(ex => <ListItem key={ex.id} testID={"blk-pick-" + ex.id} title={ex.title} sub={`${t("cat_" + ex.cat)} · ${ex.dur} ${t("min")}`}
          onPress={() => { set({ exId: ex.id, title: ex.title, text: ex.desc, min: ex.dur, points: ex.points.map(p => p.text), drawing: ex.drawing, staffId: b.staffId || ex.points.find(p => p.staffId)?.staffId || null }); setPick(false); }} />)}
      </Col> : null}
      <Field testID="blk-title" label={t("blk_title")} value={b.title} onChangeText={v => set({ title: v })} placeholder={t("blk_titlePh")} maxLength={120} />
      <Row gap={10} wrap>
        <NumField testID="blk-min" label={t("minutes")} value={b.min} min={1} max={180} step={1} onChange={v => set({ min: v || 1 })} style={{ width: 110 }} />
        {E.D.staff.length ? <Picker testID="blk-staff" label={t("blk_staff")} value={b.staffId || ""} onChange={v => set({ staffId: v || null })} options={staffOpts} style={{ flex: 1, minWidth: 180 }} /> : null}
      </Row>
      {E.D.groups.length ? <Col gap={4}>
        <Picker testID="blk-group" label={t("blk_group")} value={b.groupId || ""} onChange={v => set({ groupId: v || null })} options={groupOpts} />
        {b.groupId ? <Muted small>{t("blk_parallel")}</Muted> : null}
      </Col> : null}
      <Field testID="blk-text" label={t("blk_text")} value={b.text} onChangeText={v => set({ text: v })} multiline maxLength={4000} />
      <Col gap={6}>
        <T v="small" bold color={c.muted}>{t("blk_points")}</T>
        {b.points.map((p, i) => (
          <Row key={i} gap={6} align="flex-end">
            <Field testID={"blk-point-" + i} label="" value={p} onChangeText={v => set({ points: b.points.map((x, j) => j === i ? v : x) })} maxLength={300} style={{ flex: 1 }} />
            <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => set({ points: b.points.filter((_, j) => j !== i) })} />
          </Row>
        ))}
        {b.points.length < 12 ? <Btn small icon="plus" testID="blk-point-add" label={t("blk_pointAdd")} onPress={() => set({ points: [...b.points, ""] })} style={{ alignSelf: "flex-start" }} /> : null}
      </Col>
      <Col gap={8}>
        <T v="small" bold color={c.muted}>{t("blk_sketch")}</T>
        {b.drawing && !draw ? <Pressable accessibilityRole="button" onPress={() => setDraw(true)}><BoardView value={b.drawing} testID="blk-board-view" /></Pressable> : null}
        {draw ? <BoardEditor value={b.drawing || emptyDrawing()} onChange={d => set({ drawing: d })} testID="blk-board" /> : null}
        <Row gap={8} wrap>
          <Btn small testID="blk-draw" label={draw ? t("blk_drawDone") : b.drawing ? t("blk_drawEdit") : t("blk_draw")} onPress={() => { if (!b.drawing) set({ drawing: emptyDrawing() }); setDraw(!draw); }} />
          {b.drawing && !draw ? <Btn small kind="ghost" label={t("blk_drawDel")} onPress={() => set({ drawing: null })} /> : null}
        </Row>
        {b.photo ? <SketchImage path={b.photo} testID="blk-photo" /> : null}
        <Row gap={8} wrap>
          <Btn small icon="camera" testID="blk-photo-add" label={b.photo ? t("blk_photoNew") : t("blk_photo")} disabled={busy} onPress={photo} />
          {b.photo ? <Btn small kind="ghost" label={t("blk_photoDel")} onPress={() => set({ photo: null })} /> : null}
        </Row>
        <Muted small>{t("blk_photoD")}</Muted>
      </Col>
      <Row gap={8} wrap>
        <Btn testID="blk-save" kind="primary" label={t("save")} disabled={busy} onPress={save} />
        {!isNew ? <Btn testID="blk-del" kind="ghost" label={t("del")} onPress={() => setAsk(true)} /> : null}
      </Row>
      {ask ? <Row gap={8} wrap>
        <T v="small" bold style={{ flex: 1 }}>{t("blk_delQ")}</T>
        <Btn small label={t("no")} onPress={() => setAsk(false)} />
        <Btn small kind="danger" testID="blk-del-confirm" label={t("del")} onPress={() => { s.deleteBlock(block); s.toast(t("t_del")); onDone(); }} />
      </Row> : null}
    </Col>
  );
}
