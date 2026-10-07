// Navigation ‹ Titel › Heute für Kalender und Planung.
import React from "react";
import { Text } from "react-native";
import { Btn, Row } from "../kit";
import { useTheme } from "../theme";

/** Navigation ‹ Titel › Heute */
export function CalNav({ label, onPrev, onNext, onToday, todayLabel, info }: { label: string; onPrev: () => void; onNext: () => void; onToday: () => void; todayLabel: string; info?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Row gap={8} wrap>
      <Btn small testID="cal-prev" icon="back" label="" a11y="−1" onPress={onPrev} />
      <Text style={{ fontWeight: "800", fontSize: 15, color: c.ink, fontVariant: ["tabular-nums"] }}>{label}</Text>
      <Btn small testID="cal-next" icon="chevron" label="" a11y="+1" onPress={onNext} />
      <Btn small testID="cal-today" label={todayLabel} onPress={onToday} />
      {info}
    </Row>
  );
}
