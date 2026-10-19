// Trainer – Entwicklung im Team: wer wurde wann eingeschätzt, welche Ziele laufen, welche Gespräche stehen an.
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { addDays } from "../../../src/core/dates";
import { assessmentsOf, goalProgress, goalsOf, openRequests } from "../../../src/core/dev";
import { useEngine } from "../../../src/data/store";
import { Banner, Bar, Card, Chip, Header, Info, ListItem, Muted, Row, Screen, Seg } from "../../../src/ui/kit";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { useTheme } from "../../../src/ui/theme";
import { Pressable, Text, View } from "react-native";
import { useNavBack } from "../../../src/ui/nav";

export default function EntwicklungTeam() {
  const nb = useNavBack("entwicklung");
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [filter, setFilter] = useState<"all" | "todo">("all");
  const rows = useMemo(() => E.D.players.map(p => {
    const coach = assessmentsOf(E.D, p.id, "coach")[0], self = assessmentsOf(E.D, p.id, "self")[0];
    const goals = goalsOf(E.D, p.id).filter(g => g.status === "active"), behind = goals.filter(g => goalProgress(E.D, g, E.TODAY).behind).length;
    const talk = E.D.talks.filter(x => x.pid === p.id).sort((a, b) => a.date < b.date ? 1 : -1)[0];
    const selfNew = !!self && (!coach || self.date > coach.date);
    const stale = !coach || coach.date < addDays(E.TODAY, -90);
    const due = !!talk?.next && talk.next <= addDays(E.TODAY, 7);
    // To-do: neue Selbsteinschätzung, Gespräch fällig (7 Tage), Ziel hinter Plan, noch nie bzw. lange nicht eingeschätzt (mit laufenden Zielen)
    return { p, coach, self, goals, behind, talk, selfNew, stale, due, todo: selfNew || due || behind > 0 || (stale && goals.length > 0) };
  }), [E]);
  const list = filter === "todo" ? rows.filter(r => r.todo) : rows;
  // Überblick: wie viele aktuell eingeschätzt (90 Tage), mit laufenden Zielen, Gespräche fällig
  const n = rows.length, assessed = rows.filter(r => !r.stale).length, withGoals = rows.filter(r => r.goals.length).length, talksDue = rows.filter(r => r.due).length;
  const kpi = (k: string, label: string, v: number, of: number | null, col: string) => (
    <View key={k} testID={"dev-sum-" + k} style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text numberOfLines={2} style={{ fontSize: 11, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{v}{of != null ? <Text style={{ fontSize: 14, color: c.muted }}> / {of}</Text> : null}</Text>
      {of != null ? <Bar value={of ? v / of : 0} color={col} /> : null}
    </View>
  );
  const iq = openRequests(E.D).length;
  return (
    <Screen testID="coach-dev-team">
      <Header title={t("dv_overview")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("dv_overview")} text={[t("dv_ovInfo"), t("dv_info")]} />} />
      {!E.mods.entwicklung ? <Muted>{tf("bk_needs", { m: t("m_entwicklung") })}</Muted> : <>
        {iq ? <Pressable testID="dev-team-iq" accessibilityRole="button" onPress={() => router.push("/coach/individual")}><Banner>{t("iq_open")}: {iq} ›</Banner></Pressable> : null}
        {n ? <Card testID="dev-team-sum"><Row gap={14} align="flex-start">
          {kpi("assessed", t("dv_sumAssessed"), assessed, n, c.ok)}
          {kpi("goals", t("dv_sumGoals"), withGoals, n, c.accent)}
          {kpi("talks", t("dv_sumTalks"), talksDue, null, c.warn)}
        </Row></Card> : null}
        <Seg testID="dev-filter" value={filter} onChange={setFilter} options={[{ key: "all", label: t("dv_ovFilter_all") }, { key: "todo", label: `${t("dv_ovFilter_todo")} · ${rows.filter(r => r.todo).length}` }]} />
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          {list.length ? list.map(r => (
            <ListItem key={r.p.id} testID={"dev-row-" + r.p.id} left={<PlayerAvatar p={r.p} size={40} />} title={E.name(r.p)} sub={`${r.p.pos} · ${t("dv_ovLast")}: ${r.coach ? E.de(r.coach.date) : t("dv_ovNever")}`}
              onPress={() => router.push("/coach/entwicklung/" + r.p.id)}>
              <Row wrap gap={4}>
                {r.selfNew ? <Chip label={t("dv_ovSelfNew")} color={c.warn} /> : null}
                {r.goals.length ? <Chip label={`${t("dv_ovGoals")}: ${r.goals.length}`} color={c.ok} /> : null}
                {r.behind ? <Chip label={tf("dv_ovBehind", { n: r.behind })} color={c.warn} /> : null}
                {r.talk?.next ? <Chip label={`${t("dv_ovTalk")}: ${E.de(r.talk.next)}${r.due ? " · " + t("dv_ovDue") : ""}`} color={r.due ? c.warn : c.event} /> : null}
              </Row>
            </ListItem>
          )) : <Muted style={{ paddingVertical: 12 }}>{t("dv_ovTodoNone")}</Muted>}
        </Card>
      </>}
    </Screen>
  );
}
