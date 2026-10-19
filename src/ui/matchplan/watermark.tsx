// Matchplan: Wasserzeichen über den ganzen Inhalt (schräg, wiederholt) – Name des Spielers und Zeitpunkt.
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../theme";

/** light = auf dunklem Grund (z. B. Präsentation) */
export function Watermark({ text, height, testID = "mp-watermark", light }: { text: string; height: number; testID?: string; light?: boolean }) {
  const { dark } = useTheme();
  const rows = Math.max(4, Math.ceil(height / 110));
  return (
    <View pointerEvents="none" testID={testID} style={{ position: "absolute", left: 0, right: 0, top: 0, height, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Text key={i} numberOfLines={1} style={{ position: "absolute", top: i * 110 + 30, left: i % 2 ? -160 : -100, width: 1400, transform: [{ rotate: "-24deg" }],
          fontSize: 17, fontWeight: "800", letterSpacing: 1, color: light || dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.075)" }}>
          {`${text}   ·   ${text}   ·   ${text}   ·   ${text}`}
        </Text>
      ))}
    </View>
  );
}
