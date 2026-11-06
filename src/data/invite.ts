// Einladungen per Link und QR-Code: Spieler (Team-Code), Trainerteam (Trainer-Code) und Eltern (Eltern-Code je Kind).
// Ohne eigene Website öffnet der Link direkt die App (trainerbank://join?code=…). Mit EXPO_PUBLIC_INVITE_URL
// (z. B. https://trainerbank.de) zeigt der Link eine Seite, die zur App bzw. in die Stores weiterleitet.
// Installationslinks der Testversion (TestFlight, Google Play Test): EXPO_PUBLIC_INSTALL_IOS, EXPO_PUBLIC_INSTALL_ANDROID.
export type InviteKind = "player" | "staff" | "parent";
export interface PendingInvite { kind: InviteKind; code: string }

/** Format der Codes (wie in der Datenbank): XXXX-XXXX ohne verwechselbare Zeichen (0, O, 1, I, L) */
const CODE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

/** Code aus einem Link oder einer Eingabe säubern (Großbuchstaben, Bindestrich) – null, wenn ungültig */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const s = c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : "";
  return CODE.test(s) ? s : null;
}

/** Eltern-Code (zehn Zeichen, XXXXX-XXXXX) säubern – null, wenn ungültig */
export function cleanParentCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const s = c.length === 10 ? c.slice(0, 5) + "-" + c.slice(5) : "";
  return /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/.test(s) ? s : null;
}
/** Code der Einladung je Art säubern */
export const cleanInviteOf = (kind: unknown, raw: unknown): string | null => kind === "parent" ? cleanParentCode(raw) : kind === "player" || kind === "staff" ? cleanCode(raw) : null;

/** Seite der Einladung (Spieler: /join, Trainerteam: /staff-join, Eltern: /parent-link) */
export const invitePath = (kind: InviteKind): string => kind === "staff" ? "staff-join" : kind === "parent" ? "parent-link" : "join";

/** Link zum Beitreten bzw. Verknüpfen */
export function inviteUrl(kind: InviteKind, code: string): string {
  const base = (process.env.EXPO_PUBLIC_INVITE_URL || "").trim().replace(/\/+$/, "");
  const path = invitePath(kind), q = "code=" + encodeURIComponent(code);
  return base ? `${base}/${path}?${q}` : `trainerbank://${path}?${q}`;
}

/** Links zur Testversion bzw. zu den Stores (leer = nicht eingerichtet) */
export const installLinks = (): { ios: string; android: string } => ({
  ios: (process.env.EXPO_PUBLIC_INSTALL_IOS || "").trim(),
  android: (process.env.EXPO_PUBLIC_INSTALL_ANDROID || "").trim(),
});
