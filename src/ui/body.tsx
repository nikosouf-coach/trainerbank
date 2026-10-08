// Körperregionen antippen (Beschwerden im Morgen-Check) und als Text anzeigen.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { BODY, BODY_ZONES, bodyDef, cleanAreas, parseArea, type Side } from "../core/body";
import { useEngine } from "../data/store";
import { Col, Row, T } from "./kit";
import { radius, useTheme } from "./theme";

const SIDES: Side[] = ["l", "r", "b"];

/** Auswahl der betroffenen Regionen (mit Seite bei Armen/Beinen). `value` = Codes wie „hams:l“. */
export function BodyPicker({ value, onChange, color, testID = "body" }: { value: string[]; onChange: (v: string[]) => void; color: string; testID?: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const sel = cleanAreas(value), on = (k: string) => sel.some(x => x.split(":")[0] === k);
  const toggle = (k: string) => {
    if (on(k)) { onChange(sel.filter(x => x.split(":")[0] !== k)); return; }
    // Krankheitszeichen: oberhalb/unterhalb des Halses schließen sich aus
    const rest = k === "ill_up" ? sel.filter(x => x !== "ill_down") : k === "ill_down" ? sel.filter(x => x !== "ill_up") : sel;
    onChange([...rest, bodyDef(k)?.side ? k + ":r" : k]);
  };
  const setSide = (k: string, sd: Side) => onChange(sel.map(x => x.split(":")[0] === k ? `${k}:${sd}` : x));
  const chip = (k: string, label: string) => {
    const a = on(k);
    return (
      <Pressable key={k} testID={`${testID}-${k}`} accessibilityRole="checkbox" accessibilityState={{ checked: a }} accessibilityLabel={label} onPress={() => toggle(k)}
        style={{ borderWidth: 1.5, borderColor: a ? color : c.line, backgroundColor: a ? color : c.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12, minHeight: 36, justifyContent: "center", maxWidth: "100%" }}>
        <Text style={{ fontWeight: "700", fontSize: 13.5, color: a ? "#fff" : c.ink, flexShrink: 1 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <Col gap={12} testID={testID}>
      {BODY_ZONES.map(z => (
        <Col key={z} gap={6}>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: c.muted, textTransform: "uppercase" }}>{t("bd_zone_" + z)}</Text>
          <Row wrap gap={6}>{BODY.filter(b => b.zone === z).map(b => chip(b.k, t("bd_" + b.k)))}</Row>
        </Col>
      ))}
      {sel.filter(x => bodyDef(x.split(":")[0])?.side).map(x => {
        const a = parseArea(x)!;
        return (
          <Row key={a.k} gap={8} wrap testID={`${testID}-side-${a.k}`}>
            <T v="small" bold style={{ minWidth: 120 }}>{t("bd_" + a.k)}</T>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {SIDES.map(sd => {
                const act = a.side === sd;
                return (
                  <Pressable key={sd} testID={`${testID}-side-${a.k}-${sd}`} accessibilityRole="radio" accessibilityState={{ checked: act }} onPress={() => setSide(a.k, sd)}
                    style={{ borderWidth: 1.5, borderColor: act ? color : c.line, backgroundColor: act ? color : c.surface, borderRadius: radius.s, paddingVertical: 5, paddingHorizontal: 10 }}>
                    <Text style={{ fontWeight: "700", fontSize: 12.5, color: act ? "#fff" : c.ink }}>{t("bd_side_" + sd)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Row>
        );
      })}
    </Col>
  );
}
