// Trainingstag: Ablauf (Blöcke) mit Uhrzeiten, Summen und Zuständigkeiten.
import { addDays } from "./dates";
import type { CrewRole, DayBlock, TeamData } from "./types";

/** Blöcke eines Tages in Reihenfolge */
export const dayBlocks = (D: TeamData, date: string): DayBlock[] => D.blocks.filter(b => b.date === date).sort((a, b) => a.sort - b.sort);

const toMin = (hhmm: string): number => { const [h, m] = (hhmm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const fmt = (n: number): string => `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export interface TimedBlock { b: DayBlock; from: string; to: string; parallel: boolean }
/**
 * Uhrzeiten ab Trainingsbeginn. Blöcke für eine Gruppe (z. B. Torhüter) laufen parallel zum
 * vorherigen Mannschaftsblock und verschieben die Zeit nicht.
 */
export function timeline(blocks: DayBlock[], start: string): TimedBlock[] {
  let t = toMin(start), lastStart = t;
  return blocks.map(b => {
    if (b.groupId) { const from = lastStart; return { b, from: fmt(from), to: fmt(from + b.min), parallel: true }; }
    const from = t; t += b.min; lastStart = from;
    return { b, from: fmt(from), to: fmt(t), parallel: false };
  });
}
/** verplante Minuten der Mannschaft (ohne parallele Gruppenblöcke) */
export const blocksTotal = (blocks: DayBlock[]): number => blocks.filter(b => !b.groupId).reduce((a, b) => a + b.min, 0);

/** Blöcke, für die ein Trainer zuständig ist (ab heute, chronologisch) */
/** Zuständigkeiten eines Blocks (ältere Blöcke: nur der Hauptverantwortliche ohne Aufgabe) */
export const crewOf = (b: Pick<DayBlock, "staffId" | "crew">): CrewRole[] => b.crew && b.crew.length ? b.crew : b.staffId ? [{ staffId: b.staffId, task: "" }] : [];
/** Ist der Trainer in diesem Block zuständig (Hauptverantwortlich oder mit eigener Aufgabe)? */
export const isMyBlock = (b: Pick<DayBlock, "staffId" | "crew">, staffId: string): boolean => crewOf(b).some(x => x.staffId === staffId);
/** Aufgabe des Trainers in diesem Block („“ = ohne eigene Aufgabe) */
export const myTask = (b: Pick<DayBlock, "staffId" | "crew">, staffId: string): string => crewOf(b).find(x => x.staffId === staffId)?.task || "";
export const myBlocks = (D: TeamData, staffId: string, from: string, days = 7): DayBlock[] =>
  D.blocks.filter(b => isMyBlock(b, staffId) && b.date >= from && b.date <= addDays(from, days)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.sort - b.sort);
/** Zuständigkeiten bereinigen: ohne leere Einträge und Doppelte, Aufgabe höchstens 80 Zeichen, höchstens 6 */
export const cleanCrew = (L: CrewRole[]): CrewRole[] =>
  L.filter((x, i, a) => !!x.staffId && a.findIndex(y => y.staffId === x.staffId) === i).slice(0, 6).map(x => ({ staffId: x.staffId, task: x.task.trim().slice(0, 80) }));

