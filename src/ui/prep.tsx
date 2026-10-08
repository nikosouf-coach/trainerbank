// Bausteine für Vorbereitung & Pausen: Programm-Bausteine, Eintragen durch Spieler, Bearbeiten durch Trainer,
// Phasen anlegen, Karten für „Heute“ (Trainer und Spieler).
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { addDays, diff } from "../core/dates";
import { runTargets } from "../core/perf";
import {
  CAT_COLOR, FREE_LIB, artOf, catOf, compliance, defaultProgram, freeDef, phaseOn, phaseWeeks, progWeek, upcomingPhase, weekIndex,
  type FreeCat, type WeekRole,
} from "../core/prep";
import type { FreeKey, Phase, PhaseKind, ProgItem } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Icon, type IconName } from "./icons";
import { Btn, Card, Col, DateField, Field, Info, Muted, NumField, NumScale, Picker, Row, Seg, Sheet, T } from "./kit";
import { GOLD, HealthConsentGate } from "./player/parts";
import { radius, rpeColor, useTheme, withAlpha } from "./theme";

export const CAT_ICON: Record<FreeCat, IconName> = { erholung: "moon", ausdauer: "flame", kraft: "bolt", schnell: "target", technik: "star" };
export const ROLE_COLOR: Record<WeekRole, string> = { rest: "#16a3a3", keep: "#3a6db5", ramp: "#d6336c", entry: "#2f9e44", build: "#f0762b", deload: "#16a3a3", taper: "#7b5fd0" };

export function itemTitle(t: (k: string) => string, it: ProgItem): string { return it.key === "eigen" ? (it.title || t("fl_eigen")) : (it.title || t("fl_" + it.key)); }
export function spanText(tf: (k: string, o: Record<string, string | number>) => string, it: ProgItem): string {
  return it.from === it.to ? tf("vb_wkOne", { a: it.from }) : tf("vb_wk", { a: it.from, b: it.to });
}
/** Aktive Phase für den Spieler (läuft oder beginnt bald) – nur mit sichtbarem Programm. */
export function playerPhase(E: ReturnType<typeof useEngine>): Phase | null {
  if (!E.mods.vorbereitung || !E.playerSees("program")) return null;
  const now = phaseOn(E.D, E.TODAY), ph = now && now.program.length && now.vis ? now : upcomingPhase(E.D, E.TODAY, 21);
  return ph && ph.vis && ph.program.length ? ph : null;
}

/** Farbiges Symbol eines Bausteins. */
export function ItemIcon({ it, size = 38, done }: { it: ProgItem; size?: number; done?: boolean }) {
  const col = CAT_COLOR[catOf(it)];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: done ? GOLD : col, alignItems: "center", justifyContent: "center" }}>
      <Icon name={done ? "check" : CAT_ICON[catOf(it)]} size={size * 0.5} color="#fff" strokeWidth={2.4} />
    </View>
  );
}

/** Fortschrittsring „2/5“ – voll = Gold. */
export function CountRing({ done, total, size = 64, color }: { done: number; total: number; size?: number; color: string }) {
  const { c } = useTheme(); const W = 8, r = size / 2 - W / 2 - 1, C = 2 * Math.PI * r, pct = total ? Math.min(1, done / total) : 0, full = total > 0 && done >= total;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={withAlpha(color, 0.18)} strokeWidth={W} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={full ? GOLD : color} strokeWidth={W} fill="none" strokeLinecap="round" strokeDasharray={`${C * Math.max(pct, 0.001)} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ fontWeight: "800", fontSize: 15, color: c.ink, fontVariant: ["tabular-nums"] }}>{done}/{total}</Text>
    </View>
  );
}

/** Zeile eines Bausteins in der Spieler-App: Symbol, Titel, Punkte für jede Einheit, „Erledigt“. */
export function PlayerItemRow({ it, done, onLog, onInfo, locked, testID }: { it: ProgItem; done: number; onLog: () => void; onInfo: () => void; locked?: boolean; testID?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const full = done >= it.perWeek, col = CAT_COLOR[catOf(it)];
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.line }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("pg_how") + ": " + itemTitle(t, it)} onPress={onInfo} style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <ItemIcon it={it} done={full} />
        <Col gap={3} style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 15, color: c.ink }}>{itemTitle(t, it)}</Text>
          <Text style={{ fontSize: 12.5, color: c.muted }}>{it.min}′ · RPE {it.rpe} · {tf("vb_perWeekN", { n: it.perWeek })}</Text>
          <Row gap={4}>{[...Array(it.perWeek)].map((_, i) => <View key={i} style={{ width: 16, height: 6, borderRadius: 3, backgroundColor: i < done ? (full ? GOLD : col) : withAlpha(col, 0.2) }} />)}</Row>
        </Col>
      </Pressable>
      {full ? <Text style={{ fontSize: 22, color: GOLD }}>★</Text>
        : locked ? null
        : <Pressable testID={testID ? testID + "-log" : undefined} accessibilityRole="button" accessibilityLabel={t("pg_done") + ": " + itemTitle(t, it)} onPress={onLog}
          style={({ pressed }) => ({ backgroundColor: col, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.85 : 1, flexDirection: "row", alignItems: "center", gap: 4 })}>
          <Icon name="check" size={15} color="#fff" strokeWidth={2.6} />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{t("pg_done")}</Text>
        </Pressable>}
    </View>
  );
}

/** Anleitung zu einem Baustein (mit persönlichen Laufstrecken aus dem 30-15-Test). */
export function ItemInfoSheet({ it, pid, onClose, onLog, locked }: { it: ProgItem | null; pid: string; onClose: () => void; onLog?: () => void; locked?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const rt = it && ["intervall", "fahrtspiel"].includes(it.key) ? runTargets(E.D, pid) : null;
  return (
    <Sheet visible={!!it} onClose={onClose} title={it ? itemTitle(t, it) : ""} testID="pg-info" closeLabel={t("cancel")}>
      {it ? <>
        <Row gap={10}><ItemIcon it={it} /><Col gap={2} style={{ flex: 1 }}>
          <T v="eyebrow" color={CAT_COLOR[catOf(it)]}>{t("fl_cat_" + catOf(it))}</T>
          <Muted small>{it.min}′ · RPE {it.rpe} · {tf("vb_perWeekN", { n: it.perWeek })}</Muted>
        </Col></Row>
        {t("fl_" + it.key + "_d") && it.key !== "eigen" ? <T>{t("fl_" + it.key + "_d")}</T> : null}
        {it.note ? <View style={{ backgroundColor: c.sunk, borderRadius: radius.m, padding: 10 }}><T v="small">{it.note}</T></View> : null}
        {rt ? <View style={{ backgroundColor: withAlpha("#3a6db5", 0.12), borderRadius: radius.m, padding: 10 }}><T v="small" bold>{tf("pg_personal", { a: rt.d15_90, b: rt.d15_95 })}</T></View> : null}
        {onLog && !locked ? <Btn testID="pg-info-log" kind="primary" icon="check" label={t("pg_log")} onPress={onLog} style={{ alignSelf: "flex-start" }} /> : null}
      </> : null}
    </Sheet>
  );
}

/** Einheit eintragen: Datum, Minuten, RPE – wird als Zusatzbelastung mit Programm-Verweis gespeichert. */
export function LogSheet({ it, ph, pid, onClose }: { it: ProgItem | null; ph: Phase | null; pid: string; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [date, setDate] = useState<string>(E.TODAY), [min, setMin] = useState<number | null>(null), [rpe, setRpe] = useState<number | null>(null);
  const [last, setLast] = useState<string | null>(null);
  if (it && it.id !== last) { setLast(it.id); setDate(E.TODAY); setMin(it.min); setRpe(it.rpe); }
  const consent = !!s.consents?.health_data;
  const okDate = !!ph && date >= ph.from && date <= ph.to && date <= E.TODAY;
  const save = async () => {
    if (!it || !ph || !min || !rpe) return;
    await s.saveExtra(pid, { id: tmpId(), date, art: artOf(it), min, rpe, label: itemTitle(t, it).slice(0, 60), prog: it.id });
    s.toast(t("pg_logged")); onClose();
  };
  return (
    <Sheet visible={!!it} onClose={onClose} title={t("pg_log")} testID="pg-log" closeLabel={t("cancel")}>
      {it ? (!consent ? <HealthConsentGate /> : <>
        <Row gap={10}><ItemIcon it={it} /><T v="h3" style={{ flex: 1 }}>{itemTitle(t, it)}</T></Row>
        <Row gap={10} wrap>
          <DateField testID="pg-log-date" label={t("pg_date")} value={date} onChange={d => d && setDate(d)} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
          <NumField testID="pg-log-min" label={t("pg_min")} value={min} onChange={setMin} min={1} max={300} step={1} style={{ width: 110 }} />
        </Row>
        {!okDate ? <Muted small>{E.de(ph!.from)} – {E.de(ph!.to)}</Muted> : null}
        <Col gap={6}><T v="small" bold color={c.muted}>{t("pg_rpe")}{rpe ? `: ${rpe} · ${E.intWord(rpe)}` : ""}</T>
          <NumScale testID="pg-log-rpe" value={rpe} min={1} max={10} color={n => rpeColor(c, n)} onChange={setRpe} /></Col>
        <Btn testID="pg-log-save" kind="primary" icon="check" label={t("pg_done")} disabled={!okDate || !min || !rpe} onPress={save} style={{ alignSelf: "flex-start" }} />
      </>) : null}
    </Sheet>
  );
}

/** Karte „Mein Programm“ auf dem Spieler-Dashboard. */
export function PlayerProgramCard({ pid }: { pid: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const [info, setInfo] = useState<ProgItem | null>(null), [log, setLog] = useState<ProgItem | null>(null);
  const ph = playerPhase(E);
  if (!ph) return null;
  void s.version;
  const started = ph.from <= E.TODAY, W = phaseWeeks(ph.from, ph.to);
  const ws = started ? W.find(w => w <= E.TODAY && addDays(w, 6) >= E.TODAY) || W[0] : W[0];
  const pw = progWeek(E.D, pid, ph, ws, E.TODAY), allDone = started && pw.total > 0 && pw.done >= pw.total;
  const col = ph.kind === "break" ? "#16a3a3" : "#f0762b";
  return (
    <Card testID="player-program" tone={allDone ? GOLD : col}>
      <Pressable accessibilityRole="button" onPress={() => router.push("/player/programm")} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <CountRing done={pw.done} total={pw.total} color={col} />
        <Col gap={3} style={{ flex: 1 }}>
          <T v="eyebrow" color={col}>{t("pg_title")} · {ph.title}</T>
          <T v="h2">{allDone ? t("pg_allDone") : started ? tf("pg_week", { i: pw.i, n: W.length }) : tf("pg_startsIn", { d: E.de(ph.from) })}</T>
          <Muted small>{started ? (allDone ? tf("pg_progress", { d: pw.done, t: pw.total }) : tf("pg_left", { n: pw.total - pw.done })) : t("pg_ready")}</Muted>
        </Col>
      </Pressable>
      {pw.injured ? <Muted small>{t("pp_injured")}</Muted> : pw.personal.level !== "standard" || pw.personal.why.length ? <Row gap={6} testID="pg-personal">
        <Muted small style={{ flex: 1 }}>{tf("pp_adapted", { l: t("pp_level_" + pw.personal.level) })} · {pw.personal.why.map(k => t(k)).join(" · ")}</Muted>
        <Info title={t("pg_title")} text={t("pp_info")} />
      </Row> : null}
      <View>
        {pw.items.map(({ it, done }) => <PlayerItemRow key={it.id} testID={"pg-item-" + it.id} it={it} done={done} locked={!started} onInfo={() => setInfo(it)} onLog={() => setLog(it)} />)}
      </View>
      <Btn small testID="pg-all" label={t("pg_all")} onPress={() => router.push("/player/programm")} style={{ alignSelf: "flex-start" }} />
      <ItemInfoSheet it={info} pid={pid} locked={!started} onClose={() => setInfo(null)} onLog={() => { const x = info; setInfo(null); setLog(x); }} />
      <LogSheet it={log} ph={ph} pid={pid} onClose={() => setLog(null)} />
    </Card>
  );
}

/** Zusammenfassung einer Phase für Trainer (Liste und „Heute“). */
export function PhaseSummary({ ph, onPress, testID }: { ph: Phase; onPress: () => void; testID?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const W = phaseWeeks(ph.from, ph.to), running = ph.from <= E.TODAY && ph.to >= E.TODAY, i = running ? weekIndex(ph, E.TODAY) : 0;
  const col = ph.kind === "break" ? "#16a3a3" : "#f0762b";
  const comp = ph.kind === "break" && ph.program.length && ph.from <= E.TODAY ? E.D.players.map(p => compliance(E.D, p.id, ph, E.TODAY).pct).filter((x): x is number => x != null) : [];
  const avg = comp.length ? Math.round(comp.reduce((a, x) => a + x, 0) / comp.length * 100) : null;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: col }} />
      <Col gap={3} style={{ flex: 1 }}>
        <Row gap={6} wrap>
          <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, color: col, textTransform: "uppercase" }}>{t("vb_kind_" + ph.kind)}</Text>
          {running ? <Text style={{ fontSize: 10.5, fontWeight: "800", color: c.ok }}>● {tf(ph.kind === "break" ? "vb_nowBreak" : "vb_nowPrep", { i, n: W.length })}</Text> : null}
        </Row>
        <Text style={{ fontWeight: "800", fontSize: 16, color: c.ink }}>{ph.title}</Text>
        <Text style={{ fontSize: 13, color: c.muted }}>{E.de(ph.from)} – {E.de(ph.to)} · {W.length === 1 ? t("vb_week1") : tf("vb_weeks", { n: W.length })}{ph.firstMatch ? ` · ${t("it_match")} ${E.de(ph.firstMatch)}` : ""}</Text>
        {avg != null ? <Text style={{ fontSize: 12.5, fontWeight: "700", color: avg >= 70 ? c.ok : avg >= 50 ? c.warn : c.crit }}>{tf("vb_compShort", { p: avg })}</Text> : null}
      </Col>
      <Icon name="chevron" size={16} color={c.muted} />
    </Pressable>
  );
}

/** Karte auf „Heute“ (Trainer): laufende oder bald beginnende Phase. */
export function CoachPhaseCard() {
  const E = useEngine(); const router = useRouter(); const { t } = E;
  if (!E.mods.vorbereitung) return null;
  const ph = phaseOn(E.D, E.TODAY) || upcomingPhase(E.D, E.TODAY, 21);
  if (!ph) return null;
  return (
    <Card testID="coach-phase-card">
      <Row between><T v="eyebrow">{t("vb_title")}</T></Row>
      <PhaseSummary ph={ph} onPress={() => router.push("/coach/phase/" + ph.id)} />
    </Card>
  );
}

/** Phase anlegen oder bearbeiten. Beim Anlegen entsteht ein Vorschlag für das Spielerprogramm. */
export function PhaseSheet({ visible, kind, ph, onClose, onSaved }: { visible: boolean; kind: PhaseKind; ph: Phase | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [k, setK] = useState<PhaseKind>(kind), [title, setTitle] = useState(""), [from, setFrom] = useState<string | null>(null), [to, setTo] = useState<string | null>(null), [fm, setFm] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const cur = visible ? (ph?.id || "new-" + kind) : null;
  if (cur !== key) {
    setKey(cur);
    if (visible) {
      setK(ph?.kind || kind); setTitle(ph?.title || ""); setFrom(ph?.from || E.TODAY); setTo(ph?.to || addDays(E.TODAY, kind === "break" ? 20 : 41)); setFm(ph?.firstMatch || null);
    }
  }
  const valid = !!from && !!to && to >= from && diff(from, to) <= 182 && !!title.trim();
  const save = async () => {
    if (!valid) { s.toast(t("vb_errDates")); return; }
    const kindChanged = !ph || ph.kind !== k || ph.from !== from || ph.to !== to;
    const x: Phase = ph
      ? { ...ph, kind: k, title: title.trim(), from: from!, to: to!, firstMatch: k === "prep" ? fm : null }
      : { id: tmpId(), kind: k, title: title.trim(), from: from!, to: to!, firstMatch: k === "prep" ? fm : null, weeks: {}, program: [], vis: true, note: "" };
    if (!ph || (kindChanged && !ph.program.length)) x.program = defaultProgram(k, from!, to!, E.grp, () => "pi-" + tmpId().slice(4));
    // Programm-Wochen an eine kürzere Phase anpassen
    const n = phaseWeeks(x.from, x.to).length;
    x.program = x.program.filter(it => it.from <= n).map(it => ({ ...it, to: Math.min(it.to, n) }));
    await s.savePhase(x); s.toast(t("vb_saved")); onClose();
    // Beim Anlegen vergibt der Server eine neue ID
    const saved = s.D?.phases.find(p => p.id === x.id) || s.D?.phases.find(p => p.title === x.title && p.from === x.from && p.to === x.to && p.kind === x.kind);
    onSaved?.(saved?.id || x.id);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={ph ? t("vb_edit") : t("vb_new")} testID="vb-sheet" closeLabel={t("cancel")}>
      <Seg testID="vb-kind" value={k} onChange={setK} options={[{ key: "prep", label: t("vb_kind_prep") }, { key: "break", label: t("vb_kind_break") }]} />
      <Field testID="vb-title" label={t("vb_titleF")} value={title} onChangeText={setTitle} placeholder={t("vb_titlePh_" + k)} maxLength={120} />
      <Row gap={10} wrap>
        <DateField testID="vb-from" label={t("vb_from")} value={from} onChange={setFrom} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
        <DateField testID="vb-to" label={t("vb_to")} value={to} onChange={setTo} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
      </Row>
      {k === "prep" ? <DateField testID="vb-fm" label={t("vb_firstMatch")} value={fm} onChange={setFm} lang={E.tr.lang} /> : null}
      {!ph ? <Muted small>{t("vb_newHint")}</Muted> : null}
      <Btn testID="vb-save" kind="primary" label={t("save")} disabled={!valid} onPress={save} style={{ alignSelf: "flex-start" }} />
    </Sheet>
  );
}

/** Baustein bearbeiten (Trainer). */
export function ItemSheet({ it, n, onSave, onDelete, onClose }: { it: ProgItem | null; n: number; onSave: (x: ProgItem) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [x, setX] = useState<ProgItem | null>(null), [key, setKey] = useState<string | null>(null);
  if ((it?.id || null) !== key) { setKey(it?.id || null); setX(it ? { ...it } : null); }
  const set = (p: Partial<ProgItem>) => setX(o => o ? { ...o, ...p } : o);
  const opts = [...FREE_LIB.map(d => ({ key: d.key as FreeKey, label: t("fl_" + d.key) })), { key: "eigen" as FreeKey, label: t("fl_eigen") }];
  return (
    <Sheet visible={!!it} onClose={onClose} title={t("vb_item")} testID="vb-item" closeLabel={t("cancel")}>
      {x ? <>
        <Picker testID="vb-item-key" label={t("vb_item")} value={x.key} options={opts} onChange={k => { const d = freeDef(k); set(d ? { key: k, min: d.min, rpe: d.rpe } : { key: k }); }} />
        {x.key === "eigen" ? <Field testID="vb-item-title" label={t("vb_customTitle")} value={x.title || ""} onChangeText={v => set({ title: v })} maxLength={60} /> : null}
        <Row gap={10} wrap>
          <NumField testID="vb-item-min" label={t("pg_min")} value={x.min} onChange={v => v && set({ min: v })} min={5} max={240} step={5} style={{ width: 100 }} />
          <NumField testID="vb-item-pw" label={t("vb_perWeek")} value={x.perWeek} onChange={v => v && set({ perWeek: v })} min={1} max={7} step={1} style={{ width: 100 }} />
          <NumField testID="vb-item-from" label={t("vb_wFrom")} value={x.from} onChange={v => v && set({ from: Math.min(v, x.to) })} min={1} max={n} step={1} style={{ width: 100 }} />
          <NumField testID="vb-item-to" label={t("vb_wTo")} value={x.to} onChange={v => v && set({ to: Math.max(v, x.from) })} min={1} max={n} step={1} style={{ width: 100 }} />
        </Row>
        <Col gap={6}><T v="small" bold color={c.muted}>RPE: {x.rpe} · {E.intWord(x.rpe)}</T>
          <NumScale testID="vb-item-rpe" value={x.rpe} min={1} max={10} color={v => rpeColor(c, v)} onChange={v => set({ rpe: v })} /></Col>
        <Field testID="vb-item-note" label={t("vb_itemNote")} value={x.note || ""} onChangeText={v => set({ note: v })} multiline maxLength={500} />
        {x.key !== "eigen" ? <Muted small>{t("fl_" + x.key + "_d")}</Muted> : null}
        <Row gap={10} wrap>
          <Btn testID="vb-item-save" kind="primary" label={t("save")} disabled={x.key === "eigen" && !x.title?.trim()} onPress={() => { onSave(x); onClose(); }} />
          <Btn kind="ghost" testID="vb-item-del" label={t("vb_itemDel")} onPress={() => { onDelete(x.id); onClose(); }} />
        </Row>
      </> : null}
    </Sheet>
  );
}

