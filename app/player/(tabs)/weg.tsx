// Spieler – Mein Weg: das individuelle Entwicklungsprogramm als Herzstück. Spielerkarte (Motto, X-Faktor,
// Saisonzahlen), Stärken-Runde (solange sie läuft), Perform („So mache ich den Unterschied“), Improve („Arbeite hart
// und clever an deinem Weg“), stärkster Bereich und Notenverlauf, „So sehen wir dich“ mit Selbstanalyse – dazu der Weg
// zu Zielen, Kompetenzprofil und Gesprächen. Ohne freigegebenes Programm: Karte, Selbstanalyse und Stärken-Runde.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { visibleProgram } from "../../../src/core/program";
import { useEngine, useStore } from "../../../src/data/store";
import { Header, Info, Muted, NavRow, Screen, Section } from "../../../src/ui/kit";
import { PeerRoundCard, PlayerCard, ProgramView, SelfSheet, ViewsCard } from "../../../src/ui/program";
import { useTheme } from "../../../src/ui/theme";

export default function MeinWeg() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [self, setSelf] = useState(false);
  const p = E.P(s.mePid || "");
  if (!p || !E.playerSees("dev")) return <Screen testID="player-weg-screen"><Header title={t("ep_mine")} /><Muted>{tf("bk_needs", { m: t("m_entwicklung") })}</Muted></Screen>;
  const prog = visibleProgram(E.D, p.id);
  const openSelf = () => setSelf(true);
  return (
    <Screen testID="player-weg-screen">
      <Header title={t("ep_mine")} info={<Info title={t("ep_title")} text={t("ep_infoP")} />} />
      {prog ? <ProgramView p={p} prog={prog} onSelf={openSelf} afterCard={<PeerRoundCard p={p} />} /> : <>
        <PlayerCard p={p} prog={null} />
        <PeerRoundCard p={p} />
        <ViewsCard p={p} prog={null} forPlayer onSelf={openSelf} />
      </>}
      <Section>
        <NavRow testID="weg-more" icon="target" iconColor={c.low} title={t("ep_more")} sub={t("ep_moreSub")} onPress={() => router.push("/player/entwicklung")} />
      </Section>
      <SelfSheet p={p} visible={self} onClose={() => setSelf(false)} />
    </Screen>
  );
}
