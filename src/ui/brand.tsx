// Marke „Trainerbank“: Bildzeichen (ein „b“, dessen Bauch der Mittelkreis mit Anstoßpunkt ist) und Wortmarke.
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { BRAND, useTheme } from "./theme";

/** Bildzeichen: abgerundetes Quadrat in Markengrün, darin das „b“ mit Mittelkreis und Anstoßpunkt. */
export function LogoMark({ size = 40, mono }: { size?: number; mono?: string }) {
  const bg = mono || BRAND.green;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Trainerbank">
      <Rect x={0} y={0} width={32} height={32} rx={8.5} fill={bg} />
      <Path d="M9.5 6.5V25" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx={16} cy={18.5} r={6.5} stroke="#ffffff" strokeWidth={3} fill="none" />
      <Circle cx={16} cy={18.5} r={1.5} fill="#ffffff" />
    </Svg>
  );
}

/** Wortmarke „trainerbank“ – zweifarbig, kleingeschrieben; optional mit Bildzeichen. */
export function Wordmark({ size = 22, mark = true }: { size?: number; mark?: boolean }) {
  const { c, dark } = useTheme();
  return (
    <View accessibilityRole="header" accessibilityLabel="Trainerbank" style={{ flexDirection: "row", alignItems: "center", gap: size * 0.45 }}>
      {mark ? <LogoMark size={size * 1.45} /> : null}
      <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: -size * 0.035, color: c.ink }}>
        trainer<Text style={{ color: dark ? BRAND.greenDark : BRAND.green }}>bank</Text>
      </Text>
    </View>
  );
}
