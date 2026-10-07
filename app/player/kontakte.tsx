// Spieler – Kontakte: vom Trainer freigegebene Ansprechpartner mit Anruf und E-Mail.
import { useRouter } from "expo-router";
import React from "react";
import { useEngine } from "../../src/data/store";
import { ContactGroups, EmergencyNote } from "../../src/ui/contacts";
import { Card, Header, Muted, Screen } from "../../src/ui/kit";

export default function SpielerKontakte() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const on = E.mods.kontakte && E.playerSees("contacts");
  const L = on ? E.D.contacts.filter(x => x.vis) : [];
  return (
    <Screen testID="player-kontakte">
      <Header title={t("ct_title")} onBack={() => router.canGoBack() ? router.back() : router.replace("/player/ich")} backLabel={t("btn_back")} />
      {!on ? <Card><Muted>{t("ct_off")}</Muted></Card> : L.length ? <ContactGroups list={L} /> : <Card><Muted>{t("ct_playerNone")}</Muted></Card>}
      <EmergencyNote />
    </Screen>
  );
}
