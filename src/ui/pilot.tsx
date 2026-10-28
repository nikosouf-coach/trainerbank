// Testphase und Betrieb: Frage nach Absturzberichten (Startseite), Schalter und Version mit Update-Suche (Konto).
import React, { useMemo, useState } from "react";
import { Platform } from "react-native";
import { crashAvailable } from "../data/crash";
import { appInfo, applyUpdate, checkForUpdate, updatesOn } from "../data/release";
import { useStore } from "../data/store";
import { Btn, Card, CardTitle, Col, Muted, Row, ToggleRow } from "./kit";

/** Datum und Uhrzeit kurz (28.10.2026, 14:30) */
export const fmtStamp = (isoStr: string, lang: "de" | "en"): string => {
  const d = new Date(isoStr); if (isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Startseite: einmal fragen, ob Absturzberichte gesendet werden dürfen (nur in der App mit eingerichtetem Sentry) */
export function CrashAsk() {
  const s = useStore(); const { t } = s.tr;
  if (!crashAvailable || s.isDemo || s.crashPref !== null) return null;
  return (
    <Card testID="crash-ask">
      <CardTitle title={t("cr_askTitle")} />
      <Muted>{t("cr_askText")}</Muted>
      <Row gap={8} wrap>
        <Btn small kind="primary" testID="crash-yes" label={t("cr_yes")} onPress={() => { s.setCrashPref(true); s.toast(t("cr_on")); }} />
        <Btn small kind="ghost" testID="crash-no" label={t("cr_no")} onPress={() => s.setCrashPref(false)} />
      </Row>
    </Card>
  );
}

/** Konto: Absturzberichte ein/aus (Browser: Hinweis, dass es sie nur in der App gibt) */
export function CrashCard() {
  const s = useStore(); const { t } = s.tr;
  if (Platform.OS !== "web" && !crashAvailable) return null;
  return (
    <Card testID="ko-crash">
      {Platform.OS === "web" ? <>
        <CardTitle title={t("cr_toggle")} />
        <Muted>{t("cr_webOnly")}</Muted>
        <Muted small>{t("cr_desc")}</Muted>
      </> : <ToggleRow testID="ko-crash-toggle" label={t("cr_toggle")} desc={t("cr_desc")} value={s.crashPref === "on"} onChange={v => { s.setCrashPref(v); if (v) s.toast(t("cr_on")); }} />}
    </Card>
  );
}

/** Konto: Version (mit Build und geladenem Update) und Suche nach Updates */
export function VersionRow() {
  const s = useStore(); const { t, tf } = s.tr;
  const a = useMemo(() => appInfo(), []);
  const [st, setSt] = useState<"idle" | "checking" | "none" | "ready">("idle");
  const label = [`${t("ko_version")} ${a.version}`, a.build ? tf("up_build", { b: a.build }) : "", a.updateAt ? tf("up_update", { d: fmtStamp(a.updateAt, s.tr.lang) }) : ""].filter(Boolean).join(" · ");
  const check = async () => {
    setSt("checking");
    try { setSt(await checkForUpdate()); } catch (e) { setSt("idle"); s.toast(s.errText(e)); }
  };
  return (
    <Col gap={6}>
      <Muted small testID="ko-version">{label}</Muted>
      {updatesOn ? (st === "ready"
        ? <Row gap={8} wrap><Muted small>{t("up_ready")}</Muted><Btn small kind="primary" testID="ko-update-restart" label={t("up_restart")} onPress={() => { applyUpdate().catch(e => s.toast(s.errText(e))); }} /></Row>
        : <Row gap={8} wrap>
          <Btn small testID="ko-update-check" label={st === "checking" ? t("up_checking") : t("up_check")} disabled={st === "checking"} onPress={check} />
          {st === "none" ? <Muted small>{t("up_none")}</Muted> : null}
        </Row>) : null}
    </Col>
  );
}
