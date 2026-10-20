import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableFreeze } from "react-native-screens";
import { usePush } from "../src/data/push";
import { StoreProvider, useStore } from "../src/data/store";
import { InfoHost, Toast } from "../src/ui/kit";
import { BRAND, ThemeProvider, useTheme } from "../src/ui/theme";

// Bildschirme, die gerade nicht sichtbar sind (andere Reiter, Seiten darunter), rendern bei Änderungen nicht mit –
// sonst rechnen z. B. Startseite und Planung bei jedem automatischen Speichern im Matchplan neu (Ruckeln beim Scrollen).
enableFreeze(true);

function Shell() {
  const s = useStore();
  usePush();
  return (
    <ThemeProvider accent={s.D?.team.accent || BRAND.green} mode={s.themeMode}>
      <Body toast={s.toastMsg} closeLabel={s.tr.t("cancel")} info={s.prefs.info !== false} />
    </ThemeProvider>
  );
}
function Body({ toast, closeLabel, info }: { toast: string | null; closeLabel: string; info: boolean }) {
  const { c, dark } = useTheme();
  // Web: Seitenhintergrund passend zum Modus (sonst blitzt bei kurzen Seiten unten Weiß durch)
  useEffect(() => {
    const doc = Platform.OS === "web" ? (globalThis as unknown as { document?: Document }).document : undefined; if (!doc) return;
    doc.documentElement.style.backgroundColor = c.bg; doc.body.style.backgroundColor = c.bg;
    doc.documentElement.style.colorScheme = dark ? "dark" : "light"; doc.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [c.bg, dark]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <InfoHost closeLabel={closeLabel} enabled={info}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, freezeOnBlur: true }} />
        <Toast text={toast} />
      </InfoHost>
      <StatusBar style={dark ? "light" : "dark"} />
    </View>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
