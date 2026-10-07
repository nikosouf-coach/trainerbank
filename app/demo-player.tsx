// Demo: Auswahl, als welcher Spieler die Spieler-App angesehen wird.
import { Redirect, useRouter } from "expo-router";
import React from "react";
import { useStore } from "../src/data/store";
import { Avatar, Btn, Header, ListItem, Screen } from "../src/ui/kit";

export default function DemoPlayer() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  if (!s.D || !s.isDemo) return <Redirect href="/" />;
  const list = s.D.players.filter(p => p.active !== false);
  return (
    <Screen testID="demo-player">
      <Header eyebrow="Demo" title={t("demo_pick")} onBack={() => { s.setDemoView("coach"); router.replace("/coach/heute"); }} backLabel={t("demo_coach")} />
      {list.map(p => (
        <ListItem key={p.id} testID={"pick-" + p.id} title={`${p.vn} ${p.nn}`} sub={`${p.pos}${p.nr ? " · #" + p.nr : ""}`}
          left={<Avatar id={p.id} first={p.vn} last={p.nn} size={36} />}
          onPress={() => { s.setDemoView("player", p.id); router.replace("/player/heute"); }} />
      ))}
      <Btn kind="ghost" label={t("ko_demoLeave")} onPress={() => { s.leaveDemo(); router.replace("/"); }} />
    </Screen>
  );
}
