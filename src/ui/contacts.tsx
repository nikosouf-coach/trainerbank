// Kontaktliste: nach Rollen gruppiert, Anrufen/E-Mail, Bearbeiten (Trainerteam).
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { Contact, ContactRole } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Btn, Card, Col, Field, Muted, Picker, Row, Sheet, T, ToggleRow } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

export const CONTACT_ROLES: ContactRole[] = ["trainer", "koordinator", "vorstand", "physio", "arzt", "betreuer", "sonst"];
const ROLE_COL: Record<ContactRole, string> = { trainer: "#3a6db5", koordinator: "#7b5fd0", vorstand: "#5c6b7a", physio: "#16a3a3", arzt: "#d6336c", betreuer: "#f0762b", sonst: "#2f9e44" };
const initials = (n: string): string => n.replace(/^(Dr\.|Prof\.)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase() || "").join("");
const open = (url: string): void => { Linking.openURL(url).catch(() => undefined); };

/** Ein Kontakt mit Anruf- und E-Mail-Knopf. */
export function ContactRow({ x, onPress, staff }: { x: Contact; onPress?: () => void; staff?: boolean }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const col = ROLE_COL[x.role];
  return (
    <View testID={"ct-" + x.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line }}>
      <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={{ flexDirection: "row", gap: 12, flex: 1 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(col, 0.16), alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: col, fontWeight: "800", fontSize: 14 }}>{initials(x.name)}</Text>
        </View>
        <Col gap={2} style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 15, color: c.ink }}>{x.name}</Text>
          {x.org ? <Text style={{ fontSize: 13, color: c.muted }}>{x.org}</Text> : null}
          {x.phone ? <Text selectable style={{ fontSize: 13, color: c.ink, fontVariant: ["tabular-nums"] }}>{x.phone}</Text> : null}
          {x.email ? <Text selectable style={{ fontSize: 13, color: c.ink }}>{x.email}</Text> : null}
          {x.address ? <Text selectable style={{ fontSize: 13, color: c.muted }}>{x.address}</Text> : null}
          {x.note ? <Text style={{ fontSize: 12.5, color: c.muted, fontStyle: "italic" }}>{x.note}</Text> : null}
          {staff && !x.vis ? <Text style={{ fontSize: 11.5, fontWeight: "700", color: c.warn }}>{t("ct_hidden")}</Text> : null}
        </Col>
      </Pressable>
      <Col gap={6}>
        {x.phone ? <Pressable testID={"ct-call-" + x.id} accessibilityRole="button" accessibilityLabel={t("ct_call") + " " + x.name} onPress={() => open("tel:" + x.phone.replace(/[^\d+]/g, ""))}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.ok, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 16 }}>✆</Text></Pressable> : null}
        {x.email ? <Pressable testID={"ct-mail-" + x.id} accessibilityRole="button" accessibilityLabel={t("ct_mail") + " " + x.name} onPress={() => open("mailto:" + x.email)}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentInk, fontSize: 15, fontWeight: "800" }}>@</Text></Pressable> : null}
      </Col>
    </View>
  );
}

/** Kontakte nach Rollen gruppiert. */
export function ContactGroups({ list, onEdit, staff }: { list: Contact[]; onEdit?: (x: Contact) => void; staff?: boolean }) {
  const E = useEngine(); const { t } = E;
  return <>{CONTACT_ROLES.map(r => {
    const L = list.filter(x => x.role === r).sort((a, b) => a.name.localeCompare(b.name));
    if (!L.length) return null;
    return (
      <Card key={r} testID={"ct-group-" + r} style={{ gap: 0 }}>
        <T v="eyebrow" color={ROLE_COL[r]}>{t("ct_r_" + r)}</T>
        {L.map(x => <ContactRow key={x.id} x={x} staff={staff} onPress={onEdit ? () => onEdit(x) : undefined} />)}
      </Card>
    );
  })}</>;
}

/** Kontakt anlegen oder bearbeiten. */
export function ContactSheet({ x, onClose }: { x: Contact | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [v, setV] = useState<Contact | null>(null), [key, setKey] = useState<string | null>(null);
  if ((x?.id || null) !== key) { setKey(x?.id || null); setV(x ? { ...x } : null); }
  const set = (p: Partial<Contact>) => setV(o => o ? { ...o, ...p } : o);
  const isNew = !!x && x.id.startsWith("tmp-");
  return (
    <Sheet visible={!!x} onClose={onClose} title={isNew ? t("ct_new") : t("ct_edit")} testID="ct-sheet" closeLabel={t("cancel")}>
      {v ? <>
        <Field testID="ct-name" label={t("ct_name")} value={v.name} onChangeText={n => set({ name: n })} maxLength={120} />
        <Picker testID="ct-role" label={t("ct_role")} value={v.role} options={CONTACT_ROLES.map(r => ({ key: r, label: t("ct_r_" + r) }))} onChange={r => set({ role: r })} />
        <Field testID="ct-org" label={t("ct_org")} value={v.org} onChangeText={o => set({ org: o })} maxLength={160} />
        <Row gap={10} wrap>
          <Field testID="ct-phone" label={t("ct_phone")} value={v.phone} onChangeText={p => set({ phone: p })} keyboardType="phone-pad" maxLength={40} style={{ flex: 1, minWidth: 150 }} />
          <Field testID="ct-email" label={t("ct_email")} value={v.email} onChangeText={m => set({ email: m.trim() })} keyboardType="email-address" autoCapitalize="none" maxLength={200} style={{ flex: 1, minWidth: 180 }} />
        </Row>
        <Field testID="ct-address" label={t("ct_address")} value={v.address} onChangeText={a => set({ address: a })} maxLength={300} />
        <Field testID="ct-note" label={t("ct_note")} value={v.note} onChangeText={n => set({ note: n })} multiline maxLength={1000} />
        <ToggleRow testID="ct-vis" label={t("ct_vis")} desc={t("ct_visD")} value={v.vis} onChange={b => set({ vis: b })} />
        <Row gap={10} wrap>
          <Btn testID="ct-save" kind="primary" label={t("save")} disabled={!v.name.trim()} onPress={() => { s.saveContact({ ...v, name: v.name.trim() }).then(() => s.toast(t("ct_saved"))); onClose(); }} />
          {!isNew ? <Btn testID="ct-del" kind="ghost" label={t("ct_del")} onPress={() => { s.deleteContact(v.id).then(() => s.toast(t("ct_deleted"))); onClose(); }} /> : null}
        </Row>
        <Muted small>{t("ct_emergency")}</Muted>
      </> : null}
    </Sheet>
  );
}

export const newContact = (): Contact => ({ id: tmpId(), name: "", role: "koordinator", org: "", phone: "", email: "", address: "", note: "", vis: true });

/** Notruf-Hinweis (immer sichtbar). */
export function EmergencyNote() {
  const E = useEngine(); const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: withAlpha(c.crit, 0.1), borderRadius: radius.m, padding: 10 }}>
      <Icon name="info" size={18} color={c.crit} />
      <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: c.ink }}>{E.t("ct_emergency")}</Text>
    </View>
  );
}
