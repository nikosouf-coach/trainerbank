// Statistik (Trainerteam): Kennzahlen je Spieler als Tabelle – Zeitraum, Spieler-Filter (Mannschaftsteile, Gruppen),
// Ansichten (Überblick, Training, Belastung, Spiele, Tests, Entwicklung) oder eigene Auswahl, Sortieren je Spalte,
// Teamzeile, Export als CSV. Dazu die Auswahl des Werts neben dem Namen im Kader – dieselben Kennzahlen.
// Berechnung in core/stats; Einstellungen je Trainer in profiles.prefs (stats, squadValue).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import { posGroup } from "../core/classes";
import { STAT_CATS, STAT_PERIODS, compareStat, periodRange, statValue, statsFor, teamValue, type Range, type StatDef, type StatPeriod, type StatVal } from "../core/stats";
import type { Player } from "../core/types";
import type { UserPrefs } from "../data/api";
import { shareTextFile } from "../data/files";
import { useEngine, useStore } from "../data/store";
import { ratingColor } from "./games";
import { Icon } from "./icons";
import { Btn, Col, Group, Header, Muted, NavRow, Row, Screen, Sheet, T, cap } from "./kit";
import { useNavBack } from "./nav";
import { fmtTest } from "./perf";
import { TermInfo } from "./termInfo";
import { radius, useTheme, withAlpha } from "./theme";

/** Höchstens so viele Kennzahlen gleichzeitig (Tabelle bleibt lesbar, Einstellungen klein) */
export const MAX_COLS = 8;
/** Standard-Zeitraum (Seite und Kader) */
export const DEF_PERIOD: StatPeriod = "28";
const PCT = new Set(["att", "rpeRate", "wellRate", "minPct"]);

/** Ansichten: feste Zusammenstellungen (nur verfügbare Kennzahlen; Tests: die Tests des Teams) */
const VIEWS: { k: string; keys: (defs: StatDef[]) => string[] }[] = [
  { k: "overview", keys: () => ["att", "rpe", "rateG", "min", "scorer", "absDays"] },
  { k: "training", keys: () => ["att", "unexc", "marks", "rpeRate", "extra", "absDays"] },
  { k: "load", keys: () => ["acwr", "load", "rpe", "well", "sleep", "wellRate"] },
  { k: "games", keys: () => ["games", "starts", "min", "minPct", "goals", "assists", "rateG", "clean"] },
  { k: "tests", keys: defs => defs.filter(d => d.cat === "tests").map(d => d.key).slice(0, MAX_COLS) },
  { k: "dev", keys: () => ["devC", "devS", "marks", "rateG", "att"] },
];

/** Kennzahlen des Teams mit Texten, Zahlenformat und Farbe */
export function useStatCatalog() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const health = s.can("health");
  const defs = useMemo(() => statsFor(E, health), [E, health]);
  const byKey = useMemo(() => new Map(defs.map(d => [d.key, d])), [defs]);
  const label = (d: StatDef): string => d.test ? E.testName(d.test) : t("sx_" + d.key);
  const short = (d: StatDef): string => d.test ? E.testName(d.test) : t("sx_s_" + d.key);
  const desc = (d: StatDef): string => d.test ? [E.testDesc(d.test), t("sx_d_test")].filter(Boolean).join(" · ") : t("sx_d_" + d.key);
  /** zweite Zeile im Spaltenkopf: Einheit bzw. „aktuell“ */
  const headSub = (d: StatDef): string => [d.test ? d.unit : d.key === "load" ? "AU" : "", d.now ? t("sx_now") : ""].filter(Boolean).join(" · ");
  const fmt = (d: StatDef, x: StatVal | null | undefined): string => {
    if (!x || x.v == null) return "–";
    const v = x.v;
    if (d.key === "marks") { const g = x.good || 0, p = x.poor || 0; return !g && !p ? "–" : [g ? "+" + g : "", p ? "−" + p : ""].filter(Boolean).join(" "); }
    if (PCT.has(d.key)) return Math.round(v) + " %";
    if (d.test) return fmtTest(d.test, v, E.tr.lang, E.customTests);
    if (d.key === "sleep") return E.num(v, 1) + " h";
    if (d.dec > 0) return E.num(v, d.dec);
    return E.int(v);
  };
  /** Nachkommastellen des Teamwerts: Mittel von Zählwerten mit einer Stelle (Ø 2,4 Spiele), Summen ganz */
  const teamDec = (d: StatDef): number => d.key === "sleep" ? 1 : d.agg === "avg" && d.dec === 0 && !d.test && !PCT.has(d.key) && !["load", "min"].includes(d.key) ? 1 : d.dec;
  const fmtTeam = (d: StatDef, v: number | null): string => {
    if (v == null) return "–";
    if (d.key === "marks") return v > 0 ? "+" + E.int(v) : v < 0 ? "−" + E.int(-v) : "0";
    if (PCT.has(d.key)) return Math.round(v) + " %";
    if (d.test) return fmtTest(d.test, v, E.tr.lang, E.customTests);
    const dec = teamDec(d);
    return (dec > 0 ? E.num(v, dec) : E.int(v)) + (d.key === "sleep" ? " h" : "");
  };
  const sub = (d: StatDef, x: StatVal | null | undefined): string | null => {
    if (!x || x.v == null) return null;
    if (d.test) {
      if (x.trend != null && Math.abs(x.trend) >= 0.0005) return `${x.trend > 0 ? "▲" : "▼"} ${E.num(Math.abs(x.trend) * 100, 1)} %`;
      return x.date ? E.de(x.date) : null;
    }
    if (x.of != null && x.n != null) return tf("sx_valOf", { n: x.n, m: x.of });
    if ((d.key === "games" || d.key === "starts") && x.of != null) return tf("sx_of", { n: x.of });
    if (d.key === "extra" && x.min) return tf("sx_minSub", { n: x.min });
    if ((d.key === "devC" || d.key === "devS") && x.date) return E.de(x.date);
    return null;
  };
  const color = (d: StatDef, x: StatVal | null | undefined): string | undefined => {
    if (!x || x.v == null) return undefined;
    if (d.key === "rateG") return ratingColor(x.v);
    switch (x.tone) {
      case "top": case "ok": return c.ok;
      case "warn": return c.warn;
      case "crit": return c.crit;
      case "low": return c.low;
      default: return undefined;
    }
  };
  const periodLabel = (p: StatPeriod): string => t("sx_p_" + p);
  const rangeLabel = (r: Range): string => r.from === r.to ? E.de(r.from) : `${E.de(r.from)}–${E.de(r.to)}`;
  /** Zeiträume: Hinrunde erst, wenn sie vorbei ist (vorher gleich „Saison“), Rückrunde ab Januar */
  const periods = STAT_PERIODS.filter(p => { const r = periodRange(p, E.TODAY); return !!r && !(p === "h1" && r.to === E.TODAY); });
  /** gespeicherter Zeitraum, falls (noch) wählbar – sonst der Standard */
  const validPeriod = (p: StatPeriod | undefined): StatPeriod => p && periods.includes(p) ? p : DEF_PERIOD;
  return { defs, byKey, label, short, desc, headSub, fmt, fmtTeam, teamDec, sub, color, periodLabel, rangeLabel, periods, validPeriod };
}
export type StatCatalog = ReturnType<typeof useStatCatalog>;

/** Waagerechte Auswahl (Zeitraum, Spieler, Ansicht) – eine Zeile, die bei Bedarf seitlich scrollt */
export function ChipRow<K extends string>({ options, value, onChange, testID }: { options: { key: K; label: string; n?: number | null }[]; value: K | null; onChange: (k: K) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID={testID}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} testID={testID ? testID + "-" + o.key : undefined} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13 }}>
            <Text style={{ fontWeight: "600", fontSize: 13.5, color: on ? c.bg : c.ink }}>{cap(o.label)}</Text>
            {o.n != null ? <Text style={{ fontWeight: "700", fontSize: 12.5, color: on ? c.bg : c.muted, fontVariant: ["tabular-nums"] }}>{o.n}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------- Tabelle ----------
/** Sortierung: dir 1 = beste zuerst (neutrale Kennzahlen: höchste zuerst), -1 = umgekehrt; null = Rückennummer */
export type Sort = { k: string; dir: 1 | -1 } | null;
interface TRow { p: Player; name: string; vals: StatVal[] }
const ROW = 52, HEAD = 60;
/** Pfeil nach der Zahlenfolge: ▼ = absteigend (größte oben), ▲ = aufsteigend */
const arrowOf = (d: StatDef, dir: 1 | -1): string => (d.better === "low" ? -dir : dir) === 1 ? "▼" : "▲";

/**
 * Tabelle: links fest die Spieler (Nummer, Name, Position), rechts die Kennzahlen – seitlich scrollbar, auf breiten
 * Bildschirmen über die ganze Breite. Oben die Teamzeile. Spaltenkopf antippen sortiert (beste zuerst, noch einmal:
 * umgekehrt), Zeile antippen öffnet den Spieler.
 */
export function StatsTable({ cat, rows, defs, team, sort, onSort, onRow, testID = "sx-table" }: {
  cat: StatCatalog; rows: TRow[]; defs: StatDef[]; team: (number | null)[]; sort: Sort; onSort: (k: string) => void; onRow: (p: Player) => void; testID?: string;
}) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [W, setW] = useState(0);
  // gedrückte Zeile: Name und Werte gemeinsam hinterlegen
  const [hot, setHot] = useState<string | null>(null);
  const press = (id: string) => ({ onPressIn: () => setHot(id), onPressOut: () => setHot(h => h === id ? null : h) });
  const nameW = W >= 760 ? 200 : W >= 440 ? 172 : 136, wideName = nameW >= 200;
  // Spaltenbreite: mindestens so breit, dass das längste Wort im Kopf passt; breit: Rest gleichmäßig verteilt (füllt die
  // Breite), schmal: die Tabelle scrollt seitlich
  const minW = W >= 760 ? 88 : 78;
  const need = defs.map(d => Math.max(minW, Math.ceil(Math.max(...cat.short(d).split(/[\s-]+/).map(w => w.length)) * 7.4 + 18)));
  const avail = W ? W - 2 - nameW : 0, extra = Math.max(0, avail - need.reduce((a, b) => a + b, 0)) / Math.max(1, defs.length);
  const colW = need.map(w => w + extra - (extra ? 0.01 : 0));
  const scrolls = W > 0 && need.reduce((a, b) => a + b, 0) > avail;
  const line = { borderTopWidth: 1, borderTopColor: c.line } as const;
  const hi = withAlpha(c.accent, 0.07);
  const head = (d: StatDef, i: number) => {
    const on = !!sort && sort.k === d.key, hs = cat.headSub(d);
    return (
      <Pressable key={d.key} testID={testID + "-h-" + d.key} accessibilityRole="button" onPress={() => onSort(d.key)}
        accessibilityLabel={on ? E.tf("sx_sortBy", { k: cat.label(d) }) : cat.label(d)} accessibilityHint={t("sx_sortHint")}
        style={({ pressed }) => ({ width: colW[i], height: HEAD, paddingHorizontal: 8, justifyContent: "center", alignItems: "flex-end", backgroundColor: pressed ? c.sunk : on ? hi : "transparent" })}>
        <Text numberOfLines={2} style={{ alignSelf: "stretch", fontSize: 12, lineHeight: 15, fontWeight: "700", textAlign: "right", color: on ? c.accentTx : c.ink }}>{cat.short(d)}{on ? " " + arrowOf(d, sort!.dir) : ""}</Text>
        {hs ? <Text numberOfLines={1} style={{ fontSize: 10.5, lineHeight: 14, color: c.muted }}>{hs}</Text> : null}
      </Pressable>
    );
  };
  const cell = (d: StatDef, x: StatVal, i: number) => {
    const s = cat.sub(d, x), col = cat.color(d, x), on = !!sort && sort.k === d.key;
    return (
      <View key={d.key} style={{ width: colW[i], paddingHorizontal: 8, justifyContent: "center", alignItems: "flex-end", backgroundColor: on ? hi : "transparent" }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: col ? "700" : "600", color: col || (x.v == null ? c.faint : c.ink), fontVariant: ["tabular-nums"] }}>{cat.fmt(d, x)}</Text>
        {s ? <Text numberOfLines={1} style={{ fontSize: 10.5, lineHeight: 14, color: c.muted, fontVariant: ["tabular-nums"] }}>{s}</Text> : null}
      </View>
    );
  };
  return (
    <View testID={testID} onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))}
      style={{ borderRadius: radius.l, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, overflow: "hidden" }}>
      <View style={{ flexDirection: "row" }}>
        {/* feste Spalte: Spieler */}
        <View style={{ width: nameW, borderRightWidth: 1, borderRightColor: c.line }}>
          <Pressable testID={testID + "-h-nr"} accessibilityRole="button" accessibilityLabel={t("sx_sortNr")} onPress={() => onSort("")}
            style={({ pressed }) => ({ height: HEAD, paddingHorizontal: 10, justifyContent: "center", backgroundColor: pressed ? c.sunk : "transparent" })}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: !sort ? c.accentTx : c.ink }}>{t("sx_player")}</Text>
            <Text style={{ fontSize: 10.5, lineHeight: 14, color: c.muted }}>{t("sx_sortNr")}</Text>
          </Pressable>
          <View testID={testID + "-team"} style={{ height: ROW, ...line, justifyContent: "center", paddingHorizontal: 10, backgroundColor: c.sunk }}>
            <Text style={{ fontSize: 13.5, fontWeight: "800", color: c.ink }}>{t("sx_team")}</Text>
            <Text numberOfLines={1} style={{ fontSize: 10.5, lineHeight: 14, color: c.muted }}>{t("sx_teamD")}</Text>
          </View>
          {rows.map(r => (
            <Pressable key={r.p.id} testID={testID + "-p-" + r.p.id} accessibilityRole="button" onPress={() => onRow(r.p)} {...press(r.p.id)}
              accessibilityLabel={[r.name, ...defs.map((d, i) => cat.short(d) + " " + cat.fmt(d, r.vals[i]))].join(", ")}
              style={{ height: ROW, ...line, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, backgroundColor: hot === r.p.id ? c.sunk : "transparent" }}>
              <Text style={{ width: 20, textAlign: "right", fontSize: 13, fontWeight: "700", color: c.muted, fontVariant: ["tabular-nums"] }}>{r.p.nr ?? ""}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: c.ink }}>{wideName || !r.p.nn ? r.name : r.p.nn}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: c.muted }}>{wideName || !r.p.nn ? r.p.pos : `${r.p.vn} · ${r.p.pos}`}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {/* Kennzahlen: seitlich scrollbar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={scrolls} style={{ flex: 1 }} testID={testID + "-scroll"}>
          <View>
            <View style={{ flexDirection: "row", height: HEAD }}>{defs.map(head)}</View>
            <View style={{ flexDirection: "row", height: ROW, ...line, backgroundColor: c.sunk }}>
              {defs.map((d, i) => (
                <View key={d.key} testID={testID + "-t-" + d.key} style={{ width: colW[i], paddingHorizontal: 8, justifyContent: "center", alignItems: "flex-end" }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "800", color: team[i] == null ? c.faint : c.ink, fontVariant: ["tabular-nums"] }}>{cat.fmtTeam(d, team[i])}</Text>
                  <Text style={{ fontSize: 10.5, lineHeight: 14, color: c.muted }}>{t(d.agg === "sum" ? "sx_sum" : "sx_avg")}</Text>
                </View>
              ))}
            </View>
            {/* Werte: Vorlesen über die Namenszeile (enthält alle Werte) */}
            {rows.map(r => (
              <Pressable key={r.p.id} testID={testID + "-r-" + r.p.id} aria-hidden focusable={false} onPress={() => onRow(r.p)} {...press(r.p.id)}
                style={{ flexDirection: "row", height: ROW, ...line, backgroundColor: hot === r.p.id ? c.sunk : "transparent" }}>
                {defs.map((d, i) => cell(d, r.vals[i], i))}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ---------- Auswahl der Kennzahlen ----------
/** Kennzahlen nach Kategorien mit Erklärung: mehrere wählen (Tabelle) bzw. eine (Kader) */
function StatList({ cat, sel, onToggle, testID, single }: { cat: StatCatalog; sel: string[]; onToggle: (k: string) => void; testID: string; single?: boolean }) {
  const { t } = useEngine(); const { c } = useTheme();
  return (
    <Col gap={14}>
      {STAT_CATS.map(k => {
        const L = cat.defs.filter(d => d.cat === k); if (!L.length) return null;
        return (
          <Col key={k} gap={6} testID={testID + "-cat-" + k}>
            <T v="small" bold color={c.muted}>{t("sx_c_" + k)}</T>
            <Group>
              {L.map(d => {
                const on = sel.includes(d.key);
                return (
                  <Pressable key={d.key} testID={testID + "-" + d.key} accessibilityRole={single ? "radio" : "checkbox"} accessibilityState={{ checked: on }} onPress={() => onToggle(d.key)}
                    style={({ pressed }) => ({ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: pressed ? c.sunk : "transparent" })}>
                    <Mark on={on} round={single} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: c.ink }}>{cat.label(d)}{d.now ? <Text style={{ fontWeight: "400", color: c.muted }}>{" · " + t("sx_now")}</Text> : null}</Text>
                      <Text style={{ fontSize: 12.5, lineHeight: 17, color: c.muted }}>{cat.desc(d)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Group>
          </Col>
        );
      })}
    </Col>
  );
}
function Mark({ on, round }: { on: boolean; round?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 22, height: 22, borderRadius: round ? 11 : 7, borderWidth: 2, borderColor: on ? c.accent : c.faint, backgroundColor: on ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
      {on ? <Icon name="check" size={14} color={c.accentInk} strokeWidth={3} /> : null}
    </View>
  );
}

function ColumnSheet({ visible, cat, cols, onApply, onClose }: { visible: boolean; cat: StatCatalog; cols: string[]; onApply: (k: string[]) => void; onClose: () => void }) {
  const s = useStore(); const { t, tf } = useEngine();
  const [sel, setSel] = useState<string[]>(cols);
  const [open, setOpen] = useState(visible);
  // beim Öffnen mit der aktuellen Auswahl beginnen (nicht Übernommenes verwerfen)
  if (visible !== open) { setOpen(visible); if (visible) setSel(cols); }
  const toggle = (k: string) => {
    if (sel.includes(k)) { setSel(sel.filter(x => x !== k)); return; }
    if (sel.length >= MAX_COLS) { s.toast(tf("sx_colsMax", { n: MAX_COLS })); return; }
    // Reihenfolge wie in der Liste (nach Kategorien), nicht nach Klick
    setSel(cat.defs.map(d => d.key).filter(x => x === k || sel.includes(x)));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("sx_colsPick")} testID="sx-cols-sheet" closeLabel={t("cancel")}>
      <Muted small testID="sx-cols-n">{tf("sx_colsN", { n: sel.length, m: MAX_COLS })}</Muted>
      <StatList cat={cat} sel={sel} onToggle={toggle} testID="sx-col" />
      <Row gap={8} wrap>
        <Btn testID="sx-cols-apply" kind="primary" label={t("sx_colsDone")} disabled={!sel.length} onPress={() => onApply(sel)} />
        <Btn testID="sx-cols-reset" kind="ghost" label={t("sx_colsReset")} onPress={() => onApply([])} />
      </Row>
    </Sheet>
  );
}

// ---------- Kader: Wert neben dem Namen ----------
/** Gewählter Wert im Kader (Standard: ACWR ab Infotiefe 2, sonst Trainingsbeteiligung) und sein Zeitraum */
export function useSquadValue(cat: StatCatalog): { def: StatDef | null; period: StatPeriod; range: Range } {
  const s = useStore(); const E = useEngine();
  const pv = s.prefs.squadValue;
  const fallback = cat.byKey.get("acwr") || cat.byKey.get("att") || null;
  const def = pv ? (pv.k === "none" ? null : cat.byKey.get(pv.k) || fallback) : fallback;
  const period = cat.validPeriod(pv?.period);
  return { def, period, range: periodRange(period, E.TODAY)! };
}

export function SquadValueSheet({ visible, onClose, cat }: { visible: boolean; onClose: () => void; cat: StatCatalog }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const cur = useSquadValue(cat);
  const save = (p: Partial<NonNullable<UserPrefs["squadValue"]>>) => s.setPrefs({ squadValue: { k: cur.def ? cur.def.key : "none", period: cur.period, ...p } });
  return (
    <Sheet visible={visible} onClose={onClose} title={t("sx_val")} testID="sx-val-sheet" closeLabel={t("done")}>
      <Muted small>{t("sx_valD")}</Muted>
      <Col gap={6}>
        <T v="small" bold>{t("sx_period")}</T>
        <ChipRow testID="sx-val-period" value={cur.period} onChange={p => save({ period: p })} options={cat.periods.map(p => ({ key: p, label: cat.periodLabel(p) }))} />
        {cur.def?.now ? <Muted small testID="sx-val-nowNote">{t("sx_valNow")}</Muted> : null}
      </Col>
      <Group>
        <Pressable testID="sx-val-none" accessibilityRole="radio" accessibilityState={{ checked: !cur.def }} onPress={() => { save({ k: "none" }); onClose(); }}
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? c.sunk : "transparent" })}>
          <Mark on={!cur.def} round />
          <T>{t("sx_valNone")}</T>
        </Pressable>
      </Group>
      <StatList cat={cat} sel={cur.def ? [cur.def.key] : []} single testID="sx-val" onToggle={k => { save({ k }); onClose(); }} />
      <Group>
        <NavRow testID="sx-val-all" icon="chart" title={t("sx_all")} sub={t("sx_allSub")} onPress={() => { onClose(); router.push("/coach/statistik?from=kader"); }} />
      </Group>
    </Sheet>
  );
}

// ---------- Seite ----------
const POS = ["TW", "Abwehr", "Mittelfeld", "Sturm"] as const;
/** Dateiname ohne Umlaute und Sonderzeichen (Teilen auf dem Handy, Excel) */
const fileSafe = (x: string): string => x.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
  .replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

export function StatsScreen() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  // aus dem Kader geöffnet: zurück zum Kader (sonst wie alle Bereiche zurück zu „Mehr“, außer in der unteren Leiste)
  const { from } = useLocalSearchParams<{ from?: string }>(); const nb0 = useNavBack("statistik");
  const nb = nb0.onBack && from === "kader" ? { onBack: () => router.canGoBack() ? router.back() : router.replace("/coach/kader"), backLabel: t("nav_kader") } : nb0;
  const cat = useStatCatalog();
  const pref = s.prefs.stats || {};
  const [period, setPeriod] = useState<StatPeriod>(cat.validPeriod(pref.period));
  const [view, setView] = useState<string>(pref.view || "overview");
  const [cols, setCols] = useState<string[]>(pref.cols || []);
  const [filter, setFilter] = useState("alle");
  const [sort, setSort] = useState<Sort>(null);
  const [pick, setPick] = useState(false);
  const [exp, setExp] = useState(false);
  const save = (p: Partial<NonNullable<UserPrefs["stats"]>>) => s.setPrefs({ stats: { ...(s.prefs.stats || {}), ...p } });

  const views = VIEWS.map(v => ({ k: v.k, keys: v.keys(cat.defs).filter(k => cat.byKey.has(k)) })).filter(v => v.keys.length);
  const custom = cols.filter(k => cat.byKey.has(k));
  const vk = view === "custom" && custom.length ? "custom" : views.some(v => v.k === view) ? view : views[0]?.k || "custom";
  const keys = vk === "custom" ? custom : views.find(v => v.k === vk)?.keys || [];
  const defs = keys.map(k => cat.byKey.get(k)!);
  const range = periodRange(period, E.TODAY) || periodRange(DEF_PERIOD, E.TODAY)!;

  // Spieler (aktive), gefiltert nach Mannschaftsteil bzw. Gruppe
  const players = E.D.players.filter(p => p.active !== false);
  const inF = (p: Player, f: string) => f === "alle" || posGroup(p.pos) === f || (f.startsWith("g:") && (p.groups || []).includes(f.slice(2)));
  const fOpts = ["alle", ...POS.filter(g => players.some(p => posGroup(p.pos) === g)), ...E.D.groups.map(g => "g:" + g.id)];
  const fLabel = (k: string) => k.startsWith("g:") ? (E.D.groups.find(g => "g:" + g.id === k)?.name || "?") : t("f_" + k);
  const list = players.filter(p => inF(p, filter));
  const data = useMemo(() => list.map(p => ({ p, name: E.name(p), vals: defs.map(d => statValue(E, p.id, d, range)) })),
    [E, s.version, filter, period, keys.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const team = defs.map((d, i) => teamValue(d, data.map(r => r.vals[i].v)));
  const si = sort ? defs.findIndex(d => d.key === sort.k) : -1;
  const byNr = (a: TRow, b: TRow) => (a.p.nr ?? 99) - (b.p.nr ?? 99) || a.name.localeCompare(b.name);
  const rows = [...data].sort((a, b) => si >= 0 ? compareStat(defs[si], a.vals[si].v, b.vals[si].v, sort!.dir) || byNr(a, b) : byNr(a, b));
  const onSort = (k: string) => setSort(!k ? null : sort && sort.k === k ? { k, dir: sort.dir === 1 ? -1 : 1 } : { k, dir: 1 });
  const pText = `${cat.periodLabel(period)} (${cat.rangeLabel(range)})`;
  const lead = filter === "alle" ? tf("sx_lead", { n: list.length, p: pText }) : tf("sx_leadF", { n: list.length, m: players.length, p: pText });
  const setP = (p: StatPeriod) => { setPeriod(p); save({ period: p }); };
  const setV = (k: string) => { setView(k); setSort(null); save({ view: k }); };
  const sd = si >= 0 ? defs[si] : null;
  const sortText = sd ? tf("sx_sortBy", { k: cat.label(sd) }) + " – " + t(sd.better ? (sort!.dir === 1 ? "sx_sortBest" : "sx_sortWorst") : (sort!.dir === 1 ? "sx_sortHigh" : "sx_sortLow")) : null;

  // CSV (Excel): auf Deutsch Semikolon und Dezimalkomma, auf Englisch Komma und Punkt; mit BOM, damit Umlaute stimmen
  const exportCsv = async () => {
    const de = E.tr.lang === "de", sepC = de ? ";" : ",", q = (x: string) => x.includes(sepC) || /["\r\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
    const num = (v: number | null, dec: number) => v == null ? "" : (dec > 0 ? v.toFixed(dec) : String(Math.round(v))).replace(".", de ? "," : ".");
    const val = (d: StatDef, x: StatVal) => d.key === "marks" ? (x.v == null ? "" : cat.fmt(d, x).replace(/−/g, "-")) : num(x.v, d.key === "sleep" ? 1 : PCT.has(d.key) ? 0 : d.dec);
    const unit = (d: StatDef) => d.test ? (d.unit ? ` (${d.unit})` : "") : PCT.has(d.key) ? " (%)" : d.key === "load" ? " (AU)" : d.key === "sleep" ? " (h)" : d.key === "min" ? ` (${t("min")})` : "";
    const lines = [
      [t("sx_nr"), t("sx_player"), t("sx_pos"), ...defs.map(d => cat.label(d) + unit(d))],
      ...rows.map(r => [r.p.nr != null ? String(r.p.nr) : "", r.name, r.p.pos, ...defs.map((d, i) => val(d, r.vals[i]))]),
      ["", t("sx_teamCsv"), "", ...defs.map((d, i) => d.key === "marks" ? num(team[i], 0) : num(team[i], PCT.has(d.key) ? 0 : cat.teamDec(d)))],
    ];
    const csv = "\uFEFF" + lines.map(L => L.map(q).join(sepC)).join("\r\n");
    await shareTextFile(`${fileSafe(t("sx_title"))}_${fileSafe(E.team.name) || "Team"}_${fileSafe(cat.periodLabel(period))}_${E.TODAY}.csv`, csv, "text/csv");
    s.toast(t("sx_exported")); setExp(false);
  };

  if (!cat.defs.length) return (
    <Screen testID="coach-stats"><Header title={t("sx_title")} onBack={nb.onBack} backLabel={nb.backLabel} sub={t("sx_noStats")} /></Screen>
  );
  const healthCols = defs.some(d => ["load", "well", "health"].includes(d.cat));
  return (
    <Screen testID="coach-stats">
      <Header testID="sx-head" title={t("sx_title")} sub={lead} onBack={nb.onBack} backLabel={nb.backLabel} info={<TermInfo k="stats" testID="term-stats" />}
        right={<Btn small testID="sx-export" icon="export" label={t("sx_export")} disabled={!rows.length || !defs.length} onPress={() => setExp(true)} />} />
      <Col gap={10} testID="sx-filters">
        <ChipRow testID="sx-period" value={period} onChange={setP} options={cat.periods.map(p => ({ key: p, label: cat.periodLabel(p) }))} />
        <ChipRow testID="sx-f" value={filter} onChange={k => setFilter(k === filter && k !== "alle" ? "alle" : k)}
          options={fOpts.map(k => ({ key: k, label: fLabel(k), n: k === "alle" ? null : players.filter(p => inF(p, k)).length }))} />
        <Row gap={8}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ChipRow testID="sx-view" value={vk} onChange={setV} options={[...views.map(v => ({ key: v.k, label: t("sx_v_" + v.k) })), ...(custom.length ? [{ key: "custom", label: t("sx_v_custom") }] : [])]} />
          </View>
          <Btn small testID="sx-cols" icon="sliders" label={t("sx_colsEdit")} onPress={() => setPick(true)} />
        </Row>
      </Col>
      {!list.length ? <Muted testID="sx-empty">{t("sx_empty")}</Muted>
        : <StatsTable cat={cat} rows={rows} defs={defs} team={team} sort={sort} onSort={onSort} onRow={p => router.push("/coach/spieler/" + p.id)} />}
      <Muted small testID="sx-hint">{sortText ? sortText + ". " : ""}{t("sx_hint")}</Muted>
      <ColumnSheet visible={pick} cat={cat} cols={keys} onClose={() => setPick(false)} onApply={k => {
        setPick(false); setSort(null);
        if (!k.length) { setView("overview"); save({ view: "overview" }); return; }
        setCols(k); setView("custom"); save({ view: "custom", cols: k });
      }} />
      <Sheet visible={exp} onClose={() => setExp(false)} title={t("sx_exportT")} testID="sx-export-sheet" closeLabel={t("cancel")}>
        <T>{t("sx_exportD")}</T>
        <Muted small testID="sx-export-what">{lead}{"\n"}{defs.map(d => cat.label(d)).join(", ")}</Muted>
        {healthCols ? <View testID="sx-export-health" style={{ padding: 12, borderRadius: radius.m, backgroundColor: withAlpha(c.warn, 0.12) }}>
          <Text style={{ fontSize: 13, lineHeight: 18, color: c.ink, fontWeight: "600" }}>{t("sx_exportHealth")}</Text>
        </View> : null}
        <Btn testID="sx-export-go" kind="primary" icon="export" label={t("sx_exportGo")} onPress={() => { exportCsv().catch(() => s.toast(t("sx_exportErr"))); }} />
      </Sheet>
    </Screen>
  );
}
