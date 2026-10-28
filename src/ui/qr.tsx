// QR-Code als SVG. Immer schwarz auf weiß (auch im dunklen Modus), damit jede Kamera ihn liest; ganze Pixel je Modul,
// damit keine hellen Haarlinien entstehen. Raster aus core/qr.
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { qrMatrix } from "../core/qr";

/** Ruhezone um den Code (Module) – vom Standard verlangt */
const QUIET = 4;

export function QrCode({ value, size = 220, label, testID }: { value: string; size?: number; label?: string; testID?: string }) {
  const { d, n } = useMemo(() => {
    const m = qrMatrix(value); let p = "";
    // dunkle Module zeilenweise zu Streifen zusammenfassen (kürzerer Pfad, keine Fugen innerhalb einer Zeile)
    m.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (!row[x]) continue;
        let w = 1; while (x + w < row.length && row[x + w]) w++;
        p += `M${x + QUIET} ${y + QUIET}h${w}v1h-${w}z`; x += w - 1;
      }
    });
    return { d: p, n: m.length + 2 * QUIET };
  }, [value]);
  const px = Math.max(1, Math.floor(size / n)), real = px * n;
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: real, height: real, backgroundColor: "#ffffff", borderRadius: 10, overflow: "hidden" }}>
      <Svg width={real} height={real} viewBox={`0 0 ${n} ${n}`}>
        <Rect x={0} y={0} width={n} height={n} fill="#ffffff" />
        <Path d={d} fill="#000000" />
      </Svg>
    </View>
  );
}
