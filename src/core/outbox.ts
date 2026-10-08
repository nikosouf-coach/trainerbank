// Offline-Warteschlange: Einträge, die ohne Netz gemacht wurden, werden hier gesammelt und später in
// derselben Reihenfolge gesendet. Reine Logik ohne React/Datenbank – Speichern und Senden macht der Store.
// Grundsatz: Was der Nutzer sieht, ist sofort lokal übernommen (applyOp); nach einem Neuladen vom Server
// werden noch wartende Einträge erneut angewendet, damit nichts „verschwindet“.
import type { Absence, AttStatus, Extra, RpeEntry, TeamData, Wellness } from "./types";

export type OutboxOp =
  | { op: "rpe"; pid: string; date: string; e: RpeEntry | null }
  | { op: "well"; pid: string; date: string; w: Wellness }
  | { op: "extra"; pid: string; x: Extra }
  | { op: "extraDel"; pid: string; id: string }
  | { op: "abs"; a: Absence }
  | { op: "absDel"; id: string }
  | { op: "att"; date: string; pid: string; st: AttStatus | null }
  | { op: "task"; id: string; done: boolean; at: string | null };

export interface OutboxItem {
  /** Team, zu dem der Eintrag gehört (nur dort wird er angewendet und gesendet) */
  team: string;
  /** Zeitpunkt der Eingabe auf dem Gerät (ISO) – zählt für Fristen, nicht der Zeitpunkt des Sendens */
  at: string;
  /** Sendeversuche (für die Anzeige; Netzfehler zählen, Fehler des Servers entfernen den Eintrag) */
  tries: number;
  o: OutboxOp;
}

/** Höchstzahl wartender Einträge (ältere fallen weg – schützt Speicher und Reihenfolge) */
export const OUTBOX_MAX = 200;
/** Wartende Einträge verfallen nach so vielen Tagen (z. B. Gerät lange offline) */
export const OUTBOX_DAYS = 14;

/** Gleicher Schlüssel = derselbe Datensatz; ein neuerer Eintrag ersetzt den älteren. */
export function outboxKey(o: OutboxOp): string {
  switch (o.op) {
    case "rpe": return `rpe:${o.pid}:${o.date}`;
    case "well": return `well:${o.pid}:${o.date}`;
    case "extra": return `extra:${o.x.id}`;
    case "extraDel": return `extra:${o.id}`;
    case "abs": return `abs:${o.a.id}`;
    case "absDel": return `abs:${o.id}`;
    case "att": return `att:${o.date}:${o.pid}`;
    case "task": return `task:${o.id}`;
  }
}

/** Neue, noch nie gesendete Datensätze bekommen eine eigene ID vom Gerät (Präfix „c-“ + UUID). */
export const isClientId = (id: string): boolean => id.startsWith("c-");
export const isUnsent = (id: string): boolean => id.startsWith("tmp-") || isClientId(id);

/** UUID v4 ohne Abhängigkeiten (für IDs, die schon auf dem Gerät feststehen müssen) */
export function uuid4(rnd: () => number = Math.random): string {
  const h = (n: number): string => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");
  const v = (8 + Math.floor(rnd() * 4)).toString(16);
  return `${h(8)}-${h(4)}-4${h(3)}-${v}${h(3)}-${h(12)}`;
}

/**
 * Eintrag anhängen. Ersetzt einen wartenden Eintrag mit gleichem Schlüssel (der Zeitpunkt der ersten Eingabe
 * bleibt für Fristen erhalten). Löschen eines noch nicht gesendeten Datensatzes entfernt ihn einfach.
 */
export function enqueue(list: OutboxItem[], item: OutboxItem): OutboxItem[] {
  const key = outboxKey(item.o);
  const prev = list.find(x => x.team === item.team && outboxKey(x.o) === key);
  let rest = list.filter(x => !(x.team === item.team && outboxKey(x.o) === key));
  if ((item.o.op === "extraDel" || item.o.op === "absDel") && isUnsent(item.o.id)) return rest;
  const keepAt = prev && item.o.op === "rpe" && item.o.e && prev.o.op === "rpe" && prev.o.e ? prev.at : item.at;
  rest = [...rest, { ...item, at: keepAt }];
  return rest.length > OUTBOX_MAX ? rest.slice(rest.length - OUTBOX_MAX) : rest;
}

/** Abgelaufene Einträge (älter als OUTBOX_DAYS) entfernen */
export function prune(list: OutboxItem[], now: Date): OutboxItem[] {
  const limit = now.getTime() - OUTBOX_DAYS * 86400e3;
  return list.filter(x => { const t = Date.parse(x.at); return Number.isFinite(t) && t >= limit; });
}

/** Änderung lokal übernehmen (dieselbe Logik für sofortige Anzeige und für erneutes Anwenden nach dem Laden). */
export function applyOp(D: TeamData, o: OutboxOp): void {
  switch (o.op) {
    case "rpe":
      if (o.e) (D.rpe[o.pid] ||= {})[o.date] = o.e; else if (D.rpe[o.pid]) delete D.rpe[o.pid][o.date];
      // Wer Belastung einträgt, war da (wie der Trigger in der Datenbank)
      if (o.e && D.sessions.some(s => s.date === o.date) && !D.att[o.date]?.[o.pid]) (D.att[o.date] ||= {})[o.pid] = "da";
      return;
    case "well": (D.well[o.pid] ||= {})[o.date] = o.w; return;
    case "extra": {
      const L = (D.extra[o.pid] ||= []); const i = L.findIndex(x => x.id === o.x.id);
      if (i >= 0) L[i] = o.x; else L.push(o.x); return;
    }
    case "extraDel": D.extra[o.pid] = (D.extra[o.pid] || []).filter(x => x.id !== o.id); return;
    case "abs": { const i = D.absences.findIndex(x => x.id === o.a.id); if (i >= 0) D.absences[i] = { ...D.absences[i], ...o.a }; else D.absences.push(o.a); return; }
    case "absDel": D.absences = D.absences.filter(x => x.id !== o.id); return;
    case "att": if (o.st) (D.att[o.date] ||= {})[o.pid] = o.st; else if (D.att[o.date]) delete D.att[o.date][o.pid]; return;
    case "task": { const x = D.tasks.find(y => y.id === o.id); if (x) { x.done = o.done; x.doneAt = o.done ? o.at : null; } return; }
  }
}

/** Alle wartenden Einträge eines Teams anwenden (nach dem Laden vom Server oder aus dem Gerätespeicher) */
export function applyOutbox(D: TeamData, list: OutboxItem[], team: string): number {
  let n = 0;
  for (const it of list) if (it.team === team) { applyOp(D, it.o); n++; }
  return n;
}

/** Tmp-IDs neuer Datensätze vor dem Einreihen durch feste Geräte-IDs ersetzen (Senden wird wiederholbar). */
export function withClientId(o: OutboxOp, rnd?: () => number): OutboxOp {
  if (o.op === "extra" && o.x.id.startsWith("tmp-")) return { ...o, x: { ...o.x, id: "c-" + uuid4(rnd) } };
  if (o.op === "abs" && o.a.id.startsWith("tmp-")) return { ...o, a: { ...o.a, id: "c-" + uuid4(rnd) } };
  return o;
}

/** Erkennt Netzfehler (kein Empfang, Zeitüberschreitung) – nur diese landen in der Warteschlange. */
export function isNetworkMessage(msg: string | undefined | null): boolean {
  return /failed to fetch|network request failed|networkerror|fetch failed|load failed|internet connection appears to be offline|err_internet|err_network|timed? ?out|econn|enotfound|socket|aborted/i.test(msg || "");
}
