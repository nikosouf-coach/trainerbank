// Scouting-Datenbank: Suche, Pipeline (Anzahl je Status), Positionsbereich, Merklisten, Filter und Sortierung,
// Hinweis zur Information nach Art. 14 DSGVO; Karten mit Status, Priorität, Bewertung, nächstem Schritt.
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { iso } from "../../core/dates";
import {
  emptyFilter, filterCount, filterScouts, infoState, nextDue, PIPELINE, pipelineCounts, POS_AREAS, PRIOS, refOf, SCOUT_SORTS, scoutAge, slotsWith, sortScouts, statsBy, yearOf,
  FEET, cleanPlanContent, seasonLabel, type ScoutFilter, type ScoutSort,
} from "../../core/scout";
import { fmtOf } from "../../core/matchplan";
import type { ScoutPlayer, ScoutStatus } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Icon } from "../icons";
import { Banner, Btn, Card, Col, Field, Muted, Picker, Row, Sheet, T, ToggleRow } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { GradeBadge, posShort, PrioBadge, ScoutAvatar, slotShort, StateTag, statusCol } from "./common";
import { Chips, ListsSheet } from "./forms";

// Filter bleiben beim Wechsel ins Profil und zurück erhalten
let lastFilter: ScoutFilter = emptyFilter(), lastSort: ScoutSort = "prio";

export function ScoutDb({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const D = E.D, now = new Date(), today = iso(now);
  const [f, setF0] = useState<ScoutFilter>(lastFilter); const [sort, setSort0] = useState<ScoutSort>(lastSort);
  const [fs, setFs] = useState(false); const [lists, setLists] = useState(false);
  const setF = (p: Partial<ScoutFilter>) => setF0(x => (lastFilter = { ...x, ...p }));
  const setSort = (k: ScoutSort) => { lastSort = k; setSort0(k); };
  const stats = useMemo(() => statsBy(D.scoutReports), [D.scoutReports, s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = pipelineCounts(D.scouts);
  const list = sortScouts(filterScouts(D.scouts, f, stats, now), sort, stats);
  const due = D.scouts.filter(x => infoState(x, now).state === "due").length;
  const years = [...new Set(D.scouts.map(yearOf).filter((y): y is number => y != null))].sort((a, b) => b - a);
  // Platz im Schattenkader (jüngste Planung zuerst)
  const plans = [...D.squadPlans].sort((a, b) => b.season - a.season).map(p => ({ season: p.season, c: cleanPlanContent(p.content, fmtOf(D.team.cls)) }));
  const planOf = (id: string): string | null => {
    for (const p of plans) { const w = slotsWith(p.c, refOf("s", id))[0]; if (w) return `${seasonLabel(p.season)} · ${slotShort(t, w.key)}${w.kind === "shadow" ? " #" + w.rank : ""}`; }
    return null;
  };
  const stChip = (k: ScoutStatus | "open" | "closed" | "all", label: string) => {
    const on = f.status === k, col = k === "open" || k === "all" ? c.accent : k === "closed" ? c.crit : statusCol(c, k);
    return (
      <Pressable key={k} testID={"sc-st-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setF({ status: k })}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? withAlpha(col, 0.14) : c.surface }}>
        <Text style={{ fontWeight: "800", fontSize: 12.5, color: on ? col : c.ink }}>{label}</Text>
        <Text style={{ fontWeight: "900", fontSize: 12, color: on ? col : c.muted, fontVariant: ["tabular-nums"] }}>{counts[k]}</Text>
      </Pressable>
    );
  };
  const nf = filterCount(f);
  return (
    <Col gap={12} testID="sc-db">
      <Row gap={8}>
        <View style={{ flex: 1 }}><Field testID="sc-search" label={t("sc_search")} value={f.q} onChangeText={q => setF({ q })} /></View>
        <Btn kind="primary" icon="plus" testID="sc-new" label={t("sc_new")} onPress={onNew} style={{ alignSelf: "flex-end" }} />
      </Row>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} testID="sc-pipeline">
        {stChip("open", t("sc_open"))}
        {PIPELINE.map(k => stChip(k, t("scs_" + k)))}
        {stChip("closed", t("sc_closed"))}
      </View>
      <Row gap={8} wrap>
        <Chips testID="sc-area" value={f.area ? [f.area] : []} onChange={v => setF({ area: v[0] || null })} options={POS_AREAS.map(a => ({ key: a, label: t("sca_" + a) }))} />
        <View style={{ flex: 1 }} />
        <Pressable testID="sc-filter" accessibilityRole="button" onPress={() => setFs(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1.5, borderColor: nf ? c.accent : c.line, backgroundColor: nf ? withAlpha(c.accent, 0.12) : c.surface }}>
          <Icon name="filter" size={15} color={nf ? c.accentTx : c.ink} />
          <Text style={{ fontWeight: "700", color: nf ? c.accentTx : c.ink }}>{t("sc_filter")}{nf ? ` (${nf})` : ""}</Text>
        </Pressable>
      </Row>
      <Row gap={8} wrap>
        {D.scoutLists.map(l => {
          const on = f.list === l.id;
          return (
            <Pressable key={l.id} testID={"sc-list-chip-" + l.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setF({ list: on ? null : l.id })}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.s, borderWidth: 1.5, borderColor: on ? l.color : c.line, backgroundColor: on ? withAlpha(l.color, 0.14) : "transparent" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
              <Text style={{ fontWeight: "700", fontSize: 12.5, color: on ? l.color : c.ink }}>{l.name}</Text>
              <Text style={{ fontWeight: "800", fontSize: 11.5, color: c.muted }}>{D.scouts.filter(x => x.lists.includes(l.id)).length}</Text>
            </Pressable>
          );
        })}
        <Btn small kind="ghost" testID="sc-lists" label={D.scoutLists.length ? t("sc_listsManage") : "+ " + t("sc_listNew")} onPress={() => setLists(true)} />
      </Row>
      {due ? <Pressable testID="sc-info-due" accessibilityRole="button" onPress={() => setF({ infoDue: !f.infoDue, status: "all" })}>
        <Banner color={c.warn}><Row gap={8}><Icon name="info" size={16} color={c.warn} /><T v="small" style={{ flex: 1 }}>{tf("sc_infoDueN", { n: due })}</T></Row></Banner>
      </Pressable> : null}
      <Row between>
        <Muted small testID="sc-count">{tf("sc_count", { n: list.length })}</Muted>
        <Picker testID="sc-sort" label={t("sc_sort")} value={sort} onChange={setSort} options={SCOUT_SORTS.map(k => ({ key: k, label: t("sc_sort_" + k) }))} />
      </Row>
      {!D.scouts.length ? <Card><Muted>{t("sc_empty")}</Muted><Btn kind="primary" icon="plus" label={t("sc_newT")} onPress={onNew} style={{ alignSelf: "flex-start" }} /></Card>
        : !list.length ? <Muted>{t("sc_emptyFilter")}</Muted>
        : list.map(x => <ScoutCard key={x.id} x={x} stats={stats.get(x.id)} plan={planOf(x.id)} today={today} onPress={() => onOpen(x.id)} />)}
      <FilterSheet visible={fs} onClose={() => setFs(false)} f={f} setF={setF} years={years} />
      <ListsSheet visible={lists} onClose={() => setLists(false)} />
    </Col>
  );
}

function ScoutCard({ x, stats, plan, today, onPress }: { x: ScoutPlayer; stats?: { n: number; grade: number | null; trend: number | null }; plan: string | null; today: string; onPress: () => void }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const age = scoutAge(x, new Date()), info = infoState(x, new Date()), due = nextDue(x, today);
  const lists = E.D.scoutLists.filter(l => x.lists.includes(l.id));
  return (
    <Pressable testID={"sc-card-" + x.id} accessibilityRole="button" accessibilityLabel={`${x.vn} ${x.nn}`} onPress={onPress}>
      <Card style={{ gap: 8, paddingVertical: 12 }}>
        <Row gap={12} align="flex-start">
          <View><ScoutAvatar vn={x.vn} nn={x.nn} status={x.status} />{x.prio ? <View style={{ position: "absolute", right: -4, bottom: -4 }}><PrioBadge p={x.prio} size={18} /></View> : null}</View>
          <Col gap={3} style={{ flex: 1 }}>
            <Row gap={6}>
              <T bold numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>{`${x.vn} ${x.nn}`.trim()}</T>
              <GradeBadge g={stats?.grade ?? null} n={stats?.n} testID={"sc-grade-" + x.id} />
            </Row>
            <Muted small>{[x.pos.map(p => posShort(t, p)).join(" / "), yearOf(x) ? String(yearOf(x)) + (age ? " · " + tf(age.approx ? "sc_ageApprox" : "sc_age", { a: age.age }) : "") : "", x.foot ? t("scf_" + x.foot) : ""].filter(Boolean).join(" · ")}</Muted>
            {x.club || x.clubTeam ? <T v="small" numberOfLines={1}>{[x.club, x.clubTeam].filter(Boolean).join(" · ")}</T> : null}
          </Col>
        </Row>
        <Row gap={6} wrap>
          <StateTag label={t("scs_" + x.status)} color={statusCol(c, x.status)} />
          {plan ? <StateTag testID={"sc-inplan-" + x.id} label={"◆ " + plan} color={c.event} /> : null}
          {lists.map(l => <StateTag key={l.id} label={l.name} color={l.color} />)}
          {info.state === "due" ? <StateTag testID={"sc-due-" + x.id} label={t("sc_infoDue")} color={c.warn} /> : null}
          {stats?.trend ? <StateTag label={stats.trend > 0 ? "↑ " + t("sc_trendUp") : "↓ " + t("sc_trendDown")} color={stats.trend > 0 ? c.ok : c.crit} /> : null}
        </Row>
        {x.next ? <Row gap={6}><Icon name="calendar" size={14} color={due ? c.crit : c.muted} />
          <Text style={{ fontSize: 12.5, fontWeight: due ? "800" : "600", color: due ? c.crit : c.muted }} numberOfLines={1}>
            {E.wt(x.next)} {E.de(x.next)}{x.nextNote ? " · " + x.nextNote : ""}{due ? " · " + t("sc_nextDue") : ""}</Text></Row> : null}
        {x.tags.length ? <Muted small>{x.tags.join(" · ")}</Muted> : null}
      </Card>
    </Pressable>
  );
}

function FilterSheet({ visible, onClose, f, setF, years }: { visible: boolean; onClose: () => void; f: ScoutFilter; setF: (p: Partial<ScoutFilter>) => void; years: number[] }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t("sc_filter")} testID="sc-filter-sheet" closeLabel={t("cancel")}>
      <Col gap={14}>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_prio")}</T>
          <Chips testID="sc-ff-prio" value={f.prio ? [f.prio] : []} onChange={v => setF({ prio: v[0] || null })} options={PRIOS.map(p => ({ key: p, label: t("scp_" + p) }))} /></Col>
        {years.length ? <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_year")}</T>
          <Chips testID="sc-ff-year" value={f.year ? [String(f.year)] : []} onChange={v => setF({ year: v[0] ? Number(v[0]) : null })} options={years.map(y => ({ key: String(y), label: String(y) }))} /></Col> : null}
        {E.D.scoutLists.length ? <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_lists")}</T>
          <Chips testID="sc-ff-list" value={f.list ? [f.list] : []} onChange={v => setF({ list: v[0] || null })} options={E.D.scoutLists.map(l => ({ key: l.id, label: l.name }))} /></Col> : null}
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_foot")}</T>
          <Chips testID="sc-ff-foot" value={f.foot ? [f.foot] : []} onChange={v => setF({ foot: v[0] || null })} options={FEET.map(x => ({ key: x, label: t("scf_" + x) }))} /></Col>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_minGrade")}</T>
          <Chips testID="sc-ff-grade" value={f.minGrade ? [String(f.minGrade)] : []} onChange={v => setF({ minGrade: v[0] ? Number(v[0]) : null })} options={["3", "3.5", "4", "4.5"].map(g => ({ key: g, label: "≥ " + E.num(Number(g), 1) }))} /></Col>
        <ToggleRow testID="sc-ff-info" label={t("sc_onlyInfo")} value={f.infoDue} onChange={v => setF({ infoDue: v })} />
        <Row gap={8}>
          <Btn kind="primary" testID="sc-ff-done" label={t("done")} onPress={onClose} />
          <Btn kind="ghost" testID="sc-ff-reset" label={t("sc_reset")} onPress={() => setF({ ...emptyFilter(), q: f.q, status: f.status, area: f.area })} />
        </Row>
      </Col>
    </Sheet>
  );
}
