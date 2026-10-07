// Einrichtung eines neuen Teams (5 Schritte) – oder Start der Demo (Schritt 1 und 2).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { classDef, defaultPrinciples, defaultSettings, groupOf, modsFor } from "../src/core/classes";
import type { ClassKey, Depth, Modules, Principles, TeamSettings } from "../src/core/types";
import { useStore } from "../src/data/store";
import { ClassPicker, DaysEditor, DepthPicker, ModuleList, PrinciplesEditor, SetupSummary } from "../src/ui/editors";
import { Banner, Btn, Card, Field, Header, Muted, Row, Screen, Seg, T } from "../src/ui/kit";
import { radius, useTheme } from "../src/ui/theme";

export default function Setup() {
  const s = useStore(); const tr = s.tr; const { t } = tr; const router = useRouter(); const { c } = useTheme();
  const demo = useLocalSearchParams<{ demo: string }>().demo === "1";
  const [step, setStep] = useState(0);
  const [cls, setCls] = useState<ClassKey>("u19");
  const [depth, setDepth] = useState<Depth>("basis");
  const [mods, setMods] = useState<Modules>(modsFor("basis", "u19"));
  const [settings, setSettings] = useState<TeamSettings>(defaultSettings());
  const [principles, setPrinciples] = useState<Principles>(defaultPrinciples("u19"));
  const [club, setClub] = useState(""); const [team, setTeam] = useState("U19");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const n = demo ? 2 : 5, kids = groupOf(cls) === "u11";
  const pickClass = (k: ClassKey) => {
    setCls(k); const g = groupOf(k); setPrinciples(defaultPrinciples(g));
    const d = g === "u11" && depth === "pro" ? "basis" : depth; setDepth(d); setMods(modsFor(d, k));
    const def = classDef(k); setTeam(def.team ? def.team[tr.lang] : k.toUpperCase());
  };
  const finish = async () => {
    setBusy(true); setMsg("");
    try {
      if (demo) { await s.startDemo(cls, depth); router.replace("/"); return; }
      if (!club.trim()) { setStep(0); setMsg(t("au_fill")); return; }
      await s.createTeam({ club: club.trim(), name: team.trim() || cls.toUpperCase(), cls, depth, settings, principles, modules: mods, lang: tr.lang });
      s.toast(t("su_done")); router.replace("/");
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  const next = () => { if (step >= n - 1) finish(); else { setStep(step + 1); setMsg(""); } };
  return (
    <Screen testID={"setup-" + step}>
      <Row gap={6}>{Array.from({ length: n }).map((_, i) => <View key={i} style={{ width: 26, height: 5, borderRadius: radius.pill, backgroundColor: i <= step ? c.accent : c.line }} />)}</Row>
      {step === 0 ? <>
        <Header eyebrow={t("ob_hi")} title={t("ob_q1")} />
        <Muted>{t("ob_hi2")}</Muted>
        <ClassPicker value={cls} onChange={pickClass} tr={tr} />
        {!demo ? <Row wrap gap={10}>
          <Field testID="su-club" label={t("clubName")} value={club} onChangeText={setClub} style={{ flex: 1, minWidth: 200 }} />
          <Field testID="su-team" label={t("team")} value={team} onChangeText={setTeam} style={{ width: 160 }} />
        </Row> : null}
        <Row gap={10}><T v="eyebrow">{t("lang")}</T><Seg testID="su-lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} /></Row>
      </> : null}
      {step === 1 ? <>
        <Header eyebrow={classDef(cls).k.toUpperCase()} title={t("ob_q2")} />
        {kids ? <Banner>{t("kidsNote")}</Banner> : null}
        <DepthPicker value={depth} onChange={d => { setDepth(d); setMods(modsFor(d, cls)); }} tr={tr} kids={kids} />
        {!demo ? <><T v="h3">{t("ob_q2b")}</T><Card><ModuleList value={mods} onChange={setMods} tr={tr} cls={cls} /></Card></> : null}
      </> : null}
      {step === 2 ? <><Header title={t("ob_q3")} /><Muted>{t("ob_q3b")}</Muted><Card><DaysEditor value={settings} onChange={setSettings} tr={tr} /></Card></> : null}
      {step === 3 ? <><Header title={t("ob_q4")} /><Muted>{t("ob_q4b")}</Muted>
        {kids ? <Banner>{t("w_kids")}</Banner> : <Card><PrinciplesEditor value={principles} onChange={setPrinciples} tr={tr} cls={cls} depth={depth} kinds={[]} /></Card>}</> : null}
      {step === 4 ? <><Header title={t("ob_q5")} /><Card><SetupSummary tr={tr} cls={cls} depth={depth} settings={settings} /></Card></> : null}
      {msg ? <Muted>{msg}</Muted> : null}
      <Row between>
        <Btn testID="su-back" label={t("ob_back")} onPress={() => step === 0 ? router.back() : setStep(step - 1)} />
        <Btn testID="su-next" kind="primary" disabled={busy} label={step >= n - 1 ? (demo ? t("su_demoGo") : t("su_create")) : t("ob_next")} onPress={next} />
      </Row>
    </Screen>
  );
}
