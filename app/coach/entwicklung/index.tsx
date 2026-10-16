// Trainer – Entwicklung im Team: wer wurde wann eingeschätzt, welche Ziele laufen, welche Gespräche stehen an.
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { addDays } from "../../../src/core/dates";
import { assessmentsOf, goalProgress, goalsOf, openRequests } from "../../../src/core/dev";
import { useEngine } from "../../../src/data/store";
import { Banner, Card, Chip, Header, Info, ListItem, Muted, Row, Screen, Seg } from "../../../src/ui/kit";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { useTheme } from "../../../src/ui/theme";
import { Pressable } from "react-native";

export default function EntwicklungTeam() {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [filter, setFilter] = useState<"all" | "todo">("all");
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/mehr");
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
  const iq = openRequests(E.D).length;
  return (
    <Screen testID="coach-dev-team">
      <Header title={t("dv_overview")} onBack={back} backLabel={t("mo_title")} info={<Info title={t("dv_overview")} text={[t("dv_ovInfo"), t("dv_info")]} />} />
      {!E.mods.entwicklung ? <Muted>{tf("bk_needs", { m: t("m_entwicklung") })}</Muted> : <>
        {iq ? <Pressable testID="dev-team-iq" accessibilityRole="button" onPress={() => router.push("/coach/individual")}><Banner>{t("iq_open")}: {iq} ›</Banner></Pressable> : null}
        <Seg testID="dev-filter" value={filter} onChange={setFilter} options={[{ key: "all", label: t("dv_ovFilter_all") }, { key: "todo", label: `${t("dv_ovFilter_todo")} · ${rows.filter(r => r.todo).length}` }]} />
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          {list.length ? list.map(r => (
            <ListItem key={r.p.id} testID={"dev-row-" + r.p.id} left={<PlayerAvatar p={r.p} size={40} />} title={E.name(r.p)} sub={`${r.p.pos} · ${t("dv_ovLast")}: ${r.coach ? E.de(r.coach.date) : t("dv_ovNever")}`}
              onPress={() => router.push("/coach/entwicklung/" + r.p.id)}>
              <Row wrap gap={4}>
                {r.selfNew ? <Chip label={t("dv_ovSelfNew")} color={c.warn} /> : null}
                <Chip label={`${t("dv_ovGoals")}: ${r.goals.length}`} color={r.goals.length ? c.ok : c.build} />
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
