// Spieler – Meine Daten: Abzeichen, Beteiligung, Belastung, Schlaf, Spielminuten, Zusatzsport, Abwesenheiten.
import React, { useMemo } from "react";
import { Text } from "react-native";
import { addDays, diff, monday, sum } from "../../../src/core/dates";
import { gameOf } from "../../../src/core/game";
import { useEngine, useStore } from "../../../src/data/store";
import { WeekBars } from "../../../src/ui/charts";
import { Bar, Card, Chip, Col, Header, Info, ListItem, Muted, Row, Screen, StatusChip, T } from "../../../src/ui/kit";
import { Badges, MySeason } from "../../../src/ui/player/parts";
import { useTheme } from "../../../src/ui/theme";

export default function Daten() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const p = E.P(s.mePid || "")!;
  const g = useMemo(() => gameOf(E, p.id), [s.version, E, p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pr = E.profile(p.id), att = E.attendance(p.id);
  const cnt = { da: 0, ent: 0, unent: 0 } as Record<string, number>;
  E.D.sessions.filter(x => x.date <= E.TODAY && diff(x.date, E.TODAY) <= 28).forEach(x => { const st = E.attStatus(x.date, p.id); if (cnt[st] != null) cnt[st]++; });
  const m0 = monday(E.TODAY), dl = E.daily(p.id);
  const wk = [3, 2, 1, 0].map(i => { const w = addDays(m0, -7 * i); return { label: E.de(w), v: sum(Object.keys(dl).filter(d => d >= w && d < addDays(w, 7)).map(d => dl[d])) }; });
  const mins = E.D.sessions.filter(x => x.typ === "Spiel" && x.date <= E.TODAY && !E.absenceOn(p.id, x.date)).slice(-5).map(x => ({ d: x.date, m: E.D.rpe[p.id]?.[x.date]?.min || 0, opp: E.matchOn(x.date)?.gegner || "" }));
  const ex = (E.D.extra[p.id] || []).filter(x => diff(x.date, E.TODAY) <= 7 && x.date <= E.TODAY);
  const abs = E.D.absences.filter(a => a.pid === p.id).sort((a, b) => a.von < b.von ? 1 : -1).slice(0, 6);
  const stK = ["ok", "low", "warn", "crit", "build", "inj"].includes(pr.st) ? pr.st : "none";
  const showLoad = E.mods.belastung && E.playerSees("load");
  return (
    <Screen testID="player-daten">
      <Header title={t("pn_daten")} />
      <Badges g={g} />
      {E.mods.spielanalyse || E.mods.videos ? <MySeason pid={p.id} /> : null}
      {E.mods.beteiligung && E.playerSees("att") ? <Card testID="pd-att">
        <Row between><T v="h3">{t("pd_att")}</T><Muted small>{t("pd_28")}</Muted></Row>
        <Text style={{ fontSize: 40, fontWeight: "800", color: att != null && att >= 0.9 ? c.ok : c.ink, fontVariant: ["tabular-nums"] }}>{att != null ? Math.round(att * 100) + " %" : "–"}</Text>
        <Bar value={att || 0} color={att != null && att >= 0.9 ? c.ok : c.accent} />
        <Row wrap gap={6}><Chip label={`${cnt.da} ${t("at_da")}`} color={c.ok} /><Chip label={`${cnt.ent} ${t("at_ent")}`} color={c.warn} /><Chip label={`${cnt.unent} ${t("at_unent")}`} color={c.crit} /></Row>
      </Card> : null}
      {showLoad ? <Card testID="pd-load">
        <Row between><T v="h3">{t("pd_load")}</T><Info title={t("pd_load")} text={t("tx_src")} /></Row>
        <StatusChip status={stK} label={t("pd_load_" + stK)} />
        <T v="eyebrow">{t("pd_weeks")}</T>
        <WeekBars data={wk} label={t("pd_weeks")} height={130} />
      </Card> : null}
      {E.mods.belastung ? <Card>
        <T v="h3">{t("pd_sleep")}</T>
        <Row gap={8} align="flex-end"><Text style={{ fontSize: 34, fontWeight: "800", color: pr.sl != null && pr.sl < pr.tg[0] ? c.warn : c.ink }}>{pr.sl != null ? E.num(pr.sl, 1) + " h" : "–"}</Text><Muted>{t("pd_sleepAvg")}</Muted></Row>
        <Muted small>{tf("pd_goal", { a: pr.tg[0], b: pr.tg[1] })}</Muted>
      </Card> : null}
      {E.mods.belastung ? <Card>
        <T v="h3">{t("pd_mins")}</T>
        {mins.length ? mins.map(x => <Row key={x.d} between><T v="small">{E.wt(x.d)} {E.de(x.d)} · {x.opp}</T><T bold>{x.m}′</T></Row>) : <Muted>{t("pd_noMins")}</Muted>}
      </Card> : null}
      {E.mods.belastung ? <Card>
        <T v="h3">{t("pd_extra")}</T>
        {ex.length ? ex.map(e => <Row key={e.id} between><T v="small">{E.wt(e.date)} {E.de(e.date)} · {e.label || t("px_" + e.art)}</T><T v="small" bold>{e.min}′ · RPE {e.rpe}</T></Row>) : <Muted>{t("px_none")}</Muted>}
      </Card> : null}
      {E.mods.beteiligung ? <Card>
        <T v="h3">{t("pd_abs")}</T>
        {abs.length ? abs.map(a => <ListItem key={a.id} title={t("ab_" + a.typ) + (a.notiz ? " · " + a.notiz : "")} sub={`${E.de(a.von)} – ${a.bis ? E.de(a.bis) : t("ongoing")}`} />) : <Muted>{t("abs_none")}</Muted>}
      </Card> : null}
      <Col />
    </Screen>
  );
}
