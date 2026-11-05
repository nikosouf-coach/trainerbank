// Kader-Nominierung fürs Spiel: Das Trainerteam stellt den Kader zusammen (im Kader oder auf Abruf), dazu Treffpunkt
// und Hinweis, und veröffentlicht ihn. Spieler sehen ihre Nominierung (und – wenn freigegeben – den ganzen Kader) und
// sagen zu oder ab, wenn das Trainerteam Absagen durch Spieler erlaubt (dieselbe Einstellung wie bei Trainings:
// settings.playerAbs), bis zum Anpfiff. Reine Logik; dieselben Grenzen prüft die Datenbank (match_squads,
// match_nominations, answer_nomination).
import { posGroup } from "./classes";
import { oneLine, paragraph } from "./text";
import type { Match, MatchSquad, NomAnswer, Nomination, Player, SquadMate, Team, TeamData } from "./types";

export const SQUAD_LIMITS = { place: 120, note: 500, reason: 200 } as const;

/** Uhrzeit „HH:MM“ oder null */
export const cleanTime = (v: unknown): string | null => {
  const m = String(v ?? "").trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h <= 23 && mi <= 59 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
};
/** Kader bereinigen (Treffpunkt, Hinweis, Sichtbarkeit) */
export function cleanSquad(x: { [K in keyof MatchSquad]?: unknown } & { matchId: string }): MatchSquad {
  return {
    matchId: x.matchId, meetTime: cleanTime(x.meetTime), meetPlace: oneLine(x.meetPlace, SQUAD_LIMITS.place),
    note: paragraph(x.note, SQUAD_LIMITS.note), showAll: x.showAll !== false, published: typeof x.published === "string" && x.published ? x.published : null,
  };
}
/** Grund einer Absage (eine Zeile, höchstens 200 Zeichen) */
export const cleanReason = (v: unknown): string => oneLine(v, SQUAD_LIMITS.reason);

/** Nominierungen eines Spiels (Reihenfolge wie gespeichert) */
export const nomsOf = (D: Pick<TeamData, "noms">, matchId: string): Nomination[] => D.noms.filter(n => n.matchId === matchId);
/** Nominierung eines Spielers für ein Spiel */
export const nomOf = (D: Pick<TeamData, "noms">, matchId: string, pid: string): Nomination | null => D.noms.find(n => n.matchId === matchId && n.pid === pid) || null;

export interface SquadCounts { squad: number; standby: number; yes: number; no: number; open: number }
/** Zahlen: im Kader, auf Abruf, Zusagen, Absagen, offen (Zu-/Absagen über Kader und Abruf) */
export function squadCounts(noms: Nomination[]): SquadCounts {
  return {
    squad: noms.filter(n => !n.standby).length, standby: noms.filter(n => n.standby).length,
    yes: noms.filter(n => n.answer === "yes").length, no: noms.filter(n => n.answer === "no").length, open: noms.filter(n => !n.answer).length,
  };
}

/** Anpfiff als lokale Zeit (ohne Uhrzeit: Ende des Spieltags) */
export function kickoff(m: Pick<Match, "date" | "zeit">): Date {
  const [y, mo, d] = m.date.split("-").map(Number);
  const t = /^\d{2}:\d{2}$/.test(m.zeit || "") ? m.zeit : "23:59";
  const [h, mi] = t.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi);
}
/** Dürfen Spieler (noch) zu- oder absagen? Einstellung „Absagen durch Spieler“ und bis zum Anpfiff */
export const answersAllowed = (team: Pick<Team, "settings">, m: Pick<Match, "date" | "zeit">, now: Date): boolean =>
  (team.settings.playerAbs ?? true) && now.getTime() < kickoff(m).getTime();

/** Liegt für den Tag eine Abwesenheit vor? (Urlaub, krank, verletzt …) */
export const absentOn = (D: Pick<TeamData, "absences">, pid: string, date: string) =>
  D.absences.find(a => a.pid === pid && a.von <= date && (!a.bis || a.bis >= date)) || null;

/** Reihenfolge im Kader: Torhüter, Abwehr, Mittelfeld, Sturm; darin nach Rückennummer, dann Name */
const GROUP_ORDER = ["TW", "Abwehr", "Mittelfeld", "Sturm"];
export const squadSort = (a: Pick<Player, "pos" | "nr" | "vn" | "nn">, b: Pick<Player, "pos" | "nr" | "vn" | "nn">): number =>
  GROUP_ORDER.indexOf(posGroup(a.pos)) - GROUP_ORDER.indexOf(posGroup(b.pos)) || (a.nr ?? 1000) - (b.nr ?? 1000) || `${a.vn} ${a.nn}`.localeCompare(`${b.vn} ${b.nn}`, "de");

/** Kurzname für die Kaderliste der Spieler: Vorname und Initial („Luca B.“) */
export const mateName = (p: Pick<Player, "vn" | "nn">): string => `${p.vn.trim()} ${(p.nn.trim()[0] || "").toUpperCase()}${p.nn.trim() ? "." : ""}`.trim();
/** Kaderliste wie für Spieler (Demo: aus den Teamdaten; sonst lädt sie der Server über squad_mates) */
export function squadMatesOf(D: Pick<TeamData, "players" | "noms">, matchId: string): SquadMate[] {
  return nomsOf(D, matchId).map(n => ({ n, p: D.players.find(p => p.id === n.pid) })).filter(x => !!x.p)
    .sort((a, b) => Number(a.n.standby) - Number(b.n.standby) || squadSort(a.p!, b.p!))
    .map(({ n, p }) => ({ pid: n.pid, name: mateName(p!), nr: p!.nr ?? null, pos: p!.pos, standby: n.standby }));
}

export interface MySquad { m: Match; sq: MatchSquad; nom: Nomination; mates: SquadMate[] }
/**
 * Veröffentlichte Kader kommender Spiele (ab heute), in denen der Spieler nominiert ist: eigene Nominierung und – wenn
 * freigegeben – die Kaderliste. Wer nicht nominiert ist, sieht nichts (das sagt ihm das Trainerteam persönlich).
 */
export function mySquads(D: Pick<TeamData, "matches" | "squads" | "noms" | "squadMates">, pid: string, today: string): MySquad[] {
  return D.matches.filter(m => m.date >= today && !m.result).map(m => {
    const sq = D.squads[m.id], nom = nomOf(D, m.id, pid);
    if (!sq || !sq.published || !nom) return null;
    return { m, sq, nom, mates: sq.showAll ? D.squadMates[m.id] || [] : [] };
  }).filter((x): x is MySquad => !!x).sort((a, b) => (a.m.date + a.m.zeit < b.m.date + b.m.zeit ? -1 : 1));
}

/** Nominierte mit Konto ohne Antwort (Erinnerung als Nachricht) */
export const openWithAccount = (D: Pick<TeamData, "players" | "noms">, matchId: string): Player[] =>
  nomsOf(D, matchId).filter(n => !n.answer).map(n => D.players.find(p => p.id === n.pid)).filter((p): p is Player => !!p && !!p.userId);

/**
 * Text für die Ankündigung im Chat: Spiel, Treffpunkt, Kader (Vorname und Initial, nach Mannschaftsteilen), auf Abruf,
 * Hinweis – und ob zu-/abgesagt werden soll.
 */
export function squadAnnouncement(m: Match, sq: MatchSquad, D: Pick<TeamData, "players" | "noms">, tr: { t: (k: string) => string; tf: (k: string, o: Record<string, string | number>) => string },
  when: string, allowAnswers: boolean): string {
  const { t, tf } = tr;
  const mates = squadMatesOf(D, m.id), line = (L: SquadMate[]) => L.map(x => (x.nr != null ? `#${x.nr} ` : "") + x.name).join(", ");
  const main = mates.filter(x => !x.standby), sb = mates.filter(x => x.standby);
  const out = [tf("nm_chatHead", { w: when, g: m.gegner }), ""];
  if (sq.meetTime || sq.meetPlace) out.push(`${t("nm_meet")}: ${[sq.meetTime ? tf("nm_clock", { t: sq.meetTime }) : "", sq.meetPlace].filter(Boolean).join(" · ")}`);
  if (sq.showAll) {
    out.push(`${tf("nm_chatSquad", { n: main.length })}: ${line(main) || "–"}`);
    if (sb.length) out.push(`${t("nm_standby")}: ${line(sb)}`);
  } else out.push(t("nm_chatPrivate"));
  if (sq.note) out.push("", sq.note);
  out.push("", t(allowAnswers ? "nm_chatAnswer" : "nm_chatInfo"));
  return out.join("\n");
}

/** Antwort eines Spielers übernehmen (bereinigt: Grund nur bei Absage) */
export const applyAnswer = (n: Nomination, answer: NomAnswer | null, reason: string, at: string, byStaff: boolean): Nomination =>
  ({ ...n, answer, reason: answer === "no" ? cleanReason(reason) : "", at: answer ? at : null, byStaff: answer ? byStaff : false });
