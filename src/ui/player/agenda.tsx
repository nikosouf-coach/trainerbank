// Spieler-Kalender: Termine eines Tages (Spiel, Training, eigene Einheiten, Events), eigene Vorgabe für die Einheit
// und Fristen (Aufgaben, Dienste, Ziele, Vereinbarungen). Eine Quelle für Wochen-, Monats- und Fristenansicht.
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, diff, monday } from "../../core/dates";
import type { Engine } from "../../core/engine";
import { indivOf } from "../../core/indiv";
import type { TeamTask } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Icon, type IconName } from "../icons";
import { MyTarget } from "../indiv";
import { Col, Muted, Row } from "../kit";
import { CheckDot, dutyName } from "../tasks/widgets";
import { radius, rpeColor, useTheme, withAlpha } from "../theme";

/** Frist eines Spielers (Aufgabe, Dienst, Ziel, Vereinbarung) */
export interface DueItem { k: string; date: string; kind: "task" | "duty" | "goal" | "agree"; title: string; task?: TeamTask }

/** Alle offenen Fristen des Spielers (ohne Datum keine Frist) */
export function dueItems(E: Engine, pid: string): DueItem[] {
  const out: DueItem[] = [];
  for (const x of E.D.tasks) if (x.pid === pid && x.due && !x.done) out.push({ k: "t" + x.id, date: x.due, kind: "task", title: x.title, task: x });
  for (const d of E.D.duties) if (d.pid === pid && d.status === "open") out.push({ k: "d" + d.id, date: d.date, kind: "duty", title: dutyName(E, d.duty) });
  if (E.playerSees("dev")) {
    for (const g of E.D.goals) if (g.pid === pid && g.vis && g.status === "active" && g.due) out.push({ k: "g" + g.id, date: g.due, kind: "goal", title: g.title });
    for (const tk of E.D.talks) if (tk.pid === pid && tk.vis) for (const a of tk.agreements) if (a.who !== "coach" && !a.done && a.due) out.push({ k: "a" + tk.id + a.text.slice(0, 20), date: a.due, kind: "agree", title: a.text });
  }
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

const DUE_ICON: Record<DueItem["kind"], IconName> = { task: "checklist", duty: "checklist", goal: "target", agree: "flag" };

export interface DayMarks { match: boolean; train: number | null; off: "cancel" | "brk" | null; units: number; events: number; due: number; mine: boolean; absent: boolean }

/** Kalender-Daten eines Spielers */
export function useAgenda(pid: string) {
  const s = useStore(); const E = useEngine();
  const showPlan = E.playerSees("plan"), kids = E.grp === "u11";
  const due = dueItems(E, pid);
  const item = (d: string) => E.weekPlan(monday(d)).items.find(i => i.date === d);
  const marks = (d: string): DayMarks => {
    const x = item(d), tr = x?.train && x.train.kind !== "frei" ? x.train : null;
    const v = tr && d >= E.TODAY && showPlan && !kids ? indivOf(E, pid, d) : null;
    return {
      match: !!x?.match, train: tr ? (showPlan && !kids ? tr.rpe : 5) : null,
      off: !x || tr ? null : x.cancelled ? "cancel" : x.brk && E.regularDay(d) ? "brk" : null,
      units: E.unitsFor(pid, d).length, events: x?.events.length || 0, due: due.filter(z => z.date === d).length,
      mine: !!v && v.differs && v.kind !== "absent", absent: !!E.absenceOn(pid, d),
    };
  };
  return { E, s, showPlan, kids, due, item, marks };
}

/** Termine und Fristen eines Tages als Liste */
export function AgendaDay({ pid, date, testID }: { pid: string; date: string; testID?: string }) {
  const { E, s, showPlan, kids, due, item } = useAgenda(pid); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const x = item(date); if (!x) return null;
  const ab = E.absenceOn(pid, date), future = date >= E.TODAY;
  const timed: [string, React.ReactNode][] = [], top: React.ReactNode[] = [];
  const row = (k: string, col: string, icon: IconName, kind: string, title: string, sub?: string, extra?: React.ReactNode, off?: boolean) => (
    <View key={k} testID={"pc-e-" + k} style={{ borderLeftWidth: 3, borderLeftColor: col, backgroundColor: withAlpha(col.startsWith("#") ? col : "#888888", 0.08), borderRadius: radius.s, paddingVertical: 7, paddingHorizontal: 10, gap: 2, opacity: off ? 0.65 : 1 }}>
      <Row gap={5}><Icon name={icon} size={12} color={col} strokeWidth={2.2} /><Text style={{ fontSize: 12, fontWeight: "700", color: col }}>{kind}</Text></Row>
      <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink, textDecorationLine: off ? "line-through" : "none" }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 12.5, color: c.muted }}>{sub}</Text> : null}
      {extra}
    </View>
  );
  if (x.match) {
    const m = x.match, mp = s.myPlans.find(p => p.matchId === m.id);
    timed.push([m.zeit, row("m", c.accentTx, "ball", t("it_match"), `${t("vs")} ${m.gegner}`, `${m.zeit} · ${m.heim ? t("home") : t("away")} · ${t("comp_" + m.comp)}`,
      mp && E.mods.matchplan ? <Pressable testID={"pc-mp-" + mp.id} accessibilityRole="button" onPress={() => router.push("/player/matchplan/" + mp.id)} style={{ alignSelf: "flex-start", paddingTop: 4 }}>
        <Row gap={5}><Icon name="board" size={14} color={c.accentTx} /><Text style={{ fontSize: 13, fontWeight: "700", color: c.accentTx }}>{t("pc_mpOpen")}</Text></Row>
      </Pressable> : null)]);
  }
  const tr = x.train;
  if (tr && tr.kind !== "frei") timed.push([E.zeitOf(date), row("t", showPlan && !kids ? rpeColor(c, tr.rpe) : c.ok, "whistle", t("it_training"), showPlan ? E.kn(tr.kind) : t("it_training"),
    `${E.zeitOf(date)} · ${tr.dauer} ${t("min")}${showPlan && !kids ? " · " + t("intensity") + ": " + E.intWord(tr.rpe) : ""}`,
    future && showPlan && !kids ? <MyTarget pid={pid} date={date} detail testID={"pc-mine-" + date} /> : null)]);
  else if (tr && E.regularDay(date)) top.push(<Muted key="f" small>{t("pc_free")}</Muted>);
  else if (x.cancelled) top.push(row("c", c.muted, "whistle", t("it_training"), t("pc_cancel"), undefined, undefined, true));
  else if (x.brk && E.regularDay(date)) top.push(<Muted key="b" small>{t("pc_break")}</Muted>);
  for (const u of E.unitsFor(pid, date)) timed.push([u.zeit, row("u" + u.slot, u.art === "tw" ? c.event : "#16a3a3", "stopwatch", E.unitTitle(u),
    u.art === "tw" && u.themes?.length ? u.themes.map(k => t("tw_th_" + k)).join(" · ") : (u.inhalt.split("\n")[0] || E.unitTitle(u)),
    `${u.zeit} · ${u.dauer} ${t("min")}${showPlan && !kids ? " · " + t("intensity") + ": " + E.intWord(E.unitRpe(u)) : ""}`)]);
  x.events.forEach(e => timed.push([e.zeit || "99:99", row(e.id, c.event, "calendar", t("it_event"), e.titel, e.zeit || undefined)]));
  timed.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const dues = due.filter(z => z.date === date);
  return (
    <Col gap={6} testID={testID}>
      {ab ? <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.low }}>{t("ab_" + ab.typ)} · {t("pl_absent")}</Text> : null}
      {top}
      {timed.map(([, el]) => el)}
      {dues.map(z => <DueRow key={z.k} z={z} />)}
      {!top.length && !timed.length && !dues.length && !ab ? <Muted small>{t("pc_none")}</Muted> : null}
    </Col>
  );
}

/** Eine Frist (Aufgaben abhakbar) */
export function DueRow({ z, showDate }: { z: DueItem; showDate?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const over = z.date < E.TODAY, soon = !over && diff(E.TODAY, z.date) <= 1, col = over ? c.crit : soon ? c.warn : c.hot;
  const when = z.date === E.TODAY ? t("today") : z.date === addDays(E.TODAY, 1) ? t("tomorrow") : `${E.wt(z.date)} ${E.de(z.date)}`;
  return (
    <Row gap={10} testID={"pc-due-" + z.k} style={{ paddingVertical: 4 }}>
      {z.task ? <CheckDot done={z.task.done} label={z.title} testID={"pc-due-" + z.k + "-check"} onPress={() => s.setTaskDone(z.task!.id, !z.task!.done)} />
        : <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: withAlpha(col, 0.14), alignItems: "center", justifyContent: "center" }}><Icon name={DUE_ICON[z.kind]} size={14} color={col} strokeWidth={2} /></View>}
      <Col gap={1} style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{z.title}</Text>
        <Text style={{ fontSize: 12, color: over || soon ? col : c.muted, fontWeight: over || soon ? "700" : "400" }}>
          {t("pc_" + z.kind)}{showDate ? " · " + (over ? t("pc_over") + " · " : "") + when : over ? " · " + t("pc_over") : ""}</Text>
      </Col>
    </Row>
  );
}
