// Matchplan: Spielidee, Gegneranalyse, Spieleraufgaben, Wechselplan (mit geplanten Minuten), Freigabe und
// Zugriffsprotokoll. Bearbeiten im Trainerteam; die Ansichten für Spieler stehen in viewer.tsx.
import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  DEFAULT_SECTIONS, MP_LIMITS, MP_SECTIONS, changedSincePublish, defaultUntil, formationsOf, kickoff, newSub, onPitch, oppLineup, plannedMinutes, seenStats, shareState, squadOf,
} from "../../core/matchplan";
import { iso } from "../../core/dates";
import type { MatchPlan, MpContent, MpSection, MpShare, MpSub } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Banner, Btn, Card, CardTitle, Check, Chip, Col, DateField, Field, Info, ListItem, Muted, NumField, Picker, Row, T, TimeField, ToggleRow } from "../kit";
import { PlayerAvatar } from "../playerAvatar";
import { radius, useTheme, withAlpha } from "../theme";
import { useTokenInfo } from "./common";
import { SlideBoard } from "./slides";

// ---------- Spielidee ----------
export function IdeaEditor({ c, onChange, ro }: { c: MpContent; onChange: (c: MpContent) => void; ro?: boolean }) {
  const E = useEngine(); const { t, tf } = E;
  const idea = c.idea, set = (p: Partial<MpContent["idea"]>) => onChange({ ...c, idea: { ...idea, ...p } });
  const keys = [...idea.keys, ...Array(Math.max(0, MP_LIMITS.keys - idea.keys.length)).fill("")].slice(0, MP_LIMITS.keys);
  return (
    <Col gap={14}>
      <Card testID="mp-idea">
        <CardTitle title={t("mp_idea")} info={<Info title={t("mp_idea")} text={[t("mp_ideaInfo"), t("mp_keysInfo")]} />} />
        <Field testID="mp-motto" label={t("mp_motto")} value={idea.motto} onChangeText={v => set({ motto: v.slice(0, 120) })} maxLength={120} placeholder={t("mp_mottoPh")} />
        <Col gap={8}>
          <T v="small" bold>{tf("mp_keys", { n: MP_LIMITS.keys })}</T>
          {keys.map((k, i) => <Field key={i} testID={"mp-key-" + i} label={`${i + 1}.`} value={k} maxLength={120} placeholder={i === 0 ? t("mp_keyPh") : ""}
            onChangeText={v => { const L = [...keys]; L[i] = v.slice(0, 120); set({ keys: L }); }} />)}
          <Muted small>{t("mp_keysHint")}</Muted>
        </Col>
      </Card>
      <Card>
        <Field testID="mp-ball" label={t("mp_ball")} value={idea.ball} onChangeText={v => set({ ball: v })} multiline maxLength={MP_LIMITS.text} placeholder={t("mp_ballPh")} />
        <Field testID="mp-gegen" label={t("mp_gegen")} value={idea.gegen} onChangeText={v => set({ gegen: v })} multiline maxLength={MP_LIMITS.text} placeholder={t("mp_gegenPh")} />
        <Field testID="mp-umschalt" label={t("mp_umschalt")} value={idea.umschalt} onChangeText={v => set({ umschalt: v })} multiline maxLength={MP_LIMITS.text} placeholder={t("mp_umschaltPh")} />
      </Card>
      {ro ? <Muted small>{t("mp_ro")}</Muted> : null}
    </Col>
  );
}

// ---------- Gegneranalyse ----------
export function OppEditor({ c, onChange, ro }: { c: MpContent; onChange: (c: MpContent) => void; ro?: boolean }) {
  const E = useEngine(); const { t } = E;
  const o = c.opp, set = (p: Partial<MpContent["opp"]>) => onChange({ ...c, opp: { ...o, ...p } });
  return (
    <Col gap={14}>
      <Card testID="mp-opp">
        <CardTitle title={t("mp_opp")} info={<Info title={t("mp_opp")} text={t("mp_oppInfo")} />} />
        <Picker testID="mp-opp-formation" label={t("mp_oppFormation")} value={o.formation || ""} onChange={k => set({ formation: k || null, items: k ? oppLineup(c.fmt, k) : [] })}
          options={[{ key: "", label: t("mp_oppNone") }, ...formationsOf(c.fmt).map(k => ({ key: k, label: k }))]} style={{ maxWidth: 260 }} />
        {o.formation ? <>
          <SlideBoard slide={{ id: "opp", cat: "grund", title: "", view: "full", items: o.items, note: "", vis: true }} c={{ ...c, lineup: [] }} only={["move"]}
            onChange={x => set({ items: x.items.filter(i => i.t === "opp") })} ro={ro} testID="mp-oppboard" />
          <Muted small>{t("mp_oppBoardHint")}</Muted>
        </> : null}
      </Card>
      <Card>
        <Field testID="mp-opp-style" label={t("mp_oppStyle")} value={o.style} onChangeText={v => set({ style: v })} multiline maxLength={MP_LIMITS.text} placeholder={t("mp_oppStylePh")} />
        <Field testID="mp-opp-strong" label={t("mp_oppStrong")} value={o.strong} onChangeText={v => set({ strong: v })} multiline maxLength={MP_LIMITS.text} />
        <Field testID="mp-opp-weak" label={t("mp_oppWeak")} value={o.weak} onChangeText={v => set({ weak: v })} multiline maxLength={MP_LIMITS.text} />
        <Field testID="mp-opp-plan" label={t("mp_oppPlan")} value={o.plan} onChangeText={v => set({ plan: v })} multiline maxLength={MP_LIMITS.text} placeholder={t("mp_oppPlanPh")} />
      </Card>
      <Card testID="mp-opp-keys">
        <CardTitle title={t("mp_oppKeys")} right={!ro && o.keys.length < MP_LIMITS.oppKeys ? <Btn small icon="plus" testID="mp-opp-key-add" label={t("mp_add")} onPress={() => set({ keys: [...o.keys, { n: null, name: "", note: "" }] })} /> : null} />
        {!o.keys.length ? <Muted small>{t("mp_oppKeysNone")}</Muted> : null}
        {o.keys.map((k, i) => (
          <Col key={i} gap={6} style={{ paddingTop: 8, borderTopWidth: i ? 1 : 0, borderTopColor: "rgba(128,128,128,0.25)" }}>
            <Row gap={8} align="flex-end" wrap>
              <NumField testID={"mp-opp-key-n-" + i} label={t("mp_oppNr")} value={k.n} min={0} max={99} onChange={n => set({ keys: o.keys.map((x, j) => j === i ? { ...x, n } : x) })} style={{ width: 90 }} />
              <Field testID={"mp-opp-key-name-" + i} label={t("mp_oppKeyName")} value={k.name} maxLength={40} onChangeText={v => set({ keys: o.keys.map((x, j) => j === i ? { ...x, name: v } : x) })} style={{ flex: 1, minWidth: 140 }} />
              {!ro ? <Btn small kind="ghost" icon="trash" label="" a11y={t("mp_del")} testID={"mp-opp-key-del-" + i} onPress={() => set({ keys: o.keys.filter((_, j) => j !== i) })} /> : null}
            </Row>
            <Field testID={"mp-opp-key-note-" + i} label={t("mp_oppKeyNote")} value={k.note} maxLength={200} onChangeText={v => set({ keys: o.keys.map((x, j) => j === i ? { ...x, note: v } : x) })} />
          </Col>
        ))}
      </Card>
    </Col>
  );
}

// ---------- Spieleraufgaben ----------
export function TasksEditor({ c, onChange, ro }: { c: MpContent; onChange: (c: MpContent) => void; ro?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const info = useTokenInfo();
  const L = squadOf(c), pos = (pid: string) => c.lineup.find(x => x.pid === pid)?.label || "";
  const n = Object.values(c.tasks).filter(x => x.trim()).length;
  return (
    <Col gap={14}>
      <Card testID="mp-tasks">
        <CardTitle title={t("mp_tasks")} right={<Muted small>{tf("mp_tasksN", { n, m: L.length })}</Muted>} info={<Info title={t("mp_tasks")} text={[t("mp_tasksInfo"), t("mp_tasksPsy")]} />} />
        {!L.length ? <Muted>{t("mp_tasksNoSquad")}</Muted> : null}
        {L.map(pid => {
          const inf = info(pid); if (!inf?.p) return null;
          return (
            <Row key={pid} gap={10} align="flex-start" style={{ paddingVertical: 6 }}>
              <PlayerAvatar p={inf.p} size={34} />
              <Col gap={4} style={{ flex: 1 }}>
                <T v="small" bold>{inf.nr != null ? inf.nr + " · " : ""}{E.name(inf.p)}{pos(pid) ? " · " + E.t("mps_" + pos(pid)) : c.bench.includes(pid) ? " · " + t("mp_benchShort") : ""}</T>
                <Field testID={"mp-task-" + pid} label="" value={c.tasks[pid] || ""} maxLength={MP_LIMITS.task} placeholder={t("mp_taskPh")}
                  onChangeText={v => onChange({ ...c, tasks: { ...c.tasks, [pid]: v.slice(0, MP_LIMITS.task) } })} />
              </Col>
            </Row>
          );
        })}
      </Card>
      {ro ? <Muted small>{t("mp_ro")}</Muted> : null}
    </Col>
  );
}

// ---------- Wechselplan ----------
export function SubsEditor({ c, onChange, ro }: { c: MpContent; onChange: (c: MpContent) => void; ro?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const info = useTokenInfo(); const { c: col } = useTheme();
  const total = E.matchMin();
  const { min, issues } = useMemo(() => plannedMinutes(c, total), [c, total]);
  const L = squadOf(c), name = (pid: string | null) => { const i = pid ? info(pid) : null; return i?.p ? (i.nr != null ? i.nr + " " : "") + i.label : "–"; };
  const setSub = (id: string, p: Partial<MpSub>) => onChange({ ...c, subs: c.subs.map(x => x.id === id ? { ...x, ...p } : x) });
  const sorted = [...c.subs].sort((a, b) => a.min - b.min);
  const pitch = onPitch(c);
  const kids = E.grp === "u11" || E.grp === "u15";
  const vals = L.map(pid => min[pid] || 0), lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 0;
  return (
    <Col gap={14}>
      <Card testID="mp-subs">
        <CardTitle title={t("mp_subs")} info={<Info title={t("mp_subs")} text={[t("mp_subsInfo"), t("mp_subsIntern")]} />}
          right={!ro && c.subs.length < MP_LIMITS.subs ? <Btn small icon="plus" testID="mp-sub-add" label={t("mp_add")} onPress={() => onChange({ ...c, subs: [...c.subs, newSub(Math.round(total * 2 / 3))] })} /> : null} />
        {!c.subs.length ? <Muted small>{t("mp_subsNone")}</Muted> : null}
        {sorted.map(sb => {
          const iss = issues.filter(x => x.id === sb.id);
          return (
            <Col key={sb.id} gap={6} testID={"mp-sub-" + sb.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: col.line }}>
              <Row gap={8} align="flex-end" wrap>
                <NumField testID={"mp-sub-min-" + sb.id} label={t("mp_subMin")} value={sb.min} min={0} max={150} onChange={n => setSub(sb.id, { min: n ?? 0 })} style={{ width: 80 }} />
                <Picker testID={"mp-sub-out-" + sb.id} label={t("mp_subOut")} value={sb.out || ""} onChange={k => setSub(sb.id, { out: k || null })} options={[{ key: "", label: "–" }, ...L.map(pid => ({ key: pid, label: name(pid) + (pitch.includes(pid) ? "" : " ·") }))]} style={{ flex: 1, minWidth: 130 }} />
                <Picker testID={"mp-sub-in-" + sb.id} label={t("mp_subIn")} value={sb.in || ""} onChange={k => setSub(sb.id, { in: k || null })} options={[{ key: "", label: "–" }, ...L.map(pid => ({ key: pid, label: name(pid) }))]} style={{ flex: 1, minWidth: 130 }} />
                {!ro ? <Btn small kind="ghost" icon="trash" label="" a11y={t("mp_del")} testID={"mp-sub-del-" + sb.id} onPress={() => onChange({ ...c, subs: c.subs.filter(x => x.id !== sb.id) })} /> : null}
              </Row>
              <Field testID={"mp-sub-note-" + sb.id} label="" value={sb.note} maxLength={120} placeholder={t("mp_subNotePh")} onChangeText={v => setSub(sb.id, { note: v })} />
              {iss.map(x => <Text key={x.k} style={{ color: col.crit, fontSize: 12.5, fontWeight: "700" }}>⚠ {t("mp_iss_" + x.k)}</Text>)}
            </Col>
          );
        })}
        <Field testID="mp-subs-note" label={t("mp_subsNote")} value={c.subsNote} maxLength={600} multiline onChangeText={v => onChange({ ...c, subsNote: v })} placeholder={t("mp_subsNotePh")} />
      </Card>
      <Card testID="mp-minutes">
        <CardTitle title={tf("mp_minutes", { n: total })} info={<Info title={t("mp_minutesT")} text={kids ? [t("mp_minutesInfo"), t("mp_fairInfo")] : t("mp_minutesInfo")} />} />
        {kids && L.length ? <Banner color={hi - lo > total / 2 ? col.warn : col.ok} testID="mp-fair">{tf("mp_fair", { lo, hi })}</Banner> : null}
        {[...L].sort((a, b) => (min[b] || 0) - (min[a] || 0)).map(pid => {
          const m = min[pid] || 0, inf = info(pid); if (!inf?.p) return null;
          return (
            <Row key={pid} gap={8} testID={"mp-min-" + pid}>
              <Text numberOfLines={1} style={{ width: 120, fontSize: 13, fontWeight: "600", color: col.ink }}>{name(pid)}</Text>
              <View style={{ flex: 1, height: 10, borderRadius: 99, backgroundColor: col.sunk, overflow: "hidden" }}>
                <View style={{ width: `${Math.min(100, (m / total) * 100)}%`, height: "100%", backgroundColor: col.accent, borderRadius: 99 }} />
              </View>
              <Text style={{ width: 40, textAlign: "right", fontSize: 13, fontWeight: "800", color: col.ink, fontVariant: ["tabular-nums"] }}>{m}′</Text>
            </Row>
          );
        })}
      </Card>
    </Col>
  );
}

// ---------- Freigabe ----------
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (d: Date) => pad(d.getHours()) + ":" + pad(d.getMinutes());
const at = (date: string, time: string): Date => { const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number); return new Date(y, m - 1, d, h || 0, mi || 0); };

export function SharePanel({ plan, onBefore }: { plan: MatchPlan; onBefore?: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme();
  const m = plan.matchId ? E.D.matches.find(x => x.id === plan.matchId) || null : null;
  const now = new Date(), st = shareState(plan, now), changed = changedSincePublish(plan);
  const cur: MpShare = plan.share || { sections: DEFAULT_SECTIONS, from: null, until: defaultUntil(m, E.matchMin(), now), squadOnly: false, ownTasks: true };
  const [sections, setSections] = useState<MpSection[]>(cur.sections);
  const untilD = new Date(st === "ended" ? defaultUntil(m, E.matchMin(), now) : cur.until);
  const [uDate, setUDate] = useState<string | null>(iso(untilD)); const [uTime, setUTime] = useState(hhmm(untilD));
  const [later, setLater] = useState(!!cur.from && new Date(cur.from) > now);
  const fromD = cur.from ? new Date(cur.from) : m ? new Date(kickoff(m).getTime() - 24 * 3600e3) : now;
  const [fDate, setFDate] = useState<string | null>(iso(fromD)); const [fTime, setFTime] = useState(hhmm(fromD));
  const [squadOnly, setSquadOnly] = useState(cur.squadOnly); const [ownTasks, setOwnTasks] = useState(cur.ownTasks);
  const [announce, setAnnounce] = useState(!plan.published && E.mods.chat !== false);
  const [busy, setBusy] = useState(false);
  const can = s.can("plan");
  const until = uDate ? at(uDate, uTime) : null, from = later && fDate ? at(fDate, fTime) : null;
  const err = !sections.length ? t("mp_shareNoSec") : !until || until <= now ? t("mp_shareUntilPast") : from && from >= until ? t("mp_shareFromAfter") : "";
  const visSlides = plan.c.slides.filter(x => x.vis).length;
  const go = async () => {
    onBefore?.();
    setBusy(true);
    try {
      const ok = await s.sharePlan(plan, { sections, from: from ? from.toISOString() : null, until: until!.toISOString(), squadOnly, ownTasks });
      if (ok && announce && E.mods.chat !== false) {
        const id = await s.chatOpen("team");
        if (id) await s.chatSend(id, tf("mp_chatMsg", { t: plan.title, d: until ? `${E.wt(iso(until))} ${E.de(iso(until))} ${hhmm(until)}` : "" }));
        setAnnounce(false);
      }
    } finally { setBusy(false); }
  };
  const stLabel = st === "live" ? tf("mp_st_liveAt", { d: `${E.wt(iso(new Date(cur.until)))} ${E.de(iso(new Date(cur.until)))} ${hhmm(new Date(cur.until))}` })
    : st === "scheduled" ? tf("mp_st_scheduledAt", { d: `${E.de(iso(new Date(cur.from!)))} ${hhmm(new Date(cur.from!))}` }) : t("mp_st_" + st);
  const stCol = st === "live" ? col.ok : st === "scheduled" ? col.warn : col.build;
  return (
    <Col gap={14}>
      <Card testID="mp-share-status" tone={stCol}>
        <Row between wrap gap={8}><T v="h3">{t("mp_share")}</T><Chip label={stLabel} color={stCol} testID="mp-share-chip" /></Row>
        {plan.publishedAt && st !== "draft" ? <Muted small>{tf("mp_sharedAt", { d: `${E.de(iso(new Date(plan.publishedAt)))} ${hhmm(new Date(plan.publishedAt))}` })}</Muted> : null}
        {changed && st !== "ended" ? <Banner color={col.warn} testID="mp-changed">{t("mp_changed")}</Banner> : null}
        {can && (st === "live" || st === "scheduled") ? <Row wrap gap={8}>
          {changed ? <Btn testID="mp-update" kind="primary" label={t("mp_update")} disabled={busy || !!err} onPress={go} /> : null}
          <Btn testID="mp-unshare" kind="danger" label={t("mp_unshare")} disabled={busy} onPress={async () => { onBefore?.(); setBusy(true); try { await s.sharePlan(plan, null); } finally { setBusy(false); } }} />
        </Row> : null}
      </Card>
      <Card testID="mp-share-form">
        <CardTitle title={t("mp_shareWhat")} />
        {MP_SECTIONS.map(k => <Check key={k} testID={"mp-sec-" + k} value={sections.includes(k)} onChange={v => setSections(v ? MP_SECTIONS.filter(x => x === k || sections.includes(x)) : sections.filter(x => x !== k))}
          label={<Col gap={1}><T bold>{t("mp_sec_" + k)}{k === "slides" ? ` (${visSlides}/${plan.c.slides.length})` : ""}</T>{k === "subs" ? <Muted small>{t("mp_secSubsD")}</Muted> : k === "slides" ? <Muted small>{t("mp_secSlidesD")}</Muted> : null}</Col>} />)}
        {sections.includes("tasks") ? <ToggleRow testID="mp-owntasks" label={t("mp_ownTasks")} desc={t("mp_ownTasksD")} value={ownTasks} onChange={setOwnTasks} /> : null}
        <ToggleRow testID="mp-squadonly" label={t("mp_squadOnly")} desc={t("mp_squadOnlyD")} value={squadOnly} onChange={setSquadOnly} />
        {sections.includes("lineup") ? <Banner testID="mp-psy">{t("mp_psyHint")}</Banner> : null}
      </Card>
      <Card testID="mp-share-when">
        <CardTitle title={t("mp_shareWhen")} />
        <Row wrap gap={10} align="flex-end">
          <DateField testID="mp-until-date" label={t("mp_until")} value={uDate} onChange={setUDate} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
          <TimeField testID="mp-until-time" label={t("f_time")} value={uTime} onChange={setUTime} style={{ width: 100 }} />
        </Row>
        <Muted small>{m ? t("mp_untilD") : t("mp_untilFree")}</Muted>
        <ToggleRow testID="mp-later" label={t("mp_later")} desc={t("mp_laterD")} value={later} onChange={setLater} />
        {later ? <Row wrap gap={10} align="flex-end">
          <DateField testID="mp-from-date" label={t("mp_from")} value={fDate} onChange={setFDate} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
          <TimeField testID="mp-from-time" label={t("f_time")} value={fTime} onChange={setFTime} style={{ width: 100 }} />
        </Row> : null}
        {E.mods.chat !== false ? <Check testID="mp-announce" label={t("mp_announce")} value={announce} onChange={setAnnounce} /> : null}
        <Banner testID="mp-protect"><Col gap={4}><T v="small" bold>{t("mp_protectT")}</T><T v="small">{t("mp_protect")}</T></Col></Banner>
        {err ? <Text style={{ color: col.crit, fontWeight: "700" }} testID="mp-share-err">{err}</Text> : null}
        {can ? <Btn testID="mp-share" kind="primary" label={st === "live" || st === "scheduled" ? t("mp_shareSave") : t("mp_shareGo")} disabled={busy || !!err} onPress={go} /> : <Muted small>{t("mp_ro")}</Muted>}
      </Card>
      {plan.published ? <LogCard plan={plan} /> : null}
    </Col>
  );
}

/** Zugriffsprotokoll: gesehen / noch nicht gesehen, erkannte Screenshots */
export function LogCard({ plan }: { plan: MatchPlan }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  useEffect(() => { s.refreshPlanLogs(plan.id); }, [plan.id, plan.publishedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const logs = (E.D.planLogs[plan.id] || []).filter(l => !plan.publishedAt || l.at >= plan.publishedAt || l.kind === "shot");
  const rec = plan.share?.squadOnly ? squadOf(plan.published?.lineup ? { lineup: plan.published.lineup, bench: plan.published.bench || [] } : plan.c) : E.D.players.map(p => p.id);
  const st = seenStats(logs, rec);
  const shots = logs.filter(l => l.kind === "shot");
  const last = (pid: string) => [...logs].reverse().find(l => l.pid === pid && l.kind === "open");
  const fmt = (a: string) => { const d = new Date(a); return `${E.wt(iso(d))} ${hhmm(d)}`; };
  return (
    <Card testID="mp-log">
      <CardTitle title={t("mp_log")} info={<Info title={t("mp_log")} text={t("mp_logInfo")} />} right={<Btn small kind="ghost" testID="mp-log-refresh" label="↻" a11y={t("mp_refresh")} onPress={() => s.refreshPlanLogs(plan.id)} />} />
      <Row gap={10} wrap>
        <Chip testID="mp-seen" label={tf("mp_seen", { n: st.seen.length, m: rec.length })} color={col.ok} />
        {shots.length ? <Chip testID="mp-shots" label={tf("mp_shots", { n: shots.length })} color={col.crit} /> : null}
      </Row>
      {rec.length ? <View style={{ height: 8, borderRadius: 99, backgroundColor: col.sunk, overflow: "hidden" }}>
        <View style={{ width: `${(st.seen.length / rec.length) * 100}%`, height: "100%", backgroundColor: col.ok }} />
      </View> : null}
      {shots.map((l, i) => { const p = info(l.pid)?.p; return p ? <ListItem key={"s" + i} testID={"mp-shot-" + i} left={<PlayerAvatar p={p} size={32} />} title={E.name(p)} sub={`${t("mp_shot")} · ${fmt(l.at)} · ${l.platform || "?"}`} /> : null; })}
      {st.open.length ? <Col gap={6}>
        <T v="small" bold>{t("mp_notSeen")}</T>
        <Row wrap gap={6}>{st.open.map(pid => { const p = info(pid)?.p; return p ? <View key={pid} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: withAlpha(col.warn, 0.14) }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: col.ink }}>{info(pid)!.label}</Text></View> : null; })}</Row>
        <Muted small>{t("mp_notSeenHint")}</Muted>
      </Col> : null}
      {st.seen.length ? <Col gap={4}>
        <T v="small" bold>{t("mp_seenList")}</T>
        <Muted small>{st.seen.map(pid => `${info(pid)?.label || "?"} (${fmt(last(pid)!.at)})`).join(" · ")}</Muted>
      </Col> : null}
    </Card>
  );
}

