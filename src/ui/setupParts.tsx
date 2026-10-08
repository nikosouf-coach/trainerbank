// Bausteine der Einrichtung, die auch in den Einstellungen wiederverwendet werden:
// Trainerprofil, Team (Logo, Farbe), Erinnerungen, Testbatterie, Trainerteam, Zusammenfassung.
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { classDef, classLabel, PACKAGES, PLAYER_VIEW, teamLabel } from "../core/classes";
import type { Translator } from "../core/i18n";
import { testsFor } from "../core/perf";
import type { ClassKey, Depth, Group, Modules, PlayerViewKey, Reminders, StaffRoleKey, TeamSettings, TestKey } from "../core/types";
import { ROLES } from "./archive";
import { Icon } from "./icons";
import { Btn, ChoiceChips, Col, DateField, Field, Muted, Picker, Row, Seg, T, TimeField, ToggleRow } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

/** Vereinsfarben zur Auswahl */
export const COLORS = ["#0b3d91", "#1d4ed8", "#0f766e", "#15803d", "#b91c1c", "#9f1239", "#c2410c", "#a16207", "#6d28d9", "#111827"];
/** Trainerlizenzen (DFB/UEFA) – Schlüssel für lic_<key> */
export const LICENSES = ["none", "kinder", "c", "b", "bplus", "a", "pro", "tw", "athletik", "other"];

/** Bild aus der Mediathek wählen (quadratisch zugeschnitten); null bei Abbruch. */
export async function pickSquareImage(): Promise<string | null> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    return r.canceled || !r.assets?.length ? null : r.assets[0].uri;
  } catch { return null; }
}

/** Rundes Bild mit Platzhalter – zum Antippen (Foto/Logo wählen). */
export function ImageSlot({ uri, label, onPick, onClear, size = 84, testID, round = true, icon = "camera" }: {
  uri: string | null | undefined; label: string; onPick: (uri: string) => void; onClear?: () => void; size?: number; testID?: string; round?: boolean; icon?: "camera" | "person";
}) {
  const { c } = useTheme();
  return (
    <Col gap={6} style={{ alignItems: "center", width: Math.max(size, 96) }}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={async () => { const u = await pickSquareImage(); if (u) onPick(u); }}
        style={{ width: size, height: size, borderRadius: round ? size / 2 : radius.l, overflow: "hidden", borderWidth: 2, borderStyle: uri ? "solid" : "dashed", borderColor: uri ? c.accent : c.line, backgroundColor: c.sunk, alignItems: "center", justifyContent: "center" }}>
        {uri ? <Image source={{ uri }} style={{ width: size, height: size }} /> : <Icon name={icon} size={size * 0.34} color={c.muted} />}
      </Pressable>
      <Text style={{ fontSize: 12, fontWeight: "700", color: c.accentTx, textAlign: "center" }}>{label}</Text>
      {uri && onClear ? <Pressable accessibilityRole="button" onPress={onClear}><Text style={{ fontSize: 12, color: c.muted }}>✕</Text></Pressable> : null}
    </Col>
  );
}

export interface ProfileDraft { vn: string; nn: string; role: StaffRoleKey; license: string; birth: string | null; phone: string; photo: string | null }
export const emptyProfile = (): ProfileDraft => ({ vn: "", nn: "", role: "chef", license: "none", birth: null, phone: "", photo: null });
export const profileName = (p: ProfileDraft): string => `${p.vn.trim()} ${p.nn.trim()}`.trim();

/** Trainerprofil: Name, Rolle, Lizenz, Geburtsdatum, Telefon, Foto. */
export function ProfileFields({ value, onChange, tr, required }: { value: ProfileDraft; onChange: (p: ProfileDraft) => void; tr: Translator; required?: boolean }) {
  const { t } = tr; const { c } = useTheme();
  const set = (p: Partial<ProfileDraft>) => onChange({ ...value, ...p });
  const req = required ? " *" : "";
  return (
    <Col gap={12}>
      <Row gap={14} align="flex-start" wrap>
        <ImageSlot testID="pf-photo" uri={value.photo} label={t("pf_photo")} onPick={u => set({ photo: u })} onClear={() => set({ photo: null })} icon="person" />
        <Col gap={10} style={{ flex: 1, minWidth: 200 }}>
          <Field testID="pf-vn" label={t("po_vn") + req} value={value.vn} onChangeText={v => set({ vn: v })} autoComplete="given-name" maxLength={60} />
          <Field testID="pf-nn" label={t("po_nn") + req} value={value.nn} onChangeText={v => set({ nn: v })} autoComplete="family-name" maxLength={60} />
        </Col>
      </Row>
      <Col gap={6}><T v="small" bold color={c.muted}>{t("pf_role")}</T>
        <ChoiceChips testID="pf-role" value={value.role} onChange={r => set({ role: r })} options={ROLES.map(r => ({ key: r, label: t("sr_" + r) }))} /></Col>
      <Picker testID="pf-license" label={t("pf_license")} value={value.license} options={LICENSES.map(k => ({ key: k, label: t("lic_" + k) }))} onChange={k => set({ license: k })} />
      <Row gap={10} wrap>
        <DateField testID="pf-birth" label={t("pf_birth")} value={value.birth} onChange={d => set({ birth: d })} lang={tr.lang} style={{ flex: 1, minWidth: 150 }} />
        <Field testID="pf-phone" label={t("pf_phone")} value={value.phone} onChangeText={v => set({ phone: v })} keyboardType="phone-pad" maxLength={40} style={{ flex: 1, minWidth: 150 }} />
      </Row>
      <Muted small>{t("pf_privacy")}</Muted>
    </Col>
  );
}

/** Vereinsfarbe wählen. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { c } = useTheme();
  return (
    <Row wrap gap={8}>
      {COLORS.map(col => (
        <Pressable key={col} testID={"color-" + col.slice(1)} accessibilityRole="radio" accessibilityState={{ checked: value === col }} accessibilityLabel={col} onPress={() => onChange(col)}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: col, alignItems: "center", justifyContent: "center", borderWidth: value === col ? 3 : 0, borderColor: c.ink }}>
          {value === col ? <Icon name="check" size={17} color="#fff" strokeWidth={3} /> : null}
        </Pressable>
      ))}
    </Row>
  );
}

/** Kopfzeile mit Vereinslogo (oder Farbkreis mit Initialen) und Teamname. */
export function TeamBadge({ logo, club, name, accent, size = 44 }: { logo: string | null | undefined; club: string; name: string; accent: string; size?: number }) {
  const label = teamLabel({ club, name }), init = (club || name).split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join("") || "T";
  return logo
    ? <Image source={{ uri: logo }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#fff" }} accessibilityLabel={label} />
    : <View accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.36 }}>{init}</Text>
      </View>;
}

/** Push-Erinnerungen (Morgen-Check, RPE, Pausenprogramm). */
export function ReminderFields({ value, onChange, tr, load, prep }: { value: Reminders; onChange: (r: Reminders) => void; tr: Translator; load: boolean; prep: boolean }) {
  const { t, tf } = tr; const set = (p: Partial<Reminders>) => onChange({ ...value, ...p });
  return (
    <Col gap={14}>
      <ToggleRow testID="rm-well" label={t("rm_well")} desc={load ? t("rm_wellD") : tf("rm_needs", { m: t("pk_belastung") })} value={load && value.well !== false} disabled={!load} onChange={v => set({ well: v })} />
      {load && value.well !== false ? <TimeField testID="rm-wellAt" label={t("rm_wellAt")} value={value.wellAt || "08:00"} onChange={v => set({ wellAt: v })} style={{ width: 120, marginLeft: 62 }} /> : null}
      <ToggleRow testID="rm-rpe" label={t("rm_rpe")} desc={load ? t("rm_rpeD") : tf("rm_needs", { m: t("pk_belastung") })} value={load && value.rpe !== false} disabled={!load} onChange={v => set({ rpe: v })} />
      {load && value.rpe !== false ? <Row gap={10} wrap style={{ marginLeft: 62 }}>
        <Muted small>{t("rm_rpeDelay")}</Muted>
        <Seg testID="rm-delay" value={String(value.rpeDelay ?? 30)} onChange={v => set({ rpeDelay: Number(v) })} options={["30", "60", "90"].map(k => ({ key: k, label: tf("rm_min", { m: k }) }))} />
      </Row> : null}
      {prep ? <ToggleRow testID="rm-program" label={t("rm_program")} desc={t("rm_programD")} value={value.program !== false} onChange={v => set({ program: v })} /> : null}
    </Col>
  );
}

/** Testbatterie: welche Leistungstests das Team nutzt. */
export function TestPicker({ value, onChange, grp, tr }: { value: TestKey[] | undefined; onChange: (v: TestKey[]) => void; grp: Group; tr: Translator }) {
  const { t } = tr; const all = testsFor(grp).map(x => x.key), cur = value && value.length ? value : all;
  return (
    <Col gap={10}>
      {all.map(k => <ToggleRow key={k} testID={"tb-" + k} label={t("ts_" + k)} desc={t("tsd_" + k)} value={cur.includes(k)}
        onChange={v => { const n = v ? [...cur, k] : cur.filter(x => x !== k); if (n.length) onChange(all.filter(x => n.includes(x))); }} />)}
    </Col>
  );
}

/** Was Spieler in ihrer App sehen (nur für eingeschaltete Module). */
export function PlayerViewFields({ settings, modules, onChange, tr }: { settings: TeamSettings; modules: Modules; onChange: (s: TeamSettings) => void; tr: Translator }) {
  const { t } = tr; const pv = settings.playerView || {};
  return (
    <Col gap={12}>
      <ToggleRow testID="pv-abs" label={t("pabs_t")} desc={t("pabs_d")} value={settings.playerAbs ?? true} onChange={v => onChange({ ...settings, playerAbs: v })} />
      {PLAYER_VIEW.filter(x => !x.needs || modules[x.needs]).map(x => (
        <ToggleRow key={x.key} testID={"pv-" + x.key} label={t("pv_" + x.key)} value={pv[x.key] ?? x.def}
          onChange={v => onChange({ ...settings, playerView: { ...pv, [x.key as PlayerViewKey]: v } })} />
      ))}
    </Col>
  );
}

/** Weitere Trainer schnell anlegen (Name + Rolle). */
export function StaffQuickAdd({ value, onChange, tr }: { value: { name: string; role: StaffRoleKey }[]; onChange: (v: { name: string; role: StaffRoleKey }[]) => void; tr: Translator }) {
  const { t } = tr; const { c } = useTheme();
  return (
    <Col gap={10}>
      {value.map((x, i) => (
        <View key={i} style={{ gap: 8, padding: 10, borderRadius: radius.m, borderWidth: 1, borderColor: c.line }}>
          <Row gap={8}>
            <Field testID={"sq-name-" + i} label={t("sf_name")} value={x.name} onChangeText={n => onChange(value.map((y, j) => j === i ? { ...y, name: n } : y))} style={{ flex: 1 }} maxLength={120} />
            <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => onChange(value.filter((_, j) => j !== i))} />
          </Row>
          <ChoiceChips testID={"sq-role-" + i} value={x.role} onChange={r => onChange(value.map((y, j) => j === i ? { ...y, role: r } : y))} options={ROLES.filter(r => r !== "chef").map(r => ({ key: r, label: t("sr_" + r) }))} />
        </View>
      ))}
      <Btn small testID="sq-add" icon="plus" label={t("su_addStaff")} onPress={() => onChange([...value, { name: "", role: "co" }])} style={{ alignSelf: "flex-start" }} />
    </Col>
  );
}

/** Zusammenfassung der Einrichtung. */
export function SetupOverview({ tr, me, club, team, cls, depth, modules, settings, info }: {
  tr: Translator; me: ProfileDraft; club: string; team: string; cls: ClassKey; depth: Depth; modules: Modules; settings: TeamSettings; info: boolean;
}) {
  const { t } = tr; const { c } = useTheme(); const wd = tr.tl("wd");
  const days = Object.keys(settings.days).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map(d => `${wd[d]} ${settings.days[d].zeit} (${settings.days[d].dauer || settings.dauer}′)`).join(" · ") || "–";
  const mods = PACKAGES.flatMap(pk => pk.mods).filter(k => modules[k]).map(k => t("m_" + k));
  const row = (k: string, v: string) => <Row between align="flex-start" gap={10}><Muted>{k}</Muted><T bold style={{ flex: 1, textAlign: "right" }}>{v}</T></Row>;
  return (
    <Col gap={10}>
      {row(t("su_meT"), [profileName(me) || "–", t("sr_" + me.role)].join(" · "))}
      {row(t("team"), teamLabel({ club, name: team }) || "–")}
      {row(t("ageClass"), classLabel(classDef(cls), tr.lang))}
      {row(t("su_preset"), t("dp_" + depth))}
      {row(t("su_daysT"), days)}
      {row(t("su_info"), info ? t("cs_active") : t("cs_inactive"))}
      <View style={{ height: 1, backgroundColor: c.line }} />
      <T v="small" bold color={c.muted}>{t("su_mods")} ({mods.length})</T>
      <Row wrap gap={6}>{mods.map(m => <View key={m} style={{ backgroundColor: withAlpha(c.accentTx, 0.1), borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: c.accentTx }}>{m}</Text></View>)}</Row>
    </Col>
  );
}
