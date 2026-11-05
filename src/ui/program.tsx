// Individuelles Entwicklungsprogramm – Herzstück der Spielerentwicklung (Trainer- und Spieler-App).
// Spielerkarte (Motto, X-Faktor, Saisonzahlen), stärkster Bereich und Notenverlauf, Perform („So mache ich den
// Unterschied“), Improve („Arbeite hart und clever an deinem Weg“), „So sehen wir dich“ (Selbstanalyse, Mitspieler,
// Trainerteam), Stärken-Runde und die Blätter zum Bearbeiten. Spieler sehen nur ihr freigegebenes Programm; die
// Vorschau des Trainerteams zeigt genau das.
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { addDays } from "../core/dates";
import { DEV_AREAS, goalProgress, goalsOf } from "../core/dev";
import type { Engine } from "../core/engine";
import {
  IMPROVE_KINDS, IMPROVE_WHERE, LIMITS, PEER_DAYS, PEER_MIN_GIVERS, ZONES, ZONE_ROWS, cardStats, cleanProgram, cleanTag, customSkill, emptyProgram, endRound,
  indivTopicFor, isCustomSkill, oppShort, peerCounts, peerOpen, peerProgress, peerRoundOf, programOf, programStatus, programTodo, selfOf, skillArea, skillsFor,
  startRound, visibleProgram, xfSuggest, zoneRect, type CardStats,
} from "../core/program";
import type { DevProgram, Goal, ImproveItem, ImproveKind, PeerMate, Player } from "../core/types";
import { isGoalkeeper } from "../core/units";
import { tmpId, useEngine, useStore } from "../data/store";
import { EntrySheet, GoalProgress, GoalSheet, areaColor } from "./dev";
import { ratingColor } from "./games";
import { Icon, type IconName } from "./icons";
import { IndivRequestCard } from "./indivReq";
import { Avatar, Banner, Bar, Btn, Card, CardTitle, ChoiceChips, Chip, Col, Field, Info, Muted, Row, Seg, Sheet, T, ToggleRow, cap, useSurface } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { radius, useTheme, withAlpha, type Colors } from "./theme";

// ---------- Hilfen ----------
/** Anzeigename einer Stärke (Katalog oder eigener Begriff des Trainerteams „t:…“) */
export const skillLabel = (t: (k: string) => string, k: string): string => isCustomSkill(k) ? k.slice(2) : t("sk_" + k);
/** Farbe nach Bereich der Stärke (Technik, Taktik, Athletik, Persönlichkeit) – eigene Begriffe in Vereinsfarbe */
const skillColor = (c: Colors, k: string | null, fallback: string): string => { const a = k ? skillArea(k) : null; return a ? areaColor(c, a) : fallback; };
/** Stärkster Bereich je Drittel: „Angriffsdrittel“ → „linker Halbraum, Zentrum“ */
function zoneRows(E: Engine, zones: string[]): { row: string; lanes: string }[] {
  return ZONE_ROWS.map(r => ({ row: cap(E.t("ep_zr_" + r)), lanes: zones.filter(z => z[0] === r).map(z => E.t("ep_zl_" + z[1])).join(", ") })).filter(x => x.lanes);
}
const zoneName = (E: Engine, z: string): string => cap(E.tf("ep_zone", { l: E.t("ep_zl_" + z[1]), r: E.t("ep_zr_" + z[0]) }));
/** Torwart-Katalog für Mitspieler (nur Position bekannt) */
const mateGk = (m: PeerMate): boolean => m.pos === "TW";

// ---------- Kleine Bausteine ----------
type TagLook = "hero" | "solid" | "soft" | "plain";
/**
 * Stärke als Etikett, schräg wie ein Schriftzug auf dem Trikot. hero: auf der Spielerkarte (Vereinsfarbe), solid:
 * X-Faktor, soft: Waffen, plain: weitere Stärken. n: wie oft genannt (Stärken-Runde, nur Trainerteam).
 */
export function SkillTag({ k, look = "soft", n, big, testID }: { k: string; look?: TagLook; n?: number; big?: boolean; testID?: string }) {
  const E = useEngine(); const { c } = useTheme(); const surf = useSurface();
  const bg = look === "hero" ? c.accentInk : look === "solid" ? c.accent : look === "soft" ? c.accentSoft : surf === "surface" ? c.sunk : c.surface;
  const fg = look === "hero" ? c.accent : look === "solid" ? c.accentInk : look === "soft" ? c.accentTx : c.ink;
  const label = skillLabel(E.t, k);
  return (
    <View testID={testID} accessible accessibilityLabel={n != null ? `${label} ×${n}` : label}
      style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 4, paddingHorizontal: big ? 12 : 9, paddingVertical: big ? 6 : 4, transform: [{ skewX: "-10deg" }],
        borderWidth: look === "plain" && surf !== "surface" ? StyleSheet.hairlineWidth : 0, borderColor: c.line }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, transform: [{ skewX: "10deg" }] }}>
        <Text style={{ color: fg, fontWeight: look === "plain" ? "700" : "800", fontSize: big ? 15 : 13, letterSpacing: -0.1 }}>{label}</Text>
        {n != null ? <Text style={{ color: fg, opacity: 0.7, fontWeight: "700", fontSize: big ? 13 : 11.5, fontVariant: ["tabular-nums"] }}>×{n}</Text> : null}
      </View>
    </View>
  );
}

/** Großes X (X-Faktor): ein Strich kräftig, einer heller */
export function XMark({ size = 56, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M37 9 L11 39" stroke={color} strokeWidth={8.5} strokeLinecap="round" opacity={0.45} />
      <Path d="M11 9 L37 39" stroke={color} strokeWidth={8.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Kopf eines Programm-Bereichs: Säule (Perform, Improve) klein in Vereinsfarbe, darunter der Leitsatz */
function ProgHead({ kicker, title, info }: { kicker?: string; title: string; info?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Col gap={1} style={{ paddingHorizontal: 2 }}>
      {kicker ? <Text style={{ color: c.accentTx, fontSize: 13.5, fontWeight: "800", letterSpacing: 0.2 }}>{kicker}</Text> : null}
      <Row gap={6}><T v="h2" style={{ flexShrink: 1 }}>{title}</T>{info}</Row>
    </Col>
  );
}

/** Neutrale Kapsel (Ort, Hilfe) */
function Pill2({ label, icon }: { label: string; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      {icon ? <Icon name={icon} size={13} color={c.muted} strokeWidth={2} /> : null}
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{cap(label)}</Text>
    </View>
  );
}

/** Auswahl-Kapsel für Mehrfachauswahl (gewählt in Tintenfarbe wie ChoiceChips; accent/soft für Waffen und Stärken) */
function SelChip({ label, on, tone = "ink", disabled, onPress, testID }: { label: string; on: boolean; tone?: "ink" | "accent" | "soft"; disabled?: boolean; onPress: () => void; testID?: string }) {
  const { c } = useTheme(); const surf = useSurface();
  const fill = surf === "surface" ? c.sunk : c.surface, border = surf === "bg" ? c.line : fill;
  const bg = !on ? fill : tone === "accent" ? c.accent : tone === "soft" ? c.accentSoft : c.ink;
  const fg = !on ? c.ink : tone === "accent" ? c.accentInk : tone === "soft" ? c.accentTx : c.bg;
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!disabled }} accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ borderWidth: 1, borderColor: on ? bg : border, backgroundColor: bg, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13, opacity: disabled ? 0.38 : pressed ? 0.75 : 1 })}>
      <Text style={{ fontWeight: on ? "700" : "600", fontSize: 14, color: fg }}>{cap(label)}</Text>
    </Pressable>
  );
}
function MultiChips({ options, value, onChange, max, testID }: { options: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number; testID?: string }) {
  return (
    <Row wrap gap={6}>
      {options.map(o => {
        const on = value.includes(o.key);
        return <SelChip key={o.key} testID={testID ? testID + "-" + o.key : undefined} label={o.label} on={on} disabled={!on && max != null && value.length >= max}
          onPress={() => onChange(on ? value.filter(x => x !== o.key) : [...value, o.key])} />;
      })}
    </Row>
  );
}

// ---------- Spielerkarte ----------
/** Spielerkarte (Hauptelement der Seite): Bild, Name, Motto, X-Faktor und Saisonzahlen – so, wie der Spieler sie sieht */
export function PlayerCard({ p, prog, coach }: { p: Player; prog: DevProgram | null; coach?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const { width } = useWindowDimensions();
  const st = useMemo(() => cardStats(E.D, p, E.TODAY, true), [s.version, E, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const ink = c.accentInk, light = ink === "#ffffff";
  const sub = light ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.62)", hair = light ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.2)";
  const seeStats = E.playerSees("stats"), seeRate = E.playerSees("ratings");
  const y = Number(st.from.slice(0, 4)), season = `${t("ep_season")} ${y}/${String(y + 1).slice(2)}`;
  const tiles: { k: string; v: string; label: string }[] = [];
  if (seeStats) {
    tiles.push({ k: "games", v: String(st.games), label: t("ep_games") }, { k: "min", v: E.int(st.minutes), label: t("ep_minutes") });
    if (st.gk) tiles.push({ k: "clean", v: st.clean == null ? "–" : String(st.clean), label: t("ep_clean") }, { k: "conc", v: st.conceded == null ? "–" : String(st.conceded), label: t("ep_conceded") });
    else {
      tiles.push({ k: "goals", v: String(st.goals), label: t("ep_goals") }, { k: "assists", v: String(st.assists), label: t("ep_assists") });
      if (st.pre != null) tiles.push({ k: "pre", v: String(st.pre), label: t("ep_pre") });
    }
  }
  if (seeRate) tiles.push({ k: "avg", v: st.avg == null ? "–" : E.num(st.avg, 1), label: t("ep_avg") });
  const narrow = width < 560;
  const posName = t("pos_" + p.pos) !== "pos_" + p.pos ? t("pos_" + p.pos) : p.pos;
  // Motto als Schlagzeile über die ganze Breite (lange Mottos etwas kleiner, damit sie in eine Zeile passen)
  const tl = prog?.tag.length || 0, tagSize = tl <= 10 ? 34 : tl <= 14 ? 29 : tl <= 18 ? 24 : 20;
  return (
    <View testID="prog-card" style={{ backgroundColor: c.accent, borderRadius: radius.xl, paddingVertical: 18, paddingHorizontal: 20, gap: 16, overflow: "hidden" }}>
      <Row gap={14} align="center">
        <View style={{ borderWidth: 3, borderColor: light ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.75)", borderRadius: 44 }}><PlayerAvatar p={p} size={70} /></View>
        <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: sub, fontSize: 13.5, fontWeight: "700" }}>{[posName, E.team.name].filter(Boolean).join(" · ")}</Text>
          <Text numberOfLines={2} style={{ color: ink, fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.4 }}>{E.name(p)}</Text>
        </Col>
        {p.nr != null ? <Text accessibilityLabel={"#" + p.nr} style={{ color: ink, opacity: 0.92, fontSize: 40, lineHeight: 44, fontWeight: "900", letterSpacing: -1.5, fontVariant: ["tabular-nums"] }}>{p.nr}</Text> : null}
      </Row>
      {prog?.tag ? <Text testID="prog-tag" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: ink, fontSize: tagSize, lineHeight: Math.round(tagSize * 1.12), fontWeight: "900", letterSpacing: -0.03 * tagSize, marginTop: -4 }}>#{prog.tag}</Text> : null}
      <Col gap={8}>
        <Text style={{ color: sub, fontSize: 13, fontWeight: "700" }}>{t("ep_xf")}</Text>
        {prog?.xf.length ? <Row wrap gap={8}>{prog.xf.map(k => <SkillTag key={k} k={k} look="hero" big testID={"prog-xf-" + k} />)}</Row>
          : <Text style={{ color: sub, fontSize: 14.5, lineHeight: 20 }}>{coach ? t("ep_xfNoneC") : t("ep_xfNone")}</Text>}
      </Col>
      {tiles.length ? (
        <Col gap={8} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hair, paddingTop: 12 }}>
          <Text style={{ color: sub, fontSize: 12.5, fontWeight: "700" }}>{season}</Text>
          {st.has || st.avg != null ? (
            <View style={{ flexDirection: "row", flexWrap: narrow ? "wrap" : "nowrap", rowGap: 10 }}>
              {tiles.map(x => (
                <View key={x.k} testID={"prog-stat-" + x.k} style={narrow ? { flexBasis: "33.3%" } : { flex: 1 }}>
                  <Text style={{ color: ink, fontSize: 22, lineHeight: 26, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] }}>{x.v}</Text>
                  <Text numberOfLines={1} style={{ color: sub, fontSize: 12, fontWeight: "600" }}>{x.label}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={{ color: sub, fontSize: 14 }}>{t("ep_noStats")}</Text>}
        </Col>
      ) : null}
    </View>
  );
}

// ---------- Stärkster Bereich ----------
/** Feld hochkant (Angriff nach oben) mit den Zonen des stärksten Bereichs; onToggle: Zonen antippen (Trainerteam) */
export function ZonePitch({ zones, onToggle, width = 120, testID }: { zones: string[]; onToggle?: (z: string) => void; width?: number; testID?: string }) {
  const E = useEngine(); const { c } = useTheme();
  const W = width, H = (W * 111) / 74, k = W / 74, edit = !!onToggle;
  const ln = withAlpha(c.ink, 0.36), fill = withAlpha(c.accent, 0.62);
  const label = `${E.t("ep_zones")}: ${zones.length ? zoneRows(E, zones).map(x => `${x.row}: ${x.lanes}`).join("; ") : E.t("ep_zonesNone")}`;
  return (
    <View testID={testID} accessible={!edit} accessibilityLabel={edit ? undefined : label} style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox="-3 -3 74 111">
        <Rect x={-3} y={-3} width={74} height={111} rx={4} fill={c.sunk} />
        {zones.map(z => { const r = zoneRect(z); return r ? <Rect key={z} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} /> : null; })}
        {edit ? (
          <G stroke={withAlpha(c.ink, 0.22)} strokeWidth={0.4} strokeDasharray="1.4 1.4">
            {[13.84, 24.84, 43.16, 54.16].map(x => <Line key={"x" + x} x1={x} y1={0} x2={x} y2={105} />)}
            {[35, 70].map(y => <Line key={"y" + y} x1={0} y1={y} x2={68} y2={y} />)}
          </G>
        ) : null}
        <G stroke={ln} strokeWidth={0.7} fill="none">
          <Rect x={0} y={0} width={68} height={105} />
          <Line x1={0} y1={52.5} x2={68} y2={52.5} />
          <Circle cx={34} cy={52.5} r={9.15} />
          <Rect x={13.84} y={0} width={40.32} height={16.5} />
          <Rect x={24.84} y={0} width={18.32} height={5.5} />
          <Path d="M26.69 16.5 A9.15 9.15 0 0 0 41.31 16.5" />
          <Rect x={13.84} y={88.5} width={40.32} height={16.5} />
          <Rect x={24.84} y={99.5} width={18.32} height={5.5} />
          <Path d="M26.69 88.5 A9.15 9.15 0 0 1 41.31 88.5" />
          <Rect x={30.34} y={-1.8} width={7.32} height={1.8} />
          <Rect x={30.34} y={105} width={7.32} height={1.8} />
        </G>
        <Circle cx={34} cy={52.5} r={0.8} fill={ln} />
        <Circle cx={34} cy={11} r={0.8} fill={ln} />
        <Circle cx={34} cy={94} r={0.8} fill={ln} />
      </Svg>
      {edit ? ZONES.map(z => {
        const r = zoneRect(z)!; const on = zones.includes(z);
        return <Pressable key={z} testID={testID ? testID + "-" + z : undefined} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={zoneName(E, z)}
          onPress={() => onToggle!(z)} style={{ position: "absolute", left: (r.x + 3) * k, top: (r.y + 3) * k, width: r.w * k, height: r.h * k }} />;
      }) : null}
    </View>
  );
}
/** Zonen in Worten, je Drittel */
function ZoneText({ zones }: { zones: string[] }) {
  const E = useEngine(); const { c } = useTheme();
  if (!zones.length) return <Muted small>{E.t("ep_zonesNone")}</Muted>;
  return (
    <Col gap={6}>
      {zoneRows(E, zones).map(x => <Text key={x.row} style={{ color: c.ink, fontSize: 14, lineHeight: 19 }}><Text style={{ fontWeight: "700" }}>{x.row}</Text>{"\n"}{x.lanes}</Text>)}
    </Col>
  );
}

// ---------- Notenverlauf ----------
/** Spielnoten der Saison als Linie (0–10), gestrichelt der Schnitt, darunter der Gegner */
export function RatingTrend({ series, avg }: { series: CardStats["series"]; avg: number | null }) {
  const E = useEngine(); const { c } = useTheme(); const [w, setW] = useState(0);
  const L = series.slice(-12), H = 158, pl = 24, pr = 38, pt = 14, pb = 28;
  if (L.length < 2) return <Muted small>{E.t("ep_trendFew")}</Muted>;
  const lo = Math.max(1, Math.min(5, Math.floor(Math.min(...L.map(x => x.rating))))), hi = 10;
  const iw = Math.max(1, w - pl - pr), ih = H - pt - pb;
  const X = (i: number) => pl + (i * iw) / (L.length - 1), Y = (v: number) => pt + ((hi - v) / (hi - lo)) * ih;
  const step = hi - lo > 5 ? 2 : 1, ticks: number[] = [];
  for (let v = hi; v >= lo; v -= step) ticks.push(v);
  const every = L.length > 8 ? 2 : 1, last = L[L.length - 1];
  const a11y = `${E.t("ep_trend")}: ${L.map(x => `${x.opp || E.de(x.date)} ${E.num(x.rating, 1)}`).join(", ")}${avg != null ? ` · Ø ${E.num(avg, 1)}` : ""}`;
  return (
    <View testID="prog-trend-chart" accessible accessibilityLabel={a11y} onLayout={e => setW(Math.round(e.nativeEvent.layout.width))} style={{ height: H }}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {ticks.map(v => (
            <G key={v}>
              <Line x1={pl} x2={w - pr} y1={Y(v)} y2={Y(v)} stroke={c.line} strokeWidth={1} />
              <SvgText x={pl - 6} y={Y(v) + 3.5} fontSize={10} fill={c.muted} textAnchor="end">{String(v)}</SvgText>
            </G>
          ))}
          {avg != null ? (
            <G>
              <Line x1={pl} x2={w - pr} y1={Y(avg)} y2={Y(avg)} stroke={c.muted} strokeWidth={1.2} strokeDasharray="4 4" />
              <SvgText x={w - pr + 5} y={Y(avg) + 3.5} fontSize={10.5} fontWeight="700" fill={c.muted}>{"Ø " + E.num(avg, 1)}</SvgText>
            </G>
          ) : null}
          <Polyline points={L.map((x, i) => `${X(i)},${Y(x.rating)}`).join(" ")} fill="none" stroke={c.accent} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          {L.map((x, i) => <Circle key={i} cx={X(i)} cy={Y(x.rating)} r={4.4} fill={x.rating >= 7 ? ratingColor(x.rating) : c.muted} stroke={c.surface} strokeWidth={1.6} />)}
          <SvgText x={X(L.length - 1)} y={Y(last.rating) - 9} fontSize={11} fontWeight="800" fill={c.ink} textAnchor="middle">{E.num(last.rating, 1)}</SvgText>
          {L.map((x, i) => i % every === 0 || i === L.length - 1
            ? <SvgText key={"l" + i} x={X(i)} y={H - 9} fontSize={9.5} fontWeight="600" fill={c.muted} textAnchor="middle">{oppShort(x.opp) || E.de(x.date)}</SvgText> : null)}
        </Svg>
      ) : null}
    </View>
  );
}
/** Stärkster Bereich und Notenverlauf (nebeneinander auf breiten Bildschirmen) */
function AreaTrend({ p, prog }: { p: Player; prog: DevProgram }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const { width } = useWindowDimensions();
  const st = useMemo(() => cardStats(E.D, p, E.TODAY, true), [s.version, E, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const trend = E.playerSees("ratings") && st.series.length >= 2, zones = prog.zones.length > 0;
  if (!trend && !zones) return null;
  const wide = width >= 760 && trend && zones;
  const zoneCard = zones ? (
    <Card testID="prog-zones" style={wide ? { flex: 1 } : undefined}>
      <CardTitle title={t("ep_zones")} />
      <Row gap={16} align="flex-start">
        <ZonePitch zones={prog.zones} width={104} />
        <Col gap={10} style={{ flex: 1, minWidth: 0 }}>
          <ZoneText zones={prog.zones} />
          <Row gap={4}><Icon name="up" size={13} color={c.muted} strokeWidth={2.4} /><Muted small>{t("ep_dir")}</Muted></Row>
        </Col>
      </Row>
    </Card>
  ) : null;
  const trendCard = trend ? (
    <Card testID="prog-trend" style={wide ? { flex: 1.4 } : undefined}>
      <CardTitle title={t("ep_trend")} info={<Info title={t("ep_trend")} text={t("ep_trendD")} />} />
      {st.series.length > 12 ? <Muted small>{tf("ep_lastN", { n: 12 })}</Muted> : null}
      <RatingTrend series={st.series} avg={st.avg} />
    </Card>
  ) : null;
  return wide ? <Row gap={16} align="flex-start">{zoneCard}{trendCard}</Row> : <Col gap={20}>{zoneCard}{trendCard}</Col>;
}

// ---------- Perform ----------
/** Perform – „So mache ich den Unterschied“: X-Faktor und bis zu drei Situationen in Ich-Form */
export function PerformCard({ prog }: { prog: DevProgram }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  return (
    <View testID="prog-perform" style={{ gap: 8 }}>
      <ProgHead kicker={t("ep_perform")} title={t("ep_performT")} />
      <Card>
        <Row gap={14} align="center">
          <XMark size={56} color={c.accent} />
          <Col gap={8} style={{ flex: 1, minWidth: 0 }}>
            <T v="eyebrow">{t("ep_xf")}</T>
            {prog.xf.length ? <Row wrap gap={6}>{prog.xf.map(k => <SkillTag key={k} k={k} look="solid" big />)}</Row> : <Muted small>{t("ep_xfNoneC")}</Muted>}
          </Col>
        </Row>
        {prog.sit.length ? (
          <Col gap={12} style={{ marginTop: 2 }}>
            {prog.sit.map((x, i) => (
              <Row key={i} gap={12} align="flex-start" testID={"prog-sit-" + i}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: c.accentTx, fontWeight: "900", fontSize: 15, fontVariant: ["tabular-nums"] }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, color: c.ink, fontSize: 16, lineHeight: 22, fontWeight: "600", paddingTop: 4 }}>{x}</Text>
              </Row>
            ))}
          </Col>
        ) : null}
      </Card>
    </View>
  );
}

// ---------- Improve ----------
/** Ein Feld unter „Improve“: Art, Thema, wie es gelingt, wo verbessern, wo nach Hilfe fragen, messbares Ziel */
function ImproveCard({ x, forPlayer, onEntry, onIndiv }: { x: ImproveItem; forPlayer?: boolean; onEntry: (g: Goal) => void; onIndiv: (x: ImproveItem) => void }) {
  const E = useEngine(); const { t } = E; const { c, dark } = useTheme();
  const col = skillColor(c, x.skill, c.accentTx);
  const goal = x.goalId ? E.D.goals.find(g => g.id === x.goalId && (!forPlayer || g.vis || g.by === "player")) || null : null;
  const title = x.topic || (x.skill ? skillLabel(t, x.skill) : "");
  const helps = x.help.map(h => h === "team" ? t("ep_h_team") : h === "mates" ? t("ep_h_mates") : E.D.staff.find(y => y.id === h)?.name || "").filter(Boolean);
  const canIq = !!forPlayer && x.where.includes("indiv") && E.team.settings.indivReq !== false;
  return (
    <View testID={"prog-imp-" + x.kind} style={{ flex: 1, backgroundColor: withAlpha(col, dark ? 0.1 : 0.06), borderWidth: 1, borderColor: withAlpha(col, 0.3), borderRadius: radius.l, padding: 14, gap: 12 }}>
      <Col gap={3}>
        <Text style={{ color: col, fontSize: 13, fontWeight: "800" }}>{t("ep_ik_" + x.kind)}</Text>
        <Text style={{ color: c.ink, fontSize: 19, lineHeight: 24, fontWeight: "800", letterSpacing: -0.35 }}>{title}</Text>
        {x.how ? <T v="small" color={c.muted}>{x.how}</T> : null}
      </Col>
      {x.where.length ? <Col gap={6}><T v="eyebrow">{t("ep_where")}</T><Row wrap gap={6}>{x.where.map(w => <Pill2 key={w} label={t("ep_w_" + w)} />)}</Row></Col> : null}
      {helps.length ? <Col gap={6}><T v="eyebrow">{t("ep_help")}</T><Row wrap gap={6}>{helps.map((h, i) => <Pill2 key={i} label={h} icon="people" />)}</Row></Col> : null}
      {goal ? (
        <Col gap={6}>
          <T v="small" bold>{goal.title}</T>
          <GoalProgress g={goal} st={goalProgress(E.D, goal, E.TODAY)} />
          {forPlayer && goal.status === "active" && (goal.metric === "count" || goal.metric === "value")
            ? <Btn small icon="plus" testID={"prog-imp-" + x.kind + "-add"} label={t("dv_add")} onPress={() => onEntry(goal)} style={{ alignSelf: "flex-start" }} /> : null}
        </Col>
      ) : null}
      {canIq ? <Btn small kind="ghost" icon="whistle" testID={"prog-imp-" + x.kind + "-iq"} label={t("ep_iq")} onPress={() => onIndiv(x)} style={{ alignSelf: "flex-start" }} /> : null}
    </View>
  );
}
/** Improve – „Arbeite hart und clever an deinem Weg“: bis zu vier Felder (auf breiten Bildschirmen zweispaltig) */
export function ImproveList({ p, prog, forPlayer }: { p: Player; prog: DevProgram; forPlayer?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { width } = useWindowDimensions();
  const [entry, setEntry] = useState<Goal | null>(null);
  const [iq, setIq] = useState<ImproveItem | null>(null);
  const two = width >= 760 && prog.improve.length > 1, gk = isGoalkeeper(E.D, p);
  return (
    <View testID="prog-improve" style={{ gap: 8 }}>
      <ProgHead kicker={t("ep_improve")} title={t("ep_improveT")} />
      <View style={{ flexDirection: two ? "row" : "column", flexWrap: "wrap", gap: 12 }}>
        {prog.improve.map(x => (
          <View key={x.kind} style={two ? { flexBasis: "47%", flexGrow: 1 } : undefined}>
            <ImproveCard x={x} forPlayer={forPlayer} onEntry={setEntry} onIndiv={setIq} />
          </View>
        ))}
      </View>
      <EntrySheet goal={entry} onClose={() => setEntry(null)} />
      <Sheet visible={!!iq} onClose={() => setIq(null)} title={t("ep_iq")} testID="prog-iq-sheet" closeLabel={t("cancel")}>
        {iq ? <IndivRequestCard pid={p.id} bare onSent={() => setIq(null)} preset={{
          topic: indivTopicFor(iq, gk), note: tf("ep_iqNote", { t: iq.topic || (iq.skill ? skillLabel(t, iq.skill) : "") }),
          ask: iq.help.find(h => h !== "team" && h !== "mates") || null,
        }} /> : null}
      </Sheet>
    </View>
  );
}

// ---------- So sehen wir dich ----------
/**
 * Selbstanalyse, Mitspieler (Stärken-Runde) und Trainerteam nebeneinander. Was zum X-Faktor gehört, ist farbig – so
 * sieht man, wo sich die Sichten treffen. Spieler sehen bei den Mitspielern nur, was das Trainerteam ausgewählt hat;
 * das Trainerteam sieht darunter zusätzlich die ganze Runde (ohne Namen).
 */
export function ViewsCard({ p, prog, forPlayer, onSelf }: { p: Player; prog: DevProgram | null; forPlayer?: boolean; onSelf?: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const { width } = useWindowDimensions();
  const self = selfOf(E.D, p.id), xf = new Set(prog?.xf || []);
  const since = peerRoundOf(E.team.settings)?.since ?? null;
  const counts = useMemo(() => forPlayer ? null : peerCounts(E.D.peerGifts, p.id, since), [s.version, E, p.id, since, forPlayer]); // eslint-disable-line react-hooks/exhaustive-deps
  const wide = width >= 640;
  const tags = (L: string[], look: "soft" | "plain") => L.map(k => <SkillTag key={k} k={k} look={xf.has(k) ? "solid" : look} />);
  const col = (key: string, title: string, body: React.ReactNode) => (
    <Col key={key} gap={8} testID={"prog-view-" + key} style={wide ? { flex: 1, minWidth: 0 } : undefined}>
      <Text style={{ color: c.ink, fontSize: 14.5, fontWeight: "800" }}>{title}</Text>
      {body}
    </Col>
  );
  const selfBody = self && (self.weapons.length || self.skills.length)
    ? <Col gap={6}><Row wrap gap={6}>{tags(self.weapons, "soft")}{tags(self.skills, "plain")}</Row>{!forPlayer && self.at ? <Muted small>{tf("ep_selfFrom", { d: E.de(self.at.slice(0, 10)) })}</Muted> : null}</Col>
    : <Muted small>{forPlayer ? t("ep_selfAskP") : t("ep_selfNone")}</Muted>;
  const peers = prog?.peers || [];
  const matesBody = (
    <Col gap={6}>
      {peers.length ? <Row wrap gap={6}>{tags(peers, "plain")}</Row> : <Muted small>{t("ep_matesNone")}</Muted>}
      {counts && counts.list.length ? (
        <Muted small>{tf("ep_peersCount", { n: counts.givers })}{counts.givers < PEER_MIN_GIVERS ? " · " + tf("ep_peersFew", { n: PEER_MIN_GIVERS }) : ""}: {counts.list.slice(0, 8).map(x => `${skillLabel(t, x.key)} ×${x.n}`).join(", ")}</Muted>
      ) : null}
    </Col>
  );
  const coachBody = prog && (prog.coach.weapons.length || prog.coach.skills.length)
    ? <Row wrap gap={6}>{tags(prog.coach.weapons, "soft")}{tags(prog.coach.skills, "plain")}</Row> : <Muted small>{t("ep_none")}</Muted>;
  return (
    <Card testID="prog-views">
      <CardTitle title={t("ep_views")} info={<Info title={t("ep_views")} text={[t("ep_viewsD"), t("ep_legend")]} />} />
      <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 18 : 16 }}>
        {col("self", t("ep_v_self"), selfBody)}
        {col("mates", t("ep_v_mates"), matesBody)}
        {col("coach", t("ep_v_coach"), coachBody)}
      </View>
      {xf.size ? <Row gap={8}><XMark size={18} color={c.accent} /><Muted small>{t("ep_legend")}</Muted></Row> : null}
      {forPlayer && onSelf ? <Btn small kind={self ? "default" : "primary"} icon="eintragen" testID="prog-self" label={self ? t("ep_selfEdit") : t("ep_selfBtn")} onPress={onSelf} style={{ alignSelf: "flex-start" }} /> : null}
    </Card>
  );
}

// ---------- Stärken auswählen ----------
export interface SkillPick {
  title: string; info?: string; value: string[]; max: number;
  /** eigene Begriffe erlaubt (nur Trainerteam) */ custom?: boolean;
  /** Torwart-Katalog */ gk?: boolean;
  exclude?: string[]; onDone: (v: string[]) => void; extra?: React.ReactNode; testID?: string;
}
/** Blatt: Stärken aus dem Katalog wählen (nach Bereichen), optional eigene Begriffe */
export function SkillPickerSheet({ pick, onClose }: { pick: SkillPick | null; onClose: () => void }) {
  return pick ? <SkillPickerForm pick={pick} onClose={onClose} /> : null;
}
function SkillPickerForm({ pick, onClose }: { pick: SkillPick; onClose: () => void }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [sel, setSel] = useState<string[]>(pick.value); const [own, setOwn] = useState("");
  const ex = pick.exclude || [], id = pick.testID || "skill-pick", full = sel.length >= pick.max;
  const groups = DEV_AREAS.map(a => ({ a, L: skillsFor(!!pick.gk).filter(x => x.area === a && !ex.includes(x.key)) })).filter(g => g.L.length);
  const toggle = (k: string) => setSel(L => L.includes(k) ? L.filter(x => x !== k) : pick.max === 1 ? [k] : L.length >= pick.max ? L : [...L, k]);
  const addOwn = () => {
    const k = customSkill(own);
    if (k.length > 2 && !full && !sel.some(x => x.toLowerCase() === k.toLowerCase())) setSel([...sel, k]);
    setOwn("");
  };
  return (
    <Sheet visible onClose={onClose} title={pick.title} testID={id} closeLabel={t("cancel")}>
      {pick.info ? <Muted small>{pick.info}</Muted> : null}
      <Row between gap={8}>
        <T v="small" bold>{tf("ep_pickN", { n: sel.length, m: pick.max })}</T>
        {full && pick.max > 1 ? <Muted small>{tf("ep_max", { n: pick.max })}</Muted> : null}
      </Row>
      {sel.length ? (
        <Row wrap gap={8}>
          {sel.map(k => (
            <Pressable key={k} testID={id + "-sel-" + k} accessibilityRole="button" accessibilityLabel={`${skillLabel(t, k)} – ${t("del")}`} onPress={() => toggle(k)}>
              <Row gap={4}><SkillTag k={k} look="solid" /><Icon name="close" size={13} color={c.muted} strokeWidth={2.4} /></Row>
            </Pressable>
          ))}
        </Row>
      ) : null}
      {groups.map(g => (
        <Col key={g.a} gap={6}>
          <Text style={{ color: areaColor(c, g.a), fontSize: 13, fontWeight: "800" }}>{t("da_" + g.a)}</Text>
          <Row wrap gap={6}>
            {g.L.map(x => { const on = sel.includes(x.key); return <SelChip key={x.key} testID={id + "-" + x.key} label={skillLabel(t, x.key)} on={on} disabled={!on && full && pick.max > 1} onPress={() => toggle(x.key)} />; })}
          </Row>
        </Col>
      ))}
      {pick.custom ? (
        <Row gap={8} align="flex-end">
          <Field testID={id + "-own"} label={t("ep_own")} value={own} onChangeText={setOwn} placeholder={t("ep_ownPh")} maxLength={LIMITS.custom} style={{ flex: 1 }} />
          <Btn testID={id + "-own-add"} icon="plus" label="" a11y={t("ep_add")} disabled={!own.trim() || full} onPress={addOwn} />
        </Row>
      ) : null}
      {pick.extra}
      <Btn testID={id + "-save"} kind="primary" label={t("save")} onPress={() => { pick.onDone(sel); onClose(); }} />
    </Sheet>
  );
}

// ---------- Selbstanalyse (Spieler) ----------
/** Blatt: Waffen (bis zu 3) und weitere Stärken (bis zu 3) aus dem Katalog – das Trainerteam sieht die Auswahl */
export function SelfSheet({ p, visible, onClose }: { p: Player; visible: boolean; onClose: () => void }) {
  return visible ? <SelfForm p={p} onClose={onClose} /> : null;
}
function SelfForm({ p, onClose }: { p: Player; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const cur = selfOf(E.D, p.id);
  const [w, setW] = useState<string[]>(cur?.weapons || []); const [o, setO] = useState<string[]>(cur?.skills || []);
  const [mode, setMode] = useState<"w" | "o">("w"); const [busy, setBusy] = useState(false);
  const groups = DEV_AREAS.map(a => ({ a, L: skillsFor(isGoalkeeper(E.D, p)).filter(x => x.area === a) }));
  const tap = (k: string) => {
    if (mode === "w") { if (w.includes(k)) setW(w.filter(x => x !== k)); else if (w.length < LIMITS.weapons) { setW([...w, k]); setO(o.filter(x => x !== k)); } }
    else if (o.includes(k)) setO(o.filter(x => x !== k));
    else if (o.length < LIMITS.skills) { setO([...o, k]); setW(w.filter(x => x !== k)); }
  };
  const save = async () => { setBusy(true); try { await s.saveSelfSkills({ pid: p.id, weapons: w, skills: o, at: null }); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible onClose={onClose} title={t("ep_selfT")} testID="self-sheet" closeLabel={t("cancel")}>
      <Muted small>{t("ep_selfInfo")}</Muted>
      <Seg testID="self-mode" value={mode} onChange={setMode} options={[
        { key: "w", label: `${t("ep_weapons")} · ${w.length}/${LIMITS.weapons}` }, { key: "o", label: `${t("ep_skills")} · ${o.length}/${LIMITS.skills}` },
      ]} />
      {w.length || o.length ? <Row wrap gap={6}>{w.map(k => <SkillTag key={k} k={k} look="solid" />)}{o.map(k => <SkillTag key={k} k={k} look="soft" />)}</Row> : null}
      {groups.map(g => (
        <Col key={g.a} gap={6}>
          <Text style={{ color: areaColor(c, g.a), fontSize: 13, fontWeight: "800" }}>{t("da_" + g.a)}</Text>
          <Row wrap gap={6}>
            {g.L.map(x => {
              const inW = w.includes(x.key), inO = o.includes(x.key), on = inW || inO;
              const full = mode === "w" ? !inW && w.length >= LIMITS.weapons : !inO && o.length >= LIMITS.skills;
              return <SelChip key={x.key} testID={"self-" + x.key} label={skillLabel(t, x.key)} on={on} tone={inW ? "accent" : "soft"} disabled={full && !on} onPress={() => tap(x.key)} />;
            })}
          </Row>
        </Col>
      ))}
      <Btn testID="self-save" kind="primary" label={t("save")} disabled={busy || (!w.length && !o.length && !cur)} onPress={save} />
    </Sheet>
  );
}

// ---------- Stärken-Runde ----------
/** Spieler: Mitspielern bis zu drei Stärken schenken (nur während einer Runde; Empfänger sehen keine Namen) */
export function PeerRoundCard({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [pick, setPick] = useState<PeerMate | null>(null); const [all, setAll] = useState(false);
  const r = peerRoundOf(E.team.settings);
  if (!r || !peerOpen(E.team.settings, E.TODAY)) return null;
  const mates = s.peerMates;
  const mine = new Map(E.D.peerGifts.filter(g => g.giver === p.id && g.at.slice(0, 10) >= r.since).map(g => [g.target, g.skills] as const));
  const n = mates.filter(m => mine.has(m.id)).length, shown = all ? mates : mates.slice(0, 6);
  const give = (m: PeerMate, skills: string[]) => s.savePeerGift({ giver: p.id, target: m.id, skills, at: "" });
  return (
    <Card testID="peer-round">
      <CardTitle title={t("ep_peerT")} info={<Info title={t("ep_peerT")} text={t("ep_peerInfo")} />} right={<Chip label={tf("ep_peerUntil", { d: E.de(r.until) })} color={c.ok} />} />
      <Col gap={6}>
        <T v="h3">{t("ep_peerQ")}</T>
        {mates.length ? <Bar value={n / mates.length} color={c.ok} /> : null}
        <Muted small>{n ? tf("ep_peerGiven", { n }) : t("ep_peerGiven0")}</Muted>
      </Col>
      {mates.length ? (
        <Col gap={0}>
          {shown.map(m => {
            const g = mine.get(m.id);
            return (
              <Pressable key={m.id} testID={"peer-" + m.id} accessibilityRole="button" accessibilityLabel={`${m.name}: ${g ? g.map(k => skillLabel(t, k)).join(", ") : t("ep_peerGive")}`} onPress={() => setPick(m)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
                <Avatar id={m.id} first={m.name} last={m.name.split(" ")[1] || ""} size={38} />
                <Col gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: c.ink }}>{m.name}</Text>
                  {g ? <Row wrap gap={5}>{g.map(k => <SkillTag key={k} k={k} look="soft" />)}</Row>
                    : <Muted small>{[m.nr != null ? "#" + m.nr : "", m.pos].filter(Boolean).join(" · ")}</Muted>}
                </Col>
                {g ? <Icon name="check" size={18} color={c.ok} strokeWidth={2.4} /> : <Text style={{ color: c.accentTx, fontWeight: "700", fontSize: 14 }}>{t("ep_peerGive")}</Text>}
              </Pressable>
            );
          })}
          {mates.length > shown.length ? <Btn small kind="ghost" testID="peer-all" label={tf("ep_peerAll", { n: mates.length })} onPress={() => setAll(true)} style={{ alignSelf: "flex-start" }} /> : null}
        </Col>
      ) : <Muted small>{t("ep_peerNone")}</Muted>}
      <SkillPickerSheet onClose={() => setPick(null)} pick={pick ? {
        title: tf("ep_peerPickT", { n: pick.name.split(" ")[0] }), info: t("ep_peerMax"), value: mine.get(pick.id) || [], max: LIMITS.gift, gk: mateGk(pick), testID: "peer-pick",
        onDone: v => { give(pick, v); },
        extra: mine.has(pick.id) ? <Btn kind="ghost" testID="peer-remove" label={t("ep_peerRemove")} onPress={() => { give(pick, []); setPick(null); }} /> : undefined,
      } : null} />
    </Card>
  );
}

/** Trainerteam: Stärken-Runde starten (7/14/21 Tage), beenden, Teilnahme sehen */
export function PeerRoundAdmin() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [days, setDays] = useState<string>("14");
  const r = peerRoundOf(E.team.settings), open = peerOpen(E.team.settings, E.TODAY);
  const pr = r ? peerProgress(E.D.peerGifts, E.D.players, r.since) : null;
  const can = s.can("notes");
  return (
    <Card testID="peer-admin">
      <CardTitle title={t("ep_peerT")} info={<Info title={t("ep_peerT")} text={t("ep_roundInfo")} />} right={open && r ? <Chip label={tf("ep_roundOpen", { d: E.de(r.until) })} color={c.ok} /> : undefined} />
      {r && pr ? (
        <Col gap={6}>
          {!open ? <Muted small>{tf("ep_roundClosed", { a: E.de(r.since), b: E.de(r.until) })}</Muted> : null}
          <T v="small">{tf("ep_roundProgress", { a: pr.givers, b: pr.players, c: pr.received })}</T>
          <Bar value={pr.players ? pr.givers / pr.players : 0} color={open ? c.ok : c.build} />
        </Col>
      ) : <Muted small>{t("ep_roundInfo")}</Muted>}
      {can ? (open && r
        ? <Btn small testID="peer-stop" label={t("ep_roundStop")} onPress={() => s.setPeerRound(endRound(r, E.TODAY), t("ep_roundStopped"))} style={{ alignSelf: "flex-start" }} />
        : (
          <Col gap={8}>
            <T v="small" bold>{t("ep_roundDays")}</T>
            <ChoiceChips testID="peer-days" value={days} onChange={setDays} options={PEER_DAYS.map(n => ({ key: String(n), label: tf("ep_roundDaysN", { n }) }))} />
            <Btn small kind="primary" testID="peer-start" label={t("ep_roundStart")} onPress={() => s.setPeerRound(startRound(E.TODAY, Number(days)), t("ep_roundStarted"))} style={{ alignSelf: "flex-start" }} />
          </Col>
        )) : null}
    </Card>
  );
}

// ---------- Ganzes Programm ----------
/** Das Programm, wie der Spieler es sieht (Spieler-App „Mein Weg“ und Vorschau des Trainerteams) */
export function ProgramView({ p, prog, coach, onSelf, afterCard }: { p: Player; prog: DevProgram; coach?: boolean; onSelf?: () => void; afterCard?: React.ReactNode }) {
  return (
    <Col gap={20} testID="prog-view">
      <PlayerCard p={p} prog={prog} coach={coach} />
      {afterCard}
      {prog.xf.length || prog.sit.length ? <PerformCard prog={prog} /> : null}
      {prog.improve.length ? <ImproveList p={p} prog={prog} forPlayer={!coach} /> : null}
      <AreaTrend p={p} prog={prog} />
      <ViewsCard p={p} prog={prog} forPlayer={!coach} onSelf={onSelf} />
    </Col>
  );
}

/** Trainerteam: Reiter „Programm“ eines Spielers – Stand, offene Punkte, Bearbeiten, Spieler informieren, Vorschau */
export function CoachProgramView({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [edit, setEdit] = useState(false); const [told, setTold] = useState(false);
  const prog = programOf(E.D, p.id), st = programStatus(prog), todo = prog ? programTodo(prog) : [];
  const notify = () => {
    s.saveMessage(p.id, { id: tmpId(), date: E.TODAY, typ: "info", text: t("ep_notifyMsg"), bis: addDays(E.TODAY, 14) });
    setTold(true); s.toast(t("ep_notified"));
  };
  return (
    <Col gap={20}>
      <Card testID="prog-status">
        <CardTitle title={t("ep_title")} info={<Info title={t("ep_title")} text={t("ep_info")} />} />
        <Row wrap gap={8}>
          <Chip testID="prog-st" label={t("ep_status_" + st)} color={st === "live" ? c.ok : st === "draft" ? c.warn : c.build} />
          {st === "live" && prog?.at ? <Muted small>{tf("ep_updated", { d: E.de(prog.at.slice(0, 10)) })}</Muted> : null}
        </Row>
        {st === "none" ? <Muted small>{t("ep_emptyCoach")}</Muted> : null}
        {st !== "none" && todo.length ? <Muted small>{t("ep_todo")}: {todo.map(k => t("ep_todo_" + k)).join(" · ")}</Muted> : null}
        {st === "draft" ? <Muted small>{t("ep_previewD")}</Muted> : null}
        <Row wrap gap={8}>
          {s.can("notes") ? <Btn small kind="primary" icon="eintragen" testID="prog-edit" label={st === "none" ? t("ep_new") : t("ep_edit")} onPress={() => setEdit(true)} /> : null}
          {st === "live" && s.can("messages") && p.userId ? <Btn small testID="prog-notify" icon="send" label={told ? t("ep_notified") : t("ep_notify")} disabled={told} onPress={notify} /> : null}
        </Row>
      </Card>
      {prog && st !== "none" ? (
        <Col gap={10}>
          <Text style={{ color: c.muted, fontWeight: "700", fontSize: 13.5, paddingHorizontal: 2 }}>{t("ep_preview")}</Text>
          <ProgramView p={p} prog={prog} coach />
        </Col>
      ) : <ViewsCard p={p} prog={null} />}
      <ProgramEditor p={p} visible={edit} onClose={() => setEdit(false)} />
    </Col>
  );
}

// ---------- Programm bearbeiten (Trainerteam) ----------
function EdBlock({ title, desc, children, testID }: { title: string; desc?: string; children?: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  return (
    <Col gap={10} testID={testID} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 14 }}>
      <Col gap={2}><T v="h3">{title}</T>{desc ? <Muted small>{desc}</Muted> : null}</Col>
      {children}
    </Col>
  );
}
const blankItem = (kind: ImproveKind): ImproveItem => ({ kind, topic: "", skill: null, where: [], help: [], how: "", goalId: null });

/** Blatt: Programm anlegen oder bearbeiten */
export function ProgramEditor({ p, visible, onClose }: { p: Player; visible: boolean; onClose: () => void }) {
  return visible ? <ProgramForm p={p} onClose={onClose} /> : null;
}
function ProgramForm({ p, onClose }: { p: Player; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const cur = programOf(E.D, p.id);
  const [x, setX] = useState<DevProgram>(() => cur ? cleanProgram(cur) : emptyProgram(p.id));
  const set = (patch: Partial<DevProgram>) => setX(prev => ({ ...prev, ...patch }));
  const [pick, setPick] = useState<SkillPick | null>(null);
  const [goalT, setGoalT] = useState<{ p: Player; pre?: Partial<Goal> } | null>(null);
  const goalFor = useRef<{ kind: ImproveKind; before: Set<string> } | null>(null);
  const [busy, setBusy] = useState(false); const [sure, setSure] = useState(false);
  const gk = isGoalkeeper(E.D, p), self = selfOf(E.D, p.id);
  const since = peerRoundOf(E.team.settings)?.since ?? null;
  const counts = useMemo(() => peerCounts(E.D.peerGifts, p.id, since), [s.version, E, p.id, since]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugg = xfSuggest(x.coach, self, counts.list).filter(y => !x.xf.includes(y.key)).slice(0, 5);
  const goals = goalsOf(E.D, p.id).filter(g => g.status === "active");
  const itemOf = (k: ImproveKind): ImproveItem => x.improve.find(i => i.kind === k) || blankItem(k);
  const setItem = (k: ImproveKind, patch: Partial<ImproveItem>) => setX(prev => ({ ...prev, improve: [...prev.improve.filter(i => i.kind !== k), { ...(prev.improve.find(i => i.kind === k) || blankItem(k)), ...patch }] }));
  const sitAt = (i: number, v: string) => { const L = [...x.sit]; while (L.length < LIMITS.sit) L.push(""); L[i] = v; set({ sit: L }); };
  const peerKeys = [...counts.list.map(y => y.key), ...x.peers.filter(k => !counts.list.some(y => y.key === k))];
  const togglePeer = (k: string) => set({ peers: x.peers.includes(k) ? x.peers.filter(y => y !== k) : x.peers.length >= LIMITS.peers ? x.peers : [...x.peers, k] });
  const helpOptions = [{ key: "team", label: t("ep_h_team") }, { key: "mates", label: t("ep_h_mates") }, ...E.D.staff.map(y => ({ key: y.id, label: y.name }))];
  const openGoal = (k: ImproveKind) => {
    const it = itemOf(k);
    goalFor.current = { kind: k, before: new Set(goalsOf(E.D, p.id).map(g => g.id)) };
    setGoalT({ p, pre: { title: (it.topic || (it.skill ? skillLabel(t, it.skill) : "")).slice(0, 120), area: (it.skill && skillArea(it.skill)) || "tech" } });
  };
  // Neu angelegtes Ziel gleich mit dem Feld verknüpfen
  const closeGoal = () => {
    const g0 = goalFor.current; goalFor.current = null; setGoalT(null);
    if (!g0) return;
    const fresh = (s.D?.goals || []).filter(g => g.pid === p.id && !g0.before.has(g.id) && !g.id.startsWith("tmp-"));
    const g = fresh[fresh.length - 1];
    if (g) setItem(g0.kind, { goalId: g.id });
  };
  const save = async () => { setBusy(true); try { await s.saveProgram(cleanProgram(x)); onClose(); } finally { setBusy(false); } };
  const del = async () => { if (!sure) { setSure(true); return; } setBusy(true); try { await s.deleteProgram(p.id); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible onClose={onClose} title={cur ? t("ep_edit") : t("ep_new")} testID="prog-sheet" closeLabel={t("cancel")}>
      <Muted small>{E.name(p)} · {t("ep_info")}</Muted>

      <EdBlock title={t("ep_tag")} desc={t("ep_tagD")}>
        <Field testID="prog-tag-in" label={t("ep_tag")} value={x.tag} onChangeText={v => set({ tag: cleanTag(v.toUpperCase()) })} placeholder={t("ep_tagPh")} autoCapitalize="characters" maxLength={LIMITS.tag + 4} />
      </EdBlock>

      <EdBlock title={t("ep_xf")} desc={t("ep_xfD")} testID="prog-ed-xf">
        {x.xf.length ? <Row wrap gap={6}>{x.xf.map(k => <SkillTag key={k} k={k} look="solid" />)}</Row> : null}
        <Btn small testID="prog-xf-pick" icon={x.xf.length ? "eintragen" : "plus"} label={x.xf.length ? t("ep_change") : t("ep_choose")} style={{ alignSelf: "flex-start" }}
          onPress={() => setPick({ title: t("ep_xf"), info: t("ep_xfD"), value: x.xf, max: LIMITS.xf, custom: true, gk, testID: "pick-xf", onDone: v => set({ xf: v }) })} />
        <Col gap={8}>
          <T v="small" bold>{t("ep_suggest")}</T>
          {sugg.length ? sugg.map(y => (
            <Row key={y.key} gap={10} wrap>
              <Pressable testID={"prog-sugg-" + y.key} accessibilityRole="button" accessibilityLabel={`${t("ep_add")}: ${skillLabel(t, y.key)}`} disabled={x.xf.length >= LIMITS.xf}
                onPress={() => set({ xf: [...x.xf, y.key] })} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, opacity: x.xf.length >= LIMITS.xf ? 0.4 : pressed ? 0.7 : 1 })}>
                <Icon name="plus" size={15} color={c.accentTx} strokeWidth={2.4} /><SkillTag k={y.key} look="soft" />
              </Pressable>
              <Muted small>{y.by.map(v => t("ep_v_" + v)).join(" · ")}</Muted>
            </Row>
          )) : <Muted small>{t("ep_suggestNone")}</Muted>}
          {self && (self.weapons.length || self.skills.length) ? <Muted small>{t("ep_v_self")}: {[...self.weapons, ...self.skills].map(k => skillLabel(t, k)).join(", ")}</Muted> : null}
        </Col>
      </EdBlock>

      <EdBlock title={t("ep_sit")} desc={t("ep_sitD")} testID="prog-ed-sit">
        {[0, 1, 2].map(i => <Field key={i} testID={"prog-sit-in-" + i} label={`${i + 1}.`} value={x.sit[i] || ""} onChangeText={v => sitAt(i, v)} placeholder={i === 0 ? t("ep_sitPh") : undefined} maxLength={LIMITS.sitLen} multiline />)}
      </EdBlock>

      <EdBlock title={t("ep_zones")} desc={t("ep_zonesD")} testID="prog-ed-zones">
        <Row gap={16} align="flex-start" wrap>
          <ZonePitch zones={x.zones} width={176} testID="prog-zone" onToggle={z => set({ zones: x.zones.includes(z) ? x.zones.filter(y => y !== z) : [...x.zones, z] })} />
          <Col gap={10} style={{ flex: 1, minWidth: 140 }}>
            <ZoneText zones={x.zones} />
            <Row gap={4}><Icon name="up" size={13} color={c.muted} strokeWidth={2.4} /><Muted small>{t("ep_dir")}</Muted></Row>
          </Col>
        </Row>
      </EdBlock>

      <EdBlock title={`${t("ep_improve")} – ${t("ep_improveT")}`} desc={t("ep_kindEmpty")} testID="prog-ed-improve">
        {IMPROVE_KINDS.map(k => {
          const it = itemOf(k);
          return (
            <View key={k} testID={"prog-ed-" + k} style={{ borderRadius: radius.l, borderWidth: 1, borderColor: c.line, padding: 12, gap: 10 }}>
              <Col gap={2}><T bold>{t("ep_ik_" + k)}</T><Muted small>{t("ep_ikd_" + k)}</Muted></Col>
              <Row gap={8} align="flex-end" wrap>
                <Field testID={"prog-topic-" + k} label={t("ep_topic")} value={it.topic} onChangeText={v => setItem(k, { topic: v })} placeholder={t("ep_topicPh")} maxLength={LIMITS.topic} style={{ flex: 1, minWidth: 170 }} />
                <Btn small testID={"prog-skill-" + k} icon={it.skill ? undefined : "plus"} label={it.skill ? skillLabel(t, it.skill) : t("ep_topicPick")}
                  onPress={() => setPick({ title: t("ep_ik_" + k), info: t("ep_ikd_" + k), value: it.skill ? [it.skill] : [], max: 1, gk, testID: "pick-" + k,
                    onDone: v => setItem(k, { skill: v[0] || null, topic: it.topic || (v[0] ? skillLabel(t, v[0]) : "") }) })} />
              </Row>
              <Col gap={6}><T v="small" bold>{t("ep_where")}</T><MultiChips testID={"prog-where-" + k} value={it.where} onChange={v => setItem(k, { where: v as ImproveItem["where"] })} options={IMPROVE_WHERE.map(w => ({ key: w, label: t("ep_w_" + w) }))} /></Col>
              <Col gap={6}><T v="small" bold>{t("ep_help")}</T><MultiChips testID={"prog-help-" + k} max={LIMITS.help} value={it.help} onChange={v => setItem(k, { help: v })} options={helpOptions} /></Col>
              <Field testID={"prog-how-" + k} label={t("ep_how")} value={it.how} onChangeText={v => setItem(k, { how: v })} placeholder={t("ep_howPh")} maxLength={LIMITS.how} />
              <Col gap={6}>
                <T v="small" bold>{t("ep_goal")}</T>
                <ChoiceChips testID={"prog-goal-" + k} value={it.goalId && goals.some(g => g.id === it.goalId) ? it.goalId : "none"} onChange={v => setItem(k, { goalId: v === "none" ? null : v })}
                  options={[{ key: "none", label: t("ep_goalNone") }, ...goals.map(g => ({ key: g.id, label: g.title }))]} />
                <Btn small kind="ghost" icon="plus" testID={"prog-goal-new-" + k} label={t("ep_goalNew")} onPress={() => openGoal(k)} style={{ alignSelf: "flex-start" }} />
              </Col>
            </View>
          );
        })}
        <Muted small>{t("ep_goalHint")}</Muted>
      </EdBlock>

      <EdBlock title={t("ep_coachView")} desc={t("ep_coachViewD")} testID="prog-ed-coach">
        <Col gap={6}>
          <T v="small" bold>{t("ep_weapons")}</T>
          <Row wrap gap={6} align="center">
            {x.coach.weapons.map(k => <SkillTag key={k} k={k} look="soft" />)}
            <Btn small testID="prog-weapons-pick" icon={x.coach.weapons.length ? "eintragen" : "plus"} label={x.coach.weapons.length ? t("ep_change") : t("ep_choose")}
              onPress={() => setPick({ title: t("ep_weapons"), value: x.coach.weapons, max: LIMITS.weapons, custom: true, gk, testID: "pick-weapons",
                onDone: v => set({ coach: { weapons: v, skills: x.coach.skills.filter(k => !v.includes(k)) } }) })} />
          </Row>
        </Col>
        <Col gap={6}>
          <T v="small" bold>{t("ep_skills")}</T>
          <Row wrap gap={6} align="center">
            {x.coach.skills.map(k => <SkillTag key={k} k={k} look="plain" />)}
            <Btn small testID="prog-skills-pick" icon={x.coach.skills.length ? "eintragen" : "plus"} label={x.coach.skills.length ? t("ep_change") : t("ep_choose")}
              onPress={() => setPick({ title: t("ep_skills"), value: x.coach.skills, max: LIMITS.skills, custom: true, gk, exclude: x.coach.weapons, testID: "pick-skills",
                onDone: v => set({ coach: { ...x.coach, skills: v.filter(k => !x.coach.weapons.includes(k)) } }) })} />
          </Row>
        </Col>
      </EdBlock>

      <EdBlock title={t("ep_v_mates")} testID="prog-ed-peers"
        desc={counts.givers ? tf("ep_peersCount", { n: counts.givers }) + (counts.givers < PEER_MIN_GIVERS ? " · " + tf("ep_peersFew", { n: PEER_MIN_GIVERS }) : "") : t("ep_peersNone")}>
        {peerKeys.length ? (
          <Col gap={6}>
            <T v="small" bold>{t("ep_peersPick")}</T>
            <Row wrap gap={8}>
              {peerKeys.map(k => {
                const on = x.peers.includes(k), n = counts.list.find(y => y.key === k)?.n;
                return (
                  <Pressable key={k} testID={"prog-peer-" + k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={skillLabel(t, k)} onPress={() => togglePeer(k)}
                    disabled={!on && x.peers.length >= LIMITS.peers} style={({ pressed }) => ({ opacity: !on && x.peers.length >= LIMITS.peers ? 0.4 : pressed ? 0.7 : 1 })}>
                    <SkillTag k={k} n={n} look={on ? "solid" : "plain"} />
                  </Pressable>
                );
              })}
            </Row>
          </Col>
        ) : null}
      </EdBlock>

      <EdBlock title={t("ep_vis")}>
        <ToggleRow testID="prog-vis" label={t("ep_vis")} desc={t("ep_visD")} value={x.vis} onChange={v => set({ vis: v })} />
      </EdBlock>

      <Btn testID="prog-save" kind="primary" label={t("save")} disabled={busy} onPress={save} />
      {cur ? <Btn testID="prog-del" kind={sure ? "danger" : "ghost"} icon="trash" label={sure ? t("ep_delSure") : t("ep_del")} disabled={busy} onPress={del} style={{ alignSelf: "flex-start" }} /> : null}

      <SkillPickerSheet pick={pick} onClose={() => setPick(null)} />
      <GoalSheet target={goalT} onClose={closeGoal} />
    </Sheet>
  );
}

// ---------- Startseite (Spieler) ----------
/** Kurzfassung für „Heute“: Motto, X-Faktor, woran du gerade arbeitest – und ein Hinweis, wenn die Stärken-Runde läuft */
export function WegCard({ p, onOpen }: { p: Player; onOpen: () => void }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const prog = visibleProgram(E.D, p.id), r = peerRoundOf(E.team.settings);
  const nudge = !!r && peerOpen(E.team.settings, E.TODAY) && !E.D.peerGifts.some(g => g.giver === p.id && g.at.slice(0, 10) >= r.since);
  const focus = (prog?.improve || []).slice(0, 2);
  return (
    <Pressable testID="player-weg" accessibilityRole="button" accessibilityLabel={t("dp_weg")} onPress={onOpen}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.sunk : c.surface, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 16, gap: 12 })}>
      <Row between gap={10}>
        <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
          <Icon name="weg" size={20} color={c.accentTx} strokeWidth={2} />
          <T v="h3" style={{ flexShrink: 1 }}>{t("dp_weg")}</T>
          {prog?.tag ? <Text numberOfLines={1} style={{ color: c.accentTx, fontWeight: "900", fontSize: 15, flexShrink: 1 }}>#{prog.tag}</Text> : null}
        </Row>
        <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} />
      </Row>
      {prog ? (
        <>
          {prog.xf.length ? <Row wrap gap={6}>{prog.xf.map(k => <SkillTag key={k} k={k} look="solid" />)}</Row> : null}
          {focus.length ? (
            <Col gap={8}>
              <T v="eyebrow">{t("ep_focusNow")}</T>
              {focus.map(x => {
                const g = x.goalId ? E.D.goals.find(y => y.id === x.goalId && (y.vis || y.by === "player")) : undefined;
                const st = g ? goalProgress(E.D, g, E.TODAY) : null, col = skillColor(c, x.skill, c.accentTx);
                return (
                  <Col key={x.kind} gap={4}>
                    <Row gap={8}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
                      <Text style={{ flex: 1, color: c.ink, fontSize: 14.5, fontWeight: "700" }} numberOfLines={1}>{x.topic || (x.skill ? skillLabel(t, x.skill) : "")}</Text>
                      <Text style={{ color: c.muted, fontSize: 12.5, fontWeight: "600" }}>{t("ep_ik_" + x.kind)}</Text>
                    </Row>
                    {st && st.pct != null ? <Bar value={st.pct} color={st.reached ? c.ok : col} /> : null}
                  </Col>
                );
              })}
            </Col>
          ) : null}
        </>
      ) : <Muted small>{t("ep_empty")}</Muted>}
      {nudge ? <Banner color={c.ok}>{t("ep_peerNudge")}</Banner> : null}
    </Pressable>
  );
}
