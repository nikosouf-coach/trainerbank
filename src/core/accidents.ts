// Unfallmeldung: Sportunfall im Training, Spiel oder auf dem Weg festhalten (Hergang, Verletzung, Erste Hilfe,
// Behandlung, Zeugen), an Verein und Sportversicherung melden (Datum, Schadennummer) und als Text weitergeben.
// Gesundheitsdaten: nur das Trainerteam mit Recht „Gesundheitsdaten“; der Spieler sieht seine eigenen Meldungen.
// Löschfrist: 36 Monate nach dem Unfall (Server). Kein Versand an die Versicherung aus der App – den Weg kennt der Verein.
import { cleanAreas } from "./body";
import { diff } from "./dates";
import type { Absence, AccActivity, Accident, Match, Player, TeamData } from "./types";

export type { AccActivity, Accident };
export const ACC_ACTIVITIES: AccActivity[] = ["training", "match", "travel", "other"];
export type AccStatus = "open" | "club" | "insurer" | "closed";
export const ACC_MAX = { place: 120, how: 1000, injury: 300, firstAid: 300, treatment: 300, witnesses: 300, claimNo: 60, note: 500 } as const;
/** Ohne Meldung an den Verein nach so vielen Tagen: Hinweis */
export const ACC_REMIND_DAYS = 3;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const line = (s: unknown, n: number): string => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const text = (s: unknown, n: number): string => String(s ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const day = (s: unknown): string | null => typeof s === "string" && DATE.test(s) ? s : null;

export function cleanAccident(x: Partial<Accident> & { id: string; pid: string }): Accident {
  const t = typeof x.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ? x.time : null;
  const act = ACC_ACTIVITIES.includes(x.activity as AccActivity) ? x.activity as AccActivity : "training";
  const area = x.area ? cleanAreas([x.area])[0] ?? null : null;
  return {
    id: x.id, pid: x.pid, date: day(x.date) || "", time: t, place: line(x.place, ACC_MAX.place),
    activity: act, matchId: act === "match" || act === "travel" ? x.matchId || null : null, absenceId: x.absenceId || null,
    how: text(x.how, ACC_MAX.how), injury: text(x.injury, ACC_MAX.injury), area,
    firstAid: text(x.firstAid, ACC_MAX.firstAid), treatment: text(x.treatment, ACC_MAX.treatment), witnesses: text(x.witnesses, ACC_MAX.witnesses),
    clubOn: day(x.clubOn), insurerOn: day(x.insurerOn), claimNo: line(x.claimNo, ACC_MAX.claimNo),
    closed: x.closed === true, note: text(x.note, ACC_MAX.note), at: x.at ?? null,
  };
}

export type AccError = "player" | "date" | "how" | "injury" | "clubOn" | "insurerOn";
/** Pflicht: Spieler, Tag (nicht in der Zukunft), Hergang, Verletzung; Meldedaten nicht vor dem Unfall und nicht in der Zukunft */
export function accidentErrors(a: Accident, today: string): AccError[] {
  const e: AccError[] = [];
  if (!a.pid) e.push("player");
  if (!a.date || a.date > today) e.push("date");
  if (!a.how) e.push("how");
  if (!a.injury) e.push("injury");
  if (a.clubOn && (a.clubOn > today || (a.date && a.clubOn < a.date))) e.push("clubOn");
  if (a.insurerOn && (a.insurerOn > today || (a.date && a.insurerOn < a.date))) e.push("insurerOn");
  return e;
}

export const accStatus = (a: Pick<Accident, "closed" | "clubOn" | "insurerOn">): AccStatus =>
  a.closed ? "closed" : a.insurerOn ? "insurer" : a.clubOn ? "club" : "open";

/** Noch nicht an den Verein gemeldet, obwohl der Unfall schon ein paar Tage her ist */
export const accOverdue = (a: Accident, today: string): boolean =>
  !a.closed && !a.clubOn && !a.insurerOn && !!a.date && diff(a.date, today) >= ACC_REMIND_DAYS;

/** Offene zuerst (neueste oben), dann abgeschlossene */
export function accidentsSorted(D: Pick<TeamData, "accidents">): Accident[] {
  return [...D.accidents].sort((a, b) => Number(a.closed) - Number(b.closed) || (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
}

/** Offene Meldungen (nicht abgeschlossen) – für Menü und Startseite */
export const openAccidents = (D: Pick<TeamData, "accidents">): Accident[] => accidentsSorted(D).filter(a => !a.closed);

/** Vorlage aus einer Verletzung (Abwesenheit „verletzung“): Spieler, Tag, Körperregion */
export function accidentFromAbsence(ab: Absence): Pick<Accident, "pid" | "date" | "area" | "absenceId"> {
  return { pid: ab.pid, date: ab.von, area: ab.area || null, absenceId: ab.id };
}

/** Spiel am Unfalltag (für Ort und Tätigkeit „Spiel“) */
export const matchOn = (D: Pick<TeamData, "matches">, date: string): Match | undefined => D.matches.find(m => m.date === date);

export interface AccTextCtx {
  t: (k: string) => string; tf: (k: string, v: Record<string, string | number>) => string;
  de: (iso: string) => string; areaText: (code: string) => string;
  player: Pick<Player, "vn" | "nn" | "geb"> | undefined; club: string; team: string; match?: Match;
}

/** Meldung als Text (zum Kopieren in das Formular der Versicherung oder für die Geschäftsstelle) */
export function accidentText(a: Accident, c: AccTextCtx): string {
  const { t, tf, de } = c;
  const L: string[] = [t("ac_txtTitle"), ""];
  const row = (k: string, v: string | null | undefined) => { if (v) L.push(`${t(k)}: ${v}`); };
  row("ac_txtTeam", [c.club, c.team].filter(Boolean).join(" · "));
  row("ac_txtPerson", c.player ? `${c.player.vn} ${c.player.nn}`.trim() + (c.player.geb ? ` (${tf("ac_txtBorn", { d: de(c.player.geb) })})` : "") : "");
  row("ac_txtWhen", a.date ? de(a.date) + (a.time ? ` · ${a.time}` : "") : "");
  row("ac_txtActivity", t("ac_act_" + a.activity) + (c.match ? ` · ${t("vs")} ${c.match.gegner} (${c.match.heim ? t("home") : t("away")})` : ""));
  row("ac_txtPlace", a.place);
  row("ac_txtHow", a.how);
  row("ac_txtInjury", [a.injury, a.area ? c.areaText(a.area) : ""].filter(Boolean).join(" – "));
  row("ac_txtFirstAid", a.firstAid);
  row("ac_txtTreatment", a.treatment);
  row("ac_txtWitnesses", a.witnesses);
  row("ac_txtClub", a.clubOn ? de(a.clubOn) : "");
  row("ac_txtInsurer", a.insurerOn ? de(a.insurerOn) : "");
  row("ac_txtClaim", a.claimNo);
  row("ac_txtNote", a.note);
  return L.join("\n");
}
