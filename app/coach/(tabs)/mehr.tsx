// Trainer – Mehr: Übersicht über Einstellungen (Verein, Training, Baukasten, Zugang) und Konto.
import { useRouter } from "expo-router";
import React from "react";
import { classDef, classLabel, teamLabel } from "../../../src/core/classes";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Banner, Btn, Card, Header, ListItem, Screen } from "../../../src/ui/kit";
import { useTheme } from "../../../src/ui/theme";

export default function Mehr() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const team = E.team, nDays = Object.keys(team.settings.days).length;
  const go = (h: string) => router.push(h);
  const chev = <Icon name="chevron" size={18} color={c.muted} />;
  return (
    <Screen testID="coach-mehr">
      <Header eyebrow={t("mo_sub")} title={t("mo_title")} />
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListItem testID="mehr-team" title={t("mh_team")} sub={`${teamLabel(team)} · ${classLabel(classDef(team.cls), E.tr.lang)} · ${t("dp_" + team.depth)}`} right={chev} onPress={() => go("/coach/team")} />
        <ListItem testID="mehr-training" title={t("mh_training")} sub={tf("mh_trainingSub", { n: nDays })} right={chev} onPress={() => go("/coach/training")} />
        <ListItem testID="mehr-aufgaben" title={t("tk_title2")} sub={t("tk_menuSub")} right={chev} onPress={() => go("/coach/aufgaben")} />
        {s.can("cash") ? <ListItem testID="mehr-kasse" title={t("ks_title")} sub={t("ks_menuSub")} right={chev} onPress={() => go("/coach/kasse")} /> : null}
        {s.can("admin") ? <ListItem testID="mehr-baukasten" title={t("bk_title")} sub={t("bk_sub")} right={chev} onPress={() => go("/coach/baukasten")} /> : null}
        {E.mods.kontakte ? <ListItem testID="mehr-kontakte" title={t("ct_title")} sub={t("ct_sub")} right={chev} onPress={() => go("/coach/kontakte")} /> : null}
        {E.mods.vorbereitung ? <ListItem testID="mehr-vorbereitung" title={t("vb_title")} sub={t("vb_sub")} right={chev} onPress={() => go("/coach/vorbereitung")} /> : null}
        {E.mods.archiv ? <ListItem testID="mehr-archiv" title={t("ar_title")} sub={t("ar_sub")} right={chev} onPress={() => go("/coach/archiv")} /> : null}
        {E.mods.leistung ? <ListItem testID="mehr-leistung" title={t("lt_title")} sub={t("lt_sub")} right={chev} onPress={() => go("/coach/leistung")} /> : null}
        {E.mods.spielanalyse ? <ListItem testID="mehr-spiele" title={t("sp_list")} sub={t("sp_listSub")} right={chev} onPress={() => go("/coach/spiele")} /> : null}
        {E.mods.videos ? <ListItem testID="mehr-videos" title={t("sp_lib")} sub={t("sp_libSub")} right={chev} onPress={() => go("/coach/videos")} /> : null}
        <ListItem testID="mehr-wiki" title={t("wk_menu")} sub={t("wk_menuSub")} right={chev} onPress={() => go("/wiki")} />
        <ListItem testID="mehr-zugang" title={t("mh_access")} sub={t("cd_title") + " · " + t("st_title2")} right={chev} onPress={() => go("/coach/zugang")} />
        <ListItem testID="mehr-konto" title={t("mh_account")} sub={[s.myStaff?.name, s.isDemo ? t("w_demoHint") : s.user?.email].filter(Boolean).join(" · ")} right={chev} onPress={() => go("/konto")} />
      </Card>
      {s.isDemo ? <Banner>{t("pa_demoNote")}</Banner> : null}
      {s.isDemo ? <Btn testID="mehr-to-player" label={t("toPlayer")} onPress={() => { s.setDemoView("player"); router.replace(s.demoPlayer ? "/player/heute" : "/demo-player"); }} style={{ alignSelf: "flex-start" }} /> : null}
    </Screen>
  );
}
