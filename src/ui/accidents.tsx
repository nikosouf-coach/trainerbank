// Unfallmeldung – Oberfläche: Seite fürs Trainerteam mit Recht „Gesundheitsdaten“ (offene Meldungen mit Stand,
// abgeschlossene, „Unfall melden“ auch aus einer Verletzung), Blatt zum Erfassen (Hergang, Verletzung, Erste Hilfe,
// Behandlung, Zeugen, Meldung an Verein und Versicherung) mit „Als Text teilen“; Spieler sehen ihre eigenen Meldungen
// unter „Ich“. Logik: core/accidents.
import React, { useState } from "react";
import { Share, Text, View } from "react-native";
import { accidentErrors, accidentFromAbsence, accidentsSorted, accidentText, accOverdue, accStatus, ACC_ACTIVITIES, ACC_MAX, cleanAccident, matchOn, openAccidents } from "../core/accidents";
import { areaLabel } from "../core/body";
import { addDays } from "../core/dates";
import type { Accident } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, Check, ChoiceChips, Col, DateField, Field, Fold, Header, Info, ListItem, Muted, Picker, Row, Screen, Sheet, T, TimeField } from "./kit";
import { Icon } from "./icons";
import { useNavBack } from "./nav";
import { PlayerAvatar } from "./playerAvatar";
import { useTheme } from "./theme";

type E_ = ReturnType<typeof useEngine>;

/** Stand als Text: „Noch nicht gemeldet“, „An den Verein gemeldet am 06.11.“ … */
export function accStateText(E: E_, a: Accident): string {
  const st = accStatus(a);
  if (st === "closed") return E.t("ac_st_closed");
  if (st === "insurer") return E.tf("ac_st_insurer", { d: E.de(a.insurerOn!) }) + (a.claimNo ? ` · ${E.tf("ac_claimShort", { n: a.claimNo })}` : "");
  if (st === "club") return E.tf("ac_st_club", { d: E.de(a.clubOn!) });
  return E.t("ac_st_open");
}

/** Text für die Versicherung bzw. Geschäftsstelle */
export function accTextFor(E: E_, a: Accident): string {
  const p = E.P(a.pid), m = a.matchId ? E.D.matches.find(x => x.id === a.matchId) : undefined;
  return accidentText(a, { t: E.t, tf: E.tf, de: E.de, areaText: code => areaLabel(E.t, code), player: p, club: E.team.club, team: E.team.name, match: m });
}

// =====================================================================
// Seite: Unfallmeldungen (Trainerteam, Recht „Gesundheitsdaten“)
// =====================================================================
export function AccidentsPage() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const nb = useNavBack("unfaelle");
  const [edit, setEdit] = useState<Accident | null>(null);
  if (E.mods.unfall === false) return <Screen testID="coach-unfaelle"><Header title={t("ac_title")} onBack={nb.onBack} backLabel={nb.backLabel} /><Muted>{t("ac_modOff")}</Muted></Screen>;
  if (!s.can("health")) return <Screen testID="coach-unfaelle"><Header title={t("ac_title")} onBack={nb.onBack} backLabel={nb.backLabel} /><Muted>{t("ac_noPerm")}</Muted></Screen>;
  const all = accidentsSorted(E.D), open = all.filter(a => !a.closed), done = all.filter(a => a.closed);
  const fresh = (): Accident => cleanAccident({ id: tmpId(), pid: "", date: E.TODAY });
  const row = (a: Accident, i: number) => {
    const p = E.P(a.pid), late = accOverdue(a, E.TODAY);
    return (
      <View key={a.id} testID={"ac-" + a.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
        {p ? <PlayerAvatar p={p} size={34} /> : null}
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{p ? E.name(p) : "–"}</Text>
          <Text style={{ fontSize: 13, color: c.ink }}>{`${E.wt(a.date)} ${E.de(a.date)} · ${t("ac_act_" + a.activity)}`}</Text>
          <Muted small>{a.injury}</Muted>
          <Text testID={"ac-st-" + a.id} style={{ fontSize: 12.5, fontWeight: "700", color: late ? c.warn : a.closed ? c.muted : c.accentTx }}>{accStateText(E, a) + (late ? ` · ${t("ac_late")}` : "")}</Text>
        </Col>
        <Btn small kind="ghost" testID={"ac-edit-" + a.id} label={t("ac_open")} onPress={() => setEdit(a)} />
      </View>
    );
  };
  return (
    <Screen testID="coach-unfaelle">
      <Header title={t("ac_title")} sub={t("ac_sub")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("ac_title")} text={t("ac_info")} />}
        right={<Btn small kind="primary" icon="plus" testID="ac-add" label={t("ac_add")} onPress={() => setEdit(fresh())} />} />
      <Card testID="ac-open">
        <CardTitle title={tf("ac_openN", { n: open.length })} />
        {open.length ? open.map(row) : <Muted>{t("ac_none")}</Muted>}
      </Card>
      {done.length ? <Fold testID="ac-done" title={tf("ac_doneN", { n: done.length })}>{done.map(row)}</Fold> : null}
      <Muted small>{t("ac_privacy")}</Muted>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit && edit.id.startsWith("tmp-") ? t("ac_new") : t("ac_sheet")} testID="ac-sheet" closeLabel={t("um_cancel")}>
        {edit ? <AccidentForm key={edit.id} draft={edit} onDone={() => setEdit(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

function AccidentForm({ draft, onDone }: { draft: Accident; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const isNew = draft.id.startsWith("tmp-");
  const [a, setA] = useState<Accident>(draft);
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const set = (x: Partial<Accident>) => { setA({ ...a, ...x }); setErrs([]); };
  const players = E.D.players.filter(p => p.active !== false).sort((x, y) => E.name(x).localeCompare(E.name(y), "de"));
  // Vorlagen: Verletzungen der letzten 30 Tage ohne Meldung
  const injuries = isNew ? E.D.absences.filter(ab => ab.typ === "verletzung" && ab.von >= addDays(E.TODAY, -30) && !E.D.accidents.some(x => x.absenceId === ab.id)) : [];
  const m = a.activity === "match" || a.activity === "travel" ? matchOn(E.D, a.date) : undefined;
  const clean = (): Accident => cleanAccident({ ...a, matchId: m?.id ?? null });
  const save = async () => {
    const x = clean(), e = accidentErrors(x, E.TODAY);
    if (e.length) { setErrs(e); return; }
    setBusy(true); try { if (await s.saveAccident(x)) onDone(); } finally { setBusy(false); }
  };
  const share = () => { Share.share({ message: accTextFor(E, clean()) }).catch(() => undefined); };
  const remove = async () => { setBusy(true); try { if (await s.deleteAccident(a.id)) onDone(); } finally { setBusy(false); } };
  const p = E.P(a.pid);
  return (
    <Col gap={14}>
      {isNew && injuries.length ? (
        <Picker testID="ac-from" label={t("ac_from")} value={a.absenceId || ""} onChange={id => { const ab = injuries.find(x => x.id === id); if (ab) set({ ...accidentFromAbsence(ab) }); }}
          options={[{ key: "", label: t("ac_fromNone") }, ...injuries.map(ab => { const q = E.P(ab.pid); return { key: ab.id, label: q ? E.name(q) : "–", sub: tf("ac_fromSub", { d: E.de(ab.von) }) + (ab.area ? ` · ${areaLabel(t, ab.area)}` : "") }; })]} />
      ) : null}
      {isNew ? (
        <Picker testID="ac-pid" label={t("ac_player")} value={a.pid} onChange={v => set({ pid: v })} options={[{ key: "", label: t("kr_pick") }, ...players.map(x => ({ key: x.id, label: E.name(x) }))]} />
      ) : (
        <Row gap={10}>{p ? <PlayerAvatar p={p} size={34} /> : null}<T bold style={{ flex: 1 }}>{p ? E.name(p) : "–"}</T></Row>
      )}
      <Row gap={12} wrap align="flex-start">
        <DateField testID="ac-date" label={t("ac_date")} value={a.date || null} onChange={v => set({ date: v || "" })} lang={E.tr.lang} style={{ flexGrow: 1, minWidth: 150 }} />
        <TimeField testID="ac-time" label={t("ac_time")} value={a.time || ""} onChange={v => set({ time: v || null })} lang={E.tr.lang} style={{ width: 130 }} />
      </Row>
      <Col gap={6}>
        <T v="small" bold>{t("ac_activity")}</T>
        <ChoiceChips testID="ac-act" value={a.activity} onChange={v => set({ activity: v })} options={ACC_ACTIVITIES.map(k => ({ key: k, label: t("ac_act_" + k) }))} />
        {m ? <Muted small testID="ac-match">{tf("ac_matchOf", { g: m.gegner, h: m.heim ? t("home") : t("away") })}</Muted> : null}
      </Col>
      <Field testID="ac-place" label={t("ac_place")} placeholder={t("ac_placePh")} value={a.place} onChangeText={v => set({ place: v })} maxLength={ACC_MAX.place} />
      <Field testID="ac-how" multiline label={t("ac_how")} placeholder={t("ac_howPh")} value={a.how} onChangeText={v => set({ how: v })} maxLength={ACC_MAX.how} />
      <Field testID="ac-injury" label={t("ac_injury")} placeholder={t("ac_injuryPh")} value={a.injury} onChangeText={v => set({ injury: v })} maxLength={ACC_MAX.injury} />
      {a.area ? <Row gap={8}><Muted small style={{ flex: 1 }}>{tf("ac_area", { a: areaLabel(t, a.area) })}</Muted><Btn small kind="ghost" testID="ac-area-x" label={t("ac_areaRemove")} onPress={() => set({ area: null })} /></Row> : null}
      <Field testID="ac-aid" label={t("ac_firstAid")} placeholder={t("ac_firstAidPh")} value={a.firstAid} onChangeText={v => set({ firstAid: v })} maxLength={ACC_MAX.firstAid} />
      <Field testID="ac-treat" label={t("ac_treatment")} placeholder={t("ac_treatmentPh")} value={a.treatment} onChangeText={v => set({ treatment: v })} maxLength={ACC_MAX.treatment} />
      <Field testID="ac-wit" label={t("ac_witnesses")} placeholder={t("ac_witnessesPh")} value={a.witnesses} onChangeText={v => set({ witnesses: v })} maxLength={ACC_MAX.witnesses} />
      <Col gap={10} style={{ paddingTop: 4, borderTopWidth: 1, borderTopColor: c.line }}>
        <T bold>{t("ac_report")}</T>
        <Row gap={12} wrap align="flex-start">
          <DateField testID="ac-club" label={t("ac_clubOn")} value={a.clubOn} onChange={v => set({ clubOn: v })} lang={E.tr.lang} style={{ flexGrow: 1, minWidth: 150 }} />
          <DateField testID="ac-ins" label={t("ac_insurerOn")} value={a.insurerOn} onChange={v => set({ insurerOn: v })} lang={E.tr.lang} style={{ flexGrow: 1, minWidth: 150 }} />
        </Row>
        <Field testID="ac-claim" label={t("ac_claimNo")} value={a.claimNo} onChangeText={v => set({ claimNo: v })} maxLength={ACC_MAX.claimNo} />
        <Field testID="ac-note" multiline label={t("ac_note")} value={a.note} onChangeText={v => set({ note: v })} maxLength={ACC_MAX.note} />
        <Check testID="ac-closed" label={t("ac_closed")} value={a.closed} onChange={v => set({ closed: v })} />
        <Muted small>{t("ac_reportHint")}</Muted>
      </Col>
      {errs.length ? <Banner color={c.crit} testID="ac-err">{errs.map(e => t("ac_err_" + e)).join(" ")}</Banner> : null}
      <Row gap={10} wrap>
        <Btn kind="primary" testID="ac-save" label={t("save")} disabled={busy} onPress={save} />
        <Btn testID="ac-share" icon="export" label={t("ac_share")} onPress={share} />
        {!isNew ? (del
          ? <Btn kind="danger" testID="ac-del-ok" label={t("ac_delSure")} disabled={busy} onPress={remove} />
          : <Btn kind="ghost" testID="ac-del" label={t("kr_delete")} onPress={() => setDel(true)} />) : null}
      </Row>
    </Col>
  );
}

// =====================================================================
// Spieler: Ich → eigene Unfallmeldungen (nur lesen, nur wenn es welche gibt)
// =====================================================================
export function MyAccidentsItem() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const pid = s.mePid || "";
  const L = accidentsSorted(E.D).filter(a => a.pid === pid);
  if (!pid || !L.length || E.mods.unfall === false) return null;
  const nOpen = L.filter(a => !a.closed).length;
  return (
    <>
      <ListItem testID="me-unfall" title={t("ac_my")} sub={nOpen ? tf("ac_myOpen", { n: nOpen }) : t("ac_myDone")} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("ac_my")} testID="ac-my-sheet" closeLabel={t("close")}>
        <Col gap={12}>
          {L.map((a, i) => (
            <Col key={a.id} gap={3} testID={"ac-my-" + a.id} style={{ paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <T bold>{`${E.wt(a.date)} ${E.de(a.date)} · ${t("ac_act_" + a.activity)}`}</T>
              <T v="small">{a.injury}</T>
              <Text style={{ fontSize: 13, fontWeight: "700", color: a.closed ? c.muted : c.accentTx }}>{accStateText(E, a)}</Text>
            </Col>
          ))}
          <Muted small>{t("ac_myHint")}</Muted>
        </Col>
      </Sheet>
    </>
  );
}

/** Zahl fürs Menü: offene Meldungen, die noch nicht an den Verein gingen (nach ein paar Tagen) */
export const accidentBadge = (E: E_): number => openAccidents(E.D).filter(a => accOverdue(a, E.TODAY)).length;
