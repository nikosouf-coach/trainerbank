// Geburtstage: nächster Geburtstag mit Alter, heute und in den nächsten Tagen, Liste fürs Trainerteam, Kalender,
// fehlende Geburtsdaten, Glückwunsch für den Teamchat. Wer am 29.02. geboren ist, feiert in Nicht-Schaltjahren am 28.02.
// Grundlage ist das Geburtsdatum im Spielerprofil (players.birthdate) – sehen kann es nur das Trainerteam; Spieler
// sehen ihren eigenen Geburtstag (Glückwunsch auf „Heute“).
import { diff } from "./dates";
import type { Player, TeamData } from "./types";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Gültiges Geburtsdatum (JJJJ-MM-TT, echter Tag, ab 1900, nicht in der Zukunft) */
export function validBirth(geb: string | null | undefined, today: string): geb is string {
  const m = geb ? ISO.exec(geb) : null;
  if (!m || !geb) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return false;
  const days = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= days && geb <= today;
}

/** Geburtstag im Jahr y (29.02. → 28.02. in Nicht-Schaltjahren) */
export function birthdayIn(geb: string, y: number): string {
  const md = geb.slice(5);
  return `${String(y).padStart(4, "0")}-${md === "02-29" && !leap(y) ? "02-28" : md}`;
}

/** Alter an einem Tag (Geburtstag zählt ab dem Tag selbst; 29.02. in Nicht-Schaltjahren ab dem 28.02.) */
export function ageAt(geb: string, day: string): number {
  const y = +day.slice(0, 4);
  return y - +geb.slice(0, 4) - (day < birthdayIn(geb, y) ? 1 : 0);
}

export interface Birthday { pid: string; date: string; age: number; days: number }

/** Nächster Geburtstag ab heute (heute eingeschlossen): Datum, neues Alter, Tage bis dahin */
export function nextBirthday(p: Pick<Player, "id" | "geb">, today: string): Birthday | null {
  if (!validBirth(p.geb, today)) return null;
  const y = +today.slice(0, 4);
  let date = birthdayIn(p.geb, y);
  if (date < today) date = birthdayIn(p.geb, y + 1);
  return { pid: p.id, date, age: +date.slice(0, 4) - +p.geb.slice(0, 4), days: diff(today, date) };
}

const activePlayers = (D: Pick<TeamData, "players">) => D.players.filter(p => p.active !== false);

/** Alle aktiven Spieler mit Geburtsdatum nach dem nächsten Geburtstag (heute zuerst), dann Name */
export function birthdayList(D: Pick<TeamData, "players">, today: string): Birthday[] {
  const name = (pid: string) => { const p = D.players.find(x => x.id === pid); return p ? `${p.vn} ${p.nn}` : ""; };
  return activePlayers(D).map(p => nextBirthday(p, today)).filter((b): b is Birthday => !!b)
    .sort((a, b) => a.days - b.days || name(a.pid).localeCompare(name(b.pid), "de"));
}

/** Geburtstage heute und in den nächsten n Tagen */
export const upcomingBirthdays = (D: Pick<TeamData, "players">, today: string, days = 7): Birthday[] =>
  birthdayList(D, today).filter(b => b.days <= days);

/** Geburtstage an einem Tag (Kalender): Spieler und das Alter, das er an dem Tag wird */
export function birthdaysOn(D: Pick<TeamData, "players">, day: string): { pid: string; age: number }[] {
  const y = +day.slice(0, 4);
  return activePlayers(D).filter(p => validBirth(p.geb, day) && birthdayIn(p.geb, y) === day && p.geb < day)
    .map(p => ({ pid: p.id, age: y - +p.geb.slice(0, 4) }));
}

/** Aktive Spieler ohne gültiges Geburtsdatum */
export const missingBirthdays = (D: Pick<TeamData, "players">, today: string): string[] =>
  activePlayers(D).filter(p => !validBirth(p.geb, today)).map(p => p.id);
