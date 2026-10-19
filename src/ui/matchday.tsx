// Startseite Trainer: „Spieltag-Check“ fürs nächste Spiel (bis 7 Tage vorher) – alles, was vor dem Anpfiff
// organisiert sein muss, auf einen Blick: Matchplan (angelegt, freigegeben, gesehen), Aufstellung, Ausfälle,
// Belastung (überlastete Spieler dosieren), Dienste am Spieltag und offene Aufgaben. Jede Zeile führt direkt hin.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays } from "../core/dates";
import { changedSincePublish, seenStats, shareState, squadOf } from "../core/matchplan";
import { useEngine } from "../data/store";
import { Card, Col, Row, T } from "./kit";
import { Icon } from "./icons";
import { dutyName } from "./tasks/widgets";
import { radius, useTheme, withAlpha } from "./theme";

type State = "ok" | "todo" | "warn" | "info";
interface Check { k: string; state: State; title: string; sub?: string; href?: string }

/** Nächstes Spiel ohne Ergebnis in den nächsten 7 Tagen */
export function useNextMatch() {
  const E = useEngine();
  return useMemo(() => E.D.matches.filter(m => m.date >= E.TODAY && m.date <= addDays(E.TODAY, 7) && !m.result).sort((a, b) => (a.date + a.zeit < b.date + b.zeit ? -1 : 1))[0] || null, [E]);
}

export function MatchdayCard() {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const m = useNextMatch();
  const checks = useMemo((): Check[] => {
    if (!m) return [];
    const L: Check[] = [];
    const names = (ids: string[]) => ids.map(id => E.P(id)).filter(Boolean).slice(0, 4).map(p => p!.vn).join(", ") + (ids.length > 4 ? " " + tf("db_more", { n: ids.length - 4 }) : "");
    const plan = E.mods.matchplan ? E.D.plans.find(p => p.matchId === m.id) || null : null;
    const absent = E.absentOn(m.date).map(p => p.id);
    // Matchplan
    if (E.mods.matchplan) {
      if (!plan) L.push({ k: "plan", state: "todo", title: t("md_planNone"), sub: t("md_planNoneSub"), href: "/coach/matchplaene" });
      else {
        const st = shareState(plan, E.NOW), rec = plan.share?.squadOnly ? squadOf(plan.c) : E.D.players.map(p => p.id);
        if (st === "live") {
          const seen = seenStats((E.D.planLogs[plan.id] || []).filter(l => !plan.publishedAt || l.at >= plan.publishedAt), rec).seen.length;
          L.push(changedSincePublish(plan)
            ? { k: "plan", state: "warn", title: t("md_planChanged"), sub: t("md_planChangedSub"), href: "/coach/matchplan/" + plan.id + "?tab=share" }
            : { k: "plan", state: "ok", title: t("md_planLive"), sub: tf("mp_seen", { n: seen, m: rec.length }), href: "/coach/matchplan/" + plan.id + "?tab=share" });
        } else L.push({ k: "plan", state: "todo", title: t("md_planDraft"), sub: st === "scheduled" ? t("md_planScheduled") : t("md_planDraftSub"), href: "/coach/matchplan/" + plan.id + "?tab=share" });
        // Aufstellung: Positionen besetzt, Ausfälle in der Startelf
        const slots = plan.c.lineup.length, filled = plan.c.lineup.filter(x => x.pid).length;
        const outXI = plan.c.lineup.filter(x => x.pid && absent.includes(x.pid)).map(x => x.pid!);
        L.push(outXI.length
          ? { k: "lineup", state: "warn", title: tf("md_lineupOut", { n: outXI.length }), sub: names(outXI), href: "/coach/matchplan/" + plan.id }
          : filled < slots
            ? { k: "lineup", state: "todo", title: tf("md_lineupOpen", { n: filled, m: slots }), sub: t("md_lineupOpenSub"), href: "/coach/matchplan/" + plan.id }
            : { k: "lineup", state: "ok", title: tf("md_lineupOk", { f: plan.c.formation }), sub: tf("md_bench", { n: plan.c.bench.length }), href: "/coach/matchplan/" + plan.id });
      }
    }
    // Verfügbarkeit
    L.push(absent.length
      ? { k: "absent", state: "info", title: tf("md_absent", { n: absent.length, a: E.D.players.length - absent.length }), sub: names(absent), href: "/coach/kader?filter=inj" }
      : { k: "absent", state: "ok", title: tf("md_allAvail", { n: E.D.players.length }) });
    // Belastung (Sportwissenschaft): überlastete Spieler im Spiel dosieren
    if (E.mods.belastung) {
      const crit = E.D.players.filter(p => !absent.includes(p.id) && E.profile(p.id).st === "crit").map(p => p.id);
      L.push(crit.length
        ? { k: "load", state: "warn", title: tf(crit.length === 1 ? "md_load1" : "md_load", { n: crit.length }), sub: names(crit) + " · " + t("md_loadSub"), href: "/coach/kader?filter=crit" }
        : { k: "load", state: "ok", title: t("md_loadOk") });
    }
    // Dienste am Spieltag (wenn ein Dienstplan eingerichtet ist)
    if ((E.team.settings.duties || []).length) {
      const ds = E.D.duties.filter(d => d.date === m.date && d.status !== "waived");
      L.push(ds.length
        ? { k: "duties", state: "ok", title: tf("md_duties", { n: ds.length }), sub: ds.slice(0, 3).map(d => `${dutyName(E, d.duty)}: ${E.P(d.pid)?.vn || "?"}`).join(" · "), href: "/coach/aufgaben" }
        : { k: "duties", state: "todo", title: t("md_dutiesNone"), sub: t("md_dutiesNoneSub"), href: "/coach/aufgaben" });
    }
    // offene Aufgaben bis zum Spiel
    const open = E.D.tasks.filter(x => !x.pid && !x.done && x.due && x.due <= m.date);
    if (open.length) L.push({ k: "tasks", state: "todo", title: tf(open.length === 1 ? "md_tasks1" : "md_tasks", { n: open.length }), sub: open.slice(0, 2).map(x => x.title).join(" · "), href: "/coach/aufgaben" });
    return L;
  }, [E, m]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return null;
  const done = checks.filter(x => x.state === "ok" || x.state === "info").length;
  const days = Math.round((new Date(m.date + "T12:00:00").getTime() - new Date(E.TODAY + "T12:00:00").getTime()) / 864e5);
  const when = days === 0 ? t("today") : days === 1 ? t("tomorrow") : tf("md_inDays", { n: days });
  const icon = (st: State) => {
    const col = st === "ok" ? c.ok : st === "warn" ? c.warn : st === "info" ? c.build : c.accentTx;
    return (
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: st === "todo" ? "transparent" : withAlpha(col, 0.15), borderWidth: st === "todo" ? 2 : 0, borderColor: col, borderStyle: "dashed" }}>
        {st === "ok" ? <Icon name="check" size={15} color={col} strokeWidth={2.6} /> : st === "warn" ? <Text style={{ fontWeight: "900", color: col, fontSize: 14 }}>!</Text> : st === "info" ? <Text style={{ fontWeight: "900", color: col, fontSize: 13 }}>i</Text> : null}
      </View>
    );
  };
  return (
    <Card testID="today-matchday">
      <Row between align="flex-start" gap={8}>
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <T v="eyebrow">{t("md_title")} · {when}</T>
          <T v="h3" numberOfLines={1}>{t("vs")} {m.gegner}</T>
          <Text style={{ fontSize: 12.5, color: c.muted }}>{E.wt(m.date)} {E.de(m.date)} · {m.zeit} · {m.heim ? t("home") : t("away")} · {t("comp_" + m.comp)}</Text>
        </Col>
        <View testID="md-progress" style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: withAlpha(done === checks.length ? c.ok : c.accent, 0.12) }}>
          <Text style={{ fontWeight: "800", fontSize: 12.5, color: done === checks.length ? c.ok : c.accentTx, fontVariant: ["tabular-nums"] }}>{done}/{checks.length}</Text>
        </View>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.sunk, overflow: "hidden" }}>
        <View style={{ width: `${checks.length ? (done / checks.length) * 100 : 0}%`, height: 6, borderRadius: 3, backgroundColor: done === checks.length ? c.ok : c.accent }} />
      </View>
      <Col gap={2}>
        {checks.map((x, i) => (
          <Pressable key={x.k} testID={"md-" + x.k} accessibilityRole={x.href ? "button" : undefined} disabled={!x.href} onPress={() => x.href && router.push(x.href)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
            {icon(x.state)}
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{x.title}</Text>
              {x.sub ? <Text numberOfLines={2} style={{ fontSize: 12.5, color: c.muted }}>{x.sub}</Text> : null}
            </View>
            {x.href ? <Icon name="chevron" size={16} color={c.muted} /> : null}
          </Pressable>
        ))}
      </Col>
    </Card>
  );
}
