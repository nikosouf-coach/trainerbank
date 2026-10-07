// Gemeinsame Editoren für Einrichtung und Einstellungen (gesteuert über value/onChange).
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CLASSES, KINDS, MDS, PACKAGES, PITCH, classLabel, defaultPrinciples, groupOf, isGrowthAge } from "../core/classes";
import type { Translator } from "../core/i18n";
import type { ClassKey, CustomKind, Depth, Kind, Modules, Principles, TeamSettings } from "../core/types";
import { Banner, Btn, Col, Info, Muted, Picker, Row, T, Tag, TimeField, ToggleRow } from "./kit";
import { radius, rpeColor, useTheme } from "./theme";

export function ClassPicker({ value, onChange, tr }: { value: ClassKey; onChange: (k: ClassKey) => void; tr: Translator }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {CLASSES.map(k => {
        const on = k.k === value;
        return (
          <Pressable key={k.k} testID={"cls-" + k.k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(k.k)}
            style={{ minWidth: 92, flexGrow: 1, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, borderRadius: radius.m, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center" }}>
            <Text style={{ fontWeight: "800", color: on ? c.accentInk : c.ink, fontSize: 15 }}>{classLabel(k, tr.lang)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DepthPicker({ value, onChange, tr, kids }: { value: Depth; onChange: (d: Depth) => void; tr: Translator; kids: boolean }) {
  const { c } = useTheme();
  return (
    <Col gap={10}>
      {(["org", "basis", "pro"] as Depth[]).map(k => {
        const on = k === value, dis = kids && k === "pro";
        return (
          <Pressable key={k} testID={"depth-" + k} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: dis }} disabled={dis} onPress={() => onChange(k)}
            style={{ borderWidth: on ? 2 : 1.5, borderColor: on ? c.accentTx : c.line, backgroundColor: c.surface, borderRadius: radius.l, padding: 14, gap: 4, opacity: dis ? 0.45 : 1 }}>
            <T v="h3">{tr.t("dp_" + k)}</T>
            <Muted small>{tr.t("dp_" + k + "_d")}</Muted>
          </Pressable>
        );
      })}
    </Col>
  );
}

/** Bausteine, deren Bildschirme noch entstehen (Kennzeichnung „in Entwicklung“). */
export const MODULES_SOON = new Set<keyof Modules>([]);

/** Module nach Paketen gruppiert (Baukasten). */
export function ModuleList({ value, onChange, tr, cls }: { value: Modules; onChange: (m: Modules) => void; tr: Translator; cls: ClassKey }) {
  const kids = groupOf(cls) === "u11";
  return (
    <Col gap={18}>
      {PACKAGES.map(pk => (
        <Col key={pk.key} gap={10}>
          <Col gap={2}><T v="eyebrow">{tr.t("pk_" + pk.key)}</T>{tr.t("pkd_" + pk.key) !== "pkd_" + pk.key ? <Muted small>{tr.t("pkd_" + pk.key)}</Muted> : null}</Col>
          {pk.mods.map(k => {
            const dis = (kids && ["belastung", "regeneration", "wachstum"].includes(k)) || (k === "wachstum" && !isGrowthAge(cls));
            return <ToggleRow key={k} testID={"mod-" + k} label={tr.t("m_" + k)} desc={tr.t("md_" + k)} value={!!value[k] && !dis} disabled={dis} badge={MODULES_SOON.has(k) ? tr.t("dev") : undefined} onChange={v => onChange({ ...value, [k]: v })} />;
          })}
        </Col>
      ))}
    </Col>
  );
}

export function DaysEditor({ value, onChange, tr }: { value: TeamSettings; onChange: (s: TeamSettings) => void; tr: Translator }) {
  const { c } = useTheme();
  const order = [1, 2, 3, 4, 5, 6, 0], wd = tr.tl("wd");
  const setDay = (d: number, patch: Partial<TeamSettings["days"][number]> | null) => {
    const days = { ...value.days };
    if (patch === null) delete days[d]; else days[d] = { ...(days[d] || { zeit: "19:30", platz: "halb", dauer: value.dauer || 90 }), ...patch };
    onChange({ ...value, days });
  };
  return (
    <Col gap={14}>
      <Row wrap gap={6}>
        {order.map(d => {
          const on = !!value.days[d];
          return (
            <Pressable key={d} testID={"tday-" + d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={wd[d]} onPress={() => setDay(d, on ? null : {})}
              style={{ width: 48, height: 44, borderRadius: radius.m, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontWeight: "800", color: on ? c.accentInk : c.ink }}>{wd[d]}</Text>
            </Pressable>
          );
        })}
      </Row>
      {order.filter(d => value.days[d]).map(d => {
        const cfg = value.days[d];
        return (
          <Row key={d} gap={8} align="flex-end" wrap>
            <T bold style={{ width: 34, paddingBottom: 12 }}>{wd[d]}</T>
            <TimeField testID={"tday-" + d + "-zeit"} label={tr.t("f_time")} value={cfg.zeit} onChange={z => setDay(d, { zeit: z })} style={{ width: 90 }} />
            <MinutesField testID={"tday-" + d + "-dauer"} label={tr.t("minutes")} value={cfg.dauer || value.dauer} onChange={m => setDay(d, { dauer: m })} />
            <Picker testID={"tday-" + d + "-platz"} label={tr.t("pitch")} value={cfg.platz} options={PITCH.map(p => ({ key: p, label: tr.t("p_" + p) }))} onChange={p => setDay(d, { platz: p })} style={{ flex: 1, minWidth: 140 }} />
          </Row>
        );
      })}
      <Row gap={10} wrap align="flex-end">
        <Picker testID="s-spieltag" label={tr.t("mday")} value={String(value.spieltag)} options={[6, 0, 5, 3].map(d => ({ key: String(d), label: wd[d] }))} onChange={v => onChange({ ...value, spieltag: Number(v) })} style={{ width: 150 }} />
        <TimeField testID="s-anstoss" label={tr.t("mtime")} value={value.anstoss} onChange={z => onChange({ ...value, anstoss: z })} style={{ width: 110 }} />
      </Row>
      <ToggleRow testID="s-fix" label={tr.t("fixDur")} value={value.fix} onChange={v => onChange({ ...value, fix: v })} />
    </Col>
  );
}
function MinutesField({ label, value, onChange, testID }: { label: string; value: number; onChange: (m: number) => void; testID?: string }) {
  const { c } = useTheme(); const [txt, setTxt] = useState(String(value));
  return (
    <View style={{ gap: 4, width: 76 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.muted }}>{label}</Text>
      <TextInput testID={testID} accessibilityLabel={label} value={txt} keyboardType="number-pad" maxLength={3}
        onChangeText={s => { setTxt(s); const n = Number(s); if (n >= 20 && n <= 180) onChange(n); }}
        onBlur={() => { const n = Number(txt); if (!(n >= 20 && n <= 180)) setTxt(String(value)); }}
        style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: c.bg, color: c.ink, fontSize: 16, minHeight: 44 }} />
    </View>
  );
}

export interface PrinciplesFeedback { list: { md: string; text: string }[] }
/** Spieltags-Prinzipien inkl. Spieltag (MD), Empfehlung mit Rückmeldung und eigenen Trainingsarten. */
export function PrinciplesEditor({ value, onChange, tr, cls, depth, kinds, onNewKind, onEditKind }: {
  value: Principles; onChange: (p: Principles) => void; tr: Translator; cls: ClassKey; depth: Depth;
  kinds: CustomKind[]; onNewKind?: (md?: string) => void; onEditKind?: (k: CustomKind) => void;
}) {
  const { c } = useTheme();
  const [fb, setFb] = useState<{ list: string[]; rows: string[]; undo: Principles } | null>(null);
  const showRpe = depth !== "org";
  const kn = (k: Kind): string => k.startsWith("c:") ? (kinds.find(x => "c:" + x.id === k)?.name || "?") : tr.t("k_" + k);
  const options = [...KINDS.map(k => ({ key: k as string, label: tr.t("k_" + k) })), ...kinds.map(k => ({ key: "c:" + k.id, label: k.name })), ...(onNewKind ? [{ key: "__new", label: tr.t("kind_newOpt") }] : [])];
  const setRow = (md: string, patch: Partial<{ kind: Kind; rpe: number }>) => { setFb(null); onChange({ ...value, [md]: { ...(value[md] || { kind: "aufbau", rpe: 5 }), ...patch } }); };
  const recommend = () => {
    const rec = defaultPrinciples(groupOf(cls)), list: string[] = [], rows: string[] = [];
    ["MD", ...MDS].forEach(md => {
      const a = value[md], b = rec[md], parts: string[] = [];
      if (!a || a.kind !== b.kind) parts.push(`${a ? kn(a.kind) : "–"} → ${kn(b.kind)}`);
      if (showRpe && (!a || a.rpe !== b.rpe) && b.kind !== "frei") parts.push(`RPE ${a ? a.rpe : "–"} → ${b.rpe}`);
      if (parts.length) { rows.push(md); list.push(`${md}: ${parts.join(", ")}`); }
    });
    setFb({ list, rows, undo: value }); onChange(rec);
  };
  return (
    <Col gap={10}>
      {["MD", ...MDS].map(md => {
        const p = value[md] || { kind: "spiel" as Kind, rpe: 8 }, hl = fb?.rows.includes(md);
        return (
          <Row key={md} gap={8} align="flex-end" style={{ backgroundColor: hl ? c.accentSoft : md === "MD" ? c.sunk : "transparent", borderRadius: radius.s, padding: md === "MD" || hl ? 6 : 0 }}>
            <T bold style={{ width: 50, paddingBottom: 12 }}>{md}</T>
            {md === "MD"
              ? <Row gap={6} style={{ flex: 1, paddingBottom: 10 }}><T bold color={c.accentTx}>{tr.t("k_spiel")}</T><Info title="MD" text={tr.t("pr_md")} testID="info-md" /></Row>
              : <Picker testID={"prin-" + md} label={tr.t("content")} value={p.kind as string} options={options} style={{ flex: 1 }}
                  onChange={k => { if (k === "__new") { onNewKind && onNewKind(md); return; } const kind = k as Kind; const custom = kinds.find(x => "c:" + x.id === kind);
                    setRow(md, { kind, rpe: kind === "frei" ? 0 : custom ? custom.rpe : value[md]?.rpe || 5 }); }} />}
            {showRpe ? <RpeBox testID={"prin-" + md + "-rpe"} value={p.rpe} disabled={p.kind === "frei"} onChange={r => setRow(md, { rpe: r })} /> : null}
          </Row>
        );
      })}
      <Row wrap gap={8}>
        <Btn small testID="prin-reset" label={tr.t("pr_reset")} onPress={recommend} />
        <Info title={tr.t("pr_reset")} text={tr.t("pr_info")} testID="info-prin" />
        {onNewKind ? <Btn small testID="kind-new" label={tr.t("kind_new")} onPress={() => onNewKind()} /> : null}
        {onNewKind ? <Info title={tr.t("kind_title")} text={tr.t("kind_hint")} testID="info-kind" /> : null}
      </Row>
      {fb ? (
        <Banner color={c.ok} testID="prin-feedback">
          <Col gap={6}>
            <T bold>{fb.list.length ? tr.tf("pr_fb_n", { cls: classLabel(CLASSES.find(x => x.k === cls)!, tr.lang), n: fb.list.length }) : tr.tf("pr_fb_none", { cls: classLabel(CLASSES.find(x => x.k === cls)!, tr.lang) })}</T>
            {fb.list.map((x, i) => <T key={i} v="small">• {x}</T>)}
            {fb.list.length ? <Btn small testID="prin-undo" label={tr.t("pr_undo")} onPress={() => { onChange(fb.undo); setFb(null); }} style={{ alignSelf: "flex-start" }} /> : null}
          </Col>
        </Banner>
      ) : null}
      {kinds.length && onEditKind ? (
        <Col gap={6}>
          <T v="eyebrow">{tr.t("kind_mine")}</T>
          <Row wrap gap={6}>
            {kinds.map(k => (
              <Pressable key={k.id} testID={"kind-" + k.id} accessibilityRole="button" onPress={() => onEditKind(k)}
                style={{ borderWidth: 1, borderColor: c.line, borderLeftWidth: 4, borderLeftColor: rpeColor(c, k.rpe), borderRadius: radius.s, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: c.surface }}>
                <Text style={{ fontWeight: "700", color: c.ink }}>{k.name}{showRpe ? ` · RPE ${k.rpe}` : ""}</Text>
              </Pressable>
            ))}
          </Row>
        </Col>
      ) : null}
    </Col>
  );
}
function RpeBox({ value, onChange, disabled, testID }: { value: number; onChange: (n: number) => void; disabled?: boolean; testID?: string }) {
  const { c } = useTheme(); const [txt, setTxt] = useState(String(value)); const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setTxt(String(value)); }
  return (
    <View style={{ gap: 4, width: 64 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.muted }}>RPE</Text>
      <TextInput testID={testID} accessibilityLabel="RPE" editable={!disabled} value={txt} keyboardType="number-pad" maxLength={2}
        onChangeText={s => { setTxt(s); const n = Number(s); if (s !== "" && n >= 0 && n <= 10) { setLast(n); onChange(n); } }}
        style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: c.bg, color: c.ink, fontSize: 16, minHeight: 44, opacity: disabled ? 0.5 : 1 }} />
    </View>
  );
}

/** Kurze Zusammenfassung für den letzten Schritt der Einrichtung. */
export function SetupSummary({ tr, cls, depth, settings }: { tr: Translator; cls: ClassKey; depth: Depth; settings: TeamSettings }) {
  const wd = tr.tl("wd");
  const days = Object.keys(settings.days).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => wd[d]).join(", ") || "–";
  return (
    <Col gap={8}>
      <Row between><Muted>{tr.t("ageClass")}</Muted><T bold>{classLabel(CLASSES.find(x => x.k === cls)!, tr.lang)}</T></Row>
      <Row between><Muted>{tr.t("depthT")}</Muted><T bold>{tr.t("dp_" + depth)}</T></Row>
      <Row between><Muted>{tr.t("trSet")}</Muted><T bold>{days}</T></Row>
      {groupOf(cls) === "u11" ? <Tag label={tr.t("kidsNote")} /> : null}
    </Col>
  );
}
