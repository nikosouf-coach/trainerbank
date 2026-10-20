// Spieler – Heute: aufs Wesentliche reduziert (Standard nach Wichtigkeit): Einträge (Morgen-Check, RPE), Körper heute,
// Trainer-Nachrichten, Reha, Matchplan, nächster Termin (→ Kalender), Aufgaben, neue Bewertung, Programm und eine
// Kurzübersicht (Challenge, Ziele, Woche, Kasse). Die ausführlichen Karten lassen sich unter „Startseite anpassen“
// dazuschalten.
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { gameOf } from "../../../src/core/game";
import { useEngine, useStore } from "../../../src/data/store";
import { Ring } from "../../../src/ui/charts";
import { CustomizeLinks, DashEditor, PlayerTabsEditor, useDash } from "../../../src/ui/dashboard";
import { Col, Msg, Row, Screen, T } from "../../../src/ui/kit";
import { Icon } from "../../../src/ui/icons";
import { PlayerQuick } from "../../../src/ui/player/quick";
import { Badges, Goals, NewRating, NextDates, PlayerHero, TodoTile, WeekRings } from "../../../src/ui/player/parts";
import { PlayerProgramCard } from "../../../src/ui/prep";
import { msgColor } from "../../../src/ui/squad/ProfileCards";
import { PlayerRehaCard } from "../../../src/ui/reha";
import { PlayerTasksCard } from "../../../src/ui/tasks/widgets";
import { MyKasseCard } from "../../../src/ui/kasse";
import { ChallengeCard } from "../../../src/ui/challenge";
import { MyGoalsCard } from "../../../src/ui/dev";
import { PlayerPlansCard } from "../../../src/ui/matchplan/cards";
import { radius, useTheme } from "../../../src/ui/theme";

export default function PlayerHeute() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const dash = useDash("player"); const [edit, setEdit] = useState(false);
  const p = E.P(s.mePid || "")!;
  const g = useMemo(() => gameOf(E, p.id), [s.version, E, p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = E.playerState(p), msgs = E.activeMsgs(p.id);
  const open = E.mods.belastung ? E.playerOpenTarget(p) : undefined;
  const wellDone = !!E.D.well[p.id]?.[E.TODAY];
  const seesLoad = E.playerSees("load"), stCol = st.k === "ready" ? c.ok : st.k === "easy" ? c.warn : c.crit;
  const sessLabel = (x: { date: string; typ: string; slot: number; title: string }) => `${E.wt(x.date)} ${E.de(x.date)} · ${x.slot ? x.title : x.typ === "Spiel" ? t("it_match") : t("it_training")}`;

  const cards: Record<string, React.ReactNode> = {
    todo: E.mods.belastung ? <Row wrap gap={10}>
      <TodoTile testID="todo-well" icon="moon" title={t("pl_todoWell")} sub={wellDone ? t("pw_doneToday") : g.streak ? tf("gm_streak", { n: g.streak }) : t("gm_streak0")} done={wellDone} onPress={() => router.push("/player/eintragen?tab=well")} />
      <TodoTile testID="todo-rpe" icon="bolt" title={t("pl_todoRpe")} sub={open ? sessLabel(open) : t("pl_allDone")} done={!open} onPress={() => router.push("/player/eintragen?tab=rpe" + (open ? `&date=${open.date}&slot=${open.slot}` : ""))} />
    </Row> : null,
    // Körper heute: Zustand und Empfehlung in einer Zeile – die Seite dahinter erklärt Gründe, Tipps und Hintergrund
    body: seesLoad && (E.mods.belastung || E.mods.regeneration) ? (
      <Pressable testID="player-body" accessibilityRole="button" accessibilityLabel={`${t("ph_body")}: ${t("ph_" + st.k)}`} onPress={() => router.push("/player/koerper")}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.l, backgroundColor: pressed ? c.sunk : c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line })}>
        <Ring pct={st.k === "ready" ? 100 : st.k === "easy" ? 60 : 20} color={stCol} size={52} />
        <Col gap={2} style={{ flex: 1 }}>
          <T v="eyebrow">{t("ph_body")}</T>
          <Text style={{ fontSize: 19, lineHeight: 24, fontWeight: "800", color: stCol, letterSpacing: -0.3 }}>{t("ph_" + st.k)}</Text>
          <T v="small" numberOfLines={2} color={c.muted}>{t("ph_" + st.k + "_t")}</T>
        </Col>
        <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} />
      </Pressable>
    ) : null,
    msgs: msgs.length ? <Col gap={10}>{msgs.map(m => <Msg key={m.id} testID={"msg-" + m.id} eyebrow={`${E.coachName() ? E.tf("ph_coachN", { n: E.coachName() }) : t("ph_coach")} · ${t("ry_" + m.typ)}${m.bis ? " · " + t("until") + " " + E.de(m.bis) : ""}`} text={m.text} color={msgColor(c, m.typ)} />)}</Col> : null,
    reha: <PlayerRehaCard pid={p.id} />,
    plan: <PlayerPlansCard />,
    dates: <NextDates pid={p.id} max={1} onMore={() => router.push("/player/kalender")} />,
    tasks: <PlayerTasksCard pid={p.id} />,
    rating: <NewRating pid={p.id} />,
    program: <PlayerProgramCard pid={p.id} />,
    quick: <PlayerQuick p={p} g={g} />,
    challenge: <ChallengeCard pid={p.id} compact />,
    devgoals: E.playerSees("dev") ? <MyGoalsCard p={p} compact onOpen={() => router.push("/player/entwicklung")} /> : null,
    pot: E.playerSees("goals") ? <Goals pid={p.id} /> : null,
    rings: <WeekRings g={g} />,
    kasse: <MyKasseCard pid={p.id} compact onManage={() => router.push("/player/kasse")} />,
    badges: <Badges g={g} compact />,
  };
  const available = (k: string): boolean => ({ todo: !!E.mods.belastung, body: seesLoad && (!!E.mods.belastung || !!E.mods.regeneration), challenge: !!E.mods.challenge,
    devgoals: E.playerSees("dev"), pot: E.playerSees("goals") } as Record<string, boolean>)[k] ?? true;

  return (
    <Screen testID="player-heute">
      <PlayerHero p={p} g={g} />
      {dash.order.map(k => cards[k] ? <React.Fragment key={k}>{cards[k]}</React.Fragment> : null)}
      <CustomizeLinks testID="p-dash-edit" onDash={() => setEdit(true)} />
      <DashEditor visible={edit} onClose={() => setEdit(false)} available={available} who="player" extra={<PlayerTabsEditor />} />
    </Screen>
  );
}
