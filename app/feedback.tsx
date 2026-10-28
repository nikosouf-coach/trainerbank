// Feedback / Fehler melden (Trainer und Spieler): Art, Text, optional Bildschirmfoto. Seite, App-Version und Gerät gehen
// mit; die Rückmeldung landet bei den Betreibern der App (Seite „Rückmeldungen“).
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Image, Pressable } from "react-native";
import { FEEDBACK_KINDS, isOffline, type FeedbackKind } from "../src/data/api";
import { appInfo } from "../src/data/release";
import { lastPage } from "../src/data/trail";
import { useStore } from "../src/data/store";
import { Banner, Btn, Card, ChoiceChips, Col, Field, Header, Muted, Row, Screen, T } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

export default function Feedback() {
  const s = useStore(); const { t, tf } = s.tr; const router = useRouter(); const { c } = useTheme();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [text, setText] = useState(""); const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  // Seite und Gerät beim Öffnen festhalten (die Rückmeldung selbst zählt nicht als Seite)
  const page = useMemo(() => lastPage(), []);
  const info = useMemo(() => appInfo(), []);
  const back = () => router.canGoBack() ? router.back() : router.replace("/");
  const device = [info.device, info.os ? (info.platform === "ios" ? "iOS " : info.platform === "android" ? "Android " : "") + info.os : ""].filter(Boolean).join(", ") || info.platform;
  const pick = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      if (!r.canceled && r.assets?.length) setShot(r.assets[0].uri);
    } catch (e) { s.toast(s.errText(e)); }
  };
  const send = async () => {
    if (text.trim().length < 3) { setMsg(t("fb_need")); return; }
    setBusy(true); setMsg("");
    try { await s.sendFeedback(kind, text, shot, page); s.toast(t("fb_thanks")); back(); }
    catch (e) { setMsg(isOffline(e) ? t("fb_offline") : s.errText(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen testID="feedback" narrow>
      <Header title={t("fb_title")} onBack={back} backLabel={t("btn_back")} />
      <Muted>{t("fb_intro")}</Muted>
      {s.isDemo ? <Banner>{t("fb_demo")}</Banner> : null}
      <Col gap={8}>
        <T v="small" bold color={c.muted}>{t("fb_kindQ")}</T>
        <ChoiceChips testID="fb-kind" value={kind} onChange={setKind} options={FEEDBACK_KINDS.map(k => ({ key: k, label: t("fb_k_" + k) }))} />
      </Col>
      <Field testID="fb-text" label={t("fb_l_" + kind)} placeholder={t("fb_ph_" + kind)} value={text} onChangeText={setText} multiline maxLength={2000} />
      <Muted small>{t("fb_privacy")}</Muted>
      <Card testID="fb-shot">
        {shot ? <Row gap={12} align="flex-start">
          <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel={t("fb_shotChange")}>
            <Image source={{ uri: shot }} style={{ width: 72, height: 128, borderRadius: 8, backgroundColor: c.sunk }} resizeMode="cover" />
          </Pressable>
          <Col gap={8} style={{ flex: 1 }}>
            <Btn small testID="fb-shot-change" label={t("fb_shotChange")} onPress={pick} style={{ alignSelf: "flex-start" }} />
            <Btn small kind="ghost" testID="fb-shot-remove" label={t("fb_shotRemove")} onPress={() => setShot(null)} style={{ alignSelf: "flex-start" }} />
          </Col>
        </Row> : <Btn small testID="fb-shot-add" icon="camera" label={t("fb_shot")} onPress={pick} style={{ alignSelf: "flex-start" }} />}
        <Muted small>{t("fb_shotHint")}</Muted>
      </Card>
      <Col gap={4} testID="fb-meta">
        <T v="small" bold color={c.muted}>{t("fb_meta")}</T>
        <Muted small>{tf("fb_metaText", { p: page || "–", v: [info.version, info.build ? "(" + info.build + ")" : ""].filter(Boolean).join(" "), d: device })}</Muted>
        <Muted small>{t("fb_metaAccount")}</Muted>
      </Col>
      {msg ? <Banner color={c.warn}>{msg}</Banner> : null}
      <Btn testID="fb-send" kind="primary" icon="send" label={t("fb_send")} onPress={send} disabled={busy || !text.trim()} style={{ alignSelf: "flex-start" }} />
    </Screen>
  );
}
