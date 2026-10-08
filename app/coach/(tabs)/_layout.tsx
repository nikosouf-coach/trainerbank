// Untere Navigation der Trainer-App. "Planung" erscheint nur, wenn das Modul aktiv ist.
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useStore } from "../../../src/data/store";
import { Icon, type IconName } from "../../../src/ui/icons";
import { useTheme } from "../../../src/ui/theme";

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: "heute", icon: "heute", label: "nav_heute" },
  { name: "kalender", icon: "kalender", label: "nav_kalender" },
  { name: "plan", icon: "plan", label: "nav_plan" },
  { name: "kader", icon: "kader", label: "nav_kader" },
  { name: "mehr", icon: "mehr", label: "nav_module" },
];

export default function CoachTabs() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const planOn = !!s.D?.team.modules.planung;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.accentTx, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line }, tabBarLabelStyle: { fontWeight: "700", fontSize: 11 } }}>
        {TABS.map(x => (
          <Tabs.Screen key={x.name} name={x.name} options={{
            title: t(x.label), tabBarButtonTestID: "tab-" + x.name,
            href: x.name === "plan" && !planOn ? null : undefined,
            tabBarIcon: ({ color }) => <Icon name={x.icon} color={color} />,
          }} />
        ))}
      </Tabs>
    </View>
  );
}
