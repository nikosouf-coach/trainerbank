import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useStore } from "../src/data/store";
import { Btn, Col, Field, Header, Muted, Screen } from "../src/ui/kit";

export default function Login() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const go = async () => {
    if (!email || !pw) { setMsg(t("au_fill")); return; }
    setBusy(true); setMsg("");
    try { await s.signIn(email, pw); router.replace("/"); } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Screen testID="login">
      <Header title={t("w_login")} onBack={() => router.back()} backLabel={t("btn_back")} />
      <Col gap={12} style={{ maxWidth: 420 }}>
        <Field testID="login-email" label={t("au_email")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field testID="login-pw" label={t("au_pw")} value={pw} onChangeText={setPw} secure autoComplete="password" />
        {msg ? <Muted>{msg}</Muted> : null}
        <Btn testID="login-go" kind="primary" label={t("w_login")} onPress={go} disabled={busy} />
        <Btn kind="ghost" label={t("au_forgot")} onPress={async () => { if (!email) { setMsg(t("au_email")); return; } try { await s.resetPassword(email); setMsg(t("au_resetSent")); } catch (e) { setMsg(s.errText(e)); } }} />
        <Btn kind="ghost" label={t("au_noAcc")} onPress={() => router.replace("/register")} />
      </Col>
    </Screen>
  );
}
