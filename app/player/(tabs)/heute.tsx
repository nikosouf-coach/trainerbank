// Spieler – Heute: Level & Serie, Körperstatus, Aufgaben mit XP, Trainer-Nachrichten, Wochenringe, Termine, Ziele, Abzeichen.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { View } from "react-native";
import { gameOf, XP } from "../../../src/core/game";
import { useEngine, useStore } from "../../../src/data/store";
import { Ring } from "../../../src/ui/charts";
import { Card, Col, Msg, Row, Screen, T } from "../../../src/ui/kit";
import { Badges, Goals, LevelHero, NewRating, NextDates, TodoTile, WeekRings } from "../../../src/ui/player/parts";
import { msgColor } from "../../../src/ui/squad/ProfileCards";
import { useTheme } from "../../../src/ui/theme";

export default function PlayerHeute() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(s.mePid || "")!;
  const g = useMemo(() => gameOf(E, p.id), [s.version, E, p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = E.playerState(p), msgs = E.activeMsgs(p.id);
  const open = E.mods.belastung ? E.playerOpenSession(p) : undefined;
  const wellDone = !!E.D.well[p.id]?.[E.TODAY];
  const seesLoad = E.playerSees("load"), stCol = st.k === "ready" ? c.ok : st.k === "easy" ? c.warn : c.crit;
  const sessLabel = (x: { date: string; typ: string }) => `${E.wt(x.date)} ${E.de(x.date)} · ${x.typ === "Spiel" ? t("it_match") : t("it_training")}`;

  return (
    <Screen testID="player-heute">
      <LevelHero p={p} g={g} />
      {E.mods.belastung ? <Row wrap gap={10}>
        <TodoTile testID="todo-well" icon="moon" title={t("pl_todoWell")} sub={wellDone ? t("pw_doneToday") : g.streak ? tf("gm_streak", { n: g.streak }) : t("gm_streak0")} xp={XP.well} done={wellDone} color="#16a3a3" onPress={() => router.push("/player/eintragen?tab=well")} />
        <TodoTile testID="todo-rpe" icon="bolt" title={t("pl_todoRpe")} sub={open ? sessLabel(open) : t("pl_allDone")} xp={XP.rpe} done={!open} color="#f0762b" onPress={() => router.push("/player/eintragen?tab=rpe")} />
      </Row> : null}
      <NewRating pid={p.id} />
      {msgs.map(m => <Msg key={m.id} testID={"msg-" + m.id} eyebrow={`${t("ph_coach")} · ${t("ry_" + m.typ)}${m.bis ? " · " + t("until") + " " + E.de(m.bis) : ""}`} text={m.text} color={msgColor(c, m.typ)} />)}
      {seesLoad && (E.mods.belastung || E.mods.regeneration) ? <Card testID="player-body" tone={stCol}>
        <Row gap={14}>
          <View><Ring pct={st.k === "ready" ? 100 : st.k === "easy" ? 60 : 20} color={stCol} size={64} /></View>
          <Col gap={3} style={{ flex: 1 }}>
            <T v="eyebrow">{t("ph_body")}</T>
            <T v="h2" style={{ color: stCol }}>{t("ph_" + st.k)}</T>
            <T v="small">{t("ph_" + st.k + "_t")}</T>
            {st.why ? <T v="small" color={c.muted}>{st.why}</T> : null}
          </Col>
        </Row>
      </Card> : null}
      <WeekRings g={g} />
      <NextDates pid={p.id} />
      {E.playerSees("goals") ? <Goals pid={p.id} /> : null}
      <Badges g={g} compact />
    </Screen>
  );
}
