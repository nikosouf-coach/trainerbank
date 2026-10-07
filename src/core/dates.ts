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
