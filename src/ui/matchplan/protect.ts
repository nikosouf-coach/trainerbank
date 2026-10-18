// Bildschirmschutz für freigegebene Matchpläne: Android sperrt Screenshots und Bildschirmaufnahmen (FLAG_SECURE),
// iOS schwärzt Bildschirmaufnahmen; erkannte Screenshots (iOS, Android 14+) werden gemeldet. Im Web nicht möglich –
// dort schützt nur das Wasserzeichen.
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

export function useScreenProtect(active: boolean, onShot: () => void): void {
  const cb = useRef(onShot); cb.current = onShot;
  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    let sub: { remove(): void } | null = null;
    ScreenCapture.preventScreenCaptureAsync("matchplan").catch(() => undefined);
    try { sub = ScreenCapture.addScreenshotListener(() => cb.current()); } catch { sub = null; }
    return () => { sub?.remove(); ScreenCapture.allowScreenCaptureAsync("matchplan").catch(() => undefined); };
  }, [active]);
}
