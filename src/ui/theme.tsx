// Farben, Abstände und Typografie (Erscheinungsbild „Trainerbank“, Leitfaden: docs/DESIGN.md). Hell/Dunkel: wie das
// System oder fest gewählt (Konto → Darstellung). Neutraltöne mit einem Hauch Grün-Grau (Kreide auf Rasen), Farbe nur mit
// Bedeutung: Statusfarben für Belastung und Gesundheit, die Vereinsfarbe (Akzent) für das Wichtigste einer Seite.
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import type { ThemeMode } from "../data/api";

export interface Colors {
  bg: string; surface: string; sunk: string; ink: string; muted: string; line: string;
  /** Dritte Textstufe: Pfeile, Platzhalter, Nebensächliches */
  faint: string;
  ok: string; warn: string; hot: string; crit: string; low: string; build: string; inj: string; event: string;
  accent: string; accentTx: string; accentInk: string; accentSoft: string; overlay: string;
  /** Vereinsfarbe für Spielerkreise auf dem Feld (helle Farben wie Weiß/Silber bleiben hier hell) */
  club: string; clubInk: string;
}

/** Markenfarben (Logo, Startbildschirm, Vorgabe ohne Verein) */
export const BRAND = { green: "#0d6b4b", greenDark: "#3fbf8a", ink: "#121815", paper: "#f2f4f3", night: "#0d1110" };

// Statusfarben im hellen Modus so dunkel, dass sie als Schrift auf ihrer eigenen Tönung lesbar bleiben (≥ 4,5 : 1)
const LIGHT = { bg: "#f2f4f3", surface: "#ffffff", sunk: "#e8ecea", ink: "#121815", muted: "#5e6964", line: "#dce1de", faint: "#8d9792", ok: "#17794f", warn: "#94620b", hot: "#ad4e1d", crit: "#bb372c", low: "#2d67c0", build: "#6a7470", inj: "#7652ad", event: "#5a54c6", overlay: "rgba(10,16,13,0.44)" };
const DARK = { bg: "#0d1110", surface: "#161b19", sunk: "#202623", ink: "#e9eeeb", muted: "#95a19b", line: "#2a312e", faint: "#6c7772", ok: "#3db57f", warn: "#e0a640", hot: "#ec7d4a", crit: "#ee6a57", low: "#75a3ec", build: "#7e8883", inj: "#aa8cd9", event: "#9f93ea", overlay: "rgba(0,0,0,0.64)" };

function hexToRgb(h: string): [number, number, number] {
  const x = h.replace("#", ""); const v = x.length === 3 ? x.split("").map(c => c + c).join("") : x.padEnd(6, "0");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number): string => "#" + [r, g, b].map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("");
/** Mischt Farbe a mit b (t = Anteil von b). */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const withAlpha = (hex: string, a: number): string => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const lum = (hex: string): number => { const [r, g, b] = hexToRgb(hex); return (r * 299 + g * 587 + b * 114) / 1000; };
/** Helle Farbe (Weiß, Silber, Gelb …) – braucht dunkle Schrift und auf Weiß einen Rand */
export const isLight = (hex: string): boolean => /^#[0-9a-f]{6}$/i.test(hex) && lum(hex) > 185;
/** Lesbare Schriftfarbe auf einer Farbfläche */
export const inkOn = (hex: string): string => (/^#[0-9a-f]{6}$/i.test(hex) && lum(hex) > 160 ? "#111111" : "#ffffff");

export function makeColors(dark: boolean, accent: string): Colors {
  const base = dark ? DARK : LIGHT;
  const raw = /^#[0-9a-f]{6}$/i.test(accent) ? accent : BRAND.green;
  // Dunkle Vereinsfarben (Navy, Schwarz) im Dunkelmodus etwas aufhellen, damit Knöpfe auf Schwarz sichtbar bleiben;
  // sehr helle (Weiß, Silber) im hellen Modus zu Graphit abdunkeln, damit Knöpfe auf Weiß sichtbar bleiben.
  const acc = dark ? (lum(raw) < 70 ? mix(raw, "#ffffff", lum(raw) < 30 ? 0.3 : 0.16) : lum(raw) > 230 ? mix(raw, base.surface, 0.1) : raw)
    : isLight(raw) ? mix(raw, base.ink, 0.68) : raw;
  const accentTx = dark ? mix(acc, "#ffffff", 0.6) : lum(acc) > 170 ? mix(acc, "#000000", 0.45) : acc;
  const club = isLight(raw) ? raw : acc;
  return { ...base, accent: acc, accentTx, accentInk: inkOn(acc), accentSoft: dark ? mix(acc, base.surface, 0.78) : mix(acc, "#ffffff", 0.9), club, clubInk: inkOn(club) };
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
/** Formen nach Rolle: Kacheln 14, Gruppen und Karten 16, Hauptelement 22, Blätter 24, Knöpfe und Chips als Kapsel */
export const radius = { s: 8, m: 12, tile: 14, l: 16, xl: 22, sheet: 24, pill: 999 };
/** Typografie: Systemschrift in Satzschreibung (keine Großbuchstaben-Etiketten), kräftige Titel mit engem Spacing, gleich breite Ziffern */
export const font = {
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "800" as const, letterSpacing: -0.8 },
  h2: { fontSize: 19, lineHeight: 24, fontWeight: "700" as const, letterSpacing: -0.35 },
  h3: { fontSize: 16, lineHeight: 21, fontWeight: "700" as const, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11.5, lineHeight: 15 },
  eyebrow: { fontSize: 12.5, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0 },
  /** Kennzahl (Kacheln, Hauptelement) */
  fig: { fontSize: 30, lineHeight: 34, fontWeight: "800" as const, letterSpacing: -0.8, fontVariant: ["tabular-nums"] as ("tabular-nums")[] },
  num: { fontVariant: ["tabular-nums"] as ("tabular-nums")[] },
};

/** Farbe zur Intensität (RPE). */
export function rpeColor(c: Colors, r: number | null | undefined): string {
  if (r == null || r <= 0) return c.line;
  return r >= 8 ? c.crit : r >= 7 ? c.hot : r >= 5 ? c.warn : c.ok;
}
export type StatusKey = "crit" | "warn" | "ok" | "low" | "build" | "none" | "inj";
export function statusColor(c: Colors, s: StatusKey | string): string {
  return ({ crit: c.crit, warn: c.warn, ok: c.ok, low: c.low, build: c.build, none: c.build, inj: c.inj } as Record<string, string>)[s] || c.build;
}

export type { ThemeMode };
interface Theme { c: Colors; dark: boolean }
const ThemeCtx = createContext<Theme>({ c: makeColors(false, BRAND.green), dark: false });

export function ThemeProvider({ accent, mode = "system", children }: { accent: string; mode?: ThemeMode; children: React.ReactNode }) {
  const scheme = useColorScheme();
  const dark = mode === "system" ? scheme === "dark" : mode === "dark";
  const v = useMemo(() => ({ c: makeColors(dark, accent), dark }), [dark, accent]);
  return <ThemeCtx.Provider value={v}>{children}</ThemeCtx.Provider>;
}
export const useTheme = (): Theme => useContext(ThemeCtx);
