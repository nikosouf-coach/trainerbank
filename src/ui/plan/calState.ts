// Gemeinsamer Kalender-Zustand für Kalender und Planung (aktuelle Woche, Monat, Ansicht, hervorgehobener Tag).
import { useEffect, useState } from "react";
import { iso, monday, monthStart } from "../../core/dates";

export interface CalState { week: string; month: string; view: "woche" | "monat"; flash: string | null }

const today = iso(new Date());
let state: CalState = { week: monday(today), month: monthStart(today), view: "woche", flash: null };
const subs = new Set<(s: CalState) => void>();

export function setCal(p: Partial<CalState>): void {
  state = { ...state, ...p };
  subs.forEach(f => f(state));
}
/** Springt in Woche und Monat zu einem Datum und hebt den Tag kurz hervor. */
export function jumpTo(date: string): void {
  setCal({ week: monday(date), month: monthStart(date), flash: date });
  setTimeout(() => { if (state.flash === date) setCal({ flash: null }); }, 2500);
}
export function useCal(): CalState {
  const [s, setS] = useState(state);
  useEffect(() => { subs.add(setS); setS(state); return () => { subs.delete(setS); }; }, []);
  return s;
}
