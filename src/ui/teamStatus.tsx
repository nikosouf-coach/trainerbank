// Startseite Trainer: „Belastung im Team“ – Verteilung der Spieler auf die Belastungszonen (ACWR: Belastung der
// letzten 7 Tage im Verhältnis zum Schnitt der letzten 4 Wochen) als Balken, Zonen antippbar (Kader gefiltert) und
// darunter, was das für die nächsten Einheiten heißt.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useEngine } from "../data/store";
import { Card, CardTitle, Col, Info, Row } from "./kit";
import { radius, statusColor, useTheme, withAlpha } from "./theme";

const ZONES = ["crit", "warn", "ok", "low", "inj", "build"] as const;
type Zone = typeof ZONES[number];

export function TeamStatusCard() {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const n = useMemo(() => {
    const out: Record<Zone, number> = { crit: 0, warn: 0, ok: 0, low: 0, inj: 0, build: 0 };
    for (const p of E.D.players) { const st = E.profile(p.id).st; if (st in out) out[st as Zone]++; }
    return out;
  }, [E]);
  const total = ZONES.reduce((s, k) => s + n[k], 0);
  // Was heißt das? (Dringlichstes zuerst) – auf der Karte kurz, ausführlich im Info-Blatt
  const advice: [Zone, string, string][] = [];
  if (n.crit) advice.push(["crit", tf("ts_critS", { n: n.crit }), tf(n.crit === 1 ? "ts_crit1" : "ts_crit", { n: n.crit })]);
  if (n.warn) advice.push(["warn", tf("ts_warnS", { n: n.warn }), tf(n.warn === 1 ? "ts_warn1" : "ts_warn", { n: n.warn })]);
  if (n.low) advice.push(["low", tf("ts_lowS", { n: n.low }), tf(n.low === 1 ? "ts_low1" : "ts_low", { n: n.low })]);
  if (!advice.length && n.ok) advice.push(["ok", t("ts_allOkS"), t("ts_allOk")]);
  if (!advice.length && n.build) advice.push(["build", t("ts_buildS"), t("ts_build")]);
  const shown = ZONES.filter(k => k !== "build" || n.build);
  return (
    <Card testID="today-status">
      <CardTitle title={t("ts_title")} info={<Info title={t("ts_title")} text={[...advice.map(x => x[2]), t("ts_info1"), t("ts_info2"), t("ts_info3")]} />} />
      {total ? (
        <View testID="ts-bar" accessibilityLabel={shown.map(k => `${t("st_" + k)}: ${n[k]}`).join(", ")}
          style={{ flexDirection: "row", height: 14, borderRadius: radius.pill, overflow: "hidden", gap: 2, backgroundColor: c.sunk }}>
          {ZONES.filter(k => n[k]).map(k => <View key={k} style={{ flex: n[k], backgroundColor: statusColor(c, k) }} />)}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 }}>
        {shown.map(k => {
          const col = statusColor(c, k), on = n[k] > 0;
          return (
            <Pressable key={k} testID={"tile-" + k} accessibilityRole="button" accessibilityLabel={`${t("st_" + k)}: ${n[k]}`} onPress={() => router.push("/coach/kader?filter=" + k)}
              style={({ pressed }) => ({ width: "48.6%", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.m,
                backgroundColor: pressed ? withAlpha(col, 0.16) : on ? withAlpha(col, 0.08) : "transparent", borderWidth: 1, borderColor: on ? withAlpha(col, 0.3) : c.line })}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col, opacity: on ? 1 : 0.35 }} />
              <Text style={{ fontSize: 20, fontWeight: "800", color: on ? col : c.muted, fontVariant: ["tabular-nums"], minWidth: 22 }}>{n[k]}</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: "700", color: on ? c.ink : c.muted }}>{t("st_" + k)}</Text>
            </Pressable>
          );
        })}
      </View>
      {advice.length ? (
        <Col gap={6} testID="ts-advice">
          {advice.map(([k, txt]) => (
            <Row key={k} gap={8}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor(c, k) }} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: c.ink }}>{txt}</Text>
            </Row>
          ))}
        </Col>
      ) : null}
    </Card>
  );
}
