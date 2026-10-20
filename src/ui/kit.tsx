// Bausteine der Oberfläche. Alle Bildschirme setzen sich daraus zusammen (Leitfaden: docs/DESIGN.md).
// Aufbau einer Seite: Header (Titel) → Bereiche (Section: Titel über einer Gruppe mit Zeilen) → Zeilen führen per
// NavRow auf Detailseiten (Befund, Daten, Vorschläge, Hintergrund & Quellen). Knöpfe und Chips passen ihre Füllung der
// Fläche an, auf der sie liegen (Seitengrund, Gruppe, Kachel).
import React, { createContext, useCallback, useContext, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./icons";
import { font, radius, space, statusColor, useTheme, withAlpha, type Colors } from "./theme";

const HAIR = StyleSheet.hairlineWidth;

// ---------- Fläche (bestimmt die Füllung von Knöpfen, Chips und Feldern) ----------
type Surf = "bg" | "surface" | "sunk";
const SurfCtx = createContext<Surf>("bg");
/** Fläche, auf der ein Baustein liegt: Seitengrund, Gruppe/Karte oder Kachel */
export const useSurface = (): Surf => useContext(SurfCtx);
/** Getönte Füllung für Knöpfe, Felder und Chips passend zur Fläche darunter */
const tonal = (c: Colors, s: Surf): { backgroundColor: string; borderColor: string } =>
  s === "surface" ? { backgroundColor: c.sunk, borderColor: c.sunk } : s === "sunk" ? { backgroundColor: c.surface, borderColor: c.surface } : { backgroundColor: c.surface, borderColor: c.line };

// ---------- Text ----------
type TV = "h1" | "h2" | "h3" | "body" | "small" | "tiny" | "eyebrow";
export function T({ v = "body", color, style, children, numberOfLines, bold, center, testID, selectable }: { v?: TV; color?: string; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number; bold?: boolean; center?: boolean; testID?: string; selectable?: boolean }) {
  const { c } = useTheme();
  const role = v === "h1" || v === "h2" ? "header" : undefined;
  return (
    <Text accessibilityRole={role} testID={testID} numberOfLines={numberOfLines} selectable={selectable}
      style={[{ color: color || (v === "eyebrow" ? c.muted : c.ink) }, font[v], bold && { fontWeight: "700" }, center && { textAlign: "center" }, style]}>
      {children}
    </Text>
  );
}
export const Muted = ({ children, small, style, testID }: { children?: React.ReactNode; small?: boolean; style?: StyleProp<TextStyle>; testID?: string }) => {
  const { c } = useTheme(); return <T v={small ? "small" : "body"} color={c.muted} style={style} testID={testID}>{children}</T>;
};

/**
 * Satzschreibung für Beschriftungen (Chips, Kennzeichnungen, Feld- und Schalterbeschriftungen): erster Buchstabe groß.
 * Manche Wörterbuch-Texte beginnen klein, weil sie auch mitten im Satz vorkommen („bis“, „angepasst“).
 */
export const cap = (s: string): string => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** Länge des längsten Wortes (sehr lange deutsche Wörter brauchen eine kleinere Schrift). */
const longest = (s: string): number => Math.max(0, ...String(s).split(/\s+/).map(w => w.length));

// ---------- Layout ----------
export function Row({ children, gap = space.s, wrap, between, align = "center", style, testID }: { children?: React.ReactNode; gap?: number; wrap?: boolean; between?: boolean; align?: ViewStyle["alignItems"]; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[{ flexDirection: "row", alignItems: align, gap }, wrap && { flexWrap: "wrap" }, between && { justifyContent: "space-between" }, style]}>{children}</View>;
}
export function Col({ children, gap = space.s, style, testID }: { children?: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[{ gap }, style]}>{children}</View>;
}
/** Zwei Spalten auf breiten Bildschirmen (ab 900 px), sonst untereinander */
export function Columns({ left, right, gap = 20, testID }: { left: React.ReactNode; right: React.ReactNode; gap?: number; testID?: string }) {
  const { width } = useWindowDimensions();
  if (width < 900) return <Col gap={gap} testID={testID}>{left}{right}</Col>;
  return (
    <Row align="flex-start" gap={gap} testID={testID}>
      <Col gap={gap} style={{ flex: 1, minWidth: 0 }}>{left}</Col>
      <Col gap={gap} style={{ flex: 1, minWidth: 0 }}>{right}</Col>
    </Row>
  );
}
/**
 * Seite vorübergehend nicht scrollen lassen – z. B. solange ein Spieler auf der Aufstellung gezogen wird (sonst
 * übernimmt die Seite die Bewegung und das Ziehen bricht ab). Ohne umgebende Seite: ohne Wirkung.
 */
const ScrollLockCtx = createContext<(on: boolean) => void>(() => undefined);
export const useScrollLock = (): ((on: boolean) => void) => useContext(ScrollLockCtx);
/** Seite. narrow: Detailseite mit angenehmer Lesebreite (auf Tablet/Laptop mittig, höchstens ca. 780 px) */
export function Screen({ children, scroll = true, testID, narrow }: { children?: React.ReactNode; scroll?: boolean; testID?: string; narrow?: boolean }) {
  const { c } = useTheme(); const ins = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const [locked, setLocked] = useState(false);
  const lock = useCallback((on: boolean) => setLocked(on), []);
  const pad = width >= 900 ? 28 : space.l;
  const inner = <View style={{ width: "100%", maxWidth: narrow ? 780 + 2 * pad : 1100, alignSelf: "center", gap: 20, paddingHorizontal: pad, paddingTop: ins.top + space.l, paddingBottom: space.xxl * 2 }}>{children}</View>;
  if (!scroll) return <View testID={testID} style={{ flex: 1, backgroundColor: c.bg }}><SurfCtx.Provider value="bg">{inner}</SurfCtx.Provider></View>;
  return (
    <ScrollLockCtx.Provider value={lock}><SurfCtx.Provider value="bg">
      <ScrollView testID={testID} style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" scrollEnabled={!locked}>{inner}</ScrollView>
    </SurfCtx.Provider></ScrollLockCtx.Provider>
  );
}
/** Zurück-Link oben links (Ziel als Beschriftung, z. B. „Kader“) */
export function BackLink({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 32, marginLeft: -6, paddingRight: 8, opacity: pressed ? 0.6 : 1 })}>
      <Icon name="back" size={20} color={c.accentTx} strokeWidth={2.2} />
      {label ? <Text numberOfLines={1} style={{ color: c.accentTx, fontSize: 15.5, fontWeight: "600", letterSpacing: -0.1 }}>{label}</Text> : null}
    </Pressable>
  );
}
/**
 * Kopf einer Seite: großer Titel, darüber optional eine kurze Zeile (eyebrow, z. B. Datum), darunter optional der
 * Befund in einem Satz (sub, mit Statuspunkt subColor). right: z. B. ein Knopf (rutscht bei Platzmangel unter den Titel);
 * aside: kleines Element (Logo), bleibt immer rechts.
 */
export function Header({ eyebrow, title, sub, subColor, right, info, onBack, backLabel, aside, testID }: { eyebrow?: string; title: string; sub?: string; subColor?: string; right?: React.ReactNode; info?: React.ReactNode; onBack?: () => void; backLabel?: string; aside?: React.ReactNode; testID?: string }) {
  const { c } = useTheme();
  const w = longest(title);
  return (
    <Col gap={4} testID={testID}>
      {onBack ? <BackLink label={backLabel || ""} onPress={onBack} /> : null}
      <Row between align={aside ? "center" : "flex-end"} wrap={!aside} gap={aside ? 12 : 10}>
        <Col gap={2} style={aside ? { flex: 1, minWidth: 0 } : { flexShrink: 1 }}>
          {eyebrow ? <T v="eyebrow">{eyebrow}</T> : null}
          <Row gap={8}><T v="h1" style={[{ flexShrink: 1 }, w > 15 ? { fontSize: w > 19 ? 22 : 25, lineHeight: w > 19 ? 28 : 31 } : null]}>{title}</T>{info}</Row>
        </Col>
        {right}
        {aside ? <View style={{ flexShrink: 0 }}>{aside}</View> : null}
      </Row>
      {sub ? <Row gap={8} align="flex-start" style={{ marginTop: 2 }}>
        {subColor ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: subColor, marginTop: 6 }} /> : null}
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: c.muted }}>{sub}</Text>
      </Row> : null}
    </Col>
  );
}
/** Layout-Eigenschaften, die bei einer Karte mit Titel an den äußeren Rahmen (Titel + Fläche) gehören */
const OUTER_KEYS = new Set(["flex", "flexGrow", "flexShrink", "flexBasis", "width", "minWidth", "maxWidth", "alignSelf", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical"]);
/** Titel steht über der Fläche (wie ein Bereich) – CardTitle zeigt sich dann in Bereichsgröße */
const LiftedCtx = createContext(false);
/**
 * Karte: ruhige Fläche mit feinem Rand; tone tönt sie nur leicht ein (Status), damit Farbe Bedeutung behält.
 * Beginnt die Karte mit einem CardTitle, steht der Titel über der Fläche – so sehen alle Bereiche gleich aus
 * (Titel außen, Inhalt in der Gruppe).
 */
export function Card({ children, style, testID, tone }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; tone?: string }) {
  const { c, dark } = useTheme();
  const tn = tone && tone.startsWith("#") ? tone : undefined;
  const face: ViewStyle = { backgroundColor: tn ? withAlpha(tn, dark ? 0.1 : 0.05) : c.surface, borderWidth: HAIR, borderColor: tn ? withAlpha(tn, dark ? 0.32 : 0.26) : c.line, borderRadius: radius.l, padding: space.l, gap: space.m };
  const items = React.Children.toArray(children);
  const first = items[0];
  if (React.isValidElement(first) && first.type === CardTitle) {
    const flat = (StyleSheet.flatten(style) || {}) as unknown as Record<string, unknown>;
    const outer: Record<string, unknown> = {}, inner: Record<string, unknown> = {};
    for (const k of Object.keys(flat)) (OUTER_KEYS.has(k) ? outer : inner)[k] = flat[k];
    const rest = items.slice(1);
    return (
      <View testID={testID} style={[{ gap: 8 }, outer as unknown as ViewStyle]}>
        <LiftedCtx.Provider value={true}><View style={{ paddingHorizontal: 2 }}>{first}</View></LiftedCtx.Provider>
        {rest.length ? <View style={[face, inner as unknown as ViewStyle]}><SurfCtx.Provider value="surface">{rest}</SurfCtx.Provider></View> : null}
      </View>
    );
  }
  return (
    <View testID={testID} style={[face, style]}>
      <SurfCtx.Provider value="surface">{children}</SurfCtx.Provider>
    </View>
  );
}
const cardTitle = { fontSize: 17, lineHeight: 22, fontWeight: "700" as const, letterSpacing: -0.25 };
/**
 * Titel der umgebenden Seite: Karten mit genau diesem Titel zeigen ihn nicht noch einmal (z. B. eine Karte, die allein
 * auf ihrer eigenen Bereichsseite steht) – nur Info und Aktion bleiben.
 */
const PageTitleCtx = createContext<string | null>(null);
export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return <PageTitleCtx.Provider value={title}>{children}</PageTitleCtx.Provider>;
}
export function CardTitle({ title, info, right }: { title: string; info?: React.ReactNode; right?: React.ReactNode }) {
  const { c } = useTheme(); const page = useContext(PageTitleCtx); const lifted = useContext(LiftedCtx);
  if (page && page === title) return info || right ? <Row gap={10} style={{ justifyContent: "flex-end" }}>{info}{right}</Row> : null;
  return (
    <Row between gap={10} style={lifted ? { minHeight: 28 } : undefined}>
      <Row gap={6} style={{ flexShrink: 1 }}>
        <Text accessibilityRole="header" style={[lifted ? font.h2 : cardTitle, { color: c.ink, flexShrink: 1 }, longest(title) > 18 ? { fontSize: lifted ? 17 : 15.5 } : null]}>{title}</Text>{info}
      </Row>
      {right}
    </Row>
  );
}
export const Divider = () => { const { c } = useTheme(); return <View style={{ height: HAIR, backgroundColor: c.line, marginVertical: 2 }} />; };

// ---------- Bereiche, Gruppen, Zeilen ----------
/** Symbol in getönter Kachel (für Zeilen und Kacheln) */
export function IconTile({ name, color, size = 32 }: { name: IconName; color: string; size?: number }) {
  const col = color.startsWith("#") ? color : "#888888";
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: withAlpha(col, 0.13), alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={Math.round(size * 0.56)} color={col} strokeWidth={2} />
    </View>
  );
}
/** Zahl in einer Kapsel (z. B. offene Punkte) */
export function Badge({ n, color, testID }: { n: number | string; color?: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: color || c.sunk, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: color ? "#ffffff" : c.ink, fontVariant: ["tabular-nums"] }}>{n}</Text>
    </View>
  );
}
/**
 * Gruppe: Fläche mit Zeilen; zwischen den Zeilen feine Trennlinien (bei Zeilen mit Symbol eingerückt bis zum Text).
 * pad: Inhalt mit Innenabstand statt Zeilen (z. B. ein Diagramm).
 */
export function Group({ children, testID, style, pad }: { children?: React.ReactNode; testID?: string; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  const { c } = useTheme();
  const items = React.Children.toArray(children);
  // Zeilen mit Symbol oder Bild: Trennlinie beginnt erst beim Text (wie in Listen auf dem Handy üblich). Zeilen-Bausteine
  // geben ihren Einzug über sepInset an (Zahl oder Funktion der Eigenschaften).
  const inset = (ch: React.ReactNode): number => {
    if (!React.isValidElement(ch)) return 14;
    const si = (ch.type as unknown as { sepInset?: number | ((p: unknown) => number) }).sepInset;
    return si == null ? 14 : typeof si === "function" ? si(ch.props) : si;
  };
  return (
    <View testID={testID} style={[{ backgroundColor: c.surface, borderRadius: radius.l, borderWidth: HAIR, borderColor: c.line, overflow: "hidden" }, pad && { padding: space.l, gap: space.m }, style]}>
      <SurfCtx.Provider value="surface">
        {pad ? children : items.map((ch, i) => (
          <React.Fragment key={(React.isValidElement(ch) && ch.key) || i}>
            {i ? <View style={{ height: HAIR, backgroundColor: c.line, marginLeft: inset(ch) }} /> : null}
            {ch}
          </React.Fragment>
        ))}
      </SurfCtx.Provider>
    </View>
  );
}
/**
 * Bereich einer Seite: Titel (mit Info und Aktion rechts) über einer Gruppe. plain: ohne Fläche (Inhalt bringt eigene
 * Karten mit); pad: Gruppe mit Innenabstand; footer: kurze Anmerkung unter der Gruppe.
 */
export function Section({ title, info, action, right, children, testID, plain, pad, footer, style, dot, quiet }: {
  title?: string; info?: React.ReactNode; action?: { label: string; onPress: () => void; testID?: string }; right?: React.ReactNode; children?: React.ReactNode;
  testID?: string; plain?: boolean; pad?: boolean; footer?: string; style?: StyleProp<ViewStyle>; /** Statuspunkt vor dem Titel */ dot?: string;
  /** leiser Titel (z. B. Gruppen in langen Menüs) */ quiet?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={[{ gap: quiet ? 6 : 8 }, style]}>
      {title ? (
        <Row between gap={10} style={{ paddingHorizontal: quiet ? 4 : 2, minHeight: quiet ? 20 : 28 }}>
          <Row gap={8} style={{ flexShrink: 1 }}>
            {dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} /> : null}
            {quiet ? <Text accessibilityRole="header" style={{ flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: "600", color: c.muted }}>{title}</Text>
              : <T v="h2" style={{ flexShrink: 1 }}>{title}</T>}{info}
          </Row>
          {action ? (
            <Pressable testID={action.testID} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: c.accentTx, fontSize: 15, fontWeight: "600" }}>{action.label}</Text>
            </Pressable>
          ) : null}
          {right}
        </Row>
      ) : null}
      {plain ? children : <Group pad={pad}>{children}</Group>}
      {footer ? <T v="small" color={c.muted} style={{ paddingHorizontal: 4 }}>{footer}</T> : null}
    </View>
  );
}
/**
 * Zeile, die zu einer Seite führt (oder eine Aktion auslöst): Symbol, Titel, eine Zeile Nebentext, Wert oder Zahl, Pfeil.
 * In einer Group; ohne onPress nur Anzeige (ohne Pfeil).
 */
export function NavRow({ icon, iconColor, left, title, sub, subLines = 1, value, valueColor, badge, badgeColor, right, onPress, testID, a11y, chevron = true }: {
  icon?: IconName; iconColor?: string; left?: React.ReactNode; title: string; sub?: string; subLines?: number; value?: string | null; valueColor?: string;
  badge?: number | string | null; badgeColor?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; a11y?: string; chevron?: boolean;
  /** Einzug der Trennlinie darüber (sonst nach Symbol bzw. Bild) */ inset?: number;
}) {
  const { c } = useTheme();
  const body = (pressed: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: sub ? 10 : 12, minHeight: 52, backgroundColor: pressed ? c.sunk : "transparent" }}>
      {left ?? (icon ? <IconTile name={icon} color={iconColor || c.accentTx} /> : null)}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontSize: 15.5, lineHeight: 20, fontWeight: "600", color: c.ink, letterSpacing: -0.15 }}>{title}</Text>
        {sub ? <Text numberOfLines={subLines} style={{ fontSize: 13, lineHeight: 18, color: c.muted }}>{sub}</Text> : null}
      </View>
      {value != null && value !== "" ? <Text numberOfLines={1} style={{ fontSize: 15, color: valueColor || c.muted, fontWeight: valueColor ? "700" : "500", fontVariant: ["tabular-nums"], flexShrink: 0, maxWidth: "45%" }}>{value}</Text> : null}
      {badge != null && badge !== 0 && badge !== "" ? <Badge n={badge} color={badgeColor} /> : null}
      {right}
      {onPress && chevron ? <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body(false)}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11y || [title, sub, value, badge ? String(badge) : ""].filter(Boolean).join(", ")} onPress={onPress}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}
NavRow.sepInset = (p: { icon?: unknown; left?: unknown; inset?: number }): number => p.inset ?? (p.icon ? 58 : p.left ? 60 : 14);
/** Letzte Zeile einer Gruppe: „Weitere anzeigen“ o. Ä. (Text in Vereinsfarbe) */
export function MoreRow({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 13, minHeight: 46, justifyContent: "center", backgroundColor: pressed ? c.sunk : "transparent" })}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: c.accentTx }}>{label}</Text>
    </Pressable>
  );
}
/** Grundbreite der Kacheln einer Reihe (Metrics legt sie fest: vier Kacheln am Handy als 2 × 2) */
const MetricBasisCtx = createContext<number | `${number}%`>(100);
/** Kennzahl als Kachel: Beschriftung, große Zahl (gleich breite Ziffern), optional Einheit und eine Zeile darunter */
export function Metric({ label, value, unit, color, sub, onPress, testID, dot }: { label: string; value: string; unit?: string; color?: string; sub?: string; onPress?: () => void; testID?: string; dot?: string }) {
  const { c } = useTheme(); const surf = useSurface(); const basis = useContext(MetricBasisCtx);
  // Lange Werte (mit Einheit) kleiner setzen, damit nichts abgeschnitten wird – auch in drei Spalten am Handy
  const len = value.length + (unit ? unit.length + 1 : 0) + (onPress ? 1 : 0), fs = len > 7 ? 20 : len > 5 ? 23 : 27;
  const fill = surf === "surface" ? { backgroundColor: c.sunk, borderColor: c.sunk } : { backgroundColor: c.surface, borderColor: c.line };
  const body = (pressed: boolean) => (
    <View style={[{ borderRadius: radius.tile, borderWidth: HAIR, paddingVertical: 12, paddingHorizontal: 14, gap: 2, opacity: pressed ? 0.75 : 1 }, fill]}>
      <Row gap={6} align="flex-start">
        {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 5 }} /> : null}
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, lineHeight: 17, fontWeight: "600", color: c.muted }}>{label}</Text>
      </Row>
      <Row gap={3} align="flex-end">
        <Text numberOfLines={1} style={[font.fig, { fontSize: fs, lineHeight: fs + 5, color: color || c.ink, flexShrink: 1 }]}>{value}</Text>
        {unit ? <Text style={{ fontSize: 14, lineHeight: 22, fontWeight: "700", color: c.muted }}>{unit}</Text> : null}
        {onPress ? <View style={{ marginLeft: "auto", paddingBottom: 5 }}><Icon name="chevron" size={13} color={c.faint} strokeWidth={2.4} /></View> : null}
      </Row>
      {sub ? <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.muted }}>{sub}</Text> : null}
    </View>
  );
  const wrap = { flexGrow: 1, flexBasis: basis, minWidth: 0 };
  if (!onPress) return <View testID={testID} style={wrap}>{body(false)}</View>;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value}${unit ? " " + unit : ""}`} onPress={onPress} style={wrap}>{({ pressed }) => body(pressed)}</Pressable>;
}
/** Reihe von Kennzahl-Kacheln (bricht um): bis zu drei nebeneinander, vier am Handy als 2 × 2 */
export function Metrics({ children, testID }: { children?: React.ReactNode; testID?: string }) {
  const { width } = useWindowDimensions();
  const n = React.Children.toArray(children).length;
  return (
    <MetricBasisCtx.Provider value={n === 4 && width < 700 ? "40%" : 100}>
      <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>
    </MetricBasisCtx.Provider>
  );
}

// ---------- Detailseiten: Einordnung, Vorschläge, Hintergrund ----------
/** „Was heißt das?“ – kurze Einordnung in Absätzen */
export function Explain({ title, text, testID, children }: { title: string; text?: string | string[]; testID?: string; children?: React.ReactNode }) {
  const L = (Array.isArray(text) ? text : text ? [text] : []).filter(Boolean);
  return <Section title={title} pad testID={testID}>{L.map((x, i) => <T key={i}>{x}</T>)}{children}</Section>;
}
/** Vorschläge: konkrete nächste Schritte; mit onPress als Zeile, die hinführt */
export function Tips({ title, items, testID }: { title: string; items: (string | { text: string; onPress?: () => void; testID?: string; icon?: IconName })[]; testID?: string }) {
  const { c } = useTheme();
  const L = items.filter(Boolean);
  if (!L.length) return null;
  return (
    <Section title={title} testID={testID}>
      {L.map((x, i) => {
        const it = typeof x === "string" ? { text: x } : x;
        if (it.onPress) return <NavRow key={i} testID={it.testID} icon={it.icon || "target"} iconColor={c.accentTx} title={it.text} onPress={it.onPress} />;
        return (
          <View key={i} testID={it.testID} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: "flex-start" }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accentTx, marginTop: 7 }} />
            <T style={{ flex: 1 }}>{it.text}</T>
          </View>
        );
      })}
    </Section>
  );
}
/** „Hintergrund & Quellen“ – aufklappbar: Rechenweg, Studienlage, Quellen */
export function Background({ title, text = [], sources, sourcesLabel, testID, defaultOpen = false, children }: { title: string; text?: string[]; sources?: string[]; sourcesLabel?: string; testID?: string; defaultOpen?: boolean; children?: React.ReactNode }) {
  const { c } = useTheme(); const [open, setOpen] = useState(defaultOpen);
  return (
    <View testID={testID} style={{ backgroundColor: c.surface, borderRadius: radius.l, borderWidth: HAIR, borderColor: c.line, overflow: "hidden" }}>
      <Pressable testID={testID ? testID + "-toggle" : undefined} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} onPress={() => setOpen(!open)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 52, backgroundColor: pressed ? c.sunk : "transparent" })}>
        <IconTile name="book" color={c.muted} />
        <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "600", color: c.ink }}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}><Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} /></View>
      </Pressable>
      {open ? (
        <SurfCtx.Provider value="surface">
          <View style={{ paddingHorizontal: space.l, paddingBottom: space.l, gap: 10 }}>
            {text.filter(Boolean).map((x, i) => <T key={i} v="small" style={{ fontSize: 14, lineHeight: 20 }}>{x}</T>)}
            {children}
            {sources?.length ? <Col gap={4} style={{ marginTop: 4 }}>
              {sourcesLabel ? <T v="eyebrow">{sourcesLabel}</T> : null}
              {sources.map((x, i) => <T key={i} v="small" color={c.muted}>{x}</T>)}
            </Col> : null}
          </View>
        </SurfCtx.Provider>
      ) : null}
    </View>
  );
}

// ---------- Buttons & Auswahl ----------
export function Btn({ label, onPress, kind = "default", small, disabled, icon, testID, style, a11y }: { label: string; onPress?: () => void; kind?: "primary" | "default" | "danger" | "ghost"; small?: boolean; disabled?: boolean; icon?: IconName; testID?: string; style?: StyleProp<ViewStyle>; a11y?: string }) {
  const { c } = useTheme(); const surf = useSurface();
  const tn = tonal(c, surf);
  const bg = kind === "primary" ? c.accent : kind === "danger" ? c.crit : kind === "ghost" ? "transparent" : tn.backgroundColor;
  const bd = kind === "default" ? tn.borderColor : bg;
  const fg = kind === "primary" ? c.accentInk : kind === "danger" ? "#fff" : kind === "ghost" ? c.accentTx : c.ink;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11y || label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: bg, borderWidth: kind === "ghost" ? 0 : 1, borderColor: bd, borderRadius: radius.pill, paddingVertical: small ? 7 : 11, paddingHorizontal: kind === "ghost" ? (small ? 8 : 10) : label ? (small ? 12 : 18) : (small ? 9 : 12), opacity: disabled ? 0.45 : pressed ? 0.75 : 1, minHeight: small ? 34 : 46 }, style]}>
      {icon ? <Icon name={icon} size={small ? 15 : 18} color={fg} strokeWidth={2} /> : null}
      {label ? <Text style={{ color: fg, fontWeight: "600", fontSize: small ? 13.5 : 15, letterSpacing: -0.1 }}>{label}</Text> : null}
    </Pressable>
  );
}
export function Seg<K extends string>({ options, value, onChange, testID, wrap }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testID?: string; wrap?: boolean }) {
  const { c } = useTheme(); const surf = useSurface();
  return (
    <View testID={testID} accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", backgroundColor: surf === "sunk" ? c.surface : c.sunk, borderRadius: radius.m, padding: 3, gap: 2, alignSelf: "flex-start", maxWidth: "100%" }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} testID={testID ? testID + "-" + o.key : undefined} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9, backgroundColor: on ? (surf === "sunk" ? c.sunk : c.surface) : "transparent", borderWidth: HAIR, borderColor: on && surf !== "sunk" ? c.line : "transparent", flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ fontWeight: on ? "700" : "600", fontSize: 13.5, color: on ? c.ink : c.muted }}>{cap(o.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
/** Auswahl als Kapseln; die gewählte in Tintenfarbe (Vereinsfarbe bleibt für das Wichtigste) */
export function ChoiceChips<K extends string>({ options, value, onChange, testID }: { options: { key: K; label: string }[]; value: K | null; onChange: (k: K) => void; testID?: string }) {
  const { c } = useTheme(); const tn = tonal(c, useSurface());
  return (
    <Row wrap gap={6}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} testID={testID ? testID + "-" + o.key : undefined} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)}
            style={{ borderWidth: 1, borderColor: on ? c.ink : tn.borderColor, backgroundColor: on ? c.ink : tn.backgroundColor, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ fontWeight: "600", fontSize: 14, color: on ? c.bg : c.ink }}>{cap(o.label)}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}
export function Chip({ label, color, testID }: { label: string; color?: string; testID?: string }) {
  const { c, dark } = useTheme(); const col = color || c.build;
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: withAlpha(col.startsWith("#") ? col : "#888888", dark ? 0.16 : 0.1), borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
      <Text style={{ color: col, fontWeight: "600", fontSize: 12.5 }}>{cap(label)}</Text>
    </View>
  );
}
export const StatusChip = ({ status, label }: { status: string; label: string }) => { const { c } = useTheme(); return <Chip label={label} color={statusColor(c, status)} />; };
/** Kleine Kennzeichnung (Position, Alter, Quelle) – leise, in Satzschreibung */
export function Tag({ label }: { label: string }) {
  const { c } = useTheme(); const surf = useSurface();
  return <View style={{ backgroundColor: surf === "surface" ? c.sunk : c.surface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start" }}><Text style={{ fontSize: 11.5, fontWeight: "600", color: c.muted }}>{cap(label)}</Text></View>;
}
export function Pill({ label, color }: { label: string; color: string }) {
  return <View style={{ backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" }}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{cap(label)}</Text></View>;
}

// ---------- Eingaben ----------
/** Füllung und Rand eines Eingabefelds (getönt; beim Tippen Rand in Vereinsfarbe) */
function useInputStyle(focused: boolean): ViewStyle {
  const { c } = useTheme(); const surf = useSurface();
  const fill = surf === "surface" ? c.sunk : surf === "sunk" ? c.surface : c.surface;
  return { backgroundColor: fill, borderWidth: 1, borderColor: focused ? c.accent : surf === "bg" ? c.line : fill, borderRadius: radius.m };
}
export function Field({ label, value, onChangeText, onBlur, placeholder, keyboardType, multiline, secure, testID, hint, autoCapitalize, autoComplete, maxLength, style }: { label: string; value: string; onChangeText: (s: string) => void; onBlur?: () => void; placeholder?: string; keyboardType?: "default" | "numeric" | "number-pad" | "decimal-pad" | "email-address" | "numbers-and-punctuation" | "phone-pad"; multiline?: boolean; secure?: boolean; testID?: string; hint?: string; autoCapitalize?: "none" | "sentences" | "words" | "characters"; autoComplete?: TextInputProps["autoComplete"]; maxLength?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme(); const [focus, setFocus] = useState(false); const box = useInputStyle(focus);
  return (
    <View style={[{ gap: 5 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted }}>{cap(label)}</Text>
      <TextInput testID={testID} accessibilityLabel={label} value={value} onChangeText={onChangeText} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); onBlur?.(); }} placeholder={placeholder} placeholderTextColor={c.faint}
        keyboardType={keyboardType} multiline={multiline} numberOfLines={multiline ? 4 : undefined} secureTextEntry={secure} autoCapitalize={autoCapitalize} autoComplete={autoComplete} maxLength={maxLength}
        style={[box, { paddingHorizontal: 12, paddingVertical: 11, color: c.ink, fontSize: 16, minHeight: multiline ? 96 : 46, textAlignVertical: multiline ? "top" : "center" }]} />
      {hint ? <Text style={{ fontSize: 12.5, lineHeight: 17, color: c.muted }}>{hint}</Text> : null}
    </View>
  );
}
/** Suchfeld mit Lupe und Löschen-Knopf (ohne eigene Beschriftung – der Platzhalter sagt, was gesucht wird) */
export function SearchField({ value, onChange, placeholder, testID, clearLabel }: { value: string; onChange: (s: string) => void; placeholder: string; testID?: string; clearLabel: string }) {
  const { c } = useTheme(); const [focus, setFocus] = useState(false); const box = useInputStyle(focus);
  return (
    <View style={[box, { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }]}>
      <Icon name="search" size={18} color={c.muted} />
      <TextInput testID={testID} value={value} onChangeText={onChange} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholder={placeholder} placeholderTextColor={c.faint} accessibilityLabel={placeholder}
        style={{ flex: 1, paddingVertical: 11, fontSize: 15.5, color: c.ink, borderWidth: 0, backgroundColor: "transparent" }} />
      {value ? <Pressable accessibilityRole="button" accessibilityLabel={clearLabel} onPress={() => onChange("")} hitSlop={8}><Icon name="close" size={16} color={c.muted} /></Pressable> : null}
    </View>
  );
}
/** Datum als TT.MM.JJJJ (de) bzw. TT/MM/JJJJ (en) eingeben; liefert ISO oder null. */
export function DateField({ label, value, onChange, lang, testID, style }: { label: string; value: string | null; onChange: (iso: string | null) => void; lang: "de" | "en"; testID?: string; style?: StyleProp<ViewStyle> }) {
  const fmt = (v: string | null): string => { if (!v) return ""; const [y, m, d] = v.split("-"); return lang === "en" ? `${d}/${m}/${y}` : `${d}.${m}.${y}`; };
  const [txt, setTxt] = useState(fmt(value));
  const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setTxt(fmt(value)); }
  const parseIn = (s: string): string | null => {
    const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); if (!m) return null;
    const y = m[3].length === 2 ? "20" + m[3] : m[3], mo = +m[2], d = +m[1];
    const dt = new Date(+y, mo - 1, d); if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  return <Field style={style} testID={testID} label={label} value={txt} placeholder={lang === "en" ? "DD/MM/YYYY" : "TT.MM.JJJJ"} keyboardType="numbers-and-punctuation"
    onChangeText={s => { setTxt(s); const p = parseIn(s); if (p) { setLast(p); onChange(p); } else if (!s.trim()) { setLast(null); onChange(null); } }} />;
}
export function TimeField({ label, value, onChange, testID, style }: { label: string; value: string; onChange: (hhmm: string) => void; testID?: string; style?: StyleProp<ViewStyle> }) {
  const [txt, setTxt] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setTxt(value); }
  return <Field style={style} testID={testID} label={label} value={txt} placeholder="19:30" keyboardType="numeric" maxLength={5}
    onChangeText={s => { setTxt(s); const m = s.match(/^(\d{1,2})[:.](\d{2})$/); if (m && +m[1] < 24 && +m[2] < 60) { const v = m[1].padStart(2, "0") + ":" + m[2]; setLast(v); onChange(v); } }} />;
}
export function NumField({ label, value, onChange, min, max, testID, style, step }: { label: string; value: number | null; onChange: (n: number | null) => void; min?: number; max?: number; testID?: string; style?: StyleProp<ViewStyle>; step?: number }) {
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setTxt(value == null ? "" : String(value)); }
  return <Field style={style} testID={testID} label={label} value={txt} keyboardType="decimal-pad"
    onChangeText={s => { setTxt(s); const n = Number(s.replace(",", ".")); if (s.trim() === "") { setLast(null); onChange(null); } else if (Number.isFinite(n)) { const v = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, step ? Math.round(n / step) * step : n)); setLast(v); onChange(v); } }} />;
}
/** Auswahl aus einer Liste (öffnet ein Blatt). */
export function Picker<K extends string>({ label, value, options, onChange, testID, style }: { label: string; value: K; options: { key: K; label: string; sub?: string }[]; onChange: (k: K) => void; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme(); const [open, setOpen] = useState(false); const box = useInputStyle(false);
  const cur = options.find(o => o.key === value);
  return (
    <View style={[{ gap: 5 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted }}>{cap(label)}</Text>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label + ": " + (cur?.label || "")} onPress={() => setOpen(true)}
        style={[box, { paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
        <Text numberOfLines={1} style={{ color: c.ink, fontSize: 16, flexShrink: 1 }}>{cur ? cap(cur.label) : "–"}</Text>
        <View style={{ transform: [{ rotate: "90deg" }] }}><Icon name="chevron" size={15} color={c.muted} strokeWidth={2.2} /></View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={cap(label)}>
        <Group>
          {options.map(o => (
            <Pressable key={o.key} testID={testID ? testID + "-opt-" + o.key : undefined} accessibilityRole="button" onPress={() => { setOpen(false); onChange(o.key); }}
              style={({ pressed }) => ({ paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, backgroundColor: pressed ? c.sunk : "transparent" })}>
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: o.key === value ? "700" : "400" }}>{cap(o.label)}</Text>
                {o.sub ? <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{o.sub}</Text> : null}
              </View>
              {o.key === value ? <Icon name="check" size={18} color={c.accentTx} strokeWidth={2.4} /> : null}
            </Pressable>
          ))}
        </Group>
      </Sheet>
    </View>
  );
}
export function ToggleRow({ label, desc, value, onChange, disabled, testID, badge }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; testID?: string; badge?: string }) {
  const { c } = useTheme();
  return (
    <Row gap={12} align="flex-start" style={{ opacity: disabled ? 0.5 : 1 }}>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.accent, false: c.line }} />
      <Col gap={2} style={{ flex: 1 }}>
        <Row gap={6} wrap><T bold>{cap(label)}</T>{badge ? <Tag label={badge} /> : null}</Row>
        {desc ? <Muted small>{desc}</Muted> : null}
      </Col>
    </Row>
  );
}
export function Check({ label, value, onChange, testID }: { label: React.ReactNode; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: value ? c.accent : c.faint, backgroundColor: value ? c.accent : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {value ? <Icon name="check" size={15} color={c.accentInk} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof label === "string" ? <T>{cap(label)}</T> : label}</View>
    </Pressable>
  );
}

/** Zahlenskala als Knöpfe (z. B. RPE 1–10), farbig nach Intensität. */
export function NumScale({ value, onChange, min = 1, max = 10, color, testID, labels }: { value: number | null; onChange: (n: number) => void; min?: number; max?: number; color?: (n: number) => string; testID?: string; labels?: string[] }) {
  const { c } = useTheme(); const tn = tonal(c, useSurface());
  const nums: number[] = []; for (let i = min; i <= max; i++) nums.push(i);
  return (
    <Row wrap gap={6} testID={testID}>
      {nums.map(n => {
        const on = n === value, col = color ? color(n) : c.accent;
        return (
          <Pressable key={n} testID={testID ? testID + "-" + n : undefined} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={labels?.[n - min] ? `${n} ${labels[n - min]}` : String(n)} onPress={() => onChange(n)}
            style={{ minWidth: 42, height: 42, borderRadius: radius.m, borderWidth: 1, borderColor: on ? col : tn.borderColor, backgroundColor: on ? col : tn.backgroundColor, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ fontWeight: "700", fontSize: 15.5, color: on ? "#fff" : c.ink, fontVariant: ["tabular-nums"] }}>{n}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

// ---------- Blätter (Dialoge) & Info ----------
export function Sheet({ visible, onClose, title, children, testID, closeLabel }: { visible: boolean; onClose: () => void; title?: string; children?: React.ReactNode; testID?: string; closeLabel?: string }) {
  const { c } = useTheme(); const { width, height } = useWindowDimensions(); const wide = width >= 700; const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={wide ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: wide ? "center" : "flex-end", alignItems: "center", backgroundColor: c.overlay }}>
        <Pressable accessibilityLabel={closeLabel || "close"} onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View testID={testID} style={{ width: "100%", maxWidth: 600, maxHeight: height * 0.9, backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderBottomLeftRadius: wide ? radius.sheet : 0, borderBottomRightRadius: wide ? radius.sheet : 0 }}>
          {!wide ? <View style={{ alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: c.line, marginTop: 8 }} /> : null}
          <SurfCtx.Provider value="surface">
            <ScrollView contentContainerStyle={{ padding: space.l, paddingTop: wide ? space.l + 2 : space.m, paddingBottom: space.l + ins.bottom, gap: space.m }} keyboardShouldPersistTaps="handled">
              {title ? <Row between align="flex-start" gap={12}>
                <T v="h2" style={{ flex: 1, paddingTop: 3 }}>{title}</T>
                <Pressable testID={testID ? testID + "-close" : "sheet-close"} accessibilityRole="button" accessibilityLabel={closeLabel || "close"} onPress={onClose} hitSlop={10}
                  style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, backgroundColor: c.sunk, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
                  <Icon name="close" size={15} color={c.muted} strokeWidth={2.4} />
                </Pressable>
              </Row> : null}
              {children}
            </ScrollView>
          </SurfCtx.Provider>
        </View>
      </View>
    </Modal>
  );
}
interface InfoState { title: string; body: React.ReactNode }
const InfoCtx = createContext<(i: InfoState) => void>(() => undefined);
/** Stellt die Info-Blätter bereit (einmal im Root-Layout). */
const InfoOn = createContext(true);
/** Stellt die Info-Blätter bereit; enabled = false blendet alle Info-Buttons aus (Einstellung des Nutzers). */
export function InfoHost({ children, closeLabel, enabled = true }: { children?: React.ReactNode; closeLabel: string; enabled?: boolean }) {
  const [info, setInfo] = useState<InfoState | null>(null);
  return (
    <InfoCtx.Provider value={setInfo}><InfoOn.Provider value={enabled}>
      {children}
      <Sheet visible={!!info} onClose={() => setInfo(null)} title={info?.title} testID="info-sheet" closeLabel={closeLabel}>
        {typeof info?.body === "string" ? <T>{info.body}</T> : info?.body}
      </Sheet>
    </InfoOn.Provider></InfoCtx.Provider>
  );
}
/** Kleiner ⓘ-Knopf: Erklärungen nur bei Bedarf. */
export function Info({ title, text, children, testID }: { title: string; text?: string | string[]; children?: React.ReactNode; testID?: string }) {
  const { c } = useTheme(); const show = useContext(InfoCtx); const on = useContext(InfoOn);
  if (!on) return null;
  const body = children || (Array.isArray(text) ? <Col gap={10}>{text.filter(Boolean).map((x, i) => <T key={i}>{x}</T>)}</Col> : text);
  return (
    <Pressable testID={testID || "info"} accessibilityRole="button" accessibilityLabel={"Info: " + title} onPress={() => show({ title, body })} hitSlop={10}
      style={({ pressed }) => ({ width: 22, height: 22, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Icon name="info" size={18} color={c.faint} strokeWidth={2} />
    </Pressable>
  );
}

/** Aufklappbare Karte: Kopfzeile mit Titel, Zahl und Pfeil; zugeklappt optional eine Kurzfassung. */
export function Fold({ title, count, countColor, right, summary, children, testID, defaultOpen = false, style }: {
  title: string; count?: number; countColor?: string; right?: React.ReactNode; summary?: React.ReactNode; children?: React.ReactNode; testID?: string; defaultOpen?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme(); const [open, setOpen] = useState(defaultOpen);
  return (
    <Card testID={testID} style={style}>
      <Pressable testID={testID ? testID + "-toggle" : undefined} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} onPress={() => setOpen(!open)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 }}>
        <Text accessibilityRole="header" style={[cardTitle, { flex: 1, color: c.ink }]}>{title}</Text>
        {count != null ? <View style={{ minWidth: 28, height: 24, borderRadius: 12, paddingHorizontal: 8, backgroundColor: count ? withAlpha(countColor || c.accentTx, 0.14) : c.sunk, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: count ? (countColor || c.accentTx) : c.muted, fontVariant: ["tabular-nums"] }}>{count}</Text>
        </View> : null}
        {right}
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}><Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} /></View>
      </Pressable>
      {!open && summary ? summary : null}
      {open ? children : null}
    </Card>
  );
}

// ---------- Listen & Hinweise ----------
export function ListItem({ left, title, sub, right, onPress, testID, children }: { left?: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; children?: React.ReactNode }) {
  const { c } = useTheme();
  const body = (
    <Row gap={12} style={{ paddingVertical: 11, borderBottomWidth: HAIR, borderBottomColor: c.line }}>
      {left}
      <Col gap={3} style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 15.5, lineHeight: 20, fontWeight: "600", color: c.ink, letterSpacing: -0.1 }}>{title}</Text>
        {sub ? <Muted small>{sub}</Muted> : null}
        {children}
      </Col>
      {right}
      {onPress && !right ? <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} /> : null}
    </Row>
  );
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>{body}</Pressable> : <View testID={testID}>{body}</View>;
}
export function Banner({ children, color, testID }: { children?: React.ReactNode; color?: string; testID?: string }) {
  const { c, dark } = useTheme(); const col = color && color.startsWith("#") ? color : c.accent;
  return <View testID={testID} style={{ backgroundColor: withAlpha(col, dark ? 0.15 : 0.08), paddingVertical: 11, paddingHorizontal: 13, borderRadius: radius.m }}>{typeof children === "string" ? <T v="small" style={{ fontSize: 13.5, lineHeight: 19 }}>{children}</T> : children}</View>;
}
export function Msg({ eyebrow, text, color, testID }: { eyebrow: string; text: string; color: string; testID?: string }) {
  const { c, dark } = useTheme(); const col = color.startsWith("#") ? color : "#888888";
  return (
    <View testID={testID} style={{ backgroundColor: withAlpha(col, dark ? 0.15 : 0.08), paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.tile, gap: 4 }}>
      <Row gap={7}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} /><Text style={{ flex: 1, fontSize: 12.5, fontWeight: "700", color: c.muted }}>{eyebrow}</Text></Row><T>{text}</T>
    </View>
  );
}
export function Empty({ text }: { text: string }) { return <Muted>{text}</Muted>; }
export function Bar({ value, color }: { value: number; color?: string }) {
  const { c } = useTheme(); const surf = useSurface();
  return <View style={{ height: 8, borderRadius: 99, backgroundColor: surf === "sunk" ? c.surface : c.sunk, overflow: "hidden" }}><View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", backgroundColor: color || c.accent, borderRadius: 99 }} /></View>;
}
export function Bullets({ items }: { items: string[] }) {
  const { c } = useTheme();
  return <Col gap={7}>{items.map((x, i) => <Row key={i} gap={10} align="flex-start"><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.faint, marginTop: 8 }} /><T style={{ flex: 1 }}>{x}</T></Row>)}</Col>;
}

// ---------- Avatar ----------
export function hue(id: string): number { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
export function Avatar({ id, first, last, url, size = 44, status }: { id: string; first: string; last?: string; url?: string | null; size?: number; status?: string | null }) {
  const { c } = useTheme();
  const ini = ((first || "?")[0] + ((last || "")[0] || "")).toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      {url ? <Image accessibilityLabel={first} source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue(id)}, 24%, 42%)`, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>{ini}</Text>
          </View>}
      {status && status !== "none" ? <View style={{ position: "absolute", right: -1, bottom: -1, width: Math.max(10, size * 0.3), height: Math.max(10, size * 0.3), borderRadius: size, backgroundColor: statusColor(c, status), borderWidth: 2, borderColor: c.surface }} /> : null}
    </View>
  );
}

// ---------- Meldung ----------
export function Toast({ text }: { text: string | null }) {
  const { c } = useTheme(); const ins = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: ins.bottom + 84, alignItems: "center" }}>
      <View accessibilityLiveRegion="polite" testID="toast" style={{ backgroundColor: c.ink, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.pill, maxWidth: 420, marginHorizontal: 16 }}>
        <Text style={{ color: c.bg, fontWeight: "600", fontSize: 14.5 }}>{text}</Text>
      </View>
    </View>
  );
}
