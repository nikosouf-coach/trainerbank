// Einrichtung eines neuen Teams – oder Start der Demo.
// Die Fragen richten sich nach Stufe und Modulen:
//   Über dich · Dein Team · Funktionen (Stufe = Vorauswahl, Module einzeln, Info-Buttons) · Trainingswoche ·
//   Spieler & Trainerteam · [Erinnerungen – mit Belastung] · [Trainingsprinzipien – mit Wochenplanung] ·
//   [Sportwissenschaft – nur „Volle Tiefe“] · Zusammenfassung
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { classDef, defaultPrinciples, defaultSettings, groupOf, modsFor } from "../src/core/classes";
import type { ClassKey, Depth, Modules, Principles, StaffRoleKey, TeamSettings } from "../src/core/types";
import { useStore } from "../src/data/store";
import { ClassPicker, DaysEditor, DepthPicker, ModuleList, PrinciplesEditor, allModules, moduleCount } from "../src/ui/editors";
import { Banner, Btn, Card, CardTitle, Col, Field, Header, Muted, Row, Screen, Seg, T, ToggleRow } from "../src/ui/kit";
import {
  ColorPicker, ImageSlot, PlayerViewFields, ProfileFields, ReminderFields, SetupOverview, StaffQuickAdd, TestPicker, emptyProfile, profileName, type ProfileDraft,
} from "../src/ui/setupParts";
import { radius, useTheme } from "../src/ui/theme";

type Step = "me" | "team" | "mods" | "days" | "orga" | "load" | "principles" | "science" | "summary";

export default function Setup() {
  const s = useStore(); const tr = s.tr; const { t, tf } = tr; const router = useRouter(); const { c } = useTheme();
  const demo = useLocalSearchParams<{ demo: string }>().demo === "1";
  const [step, setStep] = useState(0);
  const [me, setMe] = useState<ProfileDraft>(emptyProfile());
  const [cls, setCls] = useState<ClassKey>("u19");
  const [depth, setDepth] = useState<Depth>("basis");
  const [mods, setMods] = useState<Modules>(modsFor("basis", "u19"));
  const [settings, setSettings] = useState<TeamSettings>(defaultSettings());
  const [principles, setPrinciples] = useState<Principles>(defaultPrinciples("u19"));
  const [club, setClub] = useState(""); const [team, setTeam] = useState("U19");
  const [logo, setLogo] = useState<string | null>(null); const [accent, setAccent] = useState("#0b3d91");
  const [info, setInfo] = useState(true);
  const [staff, setStaff] = useState<{ name: string; role: StaffRoleKey }[]>([]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const kids = groupOf(cls) === "u11";

  // Welche Fragen? – abhängig von Stufe und Modulen
  const steps: Step[] = ["me", "team", "mods", "days", "orga",
    ...(mods.belastung ? ["load" as Step] : []),
    ...(mods.planung && !kids && depth !== "org" ? ["principles" as Step] : []),
    ...(depth === "pro" ? ["science" as Step] : []),
    "summary"];
  const idx = Math.min(step, steps.length - 1), cur = steps[idx], last = idx >= steps.length - 1;
  const cnt = moduleCount(mods, cls);

  const pickClass = (k: ClassKey) => {
    setCls(k); const g = groupOf(k); setPrinciples(defaultPrinciples(g));
    const d = g === "u11" && depth === "pro" ? "basis" : depth; setDepth(d); setMods(modsFor(d, k));
    const def = classDef(k); setTeam(def.team ? def.team[tr.lang] : k.toUpperCase());
    setSettings(x => ({ ...x, tests: undefined }));
  };
  const check = (st: Step): string => {
    if (st === "me" && !demo && (!me.vn.trim() || !me.nn.trim())) return t("su_needName");
    if (st === "team" && !demo && !club.trim()) return t("su_needClub");
    if (st === "days" && !Object.keys(settings.days).length) return t("su_noDays");
    return "";
  };
  const finish = async () => {
    for (let i = 0; i < steps.length; i++) { const m = check(steps[i]); if (m) { setStep(i); setMsg(m); return; } }
    setBusy(true); setMsg("");
    const meProfile = { name: profileName(me), role: me.role, license: me.license === "none" ? "" : me.license, birth: me.birth, phone: me.phone.trim(), photo: me.photo };
    try {
      if (demo) {
        await s.startDemo(cls, depth, { modules: mods, settings, principles, club, team, accent, logo, me: meProfile.name ? meProfile : { ...meProfile, name: "" }, staff, prefs: { info } });
        router.replace("/"); return;
      }
      await s.createTeam({ club: club.trim(), name: team.trim() || cls.toUpperCase(), cls, depth, settings, principles, modules: mods, lang: tr.lang,
        me: meProfile, staff, logoUri: logo, prefs: { info } });
      s.toast(t("su_done")); router.replace("/");
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  const next = () => {
    const m = check(cur); if (m) { setMsg(m); return; }
    if (last) finish(); else { setStep(idx + 1); setMsg(""); }
  };

  return (
    <Screen testID={"setup-" + cur}>
      <Row gap={6} wrap>{steps.map((st, i) => <View key={st} style={{ width: 26, height: 5, borderRadius: radius.pill, backgroundColor: i <= idx ? c.accent : c.line }} />)}</Row>
      {demo && idx === 0 ? <Banner>{t("su_demoNote")}</Banner> : null}

      {cur === "me" ? <>
        <Header eyebrow={t("ob_hi")} title={t("su_s_me")} />
        <Muted>{t("su_s_meB")}</Muted>
        <Card testID="su-me"><ProfileFields value={me} onChange={setMe} tr={tr} required={!demo} /></Card>
        <Row gap={10}><T v="eyebrow">{t("lang")}</T><Seg testID="su-lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} /></Row>
      </> : null}

      {cur === "team" ? <>
        <Header eyebrow={profileName(me) || undefined} title={t("su_s_team")} />
        <Muted>{t("su_s_teamB")}</Muted>
        <T v="h3">{t("ob_q1")}</T>
        <ClassPicker value={cls} onChange={pickClass} tr={tr} />
        <Card testID="su-team-card">
          <Row gap={14} align="flex-start" wrap>
            <ImageSlot testID="su-logo" uri={logo} label={t("su_logo")} onPick={setLogo} onClear={() => setLogo(null)} round={false} />
            <Col gap={10} style={{ flex: 1, minWidth: 200 }}>
              <Field testID="su-club" label={t("clubName") + (demo ? "" : " *")} value={club} onChangeText={setClub} maxLength={100} />
              <Field testID="su-team" label={t("team")} value={team} onChangeText={setTeam} maxLength={100} />
            </Col>
          </Row>
          <T v="small" bold color={c.muted}>{t("su_color")}</T>
          <ColorPicker value={accent} onChange={setAccent} />
        </Card>
      </> : null}

      {cur === "mods" ? <>
        <Header eyebrow={classDef(cls).k.toUpperCase()} title={t("su_s_mods")} />
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
        <Card><ToggleRow testID="su-info" label={t("su_infoT")} desc={t("su_infoD")} value={info} onChange={setInfo} /></Card>
        <Muted small>{t("su_modsLater")}</Muted>
      </> : null}

      {cur === "days" ? <>
        <Header title={t("su_daysT")} /><Muted>{t("su_daysB")}</Muted>
        <Card testID="su-days"><DaysEditor value={settings} onChange={x => { setSettings(x); setMsg(""); }} tr={tr} /></Card>
      </> : null}

      {cur === "orga" ? <>
        <Header title={t("su_s_orga")} /><Muted>{t("su_s_orgaB")}</Muted>
        <Card testID="su-pv"><CardTitle title={t("su_pvT")} /><PlayerViewFields settings={settings} modules={mods} onChange={setSettings} tr={tr} /></Card>
        <Card testID="su-staff"><CardTitle title={t("su_staffT")} /><Muted small>{t("su_staffD")}</Muted><StaffQuickAdd value={staff} onChange={setStaff} tr={tr} /></Card>
      </> : null}

      {cur === "load" ? <>
        <Header title={t("su_s_load")} /><Muted>{t("su_s_loadB")}</Muted>
        <Card testID="su-load"><ReminderFields value={settings.reminders || {}} onChange={r => setSettings({ ...settings, reminders: r })} tr={tr} load={!!mods.belastung} prep={!!mods.vorbereitung} /></Card>
      </> : null}

      {cur === "principles" ? <>
        <Header title={t("ob_q4")} /><Muted>{t("ob_q4b")}</Muted>
        <Card><PrinciplesEditor value={principles} onChange={setPrinciples} tr={tr} cls={cls} depth={depth} kinds={[]} /></Card>
      </> : null}

      {cur === "science" ? <>
        <Header title={t("su_s_science")} /><Muted>{t("su_s_scienceB")}</Muted>
        <Card testID="su-science"><ToggleRow testID="su-fix" label={t("fixDur")} desc={t("su_fixD")} value={settings.fix} onChange={v => setSettings({ ...settings, fix: v })} /></Card>
        {mods.leistung ? <Card testID="su-tests"><CardTitle title={t("su_testsT")} /><Muted small>{t("su_testsD")}</Muted>
          <TestPicker value={settings.tests} onChange={v => setSettings({ ...settings, tests: v })} grp={groupOf(cls)} tr={tr} /></Card> : null}
      </> : null}

      {cur === "summary" ? <>
        <Header title={t("su_s_sum")} />
        <Card testID="su-summary"><SetupOverview tr={tr} me={me} club={club} team={team} cls={cls} depth={depth} modules={mods} settings={settings} info={info} /></Card>
      </> : null}

      {msg ? <Banner color={c.warn} testID="su-msg">{msg}</Banner> : null}
      <Row between>
        <Btn testID="su-back" label={t("ob_back")} onPress={() => idx === 0 ? router.back() : (setStep(idx - 1), setMsg(""))} />
        <Btn testID="su-next" kind="primary" disabled={busy} label={last ? (demo ? t("su_demoGo") : t("su_create")) : t("ob_next")} onPress={next} />
      </Row>
    </Screen>
  );
}
