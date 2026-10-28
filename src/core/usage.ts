// Nutzung der App im Team (Seite „Nutzung“, für den Piloten und später für Vereine): Registrierungen, RPE-Quote,
// Morgen-Check-Quote, erfasste Anwesenheit und geplante Trainings je Woche – nur Zahlen für das ganze Team, nie für
// einzelne Spieler. Die Ziele stammen aus dem Fahrplan der Testphase.
// Reine Berechnung: Anzeige in app/coach/nutzung.tsx.
import { addDays, diff, monday } from "./dates";
import type { Engine } from "./engine";
import type { Player } from "./types";

export interface Ratio { n: number; of: number }
export interface UsageWeek {
  /** Montag der Woche */
  ws: string;
  /** gezählte Tage (laufende Woche: bis heute) */
  days: number;
  /** RPE eingetragen von Anwesenden der Mannschaftstrainings (null = keine Anwesenheit erfasst) */
  rpe: Ratio | null;
  /** Morgen-Checks der Spieler mit App-Konto je Tag (null = niemand hat ein Konto) */
  well: Ratio | null;
  /** Mannschaftstrainings mit erfasster Anwesenheit (null = kein Training) */
  att: Ratio | null;
  /** Mannschaftstrainings, die das Trainerteam selbst geplant hat – Inhalt, Art, RPE oder Dauer angepasst oder Ablauf
   * angelegt (null = kein Training); der automatische Wochenplan allein zählt nicht */
  plan: Ratio | null;
}
export interface Usage { players: number; registered: number; weeks: UsageWeek[] }

/** Ziele im Piloten: registriert ≥ 90 %, RPE ≥ 75 %, Morgen-Check ≥ 50 %, Anwesenheit und Planung jede Woche */
export const USAGE_GOALS = { registered: 0.9, rpe: 0.75, well: 0.5, att: 1, plan: 1 } as const;
export type UsageKey = keyof typeof USAGE_GOALS;

/** Anteil (0–1) bzw. null */
export const share = (r: Ratio | null): number | null => r && r.of > 0 ? r.n / r.of : null;
/** Bewertung gegen das Ziel: erreicht, knapp darunter (bis 15 Prozentpunkte) oder deutlich darunter */
export function toneOf(k: UsageKey, v: number | null): "ok" | "warn" | "crit" | null {
  if (v == null) return null;
  const g = USAGE_GOALS[k];
  return v >= g - 1e-9 ? "ok" : v >= g - 0.15 ? "warn" : "crit";
}

/** Nutzung der letzten Wochen (neueste zuerst). registered: hat der Spieler ein App-Konto? */
export function usageOf(E: Engine, weeks = 4, registered: (p: Player) => boolean = p => !!p.userId): Usage {
  const D = E.D, today = E.TODAY;
  const players = D.players.filter(p => p.active !== false), ids = new Set(players.map(p => p.id));
  const reg = players.filter(registered);
  const out: UsageWeek[] = [];
  for (let k = 0; k < weeks; k++) {
    const ws = addDays(monday(today), -7 * k), we = addDays(ws, 6), end = we < today ? we : today;
    const days = diff(ws, end) + 1;
    const trainings = D.sessions.filter(s => s.typ === "Training" && s.date >= ws && s.date <= end);
    const taken = trainings.filter(s => Object.keys(D.att[s.date] || {}).some(pid => ids.has(pid)));
    let present = 0, rpe = 0;
    for (const s of taken) for (const [pid, st] of Object.entries(D.att[s.date])) {
      if (st !== "da" || !ids.has(pid)) continue;
      present++; if (D.rpe[pid]?.[s.date]) rpe++;
    }
    let well = 0;
    for (const p of reg) for (const d of Object.keys(D.well[p.id] || {})) if (d >= ws && d <= end) well++;
    const planned = trainings.filter(s => {
      const o = D.over[s.date];
      return !!o && (!!o.inhalt?.trim() || !!o.kind || o.rpe != null || o.dauer != null) || D.blocks.some(b => b.date === s.date);
    });
    out.push({
      ws, days,
      rpe: present ? { n: rpe, of: present } : null,
      well: reg.length ? { n: Math.min(well, reg.length * days), of: reg.length * days } : null,
      att: trainings.length ? { n: taken.length, of: trainings.length } : null,
      plan: trainings.length ? { n: planned.length, of: trainings.length } : null,
    });
  }
  return { players: players.length, registered: reg.length, weeks: out };
}
