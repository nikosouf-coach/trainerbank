// Startseite Trainer: „Meine Aufgaben“ – eigene Blöcke in den nächsten Einheiten (Co-Trainer sehen hier ihren Schwerpunkt).
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text } from "react-native";
import { dayBlocks, myBlocks, timeline } from "../../core/day";
import { useEngine, useStore } from "../../data/store";
import { Card, CardTitle, Col, Muted, Row } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";

export function MyTasksCard() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const me = s.myStaff;
  if (!me) return null;
  const mine = myBlocks(E.D, me.id, E.TODAY, 7);
  const dates = [...new Set(mine.map(b => b.date))];
  return (
    <Card testID="today-tasks">
      <CardTitle title={t("td_myBlocks")} />
      {dates.length ? dates.map(d => {
        const tl = timeline(dayBlocks(E.D, d), E.zeitOf(d)).filter(x => x.b.staffId === me.id);
        return (
          <Pressable key={d} testID={"my-day-" + d} accessibilityRole="button" onPress={() => router.push("/coach/tag/" + d)}
            style={{ borderLeftWidth: 4, borderLeftColor: c.accent, backgroundColor: withAlpha(c.accent, 0.06), borderRadius: radius.s, paddingVertical: 8, paddingHorizontal: 10, gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: c.accentTx, textTransform: "uppercase" }}>
              {d === E.TODAY ? t("today") : `${E.wt(d)} ${E.de(d)}`} · {E.zeitOf(d)}
            </Text>
            {tl.map(({ b, from }) => (
              <Row key={b.id} gap={8} align="flex-start">
                <Text style={{ width: 44, fontSize: 13, fontWeight: "700", color: c.muted, fontVariant: ["tabular-nums"] }}>{from}</Text>
                <Col gap={1} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{b.title} <Text style={{ color: c.muted, fontWeight: "400" }}>· {b.min} {t("min")}</Text></Text>
                  {b.points.length ? <Text numberOfLines={2} style={{ fontSize: 12.5, color: c.muted }}>{b.points.join(" · ")}</Text> : null}
                </Col>
              </Row>
            ))}
          </Pressable>
        );
      }) : <Muted small>{t("td_myBlocksNone")}</Muted>}
    </Card>
  );
}
