// Startseite Trainer: „Belastung im Team“ – Verteilung der Spieler auf die Belastungszonen (ACWR: Belastung der
// letzten 7 Tage im Verhältnis zum Schnitt der letzten 4 Wochen) als Balken, darunter nur die Zonen mit Spielern
// (antippbar, Kader gefiltert) und die dringlichste Empfehlung in einer Zeile – ausführlich im Info-Blatt.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useEngine } from "../data/store";
import { Card, CardTitle, Info, Row } from "./kit";
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
          style={{ flexDirection: "row", height: 10, borderRadius: radius.pill, overflow: "hidden", gap: 2, backgroundColor: c.sunk }}>
          {ZONES.filter(k => n[k]).map(k => <View key={k} style={{ flex: n[k], backgroundColor: statusColor(c, k) }} />)}
        </View>
      ) : null}
      {/* Zonen mit Spielern als kleine Marken (antippen = Kader gefiltert) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {shown.filter(k => n[k] > 0).map(k => {
          const col = statusColor(c, k);
          return (
            <Pressable key={k} testID={"tile-" + k} accessibilityRole="button" accessibilityLabel={`${t("st_" + k)}: ${n[k]}`} onPress={() => router.push("/coach/kader?filter=" + k)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: withAlpha(col, pressed ? 0.2 : 0.1) })}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: col, fontVariant: ["tabular-nums"] }}>{n[k]}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "600", color: c.ink }}>{t("st_" + k)}</Text>
            </Pressable>
          );
        })}
      </View>
      {advice.length ? (
        <Row gap={8} testID="ts-advice">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor(c, advice[0][0]) }} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: c.muted }}>{advice[0][1]}</Text>
        </Row>
      ) : null}
    </Card>
  );
}
