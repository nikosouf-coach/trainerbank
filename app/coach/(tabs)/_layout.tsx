// Untere Navigation der Trainer-App – vom Trainer anpassbar: bis zu fünf Bereiche (Reihenfolge frei), „Mehr“ immer
// rechts. Alle Bereiche sind Seiten dieser Tab-Navigation (die Adressen bleiben gleich); nicht gewählte sind
// ausgeblendet (href: null), aber über „Mehr“ und Links erreichbar – die Leiste bleibt dabei sichtbar.
import { Tabs } from "expo-router";
import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useStore } from "../../../src/data/store";
import { useChatBadge } from "../../../src/ui/chat";
import { Icon } from "../../../src/ui/icons";
import { NAV, useNav } from "../../../src/ui/nav";
import { useTheme } from "../../../src/ui/theme";

export default function CoachTabs() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme(); const { width } = useWindowDimensions();
  const nav = useNav();
  const unread = useChatBadge();
  const tabs = NAV.filter(n => n.tab);
  // Reihenfolge: gewählte Bereiche, dann „Mehr“, dann alle übrigen (ausgeblendet)
  const order = [...nav.bar, "mehr", ...tabs.map(n => n.k).filter(k => !nav.bar.includes(k))];
  const narrow = width < 380 && nav.bar.length >= 5;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Tabs backBehavior="history" screenOptions={{ headerShown: false, freezeOnBlur: true, tabBarActiveTintColor: c.ink, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, borderTopWidth: 1 },
        tabBarLabelStyle: { fontWeight: "600", fontSize: narrow ? 10 : 11, letterSpacing: -0.1 } }}>
        {order.map(k => {
          if (k === "mehr") return (
            <Tabs.Screen key="mehr" name="mehr" options={{ title: t("nav_module"), tabBarButtonTestID: "tab-mehr", tabBarIcon: ({ color, focused }) => <Icon name="mehr" color={color} strokeWidth={focused ? 2.2 : 1.8} /> }} />
          );
          const n = NAV.find(x => x.k === k)!, inBar = nav.bar.includes(k), badge = k === "chat" ? unread : nav.badge(k);
          return (
            <Tabs.Screen key={k} name={k} options={{
              title: t(n.short), tabBarButtonTestID: "tab-" + k, href: inBar ? undefined : null,
              tabBarBadge: inBar && badge ? (badge > 99 ? "99+" : badge) : undefined, tabBarBadgeStyle: { backgroundColor: c.crit, color: "#fff", fontSize: 11, fontWeight: "700" },
              tabBarIcon: ({ color, focused }) => <Icon name={n.icon} color={color} strokeWidth={focused ? 2.2 : 1.8} />,
            }} />
          );
        })}
      </Tabs>
    </View>
  );
}
