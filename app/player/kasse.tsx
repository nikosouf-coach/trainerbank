// Spieler-App – Kasse: eigene offene Beträge und Verlauf; der Kassenwart verwaltet hier zusätzlich die Kasse.
import { useRouter } from "expo-router";
import React from "react";
import { kasseOf } from "../../src/core/kasse";
import { useEngine, useStore } from "../../src/data/store";
import { KasseBody, MyKasseCard } from "../../src/ui/kasse";
import { Header, Screen } from "../../src/ui/kit";

export default function PlayerKasse() {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  const k = kasseOf(E.team.settings, E.grp);
  const treasurer = !!k.treasurer && k.treasurer === s.mePid;
  return (
    <Screen testID="player-kasse">
      <Header onBack={() => router.canGoBack() ? router.back() : router.replace("/player/heute")} backLabel={t("btn_back")} title={t("ks_title")} />
      {s.mePid ? <MyKasseCard pid={s.mePid} /> : null}
      {treasurer ? <KasseBody /> : null}
    </Screen>
  );
}
