// Trainer – Leistungsdiagnostik: Test wählen, Teamübersicht (letzter Wert, Bewertung, Trend, Bestwert), Testtag erfassen.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CUSTOM_TEST_MAX, bandOfValue, bestOf, resultsOf, trendOf } from "../../../src/core/perf";
import type { TestKey } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { Btn, Card, CardTitle, ChoiceChips, Header, Info, Muted, Row, Screen } from "../../../src/ui/kit";
import { BandChip, CustomTestSheet, CustomTestsCard, fmtTest, newCustomTest, TestDaySheet, TestInfo } from "../../../src/ui/perf";
import type { CustomTest } from "../../../src/core/types";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { useTheme } from "../../../src/ui/theme";
import { useNavBack } from "../../../src/ui/nav";

export default function Leistung() {
  const nb = useNavBack("leistung");
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const tests = E.testsFor(true);
  const [k0, setK] = useState<TestKey>(tests[0].key);
  // gewählter Test kann wegfallen (z. B. eigener Test gelöscht) → erster Test
  const k = tests.some(x => x.key === k0) ? k0 : tests[0].key;
  const [day, setDay] = useState(false);
  const [newTest, setNewTest] = useState<CustomTest | null>(null);
  const canEdit = s.can("perf") && E.customTests.length < CUSTOM_TEST_MAX;
  const d = E.testDef(k);
  // Torwarttests nur für Torhüter (Position TW oder Torhüter-Gruppe)
  const rows = E.D.players.filter(p => !d.gk || E.isGK(p)).map(p => ({ p, last: resultsOf(E.D, p.id, k)[0], pb: bestOf(E.D, p.id, k), tr: trendOf(E.D, p.id, k) }))
    .sort((a, b) => !a.last ? 1 : !b.last ? -1 : d.lower ? a.last.value - b.last.value : b.last.value - a.last.value);
  const withVal = rows.filter(r => r.last);
  const avg = withVal.length ? withVal.reduce((x, r) => x + r.last!.value, 0) / withVal.length : null;
  return (
    <Screen testID="coach-leistung">
      <Header title={t("lt_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("lt_use")} text={t("lt_useT")} />}
        right={<Btn testID="lt-day" kind="primary" icon="plus" label={t("lt_day")} onPress={() => setDay(true)} />} />
      <ChoiceChips testID="lt-test" value={k} onChange={setK} options={tests.map(x => ({ key: x.key, label: E.testName(x.key) }))} />
      {/* eigener Test direkt bei der Auswahl – Verwaltung unten unter „Eigene Tests“ */}
      {canEdit ? <Btn small kind="ghost" icon="plus" testID="lt-own" label={t("cto_addShort")} onPress={() => setNewTest(newCustomTest())} style={{ alignSelf: "flex-start" }} /> : null}
      <Card testID="lt-table">
        <CardTitle title={E.testName(k)} info={<TestInfo k={k} />} right={avg != null ? <Muted small>Ø {fmtTest(k, avg, E.tr.lang, E.customTests)} {d.unit}</Muted> : undefined} />
        <Muted small>{E.testDesc(k)}{d.gk ? " · " + t("tw_onlyGk") : ""}</Muted>
        {d.gk && !rows.length ? <Muted>{t("tw_noGk")}</Muted> : null}
        {withVal.length ? rows.map((r, i) => (
          <Pressable key={r.p.id} testID={"lt-row-" + r.p.id} accessibilityRole="button" onPress={() => router.push("/coach/spieler/" + r.p.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line, opacity: r.last ? 1 : 0.5 }}>
            <Text style={{ width: 22, textAlign: "right", fontWeight: "800", color: c.muted }}>{r.last ? i + 1 : "–"}</Text>
            <PlayerAvatar p={r.p} size={30} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontWeight: "700", color: c.ink, fontSize: 14 }}>{E.name(r.p)}</Text>
              {r.last ? <Row gap={6}><BandChip band={bandOfValue(k, E.grp, r.last.value)} />{r.pb && r.pb.id === r.last.id && resultsOf(E.D, r.p.id, k).length > 1 ? <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#c99400" }}>★ {t("pl_pb")}</Text> : null}</Row> : null}
            </View>
            {r.last ? <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{fmtTest(k, r.last.value, E.tr.lang, E.customTests)}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: r.tr == null ? c.muted : r.tr > 0.005 ? c.ok : r.tr < -0.005 ? c.crit : c.muted }}>{r.tr == null ? E.de(r.last.date) : `${r.tr > 0 ? "▲" : r.tr < 0 ? "▼" : "■"} ${E.num(Math.abs(r.tr * 100), 1)} %`}</Text>
            </View> : null}
          </Pressable>
        )) : <Muted>{t("lt_none")}</Muted>}
      </Card>
      {s.can("perf") ? <CustomTestsCard /> : null}
      <TestDaySheet visible={day} onClose={() => setDay(false)} test={k} />
      <CustomTestSheet value={newTest} onClose={() => setNewTest(null)} />
    </Screen>
  );
}
