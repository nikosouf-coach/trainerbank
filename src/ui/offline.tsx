// Leiste „ohne Netz“: zeigt, dass Einträge gesammelt und nachgereicht werden (Trainer- und Spieler-App).
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "../data/store";
import { space, useTheme, withAlpha } from "./theme";

type S = ReturnType<typeof useStore>;
const pendingOf = (s: S): number => s.outbox.filter(x => x.team === s.active?.teamId).length;
/** Leiste nötig? (kein Netz, wartende Einträge, Senden läuft oder Stand vom Gerät) */
export const offlineVisible = (s: S): boolean => s.phase === "ready" && (s.offline || s.syncing || !!s.cachedAt || pendingOf(s) > 0);

export function OfflineBar() {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const n = pendingOf(s);
  if (!offlineVisible(s)) return null;
  const since = s.cachedAt ? new Date(s.cachedAt) : null;
  const stamp = since ? `${String(since.getDate()).padStart(2, "0")}.${String(since.getMonth() + 1).padStart(2, "0")}. ${String(since.getHours()).padStart(2, "0")}:${String(since.getMinutes()).padStart(2, "0")}` : "";
  const msg = s.syncing ? t("off_syncing")
    : s.offline ? (n ? tf(n === 1 ? "off_bar1" : "off_barN", { n }) : s.cachedAt ? tf("off_cached", { at: stamp }) : t("off_bar0"))
    : tf(n === 1 ? "off_wait1" : "off_waitN", { n });
  const col = s.offline ? c.warn : c.accentTx;
  return (
    <View testID="offline-bar" accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.l, paddingVertical: 7,
      backgroundColor: withAlpha(col, 0.12), borderBottomWidth: 1, borderBottomColor: withAlpha(col, 0.35) }}>
      <Text style={{ fontSize: 14 }}>{s.offline ? "📵" : "⏳"}</Text>
      <Text testID="offline-msg" style={{ flex: 1, minWidth: 0, color: c.ink, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>{msg}</Text>
      {!s.syncing ? (
        <Pressable testID="offline-retry" accessibilityRole="button" onPress={() => s.syncNow()} hitSlop={8}
          style={{ borderWidth: 1, borderColor: withAlpha(col, 0.5), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: col, fontWeight: "700", fontSize: 12 }}>{t("off_retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
