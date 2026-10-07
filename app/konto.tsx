// Konto & Datenschutz (für Trainer und Spieler): Sprache, Teams, Einwilligungen, Erinnerungen, Export, Löschen.
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform } from "react-native";
import type { ConsentKind } from "../src/data/api";
import { shareTextFile } from "../src/data/files";
import { enablePush, type PushStatus } from "../src/data/push";
import { useStore } from "../src/data/store";
import { Banner, Btn, Card, CardTitle, Col, Divider, Header, Info, ListItem, Muted, Row, Screen, Seg, Sheet, StatusChip, T } from "../src/ui/kit";

export default function Konto() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const [ask, setAsk] = useState<null | "delete" | ConsentKind>(null);
  const [busy, setBusy] = useState(false);
  const [push, setPush] = useState<PushStatus | null>(null);
  const isPlayer = s.viewAs === "player";
  const back = () => router.canGoBack() ? router.back() : router.replace("/");

  const consentRow = (k: ConsentKind, title: string, short: string, long: string) => {
    const on = !!s.consents?.[k];
    return (
      <Col key={k} gap={6} testID={"consent-" + k}>
        <Row between gap={8}>
          <Row gap={6} style={{ flexShrink: 1 }}><T bold style={{ flexShrink: 1 }}>{title}</T><Info title={title} text={long} /></Row>
          <StatusChip status={on ? "ok" : "none"} label={t(on ? "cs_active" : "cs_inactive")} />
        </Row>
        <Muted small>{short}</Muted>
        <Btn small testID={"consent-" + k + "-btn"} label={t(on ? "cs_withdraw" : "cs_give")} disabled={busy || s.isDemo}
          onPress={() => on ? setAsk(k) : run(() => s.giveConsent(k))} style={{ alignSelf: "flex-start" }} />
        <Divider />
      </Col>
    );
  };
  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) s.toast(ok); } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  }
  const doExport = () => run(async () => {
    const data = await s.exportMyData();
    await shareTextFile(`trainerbank-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
  }, t("ko_exportDone"));
  const doPush = () => run(async () => setPush(await enablePush((tok, pf) => s.api.registerPushToken(tok, pf), true)));

  return (
    <Screen testID="konto">
      <Header title={t("ko_title")} onBack={back} backLabel={t("btn_back")} />

      <Card>
        <CardTitle title={t("ko_account")} />
        <Muted>{s.isDemo ? t("w_demoHint") : t("ko_signedIn").replace("{e}", s.user?.email || "")}</Muted>
        <Row gap={10}><T v="eyebrow">{t("ko_lang")}</T>
          <Seg testID="ko-lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} />
        </Row>
        {s.isDemo
          ? <Btn testID="ko-demo-leave" label={t("ko_demoLeave")} onPress={() => { s.leaveDemo(); router.replace("/"); }} style={{ alignSelf: "flex-start" }} />
          : <Btn testID="ko-logout" label={t("au_logout")} onPress={async () => { await s.signOut(); router.replace("/"); }} style={{ alignSelf: "flex-start" }} />}
      </Card>

      {!s.isDemo ? <Card>
        <CardTitle title={t("ko_teams")} />
        {s.memberships.map(m => (
          <ListItem key={m.teamId + m.role} title={`${m.club} · ${m.name}`} sub={m.role === "pending" ? t("pe_title") : m.role === "player" ? t("demo_player") : t("demo_coach")}
            right={m.teamId === s.active?.teamId ? <StatusChip status="ok" label="✓" /> : <Btn small label={t("st_switch")} onPress={async () => { await s.selectTeam(m); router.replace("/"); }} />} />
        ))}
        <Btn small kind="ghost" icon="plus" label={t("st_title")} onPress={() => router.push("/start")} style={{ alignSelf: "flex-start" }} />
      </Card> : null}

      <Card testID="ko-consents">
        <CardTitle title={t("cs_title")} />
        {isPlayer ? <>
          {consentRow("health_data", t("cs_health"), t("cs_health_s"), t("cs_health_l"))}
          {consentRow("ai", t("cs_ai"), t("cs_ai_s"), t("cs_ai_l"))}
          {s.D?.team.modules.befunde ? consentRow("findings", t("cs_findings"), t("cs_findings_s"), t("cs_findings_l")) : null}
        </> : consentRow("staff_confidentiality", t("sj_title"), t("sj_conf"), t("sj_conf"))}
        <ListItem title={t("cs_privacy")} sub={t("cs_privacy_s")} right={<StatusChip status={s.consents?.privacy ? "ok" : "none"} label={t(s.consents?.privacy ? "cs_active" : "cs_inactive")} />} />
      </Card>

      {isPlayer ? <Card>
        <CardTitle title={t("ko_push")} />
        {Platform.OS === "web" ? <Muted>{t("ko_pushWeb")}</Muted> : <>
          {push === "granted" ? <Banner>{t("ko_pushOk")}</Banner> : push === "denied" ? <Banner>{t("ko_pushNo")}</Banner> : null}
          {push !== "granted" ? <Btn testID="ko-push" label={t("ko_pushOn")} disabled={busy || s.isDemo} onPress={doPush} style={{ alignSelf: "flex-start" }} /> : null}
        </>}
      </Card> : null}

      <Card>
        <CardTitle title={t("ko_legal")} />
        <Row wrap gap={8}>
          <Btn small label={t("ko_privacy")} onPress={() => router.push("/legal?doc=privacy")} />
          <Btn small label={t("ko_imprint")} onPress={() => router.push("/legal?doc=imprint")} />
        </Row>
        <Col gap={8}>
          <Btn testID="ko-export" label={t("ko_export")} disabled={busy || s.isDemo} onPress={doExport} style={{ alignSelf: "flex-start" }} />
          <Btn testID="ko-delete" kind="danger" label={t("ko_delete")} disabled={busy || s.isDemo} onPress={() => setAsk("delete")} style={{ alignSelf: "flex-start" }} />
        </Col>
        <Muted small>{t("ko_version")} {Constants.expoConfig?.version || "1.0.0"}</Muted>
      </Card>

      <Sheet visible={ask === "delete"} onClose={() => setAsk(null)} title={t("ko_deleteQ")} testID="ko-delete-sheet">
        <T>{t("ko_deleteText")}</T>
        <Row gap={10}>
          <Btn label={t("no")} onPress={() => setAsk(null)} />
          <Btn testID="ko-delete-confirm" kind="danger" label={t("ko_delete")} disabled={busy}
            onPress={() => run(async () => { await s.deleteAccount(); setAsk(null); router.replace("/"); }, t("ko_deleted"))} />
        </Row>
      </Sheet>
      <Sheet visible={!!ask && ask !== "delete"} onClose={() => setAsk(null)} title={t("cs_withdrawQ")} testID="ko-withdraw-sheet">
        {ask === "health_data" ? <T>{t("cs_withdrawHealth")}</T> : null}
        <Row gap={10}>
          <Btn label={t("no")} onPress={() => setAsk(null)} />
          <Btn testID="ko-withdraw-confirm" kind="danger" label={t("cs_withdraw")} disabled={busy}
            onPress={() => { const k = ask as ConsentKind; setAsk(null); run(() => s.withdrawConsent(k)); }} />
        </Row>
      </Sheet>
    </Screen>
  );
}
