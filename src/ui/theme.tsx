// Farben, Abstände und Typografie (Erscheinungsbild „Trainerbank“). Hell/Dunkel: wie das System oder fest gewählt
// (Konto → Darstellung). Ruhige Neutraltöne, Farbe nur mit Bedeutung (Status, Akzent); die Akzentfarbe ist die Vereinsfarbe.
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import type { ThemeMode } from "../data/api";

export interface Colors {
  bg: string; surface: string; sunk: string; ink: string; muted: string; line: string;
  ok: string; warn: string; hot: string; crit: string; low: string; build: string; inj: string; event: string;
  accent: string; accentTx: string; accentInk: string; accentSoft: string; overlay: string;
  /** Vereinsfarbe für Spielerkreise auf dem Feld (helle Farben wie Weiß/Silber bleiben hier hell) */
  club: string; clubInk: string;
}

/** Markenfarben (Logo, Startbildschirm, Vorgabe ohne Verein) */
export const BRAND = { green: "#0d6b4b", greenDark: "#3fbf8a", ink: "#101418", paper: "#f5f6f8" };

// Neutral mit einem Hauch Grün-Grau, gedämpfte Statusfarben – wirkt ruhig und hochwertig in beiden Modi
const LIGHT = { bg: "#f5f6f8", surface: "#ffffff", sunk: "#eef0f3", ink: "#101418", muted: "#5d6672", line: "#e3e6ea", ok: "#1d8656", warn: "#b47d0a", hot: "#cf5f2a", crit: "#c23b2b", low: "#2e66c2", build: "#868e98", inj: "#7652ad", event: "#5f55c6", overlay: "rgba(12,16,22,0.42)" };
const DARK = { bg: "#0b0d10", surface: "#14171b", sunk: "#1c2025", ink: "#eceff2", muted: "#98a1ab", line: "#262b31", ok: "#3cb67d", warn: "#e1a53e", hot: "#ec7c48", crit: "#ee6955", low: "#74a2ec", build: "#7c848e", inj: "#a98bd8", event: "#9e92ea", overlay: "rgba(0,0,0,0.62)" };

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
export const radius = { s: 8, m: 12, l: 16, xl: 20, pill: 999 };
/** Typografie: Satzschreibung, kräftige aber ruhige Gewichte, leicht enges Spacing bei Überschriften */
export const font = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "800" as const, letterSpacing: -0.6 },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const, letterSpacing: -0.25 },
  h3: { fontSize: 15.5, lineHeight: 21, fontWeight: "700" as const, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11, lineHeight: 14 },
  eyebrow: { fontSize: 11.5, lineHeight: 15, fontWeight: "600" as const, letterSpacing: 0.5, textTransform: "uppercase" as const },
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
