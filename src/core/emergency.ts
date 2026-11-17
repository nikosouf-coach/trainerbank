// Notfallkontakte: ein oder zwei Personen je Spieler (Name, Beziehung, Telefonnummer), die das Trainerteam im Notfall
// anruft, dazu freiwillige Hinweise für den Notfall (z. B. Allergie, Asthma-Spray – Gesundheitsdaten). Beim Beitreten
// Pflicht; fehlt der Kontakt, erinnert die App den Spieler und zeigt es dem Trainerteam. Reine Logik; dieselben Grenzen
// prüft die Datenbank (emergency_contacts_ok).
import { oneLine, paragraph } from "./text";
import type { EmContact, EmRel, Player, TeamData } from "./types";

export const EM_RELS: EmRel[] = ["mother", "father", "guardian", "partner", "sibling", "grandparent", "other"];
export const EM_LIMITS = { contacts: 2, name: 80, phone: 30, med: 500 } as const;

/**
 * Telefonnummer aufräumen: nur Ziffern, „+“, Leerzeichen, „/“, „-“ und Klammern; „00“ am Anfang wird „+“
 * (z. B. „0049 171 …“ → „+49 171 …“). Prüfen mit phoneOk.
 */
export function cleanPhone(s: unknown): string {
  let x = String(s ?? "").replace(/[^\d+ ()/-]/g, " ").replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").trim();
  if (/^00\d/.test(x)) x = "+" + x.slice(2);
  return x.slice(0, EM_LIMITS.phone).trim();
}
/** Gültige Nummer: „+“ nur am Anfang, sonst Ziffern und Trennzeichen, 6–20 Ziffern */
export function phoneOk(s: string): boolean {
  if (!s || s.length > EM_LIMITS.phone || !/^\+?[\d ()/-]+$/.test(s)) return false;
  const d = s.replace(/\D/g, "").length;
  return d >= 6 && d <= 20;
}
/** Link zum Anrufen (nur „+“ und Ziffern) */
export const telHref = (s: string): string => "tel:" + s.replace(/[^\d+]/g, "");

/** Kontakt bereinigen (null = unvollständig: Name und gültige Nummer nötig; unbekannte Beziehung = „sonstige“) */
export function cleanContact(c: Partial<EmContact>): EmContact | null {
  const name = oneLine(c.name, EM_LIMITS.name), phone = cleanPhone(c.phone);
  const rel: EmRel = EM_RELS.includes(c.rel as EmRel) ? c.rel as EmRel : "other";
  return name && phoneOk(phone) ? { name, rel, phone } : null;
}
/** Kontakte bereinigen: nur vollständige, höchstens zwei, keine Nummer doppelt */
export function cleanContacts(L: unknown): EmContact[] {
  const out: EmContact[] = [], seen = new Set<string>();
  for (const x of Array.isArray(L) ? L : []) {
    const c = cleanContact((x && typeof x === "object" ? x : {}) as Partial<EmContact>);
    if (!c) continue;
    const key = c.phone.replace(/\D/g, "");
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
    if (out.length >= EM_LIMITS.contacts) break;
  }
  return out;
}
/** Hinweise für den Notfall (Absatz, höchstens 500 Zeichen) */
export const cleanMed = (s: unknown): string => paragraph(s, EM_LIMITS.med);

/**
 * Eingaben im Formular prüfen: mindestens ein vollständiger Kontakt; ein angefangener Kontakt muss vollständig sein.
 * Ergebnis: Fehler (Schlüssel für die Übersetzung mit Nummer des Kontakts) oder die bereinigten Kontakte.
 */
export function checkContacts(L: Partial<EmContact>[]): { error: "nf_errNone" | "nf_errName" | "nf_errPhone" | "nf_errSame"; n: number } | { contacts: EmContact[] } {
  const used = L.filter(c => oneLine(c.name, EM_LIMITS.name) || String(c.phone ?? "").trim());
  if (!used.length) return { error: "nf_errNone", n: 1 };
  const seen = new Set<string>(), out: EmContact[] = [];
  for (let i = 0; i < used.length; i++) {
    const c = used[i], n = L.indexOf(c) + 1;
    if (!oneLine(c.name, EM_LIMITS.name)) return { error: "nf_errName", n };
    const x = cleanContact(c);
    if (!x) return { error: "nf_errPhone", n };
    const key = x.phone.replace(/\D/g, "");
    if (seen.has(key)) return { error: "nf_errSame", n };
    seen.add(key); out.push(x);
  }
  return { contacts: out.slice(0, EM_LIMITS.contacts) };
}

/** Hat der Spieler einen Notfallkontakt? */
export const hasEmergency = (D: Pick<TeamData, "emergency">, pid: string): boolean => (D.emergency[pid] || []).length > 0;
/** Aktive Spieler ohne Notfallkontakt (Reihenfolge des Kaders) – leer, solange die Kontakte nicht geladen sind */
export const missingEmergency = (D: Pick<TeamData, "players" | "emergency" | "emergencyOk">): Player[] =>
  D.emergencyOk ? D.players.filter(p => p.active !== false && !hasEmergency(D, p.id)) : [];
/** Davon mit eigenem Konto – sie können den Kontakt selbst nachtragen (Erinnerung als Nachricht) */
export const remindable = (D: Pick<TeamData, "players" | "emergency" | "emergencyOk">): Player[] => missingEmergency(D).filter(p => !!p.userId);
/** Fehlt dem Spieler der Notfallkontakt? (nur wenn die Kontakte geladen sind) */
export const needsEmergency = (D: Pick<TeamData, "emergency" | "emergencyOk">, pid: string): boolean => D.emergencyOk && !hasEmergency(D, pid);
