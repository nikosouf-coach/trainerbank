// Personen-Hilfen: Vorname, Cheftrainer, Anrede.
import type { StaffProfile, TeamData } from "./types";

export const firstName = (n: string | null | undefined): string => (n || "").trim().split(/\s+/)[0] || "";

/** Cheftrainer des Teams: Rolle „chef“ (bevorzugt mit Konto), sonst das erste verknüpfte Profil. */
export function headCoach(D: TeamData): StaffProfile | null {
  return D.staff.find(x => x.role === "chef" && x.userId) || D.staff.find(x => x.role === "chef") || D.staff.find(x => x.userId) || null;
}

/** Tageszeit-Gruß-Schlüssel (hi_morning / hi_day / hi_evening). */
export const greetKey = (h: number): string => h < 11 ? "hi_morning" : h < 18 ? "hi_day" : "hi_evening";
