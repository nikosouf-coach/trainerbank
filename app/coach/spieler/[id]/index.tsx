// Trainer – Spielerprofil (Übersicht): Kopf, Kennzahlen und Bereiche als Zeilen (src/ui/squad/Profile).
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ProfileOverview } from "../../../../src/ui/squad/Profile";

export default function Spieler() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  return <ProfileOverview id={id} />;
}
