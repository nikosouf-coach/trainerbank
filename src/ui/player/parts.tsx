// Bausteine der Spieler-App: Level-Karte, Wochenringe, Abzeichen, Aufgaben, Termine, Ziele, Einwilligung.
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { addDays, diff, monday } from "../../core/dates";
import type { GameState, Ring } from "../../core/game";
import type { Player } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Icon, type IconName } from "../icons";
import { Btn, Card, Col, Info, Muted, Row, T } from "../kit";
import { PlayerAvatar } from "../playerAvatar";
import { RatingBadge, ratingColor, StatTile, VideoList } from "../games";
import { potColor } from "../squad/ProfileCards";
import { radius, space, useTheme, withAlpha } from "../theme";

/** Belohnungsfarbe (Gold) – in beiden Themen gut sichtbar. */
export const GOLD = "#f2b705";

/** Kopf mit Bild, Level, XP-Balken und Serie. */
export function LevelHero({ p, g }: { p: Player; g: GameState }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const names = E.tl("gm_lv"), lvName = names[Math.min(names.length - 1, g.level - 1)] || "";
  return (
    <View testID="player-hero" style={{ backgroundColor: c.accent, borderRadius: radius.xl, padding: space.l + 2, gap: 14, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)" }} />
      <View style={{ position: "absolute", right: 40, bottom: -60, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)" }} />
      <Row gap={14}>
        <View style={{ borderWidth: 3, borderColor: GOLD, borderRadius: 40 }}><PlayerAvatar p={p} size={62} /></View>
        <Col gap={3} style={{ flex: 1 }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{E.wt(E.TODAY)} {E.de(E.TODAY)} · {E.team.name}</Text>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 26, fontWeight: "800", textTransform: "uppercase" }}>{tf("ph_hi", { n: p.vn })}</Text>
          <Row gap={6} wrap>
            <View style={{ backgroundColor: GOLD, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 }}><Text style={{ color: "#1a1300", fontWeight: "800", fontSize: 12 }}>{tf("gm_level", { n: g.level })}</Text></View>
            <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "700", fontSize: 13, flexShrink: 1 }}>{lvName}</Text>
          </Row>
        </Col>
        <View testID="player-streak" accessibilityLabel={g.streak ? tf("gm_streak", { n: g.streak }) : t("gm_streak0")} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.l, paddingHorizontal: 10, paddingVertical: 8, minWidth: 62 }}>
          <Icon name="flame" size={24} color={g.streak ? "#ff9f1c" : "rgba(255,255,255,0.6)"} strokeWidth={2} />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20, fontVariant: ["tabular-nums"] }}>{g.streak}</Text>
        </View>
      </Row>
      <Col gap={6}>
        <View style={{ height: 12, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
          <View style={{ width: `${Math.max(4, g.pct * 100)}%`, height: "100%", backgroundColor: GOLD, borderRadius: 99 }} />
        </View>
        <Row between>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13, fontVariant: ["tabular-nums"] }}>{tf("gm_xp", { x: E.int(g.xp) })}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5 }}>{tf("gm_toNext", { x: E.int(g.levelNext - g.xp), n: g.level + 1 })}</Text>
        </Row>
      </Col>
    </View>
  );
}

/** Drei Wochenringe: Check-ins, RPE, Anwesenheit. Voll = Gold. */
export function WeekRings({ g }: { g: GameState }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const rings: { r: Ring; col: string; label: string }[] = [
    { r: g.week.checkins, col: "#16a3a3", label: t("gm_r_check") },
    { r: g.week.rpe, col: "#f0762b", label: t("gm_r_rpe") },
    { r: g.week.att, col: c.accent === "#111827" ? "#4f7cff" : c.accent, label: t("gm_r_att") },
  ];
  const S = 132, cx = S / 2, W = 12;
  return (
    <Card testID="player-rings">
      <Row between><T v="h2">{t("gm_week")}</T><Info title={t("gm_badges")} text={t("gm_info")} testID="game-info" /></Row>
      <Row gap={18} wrap>
        <Svg width={S} height={S}>
          {rings.map((x, i) => {
            const r = cx - W / 2 - i * (W + 4), C = 2 * Math.PI * r, pct = x.r.total ? Math.min(1, x.r.done / x.r.total) : 0, full = x.r.total > 0 && pct >= 1;
            return (
              <React.Fragment key={i}>
                <Circle cx={cx} cy={cx} r={r} stroke={withAlpha(x.col.startsWith("#") ? x.col : "#888888", 0.18)} strokeWidth={W} fill="none" />
                <Circle cx={cx} cy={cx} r={r} stroke={full ? GOLD : x.col} strokeWidth={W} fill="none" strokeLinecap="round" strokeDasharray={`${C * Math.max(pct, 0.001)} ${C}`} transform={`rotate(-90 ${cx} ${cx})`} />
              </React.Fragment>
            );
          })}
        </Svg>
        <Col gap={10} style={{ flex: 1, minWidth: 150 }}>
          {rings.map((x, i) => {
            const full = x.r.total > 0 && x.r.done >= x.r.total;
            return (
              <Row key={i} gap={8}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: full ? GOLD : x.col }} />
                <Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>{x.label}</Text>
                <Text style={{ color: full ? c.ink : c.muted, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{x.r.done}/{x.r.total}{full ? " ★" : ""}</Text>
              </Row>
            );
          })}
        </Col>
      </Row>
    </Card>
  );
}

const BADGE_ICON: Record<string, IconName> = { first: "check", streak7: "flame", perfect: "star", rpe: "bolt", att: "calendar", sleep: "moon", extra: "plus", streak30: "trophy", goal: "target", assist: "spark", top: "star", pb: "bolt" };
const BADGE_COL = ["#f2b705", "#f0762b", "#16a3a3", "#7b5fd0", "#2f9e44", "#3a6db5", "#d6336c", "#e8590c"];

/** Abzeichen: erreichte farbig, offene grau mit Fortschritt. */
export function Badges({ g, compact }: { g: GameState; compact?: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const n = g.badges.filter(b => b.earned).length;
  const tiles = g.badges.map((b, i) => {
    const col = BADGE_COL[i % BADGE_COL.length];
    return (
      <View key={b.key} testID={"badge-" + b.key} accessibilityLabel={`${t("gm_b_" + b.key)}: ${b.earned ? "✓" : Math.round(b.progress * 100) + " %"}`}
        style={{ width: compact ? 92 : undefined, flexGrow: compact ? 0 : 1, flexBasis: compact ? undefined : 140, alignItems: "center", gap: 6, padding: 10, borderRadius: radius.l, backgroundColor: b.earned ? withAlpha(col, 0.12) : c.sunk, borderWidth: 1, borderColor: b.earned ? withAlpha(col, 0.4) : c.line }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: b.earned ? col : c.line, alignItems: "center", justifyContent: "center" }}>
          <Icon name={BADGE_ICON[b.key] || "star"} size={22} color={b.earned ? "#fff" : c.muted} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: "800", color: b.earned ? c.ink : c.muted, textAlign: "center" }}>{t("gm_b_" + b.key)}</Text>
        {!compact ? <Text style={{ fontSize: 11, color: c.muted, textAlign: "center" }}>{t("gm_bd_" + b.key)}</Text> : null}
        {!b.earned ? <View style={{ width: "80%", height: 5, borderRadius: 3, backgroundColor: c.line, overflow: "hidden" }}><View style={{ width: `${b.progress * 100}%`, height: "100%", backgroundColor: col }} /></View> : null}
      </View>
    );
  });
  return (
    <Card testID="player-badges">
      <Row between><T v="h2">{t("gm_badges")}</T><Muted small>{tf("gm_earned", { n, m: g.badges.length })}</Muted></Row>
      {compact ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>{tiles}</ScrollView>
        : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{tiles}</View>}
    </Card>
  );
}

/** Große Aufgaben-Kachel mit XP-Belohnung. */
export function TodoTile({ icon, title, sub, xp, done, onPress, testID, color }: { icon: IconName; title: string; sub?: string; xp: number; done?: boolean; onPress: () => void; testID?: string; color: string }) {
  const { c } = useTheme(); const E = useEngine();
  const col = done ? c.ok : color;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 160, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.l, backgroundColor: done ? withAlpha(c.ok, 0.12) : col, opacity: pressed ? 0.85 : 1, borderWidth: done ? 1 : 0, borderColor: withAlpha(c.ok, 0.4) })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: done ? c.ok : "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
        <Icon name={done ? "check" : icon} size={22} color="#fff" strokeWidth={2.4} />
      </View>
      <Col gap={2} style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 16, color: done ? c.ink : "#fff" }}>{title}</Text>
        {sub ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: done ? c.muted : "rgba(255,255,255,0.85)" }}>{sub}</Text> : null}
      </Col>
      {!done ? <View style={{ backgroundColor: GOLD, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontWeight: "800", fontSize: 12, color: "#1a1300" }}>{E.tf("gm_plusXp", { x: xp })}</Text></View> : null}
    </Pressable>
  );
}

/** Nächste Termine (Training, Spiele, Events) der kommenden zwei Wochen. */
export function NextDates({ pid, max = 6 }: { pid: string; max?: number }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const showPlan = E.playerSees("plan"), kids = E.grp === "u11";
  const rows: React.ReactNode[] = [];
  for (let w = 0; w <= 2 && rows.length < max; w++) {
    const wp = E.weekPlan(addDays(monday(E.TODAY), 7 * w));
    for (const x of wp.items) {
      if (x.date < E.TODAY || rows.length >= max) continue;
      const i = diff(E.TODAY, x.date);
      if (i > 14) continue;
      const when = x.date === E.TODAY ? t("today") : i === 1 ? t("tomorrow") : `${E.wt(x.date)} ${E.de(x.date)}`;
      const ab = E.absenceOn(pid, x.date);
      const item = (key: string, col: string, kind: string, title: string, sub: string) => rows.push(
        <Row key={key} gap={12} align="flex-start" testID={"date-" + key}>
          <View style={{ width: 54, alignItems: "center", paddingVertical: 6, borderRadius: radius.m, backgroundColor: withAlpha(col.startsWith("#") ? col : "#888888", 0.12) }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: col }}>{E.wt(x.date).toUpperCase()}</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: c.ink }}>{E.de(x.date).slice(0, 5)}</Text>
          </View>
          <Col gap={2} style={{ flex: 1 }}>
            <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, color: col, textTransform: "uppercase" }}>{kind} · {when}</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{title}</Text>
            {sub ? <Text style={{ fontSize: 13, color: c.muted }}>{sub}</Text> : null}
            {ab ? <Text style={{ fontSize: 12, fontWeight: "700", color: c.low }}>{t("ab_" + ab.typ)} · {t("pl_absent")}</Text> : null}
          </Col>
        </Row>);
      if (x.match) item(x.date + "m", c.accentTx, t("it_match"), `${t("vs")} ${x.match.gegner}`, `${x.match.zeit} · ${x.match.heim ? t("home") : t("away")} · ${t("comp_" + x.match.comp)}`);
      else if (x.train && x.train.kind !== "frei") item(x.date + "t", c.ok, t("it_training"), showPlan ? E.kn(x.train.kind) : t("it_training"), `${E.zeitOf(x.date)} · ${x.train.dauer} ${t("min")}${showPlan && !kids ? " · " + t("intensity") + ": " + E.intWord(x.train.rpe) : ""}`);
      x.events.forEach(e => item(e.id, c.event, t("it_event"), e.titel, e.zeit || ""));
    }
  }
  return (
    <Card testID="player-dates">
      <T v="h2">{t("pl_dates")}</T>
      {rows.length ? <Col gap={12}>{rows}</Col> : <Muted>{t("pl_noDates")}</Muted>}
    </Card>
  );
}

/** Ziele als waagerecht scrollbare Karten (beliebig viele). */
export function Goals({ pid }: { pid: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const goals = (E.D.pot[pid] || []).filter(x => x.vis);
  return (
    <Card testID="player-goals">
      <Row between><T v="h2">{t("pl_goals")}</T>{goals.length ? <Muted small>{goals.length}</Muted> : null}</Row>
      {goals.length ? <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
        {goals.map(g => { const col = potColor(c, g.cat); return (
          <View key={g.id} testID={"goal-" + g.id} style={{ width: 220, padding: 12, borderRadius: radius.l, backgroundColor: withAlpha(col, 0.12), borderWidth: 1, borderColor: withAlpha(col, 0.35), gap: 6 }}>
            <Row gap={6}><Icon name="target" size={18} color={col} /><Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: col, textTransform: "uppercase" }}>{t("pc_" + g.cat)}</Text></Row>
            <Text style={{ fontSize: 14.5, color: c.ink, lineHeight: 20 }}>{g.text}</Text>
          </View>
        ); })}
      </ScrollView> : <Muted>{t("pl_noGoals")}</Muted>}
    </Card>
  );
}

/** Hinweis mit Einwilligung, wenn Gesundheitsdaten noch nicht freigegeben sind. */
export function HealthConsentGate() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  return (
    <Card tone={c.warn} testID="consent-gate">
      <Row gap={8}><T v="h3" style={{ flex: 1 }}>{t("pl_consentT")}</T><Info title={t("cs_health")} text={t("cs_health_l")} /></Row>
      <T v="small">{t("pl_consentD")}</T>
      <Btn testID="consent-give" kind="primary" label={t("pl_consentBtn")} onPress={async () => { try { await s.giveConsent("health_data"); } catch (e) { s.toast(s.errText(e)); } }} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}

/** Kurzer Weg zu einem Ziel innerhalb der Spieler-App. */
export function useGo() { const router = useRouter(); return (h: string) => router.push(h); }

/** Neueste Bewertung des Trainers (letzte 10 Tage). */
export function NewRating({ pid }: { pid: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const r = E.ratingsOf(pid).find(x => x.vis && diff(x.date, E.TODAY) <= 10 && (x.rating != null || x.text));
  if (!r || !E.playerSees("ratings")) return null;
  const m = r.kind === "spiel" ? E.D.matches.find(x => x.date === r.date) : null;
  return (
    <Pressable testID="player-newrating" accessibilityRole="button" onPress={() => router.push("/player/daten")}>
      <Card tone={ratingColor(r.rating)}>
        <Row gap={12} align="flex-start">
          <RatingBadge value={r.rating} size="l" />
          <Col gap={3} style={{ flex: 1 }}>
            <T v="eyebrow">{t("pl_newRating")}</T>
            <Text style={{ fontWeight: "800", fontSize: 15, color: c.ink }}>{E.wt(r.date)} {E.de(r.date)} · {m ? `${t("vs")} ${m.gegner}` : r.kind === "spiel" ? t("it_match") : t("it_training")}</Text>
            {r.text ? <Text style={{ fontSize: 14, color: c.ink }}>{r.text}</Text> : null}
          </Col>
        </Row>
      </Card>
    </Pressable>
  );
}

/** Saisonwerte, Notenverlauf mit Feedback und Videos für den Spieler. */
export function MySeason({ pid }: { pid: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const ss = E.seasonStats(pid), rs = E.ratingsOf(pid).filter(r => r.vis);
  const vids = E.videosFor(pid).filter(v => v.vis);
  return (
    <>
      {E.playerSees("stats") ? <Card testID="pd-season">
        <T v="h3">{t("pl_mySeason")}</T>
        <Row wrap gap={8}>
          <StatTile label={t("sp_games")} value={String(ss.games)} />
          <StatTile label={t("sp_min")} value={String(ss.min)} />
          <StatTile label={t("sp_goals")} value={String(ss.goals)} color={ss.goals ? GOLD : undefined} />
          <StatTile label={t("sp_assists")} value={String(ss.assists)} color={ss.assists ? c.low : undefined} />
        </Row>
      </Card> : null}
      {E.playerSees("ratings") && rs.length ? <Card testID="pd-ratings">
        <Row between><T v="h3">{t("pl_ratings")}</T>{ss.avg != null ? <Row gap={6}><Muted small>{t("sp_avg")}</Muted><RatingBadge value={Math.round(ss.avg * 10) / 10} size="s" /></Row> : null}</Row>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 70 }}>
          {rs.filter(r => r.rating != null).slice(0, 12).reverse().map(r => <View key={r.id} style={{ flex: 1, height: `${Math.max(10, (r.rating! - 3) / 7 * 100)}%`, backgroundColor: ratingColor(r.rating), borderRadius: 4 }} />)}
        </View>
        {rs.slice(0, 8).map(r => { const m = r.kind === "spiel" ? E.D.matches.find(x => x.date === r.date) : null; return (
          <Row key={r.id} gap={10} align="flex-start">
            <RatingBadge value={r.rating} size="s" />
            <Col gap={1} style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: c.ink }}>{E.wt(r.date)} {E.de(r.date)} · {m ? `${t("vs")} ${m.gegner}` : r.kind === "spiel" ? t("it_match") : t("it_training")}</Text>
              {r.text ? <Text style={{ fontSize: 13.5, color: c.ink }}>{r.text}</Text> : null}
            </Col>
          </Row>
        ); })}
      </Card> : null}
      {E.playerSees("videos") && vids.length ? <Card testID="pd-videos"><T v="h3">{t("pl_videos")}</T><VideoList videos={vids} /></Card> : null}
    </>
  );
}
