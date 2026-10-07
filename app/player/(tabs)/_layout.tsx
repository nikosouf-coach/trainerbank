// Untere Navigation der Spieler-App.
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useStore } from "../../../src/data/store";
import { DemoBar } from "../../../src/ui/demoBar";
import { Icon, type IconName } from "../../../src/ui/icons";
import { useTheme } from "../../../src/ui/theme";

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: "heute", icon: "heute", label: "nav_heute" },
  { name: "eintragen", icon: "eintragen", label: "pn_eintragen" },
  { name: "daten", icon: "daten", label: "pn_daten" },
  { name: "tipps", icon: "tipps", label: "pn_tipps" },
  { name: "ich", icon: "ich", label: "pn_ich" },
];

export default function PlayerTabs() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <DemoBar />
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.accentTx, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line }, tabBarLabelStyle: { fontWeight: "700", fontSize: 11 } }}>
        {TABS.map(x => (
          <Tabs.Screen key={x.name} name={x.name} options={{ title: t(x.label), tabBarButtonTestID: "tab-" + x.name, tabBarIcon: ({ color }) => <Icon name={x.icon} color={color} /> }} />
        ))}
      </Tabs>
    </View>
  );
}
