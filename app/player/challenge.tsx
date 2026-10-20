// Spieler-App – Wochenchallenge: Challenges dieser Woche mit Eintragen, eigenem Fortschritt und Teamziel.
import { useRouter } from "expo-router";
import React from "react";
import { useEngine, useStore } from "../../src/data/store";
import { ChallengeCard } from "../../src/ui/challenge";
import { Header, Muted, Screen } from "../../src/ui/kit";

export default function PlayerChallenge() {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  return (
    <Screen testID="player-challenge-page">
      <Header onBack={() => router.canGoBack() ? router.back() : router.replace("/player/heute")} backLabel={t("btn_back")} title={t("cg_title")} />
      {s.mePid ? <ChallengeCard pid={s.mePid} /> : null}
      <Muted small>{t("cg_safety")}</Muted>
    </Screen>
  );
}
