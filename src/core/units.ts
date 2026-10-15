// Mehrere Einheiten am Tag (z. B. 30 Min. Athletik vor 90 Min. Mannschaftstraining), Torwarttraining und
// Trainingseindruck (nur besonders gute oder schwache Leistungen). Reine Logik ohne UI und ohne Datenbank.
//
// Einheit 0 ist das Mannschaftstraining bzw. Spiel (RPE in D.rpe). Weitere Einheiten haben die Nummern 1–9
// (RPE in D.rpeU). Wiederkehrende Einheiten stehen je Wochentag in den Teameinstellungen (settings.units);
// einzelne Tage – festgehalten, geändert, abgesagt oder zusätzlich – in D.units (Tabelle day_units).
import { diff, parse } from "./dates";
import { inKind } from "./groups";
import type { DayUnit, Player, Rating, RpeEntry, TeamData, TeamSettings, UnitArt } from "./types";

export const UNIT_ARTS: UnitArt[] = ["athletik", "kraft", "tw", "technik", "taktik", "praev", "reha", "sonst"];
/**
 * Richtwerte je Art: Ziel-RPE (CR-10, Foster) und übliche Dauer. Athletik/Kraft vor dem Training sind kurz und
 * intensiv; Prävention und Reha bewusst niedrig. Die Ziel-RPE ist änderbar und wird nie automatisch angepasst.
 */
export const UNIT_DEF: Record<UnitArt, { rpe: number; dauer: number }> = {
  athletik: { rpe: 6, dauer: 30 }, kraft: { rpe: 6, dauer: 45 }, tw: { rpe: 6, dauer: 60 }, technik: { rpe: 4, dauer: 30 },
  taktik: { rpe: 3, dauer: 30 }, praev: { rpe: 3, dauer: 20 }, reha: { rpe: 3, dauer: 45 }, sonst: { rpe: 5, dauer: 30 },
};
export const MIN_SLOT = 1, MAX_SLOT = 9;
/** Höchstzahl weiterer Einheiten je Tag (zusätzlich zum Mannschaftstraining) */
export const MAX_UNITS_DAY = 4;

/** Schwerpunkte im Torwarttraining (alle Facetten: Technik, Taktik, Athletik, Spiel mit dem Ball, Kommunikation) */
export const TW_THEMES = ["grund", "fangen", "fallen", "hechten", "flanken", "eins", "fuss", "abwurf", "position", "reaktion", "strafraum", "elfmeter", "coaching", "athletik"] as const;
export type TwTheme = typeof TW_THEMES[number];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Einheit bereinigen (wie die Prüfungen in der Datenbank) */
export function cleanUnit(u: Partial<DayUnit> & { slot: number; art: UnitArt }): DayUnit {
  const art: UnitArt = UNIT_ARTS.includes(u.art) ? u.art : "sonst";
  const dauer = Math.round(Number(u.dauer) || UNIT_DEF[art].dauer);
  return {
    slot: Math.max(MIN_SLOT, Math.min(MAX_SLOT, Math.round(u.slot))), art,
    title: String(u.title || "").trim().slice(0, 60),
    zeit: HHMM.test(u.zeit || "") ? u.zeit! : "17:30",
    dauer: Math.max(5, Math.min(240, dauer)),
    rpe: u.rpe == null || !Number.isFinite(Number(u.rpe)) ? null : Math.max(0, Math.min(10, Math.round(Number(u.rpe)))),
    groupId: u.groupId || null, staffId: u.staffId || null,
    inhalt: String(u.inhalt || "").slice(0, 2000),
    themes: art === "tw" ? (u.themes || []).filter(x => (TW_THEMES as readonly string[]).includes(x)).slice(0, 8) : (u.themes || []).slice(0, 8).map(x => String(x).slice(0, 40)),
    cancel: !!u.cancel || undefined,
    from: u.from || null,
  };
}

/** Wiederkehrende Einheiten für diesen Tag (Wochentag, ab ihrem Startdatum) */
export const recurringOn = (S: TeamSettings, date: string): DayUnit[] =>
  (S.units?.[parse(date).getDay()] || []).filter(u => !u.from || u.from <= date);

/**
 * Wirksame Einheiten eines Tages: Einträge für den Tag ersetzen die wiederkehrende Einheit mit gleicher Nummer,
 * „abgesagt“ entfernt sie. Sortiert nach Uhrzeit.
 */
export function mergeUnits(recurring: DayUnit[], dated: DayUnit[]): DayUnit[] {
  const by = new Map<number, DayUnit>();
  for (const u of recurring) by.set(u.slot, u);
  for (const u of dated) by.set(u.slot, u);
  return [...by.values()].filter(u => !u.cancel).sort((a, b) => a.zeit < b.zeit ? -1 : a.zeit > b.zeit ? 1 : a.slot - b.slot);
}

/** Nächste freie Nummer an einem Tag (berücksichtigt auch abgesagte und wiederkehrende Einheiten) */
export function freeSlot(used: number[]): number | null {
  for (let s = MIN_SLOT; s <= MAX_SLOT; s++) if (!used.includes(s)) return s;
  return null;
}
/** Nächste freie Nummer für eine neue wiederkehrende Einheit an einem Wochentag */
export function freeWeeklySlot(S: TeamSettings, wd: number): number | null {
  return freeSlot((S.units?.[wd] || []).map(u => u.slot));
}
/** Nächste freie Nummer für eine zusätzliche Einheit an einem Tag (nicht belegt von Tageseinträgen oder wiederkehrenden Einheiten dieses Wochentags) */
export function freeDateSlot(D: Pick<TeamData, "units" | "team">, date: string): number | null {
  return freeSlot([...(D.team.settings.units?.[parse(date).getDay()] || []).map(u => u.slot), ...(D.units[date] || []).map(u => u.slot)]);
}

/** Torhüter: Position TW oder Mitglied einer Torhüter-Gruppe */
export const isGoalkeeper = (D: Pick<TeamData, "groups">, p: Player): boolean => p.pos === "TW" || inKind(D.groups, p, "tw");

/** Gehört der Spieler zu dieser Einheit? Gruppe = ihre Mitglieder; Torwarttraining ohne Gruppe = alle Torhüter; sonst alle */
export function inUnit(D: Pick<TeamData, "groups">, u: DayUnit, p: Player): boolean {
  if (u.groupId) return (p.groups || []).includes(u.groupId);
  if (u.art === "tw") return isGoalkeeper(D, p);
  return true;
}
export const unitMembers = (D: Pick<TeamData, "groups" | "players">, u: DayUnit): Player[] => D.players.filter(p => inUnit(D, u, p));

/** RPE-Eintrag einer Einheit (0 = Mannschaftstraining/Spiel) */
export const rpeEntry = (D: Pick<TeamData, "rpe" | "rpeU">, pid: string, date: string, slot = 0): RpeEntry | undefined =>
  slot ? D.rpeU[pid]?.[date]?.[slot] : D.rpe[pid]?.[date];

/** Alle RPE-Einträge eines Spielers an einem Tag (Einheit 0 zuerst) */
export function entriesOn(D: Pick<TeamData, "rpe" | "rpeU">, pid: string, date: string): { slot: number; e: RpeEntry }[] {
  const out: { slot: number; e: RpeEntry }[] = [];
  const m = D.rpe[pid]?.[date]; if (m) out.push({ slot: 0, e: m });
  for (const [s, e] of Object.entries(D.rpeU[pid]?.[date] || {})) out.push({ slot: Number(s), e });
  return out;
}

/** Sprünge/Hechtsprünge eines Torhüters in den letzten `days` Tagen (aus allen Einheiten) */
export function divesIn(D: Pick<TeamData, "rpe" | "rpeU">, pid: string, today: string, days: number): { sum: number; n: number } {
  let s = 0, n = 0;
  const add = (d: string, e: RpeEntry) => { if (d <= today && diff(d, today) < days && e.dives != null) { s += e.dives; n++; } };
  for (const [d, e] of Object.entries(D.rpe[pid] || {})) add(d, e);
  for (const [d, m] of Object.entries(D.rpeU[pid] || {})) for (const e of Object.values(m)) add(d, e);
  return { sum: s, n };
}

/**
 * Torwarttraining nach Spieltags-Bezug (Orientierung aus der Trainingspraxis, keine feste Vorgabe):
 * nach dem Spiel regenerieren, Mitte der Woche Kraft/Explosivität und spielnahe Situationen, kurz vor dem Spiel
 * Aktivierung mit wenigen, kurzen Aktionen (Frische). Ohne Spiel: Entwicklungsphase.
 */
export type TwPhase = "rec" | "light" | "power" | "game" | "tech" | "act" | "dev" | "match";
export function twPhase(md: string): TwPhase {
  if (md === "MD") return "match";
  if (md === "MD+1") return "rec";
  if (md === "MD+2" || md === "MD+3") return "light";
  if (md === "MD-1") return "act";
  if (md === "MD-2") return "tech";
  if (md === "MD-3") return "game";
  if (md === "MD-4" || md === "MD-5" || md === "MD-6") return "power";
  return "dev";
}
/** Richtwert: ab so vielen Sprüngen/Hechtsprüngen am Tag vor dem Spiel ein Hinweis (Frische für das Spiel) */
export const TW_DIVES_MD1 = 15;

/** Gründe für einen besonderen Trainingseindruck (Feldspieler und Torhüter) */
export const MARK_TAGS = {
  field: ["effort", "focus", "quality", "duels", "tempo", "ideas", "coach", "lead"],
  gk: ["catching", "diving", "crosses", "oneOnOne", "feet", "position", "voice", "effort"],
} as const;
export const markTagsFor = (gk: boolean): readonly string[] => gk ? MARK_TAGS.gk : MARK_TAGS.field;

export interface TrainingForm { good: number; poor: number; n: number; last: Rating[] }
/**
 * Trainingseindruck der letzten `days` Tage: Anzahl besonders guter/schwacher Einheiten und Anzahl besuchter
 * Einheiten (Durchschnitt = keine Markierung). Ohne Markierungen bleibt alles bei 0.
 */
export function trainingForm(D: Pick<TeamData, "ratings" | "att" | "sessions">, pid: string, today: string, days = 28, onlyVisible = false): TrainingForm {
  const marks = D.ratings.filter(r => r.pid === pid && r.kind === "training" && r.mark && r.date <= today && diff(r.date, today) < days && (!onlyVisible || r.vis))
    .sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.slot || 0) - (a.slot || 0));
  const n = D.sessions.filter(s => s.typ === "Training" && s.date <= today && diff(s.date, today) < days && D.att[s.date]?.[pid] === "da").length;
  return { good: marks.filter(r => r.mark === "good").length, poor: marks.filter(r => r.mark === "poor").length, n, last: marks.slice(0, 6) };
}

/** Herkunft einer Einheit an einem Tag: aus dem Wochenrhythmus, für den Tag geändert oder nur an diesem Tag */
export function originOf(D: Pick<TeamData, "units" | "team">, date: string, slot: number): "weekly" | "changed" | "extra" {
  const weekly = recurringOn(D.team.settings, date).some(u => u.slot === slot), dated = (D.units[date] || []).some(u => u.slot === slot);
  return dated ? (weekly ? "changed" : "extra") : "weekly";
}
/** Uhrzeit „HH:MM“ um Minuten verschieben (innerhalb des Tages) */
export function shiftTime(hhmm: string, min: number): string {
  const [h, m] = (hhmm || "00:00").split(":").map(Number), v = Math.max(0, Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + min));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}
