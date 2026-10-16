// Trainer – Entwicklung eines Spielers: Kompetenzprofil (Trainer/Selbst), Ziele, Gespräche, Saisonrückblick.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable } from "react-native";
import { assessmentsOf, posGroupOf } from "../../../src/core/dev";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { AssessSheet, GoalList, ProfileView, ReviewView, TalkList } from "../../../src/ui/dev";
import { Banner, Btn, Card, CardTitle, Header, Info, Muted, Row, Screen, Seg } from "../../../src/ui/kit";
import type { Player } from "../../../src/core/types";

type Tab = "profil" | "ziele" | "gespraeche" | "rueckblick";

export default function EntwicklungSpieler() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const { id = "", tab: tab0 } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<Tab>((["profil", "ziele", "gespraeche", "rueckblick"] as Tab[]).includes(tab0 as Tab) ? tab0 as Tab : "profil");
  const [assess, setAssess] = useState<{ p: Player; by: "coach" | "self" } | null>(null);
  const [asked, setAsked] = useState(false);
  const p = E.P(id);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/entwicklung");
  if (!p) return <Screen testID="coach-dev"><Header title={t("dv_title")} onBack={back} backLabel={t("btn_back")} /><Muted>{t("err_not_found")}</Muted></Screen>;
  if (!E.mods.entwicklung) return <Screen testID="coach-dev"><Header title={t("dv_title")} onBack={back} backLabel={t("btn_back")} /><Muted>{tf("bk_needs", { m: t("m_entwicklung") })}</Muted></Screen>;
  const pg = posGroupOf(E.D, p, E.grp), self = assessmentsOf(E.D, p.id, "self")[0];
  const openIq = E.D.indiv.filter(r => r.pid === p.id && r.status === "open").length;
  const askSelf = () => {
    s.saveMessage(p.id, { id: tmpId(), date: E.TODAY, typ: "info", text: t("dv_selfAskMsg"), bis: null });
    setAsked(true); s.toast(t("dv_selfAsked"));
  };
  return (
    <Screen testID="coach-dev">
      <Header eyebrow={`${t("dv_title")} · ${t("pgr_" + pg)}`} title={E.name(p)} onBack={back} backLabel={t("btn_back")} info={<Info title={t("dv_title")} text={t("dv_info")} />} />
      {openIq ? <Pressable testID="dev-iq" accessibilityRole="button" onPress={() => router.push("/coach/individual")}><Banner>{`${t("iq_open")}: ${openIq} · ${t("iq_answer")} ›`}</Banner></Pressable> : null}
      <Seg testID="dev-tab" value={tab} onChange={setTab} wrap options={[
        { key: "profil", label: t("dv_profile") }, { key: "ziele", label: t("dv_goals") }, { key: "gespraeche", label: t("dv_talks") }, { key: "rueckblick", label: t("dv_review") },
      ]} />
      {tab === "profil" ? <Card testID="dev-profile-card">
        <CardTitle title={t("dv_profile")} info={<Info title={t("dv_profile")} text={t("dv_profileInfo")} />} />
        <Row wrap gap={8}>
          <Btn small kind="primary" testID="dev-assess" icon="eintragen" label={t("dv_assessNew")} onPress={() => setAssess({ p, by: "coach" })} />
          {s.can("messages") && p.userId ? <Btn small testID="dev-askself" label={asked ? t("dv_selfAsked") : t("dv_selfAsk")} disabled={asked} onPress={askSelf} /> : null}
        </Row>
        {self ? <Muted small>{tf("dv_selfLast", { d: E.de(self.date) })}</Muted> : <Muted small>{t("dv_selfNone")}</Muted>}
        <ProfileView p={p} />
      </Card> : null}
      {tab === "ziele" ? <Card testID="dev-goals-card">
        <CardTitle title={t("dv_goals")} info={<Info title={t("dv_goals")} text={t("dv_goalsInfo")} />} />
        <GoalList p={p} />
      </Card> : null}
      {tab === "gespraeche" ? <Card testID="dev-talks-card">
        <CardTitle title={t("dv_talks")} info={<Info title={t("dv_talks")} text={t("dv_talksInfo")} />} />
        <TalkList p={p} />
      </Card> : null}
      {tab === "rueckblick" ? <Card testID="dev-review-card">
        <CardTitle title={t("dv_review")} info={<Info title={t("dv_review")} text={t("dv_reviewInfo")} />} />
        <ReviewView p={p} />
      </Card> : null}
      <AssessSheet target={assess} onClose={() => setAssess(null)} />
    </Screen>
  );
}
