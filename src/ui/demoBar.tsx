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
  return (
    <View testID="demo-bar" style={{ backgroundColor: withAlpha(c.warn, 0.14), borderBottomWidth: 1, borderBottomColor: withAlpha(c.warn, 0.4), paddingHorizontal: space.l, paddingVertical: 6 }}>
      <Row between wrap gap={8}>
        <Row gap={8}>
          <T v="eyebrow" color={c.ink}>Demo</T>
          <Seg testID="demo-view" value={s.viewAs || "coach"} onChange={v => {
            if (v === "player") { s.setDemoView("player"); router.replace(s.demoPlayer ? "/player/heute" : "/demo-player"); }
            else { s.setDemoView("coach"); router.replace("/coach/heute"); }
          }} options={[{ key: "coach", label: t("demo_coach") }, { key: "player", label: t("demo_player") }]} />
        </Row>
        <Btn testID="demo-leave" small kind="ghost" label={t("ko_demoLeave")} onPress={() => { s.leaveDemo(); router.replace("/"); }} />
      </Row>
    </View>
  );
}
