// Schattenkader: Spielfeld mit einer Kachel je Position (Ampel nach Soll, eingeplante Spieler, erster Schattenkandidat)
// und darunter dieselben Positionen als Liste mit allen Namen. Antippen öffnet die Position.
import React, { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { planSlots, slotDepth, type PlanSlot, type RefInfo } from "../../core/scout";
import type { MpFmt, SpContent } from "../../core/types";
import { useStore } from "../../data/store";
import { Card, Col, Muted, Row, T } from "../kit";
import { PitchSurface } from "../matchplan/pitch";
import { radius, useTheme, withAlpha } from "../theme";
import { levelCol, shortName, stateCol, StateTag } from "./common";

const SHADOW = "#d0bfff";

/** Reihen nach Höhe (Angriff oben), Kacheln gleichmäßig verteilt – das Feld ist schematisch */
function layout(slots: PlanSlot[], W: number, H: number) {
  const rows: PlanSlot[][] = [];
  for (const s of [...slots].sort((a, b) => a.y - b.y)) {
    const r = rows.find(R => Math.abs(R[0].y - s.y) <= 4);
    if (r) r.push(s); else rows.push([s]);
  }
  const pad = 6, band = (H - 2 * pad) / rows.length;
  const out: { s: PlanSlot; cx: number; cy: number; w: number; h: number }[] = [];
  rows.forEach((R, i) => {
    R.sort((a, b) => a.x - b.x);
    let gap = 68;
    for (let j = 1; j < R.length; j++) gap = Math.min(gap, R[j].x - R[j - 1].x);
    const w = Math.max(62, Math.min(W * 0.27, gap * W / 68 - 6)), h = Math.min(band - 6, 74);
    for (const s of R) out.push({ s, cx: Math.max(w / 2 + 3, Math.min(W - w / 2 - 3, s.x / 68 * W)), cy: pad + (i + 0.5) * band, w, h });
  });
  return out;
}

export function ShadowBoard({ fmt, content, info, onSlot }: { fmt: MpFmt; content: SpContent; info: (ref: string) => RefInfo | null; onSlot: (key: string) => void }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const [W, setW] = useState(0);
  const width = Math.min(W, 560), H = Math.round(width * 105 / 68);
  const slots = planSlots(fmt, content.formation);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", alignItems: "center" }}>
      {width ? <View testID="sk-board" style={{ width, height: H }}>
        <PitchSurface width={width} height={H} />
        {layout(slots, width, H).map(({ s: sl, cx, cy, w, h }) => {
          const st = content.slots[sl.key]; if (!st) return null;
          const d = slotDepth(st, info), lc = levelCol(c, d.level);
          const own = st.own.map(info).filter((x): x is RefInfo => !!x), sh = st.shadow.map(info).filter((x): x is RefInfo => !!x);
          return (
            <Pressable key={sl.key} testID={"sk-slot-" + sl.key} accessibilityRole="button" accessibilityLabel={`${t("mps_" + sl.pos)} · ${t("sk_lvl_" + d.level)}`} onPress={() => onSlot(sl.key)}
              style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: 9, backgroundColor: "rgba(10,16,24,0.78)",
                borderLeftWidth: 4, borderLeftColor: lc, paddingHorizontal: 6, paddingVertical: 4, gap: 1, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11.5, letterSpacing: 0.4 }}>{t("mps_" + sl.pos)}</Text>
                <View style={{ flex: 1 }} />
                {Array.from({ length: st.target }).map((_, i) => (
                  <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i < d.firm ? c.ok : i < d.firm + d.maybe ? c.warn : "transparent", borderWidth: 1, borderColor: i < d.firm ? c.ok : i < d.firm + d.maybe ? c.warn : "#ff8a80" }} />
                ))}
              </View>
              {own.length ? own.slice(0, 2).map((o, i) => (
                <View key={o.ref} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: stateCol(c, o.state) }} />
                  <Text numberOfLines={1} style={{ flex: 1, color: i ? "rgba(255,255,255,0.78)" : "#fff", fontWeight: i ? "600" : "800", fontSize: i ? 10.5 : 11.5 }}>{shortName(o.name)}</Text>
                </View>
              )) : <Text style={{ color: "#ff8a80", fontWeight: "800", fontSize: 11 }}>{t("sk_legend_need")}</Text>}
              {sh.length ? <Text numberOfLines={1} style={{ color: SHADOW, fontWeight: "700", fontSize: 10.5 }}>◆ {shortName(sh[0].name)}{sh.length > 1 ? ` +${sh.length - 1}` : ""}</Text> : null}
            </Pressable>
          );
        })}
      </View> : null}
      <Row wrap gap={12} style={{ marginTop: 8, justifyContent: "center" }}>
        {[["firm", c.ok], ["maybe", c.warn], ["need", c.crit]].map(([k, col]) => (
          <Row key={k} gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} /><Muted small>{t("sk_legend_" + k)}</Muted></Row>
        ))}
        <Row gap={5}><Text style={{ color: c.event, fontWeight: "900", fontSize: 12 }}>◆</Text><Muted small>{t("sk_legend_shadow")}</Muted></Row>
      </Row>
    </View>
  );
}

/** Dieselben Positionen als Liste: alle Namen, Stand, Anforderungsprofil */
export function PositionList({ fmt, content, info, onSlot }: { fmt: MpFmt; content: SpContent; info: (ref: string) => RefInfo | null; onSlot: (key: string) => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  return (
    <Col gap={8} testID="sk-poslist">
      {planSlots(fmt, content.formation).map(sl => {
        const st = content.slots[sl.key]; if (!st) return null;
        const d = slotDepth(st, info), lc = levelCol(c, d.level);
        const own = st.own.map(info).filter((x): x is RefInfo => !!x), sh = st.shadow.map(info).filter((x): x is RefInfo => !!x);
        return (
          <Pressable key={sl.key} testID={"sk-row-" + sl.key} accessibilityRole="button" onPress={() => onSlot(sl.key)}>
            <Card style={{ borderLeftWidth: 4, borderLeftColor: lc, paddingVertical: 10, gap: 6 }}>
              <Row gap={8} style={{ alignItems: "flex-start" }}>
                <View style={{ minWidth: 34, paddingHorizontal: 6, height: 24, marginTop: 1, borderRadius: radius.s, backgroundColor: withAlpha(lc, 0.16), alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontWeight: "900", color: lc, fontSize: 12 }}>{t("mps_" + sl.pos)}</Text>
                </View>
                <Col gap={1} style={{ flex: 1 }}>
                  <T bold numberOfLines={2}>{t("pos_" + sl.pos)}{sl.side ? " · " + t("sk_side_" + sl.side) : ""}</T>
                  <Muted small testID={"sk-row-depth-" + sl.key}>{d.maybe ? tf("sk_depthMaybe", { f: d.firm, t: st.target, m: d.maybe }) : tf("sk_depth", { f: d.firm, t: st.target })}</Muted>
                </Col>
                <StateTag label={t("sk_lvl_" + d.level)} color={lc} />
              </Row>
              {own.length ? <Row wrap gap={6}>{own.map(o => <StateTag key={o.ref} label={`${o.name} · ${t("sks_" + o.state)}`} color={stateCol(c, o.state)} />)}</Row>
                : <Muted small>{t("sk_none")}</Muted>}
              {sh.length ? <Text style={{ color: c.event, fontWeight: "700", fontSize: 12.5 }}>◆ {sh.map((x, i) => `${i + 1}. ${x.name}`).join("  ·  ")}</Text> : null}
              {st.need ? <Muted small>„{st.need}“</Muted> : null}
            </Card>
          </Pressable>
        );
      })}
    </Col>
  );
}
