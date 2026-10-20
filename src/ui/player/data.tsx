// Spieler – Meine Daten nach dem Muster Übersicht → Bereich:
// - PlayerDataOverview (/player/daten): vier Kennzahlen und die Bereiche als Zeilen mit dem wichtigsten Wert.
// - PlayerDataSection (/player/daten/[sec]): load (Belastung, Spielminuten, Zusatzsport), week (Wochenziele,
//   Zuverlässigkeit, Abzeichen), season (Saison, Noten & Feedback, Videos), tests (Leistungstests), att (Beteiligung,
//   Abwesenheiten), health (Befunde) – jeweils mit „Hintergrund & Quellen“, wo es Wissenschaft dahinter gibt.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { addDays, diff, monday, sum } from "../../core/dates";
import { gameOf } from "../../core/game";
import type { Player } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { WeekBars } from "../charts";
import type { IconName } from "../icons";
import { PlayerFindings } from "../injury";
import { WikiBackground } from "../insight";
import { Bar, Chip, Header, Metric, Metrics, Muted, NavRow, PageTitle, Row, Screen, Section, StatusChip } from "../kit";
import { PerfCard } from "../perf";
import { statusColor, useTheme } from "../theme";
import { Badges, GOLD, MySeason, WeekRings } from "./parts";

export type PdKey = "load" | "week" | "season" | "tests" | "att" | "health";
const PD_KEYS: PdKey[] = ["load", "week", "season", "tests", "att", "health"];

function usePdData(p: Player | undefined) {
  const s = useStore(); const E = useEngine();
  return useMemo(() => {
    if (!p) return null;
    const g = gameOf(E, p.id), pr = E.profile(p.id), att = E.attendance(p.id);
    const cnt = { da: 0, ent: 0, unent: 0 } as Record<string, number>;
    E.D.sessions.filter(x => x.date <= E.TODAY && diff(x.date, E.TODAY) <= 28).forEach(x => { const st = E.attStatus(x.date, p.id); if (cnt[st] != null) cnt[st]++; });
    const m0 = monday(E.TODAY), dl = E.daily(p.id);
    const wk = [3, 2, 1, 0].map(i => { const w = addDays(m0, -7 * i); return { label: E.de(w), v: sum(Object.keys(dl).filter(d => d >= w && d < addDays(w, 7)).map(d => dl[d])) }; });
    const mins = E.D.sessions.filter(x => x.typ === "Spiel" && x.date <= E.TODAY && !E.absenceOn(p.id, x.date)).slice(-5).map(x => ({ d: x.date, m: E.D.rpe[p.id]?.[x.date]?.min || 0, opp: E.matchOn(x.date)?.gegner || "" }));
    const ex = (E.D.extra[p.id] || []).filter(x => diff(x.date, E.TODAY) <= 7 && x.date <= E.TODAY);
    const abs = E.D.absences.filter(a => a.pid === p.id).sort((a, b) => a.von < b.von ? 1 : -1).slice(0, 6);
    const stK = ["ok", "low", "warn", "crit", "build", "inj"].includes(pr.st) ? pr.st : "none";
    const minAvg = mins.length ? Math.round(sum(mins.map(x => x.m)) / mins.length) : null;
    return { g, pr, att, cnt, wk, mins, ex, abs, stK, minAvg };
  }, [s.version, E, p]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Bereiche, die der Spieler sehen darf (Module und Freigaben des Trainers) */
function useSections(p: Player | undefined, d: ReturnType<typeof usePdData>) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  if (!p || !d) return [];
  const showLoad = !!E.mods.belastung && E.playerSees("load"), seesAtt = !!E.mods.beteiligung && E.playerSees("att");
  const L: { k: PdKey; icon: IconName; color: string; title: string; sub?: string; value?: string | null; valueColor?: string }[] = [];
  if (showLoad) L.push({ k: "load", icon: "pulse", color: d.stK === "none" ? c.accentTx : statusColor(c, d.stK), title: t("pd_load"), sub: t("pd_load_" + d.stK), value: null });
  if (E.mods.belastung) {
    const w = d.g.week, done = w.checkins.done + w.rpe.done + w.att.done, total = w.checkins.total + w.rpe.total + w.att.total;
    L.push({ k: "week", icon: "trophy", color: GOLD, title: t("pdx_week"), sub: d.g.reliability != null ? `${t("gm_rel")} ${Math.round(d.g.reliability * 100)} %` : t("gm_relFew"), value: total ? `${done}/${total}` : null, valueColor: total && done >= total ? c.ok : undefined });
  }
  if (E.mods.spielanalyse || E.mods.videos) {
    const ss = E.seasonStats(p.id);
    L.push({ k: "season", icon: "ball", color: c.low, title: t("pdx_season"), sub: E.playerSees("stats") ? tf("ps_games", { g: ss.games, m: ss.min }) : undefined, value: E.playerSees("ratings") && ss.avg != null ? E.num(ss.avg, 1) : null });
  }
  if (E.playerSees("tests")) {
    const T = E.D.tests.filter(x => x.pid === p.id), last = T.map(x => x.date).sort().at(-1);
    L.push({ k: "tests", icon: "stopwatch", color: c.ok, title: t("pdx_tests"), sub: last ? tf("ps_lastTest", { d: E.de(last) }) : t("ps_noTests"), value: T.length ? String(new Set(T.map(x => x.test)).size) : null });
  }
  if (seesAtt || E.mods.beteiligung) L.push({ k: "att", icon: "calendar", color: c.build, title: t("pdx_att"), sub: seesAtt ? t("pd_28") : undefined, value: seesAtt && d.att != null ? Math.round(d.att * 100) + " %" : null, valueColor: seesAtt && d.att != null && d.att >= 0.9 ? c.ok : undefined });
  if (E.D.findings.some(f => f.pid === p.id)) L.push({ k: "health", icon: "heart", color: c.inj, title: t("bf_mine"), value: String(E.D.findings.filter(f => f.pid === p.id).length) });
  return L;
}

export function PlayerDataOverview() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(s.mePid || "");
  const d = usePdData(p);
  const secs = useSections(p, d);
  if (!p || !d) return <Screen testID="player-daten"><Header title={t("pn_daten")} /></Screen>;
  const showLoad = !!E.mods.belastung && E.playerSees("load"), seesAtt = !!E.mods.beteiligung && E.playerSees("att");
  return (
    <Screen testID="player-daten">
      <Header title={t("pn_daten")} />
      <Metrics testID="pd-kpi">
        {showLoad ? <Metric label={t("pd_loadS")} value={t("pd_loadW_" + d.stK)} color={d.stK === "none" ? undefined : statusColor(c, d.stK)} onPress={() => router.push("/player/daten/load")} /> : null}
        {seesAtt ? <Metric label={t("pd_attS")} value={d.att != null ? String(Math.round(d.att * 100)) : "–"} unit={d.att != null ? "%" : undefined} color={d.att != null && d.att >= 0.9 ? c.ok : undefined} onPress={() => router.push("/player/daten/att")} /> : null}
        {E.mods.belastung ? <Metric label={t("pd_sleepS")} value={d.pr.sl != null ? E.num(d.pr.sl, 1) : "–"} unit={d.pr.sl != null ? "h" : undefined} color={d.pr.sl != null && d.pr.sl < d.pr.tg[0] ? c.warn : undefined} sub={`${t("sleepTarget")} ${d.pr.tg[0]}–${d.pr.tg[1]} h`} onPress={() => router.push("/player/koerper")} /> : null}
        {E.mods.belastung ? <Metric label={t("pd_minsS")} value={d.minAvg != null ? d.minAvg + "′" : "–"} onPress={showLoad ? () => router.push("/player/daten/load") : undefined} /> : null}
      </Metrics>
      {secs.length ? <Section title={t("ps_areas")} testID="pd-secs">
        {secs.map(x => <NavRow key={x.k} testID={"pd-sec-" + x.k} icon={x.icon} iconColor={x.color} title={x.title} sub={x.sub} value={x.value} valueColor={x.valueColor} onPress={() => router.push("/player/daten/" + x.k)} />)}
      </Section> : <Muted>{t("pdx_none")}</Muted>}
    </Screen>
  );
}

export function PlayerDataSection({ sec }: { sec: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(s.mePid || "");
  const d = usePdData(p);
  const k: PdKey = (PD_KEYS as string[]).includes(sec) ? sec as PdKey : "load";
  const back = () => router.canGoBack() ? router.back() : router.replace("/player/daten");
  const title = { load: t("pd_load"), week: t("pdx_week"), season: t("pdx_season"), tests: t("pdx_tests"), att: t("pdx_att"), health: t("bf_mine") }[k];
  if (!p || !d) return <Screen narrow testID={"player-daten-" + k}><Header onBack={back} backLabel={t("pn_daten")} title={title} /></Screen>;
  const showLoad = !!E.mods.belastung && E.playerSees("load"), seesAtt = !!E.mods.beteiligung && E.playerSees("att");
  const body = {
    load: showLoad ? <>
      <Section pad testID="pd-load">
        <StatusChip status={d.stK} label={t("pd_load_" + d.stK)} />
        <WeekBars data={d.wk} label={t("pd_weeks")} height={130} />
        <Muted small>{t("pd_weeks")}</Muted>
      </Section>
      {E.mods.belastung ? <Section title={t("pd_mins")} testID="pd-mins">
        {d.mins.length ? d.mins.map(x => <NavRow key={x.d} title={x.opp || t("it_match")} sub={`${E.wt(x.d)} ${E.de(x.d)}`} value={x.m + "′"} />) : <NavRow title={t("pd_noMins")} />}
      </Section> : null}
      {E.mods.belastung ? <Section title={t("pd_extra")} testID="pd-extra">
        {d.ex.length ? d.ex.map(e => <NavRow key={e.id} title={e.label || t("px_" + e.art)} sub={`${E.wt(e.date)} ${E.de(e.date)}`} value={`${e.min}′ · RPE ${e.rpe}`} />) : <NavRow title={t("px_none")} />}
      </Section> : null}
      <WikiBackground keys={["au", "acwr", "ampel"]} extra={[t("tx_src")]} testID="pd-load-bg" />
    </> : <Muted>{t("pdx_none")}</Muted>,
    week: <>
      <WeekRings g={d.g} />
      <Muted small testID="pd-rel">{t("gm_rel")}: {d.g.reliability == null ? t("gm_relFew")
        : `${Math.round(d.g.reliability * 100)} % · ` + tf("gm_relD", { c: d.g.rel.checkins.done, ct: d.g.rel.checkins.total, r: d.g.rel.rpe.done, rt: d.g.rel.rpe.total })}</Muted>
      <Badges g={d.g} />
    </>,
    season: <MySeason pid={p.id} />,
    tests: <><PerfCard p={p} /><WikiBackground keys={["bands", "sprint", "cmj", "ift"]} testID="pd-tests-bg" /></>,
    att: <>
      {seesAtt ? <Section pad testID="pd-att" title={t("pd_att")} right={<Muted small>{t("pd_28")}</Muted>}>
        <Bar value={d.att || 0} color={d.att != null && d.att >= 0.9 ? c.ok : c.accent} />
        <Row wrap gap={6}><Chip label={`${d.cnt.da} ${t("at_da")}`} color={c.ok} /><Chip label={`${d.cnt.ent} ${t("at_ent")}`} color={c.warn} /><Chip label={`${d.cnt.unent} ${t("at_unent")}`} color={c.crit} /></Row>
      </Section> : null}
      {E.mods.beteiligung ? <Section title={t("pd_abs")} testID="pd-abs">
        {d.abs.length ? d.abs.map(a => <NavRow key={a.id} title={t("ab_" + a.typ) + (a.notiz ? ": " + a.notiz : "")} sub={`${E.de(a.von)} – ${a.bis ? E.de(a.bis) : t("ongoing")}`} />) : <NavRow title={t("abs_none")} />}
      </Section> : null}
    </>,
    health: <PlayerFindings pid={p.id} />,
  }[k];
  return (
    <Screen narrow testID={"player-daten-" + k}>
      <Header onBack={back} backLabel={t("pn_daten")} title={title} />
      <PageTitle title={title}>{body}</PageTitle>
    </Screen>
  );
}
