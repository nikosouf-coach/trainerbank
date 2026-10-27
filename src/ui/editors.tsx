// Gemeinsame Editoren für Einrichtung und Einstellungen (gesteuert über value/onChange).
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CLASSES, KINDS, KIND_RPE, MDS, PACKAGES, PITCH, capOf, classLabel, defaultPrinciples, groupOf, isGrowthAge } from "../core/classes";
import { PR_NOTE_MAX, exampleWeek, mdOffset, principleHints, principleRows, type PrincipleHint, type WeekDay } from "../core/principles";
import type { Translator } from "../core/i18n";
import type { BuiltinKind, ClassKey, CustomKind, DayUnit, Depth, Kind, Modules, Principle, Principles, TeamSettings, UnitArt } from "../core/types";
import { MAX_UNITS_DAY, UNIT_ARTS, UNIT_DEF, cleanUnit, freeWeeklySlot, shiftTime } from "../core/units";
import { Icon, type IconName } from "./icons";
import { Banner, Btn, Col, Field, Info, Muted, NumField, Picker, Row, T, Tag, TimeField, ToggleRow } from "./kit";
import { radius, rpeColor, useTheme, withAlpha } from "./theme";

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

/** Ist ein Modul für die Altersklasse möglich? (U11 ohne Belastungssteuerung; Wachstum nur im Wachstumsalter) */
export function modAllowed(k: keyof Modules, cls: ClassKey): boolean {
  const kids = groupOf(cls) === "u11";
  return !((kids && ["belastung", "regeneration", "wachstum"].includes(k)) || (k === "wachstum" && !isGrowthAge(cls)));
}
/** Alle wählbaren Module der Pakete an- oder ausschalten. */
export function allModules(value: Modules, cls: ClassKey, on: boolean): Modules {
  const m = { ...value };
  for (const pk of PACKAGES) for (const k of pk.mods) m[k] = on && modAllowed(k, cls);
  return m;
}
/** Anzahl aktiver und wählbarer Module. */
export function moduleCount(value: Modules, cls: ClassKey): { on: number; all: number } {
  const ks = PACKAGES.flatMap(pk => pk.mods).filter(k => modAllowed(k, cls));
  return { on: ks.filter(k => value[k]).length, all: ks.length };
}

/** Module nach Paketen gruppiert (Baukasten). */
export function ModuleList({ value, onChange, tr, cls }: { value: Modules; onChange: (m: Modules) => void; tr: Translator; cls: ClassKey }) {
  return (
    <Col gap={18}>
      {PACKAGES.map(pk => (
        <Col key={pk.key} gap={10}>
          <Col gap={2}><T v="eyebrow">{tr.t("pk_" + pk.key)}</T>{tr.t("pkd_" + pk.key) !== "pkd_" + pk.key ? <Muted small>{tr.t("pkd_" + pk.key)}</Muted> : null}</Col>
          {pk.mods.map(k => {
            const dis = !modAllowed(k, cls);
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
  const setAllDur = (m: number) => {
    const days = { ...value.days }; for (const d of Object.keys(days)) days[Number(d)] = { ...days[Number(d)], dauer: m };
    onChange({ ...value, dauer: m, days });
  };
  const durs = [60, 75, 90, 105, 120];
  return (
    <Col gap={14}>
      <Col gap={6}>
        <T v="small" bold color={c.muted}>{tr.t("dur_all")}</T>
        <Row wrap gap={6}>
          {durs.map(m => {
            const on = value.dauer === m && Object.values(value.days).every(x => (x.dauer || value.dauer) === m);
            return (
              <Pressable key={m} testID={"tdur-" + m} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setAllDur(m)}
                style={{ minWidth: 58, height: 40, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontWeight: "800", color: on ? c.accentInk : c.ink }}>{m}′</Text>
              </Pressable>
            );
          })}
        </Row>
        <Muted small>{tr.t("dur_allHint")}</Muted>
      </Col>
      <T v="small" bold color={c.muted}>{tr.t("days_pick")}</T>
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
            <TimeField testID={"tday-" + d + "-zeit"} label={tr.t("f_time")} value={cfg.zeit} onChange={z => setDay(d, { zeit: z })} lang={tr.lang} style={{ width: 90 }} />
            <MinutesField testID={"tday-" + d + "-dauer"} label={tr.t("minutes")} value={cfg.dauer || value.dauer} onChange={m => setDay(d, { dauer: m })} />
            <Picker testID={"tday-" + d + "-platz"} label={tr.t("pitch")} value={cfg.platz} options={PITCH.map(p => ({ key: p, label: tr.t("p_" + p) }))} onChange={p => setDay(d, { platz: p })} style={{ flex: 1, minWidth: 140 }} />
          </Row>
        );
      })}
      <Row gap={10} wrap align="flex-end">
        <Picker testID="s-spieltag" label={tr.t("mday")} value={String(value.spieltag)} options={[6, 0, 5, 3].map(d => ({ key: String(d), label: wd[d] }))} onChange={v => onChange({ ...value, spieltag: Number(v) })} style={{ width: 150 }} />
        <TimeField testID="s-anstoss" label={tr.t("mtime")} value={value.anstoss} onChange={z => onChange({ ...value, anstoss: z })} lang={tr.lang} style={{ width: 110 }} />
      </Row>
      <ToggleRow testID="s-fix" label={tr.t("fixDur")} value={value.fix} onChange={v => onChange({ ...value, fix: v })} />
    </Col>
  );
}
/**
 * Einrichtung: weitere Einheiten jede Woche (z. B. 30 Min. Athletik vor dem Training, Torwarttraining) – nur Art,
 * Beginn und Dauer. Inhalte, Gruppen, Zuständige und Ziel-RPE folgen später unter Mehr → Training & Prinzipien.
 */
export function SetupUnitsEditor({ value, onChange, tr }: { value: TeamSettings; onChange: (s: TeamSettings) => void; tr: Translator }) {
  const { c } = useTheme();
  const order = [1, 2, 3, 4, 5, 6, 0], wd = tr.tl("wd");
  const [open, setOpen] = useState<number[]>([]);
  const list = (d: number): DayUnit[] => value.units?.[d] || [];
  const put = (d: number, L: DayUnit[]) => {
    const units = { ...(value.units || {}) };
    if (L.length) units[d] = [...L].sort((a, b) => a.zeit < b.zeit ? -1 : a.zeit > b.zeit ? 1 : a.slot - b.slot); else delete units[d];
    onChange({ ...value, units });
  };
  // Direkt vor dem Mannschaftstraining (endet mit dessen Beginn); ohne Mannschaftstraining am Wochenende vormittags, sonst 17:30
  const startOf = (d: number, dauer: number): string => value.days[d] ? shiftTime(value.days[d].zeit, -dauer) : d === 0 || d === 6 ? "10:00" : "17:30";
  const add = (d: number, art: UnitArt) => {
    const slot = freeWeeklySlot(value, d); if (slot == null || list(d).length >= MAX_UNITS_DAY) return;
    const dauer = UNIT_DEF[art].dauer;
    put(d, [...list(d), cleanUnit({ slot, art, title: "", zeit: startOf(d, dauer), dauer, rpe: null, groupId: null, staffId: null, inhalt: "", themes: [] })]);
  };
  const patch = (d: number, slot: number, p: Partial<DayUnit>) => put(d, list(d).map(u => u.slot === slot ? { ...u, ...p } : u));
  const setArt = (d: number, u: DayUnit, art: UnitArt) => {
    const p: Partial<DayUnit> = { art, themes: [] };
    // Dauer und Beginn mitziehen, solange noch die Richtwerte der bisherigen Art eingestellt sind
    if (u.dauer === UNIT_DEF[u.art].dauer) { p.dauer = UNIT_DEF[art].dauer; if (u.zeit === startOf(d, u.dauer)) p.zeit = startOf(d, p.dauer); }
    patch(d, u.slot, p);
  };
  // Endet die Einheit bisher mit dem Beginn des Mannschaftstrainings, bleibt das auch bei anderer Dauer so
  const setDur = (d: number, u: DayUnit, dauer: number) => patch(d, u.slot, { dauer, ...(value.days[d] && u.zeit === startOf(d, u.dauer) ? { zeit: startOf(d, dauer) } : {}) });
  const shown = order.filter(d => value.days[d] || list(d).length || open.includes(d));
  const more = order.filter(d => !shown.includes(d));
  const arts = UNIT_ARTS.map(k => ({ key: k, label: tr.t("ua_" + k) }));
  return (
    <Col gap={12} testID="su-units-editor">
      {shown.map(d => {
        const tday = value.days[d], L = list(d), full = L.length >= MAX_UNITS_DAY;
        return (
          <Col key={d} gap={8} testID={"su-u-day-" + d} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
            <T bold>{wd[d]}<Text style={{ color: c.muted, fontWeight: "400" }}>{"  ·  " + (tday ? `${tr.t("un_main")} ${tday.zeit}, ${tday.dauer || value.dauer} ${tr.t("min")}` : tr.t("un_noTraining"))}</Text></T>
            {L.map(u => { const col = u.art === "tw" ? c.event : c.accent; return (
              <Col key={u.slot} gap={8} testID={`su-u-${d}-${u.slot}`} style={{ padding: 10, borderRadius: radius.m, backgroundColor: withAlpha(col, 0.07), borderLeftWidth: 3, borderLeftColor: col }}>
                <Row gap={8} align="flex-end">
                  <Picker testID={`su-u-${d}-${u.slot}-art`} label={tr.t("su_unitArt")} value={u.art} options={arts} onChange={k => setArt(d, u, k)} style={{ flex: 1 }} />
                  <Btn small kind="ghost" icon="trash" label="" testID={`su-u-${d}-${u.slot}-del`} a11y={tr.t("un_del")} onPress={() => put(d, L.filter(x => x.slot !== u.slot))} />
                </Row>
                <Row gap={8} align="flex-end" wrap>
                  <TimeField testID={`su-u-${d}-${u.slot}-zeit`} label={tr.t("un_time")} value={u.zeit} onChange={z => patch(d, u.slot, { zeit: z })} lang={tr.lang} style={{ width: 96 }} />
                  <NumField testID={`su-u-${d}-${u.slot}-dauer`} label={tr.t("minutes")} value={u.dauer} min={5} max={240} onChange={m => setDur(d, u, m ?? UNIT_DEF[u.art].dauer)} style={{ width: 96 }} />
                  <Muted small style={{ paddingBottom: 13 }}>{tr.tf("su_unitUntil", { t: shiftTime(u.zeit, u.dauer) })}</Muted>
                </Row>
              </Col>
            ); })}
            {full ? <Muted small>{tr.tf("un_max", { n: MAX_UNITS_DAY })}</Muted> : <Row wrap gap={6}>
              <Btn small icon="plus" testID={`su-u-${d}-add-athletik`} label={tr.t("ua_athletik")} onPress={() => add(d, "athletik")} />
              <Btn small icon="plus" testID={`su-u-${d}-add-tw`} label={tr.t("ua_tw")} onPress={() => add(d, "tw")} />
              <Btn small kind="ghost" icon="plus" testID={`su-u-${d}-add-other`} label={tr.t("su_unitOther")} onPress={() => add(d, "kraft")} />
            </Row>}
          </Col>
        );
      })}
      {more.length ? <Col gap={6}>
        <Muted small>{tr.t("su_unitsOtherDay")}</Muted>
        <Row wrap gap={6}>{more.map(d => <Btn key={d} small kind="ghost" testID={"su-u-open-" + d} label={"+ " + wd[d]} onPress={() => setOpen(o => [...o, d])} />)}</Row>
      </Col> : null}
      <Muted small>{tr.t("un_blockedNote")} {tr.t("su_unitsLater")}</Muted>
    </Col>
  );
}

function MinutesField({ label, value, onChange, testID }: { label: string; value: number; onChange: (m: number) => void; testID?: string }) {
  const [txt, setTxt] = useState(String(value)); const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setTxt(String(value)); }
  // gleiches Feld wie überall (Höhe, Füllung, Beschriftung) – steht neben der Uhrzeit
  return <Field testID={testID} label={label} value={txt} keyboardType="number-pad" maxLength={3} style={{ width: 76 }}
    onChangeText={s => { const d = s.replace(/\D/g, ""); setTxt(d); const n = Number(d); if (n >= 20 && n <= 180) onChange(n); }}
    onBlur={() => { const n = Number(txt); if (!(n >= 20 && n <= 180)) setTxt(String(value)); }} />;
}

export interface PrinciplesFeedback { list: { md: string; text: string }[] }
/** Spieltags-Prinzipien inkl. Spieltag (MD), Empfehlung mit Rückmeldung und eigenen Trainingsarten. */
/** Erklärung der MD-Logik – in der Einrichtung offen, in den Einstellungen aufklappbar */
function PrinciplesHow({ tr, open: open0, showRpe }: { tr: Translator; open: boolean; showRpe: boolean }) {
  const { c } = useTheme(); const [open, setOpen] = useState(open0);
  const lines: [IconName, string][] = [["calendar", tr.t("pr_how1")], ["sliders", tr.t("pr_how2")], ["moon", tr.t("pr_how3")]];
  return (
    <View testID="prin-how" style={{ backgroundColor: c.sunk, borderRadius: radius.m, padding: 12, gap: 10 }}>
      <Pressable testID="prin-how-toggle" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}>
        <Row between gap={8}>
          <Row gap={8}><Icon name="help" size={18} color={c.accentTx} /><T bold>{tr.t("pr_howT")}</T></Row>
          <View style={{ transform: [{ rotate: open ? "270deg" : "90deg" }] }}><Icon name="chevron" size={16} color={c.muted} /></View>
        </Row>
      </Pressable>
      {open ? <Col gap={8}>
        {lines.map(([ic, x], i) => <Row key={i} gap={10} align="flex-start"><View style={{ paddingTop: 2 }}><Icon name={ic} size={16} color={c.muted} /></View><T v="small" style={{ flex: 1 }}>{x}</T></Row>)}
        {showRpe ? <Muted small>{tr.t("pr_howRpe")}</Muted> : null}
      </Col> : null}
    </View>
  );
}

/** Beispielwoche Mo–So aus Trainingstagen und Spieltag: Bezug je Tag, Farbe = geplante Intensität */
function PrinciplesWeek({ week, value, tr, kn, showRpe, spieltag }: { week: WeekDay[]; value: Principles; tr: Translator; kn: (k: Kind) => string; showRpe: boolean; spieltag: number }) {
  const { c } = useTheme(); const wd = tr.tl("wd"); const [w, setW] = useState(0);
  const wide = w / 7 >= 78;
  return (
    <Col gap={6}>
      <Col gap={1}><T v="h3">{tr.t("pr_weekT")}</T><Muted small>{tr.tf("pr_weekSub", { d: wd[spieltag] })}</Muted></Col>
      <View testID="prin-week" onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", gap: 4 }}>
        {week.map(d => {
          const p = value[d.md], rest = !d.match && (!d.train || p?.kind === "frei");
          const bar = d.match ? c.accent : rest ? c.line : showRpe ? rpeColor(c, p?.rpe) : c.accent;
          const kind = d.match ? tr.t("k_spiel") : !d.train ? tr.t("pr_noTrain") : p ? kn(p.kind) : "–";
          return (
            <View key={d.wd} testID={"prin-day-" + d.wd} accessibilityLabel={`${wd[d.wd]} · ${d.md} · ${kind}`}
              style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 3, paddingVertical: 7, borderRadius: radius.s,
                backgroundColor: d.match ? c.accentSoft : d.train ? c.surface : "transparent", borderWidth: 1, borderColor: d.match ? c.accent : d.train ? c.line : "transparent" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: d.train || d.match ? c.ink : c.muted }}>{wd[d.wd]}</Text>
              {d.match ? <Icon name="ball" size={15} color={c.accentTx} /> : <Text style={{ fontSize: 11.5, fontWeight: "700", color: d.train ? c.accentTx : c.muted }}>{d.md}</Text>}
              <View style={{ width: "70%", height: 4, borderRadius: radius.pill, backgroundColor: bar }} />
              {wide ? <Text numberOfLines={1} style={{ fontSize: 11, color: c.muted, paddingHorizontal: 3 }}>{kind}</Text> : null}
            </View>
          );
        })}
      </View>
    </Col>
  );
}

/** Abstand zum Spiel in Worten ("Tag nach dem Spiel", "4 Tage vor dem Spiel") */
const mdWords = (md: string, tr: Translator): string => {
  const n = mdOffset(md);
  return !n ? tr.t("pr_mdDay") : n > 0 ? (n === 1 ? tr.t("pr_after1") : tr.tf("pr_afterN", { n })) : n === -1 ? tr.t("pr_before1") : tr.tf("pr_beforeN", { n: -n });
};

export function PrinciplesEditor({ value, onChange, tr, cls, depth, kinds, days, spieltag, intro = false, onNewKind, onEditKind }: {
  value: Principles; onChange: (p: Principles) => void; tr: Translator; cls: ClassKey; depth: Depth;
  kinds: CustomKind[];
  /** Trainingstage (0 = So … 6 = Sa) und üblicher Spieltag – für Beispielwoche und Reihenfolge */
  days: number[]; spieltag: number;
  /** Erklärung aufgeklappt zeigen (Einrichtung) */
  intro?: boolean;
  onNewKind?: (md?: string) => void; onEditKind?: (k: CustomKind) => void;
}) {
  const { c } = useTheme(); const wd = tr.tl("wd");
  const [fb, setFb] = useState<{ list: string[]; rows: string[]; undo: Principles } | null>(null);
  const [more, setMore] = useState(false); const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const showRpe = depth !== "org";
  const kn = (k: Kind): string => k.startsWith("c:") ? (kinds.find(x => "c:" + x.id === k)?.name || "?") : tr.t("k_" + k);
  const options = [...KINDS.map(k => ({ key: k as string, label: tr.t("k_" + k), sub: tr.t("kdesc_" + k) })),
    ...kinds.map(k => ({ key: "c:" + k.id, label: k.name, sub: k.inhalt.split("\n")[0] || undefined })), ...(onNewKind ? [{ key: "__new", label: tr.t("kind_newOpt") }] : [])];
  const setRow = (md: string, patch: Partial<Principle>) => { setFb(null); onChange({ ...value, [md]: { ...(value[md] || { kind: "aufbau", rpe: 5 }), ...patch } }); };
  const week = exampleWeek(spieltag, days), rows = principleRows(spieltag, days);
  const hints = showRpe ? principleHints(value, spieltag, days) : [];
  const hintText = (h: PrincipleHint): string => h.k === "hard2" ? tr.tf("pr_h_hard2", { a: wd[h.a], b: wd[h.b] }) : h.k === "md1" || h.k === "md2" ? tr.tf("pr_h_" + h.k, { r: h.rpe })
    : h.k === "kindHigh" || h.k === "kindLow" ? tr.tf("pr_h_" + h.k, { md: h.md, k: kn(h.kind), r: h.rpe }) : tr.t("pr_h_noHard");
  const recommend = () => {
    const rec = defaultPrinciples(groupOf(cls)), list: string[] = [], rows: string[] = [];
    ["MD", ...MDS].forEach(md => {
      const a = value[md], b = rec[md], parts: string[] = [];
      if (!a || a.kind !== b.kind) parts.push(`${a ? kn(a.kind) : "–"} → ${kn(b.kind)}`);
      if (showRpe && (!a || a.rpe !== b.rpe) && b.kind !== "frei") parts.push(`RPE ${a ? a.rpe : "–"} → ${b.rpe}`);
      if (parts.length) { rows.push(md); list.push(`${md}: ${parts.join(", ")}`); }
    });
    // eigene Beschreibungen bleiben erhalten
    const keep: Principles = {}; Object.keys(rec).forEach(md => { keep[md] = value[md]?.note ? { ...rec[md], note: value[md].note } : rec[md]; });
    setFb({ list, rows, undo: value }); onChange(keep);
  };
  const row = (md: string, day?: number) => {
    const p = value[md] || { kind: "aufbau" as Kind, rpe: 5 }, hl = fb?.rows.includes(md), custom = kinds.find(x => "c:" + x.id === p.kind);
    const desc = custom ? custom.inhalt.split("\n")[0] : p.kind.startsWith("c:") ? "" : tr.t("kdesc_" + p.kind), editing = noteOpen === md;
    return (
      <View key={md} testID={"prin-row-" + md} style={{ gap: 8, padding: 10, borderRadius: radius.m, borderWidth: 1, borderColor: hl ? c.accent : c.line, backgroundColor: hl ? c.accentSoft : c.surface }}>
        <Row gap={10}>
          <View style={{ minWidth: 52, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.sunk, alignItems: "center" }}><T bold v="small">{md}</T></View>
          <T v="small" color={c.muted} style={{ flex: 1 }} numberOfLines={1}>{day != null ? wd[day] + " · " : ""}{mdWords(md, tr)}</T>
        </Row>
        <Row gap={8} align="flex-end">
          <Picker testID={"prin-" + md} label={tr.t("pr_kind")} value={p.kind as string} options={options} style={{ flex: 1 }}
            onChange={k => { if (k === "__new") { onNewKind && onNewKind(md); return; } const kind = k as Kind; const cu = kinds.find(x => "c:" + x.id === kind);
              // neue Art → ihre typische Intensität (für die Altersklasse begrenzt), damit Art und RPE zusammenpassen
              setRow(md, { kind, rpe: kind === "frei" ? 0 : cu ? cu.rpe : Math.min(capOf(cls), KIND_RPE[kind as BuiltinKind] ?? 5) }); }} />
          {showRpe ? <RpeBox testID={"prin-" + md + "-rpe"} value={p.rpe} disabled={p.kind === "frei"} onChange={r => setRow(md, { rpe: r })} /> : null}
        </Row>
        {editing ? <Col gap={6}>
          <Field testID={"prin-" + md + "-note"} label={tr.t("pr_note")} value={p.note || ""} placeholder={tr.t("pr_notePh")} multiline maxLength={PR_NOTE_MAX}
            onChangeText={v => setRow(md, { note: v.slice(0, PR_NOTE_MAX) || undefined })} hint={tr.t("pr_noteD")} />
          <Btn small testID={"prin-" + md + "-note-done"} label={tr.t("done")} onPress={() => { setNoteOpen(null); if (p.note && !p.note.trim()) setRow(md, { note: undefined }); }} style={{ alignSelf: "flex-start" }} />
        </Col> : <>
          {p.note ? <T v="small" testID={"prin-" + md + "-note-text"}>{p.note}</T> : desc ? <Muted small>{desc}</Muted> : null}
          <Pressable testID={"prin-" + md + "-note-edit"} accessibilityRole="button" onPress={() => setNoteOpen(md)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
            <Row gap={5}><Icon name="pen" size={14} color={c.accentTx} /><T v="small" bold color={c.accentTx}>{tr.t(p.note ? "pr_noteEdit" : "pr_noteAdd")}</T></Row>
          </Pressable>
        </>}
      </View>
    );
  };
  const md0 = value.MD || { kind: "spiel" as Kind, rpe: 8 };
  return (
    <Col gap={12}>
      <PrinciplesHow tr={tr} open={intro} showRpe={showRpe} />
      {days.length ? <PrinciplesWeek week={week} value={value} tr={tr} kn={kn} showRpe={showRpe} spieltag={spieltag} /> : <Muted small testID="prin-nodays">{tr.t("pr_noDays")}</Muted>}
      {hints.length ? <Banner color={c.warn} testID="prin-hints"><Col gap={4}><T bold v="small">{tr.t("pr_hintsT")}</T>{hints.map((h, i) => <T key={i} v="small">• {hintText(h)}</T>)}</Col></Banner> : null}
      {showRpe ? <Row testID="prin-row-MD" gap={10} style={{ padding: 10, borderRadius: radius.m, backgroundColor: c.sunk }}>
        <View style={{ minWidth: 52, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.accent, alignItems: "center" }}><T bold v="small" color={c.accentInk}>MD</T></View>
        <Row gap={6} style={{ flex: 1 }}><T bold>{tr.t("k_spiel")}</T><Info title="MD" text={tr.t("pr_md")} testID="info-md" /></Row>
        <RpeBox testID="prin-MD-rpe" value={md0.rpe} onChange={r => setRow("MD", { kind: "spiel", rpe: r })} />
      </Row> : null}
      {rows.week.length ? <Col gap={8}><T v="eyebrow">{tr.t("pr_inWeekT")}</T>{rows.week.map(x => row(x.md, x.wd))}</Col> : null}
      <Pressable testID="prin-other" accessibilityRole="button" accessibilityState={{ expanded: more || !rows.week.length }} onPress={() => setMore(!more)} disabled={!rows.week.length}>
        <Row between gap={8} style={{ paddingVertical: 6 }}>
          <T v="eyebrow">{tr.tf("pr_otherT", { n: rows.other.length })}</T>
          {rows.week.length ? <View style={{ transform: [{ rotate: more ? "270deg" : "90deg" }] }}><Icon name="chevron" size={16} color={c.muted} /></View> : null}
        </Row>
      </Pressable>
      {more || !rows.week.length ? <Col gap={8}><Muted small>{tr.t("pr_otherD")}</Muted>{rows.other.map(md => row(md))}</Col> : null}
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
