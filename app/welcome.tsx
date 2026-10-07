import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { hasSupabase } from "../src/data/supabase";
import { useStore } from "../src/data/store";
import { Banner, Btn, Col, Muted, Screen, Seg, T } from "../src/ui/kit";
import { radius, useTheme } from "../src/ui/theme";

export default function Welcome() {
  const s = useStore(); const { t } = s.tr; const router = useRouter(); const { c } = useTheme();
  return (
    <Screen testID="welcome">
      <View style={{ alignItems: "flex-end" }}>
        <Seg testID="lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} />
      </View>
      <Col gap={14} style={{ marginTop: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: radius.l, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
          <T v="h1" color={c.accentInk}>TB</T>
        </View>
        <T v="h1">{t("app_name")}</T>
        <Muted>{t("app_tag")}</Muted>
      </Col>
      <Col gap={10} style={{ marginTop: 18, maxWidth: 420 }}>
        {hasSupabase ? <>
          <Btn testID="go-login" kind="primary" label={t("w_login")} onPress={() => router.push("/login")} />
          <Btn testID="go-register" label={t("w_register")} onPress={() => router.push("/register")} />
        </> : <Banner>{t("w_noServer")}</Banner>}
        <Btn testID="go-demo" kind={hasSupabase ? "ghost" : "primary"} label={t("w_demo")} onPress={() => router.push("/setup?demo=1")} />
        <Muted small>{t("w_demoHint")}</Muted>
      </Col>
    </Screen>
  );
}
