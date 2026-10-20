// Startseite ohne Anmeldung: Marke, Anmelden/Registrieren, Demo.
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { hasSupabase } from "../src/data/supabase";
import { useStore } from "../src/data/store";
import { LogoMark, Wordmark } from "../src/ui/brand";
import { Banner, Btn, Col, Muted, Row, Screen, Seg } from "../src/ui/kit";

export default function Welcome() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  return (
    <Screen testID="welcome">
      <Row between>
        <LogoMark size={34} />
        <Seg testID="lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} />
      </Row>
      <Col gap={12} style={{ marginTop: 40, maxWidth: 460 }}>
        <Wordmark size={40} mark={false} />
        <Muted style={{ fontSize: 17, lineHeight: 24 }}>{t("app_tag")}</Muted>
      </Col>
      <Col gap={10} style={{ marginTop: 24, maxWidth: 420 }}>
        {hasSupabase ? <>
          <Btn testID="go-login" kind="primary" label={t("w_login")} onPress={() => router.push("/login")} />
          <Btn testID="go-register" label={t("w_register")} onPress={() => router.push("/register")} />
        </> : <Banner>{t("w_noServer")}</Banner>}
        <Btn testID="go-demo" kind={hasSupabase ? "ghost" : "primary"} label={t("w_demo")} onPress={() => router.push("/setup?demo=1")} />
        <Muted small>{t("w_demoHint")}</Muted>
      </Col>
      <View style={{ height: 8 }} />
    </Screen>
  );
}
