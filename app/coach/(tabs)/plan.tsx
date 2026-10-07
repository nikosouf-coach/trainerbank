// Trainer – Planung: Wochenplan aus Spieltags-Prinzipien, Wochentyp (Aufbau/Entlastung), Tage anpassen, KI-Einheit, Wochenbilanz.
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { addDays, kwOf, monday } from "../../../src/core/dates";
import type { Change, PlanItem, PlanTrain } from "../../../src/core/engine";
import { CONTENT } from "../../../src/core/content";
import type { Kind, WeekMode } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { TemplatePicker, templateMin, templateRpe, templateText } from "../../../src/ui/archive";
import { Dist } from "../../../src/ui/charts";
import { KindEditor, type KindEditorTarget } from "../../../src/ui/kindEditor";
import { Banner, Btn, Card, CardTitle, Chip, Col, Field, Header, Info, Muted, NumField, NumScale, Picker, Row, Screen, Seg, T, Tag } from "../../../src/ui/kit";
import { CalNav } from "../../../src/ui/plan/CalNav";
import { setCal, useCal } from "../../../src/ui/plan/calState";
import { Sec, usePlanSheets } from "../../../src/ui/plan/sheets";
import { radius, rpeColor, statusColor, useTheme, withAlpha } from "../../../src/ui/theme";

interface Draft { kind: Kind; rpe: number; dauer: number; inhalt: string; touched: boolean }
const chgTxt = (c: Change, arrow: string): string => c.from === "" ? `${c.what}: ${c.to}` : `${c.what} ${c.from}${arrow}${c.to}`;

export default function Plan() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const cal = useCal(); const sheets = usePlanSheets();
  const params = useLocalSearchParams<{ date: string }>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [kindTarget, setKindTarget] = useState<KindEditorTarget | null>(null);
  const [openNR, setOpenNR] = useState<Record<string, boolean>>({});
  const [pickFor, setPickFor] = useState<string | null>(null);
  const kids = E.grp === "u11", show = E.lvl(1) && !kids, pro = E.lvl(2) && !kids;

  const wp = useMemo(() => E.weekPlan(cal.week), [s.version, cal.week, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const startEdit = (d: string, p: PlanTrain) => setDrafts(x => ({ ...x, [d]: { kind: p.kind, rpe: p.rpe, dauer: p.dauer, inhalt: p.inhalt, touched: false } }));

  // Aus der Tagesansicht: ?date=… → Woche öffnen und Tag bearbeiten
  useEffect(() => {
    const d = params.date; if (!d) return;
    setCal({ week: monday(d) });
    const it = E.weekPlan(monday(d)).items.find(i => i.date === d);
    if (it?.train && it.train.kind !== "frei") startEdit(d, it.train);
  }, [params.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const tr = wp.tr, chronic = E.teamChronic(), total = wp.trainAU + wp.matchAU, ratio = chronic ? total / chronic : null;
  const vk = ratio == null ? "none" : ratio > 1.5 ? "crit" : ratio > 1.3 ? "warn" : ratio >= 0.8 ? "ok" : "low";
  const act = tr.filter(p => p.rpe > 0), hard = act.filter(p => p.rpe >= 7).length, mid = act.filter(p => p.rpe >= 5 && p.rpe < 7).length, easy = act.filter(p => p.rpe < 5).length;
  const delta = wp.baseAU ? wp.trainAU / wp.baseAU - 1 : 0, pct = (delta >= 0 ? "+" : "") + Math.round(delta * 100) + " %";
  const changes = tr.filter(p => p.changes.length);
  const modeText: string[] = []; let modeShort = "";
  if (wp.mode === "aufbau") {
    if (wp.limit) {
      if (wp.limit.congested) modeText.push(t("lim_cong"));
      else { modeText.push(tf(wp.limit.blocked?.length ? "lim_rec" : "lim_max", { pct, days: (wp.limit.blocked || []).map(d => E.wt(d) + " " + (E.mdOf(d).md || "")).join(", ") })); modeText.push(t(E.team.settings.fix ? "lim_fix" : "lim_more")); }
      modeShort = wp.limit.congested ? t("lim_cong_s") : tf("lim_short", { pct });
    }
    modeText.push(t("au_comp"));
  }
  if (wp.mode === "entlastung") { modeText.push(t("deload")); modeShort = t("deload_s"); }

  const saveDraft = (d: string) => {
    const dr = drafts[d]; if (!dr) return;
    const o = { ...(E.D.over[d] || {}), kind: dr.kind, rpe: dr.rpe, dauer: dr.dauer };
    if (dr.touched) o.inhalt = dr.inhalt; else delete o.inhalt;
    s.setOver(d, o); setDrafts(x => { const n = { ...x }; delete n[d]; return n; }); s.toast(t("t_saved"));
  };
  const resetDay = (d: string) => { s.setOver(d, null); setDrafts(x => { const n = { ...x }; delete n[d]; return n; }); };
  const kindOpts = [...E.allKinds().filter(k => k !== "frei").map(k => ({ key: k as string, label: E.kn(k) })), { key: "__new", label: t("kind_newOpt") }];

  const why = (p: PlanTrain): string[] => [E.whyOf(p), ...(p.notes.length ? [[...new Set(p.notes)].map(k => t(k)).join(" ")] : [])];

  const dayCard = (x: PlanItem) => {
    const head = (extra?: React.ReactNode) => <Row wrap gap={8}><T bold>{E.wt(x.date)} {E.de(x.date)}</T>{x.md ? <Tag label={x.md} /> : null}{extra}</Row>;
    if (x.match) return (
      <Sec key={x.date} color={c.accentTx} testID={"plan-day-" + x.date}>
        {head(<Chip label={t("it_match")} color={c.accentTx} />)}
        <T v="small">{x.match.zeit} · {t("vs")} {x.match.gegner} · {x.match.heim ? t("home") : t("away")} · {t("comp_" + x.match.comp)}</T>
        {pro ? <Muted small>{tf("matchLoad", { m: E.matchMin(), r: E.matchRpe() })}: {E.int(E.matchLoad())} AU</Muted> : null}
      </Sec>
    );
    if (!x.train) return (
      <View key={x.date} testID={"plan-day-" + x.date} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
        <Muted small><Text style={{ color: c.ink, fontWeight: "700" }}>{E.wt(x.date)} {E.de(x.date)}</Text>{x.md ? ` · ${x.md}` : ""} · {x.cancelled ? t("it_training") + " " + t("cancelled") : t("noTraining")}{x.events.length ? " · " + x.events.map(e => e.titel).join(", ") : ""}</Muted>
      </View>
    );
    const p = x.train, dr = drafts[x.date];
    if (p.kind === "frei") return (
      <Sec key={x.date} color={c.ok} testID={"plan-day-" + x.date}>
        {head(<><T bold color={c.ok}>{t("k_frei")}</T>{E.lvl(1) ? <Info title={t("ib_why")} text={t("w_frei")} /> : null}</>)}
        <T v="small">{tf("restRec", { md: p.md })} {CONTENT.frei[E.tr.lang]}</T>
        <Row wrap gap={6}>
          <Btn small kind="primary" testID={"plan-restcancel-" + x.date} label={t("restBtn")} onPress={() => { s.setCal(x.date, { ...(E.D.cal[x.date] || {}), cancel: true }); s.toast(t("t_saved")); }} />
          <Btn small testID={"plan-restkeep-" + x.date} label={t("restKeep")} onPress={() => s.setOver(x.date, { ...(E.D.over[x.date] || {}), keepRest: true })} />
        </Row>
      </Sec>
    );
    const ab = E.absentOn(x.date).length;
    return (
      <Sec key={x.date} color={rpeColor(c, show ? p.rpe : 5)} testID={"plan-day-" + x.date}>
        {head(<>
          <T bold>{E.kn(p.kind)}</T>
          {show ? <View style={{ backgroundColor: withAlpha(rpeColor(c, p.rpe), 0.15), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: rpeColor(c, p.rpe), fontWeight: "800", fontSize: 12 }}>{E.intWord(p.rpe)} · RPE {p.rpe}</Text></View> : null}
          {p.adjusted || p.coach ? <Tag label={t("adjusted")} /> : null}
          {show && p.changes.length && wp.mode !== "normal" ? <Muted small>{p.changes.map(ch => ch.short || chgTxt(ch, "→")).join(" · ")}</Muted> : null}
          {E.lvl(1) ? <Info title={`${t("ib_why")} · ${E.wt(x.date)} ${E.de(x.date)}`} text={why(p)} testID={"plan-why-" + x.date} /> : null}
        </>)}
        {!dr ? <T v="small">{p.inhalt}</T> : null}
        <Muted small>{E.zeitOf(x.date)} · {p.dauer} {t("min")} · {t("p_" + p.platz)}{pro ? ` · ${E.int(p.dauer * p.rpe)} AU` : ""}{x.events.length ? " · " + x.events.map(e => e.titel).join(", ") : ""}{ab ? ` · ${ab} ${t("absent")}` : ""}</Muted>
        {p.notReady.length && show ? <Col gap={4}>
          <Btn small kind="ghost" testID={"plan-nr-" + x.date} label={"⚠ " + tf("notReadyN", { n: p.notReady.length }) + (openNR[x.date] ? " ▴" : " ▾")} onPress={() => setOpenNR(o => ({ ...o, [x.date]: !o[x.date] }))} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
          {openNR[x.date] ? <T v="small" color={c.crit}>{p.notReady.map(q => `${E.name(q)} (${E.age(q)})`).join(", ")}</T> : null}
        </Col> : null}
        {dr ? <Col gap={10} testID={"plan-edit-" + x.date}>
          <Picker testID={"plan-kind-" + x.date} label={t("f_kind")} value={dr.kind as string} options={kindOpts}
            onChange={k => { if (k === "__new") { setKindTarget({ kind: null, date: x.date }); return; } setDrafts(o => ({ ...o, [x.date]: { ...dr, kind: k as Kind, rpe: Math.min(E.CAP, E.kindRpe(k as Kind)), inhalt: "", touched: false } })); }} />
          <Field testID={"plan-inhalt-" + x.date} label={t("content")} value={dr.touched || dr.kind === p.kind ? dr.inhalt : ""} placeholder={E.kn(dr.kind)} multiline
            onChangeText={v => setDrafts(o => ({ ...o, [x.date]: { ...dr, inhalt: v, touched: true } }))} />
          <Row wrap gap={10} align="flex-end">
            <NumField testID={"plan-dauer-" + x.date} label={t("minutes")} value={dr.dauer} min={0} max={180} onChange={v => setDrafts(o => ({ ...o, [x.date]: { ...dr, dauer: v ?? dr.dauer } }))} style={{ width: 110 }} />
          </Row>
          {show ? <Col gap={6}><T v="small" bold color={c.muted}>{t("target")}: {dr.rpe} · {E.intWord(dr.rpe)}</T>
            <NumScale testID={"plan-rpe-" + x.date} value={dr.rpe} min={1} max={E.CAP} onChange={v => setDrafts(o => ({ ...o, [x.date]: { ...dr, rpe: v } }))} color={n => rpeColor(c, n)} /></Col> : null}
          {E.mods.archiv ? <Row gap={8} wrap>
            <Btn small icon="plus" testID={"plan-fromarchive-" + x.date} label={t("tp_fromArchive")} onPress={() => setPickFor(x.date)} />
            <Btn small testID={"plan-saveas-" + x.date} label={t("tp_saveAs")} onPress={() => s.saveTemplate({ id: tmpId(), title: `${E.kn(dr.kind)} ${x.md || ""}`.trim(), theme: E.kn(dr.kind), blocks: [{ exId: null, text: dr.touched || dr.kind === p.kind ? dr.inhalt : p.inhalt, min: dr.dauer }], notes: "" }).then(() => s.toast(t("tp_saved")))} />
          </Row> : null}
          <Row gap={8} wrap>
            <Btn small testID={"plan-reset-" + x.date} label={t("reset")} onPress={() => resetDay(x.date)} />
            <Btn small label={t("cancel")} onPress={() => setDrafts(o => { const n = { ...o }; delete n[x.date]; return n; })} />
            <Btn small kind="primary" testID={"plan-done-" + x.date} label={t("done")} onPress={() => saveDraft(x.date)} />
          </Row>
        </Col> : <Row wrap gap={6}>
          <Btn small testID={"plan-adjust-" + x.date} label={t("adjust")} onPress={() => startEdit(x.date, p)} />
          {E.mods.ki ? <Btn small icon="spark" testID={"plan-ai-" + x.date} label={t("ki_session")} onPress={() => sheets.open({ k: "ai", date: x.date })} /> : null}
        </Row>}
      </Sec>
    );
  };

  const ws = cal.week, we = addDays(ws, 6), vcol = statusColor(c, vk === "none" ? "build" : vk);
  return (
    <Screen testID="coach-plan">
      <Header eyebrow={t("pl_sub")} title={t("nav_plan")} info={E.lvl(1) ? <Info title={t("ib_plan")} text={["m1", "m2", "m3", "m4"].map(k => t(k))} testID="plan-method" /> : undefined} />
      <CalNav label={`${t("kw")} ${kwOf(ws)} · ${E.de(ws)}–${E.de(we)}`} todayLabel={t("thisW")}
        onPrev={() => setCal({ week: addDays(ws, -7) })} onNext={() => setCal({ week: addDays(ws, 7) })} onToday={() => setCal({ week: monday(E.TODAY) })} />
      {show ? <Row wrap gap={10}>
        <Seg testID="plan-mode" value={wp.mode} onChange={(m: WeekMode) => s.setWeekMode(ws, m)}
          options={[{ key: "normal", label: t("wk_normal") }, { key: "aufbau", label: t("wk_aufbau") }, { key: "entlastung", label: t("wk_entl") }]} />
        <Chip label={`${t("trainLoad")}: ${E.int(wp.trainAU)} AU${wp.mode !== "normal" ? ` · ${pct} ${t("vsNormal")}` : ""}`} color={c.accentTx} />
      </Row> : null}
      {show && wp.mode !== "normal" ? <Card testID="plan-changes">
        <CardTitle title={t("chTitle")} info={modeText.length ? <Info title={`${t("ib_mode")}: ${t(wp.mode === "aufbau" ? "wk_aufbau" : "wk_entl")}`} text={modeText} /> : undefined} />
        {changes.length ? changes.map(p => <Col key={p.date} gap={2}><T v="small" bold>{E.wt(p.date)} {E.de(p.date)} · {p.md} {E.kn(p.kind)}</T><Muted small>{p.changes.map(ch => chgTxt(ch, " → ")).join(" · ")}</Muted></Col>) : <Muted>{t("chNone")}</Muted>}
        {modeShort ? <Muted small>{modeShort}</Muted> : null}
      </Card> : null}
      <Col gap={10}>{wp.items.map(dayCard)}</Col>
      {show ? <Card testID="plan-summary">
        {pro ? <Col gap={6}>
          <Row between><T v="h3" style={{ flexShrink: 1 }}>{t("weekTotal")}</T><T bold style={{ fontSize: 22, fontVariant: ["tabular-nums"] }}>{E.int(total)} AU</T></Row>
          <Row between><Muted>{t("usual")}</Muted><T bold>{chronic ? E.int(chronic) + " AU" : "–"}</T></Row>
          <Row between><Muted>{t("ratio")}</Muted><T bold>{ratio ? E.num(ratio, 2) : "–"}</T></Row>
        </Col> : null}
        <Row gap={8}>
          <View style={{ flex: 1, backgroundColor: withAlpha(vcol, 0.12), borderLeftWidth: 4, borderLeftColor: vcol, borderRadius: 8, padding: 10 }}><Text style={{ fontWeight: "800", color: c.ink }}>{t("v_" + vk)}</Text></View>
          <Info title={t("ib_week")} text={t("ib_week_t")} />
        </Row>
        {!hard && act.length >= 3 && wp.mode !== "entlastung" && wp.items.filter(x => x.match).length < 2 ? <Banner color={c.warn}>{t("no_hard")}</Banner> : null}
        <Col gap={6}>
          <T v="eyebrow">{t("dist")}</T>
          <Dist hard={hard} mid={mid} easy={easy} />
          <Row wrap gap={14}>
            <Muted small><Text style={{ color: c.crit }}>●</Text> {hard} {t("d_hard")}</Muted>
            <Muted small><Text style={{ color: c.warn }}>●</Text> {mid} {t("d_mid")}</Muted>
            <Muted small><Text style={{ color: c.ok }}>●</Text> {easy} {t("d_easy")}</Muted>
          </Row>
        </Col>
      </Card> : null}
      <TemplatePicker visible={!!pickFor} onClose={() => setPickFor(null)} onPick={tp => {
        const d = pickFor!; const dr = drafts[d]; if (!dr) return;
        setDrafts(o => ({ ...o, [d]: { ...dr, inhalt: tp.title + "\n" + templateText(E, tp), dauer: templateMin(tp), touched: true } }));
        // Sportwissenschaftlicher Hinweis: Vorlage deutlich intensiver als für diesen Tag vorgesehen (z. B. MD-2-Einheit am MD+1).
        const r = templateRpe(E, tp); if (r != null && r > dr.rpe + 1) s.toast(tf("tp_rpeWarn", { t: r, p: dr.rpe }));
      }} />
      <KindEditor target={kindTarget} onClose={saved => {
        const tg = kindTarget; setKindTarget(null);
        if (saved && tg?.date) setDrafts(o => { const n = { ...o }; delete n[tg.date!]; return n; });
      }} />
      {sheets.el}
    </Screen>
  );
}
