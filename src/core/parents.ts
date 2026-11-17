// Eltern-Zugang (Teil 1): Verknüpfung Elternkonto ↔ Kind, was Eltern sehen und tun dürfen.
// Datenschutz: Eltern bekommen vom Server nur ein Paket fürs eigene Kind (Team ohne Codes, Termine im Zeitfenster,
// Abwesenheiten ohne Stufe und Hinweis, Nominierung mit Treffpunkt ohne Kaderliste, Foto-Erlaubnis, eigene
// Einwilligungen, Elterninfo) – keine Belastung, Gesundheitsdetails, Noten, Notizen, Chats oder Daten anderer Kinder.
// Zugang nur, solange das Kind minderjährig ist (ein volljähriges Kind kann ihn selbst verlängern).
import { ageAt, validBirth } from "./birthdays";
import { addDays } from "./dates";
import type { Engine } from "./engine";
import type { AbsenceType, GuardianInvite, GuardianLink, GuardianRelation, Match, MatchSquad, Nomination, ParentPost, Player, TeamData } from "./types";

export const GUARDIAN_RELATIONS: GuardianRelation[] = ["mother", "father", "guardian"];
/** Was Eltern selbst eintragen dürfen – Verletzungen und Details trägt das Trainerteam ein */
export const PARENT_ABS_TYPES: AbsenceType[] = ["krank", "urlaub", "schule", "sonst"];
export const MAX_GUARDIANS = 2;
/** Demo: Konto des Demo-Elternteils */
export const DEMO_PARENT = "demo-parent";
export const POST_TITLE_MAX = 120, POST_BODY_MAX = 4000, GUARDIAN_NAME_MAX = 60;

/** Code wie eingegeben → XXXXX-XXXXX (Groß-/Kleinschreibung, Leerzeichen und Striche egal) */
export function cleanInviteCode(s: string | null | undefined): string {
  const x = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return x.length === 10 ? `${x.slice(0, 5)}-${x.slice(5)}` : x;
}
export const inviteCodeOk = (s: string): boolean => /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/.test(cleanInviteCode(s));

/** Minderjährig (Geburtsdatum bekannt, unter 18) – ohne Geburtsdatum keine Einladung */
export const isMinor = (p: Pick<Player, "geb"> | undefined, today: string): boolean => !!p && validBirth(p.geb, today) && ageAt(p.geb, today) < 18;
/** Unter 16: Einwilligungen geben die Eltern (Art. 8 DSGVO) */
export const isUnder16 = (p: Pick<Player, "geb"> | undefined, today: string): boolean => !!p && validBirth(p.geb, today) && ageAt(p.geb, today) < 16;

export interface GuardianState {
  links: GuardianLink[]; invite: GuardianInvite | undefined;
  minor: boolean; birth: boolean; canInvite: boolean; pending: number;
}
/** Stand je Spieler fürs Trainerteam */
export function guardianState(D: Pick<TeamData, "players" | "guardians" | "guardianInvites">, pid: string, today: string): GuardianState {
  const p = D.players.find(x => x.id === pid);
  const links = D.guardians.filter(g => g.pid === pid).sort((a, b) => a.at.localeCompare(b.at));
  const invite = D.guardianInvites.find(i => i.pid === pid && i.expires > new Date(today + "T00:00:00").toISOString() && i.usesLeft > 0);
  const birth = !!p && validBirth(p.geb, today), minor = isMinor(p, today);
  return { links, invite, minor, birth, canInvite: minor && links.length < MAX_GUARDIANS, pending: links.filter(g => g.status === "pending").length };
}

/** Offene Anfragen im Team (warten auf Bestätigung) */
export const pendingGuardians = (D: Pick<TeamData, "guardians">): GuardianLink[] => D.guardians.filter(g => g.status === "pending");

/** Elterninfo: wer gelesen bzw. bestätigt hat und wer fehlt (bestätigte Eltern minderjähriger bzw. verlängerter Kinder) */
export function postStats(D: Pick<TeamData, "players" | "guardians" | "parentReads">, post: ParentPost, today: string) {
  const audience = D.guardians.filter(g => g.status === "active" && (g.adultOk || isMinor(D.players.find(p => p.id === g.pid), today)));
  const users = [...new Set(audience.map(g => g.userId))];
  const reads = D.parentReads.filter(r => r.postId === post.id && users.includes(r.userId));
  const readers = new Set(reads.map(r => r.userId)), ackers = new Set(reads.filter(r => r.ackedAt).map(r => r.userId));
  const missing = audience.filter(g => !(post.needAck ? ackers : readers).has(g.userId));
  return { total: users.length, read: readers.size, acked: ackers.size, missing };
}

export function cleanPost(x: Partial<ParentPost> & { id: string }): ParentPost {
  return {
    id: x.id, title: String(x.title ?? "").replace(/\s+/g, " ").trim().slice(0, POST_TITLE_MAX),
    body: String(x.body ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, POST_BODY_MAX),
    needAck: x.needAck === true, author: x.author || "", at: x.at || "", readAt: x.readAt ?? null, ackedAt: x.ackedAt ?? null,
  };
}

export type ParentAbsErr = "type" | "from" | "to" | "consent";
/** Abmelden durch Eltern: erlaubte Art, ab höchstens 7 Tage zurück, bis höchstens 90 Tage; „krank“ braucht die Einwilligung */
export function parentAbsenceErrors(a: { typ: AbsenceType; von: string; bis: string | null }, today: string, health: boolean): ParentAbsErr[] {
  const e: ParentAbsErr[] = [];
  if (!PARENT_ABS_TYPES.includes(a.typ)) e.push("type");
  if (!a.von || a.von < addDays(today, -7) || a.von > addDays(today, 365)) e.push("from");
  if (a.bis && a.von && (a.bis < a.von || a.bis > addDays(a.von, 90))) e.push("to");
  if (a.typ === "krank" && !health) e.push("consent");
  return e;
}

// ---------------------------------------------------------------------
// Eltern-Ansicht: Termine des Kindes
// ---------------------------------------------------------------------
export type ChildItemKind = "training" | "match" | "event";
export interface ChildItem {
  date: string; time: string; kind: ChildItemKind; title: string;
  match?: Match; nom?: Nomination; squad?: MatchSquad;
  /** abgemeldet bzw. abwesend an dem Tag */
  absent: boolean;
}
/** Termine der nächsten Tage fürs Kind: Training, Spiele, Termine (nach Uhrzeit), mit Abwesenheit und Nominierung */
export function childAgenda(E: Engine, pid: string, days = 14): ChildItem[] {
  const D = E.D, L: ChildItem[] = [];
  for (let k = 0; k < days; k++) {
    const d = addDays(E.TODAY, k), absent = !!E.absenceOn(pid, d), m = E.matchOn(d);
    if (m) {
      const nom = D.noms.find(n => n.matchId === m.id && n.pid === pid), squad = D.squads[m.id];
      L.push({ date: d, time: m.zeit, kind: "match", title: m.gegner, match: m, nom, squad: squad && squad.published ? squad : undefined, absent });
    }
    for (const ev of E.eventsOn(d)) L.push({ date: d, time: ev.zeit || "", kind: "event", title: ev.titel, absent });
    if (E.isTraining(d) && !m) L.push({ date: d, time: E.zeitOf(d), kind: "training", title: "", absent });
  }
  return L.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Was Eltern erledigen sollten: offene Zu-/Absagen, zu bestätigende Elterninfos, fehlende Einwilligungen (unter 16) */
export function parentTodo(E: Engine, pid: string, posts: ParentPost[], consents: { parental: boolean; health: boolean }) {
  const open = childAgenda(E, pid, 14).filter(x => x.nom && x.squad && !x.nom.answer && !x.absent).length;
  const ack = posts.filter(p => p.needAck && !p.ackedAt).length, unread = posts.filter(p => !p.readAt).length;
  const u16 = isUnder16(E.P(pid), E.TODAY);
  const consent = u16 && (!consents.parental || !consents.health) ? 1 : 0;
  return { open, ack, unread, consent, total: open + ack + consent };
}

// ---------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------
export function demoParentPosts(lang: "de" | "en", now: Date): ParentPost[] {
  const en = lang === "en", at = (d: number, h: number) => { const x = new Date(now); x.setDate(x.getDate() - d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  return [
    { id: "dpp1", title: en ? "Parents' evening on Friday" : "Elternabend am Freitag", needAck: true, author: "Nikolas S.", at: at(1, 18),
      body: en ? "Friday, 7 pm in the clubhouse: season plan, training camp and kit. Please confirm that you have read this." : "Freitag, 19 Uhr im Vereinsheim: Saisonplan, Trainingslager und Ausrüstung. Bitte bestätigt kurz, dass ihr die Info gelesen habt." },
    { id: "dpp2", title: en ? "New training jackets" : "Neue Trainingsjacken", needAck: false, author: "Nikolas S.", at: at(9, 20),
      body: en ? "The new training jackets have arrived – we hand them out at the next training session. Please check the size with your child in the app." : "Die neuen Trainingsjacken sind da – wir geben sie beim nächsten Training aus. Bitte prüft mit eurem Kind die Größe in der App." },
  ];
}
