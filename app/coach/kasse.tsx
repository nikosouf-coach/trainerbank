// Trainer – Mannschaftskasse: Kassenstand, offene Beträge je Spieler, Kassenbuch, Beiträge, Einstellungen.
import { useRouter } from "expo-router";
import React from "react";
import { useEngine, useStore } from "../../src/data/store";
import { KasseBody } from "../../src/ui/kasse";
import { Banner, Header, Info, Screen } from "../../src/ui/kit";

export default function Kasse() {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  return (
    <Screen testID="coach-kasse">
      <Header onBack={() => router.canGoBack() ? router.back() : router.replace("/coach/mehr")} backLabel={t("mo_title")} title={t("ks_title")}
        info={<Info title={t("ks_title")} text={t("ks_info")} />} />
      {s.can("cash") ? <KasseBody /> : <Banner>{s.tr.tf("pm_denied", { p: t("pm_cash") })}</Banner>}
    </Screen>
  );
}
