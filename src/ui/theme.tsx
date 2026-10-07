// Farben, Abstände und Typografie. Hell/Dunkel folgt dem System, die Akzentfarbe ist die Vereinsfarbe.
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

export interface Colors {
  bg: string; surface: string; sunk: string; ink: string; muted: string; line: string;
  ok: string; warn: string; hot: string; crit: string; low: string; build: string; inj: string; event: string;
  accent: string; accentTx: string; accentInk: string; accentSoft: string; overlay: string;
}

const LIGHT = { bg: "#f2f4f7", surface: "#ffffff", sunk: "#e9edf2", ink: "#121a26", muted: "#5d6878", line: "#dde2ea", ok: "#22865a", warn: "#c98a0b", hot: "#d9622b", crit: "#c8402a", low: "#3a6db5", build: "#8b939e", inj: "#7d5ba6", event: "#7b5fd0", overlay: "rgba(10,14,20,0.45)" };
const DARK = { bg: "#0d121a", surface: "#151c27", sunk: "#1c2532", ink: "#e6ebf2", muted: "#98a3b3", line: "#2a3443", ok: "#3fb07c", warn: "#e3a83a", hot: "#ef7d45", crit: "#ec6a52", low: "#6f9ee6", build: "#7a8390", inj: "#a687cf", event: "#a48ce6", overlay: "rgba(0,0,0,0.6)" };

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

export function makeColors(dark: boolean, accent: string): Colors {
  const base = dark ? DARK : LIGHT;
  const acc = /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#0b3d91";
  const accentTx = dark ? mix(acc, "#ffffff", 0.65) : acc;
  return { ...base, accent: acc, accentTx, accentInk: lum(acc) > 150 ? "#111111" : "#ffffff", accentSoft: dark ? mix(acc, base.surface, 0.75) : mix(acc, "#ffffff", 0.9) };
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 8, m: 12, l: 14, xl: 18, pill: 999 };
export const font = {
  h1: { fontSize: 30, fontWeight: "800" as const, letterSpacing: 0.3, textTransform: "uppercase" as const },
  h2: { fontSize: 20, fontWeight: "800" as const, letterSpacing: 0.2, textTransform: "uppercase" as const },
  h3: { fontSize: 16, fontWeight: "800" as const, letterSpacing: 0.2, textTransform: "uppercase" as const },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11, lineHeight: 14 },
  eyebrow: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.2, textTransform: "uppercase" as const },
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

interface Theme { c: Colors; dark: boolean }
const ThemeCtx = createContext<Theme>({ c: makeColors(false, "#0b3d91"), dark: false });

export function ThemeProvider({ accent, children }: { accent: string; children: React.ReactNode }) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const v = useMemo(() => ({ c: makeColors(dark, accent), dark }), [dark, accent]);
  return <ThemeCtx.Provider value={v}>{children}</ThemeCtx.Provider>;
}
export const useTheme = (): Theme => useContext(ThemeCtx);
