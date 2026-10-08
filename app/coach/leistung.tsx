// Trainer – Leistungsdiagnostik: Test wählen, Teamübersicht (letzter Wert, Bewertung, Trend, Bestwert), Testtag erfassen.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { bandOfValue, bestOf, resultsOf, testDef, testsFor, trendOf } from "../../src/core/perf";
import type { TestKey } from "../../src/core/types";
import { useEngine } from "../../src/data/store";
import { Btn, Card, CardTitle, ChoiceChips, Header, Info, Muted, Row, Screen } from "../../src/ui/kit";
import { BandChip, fmtTest, TestDaySheet, TestInfo } from "../../src/ui/perf";
import { PlayerAvatar } from "../../src/ui/playerAvatar";
import { useTheme } from "../../src/ui/theme";

export default function Leistung() {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const all = testsFor(E.grp), sel = E.team.settings.tests;
  const tests = sel && sel.length ? all.filter(x => sel.includes(x.key)) : all;
  const [k, setK] = useState<TestKey>(tests[0].key);
  const [day, setDay] = useState(false);
  const d = testDef(k);
  const rows = E.D.players.map(p => ({ p, last: resultsOf(E.D, p.id, k)[0], pb: bestOf(E.D, p.id, k), tr: trendOf(E.D, p.id, k) }))
    .sort((a, b) => !a.last ? 1 : !b.last ? -1 : d.lower ? a.last.value - b.last.value : b.last.value - a.last.value);
  const withVal = rows.filter(r => r.last);
  const avg = withVal.length ? withVal.reduce((x, r) => x + r.last!.value, 0) / withVal.length : null;
  return (
    <Screen testID="coach-leistung">
      <Header title={t("lt_title")} onBack={() => router.back()} backLabel={t("mo_title")} info={<Info title={t("lt_use")} text={t("lt_useT")} />}
        right={<Btn testID="lt-day" kind="primary" icon="plus" label={t("lt_day")} onPress={() => setDay(true)} />} />
      <ChoiceChips testID="lt-test" value={k} onChange={setK} options={tests.map(x => ({ key: x.key, label: t("ts_" + x.key) }))} />
      <Card testID="lt-table">
        <CardTitle title={t("ts_" + k)} info={<TestInfo k={k} />} right={avg != null ? <Muted small>Ø {fmtTest(k, avg, E.tr.lang)} {d.unit}</Muted> : undefined} />
        <Muted small>{t("tsd_" + k)}</Muted>
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
              <Text style={{ fontSize: 17, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{fmtTest(k, r.last.value, E.tr.lang)}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: r.tr == null ? c.muted : r.tr > 0.005 ? c.ok : r.tr < -0.005 ? c.crit : c.muted }}>{r.tr == null ? E.de(r.last.date) : `${r.tr > 0 ? "▲" : r.tr < 0 ? "▼" : "■"} ${E.num(Math.abs(r.tr * 100), 1)} %`}</Text>
            </View> : null}
          </Pressable>
        )) : <Muted>{t("lt_none")}</Muted>}
      </Card>
      <TestDaySheet visible={day} onClose={() => setDay(false)} test={k} />
    </Screen>
  );
}
