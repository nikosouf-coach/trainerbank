// Karten im Spielerprofil: Empfehlung an den Spieler, Potenziale & Ziele, Zusatzsport.
import React, { useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { diff } from "../../core/dates";
import { parsePotentials, type Hint } from "../../core/engine";
import type { MsgType, Player, PotCat } from "../../core/types";
import { tmpId, useEngine, useStore } from "../../data/store";
import { useAi } from "../ai";
import { Btn, Card, CardTitle, Check, Chip, Col, DateField, Field, Info, Msg, Muted, Picker, Row, T, Tag } from "../kit";
import { useTheme, type Colors } from "../theme";

const RTYPES: MsgType[] = ["pause", "regen", "zusatz", "prog", "info"];
export const msgColor = (c: Colors, k: MsgType): string => ({ pause: c.crit, regen: c.warn, zusatz: c.ok, prog: c.low, info: c.accentTx }[k]);
const POTCATS: PotCat[] = ["ath", "tech", "takt", "ment", "verf"];
export const potColor = (c: Colors, k: PotCat): string => ({ ath: c.hot, tech: c.low, takt: c.event, ment: c.ok, verf: c.warn }[k]);

/** Empfehlung an den Spieler (inkl. „Pause“) mit Vorschlag der App und Verlauf. */
export function RecCard({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const sg = E.suggestRec(p);
  const [typ, setTyp] = useState<MsgType>(sg.typ);
  const [bis, setBis] = useState<string | null>(sg.bis);
  const [text, setText] = useState(sg.text);
  const hist = (E.D.msgs[p.id] || []).slice().reverse();
  return (
    <Card testID="rec-card">
      <CardTitle title={t("rec_title")} info={<Info title={t("rec_title")} text={t("rec_info")} />} />
      <Msg eyebrow={`${t("rec_sugg")} · ${t("ry_" + sg.typ)}`} text={sg.text} color={msgColor(c, sg.typ)} />
      <Row wrap gap={10}>
        <Picker testID="rec-typ" label={t("rec_typ")} value={typ} onChange={setTyp} options={RTYPES.map(k => ({ key: k, label: t("ry_" + k) }))} style={{ flex: 1, minWidth: 160 }} />
        <DateField testID="rec-bis" label={t("rec_until")} value={bis} onChange={setBis} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
      </Row>
      <Field testID="rec-text" label={t("rec_text")} value={text} onChangeText={setText} multiline />
      <Btn testID="rec-send" kind="primary" label={t("rec_send")} disabled={!text.trim()} style={{ alignSelf: "flex-start" }}
        onPress={() => { s.saveMessage(p.id, { id: tmpId(), date: E.TODAY, typ, text: text.trim(), bis }); s.toast(t("rec_sent")); }} />
      {hist.length ? <Col gap={6}>
        <T v="eyebrow">{t("rec_hist")}</T>
        {hist.map(h => (
          <Row key={h.id} gap={8} align="flex-start">
            <Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>{E.de(h.date)} · <Text style={{ fontWeight: "800", color: msgColor(c, h.typ) }}>{t("ry_" + h.typ)}</Text>: {h.text}{h.bis ? <Text style={{ color: c.muted }}> ({t("until")} {E.de(h.bis)})</Text> : null}</Text>
            <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => s.deleteMessage(p.id, h.id)} />
          </Row>
        ))}
      </Col> : null}
    </Card>
  );
}

/** Potenziale & Ziele: manuell, aus den Daten erkannt oder per KI. „Für Spieler sichtbar“ = Ziel in seiner App. */
export function PotCard({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const L = E.D.pot[p.id] || [];
  const hints = E.dataHints(p).filter(h => !L.some(x => x.text === h.text));
  const [cat, setCat] = useState<PotCat>("ath");
  const [text, setText] = useState("");
  const [vis, setVis] = useState(true);
  const ai = useAi();
  const [aiItems, setAiItems] = useState<Hint[]>([]);
  const take = (h: Hint, src: "daten" | "ki") => s.savePotential(p.id, { id: tmpId(), cat: h.cat, text: h.text, vis: false, src });
  return (
    <Card testID="pot-card">
      <CardTitle title={t("pot_title")} info={<Info title={t("pot_title")} text={t("pot_info")} />} />
      {L.length ? L.map(x => (
        <Row key={x.id} gap={8} align="flex-start" wrap>
          <Chip label={t("pc_" + x.cat)} color={potColor(c, x.cat)} />
          <Text style={{ flex: 1, minWidth: 160, color: c.ink, fontSize: 14 }}>{x.text}{x.src !== "trainer" ? "  " : ""}{x.src !== "trainer" ? <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>{t("pot_src_" + x.src).toUpperCase()}</Text> : null}</Text>
          <Btn small testID={"pot-vis-" + x.id} label={x.vis ? t("pot_vis") : t("pot_hidden")} kind={x.vis ? "primary" : "default"} onPress={() => s.savePotential(p.id, { ...x, vis: !x.vis })} />
          <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => s.deletePotential(p.id, x.id)} />
        </Row>
      )) : <Muted>{t("pot_none")}</Muted>}
      <Col gap={8}>
        <Row wrap gap={8} align="flex-end">
          <Picker testID="pot-cat" label={t("pot_cat")} value={cat} onChange={setCat} options={POTCATS.map(k => ({ key: k, label: t("pc_" + k) }))} style={{ width: 170 }} />
          <Field testID="pot-text" label={t("pot_title")} value={text} onChangeText={setText} placeholder={t("pot_ph")} style={{ flex: 1, minWidth: 200 }} />
        </Row>
        <Row wrap gap={12}>
          <Check testID="pot-vis" label={t("pot_vis")} value={vis} onChange={setVis} />
          <Btn small kind="primary" testID="pot-add" label={t("pot_add")} disabled={!text.trim()} onPress={() => { s.savePotential(p.id, { id: tmpId(), cat, text: text.trim(), vis, src: "trainer" }); setText(""); s.toast(t("t_saved")); }} />
        </Row>
      </Col>
      {hints.length ? <Col gap={6}>
        <T v="eyebrow">{t("pot_data")}</T>
        {hints.map((h, i) => <Row key={i} gap={8} wrap><Chip label={t("pc_" + h.cat)} color={potColor(c, h.cat)} /><Muted small style={{ flex: 1, minWidth: 160 }}>{h.text}</Muted><Btn small testID={"pot-take-" + i} label={t("pot_take")} onPress={() => take(h, "daten")} /></Row>)}
      </Col> : null}
      {E.mods.ki ? <Col gap={6}>
        <Row gap={8}><Btn small icon="spark" testID="pot-ai" label={t("pot_ki")} disabled={ai.busy} onPress={async () => { const r = await ai.run("potentials", E.potPrompt(p), E.aiContext(pid => s.aiPlayers.includes(pid))); if (r) setAiItems(parsePotentials(r)); }} />{ai.busy ? <ActivityIndicator color={c.accent} /> : null}</Row>
        {ai.err ? <Muted small>{ai.err}</Muted> : null}
        {aiItems.map((h, i) => <Row key={i} gap={8} wrap><Chip label={t("pc_" + h.cat)} color={potColor(c, h.cat)} /><Muted small style={{ flex: 1, minWidth: 160 }}>{h.text} </Muted><Tag label={t("pot_src_ki")} /><Btn small label={t("pot_take")} onPress={() => { take(h, "ki"); setAiItems(aiItems.filter((_, j) => j !== i)); }} /></Row>)}
      </Col> : null}
    </Card>
  );
}

/** Zusatzsport der letzten 14 Tage (vom Spieler eingetragen). */
export function ExtraCard({ p }: { p: Player }) {
  const E = useEngine(); const { t } = E;
  if (!E.mods.belastung) return null;
  const L = (E.D.extra[p.id] || []).filter(x => diff(x.date, E.TODAY) <= 14 && x.date <= E.TODAY).sort((a, b) => a.date < b.date ? 1 : -1);
  return (
    <Card>
      <CardTitle title={t("x_title")} />
      {L.length ? L.map(x => <Row key={x.id} between gap={8}><T v="small" style={{ flex: 1 }}>{E.wt(x.date)} {E.de(x.date)} · {x.label || t("px_" + x.art)} · {x.min} {t("min")}</T><T v="small" bold>RPE {x.rpe}{E.lvl(2) ? ` · ${x.rpe * x.min} AU` : ""}</T></Row>) : <Muted>{t("x_none")}</Muted>}
    </Card>
  );
}
