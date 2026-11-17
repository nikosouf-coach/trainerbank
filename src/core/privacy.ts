// Datenschutz in der Fachlogik: Gesundheitsdaten eines Spielers aus dem Stand im Speicher entfernen – genau wie
// public.erase_health_data() auf dem Server (Migration 20261105000010_loeschung.sql). Genutzt beim Löschen durch das
// Trainerteam (Widerruf einer schriftlichen Einwilligung) und im Demo-Modus.
import type { GroupKind, TeamData } from "./types";

/** Gruppen, deren Mitgliedschaft auf Gesundheitsdaten beruht (Reha, Aufbau, Wachstumsschub) */
export const HEALTH_GROUPS: GroupKind[] = ["reha", "build", "growth"];

/** Entfernt die Gesundheitsdaten eines Spielers (ohne Befunde: deren Dateien löscht die App einzeln).
 *  Abwesenheiten wegen Krankheit oder Verletzung bleiben für die Anwesenheit als „Sonstiges“ ohne Stufe, Ort und Notiz.
 *  Ergebnis: Anzahl entfernter oder geänderter Einträge. */
export function eraseHealthLocal(D: TeamData, pid: string): number {
  let n = 0;
  const drop = <T>(rec: Record<string, T>): void => {
    const v = rec[pid] as unknown;
    if (v == null) return;
    n += Array.isArray(v) ? v.length : typeof v === "object" ? Object.keys(v as object).length || 1 : 1;
    delete rec[pid];
  };
  drop(D.rpe); drop(D.rpeU); drop(D.well); drop(D.extra); drop(D.growth); drop(D.emergencyMed);
  const msgs = D.msgs[pid];
  if (msgs) {
    const keep = msgs.filter(m => m.typ !== "pause" && m.typ !== "regen");
    n += msgs.length - keep.length;
    if (keep.length) D.msgs[pid] = keep; else delete D.msgs[pid];
  }
  const p = D.players.find(x => x.id === pid);
  if (p) {
    if (p.kg != null) { p.kg = null; n++; }
    const health = new Set(D.groups.filter(g => g.kind && HEALTH_GROUPS.includes(g.kind)).map(g => g.id));
    const groups = (p.groups || []).filter(g => !health.has(g));
    if (p.groups && groups.length !== p.groups.length) { n += p.groups.length - groups.length; p.groups = groups; }
  }
  for (const a of D.absences) {
    if (a.pid !== pid || (a.typ !== "krank" && a.typ !== "verletzung")) continue;
    a.typ = "sonst"; a.stufe = null; a.notiz = ""; a.area = null; n++;
  }
  return n;
}
