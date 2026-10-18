// Matchplan ansehen (Spieler und Vorschau des Trainerteams): eigene Aufgabe zuerst, Spielidee, Aufstellung,
// Taktik & Standards, Gegner, Wechselplan – nur die freigegebenen Bereiche. Wasserzeichen mit Name und Zeit.
import React, { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import type { Match, MpPublished } from "../../core/types";
import { useEngine } from "../../data/store";
import { Card, CardTitle, Col, Muted, Row, T } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { useTokenInfo } from "./common";
import { Pitch, usePitchWidth } from "./pitch";
import { SlidesView } from "./slides";

/** Wasserzeichen über den ganzen Inhalt (schräg, wiederholt) – Name des Spielers und Zeitpunkt */
export function Watermark({ text, height, testID = "mp-watermark" }: { text: string; height: number; testID?: string }) {
  const { dark } = useTheme();
  const rows = Math.max(4, Math.ceil(height / 110));
  return (
    <View pointerEvents="none" testID={testID} style={{ position: "absolute", left: 0, right: 0, top: 0, height, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Text key={i} numberOfLines={1} style={{ position: "absolute", top: i * 110 + 30, left: i % 2 ? -160 : -100, width: 1400, transform: [{ rotate: "-24deg" }],
          fontSize: 17, fontWeight: "800", letterSpacing: 1, color: dark ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.075)" }}>
          {`${text}   ·   ${text}   ·   ${text}   ·   ${text}`}
        </Text>
      ))}
    </View>
  );
}

function Section({ title, children, testID }: { title: string; children: React.ReactNode; testID?: string }) {
  return <Card testID={testID}><CardTitle title={title} />{children}</Card>;
}
const Para = ({ label, text }: { label: string; text: string }) => text.trim() ? <Col gap={3}><T v="small" bold>{label}</T><T>{text}</T></Col> : null;

export function PlanContentView({ pub, pid, match }: { pub: MpPublished; pid: string | null; match: Match | null }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme(); const info = useTokenInfo();
  const [W, setW] = useState(0); const pw = usePitchWidth("full", W);
  const has = (k: string) => pub.sections.includes(k as never);
  const mine = pid && pub.tasks ? pub.tasks[pid] : null;
  const myPos = pid ? pub.lineup?.find(x => x.pid === pid)?.label : null, onBench = pid ? pub.bench?.includes(pid) : false;
  const keys = (pub.idea?.keys || []).filter(k => k.trim());
  const mode = pub.mode || "name", size = pub.size || 1;
  const tasks = Object.entries(pub.tasks || {}).filter(([k, v]) => v.trim() && k !== pid);
  return (
    <Col gap={16}>
      {pid && has("lineup") && (myPos || onBench) ? <View testID="pv-role" style={{ padding: 14, borderRadius: radius.l, backgroundColor: withAlpha(col.accent, 0.12), borderWidth: 1, borderColor: withAlpha(col.accent, 0.35), gap: 4 }}>
        <T v="eyebrow">{t("pv_role")}</T>
        <T v="h3">{myPos ? `${t("pv_start")} · ${E.t("mps_" + myPos)}` : t("pv_bench")}</T>
        {pub.captain === pid ? <T v="small" bold>{t("pv_captain")}</T> : null}
      </View> : null}
      {mine ? <View testID="pv-mytask" style={{ padding: 14, borderRadius: radius.l, backgroundColor: withAlpha("#ffd43b", 0.22), borderLeftWidth: 4, borderLeftColor: "#e0a800", gap: 4 }}>
        <T v="eyebrow">{t("pv_myTask")}</T>
        <T v="h3" style={{ textTransform: "none" }}>{mine}</T>
      </View> : null}
      {has("idea") && pub.idea && (pub.idea.motto || keys.length || pub.idea.ball || pub.idea.gegen || pub.idea.umschalt) ? <Section title={t("mp_idea")} testID="pv-idea">
        {pub.idea.motto ? <Text style={{ fontSize: 22, fontWeight: "900", color: col.accentTx, textTransform: "uppercase", letterSpacing: 0.4 }}>{pub.idea.motto}</Text> : null}
        {keys.length ? <Col gap={8}>{keys.map((k, i) => (
          <Row key={i} gap={10} align="flex-start">
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: col.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: col.accentInk, fontWeight: "900" }}>{i + 1}</Text></View>
            <T style={{ flex: 1 }} bold>{k}</T>
          </Row>))}</Col> : null}
        <Para label={t("mp_ball")} text={pub.idea.ball} />
        <Para label={t("mp_gegen")} text={pub.idea.gegen} />
        <Para label={t("mp_umschalt")} text={pub.idea.umschalt} />
      </Section> : null}
      {has("lineup") && pub.lineup ? <Section title={`${t("mp_sec_lineup")}${pub.formation ? " · " + pub.formation : ""}`} testID="pv-lineup">
        <View onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", alignItems: "center" }}>
          {W ? <Pitch view="full" items={pub.lineup} width={pw} mode={mode} size={size} accent={col.accent} accentInk={col.accentInk} info={info} captain={pub.captain} highlight={pid} testID="pv-pitch" /> : null}
        </View>
        {pub.bench?.length ? <Col gap={4}><T v="small" bold>{t("mp_benchShort")}</T>
          <Muted small>{pub.bench.map(b => { const i = info(b); return i ? (i.nr != null ? i.nr + " " : "") + i.label : null; }).filter(Boolean).join(" · ")}</Muted></Col> : null}
      </Section> : null}
      {has("slides") && pub.slides?.length ? <Section title={t("mp_sec_slides")} testID="pv-slides-card">
        <SlidesView slides={pub.slides} c={{ mode, size, captain: pub.captain || null }} />
      </Section> : null}
      {has("opp") && pub.opp ? <Section title={`${t("mp_opp")}${match ? " · " + match.gegner : ""}`} testID="pv-opp">
        {pub.opp.formation ? <T bold>{t("mp_oppFormation")}: {pub.opp.formation}</T> : null}
        <Para label={t("mp_oppStyle")} text={pub.opp.style} />
        <Para label={t("mp_oppStrong")} text={pub.opp.strong} />
        <Para label={t("mp_oppWeak")} text={pub.opp.weak} />
        {pub.opp.keys.length ? <Col gap={6}><T v="small" bold>{t("mp_oppKeys")}</T>
          {pub.opp.keys.map((k, i) => <Row key={i} gap={10} align="flex-start">
            <View style={{ minWidth: 30, height: 30, borderRadius: 15, backgroundColor: "#c92a2a", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}><Text style={{ color: "#fff", fontWeight: "900" }}>{k.n ?? "?"}</Text></View>
            <Col gap={1} style={{ flex: 1 }}><T bold>{k.name}</T>{k.note ? <Muted small>{k.note}</Muted> : null}</Col>
          </Row>)}</Col> : null}
        <Para label={t("mp_oppPlan")} text={pub.opp.plan} />
      </Section> : null}
      {has("tasks") && tasks.length ? <Section title={t("mp_tasksAll")} testID="pv-tasks">
        {tasks.map(([k, v]) => { const i = info(k); return i ? <Col key={k} gap={2}><T v="small" bold>{(i.nr != null ? i.nr + " · " : "") + i.label}</T><T>{v}</T></Col> : null; })}
      </Section> : null}
      {has("subs") && (pub.subs?.length || pub.subsNote) ? <Section title={t("mp_subs")} testID="pv-subs">
        {(pub.subs || []).slice().sort((a, b) => a.min - b.min).map(sb => <T key={sb.id}>{sb.min}′ · {sb.out ? info(sb.out)?.label || "–" : "–"} ↔ {sb.in ? info(sb.in)?.label || "–" : "–"}{sb.note ? ` (${sb.note})` : ""}</T>)}
        {pub.subsNote ? <Muted small>{pub.subsNote}</Muted> : null}
      </Section> : null}
    </Col>
  );
}
