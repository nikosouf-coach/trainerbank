// Datumshilfen. Alle Kalendertage als ISO-String "YYYY-MM-DD" in lokaler Zeit.

export const pad = (n: number): string => String(n).padStart(2, "0");
export const iso = (d: Date): string => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const parse = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number): string => { const x = parse(s); x.setDate(x.getDate() + n); return iso(x); };
const utc = (s: string): number => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
/** Tage von a nach b (b - a). */
export const diff = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 864e5);
export const monday = (s: string): string => addDays(s, -((parse(s).getDay() + 6) % 7));
export const kwOf = (s: string): number => {
  const d = new Date(utc(s)), day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - y0) / 864e5 + 1) / 7);
};
/** Datum + Uhrzeit "HH:MM" als lokaler Zeitpunkt. */
export const at = (date: string, hhmm?: string | null): Date => {
  const [h, m] = (hhmm || "19:30").split(":").map(Number);
  const d = parse(date); d.setHours(h, m || 0, 0, 0); return d;
};
export const monthStart = (s: string): string => s.slice(0, 8) + "01";
// ---------- Uhrzeit eintippen (Feld mit festem Doppelpunkt: Stunde | Minuten) ----------
/** „19:30“ → ["19", "30"] (Stunde zweistellig); sonst leer */
export const timeParts = (v: string): [string, string] => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ""); return m ? [m[1].padStart(2, "0"), m[2]] : ["", ""]; };
/** Ganze Uhrzeit, getippt oder eingefügt: „19:30“, „7.30“, „19 30“, „19h30“, „1930“, „730“ → [Stunde, Minuten (ggf. unvollständig)] */
export function splitTime(s: string): [string, string] | null {
  const sep = /^\s*(\d{1,2})\s*[:.,h ]\s*(\d{0,2})\s*$/i.exec(s);
  if (sep) return [sep[1], sep[2]];
  const d = s.replace(/\D/g, "");
  if (d.length < 3) return null;
  return +d.slice(0, 2) < 24 ? [d.slice(0, 2), d.slice(2, 4)] : [d.slice(0, 1), d.slice(1, 3)];
}
/** Ergebnis einer Eingabe: Stunde, Minuten und ob es zu den Minuten weitergeht */
export interface TimeTyped { h: string; m: string; next: boolean }
function fullTime([h0, m0]: [string, string]): TimeTyped | null {
  const h = h0.padStart(2, "0"); if (+h > 23) return null;
  let m = m0;
  if (m.length === 1 && +m > 5) m = "0" + m;
  if (m.length === 2 && +m > 59) m = "";
  return { h, m, next: m.length < 2 };
}
/**
 * Eingabe ins Stundenfeld: eine Ziffer 0–2 wartet, 3–9 ist fertig (07), zwei Ziffern bis 23 sind fertig, eine
 * ungültige zweite Ziffer (25) beginnt neu; eine ganze Zeit wird aufgeteilt. null = verwerfen (z. B. „25:30“).
 */
export function typeHours(s: string, m: string): TimeTyped | null {
  const sp = splitTime(s); if (sp) return fullTime(sp);
  const d = s.replace(/\D/g, "");
  if (!d) return { h: "", m, next: false };
  if (d.length === 1) return +d > 2 ? { h: "0" + d, m, next: true } : { h: d, m, next: false };
  if (+d < 24) return { h: d, m, next: true };
  const n = d[1];
  return +n > 2 ? { h: "0" + n, m, next: true } : { h: n, m, next: false };
}
/** Eingabe ins Minutenfeld: 0–5 wartet, 6–9 ist fertig (07); in ein volles Feld getippt beginnt es mit der neuen Ziffer neu */
export function typeMinutes(s: string, h: string): TimeTyped | null {
  if (/[:.,h ]/i.test(s)) { const sp = splitTime(s); if (sp) return fullTime(sp); }
  let d = s.replace(/\D/g, "");
  if (d.length > 2 || (d.length === 2 && +d > 59)) d = d.slice(-1);
  return { h, m: d.length === 1 && +d > 5 ? "0" + d : d, next: false };
}
/** Angefangene Zeit ergänzen: „19“ → 19:00, „7“ → 07:00, „19“ + „3“ → 19:03; null ohne gültige Stunde */
export function completeTime(h: string, m: string): string | null {
  if (!h) return null;
  const hh = h.padStart(2, "0"), mm = m.padStart(2, "0");
  return +hh < 24 && +mm < 60 ? hh + ":" + mm : null;
}
export const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export function ageOn(geb: string, now: Date): number {
  const b = parse(geb); let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}
/** Kleiner deterministischer Zufallsgenerator (für Demo-Daten). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
