// Spieler – Mein Programm: alle Wochen der Pause/Vorbereitung, Bausteine mit Anleitung, abhaken, eigene Aktivitäten.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { addDays } from "../../src/core/dates";
import { phaseWeeks, progWeek } from "../../src/core/prep";
import type { ProgItem } from "../../src/core/types";
import { useEngine, useStore } from "../../src/data/store";
import { Btn, Card, Col, Header, Muted, Row, Screen, T } from "../../src/ui/kit";
import { GOLD } from "../../src/ui/player/parts";
import { CountRing, ItemInfoSheet, LogSheet, PlayerItemRow, playerPhase } from "../../src/ui/prep";
import { radius, useTheme, withAlpha } from "../../src/ui/theme";

export default function Programm() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [info, setInfo] = useState<ProgItem | null>(null), [log, setLog] = useState<ProgItem | null>(null);
  const pid = s.mePid || "";
  const ph = playerPhase(E);
  const back = () => router.canGoBack() ? router.back() : router.replace("/player/heute");
  if (!ph) return <Screen testID="player-programm"><Header title={t("pg_title")} onBack={back} backLabel={t("btn_back")} /><Card><Muted>{t("pg_none")}</Muted></Card></Screen>;
  void s.version;
  const W = phaseWeeks(ph.from, ph.to), started = ph.from <= E.TODAY;
  const col = ph.kind === "break" ? "#16a3a3" : "#f0762b";
  const weeks = W.map(ws => progWeek(E.D, pid, ph, ws, E.TODAY));
  const doneAll = weeks.filter(w => w.ws <= E.TODAY).reduce((a, w) => a + w.done, 0), totalAll = weeks.reduce((a, w) => a + w.total, 0);
  return (
    <Screen testID="player-programm">
      <Header eyebrow={t("pg_title")} title={ph.title} onBack={back} backLabel={t("btn_back")} />
      <Card tone={col}>
        <Row gap={14}>
          <CountRing done={doneAll} total={totalAll} color={col} size={72} />
          <Col gap={3} style={{ flex: 1 }}>
            <T v="eyebrow" color={col}>{t("vb_kind_" + ph.kind)} · {E.de(ph.from)} – {E.de(ph.to)}</T>
            <T v="h3">{started ? tf("pg_progress", { d: doneAll, t: totalAll }) : tf("pg_startsIn", { d: E.de(ph.from) })}</T>
          </Col>
        </Row>
        <T v="small">{t("pg_why_" + ph.kind)}</T>
      </Card>
      {weeks.map(w => {
        const cur = w.ws <= E.TODAY && addDays(w.ws, 6) >= E.TODAY, past = addDays(w.ws, 6) < E.TODAY, future = w.ws > E.TODAY;
        const full = w.total > 0 && w.done >= w.total;
        return (
          <Card key={w.ws} testID={"pg-week-" + w.i} tone={full ? GOLD : cur ? col : undefined}>
            <Row between>
              <Col gap={1}>
                <T v="h3">{cur ? t("pg_thisWeek") : tf("pg_week_n", { i: w.i })}</T>
                <Muted small>{E.de(w.ws < ph.from ? ph.from : w.ws)} – {E.de(addDays(w.ws, 6) > ph.to ? ph.to : addDays(w.ws, 6))}</Muted>
              </Col>
              <View style={{ backgroundColor: full ? GOLD : withAlpha(col, 0.14), borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontWeight: "800", color: full ? "#1a1300" : c.ink, fontVariant: ["tabular-nums"] }}>{full ? "★ " : ""}{w.done}/{w.total}</Text>
              </View>
            </Row>
            <View style={{ opacity: future ? 0.75 : 1 }}>
              {w.items.map(({ it, done }) => <PlayerItemRow key={it.id} testID={`pgw-${w.i}-${it.id}`} it={it} done={done} locked={future || past} onInfo={() => setInfo(it)} onLog={() => setLog(it)} />)}
            </View>
            {w.ownMin ? <Muted small>{tf("vb_own", { m: w.ownMin })}</Muted> : null}
          </Card>
        );
      })}
      <Muted small>{t("pg_own")}</Muted>
      <Btn small testID="pg-own" icon="plus" label={t("pl_tab_extra")} onPress={() => router.push("/player/eintragen?tab=extra")} style={{ alignSelf: "flex-start" }} />
      <ItemInfoSheet it={info} pid={pid} locked={!started} onClose={() => setInfo(null)} onLog={() => { const x = info; setInfo(null); setLog(x); }} />
      <LogSheet it={log} ph={ph} pid={pid} onClose={() => setLog(null)} />
    </Screen>
  );
}
