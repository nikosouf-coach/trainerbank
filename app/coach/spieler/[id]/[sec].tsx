// Trainer – Spielerprofil, Bereichsseite (Belastung & Erholung, Gesundheit, Empfehlung, Leistung, Spiele, Potenziale,
// Abwesenheiten, Notizen) – src/ui/squad/Profile.
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ProfileSection } from "../../../../src/ui/squad/Profile";

export default function SpielerBereich() {
  const { id = "", sec = "" } = useLocalSearchParams<{ id: string; sec: string }>();
  return <ProfileSection id={id} sec={sec} />;
}
