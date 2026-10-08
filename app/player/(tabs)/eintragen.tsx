// Spieler – Eintragen: RPE nach der Einheit, Morgen-Check, Zusatzsport (auch freie Sportarten), Abwesenheit.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { diff } from "../../../src/core/dates";
import { XP } from "../../../src/core/game";
import type { AbsenceType, Complaint, ExtraType, WellnessItems } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { Banner, Btn, Card, ChoiceChips, Col, DateField, Field, Header, Info, ListItem, Muted, NumField, NumScale, Picker, Row, Screen, Seg, T } from "../../../src/ui/kit";
import { cleanAreas } from "../../../src/core/body";
import { BodyPicker } from "../../../src/ui/body";
import { TermInfo } from "../../../src/ui/termInfo";
import { HealthConsentGate } from "../../../src/ui/player/parts";
import { radius, rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

type Tab = "rpe" | "well" | "extra" | "abs";

function RpeForm() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const p = E.P(s.mePid!)!;
  const L = E.playerSessions(p);
  const [sess, setSess] = useState<string>((E.playerOpenSession(p) || L[0])?.date || "");
  const cur = L.find(x => x.date === sess), done = cur ? E.D.rpe[p.id]?.[cur.date] : undefined;
  const [rpe, setRpe] = useState<number | null>(done?.rpe ?? null);
  const [min, setMin] = useState<number | null>(done?.min ?? null);
  const [fb, setFb] = useState("");
  useEffect(() => { const d = cur ? E.D.rpe[p.id]?.[cur.date] : undefined; setRpe(d?.rpe ?? null); setMin(d?.min ?? null); setFb(""); }, [sess]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!L.length || !cur) return <Card><Muted>{t("pe_noSess")}</Muted></Card>;
  const defMin = cur.typ === "Spiel" ? E.matchMin() : (cur.dauer || E.durOf(cur.date));
  const cr = E.tl("cr"), crd = E.tl("crd");
  const save = () => {
    if (rpe == null) { s.toast(t("pe_pick")); return; }
    const m = Math.max(1, min || defMin); s.saveRpe(p.id, cur.date, { rpe, min: m });
    const au = rpe * m, need = rpe >= 7 && E.mods.regeneration ? E.recoveryNeed(p, { typ: cur.typ, rpe, min: m }).h : null;
    setFb(tf("pe_fb", { au: E.int(au) }) + (need ? " " + tf("pe_fbRec", { h: need }) : ""));
    s.toast(`${tf("pe_saved", { au: E.int(au) })}${done ? "" : " · " + tf("gm_plusXp", { x: XP.rpe })}`);
  };
  return (
    <Card testID="form-rpe">
      <Picker testID="rpe-sess" label={t("pe_sess")} value={sess} onChange={setSess} options={L.map(x => ({ key: x.date, label: `${E.wt(x.date)} ${E.de(x.date)} (${x.typ === "Spiel" ? t("it_match") : t("it_training")})${E.D.rpe[p.id]?.[x.date] ? " · ✓ " + t("pe_done") : ""}` }))} />
      <Row between><T v="h3" style={{ flex: 1 }}>{t("pe_rpeQ")}</T><Info title={t("pe_rpe")} text={t("pe_rpeHint")} /></Row>
      <View style={{ gap: 6 }}>
        {cr.map((label, i) => {
          const on = rpe === i, col = i ? rpeColor(c, i) : c.build;
          return (
            <Pressable key={i} testID={"rpe-" + i} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${i} ${label}`} onPress={() => setRpe(i)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? withAlpha(col, 0.16) : c.surface }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: col, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{i}</Text></View>
              <Text style={{ flex: 1, fontWeight: on ? "800" : "600", color: c.ink, fontSize: 14.5 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {rpe != null ? <Banner color={rpe ? rpeColor(c, rpe) : c.build}><T v="small"><T v="small" bold>{rpe} · {cr[rpe]}</T>: {crd[rpe]}</T></Banner> : null}
      <NumField testID="rpe-min" label={t("pe_min")} value={min ?? defMin} min={1} max={150} onChange={setMin} style={{ width: 140 }} />
      <Btn testID="rpe-save" kind="primary" label={t("pl_saveRpe")} onPress={save} style={{ alignSelf: "flex-start" }} />
      {fb ? <Banner color={c.ok}>{fb}</Banner> : null}
    </Card>
  );
}

function WellForm({ onDone }: { onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const p = E.P(s.mePid!)!; const today = E.D.well[p.id]?.[E.TODAY];
  const [sleep, setSleep] = useState<number>(today?.schlaf ?? E.profile(p.id).tg[0]);
  const [items, setItems] = useState<Partial<WellnessItems>>(today?.items || {});
  const [pain, setPain] = useState<Complaint>(today?.beschw || "none");
  const [ort, setOrt] = useState(today?.ort || "");
  const [areas, setAreas] = useState<string[]>(today?.areas || []);
  const col = (v: number) => v <= 2 ? c.ok : v <= 4 ? c.warn : c.crit;
  // Sofort-Hinweis zur gewählten Region (gleiche Logik wie in der Steuerung)
  const preview = pain !== "none" ? E.soreEffect(p, { sum: 0, schlaf: sleep, beschw: pain, areas }) : null;
  const keys: (keyof WellnessItems)[] = ["sq", "fat", "doms", "stress"];
  const save = () => {
    if (keys.some(k => !items[k])) { s.toast(t("pw_need")); return; }
    if (pain !== "none" && !cleanAreas(areas).length) { s.toast(t("pw_regionNeed")); return; }
    const it = items as WellnessItems;
    s.saveWellness(p.id, E.TODAY, { sum: it.sq + it.fat + it.doms + it.stress, schlaf: sleep, beschw: pain, ort: pain !== "none" ? ort.trim() : "", items: it, areas: pain !== "none" ? cleanAreas(areas) : [] });
    s.toast(`${t("pw_saved")}${today ? "" : " · " + tf("gm_plusXp", { x: XP.well })}`); onDone();
  };
  return (
    <Card testID="form-well">
      {today ? <Banner color={c.ok}>{t("pw_doneToday")}</Banner> : null}
      <T v="h3">{t("pw_sleep")}</T>
      <Row gap={14}>
        <Btn testID="sleep-minus" label="−" a11y="−0,5" onPress={() => setSleep(Math.max(0, Math.round((sleep - 0.5) * 2) / 2))} style={{ width: 52 }} />
        <Text testID="sleep-val" style={{ fontSize: 30, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"], minWidth: 90, textAlign: "center" }}>{E.num(sleep, 1)} h</Text>
        <Btn testID="sleep-plus" label="+" a11y="+0,5" onPress={() => setSleep(Math.min(14, Math.round((sleep + 0.5) * 2) / 2))} style={{ width: 52 }} />
      </Row>
      <Col gap={2}><T v="h3">{t("pw_q")}</T><Muted small>{t("pw_scale")}</Muted></Col>
      {keys.map(k => (
        <Col key={k} gap={6}>
          <T bold>{t("pw_" + k)}</T>
          <NumScale testID={"well-" + k} value={items[k] ?? null} min={1} max={7} color={col} onChange={v => setItems({ ...items, [k]: v })} />
        </Col>
      ))}
      <Row gap={6}><T v="h3" style={{ flexShrink: 1 }}>{t("pw_pain")}</T><TermInfo k="complaints" testID="term-complaints" /></Row>
      <ChoiceChips testID="well-pain" value={pain} onChange={setPain} options={[{ key: "none", label: t("pw_no") }, { key: "light", label: t("pw_light") }, { key: "clear", label: t("pw_clear") }]} />
      {pain !== "none" ? <Col gap={8}>
        <Col gap={2}><T bold>{t("pw_regions")}</T><Muted small>{t("pw_regionsD")}</Muted></Col>
        <BodyPicker testID="well-body" value={areas} onChange={setAreas} color={pain === "clear" ? c.crit : c.warn} />
        {preview ? <Banner color={preview.kind === "sick" || preview.kind === "pause" ? c.crit : c.warn} testID="well-body-advice">{t(preview.how)}</Banner> : null}
        <Field testID="well-where" label={t("pw_note")} value={ort} onChangeText={setOrt} placeholder={t("pw_notePh")} maxLength={120} />
      </Col> : null}
      <Btn testID="well-save" kind="primary" label={t("pl_saveWell")} onPress={save} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}

const EXTRA: ExtraType[] = ["gym", "lauf", "schule", "verein", "sonst"];
function ExtraForm() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const p = E.P(s.mePid!)!;
  const [art, setArt] = useState<ExtraType>("gym");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState<string | null>(E.TODAY);
  const [min, setMin] = useState<number | null>(60);
  const [rpe, setRpe] = useState(5);
  const L = (E.D.extra[p.id] || []).filter(x => diff(x.date, E.TODAY) <= 7 && x.date <= E.TODAY).sort((a, b) => a.date < b.date ? 1 : -1);
  const save = () => {
    if (art === "sonst" && !label.trim()) { s.toast(t("pl_otherLabel")); return; }
    const d = !date || date > E.TODAY ? E.TODAY : date, first = !(E.D.extra[p.id] || []).some(x => x.date === d);
    s.saveExtra(p.id, { id: tmpId(), date: d, art, min: Math.max(5, min || 60), rpe, label: art === "sonst" ? label.trim() : undefined });
    s.toast(`${t("px_saved")}${first ? " · " + tf("gm_plusXp", { x: XP.extra }) : ""}`); setLabel("");
  };
  return (
    <>
      <Card testID="form-extra">
        <T v="h3">{t("px_art")}</T>
        <ChoiceChips testID="extra-art" value={art} onChange={setArt} options={EXTRA.map(k => ({ key: k, label: t("px_" + k) }))} />
        {art === "sonst" ? <Field testID="extra-label" label={t("pl_otherLabel")} value={label} onChangeText={setLabel} placeholder={t("pl_otherPh")} maxLength={60} /> : null}
        <Row wrap gap={10}>
          <DateField testID="extra-date" label={t("px_date")} value={date} onChange={setDate} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
          <NumField testID="extra-min" label={t("px_min")} value={min} onChange={setMin} min={5} max={240} style={{ width: 120 }} />
        </Row>
        <T v="small" bold color={c.muted}>{t("px_rpe")}: {rpe} · {E.tl("cr")[rpe]}</T>
        <NumScale testID="extra-rpe" value={rpe} min={1} max={10} color={n => rpeColor(c, n)} onChange={setRpe} />
        <Muted small>{t("px_note")}</Muted>
        <Btn testID="extra-save" kind="primary" label={t("save")} onPress={save} style={{ alignSelf: "flex-start" }} />
      </Card>
      <Card>
        <T v="h3">{t("px_list")}</T>
        {L.length ? L.map(x => <ListItem key={x.id} title={`${E.wt(x.date)} ${E.de(x.date)} · ${x.label || t("px_" + x.art)}`} sub={`${x.min} ${t("min")} · RPE ${x.rpe}`}
          right={<Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => s.deleteExtra(p.id, x.id)} />} />) : <Muted>{t("px_none")}</Muted>}
      </Card>
    </>
  );
}

function AbsForm() {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const p = E.P(s.mePid!)!; const allowed = E.team.settings.playerAbs ?? true;
  const types: AbsenceType[] = ["urlaub", "krank", "verletzung", E.grp === "akt" ? "arbeit" : "schule", "sonst"];
  const [typ, setTyp] = useState<AbsenceType>("urlaub");
  const [von, setVon] = useState<string | null>(E.TODAY);
  const [bis, setBis] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const mine = E.D.absences.filter(x => x.pid === p.id && (!x.bis || x.bis >= E.TODAY)).sort((a, b) => a.von < b.von ? -1 : 1);
  return (
    <>
      {allowed ? <Card testID="form-abs">
        <T v="h3">{t("pa_absQ")}</T>
        <ChoiceChips testID="abs-typ" value={typ} onChange={setTyp} options={types.map(k => ({ key: k, label: t("ab_" + k) }))} />
        <Row wrap gap={10}>
          <DateField testID="pabs-from" label={t("abs_from")} value={von} onChange={setVon} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
          <DateField testID="pabs-to" label={t("abs_to")} value={bis} onChange={setBis} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
        </Row>
        <Field testID="pabs-note" label={t("abs_note")} value={notiz} onChangeText={setNotiz} />
        <Btn testID="pabs-save" kind="primary" label={t("save")} onPress={() => {
          const v = von || E.TODAY; s.saveAbsence({ id: tmpId(), pid: p.id, typ, von: v, bis: bis && bis < v ? v : bis, stufe: typ === "verletzung" ? 1 : null, notiz: notiz.trim(), by: "player" });
          s.toast(t("pa_absSaved")); setNotiz(""); setBis(null);
        }} style={{ alignSelf: "flex-start" }} />
      </Card> : <Banner>{t("pl_absOff")}</Banner>}
      <Card>
        <T v="h3">{t("pa_mine")}</T>
        {mine.length ? mine.map(x => <ListItem key={x.id} title={t("ab_" + x.typ)} sub={`${E.de(x.von)} – ${x.bis ? E.de(x.bis) : t("ongoing")}${x.notiz ? " · " + x.notiz : ""}`}
          right={x.by === "player" && allowed ? <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => s.deleteAbsence(x.id)} /> : undefined} />) : <Muted>{t("abs_none")}</Muted>}
      </Card>
    </>
  );
}

export default function Eintragen() {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  const params = useLocalSearchParams<{ tab: string }>();
  const tabs: Tab[] = [...(E.mods.belastung ? ["rpe", "well", "extra"] as Tab[] : []), "abs"];
  const [tab, setTab] = useState<Tab>(tabs.includes(params.tab as Tab) ? params.tab as Tab : tabs[0]);
  useEffect(() => { if (params.tab && tabs.includes(params.tab as Tab)) setTab(params.tab as Tab); }, [params.tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const needsConsent = tab !== "abs" && !s.consents?.health_data;
  return (
    <Screen testID="player-eintragen">
      <Header title={t("pn_eintragen")} />
      <Seg testID="ptab" value={tab} onChange={setTab} options={tabs.map(k => ({ key: k, label: t("pl_tab_" + k) }))} />
      {needsConsent ? <HealthConsentGate /> : tab === "rpe" ? <RpeForm /> : tab === "well" ? <WellForm onDone={() => router.navigate("/player/heute")} /> : tab === "extra" ? <ExtraForm /> : <AbsForm />}
    </Screen>
  );
}
