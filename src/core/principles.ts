// Trainingsprinzipien: Spieltags-Bezug (MD-Logik), Beispielwoche aus Trainingstagen und Spieltag, Plausibilitäts-
// Hinweise und Bereinigung gespeicherter Prinzipien. Eine Regel für alles – Wochenplan und Einrichtung rechnen gleich.
import { KINDS, MDS, PR_ROWS, defaultPrinciples } from "./classes";
import type { BuiltinKind, Group, Kind, Principle, Principles } from "./types";

/** Länge der eigenen Beschreibung je Spieltags-Bezug */
export const PR_NOTE_MAX = 300;

/**
 * Spieltags-Bezug aus dem Abstand zum letzten (after) und zum nächsten Spiel (before), in Tagen.
 * Erholung geht vor: Bis zu zwei Tage nach einem Spiel gilt MD+1/MD+2 (sofern das nächste Spiel nicht näher ist),
 * danach wird bis zum nächsten Spiel heruntergezählt (MD-6 … MD-1). In einer normalen Woche mit einem Spiel sind
 * MD+1/MD+2 deshalb dieselben Tage wie rechnerisch MD-6/MD-5 – MD-6 und MD-5 gibt es nur bei mehr als 7 Tagen
 * zwischen zwei Spielen. Ohne nahes nächstes Spiel: MD+3, sonst kein Bezug ("").
 */
export function mdLabel(after: number, before: number): string {
  if (after === 0 || before === 0) return "MD";
  if (after <= 2 && after < before) return "MD+" + after;
  if (before <= 6) return "MD-" + before;
  if (after <= 3) return "MD+" + after;
  return "";
}

/** Spieltags-Bezug eines Wochentags (0 = So … 6 = Sa), wenn jede Woche am selben Tag gespielt wird */
export function mdInWeek(wd: number, spieltag: number): string {
  const after = (((wd - spieltag) % 7) + 7) % 7;
  return after ? mdLabel(after, 7 - after) : "MD";
}

export interface WeekDay { wd: number; md: string; train: boolean; match: boolean }
/** Beispielwoche Mo–So: Spieltags-Bezug je Tag, ob trainiert wird und ob gespielt wird */
export function exampleWeek(spieltag: number, days: number[]): WeekDay[] {
  return [1, 2, 3, 4, 5, 6, 0].map(wd => ({ wd, md: mdInWeek(wd, spieltag), match: wd === spieltag, train: wd !== spieltag && days.includes(wd) }));
}

/**
 * Zeilen der Prinzipien geordnet nach der Woche: zuerst die Trainingstage der normalen Woche in der Reihenfolge ab dem
 * Spiel (MD+1, MD+2, MD-4 …), dann alle übrigen Bezüge (greifen bei verschobenem Spieltag, englischen Wochen oder
 * längeren Pausen). `wd` = Wochentag in der Beispielwoche (nur bei Zeilen der Woche).
 */
export function principleRows(spieltag: number, days: number[]): { week: { md: string; wd: number }[]; other: string[] } {
  const week: { md: string; wd: number }[] = [];
  for (let i = 1; i <= 6; i++) {
    const wd = (spieltag + i) % 7;
    if (days.includes(wd)) { const md = mdInWeek(wd, spieltag); if (!week.some(x => x.md === md)) week.push({ md, wd }); }
  }
  return { week, other: MDS.filter(md => !week.some(x => x.md === md)) };
}

/** Abstand zum Spiel in Tagen aus dem Bezug ("MD+1" → +1, "MD-4" → -4, "MD" → 0) */
export const mdOffset = (md: string): number => md === "MD" ? 0 : Number(md.slice(2)) || 0;

const LIGHT_KINDS: Kind[] = ["regen", "aktiv", "technik", "schnell"];
export type PrincipleHint =
  | { k: "hard2"; a: number; b: number }
  | { k: "md1"; rpe: number }
  | { k: "md2"; rpe: number }
  | { k: "kindHigh"; md: string; kind: Kind; rpe: number }
  | { k: "kindLow"; md: string; kind: Kind; rpe: number }
  | { k: "noHard" };

/**
 * Plausibilitäts-Hinweise für die normale Woche (nur Hinweise – der Trainer entscheidet):
 * zwei harte Tage hintereinander, harter Tag direkt vor dem Spiel, Art und Intensität passen nicht zusammen,
 * kein einziger intensiver Reiz in der Woche.
 */
export function principleHints(pr: Principles, spieltag: number, days: number[]): PrincipleHint[] {
  const wk = exampleWeek(spieltag, days), out: PrincipleHint[] = [];
  const at = (md: string): Principle | undefined => pr[md];
  const hard = (d: WeekDay): boolean => { const p = at(d.md); return d.train && !!p && p.kind !== "frei" && p.rpe >= 7; };
  // Reihenfolge ab dem Tag nach dem Spiel (Woche als Kreis)
  const order = [1, 2, 3, 4, 5, 6].map(i => wk.find(d => d.wd === (spieltag + i) % 7)!);
  for (let i = 1; i < order.length; i++) if (hard(order[i - 1]) && hard(order[i])) { out.push({ k: "hard2", a: order[i - 1].wd, b: order[i].wd }); break; }
  const tr = order.filter(d => d.train && at(d.md) && at(d.md)!.kind !== "frei");
  const p1 = tr.find(d => d.md === "MD-1"), p2 = tr.find(d => d.md === "MD-2");
  if (p1 && at("MD-1")!.rpe >= 6) out.push({ k: "md1", rpe: at("MD-1")!.rpe });
  if (p2 && at("MD-2")!.rpe >= 7) out.push({ k: "md2", rpe: at("MD-2")!.rpe });
  for (const md of PR_ROWS) {
    const p = at(md); if (!p || md === "MD") continue;
    if (LIGHT_KINDS.includes(p.kind) && p.rpe >= 7) out.push({ k: "kindHigh", md, kind: p.kind, rpe: p.rpe });
    else if (p.kind === "intensiv" && p.rpe > 0 && p.rpe <= 4) out.push({ k: "kindLow", md, kind: p.kind, rpe: p.rpe });
  }
  if (tr.length >= 2 && !tr.some(d => at(d.md)!.rpe >= 6)) out.push({ k: "noHard" });
  return out;
}

const BUILTIN: BuiltinKind[] = [...KINDS, "kids", "spiel"];
const validKind = (k: unknown): k is Kind => typeof k === "string" && (BUILTIN.includes(k as BuiltinKind) || /^c:[A-Za-z0-9_-]{1,40}$/.test(k));

/** Gespeicherte Prinzipien bereinigen: unbekannte Arten → Empfehlung, RPE 0–10 ganzzahlig, Beschreibung gekürzt */
export function cleanPrinciples(raw: unknown, grp: Group): Principles {
  const def = defaultPrinciples(grp), src = raw && typeof raw === "object" ? raw as Record<string, Partial<Principle>> : {}, out: Principles = {};
  for (const md of PR_ROWS) {
    const r = src[md], d = def[md];
    if (!r || typeof r !== "object") { out[md] = d; continue; }
    const kind = md === "MD" ? d.kind : validKind(r.kind) ? r.kind : d.kind;
    const n = Number(r.rpe), rpe = kind === "frei" ? 0 : Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : d.rpe;
    const p: Principle = { kind, rpe };
    const note = typeof r.note === "string" ? r.note.trim().slice(0, PR_NOTE_MAX) : "";
    if (note) p.note = note;
    out[md] = p;
  }
  return out;
}
