// Individualtraining anfragen (Spieler) und beantworten (Trainerteam). Eine Zusage legt eine Einheit nur für den
// Spieler an – mit RPE und Belastung wie jede andere Einheit.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { addDays } from "../core/dates";
import { INDIV_TOPICS, MAX_OPEN_REQUESTS, openRequests } from "../core/dev";
import type { IndivRequest, IndivTopic, Player } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, Chip, ChoiceChips, Col, DateField, Field, Info, ListItem, Muted, NumField, Picker, Row, Sheet, T, TimeField, ToggleRow } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { useTheme, type Colors } from "./theme";

export const iqColor = (c: Colors, st: IndivRequest["status"]): string => ({ open: c.warn, accepted: c.ok, declined: c.crit, cancelled: c.build }[st]);

/** Spieler: anfragen und eigene Anfragen sehen */
export function IndivRequestCard({ pid }: { pid: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [topic, setTopic] = useState<IndivTopic>("technik"); const [note, setNote] = useState(""); const [wish, setWish] = useState(""); const [busy, setBusy] = useState(false);
  const mine = E.D.indiv.filter(r => r.pid === pid).sort((a, b) => a.created < b.created ? 1 : -1);
  const open = mine.filter(r => r.status === "open").length, off = E.team.settings.indivReq === false;
  const send = async () => {
    setBusy(true);
    try { await s.requestIndiv({ id: tmpId(), pid, topic, note: note.trim(), wish: wish.trim(), status: "open", answer: "", date: null, slot: null, staffId: null, created: new Date().toISOString() }); setNote(""); setWish(""); }
    finally { setBusy(false); }
  };
  return (
    <Card testID="iq-card">
      <CardTitle title={t("iq_req")} info={<Info title={t("iq_title")} text={t("iq_reqInfo")} />} />
      {off ? <Muted>{t("iq_off")}</Muted> : open >= MAX_OPEN_REQUESTS ? <Banner>{tf("iq_maxOpen", { n: open })}</Banner> : <>
        <Muted small>{t("iq_reqInfo")}</Muted>
        <Col gap={6}><T v="small" bold>{t("iq_topic")}</T>
          <ChoiceChips testID="iq-topic" value={topic} onChange={setTopic} options={INDIV_TOPICS.filter(k => k !== "tw" || E.D.players.find(p => p.id === pid)?.pos === "TW" || (E.D.players.find(p => p.id === pid)?.groups || []).some(g => E.D.groups.find(x => x.id === g)?.kind === "tw")).map(k => ({ key: k, label: t("iq_t_" + k) }))} />
        </Col>
        <Field testID="iq-note" label={t("iq_note")} value={note} onChangeText={setNote} placeholder={t("iq_notePh")} multiline maxLength={1000} />
        <Field testID="iq-wish" label={t("iq_wish")} value={wish} onChangeText={setWish} placeholder={t("iq_wishPh")} maxLength={300} />
        <Btn testID="iq-send" kind="primary" label={t("iq_send")} disabled={busy || !note.trim()} onPress={send} style={{ alignSelf: "flex-start" }} />
      </>}
      {mine.length ? <Col gap={8}>
        <T v="eyebrow">{t("iq_mine")}</T>
        {mine.slice(0, 6).map(r => (
          <Col key={r.id} gap={4} testID={"iq-mine-" + r.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
            <Row between wrap gap={8}><T bold>{t("iq_t_" + r.topic)}</T><Chip label={t("iq_st_" + r.status)} color={iqColor(c, r.status)} /></Row>
            {r.note ? <Muted small>{r.note}</Muted> : null}
            {r.status === "accepted" && r.date ? <T v="small" bold color={c.ok}>{t("iq_when")}: {E.wt(r.date)} {E.de(r.date)}{(() => { const u = (E.D.units[r.date] || []).find(x => x.slot === r.slot); return u ? ` · ${u.zeit} · ${u.dauer} ${t("min")}` : ""; })()}</T> : null}
            {r.answer ? <Banner>{r.answer}</Banner> : null}
            {r.status === "open" ? <Btn small testID={"iq-cancel-" + r.id} label={t("iq_cancel")} onPress={() => s.cancelIndiv(r)} style={{ alignSelf: "flex-start" }} /> : null}
          </Col>
        ))}
      </Col> : null}
    </Card>
  );
}

/** Trainerteam: offene Anfragen (Startseite und eigene Seite) */
export function IndivInbox({ compact }: { compact?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const [ans, setAns] = useState<{ r: IndivRequest; accept: boolean } | null>(null);
  const open = openRequests(E.D), done = E.D.indiv.filter(r => r.status !== "open").sort((a, b) => a.created < b.created ? 1 : -1).slice(0, 20);
  const canPlan = s.can("plan");
  const row = (r: IndivRequest) => {
    const p = E.P(r.pid); if (!p) return null;
    return (
      <ListItem key={r.id} testID={"iq-" + r.id} left={<PlayerAvatar p={p} size={40} />} title={`${E.name(p)} · ${t("iq_t_" + r.topic)}`}
        sub={`${E.de(r.created.slice(0, 10))}${r.wish ? " · " + r.wish : ""}`} onPress={compact ? () => router.push("/coach/individual") : undefined}>
        {r.note ? <Muted small>{r.note}</Muted> : null}
        {r.status === "open" ? (!compact && canPlan ? <Row gap={8} wrap>
          <Btn small kind="primary" testID={"iq-accept-" + r.id} label={t("iq_accept")} onPress={() => setAns({ r, accept: true })} />
          <Btn small testID={"iq-decline-" + r.id} label={t("iq_decline")} onPress={() => setAns({ r, accept: false })} />
        </Row> : null) : <Row gap={8} wrap><Chip label={t("iq_st_" + r.status)} color={iqColor(c, r.status)} />{r.date ? <Muted small>{E.wt(r.date)} {E.de(r.date)}</Muted> : null}</Row>}
      </ListItem>
    );
  };
  if (compact) return open.length ? <Card testID="iq-inbox">
    <CardTitle title={t("iq_open")} right={<Btn small kind="ghost" label={t("iq_answer") + " ›"} onPress={() => router.push("/coach/individual")} />} />
    {open.slice(0, 4).map(row)}
  </Card> : null;
  return (
    <Col gap={18}>
      <Card testID="iq-settings">
        <ToggleRow testID="iq-on" label={t("iq_setting")} desc={t("iq_info")} value={E.team.settings.indivReq !== false} disabled={!canPlan}
          onChange={v => s.updateTeam({ settings: { ...E.team.settings, indivReq: v } })} />
      </Card>
      <Card testID="iq-open">
        <CardTitle title={t("iq_open")} />
        {open.length ? open.map(row) : <Muted>{t("iq_none")}</Muted>}
      </Card>
      {done.length ? <Card testID="iq-done"><CardTitle title={t("tk_done")} />{done.map(row)}</Card> : null}
      <AnswerSheet target={ans} onClose={() => setAns(null)} />
    </Col>
  );
}

function AnswerSheet({ target, onClose }: { target: { r: IndivRequest; accept: boolean } | null; onClose: () => void }) {
  return target ? <AnswerForm key={target.r.id + target.accept} target={target} onClose={onClose} /> : null;
}
function AnswerForm({ target, onClose }: { target: { r: IndivRequest; accept: boolean }; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const { r, accept } = target, p = E.P(r.pid) as Player;
  const me = s.myStaff?.id || E.D.staff[0]?.id || "";
  const [date, setDate] = useState<string | null>(addDays(E.TODAY, 1)); const [zeit, setZeit] = useState("17:00"); const [dauer, setDauer] = useState<number | null>(45);
  const [staff, setStaff] = useState<string>(me); const [answer, setAnswer] = useState(""); const [title, setTitle] = useState(tf("iq_unitTitle", { t: t("iq_t_" + r.topic) }));
  const [busy, setBusy] = useState(false);
  const ok = !accept || (!!date && date >= E.TODAY && !!dauer);
  const go = async () => {
    setBusy(true);
    try { if (await s.answerIndiv(r, accept, answer, accept && date ? { date, zeit, dauer: dauer || 45, staffId: staff || null, title: title.trim() || t("iq_title") } : undefined)) onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title={`${accept ? t("iq_accept") : t("iq_decline")}: ${E.name(p)}`} testID="iq-sheet" closeLabel={t("cancel")}>
      <Muted small>{t("iq_t_" + r.topic)}{r.note ? " · " + r.note : ""}{r.wish ? " · " + r.wish : ""}</Muted>
      {accept ? <>
        <Row wrap gap={10}>
          <DateField testID="iq-date" label={t("iq_when")} value={date} onChange={setDate} lang={E.tr.lang} style={{ flex: 1, minWidth: 130 }} />
          <TimeField testID="iq-time" label={t("un_time")} value={zeit} onChange={setZeit} style={{ width: 110 }} />
          <NumField testID="iq-dur" label={t("min")} value={dauer} onChange={setDauer} min={10} max={180} step={5} style={{ width: 100 }} />
        </Row>
        <Field testID="iq-title" label={t("cg_titleF")} value={title} onChangeText={setTitle} maxLength={60} />
        {E.D.staff.length ? <Picker testID="iq-staff" label={t("un_staff")} value={staff} onChange={setStaff} options={[{ key: "", label: "–" }, ...E.D.staff.map(x => ({ key: x.id, label: x.name }))]} /> : null}
        <Banner>{t("iq_acceptD")}</Banner>
      </> : null}
      <Field testID="iq-answer" label={t("iq_answerT")} value={answer} onChangeText={setAnswer} placeholder={t("iq_answerPh")} multiline maxLength={1000} />
      <Btn testID="iq-go" kind={accept ? "primary" : "danger"} label={accept ? t("iq_accept") : t("iq_decline")} disabled={busy || !ok} onPress={go} />
    </Sheet>
  );
}
