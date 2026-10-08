// Blätter (Dialoge) für Kalender und Planung: Tagesansicht, Termin anlegen/bearbeiten, Spielplan-Import,
// Abwesenheit eintragen und KI-Einheit. Ein Bildschirm nutzt sie über usePlanSheets().
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { CONTENT } from "../../core/content";
import { addDays, diff, kwOf, monday } from "../../core/dates";
import { demoTeam, sampleFixtures } from "../../core/demo";
import { parseFixtures } from "../../core/fixtures";
import type { Engine } from "../../core/engine";
import { defaultProgram, phaseOn } from "../../core/prep";
import type { AbsenceType, Match, Phase, TeamEvent } from "../../core/types";
import { pickTextFile } from "../../data/files";
import { tmpId, useEngine, useStore } from "../../data/store";
import { Markdown, useAi } from "../ai";
import { Banner, Btn, Check, ChoiceChips, Col, DateField, Field, ListItem, Muted, Picker, Row, Seg, Sheet, T, TimeField } from "../kit";
import { rpeColor, useTheme, withAlpha } from "../theme";
import { RegionPicker } from "../reha";
import { jumpTo } from "./calState";

export type SheetState =
  | { k: "day"; date: string }
  | { k: "add"; date: string; type: "training" | "match" | "event" | "pause"; obj?: Match | TeamEvent }
  | { k: "import" }
  | { k: "ai"; date: string }
  | { k: "abs"; date?: string; pid?: string };

/** Farbiger Abschnitt mit Randstreifen (wie im Prototyp). */
export function Sec({ color, children, testID }: { color?: string; children?: React.ReactNode; testID?: string }) {
  const { c } = useTheme(); const col = color || c.line;
  return <View testID={testID} style={{ borderLeftWidth: 4, borderLeftColor: col, backgroundColor: withAlpha(col.startsWith("#") ? col : "#888888", 0.07), borderRadius: 10, padding: 12, gap: 6 }}>{children}</View>;
}

const ABS_TYPES: AbsenceType[] = ["urlaub", "krank", "verletzung", "schule", "arbeit", "sonst"];

// ---------- Tagesansicht ----------
function DayBody({ date, open, close }: { date: string; open: (s: SheetState) => void; close: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const x = E.weekPlan(monday(date)).items.find(i => i.date === date)!;
  const n = E.D.players.length, ab = E.absentOn(date), past = date < E.TODAY, sess = E.D.sessions.find(z => z.date === date);
  const showI = E.lvl(1) && E.grp !== "u11", pro = E.lvl(2) && E.grp !== "u11", tr = x.train, mods = E.mods;
  const cal = E.D.cal[date] || {};
  const onTagPage = (usePathname() || "").startsWith("/coach/tag/");
  const saved = (msg?: string) => { jumpTo(date); s.toast(msg || tf("saved_on", { d: E.wt(date) + " " + E.de(date) })); };
  return (
    <Col gap={12}>
      <Row between wrap gap={8}>
        <Col gap={2}><T v="eyebrow">{(x.md ? x.md + " · " : "") + t("kw") + " " + kwOf(date)}</T><T v="h2">{E.wt(date)} {E.de(date)}</T></Col>
        {!onTagPage ? <Btn small kind="primary" testID="day-open-tag" label={t("td_open") + " ›"} onPress={() => { close(); router.push("/coach/tag/" + date); }} /> : null}
      </Row>
      {x.match ? <Sec color={c.accentTx}>
        <T bold>{t("it_match")} {t("vs")} {x.match.gegner}</T>
        <Muted small>{x.match.zeit} · {x.match.heim ? t("home") : t("away")} · {t("comp_" + x.match.comp)}{pro ? ` · ${E.int(E.matchLoad())} AU` : ""}</Muted>
        <Row wrap gap={6}>
          {mods.spielanalyse && date <= E.TODAY ? <Btn small kind="primary" testID="day-report" label={t("sp_open")} onPress={() => { close(); router.push("/coach/spiel/" + x.match!.id); }} /> : null}
          <Btn small testID="day-edit-match" label={t("day_editMatch")} onPress={() => open({ k: "add", date, type: "match", obj: x.match! })} />
          {sess && mods.beteiligung ? <Btn small label={t("day_attOpen")} onPress={() => { close(); router.push("/coach/einheit/" + date); }} /> : null}
        </Row>
      </Sec> : null}
      {tr && tr.kind === "frei" ? <Sec color={c.ok}>
        <T bold>{t("k_frei")}</T>
        <T v="small">{tf("restRec", { md: tr.md })} {CONTENT.frei[E.tr.lang]}</T>
        <Row wrap gap={6}>
          <Btn small kind="primary" testID="day-restcancel" label={t("restBtn")} onPress={() => { s.setCal(date, { ...cal, cancel: true }); close(); s.toast(t("t_saved")); }} />
          <Btn small label={t("restKeep")} onPress={() => { s.setOver(date, { ...(E.D.over[date] || {}), keepRest: true }); close(); }} />
        </Row>
      </Sec> : tr ? <Sec color={rpeColor(c, showI ? tr.rpe : 5)}>
        <Row wrap gap={8}><T bold>{t("it_training")} · {E.kn(tr.kind)}</T>{showI ? <T v="small" bold color={rpeColor(c, tr.rpe)}>{E.intWord(tr.rpe)} · RPE {tr.rpe}</T> : null}</Row>
        <Muted small>{E.zeitOf(date)} · {tr.dauer} {t("min")} · {t("p_" + tr.platz)}</Muted>
        <T v="small">{tr.inhalt}</T>
        {sess ? <T v="small">{mods.beteiligung ? tf("day_att", { a: E.D.players.filter(p => E.attStatus(date, p.id) === "da").length }) : ""}{showI && E.sessAvg(date) != null ? " · " + tf("day_rpeAvg", { r: E.num(E.sessAvg(date)!, 1) }) : ""}</T> : null}
        {!past && showI && tr.notReady.length ? <T v="small" color={c.crit}>⚠ {tf("notReadyN", { n: tr.notReady.length })}: {tr.notReady.map(q => q.vn).join(", ")}</T> : null}
        <Row wrap gap={6}>
          {mods.planung && !past ? <Btn small testID="day-plan" label={t("day_plan")} onPress={() => { close(); router.push("/coach/plan?date=" + date); }} /> : null}
          {mods.ki && !past ? <Btn small icon="spark" testID="day-ai" label={t("ki_session")} onPress={() => open({ k: "ai", date })} /> : null}
          {sess && mods.beteiligung ? <Btn small label={t("day_attOpen")} onPress={() => { close(); router.push("/coach/einheit/" + date); }} /> : null}
          {!past && !x.match ? <Btn small testID="day-cancel" label={t("cancelTr")} onPress={() => { const o = { ...cal, cancel: true }; delete o.extra; s.setCal(date, o); saved(); }} /> : null}
        </Row>
      </Sec> : x.cancelled ? <Sec>
        <T bold>{t("it_training")} {t("cancelled")}</T>
        <Btn small testID="day-restore" label={t("restoreTr")} onPress={() => { const o = { ...cal }; delete o.cancel; s.setCal(date, Object.keys(o).length ? o : null); saved(); }} style={{ alignSelf: "flex-start" }} />
      </Sec> : null}
      {x.events.map(e => <Sec key={e.id} color={c.event}>
        <T bold>{t("it_event")}: {e.titel}</T>
        <Muted small>{e.zeit || ""}{e.ersetzt ? " · " + t("f_replace") : ""}</Muted>
        <Btn small label={t("day_editMatch")} onPress={() => open({ k: "add", date, type: "event", obj: e })} style={{ alignSelf: "flex-start" }} />
      </Sec>)}
      {x.brk ? <Sec color="#16a3a3"><T bold>{tf("vb_breakCal", { t: phaseOn(E.D, date)?.title || "" })}</T><Muted small>{t("vb_noTraining")}</Muted></Sec> : null}
      {!x.match && !tr && !x.cancelled && !x.brk && !x.events.length ? <Muted>{t("day_none")}</Muted> : null}
      {x.match || tr ? <Sec>
        <T bold>{tf("day_avail", { a: n - ab.length, n })}</T>
        {ab.length ? ab.map(p => { const a = E.absenceOn(p.id, date)!; return <T key={p.id} v="small">{E.name(p)} · <T v="small" color={c.muted}>{t("ab_" + a.typ)}{a.bis ? " " + t("until") + " " + E.de(a.bis) : ""}</T></T>; }) : <Muted small>{t("day_all")}</Muted>}
      </Sec> : null}
      <Row wrap gap={6}>
        {!x.match ? <Btn small testID="day-add-match" label={t("day_addMatch")} onPress={() => open({ k: "add", date, type: "match" })} /> : null}
        <Btn small testID="day-add-event" label={t("day_addEvent")} onPress={() => open({ k: "add", date, type: "event" })} />
        {!tr && !x.match && !x.cancelled ? <Btn small testID="day-add-training" label={t("day_addTr")} onPress={() => { const o = { ...cal, extra: true }; delete o.cancel; s.setCal(date, o); saved(); }} /> : null}
        {mods.beteiligung ? <Btn small testID="day-add-abs" label={t("day_addAbs")} onPress={() => open({ k: "abs", date })} /> : null}
        {!x.brk ? <Btn small testID="day-add-break" label={"+ " + t("cal_addBreak")} onPress={() => open({ k: "add", date, type: "pause" })} /> : null}
      </Row>
    </Col>
  );
}

// ---------- Termin anlegen / bearbeiten ----------
function AddBody({ st, close }: { st: Extract<SheetState, { k: "add" }>; close: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const edit = !!st.obj;
  const [type, setType] = useState(st.type);
  const [date, setDate] = useState(st.date);
  const m0 = type === "match" ? st.obj as Match | undefined : undefined, e0 = type === "event" ? st.obj as TeamEvent | undefined : undefined;
  const [opp, setOpp] = useState(m0?.gegner || "");
  const [zeit, setZeit] = useState(m0?.zeit || e0?.zeit || (type === "match" ? E.team.settings.anstoss : "19:00"));
  const [comp, setComp] = useState<Match["comp"]>(m0?.comp || "liga");
  const [heim, setHeim] = useState(m0 ? m0.heim : true);
  const [titel, setTitel] = useState(e0?.titel || "");
  const [etyp, setEtyp] = useState(e0?.typ || "abend");
  const [ersetzt, setErsetzt] = useState(!!e0?.ersetzt);
  const [bTitle, setBTitle] = useState(""), [bTo, setBTo] = useState<string | null>(addDays(st.date, 13)), [busy, setBusy] = useState(false);
  const d = date || st.date;
  const reg = E.regularDay(d), isTr = E.isTraining(d), cal = E.D.cal[d] || {};
  const done = () => { jumpTo(d); close(); s.toast(tf("saved_on", { d: E.wt(d) + " " + E.de(d) })); };
  const setC = (o: typeof cal) => { s.setCal(d, Object.keys(o).length ? o : null); done(); };
  const switchType = (k: typeof type) => { setType(k); if (k === "match") setZeit(E.team.settings.anstoss); if (k === "event") setZeit("19:00"); };
  return (
    <Col gap={12}>
      {!edit ? <Seg testID="add-type" value={type} onChange={switchType} options={(["training", "match", "event", "pause"] as const).map(k => ({ key: k, label: k === "pause" ? t("cal_addBreak") : t("it_" + k) }))} /> : null}
      <DateField testID="add-date" label={type === "pause" ? t("cal_breakFrom") : t("f_date")} value={date} onChange={v => v && setDate(v)} lang={E.tr.lang} />
      {type === "training" ? <Col gap={10}>
        <Muted small>{reg ? t("trInfo") + " · " + E.dayCfg(d).zeit + " · " + t("p_" + E.dayCfg(d).platz) : t("noTrInfo")}</Muted>
        <Row wrap gap={8}>
          {isTr && reg && !cal.extra ? <Btn testID="add-cancel-tr" label={t("cancelTr")} onPress={() => { const o = { ...cal, cancel: true }; delete o.extra; setC(o); }} /> : null}
          {!isTr && reg && cal.cancel ? <Btn testID="add-restore-tr" label={t("restoreTr")} onPress={() => { const o = { ...cal }; delete o.cancel; setC(o); }} /> : null}
          {!reg && !cal.extra && !E.matchOn(d) ? <Btn testID="add-extra-tr" kind="primary" label={t("extraTr")} onPress={() => { const o = { ...cal, extra: true }; delete o.cancel; setC(o); }} /> : null}
          {cal.extra ? <Btn label={t("del")} onPress={() => { const o = { ...cal }; delete o.extra; setC(o); }} /> : null}
        </Row>
      </Col> : null}
      {type === "match" ? <Col gap={10}>
        <Field testID="add-opp" label={t("f_opp")} value={opp} onChangeText={setOpp} />
        <Row wrap gap={10} align="flex-start">
          <TimeField testID="add-time" label={t("f_time")} value={zeit} onChange={setZeit} style={{ width: 120 }} />
          <Col gap={4} style={{ flex: 1, minWidth: 200 }}><T v="small" bold color={c.muted}>{t("f_comp")}</T>
            <ChoiceChips testID="add-comp" value={comp} onChange={setComp} options={(["liga", "pokal", "test"] as const).map(k => ({ key: k, label: t("comp_" + k) }))} /></Col>
        </Row>
        <Check testID="add-home" label={t("f_home")} value={heim} onChange={setHeim} />
        <Row gap={8}>
          <Btn testID="add-save-match" kind="primary" label={t("save")} onPress={() => { s.saveMatch({ id: m0?.id || tmpId(), date: d, zeit, gegner: opp.trim() || "?", heim, comp }); done(); }} />
          {m0 ? <Btn testID="add-del-match" label={t("del")} onPress={() => { s.deleteMatch(m0.id); close(); s.toast(t("t_del")); }} /> : null}
        </Row>
      </Col> : null}
      {type === "pause" ? <BreakForm from={d} to={bTo} setTo={setBTo} title={bTitle} setTitle={setBTitle} busy={busy} onSave={async () => {
        const from = d, to = bTo;
        if (!to || to < from || diff(from, to) > 182) { s.toast(t("cal_breakBad")); return; }
        setBusy(true);
        try {
          if (E.mods.vorbereitung) {
            if (E.D.phases.some(p => !(to < p.from || from > p.to))) { s.toast(t("cal_breakOverlap")); return; }
            const ph: Phase = { id: tmpId(), kind: "break", title: bTitle.trim() || t("cal_addBreak"), from, to, firstMatch: null, weeks: {}, vis: true, note: "",
              program: defaultProgram("break", from, to, E.grp, () => "pi-" + tmpId().slice(4)) };
            await s.savePhase(ph);
          } else {
            // ohne Modul „Vorbereitung & Pausen“: reguläre Trainings im Zeitraum absagen
            for (let x = from; x <= to; x = addDays(x, 1)) if (E.regularDay(x) && !E.matchOn(x)) { const o = { ...(E.D.cal[x] || {}), cancel: true }; delete o.extra; await s.setCal(x, o); }
          }
          jumpTo(from); close(); s.toast(t("cal_breakSaved"));
        } finally { setBusy(false); }
      }} /> : null}
      {type === "event" ? <Col gap={10}>
        <Field testID="add-title" label={t("f_title")} value={titel} onChangeText={setTitel} />
        <Row wrap gap={10} align="flex-start">
          <TimeField label={t("f_time")} value={zeit} onChange={setZeit} style={{ width: 120 }} />
          <Picker testID="add-etype" label={t("f_etype")} value={etyp} onChange={setEtyp} options={["abend", "foto", "meeting", "lager", "frei", "sonst"].map(k => ({ key: k, label: t("et_" + k) }))} style={{ flex: 1, minWidth: 180 }} />
        </Row>
        <Check label={t("f_replace")} value={ersetzt} onChange={setErsetzt} />
        <Row gap={8}>
          <Btn testID="add-save-event" kind="primary" label={t("save")} onPress={() => { s.saveEvent({ id: e0?.id || tmpId(), date: d, zeit, titel: titel.trim() || t("et_" + etyp), typ: etyp, ersetzt }); done(); }} />
          {e0 ? <Btn label={t("del")} onPress={() => { s.deleteEvent(e0.id); close(); s.toast(t("t_del")); }} /> : null}
        </Row>
      </Col> : null}
    </Col>
  );
}

/** Pause im Kalender: Zeitraum und Bezeichnung (mit Modul „Vorbereitung & Pausen“ inkl. Spielerprogramm). */
function BreakForm({ from, to, setTo, title, setTitle, busy, onSave }: { from: string; to: string | null; setTo: (v: string | null) => void; title: string; setTitle: (v: string) => void; busy: boolean; onSave: () => void }) {
  const E = useEngine(); const { t, tf } = E;
  const { c } = useTheme();
  const n = to && to >= from ? countTrainings(E, from, to) : 0, nm = to && to >= from ? E.D.matches.filter(m => m.date >= from && m.date <= to).length : 0;
  const ov = E.mods.vorbereitung && to && to >= from ? E.D.phases.find(p => !(to < p.from || from > p.to)) : undefined;
  return (
    <Col gap={10} testID="add-break">
      <Muted small>{t("cal_breakD")}</Muted>
      <Field testID="add-break-title" label={t("cal_breakName")} value={title} onChangeText={setTitle} placeholder={t("cal_breakPh")} maxLength={120} />
      <DateField testID="add-break-to" label={t("cal_breakTo")} value={to} onChange={setTo} lang={E.tr.lang} />
      {to && to >= from ? <Muted small>{E.de(from)} – {E.de(to)} · {tf("cal_breakN", { n })}</Muted> : null}
      {nm ? <Muted small testID="add-break-matches">{tf("cal_breakMatches", { n: nm })}</Muted> : null}
      {ov ? <Banner color={c.warn} testID="add-break-overlap">{tf("cal_breakOverlapN", { t: ov.title, a: E.de(ov.from), b: E.de(ov.to) })}</Banner> : null}
      {!E.mods.vorbereitung ? <Muted small>{t("cal_breakNoMod")}</Muted> : null}
      <Btn testID="add-save-break" kind="primary" label={t("cal_breakSave")} disabled={busy || !to || to < from || !!ov} onPress={onSave} style={{ alignSelf: "flex-start" }} />
    </Col>
  );
}
const countTrainings = (E: Engine, from: string, to: string): number => {
  let n = 0; for (let x = from; x <= to && diff(from, x) <= 182; x = addDays(x, 1)) if (E.regularDay(x) && !E.matchOn(x) && !E.D.cal[x]?.cancel) n++;
  return n;
};

// ---------- Spielplan-Import ----------
function ImportBody({ close }: { close: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [text, setText] = useState("");
  const team = E.team;
  const found = useMemo(() => text ? parseFixtures(text, team.club, team.name, team.settings.anstoss) : [], [text, team]);
  const go = () => {
    let n = 0, first: string | null = null;
    for (const f of found) { if (E.D.matches.some(m => m.date === f.date)) continue; s.saveMatch({ id: tmpId(), date: f.date, zeit: f.zeit, gegner: f.gegner, heim: f.heim, comp: f.comp }); n++; if (!first || f.date < first) first = f.date; }
    s.toast(tf("imp_done", { n })); if (first) jumpTo(first); close();
  };
  return (
    <Col gap={12}>
      <Btn testID="imp-file" label={t("imp_ics")} onPress={async () => { try { const x = await pickTextFile(); if (x) setText(x); } catch (e) { s.toast(s.errText(e)); } }} style={{ alignSelf: "flex-start" }} />
      <Field testID="imp-text" label={t("imp_paste")} value={text} onChangeText={setText} multiline />
      <Row wrap gap={8}>
        <Btn small testID="imp-sample" label={t("imp_sample")} onPress={() => setText(sampleFixtures(s.isDemo ? demoTeam(team.cls, team.depth, E.tr.lang) : team))} />
        {text ? <T v="small" bold={!!found.length} color={found.length ? c.ok : c.muted}>{found.length ? tf("imp_found", { n: found.length }) : t("imp_none")}</T> : null}
      </Row>
      {found.length ? <Col gap={0}>
        {found.slice(0, 8).map((f, i) => <ListItem key={i} title={`${E.wt(f.date)} ${E.de(f.date)} · ${f.zeit}`} sub={`${t("vs")} ${f.gegner} · ${f.heim ? t("home") : t("away")}`} />)}
        <Btn testID="imp-go" kind="primary" label={t("imp_go")} onPress={go} style={{ marginTop: 10, alignSelf: "flex-start" }} />
      </Col> : null}
      <Muted small>{t("imp_hint")}</Muted>
    </Col>
  );
}

// ---------- Abwesenheit ----------
export function AbsenceForm({ date, pid, onDone }: { date?: string; pid?: string; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const players = E.D.players;
  const [p, setP] = useState(pid || players[0]?.id || "");
  const [typ, setTyp] = useState<AbsenceType>("urlaub");
  const [von, setVon] = useState<string | null>(date || E.TODAY);
  const [bis, setBis] = useState<string | null>(null);
  const [stufe, setStufe] = useState("1");
  const [notiz, setNotiz] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const save = () => {
    if (!p || !von) { setMsg(t("au_fill")); return; }
    if (bis && bis < von) { setMsg(t("abs_order")); return; }
    s.saveAbsence({ id: tmpId(), pid: p, typ, von, bis, stufe: typ === "verletzung" ? Number(stufe) : null, notiz: notiz.trim(), by: "coach", area: typ === "verletzung" ? area : null });
    s.toast(t("t_saved")); onDone();
  };
  return (
    <Col gap={12}>
      <Picker testID="abs-player" label={t("abs_player")} value={p} onChange={setP} options={players.map(x => ({ key: x.id, label: E.name(x) }))} />
      <Picker testID="abs-type" label={t("abs_type")} value={typ} onChange={setTyp} options={ABS_TYPES.map(k => ({ key: k, label: t("ab_" + k) }))} />
      <Row wrap gap={10}>
        <DateField testID="abs-from" label={t("abs_from")} value={von} onChange={setVon} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
        <DateField testID="abs-to" label={t("abs_to")} value={bis} onChange={setBis} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
      </Row>
      {typ === "verletzung" ? <Picker testID="abs-stage" label={t("abs_stage")} value={stufe} onChange={setStufe} options={E.tl("stages").map((x, i) => ({ key: String(i + 1), label: `${i + 1} · ${x}` }))} /> : null}
      {typ === "verletzung" ? <RegionPicker value={area} onChange={setArea} testID="abs-region" /> : null}
      <Field testID="abs-note" label={t("abs_note")} value={notiz} onChangeText={setNotiz} />
      {msg ? <Muted>{msg}</Muted> : null}
      <Btn testID="abs-save" kind="primary" label={t("save")} onPress={save} style={{ alignSelf: "flex-start" }} />
    </Col>
  );
}

// ---------- KI: Einheit ausarbeiten ----------
function AiBody({ date }: { date: string }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const ai = useAi();
  const [started, setStarted] = useState(false);
  const x = E.weekPlan(monday(date)).items.find(i => i.date === date), tr = x?.train;
  const run = () => { setStarted(true); ai.run("session", E.aiSessionPrompt(date), E.aiContext(pid => s.aiPlayers.includes(pid))); };
  useEffect(() => { if (!started && tr) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Col gap={10}>
      <Muted>{E.wt(date)} {E.de(date)}{tr ? ` · ${tr.md || ""} · ${E.kn(tr.kind)} · ${tr.dauer} ${t("min")}` : ""}</Muted>
      {ai.busy ? <Row gap={8}><ActivityIndicator color={c.accent} /><Muted>{t("ki_think")}</Muted><Btn small label={t("ki_stop")} onPress={ai.stop} /></Row> : null}
      {ai.err ? <Banner color={c.warn}>{ai.err}</Banner> : null}
      {ai.text ? <Markdown testID="ai-session-out" text={ai.text} /> : null}
      {!ai.busy && (ai.err || ai.text) ? <Btn small label={t("retry")} onPress={run} style={{ alignSelf: "flex-start" }} /> : null}
    </Col>
  );
}

/** Steuert die Blätter eines Bildschirms. `el` in den Bildschirm einsetzen, `open(...)` zum Öffnen. */
export function usePlanSheets() {
  const s = useStore();
  const [st, setSt] = useState<SheetState | null>(null);
  const close = () => setSt(null);
  const { t } = s.tr;
  const title = !st ? "" : st.k === "day" ? "" : st.k === "add" ? (st.obj ? t("edit_title") : t("add_title")) : st.k === "import" ? t("imp_title") : st.k === "abs" ? t("abs_add").replace("+ ", "") : t("ki_sessTitle");
  const key = st ? JSON.stringify({ ...st, obj: st.k === "add" ? st.obj?.id : undefined }) : "none";
  const el = (
    <Sheet visible={!!st} onClose={close} title={title || undefined} testID={"sheet-" + (st?.k || "none")} closeLabel={t("cancel")}>
      {st?.k === "day" ? <View style={{ alignItems: "flex-end", marginBottom: -8 }}><Btn small kind="ghost" icon="close" label="" a11y={t("cancel")} testID="sheet-day-close" onPress={close} /></View> : null}
      {st?.k === "day" ? <DayBody key={key} date={st.date} open={setSt} close={close} /> : null}
      {st?.k === "add" ? <AddBody key={key} st={st} close={close} /> : null}
      {st?.k === "import" ? <ImportBody key={key} close={close} /> : null}
      {st?.k === "abs" ? <AbsenceForm key={key} date={st.date} pid={st.pid} onDone={close} /> : null}
      {st?.k === "ai" ? <AiBody key={key} date={st.date} /> : null}
    </Sheet>
  );
  return { open: setSt, close, el };
}

