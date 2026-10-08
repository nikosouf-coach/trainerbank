// Leistungsdiagnostik-Bausteine: Bewertungsfarbe, Testkarte im Profil, Laufvorgaben, Testtag-Erfassung.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { bandOfValue, bestOf, normOf, resultsOf, runTargets, testDef, testsFor, trendOf, type Band } from "../core/perf";
import type { Player, TestKey } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Col, DateField, Info, Muted, NumField, Row, Sheet, T } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { radius, useTheme, withAlpha, type Colors } from "./theme";

export const bandColor = (c: Colors, b: Band): string => ({ top: "#13854f", gut: c.ok, mittel: c.warn, basis: c.hot, none: c.build }[b]);
export function fmtTest(k: TestKey, v: number, lang: "de" | "en"): string { const s = v.toFixed(testDef(k).dec); return lang === "en" ? s : s.replace(".", ","); }

/** Kleine Bewertung (Farbpunkt + Text). */
export function BandChip({ band }: { band: Band }) {
  const { c } = useTheme(); const E = useEngine(); const col = bandColor(c, band);
  if (band === "none") return null;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: withAlpha(col, 0.14), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} /><Text style={{ color: col, fontWeight: "800", fontSize: 11.5 }}>{E.t("band_" + band)}</Text></View>;
}

/** Erklärungen zu einem Test (Durchführung, Orientierungswerte). */
export function TestInfo({ k }: { k: TestKey }) {
  const E = useEngine(); const { t } = E; const d = testDef(k), n = normOf(k, E.grp);
  const fmt = (v: number) => fmtTest(k, v, E.tr.lang) + " " + d.unit;
  const norm = n ? `${t("lt_norm")} (${E.team.cls.toUpperCase()}): ${t("band_top")} ${d.lower ? "≤" : "≥"} ${fmt(n[0])} · ${t("band_gut")} ${d.lower ? "≤" : "≥"} ${fmt(n[1])} · ${t("band_mittel")} ${d.lower ? "≤" : "≥"} ${fmt(n[2])}` : "";
  return <Info title={t("ts_" + k)} text={[t("tsd_" + k), t("lt_how") + ": " + t("tsp_" + k), norm, t("lt_normInfo")].filter(Boolean)} testID={"tinfo-" + k} />;
}

/** Persönliche Laufvorgaben aus dem 30-15 IFT. */
export function RunTargets({ pid }: { pid: string }) {
  const E = useEngine(); const rt = runTargets(E.D, pid);
  if (!rt) return null;
  return <Banner color="#16a3a3"><Col gap={2}><T v="small" bold>{E.t("lt_runs")}</T><T v="small">{E.tf("lt_runsT", { a: rt.d15_90, b: rt.d15_95, c: rt.d30_85, v: fmtTest("ift", rt.vift, E.tr.lang), d: E.de(rt.date) })}</T></Col></Banner>;
}

/** Testwerte eines Spielers (Profil für Trainer und „Meine Tests“ für Spieler). */
export function PerfCard({ p, editable }: { p: Player; editable?: boolean }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [add, setAdd] = useState(false);
  const list = testsFor(E.grp).filter(d => resultsOf(E.D, p.id, d.key).length);
  return (
    <Card testID="perf-card">
      <CardTitle title={editable ? t("lt_title") : t("pl_tests")} info={<Info title={t("lt_use")} text={t("lt_useT")} />}
        right={editable ? <Btn small kind="ghost" icon="plus" testID="perf-add" label={t("lt_add")} onPress={() => setAdd(true)} /> : undefined} />
      {list.length ? list.map(d => {
        const L = resultsOf(E.D, p.id, d.key), last = L[0], pb = bestOf(E.D, p.id, d.key)!, tr = trendOf(E.D, p.id, d.key);
        const band = bandOfValue(d.key, E.grp, last.value), isPb = pb.id === last.id && L.length > 1, rk = E.rankOf(p.id, d.key);
        return (
          <View key={d.key} testID={"perf-" + d.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Col gap={2} style={{ flex: 1 }}>
              <Row gap={6}><Text style={{ fontWeight: "700", fontSize: 14, color: c.ink }}>{t("ts_" + d.key)}</Text><TestInfo k={d.key} /></Row>
              <Row gap={6} wrap><BandChip band={band} />{isPb ? <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#c99400" }}>★ {t("pl_pb")}</Text> : <Muted small>{t("lt_pb")}: {fmtTest(d.key, pb.value, E.tr.lang)}</Muted>}</Row>
              {rk ? <Text testID={"rank-" + d.key} style={{ fontSize: 12, fontWeight: "700", color: rk.rank <= 3 ? c.accentTx : c.muted }}>
                {E.tf("lt_rank", { r: rk.rank, n: rk.n })}{rk.best != null ? " · " + E.tf("lt_teamBest", { v: fmtTest(d.key, rk.best, E.tr.lang), u: d.unit }) : ""}
              </Text> : null}
            </Col>
            <Col gap={0} style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{fmtTest(d.key, last.value, E.tr.lang)} <Text style={{ fontSize: 12, color: c.muted }}>{d.unit}</Text></Text>
              <Text style={{ fontSize: 11.5, color: tr == null ? c.muted : tr > 0.005 ? c.ok : tr < -0.005 ? c.crit : c.muted, fontWeight: "700" }}>{tr == null ? E.de(last.date) : `${tr > 0 ? "▲" : tr < 0 ? "▼" : "■"} ${E.num(Math.abs(tr * 100), 1)} % · ${E.de(last.date)}`}</Text>
            </Col>
          </View>
        );
      }) : <Muted>{t("lt_none")}</Muted>}
      <RunTargets pid={p.id} />
      {editable ? <TestDaySheet visible={add} onClose={() => setAdd(false)} only={p.id} /> : null}
    </Card>
  );
}

/** Blatt: Testtag erfassen (alle Spieler) oder einzelnen Wert (only = Spieler-ID). */
export function TestDaySheet({ visible, onClose, only, test }: { visible: boolean; onClose: () => void; only?: string; test?: TestKey }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={visible} onClose={onClose} title={only ? t("lt_add") : t("lt_day")} testID="testday-sheet" closeLabel={t("cancel")}>
      {visible ? <TestDayForm only={only} test={test} onDone={onClose} /> : null}
    </Sheet>
  );
}
function TestDayForm({ only, test, onDone }: { only?: string; test?: TestKey; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const sel = E.team.settings.tests, all = testsFor(E.grp);
  const tests = sel && sel.length ? all.filter(x => sel.includes(x.key)) : all;
  const [k, setK] = useState<TestKey>(test || tests[0].key);
  const [date, setDate] = useState<string | null>(E.TODAY);
  const [vals, setVals] = useState<Record<string, number | null>>({});
  const d = testDef(k);
  const players = only ? E.D.players.filter(p => p.id === only) : E.D.players.filter(p => !E.absenceOn(p.id, date || E.TODAY) || E.absenceOn(p.id, date || E.TODAY)?.typ === "urlaub");
  const save = () => {
    let n = 0;
    for (const p of players) { const v = vals[p.id]; if (v == null || v < d.min || v > d.max) continue; s.saveTest({ id: tmpId(), pid: p.id, test: k, date: date || E.TODAY, value: v }); n++; }
    s.toast(tf("lt_saved", { n })); onDone();
  };
  return (
    <Col gap={12}>
      <ChoiceChips testID="td-test" value={k} onChange={x => { setK(x); setVals({}); }} options={tests.map(x => ({ key: x.key, label: t("ts_" + x.key) }))} />
      <Row gap={6}><Muted small style={{ flex: 1 }}>{t("tsd_" + k)}</Muted><TestInfo k={k} /></Row>
      <DateField label={t("f_date")} value={date} onChange={setDate} lang={E.tr.lang} style={{ maxWidth: 200 }} />
      {players.map(p => (
        <Row key={p.id} gap={10}>
          <PlayerAvatar p={p} size={30} />
          <Text style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{E.name(p)}</Text>
          <NumField testID={"td-" + p.id} label="" value={vals[p.id] ?? null} onChange={v => setVals({ ...vals, [p.id]: v })} min={0} max={d.max} style={{ width: 110 }} />
          <Text style={{ width: 36, fontSize: 12, color: "#8b939e" }}>{d.unit}</Text>
        </Row>
      ))}
      <Btn testID="td-save" kind="primary" label={t("lt_save")} disabled={!Object.values(vals).some(v => v != null)} onPress={save} style={{ alignSelf: "flex-start" }} />
    </Col>
  );
}
