// Spielerzeile wie auf dem Spielberichtsbogen: Rückennummer in fester Spalte, Bild mit Statuspunkt, Name, eine Zeile
// Nebentext (Position, Alter, Status), rechts ein Wert (z. B. ACWR oder Beteiligung) und Pfeil. In einer Group.
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Player } from "../../core/types";
import { Icon } from "../icons";
import { PlayerAvatar } from "../playerAvatar";
import { useTheme } from "../theme";

export function PlayerRow({ p, name, status, sub, flag, flagColor, value, valueColor, valueSub, onPress, testID, dim, right }: {
  p: Player; name: string; status?: string | null; sub?: string; /** kurzer Status hinter dem Nebentext (farbig) */ flag?: string; flagColor?: string;
  value?: string | null; valueColor?: string; /** kleine Beschriftung unter dem Wert */ valueSub?: string; onPress?: () => void; testID?: string; dim?: boolean; right?: React.ReactNode;
}) {
  const { c } = useTheme();
  const body = (pressed: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, minHeight: 60, backgroundColor: pressed ? c.sunk : "transparent", opacity: dim ? 0.55 : 1 }}>
      <Text style={{ width: 22, textAlign: "right", fontSize: 15, fontWeight: "700", color: c.muted, fontVariant: ["tabular-nums"] }}>{p.nr ?? ""}</Text>
      <PlayerAvatar p={p} size={38} status={status} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, lineHeight: 20, fontWeight: "600", color: c.ink, letterSpacing: -0.15 }}>{name}</Text>
        {sub || flag ? (
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: c.muted }}>
            {sub}{sub && flag ? "   " : ""}{flag ? <Text style={{ color: flagColor || c.muted, fontWeight: "600" }}>{flag}</Text> : null}
          </Text>
        ) : null}
      </View>
      {value != null && value !== "" ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 15.5, fontWeight: "700", color: valueColor || c.ink, fontVariant: ["tabular-nums"] }}>{value}</Text>
          {valueSub ? <Text style={{ fontSize: 11.5, color: c.muted }}>{valueSub}</Text> : null}
        </View>
      ) : null}
      {right}
      {onPress ? <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body(false)}</View>;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={[name, sub, flag, value].filter(Boolean).join(", ")} onPress={onPress}>{({ pressed }) => body(pressed)}</Pressable>;
}
/** Trennlinie in einer Group beginnt beim Namen */
PlayerRow.sepInset = 94;
