// Spieler – Umfragen: offen für dich, beantwortet (Ergebnis, wenn es für alle freigegeben ist), beendet. Eigene
// Abstimmung starten, wenn das Trainerteam es erlaubt (immer mit Namen, ganzes Team, höchstens zwei laufende).
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { PLAYER_OPEN_MAX, answerOf, newPoll, openPollsBy, playersMayPoll, pollOpen } from "../../src/core/polls";
import type { Poll } from "../../src/core/types";
import { tmpId, useEngine, useStore } from "../../src/data/store";
import { Btn, Card, Header, Muted, NavRow, Screen, Section } from "../../src/ui/kit";
import { PollEditor, PollSheet, pollAuthor, pollMeta } from "../../src/ui/polls";
import { useTheme } from "../../src/ui/theme";

export default function PlayerUmfragen() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const pid = s.mePid || "";
  const [sheet, setSheet] = useState<Poll | null>(null);
  const [edit, setEdit] = useState<Poll | null>(null);
  const L = s.myPolls;
  const running = L.filter(p => pollOpen(p, E.TODAY));
  const toAnswer = running.filter(p => !answerOf(E.D, p.id, pid)), answered = running.filter(p => !!answerOf(E.D, p.id, pid));
  const ended = L.filter(p => !pollOpen(p, E.TODAY));
  const may = playersMayPoll(E.team.settings), own = openPollsBy({ polls: L }, pid, E.TODAY);
  const row = (p: Poll) => {
    const done = !!answerOf(E.D, p.id, pid), by = pollAuthor(E, p, pid);
    return (
      <NavRow key={p.id} testID={"pp-" + p.id} icon="poll" iconColor={pollOpen(p, E.TODAY) ? c.accentTx : c.muted} title={p.title} subLines={2}
        sub={pollMeta(E, p) + (by ? " · " + by : "")} value={done ? "✓" : null} valueColor={c.ok} onPress={() => setSheet(p)} />
    );
  };
  return (
    <Screen testID="player-polls-page">
      <Header onBack={() => router.canGoBack() ? router.back() : router.replace("/player/heute")} backLabel={t("btn_back")} title={t("um_title")} />
      {may ? (
        <Card testID="player-polls-own">
          <Btn kind="primary" icon="plus" testID="player-poll-new" label={t("um_startOwn")} disabled={own >= PLAYER_OPEN_MAX} onPress={() => setEdit(newPoll("quick", tmpId()))} style={{ alignSelf: "flex-start" }} />
          <Muted small>{own >= PLAYER_OPEN_MAX ? tf("um_ownMax", { n: PLAYER_OPEN_MAX }) : t("um_ownInfo")}</Muted>
        </Card>
      ) : null}
      {toAnswer.length ? <Section title={t("um_toAnswer")} testID="pp-open">{toAnswer.map(row)}</Section> : null}
      {answered.length ? <Section title={t("um_answeredList")} testID="pp-answered">{answered.map(row)}</Section> : null}
      {ended.length ? <Section title={t("um_ended")} testID="pp-ended">{ended.map(row)}</Section> : null}
      {!L.length ? <Muted>{t("um_playerNone")}</Muted> : null}
      <PollSheet poll={sheet} onClose={() => setSheet(null)} />
      <PollEditor initial={edit} onClose={() => setEdit(null)} asPlayer />
    </Screen>
  );
}
