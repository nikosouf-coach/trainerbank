// Foto-Erlaubnis – Oberfläche: Seite fürs Trainerteam (Kanal wählen: wer darf, wer nicht, wer fehlt; alle Spieler mit
// Stand je Kanal; Erklärung eintragen) und für Spieler unter „Ich“ (eigener Stand, ab 18 selbst zustimmen, Nein immer).
// Regeln: core/photos.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { groupOf } from "../core/classes";
import { canSelfConsent, cleanPhotoConsent, missingParty, needsRenewal, photoAge, photoCounts, photoRows, photoState, PHOTO_BY, PHOTO_CHANNELS, PHOTO_NOTE_MAX, selfChange, type PhotoRow } from "../core/photos";
import type { PhotoBy, PhotoChannel, PhotoConsent } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Col, DateField, Field, Header, Info, ListItem, Muted, Row, Screen, Seg, Sheet, T } from "./kit";
import { Icon } from "./icons";
import { useNavBack } from "./nav";
import { PlayerAvatar } from "./playerAvatar";
import { useTheme } from "./theme";

type State = ReturnType<typeof photoState>;
const stateColor = (c: ReturnType<typeof useTheme>["c"], st: State): string => st === "yes" ? c.ok : st === "no" ? c.crit : st === "missing" ? c.warn : c.muted;
const SYM: Record<State, string> = { yes: "✓", no: "✕", open: "–", missing: "!" };

/** Wer muss zustimmen (fürs Alter) */
export const whoMust = (t: (k: string) => string, age: number | null): string =>
  age == null ? t("ph_whoUnknown") : age >= 18 ? t("ph_who18") : age >= 14 ? t("ph_who14") : t("ph_whoKid");

/** Kleine Statusmarke je Kanal (Buchstabe + Zeichen) */
function Pill({ ch, st }: { ch: PhotoChannel; st: State }) {
  const E = useEngine(); const { c } = useTheme(); const col = stateColor(c, st);
  return (
    <View accessibilityLabel={`${E.t("ph_ch_" + ch)}: ${E.t("ph_st_" + st)}`} style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: col }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted }}>{E.t("ph_short_" + ch)}</Text>
      <Text style={{ fontSize: 12, fontWeight: "800", color: col }}>{SYM[st]}</Text>
    </View>
  );
}

// =====================================================================
// Seite: Foto-Erlaubnis (Trainerteam)
// =====================================================================
export function PhotosPage() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const nb = useNavBack("fotos");
  const [ch, setCh] = useState<PhotoChannel>("social");
  const [edit, setEdit] = useState<PhotoRow | null>(null);
  if (E.mods.fotos === false) return <Screen testID="coach-fotos"><Header title={t("ph_title")} onBack={nb.onBack} backLabel={nb.backLabel} /><Muted>{t("ph_modOff")}</Muted></Screen>;
  const canEdit = s.can("squad");
  const rows = photoRows(E.D, E.TODAY).sort((a, b) => { const pa = E.P(a.pid), pb = E.P(b.pid); return pa && pb ? E.name(pa).localeCompare(E.name(pb), "de") : 0; });
  const k = photoCounts(rows, ch);
  const not = rows.filter(r => r.states[ch] !== "yes"), yes = rows.filter(r => r.states[ch] === "yes");
  const renew = rows.filter(needsRenewal);
  const name = (pid: string) => { const p = E.P(pid); return p ? E.name(p) : "–"; };
  const reason = (r: PhotoRow): string => r.states[ch] === "missing" ? t("ph_miss_" + missingParty(r.c, r.age)) : t("ph_st_" + r.states[ch]);
  return (
    <Screen testID="coach-fotos">
      <Header title={t("ph_title")} sub={t("ph_sub")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("ph_title")} text={t("ph_info")} />} />
      <Card testID="ph-channel">
        <Seg testID="ph-ch" wrap value={ch} onChange={setCh} options={PHOTO_CHANNELS.map(x => ({ key: x, label: t("ph_ch_" + x) }))} />
        <Muted small testID="ph-counts">{tf("ph_counts", { y: k.yes, n: k.no, o: k.open + k.missing })}</Muted>
      </Card>
      <Card testID="ph-not" tone={not.length ? c.warn : undefined}>
        <CardTitle title={tf(ch === "name" ? "ph_notName" : "ph_not", { n: not.length })} />
        {!not.length ? <Muted>{t("ph_allOk")}</Muted> : not.map(r => (
          <Row key={r.pid} gap={10} testID={"ph-not-" + r.pid}>
            <Text style={{ width: 14, textAlign: "center", fontWeight: "800", color: stateColor(c, r.states[ch]) }}>{SYM[r.states[ch]]}</Text>
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: c.ink, fontWeight: "600" }}>{name(r.pid)}</Text>
            <Text numberOfLines={1} style={{ flexShrink: 0, maxWidth: "55%", textAlign: "right", fontSize: 12.5, color: stateColor(c, r.states[ch]) }}>{reason(r)}</Text>
          </Row>
        ))}
        {yes.length ? <Muted small testID="ph-yes">{tf(ch === "name" ? "ph_yesName" : "ph_yes", { n: yes.length }) + ": " + yes.map(r => { const p = E.P(r.pid); return p ? `${p.vn} ${p.nn.slice(0, 1)}.` : ""; }).join(", ")}</Muted> : null}
      </Card>
      {renew.length ? (
        <Banner color={c.warn} testID="ph-renew">{tf("ph_renew", { n: renew.map(r => name(r.pid)).join(", ") })}</Banner>
      ) : null}
      <Card testID="ph-all">
        <CardTitle title={tf("ph_all", { n: rows.length })} />
        {rows.map((r, i) => {
          const p = E.P(r.pid);
          if (!p) return null;
          return (
            <ListItem key={r.pid} testID={"ph-p-" + r.pid} title={E.name(p)} left={<PlayerAvatar p={p} size={32} />}
              sub={(r.c?.by ? t("ph_by_" + r.c.by) + (r.c.on ? ` · ${E.de(r.c.on)}` : "") : t("ph_noDecl")) + (r.age != null ? ` · ${tf("ph_age", { n: r.age })}` : "")}
              onPress={canEdit ? () => setEdit(r) : undefined}
              right={<Row gap={4} wrap style={{ maxWidth: 170, justifyContent: "flex-end" }}>{PHOTO_CHANNELS.map(x => <Pill key={x} ch={x} st={r.states[x]} />)}</Row>} />
          );
        })}
        <Muted small>{t("ph_legend")}</Muted>
      </Card>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={t("ph_sheet")} testID="ph-sheet" closeLabel={t("um_cancel")}>
        {edit ? <PhotoForm key={edit.pid} row={edit} onDone={() => setEdit(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

type V = "yes" | "no" | "open";
const toV = (b: boolean | null): V => b === true ? "yes" : b === false ? "no" : "open";
const fromV = (v: V): boolean | null => v === "yes" ? true : v === "no" ? false : null;

function PhotoForm({ row, onDone }: { row: PhotoRow; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const base = cleanPhotoConsent(row.c);
  const [v, setV] = useState<Record<PhotoChannel, V>>(() => Object.fromEntries(PHOTO_CHANNELS.map(ch => [ch, toV(base[ch])])) as Record<PhotoChannel, V>);
  const [by, setBy] = useState<PhotoBy | null>(base.by ?? (row.age != null && row.age < 18 ? "parents" : "player"));
  const [on, setOn] = useState<string | null>(base.on ?? E.TODAY);
  const [note, setNote] = useState(base.note);
  const [busy, setBusy] = useState(false);
  const p = E.P(row.pid);
  const anyYes = PHOTO_CHANNELS.some(ch => v[ch] === "yes");
  const draft: PhotoConsent = { ...base, ...Object.fromEntries(PHOTO_CHANNELS.map(ch => [ch, fromV(v[ch])])), by, on, note };
  const weak = anyYes && PHOTO_CHANNELS.some(ch => photoState(draft, ch, row.age) === "missing");
  const save = async () => { setBusy(true); try { if (await s.savePhotoConsent(row.pid, draft)) onDone(); } finally { setBusy(false); } };
  return (
    <Col gap={14}>
      <Row gap={10}>{p ? <PlayerAvatar p={p} size={34} /> : null}<Col gap={1} style={{ flex: 1 }}><T bold>{p ? E.name(p) : "–"}</T><Muted small>{whoMust(t, row.age)}</Muted></Col></Row>
      {PHOTO_CHANNELS.map(ch => (
        <Col key={ch} gap={6}>
          <T v="small" bold>{t("ph_q_" + ch)}</T>
          <ChoiceChips testID={"ph-v-" + ch} value={v[ch]} onChange={x => setV({ ...v, [ch]: x })}
            options={[{ key: "yes", label: t("ph_yesL") }, { key: "no", label: t("ph_noL") }, { key: "open", label: t("ph_openL") }]} />
        </Col>
      ))}
      <Col gap={6}>
        <T v="small" bold>{t("ph_byL")}</T>
        <ChoiceChips testID="ph-by" value={by} onChange={setBy} options={PHOTO_BY.map(x => ({ key: x, label: t("ph_by_" + x) }))} />
      </Col>
      <DateField testID="ph-on" label={t("ph_onL")} value={on} onChange={setOn} lang={E.tr.lang} />
      <Field testID="ph-note" label={t("ph_noteL")} placeholder={t("ph_notePh")} value={note} onChangeText={setNote} maxLength={PHOTO_NOTE_MAX} />
      {weak ? <Banner color={c.warn} testID="ph-weak">{tf("ph_weak", { w: whoMust(t, row.age) })}</Banner> : null}
      <Muted small>{t("ph_formHint")}</Muted>
      <Btn kind="primary" testID="ph-save" label={t("save")} disabled={busy} onPress={save} />
    </Col>
  );
}

// =====================================================================
// Spieler: Ich → Foto-Erlaubnis (Zeile mit Stand, Blatt zum Ändern)
// =====================================================================
export function MyPhotoItem() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const p = s.mePid ? E.P(s.mePid) : undefined;
  if (!p || E.mods.fotos === false) return null;
  const age = photoAge(p, E.TODAY), cur = E.D.photos[p.id];
  const st = PHOTO_CHANNELS.map(ch => photoState(cur, ch, age));
  const sub = st.every(x => x === "yes") ? t("ph_meAll") : st.every(x => x === "no") ? t("ph_meNone") : st.some(x => x === "yes") ? t("ph_meSome") : t("ph_meOpen");
  return (
    <>
      <ListItem testID="me-fotos" title={t("ph_title")} sub={sub} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("ph_title")} testID="ph-me-sheet" closeLabel={t("um_cancel")}>
        {open ? <MyPhotoForm onDone={() => setOpen(false)} /> : null}
      </Sheet>
    </>
  );
}

function MyPhotoForm({ onDone }: { onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const p = s.mePid ? E.P(s.mePid) : undefined;
  const age = photoAge(p, E.TODAY);
  const self = canSelfConsent(age, groupOf(E.team.cls) === "akt");
  const cur = E.D.photos[p?.id || ""];
  const [v, setV] = useState<Partial<Record<PhotoChannel, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const next = selfChange(cur, v, self, E.TODAY), base = cleanPhotoConsent(cur);
  const dirty = PHOTO_CHANNELS.some(ch => v[ch] !== undefined && v[ch] !== base[ch]);
  const save = async () => { setBusy(true); try { if (p && await s.savePhotoSelf(p.id, v)) onDone(); } finally { setBusy(false); } };
  return (
    <Col gap={12}>
      <T v="small">{self ? t("ph_meSelf") : age != null && age < 14 ? t("ph_meKid") : t("ph_meTeen")}</T>
      {cur?.by ? <Muted small>{tf("ph_meBy", { b: t("ph_by_" + cur.by), d: cur.on ? E.de(cur.on) : "–" })}</Muted> : null}
      <View testID="ph-me">
        {PHOTO_CHANNELS.map((ch, i) => {
          const st = photoState(next, ch, age), val = next[ch];
          return (
            <Col key={ch} gap={6} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Row gap={8}><Text style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: c.ink }}>{t("ph_q_" + ch)}</Text>
                <Text testID={"ph-me-st-" + ch} style={{ fontSize: 13, fontWeight: "700", color: stateColor(c, st) }}>{t("ph_st_" + st)}</Text></Row>
              {self ? (
                <ChoiceChips testID={"ph-me-" + ch} value={val === true ? "yes" : val === false ? "no" : null} onChange={x => setV({ ...v, [ch]: x === "yes" })}
                  options={[{ key: "yes", label: t("ph_yesL") }, { key: "no", label: t("ph_noL") }]} />
              ) : val !== false ? (
                <Btn small kind="ghost" testID={"ph-me-no-" + ch} label={t("ph_meNo")} onPress={() => setV({ ...v, [ch]: false })} style={{ alignSelf: "flex-start" }} />
              ) : null}
            </Col>
          );
        })}
      </View>
      <Muted small>{t("ph_meRevoke")}</Muted>
      <Btn kind="primary" testID="ph-me-save" label={t("save")} disabled={busy || !dirty} onPress={save} />
    </Col>
  );
}
