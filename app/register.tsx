import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useStore } from "../src/data/store";
import { Banner, Btn, Check, Col, Field, Header, Muted, Screen } from "../src/ui/kit";

export default function Register() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [privacy, setPrivacy] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [done, setDone] = useState(false);
  const go = async () => {
    if (!name.trim() || !email || !pw) { setMsg(t("au_fill")); return; }
    if (pw.length < 8) { setMsg(t("au_pwRule")); return; }
    if (pw !== pw2) { setMsg(t("au_pwMismatch")); return; }
    if (!privacy) { setMsg(t("cs_need")); return; }
    setBusy(true); setMsg("");
    try {
      const r = await s.signUp(email, pw, name.trim());
      if (r.needsConfirmation) setDone(true);
      else { await s.giveConsent("privacy"); await s.boot(); router.replace("/"); }
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  if (done) return <Screen><Header title={t("w_register")} /><Banner>{t("au_confirm")}</Banner><Btn kind="primary" label={t("w_login")} onPress={() => router.replace("/login")} style={{ maxWidth: 420 }} /></Screen>;
  return (
    <Screen testID="register">
      <Header title={t("w_register")} onBack={() => router.back()} backLabel={t("btn_back")} />
      <Col gap={12} style={{ maxWidth: 420 }}>
        <Field testID="reg-name" label={t("au_name")} value={name} onChangeText={setName} autoComplete="name" />
        <Field testID="reg-email" label={t("au_email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field testID="reg-pw" label={t("au_pw")} value={pw} onChangeText={setPw} secure hint={t("au_pwRule")} autoComplete="password-new" />
        <Field testID="reg-pw2" label={t("au_pw2")} value={pw2} onChangeText={setPw2} secure autoComplete="password-new" />
        <Check testID="reg-privacy" value={privacy} onChange={setPrivacy} label={t("au_privacy")} />
        <Btn kind="ghost" label={t("au_privacyLink")} onPress={() => router.push("/legal?doc=privacy")} style={{ alignSelf: "flex-start" }} />
        {msg ? <Muted>{msg}</Muted> : null}
        <Btn testID="reg-go" kind="primary" label={t("w_register")} onPress={go} disabled={busy} />
        <Btn kind="ghost" label={t("au_haveAcc")} onPress={() => router.replace("/login")} />
      </Col>
    </Screen>
  );
}
