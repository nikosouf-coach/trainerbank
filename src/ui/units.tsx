// Weitere Einheiten am Tag (z. B. 30 Min. Athletik vor dem Mannschaftstraining, Torwarttraining):
// Bearbeiten für einen Tag oder im Wochenrhythmus, Übersicht im Tagesplan, Wochenrhythmus in den Einstellungen,
// kleine Hinweise im Kalender und Wochenplan.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { parse } from "../core/dates";
import { MAX_UNITS_DAY, TW_THEMES, UNIT_ARTS, UNIT_DEF, cleanUnit, freeDateSlot, freeWeeklySlot, originOf, shiftTime } from "../core/units";
import type { DayUnit, UnitArt } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { StaffDot } from "./day/BlockSheet";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Col, Field, Info, Muted, NumField, NumScale, Picker, Row, Sheet, T, TimeField } from "./kit";
import { GroupChip } from "./squad/Groups";
import { radius, rpeColor, useTheme, withAlpha } from "./theme";

export type UnitTarget = { mode: "day"; date: string; unit: DayUnit | null } | { mode: "week"; wd: number; unit: DayUnit | null };

/** Blatt: Einheit anlegen/bearbeiten (für einen Tag oder jede Woche) */
export function UnitSheet({ target, onClose }: { target: UnitTarget | null; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={!!target} onClose={onClose} title={target?.unit ? t("un_edit") : t("un_new")} testID="unit-sheet" closeLabel={t("cancel")}>
      {target ? <UnitForm key={(target.mode === "day" ? target.date : "w" + target.wd) + ":" + (target.unit?.slot ?? "new")} target={target} onDone={onClose} /> : null}
    </Sheet>
  );
}

function UnitForm({ target, onDone }: { target: UnitTarget; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const S = E.team.settings;
  const wd = target.mode === "day" ? parse(target.date).getDay() : target.wd;
  const trainAt = target.mode === "day" ? (E.isTraining(target.date) ? E.zeitOf(target.date) : null) : (S.days[wd]?.zeit || null);
  const slot0 = target.unit?.slot ?? (target.mode === "day" ? freeDateSlot(E.D, target.date) : freeWeeklySlot(S, wd));
  const [u, setU] = useState<DayUnit>(() => target.unit ? { ...target.unit, themes: target.unit.themes || [] } : {
    slot: slot0 || 1, art: "athletik", title: "", zeit: trainAt ? shiftTime(trainAt, -UNIT_DEF.athletik.dauer) : "17:30", dauer: UNIT_DEF.athletik.dauer, rpe: null,
    groupId: null, staffId: null, inhalt: "", themes: [], from: target.mode === "week" ? E.TODAY : null,
  });
  const set = (p: Partial<DayUnit>) => setU(x => ({ ...x, ...p }));
  const isNew = !target.unit;
  if (isNew && slot0 == null) return <Banner color={c.warn}>{tf("un_max", { n: MAX_UNITS_DAY })}</Banner>;
  const setArt = (art: UnitArt) => {
    const p: Partial<DayUnit> = { art };
    // Dauer/Uhrzeit mitziehen, solange noch der Richtwert der bisherigen Art eingestellt ist
    if (u.dauer === UNIT_DEF[u.art].dauer) { p.dauer = UNIT_DEF[art].dauer; if (isNew && trainAt) p.zeit = shiftTime(trainAt, -UNIT_DEF[art].dauer); }
    if (art === "tw") {
      if (!u.staffId) p.staffId = E.D.staff.find(x => x.role === "tw")?.id || null;
      if (!u.groupId) p.groupId = null; // alle Torhüter
    } else if (u.art === "tw") p.themes = [];
    if (art === "athletik" && !u.staffId) p.staffId = E.D.staff.find(x => x.role === "athletik")?.id || null;
    if (art === "reha" && !u.groupId) p.groupId = E.D.groups.find(g => g.kind === "reha")?.id || null;
    set(p);
  };
  const forOpts = [{ key: "", label: u.art === "tw" ? t("un_gks") : t("un_all") }, ...E.D.groups.map(g => ({ key: g.id, label: g.name }))];
  const g = u.groupId ? E.D.groups.find(x => x.id === u.groupId) : null;
  const members = E.unitMembers(u).length;
  const showRpe = E.mods.belastung && E.grp !== "u11";
  const save = () => {
    const clean = cleanUnit(u);
    if (target.mode === "day") s.saveUnit(target.date, { ...clean, from: null, cancel: undefined });
    else {
      const list = (S.units?.[wd] || []).filter(x => x.slot !== clean.slot);
      s.saveWeeklyUnits(wd, [...list, { ...clean, cancel: undefined }].sort((a, b) => a.zeit < b.zeit ? -1 : 1));
    }
    s.toast(t("un_saved")); onDone();
  };
  const origin = target.mode === "day" && !isNew ? originOf(E.D, target.date, u.slot) : null;
  return (
    <Col gap={12}>
      {target.mode === "day" ? <Muted small>{E.wt(target.date)} {E.de(target.date)} · {origin === "weekly" || origin === "changed" ? t("un_fromWeekly") + " – " + t("un_dayOnly") : t("un_extraDay")}</Muted>
        : <Muted small>{E.tl("wd")[wd]} · {t("un_weekly")}</Muted>}
      <ChoiceChips testID="unit-art" value={u.art} onChange={setArt} options={UNIT_ARTS.map(k => ({ key: k, label: t("ua_" + k) }))} />
      <Muted small>{t("uad_" + u.art)}</Muted>
      <Field testID="unit-title" label={t("un_name")} value={u.title} onChangeText={v => set({ title: v })} placeholder={t("un_namePh")} maxLength={60} />
      <Row gap={10} wrap>
        <TimeField testID="unit-time" label={t("un_time")} value={u.zeit} onChange={v => set({ zeit: v })} style={{ width: 120 }} />
        <NumField testID="unit-dur" label={t("un_dur")} value={u.dauer} min={5} max={240} onChange={v => set({ dauer: v ?? UNIT_DEF[u.art].dauer })} style={{ width: 130 }} />
      </Row>
      {showRpe ? <Col gap={6}>
        <Row between><T v="small" bold>{t("un_rpe")}</T>
          <Pressable testID="unit-rpe-auto" accessibilityRole="checkbox" accessibilityState={{ checked: u.rpe == null }} onPress={() => set({ rpe: u.rpe == null ? E.unitRpe({ ...u, rpe: null }) : null })}>
            <Text style={{ color: u.rpe == null ? c.accentTx : c.muted, fontWeight: "700", fontSize: 13 }}>{u.rpe == null ? "✓ " : ""}{t("un_rpeAuto")} ({E.unitRpe({ ...u, rpe: null })})</Text>
          </Pressable>
        </Row>
        <NumScale testID="unit-rpe" value={u.rpe ?? E.unitRpe(u)} min={1} max={10} color={n => rpeColor(c, n)} onChange={n => set({ rpe: n })} />
      </Col> : null}
      <Picker testID="unit-for" label={t("un_for")} value={u.groupId || ""} options={forOpts} onChange={k => set({ groupId: k || null })} />
      <Muted small>{members ? tf("un_members", { n: members }) : t("un_membersNone")}</Muted>
      {g && !g.vis ? <Banner color={c.warn} testID="unit-hidden">
        <Col gap={6}><T v="small">{t("un_hiddenGroup")}</T>
          {s.can("squad") ? <Btn small testID="unit-showgroup" label={t("un_showGroup")} onPress={() => s.saveGroup({ ...g, vis: true })} style={{ alignSelf: "flex-start" }} /> : null}</Col>
      </Banner> : null}
      {E.D.staff.length ? <Picker testID="unit-staff" label={t("un_staff")} value={u.staffId || ""} options={[{ key: "", label: t("un_staffNone") }, ...E.D.staff.map(x => ({ key: x.id, label: x.name }))]} onChange={k => set({ staffId: k || null })} /> : null}
      {u.art === "tw" ? <Col gap={6}>
        <T v="small" bold>{t("un_themes")}</T>
        <Row wrap gap={6}>
          {TW_THEMES.map(k => { const on = (u.themes || []).includes(k); return (
            <Pressable key={k} testID={"unit-theme-" + k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set({ themes: on ? (u.themes || []).filter(x => x !== k) : [...(u.themes || []), k].slice(0, 8) })}
              style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? withAlpha(c.accent, 0.12) : c.surface }}>
              <Text style={{ color: c.ink, fontWeight: on ? "800" : "600", fontSize: 13 }}>{t("tw_th_" + k)}</Text>
            </Pressable>
          ); })}
        </Row>
      </Col> : null}
      <Field testID="unit-content" label={t("un_content")} value={u.inhalt} onChangeText={v => set({ inhalt: v })} placeholder={t("un_contentPh")} multiline maxLength={2000} />
      {showRpe ? <Muted small>{t("un_loadNote")}</Muted> : null}
      {target.mode === "week" ? <Muted small>{t("un_blockedNote")}</Muted> : null}
      <Row gap={8} wrap>
        <Btn testID="unit-save" kind="primary" label={t("un_save")} onPress={save} />
        {!isNew && target.mode === "day" && (origin === "weekly" || origin === "changed") ? <Btn testID="unit-cancel" label={t("un_cancelDay")} onPress={() => { s.saveUnit(target.date, { ...cleanUnit(target.unit!), cancel: true, from: null }); s.toast(t("un_cancelledT")); onDone(); }} /> : null}
        {!isNew && target.mode === "day" && origin === "changed" ? <Btn kind="ghost" testID="unit-reset" label={t("un_fromWeekly")} onPress={() => { s.deleteUnit(target.date, u.slot); onDone(); }} /> : null}
        {!isNew && (target.mode === "week" || origin === "extra") ? <Btn kind="ghost" testID="unit-del" label={t("un_del")} onPress={() => {
          if (target.mode === "week") s.saveWeeklyUnits(wd, (S.units?.[wd] || []).filter(x => x.slot !== u.slot)); else s.deleteUnit(target.date, u.slot);
          s.toast(t("un_deleted")); onDone();
        }} /> : null}
      </Row>
    </Col>
  );
}

/** Zeile einer Einheit (Uhrzeit, Titel, Dauer, Ziel-RPE, Gruppe, Zuständige) */
export function UnitLine({ u, date, onPress, right, testID }: { u: DayUnit; date?: string; onPress?: () => void; right?: React.ReactNode; testID?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const g = u.groupId ? E.D.groups.find(x => x.id === u.groupId) : null, r = E.unitRpe(u), showI = E.lvl(1) && E.grp !== "u11" && E.mods.belastung;
  const n = E.unitMembers(u).length, avg = date && date <= E.TODAY ? E.unitAvg(date, u.slot) : null;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 4, borderLeftColor: u.art === "tw" ? c.event : showI ? rpeColor(c, r) : c.line, paddingLeft: 10, paddingVertical: 6 }}>
      <Col gap={0} style={{ width: 50 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{u.zeit}</Text>
        <Text style={{ fontSize: 11, color: c.muted, fontVariant: ["tabular-nums"] }}>{shiftTime(u.zeit, u.dauer)}</Text>
      </Col>
      <Col gap={3} style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{E.unitTitle(u)}</Text>
        <Text style={{ fontSize: 12, color: c.muted }}>
          {u.dauer} {t("min")}{showI ? ` · RPE ${r}` : ""}{!g && u.art === "tw" ? " · " + t("un_gks") : ""}{u.groupId && !g ? " · " + t("un_groupGone") : ""} · {tf("un_members", { n })}
          {avg != null ? " · " + tf("un_avg", { r: E.num(avg, 1) }) : ""}
        </Text>
        {g ? <View style={{ alignSelf: "flex-start" }}><GroupChip group={g} /></View> : null}
        {u.themes?.length ? <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink }}>{u.themes.map(k => u.art === "tw" ? t("tw_th_" + k) : k).join(" · ")}</Text> : null}
      </Col>
      <StaffDot staffId={u.staffId} />
      {right}
    </View>
  );
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={E.unitTitle(u)} onPress={onPress}>{body}</Pressable> : <View testID={testID}>{body}</View>;
}

/** Tagesplan: Mannschaftstraining und weitere Einheiten in zeitlicher Reihenfolge; anlegen, ändern, absagen */
export function DayUnitsCard({ date, train }: { date: string; train: { zeit: string; dauer: number; title: string; rpe: number } | null }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const [edit, setEdit] = useState<UnitTarget | null>(null);
  // Kinder (U11): keine weiteren Einheiten anlegen – vorhandene werden angezeigt
  const units = E.unitsOn(date), cancelled = (E.D.units[date] || []).filter(u => u.cancel), canPlan = s.can("plan") && E.grp !== "u11";
  if (!units.length && !cancelled.length && !canPlan) return null;
  const showI = E.lvl(1) && E.grp !== "u11" && E.mods.belastung;
  type Row0 = { k: string; zeit: string; el: React.ReactNode };
  const rows: Row0[] = [
    ...(train ? [{ k: "main", zeit: train.zeit, el: (
      <View key="main" style={{ flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 4, borderLeftColor: showI ? rpeColor(c, train.rpe) : c.accent, paddingLeft: 10, paddingVertical: 6 }}>
        <Col gap={0} style={{ width: 50 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{train.zeit}</Text>
          <Text style={{ fontSize: 11, color: c.muted, fontVariant: ["tabular-nums"] }}>{shiftTime(train.zeit, train.dauer)}</Text>
        </Col>
        <Col gap={2} style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{t("un_main")}</Text>
          <Text style={{ fontSize: 12, color: c.muted }}>{train.title} · {train.dauer} {t("min")}{showI ? ` · RPE ${train.rpe}` : ""}</Text>
        </Col>
      </View>) }] : []),
    ...units.map(u => ({ k: "u" + u.slot, zeit: u.zeit, el: <UnitLine key={"u" + u.slot} u={u} date={date} testID={"day-unit-" + u.slot}
      onPress={canPlan ? () => setEdit({ mode: "day", date, unit: u }) : undefined}
      right={date <= E.TODAY && E.mods.belastung ? <Btn small testID={"day-unit-rpe-" + u.slot} label="RPE" onPress={() => router.push(`/coach/einheit/${date}?slot=${u.slot}`)} /> : undefined} /> })),
  ].sort((a, b) => a.zeit < b.zeit ? -1 : a.zeit > b.zeit ? 1 : 0);
  return (
    <Card testID="day-units">
      <CardTitle title={t("un_title")} info={<Info title={t("un_title")} text={[t("un_titleInfo"), t("un_dayOnly")]} />} />
      {rows.length ? <Col gap={4}>{rows.map(r => r.el)}</Col> : <Muted small>{t("un_weeklyNone")}</Muted>}
      {cancelled.map(u => (
        <Row key={"x" + u.slot} gap={8} testID={"day-unit-cancelled-" + u.slot}>
          <Text style={{ flex: 1, color: c.muted, textDecorationLine: "line-through", fontSize: 13.5 }}>{u.zeit} · {E.unitTitle(u)}</Text>
          <Muted small>{t("un_cancelled")}</Muted>
          {canPlan ? <Btn small kind="ghost" testID={"day-unit-restore-" + u.slot} label={t("un_restore")} onPress={() => {
            if (originOf(E.D, date, u.slot) === "changed") s.deleteUnit(date, u.slot); else s.saveUnit(date, { ...u, cancel: undefined });
            s.toast(t("un_restored"));
          }} /> : null}
        </Row>
      ))}
      {canPlan ? <Row gap={8} wrap>
        <Btn small icon="plus" testID="day-unit-add" label={t("un_add")} onPress={() => units.length >= MAX_UNITS_DAY ? s.toast(E.tf("un_max", { n: MAX_UNITS_DAY })) : setEdit({ mode: "day", date, unit: null })} />
        <Btn small kind="ghost" testID="day-unit-weekly" label={t("un_editWeekly")} onPress={() => router.push("/coach/training")} />
      </Row> : null}
      <UnitSheet target={edit} onClose={() => setEdit(null)} />
    </Card>
  );
}

/** Einstellungen: weitere Einheiten jede Woche (alle Wochentage, auch ohne Mannschaftstraining) */
export function WeeklyUnitsEditor() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [edit, setEdit] = useState<UnitTarget | null>(null);
  const S = E.team.settings, order = [1, 2, 3, 4, 5, 6, 0], wd = E.tl("wd"), canPlan = s.can("plan");
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Col gap={10} testID="weekly-units">
      <Muted small>{t("un_weeklyD")}</Muted>
      {order.map(d => {
        const L = [...(S.units?.[d] || [])].sort((a, b) => a.zeit < b.zeit ? -1 : 1), tr = S.days[d];
        if (!L.length && open !== d && !tr) return null;
        return (
          <Col key={d} gap={4} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }}>
            <Row between>
              <T bold>{wd[d]}{tr ? <Text style={{ color: c.muted, fontWeight: "400" }}>{`  ·  ${t("un_main")} ${tr.zeit}, ${tr.dauer || S.dauer} ${t("min")}`}</Text> : <Text style={{ color: c.muted, fontWeight: "400" }}>{"  ·  " + t("un_noTraining")}</Text>}</T>
              {canPlan && L.length < MAX_UNITS_DAY ? <Btn small kind="ghost" icon="plus" testID={"wu-add-" + d} label="" a11y={tf("un_weeklyAdd", { d: wd[d] })} onPress={() => setEdit({ mode: "week", wd: d, unit: null })} /> : null}
            </Row>
            {L.map(u => <UnitLine key={u.slot} u={u} testID={`wu-${d}-${u.slot}`} onPress={canPlan ? () => setEdit({ mode: "week", wd: d, unit: u }) : undefined} />)}
          </Col>
        );
      })}
      {canPlan ? <Row wrap gap={6}>
        {order.filter(d => !S.days[d] && !(S.units?.[d] || []).length && open !== d).map(d => <Btn key={d} small kind="ghost" testID={"wu-day-" + d} label={"+ " + wd[d]} onPress={() => { setOpen(d); setEdit({ mode: "week", wd: d, unit: null }); }} />)}
      </Row> : null}
      <Muted small>{t("un_blockedNote")}</Muted>
      <UnitSheet target={edit} onClose={() => { setEdit(null); setOpen(null); }} />
    </Col>
  );
}

/** Kleine Hinweise auf weitere Einheiten (Kalender, Wochenplan, Heute) */
export function UnitChips({ units, testID }: { units: DayUnit[]; testID?: string }) {
  const E = useEngine(); const { c } = useTheme();
  if (!units.length) return null;
  return (
    <Row wrap gap={4} testID={testID}>
      {units.map(u => (
        <View key={u.slot} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: withAlpha(u.art === "tw" ? c.event : c.accent, 0.12) }}>
          <Text style={{ fontSize: 11.5, fontWeight: "800", color: c.ink }}>+ {u.zeit} {E.unitTitle(u)}</Text>
        </View>
      ))}
    </Row>
  );
}
