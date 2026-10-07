// Übungsarchiv-Bausteine: Übungskarte, Einheiten-Vorlage (Blatt), Vorlagen-Auswahl, Trainerprofile (Blatt).
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, monday } from "../core/dates";
import type { Exercise, SessionTemplate, StaffProfile, StaffRoleKey, TemplateBlock } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { BoardView } from "./board";
import { Banner, Btn, ChoiceChips, Col, Field, ListItem, Muted, NumField, Picker, Row, Sheet, T, Tag } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

export const CATS: Exercise["cat"][] = ["warmup", "technik", "pass", "abschluss", "spielform", "taktik", "athletik", "torwart", "cooldown"];
export const ROLES: StaffRoleKey[] = ["chef", "co", "tw", "athletik", "physio", "betreuer", "analyst"];

/** Kurzfassung einer Einheit als Text (für die Planung). */
export function templateText(E: ReturnType<typeof useEngine>, tp: SessionTemplate): string {
  return tp.blocks.map(b => {
    const ex = b.exId ? E.D.exercises.find(x => x.id === b.exId) : null, who = b.staffId ? E.D.staff.find(x => x.id === b.staffId)?.name : null;
    return `${b.min}′ ${ex ? ex.title : b.text}${who ? ` (${who})` : ""}`;
  }).join("\n");
}
export const templateMin = (tp: SessionTemplate): number => tp.blocks.reduce((a, b) => a + (b.min || 0), 0);
/** Geschätzte Intensität einer Einheit: nach Minuten gewichtetes Mittel der Übungs-RPE (null, wenn keine Übung eine RPE hat). */
export function templateRpe(E: ReturnType<typeof useEngine>, tp: SessionTemplate): number | null {
  let sum = 0, min = 0;
  for (const b of tp.blocks) { const r = b.exId ? E.D.exercises.find(x => x.id === b.exId)?.rpe : null; if (r != null && b.min) { sum += r * b.min; min += b.min; } }
  return min ? Math.round(sum / min) : null;
}

/** Übung in einer Liste. */
export function ExerciseRow({ ex, onPress }: { ex: Exercise; onPress: () => void }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  return (
    <Pressable testID={"ex-" + ex.id} accessibilityRole="button" accessibilityLabel={ex.title} onPress={onPress}
      style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line, alignItems: "center" }}>
      <View style={{ width: 96 }}>{ex.drawing ? <BoardView value={ex.drawing} /> : <View style={{ height: 62, borderRadius: radius.m, backgroundColor: c.sunk, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.muted, fontWeight: "800", fontSize: 11 }}>{t("cat_" + ex.cat).toUpperCase()}</Text></View>}</View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={2} style={{ fontWeight: "800", fontSize: 15, color: c.ink }}>{ex.title}</Text>
        <Text style={{ fontSize: 12.5, color: c.muted }}>{t("cat_" + ex.cat)} · {ex.dur} {t("min")}{ex.players ? " · " + ex.players : ""}{ex.rpe != null ? " · RPE " + ex.rpe : ""}</Text>
        {ex.themes.length ? <Row wrap gap={4}>{ex.themes.slice(0, 4).map(th => <Tag key={th} label={th} />)}</Row> : null}
      </View>
    </Pressable>
  );
}

/** Blatt: Einheit (Vorlage) bearbeiten, speichern, in die Planung übernehmen. */
export function TemplateSheet({ tpl, onClose }: { tpl: SessionTemplate | null | undefined; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={tpl !== undefined} onClose={onClose} title={tpl ? t("tp_edit") : t("tp_new")} testID="tpl-sheet" closeLabel={t("cancel")}>
      {tpl !== undefined ? <TemplateForm key={tpl?.id || "new"} tpl={tpl} onDone={onClose} /> : null}
    </Sheet>
  );
}
function TemplateForm({ tpl, onDone }: { tpl: SessionTemplate | null; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [title, setTitle] = useState(tpl?.title || "");
  const [theme, setTheme] = useState(tpl?.theme || "");
  const [blocks, setBlocks] = useState<TemplateBlock[]>(tpl?.blocks || []);
  const [notes, setNotes] = useState(tpl?.notes || "");
  const [pick, setPick] = useState(false);
  const [use, setUse] = useState(false);
  const cur: SessionTemplate = { id: tpl?.id || tmpId(), title: title.trim(), theme: theme.trim(), blocks, notes: notes.trim() };
  const setB = (i: number, b: Partial<TemplateBlock>) => setBlocks(blocks.map((x, j) => j === i ? { ...x, ...b } : x));
  const move = (i: number, d: number) => { const n = blocks.slice(); const [x] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x); setBlocks(n); };
  const days: string[] = [];
  for (let w = 0; w <= 1; w++) for (const x of E.weekPlan(addDays(monday(E.TODAY), 7 * w)).items) if (x.date >= E.TODAY && x.train && x.train.kind !== "frei") days.push(x.date);
  const staffOpts = [{ key: "", label: t("ex_nobody") }, ...E.D.staff.map(x => ({ key: x.id, label: x.name }))];
  return (
    <Col gap={12}>
      <Row wrap gap={10}>
        <Field testID="tpl-title" label={t("tp_title")} value={title} onChangeText={setTitle} style={{ flex: 1, minWidth: 180 }} />
        <Field testID="tpl-theme" label={t("tp_theme")} value={theme} onChangeText={setTheme} style={{ flex: 1, minWidth: 140 }} />
      </Row>
      <Row between><T v="h3">{t("tp_blocks")}</T><Muted small>{tf("tp_total", { m: templateMin(cur) })}{templateRpe(E, cur) != null ? " · ≈ RPE " + templateRpe(E, cur) : ""}</Muted></Row>
      {blocks.map((b, i) => {
        const ex = b.exId ? E.D.exercises.find(x => x.id === b.exId) : null;
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, padding: 10, gap: 8 }}>
            <Row gap={8}>
              <Text style={{ fontWeight: "800", color: c.muted, width: 18 }}>{i + 1}</Text>
              {ex ? <Text style={{ flex: 1, fontWeight: "700", color: c.ink }}>{ex.title}</Text> : <Field label={t("tp_text")} value={b.text} onChangeText={v => setB(i, { text: v })} style={{ flex: 1 }} />}
              <Btn small kind="ghost" label="↑" a11y="↑" onPress={() => move(i, -1)} />
              <Btn small kind="ghost" label="↓" a11y="↓" onPress={() => move(i, 1)} />
              <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => setBlocks(blocks.filter((_, j) => j !== i))} />
            </Row>
            <Row gap={10} wrap>
              <NumField label={t("minutes")} value={b.min} min={1} max={120} step={1} onChange={v => setB(i, { min: v || 1 })} style={{ width: 100 }} />
              {E.D.staff.length ? <Picker label={t("ex_who")} value={b.staffId || ""} onChange={v => setB(i, { staffId: v || null })} options={staffOpts} style={{ flex: 1, minWidth: 150 }} /> : null}
            </Row>
          </View>
        );
      })}
      <Row gap={8} wrap>
        <Btn small icon="plus" testID="tpl-add-ex" label={t("tp_addEx")} onPress={() => setPick(true)} />
        <Btn small icon="plus" testID="tpl-add-text" label={t("tp_addText")} onPress={() => setBlocks([...blocks, { exId: null, text: "", min: 15 }])} />
      </Row>
      {pick ? <Col gap={0} testID="tpl-pick">
        <T v="eyebrow">{t("tp_pick")}</T>
        {E.D.exercises.map(ex => <ListItem key={ex.id} testID={"tpl-pick-" + ex.id} title={ex.title} sub={`${t("cat_" + ex.cat)} · ${ex.dur} ${t("min")}`} onPress={() => { setBlocks([...blocks, { exId: ex.id, text: "", min: ex.dur, staffId: ex.points.find(p => p.staffId)?.staffId || null }]); setPick(false); }} />)}
      </Col> : null}
      <Field label={t("tp_notes")} value={notes} onChangeText={setNotes} multiline />
      <Row gap={8} wrap>
        <Btn testID="tpl-save" kind="primary" label={t("save")} disabled={!title.trim() || !blocks.length} onPress={() => { s.saveTemplate(cur); s.toast(t("tp_saved")); onDone(); }} />
        {E.mods.planung ? <Btn testID="tpl-use" label={t("tp_use")} disabled={!blocks.length} onPress={() => setUse(!use)} /> : null}
        {tpl ? <Btn kind="ghost" label={t("tp_del")} onPress={() => { s.deleteTemplate(tpl.id); onDone(); }} /> : null}
      </Row>
      {use ? <Banner color={c.accent}>
        <Col gap={6}>
          <T v="small">{t("tp_useD")}</T>
          {days.length ? <Row wrap gap={6}>{days.map(d => <Btn key={d} small testID={"tpl-use-" + d} label={`${E.wt(d)} ${E.de(d)}`} onPress={() => {
            s.setOver(d, { ...(E.D.over[d] || {}), inhalt: (cur.title ? cur.title + "\n" : "") + templateText(E, cur), dauer: templateMin(cur) });
            if (title.trim()) s.saveTemplate(cur);
            s.toast(tf("tp_used", { d: E.wt(d) + " " + E.de(d) })); onDone();
          }} />)}</Row> : <Muted small>{t("tp_noDays")}</Muted>}
        </Col>
      </Banner> : null}
    </Col>
  );
}

/** Vorlagen-Auswahl (für die Planung). */
export function TemplatePicker({ visible, onPick, onClose }: { visible: boolean; onPick: (tp: SessionTemplate) => void; onClose: () => void }) {
  const E = useEngine(); const { t, tf } = E;
  return (
    <Sheet visible={visible} onClose={onClose} title={t("tp_fromArchive")} testID="tpl-picker" closeLabel={t("cancel")}>
      {E.D.templates.length ? E.D.templates.map(tp => <ListItem key={tp.id} testID={"tplp-" + tp.id} title={tp.title} sub={`${tp.theme ? tp.theme + " · " : ""}${tf("tp_total", { m: templateMin(tp) })}${templateRpe(E, tp) != null ? " · ≈ RPE " + templateRpe(E, tp) : ""}`} onPress={() => { onPick(tp); onClose(); }} />) : <Muted>{t("ar_noTpl")}</Muted>}
    </Sheet>
  );
}

/** Blatt: Trainerprofil mit Aufgabenbereichen und zugeordneten Coachingpunkten. */
export function StaffSheet({ prof, onClose }: { prof: StaffProfile | null | undefined; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={prof !== undefined} onClose={onClose} title={prof ? prof.name : t("sf_new")} testID="staff-sheet" closeLabel={t("cancel")}>
      {prof !== undefined ? <StaffForm key={prof?.id || "new"} prof={prof} onDone={onClose} /> : null}
    </Sheet>
  );
}
function StaffForm({ prof, onDone }: { prof: StaffProfile | null; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [name, setName] = useState(prof?.name || "");
  const [role, setRole] = useState<StaffRoleKey>(prof?.role || "co");
  const [areas, setAreas] = useState<string[]>(prof?.areas || []);
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState(prof?.phone || ""); const [email, setEmail] = useState(prof?.email || ""); const [note, setNote] = useState(prof?.note || "");
  const pts = prof ? E.D.exercises.flatMap(ex => ex.points.filter(p => p.staffId === prof.id).map(p => ({ ex, p }))) : [];
  return (
    <Col gap={12}>
      <Field testID="sf-name" label={t("sf_name")} value={name} onChangeText={setName} />
      <Col gap={6}><T v="small" bold color={c.muted}>{t("sf_role")}</T><ChoiceChips testID="sf-role" value={role} onChange={setRole} options={ROLES.map(r => ({ key: r, label: t("sr_" + r) }))} /></Col>
      <Col gap={6}>
        <T v="small" bold color={c.muted}>{t("sf_areas")}</T>
        <Row wrap gap={6}>{areas.map(a => <Pressable key={a} accessibilityRole="button" accessibilityLabel={t("del") + " " + a} onPress={() => setAreas(areas.filter(x => x !== a))} style={{ backgroundColor: withAlpha(c.accent, 0.12), borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: c.accentTx, fontWeight: "700", fontSize: 13 }}>{a} ✕</Text></Pressable>)}</Row>
        <Row gap={8} align="flex-end"><Field testID="sf-area" label="" value={area} onChangeText={setArea} placeholder={t("sf_areasPh")} style={{ flex: 1 }} />
          <Btn small testID="sf-area-add" label={t("pot_add")} disabled={!area.trim()} onPress={() => { setAreas([...areas, area.trim()]); setArea(""); }} /></Row>
      </Col>
      <Row wrap gap={10}>
        <Field label={t("sf_phone")} value={phone} onChangeText={setPhone} keyboardType="numbers-and-punctuation" style={{ flex: 1, minWidth: 140 }} />
        <Field label={t("sf_email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={{ flex: 1, minWidth: 180 }} />
      </Row>
      <Field label={t("sf_note")} value={note} onChangeText={setNote} multiline />
      {prof ? <Col gap={6}>
        <T v="h3">{t("sf_points")}</T>
        {pts.length ? pts.map(({ ex, p }, i) => <Row key={i} gap={8} align="flex-start"><Text style={{ color: c.accentTx }}>•</Text><Col gap={0} style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 14 }}>{p.text}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{ex.title}</Text></Col></Row>) : <Muted small>{t("sf_noPoints")}</Muted>}
      </Col> : null}
      <Row gap={8} wrap>
        <Btn testID="sf-save" kind="primary" label={t("save")} disabled={!name.trim()} onPress={() => { s.saveStaff({ id: prof?.id || tmpId(), name: name.trim(), role, areas, phone: phone.trim(), email: email.trim(), note: note.trim() }); s.toast(t("sf_saved")); onDone(); }} />
        {prof ? <Btn kind="ghost" label={t("sf_del")} onPress={() => { s.deleteStaff(prof.id); onDone(); }} /> : null}
      </Row>
    </Col>
  );
}
