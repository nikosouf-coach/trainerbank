// Untere Navigation der Trainer-App. "Planung" erscheint nur, wenn das Modul aktiv ist; "Chat" nur, wenn der Chat an ist (mit Zahl ungelesener Nachrichten);
// "Scouting" nur mit Modul Kaderplanung & Scouting und Recht „Scouting“.
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { chatSettings } from "../../../src/core/chat";
import { useStore } from "../../../src/data/store";
import { useChatBadge } from "../../../src/ui/chat";
import { Icon, type IconName } from "../../../src/ui/icons";
import { useTheme } from "../../../src/ui/theme";

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: "heute", icon: "heute", label: "nav_heute" },
  { name: "kalender", icon: "kalender", label: "nav_kalender" },
  { name: "plan", icon: "plan", label: "nav_plan" },
  { name: "kader", icon: "kader", label: "nav_kader" },
  { name: "scouting", icon: "scout", label: "nav_scout" },
  { name: "chat", icon: "chat", label: "nav_chat" },
  { name: "mehr", icon: "mehr", label: "nav_module" },
];

export default function CoachTabs() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const planOn = !!s.D?.team.modules.planung;
  const chatOn = !!s.D && s.D.team.modules.chat !== false && chatSettings(s.D.team).on;
  // Kaderplanung & Scouting: nur mit Modul und Recht „Scouting“
  const scoutOn = !!s.D?.team.modules.kaderplanung && s.can("scout");
  const unread = useChatBadge();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.accentTx, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line }, tabBarLabelStyle: { fontWeight: "700", fontSize: 11 } }}>
        {TABS.map(x => (
          <Tabs.Screen key={x.name} name={x.name} options={{
            title: t(x.label), tabBarButtonTestID: "tab-" + x.name,
            href: (x.name === "plan" && !planOn) || (x.name === "chat" && !chatOn) || (x.name === "scouting" && !scoutOn) ? null : undefined,
            tabBarBadge: x.name === "chat" && unread ? (unread > 99 ? "99+" : unread) : undefined, tabBarBadgeStyle: { backgroundColor: c.accent, color: c.accentInk },
            tabBarIcon: ({ color }) => <Icon name={x.icon} color={color} />,
          }} />
        ))}
      </Tabs>
    </View>
  );
}
