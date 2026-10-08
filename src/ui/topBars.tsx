// Leisten oben (Demo, ohne Netz) für alle Seiten der Trainer- und Spieler-App. Die Leisten übernehmen den
// oberen Sicherheitsabstand (Notch/Statusleiste); die Seiten darunter bekommen dafür oben 0 – kein doppelter Abstand.
import React, { type ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../data/store";
import { DemoBar } from "./demoBar";
import { OfflineBar, offlineVisible } from "./offline";
import { useTheme } from "./theme";

export function WithTopBars({ children }: { children: ReactNode }) {
  const s = useStore(); const ins = useSafeAreaInsets(); const { c } = useTheme();
  const bars = s.isDemo || offlineVisible(s);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {bars ? (
        <View style={{ paddingTop: ins.top, backgroundColor: c.surface }}>
          <DemoBar />
          <OfflineBar />
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={bars ? { ...ins, top: 0 } : ins}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
