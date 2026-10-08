// Reha: Region der Verletzung wählen und Reha-Plan nach Region und Stufe anzeigen (Trainer und Spieler).
import React, { useState } from "react";
import { Text, View } from "react-native";
import { BODY, bodyDef, parseArea, type Side } from "../core/body";
import { guessArea, rehaGroupOf, rehaPlan } from "../core/reha";
import type { Absence } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { RegionMap } from "./bodyMap";
import { Btn, Card, Col, Muted, Picker, Row, Seg, T } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

/** Region (ohne Krankheitszeichen) mit Seite. value = Code wie „hams:l“ oder null */
export function RegionPicker({ value, onChange, testID = "region", map = true }: { value: string | null | undefined; onChange: (v: string | null) => void; testID?: string; map?: boolean }) {
  const E = useEngine(); const { t } = E;
  const [list, setList] = useState(!map);
  const a = value ? parseArea(value) : null, def = a ? bodyDef(a.k) : null;
  const opts = [{ key: "", label: t("rh_regionNone") }, ...BODY.filter(b => b.zone !== "ill").map(b => ({ key: b.k, label: t("bd_" + b.k) }))];
  return (
    <Col gap={6}>
      {!list ? <RegionMap value={value} onChange={onChange} testID={testID + "-map"} /> : null}
      {map ? <Btn small kind="ghost" testID={testID + "-mode"} label={list ? "🧍 " + t("bm_asMap") : "☰ " + t("bm_asList")} onPress={() => setList(!list)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} /> : null}
      {list ? <Picker testID={testID} label={t("rh_region")} value={a?.k || ""} options={opts}
        onChange={k => { const d = bodyDef(k); onChange(!k ? null : d?.side ? `${k}:${a?.side || "r"}` : k); }} /> : null}
      {list && a && def?.side ? <Seg testID={testID + "-side"} value={(a.side || "r") as Side} onChange={(sd: Side) => onChange(`${a.k}:${sd}`)}
        options={(["l", "r", "b"] as Side[]).map(x => ({ key: x, label: t("bd_side_" + x) }))} /> : null}
    </Col>
  );
}

/** Reha-Plan der aktuellen Stufe (Ziel, Übungen, Kriterien für die nächste Stufe). */
export function RehaPlanView({ a, editable, testID = "reha" }: { a: Absence; editable?: boolean; testID?: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf, tl } = E; const { c } = useTheme();
  const area = a.area || guessArea(a.notiz), grp = rehaGroupOf(area), plan = rehaPlan(t, tl, grp, a.stufe || 1);
  return (
    <Col gap={8} testID={testID}>
      {editable ? <RegionPicker value={a.area || null} onChange={v => s.saveAbsence({ ...a, area: v })} testID={testID + "-region"} map={false} /> : null}
      <Row gap={6} wrap>
        <View style={{ backgroundColor: withAlpha(c.inj, 0.14), borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ color: c.inj, fontWeight: "800", fontSize: 12 }}>{t("rh_g_" + grp)}{area && parseArea(area)?.side ? ` (${t("bd_side_" + parseArea(area)!.side)})` : ""}</Text>
        </View>
        <Muted small>{tf("rh_stage", { s: plan.stage })} · {E.tl("stages")[plan.stage - 1]}</Muted>
      </Row>
      <T v="small" bold>{t("rh_goal")}: {plan.goal}</T>
      <Col gap={4}>
        {plan.items.map((x, i) => <Row key={i} gap={8} align="flex-start"><Text style={{ color: c.inj, fontWeight: "800" }}>•</Text><Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>{x}</Text></Row>)}
      </Col>
      <View style={{ backgroundColor: c.sunk, borderRadius: radius.s, padding: 8, gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: c.muted }}>{t("rh_next")}</Text>
        <Text style={{ fontSize: 13, color: c.ink }}>{plan.next}</Text>
      </View>
      <Muted small>{t("rh_note")}</Muted>
    </Col>
  );
}

/** Spieler-App: Reha-Plan, solange eine Verletzung läuft. */
export function PlayerRehaCard({ pid }: { pid: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const a = E.D.absences.find(x => x.pid === pid && x.typ === "verletzung" && x.von <= E.TODAY && (!x.bis || x.bis >= E.TODAY));
  if (!a) return null;
  return (
    <Card testID="player-reha" tone={c.inj}>
      <T v="h3">{t("rh_mine")}</T>
      <RehaPlanView a={a} testID="p-reha" />
    </Card>
  );
}
