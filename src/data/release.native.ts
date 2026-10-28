// Version und Updates – App (iOS/Android): Build-Nummer, Gerät und Updates über EAS Update.
// Gleiche Exporte wie release.ts (Browser).
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import type { AppInfo, UpdateState } from "./release";

export function appInfo(): AppInfo {
  const fromUpdate = Updates.isEnabled && !Updates.isEmbeddedLaunch;
  return {
    version: Application.nativeApplicationVersion || Constants.expoConfig?.version || "1.0.0",
    build: Application.nativeBuildVersion || null,
    updateId: fromUpdate ? Updates.updateId || null : null,
    updateAt: fromUpdate && Updates.createdAt ? Updates.createdAt.toISOString() : null,
    channel: Updates.isEnabled ? Updates.channel || null : null,
    platform: Platform.OS === "ios" ? "ios" : "android",
    os: Device.osVersion || null,
    device: Device.modelName || null,
  };
}
/** Werden Updates über Expo geladen? (nicht in Entwicklungs-Builds und ohne Projekt-ID) */
export const updatesOn = Updates.isEnabled;
/** Nach einem Update suchen und es laden; es wirkt nach dem Neustart (applyUpdate) */
export async function checkForUpdate(): Promise<UpdateState> {
  if (!Updates.isEnabled) return "none";
  const r = await Updates.checkForUpdateAsync();
  if (!r.isAvailable) return "none";
  const f = await Updates.fetchUpdateAsync();
  return f.isNew ? "ready" : "none";
}
/** App mit dem geladenen Update neu starten */
export async function applyUpdate(): Promise<void> { if (Updates.isEnabled) await Updates.reloadAsync(); }
