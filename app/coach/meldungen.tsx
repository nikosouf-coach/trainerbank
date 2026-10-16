// Trainer – gemeldete Chat-Nachrichten (Recht „Nachrichten“).
import { useRouter } from "expo-router";
import React from "react";
import { useStore } from "../../src/data/store";
import { ReportsScreen } from "../../src/ui/chat";
import { Header, Muted, Screen } from "../../src/ui/kit";

export default function Meldungen() {
  const s = useStore(); const router = useRouter(); const { t, tf } = s.tr;
  if (!s.chatMod) return (
    <Screen testID="chat-reports-screen">
      <Header title={t("ch_reports")} onBack={() => router.back()} backLabel={t("btn_back")} />
      <Muted>{tf("pm_denied", { p: t("pm_messages") })}</Muted>
    </Screen>
  );
  return <ReportsScreen />;
}
