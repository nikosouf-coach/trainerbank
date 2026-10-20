// Belastung im Team (ACWR: Belastung der letzten 7 Tage im Verhältnis zum Wochenschnitt der letzten 4 Wochen).
// - TeamStatusCard (Startseite): Verteilung als Balken, Zonen mit Anzahl und die dringlichste Empfehlung in einer Zeile –
//   antippen führt auf die Detailseite.
// - TeamLoadScreen (/coach/belastung): Befund in einem Satz, Spieler je Zone (führen ins Profil, Bereich Belastung),
//   Vorschläge, Team-Wochenlast und „Hintergrund & Quellen“ aus dem Wiki.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, monday, sum } from "../core/dates";
import type { Profile } from "../core/engine";
import { useEngine } from "../data/store";
import { WeekBars } from "./charts";
import { Icon } from "./icons";
import { WikiBackground, useIx } from "./insight";
import { Group, Header, MoreRow, Row, Screen, Section, Tips } from "./kit";
import { PlayerRow } from "./squad/PlayerRow";
import { radius, statusColor, useTheme } from "./theme";

const ZONES = ["crit", "warn", "ok", "low", "inj", "build"] as const;
type Zone = typeof ZONES[number];
/** Reihenfolge auf der Detailseite: was Handeln braucht zuerst */
const PAGE_ORDER: Zone[] = ["crit", "warn", "low", "inj", "ok", "build"];

function useZones() {
  const E = useEngine();
  return useMemo(() => {
    const n: Record<Zone, number> = { crit: 0, warn: 0, ok: 0, low: 0, inj: 0, build: 0 };
    const by: Record<Zone, Profile[]> = { crit: [], warn: [], ok: [], low: [], inj: [], build: [] };
    for (const p of E.D.players) { const pr = E.profile(p.id); const st = pr.st as Zone; if (st in n) { n[st]++; by[st].push(pr); } }
    for (const z of ZONES) by[z].sort((a, b) => (b.m?.acwr ?? -1) - (a.m?.acwr ?? -1));
    return { n, by, total: ZONES.reduce((s, k) => s + n[k], 0) };
  }, [E]);
}

/** Empfehlungen je Zone (kurz für die Startseite, lang für die Detailseite) – Dringlichstes zuerst */
function useAdvice(n: Record<Zone, number>): [Zone, string, string][] {
  const { t, tf } = useEngine();
  const advice: [Zone, string, string][] = [];
  if (n.crit) advice.push(["crit", tf("ts_critS", { n: n.crit }), tf(n.crit === 1 ? "ts_crit1" : "ts_crit", { n: n.crit })]);
  if (n.warn) advice.push(["warn", tf("ts_warnS", { n: n.warn }), tf(n.warn === 1 ? "ts_warn1" : "ts_warn", { n: n.warn })]);
  if (n.low) advice.push(["low", tf("ts_lowS", { n: n.low }), tf(n.low === 1 ? "ts_low1" : "ts_low", { n: n.low })]);
  if (!advice.length && n.ok) advice.push(["ok", t("ts_allOkS"), t("ts_allOk")]);
  if (!advice.length && n.build) advice.push(["build", t("ts_buildS"), t("ts_build")]);
  return advice;
}

/** Verteilung der Spieler auf die Zonen als Balken */
function ZoneBar({ n, height = 10 }: { n: Record<Zone, number>; height?: number }) {
  const { t } = useEngine(); const { c } = useTheme();
  const shown = ZONES.filter(k => n[k]);
  return (
    <View testID="ts-bar" accessibilityLabel={shown.map(k => `${t("st_" + k)}: ${n[k]}`).join(", ")}
      style={{ flexDirection: "row", height, borderRadius: radius.pill, overflow: "hidden", gap: 2, backgroundColor: c.sunk }}>
      {shown.map(k => <View key={k} style={{ flex: n[k], backgroundColor: statusColor(c, k) }} />)}
    </View>
  );
}

/** Zonen mit Anzahl (Legende zum Balken) */
function ZoneLegend({ n }: { n: Record<Zone, number> }) {
  const { t } = useEngine(); const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
      {ZONES.filter(k => n[k] > 0).map(k => (
        <View key={k} testID={"tile-" + k} accessibilityLabel={`${t("st_" + k)}: ${n[k]}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(c, k) }} />
          <Text style={{ fontSize: 14.5, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{n[k]}</Text>
          <Text numberOfLines={1} style={{ fontSize: 13.5, color: c.muted }}>{t("st_" + k)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Startseite: kompakt, antippen öffnet die Detailseite */
export function TeamStatusCard() {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const { n, total } = useZones();
  const advice = useAdvice(n);
  return (
    <Section title={t("ts_title")} testID="today-status">
      <Pressable testID="ts-open" accessibilityRole="button" accessibilityLabel={t("ts_title") + (advice.length ? ": " + advice[0][1] : "")} onPress={() => router.push("/coach/belastung")}
        style={({ pressed }) => ({ padding: 16, gap: 12, backgroundColor: pressed ? c.sunk : "transparent" })}>
        {total ? <ZoneBar n={n} /> : null}
        <ZoneLegend n={n} />
        {advice.length ? (
          <Row gap={10} testID="ts-advice">
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 14.5, fontWeight: "600", color: c.ink }}>{advice[0][1]}</Text>
            <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} />
          </Row>
        ) : null}
      </Pressable>
    </Section>
  );
}

/** Spieler einer Zone; viele unauffällige Spieler (Sweet Spot, Datenaufbau) erst aufklappen */
function ZoneSection({ z, list }: { z: Zone; list: Profile[] }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const quiet = z === "ok" || z === "build";
  const [all, setAll] = useState(!quiet || list.length <= 4);
  const shown = all ? list : list.slice(0, 3);
  const col = statusColor(c, z);
  return (
    <Section testID={"tl-zone-" + z} title={`${t("st_" + z)} (${list.length})`} dot={col}>
      {shown.map(pr => {
        const m = pr.m, a = m && m.acwr != null ? E.num(m.acwr, 2) : null;
        const sub = z === "inj" ? (pr.reasons.find(r => r[0] === "inj")?.[1] || t("st_inj"))
          : m && E.lvl(2) ? tf("tl_week", { a: E.int(m.wk), b: E.int(m.chronic) }) : pr.p.pos;
        return (
          <PlayerRow key={pr.p.id} testID={"tl-p-" + pr.p.id} p={pr.p} name={E.name(pr.p)} status={pr.st} sub={sub}
            value={z !== "inj" && a && E.lvl(2) ? a : null} valueColor={z !== "inj" && z !== "build" ? col : undefined} valueSub={z !== "inj" && a && E.lvl(2) ? "ACWR" : undefined}
            onPress={() => router.push("/coach/spieler/" + pr.p.id + "/load")} />
        );
      })}
      {!all ? <MoreRow testID={"tl-more-" + z} label={tf("tl_showAll", { n: list.length })} onPress={() => setAll(true)} /> : null}
    </Section>
  );
}

/** Detailseite „Belastung im Team“ */
export function TeamLoadScreen() {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter(); const ix = useIx();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { n, by, total } = useZones();
  const advice = useAdvice(n);
  // Zurück dorthin, woher man kam (Startseite oder Menü „Mehr“)
  const backTo = from === "mehr" ? "/coach/mehr" : "/coach/heute", backLabel = from === "mehr" ? t("nav_module") : t("nav_heute");
  const back = () => router.canGoBack() ? router.back() : router.replace(backTo);
  // Befund in einem Satz
  const lead = !total ? t("tl_leadBuild")
    : n.crit ? tf(n.crit === 1 ? "tl_leadCrit1" : "tl_leadCrit", { n: n.crit, ok: n.ok })
    : n.warn ? tf(n.warn === 1 ? "tl_leadWarn1" : "tl_leadWarn", { n: n.warn, ok: n.ok })
    : n.ok ? tf("tl_leadOk", { ok: n.ok, all: total }) : t("tl_leadBuild");
  const leadCol = n.crit ? c.crit : n.warn ? c.warn : n.ok ? c.ok : c.build;
  const team = useMemo(() => {
    const m0 = monday(E.TODAY);
    return [5, 4, 3, 2, 1, 0].map(i => addDays(m0, -7 * i)).map(w => {
      const per = E.D.players.map(p => { const dl = E.daily(p.id); return sum(Object.keys(dl).filter(d => d >= w && d < addDays(w, 7)).map(d => dl[d])); }).filter(x => x > 0);
      return { label: E.de(w), v: per.length ? sum(per) / per.length : 0 };
    });
  }, [E]);
  if (!E.mods.belastung) return <Screen narrow testID="coach-load"><Header onBack={back} backLabel={backLabel} title={t("ts_title")} sub={t("tl_off")} /></Screen>;
  return (
    <Screen narrow testID="coach-load">
      <Header onBack={back} backLabel={backLabel} title={t("ts_title")} sub={lead} subColor={leadCol} />
      {total ? <Group pad><ZoneBar n={n} height={14} /><ZoneLegend n={n} /></Group> : null}
      <Tips title={ix.tips} testID="tl-tips" items={[
        ...advice.map(x => x[2]),
        ...(E.mods.planung ? [{ text: t("tl_toPlan"), onPress: () => router.push("/coach/plan"), icon: "plan" as const, testID: "tl-to-plan" }] : []),
      ]} />
      {PAGE_ORDER.filter(z => by[z].length).map(z => <ZoneSection key={z} z={z} list={by[z]} />)}
      {E.lvl(2) ? <Section title={t("teamLoad")} pad footer={t("teamLoadNote")} testID="tl-week"><WeekBars data={team} label={t("teamLoad")} /></Section> : null}
      <WikiBackground keys={["acwr", "au", "ampel"]} extra={[t("ts_info1"), t("ts_info2"), t("ts_info3")]} testID="tl-bg" />
    </Screen>
  );
}
