// Trainer – Spiele & Statistik: Ergebnisse der Saison und Spielerstatistik (Spiele, Minuten, Tore, Vorlagen, Ø Note).
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useEngine, useStore } from "../../src/data/store";
import { fmtRating, RatingBadge } from "../../src/ui/games";
import { Card, CardTitle, Header, ListItem, Muted, Row, Screen, Seg, Tag } from "../../src/ui/kit";
import { PlayerAvatar } from "../../src/ui/playerAvatar";
import { useTheme } from "../../src/ui/theme";

type SortKey = "goals" | "assists" | "min" | "avg";

export default function Spiele() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const [sort, setSort] = useState<SortKey>("goals");
  const past = E.D.matches.filter(m => m.date <= E.TODAY).sort((a, b) => a.date < b.date ? 1 : -1);
  const rows = useMemo(() => E.D.players.map(p => ({ p, ss: E.seasonStats(p.id) })), [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = rows.slice().sort((a, b) => sort === "avg" ? (b.ss.avg ?? 0) - (a.ss.avg ?? 0) : (b.ss[sort] - a.ss[sort]) || (b.ss.min - a.ss.min));
  const res = (m: typeof past[number]) => m.result ? `${m.result.own}:${m.result.opp}` : "–:–";
  const resCol = (m: typeof past[number]) => !m.result ? c.muted : m.result.own > m.result.opp ? c.ok : m.result.own < m.result.opp ? c.crit : c.warn;
  const cell = (v: string, w: number, bold?: boolean) => <Text style={{ width: w, textAlign: "right", fontVariant: ["tabular-nums"], fontWeight: bold ? "800" : "500", color: c.ink, fontSize: 14 }}>{v}</Text>;
  return (
    <Screen testID="coach-spiele">
      <Header title={t("sp_list")} onBack={() => router.back()} backLabel={t("mo_title")} />
      <Card testID="sp-results">
        <CardTitle title={t("sp_results")} />
        {past.length ? past.map(m => (
          <ListItem key={m.id} testID={"res-" + m.id} title={`${t("vs")} ${m.gegner}`} sub={`${E.wt(m.date)} ${E.de(m.date)} · ${m.heim ? t("home") : t("away")} · ${t("comp_" + m.comp)}`}
            right={<Text style={{ fontSize: 20, fontWeight: "800", color: resCol(m), fontVariant: ["tabular-nums"] }}>{res(m)}</Text>} onPress={() => router.push("/coach/spiel/" + m.id)} />
        )) : <Muted>{t("sp_noGames")}</Muted>}
      </Card>
      <Card testID="sp-table">
        <CardTitle title={t("sp_table")} />
        <Seg testID="sp-sort" value={sort} onChange={setSort} options={[{ key: "goals", label: t("sp_goals") }, { key: "assists", label: t("sp_assists") }, { key: "min", label: t("sp_min") }, { key: "avg", label: t("sp_avg") }]} />
        <Row gap={6} style={{ paddingVertical: 4 }}>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: c.muted }}>{t("tab_spieler").toUpperCase()}</Text>
          {[t("sp_games"), t("sp_min"), "⚽", "🅰"].map((h, i) => <Text key={i} style={{ width: i === 1 ? 52 : 34, textAlign: "right", fontSize: 11, fontWeight: "700", color: c.muted }}>{h}</Text>)}
          <View style={{ width: 40 }} />
        </Row>
        {sorted.map(({ p, ss }) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={E.name(p)} onPress={() => router.push("/coach/spieler/" + p.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}>
            <Row gap={8} style={{ flex: 1 }}><PlayerAvatar p={p} size={26} /><Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: c.ink, fontWeight: "600" }}>{p.vn} {(p.nn || "")[0]}.</Text></Row>
            {cell(String(ss.games), 34)}{cell(String(ss.min), 52)}{cell(String(ss.goals), 34, ss.goals > 0)}{cell(String(ss.assists), 34, ss.assists > 0)}
            <View style={{ width: 40, alignItems: "flex-end" }}>{ss.avg != null ? <RatingBadge value={Math.round(ss.avg * 10) / 10} size="s" /> : <Tag label="–" />}</View>
          </Pressable>
        ))}
        <Muted small>{t("sp_avg")}: {rows.filter(r => r.ss.avg != null).length ? fmtRating(rows.filter(r => r.ss.avg != null).reduce((a, r) => a + r.ss.avg!, 0) / rows.filter(r => r.ss.avg != null).length, E.tr.lang) : "–"}</Muted>
      </Card>
    </Screen>
  );
}
