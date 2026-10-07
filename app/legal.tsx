import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Linking } from "react-native";
import { useStore } from "../src/data/store";
import { Btn, Col, Header, Screen, T } from "../src/ui/kit";

const URLS: Record<string, string | undefined> = { privacy: process.env.EXPO_PUBLIC_PRIVACY_URL, imprint: process.env.EXPO_PUBLIC_IMPRINT_URL };

export default function Legal() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: string }>(); const d = doc === "imprint" ? "imprint" : "privacy";
  const url = URLS[d];
  return (
    <Screen testID="legal">
      <Header title={t(d === "privacy" ? "ko_privacy" : "ko_imprint")} onBack={() => router.back()} backLabel={t("btn_back")} />
      <Col gap={12} style={{ maxWidth: 640 }}>
        <T>{t(d === "privacy" ? "lg_privacyFallback" : "lg_imprintFallback")}</T>
        {url ? <Btn kind="primary" label={t("lg_open")} onPress={() => Linking.openURL(url)} style={{ alignSelf: "flex-start" }} /> : null}
      </Col>
    </Screen>
  );
}
