// Notfallkontakte – Oberfläche: Eingabe (Beitreten, Spieler, Trainerteam), Anzeige mit Anrufen, Hinweis „fehlt“ auf
// der Startseite des Spielers, Abschnitt im Spielerprofil. Die Übersicht fürs Trainerteam liegt unter
// app/coach/(tabs)/notfall.tsx. Regeln und Prüfung: core/emergency (dieselben Grenzen prüft die Datenbank).
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { EM_LIMITS, EM_RELS, checkContacts, hasEmergency, needsEmergency, telHref } from "../core/emergency";
import type { EmContact, EmRel, Player } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Btn, Card, ChoiceChips, Col, Field, ListItem, Muted, Row, Section, Sheet, T } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

/** Kontakt im Formular (noch ungeprüft) */
export interface EmDraft { name: string; rel: EmRel; phone: string }
const blank = (rel: EmRel = "mother"): EmDraft => ({ name: "", rel, phone: "" });
/** Gespeicherte Kontakte als Formular (leer: ein leerer Kontakt) */
export const toDraft = (L: EmContact[]): EmDraft[] => L.length ? L.map(c => ({ ...c })) : [blank()];
/** Fehlertext zu checkContacts */
export function draftError(tf: (k: string, o: Record<string, string | number>) => string, L: EmDraft[]): { error: string } | { contacts: EmContact[] } {
  const r = checkContacts(L);
  return "error" in r ? { error: tf(r.error, { n: r.n }) } : r;
}

/** Eingabe: ein oder zwei Kontakte (Name, Beziehung, Telefonnummer) */
export function EmergencyFields({ value, onChange, testID = "nf" }: { value: EmDraft[]; onChange: (v: EmDraft[]) => void; testID?: string }) {
  // ohne useEngine: auch beim Beitreten nutzbar (noch kein Team geladen)
  const { t, tf } = useStore().tr; const { c } = useTheme();
  const set = (i: number, patch: Partial<EmDraft>) => onChange(value.map((x, j) => j === i ? { ...x, ...patch } : x));
  const two = value.length > 1;
  return (
    <Col gap={14}>
      {value.map((x, i) => (
        <View key={i} testID={`${testID}-c${i}`} style={two ? { gap: 10, borderWidth: 1, borderColor: c.line, borderRadius: radius.m, padding: 12 } : { gap: 10 }}>
          {two ? (
            <Row between gap={8}>
              <T v="eyebrow">{tf("nf_contactN", { n: i + 1 })}</T>
              <Btn small kind="ghost" icon="close" testID={`${testID}-rm${i}`} label={tf("nf_remove", { n: i + 1 })} onPress={() => onChange(value.filter((_, j) => j !== i))} />
            </Row>
          ) : null}
          <Field testID={`${testID}-name${i}`} label={t("nf_name")} placeholder={t("nf_namePh")} value={x.name} onChangeText={v => set(i, { name: v })} maxLength={EM_LIMITS.name} autoCapitalize="words" autoComplete="name" />
          <Col gap={6}>
            <T v="small" bold color={c.muted}>{t("nf_rel")}</T>
            <ChoiceChips testID={`${testID}-rel${i}`} value={x.rel} onChange={k => set(i, { rel: k })} options={EM_RELS.map(k => ({ key: k, label: t("nf_rel_" + k) }))} />
          </Col>
          <Field testID={`${testID}-phone${i}`} label={t("nf_phone")} placeholder={t("nf_phonePh")} value={x.phone} onChangeText={v => set(i, { phone: v })} maxLength={EM_LIMITS.phone} keyboardType="phone-pad" autoComplete="tel" />
        </View>
      ))}
      {value.length < EM_LIMITS.contacts
        ? <Btn small kind="ghost" icon="plus" testID={`${testID}-add`} label={t("nf_add")} onPress={() => onChange([...value, blank(value[0]?.rel === "mother" ? "father" : "mother")])} style={{ alignSelf: "flex-start" }} />
        : null}
    </Col>
  );
}

/** Hinweise für den Notfall (Gesundheitsdaten, freiwillig) */
export function MedField({ value, onChange, testID = "nf-med" }: { value: string; onChange: (v: string) => void; testID?: string }) {
  const { t } = useStore().tr;
  return (
    <Col gap={4}>
      <Field testID={testID} label={t("nf_med")} placeholder={t("nf_medPh")} value={value} onChangeText={onChange} multiline maxLength={EM_LIMITS.med} />
      <Muted small>{t("nf_medD")}</Muted>
    </Col>
  );
}

/** Anrufen – in der Demo nur ein Hinweis (die Nummern sind erfunden) */
function useCall(): (phone: string) => void {
  const s = useStore();
  return phone => {
    if (s.isDemo) { s.toast(s.tr.t("nf_callDemo")); return; }
    Linking.openURL(telHref(phone)).catch(() => undefined);
  };
}

/** Kontakte mit Knopf zum Anrufen; Hinweis für den Notfall hervorgehoben (nur mit showMed) */
export function EmergencyView({ pid, showMed }: { pid: string; showMed: boolean }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const call = useCall();
  const L = E.D.emergency[pid] || [], med = showMed ? E.D.emergencyMed[pid] || "" : "";
  return (
    <Col gap={10}>
      {L.map((x, i) => (
        <Row key={i} gap={12} testID={`nf-show-${pid}-${i}`}>
          <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
            <T bold>{x.name}</T>
            <Text selectable style={{ fontSize: 13.5, color: c.muted, fontVariant: ["tabular-nums"] }}>{`${t("nf_rel_" + x.rel)} · ${x.phone}`}</Text>
          </Col>
          <Pressable testID={`nf-call-${pid}-${i}`} accessibilityRole="button" accessibilityLabel={tf("nf_call", { n: x.name })} onPress={() => call(x.phone)} hitSlop={6}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: c.ok, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 })}>
            <Icon name="phone" size={19} color="#fff" strokeWidth={2.2} />
          </Pressable>
        </Row>
      ))}
      {med ? (
        <View testID={`nf-med-${pid}`} style={{ backgroundColor: withAlpha(c.crit, 0.09), borderRadius: radius.m, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
          <T v="small" bold color={c.crit}>{t("nf_medT")}</T>
          <T v="small">{med}</T>
        </View>
      ) : null}
    </Col>
  );
}

/**
 * Notfallkontakt bearbeiten. Spieler: eigene Kontakte und Hinweise. Trainerteam: Kontakte mit Recht „Kader“, Hinweise
 * mit „Gesundheitsdaten“ (ohne „Kader“ sind die Kontakte nur zu sehen).
 */
export function EmergencySheet({ pid, onClose }: { pid: string | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const staff = s.viewAs === "coach";
  const canContacts = !staff || s.can("squad"), canMed = !staff || s.can("health");
  const [draft, setDraft] = useState<EmDraft[]>([blank()]);
  const [med, setMed] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pid) return;
    setDraft(toDraft(E.D.emergency[pid] || [])); setMed(E.D.emergencyMed[pid] || ""); setErr(""); setBusy(false);
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = pid ? E.P(pid) : null;
  const save = async () => {
    if (!pid) return;
    let contacts: EmContact[] | null = null;
    if (canContacts) {
      const r = draftError(tf, draft);
      if ("error" in r) { setErr(r.error); return; }
      contacts = r.contacts;
    }
    setBusy(true);
    try {
      // nicht gespeichert (Hinweis kam schon): Blatt bleibt offen, die Eingaben gehen nicht verloren
      if (contacts && (await s.saveEmergency(pid, contacts)) === false) return;
      if (canMed && med.trim() !== (E.D.emergencyMed[pid] || "").trim() && (await s.saveEmergencyMed(pid, med)) === false) return;
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!pid} onClose={onClose} title={staff && p ? `${t("nf_editT")} · ${E.name(p)}` : t("nf_editT")} testID="nf-sheet" closeLabel={t("um_cancel")}>
      {pid ? (
        <>
          {canContacts ? <EmergencyFields value={draft} onChange={v => { setDraft(v); setErr(""); }} /> : <EmergencyView pid={pid} showMed={false} />}
          {!staff ? <Muted small>{t("nf_tell")}</Muted> : null}
          {canMed ? <MedField value={med} onChange={setMed} /> : null}
          {err ? <Banner color={c.crit} testID="nf-err">{err}</Banner> : null}
          <Row gap={10} wrap>
            <Btn kind="primary" testID="nf-save" label={t("save")} disabled={busy} onPress={save} />
            <Btn kind="ghost" testID="nf-cancel" label={t("um_cancel")} onPress={onClose} />
          </Row>
        </>
      ) : null}
    </Sheet>
  );
}

/** Startseite des Spielers: Hinweis, solange der Notfallkontakt fehlt (lässt sich nicht wegklicken) */
export function PlayerEmergencyCard() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pid = s.mePid || "";
  const [open, setOpen] = useState(false);
  const sheet = <EmergencySheet pid={open ? pid : null} onClose={() => setOpen(false)} />;
  if (!pid || !needsEmergency(E.D, pid)) return sheet;
  return (
    <Card testID="nf-prompt" style={{ borderWidth: 1.5, borderColor: c.crit }}>
      <Row gap={12} align="flex-start">
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(c.crit, 0.12), alignItems: "center", justifyContent: "center" }}>
          <Icon name="phone" size={20} color={c.crit} strokeWidth={2.2} />
        </View>
        <Col gap={4} style={{ flex: 1, minWidth: 0 }}>
          <T bold>{t("nf_missingT")}</T>
          <Muted small>{t("nf_missingD")}</Muted>
        </Col>
      </Row>
      <Btn kind="primary" testID="nf-prompt-go" label={t("nf_enter")} onPress={() => setOpen(true)} style={{ alignSelf: "flex-start" }} />
      {sheet}
    </Card>
  );
}

/** Spieler – Ich: eigener Notfallkontakt (Namen oder „fehlt“), öffnet die Bearbeitung */
export function MyEmergencyItem() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pid = s.mePid || "";
  const [open, setOpen] = useState(false);
  if (!pid) return null;
  const L = E.D.emergency[pid] || [], missing = needsEmergency(E.D, pid);
  return (
    <>
      <ListItem testID="me-notfall" title={t("nf_my")} sub={L.length ? L.map(x => `${x.name} (${t("nf_rel_" + x.rel)})`).join(", ") : undefined}
        right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => setOpen(true)}>
        {missing ? <Text style={{ fontSize: 13, fontWeight: "700", color: c.crit }}>{t("nf_myMissing")}</Text> : null}
      </ListItem>
      <EmergencySheet pid={open ? pid : null} onClose={() => setOpen(false)} />
    </>
  );
}

/** Spielerprofil (Trainerteam): Notfallkontakt mit Anrufen, „fehlt“ und Bearbeiten – nur mit „Kader“ oder „Gesundheitsdaten“ */
export function EmergencySection({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const [edit, setEdit] = useState(false);
  if (!s.can("squad") && !s.can("health")) return null;
  const has = hasEmergency(E.D, p.id), med = s.can("health") && !!E.D.emergencyMed[p.id];
  return (
    <Section title={t("nf_my")} testID="profile-emergency" action={{ label: t("nf_allLink"), onPress: () => router.push("/coach/notfall"), testID: "profile-emergency-all" }}>
      <Card>
        {has || med ? <EmergencyView pid={p.id} showMed={s.can("health")} /> : null}
        {!has && E.D.emergencyOk ? <Text style={{ color: c.crit, fontWeight: "700", fontSize: 14 }}>{t("nf_none")}</Text> : null}
        <Btn small kind="ghost" icon="pen" testID="profile-emergency-edit" label={has ? t("edit") : t("nf_enterCoach")} onPress={() => setEdit(true)} style={{ alignSelf: "flex-start" }} />
      </Card>
      <EmergencySheet pid={edit ? p.id : null} onClose={() => setEdit(false)} />
    </Section>
  );
}
