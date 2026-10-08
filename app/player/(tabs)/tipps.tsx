// Spieler – Tipps: Regeneration, Krafttraining, Zusatzbelastung, Ernährung & Trinken, Schlaf, KI-Coach.
import { useRouter } from "expo-router";
import React from "react";
import { useEngine, useStore } from "../../../src/data/store";
import { AiPanel } from "../../../src/ui/ai";
import { Icon, type IconName } from "../../../src/ui/icons";
import { Banner, Btn, Bullets, Card, Col, Header, Info, Msg, Muted, Row, Screen, T } from "../../../src/ui/kit";
import { msgColor } from "../../../src/ui/squad/ProfileCards";
import { useTheme, withAlpha } from "../../../src/ui/theme";
import { View } from "react-native";

function TipCard({ icon, color, title, head, items, info, children, testID }: { icon: IconName; color: string; title: string; head?: string; items?: string[]; info?: string; children?: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  return (
    <Card testID={testID}>
      <Row gap={10}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: withAlpha(color, 0.15), alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={20} color={color} strokeWidth={2.2} /></View>
        <T v="h2" style={{ flex: 1 }}>{title}</T>
        {info ? <Info title={title} text={info} /> : null}
      </Row>
      {head ? <T style={{ fontWeight: "700", color: c.ink }}>{head}</T> : null}
      {items && items.length ? <Bullets items={items} /> : null}
      {children}
    </Card>
  );
}

export default function Tipps() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(s.mePid || "")!, pr = E.profile(p.id);
  const msgs = E.activeMsgs(p.id);
  if (!E.playerSees("tips") && !E.playerSees("ai")) return <Screen testID="player-tipps"><Header title={t("pn_tipps")} /><Banner>{t("pl_tipsOff")}</Banner></Screen>;
  const reg = E.tipRegen(p, pr), gym = E.tipGym(p, pr), ex = E.tipExtra(p, pr), food = E.tipFood(p), sl = E.tipSleep(pr);
  return (
    <Screen testID="player-tipps">
      <Header title={t("pn_tipps")} />
      {msgs.map(m => <Msg key={m.id} eyebrow={`${E.coachName() ? E.tf("ph_coachN", { n: E.coachName() }) : t("ph_coach")} · ${t("ry_" + m.typ)}${m.bis ? " · " + t("until") + " " + E.de(m.bis) : ""}`} text={m.text} color={msgColor(c, m.typ)} />)}
      {E.playerSees("tips") ? <>
        <TipCard testID="tip-regen" icon="moon" color="#16a3a3" title={t("pt_regen")} head={reg.head} items={reg.items} info={t("rt_note")} />
        <TipCard testID="tip-gym" icon="bolt" color="#f0762b" title={t("pt_gym")} head={gym.head} info={gym.source}>
          {gym.best ? <Muted small>{gym.best}</Muted> : null}
          {gym.program.length ? <Bullets items={gym.program} /> : null}
          {gym.note ? <Muted small>{gym.note}</Muted> : null}
        </TipCard>
        {ex ? <TipCard testID="tip-extra" icon="plus" color="#7b5fd0" title={t("pt_extra")} head={ex.head} info={ex.source}>
          {ex.budget ? <T>{ex.budget}</T> : null}
          {ex.done ? <Muted small>{ex.done}</Muted> : null}
          <Muted small>{t("px_note")}</Muted>
        </TipCard> : null}
        <TipCard testID="tip-food" icon="star" color="#2f9e44" title={t("pt_food")} head={food.head} items={food.items} info={food.source} />
        <TipCard testID="tip-sleep" icon="moon" color="#3a6db5" title={t("pt_sleep")} head={sl.head} items={sl.items} info={sl.source} />
      </> : null}
      {E.playerSees("ai") ? (s.consents?.ai
        ? <AiPanel mode="player" testID="pai" context={() => E.playerAiContext(p)} quick={["pt_ki_q1", "pt_ki_q2", "pt_ki_q3"]} placeholder={t("pt_kiPh")} />
        : <Card><Row gap={8}><Icon name="spark" color={c.accentTx} /><T v="h2">{t("pt_ki")}</T></Row><Muted>{t("pl_aiConsent")}</Muted><Btn small label={t("pl_account")} onPress={() => router.push("/konto")} style={{ alignSelf: "flex-start" }} /></Card>) : null}
      <Col />
    </Screen>
  );
}
