// Texteingaben bereinigen – gemeinsam für Umfragen, Notfallkontakte und Größen. Die Datenbank zählt Zeichen wie hier
// (char_length) und lehnt halbe Zeichen (getrennte Ersatzpaare, z. B. bei Emojis) ab.

/** Höchstens max Zeichen, ohne ein Emoji (Ersatzpaar) zu zerschneiden; Leerraum am Ende fällt weg */
export function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const r = s.slice(0, max), last = r.charCodeAt(r.length - 1);
  return (last >= 0xd800 && last <= 0xdbff ? r.slice(0, -1) : r).trimEnd();
}
/** Eine Zeile (Titel, Name, Antwort): ohne Steuerzeichen und Zeilenumbrüche, Leerraum zusammengefasst */
export function oneLine(s: unknown, max: number): string {
  return cut(String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim(), max);
}
/** Absatz (Einleitung, Freitext, Hinweis): Zeilenumbrüche bleiben, höchstens eine Leerzeile */
export function paragraph(s: unknown, max: number): string {
  return cut(String(s ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim(), max);
}

/** Persönliche Angaben aus Fehlermeldungen entfernen, bevor sie in einen Absturzbericht gehen:
 *  E-Mail-Adressen, IDs (UUID), Telefonnummern und lange Ziffernfolgen (z. B. Codes). */
export function scrubText(s: unknown): string {
  return String(s ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[ID]")
    .replace(/(?:\+|\b00)\d[\d ()/-]{6,}\d/g, "[Telefon]")
    .replace(/\b\d[\d ()/-]{7,}\d\b/g, "[Zahl]")
    .replace(/\b[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}\b/g, "[Code]");
}
