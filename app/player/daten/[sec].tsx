// Spieler – Meine Daten, Bereichsseite (Belastung, Woche & Abzeichen, Saison & Feedback, Tests, Beteiligung, Befunde).
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { PlayerDataSection } from "../../../src/ui/player/data";

export default function DatenBereich() {
  const { sec = "" } = useLocalSearchParams<{ sec: string }>();
  return <PlayerDataSection sec={sec} />;
}
