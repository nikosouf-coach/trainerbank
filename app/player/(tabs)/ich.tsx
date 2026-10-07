// Spieler – Ich: Profilbild, eigenes Profil, Ziele, Konto & Datenschutz.
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { POS } from "../../../src/core/classes";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Banner, Btn, Card, ChoiceChips, Col, DateField, Field, Header, ListItem, Muted, NumField, Row, Screen, T } from "../../../src/ui/kit";
import { GOLD, Goals } from "../../../src/ui/player/parts";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { useTheme } from "../../../src/ui/theme";

export default function Ich() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(s.mePid || "")!;
  const [vn, setVn] = useState(p.vn); const [nn, setNn] = useState(p.nn);
  const [geb, setGeb] = useState<string | null>(p.geb || null); const [pos, setPos] = useState(p.pos);
  const [nr, setNr] = useState<number | null>(p.nr ?? null); const [kg, setKg] = useState<number | null>(p.kg ?? null);
  const [busy, setBusy] = useState(false);
  const dirty = vn !== p.vn || nn !== p.nn || geb !== (p.geb || null) || pos !== p.pos || nr !== (p.nr ?? null) || kg !== (p.kg ?? null);
  const save = async () => {
    if (!vn.trim() || !nn.trim() || !geb) { s.toast(t("po_need")); return; }
    setBusy(true);
    try { await s.savePlayer({ ...p, vn: vn.trim(), nn: nn.trim(), geb, pos, nr, kg }); s.toast(t("pi_saved")); } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  const pickPhoto = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (r.canceled || !r.assets?.length) return;
      await s.uploadPhoto(p.id, r.assets[0].uri); s.toast(t("pr_photoSaved"));
    } catch (e) { s.toast(s.errText(e)); }
  };
  return (
    <Screen testID="player-ich">
      <Header title={t("pi_hi")} />
      <Card testID="me-card">
        <Row gap={16} wrap>
          <Pressable testID="me-photo" accessibilityRole="button" accessibilityLabel={t("pl_photoChange")} onPress={pickPhoto} style={{ alignItems: "center", gap: 6 }}>
            <Col style={{ borderWidth: 3, borderColor: GOLD, borderRadius: 60 }}><PlayerAvatar p={p} size={96} /></Col>
            <Row gap={4}><Icon name="camera" size={15} color={c.accentTx} /><Text style={{ fontSize: 12, fontWeight: "700", color: c.accentTx }}>{t("pl_photoChange")}</Text></Row>
          </Pressable>
          <Col gap={4} style={{ flex: 1, minWidth: 180 }}>
            <T v="eyebrow">#{p.nr ?? "–"} · {p.pos} · {E.age(p)} {t("years")}</T>
            <T v="h1" style={{ fontSize: 26 }}>{E.name(p)}</T>
            <Muted small>{E.team.club} · {E.team.name}</Muted>
          </Col>
        </Row>
      </Card>
      <Card testID="me-profile">
        <T v="h3">{t("pl_profile")}</T>
        <Row wrap gap={10}>
          <Field testID="me-vn" label={t("po_vn")} value={vn} onChangeText={setVn} style={{ flex: 1, minWidth: 140 }} />
          <Field testID="me-nn" label={t("po_nn")} value={nn} onChangeText={setNn} style={{ flex: 1, minWidth: 140 }} />
        </Row>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("po_pos")}{pos ? " · " + t("pos_" + pos) : ""}</T>
          <ChoiceChips testID="me-pos" value={pos} onChange={setPos} options={POS.map(k => ({ key: k, label: k }))} /></Col>
        <Row wrap gap={10}>
          <DateField testID="me-geb" label={t("po_geb")} value={geb} onChange={setGeb} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
          <NumField testID="me-nr" label={t("po_nr")} value={nr} onChange={setNr} min={1} max={99} step={1} style={{ width: 110 }} />
          <NumField testID="me-kg" label={t("po_kg")} value={kg} onChange={setKg} min={20} max={150} style={{ width: 110 }} />
        </Row>
        {dirty ? <Btn testID="me-save" kind="primary" label={t("pi_save")} disabled={busy} onPress={save} style={{ alignSelf: "flex-start" }} /> : null}
        <Banner>{t("po_privacy")}</Banner>
      </Card>
      {E.playerSees("goals") ? <Goals pid={p.id} /> : null}
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListItem testID="me-konto" title={t("pl_account")} sub={s.isDemo ? t("w_demoHint") : s.user?.email || ""} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => router.push("/konto")} />
      </Card>
    </Screen>
  );
}
