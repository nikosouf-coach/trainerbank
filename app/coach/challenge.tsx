// Trainer – Wochenchallenge: Vorschläge je Altersgruppe, eigene Challenges, Teilnahme und Teamziel.
import { useRouter } from "expo-router";
import React from "react";
import { useEngine } from "../../src/data/store";
import { ChallengeAdmin } from "../../src/ui/challenge";
import { Header, Info, Muted, Screen } from "../../src/ui/kit";

export default function ChallengeScreen() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/mehr");
  return (
    <Screen testID="coach-challenge">
      <Header title={t("cg_title")} onBack={back} backLabel={t("mo_title")} info={<Info title={t("cg_title")} text={[t("cg_info"), t("cg_safety")]} />} />
      {E.mods.challenge ? <ChallengeAdmin /> : <Muted>{E.tf("bk_needs", { m: t("m_challenge") })}</Muted>}
    </Screen>
  );
}
