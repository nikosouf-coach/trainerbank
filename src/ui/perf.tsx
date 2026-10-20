// Leistungsdiagnostik-Bausteine: Bewertungsfarbe, Testkarte im Profil, Laufvorgaben, Testtag-Erfassung.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { CT_LIMITS, CUSTOM_TEST_MAX, bandOfValue, bestOf, cleanCustomTests, normOf, resultsOf, runTargets, testDef, trendOf, type Band } from "../core/perf";
import type { CustomTest, Player, TestKey } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Col, DateField, Field, Info, Muted, NumField, Row, Seg, Sheet, T, ToggleRow } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { radius, useTheme, withAlpha, type Colors } from "./theme";

export const bandColor = (c: Colors, b: Band): string => ({ top: "#13854f", gut: c.ok, mittel: c.warn, basis: c.hot, none: c.build }[b]);
/** Testwert mit den Nachkommastellen des Tests (cx: eigene Tests des Teams) */
export function fmtTest(k: TestKey, v: number, lang: "de" | "en", cx?: CustomTest[]): string { const s = v.toFixed(testDef(k, cx).dec); return lang === "en" ? s : s.replace(".", ","); }

/** Kleine Bewertung (Farbpunkt + Text). */
export function BandChip({ band }: { band: Band }) {
  const { c } = useTheme(); const E = useEngine(); const col = bandColor(c, band);
  if (band === "none") return null;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: withAlpha(col, 0.14), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} /><Text style={{ color: col, fontWeight: "800", fontSize: 11.5 }}>{E.t("band_" + band)}</Text></View>;
}

/** Erklärungen zu einem Test (Durchführung, Orientierungswerte). */
export function TestInfo({ k }: { k: TestKey }) {
  const E = useEngine(); const { t } = E; const d = E.testDef(k), n = normOf(k, E.grp);
  const fmt = (v: number) => fmtTest(k, v, E.tr.lang, E.customTests) + " " + d.unit;
  const norm = n ? `${t("lt_norm")} (${E.team.cls.toUpperCase()}): ${t("band_top")} ${d.lower ? "≤" : "≥"} ${fmt(n[0])} · ${t("band_gut")} ${d.lower ? "≤" : "≥"} ${fmt(n[1])} · ${t("band_mittel")} ${d.lower ? "≤" : "≥"} ${fmt(n[2])}` : "";
  const how = E.testHow(k);
  return <Info title={E.testName(k)} text={[E.testDesc(k), how ? t("lt_how") + ": " + how : "", norm, n ? t("lt_normInfo") : d.custom ? t("cto_noNorm") : ""].filter(Boolean)} testID={"tinfo-" + k} />;
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
  const list = E.testsFor().filter(d => resultsOf(E.D, p.id, d.key).length);
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
              <Row gap={6}><Text style={{ fontWeight: "700", fontSize: 14, color: c.ink }}>{E.testName(d.key)}</Text><TestInfo k={d.key} /></Row>
              <Row gap={6} wrap><BandChip band={band} />{isPb ? <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#c99400" }}>★ {t("pl_pb")}</Text> : <Muted small>{t("lt_pb")}: {fmtTest(d.key, pb.value, E.tr.lang, E.customTests)}</Muted>}</Row>
              {rk ? <Text testID={"rank-" + d.key} style={{ fontSize: 12, fontWeight: "700", color: rk.rank <= 3 ? c.accentTx : c.muted }}>
                {E.tf("lt_rank", { r: rk.rank, n: rk.n })}{rk.best != null ? " · " + E.tf("lt_teamBest", { v: fmtTest(d.key, rk.best, E.tr.lang, E.customTests), u: d.unit }) : ""}
              </Text> : null}
            </Col>
            <Col gap={0} style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{fmtTest(d.key, last.value, E.tr.lang, E.customTests)} <Text style={{ fontSize: 12, color: c.muted }}>{d.unit}</Text></Text>
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
  const op = only ? E.P(only) : null;
  const tests = E.testsFor(true).filter(x => !x.gk || !op || E.isGK(op));
  const [k, setK] = useState<TestKey>(test && tests.some(x => x.key === test) ? test : tests[0].key);
  const [date, setDate] = useState<string | null>(E.TODAY);
  const [vals, setVals] = useState<Record<string, number | null>>({});
  const d = E.testDef(k);
  const players = (only ? E.D.players.filter(p => p.id === only) : E.D.players.filter(p => !E.absenceOn(p.id, date || E.TODAY) || E.absenceOn(p.id, date || E.TODAY)?.typ === "urlaub"))
    .filter(p => !d.gk || E.isGK(p));
  const save = () => {
    let n = 0;
    for (const p of players) { const v = vals[p.id]; if (v == null || v < d.min || v > d.max) continue; s.saveTest({ id: tmpId(), pid: p.id, test: k, date: date || E.TODAY, value: v }); n++; }
    s.toast(tf("lt_saved", { n })); onDone();
  };
  return (
    <Col gap={12}>
      <ChoiceChips testID="td-test" value={k} onChange={x => { setK(x); setVals({}); }} options={tests.map(x => ({ key: x.key, label: E.testName(x.key) }))} />
      <Row gap={6}><Muted small style={{ flex: 1 }}>{E.testDesc(k)}</Muted><TestInfo k={k} /></Row>
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

// ---------- Eigene Tests ----------
/** Kennung eines eigenen Tests (dauerhaft, Teil des Ergebnisschlüssels "c:<id>") */
const ctId = (): string => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** Vorlagen für häufige eigene Tests (füllen nur das Formular) */
const CT_PRESETS: { k: string; unit: string; lower: boolean; dec: 0 | 1 | 2 }[] = [
  { k: "jongl", unit: "x", lower: false, dec: 0 }, { k: "push", unit: "Wdh.", lower: false, dec: 0 }, { k: "plank", unit: "s", lower: false, dec: 0 },
  { k: "shot", unit: "/10", lower: false, dec: 0 }, { k: "sprint20", unit: "s", lower: true, dec: 2 }, { k: "beep", unit: "Stufe", lower: false, dec: 1 },
];

/** Eigene Tests des Teams: Liste mit Anzahl Ergebnisse, anlegen, bearbeiten, löschen (mit allen Ergebnissen) */
export function CustomTestsCard({ testID = "ct-card" }: { testID?: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [edit, setEdit] = useState<CustomTest | null>(null);
  const list = E.customTests;
  const count = (x: CustomTest) => E.D.tests.filter(r => r.test === "c:" + x.id).length;
  return (
    <Card testID={testID}>
      <CardTitle title={t("cto_title")} info={<Info title={t("cto_title")} text={[t("cto_info"), t("cto_info2")]} />} />
      {list.length ? list.map(x => (
        <Row key={x.id} gap={10} testID={"ct-row-" + x.id} style={{ paddingVertical: 4 }}>
          <Col gap={1} style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 14.5, color: c.ink }}>{x.name}{x.gk ? " · " + t("cto_gkShort") : ""}</Text>
            <Muted small>{[x.unit, t(x.lower ? "cto_lower" : "cto_higher"), tf("cto_results", { n: count(x) })].filter(Boolean).join(" · ")}</Muted>
          </Col>
          <Btn small testID={"ct-edit-" + x.id} icon="pen" label="" a11y={t("edit")} onPress={() => setEdit(x)} />
        </Row>
      )) : <Muted small>{t("cto_none")}</Muted>}
      {list.length < CUSTOM_TEST_MAX ? <Btn small icon="plus" testID="ct-add" label={t("cto_add")} style={{ alignSelf: "flex-start" }}
        onPress={() => setEdit(newCustomTest())} /> : <Muted small>{tf("cto_max", { n: CUSTOM_TEST_MAX })}</Muted>}
      <CustomTestSheet value={edit} onClose={() => setEdit(null)} />
    </Card>
  );
}

/** Neuer eigener Test (Vorlage für den Knopf „+ Eigener Test“) */
export const newCustomTest = (): CustomTest => ({ id: ctId(), name: "", unit: "", lower: false, dec: 0 });

/** Blatt: eigenen Test anlegen oder bearbeiten (value = null → geschlossen) */
export function CustomTestSheet({ value, onClose }: { value: CustomTest | null; onClose: () => void }) {
  const E = useEngine(); const { t } = E;
  const isNew = !!value && !E.customTests.some(x => x.id === value.id);
  const results = value ? E.D.tests.filter(r => r.test === "c:" + value.id).length : 0;
  return (
    <Sheet visible={!!value} onClose={onClose} title={isNew ? t("cto_add") : t("cto_edit")} testID="ct-sheet" closeLabel={t("cancel")}>
      {value ? <CustomTestForm init={value} isNew={isNew} results={results} onDone={onClose} /> : null}
    </Sheet>
  );
}

function CustomTestForm({ init, isNew, results, onDone }: { init: CustomTest; isNew: boolean; results: number; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const [x, setX] = useState<CustomTest>(init); const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false);
  const set = (p: Partial<CustomTest>) => setX(v => ({ ...v, ...p }));
  const S = E.team.settings, key = ("c:" + x.id) as TestKey;
  const save = async () => {
    setBusy(true);
    try {
      const list = isNew ? [...E.customTests, x] : E.customTests.map(y => y.id === x.id ? x : y);
      // eine bestehende Auswahl (settings.tests) bekommt den neuen Test dazu, sonst wäre er unsichtbar
      const tests = isNew && S.tests && S.tests.length ? [...S.tests, key] : S.tests;
      await s.updateTeam({ settings: { ...S, customTests: cleanCustomTests(list), tests } });
      s.toast(t("t_saved")); onDone();
    } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try {
      // Datensparsamkeit: mit dem Test verschwinden auch seine Ergebnisse
      for (const r of E.D.tests.filter(r => r.test === key)) await s.deleteTest(r.id);
      await s.updateTeam({ settings: { ...S, customTests: E.customTests.filter(y => y.id !== x.id), tests: S.tests ? S.tests.filter(k => k !== key) : S.tests } });
      s.toast(t("t_del")); onDone();
    } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Col gap={12}>
      {isNew ? <Col gap={6}><T v="small" bold>{t("cto_presets")}</T>
        <Row wrap gap={6}>{CT_PRESETS.map(p => <Btn key={p.k} small testID={"ct-preset-" + p.k} label={t("ctp_" + p.k)}
          onPress={() => set({ name: t("ctp_" + p.k), unit: p.unit, lower: p.lower, dec: p.dec, how: t("ctph_" + p.k) })} />)}</Row></Col> : null}
      <Field testID="ct-name" label={t("cto_name") + " *"} value={x.name} onChangeText={v => set({ name: v })} placeholder={t("cto_namePh")} maxLength={CT_LIMITS.name} />
      <Field testID="ct-unit" label={t("cto_unit")} value={x.unit} onChangeText={v => set({ unit: v })} placeholder={t("cto_unitPh")} maxLength={CT_LIMITS.unit} />
      <Col gap={4}><T v="small" bold>{t("cto_dir")}</T>
        <Seg testID="ct-dir" value={x.lower ? "lower" : "higher"} onChange={v => set({ lower: v === "lower" })} options={[{ key: "higher", label: t("cto_higher") }, { key: "lower", label: t("cto_lower") }]} wrap /></Col>
      <Col gap={4}><T v="small" bold>{t("cto_dec")}</T>
        <Seg testID="ct-dec" value={String(x.dec)} onChange={v => set({ dec: Number(v) as 0 | 1 | 2 })} options={[{ key: "0", label: "12" }, { key: "1", label: "12,3" }, { key: "2", label: "12,34" }]} /></Col>
      <Field testID="ct-how" label={t("cto_how")} value={x.how || ""} onChangeText={v => set({ how: v })} placeholder={t("cto_howPh")} multiline maxLength={CT_LIMITS.how} />
      <ToggleRow testID="ct-gk" label={t("cto_gk")} value={!!x.gk} onChange={v => set({ gk: v })} />
      <Row gap={8} wrap>
        <Btn testID="ct-save" kind="primary" label={t("save")} disabled={busy || !x.name.trim()} onPress={save} />
        {!isNew ? <Btn testID="ct-del" kind="ghost" label={t("del")} onPress={() => setAsk(true)} /> : null}
      </Row>
      {ask ? <Banner color="#c23b2b" testID="ct-del-ask"><Col gap={8}>
        <T v="small" bold>{results ? tf("cto_delQn", { n: results }) : t("cto_delQ")}</T>
        <Row gap={8}><Btn small label={t("no")} onPress={() => setAsk(false)} /><Btn small kind="danger" testID="ct-del-confirm" label={t("del")} disabled={busy} onPress={del} /></Row>
      </Col></Banner> : null}
    </Col>
  );
}
