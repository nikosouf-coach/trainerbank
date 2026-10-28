// Version und Updates – Browser (Vorschau, Web-Fassung): keine Updates über Expo, Version aus der Konfiguration.
// Die App-Fassung steht in release.native.ts (Metro nimmt sie für iOS und Android, beide haben dieselben Exporte).
import Constants from "expo-constants";

export interface AppInfo {
  /** Version der App (z. B. 1.0.0) */
  version: string;
  /** Build-Nummer der installierten App (nur iOS/Android) */
  build: string | null;
  /** Geladenes Update (EAS Update): Kennung und Zeitpunkt – null = Stand des Builds */
  updateId: string | null; updateAt: string | null;
  /** Kanal der Updates (preview = Test, production = Store) */
  channel: string | null;
  platform: "ios" | "android" | "web";
  os: string | null; device: string | null;
}
/** Ergebnis der Suche nach Updates: keins oder geladen (wirkt nach dem Neustart) */
export type UpdateState = "none" | "ready";

/** Browser grob benennen (ohne vollständige Kennung, damit nichts Persönliches mitgeht) */
function browserOf(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

export function appInfo(): AppInfo {
  const ua = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent || "";
  return { version: Constants.expoConfig?.version || "1.0.0", build: null, updateId: null, updateAt: null, channel: null, platform: "web", os: null, device: browserOf(ua) };
}
/** Werden Updates über Expo geladen? (nur in der App) */
export const updatesOn = false;
export async function checkForUpdate(): Promise<UpdateState> { return "none"; }
export async function applyUpdate(): Promise<void> { /* Browser: Seite neu laden genügt */ }
