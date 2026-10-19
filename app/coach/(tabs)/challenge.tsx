// Trainer – Wochenchallenge: Vorschläge je Altersgruppe, eigene Challenges, Teilnahme und Teamziel.
import React from "react";
import { useEngine } from "../../../src/data/store";
import { ChallengeAdmin } from "../../../src/ui/challenge";
import { Header, Info, Muted, Screen } from "../../../src/ui/kit";
import { useNavBack } from "../../../src/ui/nav";

export default function ChallengeScreen() {
  const nb = useNavBack("challenge");
  const E = useEngine(); const { t } = E;
  return (
    <Screen testID="coach-challenge">
      <Header title={t("cg_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("cg_title")} text={[t("cg_info"), t("cg_safety")]} />} />
      {E.mods.challenge ? <ChallengeAdmin /> : <Muted>{E.tf("bk_needs", { m: t("m_challenge") })}</Muted>}
    </Screen>
  );
}
