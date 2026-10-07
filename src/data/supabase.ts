// Supabase-Client. Zugangsdaten kommen aus .env (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY).
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** true, wenn ein Server eingerichtet ist. Ohne Server startet die App nur im Demo-Modus. */
export const hasSupabase = !!(url && anonKey);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anonKey!, {
      auth: {
        storage: Platform.OS === "web" ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    })
  : null;

// Token nur auffrischen, solange die App im Vordergrund ist (Empfehlung von Supabase für React Native)
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", state => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
