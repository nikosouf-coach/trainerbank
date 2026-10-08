// Rechte im Trainerteam: einzelne Rechte je Mitglied, Vorlagen je Funktion (Co-Trainer, Torwarttrainer …).
// Durchgesetzt wird serverseitig (RLS, supabase/migrations/…17_rechte.sql); die App blendet passend aus.
// Grundsatz: Wer ein Recht nicht hat, für den wirken die zugehörigen Module wie ausgeschaltet.
import type { StaffRoleKey, TeamData } from "./types";

export type Perm = "health" | "medical" | "plan" | "squad" | "perf" | "notes" | "messages" | "tasks" | "cash" | "admin";
export const PERMS: Perm[] = ["health", "medical", "plan", "squad", "perf", "notes", "messages", "tasks", "cash", "admin"];
export const ALL_PERMS: ReadonlySet<Perm> = new Set(PERMS);

/** Standardrechte je Rolle in team_staff (identisch mit public.default_perms in der Datenbank) */
export function defaultPerms(role: string | null | undefined): Perm[] {
  switch (role) {
    case "owner": return [...PERMS];
    case "coach": return ["health", "plan", "squad", "perf", "notes", "messages", "tasks"];
    case "physio": return ["health", "medical", "perf", "messages"];
    default: return [];
  }
}

/** Vorlagen nach Funktion im Trainerteam (Trainerprofil) – Ausgangspunkt, danach einzeln anpassbar */
export const PERM_PRESETS: Record<StaffRoleKey, Perm[]> = {
  chef: [...PERMS],
  co: ["health", "plan", "squad", "perf", "notes", "messages", "tasks"],
  tw: ["health", "plan", "perf", "notes", "messages"],
  athletik: ["health", "plan", "perf", "messages"],
  physio: ["health", "medical", "perf", "messages"],
  betreuer: ["squad", "tasks", "cash", "messages"],
  analyst: ["plan", "perf", "notes"],
};
/** Rolle in team_staff passend zur Funktion (Physio = physio, sonst coach) */
export const accessRoleFor = (r: StaffRoleKey): "coach" | "physio" => r === "physio" ? "physio" : "coach";

/** Wirksame Rechte: Owner immer alle, sonst gespeicherte Rechte oder Standard der Rolle; nur bekannte Schlüssel */
export function effectivePerms(role: string | null | undefined, perms?: readonly string[] | null): Set<Perm> {
  if (role === "owner") return new Set(PERMS);
  if (role !== "coach" && role !== "physio") return new Set();
  const src = perms ?? defaultPerms(role);
  return new Set(src.filter((p): p is Perm => ALL_PERMS.has(p as Perm)));
}
export const samePerms = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && [...a].sort().join() === [...b].sort().join();
/** Passt die Auswahl genau zu einer Vorlage? */
export function presetOf(perms: readonly string[]): StaffRoleKey | null {
  const hit = (Object.keys(PERM_PRESETS) as StaffRoleKey[]).find(k => samePerms(PERM_PRESETS[k], perms));
  return hit ?? null;
}

/**
 * Sicht eines Trainers ohne einzelne Rechte: Module wirken ausgeschaltet. Mit `strip` (nur Demo – echte Daten
 * filtert die Datenbank) werden die Daten selbst entfernt, damit die Vorschau genau zeigt, was die Person sieht.
 * Gibt bei vollen Rechten dasselbe Objekt zurück.
 */
export function viewFor(D: TeamData, perms: ReadonlySet<Perm>, strip: boolean): TeamData {
  const health = perms.has("health"), medical = perms.has("medical"), notes = perms.has("notes");
  if (health && medical && notes) return D;
  const m = { ...D.team.modules };
  if (!health) { m.belastung = false; m.regeneration = false; m.wachstum = false; }
  if (!medical) m.befunde = false;
  const V: TeamData = { ...D, team: { ...D.team, modules: m } };
  if (strip) {
    if (!health) { V.rpe = {}; V.well = {}; V.extra = {}; V.growth = {}; }
    if (!medical) V.findings = [];
    if (!notes) V.notes = {};
  }
  return V;
}

/** Welches Recht braucht eine Änderung an Teamdaten/Einstellungen? (wie public.teams_perm_guard – nur echte Änderungen zählen) */
export function teamPatchPerms(patch: Record<string, unknown>, before: Record<string, unknown> & { settings: object }): Perm[] {
  const need = new Set<Perm>(), same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);
  const ps = patch.settings as Record<string, unknown> | undefined;
  if (ps) {
    const a = before.settings as Record<string, unknown>;
    for (const k of new Set([...Object.keys(a), ...Object.keys(ps)])) {
      if (same(a[k], ps[k])) continue;
      need.add(["days", "dauer", "fix", "spieltag", "anstoss"].includes(k) ? "plan" : k === "duties" || k === "fines" ? "tasks" : k === "tests" || k === "testRank" ? "perf" : k === "kasse" ? "cash" : "admin");
    }
  }
  if ("principles" in patch && !same(patch.principles, before.principles)) need.add("plan");
  for (const k of ["club", "name", "accent", "cls", "depth", "modules", "logo", "timezone"]) if (k in patch && !same(patch[k], before[k])) need.add("admin");
  return [...need];
}
