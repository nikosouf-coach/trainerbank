// Spielerentwicklung (Paket C): Kompetenzprofil, messbare Ziele, Entwicklungsgespräche, Saisonrückblick.
// Gemeinsam für Trainer- und Spieler-App (Spieler sehen nur Eigenes und Freigegebenes).
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays } from "../core/dates";
import {
  COMPETENCIES, DEV_AREAS, MAX_ACTIVE_GOALS, agreementId, areaAvg, assessmentsOf, cleanGoal, cleanScores, compsOf, entriesOfGoal, gapsOf, goalProgress, goalUnit, goalsOf, posGroupOf, prepTalk,
  seasonReview, suggestStart, type GoalState, type PosGroup,
} from "../core/dev";
import { isCustomTest } from "../core/perf";
import type { Agreement, Assessment, DevArea, DevTalk, Goal, GoalKind, GoalMetric, GoalStat, Player, TestKey } from "../core/types";
import { isGoalkeeper } from "../core/units";
import { tmpId, useEngine, useStore } from "../data/store";
import { StatTile } from "./games";
import { Icon } from "./icons";
import { Banner, Bar, Btn, Card, CardTitle, Check, Chip, ChoiceChips, Col, DateField, Field, Muted, NumField, Picker, Row, Seg, Sheet, T, ToggleRow } from "./kit";
import { radius, useTheme, withAlpha, type Colors } from "./theme";

export const areaColor = (c: Colors, a: DevArea): string => ({ tech: c.low, takt: c.event, ath: c.hot, ment: c.ok }[a]);
const METRICS: GoalMetric[] = ["count", "value", "test", "stat", "att", "check"];
const KINDS: GoalKind[] = ["process", "perf", "outcome"];
const STATS: GoalStat[] = ["goals", "assists", "minutes", "games", "starts", "clean"];

/** Zahl ohne unnötige Nachkommastellen */
function useFmt() {
  const E = useEngine();
  return (v: number | null | undefined, g?: Goal): string => {
    if (v == null || !Number.isFinite(v)) return "–";
    const dec = g?.metric === "test" && g.test ? E.testDef(g.test).dec : Number.isInteger(v) ? 0 : 1;
    return E.tr.num(v, dec);
  };
}
/** Textbaustein der Gesprächsvorbereitung übersetzen („dv_pComp|k=pass|v=4“) */
export function usePrepText() {
  const E = useEngine();
  return (line: string): string => {
    const [key, ...ps] = line.split("|"), o: Record<string, string> = {};
    for (const p of ps) { const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1); o[k] = k === "k" ? E.t("cp_" + v) : k === "t" && key === "dv_pTest" ? E.testName(v as TestKey) : v; }
    return E.tf(key, o);
  };
}

// ---------- Stufen 1–5 ----------
export function LevelDots({ value, onChange, color, testID, size = 22, labels }: { value: number | null | undefined; onChange?: (v: number | null) => void; color?: string; testID?: string; size?: number; labels?: string[] }) {
  const { c } = useTheme(); const col = color || c.accent;
  return (
    <Row gap={onChange ? 6 : 3} testID={testID}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = value != null && n <= value;
        const dot = <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? col : "transparent" }} />;
        return onChange ? (
          <Pressable key={n} testID={testID ? testID + "-" + n : undefined} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n}${labels?.[n - 1] ? " " + labels[n - 1] : ""}`}
            hitSlop={4} onPress={() => onChange(value === n ? null : n)}>{dot}</Pressable>
        ) : <React.Fragment key={n}>{dot}</React.Fragment>;
      })}
    </Row>
  );
}

// ---------- Kompetenzprofil ----------
/** Profil: je Bereich die Kompetenzen mit Trainer- (●) und Selbsteinschätzung (○), Unterschiede ab 2 Stufen markiert */
export function ProfileView({ p, forPlayer }: { p: Player; forPlayer?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const fmt = useFmt();
  const pg = posGroupOf(E.D, p, E.grp);
  const coachL = assessmentsOf(E.D, p.id, "coach", forPlayer), selfL = assessmentsOf(E.D, p.id, "self");
  const coach = coachL[0], self = selfL[0], first = coachL[coachL.length - 1];
  const gaps = gapsOf(coach, self, pg);
  if (!coach && !self) return <Muted>{forPlayer ? t("dv_selfNone") : t("dv_none")}</Muted>;
  return (
    <Col gap={14} testID="dev-profile">
      <Row wrap gap={10}>
        <Chip label={t("pgr_" + pg)} />
        {coach ? <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} /><Muted small>{(forPlayer ? t("dv_coachView") : t("dv_coach")) + " · " + E.de(coach.date)}</Muted></Row> : null}
        {self ? <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.warn }} /><Muted small>{t("dv_self") + " · " + E.de(self.date)}</Muted></Row> : null}
      </Row>
      {DEV_AREAS.map(area => {
        const col = areaColor(c, area), aC = areaAvg(coach, pg, area), aS = areaAvg(self, pg, area), aF = coachL.length > 1 ? areaAvg(first, pg, area) : null;
        return (
          <Col key={area} gap={8} testID={"dev-area-" + area}>
            <Row between wrap>
              <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 0.8, color: col }}>{t("da_" + area)}</Text>
              <Muted small>
                {aC != null ? "Ø " + fmt(Math.round(aC * 10) / 10) : ""}{aF != null && aC != null && Math.abs(aC - aF) >= 0.1 ? ` (${aC > aF ? "▲" : "▼"} ${tf("dv_since", { d: E.de(first!.date) })})` : ""}
                {aS != null ? `${aC != null ? " · " : ""}${t("dv_self")} Ø ${fmt(Math.round(aS * 10) / 10)}` : ""}
              </Muted>
            </Row>
            {COMPETENCIES[pg][area].map(key => {
              const vc = coach?.scores[key], vs = self?.scores[key], gap = gaps.find(g => g.key === key);
              return (
                <View key={key} testID={"dev-comp-" + key} style={{ gap: 4, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: c.line }}>
                  <Row between wrap gap={6}>
                    <T v="small" bold style={{ flexShrink: 1 }}>{t("cp_" + key)}</T>
                    {gap ? <Chip label={`${t("dv_gap")} ${gap.diff > 0 ? "+" : ""}${gap.diff}`} color={c.warn} /> : null}
                  </Row>
                  <Row gap={14} wrap>
                    {coach ? <LevelDots value={vc} size={13} color={c.accent} /> : null}
                    {self ? <Row gap={3}>{[1, 2, 3, 4, 5].map(n => <View key={n} style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: vs != null && n <= vs ? c.warn : c.line }} />)}</Row> : null}
                  </Row>
                </View>
              );
            })}
          </Col>
        );
      })}
      {coach?.note ? <Banner>{coach.note}</Banner> : null}
      {self && gaps.length ? <Col gap={4}>
        <T v="eyebrow">{t("dv_gapsT")}</T>
        {gaps.slice(0, 5).map(g => <Muted key={g.key} small>{`${t("cp_" + g.key)}: ${t("dv_self")} ${g.self} · ${t("dv_coach")} ${g.coach}${forPlayer ? "" : " – " + (g.diff > 0 ? t("dv_gapUp") : t("dv_gapDown"))}`}</Muted>)}
      </Col> : null}
    </Col>
  );
}

/** Einschätzen (Trainerteam) bzw. Selbsteinschätzung (Spieler) */
export function AssessSheet({ target, onClose }: { target: { p: Player; by: "coach" | "self" } | null; onClose: () => void }) {
  return target ? <AssessForm key={target.p.id + target.by} target={target} onClose={onClose} /> : null;
}
function AssessForm({ target, onClose }: { target: { p: Player; by: "coach" | "self" }; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const { p, by } = target, pg: PosGroup = posGroupOf(E.D, p, E.grp);
  const last = assessmentsOf(E.D, p.id, by)[0];
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...(last?.scores || {}) }));
  const [note, setNote] = useState("");
  const [vis, setVis] = useState(by === "self" ? true : last?.vis ?? false);
  const [busy, setBusy] = useState(false);
  const labels = [1, 2, 3, 4, 5].map(n => t((by === "self" ? "lvs_" : "lv_") + n));
  const n = Object.keys(cleanScores(scores, pg)).length, all = compsOf(pg).length;
  const save = async () => {
    setBusy(true);
    const a: Assessment = { id: tmpId(), pid: p.id, date: E.TODAY, by, scores: cleanScores(scores, pg), note: note.trim().slice(0, 2000), vis: by === "self" ? true : vis };
    try { await s.saveAssessment(a); onClose(); } finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title={by === "self" ? t("dv_selfTitle") : `${t("dv_assessT")}: ${E.name(p)}`} testID="assess-sheet" closeLabel={t("cancel")}>
      <Muted small>{by === "self" ? t("dv_selfInfo") : t("dv_profileInfo")}</Muted>
      <Row wrap gap={8}><Chip label={t("pgr_" + pg)} /><Muted small>{n} / {all}</Muted></Row>
      {DEV_AREAS.map(area => (
        <Col key={area} gap={10}>
          <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 0.8, color: areaColor(c, area) }}>{t("da_" + area)}</Text>
          {COMPETENCIES[pg][area].map(key => (
            <Col key={key} gap={6} style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <T v="small" bold>{t((by === "self" ? "cps_" : "cp_") + key)}</T>
              <Row between wrap gap={8}>
                <LevelDots testID={"as-" + key} value={scores[key]} labels={labels} color={by === "self" ? c.warn : c.accent} size={30}
                  onChange={v => setScores(prev => { const x = { ...prev }; if (v == null) delete x[key]; else x[key] = v; return x; })} />
                <Muted small>{scores[key] ? labels[scores[key] - 1] : t("dv_skip")}</Muted>
              </Row>
            </Col>
          ))}
        </Col>
      ))}
      <Field testID="as-note" label={by === "self" ? t("dv_selfReflect") : t("dv_note")} value={note} onChangeText={setNote} multiline maxLength={2000} />
      {by === "coach" ? <ToggleRow testID="as-vis" label={t("dv_visCoach")} desc={t("dv_visCoachD")} value={vis} onChange={setVis} /> : null}
      <Btn testID="as-save" kind="primary" label={by === "self" ? t("dv_selfSave") : t("save")} disabled={busy || !n} onPress={save} />
    </Sheet>
  );
}

// ---------- Ziele ----------
export function GoalProgress({ g, st }: { g: Goal; st: GoalState }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const fmt = useFmt();
  const unit = goalUnit(g), col = st.reached ? c.ok : st.behind ? c.warn : areaColor(c, g.area);
  const right = g.metric === "check" ? `${st.cur ?? 0} / ${st.target ?? g.steps.length}` : `${fmt(st.cur, g)}${st.target != null ? " / " + fmt(st.target, g) : ""}${unit ? " " + unit : ""}`;
  return (
    <Col gap={4}>
      <Bar value={st.pct ?? 0} color={col} />
      <Row between wrap>
        <Muted small>{st.cur == null ? t("dv_noData") : right}</Muted>
        <Text style={{ fontSize: 12, fontWeight: "700", color: col }}>{g.status !== "active" ? t("dv_st_" + g.status) : st.reached ? t("dv_reached") : st.behind ? t("dv_behind") : st.expected != null && st.cur != null ? t("dv_onTrack") : ""}</Text>
      </Row>
    </Col>
  );
}
/** Ziel als Karte: Titel, Bereich, Fortschritt, Frist, Schritte (abhakbar), Fortschritt eintragen */
export function GoalCard({ g, onEdit, onEntry, canTick, testID, compact }: { g: Goal; onEdit?: () => void; onEntry?: () => void; canTick?: boolean; testID?: string; compact?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const st = goalProgress(E.D, g, E.TODAY), col = areaColor(c, g.area);
  const tick = (i: number, v: boolean) => s.saveGoal({ ...g, steps: g.steps.map((x, j) => j === i ? { ...x, done: v } : x) });
  return (
    <View testID={testID || "goal-" + g.id} style={{ borderWidth: 1, borderColor: withAlpha(col, 0.35), backgroundColor: withAlpha(col, 0.06), borderRadius: radius.l, padding: 12, gap: 8, opacity: g.status === "dropped" ? 0.6 : 1 }}>
      <Row between align="flex-start" gap={8}>
        <Col gap={3} style={{ flex: 1 }}>
          <Row gap={6} wrap>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: col }}>{t("da_" + g.area)} · {t("dv_k_" + g.kind)}</Text>
            {g.by === "player" ? <Chip label={t("dv_byPlayer")} color={c.warn} /> : null}
            {!g.vis ? <Chip label={t("hidden")} color={c.build} /> : null}
          </Row>
          <T bold>{g.title}</T>
          {compact ? null : g.due ? <Muted small>{t("dv_due")} {E.de(g.due)}{g.why ? " · " + g.why : ""}</Muted> : g.why ? <Muted small>{g.why}</Muted> : null}
        </Col>
        {onEdit ? <Btn small kind="ghost" icon="eintragen" label="" a11y={t("dv_goalEdit")} testID={(testID || "goal-" + g.id) + "-edit"} onPress={onEdit} /> : null}
      </Row>
      <GoalProgress g={g} st={st} />
      {g.steps.length && !compact ? <Col gap={6}>
        {g.steps.map((x, i) => canTick && g.status === "active"
          ? <Check key={i} testID={(testID || "goal-" + g.id) + "-step-" + i} label={x.text} value={x.done} onChange={v => tick(i, v)} />
          : <Row key={i} gap={8}><Icon name={x.done ? "check" : "chevron"} size={14} color={x.done ? c.ok : c.muted} /><T v="small" style={{ flex: 1, textDecorationLine: x.done ? "line-through" : "none" }}>{x.text}</T></Row>)}
      </Col> : null}
      {onEntry && g.status === "active" && (g.metric === "count" || g.metric === "value") ? <Btn small testID={(testID || "goal-" + g.id) + "-add"} icon="plus" label={t("dv_add")} onPress={onEntry} style={{ alignSelf: "flex-start" }} /> : null}
    </View>
  );
}

const emptyGoal = (pid: string, from: string, by: "coach" | "player"): Goal => ({ id: tmpId(), pid, title: "", area: "tech", kind: "process", metric: "count", unit: "", start: 0, target: null, lower: false,
  test: null, stat: null, from, due: addDays(from, 42), why: "", steps: [], status: "active", vis: true, by, talkId: null });

/** Ziel anlegen oder bearbeiten (SMART). Spieler: eigene Ziele. */
export function GoalSheet({ target, onClose }: { target: { p: Player; goal?: Goal; pre?: Partial<Goal> } | null; onClose: () => void }) {
  return target ? <GoalForm key={(target.goal?.id || "new") + target.p.id} target={target} onClose={onClose} /> : null;
}
function GoalForm({ target, onClose }: { target: { p: Player; goal?: Goal; pre?: Partial<Goal> }; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const staff = s.viewAs === "coach", p = target.p;
  const [g, setG] = useState<Goal>(() => target.goal ? { ...target.goal, steps: target.goal.steps.map(x => ({ ...x })) } : { ...emptyGoal(p.id, E.TODAY, staff ? "coach" : "player"), ...(target.pre || {}) });
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (x: Partial<Goal>) => setG(prev => ({ ...prev, ...x }));
  const isNew = g.id.startsWith("tmp-");
  const tests = E.testsFor().filter(d => !d.gk || isGoalkeeper(E.D, p));
  const active = goalsOf(E.D, p.id).filter(x => x.status === "active" && x.id !== g.id).length;
  const own = g.by === "player", canEdit = staff || own;
  const setMetric = (m: GoalMetric) => {
    const test: TestKey | null = m === "test" ? (g.test || tests[0]?.key || null) : null;
    set({ metric: m, test, stat: m === "stat" ? (g.stat || "goals") : null, lower: m === "test" && test ? E.testDef(test).lower : m === "value" ? g.lower : false,
      start: suggestStart(E.D, p.id, m, test, E.TODAY), unit: m === "count" || m === "value" ? g.unit : m === "test" && test && isCustomTest(test) ? E.testDef(test).unit : "", kind: m === "test" ? "perf" : m === "stat" ? "outcome" : g.kind });
  };
  // eigener Test: Einheit ins Ziel übernehmen (eingebaute Tests: Einheit aus dem Katalog)
  const setTest = (k: TestKey) => set({ test: k, lower: E.testDef(k).lower, unit: isCustomTest(k) ? E.testDef(k).unit : "", start: suggestStart(E.D, p.id, "test", k, E.TODAY) });
  const ok = g.title.trim().length > 0 && (g.metric === "check" ? g.steps.length > 0 : g.metric === "att" || g.target != null) && (!g.due || g.due >= g.from);
  const save = async (patch: Partial<Goal> = {}) => {
    setBusy(true);
    try { await s.saveGoal(cleanGoal({ ...g, ...patch })); onClose(); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await s.deleteGoal(g.id); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible onClose={onClose} title={isNew ? (staff ? t("dv_goalNew") : t("dv_myGoalNew")) : t("dv_goalEdit")} testID="goal-sheet" closeLabel={t("cancel")}>
      {!staff && isNew ? <Banner>{t("dv_myGoalHint")}</Banner> : <Row gap={6}><Muted small style={{ flex: 1 }}>{t("dv_goalsInfo")}</Muted></Row>}
      {active >= MAX_ACTIVE_GOALS && isNew ? <Banner color="#c98a0b">{tf("dv_maxGoals", { n: MAX_ACTIVE_GOALS })}</Banner> : null}
      <Field testID="goal-title" label={t("dv_goalTitle")} value={g.title} onChangeText={x => set({ title: x })} placeholder={t("dv_goalTitlePh")} maxLength={120} />
      <Col gap={6}><T v="small" bold>{t("dv_area")}</T><ChoiceChips testID="goal-area" value={g.area} onChange={a => set({ area: a })} options={DEV_AREAS.map(a => ({ key: a, label: t("da_" + a) }))} /></Col>
      <Col gap={6}>
        <T v="small" bold>{t("dv_kind")}</T>
        <ChoiceChips testID="goal-kind" value={g.kind} onChange={k => set({ kind: k })} options={KINDS.map(k => ({ key: k, label: t("dv_k_" + k) }))} />
        <Muted small>{t("dv_kd_" + g.kind)}</Muted>
      </Col>
      <Picker testID="goal-metric" label={t("dv_metric")} value={g.metric} onChange={setMetric}
        options={METRICS.filter(m => (m !== "test" || (E.mods.leistung && tests.length)) && (m !== "stat" || E.mods.spielanalyse) && (m !== "att" || E.mods.beteiligung)).map(m => ({ key: m, label: t("dv_m_" + m) }))} />
      <Muted small>{t("dv_md_" + g.metric)}</Muted>
      {g.metric === "test" ? <Picker testID="goal-test" label={t("dv_m_test")} value={(g.test || tests[0]?.key) as TestKey} onChange={setTest} options={tests.map(d => ({ key: d.key, label: E.testName(d.key) + (d.unit ? ` (${d.unit})` : "") }))} /> : null}
      {g.metric === "stat" ? <Picker testID="goal-stat" label={t("dv_m_stat")} value={(g.stat || "goals") as GoalStat} onChange={x => set({ stat: x })} options={STATS.filter(x => x !== "clean" || isGoalkeeper(E.D, p)).map(x => ({ key: x, label: t("dv_s_" + x) }))} /> : null}
      {g.metric !== "check" ? <Row wrap gap={10}>
        {g.metric !== "stat" && g.metric !== "count" ? <NumField testID="goal-start" label={t("dv_start")} value={g.start} onChange={v => set({ start: v })} style={{ flex: 1, minWidth: 110 }} /> : null}
        <NumField testID="goal-target" label={t("dv_target") + (g.metric === "att" ? " (%)" : "")} value={g.target} onChange={v => set({ target: v })} min={g.metric === "att" ? 0 : undefined} max={g.metric === "att" ? 100 : undefined} style={{ flex: 1, minWidth: 110 }} />
        {g.metric === "count" || g.metric === "value" ? <Field testID="goal-unit" label={t("dv_unit")} value={g.unit} onChangeText={x => set({ unit: x })} placeholder={t("dv_unitPh")} maxLength={20} style={{ flex: 1, minWidth: 110 }} /> : null}
      </Row> : null}
      {g.metric === "value" ? <Check testID="goal-lower" label={t("dv_lower")} value={g.lower} onChange={v => set({ lower: v })} /> : null}
      <Row wrap gap={10}>
        <DateField testID="goal-from" label={t("dv_from")} value={g.from} onChange={v => v && set({ from: v })} lang={E.tr.lang} style={{ flex: 1, minWidth: 130 }} />
        <DateField testID="goal-due" label={t("dv_due")} value={g.due} onChange={v => set({ due: v })} lang={E.tr.lang} style={{ flex: 1, minWidth: 130 }} />
      </Row>
      <Field testID="goal-why" label={t("dv_why")} value={g.why} onChangeText={x => set({ why: x })} placeholder={t("dv_whyPh")} multiline maxLength={1000} />
      <Col gap={8}>
        <T v="small" bold>{t("dv_steps")}{g.metric === "check" ? " *" : ""}</T>
        {g.steps.map((x, i) => (
          <Row key={i} gap={8}>
            <View style={{ flex: 1 }}><Check testID={"goal-step-" + i} label={x.text} value={x.done} onChange={v => set({ steps: g.steps.map((y, j) => j === i ? { ...y, done: v } : y) })} /></View>
            <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => set({ steps: g.steps.filter((_, j) => j !== i) })} />
          </Row>
        ))}
        {g.steps.length < 10 ? <Row gap={8} align="flex-end">
          <Field testID="goal-step-new" label={t("dv_stepPh")} value={step} onChangeText={setStep} maxLength={200} style={{ flex: 1 }} />
          <Btn testID="goal-step-add" icon="plus" label="" a11y={t("dv_stepPh")} disabled={!step.trim()} onPress={() => { set({ steps: [...g.steps, { text: step.trim(), done: false }] }); setStep(""); }} />
        </Row> : null}
      </Col>
      {staff ? <ToggleRow testID="goal-vis" label={t("dv_goalVis")} desc={t("dv_goalVisD")} value={g.vis} onChange={v => set({ vis: v })} /> : null}
      {canEdit ? <Btn testID="goal-save" kind="primary" label={t("save")} disabled={busy || !ok} onPress={() => save()} /> : null}
      {!isNew && canEdit ? <Row wrap gap={8}>
        {g.status === "active" ? <>
          <Btn small testID="goal-done" label={t("dv_markDone")} onPress={() => save({ status: "done" })} disabled={busy} />
          {staff ? <Btn small testID="goal-missed" label={t("dv_markMissed")} onPress={() => save({ status: "missed" })} disabled={busy} /> : null}
          <Btn small testID="goal-drop" label={t("dv_drop")} onPress={() => save({ status: "dropped" })} disabled={busy} />
        </> : <Btn small testID="goal-reopen" label={t("dv_reopen")} onPress={() => save({ status: "active" })} disabled={busy} />}
        <Btn small kind="danger" testID="goal-del" icon="trash" label={t("del")} onPress={del} disabled={busy} />
      </Row> : null}
    </Sheet>
  );
}

/** Fortschritt eintragen (Zähler: Menge, Messwert: Wert) und Einträge ansehen */
export function EntrySheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  return goal ? <EntryForm key={goal.id} goal={goal} onClose={onClose} /> : null;
}
function EntryForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const fmt = useFmt();
  const [v, setV] = useState<number | null>(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const list = entriesOfGoal(E.D, goal.id), unit = goalUnit(goal), staff = s.viewAs === "coach";
  const save = async () => {
    if (v == null) return; setBusy(true);
    try { await s.saveGoalEntry({ id: tmpId(), goalId: goal.id, pid: goal.pid, date: E.TODAY, value: v, note: note.trim(), by: staff ? "coach" : "player" }); setV(null); setNote(""); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Sheet visible onClose={onClose} title={goal.title} testID="entry-sheet" closeLabel={t("cancel")}>
      <GoalProgress g={goal} st={goalProgress(E.D, goal, E.TODAY)} />
      <Row wrap gap={10}>
        <NumField testID="entry-value" label={(goal.metric === "count" ? t("dv_addCount") : t("dv_addValue")) + (unit ? ` (${unit})` : "")} value={v} onChange={setV} min={goal.metric === "count" ? 0 : undefined} style={{ flex: 1, minWidth: 120 }} />
        <Field testID="entry-note" label={t("dv_note")} value={note} onChangeText={setNote} maxLength={500} style={{ flex: 2, minWidth: 160 }} />
      </Row>
      <Btn testID="entry-save" kind="primary" label={t("dv_add")} disabled={busy || v == null} onPress={save} />
      {list.length ? <Col gap={6}>
        <T v="eyebrow">{t("dv_entries")}</T>
        {list.slice(0, 20).map(e => (
          <Row key={e.id} between gap={8}>
            <T v="small" style={{ flex: 1 }}>{E.de(e.date)} · {goal.metric === "count" ? "+" : ""}{fmt(e.value, goal)}{unit ? " " + unit : ""}{e.note ? " · " + e.note : ""}{e.by === "player" && staff ? " · " + t("dv_byPlayer") : ""}</T>
            {(staff || e.by === "player") ? <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => s.deleteGoalEntry(e.id)} /> : null}
          </Row>
        ))}
      </Col> : null}
    </Sheet>
  );
}

/** Ziele eines Spielers (aktiv zuerst) mit Anlegen/Bearbeiten/Eintragen */
export function GoalList({ p, forPlayer, limit }: { p: Player; forPlayer?: boolean; limit?: number }) {
  const E = useEngine(); const { t } = E;
  const [edit, setEdit] = useState<{ p: Player; goal?: Goal; pre?: Partial<Goal> } | null>(null);
  const [entry, setEntry] = useState<Goal | null>(null);
  const all = goalsOf(E.D, p.id).filter(g => !forPlayer || g.vis || g.by === "player");
  const list = limit ? all.filter(g => g.status === "active").slice(0, limit) : all;
  const pots = !forPlayer ? (E.D.pot[p.id] || []).filter(x => !all.some(g => g.title === x.text)).slice(0, 5) : [];
  return (
    <Col gap={10} testID="goal-list">
      {list.length ? list.map(g => <GoalCard key={g.id} g={g} canTick={!forPlayer || g.vis}
        onEdit={!forPlayer || g.by === "player" ? () => setEdit({ p, goal: g }) : undefined} onEntry={() => setEntry(g)} />) : <Muted>{t("dv_goalNone")}</Muted>}
      {!limit ? <Btn testID="goal-new" icon="plus" label={forPlayer ? t("dv_myGoalNew") : t("dv_goalNew")} onPress={() => setEdit({ p })} style={{ alignSelf: "flex-start" }} /> : null}
      {pots.length ? <Col gap={6}>
        <T v="eyebrow">{t("pl_goals")}</T>
        {pots.map(x => (
          <Row key={x.id} gap={8}>
            <T v="small" style={{ flex: 1 }}>{x.text}</T>
            <Btn small testID={"pot-goal-" + x.id} label={t("dv_fromPot")} onPress={() => setEdit({ p, pre: { title: x.text.slice(0, 120), area: x.cat === "verf" ? "ment" : x.cat } })} />
          </Row>
        ))}
      </Col> : null}
      <GoalSheet target={edit} onClose={() => setEdit(null)} />
      <EntrySheet goal={entry} onClose={() => setEntry(null)} />
    </Col>
  );
}

// ---------- Entwicklungsgespräche ----------
export function TalkView({ x, forPlayer, onEdit }: { x: DevTalk; forPlayer?: boolean; onEdit?: () => void }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const block = (k: string, v: string) => v.trim() ? <Col gap={2}><T v="eyebrow">{t(k)}</T><T v="small">{v}</T></Col> : null;
  return (
    <View testID={"talk-" + x.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.l, padding: 12, gap: 8 }}>
      <Row between gap={8}>
        <Row gap={8} wrap style={{ flex: 1 }}><T bold>{E.wt(x.date)} {E.de(x.date)}</T><Chip label={t("dv_tk_" + x.kind)} />{!forPlayer && !x.vis ? <Chip label={t("hidden")} color={c.build} /> : null}</Row>
        {onEdit ? <Btn small kind="ghost" icon="eintragen" label="" a11y={t("dv_talkEdit")} testID={"talk-" + x.id + "-edit"} onPress={onEdit} /> : null}
      </Row>
      {block("dv_tPlayer", x.player)}{block("dv_tStrengths", x.strengths)}{block("dv_tFocus", x.focus)}
      {x.agreements.length ? <Col gap={4}>
        <T v="eyebrow">{t("dv_tAgree")}</T>
        {x.agreements.map(a => <Row key={a.id} gap={8} align="flex-start"><Icon name={a.done ? "check" : "chevron"} size={14} color={a.done ? c.ok : c.muted} />
          <T v="small" style={{ flex: 1 }}>{a.text} <Text style={{ color: c.muted }}>({t("dv_who_" + a.who)}{a.due ? " · " + E.de(a.due) : ""} · {a.done ? t("dv_agreeDone") : t("dv_agreeOpen")})</Text></T></Row>)}
      </Col> : null}
      {!forPlayer && x.notes ? <Banner color={c.event}>{t("dv_tNotes")}: {x.notes}</Banner> : null}
      {x.next ? <Muted small>{t("dv_tNext")}: {E.de(x.next)}</Muted> : null}
    </View>
  );
}

export function TalkSheet({ target, onClose }: { target: { p: Player; talk?: DevTalk } | null; onClose: () => void }) {
  return target ? <TalkForm key={target.talk?.id || "new" + target.p.id} target={target} onClose={onClose} /> : null;
}
function TalkForm({ target, onClose }: { target: { p: Player; talk?: DevTalk }; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const pt = usePrepText();
  const p = target.p;
  const prep = useMemo(() => prepTalk(E, p.id), [E, p.id]);
  const [x, setX] = useState<DevTalk>(() => target.talk ? { ...target.talk, agreements: target.talk.agreements.map(a => ({ ...a })) }
    : { id: tmpId(), pid: p.id, date: E.TODAY, kind: "event", player: "", strengths: "", focus: "", agreements: prep.open.map(a => ({ ...a, id: agreementId() })), notes: "", next: addDays(E.TODAY, 84), vis: false });
  const [agree, setAgree] = useState(""); const [busy, setBusy] = useState(false);
  const [goal, setGoal] = useState<{ p: Player; pre: Partial<Goal> } | null>(null);
  const set = (y: Partial<DevTalk>) => setX(prev => ({ ...prev, ...y }));
  const setA = (id: string, y: Partial<Agreement>) => set({ agreements: x.agreements.map(a => a.id === id ? { ...a, ...y } : a) });
  const isNew = x.id.startsWith("tmp-");
  const take = () => set({ strengths: x.strengths || prep.strengths.map(pt).join("\n"), focus: x.focus || prep.focus.map(pt).join("\n") });
  const save = async () => { setBusy(true); try { await s.saveTalk({ ...x, agreements: x.agreements.filter(a => a.text.trim()).slice(0, 20) }); onClose(); } finally { setBusy(false); } };
  const del = async () => { setBusy(true); try { await s.deleteTalk(x.id); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible onClose={onClose} title={`${isNew ? t("dv_talkNew") : t("dv_talkEdit")}: ${E.name(p)}`} testID="talk-sheet" closeLabel={t("cancel")}>
      <Row gap={6}><Muted small style={{ flex: 1 }}>{t("dv_talksInfo")}</Muted></Row>
      {isNew ? <Card tone={c.low} testID="talk-prep">
        <CardTitle title={t("dv_prep")} />
        {!prep.strengths.length && !prep.focus.length && !prep.gaps.length && !prep.open.length ? <Muted small>{t("dv_prepNone")}</Muted> : null}
        {prep.strengths.length ? <Col gap={2}><T v="eyebrow">{t("dv_prepStrengths")}</T>{prep.strengths.map((l, i) => <T key={i} v="small">• {pt(l)}</T>)}</Col> : null}
        {prep.focus.length ? <Col gap={2}><T v="eyebrow">{t("dv_prepFocus")}</T>{prep.focus.map((l, i) => <T key={i} v="small">• {pt(l)}</T>)}</Col> : null}
        {prep.gaps.length ? <Col gap={2}><T v="eyebrow">{t("dv_gapsT")}</T>{prep.gaps.slice(0, 4).map(g => <T key={g.key} v="small">• {t("cp_" + g.key)}: {g.diff > 0 ? t("dv_gapUp") : t("dv_gapDown")} ({g.self} / {g.coach})</T>)}</Col> : null}
        {prep.open.length ? <Col gap={2}><T v="eyebrow">{t("dv_prepOpen")}</T>{prep.open.map(a => <T key={a.id} v="small">• {a.text}</T>)}</Col> : null}
        {!prep.selfFresh ? <Muted small>{t("dv_prepSelf")}</Muted> : null}
        {prep.strengths.length || prep.focus.length ? <Btn small testID="talk-take" icon="check" label={t("dv_prepTake")} onPress={take} style={{ alignSelf: "flex-start" }} /> : null}
      </Card> : null}
      <Row wrap gap={10}>
        <DateField testID="talk-date" label={t("date")} value={x.date} onChange={v => v && set({ date: v })} lang={E.tr.lang} style={{ flex: 1, minWidth: 130 }} />
        <DateField testID="talk-next" label={t("dv_tNext")} value={x.next} onChange={v => set({ next: v })} lang={E.tr.lang} style={{ flex: 1, minWidth: 130 }} />
      </Row>
      <Col gap={6}><T v="small" bold>{t("dv_talkKind")}</T><ChoiceChips testID="talk-kind" value={x.kind} onChange={k => set({ kind: k })} options={(["start", "mid", "end", "event"] as const).map(k => ({ key: k, label: t("dv_tk_" + k) }))} /></Col>
      <Field testID="talk-player" label={t("dv_tPlayer")} value={x.player} onChangeText={v => set({ player: v })} placeholder={t("dv_tPlayerPh")} multiline maxLength={4000} />
      <Field testID="talk-strengths" label={t("dv_tStrengths")} value={x.strengths} onChangeText={v => set({ strengths: v })} multiline maxLength={4000} />
      <Field testID="talk-focus" label={t("dv_tFocus")} value={x.focus} onChangeText={v => set({ focus: v })} multiline maxLength={4000} />
      <Col gap={8} testID="talk-agree">
        <T v="small" bold>{t("dv_tAgree")}</T>
        {x.agreements.map(a => (
          <View key={a.id} style={{ gap: 6, padding: 10, borderRadius: radius.m, borderWidth: 1, borderColor: c.line }}>
            <Row gap={8}>
              <View style={{ flex: 1 }}><Check testID={"talk-ag-" + a.id} label={a.text} value={a.done} onChange={v => setA(a.id, { done: v })} /></View>
              <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => set({ agreements: x.agreements.filter(y => y.id !== a.id) })} />
            </Row>
            <Row wrap gap={8}>
              <Seg value={a.who} onChange={w => setA(a.id, { who: w })} options={(["player", "coach", "both"] as const).map(k => ({ key: k, label: t("dv_who_" + k) }))} />
              <Btn small testID={"talk-ag-goal-" + a.id} icon="target" label={t("dv_toGoal")} onPress={() => setGoal({ p, pre: { title: a.text.slice(0, 120), talkId: x.id.startsWith("tmp-") ? null : x.id, due: a.due } })} />
            </Row>
          </View>
        ))}
        {x.agreements.length < 20 ? <Row gap={8} align="flex-end">
          <Field testID="talk-ag-new" label={t("dv_tAgreePh")} value={agree} onChangeText={setAgree} maxLength={300} style={{ flex: 1 }} />
          <Btn testID="talk-ag-add" icon="plus" label="" a11y={t("dv_tAgreePh")} disabled={!agree.trim()}
            onPress={() => { set({ agreements: [...x.agreements, { id: agreementId(), text: agree.trim(), who: "player", due: null, done: false }] }); setAgree(""); }} />
        </Row> : null}
      </Col>
      <Field testID="talk-notes" label={t("dv_tNotes")} value={x.notes} onChangeText={v => set({ notes: v })} multiline maxLength={4000} />
      <ToggleRow testID="talk-vis" label={t("dv_tVis")} desc={t("dv_tVisD")} value={x.vis} onChange={v => set({ vis: v })} />
      <Btn testID="talk-save" kind="primary" label={t("save")} disabled={busy} onPress={save} />
      {!isNew ? <Btn testID="talk-del" kind="danger" icon="trash" label={t("del")} disabled={busy} onPress={del} style={{ alignSelf: "flex-start" }} /> : null}
      <GoalSheet target={goal} onClose={() => setGoal(null)} />
    </Sheet>
  );
}

/** Gespräche eines Spielers */
export function TalkList({ p, forPlayer }: { p: Player; forPlayer?: boolean }) {
  const E = useEngine(); const { t, tf } = E;
  const [edit, setEdit] = useState<{ p: Player; talk?: DevTalk } | null>(null);
  const list = E.D.talks.filter(x => x.pid === p.id && (!forPlayer || x.vis)).sort((a, b) => a.date < b.date ? 1 : -1);
  const nextDue = list[0]?.next;
  return (
    <Col gap={10} testID="talk-list">
      {!forPlayer && nextDue ? <Banner color={nextDue <= E.TODAY ? "#c98a0b" : undefined}>{tf("dv_nextDue", { d: E.de(nextDue) })}</Banner> : null}
      {list.length ? list.map(x => <TalkView key={x.id} x={x} forPlayer={forPlayer} onEdit={forPlayer ? undefined : () => setEdit({ p, talk: x })} />) : <Muted>{t("dv_talkNone")}</Muted>}
      {!forPlayer ? <Btn testID="talk-new" icon="plus" kind="primary" label={t("dv_talkNew")} onPress={() => setEdit({ p })} style={{ alignSelf: "flex-start" }} /> : null}
      <TalkSheet target={edit} onClose={() => setEdit(null)} />
    </Col>
  );
}

// ---------- Saisonrückblick ----------
export function ReviewView({ p, forPlayer }: { p: Player; forPlayer?: boolean }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const fmt = useFmt();
  const r = useMemo(() => seasonReview(E, p.id, forPlayer), [E, p.id, forPlayer]);
  const pg = posGroupOf(E.D, p, E.grp);
  return (
    <Col gap={12} testID="dev-review">
      <Muted small>{t("dv_reviewSoFar")} · {E.de(r.from)} – {E.de(E.TODAY)}</Muted>
      <Row wrap gap={8}>
        {E.mods.beteiligung ? <StatTile label={t("dv_rAtt")} value={r.att != null ? r.att + " %" : "–"} color={r.att != null && r.att >= 85 ? c.ok : undefined} /> : null}
        <StatTile label={t("dv_rSessions")} value={`${r.attended}/${r.sessions}`} />
        {E.mods.spielanalyse ? <><StatTile label={t("dv_rGames")} value={String(r.games)} /><StatTile label={t("dv_rMin")} value={String(r.minutes)} />
          {r.clean != null ? <StatTile label={t("dv_s_clean")} value={String(r.clean)} /> : <><StatTile label={t("dv_s_goals")} value={String(r.goals)} /><StatTile label={t("dv_s_assists")} value={String(r.assists)} /></>}</> : null}
        <StatTile label={t("dv_rGoals")} value={`${r.goalsDone}/${r.goalsTotal}`} color={r.goalsDone ? c.ok : undefined} />
        {E.mods.challenge ? <StatTile label={t("dv_rChallenges")} value={String(r.challenges)} /> : null}
        {r.good || r.poor ? <StatTile label={t("te_good")} value={String(r.good)} color={c.ok} /> : null}
      </Row>
      {E.mods.leistung ? <Col gap={4}>
        <T v="eyebrow">{t("dv_rTests")}</T>
        {r.tests.length ? r.tests.map(x => <Row key={x.key} between><T v="small">{E.testName(x.key)}</T>
          <T v="small" bold color={x.better ? c.ok : c.warn}>{E.tr.num(x.first, E.testDef(x.key).dec)} → {E.tr.num(x.last, E.testDef(x.key).dec)} {E.testDef(x.key).unit} ({x.better ? "▲" : "▼"} {E.tr.num(x.pct, 1)} %)</T></Row>) : <Muted small>{t("dv_rNoTests")}</Muted>}
      </Col> : null}
      {r.areas.some(a => a.last != null) ? <Col gap={4}>
        <T v="eyebrow">{t("dv_rAreas")} · {t("pgr_" + pg)}</T>
        {r.areas.map(a => a.last != null ? <Row key={a.area} between><T v="small">{t("da_" + a.area)}</T>
          <T v="small" bold>{a.first != null && a.first !== a.last ? `${fmt(Math.round(a.first * 10) / 10)} → ` : ""}{fmt(Math.round(a.last * 10) / 10)}</T></Row> : null)}
      </Col> : null}
      <Muted small>{t("dv_rTalks")}: {r.talks}</Muted>
      {r.closing ? <Col gap={4}><T v="eyebrow">{t("dv_rClosing")}</T><TalkView x={r.closing} forPlayer={forPlayer} /></Col> : null}
    </Col>
  );
}

/** Spieler-Startseite: aktive Ziele (höchstens 3) mit Fortschritt */
export function MyGoalsCard({ p, onOpen, compact }: { p: Player; onOpen: () => void; compact?: boolean }) {
  const E = useEngine(); const { t } = E;
  const [entry, setEntry] = useState<Goal | null>(null);
  const L = goalsOf(E.D, p.id).filter(g => g.status === "active" && (g.vis || g.by === "player")).slice(0, compact ? 2 : 3);
  return (
    <Card testID="player-devgoals">
      <CardTitle title={t("dv_myGoals")} right={<Btn small kind="ghost" testID="pgoals-open" label={t("dv_mine")} onPress={onOpen} />} />
      {L.length ? L.map(g => compact
        ? <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={g.title} onPress={onOpen}><GoalCard g={g} compact onEntry={() => setEntry(g)} /></Pressable>
        : <GoalCard key={g.id} g={g} canTick onEntry={() => setEntry(g)} />) : <Muted small>{t("dv_myGoalHint")}</Muted>}
      {!L.length ? <Btn small testID="pgoals-new" icon="plus" label={t("dv_myGoalNew")} onPress={onOpen} style={{ alignSelf: "flex-start" }} /> : null}
      <EntrySheet goal={entry} onClose={() => setEntry(null)} />
    </Card>
  );
}
