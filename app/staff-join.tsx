import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useStore } from "../src/data/store";
import { Btn, Check, Col, Field, Header, Muted, Screen } from "../src/ui/kit";

export default function StaffJoin() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const [code, setCode] = useState(""); const [conf, setConf] = useState(false); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!conf) { setMsg(t("cs_need")); return; }
    setBusy(true); setMsg("");
    try { await s.giveConsent("staff_confidentiality"); await s.joinStaff(code); router.replace("/"); } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Screen testID="staff-join">
      <Header title={t("sj_title")} onBack={() => router.back()} backLabel={t("btn_back")} />
      <Col gap={12} style={{ maxWidth: 480 }}>
        <Field testID="sj-code" label={t("sj_code")} value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABCD-EFGH" />
        <Check testID="sj-conf" value={conf} onChange={setConf} label={t("sj_conf")} />
        {msg ? <Muted>{msg}</Muted> : null}
        <Btn testID="sj-go" kind="primary" label={t("sj_go")} onPress={go} disabled={busy || !code.trim()} />
      </Col>
    </Screen>
  );
}
