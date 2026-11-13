// Trainer – Umfragen: neue Abstimmung oder neuer Fragebogen (auch aus Vorlagen), laufende und beendete Umfragen mit
// Beteiligung, Schalter „Spieler dürfen Abstimmungen starten“. Nur mit Recht „Nachrichten“.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { fromTemplate, newPoll, playersMayPoll, pollOpen, sortPolls } from "../../../src/core/polls";
import type { Poll } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { Btn, Card, Col, Group, Header, Info, MoreRow, Muted, Row, Screen, Section, T, ToggleRow } from "../../../src/ui/kit";
import { useNavBack } from "../../../src/ui/nav";
import { PollEditor, PollRow, PollTemplatesSheet } from "../../../src/ui/polls";

export default function Umfragen() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter(); const nb = useNavBack("umfragen");
  const [edit, setEdit] = useState<Poll | null>(null);
  const [tpl, setTpl] = useState(false);
  const [allEnded, setAllEnded] = useState(false);
  const header = <Header title={t("um_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("um_title")} text={t("um_info")} />} />;
  if (!s.can("messages")) return <Screen testID="coach-polls">{header}<Muted>{tf("pm_denied", { p: t("pm_messages") })}</Muted></Screen>;
  const L = sortPolls(E.D.polls, E.TODAY), running = L.filter(p => pollOpen(p, E.TODAY)), ended = L.filter(p => !pollOpen(p, E.TODAY));
  const open = (p: Poll) => router.push(`/coach/umfrage/${p.id}`);
  return (
    <Screen testID="coach-polls">
      {header}
      <Row wrap gap={8}>
        <Btn kind="primary" icon="plus" testID="poll-new-quick" label={t("um_newQuick")} onPress={() => setEdit(newPoll("quick", tmpId()))} />
        <Btn icon="plus" testID="poll-new-survey" label={t("um_newSurvey")} onPress={() => setEdit(newPoll("survey", tmpId()))} />
        <Btn kind="ghost" icon="copy" testID="poll-templates" label={t("um_templates")} onPress={() => setTpl(true)} />
      </Row>
      {running.length ? (
        <Section title={t("um_running")} testID="polls-running">
          {running.map(p => <PollRow key={p.id} p={p} onPress={() => open(p)} />)}
        </Section>
      ) : (
        <Card testID="polls-empty">
          <T v="h3">{t("um_none")}</T>
          <Muted>{t("um_noneD")}</Muted>
        </Card>
      )}
      {ended.length ? (
        <Section title={t("um_ended")} testID="polls-ended">
          {(allEnded ? ended : ended.slice(0, 5)).map(p => <PollRow key={p.id} p={p} onPress={() => open(p)} />)}
          {!allEnded && ended.length > 5 ? <MoreRow testID="polls-ended-more" label={t("um_seeAll")} onPress={() => setAllEnded(true)} /> : null}
        </Section>
      ) : null}
      <Group pad testID="polls-players">
        <ToggleRow testID="polls-players-toggle" label={t("um_playersMay")} desc={t("um_playersMayD")} value={playersMayPoll(E.team.settings)} onChange={v => s.setPlayerPolls(v)} />
      </Group>
      <Col gap={0}>
        <PollTemplatesSheet visible={tpl} onClose={() => setTpl(false)} onPick={x => { setTpl(false); setEdit(fromTemplate(x, tmpId())); }} />
        <PollEditor initial={edit} onClose={() => setEdit(null)} />
      </Col>
    </Screen>
  );
}
