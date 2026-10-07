import { de } from "../i18n/de";
import { en } from "../i18n/en";
import type { Dict } from "../i18n/types";
import type { Lang } from "./types";

const DICTS: Record<Lang, Dict> = { de, en };

export interface Translator {
  lang: Lang;
  /** Text zum Schlüssel (fällt auf Deutsch und dann auf den Schlüssel zurück). */
  t: (k: string) => string;
  /** Listen-Texte wie Wochentage. */
  tl: (k: string) => string[];
  /** Text mit Platzhaltern {name}. */
  tf: (k: string, o: Record<string, string | number>) => string;
  num: (x: number, d: number) => string;
  int: (x: number) => string;
}

export function translator(lang: Lang): Translator {
  const d = DICTS[lang] || de;
  const raw = (k: string): string | string[] | undefined => d[k] ?? de[k];
  const t = (k: string): string => { const v = raw(k); return typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : k; };
  const tl = (k: string): string[] => { const v = raw(k); return Array.isArray(v) ? v : []; };
  const tf = (k: string, o: Record<string, string | number>): string => t(k).replace(/\{(\w+)\}/g, (_m, x: string) => String(o[x] ?? ""));
  const num = (x: number, dd: number): string => lang === "en" ? x.toFixed(dd) : x.toFixed(dd).replace(".", ",");
  const int = (x: number): string => Math.round(x).toLocaleString(lang === "en" ? "en-GB" : "de-DE");
  return { lang, t, tl, tf, num, int };
}

/** Für Formulare und Tests: alle Schlüssel einer Sprache. */
export const dictKeys = (lang: Lang): string[] => Object.keys(DICTS[lang]);
export { DICTS };
