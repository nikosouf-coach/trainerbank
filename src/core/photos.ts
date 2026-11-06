// Foto-Erlaubnis: ob Fotos eines Spielers veröffentlicht werden dürfen – je Kanal (Vereinswebsite, Social Media des
// Vereins, Presse und Druck) und ob sein Name dazu genannt werden darf. Wer zustimmen muss, hängt vom Alter ab:
// unter 14 die Eltern, 14–17 Eltern und Spieler, ab 18 der Spieler selbst (Alter unbekannt: wie eingetragen).
// „Nein“ des Spielers gilt immer – auch bei Minderjährigen; ein Widerruf wirkt für künftige Veröffentlichungen.
// Eintragen: das Trainerteam (Recht „Kader“, aus dem unterschriebenen Formular) und der Spieler selbst (Ja ab 18, Nein immer).
import { ageAt, validBirth } from "./birthdays";
import type { PhotoBy, PhotoChannel, PhotoConsent, Player, TeamData } from "./types";

export type { PhotoBy, PhotoChannel, PhotoConsent };
export const PHOTO_CHANNELS: PhotoChannel[] = ["web", "social", "press", "name"];
/** Wer hat erklärt: der Spieler, die Eltern oder beide (z. B. gemeinsam unterschriebenes Formular) */
export const PHOTO_BY: PhotoBy[] = ["player", "parents", "both"];
/** ja: darf veröffentlicht werden; nein: abgelehnt bzw. widerrufen; offen: keine Erklärung; fehlt: Zustimmung reicht fürs Alter nicht */
export type PhotoState = "yes" | "no" | "open" | "missing";
export const PHOTO_NOTE_MAX = 200;

/** Alter heute (null = Geburtsdatum fehlt) */
export const photoAge = (p: Pick<Player, "geb"> | undefined, today: string): number | null =>
  p && validBirth(p.geb, today) ? ageAt(p.geb, today) : null;

/** Welche Erklärungen reichen fürs Alter? */
export function validBy(age: number | null): PhotoBy[] {
  if (age == null) return ["player", "parents", "both"];
  if (age >= 18) return ["player", "both"];
  if (age >= 14) return ["both"];
  return ["parents", "both"];
}

/** Stand je Kanal */
export function photoState(c: PhotoConsent | undefined, ch: PhotoChannel, age: number | null): PhotoState {
  const v = c ? c[ch] : null;
  if (v === false) return "no";
  if (v !== true) return "open";
  return c && c.by && validBy(age).includes(c.by) ? "yes" : "missing";
}

/** Darf der Spieler selbst zustimmen? Ab 18 bzw. ohne Geburtsdatum im Erwachsenenbereich – „Nein“ geht immer */
export const canSelfConsent = (age: number | null, adultTeam: boolean): boolean => age != null ? age >= 18 : adultTeam;

export function cleanPhotoConsent(x: Partial<PhotoConsent> | null | undefined): PhotoConsent {
  const b = (v: unknown): boolean | null => v === true ? true : v === false ? false : null;
  const by = x?.by === "player" || x?.by === "parents" || x?.by === "both" ? x.by : null;
  const on = typeof x?.on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.on) ? x.on : null;
  const note = String(x?.note ?? "").replace(/\s+/g, " ").trim().slice(0, PHOTO_NOTE_MAX);
  return { web: b(x?.web), social: b(x?.social), press: b(x?.press), name: b(x?.name), by, on, note, at: x?.at ?? null };
}

/**
 * Eigene Änderung des Spielers: Ja nur, wenn er selbst zustimmen darf; Nein immer; sonst bleibt der alte Wert.
 * Darf er zustimmen und ändert etwas, gilt die Erklärung als seine (heute); sonst bleiben Erklärung und Datum.
 */
export function selfChange(old: PhotoConsent | undefined, next: Partial<Record<PhotoChannel, boolean>>, self: boolean, today: string): PhotoConsent {
  const base = cleanPhotoConsent(old);
  const out: PhotoConsent = { ...base };
  let changed = false;
  for (const ch of PHOTO_CHANNELS) {
    const v = next[ch];
    if (v === undefined || v === base[ch]) continue;
    if (v === false || self) { out[ch] = v; changed = true; }
  }
  if (changed && self) { out.by = "player"; out.on = today; }
  return out;
}

export interface PhotoRow { pid: string; age: number | null; c: PhotoConsent | undefined; states: Record<PhotoChannel, PhotoState> }

/** Übersicht fürs Trainerteam: aktive Spieler mit Stand je Kanal */
export function photoRows(D: Pick<TeamData, "players" | "photos">, today: string): PhotoRow[] {
  return D.players.filter(p => p.active !== false).map(p => {
    const age = photoAge(p, today), c = D.photos[p.id];
    const states = Object.fromEntries(PHOTO_CHANNELS.map(ch => [ch, photoState(c, ch, age)])) as Record<PhotoChannel, PhotoState>;
    return { pid: p.id, age, c, states };
  });
}

/** Zählung je Kanal */
export function photoCounts(rows: PhotoRow[], ch: PhotoChannel): Record<PhotoState, number> {
  const k: Record<PhotoState, number> = { yes: 0, no: 0, open: 0, missing: 0 };
  for (const r of rows) k[r.states[ch]]++;
  return k;
}

/** Hinweis bei Volljährigkeit: Zustimmung nur der Eltern reicht ab 18 nicht mehr */
export const needsRenewal = (r: PhotoRow): boolean =>
  r.age != null && r.age >= 18 && r.c?.by === "parents" && PHOTO_CHANNELS.some(ch => r.c?.[ch] === true);
