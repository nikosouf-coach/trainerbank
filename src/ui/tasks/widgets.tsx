// Aufgaben, Dienste, Strafen – kleine Bausteine für Startseite, Trainingstag und Spieler-App.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Engine } from "../../core/engine";
import type { DutyEntry, FineEntry, TeamTask } from "../../core/types";
import { tmpId, useEngine, useStore } from "../../data/store";
import { Btn, Card, CardTitle, Col, DateField, Field, Muted, Picker, Row, T } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";

export const dutyName = (E: Engine, id: string): string => (E.team.settings.duties || []).find(d => d.id === id)?.name || id;
export const ruleName = (E: Engine, id: string): string => (E.team.settings.fines || []).find(r => r.id === id)?.name || id;
export const fineText = (E: Engine, f: FineEntry): string => {
  const parts: string[] = [];
  if (f.dutyDate) { const r = (E.team.settings.fines || []).find(x => x.id === f.rule); parts.push(`${r?.duty ? dutyName(E, r.duty) : E.t("fn_duty")} · ${E.wt(f.dutyDate)} ${E.de(f.dutyDate)}`); }
  if (f.amount != null) parts.push(E.tr.lang === "en" ? `€${f.amount.toFixed(2)}` : `${f.amount.toFixed(2).replace(".", ",")} €`);
  if (f.note) parts.push(f.note);
  return parts.join(" · ");
};
const whenLabel = (E: Engine, d: string): string => d === E.TODAY ? E.t("today") : `${E.wt(d)} ${E.de(d)}`;

/** Runder Haken zum Abhaken */
export function CheckDot({ done, onPress, testID, label }: { done: boolean; onPress?: () => void; testID?: string; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label} onPress={onPress} disabled={!onPress} hitSlop={8}
      style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: done ? c.ok : c.line, backgroundColor: done ? c.ok : "transparent", alignItems: "center", justifyContent: "center" }}>
      {done ? <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>✓</Text> : null}
    </Pressable>
  );
}

/** Eine Aufgabe als Zeile */
export function TaskRow({ x, onToggle, sub, testID }: { x: TeamTask; onToggle?: () => void; sub?: string; testID?: string }) {
  const E = useEngine(); const { c } = useTheme();
  const over = !x.done && !!x.due && x.due < E.TODAY;
  return (
    <Row gap={10} testID={testID}>
      <CheckDot done={x.done} onPress={onToggle} label={x.title} testID={testID ? testID + "-check" : undefined} />
      <Col gap={1} style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink, textDecorationLine: x.done ? "line-through" : "none", opacity: x.done ? 0.6 : 1 }}>{x.title}</Text>
        {sub || x.due || x.note ? <Text style={{ fontSize: 12, color: over ? c.crit : c.muted }}>{[x.due ? E.tf("tk_dueOn", { d: whenLabel(E, x.due) }) : "", x.note, sub].filter(Boolean).join(" · ")}</Text> : null}
      </Col>
    </Row>
  );
}

/** Schnell eine Trainer-Aufgabe anlegen (optional mit festem Datum) */
export function QuickTodo({ date, testID = "todo" }: { date?: string; testID?: string }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [title, setTitle] = useState(""), [due, setDue] = useState<string | null>(date || null), [who, setWho] = useState<string>(s.myStaff?.id || "");
  const add = async () => {
    await s.saveTask({ id: tmpId(), title: title.trim(), note: "", due, staffId: who || null, pid: null, groupId: null, done: false, doneAt: null });
    setTitle(""); s.toast(t("t_saved"));
  };
  return (
    <Col gap={8}>
      <Row gap={8} wrap align="flex-end">
        <Field testID={testID + "-title"} label={t("tk_new")} value={title} onChangeText={setTitle} placeholder={t("tk_newPh")} maxLength={200} style={{ flex: 1, minWidth: 200 }} />
        {!date ? <DateField testID={testID + "-due"} label={t("tk_due")} value={due} onChange={setDue} lang={E.tr.lang} style={{ width: 150 }} /> : null}
      </Row>
      <Row gap={8} wrap align="flex-end">
        {E.D.staff.length ? <Picker testID={testID + "-who"} label={t("tk_who")} value={who} onChange={setWho} options={[{ key: "", label: t("tk_allStaff") }, ...E.D.staff.map(x => ({ key: x.id, label: x.name }))]} style={{ flex: 1, minWidth: 180 }} /> : null}
        <Btn testID={testID + "-add"} kind="primary" label={t("pot_add")} disabled={!title.trim()} onPress={add} />
      </Row>
    </Col>
  );
}

/** Trainingstag: Dienste, Trainer-Aufgaben und Spieler-Aufgaben dieses Tages */
export function DayTasks({ date }: { date: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [add, setAdd] = useState(false);
  const duties = E.D.duties.filter(d => d.date === date && d.status !== "waived");
  const todos = E.D.tasks.filter(x => !x.pid && x.due === date);
  const ptasks = E.D.tasks.filter(x => x.pid && x.due === date);
  const byDuty = [...new Set(duties.map(d => d.duty))];
  const ptGroups = groupTasks(ptasks);
  return (
    <Card testID="td-tasks">
      <CardTitle title={t("td_tasks")} right={<Btn small kind="ghost" testID="td-tasks-all" label={t("tk_all") + " ›"} onPress={() => router.push("/coach/aufgaben")} />} />
      {byDuty.length ? <Col gap={6} testID="td-duties">
        <T v="eyebrow">{t("dy_title")}</T>
        {byDuty.map(k => (
          <Col key={k} gap={4}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.ink }}>{dutyName(E, k)}</Text>
            <Row gap={6} wrap>{duties.filter(d => d.duty === k).map(d => <DutyChip key={d.id} d={d} onPress={() => s.saveDuty({ ...d, status: d.status === "done" ? "open" : "done" })} />)}</Row>
          </Col>
        ))}
      </Col> : <Muted small>{t("dy_noneDay")}</Muted>}
      <Col gap={8}>
        <T v="eyebrow">{t("tk_staff")}</T>
        {todos.length ? todos.map(x => <TaskRow key={x.id} x={x} testID={"td-todo-" + x.id} sub={x.staffId ? E.D.staff.find(y => y.id === x.staffId)?.name : t("tk_allStaff")} onToggle={() => s.setTaskDone(x.id, !x.done)} />) : <Muted small>{t("tk_none")}</Muted>}
        {ptGroups.map(g => <Muted key={g.key} small>{tf("tk_playerTask", { t: g.title, a: g.done, n: g.items.length })}</Muted>)}
        {add ? <QuickTodo date={date} testID="td-todo" /> : <Btn small icon="plus" testID="td-todo-new" label={t("tk_add")} onPress={() => setAdd(true)} style={{ alignSelf: "flex-start" }} />}
      </Col>
    </Card>
  );
}

/** Dienst als Marke (Name, Quelle Strafe, erledigt) */
export function DutyChip({ d, onPress }: { d: DutyEntry; onPress?: () => void }) {
  const E = useEngine(); const { c } = useTheme(); const p = E.P(d.pid) || E.D.inactive.find(x => x.id === d.pid);
  const col = d.status === "done" ? c.ok : d.source === "fine" ? c.crit : c.accentTx;
  return (
    <Pressable testID={"duty-" + d.id} accessibilityRole="button" accessibilityLabel={p ? E.name(p) : "?"} onPress={onPress} disabled={!onPress}
      style={{ backgroundColor: withAlpha(col, 0.12), borderWidth: 1, borderColor: withAlpha(col, 0.4), borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ color: col, fontWeight: "700", fontSize: 12.5 }}>{d.status === "done" ? "✓ " : ""}{p ? p.vn + " " + (p.nn || "")[0] + "." : "?"}{d.source === "fine" ? " ⚑" : ""}</Text>
    </Pressable>
  );
}

/** Spieler-Aufgaben mit gleichem Titel/Termin zusammenfassen (an mehrere Spieler verschickt) */
export function groupTasks(L: TeamTask[]): { key: string; title: string; due: string | null; note: string; groupId: string | null; items: TeamTask[]; done: number }[] {
  const m = new Map<string, TeamTask[]>();
  for (const x of L) { const k = `${x.title}|${x.due || ""}|${x.note}`; m.set(k, [...(m.get(k) || []), x]); }
  return [...m.entries()].map(([key, items]) => ({ key, title: items[0].title, due: items[0].due, note: items[0].note, groupId: items[0].groupId, items, done: items.filter(x => x.done).length }));
}

/** Startseite Trainer: eigene offene Aufgaben (mir zugeteilt oder dem ganzen Trainerteam) */
export function MyTodos() {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const me = s.myStaff;
  const L = E.D.tasks.filter(x => !x.pid && !x.done && (!x.staffId || (me && x.staffId === me.id))).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1).slice(0, 6);
  if (!L.length) return <Muted small>{t("tk_noneMine")}</Muted>;
  return <Col gap={8}>{L.map(x => <TaskRow key={x.id} x={x} testID={"my-todo-" + x.id} onToggle={() => s.setTaskDone(x.id, true)} />)}</Col>;
}

/** Spieler-App: eigene Aufgaben, Dienste und offene Strafen */
export function PlayerTasksCard({ pid }: { pid: string }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const tasks = E.D.tasks.filter(x => x.pid === pid && (!x.done || (x.doneAt || "") >= E.TODAY));
  const duties = E.D.duties.filter(d => d.pid === pid && d.date >= E.TODAY && d.status === "open").sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 4);
  const fines = E.D.fines.filter(f => f.pid === pid && f.status === "open");
  if (!tasks.length && !duties.length && !fines.length) return null;
  return (
    <Card testID="player-tasks">
      <CardTitle title={t("tk_mine")} />
      {duties.map(d => (
        <Row key={d.id} gap={10} testID={"p-duty-" + d.id}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: withAlpha(d.source === "fine" ? c.crit : c.accentTx, 0.14), alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 13 }}>{d.source === "fine" ? "⚑" : "⚽"}</Text></View>
          <Col gap={1} style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{dutyName(E, d.duty)}</Text>
            <Text style={{ fontSize: 12, color: c.muted }}>{whenLabel(E, d.date)}{d.source === "fine" ? " · " + t("dy_fromFine") : ""}</Text>
          </Col>
        </Row>
      ))}
      {tasks.map(x => <TaskRow key={x.id} x={x} testID={"p-task-" + x.id} onToggle={() => s.setTaskDone(x.id, !x.done)} />)}
      {fines.map(f => (
        <Row key={f.id} gap={10} testID={"p-fine-" + f.id}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: withAlpha(c.warn, 0.16), alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 13 }}>!</Text></View>
          <Col gap={1} style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: c.ink }}>{ruleName(E, f.rule)}</Text>
            <Text style={{ fontSize: 12, color: c.muted }}>{fineText(E, f)}</Text>
          </Col>
        </Row>
      ))}
    </Card>
  );
}
