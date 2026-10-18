// Trainer – Kandidatenprofil (Scouting): Status-Pipeline, Priorität, Einschätzung, Bewertungsprofil aus Berichten,
// nächster Schritt, Schattenkader, Berichte, Merklisten, Datenschutz (Art. 14/15 DSGVO, automatische Löschung).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, Share, Text, View } from "react-native";
import { iso } from "../../../src/core/dates";
import { fmtOf } from "../../../src/core/matchplan";
import {
  cleanPlanContent, CLOSED, deleteAt, infoState, isClosed, nextDue, PIPELINE, refOf, removeRef, reportStats, SCOUT_AREAS, scoutAge, seasonLabel, slotsWith, yearOf,
} from "../../../src/core/scout";
import type { ScoutPlayer, ScoutReport, ScoutStatus } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Banner, Btn, Card, CardTitle, Col, DateField, Field, Muted, Row, Screen, T } from "../../../src/ui/kit";
import { currentPlanSeason, Dots, fullDate, GradeBadge, gradeCol, posShort, PrioBadge, prioCol, ScoutAvatar, slotShort, StateTag, statusCol } from "../../../src/ui/scout/common";
import { blankReport, PlanPickSheet, ReportSheet, ScoutForm } from "../../../src/ui/scout/forms";
import { radius, useTheme, withAlpha } from "../../../src/ui/theme";

export default function ScoutProfile() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const x = E.D.scouts.find(y => y.id === id) || null;
  const [edit, setEdit] = useState<ScoutPlayer | null>(null); const [rep, setRep] = useState<ScoutReport | null>(null);
  const [pick, setPick] = useState(false); const [season, setSeason] = useState(currentPlanSeason()); const [ask, setAsk] = useState(false);
  const [next, setNext] = useState<{ d: string | null; n: string } | null>(null); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setNext(null); }, [id]);
  const reports = useMemo(() => E.D.scoutReports.filter(r => r.sid === id).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0), [E.D.scoutReports, id, s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/scouting");
  if (!x) return <Screen testID="coach-scout"><Btn small kind="ghost" icon="back" label={t("sc_back")} onPress={back} style={{ alignSelf: "flex-start" }} /><Muted>{t("sc_notFound")}</Muted></Screen>;

  const now = new Date(), today = iso(now), st = reportStats(reports), age = scoutAge(x, now), info = infoState(x, now);
  const save = (p: Partial<ScoutPlayer>) => s.saveScout({ ...x, ...p });
  const setStatus = (k: ScoutStatus) => { if (k !== x.status) save({ status: k }); };
  const lists = E.D.scoutLists.filter(l => x.lists.includes(l.id));
  const plans = [...E.D.squadPlans].sort((a, b) => b.season - a.season).map(p => ({ p, c: cleanPlanContent(p.content, fmtOf(E.team.cls)) }));
  const inPlans = plans.flatMap(({ p, c: pc }) => slotsWith(pc, refOf("s", x.id)).map(w => ({ season: p.season, w, pc })));
  const player = x.playerId ? E.D.players.find(p => p.id === x.playerId) || null : null;
  const sender = s.myStaff?.name || s.user?.displayName || "";
  const shareInfo = () => Share.share({ message: tf("sc_art14", { team: E.team.name, club: E.team.club || E.team.name, sender }) }).catch(() => undefined);
  const shareAccess = () => {
    const L = [tf("sc_accessHead", { n: `${x.vn} ${x.nn}`.trim(), team: E.team.name, d: fullDate(s.lang, today) }), "",
      `${t("sc_year")}: ${yearOf(x) ?? "–"}${x.geb ? " (" + x.geb + ")" : ""}`, `${t("sc_pos")}: ${x.pos.join(", ") || "–"}`, `${t("sc_foot")}: ${x.foot ? t("scf_" + x.foot) : "–"}`,
      `${t("sc_height")}: ${x.cm ?? "–"}`, `${t("sc_club")}: ${[x.club, x.clubTeam].filter(Boolean).join(" · ") || "–"}`, `${t("sc_status")}: ${t("scs_" + x.status)}`,
      `${t("sc_prio")}: ${x.prio ? t("scp_" + x.prio) : "–"}`, `${t("sc_level")}/${t("sc_potential")}: ${x.level ?? "–"}/${x.potential ?? "–"}`, `${t("sc_tags")}: ${x.tags.join(", ") || "–"}`,
      `${t("sc_source")}: ${x.source || "–"}`, `${t("sc_contact")}: ${x.contact || "–"}`, `${t("sc_note")}: ${x.note || "–"}`, `${t("sc_informed")}: ${x.informed || "–"}`, "",
      `${t("sc_accessReports")}: ${reports.length ? "" : t("sc_accessNone")}`,
      ...reports.map(r => `– ${r.date} · ${t("sck_" + r.kind)} · ${r.event} · ${t("sc_grade")}: ${r.grade ?? "–"} · ${r.verdict ? t("scv_" + r.verdict) : "–"}\n  ${[r.strengths, r.weaknesses, r.summary].filter(Boolean).join(" / ")}`)];
    Share.share({ message: L.join("\n") }).catch(() => undefined);
  };
  const idx = PIPELINE.indexOf(x.status), closed = isClosed(x.status);
  const nx = next ?? { d: x.next, n: x.nextNote };
  return (
    <Screen testID="coach-scout">
      <Btn small kind="ghost" icon="back" label={t("sc_back")} onPress={back} style={{ alignSelf: "flex-start" }} />

      <Card testID="sc-head">
        <Row gap={14} align="flex-start">
          <View><ScoutAvatar vn={x.vn} nn={x.nn} status={x.status} size={64} />{x.prio ? <View style={{ position: "absolute", right: -4, bottom: -4 }}><PrioBadge p={x.prio} size={22} /></View> : null}</View>
          <Col gap={4} style={{ flex: 1 }}>
            <T v="eyebrow">{[yearOf(x) ? `${t("sc_year")} ${yearOf(x)}` : "", age ? tf(age.approx ? "sc_ageApprox" : "sc_age", { a: age.age }) : "", x.cm ? x.cm + " cm" : "", x.foot ? t("scf_" + x.foot) : ""].filter(Boolean).join(" · ")}</T>
            <T v="h1" style={{ fontSize: 24 }}>{`${x.vn} ${x.nn}`.trim()}</T>
            {x.pos.length ? <T v="small" bold>{x.pos.map(p => t("pos_" + p) === "pos_" + p ? posShort(t, p) : t("pos_" + p)).join(" · ")}</T> : null}
            {x.club || x.clubTeam ? <Muted small>{[x.club, x.clubTeam].filter(Boolean).join(" · ")}</Muted> : null}
          </Col>
        </Row>
        <Row gap={6} wrap>
          <StateTag label={t("scs_" + x.status)} color={statusCol(c, x.status)} />
          {x.prio ? <StateTag label={t("scp_" + x.prio)} color={prioCol(c, x.prio)} /> : null}
          {lists.map(l => <StateTag key={l.id} label={l.name} color={l.color} />)}
          {x.tags.map(tg => <StateTag key={tg} label={tg} color={c.build} />)}
        </Row>
        <Row gap={8} wrap>
          <Btn small testID="sc-edit" label={t("sc_editT")} onPress={() => setEdit(x)} />
          {x.video ? <Btn small testID="sc-video" label={"▶ " + t("sc_video")} onPress={() => Linking.openURL(x.video!).catch(() => undefined)} /> : null}
        </Row>
      </Card>

      <Card testID="sc-pipeline-card">
        <CardTitle title={t("sc_pipeline")} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {PIPELINE.map((k, i) => {
            const on = k === x.status, done = !closed && i < idx, col = statusCol(c, k);
            return (
              <Pressable key={k} testID={"sc-step-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setStatus(k)}
                style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1.5,
                  borderColor: on || done ? col : c.line, backgroundColor: on ? col : done ? withAlpha(col, 0.12) : c.surface }}>
                {done ? <Icon name="check" size={13} color={col} /> : <Text style={{ fontWeight: "900", fontSize: 11, color: on ? "#fff" : c.muted }}>{i + 1}</Text>}
                <Text style={{ fontWeight: "800", fontSize: 13, color: on ? "#fff" : done ? col : c.ink }}>{t("scs_" + k)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Row gap={8} wrap>
          {closed ? <Btn small testID="sc-reopen" label={t("sc_reopen")} onPress={() => setStatus("watch")} />
            : CLOSED.map(k => <Btn key={k} small kind="ghost" testID={"sc-step-" + k} label={t("scs_" + k)} onPress={() => setStatus(k)} />)}
          {closed ? <StateTag label={t("scs_" + x.status)} color={c.crit} /> : null}
        </Row>
        {info.state === "due" ? <Banner color={c.warn} testID="sc-info-banner"><Col gap={6}><T v="small" bold>{t("sc_infoDue")}</T><T v="small">{t("sc_infoHint")}</T>
          <Row gap={8} wrap><Btn small testID="sc-info-share" label={t("sc_infoText")} onPress={shareInfo} /><Btn small kind="primary" testID="sc-info-today" label={t("sc_infoSet")} onPress={() => save({ informed: today })} /></Row></Col></Banner> : null}
        {x.status === "signed" ? (player
          ? <Pressable accessibilityRole="button" onPress={() => router.push("/coach/spieler/" + player.id)}><Banner color={c.ok} testID="sc-taken">{tf("sc_takenHint", { n: `${player.vn} ${player.nn}`.trim() })}</Banner></Pressable>
          : s.can("squad") ? <Banner color={c.ok}><Row gap={8} wrap><T v="small" style={{ flex: 1, minWidth: 180 }}>{t("sc_signedHint")}</T>
            <Btn small kind="primary" testID="sc-takeover" label={t("sk_takeOver")} onPress={async () => { const pid = await s.takeOverScout(x.id); if (pid) router.push("/coach/spieler/" + pid); }} /></Row></Banner> : null) : null}
      </Card>

      <Card testID="sc-rating">
        <CardTitle title={t("sc_profile")} right={<GradeBadge g={st.grade} n={st.n} testID="sc-avg" />} />
        <Row gap={18} wrap>
          <Col gap={4}><T v="small" bold color={c.muted}>{t("sc_level")}</T><Dots testID="sc-level" value={x.level} onChange={v => save({ level: v })} size={15} label={t("sc_level")} /><Muted small>{x.level ? t("scl_" + x.level) : "–"}</Muted></Col>
          <Col gap={4}><T v="small" bold color={c.muted}>{t("sc_potential")}</T><Dots testID="sc-pot" value={x.potential} onChange={v => save({ potential: v })} size={15} color={c.event} label={t("sc_potential")} /><Muted small>{x.potential ? t("scl_" + x.potential) : "–"}</Muted></Col>
        </Row>
        {st.n ? <Col gap={8}>
          <Muted small>{st.n === 1 ? t("sc_avg1") : tf("sc_avg", { g: st.grade != null ? E.num(st.grade, 1) : "–", n: st.n })}{st.trend ? " · " + (st.trend > 0 ? "↑ " + t("sc_trendUp") : "↓ " + t("sc_trendDown")) : ""}</Muted>
          {SCOUT_AREAS.map(a => { const v = st.areas[a]; return (
            <Row key={a} gap={10}>
              <Text style={{ width: 86, fontWeight: "700", color: c.ink }}>{t("da_" + a)}</Text>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.sunk, overflow: "hidden" }}><View style={{ width: `${((v ?? 0) / 5) * 100}%`, height: "100%", backgroundColor: gradeCol(c, v), borderRadius: 5 }} /></View>
              <Text style={{ width: 30, textAlign: "right", fontWeight: "900", color: c.ink, fontVariant: ["tabular-nums"] }}>{v != null ? E.num(v, 1) : "–"}</Text>
            </Row>
          ); })}
          <Muted small>{tf("sc_verdicts", { s: st.verdicts.sign, w: st.verdicts.watch, n: st.verdicts.no })}</Muted>
        </Col> : <Muted small>{t("sc_noRating")}</Muted>}
        <Muted small>{t("sc_levelHint")}</Muted>
      </Card>

      <Card testID="sc-next">
        <CardTitle title={t("sc_next")} right={x.next && nextDue(x, today) ? <StateTag label={t("sc_nextDue")} color={c.crit} /> : undefined} />
        <Row gap={10} wrap>
          <DateField testID="sc-next-date" label={t("sc_nextDate")} value={nx.d} lang={s.lang} onChange={d => setNext({ ...nx, d })} style={{ width: 150 }} />
          <Field testID="sc-next-note" label={t("sc_next")} value={nx.n} onChangeText={n => setNext({ ...nx, n })} placeholder={t("sc_nextPh")} maxLength={120} style={{ flex: 1, minWidth: 180 }} />
        </Row>
        {next && (next.d !== x.next || next.n !== x.nextNote) ? <Btn small kind="primary" testID="sc-next-save" label={t("save")} onPress={async () => { if (await save({ next: next.d, nextNote: next.n })) { setNext(null); s.toast(t("t_saved")); } }} style={{ alignSelf: "flex-start" }} /> : null}
      </Card>

      <Card testID="sc-plan">
        <CardTitle title={t("sk_shadow")} />
        {inPlans.length ? inPlans.map(({ season: se, w, pc }) => (
          <Row key={se + w.key + w.kind} gap={8} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Text style={{ color: c.event, fontWeight: "900" }}>◆</Text>
            <T style={{ flex: 1 }} testID={"sc-plan-" + se + "-" + w.key}>{w.kind === "own" ? tf("sc_inPlanOwn", { s: seasonLabel(se), p: slotShort(t, w.key) }) : tf("sc_inPlanRank", { s: seasonLabel(se), p: slotShort(t, w.key), r: w.rank })}</T>
            <Btn small kind="ghost" label={t("sk_remove")} onPress={() => {
              const ref = refOf("s", x.id), sl = pc.slots[w.key];
              const c2 = { ...pc, slots: { ...pc.slots, [w.key]: { ...sl, own: sl.own.filter(r => r !== ref), shadow: sl.shadow.filter(r => r !== ref) } } };
              s.saveSquadPlan(se, slotsWith(c2, ref).length ? c2 : removeRef(c2, ref));
            }} />
          </Row>
        )) : <Muted small>{t("sc_inPlanNone")}</Muted>}
        <Btn small testID="sc-plan-add" icon="plus" label={t("sc_addToPlan")} onPress={() => setPick(true)} style={{ alignSelf: "flex-start" }} />
      </Card>

      <Card testID="sc-reports">
        <CardTitle title={`${t("sc_reports")} (${reports.length})`} right={<Btn small kind="primary" testID="sc-rep-new" icon="plus" label={t("sc_newReport")} onPress={() => setRep(blankReport(x))} />} />
        {reports.length ? reports.map(r => {
          const isOpen = open === r.id;
          return (
            <Pressable key={r.id} testID={"sc-rep-" + r.id} accessibilityRole="button" onPress={() => setOpen(isOpen ? null : r.id)}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line, gap: 6 }}>
              <Row gap={8}>
                <Col gap={2} style={{ flex: 1 }}>
                  <T bold numberOfLines={isOpen ? 3 : 1}>{r.event || t("sck_" + r.kind)}</T>
                  <Muted small>{[`${E.wt(r.date)} ${E.de(r.date)}`, t("sck_" + r.kind), r.min != null ? tf("sc_min", { m: r.min }) : "", r.pos ? posShort(t, r.pos) : "", r.authorName ? tf("sc_by", { n: r.authorName }) : ""].filter(Boolean).join(" · ")}</Muted>
                </Col>
                {r.verdict ? <StateTag label={t("scv_" + r.verdict)} color={r.verdict === "sign" ? c.ok : r.verdict === "watch" ? c.warn : c.crit} /> : null}
                <GradeBadge g={r.grade} />
              </Row>
              <Row gap={10} wrap>{SCOUT_AREAS.filter(a => r.scores[a] != null).map(a => (
                <Row key={a} gap={4}><Muted small>{t("da_" + a)}</Muted><Text style={{ fontWeight: "900", color: gradeCol(c, r.scores[a]) }}>{r.scores[a]}</Text></Row>
              ))}</Row>
              {isOpen ? <Col gap={4}>
                {r.strengths ? <T v="small"><Text style={{ fontWeight: "800" }}>{t("sc_strengths")}: </Text>{r.strengths}</T> : null}
                {r.weaknesses ? <T v="small"><Text style={{ fontWeight: "800" }}>{t("sc_weaknesses")}: </Text>{r.weaknesses}</T> : null}
                {r.summary ? <T v="small"><Text style={{ fontWeight: "800" }}>{t("sc_summary")}: </Text>{r.summary}</T> : null}
                <Btn small testID={"sc-rep-edit-" + r.id} label={t("sc_repEdit")} onPress={() => setRep(r)} style={{ alignSelf: "flex-start" }} />
              </Col> : (r.summary ? <Muted small>{r.summary.length > 120 ? r.summary.slice(0, 117) + "…" : r.summary}</Muted> : null)}
            </Pressable>
          );
        }) : <Muted small>{t("sc_noReports")}</Muted>}
      </Card>

      {x.source || x.contact || x.note ? <Card testID="sc-details">
        {x.source ? <Row gap={8}><Muted small>{t("sc_source")}:</Muted><T v="small">{x.source}</T></Row> : null}
        {x.contact ? <Row gap={8}><Muted small>{t("sc_contact")}:</Muted><T v="small" style={{ flex: 1 }}>{x.contact}</T></Row> : null}
        {x.note ? <T v="small">{x.note}</T> : null}
      </Card> : null}

      <Card testID="sc-privacy">
        <CardTitle title={t("sc_privacy")} />
        <View style={{ padding: 10, borderRadius: radius.m, backgroundColor: withAlpha(info.state === "ok" ? c.ok : info.state === "due" ? c.warn : c.low, 0.12) }}>
          <T v="small" bold testID="sc-info-state">{info.state === "ok" ? tf("sc_infoOk", { d: fullDate(s.lang, x.informed!) }) : info.state === "due" ? t("sc_infoDue") : tf("sc_infoSoon", { d: info.days })}</T>
        </View>
        <Muted small>{t("sc_infoHint")}</Muted>
        <Row gap={10} wrap style={{ alignItems: "flex-end" }}>
          <DateField testID="sc-informed" label={t("sc_informed")} value={x.informed} lang={s.lang} onChange={d => save({ informed: d })} style={{ width: 190 }} />
          <Btn small testID="sc-share-info" label={t("sc_infoText")} onPress={shareInfo} />
          {!x.informed ? <Btn small kind="primary" testID="sc-informed-today" label={t("sc_infoSet")} onPress={() => save({ informed: today })} /> : null}
        </Row>
        <Muted small testID="sc-delete-at">{tf("sc_deleteAt", { d: fullDate(s.lang, deleteAt(x)) })}</Muted>
        <Row gap={8} wrap>
          <Btn small testID="sc-access" label={t("sc_access")} onPress={shareAccess} />
          {!ask ? <Btn small kind="ghost" testID="sc-delete" label={t("sc_delete")} onPress={() => setAsk(true)} /> : null}
        </Row>
        {ask ? <Banner color={c.crit}><Col gap={8}><T v="small">{tf("sc_deleteQ", { n: `${x.vn} ${x.nn}`.trim() })}</T><Row gap={8}>
          <Btn small label={t("no")} onPress={() => setAsk(false)} />
          <Btn small kind="danger" testID="sc-delete-yes" label={t("sc_delete")} onPress={async () => { await s.deleteScout(x.id); back(); }} />
        </Row></Col></Banner> : null}
      </Card>

      <ScoutForm value={edit} onClose={() => setEdit(null)} />
      <ReportSheet scout={x} value={rep} onClose={() => setRep(null)} />
      <PlanPickSheet scout={x} visible={pick} onClose={() => setPick(false)} season={season} onSeason={setSeason} />
    </Screen>
  );
}
