// Trainer – Mannschaftskasse: Kassenstand, offene Beträge je Spieler, Kassenbuch, Beiträge, Einstellungen.
import React from "react";
import { useEngine, useStore } from "../../../src/data/store";
import { KasseBody } from "../../../src/ui/kasse";
import { Banner, Header, Info, Screen } from "../../../src/ui/kit";
import { useNavBack } from "../../../src/ui/nav";

export default function Kasse() {
  const nb = useNavBack("kasse");
  const s = useStore(); const E = useEngine(); const { t } = E;
  return (
    <Screen testID="coach-kasse">
      <Header onBack={nb.onBack} backLabel={nb.backLabel} title={t("ks_title")}
        info={<Info title={t("ks_title")} text={t("ks_info")} />} />
      {s.can("cash") ? <KasseBody /> : <Banner>{s.tr.tf("pm_denied", { p: t("pm_cash") })}</Banner>}
    </Screen>
  );
}
