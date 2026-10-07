// Leitet auf den richtigen Bereich um (Anmeldung, Start, Trainer- oder Spieler-App).
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useStore } from "../data/store";
import { useTheme } from "./theme";

export function targetPath(s: ReturnType<typeof useStore>): string {
  if (s.phase === "signedOut") return "/welcome";
  if (s.phase === "noTeam") return "/start";
  if (s.phase === "pending") return "/pending";
  if (s.phase === "ready") return s.viewAs === "player" ? (s.mePid ? "/player/heute" : "/demo-player") : "/coach/heute";
  return "/";
}
export function Splash() {
  const { c } = useTheme();
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}><ActivityIndicator size="large" color={c.accent} /></View>;
}
/** In Layouts: nur rendern, wenn der Bereich zur Rolle passt. */
export function Guard({ area, children }: { area: "coach" | "player"; children: React.ReactNode }) {
  const s = useStore();
  if (s.phase === "loading") return <Splash />;
  if (s.phase !== "ready" || !s.D || s.viewAs !== area) return <Redirect href={targetPath(s)} />;
  if (area === "player" && !s.mePid) return <Redirect href="/demo-player" />;
  return <>{children}</>;
}
