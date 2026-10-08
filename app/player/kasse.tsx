// Spieler-App – Kasse verwalten (nur Kassenwart): Übersicht und Kassenbuch.
import { useRouter } from "expo-router";
import React from "react";
import { kasseOf } from "../../src/core/kasse";
import { useEngine, useStore } from "../../src/data/store";
import { KasseBody } from "../../src/ui/kasse";
import { Banner, Header, Screen } from "../../src/ui/kit";

export default function PlayerKasse() {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  const k = kasseOf(E.team.settings, E.grp);
  const ok = !!k.treasurer && k.treasurer === s.mePid;
  return (
    <Screen testID="player-kasse">
      <Header onBack={() => router.canGoBack() ? router.back() : router.replace("/player/ich")} backLabel={t("pn_ich")} title={t("ks_title")} />
      {ok ? <KasseBody /> : <Banner>{t("ks_notTreasurer")}</Banner>}
    </Screen>
  );
}
