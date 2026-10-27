// Zeichentool (Matchplan-Folien, Übungsskizzen): Werkzeugleiste in zwei Ebenen.
// Ebene 1 (unten): die Art – Auswahl, Spieler, Pfeile, Linien, Formen, Material, Text.
// Ebene 2 (darüber): die Optionen dieser Art – Linie (durchgezogen, gestrichelt, gepunktet, Welle), Verlauf (gerade,
// gebogen, frei gemalt), Stärke (dünn, mittel, dick), Farbe, Füllung … – bzw. die des ausgewählten Elements samt
// Kopieren, Löschen und Fertig. Eine Zeile oben sagt in Worten, was gerade gezeichnet wird.
// Alles passt in die Breite (nichts scrollt waagerecht) und Ebene 2 hat eine feste Höhe – die Tafel springt nicht.
import React, { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path, Polyline, Rect } from "react-native-svg";
import { MP_COLORS, isArea, isArrow, isMaterial, isRotatable } from "../../core/matchplan";
import type { MpColor, MpContent, MpItem, MpTool } from "../../core/types";
import { useEngine } from "../../data/store";
import { Icon, type IconName } from "../icons";
import { Btn, Col, Field, Muted, NumField, Picker, Seg } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { useTokenInfo } from "./common";
import { NEU_COL, OPP_COL, lineCol } from "./pitch";
import { CATS, CURVE, MATERIAL_TOOLS, ToolIcon, catOf, defCol, restyle, stepped, styleOfItem, type BoardState, type Cat, type Dash, type PathKind, type Width } from "./board";

/** Höhe einer Option (Handy), einer großen Kachel und der zweiten Ebene (Beschriftung + zwei Reihen) */
const OPT = 40, BIG = 70;
export const OPT_H = 28 + 6 + OPT + 6 + OPT;
const DASHES: Dash[] = ["solid", "dash", "dot", "wave"];
const WIDTHS: Width[] = [1, 2, 3];
/** Bogen beim Auswählen: links, gerade, rechts */
const BENDS3: { k: "left" | "none" | "right"; v: number }[] = [{ k: "left", v: CURVE }, { k: "none", v: 0 }, { k: "right", v: -CURVE }];

// ---------- Muster (Vorschau der Optionen) ----------
function LineSample({ dash, w = 2, color, head }: { dash: Dash; w?: Width; color: string; head?: boolean }) {
  const sw = w === 1 ? 1.4 : w === 3 ? 3.8 : 2.4, end = head ? 25 : 31;
  const da = dash === "solid" || dash === "wave" ? undefined : dash === "dot" ? `0.01 ${sw * 2.3}` : `${sw * 2.2} ${sw * 1.5}`;
  const d = dash === "wave" ? "M3 9 Q 5.5 3.5 8 9 T 13 9 T 18 9 T 23 9" + (head ? "" : " T 28 9 L 31 9") : `M3 9 H${end}`;
  return (
    <Svg width={34} height={18} viewBox="0 0 34 18">
      <Path d={d} stroke={color} strokeWidth={sw} fill="none" strokeDasharray={da} strokeLinecap={dash === "dash" ? "butt" : "round"} strokeLinejoin="round" />
      {head ? <Polyline points="31,9 24.5,4.6 24.5,13.4" fill={color} stroke={color} strokeWidth={0.8} strokeLinejoin="round" /> : null}
    </Svg>
  );
}
function PathSample({ k, color, head }: { k: PathKind; color: string; head: boolean }) {
  const st = { stroke: color, strokeWidth: 2.3, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const d = k === "straight" ? "M5 19 L19 7" : k === "curve" ? "M4 19 Q 5 6 19 6" : "M4 19 C 7 10, 10 22, 13 13 C 14.5 9, 16.5 7, 19.5 6.5";
  const tip = k === "straight" ? "21.5,5 14.6,7.4 18.4,11.6" : k === "curve" ? "22,6 15.5,2.6 15.5,9.4" : "22,6 15.2,4.6 17.2,10.6";
  return <Svg width={26} height={24} viewBox="0 0 26 24"><Path d={d} {...st} />{head ? <Polyline points={tip} fill={color} stroke={color} strokeWidth={0.8} /> : null}</Svg>;
}
function FillSample({ fill, color }: { fill: boolean; color: string }) {
  return <Svg width={26} height={20} viewBox="0 0 26 20"><Rect x={3} y={3} width={20} height={14} rx={2} fill={fill ? color : "none"} fillOpacity={0.3} stroke={color} strokeWidth={1.8} strokeDasharray="3 2.2" /></Svg>;
}
function ShapeSample({ k, color }: { k: "zone" | "circle"; color: string }) {
  return (
    <Svg width={26} height={22} viewBox="0 0 26 22">
      {k === "zone" ? <Rect x={2.5} y={3.5} width={21} height={15} rx={2} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.9} /> : <Circle cx={13} cy={11} r={8.5} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.9} />}
    </Svg>
  );
}
function Token({ color, size = 22 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={9} fill={color} stroke="#ffffff" strokeWidth={2.2} /></Svg>;
}
/** Textgröße: „Aa“ klein, mittel, groß */
function TextSample({ w, color }: { w: Width; color: string }) {
  return <Text style={{ fontSize: w === 1 ? 12 : w === 3 ? 21 : 16, lineHeight: 24, fontWeight: "800", color }}>Aa</Text>;
}
/** Symbol einer Art (erste Ebene) */
export function CatIcon({ k, color, accent, size = 22 }: { k: Cat; color: string; accent: string; size?: number }) {
  if (k === "players") return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={8.6} cy={12} r={6.2} fill={accent} stroke="#ffffff" strokeWidth={1.8} /><Circle cx={15.4} cy={12} r={6.2} fill={OPP_COL} stroke="#ffffff" strokeWidth={1.8} />
    </Svg>
  );
  if (k === "shapes") return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={6} width={12} height={10.5} rx={1.6} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1.8} />
      <Circle cx={16} cy={13} r={5.6} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
  const tk: Record<Exclude<Cat, "players" | "shapes">, MpTool | "move"> = { select: "move", arrows: "pass", lines: "line", material: "cone", text: "text" };
  return <ToolIcon k={tk[k]} size={size} color={color} accent={accent} />;
}

// ---------- Bausteine ----------
/**
 * Eine Option, gewählt mit Rahmen in Vereinsfarbe. Ohne Beschriftung nur das Muster; mit Beschriftung: darunter
 * (Seitenleiste), inline (Symbol und Text nebeneinander, z. B. „Text ändern“), tile (klein darunter, Material) oder
 * big (große Kachel – Arten mit nur einer Reihe Optionen).
 */
function Opt({ on, onPress, a11y, testID, children, label, disabled, primary, inline, tile, big, cell, fill }: {
  on?: boolean; onPress: () => void; a11y: string; testID?: string; children?: React.ReactNode; label?: string; disabled?: boolean; primary?: boolean;
  /** fill: ohne Beschriftung so breit wie beschriftete Optionen (Seitenleiste) */
  inline?: boolean; tile?: boolean; big?: boolean; fill?: boolean;
  /** feste Breite im Raster (z. B. „31.5%“) statt gleich verteilt */
  cell?: `${number}%`;
}) {
  const { c } = useTheme();
  const fg = primary ? c.accentInk : on ? c.accentTx : inline ? c.ink : c.muted, stack = !!label && !!children && !inline;
  return (
    <Pressable testID={testID} accessibilityRole={inline ? "button" : "radio"} accessibilityState={{ checked: !!on, disabled: !!disabled }} accessibilityLabel={a11y} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ ...(cell ? { width: cell } : { flex: 1, minWidth: 0, maxWidth: inline ? 240 : big ? 150 : tile ? 96 : label || fill ? 132 : 64 }), height: big ? BIG : stack && !tile ? 54 : OPT,
        paddingHorizontal: inline ? 10 : 4, borderRadius: big ? radius.l : radius.m,
        flexDirection: stack ? "column" : "row", alignItems: "center", justifyContent: "center", gap: stack ? (tile ? 0 : big ? 5 : 2) : 7,
        borderWidth: on ? 2 : 1, borderColor: primary || on ? c.accent : c.line,
        backgroundColor: primary ? c.accent : on ? c.accentSoft : pressed ? c.sunk : c.surface, opacity: disabled ? 0.35 : 1 })}>
      {children}
      {label ? <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: tile ? 10.5 : big ? 13 : stack ? 11 : 13.5, fontWeight: "700", color: fg }}>{label}</Text> : null}
    </Pressable>
  );
}
/** Knopf mit Symbol (Kopieren, Löschen, Fertig …) */
function Act({ icon, a11y, onPress, testID, danger, label, primary }: { icon: IconName; a11y: string; onPress: () => void; testID?: string; danger?: boolean; label?: string; primary?: boolean }) {
  const { c } = useTheme(); const fg = primary ? c.accentInk : danger ? c.crit : c.ink;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ height: 32, minWidth: 32, paddingHorizontal: label ? 10 : 0, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", borderRadius: radius.pill,
        backgroundColor: primary ? c.accent : pressed ? c.line : c.sunk })}>
      <Icon name={icon} size={16} color={fg} strokeWidth={2.2} />
      {label ? <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: fg }}>{label}</Text> : null}
    </Pressable>
  );
}
const Sep = () => { const { c } = useTheme(); return <View style={{ width: 1, alignSelf: "stretch", marginVertical: 6, backgroundColor: c.line }} />; };
/** Reihe der zweiten Ebene; big: eine Reihe großer Kacheln über die Höhe beider Reihen */
function OptRow({ children, big }: { children?: React.ReactNode; big?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: big ? 8 : 6, height: big ? OPT * 2 + 6 : OPT }}>{children}</View>;
}
function Grp({ title, wide, flex = 1, children }: { title: string; wide?: boolean; flex?: number; children?: React.ReactNode }) {
  const { c } = useTheme();
  if (wide) return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.muted }}>{title}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>{children}</View>
    </View>
  );
  return <View accessibilityLabel={title} style={{ flex, minWidth: 0, flexDirection: "row", gap: 4, alignItems: "center" }}>{children}</View>;
}
/** Beschriftung oben: was gezeichnet wird bzw. was ausgewählt ist, dahinter ein Hinweis; rechts Aktionen */
function Caption({ icon, title, hint, right, testID }: { icon?: React.ReactNode; title: string; hint?: string; right?: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 28, flexDirection: "row", alignItems: "center", gap: 7 }}>
      {icon}
      <Text testID={testID} numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: "700", color: c.ink }}>{title}</Text>
      {hint ? <Text testID={testID ? testID + "-hint" : undefined} numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: c.muted }}>{hint}</Text> : <View style={{ flex: 1 }} />}
      {right ? <View style={{ flexDirection: "row", gap: 6 }}>{right}</View> : null}
    </View>
  );
}
/** Farben (passend zum Spielfeld-Design) */
function Colors({ value, onChange, look, testID, wide }: { value: MpColor; onChange: (k: MpColor) => void; look?: MpContent["look"]; testID: string; wide?: boolean }) {
  const E = useEngine(); const { c } = useTheme();
  return (
    <>
      {MP_COLORS.filter(k => !(look === "white" && k === "k")).map(k => (
        <Pressable key={k} testID={testID + "-" + k} accessibilityRole="radio" accessibilityState={{ checked: value === k }} accessibilityLabel={E.t(k === "w" && look === "white" ? "mpc_wd" : "mpc_" + k)}
          onPress={() => onChange(k)} hitSlop={2} style={{ flex: wide ? 0 : 1, width: wide ? 34 : undefined, minWidth: 0, maxWidth: 40, height: OPT, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: wide ? 30 : "84%", maxWidth: 30, aspectRatio: 1, borderRadius: 999, backgroundColor: lineCol(look, k), borderWidth: value === k ? 3 : 1.5, borderColor: value === k ? c.accent : withAlpha(c.ink, 0.22) }} />
        </Pressable>
      ))}
    </>
  );
}

// ---------- Optionen einer Linie (Werkzeug und ausgewähltes Element) ----------
/** Überschrift der Linien-Gruppe mit dem gewählten Stil (breit: die Muster tragen keinen Namen) */
const dashTitle = (t: (k: string) => string, g: "line" | "border", d: Dash): string => `${t("zt_g_" + g)} · ${t("zt_d_" + d)}`;
type LineOpts = { dash: Dash; w: Width; col: MpColor };
function DashOpts({ value, onChange, wave, head, testID, wide, waveOff }: { value: Dash; onChange: (d: Dash) => void; wave?: boolean; head?: boolean; testID: string; wide?: boolean; waveOff?: boolean }) {
  const { t } = useEngine(); const { c } = useTheme();
  return (
    <>
      {DASHES.filter(d => d !== "wave" || wave).map(d => (
        <Opt key={d} fill={wide} testID={testID + "-dash-" + d} on={value === d} a11y={t("zt_d_" + d)} onPress={() => onChange(d)} disabled={d === "wave" && waveOff}>
          <LineSample dash={d} color={value === d ? c.accentTx : c.ink} head={head} />
        </Opt>
      ))}
    </>
  );
}
function WidthOpts({ value, onChange, testID, wide }: { value: Width; onChange: (w: Width) => void; testID: string; wide?: boolean }) {
  const { t } = useEngine(); const { c } = useTheme();
  return <>{WIDTHS.map(w => <Opt key={w} testID={testID + "-w" + w} on={value === w} a11y={t("mpw_" + w)} label={wide ? t("mpw_" + w) : undefined} onPress={() => onChange(w)}><LineSample dash="solid" w={w} color={value === w ? c.accentTx : c.ink} /></Opt>)}</>;
}
/** Textgröße (klein, mittel, groß); tile: Name klein darunter */
function TextSizes({ value, onChange, testID, wide, tile }: { value: Width; onChange: (w: Width) => void; testID: string; wide?: boolean; tile?: boolean }) {
  const { t } = useEngine(); const { c } = useTheme();
  return <>{WIDTHS.map(w => <Opt key={w} testID={testID + "-size" + w} on={value === w} tile={tile} a11y={t("zt_s_" + w)} label={wide || tile ? t("zt_s_" + w) : undefined} onPress={() => onChange(w)}><TextSample w={w} color={value === w ? c.accentTx : c.ink} /></Opt>)}</>;
}

// ---------- Zweite Ebene: Optionen des Werkzeugs ----------
/** Name und Hinweis des Werkzeugs (Beschriftungszeile) */
function toolText(B: BoardState, t: (k: string) => string, sketch?: boolean): { title: string; hint: string } {
  const ts = B.tools;
  switch (ts.cat) {
    case "select": return ts.selMode === "del" ? { title: t("zt_sel_del"), hint: t("zt_h_del") } : { title: t("zt_sel_move"), hint: t("zt_h_move") };
    case "players": return { title: t(sketch && ts.player !== "neu" ? "zt_p_" + ts.player + "S" : "mpt_" + ts.player), hint: t("zt_h_player") };
    case "arrows": {
      const a = ts.arrows, name = a.path === "free" ? t("zt_freeArrow") : t("mpt_" + B.tool);
      return { title: a.dash === "wave" || a.dash === "solid" && a.path !== "free" ? name : `${name} · ${t("zt_d_" + a.dash)}`, hint: t("zt_h_" + a.path) };
    }
    case "lines": {
      const l = ts.lines, name = l.path === "free" ? t("zt_freeLine") : t("mpt_line");
      return { title: l.dash === "solid" ? name : `${name} · ${t("zt_d_" + l.dash)}`, hint: l.path === "free" ? t("zt_h_free") : t(l.path === "curve" ? "zt_h_curve" : "zt_h_line") };
    }
    case "shapes": return { title: `${t("mpt_" + ts.shape)}${ts.shapes.fill ? "" : " · " + t("zt_fill_off")}`, hint: t("mpt_" + ts.shape + "_h") };
    case "material": return { title: t("mpt_" + ts.mat), hint: t("zt_h_place") };
    default: return { title: t("mpt_text"), hint: t("mpt_text_h") };
  }
}

/** Optionen der gewählten Art (bzw. Hinweise); wide: Seitenleiste mit Überschriften und Beschriftungen */
export function ToolOptions({ B, look, sketch, wide, testID = "mp-board" }: { B: BoardState; look?: MpContent["look"]; sketch?: boolean; wide?: boolean; testID?: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const ts = B.tools, set = B.setTools, id = testID + "-opt";
  const { title, hint } = toolText(B, t, sketch);
  const cap = <Caption testID={testID + "-tool"} title={title} hint={wide ? undefined : hint}
    icon={<ToolIcon k={B.tool} size={18} color={c.accentTx} accent={c.accent} head={ts.cat !== "lines"} />} />;
  const hintLine = wide ? <Muted small testID={testID + "-tool-hint"}>{hint}</Muted> : null;
  const rows = (a: React.ReactNode, b?: React.ReactNode) => wide
    ? <Col gap={12}>{cap}{hintLine}{a}{b}</Col>
    : <View style={{ height: OPT_H, gap: 6 }}>{cap}{a}{b}</View>;
  const lineStyle = (k: "arrows" | "lines") => {
    const s = ts[k], tool = B.tool as MpTool, head = k === "arrows", colr = s.col || defCol(tool);
    const upd = (p: Partial<typeof s>) => set({ [k]: { ...s, ...p } } as Partial<typeof ts>);
    const dash = <DashOpts testID={id} value={s.dash} wave={head} head={head} wide={wide} waveOff={s.path === "free"} onChange={d => upd({ dash: d })} />;
    const path = (["straight", "curve", "free"] as PathKind[]).map(p => (
      <Opt key={p} testID={id + "-path-" + p} on={s.path === p} a11y={t("zt_path_" + p)} label={wide ? t("zt_path_" + p) : undefined}
        onPress={() => upd({ path: p, ...(p === "free" && s.dash === "wave" ? { dash: "solid" as Dash } : {}) })}>
        <PathSample k={p} head={head} color={s.path === p ? c.accentTx : c.ink} />
      </Opt>
    ));
    const width = <WidthOpts testID={id} value={s.w} wide={wide} onChange={w => upd({ w })} />;
    const colors = <Colors testID={id + "-col"} value={colr} look={look} wide={wide} onChange={col => upd({ col })} />;
    return wide
      ? rows(<><Grp wide title={dashTitle(t, "line", s.dash)}>{dash}</Grp><Grp wide title={t("zt_g_path")}>{path}</Grp></>, <><Grp wide title={t("zt_g_width")}>{width}</Grp><Grp wide title={t("zt_g_color")}>{colors}</Grp></>)
      : rows(<OptRow><Grp title={t("zt_g_line")} flex={head ? 4 : 3}>{dash}</Grp><Sep /><Grp title={t("zt_g_path")} flex={3}>{path}</Grp></OptRow>,
        <OptRow><Grp title={t("zt_g_width")} flex={3}>{width}</Grp><Sep /><Grp title={t("zt_g_color")} flex={6}>{colors}</Grp></OptRow>);
  };
  const ic = wide ? 20 : 24;
  /** Arten mit nur einer Reihe: große Kacheln (Handy) bzw. eine Reihe mit Beschriftung (breit) */
  const one = (kids: React.ReactNode) => wide ? <View style={{ flexDirection: "row", gap: 6 }}>{kids}</View> : <OptRow big>{kids}</OptRow>;
  switch (ts.cat) {
    case "select": return rows(one(<>
        <Opt big={!wide} testID={id + "-sel-move"} on={ts.selMode === "move" && !B.framing} a11y={t("zt_sel_move")} label={t("zt_sel_move")} onPress={() => { B.setFraming(false); B.setTool("move"); }}><ToolIcon k="move" size={ic} color={c.ink} accent={c.accent} /></Opt>
        <Opt big={!wide} testID={id + "-sel-del"} on={ts.selMode === "del" && !B.framing} a11y={t("zt_sel_del")} label={t("zt_sel_del")} onPress={() => { B.setFraming(false); B.setTool("del"); }}><ToolIcon k="del" size={ic} color={c.crit} accent={c.accent} /></Opt>
        <Opt big={!wide} testID={id + "-frame"} on={B.framing} a11y={t("mp_frame")} label={t("mp_frame")} onPress={() => B.setFraming(true)}><Icon name="frame" size={ic} color={c.ink} /></Opt>
      </>));
    case "players": return rows(one(<>
        {(["own", "opp", "neu"] as const).map(k => (
          <Opt key={k} big={!wide} testID={id + "-player-" + k} on={ts.player === k} a11y={t(sketch && k !== "neu" ? "zt_p_" + k + "S" : "zt_p_" + k)} label={t(sketch && k !== "neu" ? "zt_p_" + k + "S" : "zt_p_" + k)} onPress={() => set({ player: k })}>
            <Token color={k === "own" ? c.club : k === "opp" ? OPP_COL : NEU_COL} size={wide ? 22 : 26} />
          </Opt>
        ))}
      </>));
    case "arrows": return lineStyle("arrows");
    case "lines": return lineStyle("lines");
    case "shapes": {
      const s = ts.shapes, colr = s.col || defCol(ts.shape), upd = (p: Partial<typeof s>) => set({ shapes: { ...s, ...p } });
      const shape = (["zone", "circle"] as const).map(k => <Opt key={k} testID={id + "-shape-" + k} on={ts.shape === k} a11y={t("mpt_" + k)} label={wide ? t("mpt_" + k) : undefined} onPress={() => set({ shape: k })}><ShapeSample k={k} color={ts.shape === k ? c.accentTx : c.ink} /></Opt>);
      const fill = ([true, false] as const).map(f => <Opt key={String(f)} testID={id + "-fill-" + (f ? "on" : "off")} on={s.fill === f} a11y={t(f ? "zt_fill_on" : "zt_fill_off")} label={wide ? t(f ? "zt_fill_on" : "zt_fill_off") : undefined} onPress={() => upd({ fill: f })}><FillSample fill={f} color={s.fill === f ? c.accentTx : c.ink} /></Opt>);
      const width = <WidthOpts testID={id} value={s.w} wide={wide} onChange={w => upd({ w })} />;
      const dash = <DashOpts testID={id} value={s.dash} wide={wide} onChange={d => upd({ dash: d === "wave" ? "solid" : d })} />;
      const colors = <Colors testID={id + "-col"} value={colr} look={look} wide={wide} onChange={col => upd({ col })} />;
      return wide
        ? rows(<><Grp wide title={t("zt_g_shape")}>{shape}</Grp><Grp wide title={t("zt_g_fill")}>{fill}</Grp><Grp wide title={dashTitle(t, "border", s.dash)}>{dash}</Grp></>, <><Grp wide title={t("zt_g_width")}>{width}</Grp><Grp wide title={t("zt_g_color")}>{colors}</Grp></>)
        : rows(<OptRow><Grp title={t("zt_g_shape")} flex={2}>{shape}</Grp><Sep /><Grp title={t("zt_g_fill")} flex={2}>{fill}</Grp><Sep /><Grp title={t("zt_g_width")} flex={3}>{width}</Grp></OptRow>,
          <OptRow><Grp title={t("zt_g_border")} flex={3}>{dash}</Grp><Sep /><Grp title={t("zt_g_color")} flex={6}>{colors}</Grp></OptRow>);
    }
    case "material": {
      // Handy: zwei Reihen mit kurzem Namen unter dem Symbol; breit: Raster
      const btns = MATERIAL_TOOLS.map(k => <Opt key={k} tile={!wide} cell={wide ? "31.5%" : undefined} testID={id + "-mat-" + k} on={ts.mat === k} a11y={t("mpt_" + k)} label={t("mpts_" + k)} onPress={() => set({ mat: k })}><ToolIcon k={k} size={wide ? 22 : 21} color={c.ink} accent={c.accent} /></Opt>);
      // zweite Reihe mit Platzhalter, damit alle Felder gleich breit sind
      return wide ? rows(<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{btns}</View>)
        : rows(<OptRow>{btns.slice(0, 5)}</OptRow>, <OptRow>{btns.slice(5)}<View style={{ flex: 1, maxWidth: 96 }} /></OptRow>);
    }
    default: {
      const size = <TextSizes testID={id} value={ts.textW} wide={wide} tile={!wide} onChange={w => set({ textW: w })} />;
      const colors = <Colors testID={id + "-col"} value={ts.textCol || "w"} look={look} wide={wide} onChange={k => set({ textCol: k })} />;
      return wide ? rows(<Grp wide title={t("zt_g_size")}>{size}</Grp>, <Grp wide title={t("zt_g_color")}>{colors}</Grp>)
        : rows(<OptRow><Grp title={t("zt_g_size")}>{size}</Grp></OptRow>, <OptRow><Grp title={t("zt_g_color")}>{colors}</Grp></OptRow>);
    }
  }
}

// ---------- Zweite Ebene: ausgewähltes Element ----------
/**
 * Optionen des ausgewählten Elements: Stil (wie beim Zeichnen), Bogen bzw. Spitze, Spieler wählen, Drehen, Text;
 * oben Kopieren, Löschen, Fertig und – wo es mehr gibt (Schritt im Ablauf, Nummer) – „Mehr“. Stiländerungen gelten
 * auch für die nächsten Elemente dieser Art.
 */
export function SelOptions({ it, B, look, sketch, wide, onUpdate, onDelete, onDup, onEdit, onPick, testID = "mp-sel" }: {
  it: MpItem; B: BoardState; look?: MpContent["look"]; sketch?: boolean; wide?: boolean; onUpdate: (x: MpItem) => void; onDelete: () => void; onDup?: () => void; onEdit?: () => void; onPick?: () => void; testID?: string;
}) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const info = useTokenInfo();
  const by = it.by ? E.D.staff.find(x => x.id === it.by)?.name.split(" ")[0] || null : null;
  const s = styleOfItem(it), k = catOf(it);
  /** Stil ändern – gilt auch für die nächsten Elemente, wenn gerade diese Art gewählt ist */
  const upd = (ch: Parameters<typeof restyle>[1]) => {
    onUpdate(restyle(it, ch));
    const ts = B.tools; if (ts.cat !== k) return;
    if (k === "arrows" || k === "lines") { const L = ts[k]; B.setTools({ [k]: { ...L, ...(ch.dash ? { dash: ch.dash } : {}), ...(ch.w ? { w: ch.w } : {}), ...(ch.col ? { col: ch.col } : {}) } }); }
    else if (k === "shapes") { const S = ts.shapes; B.setTools({ shapes: { ...S, ...(ch.dash && ch.dash !== "wave" ? { dash: ch.dash } : {}), ...(ch.w ? { w: ch.w } : {}), ...(ch.col ? { col: ch.col } : {}), ...(ch.fill != null ? { fill: ch.fill } : {}) } }); }
    else if (k === "text") B.setTools({ ...(ch.col ? { textCol: ch.col } : {}), ...(ch.w ? { textW: ch.w } : {}) });
  };
  const name = it.t === "free" ? t(it.nh ? "zt_freeLine" : "zt_freeArrow") : sketch && (it.t === "own" || it.t === "opp") ? t("zt_p_" + it.t + "S") : t("mpt_" + it.t);
  const hasForm = !!onEdit && (it.t === "own" || it.t === "opp" || it.t === "neu" || it.t === "text" || stepped(it.t));
  const acts = <>
    {hasForm ? <Act testID={testID + "-more"} icon="sliders" a11y={t("mp_more")} onPress={onEdit!} /> : null}
    {onDup ? <Act testID={testID + "-dup"} icon="copy" a11y={t("mp_itemDup")} onPress={onDup} /> : null}
    <Act testID={testID + "-del"} icon="trash" danger a11y={t("mp_itemDel")} onPress={onDelete} />
    <Act testID={testID + "-x"} icon="check" primary a11y={t("mp_selDone")} label={wide ? t("done") : undefined} onPress={() => B.setSel(null)} />
  </>;
  // breit: „von …“ in eigener Zeile (neben den Aktionen ist kein Platz)
  const cap = <Caption testID={testID + "-kind"} title={name} hint={by && !wide ? E.tf("mp_by", { n: by }) : undefined} right={acts}
    icon={<ToolIcon k={it.t} size={18} color={c.accentTx} accent={c.accent} head={!it.nh} />} />;
  const rows = (a: React.ReactNode, b?: React.ReactNode) => wide
    ? <Col gap={12} testID={testID + "-bar"}>{cap}{by ? <Muted small testID={testID + "-kind-hint"}>{E.tf("mp_by", { n: by })}</Muted> : null}{a}{b}</Col>
    : <View testID={testID + "-bar"} style={{ height: OPT_H, gap: 6 }}>{cap}{a}{b}</View>;
  const hintRow = (txt: string) => <View style={{ height: OPT, justifyContent: "center" }}><Muted small>{txt}</Muted></View>;
  const id = testID;
  const colors = <Colors testID={id + "-col"} value={s.col} look={look} wide={wide} onChange={col => upd({ col })} />;
  const width = <WidthOpts testID={id} value={s.w} wide={wide} onChange={w => upd({ w })} />;

  if (isArrow(it.t)) {
    const dash = <DashOpts testID={id} value={s.dash} wave={it.t !== "line"} head={it.t !== "line"} wide={wide} onChange={d => upd({ dash: d })} />;
    const bk = !it.bend ? "none" : it.bend > 0 ? "left" : "right";
    const bend = BENDS3.map(b => (
      <Opt key={b.k} testID={id + "-bend-" + b.k} on={bk === b.k} a11y={t("zt_b_" + b.k)} label={wide ? t("zt_b_" + b.k) : undefined} onPress={() => upd({ bend: b.v })}>
        <Svg width={26} height={20} viewBox="0 0 26 20"><Path d={b.k === "none" ? "M4 14 L22 14" : b.k === "left" ? "M4 15 Q 13 1 22 15" : "M4 5 Q 13 19 22 5"} stroke={bk === b.k ? c.accentTx : c.ink} strokeWidth={2.3} fill="none" strokeLinecap="round" /></Svg>
      </Opt>
    ));
    return wide
      ? rows(<><Grp wide title={dashTitle(t, "line", s.dash)}>{dash}</Grp><Grp wide title={t("zt_g_bend")}>{bend}</Grp></>, <><Grp wide title={t("zt_g_width")}>{width}</Grp><Grp wide title={t("zt_g_color")}>{colors}</Grp></>)
      : rows(<OptRow><Grp title={t("zt_g_line")} flex={it.t === "line" ? 3 : 4}>{dash}</Grp><Sep /><Grp title={t("zt_g_bend")} flex={3}>{bend}</Grp></OptRow>,
        <OptRow><Grp title={t("zt_g_width")} flex={3}>{width}</Grp><Sep /><Grp title={t("zt_g_color")} flex={6}>{colors}</Grp></OptRow>);
  }
  if (it.t === "free") {
    const dash = <DashOpts testID={id} value={s.dash} head={!it.nh} wide={wide} onChange={d => upd({ dash: d })} />;
    const head = ([true, false] as const).map(h => (
      <Opt key={String(h)} testID={id + "-head-" + (h ? "on" : "off")} on={!it.nh === h} a11y={t(h ? "zt_head_on" : "zt_head_off")} label={wide ? t(h ? "zt_head_on" : "zt_head_off") : undefined} onPress={() => upd({ head: h })}>
        <PathSample k="free" head={h} color={!it.nh === h ? c.accentTx : c.ink} />
      </Opt>
    ));
    return wide
      ? rows(<><Grp wide title={dashTitle(t, "line", s.dash)}>{dash}</Grp><Grp wide title={t("zt_g_head")}>{head}</Grp></>, <><Grp wide title={t("zt_g_width")}>{width}</Grp><Grp wide title={t("zt_g_color")}>{colors}</Grp></>)
      : rows(<OptRow><Grp title={t("zt_g_line")} flex={3}>{dash}</Grp><Sep /><Grp title={t("zt_g_head")} flex={2}>{head}</Grp></OptRow>,
        <OptRow><Grp title={t("zt_g_width")} flex={3}>{width}</Grp><Sep /><Grp title={t("zt_g_color")} flex={6}>{colors}</Grp></OptRow>);
  }
  if (isArea(it.t)) {
    const fill = ([true, false] as const).map(f => <Opt key={String(f)} testID={id + "-fill-" + (f ? "on" : "off")} on={s.fill === f} a11y={t(f ? "zt_fill_on" : "zt_fill_off")} label={wide ? t(f ? "zt_fill_on" : "zt_fill_off") : undefined} onPress={() => upd({ fill: f })}><FillSample fill={f} color={s.fill === f ? c.accentTx : c.ink} /></Opt>);
    const dash = <DashOpts testID={id} value={s.dash} wide={wide} onChange={d => upd({ dash: d })} />;
    return wide
      ? rows(<><Grp wide title={t("zt_g_fill")}>{fill}</Grp><Grp wide title={dashTitle(t, "border", s.dash)}>{dash}</Grp></>, <><Grp wide title={t("zt_g_width")}>{width}</Grp><Grp wide title={t("zt_g_color")}>{colors}</Grp></>)
      : rows(<OptRow><Grp title={t("zt_g_fill")} flex={2}>{fill}</Grp><Sep /><Grp title={t("zt_g_width")} flex={3}>{width}</Grp></OptRow>,
        <OptRow><Grp title={t("zt_g_border")} flex={3}>{dash}</Grp><Sep /><Grp title={t("zt_g_color")} flex={6}>{colors}</Grp></OptRow>);
  }
  if (it.t === "text") {
    const edit = <Opt inline testID={id + "-text"} a11y={t("mp_textEdit")} label={t("mp_textEdit")} onPress={() => onEdit?.()}><Icon name="pen" size={16} color={c.ink} /></Opt>;
    const size = <TextSizes testID={id} value={s.w} wide={wide} onChange={w => upd({ w })} />;
    return wide
      ? rows(<><View style={{ flexDirection: "row" }}>{edit}</View><Grp wide title={t("zt_g_size")}>{size}</Grp></>, <Grp wide title={t("zt_g_color")}>{colors}</Grp>)
      : rows(<OptRow><Grp title={t("mp_textEdit")} flex={3}>{edit}</Grp><Sep /><Grp title={t("zt_g_size")} flex={3}>{size}</Grp></OptRow>, <OptRow><Grp title={t("zt_g_color")}>{colors}</Grp></OptRow>);
  }
  if (it.t === "own" && onPick && !sketch) {
    const inf = it.pid ? info(it.pid) : null;
    return rows(
      <OptRow>
        <Opt inline testID={id + "-player"} primary={!it.pid} a11y={t("mp_pick")} label={inf?.p ? `${inf.nr != null ? inf.nr + " " : ""}${inf.label}` : t("mp_pick")} onPress={onPick}><Icon name="person" size={16} color={it.pid ? c.ink : c.accentInk} /></Opt>
        {onEdit ? <Opt inline testID={id + "-edit"} a11y={t("mp_itemEdit")} label={t("mp_itemEdit")} onPress={onEdit}><Icon name="pen" size={16} color={c.ink} /></Opt> : null}
      </OptRow>, hintRow(t("zt_h_moveIt")));
  }
  if (it.t === "own" || it.t === "opp" || it.t === "neu") return rows(
    onEdit ? <OptRow><Opt inline testID={id + "-edit"} a11y={t("mp_itemEdit")} label={t("zt_number")} onPress={onEdit}><Icon name="pen" size={16} color={c.ink} /></Opt></OptRow> : hintRow(t("zt_h_moveIt")),
    onEdit ? hintRow(t("zt_h_moveIt")) : undefined);
  if (isRotatable(it.t)) return rows(
    <OptRow><Opt inline testID={id + "-rot"} a11y={t("mp_itemRot")} label={t("mp_itemRot")} onPress={() => { const r = ((it.rot || 0) + 45) % 360, x = { ...it }; delete x.rot; onUpdate(r ? { ...x, rot: r } : x); }}><Icon name="redo" size={16} color={c.ink} /></Opt></OptRow>,
    hintRow(t("zt_h_moveIt")));
  return rows(hintRow(t("zt_h_moveIt")));
}

// ---------- Erste Ebene ----------
/** Arten (erste Ebene): Handy eine Reihe mit Symbol und Name, breit ein Raster */
export function CatBar({ B, testID = "mp-board", wide }: { B: BoardState; testID?: string; wide?: boolean }) {
  const { t } = useEngine(); const { c } = useTheme();
  // Handy: Schrift passend zur Breite (alle sieben Arten in einer Reihe, auch bei 320 pt); der Rahmen der gewählten Art
  // liegt darüber und nimmt dem Namen keinen Platz
  const [W, setW] = useState(0);
  const gap = wide ? 8 : W && W < 330 ? 2 : 4, tw = W ? (W - gap * (CATS.length - 1)) / CATS.length : 50;
  const fs = wide ? 11 : Math.max(9, Math.min(10.5, Math.floor((tw / 4.45) * 2) / 2));
  return (
    <View testID={testID + "-cats"} accessibilityRole="tablist" onLayout={wide ? undefined : (e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))}
      style={{ flexDirection: "row", flexWrap: wide ? "wrap" : "nowrap", gap }}>
      {CATS.map(k => {
        const on = B.tools.cat === k;
        return (
          <Pressable key={k} testID={testID + "-cat-" + k} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t("zt_cat_" + k)} onPress={() => B.setCat(k)}
            style={({ pressed }) => ({ flex: wide ? 0 : 1, width: wide ? "22.5%" : undefined, minWidth: 0, height: 54, borderRadius: radius.m, alignItems: "center", justifyContent: "center", gap: 3,
              backgroundColor: on ? c.accentSoft : pressed ? c.sunk : "transparent" })}>
            <CatIcon k={k} color={on ? c.accentTx : c.ink} accent={c.club} />
            <Text numberOfLines={1} style={{ fontSize: fs, fontWeight: on ? "700" : "600", color: on ? c.accentTx : c.muted }}>{t("zt_cat_" + k)}</Text>
            {on ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: radius.m, borderWidth: 2, borderColor: c.accent }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Formular: Element im Detail ----------
/** Bogen in fünf Stufen: stark links … stark rechts (in Laufrichtung) */
export const BENDS: { k: string; v: number; icon: string }[] = [{ k: "2", v: 2, icon: "↶↶" }, { k: "1", v: 1, icon: "↶" }, { k: "0", v: 0, icon: "—" }, { k: "-1", v: -1, icon: "↷" }, { k: "-2", v: -2, icon: "↷↷" }];
function T2({ text }: { text: string }) { const { c } = useTheme(); return <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.muted }}>{text}</Text>; }

/** Element bearbeiten: Spieler, Rückennummer, Text, Linie, Bogen, Stärke, Schritt und Farbe */
export function ItemForm({ it, squad, look, onSave, onDelete, sketch }: { it: MpItem; squad: string[]; look?: MpContent["look"]; onSave: (x: MpItem) => void; onDelete: () => void; sketch?: boolean }) {
  const E = useEngine(); const { t } = E; const info = useTokenInfo();
  const [x, setX] = useState<MpItem>(it);
  const s = styleOfItem(x), bendKey = String(Math.max(-2, Math.min(2, Math.round(x.bend || 0))));
  const by = it.by ? E.D.staff.find(y => y.id === it.by)?.name || null : null;
  const line = isArrow(it.t) || it.t === "free" || isArea(it.t);
  return (
    <Col gap={14}>
      {by ? <Muted small testID="mp-item-by">{E.tf("mp_byLong", { n: by })}</Muted> : null}
      {it.t === "own" && !sketch ? <Picker testID="mp-item-player" label={t("mp_player")} value={x.pid || ""} onChange={k => setX({ ...x, pid: k || null })}
        options={[{ key: "", label: t("mp_noPlayer") }, ...[...new Set([...squad, ...E.D.players.map(p => p.id)])].map(pid => ({ key: pid, label: (info(pid)?.nr != null ? info(pid)!.nr + " " : "") + (info(pid)?.p ? E.name(info(pid)!.p!) : "?") }))]} /> : null}
      {it.t === "own" && !x.pid && !sketch ? <Field testID="mp-item-pos" label={t("mp_posShort")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 4) })} maxLength={4} style={{ width: 110 }} /> : null}
      {it.t === "opp" || it.t === "neu" || (it.t === "own" && sketch) ? <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <NumField testID="mp-item-n" label={t("mp_oppNr")} value={x.n ?? null} min={0} max={99} onChange={n => setX({ ...x, n })} style={{ width: 110 }} />
        <Field testID="mp-item-label" label={t("mp_posShort")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 4) })} maxLength={4} style={{ width: 110 }} />
      </View> : null}
      {it.t === "text" ? <Field testID="mp-item-text" label={t("mpt_text")} value={x.label || ""} onChangeText={v => setX({ ...x, label: v.slice(0, 40) })} maxLength={40} /> : null}
      {line ? <Grp wide title={dashTitle(t, isArea(it.t) ? "border" : "line", s.dash)}><DashOpts testID="mp-item" value={s.dash} wave={it.t === "pass" || it.t === "run" || it.t === "drib"} head={!isArea(it.t) && it.t !== "line" && !x.nh} wide onChange={d => setX(restyle(x, { dash: d }))} /></Grp> : null}
      {isArrow(it.t) ? <Col gap={5}><T2 text={t("zt_g_bend")} />
        <Seg testID="mp-item-bend" value={bendKey} onChange={k => setX(restyle(x, { bend: Number(k) }))} options={BENDS.map(b => ({ key: b.k, label: b.icon }))} />
      </Col> : null}
      {it.t === "free" ? <Grp wide title={t("zt_g_head")}>{([true, false] as const).map(h => <Opt key={String(h)} testID={"mp-item-head-" + (h ? "on" : "off")} on={!x.nh === h} a11y={t(h ? "zt_head_on" : "zt_head_off")} label={t(h ? "zt_head_on" : "zt_head_off")} onPress={() => setX(restyle(x, { head: h }))}><PathSample k="free" head={h} color="#888888" /></Opt>)}</Grp> : null}
      {isArea(it.t) ? <Grp wide title={t("zt_g_fill")}>{([true, false] as const).map(f => <Opt key={String(f)} testID={"mp-item-fill-" + (f ? "on" : "off")} on={s.fill === f} a11y={t(f ? "zt_fill_on" : "zt_fill_off")} label={t(f ? "zt_fill_on" : "zt_fill_off")} onPress={() => setX(restyle(x, { fill: f }))}><FillSample fill={f} color="#888888" /></Opt>)}</Grp> : null}
      {line ? <Grp wide title={t("zt_g_width")}><WidthOpts testID="mp-item" value={s.w} wide onChange={w => setX(restyle(x, { w }))} /></Grp> : null}
      {stepped(it.t) ? <NumField testID="mp-item-step" label={t("mp_step")} value={x.n ?? null} min={1} max={20} onChange={n => { const y = { ...x }; delete y.n; setX(n ? { ...y, n } : y); }} style={{ width: 130 }} /> : null}
      {line || it.t === "text" ? <Grp wide title={t("zt_g_color")}><Colors testID="mp-item-col" value={s.col} look={look} wide onChange={k => setX({ ...x, col: k })} /></Grp> : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {it.t !== "ball" && it.t !== "cone" && !isMaterial(it.t) ? <Btn testID="mp-item-save" kind="primary" label={t("save")} onPress={() => onSave(x)} /> : null}
        <Btn testID="mp-item-del" kind="danger" label={t("mp_itemDel")} onPress={onDelete} />
      </View>
    </Col>
  );
}

// ---------- Leiste unter der Tafel (Handy) ----------
/**
 * Unter der Tafel: zweite Ebene (Ausschnitt, ausgewähltes Element oder Optionen der Art) mit fester Höhe, darunter
 * die Arten. sel: Aktionen für das ausgewählte Element; frame: Ausschnitt-Bedienung.
 */
export function EditorPanel({ B, look, sketch, sel, frame, testID = "mp-board", wide }: {
  B: BoardState; look?: MpContent["look"]; sketch?: boolean; testID?: string; wide?: boolean;
  sel: { it: MpItem; onUpdate: (x: MpItem) => void; onDelete: () => void; onDup?: () => void; onEdit?: () => void; onPick?: () => void; testID?: string } | null;
  frame: React.ReactNode;
}) {
  const { c } = useTheme();
  const level2 = B.framing ? frame
    : sel ? <SelOptions key={sel.it.id} it={sel.it} B={B} look={look} sketch={sketch} wide={wide} onUpdate={sel.onUpdate} onDelete={sel.onDelete} onDup={sel.onDup} onEdit={sel.onEdit} onPick={sel.onPick} testID={sel.testID} />
    : <ToolOptions B={B} look={look} sketch={sketch} wide={wide} testID={testID} />;
  if (wide) return (
    <Col gap={16} testID={testID + "-panel"}>
      <CatBar B={B} testID={testID} wide />
      <View style={{ padding: 14, borderRadius: radius.l, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>{level2}</View>
    </Col>
  );
  // größere Displays (Tablet hochkant): Leiste mittig und höchstens 480 breit – so füllen die Optionen ihre Reihen
  const box = { width: "100%" as const, maxWidth: 480, alignSelf: "center" as const };
  return (
    <View testID={testID + "-panel"} style={{ gap: 8 }}>
      <View style={{ minHeight: OPT_H, ...box }}>{level2}</View>
      <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: -10 }} />
      <View style={box}><CatBar B={B} testID={testID} /></View>
    </View>
  );
}
