// Körperkarte: gezeichnete Figur (vorne/hinten, altersgerecht) zum Antippen schmerzender Stellen,
// danach Angaben zum Schmerz (Stärke, Art, Beginn, Dauer, Situation, Kontakt, Zeichen, Trainierbarkeit).
// Auch als reine Anzeige (Trainer) und als Einzelauswahl (Region einer Verletzung).
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Ellipse, Path, Rect, Text as SvgText } from "react-native-svg";
import { areaLabel, bodyDef, cleanAreas, parseArea, type BodyCode, type Side } from "../core/body";
import { FIG_H, FIG_W, figureFor, figureParts, figureSilhouette, type FigureKind, type Part, type Shape, type View as FigView } from "../core/figure";
import { PAIN_Q, PAIN_Q_KID, PAIN_SIGNS, PAIN_SIGNS_KID, PAIN_WHEN, cleanPain, nrsLevel, painEffect, painSummary, preventionFor, teamHotspots } from "../core/pain";
import type { Complaint, PainInfo } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { BodyPicker } from "./body";
import { Banner, Bar, Btn, Card, CardTitle, Col, Info, Muted, Row, Seg, Sheet, T } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

const VIEWS: FigView[] = ["front", "back"];
const base = (code: string): string => code.split(":")[0];
/** Prozentwert für Positionen (Typ für React Native) */
const pct = (n: number) => `${Math.round(n * 100) / 100}%` as const;

function ShapeEl({ s, fill, stroke }: { s: Shape; fill: string; stroke: string }) {
  const w = stroke === "none" ? 0 : 0.5;
  if (s.t === "ell") return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} stroke={stroke} strokeWidth={w} />;
  if (s.t === "rect") return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} ry={s.r} fill={fill} stroke={stroke} strokeWidth={w} />;
  return <Path d={s.d} fill={fill} stroke={stroke} strokeWidth={w} />;
}

/** Eine Figur (vorne oder hinten) mit markierten Regionen; optional antippbar */
function Figure({ kind, view, sel, color, onTap, testID }: { kind: FigureKind; view: FigView; sel: string[]; color: string; onTap?: (p: Part) => void; testID: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const parts = useMemo(() => figureParts(kind, view), [kind, view]);
  const sil = useMemo(() => figureSilhouette(kind), [kind]);
  const isSel = (p: Part): boolean => sel.some(code => { const [k, sd] = code.split(":"); return k === p.k && (!p.side || !sd || sd === "b" || sd === p.side); });
  const left = view === "front" ? t("bd_side_short_r") : t("bd_side_short_l"), right = view === "front" ? t("bd_side_short_l") : t("bd_side_short_r");
  return (
    <Col gap={4} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
      <View testID={`${testID}-${view}`} style={{ width: "100%", maxWidth: 190, aspectRatio: FIG_W / FIG_H }}>
        <Svg viewBox={`0 0 ${FIG_W} ${FIG_H}`} width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0 }}>
          {sil.map((sh, i) => <ShapeEl key={"s" + i} s={sh} fill={c.sunk} stroke="none" />)}
          {parts.map((p, i) => <ShapeEl key={i} s={p.shape} fill={isSel(p) ? color : "transparent"} stroke={isSel(p) ? withAlpha(color, 0.95) : withAlpha(c.muted, 0.35)} />)}
          <SvgText x={1} y={128} fontSize={9} fontWeight="800" fill={c.muted}>{left}</SvgText>
          <SvgText x={FIG_W - 1} y={128} fontSize={9} fontWeight="800" fill={c.muted} textAnchor="end">{right}</SvgText>
        </Svg>
        {onTap ? parts.map((p, i) => (
          <Pressable key={i} testID={`${testID}-${view}-${p.k}${p.side ? "-" + p.side : ""}`} accessibilityRole="button"
            accessibilityLabel={`${t("bd_" + p.k)}${p.side ? " " + t("bd_side_" + p.side) : ""} (${t("bm_" + view)})`} onPress={() => onTap(p)}
            style={{ position: "absolute", left: pct(p.hit.x), top: pct((p.hit.y / FIG_H) * 100), width: pct(p.hit.w), height: pct((p.hit.h / FIG_H) * 100) }} />
        )) : null}
      </View>
      <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: c.muted, textTransform: "uppercase" }}>{t("bm_" + view)}</Text>
    </Col>
  );
}

/** Beide Ansichten nebeneinander */
function Figures({ kind, sel, color, onTap, testID }: { kind: FigureKind; sel: string[]; color: string; onTap?: (p: Part) => void; testID: string }) {
  return <Row gap={8} style={{ alignItems: "flex-start" }}>{VIEWS.map(v => <Figure key={v} kind={kind} view={v} sel={sel} color={color} onTap={onTap} testID={testID} />)}</Row>;
}

/** Neue Auswahl nach Antippen: Region dazu, andere Seite ⇒ beidseitig */
function tapCode(value: string[], p: Part): { next: string[]; k: BodyCode } {
  const cur = value.find(x => base(x) === p.k);
  if (!cur) return { next: [...value, p.side ? `${p.k}:${p.side}` : p.k], k: p.k };
  const sd = cur.split(":")[1];
  if (p.side && sd && sd !== "b" && sd !== p.side) return { next: value.map(x => base(x) === p.k ? `${p.k}:b` : x), k: p.k };
  return { next: value, k: p.k };
}

/**
 * Beschwerden im Morgen-Check: Stellen antippen, Angaben zum Schmerz machen. Krankheitszeichen als eigene Knöpfe.
 * `value` = Regionen („hams:l“), `pain` = Angaben je Region (ohne Seite).
 */
export function BodyMap({ value, onChange, pain, onPain, level, color, testID = "bmap", baseRpe, tw }: {
  value: string[]; onChange: (v: string[]) => void; pain: Record<string, PainInfo>; onPain: (p: Record<string, PainInfo>) => void;
  level: Exclude<Complaint, "none">; color: string; testID?: string; baseRpe: number; tw: boolean;
}) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const kind = figureFor(E.grp), kid = kind === "kid";
  const [open, setOpen] = useState<BodyCode | null>(null), [list, setList] = useState(false);
  const sel = cleanAreas(value);
  const tap = (p: Part) => { const { next, k } = tapCode(sel, p); onChange(next); setOpen(k); };
  const toggleIll = (k: "ill_up" | "ill_down") => {
    const on = sel.includes(k);
    onChange(on ? sel.filter(x => x !== k) : [...sel.filter(x => x !== (k === "ill_up" ? "ill_down" : "ill_up")), k]);
  };
  const body = sel.filter(x => bodyDef(base(x))?.zone !== "ill");
  return (
    <Col gap={10} testID={testID}>
      <Muted small>{kid ? t("bm_hintKid") : t("bm_hint")}</Muted>
      {list ? <BodyPicker testID={testID + "-list"} value={sel} onChange={onChange} color={color} />
        : <Figures kind={kind} sel={sel} color={color} onTap={tap} testID={testID} />}
      <Btn small kind="ghost" testID={testID + "-mode"} label={list ? "🧍 " + t("bm_asMap") : "☰ " + t("bm_asList")} onPress={() => setList(!list)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
      {!list ? <Col gap={6}>
        <T v="small" bold>{t("bm_ill")}</T>
        <Row wrap gap={6}>
          {(["ill_up", "ill_down"] as const).map(k => {
            const on = sel.includes(k);
            return (
              <Pressable key={k} testID={`${testID}-${k}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleIll(k)}
                style={{ borderWidth: 1.5, borderColor: on ? color : c.line, backgroundColor: on ? color : c.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}>
                <Text style={{ fontWeight: "700", fontSize: 13, color: on ? "#fff" : c.ink }}>{t("bd_" + k)}</Text>
              </Pressable>
            );
          })}
        </Row>
      </Col> : null}
      {body.length ? <Col gap={6} testID={testID + "-sel"}>
        {body.map(code => {
          const k = base(code) as BodyCode, info = pain[k];
          const ef = painEffect(k, info, level, baseRpe, tw);
          return (
            <Pressable key={code} testID={`${testID}-sel-${k}`} accessibilityRole="button" onPress={() => setOpen(k)}
              style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, padding: 10, gap: 3, backgroundColor: c.surface }}>
              <Row between gap={8}>
                <T bold style={{ flexShrink: 1 }}>{areaLabel(t, code)}</T>
                <Text style={{ color: c.accentTx, fontWeight: "700", fontSize: 13 }}>{info ? t("bm_edit") : t("bm_addInfo")} ›</Text>
              </Row>
              {info ? <Muted small>{painSummary(t, info)}</Muted> : <Muted small>{t("bm_noInfo")}</Muted>}
              {ef.flags.length ? <Text style={{ color: c.crit, fontSize: 12.5, fontWeight: "700" }}>⚠ {t(ef.flags[0] + "_s")}</Text> : null}
            </Pressable>
          );
        })}
      </Col> : null}
      <PainSheet code={open ? sel.find(x => base(x) === open) || null : null} info={open ? pain[open] || {} : {}} kid={kid} level={level} baseRpe={baseRpe} tw={tw}
        onClose={() => setOpen(null)}
        onInfo={info => { if (!open) return; const n = { ...pain }; const ci = cleanPain(info); if (ci) n[open] = ci; else delete n[open]; onPain(n); }}
        onSide={sd => open && onChange(sel.map(x => base(x) === open ? `${open}:${sd}` : x))}
        onSwitch={k => { if (!open) return; const cur = sel.find(x => base(x) === open); const sd = cur?.split(":")[1];
          onChange(sel.map(x => base(x) === open ? (bodyDef(k)?.side ? `${k}:${sd || "r"}` : k) : x));
          const n = { ...pain }; if (n[open]) { n[k] = n[open]; delete n[open]; } onPain(n); setOpen(k); }}
        onRemove={() => { if (!open) return; onChange(sel.filter(x => base(x) !== open)); const n = { ...pain }; delete n[open]; onPain(n); setOpen(null); }} />
    </Col>
  );
}

/** Nachbarregionen zum schnellen Korrigieren (falls daneben getippt) */
const NEAR: Partial<Record<BodyCode, BodyCode[]>> = {
  ankle: ["foot", "shin", "achilles", "heel"], foot: ["ankle", "heel"], heel: ["achilles", "foot", "ankle"], achilles: ["calf", "heel", "ankle"],
  calf: ["achilles", "knee", "shin"], shin: ["calf", "ankle", "knee"], knee: ["quad", "hams", "shin", "calf"], quad: ["groin", "hip", "knee"],
  hams: ["glute", "knee", "calf"], groin: ["hip", "quad", "abdomen"], hip: ["groin", "glute", "lowback"], glute: ["hams", "lowback", "hip"],
  lowback: ["upback", "glute", "hip"], upback: ["neck", "lowback", "shoulder"], abdomen: ["groin", "chest"], chest: ["shoulder", "abdomen"],
  shoulder: ["neck", "arm", "upback"], arm: ["shoulder", "hand"], hand: ["arm"], neck: ["head", "shoulder", "upback"], head: ["neck"],
};

function Chips<K extends string>({ options, value, onChange, multi, testID, label }: { options: K[]; value: K[]; onChange: (v: K[]) => void; multi?: boolean; testID: string; label: (k: K) => string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const on = value.includes(o);
        return (
          <Pressable key={o} testID={`${testID}-${o}`} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={{ checked: on }}
            onPress={() => onChange(multi ? (on ? value.filter(x => x !== o) : [...value, o]) : (on ? [] : [o]))}
            style={{ borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? withAlpha(c.accent, 0.14) : c.surface, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11 }}>
            <Text style={{ fontWeight: "700", fontSize: 13, color: on ? c.accentTx : c.ink }}>{label(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Angaben zum Schmerz einer Region (Kinder: vereinfacht) */
function PainSheet({ code, info, kid, level, baseRpe, tw, onClose, onInfo, onSide, onSwitch, onRemove }: {
  code: string | null; info: PainInfo; kid: boolean; level: Exclude<Complaint, "none">; baseRpe: number; tw: boolean;
  onClose: () => void; onInfo: (i: PainInfo) => void; onSide: (s: Side) => void; onSwitch: (k: BodyCode) => void; onRemove: () => void;
}) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  if (!code) return null;
  const a = parseArea(code)!, d = bodyDef(a.k)!;
  const set = (p: Partial<PainInfo>) => onInfo({ ...info, ...p });
  const ef = painEffect(a.k, cleanPain(info), level, baseRpe, tw);
  const nrsCol = (n: number) => { const l = nrsLevel(n); return l === "ok" ? c.ok : l === "warn" ? c.warn : c.crit; };
  const FACES = ["😀", "🙂", "😐", "🙁", "😣", "😭"];
  const q = (title: string, el: React.ReactNode) => <Col gap={6}><T v="small" bold>{title}</T>{el}</Col>;
  return (
    <Sheet visible onClose={onClose} title={areaLabel(t, code)} testID="pain-sheet" closeLabel={t("done")}>
      <Col gap={14}>
        {d.side ? <Seg testID="pain-side" value={(a.side || "r") as Side} onChange={(sd: Side) => onSide(sd)} options={(["r", "l", "b"] as Side[]).map(x => ({ key: x, label: t("bd_side_" + x) }))} /> : null}
        {NEAR[a.k]?.length ? <Col gap={4}><Muted small>{t("bm_near")}</Muted><Row wrap gap={6}>{NEAR[a.k]!.map(k => (
          <Btn key={k} small kind="ghost" testID={"pain-near-" + k} label={t("bd_" + k)} onPress={() => onSwitch(k)} />
        ))}</Row></Col> : null}
        {q(kid ? t("pi_nrsKid") : t("pi_nrs"), kid
          ? <Row wrap gap={6}>{[0, 2, 4, 6, 8, 10].map((n, i) => {
              const on = info.nrs === n;
              return <Pressable key={n} testID={"pain-nrs-" + n} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${n}/10`} onPress={() => set({ nrs: on ? null : n })}
                style={{ alignItems: "center", borderWidth: 1.5, borderColor: on ? nrsCol(n) : c.line, backgroundColor: on ? withAlpha(nrsCol(n), 0.16) : c.surface, borderRadius: radius.m, paddingVertical: 6, paddingHorizontal: 8, minWidth: 46 }}>
                <Text style={{ fontSize: 22 }}>{FACES[i]}</Text><Text style={{ fontSize: 11, fontWeight: "700", color: c.muted }}>{n}</Text>
              </Pressable>;
            })}</Row>
          : <Row wrap gap={4}>{Array.from({ length: 11 }, (_, n) => {
              const on = info.nrs === n;
              return <Pressable key={n} testID={"pain-nrs-" + n} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${n}/10`} onPress={() => set({ nrs: on ? null : n })}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: on ? nrsCol(n) : c.line, backgroundColor: on ? nrsCol(n) : c.surface }}>
                <Text style={{ fontWeight: "800", color: on ? "#fff" : c.ink }}>{n}</Text>
              </Pressable>;
            })}</Row>)}
        {!kid ? <Muted small>{t("pi_nrsD")}</Muted> : null}
        {q(t("pi_q"), <Chips testID="pain-q" multi options={kid ? PAIN_Q_KID : PAIN_Q} value={info.q || []} onChange={v => set({ q: v })} label={k => t((kid ? "pqk_" : "pq_") + k)} />)}
        {q(t("pi_onset"), <Chips testID="pain-onset" options={["sudden", "gradual"] as const} value={info.onset ? [info.onset] : []} onChange={v => set({ onset: v[0] || null })} label={k => t((kid ? "pok_" : "pol_") + k)} />)}
        {q(t("pi_since"), <Chips testID="pain-since" options={kid ? ["today", "days", "long"] as const : ["today", "days", "week", "long"] as const} value={info.since ? [info.since] : []} onChange={v => set({ since: v[0] || null })} label={k => t("psl_" + k)} />)}
        {!kid ? q(t("pi_when"), <Chips testID="pain-when" multi options={PAIN_WHEN} value={info.when || []} onChange={v => set({ when: v })} label={k => t("pwhl_" + k)} />) : null}
        {q(kid ? t("pi_causeKid") : t("pi_cause"), <Chips testID="pain-cause" options={["contact", "noncontact", "none"] as const} value={info.cause ? [info.cause] : []} onChange={v => set({ cause: v[0] || null })} label={k => t((kid ? "pck_" : "pcl_") + k)} />)}
        {q(kid ? t("pi_signsKid") : t("pi_signs"), <Chips testID="pain-signs" multi options={kid ? PAIN_SIGNS_KID : PAIN_SIGNS} value={info.signs || []} onChange={v => set({ signs: v })} label={k => t((kid ? "pgk_" : "pgl_") + k)} />)}
        {q(t("pi_train"), <Chips testID="pain-train" options={["full", "limited", "no"] as const} value={info.train ? [info.train] : []} onChange={v => set({ train: v[0] || null })} label={k => t("ptl_" + k)} />)}
        {ef.flags.length ? <Banner color={c.crit} testID="pain-flags"><Col gap={4}>{ef.flags.map(f => <T key={f} v="small">⚠ {t(f)}</T>)}</Col></Banner>
          : ef.kind !== "mod" ? <Banner color={c.warn} testID="pain-advice"><T v="small">{t(ef.how)}</T></Banner> : null}
        <Row gap={8} wrap>
          <Btn kind="primary" testID="pain-done" label={t("done")} onPress={onClose} />
          <Btn kind="ghost" testID="pain-remove" label={t("bm_remove")} onPress={onRemove} />
        </Row>
      </Col>
    </Sheet>
  );
}

/** Einzelauswahl einer Region (Verletzung): Figur antippen, Seite wählen */
export function RegionMap({ value, onChange, testID = "rmap" }: { value: string | null | undefined; onChange: (v: string | null) => void; testID?: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const kind = figureFor(E.grp), sel = value && parseArea(value) ? [value] : [];
  return (
    <Col gap={6} testID={testID}>
      <Figures kind={kind} sel={sel} color={c.inj} testID={testID} onTap={p => {
        const cur = value ? parseArea(value) : null;
        if (cur && cur.k === p.k && p.side && cur.side && cur.side !== p.side && cur.side !== "b") onChange(`${p.k}:b`);
        else if (cur && cur.k === p.k && (!p.side || cur.side === p.side || cur.side === "b")) onChange(null);
        else onChange(p.side ? `${p.k}:${p.side}` : p.k);
      }} />
      <Muted small>{value && parseArea(value) ? areaLabel(t, value) : t("bm_tapInjury")}</Muted>
    </Col>
  );
}

/** Nur anzeigen (Trainer): Figur mit markierten Regionen und Angaben je Region */
export function BodyMapView({ areas, pain, color, testID = "bmview", compact }: { areas: string[]; pain?: Record<string, PainInfo>; color: string; testID?: string; compact?: boolean }) {
  const E = useEngine(); const { t } = E;
  const sel = cleanAreas(areas), body = sel.filter(x => bodyDef(base(x))?.zone !== "ill");
  if (!body.length) return null;
  return (
    <Row gap={10} testID={testID} style={{ alignItems: "flex-start" }}>
      <View style={{ width: compact ? 120 : 150 }}><Figures kind={figureFor(E.grp)} sel={body} color={color} testID={testID} /></View>
      <Col gap={6} style={{ flex: 1, minWidth: 0 }}>
        {body.map(code => (
          <Col key={code} gap={2}>
            <T v="small" bold>{areaLabel(t, code)}</T>
            {pain?.[base(code)] ? <Muted small>{painSummary(t, pain[base(code)])}</Muted> : null}
          </Col>
        ))}
      </Col>
    </Row>
  );
}


/** Trainer: Häufung von Beschwerden im Team (4 Wochen) mit Figur und Präventions-Hinweisen */
export function TeamHotspots({ testID = "hotspots" }: { testID?: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const spots = useMemo(() => teamHotspots(E.D, E.TODAY), [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = preventionFor(spots, E.D.players.length);
  const max = spots[0]?.players.length || 1;
  return (
    <Card testID={testID}>
      <CardTitle title={t("hs_title")} info={<Info title={t("hs_title")} text={t("hs_info")} />} />
      {spots.length ? <Row gap={12} style={{ alignItems: "flex-start" }}>
        <View style={{ width: 130 }}><Figures kind={figureFor(E.grp)} sel={spots.map(h => h.k)} color={c.warn} testID={testID + "-fig"} /></View>
        <Col gap={6} style={{ flex: 1, minWidth: 0 }}>
          {spots.slice(0, 8).map(h => (
            <Col key={h.k} gap={3} testID={`${testID}-${h.k}`}>
              <Row between gap={6}><T v="small" bold style={{ flexShrink: 1 }}>{t("bd_" + h.k)}</T><Muted small>{tf("hs_players", { n: h.players.length })}</Muted></Row>
              <Bar value={h.players.length / max} color={h.clear ? c.crit : c.warn} />
            </Col>
          ))}
        </Col>
      </Row> : <Muted>{t("hs_none")}</Muted>}
      {prev.length ? <Banner testID={testID + "-prev"}><Col gap={4}><T v="small" bold>{t("hs_prev")}</T>{prev.map(g => <T key={g} v="small">• {t("hs_prev_" + g)}</T>)}</Col></Banner> : null}
    </Card>
  );
}
