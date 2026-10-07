// Trainer – Einheit: Anwesenheit per Tipp und RPE nachtragen.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { AttStatus } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { Btn, Card, CardTitle, Chip, Col, Header, Info, Muted, NumScale, Row, Screen, Sheet, T } from "../../../src/ui/kit";
import { RatingBadge, RatingSheet, type RatingTarget } from "../../../src/ui/games";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { radius, rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

const NEXT: Record<string, AttStatus | null> = { da: "ent", ent: "unent", unent: null, offen: "da" };

export default function Einheit() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const { date = "" } = useLocalSearchParams<{ date: string }>();
  const [rpeFor, setRpeFor] = useState<string | null>(null);
  const [rate, setRate] = useState<RatingTarget | null>(null);
  const sess = E.D.sessions.find(x => x.date === date);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/kalender");
  if (!sess) return <Screen testID="coach-einheit"><Header title={t("nav_kalender")} onBack={back} backLabel={t("nav_kalender")} /><Muted>{t("noSession")}</Muted></Screen>;

  const label = (st: string): string => st.startsWith("abs:") ? t("ab_" + st.slice(4)) : t("at_" + st);
  const col = (st: string): string => st === "da" ? c.ok : st === "ent" ? c.warn : st === "unent" ? c.crit : st === "abs:verletzung" || st === "abs:krank" ? c.inj : st.startsWith("abs:") ? c.low : c.muted;
  const cnt: Record<string, number> = {}; E.D.players.forEach(p => { const k = E.attStatus(date, p.id); cnt[k] = (cnt[k] || 0) + 1; });
  const showI = E.lvl(1) && E.grp !== "u11";
  const title = sess.typ === "Spiel" ? `${t("it_match")} ${t("vs")} ${E.matchOn(date)?.gegner || ""}` : E.kn(sess.kind || "intensiv");
  const rp = rpeFor ? E.P(rpeFor) : null, cur = rpeFor ? E.D.rpe[rpeFor]?.[date] : undefined;
  const avg = E.sessAvg(date);

  return (
    <Screen testID="coach-einheit">
      <Header onBack={back} backLabel={t("nav_kalender")} eyebrow={`${E.wt(date)} ${E.de(date)}${sess.md ? " · " + sess.md : ""} · ${sess.dauer} ${t("min")}${showI ? ` · ${t("target")} ${sess.ziel}` : ""}`} title={title} />
      <Row wrap gap={6}>{Object.entries(cnt).map(([k, v]) => <Chip key={k} label={`${label(k)} ${v}`} color={col(k)} />)}{showI && avg != null ? <Chip label={`Ø RPE ${E.num(avg, 1)}`} color={rpeColor(c, Math.round(avg))} /> : null}</Row>
      <Card>
        <CardTitle title={t("presence")} info={<Info title={t("presence")} text={t("tapHint")} />} />
        <Btn small testID="att-all" label={t("allPresent")} onPress={() => E.D.players.forEach(p => { if (E.attStatus(date, p.id) === "offen") s.setAttendance(date, p.id, "da"); })} style={{ alignSelf: "flex-start" }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {E.D.players.map(p => {
            const st = E.attStatus(date, p.id), cl = col(st), r = E.D.rpe[p.id]?.[date];
            return (
              <View key={p.id} style={{ flexGrow: 1, flexBasis: 240, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: withAlpha(cl, 0.5), backgroundColor: withAlpha(cl, 0.07), borderRadius: radius.m, padding: 8 }}>
                <Pressable testID={"att-" + p.id} accessibilityRole="button" accessibilityLabel={`${E.name(p)}: ${label(st)}`} onPress={() => s.setAttendance(date, p.id, st.startsWith("abs:") ? "da" : NEXT[st] ?? null)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <PlayerAvatar p={p} size={36} />
                  <Col gap={1} style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 14, color: c.ink }}>{E.name(p)}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: cl }}>{label(st)}</Text>
                  </Col>
                </Pressable>
                {E.mods.spielanalyse && st === "da" && sess.typ === "Training" ? <Pressable testID={"rate-" + p.id} accessibilityRole="button" accessibilityLabel={`${t("tr_rate")} ${E.name(p)}`} onPress={() => setRate({ pid: p.id, date, kind: "training" })}>
                  <RatingBadge value={E.D.ratings.find(x => x.pid === p.id && x.date === date && x.kind === "training")?.rating ?? null} size="s" />
                </Pressable> : null}
                {E.mods.belastung && st === "da" ? <Pressable testID={"rpe-" + p.id} accessibilityRole="button" accessibilityLabel={`RPE ${E.name(p)}`} onPress={() => setRpeFor(p.id)}
                  style={{ minWidth: 52, height: 36, borderRadius: radius.s, borderWidth: 1, borderColor: r ? rpeColor(c, r.rpe) : c.line, backgroundColor: r ? rpeColor(c, r.rpe) : c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ fontWeight: "800", fontSize: 12.5, color: r ? "#fff" : c.muted }}>{r ? "RPE " + r.rpe : "RPE +"}</Text>
                </Pressable> : null}
              </View>
            );
          })}
        </View>
      </Card>
      <RatingSheet target={rate} onClose={() => setRate(null)} />
      <Sheet visible={!!rp} onClose={() => setRpeFor(null)} title={rp ? `RPE · ${E.name(rp)}` : ""} testID="rpe-sheet" closeLabel={t("cancel")}>
        {rp ? <Col gap={12}>
          <Muted>{t("rpe_coachQ")}</Muted>
          <NumScale testID="rpe-scale" value={cur?.rpe ?? null} min={1} max={10} color={n => rpeColor(c, n)}
            onChange={n => { s.saveRpe(rp.id, date, { rpe: n, min: sess.dauer }); setRpeFor(null); s.toast(t("t_saved")); }} />
          {cur ? <Btn small label={t("del")} onPress={() => { s.saveRpe(rp.id, date, null); setRpeFor(null); }} style={{ alignSelf: "flex-start" }} /> : null}
        </Col> : null}
      </Sheet>
    </Screen>
  );
}
