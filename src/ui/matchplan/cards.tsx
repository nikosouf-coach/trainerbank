// Matchplan: Karten für die Startseiten und das Spiel – Spieler sehen freigegebene Pläne, das Trainerteam Status
// und Zugriffe bzw. „Plan erstellen“.
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { iso } from "../../core/dates";
import { seenStats, shareState, squadOf } from "../../core/matchplan";
import type { Match } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Icon } from "../icons";
import { Btn, Card, Chip, Col, Group, Muted, Row, T } from "../kit";
import { radius, useTheme } from "../theme";

/** Spieler: freigegebene Matchpläne (neu = noch nicht angesehen) */
export function PlayerPlansCard() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  useEffect(() => { s.refreshMyPlans(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!E.mods.matchplan || !s.myPlans.length) return null;
  return (
    <Group>
      {s.myPlans.map(p => {
        const m = p.matchId ? E.D.matches.find(x => x.id === p.matchId) : null;
        return (
          <Pressable key={p.id} testID={"pp-" + p.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={() => router.push("/player/matchplan/" + p.id)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? c.sunk : "transparent" })}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Icon name="board" size={21} color={c.accentInk} strokeWidth={2} />
            </View>
            <Col gap={2} style={{ flex: 1 }}>
              <Text style={{ color: c.muted, fontSize: 12.5, fontWeight: "600" }}>{t("mp_title")}{m ? ` · ${E.wt(m.date)} ${E.de(m.date)}` : ""}</Text>
              <Text numberOfLines={2} style={{ color: c.ink, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 }}>{p.title}</Text>
              <Text style={{ color: c.muted, fontSize: 12.5 }}>{tf("pp_until", { d: `${E.wt(iso(new Date(p.until)))} ${new Date(p.until).toTimeString().slice(0, 5)}` })}</Text>
            </Col>
            {!p.seen ? <View testID={"pp-new-" + p.id} accessibilityLabel={t("pp_new")} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.accent }}><Text style={{ color: c.accentInk, fontSize: 11.5, fontWeight: "700" }}>{t("pp_new")}</Text></View> : null}
            <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} />
          </Pressable>
        );
      })}
    </Group>
  );
}

/** Trainerteam: Matchplan zu einem Spiel (Status, gesehen, öffnen bzw. erstellen) */
export function CoachPlanCard({ match, compact }: { match: Match; compact?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!E.mods.matchplan) return null;
  const p = E.D.plans.find(x => x.matchId === match.id);
  if (!p) {
    if (!s.can("plan") || match.date < E.TODAY) return null;
    return (
      <Btn small icon="plus" testID="mp-card-create" label={t("mp_create")} disabled={busy} onPress={async () => {
        setBusy(true); try { const id = await s.createPlan(match.id); if (id) router.push("/coach/matchplan/" + id); } finally { setBusy(false); }
      }} />
    );
  }
  const st = shareState(p, new Date()), rec = p.share?.squadOnly ? squadOf(p.c) : E.D.players.map(x => x.id);
  const seen = seenStats((E.D.planLogs[p.id] || []).filter(l => !p.publishedAt || l.at >= p.publishedAt), rec);
  const col = st === "live" ? c.ok : st === "scheduled" ? c.warn : c.build;
  const body = (
    <Row gap={10} wrap>
      <Row gap={6}><Icon name="board" size={18} color={c.ink} /><T bold>{t("mp_title")}</T></Row>
      <Chip testID="mp-card-status" label={st === "live" ? t("mp_st_liveShort") : t("mp_st_" + st)} color={col} />
      {st === "live" || st === "ended" ? <Chip label={tf("mp_seen", { n: seen.seen.length, m: rec.length })} color={c.accentTx} /> : null}
      {seen.shots ? <Chip label={tf("mp_shots", { n: seen.shots })} color={c.crit} /> : null}
    </Row>
  );
  if (compact) return <Pressable testID="mp-card" accessibilityRole="button" onPress={() => router.push("/coach/matchplan/" + p.id)}>{body}</Pressable>;
  return (
    <Card testID="mp-card" tone={col}>
      {body}
      <Muted small>{p.c.fmt}er · {p.c.formation} · {tf("mp_slidesN", { n: p.c.slides.length })}</Muted>
      <Btn small kind="primary" testID="mp-card-open" label={t("mp_open")} onPress={() => router.push("/coach/matchplan/" + p.id)} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}
