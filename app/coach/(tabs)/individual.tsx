// Trainer – Anfragen für Individualtraining: zusagen (Einheit nur für den Spieler) oder absagen.
import React from "react";
import { useEngine } from "../../../src/data/store";
import { IndivInbox } from "../../../src/ui/indivReq";
import { Header, Info, Muted, Screen } from "../../../src/ui/kit";
import { useNavBack } from "../../../src/ui/nav";

export default function Individual() {
  const nb = useNavBack("individual");
  const E = useEngine(); const { t } = E;
  return (
    <Screen testID="coach-individual">
      <Header title={t("iq_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("iq_title")} text={t("iq_info")} />} />
      {E.mods.entwicklung ? <IndivInbox /> : <Muted>{E.tf("bk_needs", { m: t("m_entwicklung") })}</Muted>}
    </Screen>
  );
}
