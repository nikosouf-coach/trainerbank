// Spieler-Startseite: Kurzübersicht – je Bereich eine Zeile mit dem Wichtigsten (Challenge, Ziele, Woche, Kasse,
// Meilensteine); Antippen öffnet die Details. Ersetzt die großen Karten auf der Startseite (die lassen sich unter
// „Startseite anpassen“ zusätzlich einschalten).
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { entryOf, isDone, progressOf, weekChallenges } from "../../core/challenge";
import { goalsOf } from "../../core/dev";
import type { GameState } from "../../core/game";
import type { Player } from "../../core/types";
import { useEngine } from "../../data/store";
import { CH_COLOR } from "../challenge";
import { Icon, type IconName } from "../icons";
import { useMyOpenLabel } from "../kasse";
import { Card } from "../kit";
import { useTheme, withAlpha } from "../theme";
import { GOLD } from "./parts";

interface Row { k: string; icon: IconName; color: string; title: string; value: string; go: string; done?: boolean }

export function PlayerQuick({ p, g }: { p: Player; g: GameState }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const open = useMyOpenLabel(p.id);
  const rows: Row[] = [];
  // Wochenchallenge: Fortschritt der ersten offenen bzw. „geschafft“
  if (E.mods.challenge) {
    const L = weekChallenges(E.D, E.TODAY, p);
    if (L.length) {
      const st = L.map(ch => { const e = entryOf(E.D, ch.id, p.id); return { done: isDone(ch, e), pr: progressOf(ch, e) }; });
      const n = st.filter(x => x.done).length, first = st.find(x => !x.done);
      rows.push({ k: "challenge", icon: "flame", color: CH_COLOR, title: t("cg_title"), go: "/player/challenge", done: n === L.length,
        value: n === L.length ? t("pq_done") : L.length > 1 ? tf("pq_of", { n, m: L.length }) : `${Math.round((first?.pr || 0) * 100)} %` });
    }
  }
  // Eigene Ziele
  if (E.playerSees("dev")) {
    const L = goalsOf(E.D, p.id).filter(x => x.status === "active" && (x.vis || x.by === "player"));
    rows.push({ k: "goals", icon: "target", color: c.low, title: t("dv_myGoals"), go: "/player/entwicklung", value: L.length ? tf("pq_active", { n: L.length }) : t("pq_new") });
  }
  // Wochenziele (Check-ins, RPE, dabei)
  if (E.mods.belastung) {
    const w = g.week, done = w.checkins.done + w.rpe.done + w.att.done, total = w.checkins.total + w.rpe.total + w.att.total;
    if (total) rows.push({ k: "week", icon: "trophy", color: GOLD, title: t("gm_week"), go: "/player/daten", value: `${done}/${total}`, done: done >= total });
  }
  // Kasse (nur wenn etwas offen ist)
  if (open) rows.push({ k: "kasse", icon: "wallet", color: c.warn, title: t("ks_mine"), go: "/player/kasse", value: tf("pq_open", { v: open }) });
  if (!rows.length) return null;
  return (
    <Card testID="player-quick" style={{ paddingVertical: 6, gap: 0 }}>
      {rows.map((x, i) => (
        <Pressable key={x.k} testID={"pq-" + x.k} accessibilityRole="button" accessibilityLabel={`${x.title}: ${x.value}`} onPress={() => router.push(x.go)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: withAlpha(x.color, 0.13), alignItems: "center", justifyContent: "center" }}>
            <Icon name={x.icon} size={17} color={x.color} strokeWidth={2} />
          </View>
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: "600", color: c.ink }}>{x.title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: x.done ? "700" : "500", color: x.done ? c.ok : c.muted, fontVariant: ["tabular-nums"] }}>{x.value}</Text>
          <Icon name="chevron" size={16} color={c.muted} />
        </Pressable>
      ))}
    </Card>
  );
}
