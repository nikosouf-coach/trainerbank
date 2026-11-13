// Rechtliches in der App: Impressum direkt (ohne Netz, § 5 DDG: unmittelbar erreichbar), Datenschutz kurz mit Link zur
// vollständigen Erklärung auf der Website. Angaben aus src/data/site.json (dieselbe Quelle wie die Website).
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Linking } from "react-native";
import { CONTACT_EMAIL, LEGAL_URLS, PUBLISHER } from "../src/data/site";
import { useStore } from "../src/data/store";
import { Btn, Col, Header, Muted, Screen, T } from "../src/ui/kit";

export default function Legal() {
  const s = useStore(); const { t, tf } = s.tr; const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: string }>(); const d = doc === "imprint" ? "imprint" : "privacy";
  const url = LEGAL_URLS[d];
  const address = [PUBLISHER.name, PUBLISHER.business, PUBLISHER.street, `${PUBLISHER.postcode} ${PUBLISHER.city}`,
    s.tr.lang === "en" ? PUBLISHER.countryEn : PUBLISHER.country].filter(Boolean).join("\n");
  return (
    <Screen testID="legal">
      <Header title={t(d === "privacy" ? "ko_privacy" : "ko_imprint")} onBack={() => router.back()} backLabel={t("btn_back")} />
      <Col gap={12} style={{ maxWidth: 640 }}>
        {d === "imprint" ? (
          <Col gap={8} testID="legal-imprint">
            <Muted small>{t("lg_imprintBasis")}</Muted>
            <T selectable>{address}</T>
            <T selectable>{tf("lg_email", { e: CONTACT_EMAIL })}{PUBLISHER.phone ? "\n" + tf("lg_phone", { p: PUBLISHER.phone }) : ""}</T>
          </Col>
        ) : <T testID="legal-privacy">{t("lg_privacyFallback")}</T>}
        <Btn kind="primary" label={t("lg_open")} onPress={() => { Linking.openURL(url).catch(() => undefined); }} style={{ alignSelf: "flex-start" }} />
        {d === "privacy" ? <Muted small>{tf("lg_contact", { e: CONTACT_EMAIL })}</Muted> : null}
      </Col>
    </Screen>
  );
}
