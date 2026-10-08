// Trainer – Heute: nächster Termin, KI-Coach, Woche, Ampel, Spieler mit Handlungsbedarf, letzte Einheit, Teamlast.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { addDays, monday, sum } from "../../../src/core/dates";
import { useEngine, useStore } from "../../../src/data/store";
import { AiPanel } from "../../../src/ui/ai";
import { WeekBars, WeekStrip } from "../../../src/ui/charts";
import { Bar, Btn, Card, CardTitle, Chip, Col, Divider, Header, Info, ListItem, Muted, Row, Screen, T } from "../../../src/ui/kit";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { teamLabel } from "../../../src/core/classes";
import { firstName, greetKey } from "../../../src/core/people";
import { TeamLogo } from "../../../src/ui/teamLogo";
import { CoachPhaseCard } from "../../../src/ui/prep";
import { radius, space, statusColor, useTheme, withAlpha } from "../../../src/ui/theme";

function HeroPill({ label }: { label: string }) {
  return <View style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 12.5 }}>{label}</Text></View>;
}

export default function Heute() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { width } = useWindowDimensions(); const wide = width >= 900;
  const sheets = usePlanSheets();
  const mods = E.mods, kids = E.grp === "u11";

  const data = useMemo(() => {
    const prs = E.D.players.map(p => E.profile(p.id));
    const nx = E.nextItem(), last = E.D.sessions.filter(x => x.date <= E.TODAY).at(-1);
    const st = last ? E.D.players.map(p => E.attStatus(last.date, p.id)) : [];
    const da = st.filter(x => x === "da").length, avl = st.filter(x => x !== "abs:verletzung" && x !== "abs:krank").length;
    const missing = last && mods.belastung ? E.D.players.filter(p => E.attStatus(last.date, p.id) === "da" && !E.D.rpe[p.id]?.[last.date]) : [];
    const rank = (x: typeof prs[number]) => x.st === "crit" ? 0 : x.reasons.some(r => r[0] === "k-crit") ? 1 : x.st === "inj" ? 3 : 2;
    const attn = prs.filter(x => x.reasons.length).sort((a, b) => rank(a) - rank(b));
    const wp = E.weekPlan(monday(E.TODAY));
    const evUp = E.D.events.filter(e => e.date >= E.TODAY && e.date <= addDays(E.TODAY, 14)).sort((a, b) => a.date < b.date ? -1 : 1);
    const m0 = monday(E.TODAY), weeks = [5, 4, 3, 2, 1, 0].map(i => addDays(m0, -7 * i));
    const team = weeks.map(w => { const per = E.D.players.map(p => { const dl = E.daily(p.id); return sum(Object.keys(dl).filter(d => d >= w && d < addDays(w, 7)).map(d => dl[d])); }).filter(x => x > 0); return { label: E.de(w), v: per.length ? sum(per) / per.length : 0 }; });
    const count = (k: string) => prs.filter(x => x.st === k).length;
    return { prs, nx, last, da, avl, missing, attn, wp, evUp, team, count };
  }, [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const { nx, last, da, avl, missing, attn, wp, evUp, team, count } = data;

  const gruss = t(greetKey(E.NOW.getHours())), myName = firstName(s.myStaff?.name || s.user?.displayName);
  const absN = nx ? E.absentOn(nx.date) : [];
  const nxTitle = nx ? (nx.match ? `${t("vs")} ${nx.match.gegner}` : E.kn(nx.train!.kind)) : "";
  const nxSub = nx?.train ? nx.train.inhalt : "";
  const when = nx ? (nx.i === 0 ? t("today") : nx.i === 1 ? t("tomorrow") : E.wt(nx.date) + " " + E.de(nx.date)) : "";

  const hero = nx ? (
    <Pressable testID="today-next" accessibilityRole="button" onPress={() => sheets.open({ k: "day", date: nx.date })}
      style={{ backgroundColor: c.accent, borderRadius: radius.xl, padding: space.l + 2, gap: 10 }}>
      <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{nx.match ? t("nextMatch") : t("next")} · {when}</Text>
      <Text numberOfLines={2} style={{ color: "#fff", fontSize: 26, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 }}>{nxTitle}</Text>
      {nxSub ? <Text numberOfLines={3} style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20 }}>{nxSub}</Text> : null}
      <Row wrap gap={6}>
        {nx.match ? <>
          <HeroPill label={nx.match.zeit} /><HeroPill label={nx.match.heim ? t("home") : t("away")} /><HeroPill label={t("comp_" + nx.match.comp)} />
        </> : <>
          {nx.train!.md ? <HeroPill label={nx.train!.md} /> : null}
          <HeroPill label={`${E.zeitOf(nx.date)} · ${nx.train!.dauer} ${t("min")}`} />
          {E.lvl(1) && !kids ? <HeroPill label={`${t("intensity")}: ${E.intWord(nx.train!.rpe)} · RPE ${nx.train!.rpe}`} /> : null}
          {nx.train!.notReady.length ? <HeroPill label={"⚠ " + tf("notReadyN", { n: nx.train!.notReady.length })} /> : null}
        </>}
        <HeroPill label={`${E.D.players.length - absN.length} ${t("avail")}`} />
      </Row>
    </Pressable>
  ) : null;

  const tiles = mods.belastung ? (
    <Row gap={8} wrap>
      {(["crit", "warn", "ok", "low", "inj"] as const).map(k => {
        const col = statusColor(c, k);
        return (
          <Pressable key={k} testID={"tile-" + k} accessibilityRole="button" accessibilityLabel={`${t("st_" + k)}: ${count(k)}`} onPress={() => router.push("/coach/kader?filter=" + k)}
            style={{ flexGrow: 1, flexBasis: 100, backgroundColor: withAlpha(col, 0.1), borderWidth: 1, borderColor: withAlpha(col, 0.35), borderRadius: radius.l, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: col, fontVariant: ["tabular-nums"] }}>{count(k)}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: c.ink }}>{t("st_" + k)}</Text>
          </Pressable>
        );
      })}
    </Row>
  ) : null;

  const attnCard = (
    <Card testID="today-attn" style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("attn")} right={<Muted>{String(attn.length)}</Muted>} />
      {attn.length ? attn.slice(0, 10).map(x => (
        <ListItem key={x.p.id} testID={"attn-" + x.p.id} title={`${E.name(x.p)}`} sub={`${E.age(x.p)} ${t("years")} · ${x.p.pos}`}
          left={<PlayerAvatar p={x.p} size={40} status={x.st} />} onPress={() => router.push("/coach/spieler/" + x.p.id)}>
          <Row wrap gap={4}>{x.reasons.map(([k, r], i) => <Chip key={i} label={r} color={statusColor(c, k.replace(/^k-/, ""))} />)}</Row>
        </ListItem>
      )) : <Muted>{t("allgreen")}</Muted>}
    </Card>
  );

  const sideCard = (
    <Card testID="today-side" style={{ flex: wide ? 1 : undefined }}>
      {absN.length && nx ? <Col gap={4}>
        <T v="h3">{t("absentNext")}</T>
        {absN.map(p => { const a = E.absenceOn(p.id, nx.date)!; return <ListItem key={p.id} title={E.name(p)} sub={t("ab_" + a.typ) + (a.bis ? " · " + t("until") + " " + E.de(a.bis) : "")} left={<PlayerAvatar p={p} size={32} />} onPress={() => router.push("/coach/spieler/" + p.id)} />; })}
        <Divider />
      </Col> : null}
      {evUp.length ? <Col gap={4}>
        <T v="h3">{t("upEvents")}</T>
        {evUp.map(e => <ListItem key={e.id} title={`${E.wt(e.date)} ${E.de(e.date)}${e.zeit ? " · " + e.zeit : ""}`} sub={e.titel} onPress={() => sheets.open({ k: "add", date: e.date, type: "event", obj: e })} />)}
        <Divider />
      </Col> : null}
      {last ? <Col gap={10}>
        <Row between wrap><T v="h3">{t("last")}</T><Muted small>{E.wt(last.date)} {E.de(last.date)} · {last.typ === "Spiel" ? t("it_match") : t("it_training")}</Muted></Row>
        {mods.beteiligung ? <Col gap={6}><Row between><T>{t("part")}</T><T bold>{da} / {avl}</T></Row><Bar value={avl ? da / avl : 0} color={c.ok} /></Col> : null}
        {mods.belastung ? <Col gap={4}>
          <Row between><T>{t("rpeSub")}</T><T bold>{da - missing.length} / {da}</T></Row>
          {missing.length ? <Muted small>{t("missing")}: {missing.map(p => p.vn + " " + (p.nn || " ")[0] + ".").join(", ")}</Muted> : null}
        </Col> : null}
        {mods.beteiligung ? <Btn testID="today-att" label={t("viewAtt")} onPress={() => router.push("/coach/einheit/" + last.date)} style={{ alignSelf: "flex-start" }} /> : null}
      </Col> : <Muted>{t("noSession")}</Muted>}
      {mods.belastung && E.lvl(2) ? <Col gap={6}>
        <Divider />
        <Row between><T v="h3">{t("teamLoad")}</T><Info title={t("teamLoad")} text={t("teamLoadNote")} /></Row>
        <WeekBars data={team} label={t("teamLoad")} />
      </Col> : null}
    </Card>
  );

  return (
    <Screen testID="coach-heute">
      <Header eyebrow={`${E.wt(E.TODAY)} ${E.de(E.TODAY)} · ${teamLabel(E.team)}`} title={myName ? `${gruss}, ${myName}` : gruss}
        right={<TeamLogo size={46} />} />
      {hero}
      <CoachPhaseCard />
      {mods.ki ? <AiPanel mode="coach" testID="ai" context={() => E.aiContext(pid => s.aiPlayers.includes(pid))} quick={["ki_q1", "ki_q2", "ki_q3"]} placeholder={t("ki_ph")} note={t("ki_note")}
        onQuick={k => { if (k === "ki_q1" && nx?.train) { sheets.open({ k: "ai", date: nx.date }); return true; } return false; }} /> : null}
      <Card>
        <CardTitle title={t("thisWeek")} right={<Btn small kind="ghost" label={(mods.planung ? t("nav_plan") : t("nav_kalender")) + " ›"} onPress={() => router.push(mods.planung ? "/coach/plan" : "/coach/kalender")} />} />
        <WeekStrip days={wp.items.map(x => ({ label: E.wt(x.date), md: x.md, rpe: x.match ? 8 : x.train ? x.train.rpe : 0, match: !!x.match, today: x.date === E.TODAY }))} />
      </Card>
      {tiles}
      {wide ? <Row align="flex-start" gap={18}>{attnCard}{sideCard}</Row> : <>{attnCard}{sideCard}</>}
      {sheets.el}
    </Screen>
  );
}
