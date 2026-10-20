// Planung: Zeile „Ablauf & Skizzen“ je Trainingstag – Übungen und Skizzen auf einen Blick, führt zum Trainingstag
// (dort Übungen anlegen, Skizzen zeichnen, Zuständigkeiten).
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { dayBlocks } from "../../core/day";
import { useEngine } from "../../data/store";
import { Icon } from "../icons";
import { Col } from "../kit";
import { SketchView } from "../sketch";
import { radius, useTheme } from "../theme";

export function DayFlowRow({ date, testID }: { date: string; testID?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const blocks = dayBlocks(E.D, date), withSketch = blocks.filter(b => b.drawing), nSk = blocks.filter(b => b.drawing || b.photo).length;
  const sub = blocks.length
    ? [blocks.length === 1 ? t("pl_flow1") : tf("pl_flowN", { n: blocks.length }), nSk ? (nSk === 1 ? t("pl_sk1") : tf("pl_skN", { n: nSk })) : t("pl_skNone")].join(" · ")
    : t("pl_flowNone");
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${t("pl_flowT")}: ${sub}`} onPress={() => router.push("/coach/tag/" + date)}
      style={({ pressed }) => ({ gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.sunk : c.surface })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name="board" size={17} color={c.accentTx} /></View>
        <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.ink }}>{t("pl_flowT")}</Text>
          <Text style={{ fontSize: 12, color: c.muted }}>{sub}</Text>
        </Col>
        <Icon name="chevron" size={16} color={c.muted} />
      </View>
      {/* Skizzen des Tages als Vorschaubilder (ganze Breite, nichts wird abgeschnitten) */}
      {withSketch.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 42 }}>
        {withSketch.slice(0, 6).map(b => <View key={b.id} style={{ borderRadius: 5, overflow: "hidden" }}><SketchView value={b.drawing!} width={52} mini /></View>)}
      </View> : null}
    </Pressable>
  );
}
