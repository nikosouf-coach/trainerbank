// Push-Erinnerungen (RPE nach der Einheit, Morgen-Check). Nur in der App auf dem Handy.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useStore } from "./store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushStatus = "unsupported" | "denied" | "granted" | "undetermined";

/** Fragt (auf Wunsch) die Berechtigung an und meldet das Gerät beim Server an. */
export async function enablePush(register: (token: string, platform: "ios" | "android") => Promise<void>, ask: boolean): Promise<PushStatus> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && ask) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return perm.status === "denied" ? "denied" : "undetermined";
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Erinnerungen", importance: Notifications.AndroidImportance.DEFAULT });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await register(token, Platform.OS === "ios" ? "ios" : "android");
  return "granted";
}

/** Meldet das Gerät automatisch an, wenn die Berechtigung schon besteht, und öffnet bei Tipp auf eine Erinnerung das Eintragen. */
export function usePush(): void {
  const s = useStore();
  const ready = s.phase === "ready" && s.api.kind === "supabase";
  useEffect(() => {
    if (!ready) return;
    enablePush((tok, pf) => s.api.registerPushToken(tok, pf), false).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(r => {
      const type = r.notification.request.content.data?.type;
      if (type === "rpe") router.push("/player/eintragen?tab=rpe");
      else if (type === "wellness") router.push("/player/eintragen?tab=well");
      else if (type === "program") router.push("/player/programm");
    });
    return () => sub.remove();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
}
