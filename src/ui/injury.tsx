// Verletzungen & Befunde: aktuelle Verletzung mit Stufe, Befunde (Foto/PDF) hochladen, ansehen, mit KI auswerten.
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from "react-native";
import { ApiError } from "../data/api";
import type { Finding, Player } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { RehaPlanView } from "./reha";
import { Markdown, aiErrText } from "./ai";
import { Icon } from "./icons";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Col, DateField, Field, Info, Muted, Picker, Row, Sheet, T } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

/** Aktuelle bzw. letzte Verletzung eines Spielers (Abwesenheit „verletzung“). */
export function currentInjury(E: ReturnType<typeof useEngine>, pid: string) {
  return E.D.absences.filter(a => a.pid === pid && a.typ === "verletzung").sort((a, b) => a.von < b.von ? 1 : -1)[0] || null;
}

/** Signierte URL einer Befunddatei laden. */
function useFindingUrl(f: Finding | null): string | null {
  const s = useStore(); const [u, setU] = useState<string | null>(null);
  useEffect(() => { let live = true; setU(null); if (f) s.api.findingUrl(f.path).then(x => { if (live) setU(x); }).catch(() => undefined); return () => { live = false; }; }, [f?.path]); // eslint-disable-line react-hooks/exhaustive-deps
  return u;
}

/** Karte im Spielerprofil (Trainer). */
export function InjuryCard({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState<Finding | null>(null);
  const inj = currentInjury(E, p.id), active = inj && (!inj.bis || inj.bis >= E.TODAY);
  const list = E.D.findings.filter(f => f.pid === p.id).sort((a, b) => a.date < b.date ? 1 : -1);
  const stages = E.tl("stages");
  return (
    <Card testID="injury-card">
      <CardTitle title={t("inj_title")} info={<Info title={t("inj_title")} text={[t("inj_stageInfo"), t("bf_privacy")]} />} />
      {active && inj ? <Col gap={8}>
        <T v="eyebrow">{t("inj_current")}</T>
        <T bold>{inj.notiz || t("ab_verletzung")} · {t("inj_since")} {E.de(inj.von)}{inj.bis ? ` · ${t("inj_until")} ${E.de(inj.bis)}` : ""}</T>
        <Row gap={4}>
          {stages.map((st, i) => {
            const on = (inj.stufe || 1) === i + 1, done = (inj.stufe || 1) > i + 1;
            return (
              <Pressable key={i} testID={"inj-stage-" + (i + 1)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${i + 1} ${st}`}
                onPress={() => s.saveAbsence({ ...inj, stufe: i + 1 })}
                style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.s, alignItems: "center", gap: 2, backgroundColor: on ? c.inj : done ? withAlpha(c.inj, 0.25) : c.sunk }}>
                <Text style={{ fontWeight: "800", fontSize: 13, color: on ? "#fff" : c.ink }}>{i + 1}</Text>
                <Text numberOfLines={2} style={{ fontSize: 10, textAlign: "center", color: on ? "#fff" : c.muted }}>{st}</Text>
              </Pressable>
            );
          })}
        </Row>
        <RehaPlanView a={inj} editable testID="inj-reha" />
      </Col> : <Muted>{t("inj_none")}</Muted>}
      {E.mods.befunde ? <Col gap={8}>
        <Row between><T v="eyebrow">{t("bf_title")}</T><Btn small kind="ghost" icon="plus" testID="bf-add" label={t("bf_add")} onPress={() => setAdd(true)} /></Row>
        {list.length ? list.map(f => (
          <Pressable key={f.id} testID={"bf-" + f.id} accessibilityRole="button" onPress={() => setOpen(f)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 40, height: 48, borderRadius: 6, backgroundColor: withAlpha(c.inj, 0.14), alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: c.inj }}>{f.mime === "application/pdf" ? "PDF" : "IMG"}</Text>
            </View>
            <Col gap={1} style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 14.5, color: c.ink }}>{f.title}</Text>
              <Text style={{ fontSize: 12, color: c.muted }}>{E.de(f.date)}{f.ai ? " · " + t("bf_ai") + " ✓" : ""}</Text>
            </Col>
            <Icon name="chevron" size={16} color={c.muted} />
          </Pressable>
        )) : <Muted small>{t("bf_none")}</Muted>}
      </Col> : null}
      <AddFindingSheet visible={add} p={p} onClose={() => setAdd(false)} />
      <FindingSheet finding={open} onClose={() => setOpen(null)} canEdit />
    </Card>
  );
}

/** Blatt: Befund hinzufügen (Kamera, Bild, PDF) mit Einwilligung. */
function AddFindingSheet({ visible, p, onClose }: { visible: boolean; p: Player; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={visible} onClose={onClose} title={t("bf_add")} testID="bf-add-sheet" closeLabel={t("cancel")}>
      {visible ? <AddFindingForm p={p} onDone={onClose} /> : null}
    </Sheet>
  );
}
function AddFindingForm({ p, onDone }: { p: Player; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const inj = currentInjury(E, p.id);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string | null>(E.TODAY);
  const [abs, setAbs] = useState<string>(inj?.id || "");
  const [consent, setConsent] = useState<"app" | "schriftlich" | null>(null);
  const [busy, setBusy] = useState(false);
  const injuries = E.D.absences.filter(a => a.pid === p.id && a.typ === "verletzung");
  const upload = async (uri: string, mime: string) => {
    if (!consent) return;
    setBusy(true);
    try {
      await s.uploadFinding({ pid: p.id, absenceId: abs || null, date: date || E.TODAY, title: title.trim() || t("bf_title"), mime, consent, note: "" }, uri);
      s.toast(t("bf_saved")); onDone();
    } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  const camera = async () => { const perm = await ImagePicker.requestCameraPermissionsAsync(); if (!perm.granted) return; const r = await ImagePicker.launchCameraAsync({ quality: 0.8 }); if (!r.canceled && r.assets?.length) upload(r.assets[0].uri, "image/jpeg"); };
  const photo = async () => { const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 }); if (!r.canceled && r.assets?.length) upload(r.assets[0].uri, "image/jpeg"); };
  const pdf = async () => { const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true }); if (!r.canceled && r.assets?.length) upload(r.assets[0].uri, "application/pdf"); };
  return (
    <Col gap={12}>
      <Field testID="bf-title" label={t("bf_titleF")} value={title} onChangeText={setTitle} placeholder={t("bf_titlePh")} maxLength={200} />
      <Row wrap gap={10}>
        <DateField label={t("f_date")} value={date} onChange={setDate} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
        <Picker label={t("bf_injury")} value={abs} onChange={setAbs} options={[{ key: "", label: t("bf_noInjury") }, ...injuries.map(a => ({ key: a.id, label: `${E.de(a.von)} ${a.notiz || t("ab_verletzung")}` }))]} style={{ flex: 1, minWidth: 180 }} />
      </Row>
      <Row gap={6}><T v="small" bold>{t("bf_consentQ")}</T><Info title={t("bf_consentQ")} text={t("bf_consentInfo")} /></Row>
      <ChoiceChips testID="bf-consent" value={consent} onChange={setConsent} options={[...(p.userId ? [{ key: "app" as const, label: t("bf_consentApp") }] : []), { key: "schriftlich" as const, label: t("bf_consentWritten") }]} />
      <Row wrap gap={8}>
        <Btn testID="bf-camera" icon="camera" label={t("bf_camera")} disabled={!consent || busy} onPress={camera} />
        <Btn testID="bf-photo" label={t("bf_photo")} disabled={!consent || busy} onPress={photo} />
        <Btn testID="bf-pdf" label={t("bf_pdf")} disabled={!consent || busy} onPress={pdf} />
      </Row>
      {busy ? <Row gap={8}><ActivityIndicator color={c.accent} /><Muted>{t("bf_uploading")}</Muted></Row> : null}
      <Muted small>{t("bf_privacy")}</Muted>
    </Col>
  );
}

/** Blatt: Befund ansehen, KI-Auswertung starten/lesen, löschen. */
export function FindingSheet({ finding, onClose, canEdit }: { finding: Finding | null; onClose: () => void; canEdit?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const f = finding ? E.D.findings.find(x => x.id === finding.id) || finding : null;
  const url = useFindingUrl(f);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ask, setAsk] = useState(false);
  const run = async () => {
    if (!f) return; setBusy(true); setErr("");
    const p = E.P(f.pid), inj = f.absenceId ? E.D.absences.find(a => a.id === f.absenceId) : currentInjury(E, f.pid);
    const ctx = p ? [`Spieler: ${E.age(p)} Jahre, Position ${p.pos}, Altersklasse ${E.team.cls.toUpperCase()}.`,
      inj ? `Verletzung seit ${inj.von}${inj.bis ? ", voraussichtlich bis " + inj.bis : ""}, aktuelle Stufe ${inj.stufe || 1}/4${inj.notiz ? ", Notiz: " + inj.notiz : ""}.` : "",
      `Trainingstage pro Woche: ${Object.keys(E.team.settings.days).length}, Spieltag: ${E.tl("wd")[E.team.settings.spieltag]}.`].filter(Boolean).join("\n") : "";
    try { await s.analyzeFinding(f.id, ctx); } catch (e) { setErr(e instanceof ApiError && e.code === "consent_required" ? t("bf_noConsent") : aiErrText(e, t)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!f} onClose={onClose} title={f?.title} testID="bf-sheet" closeLabel={t("cancel")}>
      {f ? <Col gap={12}>
        <Muted small>{E.de(f.date)} · {f.mime === "application/pdf" ? "PDF" : "Foto"}</Muted>
        {f.mime !== "application/pdf" && url ? <Image accessibilityLabel={f.title} source={{ uri: url }} resizeMode="contain" style={{ width: "100%", height: 320, borderRadius: radius.m, backgroundColor: c.sunk }} /> : null}
        {url ? <Btn testID="bf-open" label={t("bf_open")} onPress={() => Linking.openURL(url).catch(() => undefined)} style={{ alignSelf: "flex-start" }} /> : <Muted small>{t("bf_noView")}</Muted>}
        <Col gap={8}>
          <Row gap={8}><Icon name="spark" color={c.accentTx} /><T v="h3" style={{ flex: 1 }}>{t("bf_ai")}</T><Info title={t("bf_ai")} text={t("bf_aiNote")} /></Row>
          {f.ai ? <View style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 10 }}><Markdown testID="bf-ai-out" text={f.ai} /></View> : null}
          {f.id.startsWith("demo-") && f.ai ? <Muted small>{t("bf_aiDemo")}</Muted> : null}
          {canEdit && E.mods.ki ? <Btn testID="bf-ai-run" icon="spark" label={t("bf_aiRun")} disabled={busy} onPress={run} style={{ alignSelf: "flex-start" }} /> : null}
          {busy ? <Row gap={8}><ActivityIndicator color={c.accent} /><Muted>{t("ki_think")}</Muted></Row> : null}
          {err ? <Banner color={c.warn}>{err}</Banner> : null}
        </Col>
        {canEdit ? (ask ? <Banner color={c.crit}><Col gap={8}><T v="small">{t("bf_delQ")}</T><Row gap={8}>
          <Btn small label={t("no")} onPress={() => setAsk(false)} />
          <Btn small kind="danger" testID="bf-del-confirm" label={t("bf_del")} onPress={() => { s.deleteFinding(f); onClose(); }} />
        </Row></Col></Banner> : <Btn small kind="ghost" testID="bf-del" label={t("bf_del")} onPress={() => setAsk(true)} style={{ alignSelf: "flex-start" }} />) : null}
      </Col> : null}
    </Sheet>
  );
}

/** Spieler-Ansicht: eigene Befunde (nur lesen). */
export function PlayerFindings({ pid }: { pid: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [open, setOpen] = useState<Finding | null>(null);
  const list = E.D.findings.filter(f => f.pid === pid).sort((a, b) => a.date < b.date ? 1 : -1);
  if (!list.length) return null;
  return (
    <Card testID="player-findings">
      <T v="h3">{t("bf_mine")}</T>
      {list.map(f => (
        <Pressable key={f.id} accessibilityRole="button" onPress={() => setOpen(f)} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: c.inj, width: 34 }}>{f.mime === "application/pdf" ? "PDF" : "IMG"}</Text>
          <Text style={{ flex: 1, color: c.ink, fontWeight: "600" }}>{f.title}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{E.de(f.date)}</Text>
        </Pressable>
      ))}
      <FindingSheet finding={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
