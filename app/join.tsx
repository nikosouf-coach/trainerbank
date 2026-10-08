// Spieler treten mit dem Team-Code bei: Code → Profil → Einwilligungen.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { teamLabel, POS } from "../src/core/classes";
import { ageOn } from "../src/core/dates";
import { useStore } from "../src/data/store";
import { Banner, Btn, Card, Check, ChoiceChips, Col, DateField, Field, Header, Info, Muted, NumField, Row, Screen, T } from "../src/ui/kit";

export default function Join() {
  const s = useStore(); const tr = s.tr; const { t } = tr; const router = useRouter();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(""); const [teamName, setTeamName] = useState("");
  const [vn, setVn] = useState(""); const [nn, setNn] = useState(""); const [geb, setGeb] = useState<string | null>(null);
  const [pos, setPos] = useState("ZM"); const [nr, setNr] = useState<number | null>(null); const [kg, setKg] = useState<number | null>(null);
  const [cPrivacy, setCPrivacy] = useState(false); const [cHealth, setCHealth] = useState(false); const [cParent, setCParent] = useState(false); const [parentMail, setParentMail] = useState(""); const [cAi, setCAi] = useState(false);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const under16 = geb ? ageOn(geb, new Date()) < 16 : false;
  const check = async () => {
    setBusy(true); setMsg("");
    try { const r = await s.api.teamByCode(code); if (!r) { setMsg(t("err_invalid_code")); return; } setTeamName(teamLabel(r)); setStep(1); }
    catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  const go = async () => {
    if (!cPrivacy || !cHealth || (under16 && (!cParent || !/^\S+@\S+\.\S+$/.test(parentMail)))) { setMsg(t("cs_need")); return; }
    setBusy(true); setMsg("");
    try {
      await s.giveConsent("privacy"); await s.giveConsent("health_data");
      if (under16) await s.giveConsent("parental", { parentEmail: parentMail.trim() });
      if (cAi) await s.giveConsent("ai");
      await s.joinTeam(code, { vn: vn.trim(), nn: nn.trim(), geb: geb!, pos, nr, kg });
      s.toast(t("jn_done")); router.replace("/");
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Screen testID={"join-" + step}>
      <Header eyebrow={teamName || t("po_hi")} title={step === 0 ? t("po_q1") : step === 1 ? t("jn_profile") : t("jn_consent")} onBack={() => step === 0 ? router.back() : setStep(step - 1)} backLabel={t("btn_back")} />
      {step === 0 ? <Col gap={12} style={{ maxWidth: 480 }}>
        <Muted>{t("po_q1b")}</Muted>
        <Field testID="jn-code" label={t("po_code")} value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABCD-EFGH" />
        <Btn testID="jn-check" kind="primary" label={t("jn_check")} onPress={check} disabled={busy || !code.trim()} />
      </Col> : null}
      {step === 1 ? <Col gap={12} style={{ maxWidth: 560 }}>
        <Muted>{t("po_q2b")}</Muted>
        <Row wrap gap={10}>
          <Field testID="jn-vn" label={t("po_vn")} value={vn} onChangeText={setVn} autoComplete="given-name" style={{ flex: 1, minWidth: 160 }} />
          <Field testID="jn-nn" label={t("po_nn")} value={nn} onChangeText={setNn} autoComplete="family-name" style={{ flex: 1, minWidth: 160 }} />
        </Row>
        <DateField testID="jn-geb" label={t("po_geb")} value={geb} onChange={setGeb} lang={tr.lang} style={{ maxWidth: 220 }} />
        <T bold>{t("po_pos")}</T>
        <ChoiceChips testID="jn-pos" value={pos} onChange={setPos} options={POS.map(p => ({ key: p, label: p }))} />
        <Row wrap gap={10}>
          <NumField testID="jn-nr" label={t("po_nr")} value={nr} onChange={setNr} min={0} max={99} step={1} style={{ width: 120 }} />
          <NumField testID="jn-kg" label={t("po_kg")} value={kg} onChange={setKg} min={20} max={150} style={{ width: 200 }} />
        </Row>
        <Muted small>{t("po_kgHint")}</Muted>
        {msg ? <Muted>{msg}</Muted> : null}
        <Btn testID="jn-next" kind="primary" label={t("ob_next")} onPress={() => { if (!vn.trim() || !nn.trim() || !geb) { setMsg(t("po_need")); return; } setMsg(""); setStep(2); }} />
      </Col> : null}
      {step === 2 ? <Col gap={12} style={{ maxWidth: 600 }}>
        <Banner>{t("po_privacy")}</Banner>
        <Card>
          <Check testID="jn-c-privacy" value={cPrivacy} onChange={setCPrivacy} label={t("cs_privacy_s")} />
          <Btn kind="ghost" small label={t("au_privacyLink")} onPress={() => router.push("/legal?doc=privacy")} style={{ alignSelf: "flex-start" }} />
        </Card>
        <Card>
          <Row gap={8}><T v="h3">{t("cs_health")}</T><Info title={t("cs_health")} text={t("cs_health_l")} /></Row>
          <Check testID="jn-c-health" value={cHealth} onChange={setCHealth} label={t("cs_health_s")} />
        </Card>
        {under16 ? <Card>
          <Row gap={8}><T v="h3">{t("cs_parent")}</T><Info title={t("cs_parent")} text={t("cs_parent_l")} /></Row>
          <Check testID="jn-c-parent" value={cParent} onChange={setCParent} label={t("cs_parent_s")} />
          <Field testID="jn-parentmail" label={t("cs_parentMail")} value={parentMail} onChangeText={setParentMail} keyboardType="email-address" autoCapitalize="none" />
        </Card> : null}
        <Card>
          <Row gap={8}><T v="h3">{t("cs_ai")}</T><Info title={t("cs_ai")} text={t("cs_ai_l")} /></Row>
          <Check testID="jn-c-ai" value={cAi} onChange={setCAi} label={t("cs_ai_s")} />
        </Card>
        {msg ? <Muted>{msg}</Muted> : null}
        <Btn testID="jn-go" kind="primary" label={t("jn_go")} onPress={go} disabled={busy} />
      </Col> : null}
    </Screen>
  );
}
