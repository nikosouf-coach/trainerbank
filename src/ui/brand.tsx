// Marke „Trainerstab“: Bildzeichen (Trillerpfeife – Mundstück und Kugel mit Anstoßpunkt) und Wortmarke. Dieselbe
// Geometrie steckt in den App-Symbolen (assets/) und im Favicon der Website (website/static/favicon.svg).
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { BRAND, useTheme } from "./theme";

/** Bildzeichen: abgerundetes Quadrat in Markengrün, darin die Pfeife (32er-Raster, Strich 3 wie die übrigen Symbole). */
export function LogoMark({ size = 40, mono }: { size?: number; mono?: string }) {
  const bg = mono || BRAND.green;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Trainerstab">
      <Rect x={0} y={0} width={32} height={32} rx={8.5} fill={bg} />
      <Path d="M6.425 8.25H19.125V9.75A6.25 6.25 0 0 0 14.205 12.15H6.425A1.3 1.3 0 0 1 5.125 10.85V9.55A1.3 1.3 0 0 1 6.425 8.25Z" fill="#ffffff" />
      <Circle cx={19.125} cy={16} r={6.25} stroke="#ffffff" strokeWidth={3} fill="none" />
      <Circle cx={19.125} cy={16} r={1.6} fill="#ffffff" />
    </Svg>
  );
}

/** Wortmarke „trainerstab“ – zweifarbig, kleingeschrieben; optional mit Bildzeichen. */
export function Wordmark({ size = 22, mark = true }: { size?: number; mark?: boolean }) {
  const { c, dark } = useTheme();
  return (
    <View accessibilityRole="header" accessibilityLabel="Trainerstab" style={{ flexDirection: "row", alignItems: "center", gap: size * 0.45 }}>
      {mark ? <LogoMark size={size * 1.45} /> : null}
      <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: -size * 0.035, color: c.ink }}>
        trainer<Text style={{ color: dark ? BRAND.greenDark : BRAND.green }}>stab</Text>
      </Text>
    </View>
  );
}
