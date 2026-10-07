// Bausteine der Oberfläche. Alle Bildschirme setzen sich daraus zusammen.
import React, { createContext, useContext, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./icons";
import { font, radius, space, statusColor, useTheme, withAlpha } from "./theme";

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
export const Muted = ({ children, small, style }: { children?: React.ReactNode; small?: boolean; style?: StyleProp<TextStyle> }) => {
  const { c } = useTheme(); return <T v={small ? "small" : "body"} color={c.muted} style={style}>{children}</T>;
};

// ---------- Layout ----------
export function Row({ children, gap = space.s, wrap, between, align = "center", style, testID }: { children?: React.ReactNode; gap?: number; wrap?: boolean; between?: boolean; align?: ViewStyle["alignItems"]; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[{ flexDirection: "row", alignItems: align, gap }, wrap && { flexWrap: "wrap" }, between && { justifyContent: "space-between" }, style]}>{children}</View>;
}
export function Col({ children, gap = space.s, style, testID }: { children?: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[{ gap }, style]}>{children}</View>;
}
export function Screen({ children, scroll = true, testID }: { children?: React.ReactNode; scroll?: boolean; testID?: string }) {
  const { c } = useTheme(); const ins = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const pad = width >= 900 ? 28 : space.l;
  const inner = <View style={{ width: "100%", maxWidth: 1100, alignSelf: "center", gap: 18, paddingHorizontal: pad, paddingTop: ins.top + space.l, paddingBottom: space.xxl * 2 }}>{children}</View>;
  if (!scroll) return <View testID={testID} style={{ flex: 1, backgroundColor: c.bg }}>{inner}</View>;
  return <ScrollView testID={testID} style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled">{inner}</ScrollView>;
}
export function Header({ eyebrow, title, right, info, onBack, backLabel }: { eyebrow?: string; title: string; right?: React.ReactNode; info?: React.ReactNode; onBack?: () => void; backLabel?: string }) {
  return (
    <Col gap={6}>
      {onBack ? <Btn small kind="ghost" icon="back" label={backLabel || ""} onPress={onBack} style={{ alignSelf: "flex-start" }} /> : null}
      <Row between align="flex-end" wrap>
        <Col gap={4} style={{ flexShrink: 1 }}>
          {eyebrow ? <T v="eyebrow">{eyebrow}</T> : null}
          <Row gap={8}><T v="h1" style={{ flexShrink: 1 }}>{title}</T>{info}</Row>
        </Col>
        {right}
      </Row>
    </Col>
  );
}
export function Card({ children, style, testID, tone }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string; tone?: string }) {
  const { c } = useTheme();
  return <View testID={testID} style={[{ backgroundColor: tone ? withAlpha(tone, 0.1) : c.surface, borderWidth: 1, borderColor: tone ? withAlpha(tone, 0.35) : c.line, borderRadius: radius.l, padding: space.l, gap: space.m }, style]}>{children}</View>;
}
export function CardTitle({ title, info, right }: { title: string; info?: React.ReactNode; right?: React.ReactNode }) {
  return <Row between><Row gap={6} style={{ flexShrink: 1 }}><T v="h2" style={{ flexShrink: 1 }}>{title}</T>{info}</Row>{right}</Row>;
}
export const Divider = () => { const { c } = useTheme(); return <View style={{ height: 1, backgroundColor: c.line, marginVertical: 2 }} />; };

// ---------- Buttons & Auswahl ----------
export function Btn({ label, onPress, kind = "default", small, disabled, icon, testID, style, a11y }: { label: string; onPress?: () => void; kind?: "primary" | "default" | "danger" | "ghost"; small?: boolean; disabled?: boolean; icon?: IconName; testID?: string; style?: StyleProp<ViewStyle>; a11y?: string }) {
  const { c } = useTheme();
  const bg = kind === "primary" ? c.accent : kind === "danger" ? c.crit : kind === "ghost" ? "transparent" : c.surface;
  const fg = kind === "primary" ? c.accentInk : kind === "danger" ? "#fff" : kind === "ghost" ? c.accentTx : c.ink;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11y || label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: bg, borderWidth: kind === "ghost" ? 0 : 1, borderColor: kind === "default" ? c.line : bg, borderRadius: radius.m, paddingVertical: small ? 7 : 11, paddingHorizontal: small ? 11 : 16, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, minHeight: small ? 34 : 44 }, style]}>
      {icon ? <Icon name={icon} size={small ? 15 : 18} color={fg} /> : null}
      {label ? <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 13 : 15 }}>{label}</Text> : null}
    </Pressable>
  );
}
export function Seg<K extends string>({ options, value, onChange, testID, wrap }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testID?: string; wrap?: boolean }) {
  const { c } = useTheme();
  return (
    <View testID={testID} accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", backgroundColor: c.sunk, borderRadius: radius.m, padding: 3, gap: 2, alignSelf: "flex-start", maxWidth: "100%" }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} testID={testID ? testID + "-" + o.key : undefined} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.s, backgroundColor: on ? c.surface : "transparent", flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 13, color: on ? c.ink : c.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function ChoiceChips<K extends string>({ options, value, onChange, testID }: { options: { key: K; label: string }[]; value: K | null; onChange: (k: K) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Row wrap gap={6}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} testID={testID ? testID + "-" + o.key : undefined} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.key)}
            style={{ borderWidth: 1.5, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13 }}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: on ? c.accentInk : c.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}
export function Chip({ label, color, testID }: { label: string; color?: string; testID?: string }) {
  const { c } = useTheme(); const col = color || c.build;
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: withAlpha(col.startsWith("#") ? col : "#888888", 0.15), borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9, alignSelf: "flex-start" }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col }} />
      <Text style={{ color: col, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}
export const StatusChip = ({ status, label }: { status: string; label: string }) => { const { c } = useTheme(); return <Chip label={label} color={statusColor(c, status)} />; };
export function Tag({ label }: { label: string }) {
  const { c } = useTheme();
  return <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start" }}><Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, color: c.muted, textTransform: "uppercase" }}>{label}</Text></View>;
}
export function Pill({ label, color }: { label: string; color: string }) {
  return <View style={{ backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" }}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>{label}</Text></View>;
}

// ---------- Eingaben ----------
export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, secure, testID, hint, autoCapitalize, autoComplete, maxLength, style }: { label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; keyboardType?: "default" | "numeric" | "number-pad" | "decimal-pad" | "email-address" | "numbers-and-punctuation"; multiline?: boolean; secure?: boolean; testID?: string; hint?: string; autoCapitalize?: "none" | "sentences" | "words" | "characters"; autoComplete?: string; maxLength?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.muted }}>{label}</Text>
      <TextInput testID={testID} accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted}
        keyboardType={keyboardType} multiline={multiline} numberOfLines={multiline ? 4 : undefined} secureTextEntry={secure} autoCapitalize={autoCapitalize} autoComplete={autoComplete} maxLength={maxLength}
        style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.bg, color: c.ink, fontSize: 16, minHeight: multiline ? 96 : 44, textAlignVertical: multiline ? "top" : "center" }} />
      {hint ? <Text style={{ fontSize: 12, color: c.muted }}>{hint}</Text> : null}
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
export function Picker<K extends string>({ label, value, options, onChange, testID, style }: { label: string; value: K; options: { key: K; label: string }[]; onChange: (k: K) => void; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme(); const [open, setOpen] = useState(false);
  const cur = options.find(o => o.key === value);
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.muted }}>{label}</Text>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label + ": " + (cur?.label || "")} onPress={() => setOpen(true)}
        style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.bg, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={{ color: c.ink, fontSize: 16, flexShrink: 1 }}>{cur?.label || "–"}</Text>
        <Icon name="chevron" size={16} color={c.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map(o => (
          <Pressable key={o.key} testID={testID ? testID + "-opt-" + o.key : undefined} accessibilityRole="button" onPress={() => { setOpen(false); onChange(o.key); }}
            style={{ paddingVertical: 13, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: c.ink, fontSize: 16, fontWeight: o.key === value ? "700" : "400", flexShrink: 1 }}>{o.label}</Text>
            {o.key === value ? <Icon name="check" size={18} color={c.accentTx} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
export function ToggleRow({ label, desc, value, onChange, disabled, testID, badge }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; testID?: string; badge?: string }) {
  const { c } = useTheme();
  return (
    <Row gap={12} align="flex-start" style={{ opacity: disabled ? 0.55 : 1 }}>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.accent, false: c.line }} />
      <Col gap={2} style={{ flex: 1 }}>
        <Row gap={6} wrap><T bold>{label}</T>{badge ? <Tag label={badge} /> : null}</Row>
        {desc ? <Muted small>{desc}</Muted> : null}
      </Col>
    </Row>
  );
}
export function Check({ label, value, onChange, testID }: { label: React.ReactNode; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: value ? c.accent : c.line, backgroundColor: value ? c.accent : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {value ? <Icon name="check" size={15} color={c.accentInk} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof label === "string" ? <T>{label}</T> : label}</View>
    </Pressable>
  );
}

// ---------- Blätter (Dialoge) & Info ----------
export function Sheet({ visible, onClose, title, children, testID, closeLabel }: { visible: boolean; onClose: () => void; title?: string; children?: React.ReactNode; testID?: string; closeLabel?: string }) {
  const { c } = useTheme(); const { width, height } = useWindowDimensions(); const wide = width >= 700; const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={wide ? "fade" : "slide"} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: wide ? "center" : "flex-end", alignItems: "center", backgroundColor: c.overlay }}>
        <Pressable accessibilityLabel={closeLabel || "close"} onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View testID={testID} style={{ width: "100%", maxWidth: 600, maxHeight: height * 0.9, backgroundColor: c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderBottomLeftRadius: wide ? radius.xl : 0, borderBottomRightRadius: wide ? radius.xl : 0 }}>
          <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: space.l + ins.bottom, gap: space.m }} keyboardShouldPersistTaps="handled">
            {title ? <Row between align="flex-start"><T v="h2" style={{ flex: 1 }}>{title}</T><Pressable testID={testID ? testID + "-close" : "sheet-close"} accessibilityRole="button" accessibilityLabel={closeLabel || "close"} onPress={onClose} hitSlop={10}><Icon name="close" size={22} color={c.muted} /></Pressable></Row> : null}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
interface InfoState { title: string; body: React.ReactNode }
const InfoCtx = createContext<(i: InfoState) => void>(() => undefined);
/** Stellt die Info-Blätter bereit (einmal im Root-Layout). */
export function InfoHost({ children, closeLabel }: { children?: React.ReactNode; closeLabel: string }) {
  const [info, setInfo] = useState<InfoState | null>(null);
  return (
    <InfoCtx.Provider value={setInfo}>
      {children}
      <Sheet visible={!!info} onClose={() => setInfo(null)} title={info?.title} testID="info-sheet" closeLabel={closeLabel}>
        {typeof info?.body === "string" ? <T>{info.body}</T> : info?.body}
      </Sheet>
    </InfoCtx.Provider>
  );
}
/** Kleiner ⓘ-Knopf: Erklärungen nur bei Bedarf. */
export function Info({ title, text, children, testID }: { title: string; text?: string | string[]; children?: React.ReactNode; testID?: string }) {
  const { c } = useTheme(); const show = useContext(InfoCtx);
  const body = children || (Array.isArray(text) ? <Col gap={10}>{text.filter(Boolean).map((x, i) => <T key={i}>{x}</T>)}</Col> : text);
  return (
    <Pressable testID={testID || "info"} accessibilityRole="button" accessibilityLabel={"Info: " + title} onPress={() => show({ title, body })} hitSlop={8}
      style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: withAlpha(c.accentTx, 0.6), alignItems: "center", justifyContent: "center", backgroundColor: c.surface }}>
      <Text style={{ color: c.accentTx, fontStyle: "italic", fontWeight: "800", fontSize: 13, fontFamily: "Georgia" }}>i</Text>
    </Pressable>
  );
}

// ---------- Listen & Hinweise ----------
export function ListItem({ left, title, sub, right, onPress, testID, children }: { left?: React.ReactNode; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; children?: React.ReactNode }) {
  const { c } = useTheme();
  const body = (
    <Row gap={12} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
      {left}
      <Col gap={3} style={{ flex: 1 }}>
        <T bold numberOfLines={2}>{title}</T>
        {sub ? <Muted small>{sub}</Muted> : null}
        {children}
      </Col>
      {right}
    </Row>
  );
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>{body}</Pressable> : <View testID={testID}>{body}</View>;
}
export function Banner({ children, color, testID }: { children?: React.ReactNode; color?: string; testID?: string }) {
  const { c } = useTheme(); const col = color || c.accent;
  return <View testID={testID} style={{ borderLeftWidth: 3, borderLeftColor: col, backgroundColor: withAlpha(col, 0.08), paddingVertical: 8, paddingHorizontal: 12, borderTopRightRadius: radius.s, borderBottomRightRadius: radius.s }}>{typeof children === "string" ? <T v="small">{children}</T> : children}</View>;
}
export function Msg({ eyebrow, text, color, testID }: { eyebrow: string; text: string; color: string; testID?: string }) {
  return (
    <View testID={testID} style={{ borderLeftWidth: 4, borderLeftColor: color, backgroundColor: withAlpha(color, 0.09), paddingVertical: 10, paddingHorizontal: 12, borderTopRightRadius: radius.m, borderBottomRightRadius: radius.m, gap: 4 }}>
      <T v="eyebrow">{eyebrow}</T><T>{text}</T>
    </View>
  );
}
export function Empty({ text }: { text: string }) { return <Muted>{text}</Muted>; }
export function Bar({ value, color }: { value: number; color?: string }) {
  const { c } = useTheme();
  return <View style={{ height: 8, borderRadius: 99, backgroundColor: c.sunk, overflow: "hidden" }}><View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", backgroundColor: color || c.accent, borderRadius: 99 }} /></View>;
}
export function Bullets({ items }: { items: string[] }) {
  const { c } = useTheme();
  return <Col gap={6}>{items.map((x, i) => <Row key={i} gap={8} align="flex-start"><Text style={{ color: c.accentTx, fontSize: 15, lineHeight: 21 }}>•</Text><T style={{ flex: 1 }}>{x}</T></Row>)}</Col>;
}

// ---------- Avatar ----------
export function hue(id: string): number { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
export function Avatar({ id, first, last, url, size = 44, status }: { id: string; first: string; last?: string; url?: string | null; size?: number; status?: string | null }) {
  const { c } = useTheme();
  const ini = ((first || "?")[0] + ((last || "")[0] || "")).toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      {url ? <Image accessibilityLabel={first} source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue(id)}, 42%, 42%)`, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.36 }}>{ini}</Text>
          </View>}
      {status && status !== "none" ? <View style={{ position: "absolute", right: -1, bottom: -1, width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: statusColor(c, status), borderWidth: 2, borderColor: c.surface }} /> : null}
    </View>
  );
}

// ---------- Meldung ----------
export function Toast({ text }: { text: string | null }) {
  const { c } = useTheme(); const ins = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: ins.bottom + 84, alignItems: "center" }}>
      <View accessibilityLiveRegion="polite" testID="toast" style={{ backgroundColor: c.ink, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.m, maxWidth: 420, marginHorizontal: 16 }}>
        <Text style={{ color: c.bg, fontWeight: "700" }}>{text}</Text>
      </View>
    </View>
  );
}
