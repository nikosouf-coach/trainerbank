// Trainer – Kader: Spieler mit Filtern (Position, Gruppe, Status), Abwesenheiten, Gruppen (src/ui/squad/Groups).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { posGroup } from "../../../src/core/classes";
import type { Player } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { TeamHotspots } from "../../../src/ui/bodyMap";
import { TeamMarksCard } from "../../../src/ui/marks";
import { Banner, Bar, Btn, Card, CardTitle, Chip, Col, Group, Header, Info, ListItem, Muted, Row, Screen, SearchField, Section, Seg, T } from "../../../src/ui/kit";
import { TermInfo } from "../../../src/ui/termInfo";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { GroupsTab } from "../../../src/ui/squad/Groups";
import { PlayerRow } from "../../../src/ui/squad/PlayerRow";
import { MergeSheet, PlayerSheet } from "../../../src/ui/squad/PlayerForm";
import { radius, statusColor, useTheme } from "../../../src/ui/theme";

type Tab = "spieler" | "abw" | "gruppen";

/** Filter nach Belastung bzw. Ausfall */
const STATUS_F = ["crit", "warn", "low", "inj"];

export default function Kader() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const params = useLocalSearchParams<{ filter: string; tab: string }>();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>("spieler");
  const [filter, setFilter] = useState("alle");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Player | null | undefined>(undefined);
  const [merge, setMerge] = useState<Player | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const sheets = usePlanSheets();
  useEffect(() => { if (params.filter) { setFilter(params.filter); setTab("spieler"); } if (params.tab === "abw" || params.tab === "gruppen") setTab(params.tab); }, [params.filter, params.tab]);

  const mods = E.mods, groups = E.D.groups;
  const prs = useMemo(() => E.D.players.map(p => E.profile(p.id)), [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const neu = E.D.players.filter(p => p.neu);
  // Filter: Alle, dann Belastung mit Anzahl (nur Zonen mit Spielern – das Auffällige zuerst), Positionen, Gruppen
  const stN = (k: string): number => prs.filter(x => x.st === k).length;
  const keys = ["alle", ...[...(mods.belastung ? ["crit", "warn", "low"] : []), "inj"].filter(k => stN(k) > 0 || filter === k), "TW", "Abwehr", "Mittelfeld", "Sturm", ...groups.map(g => "g:" + g.id)];
  const keyLabel = (k: string) => k.startsWith("g:") ? (groups.find(g => "g:" + g.id === k)?.name || "?") : t("f_" + k);
  const list = prs.filter(x => filter === "alle" || posGroup(x.p.pos) === filter || x.st === filter || (filter.startsWith("g:") && (x.p.groups || []).includes(filter.slice(2))))
    .filter(x => !q || E.name(x.p).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.p.active === false ? 1 : 0) - (b.p.active === false ? 1 : 0) || (a.p.nr ?? 99) - (b.p.nr ?? 99));

  // Wert rechts in der Zeile: ACWR (ab Infotiefe 2), sonst Beteiligung der letzten 28 Tage
  const showAcwr = !!mods.belastung && E.lvl(2);
  const row = (x: typeof prs[number]) => {
    const stOn = (mods.belastung || x.st === "inj") && x.st !== "none";
    const val = showAcwr ? (x.m && x.m.acwr != null && x.st !== "inj" ? E.num(x.m.acwr, 2) : "–") : mods.beteiligung ? (x.att != null ? Math.round(x.att * 100) + " %" : "–") : null;
    // Nur Auffälliges benennen (Sweet Spot und Datenaufbau zeigt der Punkt am Bild); bei Ausfall den Grund („Krank“, „Verletzung“)
    const loud = stOn && x.st !== "ok" && x.st !== "build";
    const flag = loud ? (x.st === "inj" && x.ab ? t("ab_" + x.ab.typ) : t("sts_" + x.st)) : x.ab ? t("ab_" + x.ab.typ) : x.p.neu ? t("newP") : x.p.origin ? E.tf("cl_from", { t: x.p.origin }) : x.p.active === false ? t("kd_inactive") : undefined;
    return (
      <PlayerRow key={x.p.id} testID={"pcard-" + x.p.id} p={x.p} name={E.name(x.p)} status={mods.belastung || x.st === "inj" ? x.st : null}
        sub={`${x.p.pos}, ${E.age(x.p)} ${t("yrs")}`} flag={flag} flagColor={loud ? statusColor(c, x.st) : x.p.neu ? c.low : c.muted}
        value={val} valueColor={showAcwr && stOn && x.st !== "ok" ? statusColor(c, x.st) : undefined}
        dim={x.p.active === false} onPress={() => router.push("/coach/spieler/" + x.p.id)} />
    );
  };
  // Ohne Filter und Suche: nach Mannschaftsteilen wie auf dem Spielberichtsbogen; sonst eine Liste
  const LINES = ["TW", "Abwehr", "Mittelfeld", "Sturm"] as const;
  const grouped = filter === "alle" && !q;
  const sections = grouped ? LINES.map(g => ({ g, L: list.filter(x => posGroup(x.p.pos) === g) })).filter(x => x.L.length) : [];
  const wideList = width >= 900;
  const listEl = !list.length ? <Muted>{t("noPlayers")}</Muted> : grouped ? (
    wideList ? <Row align="flex-start" gap={18}>
      {[sections.filter((_, i) => i % 2 === 0), sections.filter((_, i) => i % 2 === 1)].map((col, ci) => (
        <Col key={ci} gap={20} style={{ flex: 1, minWidth: 0 }}>{col.map(x => <Section key={x.g} testID={"kader-line-" + x.g} title={`${t("f_" + x.g)} (${x.L.length})`}>{x.L.map(row)}</Section>)}</Col>
      ))}
    </Row> : <>{sections.map(x => <Section key={x.g} testID={"kader-line-" + x.g} title={`${t("f_" + x.g)} (${x.L.length})`}>{x.L.map(row)}</Section>)}</>
  ) : <Group testID="kader-list">{list.map(row)}</Group>;

  const spieler = (
    <>
      {neu.length ? <Banner color={c.low} testID="kader-new">
        <Col gap={8}>
          <T bold>{tf(neu.length === 1 ? "kd_newApp1" : "kd_newApp", { n: neu.length })}</T>
          {neu.map(p => <Row key={p.id} between gap={8}><T style={{ flex: 1 }}>{E.name(p)}</T><Btn small testID={"kader-merge-" + p.id} label={t("kd_merge")} onPress={() => setMerge(p)} /></Row>)}
          <Muted small>{t("kd_newAppD")}</Muted>
        </Col>
      </Banner> : null}
      <SearchField testID="kader-search" value={q} onChange={setQ} placeholder={t("search")} clearLabel={t("cancel")} />
      {/* Filter: Positionen und Gruppen, dahinter Belastung (mit Anzahl) – eine waagerecht scrollbare Zeile */}
      <Col gap={8} testID="kader-filters">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {keys.map(k => {
            const on = filter === k, st = STATUS_F.includes(k), col = statusColor(c, k), n = st ? stN(k) : null;
            return (
              <Pressable key={k} testID={"kader-f-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setFilter(on && k !== "alle" ? "alle" : k)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13 }}>
                {st ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} /> : null}
                <Text style={{ fontWeight: "600", fontSize: 13.5, color: on ? c.bg : c.ink }}>{keyLabel(k)}</Text>
                {n != null ? <Text style={{ fontWeight: "700", fontSize: 12.5, color: on ? c.bg : c.muted, fontVariant: ["tabular-nums"] }}>{n}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Row between gap={8} style={{ paddingHorizontal: 2 }}>
          {filter !== "alle" || q ? <Muted small testID="kader-count">{tf("kd_shown", { n: list.length, m: prs.length })}</Muted> : <View />}
          {showAcwr ? <Row gap={4}><Muted small>{t("kd_valAcwr")}</Muted><TermInfo k="acwr" testID="term-acwr-kader" /></Row>
            : mods.beteiligung ? <Muted small>{t("kd_valAtt")}</Muted> : null}
        </Row>
      </Col>
      {listEl}
      {E.D.inactive.length ? <Section testID="kader-inactive" plain={!showInactive} title={tf("in_title", { n: E.D.inactive.length })} info={<Info title={tf("in_title", { n: E.D.inactive.length })} text={t("in_info")} />}
        action={{ label: showInactive ? t("in_hide") : t("in_show"), onPress: () => setShowInactive(!showInactive), testID: "kader-inactive-toggle" }}>
        {showInactive ? E.D.inactive.map(p => <PlayerRow key={p.id} testID={"inactive-" + p.id} p={p} name={E.name(p)} sub={p.pos} dim
          right={<Btn small testID={"reactivate-" + p.id} label={t("in_reactivate")} onPress={async () => { await s.savePlayer({ ...p, active: true }); s.toast(tf("in_done", { n: E.name(p) })); }} />} />) : null}
      </Section> : null}
    </>
  );

  const abw = () => {
    const cur = E.D.absences.filter(a => !a.bis || a.bis >= E.TODAY).sort((a, b) => a.von < b.von ? -1 : 1);
    const past = E.D.absences.filter(a => a.bis && a.bis < E.TODAY).sort((a, b) => (a.bis! < b.bis! ? 1 : -1)).slice(0, 10);
    const row = (a: typeof cur[number]) => {
      const p = E.P(a.pid); if (!p) return null; const col = a.typ === "verletzung" || a.typ === "krank" ? c.inj : c.low;
      return <ListItem key={a.id} testID={"abs-" + a.id} title={E.name(p)} left={<PlayerAvatar p={p} size={36} />}
        sub={`${E.de(a.von)} – ${a.bis ? E.de(a.bis) : t("ongoing")}${a.typ === "verletzung" && a.stufe ? ` · ${t("stage")} ${a.stufe}/4 ${E.tl("stages")[a.stufe - 1]}` : ""}${a.notiz ? " · " + a.notiz : ""}${a.by === "player" ? " · " + t("fromPlayer") : ""}`}
        right={<Row gap={6}><Chip label={t("ab_" + a.typ)} color={col} /><Btn small kind="ghost" icon="trash" label="" a11y={t("del")} testID={"abs-del-" + a.id} onPress={() => { s.deleteAbsence(a.id); s.toast(t("t_del")); }} /></Row>} />;
    };
    const ranking = E.D.players.map(p => ({ p, a: E.attendance(p.id) })).filter(x => x.a != null).sort((a, b) => a.a! - b.a!);
    const wide = width >= 900;
    const left = <Card style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("abs_cur")} right={<Btn small kind="primary" testID="abs-add" label={t("abs_add")} onPress={() => sheets.open({ k: "abs" })} />} />
      {cur.length ? cur.map(row) : <Muted>{t("abs_none")}</Muted>}
      {past.length ? <><Btn small kind="ghost" label={`${t("abs_past")} (${past.length}) ${showPast ? "▴" : "▾"}`} onPress={() => setShowPast(!showPast)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />{showPast ? past.map(row) : null}</> : null}
      {!(E.team.settings.playerAbs ?? true) ? <Muted small>{t("pabs_d")}</Muted> : null}
    </Card>;
    const right = <Card style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("att28")} info={<Info title={t("att28")} text={t("att28note")} />} />
      {ranking.map(x => <ListItem key={x.p.id} title={E.name(x.p)} left={<PlayerAvatar p={x.p} size={32} />} onPress={() => router.push("/coach/spieler/" + x.p.id)}
        right={<T bold>{Math.round(x.a! * 100)} %</T>}><Bar value={x.a!} color={x.a! < 0.8 ? c.warn : c.accent} /></ListItem>)}
    </Card>;
    return <>{wide ? <Row align="flex-start" gap={18}>{left}{right}</Row> : <>{left}{right}</>}{mods.belastung ? <TeamHotspots /> : null}<TeamMarksCard /></>;
  };

  return (
    <Screen testID="coach-kader">
      <Header eyebrow={`${E.team.name} · ${E.D.players.filter(p => p.active !== false).length} ${t("players")}`} title={t("nav_kader")}
        right={<Btn testID="kader-add" kind="primary" icon="plus" label={t("addPlayer")} onPress={() => setEdit(null)} />} />
      <Seg testID="kader-tab" value={tab} onChange={setTab} options={[{ key: "spieler", label: t("tab_spieler") }, ...(mods.beteiligung ? [{ key: "abw" as Tab, label: t("tab_abw") }] : []), { key: "gruppen", label: t("tab_gruppen") }]} />
      {tab === "spieler" ? spieler : tab === "abw" ? abw() : <GroupsTab onFilter={g => { setFilter(g); setTab("spieler"); }} />}
      <PlayerSheet player={edit} onClose={() => setEdit(undefined)} />
      <MergeSheet newPlayer={merge} onClose={() => setMerge(null)} />
      {sheets.el}
    </Screen>
  );
}
