// Spieler – „Dein Körper heute“ (Detailseite von „Heute“): Zustand mit Grund, was jetzt hilft (Erholung, Schlaf),
// Nachricht des Trainers und „Hintergrund & Quellen“ aus dem Wiki.
import { useRouter } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { useEngine, useStore } from "../../src/data/store";
import { Ring } from "../../src/ui/charts";
import { WikiBackground, useIx } from "../../src/ui/insight";
import { Col, Group, Header, Msg, NavRow, Row, Screen, T, Tips } from "../../src/ui/kit";
import { msgColor } from "../../src/ui/squad/ProfileCards";
import { useTheme } from "../../src/ui/theme";

export default function Koerper() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter(); const ix = useIx();
  const p = E.P(s.mePid || "");
  const back = () => router.canGoBack() ? router.back() : router.replace("/player/heute");
  if (!p) return <Screen narrow testID="player-koerper"><Header onBack={back} backLabel={t("nav_heute")} title={t("ph_body")} /></Screen>;
  const st = E.playerState(p), pr = E.profile(p.id), msgs = E.activeMsgs(p.id);
  const stCol = st.k === "ready" ? c.ok : st.k === "easy" ? c.warn : c.crit;
  const tips = E.playerSees("tips");
  const reg = tips ? E.tipRegen(p, pr) : null, sl = tips && E.mods.belastung ? E.tipSleep(pr) : null;
  return (
    <Screen narrow testID="player-koerper">
      <Header onBack={back} backLabel={t("nav_heute")} title={t("ph_body")} />
      <Group pad testID="pk-state">
        <Row gap={16}>
          <Ring pct={st.k === "ready" ? 100 : st.k === "easy" ? 60 : 20} color={stCol} size={64} />
          <Col gap={3} style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: "800", color: stCol, letterSpacing: -0.5 }}>{t("ph_" + st.k)}</Text>
            <T>{t("ph_" + st.k + "_t")}</T>
          </Col>
        </Row>
        {st.why ? <T v="small" color={c.muted} testID="pk-why">{t("pk_why")}: {st.why}</T> : null}
      </Group>
      {msgs.map(m => <Msg key={m.id} eyebrow={`${E.coachName() ? E.tf("ph_coachN", { n: E.coachName() }) : t("ph_coach")} · ${t("ry_" + m.typ)}${m.bis ? " · " + t("until") + " " + E.de(m.bis) : ""}`} text={m.text} color={msgColor(c, m.typ)} />)}
      {reg ? <Tips title={t("pk_helps")} testID="pk-regen" items={[reg.head, ...reg.items].filter(Boolean)} /> : null}
      {sl ? <Tips title={t("pt_sleep")} testID="pk-sleep" items={[sl.head, ...sl.items].filter(Boolean)} /> : null}
      {tips ? <Group><NavRow testID="pk-tips" icon="tipps" title={t("pk_moreTips")} sub={t("pk_moreTipsSub")} onPress={() => router.push("/player/tipps")} /></Group> : null}
      <WikiBackground keys={["recovery", "hooper", "sleep"]} testID="pk-bg" title={ix.bg} />
    </Screen>
  );
}
