// Trainer – eine Umfrage: Beteiligung, Ergebnis (anonym erst ab drei Antworten), wer noch fehlt (nur mit Namen) und
// erinnern, im Chat ankündigen, bearbeiten bzw. Ende ändern, beenden oder wieder öffnen, löschen.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { pollEditable, pollOpen, pollTargets, reopened } from "../../../src/core/polls";
import type { Poll } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { Banner, Bar, Btn, Card, CardTitle, Col, Header, Info, Muted, Row, Screen, T } from "../../../src/ui/kit";
import { PollEditor, PollFacts, PollResultView, announceChat, usePollResult } from "../../../src/ui/polls";
import { useTheme } from "../../../src/ui/theme";

export default function UmfrageDetail() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const [edit, setEdit] = useState<Poll | null>(null);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = E.D.polls.find(x => x.id === id) || null;
  const can = s.can("messages");
  const r = usePollResult(p, !!p && can);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/umfragen");
  if (!p || !can) return (
    <Screen testID="coach-poll">
      <Header title={t("um_title")} onBack={back} backLabel={t("btn_back")} />
      <Muted>{!can ? tf("pm_denied", { p: t("pm_messages") }) : t("err_not_found")}</Muted>
    </Screen>
  );
  const open = pollOpen(p, E.TODAY), targets = pollTargets(E.D, p).length, n = r?.n ?? p.answers, total = r?.targets ?? targets;
  const missing = r?.missing || [];
  const chat = open ? announceChat(s.chats, p) : null;
  const remind = async (pids: string[], all: boolean) => {
    setBusy(true);
    try { await s.remindPoll(p, pids, tf(all ? "um_remindMsgAll" : "um_remindMsg", { t: p.title })); } finally { setBusy(false); }
  };
  const remove = async () => { await s.deletePoll(p.id); back(); };
  return (
    <Screen testID="coach-poll">
      <Header eyebrow={`${t("um_kind_" + p.kind)} · ${t(open ? "um_state_open" : "um_state_closed")}`} title={p.title} onBack={back} backLabel={t("btn_back")}
        info={<Info title={t("um_title")} text={t("um_info")} />} />
      <PollFacts p={p} staff />
      {p.intro ? <T>{p.intro}</T> : null}
      <Card testID="poll-participation">
        <CardTitle title={t("um_participation")} />
        <T v="h3">{tf(n === 1 ? "um_answered1" : "um_answeredN", { n, m: total })}</T>
        <Bar value={total ? Math.min(1, n / total) : 0} color={open ? c.accent : c.build} />
        {!p.anonymous && r ? (
          missing.length ? (
            <Col gap={6}>
              <T v="small" bold color={c.muted}>{t("um_missing")}</T>
              <Muted small>{missing.map(x => x.name).join(", ")}</Muted>
              {open ? <Btn small testID="poll-remind" icon="send" label={tf("um_remind", { n: missing.length })} disabled={busy} onPress={() => remind(missing.map(x => x.pid), false)} style={{ alignSelf: "flex-start" }} /> : null}
            </Col>
          ) : <Muted small>{t("um_allDone")}</Muted>
        ) : null}
        {p.anonymous && open && n < total ? (
          <Col gap={6}>
            <Muted small>{t("um_remindAnonD")}</Muted>
            <Btn small testID="poll-remind-all" icon="send" label={t("um_remindAll")} disabled={busy} onPress={() => remind(pollTargets(E.D, p).map(x => x.id), true)} style={{ alignSelf: "flex-start" }} />
          </Col>
        ) : null}
      </Card>
      <Card testID="poll-results">
        <CardTitle title={t("um_results")} />
        <PollResultView p={p} r={r} staff />
      </Card>
      <Card testID="poll-manage">
        <Row wrap gap={8}>
          {!p.byPlayer || !pollEditable(p) ? <Btn small testID="poll-edit" icon="pen" label={pollEditable(p) ? t("edit") : t("um_changeEnd")} onPress={() => setEdit(p)} /> : null}
          {open ? <Btn small testID="poll-close" label={t("um_close")} onPress={() => s.setPollState(p, { closed: true, until: p.until }, t("um_closedT"))} />
            : <Btn small testID="poll-reopen" label={t("um_reopen")} onPress={() => { const x = reopened(p, E.TODAY); s.setPollState(p, { closed: x.closed, until: x.until }, t("um_reopenedT")); }} />}
          {chat ? <Btn small kind="ghost" testID="poll-share" icon="chat" label={t("um_share")} onPress={async () => { await s.chatSend(chat.id, tf("um_shareMsg", { t: p.title })); s.toast(t("um_shared")); }} /> : null}
        </Row>
        {!del ? <Btn small kind="ghost" testID="poll-delete" icon="trash" label={t("um_delete")} onPress={() => setDel(true)} style={{ alignSelf: "flex-start" }} /> : (
          <Banner color={c.crit} testID="poll-delete-ask">
            <Col gap={8}>
              <T v="small" bold>{t("um_deleteQ")}</T>
              <Row gap={8} wrap>
                <Btn small kind="danger" testID="poll-delete-yes" label={t("um_deleteYes")} onPress={remove} />
                <Btn small kind="ghost" testID="poll-delete-no" label={t("um_cancel")} onPress={() => setDel(false)} />
              </Row>
            </Col>
          </Banner>
        )}
      </Card>
      <PollEditor initial={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}
