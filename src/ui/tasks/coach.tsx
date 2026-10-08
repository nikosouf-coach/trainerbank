// Mehr → Aufgaben & Dienste: Aufgaben (Trainer, Spieler), Dienste reihum, Strafenkatalog mit Automatik.
import React, { useState } from "react";
import { Text, View } from "react-native";
import { addDays, diff } from "../../core/dates";
import { dutySuggest, fineSuggest } from "../../core/duties";
import { kasseOf, money } from "../../core/kasse";
import type { DutyDef, DutyEntry, DutyWhen, FineEntry, FineRule, FineTrigger } from "../../core/types";
import { tmpId, useEngine, useStore } from "../../data/store";
import { Banner, Btn, Card, CardTitle, Check, Col, DateField, Field, Info, ListItem, Muted, NumField, Picker, Row, Seg, Sheet, T, Tag, ToggleRow } from "../kit";
import { useTheme } from "../theme";
import { DutyChip, QuickTodo, TaskRow, dutyName, fineText, groupTasks, ruleName } from "./widgets";

// ---------------------------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------------------------
export function TasksTab() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [showDone, setShowDone] = useState(false), [send, setSend] = useState(false), [openKey, setOpenKey] = useState<string | null>(null);
  const staffTodos = E.D.tasks.filter(x => !x.pid).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
  const open = staffTodos.filter(x => !x.done), done = staffTodos.filter(x => x.done);
  const groups = groupTasks(E.D.tasks.filter(x => x.pid)).sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
  const pname = (pid: string): string => { const p = E.P(pid); return p ? E.name(p) : "?"; };
  return (
    <>
      <Card testID="tk-staff">
        <CardTitle title={t("tk_staff")} />
        {open.length ? open.map(x => <TaskRow key={x.id} x={x} testID={"tk-" + x.id} sub={x.staffId ? E.D.staff.find(y => y.id === x.staffId)?.name : t("tk_allStaff")} onToggle={() => s.setTaskDone(x.id, true)} />) : <Muted>{t("tk_none")}</Muted>}
        <QuickTodo testID="tk" />
        {done.length ? <Btn small kind="ghost" label={`${t("tk_done")} (${done.length}) ${showDone ? "▴" : "▾"}`} onPress={() => setShowDone(!showDone)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} /> : null}
        {showDone ? done.map(x => (
          <Row key={x.id} gap={8}><View style={{ flex: 1 }}><TaskRow x={x} onToggle={() => s.setTaskDone(x.id, false)} /></View><Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => s.deleteTask(x.id)} /></Row>
        )) : null}
      </Card>
      <Card testID="tk-players">
        <CardTitle title={t("tk_players")} info={<Info title={t("tk_players")} text={t("tk_playersInfo")} />} right={<Btn small kind="primary" icon="plus" testID="tk-send" label={t("tk_send")} onPress={() => setSend(true)} />} />
        {groups.length ? groups.map(g => {
          const o = openKey === g.key, grp = g.groupId ? E.D.groups.find(x => x.id === g.groupId) : null;
          return (
            <View key={g.key} testID={"tk-g-" + g.items[0].id} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, gap: 6 }}>
              <ListItem title={g.title} sub={[g.due ? tf("tk_dueOn", { d: `${E.wt(g.due)} ${E.de(g.due)}` }) : "", grp ? grp.name : g.items.length === 1 ? pname(g.items[0].pid!) : tf("tk_nPlayers", { n: g.items.length })].filter(Boolean).join(" · ")}
                right={<Tag label={`${g.done}/${g.items.length}`} />} onPress={() => setOpenKey(o ? null : g.key)} />
              {o ? <Col gap={6}>
                {g.items.map(x => { return <Row key={x.id} gap={8}><Text style={{ flex: 1, color: c.ink }}>{pname(x.pid!)}</Text><Text style={{ color: x.done ? c.ok : c.muted, fontWeight: "700" }}>{x.done ? "✓ " + t("tk_doneShort") : t("tk_open")}</Text></Row>; })}
                <Btn small kind="ghost" testID="tk-g-del" label={t("del")} onPress={() => { g.items.forEach(x => s.deleteTask(x.id)); setOpenKey(null); }} style={{ alignSelf: "flex-start" }} />
              </Col> : null}
            </View>
          );
        }) : <Muted>{t("tk_nonePlayers")}</Muted>}
      </Card>
      <SendTaskSheet visible={send} onClose={() => setSend(false)} />
    </>
  );
}

function SendTaskSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const [title, setTitle] = useState(""), [note, setNote] = useState(""), [due, setDue] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "group" | "pick">("pick"), [gid, setGid] = useState(E.D.groups[0]?.id || ""), [pids, setPids] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const to = mode === "all" ? E.D.players.map(p => p.id) : mode === "group" ? E.D.players.filter(p => (p.groups || []).includes(gid)).map(p => p.id) : pids;
  const send = async () => {
    setBusy(true);
    try { for (const pid of to) await s.saveTask({ id: tmpId(), title: title.trim(), note: note.trim(), due, staffId: null, pid, groupId: mode === "group" ? gid : null, done: false, doneAt: null }); }
    finally { setBusy(false); }
    s.toast(tf("tk_sent", { n: to.length })); setTitle(""); setNote(""); setPids([]); onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("tk_send")} testID="tk-send-sheet" closeLabel={t("cancel")}>
      <Field testID="tks-title" label={t("tk_title")} value={title} onChangeText={setTitle} placeholder={t("tk_titlePh")} maxLength={200} />
      <Field testID="tks-note" label={t("tk_note")} value={note} onChangeText={setNote} multiline maxLength={1000} />
      <DateField testID="tks-due" label={t("tk_due")} value={due} onChange={setDue} lang={E.tr.lang} />
      <Seg testID="tks-mode" value={mode} onChange={setMode} options={[{ key: "pick", label: t("tk_pick") }, ...(E.D.groups.length ? [{ key: "group" as const, label: t("tab_gruppen") }] : []), { key: "all", label: t("tk_everyone") }]} />
      {mode === "group" ? <Picker testID="tks-group" label={t("tab_gruppen")} value={gid} onChange={setGid} options={E.D.groups.map(g => ({ key: g.id, label: g.name }))} /> : null}
      {mode === "pick" ? <Row wrap gap={10}>{E.D.players.map(p => <Check key={p.id} testID={"tks-p-" + p.id} label={p.vn + " " + (p.nn || "")[0] + "."} value={pids.includes(p.id)} onChange={on => setPids(on ? [...pids, p.id] : pids.filter(x => x !== p.id))} />)}</Row> : null}
      <Muted small>{t("tk_sendD")}</Muted>
      <Btn testID="tks-go" kind="primary" label={tf("tk_sendN", { n: to.length })} disabled={!title.trim() || !to.length || busy} onPress={send} style={{ alignSelf: "flex-start" }} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Dienste
// ---------------------------------------------------------------------------------------------
export function DutiesTab() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const defs = E.team.settings.duties || [];
  const [edit, setEdit] = useState<DutyDef | null>(null), [pick, setPick] = useState<DutyEntry | null>(null);
  const upcoming = E.D.duties.filter(d => d.date >= E.TODAY && diff(E.TODAY, d.date) <= 14 && d.status !== "waived");
  const dates = [...new Set(upcoming.map(d => d.date))].sort();
  const counts = E.D.players.map(p => ({ p, n: E.D.duties.filter(d => d.pid === p.id && d.status !== "waived" && diff(d.date, E.TODAY) <= 56 && d.date <= addDays(E.TODAY, 14)).length })).sort((a, b) => b.n - a.n);
  const saveDefs = (L: DutyDef[]) => s.saveDutyDefs(L);
  return (
    <>
      <Card testID="dy-plan">
        <CardTitle title={t("dy_plan")} info={<Info title={t("dy_plan")} text={t("dy_planInfo")} />} />
        {dates.length ? dates.map(d => (
          <Col key={d} gap={6} testID={"dy-day-" + d}>
            <T v="eyebrow">{d === E.TODAY ? t("today") : `${E.wt(d)} ${E.de(d)}`}{E.matchOn(d) ? " · " + t("it_match") : ""}</T>
            {[...new Set(upcoming.filter(x => x.date === d).map(x => x.duty))].map(k => (
              <Col key={k} gap={4}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.ink }}>{dutyName(E, k)}</Text>
                <Row gap={6} wrap>{upcoming.filter(x => x.date === d && x.duty === k).map(x => <DutyChip key={x.id} d={x} onPress={() => setPick(x)} />)}</Row>
              </Col>
            ))}
          </Col>
        )) : <Muted>{defs.some(d => d.on) ? t("dy_noneSoon") : t("dy_noneSet")}</Muted>}
        <Muted small>⚑ {t("dy_fineMark")}</Muted>
      </Card>
      <Card testID="dy-defs">
        <CardTitle title={t("dy_defs")} />
        {defs.length ? defs.map(d => (
          <ListItem key={d.id} testID={"dy-def-" + d.id} title={d.name} sub={`${t("dy_when_" + d.when)} · ${tf("dy_count", { n: d.count })}`} onPress={() => setEdit(d)} right={<Tag label={d.on ? t("tk_on") : t("tk_off")} />} />
        )) : <Banner>
          <Col gap={8}><T v="small">{t("dy_suggestD")}</T>
            <Btn small kind="primary" testID="dy-suggest" label={t("dy_suggest")} onPress={() => saveDefs(dutySuggest(E.tr.lang))} style={{ alignSelf: "flex-start" }} /></Col>
        </Banner>}
        <Btn small icon="plus" testID="dy-add" label={t("dy_add")} onPress={() => setEdit({ id: "d" + tmpId().slice(4, 12), name: "", when: "training", count: 1, on: true })} style={{ alignSelf: "flex-start" }} />
      </Card>
      {counts.some(x => x.n) ? <Card testID="dy-fair">
        <CardTitle title={t("dy_fair")} info={<Info title={t("dy_fair")} text={t("dy_fairInfo")} />} />
        <Row wrap gap={6}>{counts.map(x => <Tag key={x.p.id} label={`${x.p.vn} ${(x.p.nn || "")[0] || ""}. ${x.n}`} />)}</Row>
      </Card> : null}
      <DutyDefSheet def={edit} onClose={() => setEdit(null)} onSave={d => { const L = defs.some(x => x.id === d.id) ? defs.map(x => x.id === d.id ? d : x) : [...defs, d]; saveDefs(L); setEdit(null); }}
        onDelete={d => { saveDefs(defs.filter(x => x.id !== d.id)); setEdit(null); }} />
      <DutyEntrySheet d={pick} onClose={() => setPick(null)} />
    </>
  );
}

function DutyDefSheet({ def, onClose, onSave, onDelete }: { def: DutyDef | null; onClose: () => void; onSave: (d: DutyDef) => void; onDelete: (d: DutyDef) => void }) {
  const E = useEngine(); const { t } = E;
  const [x, setX] = useState<DutyDef | null>(null), [key, setKey] = useState<string | null>(null);
  if ((def?.id || null) !== key) { setKey(def?.id || null); setX(def ? { ...def } : null); }
  if (!def || !x) return null;
  const isNew = !(E.team.settings.duties || []).some(d => d.id === def.id);
  return (
    <Sheet visible onClose={onClose} title={isNew ? t("dy_add") : x.name || t("dy_defs")} testID="dy-def-sheet" closeLabel={t("cancel")}>
      <Field testID="dyd-name" label={t("dy_name")} value={x.name} onChangeText={v => setX({ ...x, name: v })} placeholder={t("dy_namePh")} maxLength={60} />
      <Seg testID="dyd-when" value={x.when} onChange={(w: DutyWhen) => setX({ ...x, when: w })} options={(["training", "match", "both"] as DutyWhen[]).map(w => ({ key: w, label: t("dy_when_" + w) }))} />
      <NumField testID="dyd-count" label={t("dy_countL")} value={x.count} min={1} max={6} step={1} onChange={v => setX({ ...x, count: v || 1 })} style={{ width: 140 }} />
      <ToggleRow testID="dyd-on" label={t("dy_active")} desc={t("dy_activeD")} value={x.on} onChange={v => setX({ ...x, on: v })} />
      <Row gap={8} wrap>
        <Btn testID="dyd-save" kind="primary" label={t("save")} disabled={!x.name.trim()} onPress={() => onSave({ ...x, name: x.name.trim() })} />
        {!isNew ? <Btn kind="ghost" testID="dyd-del" label={t("del")} onPress={() => onDelete(x)} /> : null}
      </Row>
    </Sheet>
  );
}

function DutyEntrySheet({ d, onClose }: { d: DutyEntry | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [swap, setSwap] = useState("");
  if (!d) return null;
  const p = E.P(d.pid);
  return (
    <Sheet visible onClose={onClose} title={`${dutyName(E, d.duty)} · ${E.wt(d.date)} ${E.de(d.date)}`} testID="dy-entry-sheet" closeLabel={t("cancel")}>
      <T bold>{p ? E.name(p) : "?"}{d.source === "fine" ? " · " + t("dy_fromFine") : ""}</T>
      <Row gap={8} wrap>
        <Btn testID="dye-done" kind="primary" label={d.status === "done" ? t("tk_reopen") : t("dy_markDone")} onPress={() => { s.saveDuty({ ...d, status: d.status === "done" ? "open" : "done" }); onClose(); }} />
        <Btn testID="dye-remove" kind="ghost" label={t("dy_remove")} onPress={async () => { await s.saveDuty({ ...d, status: "waived" }); s.runAutomation(); onClose(); }} />
      </Row>
      <Picker testID="dye-swap" label={t("dy_swap")} value={swap} onChange={setSwap} options={[{ key: "", label: "–" }, ...E.D.players.filter(x => x.id !== d.pid && !E.absenceOn(x.id, d.date)).map(x => ({ key: x.id, label: E.name(x) }))]} />
      <Btn testID="dye-swap-go" label={t("dy_swapGo")} disabled={!swap} onPress={async () => { await s.saveDuty({ ...d, pid: swap, source: d.source === "rotation" ? "manual" : d.source }); s.toast(t("t_saved")); onClose(); }} style={{ alignSelf: "flex-start" }} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Strafen
// ---------------------------------------------------------------------------------------------
export function FinesTab() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const rules = E.team.settings.fines || [], defs = E.team.settings.duties || [];
  const [edit, setEdit] = useState<FineRule | null>(null), [give, setGive] = useState(false), [showAll, setShowAll] = useState(false);
  const open = E.D.fines.filter(f => f.status === "open").sort((a, b) => a.date < b.date ? 1 : -1);
  const closed = E.D.fines.filter(f => f.status !== "open").sort((a, b) => a.date < b.date ? 1 : -1);
  const k = kasseOf(E.team.settings, E.grp);
  const sum = (L: FineEntry[]) => k.money ? L.reduce((a, f) => a + (f.amount || 0), 0) : 0;
  const fmt = (v: number) => money(v, k.currency, E.tr.lang);
  // Bezahlen: mit Kasse als Einnahme im Kassenbuch (die Strafe gilt dann als bezahlt), sonst nur als erledigt
  const paid = (f: FineEntry) => k.on && k.money && f.amount ? s.payItems([{ id: tmpId(), date: E.TODAY, amount: f.amount, kind: "in", cat: "fine", pid: f.pid, feeId: null, period: null, fineId: f.id, note: "" }]) : s.saveFine({ ...f, status: "done" });
  const saveRules = (L: FineRule[]) => s.saveFineRules(L);
  const auto = rules.some(r => r.on && r.trigger !== "manual");
  const row = (f: FineEntry) => {
    const p = E.P(f.pid) || E.D.inactive.find(x => x.id === f.pid);
    return (
      <View key={f.id} testID={"fn-" + f.id} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, gap: 4 }}>
        <Row between wrap gap={6}>
          <T bold>{p ? E.name(p) : "?"}</T>
          <Muted small>{E.wt(f.date)} {E.de(f.date)}{f.auto ? " · " + t("fn_auto") : ""}</Muted>
        </Row>
        <T v="small">{ruleName(E, f.rule)}{f.ref ? ` (${E.de(f.ref)})` : ""}</T>
        {fineText(E, f) ? <Muted small>{fineText(E, f)}</Muted> : null}
        {f.status === "open" ? <Row gap={6} wrap>
          <Btn small kind="primary" testID={"fn-done-" + f.id} label={k.money && f.amount && !f.dutyDate ? t("fn_paid") : t("fn_doneBtn")} onPress={() => k.money && f.amount && !f.dutyDate ? paid(f) : s.saveFine({ ...f, status: "done" })} />
          <Btn small kind="ghost" testID={"fn-waive-" + f.id} label={t("fn_waive")} onPress={() => s.saveFine({ ...f, status: "waived" })} />
        </Row> : <Tag label={t("fn_st_" + f.status)} />}
      </View>
    );
  };
  return (
    <>
      <Card testID="fn-open">
        <CardTitle title={tf("fn_openN", { n: open.length })} right={<Btn small kind="primary" icon="plus" testID="fn-give" label={t("fn_give")} onPress={() => setGive(true)} />} />
        {open.length ? open.map(row) : <Muted>{t("fn_none")}</Muted>}
        {sum(open) || sum(closed.filter(f => f.status === "done")) ? <Row gap={14} wrap>
          <Muted small>{t("fn_cashOpen")}: <Text style={{ fontWeight: "800", color: c.ink }}>{fmt(sum(open))}</Text></Muted>
          <Muted small>{t("fn_cashPaid")}: <Text style={{ fontWeight: "800", color: c.ink }}>{fmt(sum(closed.filter(f => f.status === "done")))}</Text></Muted>
        </Row> : null}
        {closed.length ? <Btn small kind="ghost" label={`${t("fn_history")} (${closed.length}) ${showAll ? "▴" : "▾"}`} onPress={() => setShowAll(!showAll)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} /> : null}
        {showAll ? closed.slice(0, 30).map(row) : null}
      </Card>
      <Card testID="fn-catalog">
        <CardTitle title={t("fn_catalog")} info={<Info title={t("fn_catalog")} text={t("fn_catalogInfo")} />} />
        {rules.length ? rules.map(r => (
          <ListItem key={r.id} testID={"fn-rule-" + r.id} title={r.name} onPress={() => setEdit(r)}
            sub={[r.trigger !== "manual" ? "⚙ " + t("fn_trig_" + r.trigger) : t("fn_trig_manual"), r.duty ? dutyName(E, r.duty) : "", r.amount && k.money ? fmt(r.amount) : ""].filter(Boolean).join(" · ")}
            right={<Tag label={r.on ? t("tk_on") : t("tk_off")} />} />
        )) : <Banner><Col gap={8}><T v="small">{t("fn_suggestD")}</T>
          <Btn small kind="primary" testID="fn-suggest" label={t("fn_suggest")} onPress={() => { saveRules(fineSuggest(E.tr.lang, k.money)); if (!defs.length) s.saveDutyDefs(dutySuggest(E.tr.lang)); }} style={{ alignSelf: "flex-start" }} /></Col></Banner>}
        <Btn small icon="plus" testID="fn-add" label={t("fn_add")} onPress={() => setEdit({ id: "f" + tmpId().slice(4, 12), name: "", trigger: "manual", duty: null, amount: null, note: "", on: true })} style={{ alignSelf: "flex-start" }} />
        {auto ? <Banner color={c.warn} testID="fn-privacy">{t("fn_privacy")}</Banner> : <Muted small>{t("fn_privacy")}</Muted>}
        <Muted small testID="fn-money-hint">{k.money ? t("fn_moneyOn") : t("fn_moneyOff")}</Muted>
      </Card>
      <FineRuleSheet rule={edit} onClose={() => setEdit(null)}
        onSave={r => { const L = rules.some(x => x.id === r.id) ? rules.map(x => x.id === r.id ? r : x) : [...rules, r]; saveRules(L); setEdit(null); }}
        onDelete={r => { saveRules(rules.filter(x => x.id !== r.id)); setEdit(null); }} />
      <GiveFineSheet visible={give} onClose={() => setGive(false)} />
    </>
  );
}

function FineRuleSheet({ rule, onClose, onSave, onDelete }: { rule: FineRule | null; onClose: () => void; onSave: (r: FineRule) => void; onDelete: (r: FineRule) => void }) {
  const E = useEngine(); const { t } = E; const k = kasseOf(E.team.settings, E.grp);
  const [x, setX] = useState<FineRule | null>(null), [key, setKey] = useState<string | null>(null);
  if ((rule?.id || null) !== key) { setKey(rule?.id || null); setX(rule ? { ...rule } : null); }
  if (!rule || !x) return null;
  const defs = E.team.settings.duties || [], isNew = !(E.team.settings.fines || []).some(r => r.id === rule.id);
  const was = (E.team.settings.fines || []).find(r => r.id === rule.id);
  const save = () => {
    // Automatik gilt erst ab dem Einschalten (keine rückwirkenden Strafen)
    const since = x.trigger !== "manual" && x.on && (!was || !was.on || was.trigger !== x.trigger) ? E.TODAY : x.since;
    onSave({ ...x, name: x.name.trim(), since });
  };
  return (
    <Sheet visible onClose={onClose} title={isNew ? t("fn_add") : x.name} testID="fn-rule-sheet" closeLabel={t("cancel")}>
      <Field testID="fnr-name" label={t("fn_name")} value={x.name} onChangeText={v => setX({ ...x, name: v })} placeholder={t("fn_namePh")} maxLength={80} />
      <Picker testID="fnr-trigger" label={t("fn_trigger")} value={x.trigger} onChange={(v: FineTrigger) => setX({ ...x, trigger: v })} options={(["manual", "late_rpe", "unexcused"] as FineTrigger[]).map(k => ({ key: k, label: t("fn_trig_" + k) }))} />
      {x.trigger !== "manual" ? <Muted small>{t("fn_trigD_" + x.trigger)}</Muted> : null}
      <Picker testID="fnr-duty" label={t("fn_duty")} value={x.duty || ""} onChange={v => setX({ ...x, duty: v || null })} options={[{ key: "", label: t("fn_noDuty") }, ...defs.map(d => ({ key: d.id, label: d.name }))]} />
      {x.duty ? <Muted small>{t("fn_dutyD")}</Muted> : null}
      {k.money ? <NumField testID="fnr-amount" label={`${t("fn_amount")} (${k.currency})`} value={x.amount} min={0} max={500} step={0.5} onChange={v => setX({ ...x, amount: v })} style={{ width: 180 }} /> : null}
      {k.money && x.trigger === "late_rpe" && x.amount ? <Muted small>{t("fn_noMoneyRpe")}</Muted> : null}
      <ToggleRow testID="fnr-on" label={t("dy_active")} value={x.on} onChange={v => setX({ ...x, on: v })} />
      <Row gap={8} wrap>
        <Btn testID="fnr-save" kind="primary" label={t("save")} disabled={!x.name.trim()} onPress={save} />
        {!isNew ? <Btn kind="ghost" testID="fnr-del" label={t("del")} onPress={() => onDelete(x)} /> : null}
      </Row>
    </Sheet>
  );
}

function GiveFineSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const k = kasseOf(E.team.settings, E.grp);
  const rules = (E.team.settings.fines || []).filter(r => r.on);
  const [pid, setPid] = useState(""), [rid, setRid] = useState(rules[0]?.id || ""), [note, setNote] = useState("");
  const r = rules.find(x => x.id === rid);
  return (
    <Sheet visible={visible} onClose={onClose} title={t("fn_give")} testID="fn-give-sheet" closeLabel={t("cancel")}>
      {rules.length ? <>
        <Picker testID="fng-player" label={t("players")} value={pid} onChange={setPid} options={[{ key: "", label: "–" }, ...E.D.players.map(p => ({ key: p.id, label: E.name(p) }))]} />
        <Picker testID="fng-rule" label={t("fn_rule")} value={rid} onChange={setRid} options={rules.map(x => ({ key: x.id, label: x.name }))} />
        {r ? <Muted small>{[r.duty ? dutyName(E, r.duty) + " · " + t("fn_nextDate") : "", r.amount && k.money ? money(r.amount, k.currency, E.tr.lang) : ""].filter(Boolean).join(" · ")}</Muted> : null}
        <Field testID="fng-note" label={t("tk_note")} value={note} onChangeText={setNote} maxLength={300} />
        <Btn testID="fng-go" kind="primary" label={t("fn_give")} disabled={!pid || !r} onPress={async () => {
          await s.saveFine({ id: tmpId(), pid, rule: r!.id, date: E.TODAY, ref: null, amount: k.money ? r!.amount : null, note: note.trim(), status: "open", auto: false, dutyDate: null });
          s.toast(t("t_saved")); setPid(""); setNote(""); onClose();
        }} style={{ alignSelf: "flex-start" }} />
      </> : <Muted>{t("fn_noRules")}</Muted>}
    </Sheet>
  );
}
