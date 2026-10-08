// Leiste im Demo-Modus: zwischen Trainer- und Spieleransicht wechseln oder die Demo beenden.
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useStore } from "../data/store";
import { Btn, Row, Seg, T } from "./kit";
import { space, useTheme, withAlpha } from "./theme";

export function DemoBar() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme(); const router = useRouter();
  if (!s.isDemo) return null;
  // Co-Trainer-Ansicht: erster Co-Trainer aus dem Trainerteam (zeigt, was ein Co-Trainer in seiner App sieht)
  const co = s.D?.staff.find(x => x.role === "co") || s.D?.staff.find(x => x.role !== "chef" && x.id !== "s1") || null;
  return (
    <View testID="demo-bar" style={{ backgroundColor: withAlpha(c.warn, 0.14), borderBottomWidth: 1, borderBottomColor: withAlpha(c.warn, 0.4), paddingHorizontal: space.l, paddingVertical: 6 }}>
      <Row between wrap gap={8}>
        <Row gap={8}>
          <T v="eyebrow" color={c.ink}>Demo</T>
          <Seg testID="demo-view" value={s.viewAs === "player" ? "player" : s.demoStaff ? "co" : "coach"} onChange={v => {
            if (v === "player") { s.setDemoView("player"); router.replace(s.demoPlayer ? "/player/heute" : "/demo-player"); }
            else if (v === "co") { s.setDemoView("coach", null, co?.id || null); router.replace("/coach/heute"); }
            else { s.setDemoView("coach", null, null); router.replace("/coach/heute"); }
          }} options={[{ key: "coach", label: t("demo_coach") }, ...(co ? [{ key: "co", label: t("demo_co") }] : []), { key: "player", label: t("demo_player") }]} />
        </Row>
        <Row gap={8}>
          {/* Offline ausprobieren: Einträge landen in der Warteschlange und werden beim Wiedereinschalten gesendet */}
          <Seg testID="demo-net" value={s.offline ? "off" : "on"} onChange={v => s.setDemoOffline(v === "off")}
            options={[{ key: "on", label: `📶 ${t("demo_netOn")}` }, { key: "off", label: `📵 ${t("demo_netOff")}` }]} />
          <Btn testID="demo-leave" small kind="ghost" label={t("ko_demoLeave")} onPress={() => { s.leaveDemo(); router.replace("/"); }} />
        </Row>
      </Row>
    </View>
  );
}
