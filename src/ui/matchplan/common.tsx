// Matchplan: gemeinsame Helfer der Oberfläche – Namen für Icons, Verfügbarkeit, Reiterleiste, Positionskürzel.
import React, { useMemo } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import type { Player } from "../../core/types";
import { useEngine } from "../../data/store";
import type { TokenInfo } from "./pitch";
import { radius, useTheme } from "../theme";

/**
 * Namen auf den Icons: Jugend Vorname, Senioren Nachname; bei Doppelungen mit Initiale des anderen Namens.
 * Liefert die Info je Spieler-ID (unbekannte IDs → null, z. B. gelöschte Spieler).
 */
export function useTokenInfo(): (pid: string) => TokenInfo | null {
  const E = useEngine();
  return useMemo(() => {
    const seniors = E.grp === "akt", all = [...E.D.players, ...E.D.inactive];
    const base = (p: Player) => (seniors ? p.nn || p.vn : p.vn || p.nn || "?").trim();
    const count = new Map<string, number>(); for (const p of E.D.players) count.set(base(p), (count.get(base(p)) || 0) + 1);
    const map = new Map<string, TokenInfo>();
    for (const p of all) {
      const b = base(p), other = seniors ? p.vn : p.nn;
      map.set(p.id, { p, nr: p.nr ?? null, label: (count.get(b) || 0) > 1 && other ? `${b} ${other.slice(0, 1)}.` : b });
    }
    return (pid: string) => map.get(pid) || null;
  }, [E]);
}

/** Verfügbarkeit am Spieltag: verletzt/krank/abwesend bzw. Belastungsampel (rot/gelb) */
export function useAvail(date: string | null): { dot: (pid: string) => string | null; why: (pid: string) => string | null; out: (pid: string) => boolean } {
  const E = useEngine(); const { c } = useTheme();
  return useMemo(() => {
    const d = date || E.TODAY;
    const st = (pid: string) => E.mods.belastung ? E.profile(pid).st : "none";
    return {
      out: (pid: string) => { const a = E.absenceOn(pid, d); return !!a && (a.typ === "verletzung" || a.typ === "krank"); },
      dot: (pid: string) => {
        const a = E.absenceOn(pid, d); if (a) return a.typ === "verletzung" ? c.inj : a.typ === "krank" ? c.crit : c.build;
        const s = st(pid); return s === "crit" ? c.crit : s === "warn" ? c.warn : null;
      },
      why: (pid: string) => {
        const a = E.absenceOn(pid, d); if (a) return E.t("ab_" + a.typ) + (a.bis ? ` · ${E.t("until")} ${E.de(a.bis)}` : "");
        const s = st(pid); return s === "crit" || s === "warn" ? E.t("st_" + s) : null;
      },
    };
  }, [E, date, c]);
}

/** Kurzbezeichnung einer Position (de: IV, en: CB …) */
export function usePosLabel(): (pos: string) => string {
  const E = useEngine();
  return (pos: string) => pos ? E.t("mps_" + pos) : "";
}

/** Waagerecht scrollbare Reiter */
export function TabBar<K extends string>({ tabs, value, onChange, testID }: { tabs: { key: K; label: string; badge?: string | null }[]; value: K; onChange: (k: K) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }} testID={testID} accessibilityRole="tablist">
      {tabs.map(tb => {
        const on = tb.key === value;
        return (
          <Pressable key={tb.key} testID={testID ? testID + "-" + tb.key : undefined} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(tb.key)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface }}>
            <Text style={{ fontWeight: "800", fontSize: 13.5, color: on ? c.accentInk : c.ink }}>{tb.label}</Text>
            {tb.badge ? <Text style={{ fontWeight: "800", fontSize: 11.5, color: on ? c.accentInk : c.muted }}>{tb.badge}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
