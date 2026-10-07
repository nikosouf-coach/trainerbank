import { useRouter } from "expo-router";
import React from "react";
import { useStore } from "../src/data/store";
import { Banner, Btn, Col, Header, Screen } from "../src/ui/kit";

export default function Pending() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  return (
    <Screen testID="pending">
      <Header eyebrow={s.active ? `${s.active.club} · ${s.active.name}` : ""} title={t("pe_title")} />
      <Col gap={12} style={{ maxWidth: 480 }}>
        <Banner>{t("pe_text")}</Banner>
        <Btn kind="primary" label={t("pe_reload")} onPress={async () => { await s.reload(); router.replace("/"); }} />
        <Btn label={t("st_title")} onPress={() => router.push("/start")} />
        <Btn kind="ghost" label={t("au_logout")} onPress={async () => { await s.signOut(); router.replace("/"); }} />
      </Col>
    </Screen>
  );
}
