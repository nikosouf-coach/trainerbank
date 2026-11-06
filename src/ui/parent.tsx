// Eltern-Zugang – Eltern-Ansicht: Termine des Kindes (Zu-/Absage bei Nominierung, Abmelden), Abmeldungen, Elterninfo
// (lesen, bestätigen), Einwilligungen (unter 16: Nutzung der App; Gesundheitsangaben; Foto-Erlaubnis), was Eltern sehen;
// Code einlösen; für Spieler unter „Ich“: verknüpfte Eltern (volljährig: verlängern oder entfernen).
// Die Daten kommen als Paket vom Server – nur, was Eltern sehen dürfen (core/parents, Migration 20261105000009).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { createEngine } from "../core/engine";
import { answersAllowed } from "../core/nomination";
import { childAgenda, cleanInviteCode, GUARDIAN_NAME_MAX, GUARDIAN_RELATIONS, inviteCodeOk, isMinor, isUnder16, parentAbsenceErrors, parentTodo, PARENT_ABS_TYPES, type ChildItem } from "../core/parents";
import { cleanPhotoConsent, missingParty, photoAge, photoState, PHOTO_CHANNELS } from "../core/photos";
import type { AbsenceType, GuardianRelation, PhotoChannel } from "../core/types";
import type { ChildData, GuardianChild } from "../data/api";
import { useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Btn, Card, CardTitle, Check, ChoiceChips, Col, DateField, Field, Header, Info, ListItem, Muted, Row, Screen, Sheet, T } from "./kit";
import { useTheme } from "./theme";

type E_ = ReturnType<typeof createEngine>;
const ROW = 96;

// =====================================================================
// Eltern-Ansicht
// =====================================================================
export function ParentHome() {
  const s = useStore(); const { t, tf } = s.tr; const router = useRouter(); const { c } = useTheme();
  const P = s.parent;
  const child: GuardianChild | undefined = P ? P.children.find(x => x.pid === P.sel) || P.children[0] : undefined;
  const data: ChildData | undefined = child && P ? P.data[child.pid] : undefined;
  const E = useMemo(() => data ? createEngine(data.D, { lang: s.lang }) : null, [data, s.lang]);
  const toTeam = s.phase === "ready" && !s.isDemo, only = s.phase === "parent";
  // zurück in der App: neu laden (höchstens alle zwei Minuten) – neue Nominierungen, Infos, Bestätigung des Trainerteams
  const last = useRef(Date.now()), reload = useRef(s.parentReload); reload.current = s.parentReload;
  useEffect(() => {
    const sub = AppState.addEventListener("change", st => { if (st === "active" && Date.now() - last.current > 120000) { last.current = Date.now(); reload.current(); } });
    return () => sub.remove();
  }, []);
  return (
    <Screen testID="parent-home">
      <Header eyebrow={t("el_eyebrow")} title={child ? `${child.vn} ${child.nn}`.trim() : t("el_title")} sub={child ? child.team + (child.club ? " · " + child.club : "") : undefined}
        info={<Info title={t("el_title")} text={t("el_info")} />}
        right={<Btn small kind="ghost" icon="plus" testID="el-add" label={t("el_addChild")} onPress={() => router.push("/parent-link")} />} />
      {P && P.children.length > 1 ? (
        <ChoiceChips testID="el-kids" value={child?.pid || null} onChange={v => s.parentSelect(v)} options={P.children.map(k => ({ key: k.pid, label: k.vn }))} />
      ) : null}
      {!child ? (
        <Card testID="el-empty"><T>{t("el_none")}</T>
          <Btn kind="primary" testID="el-empty-link" label={t("el_enterCode")} onPress={() => router.push("/parent-link")} style={{ alignSelf: "flex-start" }} /></Card>
      ) : child.status === "pending" ? (
        <Card testID="el-pending" tone={c.warn}><T bold>{t("el_pendingT")}</T><Muted>{tf("el_pending", { n: child.vn, t: child.team })}</Muted></Card>
      ) : child.off ? (
        <Card testID="el-off"><T bold>{t("el_offT")}</T><Muted>{tf("el_off", { t: child.team })}</Muted></Card>
      ) : !child.access ? (
        <Card testID="el-adult"><T bold>{tf("el_adultT", { n: child.vn })}</T><Muted>{tf("el_adult", { n: child.vn })}</Muted></Card>
      ) : data && E ? (
        <ChildView key={child.pid} child={child} data={data} E={E} />
      ) : (
        <Card testID="el-loading"><Muted>{t("el_loading")}</Muted>
          <Btn small testID="el-reload" label={t("el_reload")} onPress={() => s.parentReload()} style={{ alignSelf: "flex-start" }} /></Card>
      )}
      {child ? <ParentPrivacy child={child} /> : null}
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListItem testID="el-konto" title={t("pl_account")} sub={t("el_kontoSub")} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => router.push("/konto")} />
        <ListItem testID="el-wiki" title={t("wk_menu")} sub={t("wk_menuSub")} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => router.push("/wiki")} />
        {only ? <ListItem testID="el-start" title={t("el_startMore")} sub={t("el_startMoreSub")} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => router.push("/start")} /> : null}
      </Card>
      <Row gap={10} wrap>
        <Btn kind="ghost" testID="el-refresh" label={t("el_refresh")} onPress={() => { last.current = Date.now(); s.parentReload(); }} />
        {toTeam ? <Btn testID="el-back" icon="back" label={t("el_backToTeam")} onPress={async () => { await s.setParentMode(false); router.replace("/"); }} /> : null}
        {only ? <Btn kind="ghost" testID="el-logout" label={t("au_logout")} onPress={async () => { await s.signOut(); router.replace("/"); }} /> : null}
      </Row>
    </Screen>
  );
}

function ChildView({ child, data, E }: { child: GuardianChild; data: ChildData; E: E_ }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [abs, setAbs] = useState<string | null>(null);
  const todo = parentTodo(E, child.pid, data.posts, data.consents);
  const items = childAgenda(E, child.pid, 14);
  const absOn = E.team.settings.playerAbs ?? true;
  const parts = [todo.open ? tf(todo.open === 1 ? "el_todoOpen1" : "el_todoOpenN", { n: todo.open }) : "", todo.ack ? tf(todo.ack === 1 ? "el_todoAck1" : "el_todoAckN", { n: todo.ack }) : "",
    todo.consent ? t("el_todoConsent") : ""].filter(Boolean);
  return (
    <>
      {parts.length ? <Banner color={c.warn} testID="el-todo">{t("el_todo") + " " + parts.join(" · ")}</Banner> : null}
      <Card testID="el-agenda">
        <CardTitle title={t("el_agenda")} right={absOn ? <Btn small kind="ghost" icon="plus" testID="el-abs-new" label={t("el_absNew")} onPress={() => setAbs(E.TODAY)} /> : null} />
        {!items.length ? <Muted>{t("el_agendaNone")}</Muted> : items.map((x, i) => <AgendaRow key={x.date + x.kind + x.time + i} x={x} first={!i} child={child} E={E} absOn={absOn} onAbs={setAbs} />)}
        {!absOn ? <Muted small>{t("el_absOff")}</Muted> : null}
      </Card>
      <AbsenceList child={child} data={data} E={E} />
      <PostsCard child={child} data={data} />
      <ConsentsCard child={child} data={data} E={E} />
      <Sheet visible={!!abs} onClose={() => setAbs(null)} title={tf("el_absTitle", { n: child.vn })} testID="el-abs-sheet" closeLabel={t("um_cancel")}>
        {abs ? <AbsenceForm child={child} data={data} E={E} from={abs} onDone={() => setAbs(null)} /> : null}
      </Sheet>
    </>
  );
}

function AgendaRow({ x, first, child, E, absOn, onAbs }: { x: ChildItem; first: boolean; child: GuardianChild; E: E_; absOn: boolean; onAbs: (d: string) => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [no, setNo] = useState(false);
  const title = x.kind === "training" ? t("el_training") : x.kind === "match" ? tf("el_match", { g: x.title, h: t(x.match?.heim ? "home" : "away") }) : x.title;
  const canAnswer = !!x.match && !!x.squad && !!x.nom && !x.absent && answersAllowed(E.team, x.match, new Date());
  const nomTxt = x.nom && x.squad ? (x.nom.standby ? t("el_standby") : t("el_squad")) + " · " + (x.nom.answer === "yes" ? t("el_yes") : x.nom.answer === "no" ? t("el_no") : t("el_open"))
    + (x.nom.answer && x.nom.byGuardian ? " " + t("el_byParents") : "") : "";
  const answer = (a: "yes" | "no", reason = "") => s.parentDo(child.pid, api => api.guardianAnswer(x.match!.id, child.pid, a, reason), a === "yes" ? "el_saidYes" : "el_saidNo");
  return (
    <View testID={`el-item-${x.date}-${x.kind}`} style={{ paddingVertical: 9, borderTopWidth: first ? 0 : 1, borderTopColor: c.line, gap: 6 }}>
      <Row gap={8} align="flex-start">
        <Text style={{ width: ROW, fontSize: 13, color: c.muted, fontVariant: ["tabular-nums"] }}>{`${E.wt(x.date)} ${E.de(x.date)}`}{x.time ? `\n${x.time}` : ""}</Text>
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: x.absent ? c.muted : c.ink }}>{title}</Text>
          {x.absent ? <Text testID={"el-absent-" + x.date} style={{ fontSize: 13, color: c.muted }}>{t("el_absent")}</Text> : null}
          {nomTxt ? <Text testID={"el-nom-" + x.date} style={{ fontSize: 13, color: x.nom?.answer ? c.ink : c.warn, fontWeight: "600" }}>{nomTxt}</Text> : null}
          {x.squad && (x.squad.meetTime || x.squad.meetPlace) ? <Muted small>{tf("el_meet", { t: x.squad.meetTime || "–", p: x.squad.meetPlace || "–" })}</Muted> : null}
          {x.squad?.note ? <Muted small>{x.squad.note}</Muted> : null}
        </Col>
      </Row>
      {canAnswer ? (
        <Row gap={8} wrap style={{ paddingLeft: ROW + 8 }}>
          {x.nom!.answer !== "yes" ? <Btn small kind="primary" testID={"el-yes-" + x.date} label={t("el_sayYes")} onPress={() => answer("yes")} /> : null}
          {x.nom!.answer !== "no" ? <Btn small testID={"el-no-" + x.date} label={t("el_sayNo")} onPress={() => setNo(true)} /> : null}
        </Row>
      ) : absOn && !x.absent && !x.nom && x.kind !== "event" ? (
        <Row style={{ paddingLeft: ROW + 8 }}><Btn small kind="ghost" testID={"el-abs-" + x.date} label={t("el_absThis")} onPress={() => onAbs(x.date)} /></Row>
      ) : null}
      <Sheet visible={no} onClose={() => setNo(false)} title={t("el_sayNo")} testID="el-no-sheet" closeLabel={t("um_cancel")}>
        {no ? <NoForm onSend={async r => { if (await answer("no", r)) setNo(false); }} /> : null}
      </Sheet>
    </View>
  );
}

function NoForm({ onSend }: { onSend: (reason: string) => void }) {
  const s = useStore(); const { t } = s.tr;
  const [r, setR] = useState("");
  return (
    <Col gap={12}>
      <Field testID="el-no-reason" label={t("el_noReason")} placeholder={t("el_noReasonPh")} value={r} onChangeText={setR} maxLength={200} />
      <Muted small>{t("el_noHint")}</Muted>
      <Btn kind="primary" testID="el-no-send" label={t("el_sayNo")} onPress={() => onSend(r.trim())} />
    </Col>
  );
}

function AbsenceForm({ child, data, E, from, onDone }: { child: GuardianChild; data: ChildData; E: E_; from: string; onDone: () => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [typ, setTyp] = useState<AbsenceType>(data.sickOk ? "krank" : "sonst");
  const u16 = isUnder16(data.D.players[0], E.TODAY);
  const [von, setVon] = useState<string | null>(from);
  const [bis, setBis] = useState<string | null>(from);
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const a = { typ, von: von || "", bis: bis || null }, e = parentAbsenceErrors(a, E.TODAY, data.sickOk);
    if (e.length) { setErrs(e); return; }
    setBusy(true); try { if (await s.parentDo(child.pid, api => api.guardianAbsence(child.pid, a), "el_absSaved")) onDone(); } finally { setBusy(false); }
  };
  return (
    <Col gap={14}>
      <Col gap={6}>
        <T v="small" bold>{t("el_absType")}</T>
        <ChoiceChips testID="el-abs-type" value={typ} onChange={v => { setTyp(v); setErrs([]); }} options={PARENT_ABS_TYPES.map(k => ({ key: k, label: t("ab_" + k) }))} />
        {!data.sickOk ? <Muted small>{tf(u16 ? "el_absSickHint" : "el_absSickHint16", { n: child.vn })}</Muted> : null}
      </Col>
      <Row gap={12} wrap align="flex-start">
        <DateField testID="el-abs-from" label={t("el_absFrom")} value={von} onChange={v => { setVon(v); if (v && bis && bis < v) setBis(v); setErrs([]); }} lang={s.lang} style={{ flexGrow: 1, minWidth: 150 }} />
        <DateField testID="el-abs-to" label={t("el_absTo")} value={bis} onChange={v => { setBis(v); setErrs([]); }} lang={s.lang} style={{ flexGrow: 1, minWidth: 150 }} />
      </Row>
      <Muted small>{t("el_absPrivacy")}</Muted>
      {errs.length ? <Banner color={c.crit} testID="el-abs-err">{errs.map(e => e === "consent" && !u16 ? tf("el_absErr_consent16", { n: child.vn }) : t("el_absErr_" + e)).join(" ")}</Banner> : null}
      <Btn kind="primary" testID="el-abs-save" label={t("el_absSave")} disabled={busy} onPress={save} />
    </Col>
  );
}

function AbsenceList({ child, data, E }: { child: GuardianChild; data: ChildData; E: E_ }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const L = data.D.absences.filter(a => (a.bis || "9999-12-31") >= E.TODAY).sort((a, b) => a.von.localeCompare(b.von));
  if (!L.length) return null;
  return (
    <Card testID="el-abs-list">
      <CardTitle title={t("el_absList")} />
      {L.map((a, i) => {
        const mine = data.mineAbs.includes(a.id), away = data.awayAbs.includes(a.id), byParent = data.parentAbs.includes(a.id);
        const when = E.de(a.von) + (a.bis && a.bis !== a.von ? " – " + E.de(a.bis) : !a.bis ? " – " + t("el_absOpen") : "");
        return (
          <Row key={a.id} gap={10} testID={"el-abs-row-" + a.id} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.ink }}>{away ? t("el_absAway") : t("ab_" + a.typ)}</Text>
              <Muted small>{when + " · " + t(mine ? "el_absByYou" : byParent ? "el_absByParent" : a.by === "player" ? "el_absByKid" : "el_absByTeam")}</Muted>
            </Col>
            {mine && a.von >= E.TODAY ? <Btn small kind="ghost" testID={"el-abs-del-" + a.id} label={t("el_absUndo")} onPress={() => s.parentDo(child.pid, api => api.guardianAbsenceDelete(a.id), "el_absDeleted")} /> : null}
          </Row>
        );
      })}
    </Card>
  );
}

function PostsCard({ child, data }: { child: GuardianChild; data: ChildData }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  if (!data.posts.length) return null;
  const toggle = (id: string, read: boolean) => { setOpen(open === id ? null : id); if (!read) s.parentDo(child.pid, api => api.parentPostRead(id, false)); };
  const day = (at: string) => { const d = new Date(at); return isNaN(d.getTime()) ? "" : d.toLocaleDateString(s.lang === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); };
  return (
    <Card testID="el-posts">
      <CardTitle title={t("el_posts")} />
      {data.posts.map((p, i) => (
        <View key={p.id} testID={"el-post-" + p.id} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, gap: 5 }}>
          <Row gap={8}>
            {!p.readAt ? <View accessibilityLabel={t("el_unread")} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
            <Text onPress={() => toggle(p.id, !!p.readAt)} style={{ flex: 1, fontSize: 15, fontWeight: p.readAt ? "600" : "800", color: c.ink }}>{p.title}</Text>
            <Btn small kind="ghost" testID={"el-post-open-" + p.id} label={open === p.id ? t("el_postClose") : t("el_postOpen")} onPress={() => toggle(p.id, !!p.readAt)} />
          </Row>
          <Muted small>{[p.author, day(p.at)].filter(Boolean).join(" · ")}</Muted>
          {open === p.id ? <T v="small" selectable testID={"el-post-body-" + p.id}>{p.body}</T> : null}
          {p.needAck ? (p.ackedAt ? <Text testID={"el-acked-" + p.id} style={{ fontSize: 12.5, color: c.ok, fontWeight: "700" }}>{t("el_acked")}</Text>
            : <Btn small kind="primary" testID={"el-ack-" + p.id} label={t("el_ack")} onPress={() => s.parentDo(child.pid, api => api.parentPostRead(p.id, true), "el_ackedT")} style={{ alignSelf: "flex-start" }} />) : null}
        </View>
      ))}
      <Muted small>{tf("el_postsHint", { t: child.team })}</Muted>
    </Card>
  );
}

function ConsentsCard({ child, data, E }: { child: GuardianChild; data: ChildData; E: E_ }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [photo, setPhoto] = useState(false);
  const p = data.D.players[0], u16 = isUnder16(p, E.TODAY), age = photoAge(p, E.TODAY);
  const ph = data.D.photos[child.pid], miss = missingParty(ph, age);
  const consent = (kind: "parental" | "health_data", give: boolean) =>
    s.parentDo(child.pid, api => api.guardianConsent(child.pid, kind, give), give ? "el_cGiven" : "el_cWithdrawn");
  const row = (kind: "parental" | "health_data", on: boolean, title: string, text: string) => (
    <Col key={kind} gap={6} style={{ paddingVertical: 8 }}>
      <Row gap={8}><Text style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: c.ink }}>{title}</Text>
        <Text testID={"el-c-st-" + kind} style={{ fontSize: 13, fontWeight: "700", color: on ? c.ok : c.warn }}>{on ? t("el_cOn") : t("el_cOff")}</Text></Row>
      <Muted small>{text}</Muted>
      <Btn small kind={on ? "ghost" : "primary"} testID={"el-c-" + kind} label={on ? t("el_cWithdraw") : t("el_cGive")} onPress={() => consent(kind, !on)} style={{ alignSelf: "flex-start" }} />
    </Col>
  );
  return (
    <Card testID="el-consents">
      <CardTitle title={t("el_consents")} info={<Info title={t("el_consents")} text={t("el_cInfo")} />} />
      {u16 ? <>
        {row("parental", data.consents.parental, t("el_cParental"), tf("el_cParentalText", { n: child.vn }))}
        {row("health_data", data.consents.health, t("el_cHealth"), tf("el_cHealthText", { n: child.vn }))}
      </> : <Muted small testID="el-c16">{tf(data.sickOk ? "el_c16" : "el_c16Sick", { n: child.vn })}</Muted>}
      <Col gap={6} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }} testID="el-photo">
        <Row gap={8}><Text style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: c.ink }}>{t("ph_title")}</Text>
          <Btn small kind="ghost" testID="el-photo-edit" label={t("el_photoEdit")} onPress={() => setPhoto(true)} /></Row>
        {PHOTO_CHANNELS.map(ch => {
          const st = photoState(ph, ch, age);
          return (
            <Row key={ch} gap={8}>
              <Text style={{ flex: 1, fontSize: 13.5, color: c.ink }}>{t("ph_q_" + ch)}</Text>
              <Text testID={"el-ph-st-" + ch} style={{ fontSize: 12.5, fontWeight: "700", color: st === "yes" ? c.ok : st === "no" ? c.crit : st === "missing" ? c.warn : c.muted }}>
                {st !== "missing" ? t("ph_st_" + st) : miss === "player" ? tf("el_photoWaitKid", { n: child.vn }) : miss === "parents" ? t("el_photoWaitYou") : t("ph_miss_decl")}</Text>
            </Row>
          );
        })}
        <Muted small>{age != null && age >= 14 ? tf("el_photo14", { n: child.vn }) : t("el_photoKid")}</Muted>
      </Col>
      <Sheet visible={photo} onClose={() => setPhoto(false)} title={t("ph_title")} testID="el-photo-sheet" closeLabel={t("um_cancel")}>
        {photo ? <PhotoForm child={child} data={data} age={age} onDone={() => setPhoto(false)} /> : null}
      </Sheet>
    </Card>
  );
}

/** Foto-Erlaubnis der Eltern: je Kanal Ja/Nein, gespeichert als Erklärung der Eltern (heute) */
function PhotoForm({ child, data, age, onDone }: { child: GuardianChild; data: ChildData; age: number | null; onDone: () => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const base = cleanPhotoConsent(data.D.photos[child.pid]);
  const [v, setV] = useState<Record<PhotoChannel, boolean | null>>({ web: base.web, social: base.social, press: base.press, name: base.name });
  const [busy, setBusy] = useState(false);
  // speichern, wenn sich etwas ändert – oder wenn ein „Ja“ noch ohne Erklärung der Eltern ist (z. B. nur vom Kind erklärt)
  const dirty = PHOTO_CHANNELS.some(ch => v[ch] !== base[ch]) || (PHOTO_CHANNELS.some(ch => v[ch] === true) && base.by !== "parents" && base.by !== "both");
  const complete = PHOTO_CHANNELS.every(ch => v[ch] !== null);
  const save = async () => {
    setBusy(true);
    try { if (await s.parentDo(child.pid, api => api.guardianPhoto(child.pid, { ...base, ...v }), "ph_saved")) onDone(); } finally { setBusy(false); }
  };
  return (
    <Col gap={12}>
      <T v="small">{age != null && age >= 14 ? tf("el_photo14", { n: child.vn }) : tf("el_photoForm", { n: child.vn })}</T>
      <View testID="el-photo-form">
        {PHOTO_CHANNELS.map((ch, i) => (
          <Col key={ch} gap={6} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{t("ph_q_" + ch)}</Text>
            <ChoiceChips testID={"el-ph-" + ch} value={v[ch] === true ? "yes" : v[ch] === false ? "no" : null} onChange={x => setV({ ...v, [ch]: x === "yes" })}
              options={[{ key: "yes", label: t("ph_yesL") }, { key: "no", label: t("ph_noL") }]} />
          </Col>
        ))}
      </View>
      <Muted small>{t("el_photoJoint")}</Muted>
      <Muted small>{t("ph_meRevoke")}</Muted>
      <Btn kind="primary" testID="el-photo-save" label={t("el_photoSave")} disabled={busy || !dirty || !complete} onPress={save} />
    </Col>
  );
}

function ParentPrivacy({ child }: { child: GuardianChild }) {
  const s = useStore(); const { t, tf } = s.tr;
  const [sure, setSure] = useState(false);
  const pending = child.status === "pending";
  return (
    <Card testID="el-privacy">
      <CardTitle title={t("el_seeT")} />
      <T v="small">{tf("el_see", { n: child.vn })}</T>
      <Muted small>{tf("el_notSee", { n: child.vn })}</Muted>
      {sure ? (
        <Col gap={8}>
          <Muted small>{tf(pending ? "el_leavePending" : "el_leaveText", { n: child.vn })}</Muted>
          <Row gap={8} wrap>
            <Btn kind="danger" small testID="el-leave-ok" label={t(pending ? "el_leavePendingOk" : "el_leaveOk")} onPress={() => s.parentLeave(child.linkId)} />
            <Btn kind="ghost" small label={t("um_cancel")} onPress={() => setSure(false)} />
          </Row>
        </Col>
      ) : <Btn kind="ghost" small testID="el-leave" label={t(pending ? "el_leavePendingOk" : "el_leave")} onPress={() => setSure(true)} style={{ alignSelf: "flex-start" }} />}
    </Card>
  );
}

// =====================================================================
// Code einlösen (Eltern) – /parent-link, auch aus einem Link (…/parent-link?code=…)
// =====================================================================
export function ParentLinkPage() {
  const s = useStore(); const { t, tf } = s.tr; const router = useRouter(); const { c } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const fromLink = typeof params.code === "string" ? cleanInviteCode(params.code) : s.pendingInvite?.kind === "parent" ? s.pendingInvite.code : "";
  const [code, setCode] = useState(fromLink);
  const [name, setName] = useState(s.user?.displayName || "");
  const [rel, setRel] = useState<GuardianRelation | null>(null); const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  // Link ohne Anmeldung: Code merken – nach Anmeldung bzw. Registrierung geht es auf der Startseite weiter
  useEffect(() => {
    if (s.phase !== "signedOut") return;
    if (inviteCodeOk(fromLink)) s.rememberInvite({ kind: "parent", code: cleanInviteCode(fromLink) });
    router.replace("/welcome");
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    if (!inviteCodeOk(code)) { setErr(t("el_errCode")); return; }
    if (name.trim().length < 2) { setErr(t("el_errName")); return; }
    if (!rel) { setErr(t("el_errRel")); return; }
    if (!ok) { setErr(t("el_errOk")); return; }
    setBusy(true); setErr("");
    try {
      if (await s.parentRedeem(code, name, rel)) {
        if (s.pendingInvite?.kind === "parent") s.rememberInvite(null);
        router.replace("/parent");
      }
    } finally { setBusy(false); }
  };
  if (s.phase === "loading" || s.phase === "signedOut") return null;
  return (
    <Screen testID="parent-link" narrow>
      <Header eyebrow={t("el_eyebrow")} title={t("el_linkTitle")} onBack={() => router.canGoBack() ? router.back() : router.replace("/")} backLabel={t("btn_back")} />
      <Col gap={14}>
        <Muted>{t("el_linkIntro")}</Muted>
        <Field testID="el-code" label={t("el_code")} placeholder="ABCDE-FGHJK" value={code} autoCapitalize="characters" autoComplete="off"
          onChangeText={v => { setCode(v); setErr(""); }} onBlur={() => setCode(cleanInviteCode(code))} />
        <Field testID="el-name" label={t("el_yourName")} placeholder={t("el_yourNamePh")} value={name} onChangeText={v => { setName(v); setErr(""); }} maxLength={GUARDIAN_NAME_MAX} hint={t("el_yourNameHint")} />
        <Col gap={6}><T v="small" bold>{t("el_relation")}</T>
          <ChoiceChips testID="el-rel" value={rel} onChange={v => { setRel(v); setErr(""); }} options={GUARDIAN_RELATIONS.map(k => ({ key: k, label: t("el_rel_" + k) }))} /></Col>
        <Card>
          <T v="small" bold>{t("el_linkWhatT")}</T>
          <Muted small>{t("el_linkWhat")}</Muted>
        </Card>
        <Check testID="el-ok" label={t("el_linkOk")} value={ok} onChange={v => { setOk(v); setErr(""); }} />
        <Btn small kind="ghost" testID="el-link-privacy" label={t("el_linkPrivacyLink")} onPress={() => router.push("/legal?doc=privacy")} style={{ alignSelf: "flex-start" }} />
        {err ? <Banner color={c.crit} testID="el-link-err">{err}</Banner> : null}
        <Btn kind="primary" testID="el-link-send" label={t("el_linkSend")} disabled={busy} onPress={send} />
        <Muted small>{tf("el_linkAfter", { d: 30 })}</Muted>
      </Col>
    </Screen>
  );
}

// =====================================================================
// Spieler: Ich → Eltern (wer verknüpft ist; volljährig: verlängern oder entfernen)
// =====================================================================
export function MyGuardiansItem() {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const D = s.D, pid = s.mePid;
  if (!D || !pid || D.team.modules.eltern === false) return null;
  const L = D.guardians.filter(g => g.pid === pid);
  if (!L.length) return null;
  const me = D.players.find(p => p.id === pid), today = s.engine?.TODAY || new Date().toISOString().slice(0, 10);
  const adult = !!me?.geb && !isMinor(me, today);
  return (
    <>
      <ListItem testID="me-eltern" title={t("el_myTitle")} sub={L.map(g => g.name).join(", ")} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t("el_myTitle")} testID="el-my-sheet" closeLabel={t("close")}>
        <Col gap={12}>
          <T v="small">{adult ? t("el_myAdult") : t("el_myMinor")}</T>
          {L.map(g => (
            <Col key={g.id} gap={6} testID={"el-my-" + g.id} style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line }}>
              <Row gap={8}><T bold style={{ flex: 1 }}>{g.name}</T><Muted small>{`${t("el_rel_" + g.relation)} · ${t(g.status === "active" ? "el_active" : "el_waiting")}`}</Muted></Row>
              {adult ? (
                <Col gap={6}>
                  <Check testID={"el-my-keep-" + g.id} label={tf("el_adultKeep", { n: g.name })} value={g.adultOk} onChange={v => s.guardianAdultOk(g.id, v)} />
                  <Btn small kind="ghost" testID={"el-my-del-" + g.id} label={t("el_remove")} onPress={() => s.guardianRemove(g.id)} style={{ alignSelf: "flex-start" }} />
                </Col>
              ) : null}
            </Col>
          ))}
        </Col>
      </Sheet>
    </>
  );
}
