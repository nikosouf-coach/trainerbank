// Größen & Ausrüstung – Oberfläche: Eingabe (Spieler und Trainerteam), kurze Zeile mit den Größen, Eintrag unter „Ich“.
// Die Übersicht mit Bestellliste fürs Trainerteam liegt unter app/coach/(tabs)/groessen.tsx. Regeln: core/sizes
// (dieselben Grenzen prüft die Datenbank).
import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { ADULT_SIZES, KIDS_SIZES, SIZE_LIMITS, cleanHalf, cleanSizes, emptySizes, fmtHalf, kidsSizes, sizesComplete, sockOf } from "../core/sizes";
import type { PlayerSizes } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Btn, ChoiceChips, Col, Field, ListItem, Muted, Row, Sheet, T } from "./kit";
import { useTheme } from "./theme";

type Tr = { t: (k: string) => string; lang: string };

/** Kurze Zeile mit den eingetragenen Größen („Oberteil M · Hose M · Schuhe 43“) */
export function sizesLine(s: PlayerSizes | null | undefined, tr: Tr): string {
  if (!s) return "";
  const { t, lang } = tr;
  return [
    s.top ? `${t("gr_item_top")} ${s.top}` : "",
    s.bottom ? `${t("gr_item_bottom")} ${s.bottom}` : "",
    s.shoes != null ? `${t("gr_item_shoes")} ${fmtHalf(s.shoes, lang)}` : "",
    s.gloves != null ? `${t("gr_item_gloves")} ${fmtHalf(s.gloves, lang)}` : "",
  ].filter(Boolean).join(" · ");
}

/** Formular (Texte für Schuhe und Handschuhe, damit beim Tippen nichts springt) */
interface Draft { top: string | null; bottom: string | null; shoes: string; gloves: string; print: string; note: string }
const toDraft = (s: PlayerSizes | null | undefined, lang: string): Draft => {
  const x = s || emptySizes();
  return { top: x.top, bottom: x.bottom, shoes: x.shoes == null ? "" : fmtHalf(x.shoes, lang), gloves: x.gloves == null ? "" : fmtHalf(x.gloves, lang), print: x.print, note: x.note };
};
/** Formular prüfen: Schuh- und Handschuhgröße im Bereich (sonst Fehlertext), sonst die bereinigten Größen */
function fromDraft(d: Draft, t: (k: string) => string): { error: string } | { sizes: PlayerSizes } {
  const shoes = d.shoes.trim() ? cleanHalf(d.shoes, SIZE_LIMITS.shoesMin, SIZE_LIMITS.shoesMax) : null;
  if (d.shoes.trim() && shoes == null) return { error: t("gr_errShoes") };
  const gloves = d.gloves.trim() ? cleanHalf(d.gloves, SIZE_LIMITS.glovesMin, SIZE_LIMITS.glovesMax) : null;
  if (d.gloves.trim() && gloves == null) return { error: t("gr_errGloves") };
  return { sizes: cleanSizes({ top: d.top, bottom: d.bottom, shoes, gloves, print: d.print, note: d.note }) };
}

/** Kleidergröße wählen (nochmal tippen = abwählen); Kindergrößen bis zur U15 oder auf Wunsch */
function ClothChips({ value, onChange, kids, testID }: { value: string | null; onChange: (v: string | null) => void; kids: boolean; testID: string }) {
  const opts = [...(kids ? KIDS_SIZES : []), ...ADULT_SIZES].map(k => ({ key: k, label: k }));
  return <ChoiceChips testID={testID} value={value} onChange={k => onChange(k === value ? null : k)} options={opts} />;
}

/** Eingabe der Größen (Spieler selbst oder Trainerteam für den Spieler) */
function SizesForm({ pid, onDone }: { pid: string; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const p = E.P(pid);
  const stored = E.D.sizes[pid];
  const [d, setD] = useState<Draft>(() => toDraft(stored, E.tr.lang));
  const [kids, setKids] = useState(() => kidsSizes(E.team.cls) || KIDS_SIZES.includes(stored?.top || "") || KIDS_SIZES.includes(stored?.bottom || ""));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => { setD(x => ({ ...x, ...patch })); setErr(""); };
  const gk = p?.pos === "TW" || !!d.gloves.trim();
  const shoesN = d.shoes.trim() ? cleanHalf(d.shoes, SIZE_LIMITS.shoesMin, SIZE_LIMITS.shoesMax) : null;
  const save = async () => {
    const r = fromDraft(d, t);
    if ("error" in r) { setErr(r.error); return; }
    setBusy(true);
    try { if ((await s.saveSizes(pid, r.sizes)) !== false) onDone(); } finally { setBusy(false); }
  };
  const label = (k: string) => (
    <Row gap={6} wrap>
      <T v="small" bold>{t("gr_item_" + k)}</T>
      <Muted small>{t("gr_itemD_" + k)}</Muted>
    </Row>
  );
  return (
    <Col gap={16}>
      {s.viewAs !== "coach" ? <Muted small>{t("gr_hint")}</Muted> : null}
      <Col gap={8} testID="gr-top">
        {label("top")}
        <ClothChips testID="gr-top" value={d.top} onChange={v => set({ top: v })} kids={kids} />
      </Col>
      <Col gap={8} testID="gr-bottom">
        {label("bottom")}
        <ClothChips testID="gr-bottom" value={d.bottom} onChange={v => set({ bottom: v })} kids={kids} />
      </Col>
      {!kids ? (
        <Pressable testID="gr-kids" accessibilityRole="button" onPress={() => setKids(true)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
          <Text style={{ color: c.accentTx, fontWeight: "600", fontSize: 14 }}>{t("gr_kidsShow")}</Text>
        </Pressable>
      ) : null}
      <Row gap={12} wrap align="flex-end">
        <Field testID="gr-shoes" label={`${t("gr_item_shoes")} (${t("gr_itemD_shoes")})`} placeholder={t("gr_shoesPh")} value={d.shoes} onChangeText={v => set({ shoes: v })}
          keyboardType="decimal-pad" maxLength={4} style={{ width: 170 }} />
        {shoesN != null ? <Muted small>{`${t("gr_item_socks")}: ${sockOf(shoesN)}`}</Muted> : null}
      </Row>
      {gk ? (
        <Field testID="gr-gloves" label={`${t("gr_item_gloves")}`} placeholder={t("gr_glovesPh")} value={d.gloves} onChangeText={v => set({ gloves: v })}
          keyboardType="decimal-pad" maxLength={4} style={{ width: 170 }} />
      ) : null}
      <Col gap={4}>
        <Field testID="gr-print" label={t("gr_print")} placeholder={tf("gr_printPh", { n: (p?.nn || "").toUpperCase() })} value={d.print} onChangeText={v => set({ print: v })}
          maxLength={SIZE_LIMITS.print} autoCapitalize="characters" />
        <Muted small>{t("gr_printD")}</Muted>
      </Col>
      <Field testID="gr-note" label={t("gr_note")} placeholder={t("gr_notePh")} value={d.note} onChangeText={v => set({ note: v })} multiline maxLength={SIZE_LIMITS.note} />
      {err ? <Banner color={c.crit} testID="gr-err">{err}</Banner> : null}
      <Row gap={10} wrap>
        <Btn kind="primary" testID="gr-save" label={t("save")} disabled={busy} onPress={save} />
        <Btn kind="ghost" testID="gr-cancel" label={t("um_cancel")} onPress={onDone} />
      </Row>
    </Col>
  );
}

/** Blatt: Größen eintragen (Spieler: eigene; Trainerteam mit Recht „Kader“) */
export function SizesSheet({ pid, onClose }: { pid: string | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const p = pid ? E.P(pid) : null;
  const staff = s.viewAs === "coach";
  return (
    <Sheet visible={!!pid} onClose={onClose} title={staff && p ? `${t("gr_editT")} · ${E.name(p)}` : t("gr_editT")} testID="gr-sheet" closeLabel={t("um_cancel")}>
      {pid ? <SizesForm key={pid} pid={pid} onDone={onClose} /> : null}
    </Sheet>
  );
}

/** Spieler – Ich: eigene Größen (kurze Zeile oder „noch nicht vollständig“), öffnet die Eingabe */
export function MySizesItem() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pid = s.mePid || "";
  const [open, setOpen] = useState(false);
  if (!pid || E.mods.ausruestung === false) return null;
  const mine = E.D.sizes[pid], line = sizesLine(mine, E.tr);
  const incomplete = E.D.sizesOk && !sizesComplete(mine);
  return (
    <>
      <ListItem testID="me-groessen" title={t("gr_my")} sub={line || undefined} right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => setOpen(true)}>
        {incomplete ? <Text style={{ fontSize: 13, fontWeight: "700", color: c.warn }}>{t("gr_myMissing")}</Text> : null}
      </ListItem>
      <SizesSheet pid={open ? pid : null} onClose={() => setOpen(false)} />
    </>
  );
}
