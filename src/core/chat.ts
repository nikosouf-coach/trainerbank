// Chat im Team: Teamchat, Trainerteam, Gruppen, Einzel- und eigene Chats. Reine Logik (Rechte nach den Einstellungen,
// Titel, Ungelesen, Kinderschutz) – die Datenbank prüft dieselben Regeln (Migration …23_chat.sql).
//
// Kinderschutz-Grundsätze (u. a. Empfehlungen des DFB und der Deutschen Sportjugend): Kommunikation mit Minderjährigen
// möglichst transparent in Gruppen; keine „geheimen“ Einzelchats zwischen Trainer und Kind – in Jugendteams sieht das
// Trainerteam deshalb Einzelchats zwischen Trainer und Spieler mit. Nachrichten lassen sich melden und löschen.
import { groupOf } from "./classes";
import { iso } from "./dates";
import type { Chat, ChatMsg, ChatPerson, ChatSettings, ClassKey, Player, TeamData } from "./types";

/** Standard je Altersklasse: Jugend – Einzelchats nur mit dem Trainerteam, Trainerteam liest mit; Senioren – frei */
export function chatDefaults(cls: ClassKey): ChatSettings {
  const youth = groupOf(cls) !== "akt";
  return { on: true, dm: youth ? "staff" : "all", transparent: youth, teamReadOnly: false };
}
export const chatSettings = (team: { cls: ClassKey; settings: { chat?: ChatSettings } }): ChatSettings => ({ ...chatDefaults(team.cls), ...(team.settings.chat || {}) });
export const isYouth = (cls: ClassKey): boolean => groupOf(cls) !== "akt";

/** Darf ich mit dieser Person einen Einzelchat starten? */
export function canDirect(st: ChatSettings, me: ChatPerson["kind"], other: ChatPerson["kind"]): boolean {
  if (!st.on || st.dm === "off") return false;
  if (me === "staff" || other === "staff") return true;
  return st.dm === "all";
}
/** Wird ein Einzelchat vom Trainerteam mitgelesen? (Jugend: zwischen Trainerteam und Spieler) */
export const isTransparentPair = (st: ChatSettings, a: ChatPerson["kind"], b: ChatPerson["kind"]): boolean => st.transparent && (a === "staff") !== (b === "staff");

/** Anzeigename eines Spielers im Chat (Vorname + Initial – Datensparsamkeit) */
export const chatNameOf = (p: Pick<Player, "vn" | "nn">): string => (p.vn + (p.nn ? " " + p.nn.trim()[0] + "." : "")).trim();

/** Schlüssel eines Einzelchats (sortierte Konten) – eindeutig je Team */
export const pairKey = (a: string, b: string): string => [a, b].sort().join(":");

/** Titel eines Chats aus Sicht des Nutzers */
export function chatTitle(c: Chat, D: Pick<TeamData, "chatPeople" | "groups" | "team">, me: string, t: (k: string) => string): string {
  switch (c.kind) {
    case "team": return D.team.name || t("ch_team");
    case "staff": return t("ch_staff");
    case "group": return D.groups.find(g => g.id === c.groupId)?.name || c.title || t("ch_group");
    case "direct": {
      const nm = (u: string | undefined) => D.chatPeople.find(p => p.uid === u)?.name || "–";
      // Mitlesen (Kinderschutz): beide Namen
      if (!c.members.includes(me)) return c.members.length ? c.members.map(nm).join(" ↔ ") : t("ch_direct");
      const other = c.members.find(u => u !== me);
      return D.chatPeople.find(p => p.uid === other)?.name || c.title || t("ch_direct");
    }
    default: return c.title || t("ch_custom");
  }
}
export const msgsOf = (D: Pick<TeamData, "chatMsgs">, chatId: string): ChatMsg[] => D.chatMsgs[chatId] || [];
/** Ungelesen: Nachrichten anderer nach dem eigenen Lesestand */
export function unreadOf(D: Pick<TeamData, "chatMsgs" | "chatRead">, chatId: string, me: string): number {
  const r = D.chatRead[chatId] || "";
  return msgsOf(D, chatId).filter(m => m.at > r && m.uid !== me && !m.deleted).length;
}
export const totalUnread = (D: Pick<TeamData, "chats" | "chatMsgs" | "chatRead">, me: string): number => D.chats.reduce((a, c) => a + unreadOf(D, c.id, me), 0);
/** Chats sortiert: neueste Nachricht zuerst; Teamchat und Trainerteam ohne Nachrichten oben */
export function sortChats(D: Pick<TeamData, "chats" | "chatMsgs">): Chat[] {
  const last = (c: Chat): string => msgsOf(D, c.id).at(-1)?.at || c.lastAt || "";
  const rank = (c: Chat): number => c.kind === "team" ? 0 : c.kind === "staff" ? 1 : 2;
  return [...D.chats].sort((a, b) => (last(b) || "").localeCompare(last(a) || "") || rank(a) - rank(b));
}
/** Nachricht einfügen (sortiert, ohne Doppelungen – auch wenn Echtzeit und eigene Antwort gleichzeitig kommen) */
export function putMsg(D: Pick<TeamData, "chatMsgs">, m: ChatMsg): void {
  const L = (D.chatMsgs[m.chatId] ||= []), i = L.findIndex(x => x.id === m.id);
  if (i >= 0) L[i] = { ...L[i], ...m };
  else { L.push(m); L.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0); }
}
/** Höchstlänge einer Nachricht */
export const MSG_MAX = 4000;
export const REACTIONS = ["👍", "✅", "❤️", "😂", "💪", "👏"];
/** Nachrichtentext bereinigen (Leerzeichen am Rand, Länge) – leer = nicht senden */
export const cleanBody = (s: string): string => s.replace(/\s+$/g, "").replace(/^\s+/g, "").slice(0, MSG_MAX);
/** Links im Text erkennen (zum Antippen) */
export const LINK_RE = /(https?:\/\/[^\s]+)/g;
/** Darf ich in diesem Chat schreiben? (Ankündigungen: nur Trainerteam) */
export const canWrite = (c: Chat, staff: boolean): boolean => !c.readOnly || staff;
/** Kalendertag (lokal) einer Nachricht – für Tagesüberschriften */
export const dayOf = (at: string): string => { const d = new Date(at); return Number.isFinite(d.getTime()) ? iso(d) : at.slice(0, 10); };
/** Uhrzeit „HH:MM“ (lokal) */
export const timeOf = (at: string): string => { const d = new Date(at); return Number.isFinite(d.getTime()) ? String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : ""; };

// ---------- Rechte wie in der Datenbank (für die Demo und die Oberfläche) ----------
/** Ankündigungs-Chat? (eigener Schalter am Chat oder Teamchat laut Einstellung) */
export const readOnlyOf = (c: Chat, st: ChatSettings): boolean => c.readOnly || (c.kind === "team" && st.teamReadOnly);
/** Teilnehmer: Teamchat alle, Trainerteam-Chat nur Staff, Gruppen-Chat Staff + Mitglieder der freigegebenen Gruppe, sonst Mitglieder */
export function isParticipant(D: Pick<TeamData, "groups" | "players" | "chatPeople">, c: Chat, me: string): boolean {
  const p = D.chatPeople.find(x => x.uid === me); if (!p) return false;
  switch (c.kind) {
    case "team": return true;
    case "staff": return p.kind === "staff";
    case "group": {
      if (p.kind === "staff") return true;
      const g = D.groups.find(x => x.id === c.groupId), pl = D.players.find(x => x.id === p.pid);
      return !!g && !!g.vis && !!pl && (pl.groups || []).includes(g.id);
    }
    default: return c.members.includes(me);
  }
}
/** Liest das Trainerteam mit? (transparenter Einzel-/eigener Chat, Recht „messages“, kein Mitglied) */
export const isObserver = (c: Chat, me: string, canModerate: boolean): boolean => (c.kind === "direct" || c.kind === "custom") && c.transparent && canModerate && !c.members.includes(me);
/** Darf ich lesen? (ausgeschaltet: nur das Trainerteam behält den Verlauf) */
export function canRead(D: Pick<TeamData, "groups" | "players" | "chatPeople" | "team">, c: Chat, me: string, canModerate: boolean): boolean {
  const staff = D.chatPeople.find(x => x.uid === me)?.kind === "staff";
  return (isParticipant(D, c, me) && (chatSettings(D.team).on || !!staff)) || isObserver(c, me, canModerate);
}
/** Darf ich schreiben? (Chat an, Teilnehmer, Ankündigungen nur Staff, Einzelchats nur, solange erlaubt) */
export function canSend(D: Pick<TeamData, "groups" | "players" | "chatPeople" | "team">, c: Chat, me: string): boolean {
  const st = chatSettings(D.team), meP = D.chatPeople.find(x => x.uid === me);
  if (!st.on || !meP || !isParticipant(D, c, me)) return false;
  if (readOnlyOf(c, st) && meP.kind !== "staff") return false;
  if (c.kind === "direct") {
    if (st.dm === "off") return false;
    if (st.dm === "staff" && !c.members.some(u => D.chatPeople.find(x => x.uid === u)?.kind === "staff")) return false;
  }
  return true;
}
/** Chats, die ich sehe (Demo: wie die Zugriffsregeln der Datenbank) */
export const visibleChats = (D: TeamData, me: string, canModerate: boolean): Chat[] => D.chats.filter(c => canRead(D, c, me, canModerate));
/** Vorschau der letzten Nachricht in der Liste */
export function previewOf(m: ChatMsg | undefined, me: string, t: (k: string) => string, tf: (k: string, o: Record<string, string | number>) => string, group: boolean): string {
  if (!m) return "";
  const body = m.deleted ? t("ch_deleted") : m.body.replace(/\s+/g, " ").slice(0, 90);
  if (m.uid === me) return tf("ch_lastYou", { t: body });
  return group ? (m.name.split(" ")[0] || m.name) + ": " + body : body;
}
/** Personen im Team für den Chat (Demo; echt: Funktion chat_directory) – Trainerteam mit Namen, Spieler „Vorname N.“ */
export function demoPeople(D: Pick<TeamData, "staff" | "players">): ChatPerson[] {
  return [
    ...D.staff.map(s => ({ uid: s.userId || "demo-" + s.id, name: s.name, kind: "staff" as const, pid: null, role: s.role })),
    ...D.players.filter(p => p.active !== false).map(p => ({ uid: p.userId || "demo-p-" + p.id, name: chatNameOf(p), kind: "player" as const, pid: p.id, role: null })),
  ];
}
/** Wer ist „ich“ im Chat? (Konto; Demo: Spieler bzw. gewähltes Trainerprofil) */
export function demoMe(D: Pick<TeamData, "staff" | "players">, view: "coach" | "player", pid: string | null, staffId: string | null, userId: string): string {
  if (view === "player") { const p = D.players.find(x => x.id === pid); return p ? p.userId || "demo-p-" + p.id : ""; }
  if (staffId) { const s = D.staff.find(x => x.id === staffId); if (s) return s.userId || "demo-" + s.id; }
  return userId;
}
/** Gruppen-Chats, die ich öffnen kann: freigegebene Gruppen (Spieler: nur eigene) */
export function openableGroups(D: Pick<TeamData, "groups" | "players" | "chatPeople">, me: string): TeamData["groups"] {
  const p = D.chatPeople.find(x => x.uid === me); if (!p) return [];
  const pl = p.pid ? D.players.find(x => x.id === p.pid) : undefined;
  return D.groups.filter(g => !!g.vis && (p.kind === "staff" || (pl?.groups || []).includes(g.id)));
}
/** Personen für einen neuen Einzelchat (nach Einstellung) */
export function directTargets(D: Pick<TeamData, "chatPeople" | "team">, me: string): ChatPerson[] {
  const st = chatSettings(D.team), meP = D.chatPeople.find(x => x.uid === me); if (!meP) return [];
  return D.chatPeople.filter(p => p.uid !== me && canDirect(st, meP.kind, p.kind)).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "staff" ? -1 : 1) || a.name.localeCompare(b.name));
}
/** Darf ich eigene Gruppen anlegen? (Trainerteam immer, Spieler nur bei Einzelchats für alle) */
export const canCustom = (D: Pick<TeamData, "chatPeople" | "team">, me: string): boolean => {
  const st = chatSettings(D.team), k = D.chatPeople.find(x => x.uid === me)?.kind;
  return st.on && (k === "staff" || (k === "player" && st.dm === "all"));
};
/** Reaktion umschalten (lokal) */
export function toggleReaction(m: ChatMsg, emoji: string, me: string): boolean {
  const L = m.reactions[emoji] || [], on = !L.includes(me);
  m.reactions = { ...m.reactions, [emoji]: on ? [...L, me] : L.filter(u => u !== me) };
  if (!m.reactions[emoji].length) { const r = { ...m.reactions }; delete r[emoji]; m.reactions = r; }
  return on;
}

// ---------- Ordner ----------
/** Vorgegebene Ordner: eigene Einzelchats, Gruppen (Team, Trainerteam, Gruppen, eigene Gruppen), nur mitlesen */
export type ChatFolderKey = "mine" | "groups" | "read";
export const CHAT_FOLDERS: ChatFolderKey[] = ["mine", "groups", "read"];
/** Eigener Ordner: Name und zugeordnete Chats */
export interface ChatFolder { id: string; name: string; chats: string[] }
/** Ordner-Einstellungen eines Kontos (umbenannt, ausgeblendet, eigene Ordner) */
export interface ChatFolderPrefs { names?: Partial<Record<ChatFolderKey, string>>; hide?: ChatFolderKey[]; custom?: ChatFolder[] }
/** Grenzen (die Einstellungen des Kontos sind auf 8 KB begrenzt) */
export const CF_LIMITS = { name: 30, custom: 10, ids: 100 };

/** In welchen vorgegebenen Ordner gehört ein Chat? */
export const folderOf = (c: Chat, me: string, canModerate: boolean): ChatFolderKey =>
  isObserver(c, me, canModerate) ? "read" : c.kind === "direct" ? "mine" : "groups";

/** Gespeicherte Ordner bereinigen: Namen gekürzt, nur gültige Schlüssel, höchstens 10 eigene Ordner und 100 Chats insgesamt */
export function cleanChatFolders(raw: unknown): ChatFolderPrefs {
  const r = raw && typeof raw === "object" ? raw as ChatFolderPrefs : {}, out: ChatFolderPrefs = {};
  const nm = (x: unknown): string => typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, CF_LIMITS.name) : "";
  const names: Partial<Record<ChatFolderKey, string>> = {};
  for (const k of CHAT_FOLDERS) { const n = nm(r.names?.[k]); if (n) names[k] = n; }
  if (Object.keys(names).length) out.names = names;
  const hide = Array.isArray(r.hide) ? CHAT_FOLDERS.filter(k => r.hide!.includes(k)) : [];
  if (hide.length) out.hide = hide;
  let budget = CF_LIMITS.ids; const ids = new Set<string>();
  const custom = (Array.isArray(r.custom) ? r.custom : []).filter(f => f && typeof f === "object" && typeof f.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(f.id) && !ids.has(f.id) && ids.add(f.id))
    .slice(0, CF_LIMITS.custom).map(f => {
      const chats = [...new Set((Array.isArray(f.chats) ? f.chats : []).filter(x => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)))];
      const keep = chats.slice(0, Math.max(0, budget)); budget -= keep.length;
      return { id: f.id, name: nm(f.name) || "…", chats: keep };
    });
  if (custom.length) out.custom = custom;
  return out;
}
