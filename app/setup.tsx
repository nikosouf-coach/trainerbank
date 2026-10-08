// Einrichtung eines neuen Teams – oder Start der Demo.
// Schritte: 1 Mannschaft · 2 Vorauswahl (Stufe) und einzelne Module · 3 Trainingstage und Dauer ·
// 4 Trainingsprinzipien (nur mit Planung, nicht in der Demo) · 5 Zusammenfassung (nicht in der Demo).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { classDef, defaultPrinciples, defaultSettings, groupOf, modsFor } from "../src/core/classes";
import type { ClassKey, Depth, Modules, Principles, TeamSettings } from "../src/core/types";
import { useStore } from "../src/data/store";
import { ClassPicker, DaysEditor, DepthPicker, ModuleList, PrinciplesEditor, SetupSummary, allModules, moduleCount } from "../src/ui/editors";
import { Banner, Btn, Card, Col, Field, Header, Muted, Row, Screen, Seg, T } from "../src/ui/kit";
import { radius, useTheme } from "../src/ui/theme";

type Step = "team" | "mods" | "days" | "principles" | "summary";

export default function Setup() {
  const s = useStore(); const tr = s.tr; const { t, tf } = tr; const router = useRouter(); const { c } = useTheme();
  const demo = useLocalSearchParams<{ demo: string }>().demo === "1";
  const [step, setStep] = useState(0);
  const [cls, setCls] = useState<ClassKey>("u19");
  const [depth, setDepth] = useState<Depth>("basis");
  const [mods, setMods] = useState<Modules>(modsFor("basis", "u19"));
  const [settings, setSettings] = useState<TeamSettings>(defaultSettings());
  const [principles, setPrinciples] = useState<Principles>(defaultPrinciples("u19"));
  const [club, setClub] = useState(""); const [team, setTeam] = useState("U19");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const kids = groupOf(cls) === "u11";
  // Prinzipien nur, wenn die Wochenplanung an ist; Demo ohne Prinzipien und Zusammenfassung
  const steps: Step[] = demo ? ["team", "mods", "days"] : ["team", "mods", "days", ...(mods.planung && !kids ? ["principles" as Step] : []), "summary"];
  const cur = steps[Math.min(step, steps.length - 1)], last = step >= steps.length - 1;
  const noDays = !Object.keys(settings.days).length;
  const cnt = moduleCount(mods, cls);

  const pickClass = (k: ClassKey) => {
    setCls(k); const g = groupOf(k); setPrinciples(defaultPrinciples(g));
    const d = g === "u11" && depth === "pro" ? "basis" : depth; setDepth(d); setMods(modsFor(d, k));
    const def = classDef(k); setTeam(def.team ? def.team[tr.lang] : k.toUpperCase());
  };
  const finish = async () => {
    setBusy(true); setMsg("");
    try {
      if (demo) { await s.startDemo(cls, depth, { modules: mods, settings }); router.replace("/"); return; }
      if (!club.trim()) { setStep(0); setMsg(t("au_fill")); return; }
      await s.createTeam({ club: club.trim(), name: team.trim() || cls.toUpperCase(), cls, depth, settings, principles, modules: mods, lang: tr.lang });
      s.toast(t("su_done")); router.replace("/");
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  const next = () => {
    if (cur === "days" && noDays) { setMsg(t("su_noDays")); return; }
    if (last) finish(); else { setStep(step + 1); setMsg(""); }
  };
  return (
    <Screen testID={"setup-" + step}>
      <Row gap={6}>{steps.map((_, i) => <View key={i} style={{ width: 26, height: 5, borderRadius: radius.pill, backgroundColor: i <= step ? c.accent : c.line }} />)}</Row>
      {cur === "team" ? <>
        <Header eyebrow={t("ob_hi")} title={t("ob_q1")} />
        <Muted>{t("ob_hi2")}</Muted>
        <ClassPicker value={cls} onChange={pickClass} tr={tr} />
        {!demo ? <Row wrap gap={10}>
          <Field testID="su-club" label={t("clubName")} value={club} onChangeText={setClub} style={{ flex: 1, minWidth: 200 }} />
          <Field testID="su-team" label={t("team")} value={team} onChangeText={setTeam} style={{ width: 160 }} />
        </Row> : null}
        <Row gap={10}><T v="eyebrow">{t("lang")}</T><Seg testID="su-lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} /></Row>
      </> : null}
      {cur === "mods" ? <>
        <Header eyebrow={classDef(cls).k.toUpperCase()} title={t("ob_q2")} />
        {kids ? <Banner>{t("kidsNote")}</Banner> : null}
        <Col gap={4}><T v="h3">{t("su_preset")}</T><Muted small>{t("su_presetHint")}</Muted></Col>
        <DepthPicker value={depth} onChange={d => { setDepth(d); setMods(modsFor(d, cls)); }} tr={tr} kids={kids} />
        <Row between wrap gap={8}>
          <Col gap={2}><T v="h3">{t("su_mods")}</T><Muted small>{tf("su_modsCount", { n: cnt.on, m: cnt.all })}</Muted></Col>
          <Row gap={6} wrap>
            <Btn small testID="su-all-on" label={t("su_allOn")} onPress={() => setMods(allModules(mods, cls, true))} />
            <Btn small testID="su-all-off" label={t("su_allOff")} onPress={() => setMods(allModules(mods, cls, false))} />
            <Btn small kind="ghost" testID="su-reset" label={t("su_reset")} onPress={() => setMods(modsFor(depth, cls))} />
          </Row>
        </Row>
        <Card testID="su-mods"><ModuleList value={mods} onChange={setMods} tr={tr} cls={cls} /></Card>
        <Muted small>{t("su_modsLater")}</Muted>
      </> : null}
      {cur === "days" ? <><Header title={t("su_daysT")} /><Muted>{t("su_daysB")}</Muted><Card testID="su-days"><DaysEditor value={settings} onChange={x => { setSettings(x); setMsg(""); }} tr={tr} /></Card></> : null}
      {cur === "principles" ? <><Header title={t("ob_q4")} /><Muted>{t("ob_q4b")}</Muted>
        <Card><PrinciplesEditor value={principles} onChange={setPrinciples} tr={tr} cls={cls} depth={depth} kinds={[]} /></Card></> : null}
      {cur === "summary" ? <><Header title={t("ob_q5")} /><Card><SetupSummary tr={tr} cls={cls} depth={depth} settings={settings} /></Card></> : null}
      {msg ? <Banner color={c.warn}>{msg}</Banner> : null}
      <Row between>
        <Btn testID="su-back" label={t("ob_back")} onPress={() => step === 0 ? router.back() : setStep(step - 1)} />
        <Btn testID="su-next" kind="primary" disabled={busy} label={last ? (demo ? t("su_demoGo") : t("su_create")) : t("ob_next")} onPress={next} />
      </Row>
    </Screen>
  );
}
