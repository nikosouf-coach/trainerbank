import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { usePush } from "../src/data/push";
import { StoreProvider, useStore } from "../src/data/store";
import { InfoHost, Toast } from "../src/ui/kit";
import { ThemeProvider, useTheme } from "../src/ui/theme";

function Shell() {
  const s = useStore();
  usePush();
  return (
    <ThemeProvider accent={s.D?.team.accent || "#0b3d91"}>
      <Body toast={s.toastMsg} closeLabel={s.tr.t("cancel")} info={s.prefs.info !== false} />
    </ThemeProvider>
  );
}
function Body({ toast, closeLabel, info }: { toast: string | null; closeLabel: string; info: boolean }) {
  const { c, dark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <InfoHost closeLabel={closeLabel} enabled={info}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
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
