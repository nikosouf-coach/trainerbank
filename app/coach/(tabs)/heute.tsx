// Trainer – Heute: eine Frage – was ist jetzt wichtig? Oben die nächste Einheit (das eine kräftige Element der Seite),
// darunter Bereiche als Gruppen: „Heute wichtig“ (alles Offene je eine Zeile), Belastung im Team (führt auf die
// Detailseite mit Zonen, Vorschlägen und Hintergrund), die Woche, Vorbereitung und KI-Coach. Weitere Karten
// (Spieltag-Check, Aufgaben, Posteingang, Braucht Aufmerksamkeit, Abwesende, Events, letzte Einheit, Team-Wochenlast)
// lassen sich unter „Startseite anpassen“ dazuschalten.
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { addDays, monday, sum } from "../../../src/core/dates";
import { useEngine, useStore } from "../../../src/data/store";
import { AiPanel } from "../../../src/ui/ai";
import { WeekBars, WeekStrip } from "../../../src/ui/charts";
import { Bar, Btn, Chip, Col, Fold, Group, Header, Info, ListItem, Muted, NavRow, Row, Screen, Section, Sheet, T } from "../../../src/ui/kit";
import { CustomizeLinks, DashEditor, useDash } from "../../../src/ui/dashboard";
import { FocusCard } from "../../../src/ui/focus";
import { MenuEditor } from "../../../src/ui/navEditor";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { teamLabel } from "../../../src/core/classes";
import { firstName, greetKey } from "../../../src/core/people";
import { MyTasksCard } from "../../../src/ui/day/MyTasks";
import { MatchdayCard } from "../../../src/ui/matchday";
import { TeamStatusCard } from "../../../src/ui/teamStatus";
import { TeamLogo } from "../../../src/ui/teamLogo";
import { CoachPhaseCard } from "../../../src/ui/prep";
import { InboxCard } from "../../../src/ui/inbox";
import { ViaClubBanner } from "../../../src/ui/club";
import { Icon, type IconName } from "../../../src/ui/icons";
import { longDate } from "../../../src/ui/insight";
import { radius, statusColor, useTheme } from "../../../src/ui/theme";

/** Eine Angabe im Hauptelement: Symbol und Wert (statt Kapseln mit Trennpunkten) */
function Fact({ icon, label, color }: { icon: IconName; label: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon name={icon} size={15} color={color} strokeWidth={2.1} />
      <Text style={{ color, fontSize: 14.5, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{label}</Text>
    </View>
  );
}

export default function Heute() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const sheets = usePlanSheets(); const { width } = useWindowDimensions();
  const dash = useDash(); const [editDash, setEditDash] = useState(false); const [editMenu, setEditMenu] = useState(false); const [aiOpen, setAiOpen] = useState(false);
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
    return { prs, nx, last, da, avl, missing, attn, wp, evUp, team };
  }, [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const { nx, last, da, avl, missing, attn, wp, evUp, team } = data;

  const gruss = t(greetKey(E.NOW.getHours())), myName = firstName(s.myStaff?.name || s.user?.displayName);
  const absN = nx ? E.absentOn(nx.date) : [];
  const nxTitle = nx ? (nx.match ? `${t("vs")} ${nx.match.gegner}` : E.kn(nx.train!.kind)) : "";
  const when = nx ? (nx.i === 0 ? t("today") : nx.i === 1 ? t("tomorrow") : E.wt(nx.date) + " " + E.de(nx.date)) : "";

  // Nächste Einheit: Titel groß, darunter die vier wichtigsten Angaben (Inhalt und Details auf der Tagesseite)
  const ink = c.accentInk, sub = ink === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.64)";
  const hero = nx ? (
    <Pressable testID="today-next" accessibilityRole="button" accessibilityLabel={`${nx.match ? t("nextMatch") : t("next")}, ${when}: ${nxTitle}`} onPress={() => router.push("/coach/tag/" + nx.date)}
      style={({ pressed }) => ({ backgroundColor: c.accent, borderRadius: radius.xl, paddingVertical: 18, paddingHorizontal: 20, gap: 10, opacity: pressed ? 0.92 : 1 })}>
      <Row between>
        <Text style={{ color: sub, fontSize: 14, fontWeight: "600" }}>{nx.match ? t("nextMatch") : t("next")} · {when}</Text>
        <Icon name="chevron" size={18} color={sub} strokeWidth={2.2} />
      </Row>
      <Text numberOfLines={2} style={{ color: ink, fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9 }}>{nxTitle}</Text>
      <Row wrap gap={16} style={{ rowGap: 6 }}>
        {nx.match ? <>
          <Fact icon="clock" color={ink} label={nx.match.zeit} />
          <Fact icon="home" color={ink} label={nx.match.heim ? t("home") : t("away")} />
        </> : <>
          <Fact icon="clock" color={ink} label={E.zeitOf(nx.date)} />
          <Fact icon="stopwatch" color={ink} label={`${nx.train!.dauer} ${t("min")}`} />
          {E.lvl(1) && !kids ? <Fact icon="bolt" color={ink} label={`${E.intWord(nx.train!.rpe)} · RPE ${nx.train!.rpe}`} /> : null}
        </>}
        <Fact icon="people" color={ink} label={`${E.D.players.length - absN.length} ${t("avail")}`} />
      </Row>
      {nx.train?.notReady.length ? (
        <Row gap={7} style={{ marginTop: 2 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ink, opacity: 0.85 }} />
          <Text style={{ color: sub, fontSize: 13.5, fontWeight: "600" }}>{tf(nx.train.notReady.length === 1 ? "notReady1" : "notReadyN", { n: nx.train.notReady.length })}</Text>
        </Row>
      ) : null}
    </Pressable>
  ) : null;

  // ---------- Karten (Reihenfolge und Auswahl: „Startseite anpassen“) ----------
  const attnCard = (
    <Fold testID="today-attn" title={t("attn")} count={attn.length} countColor={attn.some(x => x.st === "crit") ? c.crit : attn.length ? c.warn : undefined}
      summary={attn.length ? <Row gap={6} wrap>{attn.slice(0, 8).map(x => <PlayerAvatar key={x.p.id} p={x.p} size={30} status={x.st} />)}{attn.length > 8 ? <Muted small>{tf("db_more", { n: attn.length - 8 })}</Muted> : null}</Row> : <Muted small>{t("db_attnNone")}</Muted>}>
      {attn.length ? attn.map(x => (
        <ListItem key={x.p.id} testID={"attn-" + x.p.id} title={`${E.name(x.p)}`} sub={`${E.age(x.p)} ${t("years")} · ${x.p.pos}`}
          left={<PlayerAvatar p={x.p} size={40} status={x.st} />} onPress={() => router.push("/coach/spieler/" + x.p.id)}>
          <Row wrap gap={4}>{x.reasons.map(([k, r], i) => <Chip key={i} label={r} color={statusColor(c, k.replace(/^k-/, ""))} />)}</Row>
        </ListItem>
      )) : <Muted>{t("allgreen")}</Muted>}
    </Fold>
  );

  const absentCard = nx ? (
    <Fold testID="today-absent" title={t("absentNext")} count={absN.length}
      summary={absN.length ? <Muted small>{absN.slice(0, 5).map(p => p.vn + " " + (p.nn || " ")[0] + ".").join(", ")}{absN.length > 5 ? " " + tf("db_more", { n: absN.length - 5 }) : ""}</Muted> : <Muted small>{t("db_absNone")}</Muted>}>
      {absN.length ? absN.map(p => { const a = E.absenceOn(p.id, nx.date)!; return <ListItem key={p.id} title={E.name(p)} sub={t("ab_" + a.typ) + (a.bis ? " · " + t("until") + " " + E.de(a.bis) : "")} left={<PlayerAvatar p={p} size={32} />} onPress={() => router.push("/coach/spieler/" + p.id)} />; })
        : <Muted>{t("db_absNone")}</Muted>}
    </Fold>
  ) : null;

  const eventsCard = evUp.length ? (
    <Section title={t("upEvents")} testID="today-events">
      {evUp.map(e => <NavRow key={e.id} icon="calendar" iconColor={c.event} title={e.titel} sub={`${E.wt(e.date)} ${E.de(e.date)}${e.zeit ? " · " + e.zeit : ""}`} onPress={() => sheets.open({ k: "add", date: e.date, type: "event", obj: e })} />)}
    </Section>
  ) : null;

  // Letzte Einheit: Titel über der Fläche wie alle Bereiche, Datum rechts daneben
  const lastCard = (
    <Section testID="today-last" title={t("last")} pad
      right={last ? <Muted small>{E.wt(last.date)} {E.de(last.date)} · {last.typ === "Spiel" ? t("it_match") : t("it_training")}</Muted> : undefined}>
      {last ? <>
        {mods.beteiligung ? <Col gap={6}><Row between><T>{t("part")}</T><T bold>{da} / {avl}</T></Row><Bar value={avl ? da / avl : 0} color={c.ok} /></Col> : null}
        {mods.belastung ? <Col gap={4}>
          <Row between><T>{t("rpeSub")}</T><T bold>{da - missing.length} / {da}</T></Row>
          {missing.length ? <Muted small>{t("missing")}: {missing.map(p => p.vn + " " + (p.nn || " ")[0] + ".").join(", ")}</Muted> : null}
        </Col> : null}
        {mods.beteiligung ? <Btn testID="today-att" label={t("viewAtt")} onPress={() => router.push("/coach/einheit/" + last.date)} style={{ alignSelf: "flex-start" }} /> : null}
      </> : <Muted>{t("noSession")}</Muted>}
    </Section>
  );

  const loadCard = mods.belastung && E.lvl(2) ? (
    <Section title={t("teamLoad")} info={<Info title={t("teamLoad")} text={t("teamLoadNote")} />} testID="today-load" pad>
      <WeekBars data={team} label={t("teamLoad")} />
    </Section>
  ) : null;

  const weekCard = (
    <Section testID="today-week" title={t("thisWeek")} pad
      action={{ label: mods.planung ? t("nav_plan") : t("nav_kalender"), onPress: () => router.push(mods.planung ? "/coach/plan" : "/coach/kalender"), testID: "today-week-open" }}>
      <WeekStrip testID="today-day" onDay={i => router.push("/coach/tag/" + wp.items[i].date)}
        days={wp.items.map(x => ({ label: E.wt(x.date), md: x.md, rpe: x.match ? 8 : x.train ? x.train.rpe : 0, match: !!x.match, today: x.date === E.TODAY }))} />
    </Section>
  );

  // KI-Coach: auf der Startseite nur ein Eintrag – das Gespräch öffnet sich als Blatt
  const aiCard = mods.ki ? (
    <Group>
      <NavRow testID="ai-open" icon="spark" title={t("ki_title")} sub={t("fc_aiSub")} onPress={() => setAiOpen(true)} />
    </Group>
  ) : null;

  const cards: Record<string, React.ReactNode> = {
    next: hero, focus: <FocusCard />, matchday: <MatchdayCard />, tasks: <MyTasksCard />, inbox: <InboxCard />, phase: <CoachPhaseCard />, status: mods.belastung ? <TeamStatusCard /> : null,
    attn: attnCard, absent: absentCard, week: weekCard, events: eventsCard, last: lastCard, load: loadCard, ai: aiCard,
  };
  const wide = width >= 1000, rest = dash.order.filter(k => k !== "next" && !!cards[k]);
  const available = (k: string): boolean => ({ focus: true, matchday: true, inbox: !!mods.entwicklung || !!mods.chat, status: !!mods.belastung, load: !!mods.belastung && E.lvl(2), phase: !!mods.vorbereitung, ai: !!mods.ki, tasks: true } as Record<string, boolean>)[k] ?? true;

  return (
    <Screen testID="coach-heute">
      <Header eyebrow={`${longDate(E, E.TODAY)} · ${teamLabel(E.team)}`} title={myName ? `${gruss}, ${myName}` : gruss}
        aside={<TeamLogo size={46} />} />
      <ViaClubBanner />
      {/* Breiter Bildschirm (Tablet, Laptop): nächste Einheit über die ganze Breite, die übrigen Bereiche in zwei Spalten
          (Reihenfolge bleibt zeilenweise erhalten) */}
      {wide ? <>
        {dash.order.includes("next") && hero ? hero : null}
        <Row align="flex-start" gap={20}>
          {[0, 1].map(col => (
            <Col key={col} gap={20} style={{ flex: 1, minWidth: 0 }}>
              {rest.filter((_, i) => i % 2 === col).map(k => <React.Fragment key={k}>{cards[k]}</React.Fragment>)}
            </Col>
          ))}
        </Row>
      </> : dash.order.map(k => cards[k] ? <React.Fragment key={k}>{cards[k]}</React.Fragment> : null)}
      <CustomizeLinks onDash={() => setEditDash(true)} onBar={() => setEditMenu(true)} />
      <Sheet visible={aiOpen} onClose={() => setAiOpen(false)} title={t("ki_title")} testID="ai-sheet" closeLabel={t("close")}>
        {aiOpen ? <AiPanel mode="coach" testID="ai" context={() => E.aiContext(pid => s.aiPlayers.includes(pid))} quick={["ki_q1", "ki_q2", "ki_q3"]} placeholder={t("ki_ph")} note={t("ki_note")}
          onQuick={k => { if (k === "ki_q1" && nx?.train) { setAiOpen(false); sheets.open({ k: "ai", date: nx.date }); return true; } return false; }} /> : null}
      </Sheet>
      <DashEditor visible={editDash} onClose={() => setEditDash(false)} available={available}
        extra={<Btn small testID="dash-to-menu" icon="grid" label={t("tip_bar")} onPress={() => { setEditDash(false); setEditMenu(true); }} style={{ alignSelf: "flex-start" }} />} />
      <MenuEditor visible={editMenu} onClose={() => setEditMenu(false)} />
      {sheets.el}
    </Screen>
  );
}
