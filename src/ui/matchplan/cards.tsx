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
import { Btn, Card, Chip, Col, Muted, Row, T } from "../kit";
import { radius, useTheme } from "../theme";

/** Spieler: freigegebene Matchpläne (neu = noch nicht angesehen) */
export function PlayerPlansCard() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  useEffect(() => { s.refreshMyPlans(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!E.mods.matchplan || !s.myPlans.length) return null;
  return (
    <Col gap={10}>
      {s.myPlans.map(p => {
        const m = p.matchId ? E.D.matches.find(x => x.id === p.matchId) : null;
        return (
          <Pressable key={p.id} testID={"pp-" + p.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={() => router.push("/player/matchplan/" + p.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.xl, backgroundColor: c.accent }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20 }}>📋</Text>
            </View>
            <Col gap={2} style={{ flex: 1 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                {t("mp_title")}{m ? ` · ${E.wt(m.date)} ${E.de(m.date)}` : ""}{!p.seen ? " · " + t("pp_new") : ""}</Text>
              <Text numberOfLines={2} style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>{p.title}</Text>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5 }}>{tf("pp_until", { d: `${E.wt(iso(new Date(p.until)))} ${new Date(p.until).toTimeString().slice(0, 5)}` })}</Text>
            </Col>
            {!p.seen ? <View testID={"pp-new-" + p.id} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ffd43b" }} /> : <Icon name="chevron" size={20} color="#fff" />}
          </Pressable>
        );
      })}
    </Col>
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
      <T bold>📋 {t("mp_title")}</T>
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

/** Kurzer Hinweis in der Kopfzeile des nächsten Spiels (Startseite Trainer) */
export function heroPlanLabel(E: ReturnType<typeof useEngine>, match: Match): string | null {
  if (!E.mods.matchplan) return null;
  const p = E.D.plans.find(x => x.matchId === match.id);
  if (!p) return "📋 " + E.t("mp_heroNone");
  const st = shareState(p, new Date());
  if (st !== "live") return "📋 " + E.t("mp_st_" + st);
  const rec = p.share?.squadOnly ? squadOf(p.c) : E.D.players.map(x => x.id);
  const n = seenStats((E.D.planLogs[p.id] || []).filter(l => !p.publishedAt || l.at >= p.publishedAt), rec).seen.length;
  return "📋 " + E.tf("mp_seen", { n, m: rec.length });
}
