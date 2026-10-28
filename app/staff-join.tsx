// Trainerteam bzw. Funktionäre treten mit dem Trainer- oder Vereinscode bei. Aus einem Einladungslink
// (trainerbank://staff-join?code=…) ist der Code vorausgefüllt; ohne Anmeldung wird die Einladung gemerkt.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { cleanCode } from "../src/data/invite";
import { useStore } from "../src/data/store";
import { Splash } from "../src/ui/guard";
import { Btn, Check, Col, Field, Header, Muted, Screen } from "../src/ui/kit";

export default function StaffJoin() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const [code, setCode] = useState(""); const [conf, setConf] = useState(false); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const params = useLocalSearchParams<{ code?: string }>();
  const linkCode = cleanCode(params.code) || (s.pendingInvite?.kind === "staff" ? s.pendingInvite.code : null);
  const auto = useRef(false);
  useEffect(() => {
    if (!linkCode || auto.current || s.phase === "loading") return;
    auto.current = true;
    if (s.phase === "signedOut") { s.rememberInvite({ kind: "staff", code: linkCode }); router.replace("/welcome"); return; }
    setCode(linkCode);
  }, [linkCode, s.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async () => {
    if (!conf) { setMsg(t("cs_need")); return; }
    setBusy(true); setMsg("");
    try {
      await s.giveConsent("staff_confidentiality");
      const kind = await s.joinStaff(code);
      s.rememberInvite(null);
      // Vereins-Code: Anfrage beim Vereinsadmin (Start bzw. Verein zeigt den Stand)
      if (kind === "club") s.toast(t("sj_clubSent"));
      router.replace("/");
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  if (s.phase === "loading") return <Splash />;
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
