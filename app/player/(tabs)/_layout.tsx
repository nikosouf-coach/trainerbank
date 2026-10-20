// Untere Navigation der Spieler-App. "Chat" nur, wenn der Chat an ist (mit Zahl ungelesener Nachrichten).
// Kalender, Chat, Daten und Tipps kann jeder Spieler ein- und ausblenden (Startseite anpassen) – ausgeblendete bleiben
// über „Ich“ erreichbar. Standard: Tipps ausgeblendet.
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { chatSettings } from "../../../src/core/chat";
import { useStore } from "../../../src/data/store";
import { useChatBadge } from "../../../src/ui/chat";
import { playerHidden } from "../../../src/ui/dashboard";
import { Icon, type IconName } from "../../../src/ui/icons";
import { useTheme } from "../../../src/ui/theme";

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: "heute", icon: "heute", label: "nav_heute" },
  { name: "eintragen", icon: "eintragen", label: "pn_eintragen" },
  { name: "kalender", icon: "kalender", label: "pn_kalender" },
  { name: "chat", icon: "chat", label: "nav_chat" },
  { name: "daten", icon: "daten", label: "pn_daten" },
  { name: "tipps", icon: "tipps", label: "pn_tipps" },
  { name: "ich", icon: "ich", label: "pn_ich" },
];

export default function PlayerTabs() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const chatOn = !!s.D && s.D.team.modules.chat !== false && chatSettings(s.D.team).on;
  const unread = useChatBadge();
  const hide = playerHidden(s.prefs);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Tabs screenOptions={{ headerShown: false, freezeOnBlur: true, tabBarActiveTintColor: c.accentTx, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }, tabBarLabelStyle: { fontWeight: "600", fontSize: 10.5, letterSpacing: -0.1 } }}>
        {TABS.map(x => (
          <Tabs.Screen key={x.name} name={x.name} options={{
            title: t(x.label), tabBarButtonTestID: "tab-" + x.name, tabBarIcon: ({ color, focused }) => <Icon name={x.icon} color={color} strokeWidth={focused ? 2.2 : 1.8} />,
            href: (x.name === "chat" && !chatOn) || hide.includes(x.name) ? null : undefined,
            tabBarBadge: x.name === "chat" && unread ? (unread > 99 ? "99+" : unread) : undefined, tabBarBadgeStyle: { backgroundColor: c.crit, color: "#fff", fontSize: 11, fontWeight: "700" },
          }} />
        ))}
      </Tabs>
    </View>
  );
}
