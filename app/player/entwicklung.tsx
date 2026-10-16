// Spieler – Meine Entwicklung: Ziele mit Fortschritt, Selbsteinschätzung (und freigegebene Sicht des Trainerteams),
// Gespräche, Saison bisher und Individualtraining anfragen.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { assessmentsOf } from "../../src/core/dev";
import { useEngine, useStore } from "../../src/data/store";
import { AssessSheet, GoalList, ProfileView, ReviewView, TalkList } from "../../src/ui/dev";
import { IndivRequestCard } from "../../src/ui/indivReq";
import { Btn, Card, CardTitle, Header, Info, Muted, Screen } from "../../src/ui/kit";
import type { Player } from "../../src/core/types";

export default function MeineEntwicklung() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const [assess, setAssess] = useState<{ p: Player; by: "coach" | "self" } | null>(null);
  const p = E.P(s.mePid || "");
  const back = () => router.canGoBack() ? router.back() : router.replace("/player/ich");
  if (!p || !E.playerSees("dev")) return <Screen testID="player-dev"><Header title={t("dv_mine")} onBack={back} backLabel={t("pn_ich")} /><Muted>{t("err_not_found")}</Muted></Screen>;
  const self = assessmentsOf(E.D, p.id, "self")[0];
  return (
    <Screen testID="player-dev">
      <Header title={t("dv_mine")} onBack={back} backLabel={t("pn_ich")} />
      <Card testID="pdev-goals">
        <CardTitle title={t("dv_myGoals")} info={<Info title={t("dv_goals")} text={t("dv_goalsInfo")} />} />
        <GoalList p={p} forPlayer />
      </Card>
      <Card testID="pdev-profile">
        <CardTitle title={t("dv_profile")} info={<Info title={t("dv_selfTitle")} text={t("dv_selfInfo")} />} />
        <Btn testID="pdev-self" kind="primary" icon="eintragen" label={t("dv_selfTitle")} onPress={() => setAssess({ p, by: "self" })} style={{ alignSelf: "flex-start" }} />
        {self ? <Muted small>{tf("dv_selfLast", { d: E.de(self.date) })}</Muted> : null}
        <ProfileView p={p} forPlayer />
      </Card>
      <Card testID="pdev-talks">
        <CardTitle title={t("dv_myTalks")} />
        <TalkList p={p} forPlayer />
      </Card>
      <Card testID="pdev-review">
        <CardTitle title={t("dv_reviewSoFar")} info={<Info title={t("dv_review")} text={t("dv_reviewInfo")} />} />
        <ReviewView p={p} forPlayer />
      </Card>
      <IndivRequestCard pid={p.id} />
      <AssessSheet target={assess} onClose={() => setAssess(null)} />
    </Screen>
  );
}
