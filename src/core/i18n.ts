import { de as deBase } from "../i18n/de";
import { en as enBase } from "../i18n/en";
import { de_app } from "../i18n/de_app";
import { en_app } from "../i18n/en_app";
import { de_coach } from "../i18n/de_coach";
import { en_coach } from "../i18n/en_coach";
import { de_player } from "../i18n/de_player";
import { de_squad } from "../i18n/de_squad";
import { en_player } from "../i18n/en_player";
import { en_squad } from "../i18n/en_squad";
import { de_prep } from "../i18n/de_prep";
import { en_prep } from "../i18n/en_prep";
import { de_more } from "../i18n/de_more";
import { en_more } from "../i18n/en_more";
import { de_steer } from "../i18n/de_steer";
import { en_steer } from "../i18n/en_steer";
import { de_reha } from "../i18n/de_reha";
import { en_reha } from "../i18n/en_reha";
import type { Dict } from "../i18n/types";
import type { Lang } from "./types";

const de: Dict = { ...deBase, ...de_app, ...de_coach, ...de_squad, ...de_player, ...de_prep, ...de_more, ...de_steer, ...de_reha };
const en: Dict = { ...enBase, ...en_app, ...en_coach, ...en_squad, ...en_player, ...en_prep, ...en_more, ...en_steer, ...en_reha };
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
