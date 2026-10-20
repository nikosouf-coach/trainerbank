// Kaderplanung & Scouting: gemeinsame Bausteine (Farben je Status, Abzeichen, Bewertungspunkte, Saison-Auswahl,
// Kurznamen, Daten der Ansicht).
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { classDef } from "../../core/classes";
import { fmtOf } from "../../core/matchplan";
import { cleanPlanContent, defaultSeason, makeResolver, planSeasons, seasonLabel, statsBy, type RefState } from "../../core/scout";
import type { ScoutPrio, ScoutStatus, SpContent } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Seg, T, cap } from "../kit";
import { radius, useTheme, withAlpha, type Colors } from "../theme";

export const statusCol = (c: Colors, s: ScoutStatus): string =>
  ({ watch: c.build, scout: c.low, trial: c.warn, talks: c.event, signed: c.ok, declined: c.crit, dropped: c.crit } as Record<ScoutStatus, string>)[s];
export const prioCol = (c: Colors, p: ScoutPrio | null): string => p === "a" ? c.crit : p === "b" ? c.warn : p === "c" ? c.low : c.build;
export const stateCol = (c: Colors, s: RefState): string =>
  ({ fix: c.ok, persp: c.low, open: c.build, unsure: c.warn, leave: c.crit, ageout: c.crit, riser: c.event, signed: c.ok, pending: c.warn, gone: c.build } as Record<RefState, string>)[s];
export const gradeCol = (c: Colors, g: number | null): string => g == null ? c.build : g >= 4 ? c.ok : g >= 3 ? c.warn : c.crit;
export const levelCol = (c: Colors, l: "ok" | "risk" | "need"): string => l === "ok" ? c.ok : l === "risk" ? c.warn : c.crit;

/** Priorität als kleines Quadrat (A/B/C) */
export function PrioBadge({ p, size = 20, testID }: { p: ScoutPrio | null; size?: number; testID?: string }) {
  const { c } = useTheme();
  if (!p) return null;
  return (
    <View testID={testID} style={{ width: size, height: size, borderRadius: 5, backgroundColor: prioCol(c, p), alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.58 }}>{p.toUpperCase()}</Text>
    </View>
  );
}
/** Ø Gesamteindruck als Zahl auf farbigem Grund */
export function GradeBadge({ g, n, testID }: { g: number | null; n?: number; testID?: string }) {
  const { c } = useTheme(); const s = useStore();
  const col = gradeCol(c, g);
  return (
    <View testID={testID} style={{ minWidth: 38, paddingHorizontal: 6, height: 26, borderRadius: 8, backgroundColor: withAlpha(col, 0.16), alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 }}>
      <Text style={{ color: col, fontWeight: "900", fontSize: 14, fontVariant: ["tabular-nums"] }}>{g == null ? "–" : s.tr.num(g, 1)}</Text>
      {n ? <Text style={{ color: col, fontWeight: "700", fontSize: 10 }}>({n})</Text> : null}
    </View>
  );
}
/** Wert 1–5 als Punkte; antippen setzt, erneut antippen löscht (wenn onChange gesetzt) */
export function Dots({ value, onChange, color, size = 12, testID, label }: { value: number | null; onChange?: (v: number | null) => void; color?: string; size?: number; testID?: string; label?: string }) {
  const { c } = useTheme(); const col = color || c.accent;
  return (
    <View testID={testID} accessibilityLabel={label} style={{ flexDirection: "row", gap: onChange ? 6 : 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(i => {
        const on = value != null && i <= value;
        const dot = <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: on ? col : "transparent", borderWidth: 1.5, borderColor: on ? col : c.line }} />;
        return onChange
          ? <Pressable key={i} testID={testID ? testID + "-" + i : undefined} accessibilityRole="radio" accessibilityState={{ checked: value === i }} accessibilityLabel={`${label || ""} ${i}`.trim()}
              hitSlop={6} onPress={() => onChange(value === i ? null : i)} style={{ padding: 3 }}>{dot}</Pressable>
          : <View key={i}>{dot}</View>;
      })}
    </View>
  );
}
/** Auswahl 1–5 mit Beschriftung (für Berichte; erneut antippen löscht) */
export function Scale5({ value, onChange, labels, testID, compact }: { value: number | null; onChange: (v: number | null) => void; labels?: string[]; testID?: string; compact?: boolean }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {[1, 2, 3, 4, 5].map(i => {
        const on = value === i, col = gradeCol(c, i);
        return (
          <Pressable key={i} testID={testID ? testID + "-" + i : undefined} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={labels?.[i - 1] ? `${i} ${labels[i - 1]}` : String(i)}
            onPress={() => onChange(on ? null : i)}
            style={{ minWidth: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? col : c.surface, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: on ? "#fff" : c.ink }}>{i}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
/** Kleiner Status-Punkt mit Text */
export function StateTag({ label, color, testID }: { label: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: withAlpha(color, 0.14), borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontWeight: "700", fontSize: 11.5 }}>{cap(label)}</Text>
    </View>
  );
}
/** Initialen-Kreis für externe Spieler (Rand = Status) */
export function ScoutAvatar({ vn, nn, status, size = 42 }: { vn: string; nn: string; status: ScoutStatus; size?: number }) {
  const { c } = useTheme();
  const ini = ((vn || "?")[0] + ((nn || "")[0] || "")).toUpperCase(), col = statusCol(c, status);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(col, 0.16), borderWidth: 2, borderColor: col, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: col, fontWeight: "900", fontSize: size * 0.36 }}>{ini}</Text>
    </View>
  );
}

/** Positionskürzel (lokalisiert; Unbekanntes wie gespeichert) */
export const posShort = (t: (k: string) => string, pos: string): string => { if (!pos) return ""; const x = t("mps_" + pos); return x.startsWith("mps_") ? pos : x; };
/** Kurzbezeichnung einer Position der Planung („IV L“) */
export const slotShort = (t: (k: string) => string, key: string): string => {
  const [pos, side] = key.split("-");
  return posShort(t, pos) + (side && ["l", "c", "r"].includes(side) ? " " + t("sk_side_" + side).slice(0, 1).toUpperCase() : side ? " " + side : "");
};
/** Datum mit Jahr (de: TT.MM.JJJJ, en: TT/MM/JJJJ) */
export const fullDate = (lang: "de" | "en", d: string): string => { const [y, m, dd] = d.slice(0, 10).split("-"); return lang === "en" ? `${dd}/${m}/${y}` : `${dd}.${m}.${y}`; };
/** Kurzname für das Spielfeld: Nachname (sonst Vorname) */
export const shortName = (full: string): string => { const p = full.trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(" ") : p[0] || "–"; };

// ---------- Saison (zwischen Reiter und Kandidatenprofil geteilt) ----------
let lastSeason: number | null = null;
export const rememberSeason = (s: number): void => { lastSeason = s; };
export const currentPlanSeason = (now: Date = new Date()): number => lastSeason ?? defaultSeason(now);
export function SeasonSeg({ value, onChange, testID = "sk-season" }: { value: number; onChange: (s: number) => void; testID?: string }) {
  return <Seg testID={testID} value={String(value)} onChange={k => { rememberSeason(Number(k)); onChange(Number(k)); }} options={planSeasons(new Date()).map(y => ({ key: String(y), label: seasonLabel(y) }))} />;
}

/** Daten für eine Saison: Planung (bereinigt), Aufrücker, Auflösung der Verweise, Statistik der Berichte */
export function usePlanData(season: number) {
  const s = useStore(); const E = useEngine();
  const D = E.D, fmt = fmtOf(D.team.cls);
  const plan = D.squadPlans.find(p => p.season === season) || null;
  const content: SpContent | null = useMemo(() => plan ? cleanPlanContent(plan.content, fmt) : null, [plan, plan?.content, s.version, fmt]); // eslint-disable-line react-hooks/exhaustive-deps
  const risers = (s.active && s.risers[s.active.teamId + ":" + season]) || [];
  const stats = useMemo(() => statsBy(D.scoutReports), [D.scoutReports, s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = useMemo(() => content ? makeResolver(D, content, season, risers) : () => null, [content, D, season, risers, s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const youth = classDef(D.team.cls).grp !== "akt";
  return { E, D, fmt, plan, content, risers, stats, info, youth, save: (c: SpContent) => s.saveSquadPlan(season, c) };
}

/** Kopf einer Liste mit Zahl */
export function SectionHead({ title, n, right }: { title: string; n?: number; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
      <T v="eyebrow">{title}</T>
      {n != null ? <Text style={{ fontWeight: "800", fontSize: 11, color: c.muted, fontVariant: ["tabular-nums"] }}>{n}</Text> : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}
