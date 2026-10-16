// Trainer – Anfragen für Individualtraining: zusagen (Einheit nur für den Spieler) oder absagen.
import { useRouter } from "expo-router";
import React from "react";
import { useEngine } from "../../src/data/store";
import { IndivInbox } from "../../src/ui/indivReq";
import { Header, Info, Muted, Screen } from "../../src/ui/kit";

export default function Individual() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/mehr");
  return (
    <Screen testID="coach-individual">
      <Header title={t("iq_title")} onBack={back} backLabel={t("mo_title")} info={<Info title={t("iq_title")} text={t("iq_info")} />} />
      {E.mods.entwicklung ? <IndivInbox /> : <Muted>{E.tf("bk_needs", { m: t("m_entwicklung") })}</Muted>}
    </Screen>
  );
}
