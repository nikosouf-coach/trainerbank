// Trainer – Spielerprofil: Status, Kennzahlen, Empfehlung, Erholung, Wachstum, Belastung, Potenziale, Zusatzsport, Abwesenheiten, Notizen.
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TermInfo } from "../../../src/ui/termInfo";
import React, { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { diff } from "../../../src/core/dates";
import { useEngine, useStore } from "../../../src/data/store";
import { LoadChart, Ring } from "../../../src/ui/charts";
import { Btn, Card, CardTitle, Chip, Col, Field, Header, Info, ListItem, Muted, Row, Screen, StatusChip, T } from "../../../src/ui/kit";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { MyTarget } from "../../../src/ui/indiv";
import { GroupChip } from "../../../src/ui/squad/Groups";
import { MergeSheet, PlayerSheet } from "../../../src/ui/squad/PlayerForm";
import { InjuryCard } from "../../../src/ui/injury";
import { PerfCard } from "../../../src/ui/perf";
import { ExtraCard, GamesCard, PotCard, RecCard } from "../../../src/ui/squad/ProfileCards";
import { radius, statusColor, useTheme } from "../../../src/ui/theme";
import type { Player } from "../../../src/core/types";

function Kpi({ label, value, sub, color, term }: { label: string; value: string; sub?: string; color?: string; term?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 130, backgroundColor: c.sunk, borderRadius: radius.m, padding: 10, gap: 2 }}>
      <Row gap={6}><T v="eyebrow">{label}</T>{term ? <TermInfo k={term} /> : null}</Row>
      <Text style={{ fontSize: 22, fontWeight: "800", color: color || c.ink, fontVariant: ["tabular-nums"] }}>{value}</Text>
      {sub ? <Muted small>{sub}</Muted> : null}
    </View>
  );
}

export default function Spieler() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions(); const wide = width >= 900;
  const [edit, setEdit] = useState<Player | null | undefined>(undefined);
  const [merge, setMerge] = useState<Player | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const sheets = usePlanSheets();
  const p = E.P(id);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/kader");
  if (!p) return <Screen testID="coach-spieler"><Header title={t("nav_kader")} onBack={back} backLabel={t("nav_kader")} /><Muted>{t("err_not_found")}</Muted></Screen>;

  const pr = E.profile(p.id), m = pr.m, rec = pr.rec, mods = E.mods, nx = E.nextItem();
  const abs = E.D.absences.filter(a => a.pid === p.id).sort((a, b) => a.von < b.von ? 1 : -1);
  const series = m ? m.series.slice(-28) : [];
  const fmtH = (h: number) => h < 1 ? "<1 " + t("hours") : Math.round(h) + " " + t("hours");
  const recCol = !rec || rec.none ? c.ok : rec.notReady ? c.crit : rec.remaining > 0 ? c.warn : c.ok;
  const adv = E.advice(pr);
  const noteVal = note ?? (E.D.notes[p.id] || "");

  const pickPhoto = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (r.canceled || !r.assets?.length) return;
      await s.uploadPhoto(p.id, r.assets[0].uri); s.toast(t("pr_photoSaved"));
    } catch (e) { s.toast(s.errText(e)); }
  };

  const head = (
    <Card testID="profile-head">
      <Row gap={16} align="flex-start" wrap>
        <Pressable testID="profile-photo" accessibilityRole="button" accessibilityLabel={t("pr_photo")} onPress={pickPhoto} style={{ alignItems: "center", gap: 4 }}>
          <PlayerAvatar p={p} size={84} status={mods.belastung || pr.st === "inj" ? pr.st : null} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: c.accentTx }}>{t("pr_photo")}</Text>
        </Pressable>
        <Col gap={6} style={{ flex: 1, minWidth: 200 }}>
          <T v="eyebrow">{p.nr != null ? "#" + p.nr + " · " : ""}{p.pos} · {t("pos_" + p.pos) !== "pos_" + p.pos ? t("pos_" + p.pos) + " · " : ""}{E.age(p)} {t("years")}</T>
          <T v="h1" style={{ fontSize: 26 }}>{E.name(p)}</T>
          <Row wrap gap={6}>
            {(mods.belastung || pr.st === "inj") && pr.st !== "none" ? <StatusChip status={pr.st} label={t("st_" + pr.st)} /> : null}
            {pr.reasons.filter(r => !r[1].startsWith("ACWR") && ![t("st_low"), t("st_crit"), t("st_warn")].includes(r[1])).map(([k, r], i) => <Chip key={i} label={r} color={statusColor(c, k.replace(/^k-/, ""))} />)}
            {(p.groups || []).map(g => { const gg = E.D.groups.find(x => x.id === g); return gg ? <GroupChip key={g} group={gg} /> : null; })}
            {p.neu ? <Chip label={t("newP")} color={c.low} /> : null}
          </Row>
          {nx?.train ? <MyTarget pid={p.id} date={nx.date} detail label={`${E.wt(nx.date)} ${E.de(nx.date)}`} testID="profile-target" /> : null}
          <Row gap={8} wrap>
            <Btn small testID="profile-edit" label={t("pr_edit")} onPress={() => setEdit(p)} />
            {p.neu ? <Btn small testID="profile-merge" label={t("kd_merge")} onPress={() => setMerge(p)} /> : null}
          </Row>
        </Col>
      </Row>
      {adv && E.lvl(1) ? <T style={{ fontWeight: "600" }}>{adv}</T> : null}
      <Row wrap gap={8}>
        {mods.belastung && E.lvl(2) ? <>
          <Kpi label={t("k_acwr")} value={m && m.acwr != null ? E.num(m.acwr, 2) : "–"} term="acwr" />
          <Kpi label={t("k_7")} value={m ? E.int(m.wk) : "–"} term="au" />
          <Kpi label={t("k_wk")} value={m ? E.int(m.chronic) : "–"} term="acwr" />
        </> : null}
        {mods.beteiligung ? <Kpi label={t("k_att")} value={pr.att != null ? Math.round(pr.att * 100) + " %" : "–"} /> : null}
        {mods.belastung ? <>
          <Kpi label={t("k_sleep")} value={pr.sl != null ? E.num(pr.sl, 1) + " h" : "–"} color={pr.sl != null && pr.sl < pr.tg[0] ? c.warn : undefined} sub={`${t("sleepTarget")} ${pr.tg[0]}–${pr.tg[1]} h`} />
          <Kpi label={t("k_well")} value={pr.w0 ? String(pr.w0.sum) : "–"} />
        </> : null}
      </Row>
    </Card>
  );

  const regen = rec ? (
    <Card testID="profile-regen">
      <CardTitle title={t("regen")} info={<Info title={t("regen")} text={t("rt_note")} />} />
      {rec.none ? <Muted>{t("noIntense")}</Muted> : <>
        <Row gap={14}>
          <Ring pct={rec.pct} color={recCol} size={64} />
          <Col gap={3} style={{ flex: 1 }}>
            <T bold style={{ color: recCol, fontSize: 16 }}>{rec.remaining > 0 ? t("recIn") + " " + fmtH(rec.remaining) : t("recovered")}</T>
            <Muted small>{t("lastIntense")}: {E.wt(rec.ev!.date)} {E.de(rec.ev!.date)} · {rec.ev!.typ === "Spiel" ? t("it_match") : t("it_training")}{E.lvl(2) ? " · RPE " + rec.ev!.rpe : ""} · {rec.ev!.min} {t("min")}</Muted>
            {rec.next ? <Muted small>{t("nextIntense")}: {E.wt(rec.next.date)} {E.de(rec.next.date)}{rec.next.match ? " · " + t("it_match") : ""}</Muted> : null}
          </Col>
        </Row>
        {E.lvl(2) && rec.need ? <Col gap={4}>
          {rec.need.lines.map(([l, v], i) => <Row key={i} between><Muted small style={{ flex: 1 }}>{l}</Muted><T v="small" bold>{i > 0 && v > 0 ? "+" : ""}{v} {t("hours")}</T></Row>)}
          <Row between><T v="small" bold>{t("totalRec")}</T><T v="small" bold>{rec.need.h} {t("hours")}</T></Row>
        </Col> : null}
      </>}
    </Card>
  ) : null;

  const growth = pr.gr ? (
    <Card>
      <CardTitle title={t("growth")} right={<Chip label={E.num(pr.gr.rate, 1) + " cm"} color={pr.gr.spurt ? c.warn : c.ok} />} />
      <Row wrap gap={8}><Kpi label={t("height")} value={E.num(pr.gr.cm, 1) + " cm"} /><Kpi label={t("growthRate")} value={E.num(pr.gr.rate, 1)} color={pr.gr.spurt ? c.warn : undefined} /></Row>
      <T v="small" color={pr.gr.spurt ? c.ink : c.muted}>{pr.gr.spurt ? t("spurt") : t("noSpurt")}</T>
    </Card>
  ) : null;

  const load = mods.belastung && E.lvl(2) && series.length ? (
    <Card>
      <CardTitle title={t("loadTitle")} />
      <LoadChart series={series} label={t("loadTitle")} dateLabel={E.de} />
      <Row wrap gap={14}>
        <Muted small><Text style={{ color: c.accent }}>■</Text> {t("lg_load")}</Muted>
        <Row gap={6}><Muted small><Text style={{ color: c.ink }}>—</Text> {t("lg_acwr")}</Muted><TermInfo k="acwr" testID="term-acwr-chart" /></Row>
        <Muted small><Text style={{ color: c.ok }}>■</Text> {t("lg_sweet")}</Muted>
      </Row>
    </Card>
  ) : null;

  const absCard = mods.beteiligung ? (
    <Card style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("abs")} right={<Btn small testID="profile-abs-add" label={t("pr_absAdd")} onPress={() => sheets.open({ k: "abs", pid: p.id })} />} />
      {abs.length ? abs.map(a => <ListItem key={a.id} title={t("ab_" + a.typ) + (a.notiz ? " · " + a.notiz : "")} sub={`${E.de(a.von)} – ${a.bis ? E.de(a.bis) : t("ongoing")} · ${diff(a.von, a.bis || E.TODAY) + 1} ${t("days")}`}
        right={a.typ === "verletzung" ? <Chip label={a.bis && a.bis < E.TODAY ? "✓" : `${t("stage")} ${a.stufe || 1}/4`} color={a.bis && a.bis < E.TODAY ? c.ok : c.inj} /> : undefined} />) : <Muted>{t("noEntries")}</Muted>}
    </Card>
  ) : null;

  const notes = (
    <Card style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("notes")} />
      <Field testID="profile-note" label={t("notes")} value={noteVal} onChangeText={setNote} placeholder={t("notesPh")} multiline />
      {note != null && note !== (E.D.notes[p.id] || "") ? <Btn small kind="primary" testID="profile-note-save" label={t("pr_notesSave")} onPress={() => { s.saveNote(p.id, note); setNote(null); s.toast(t("t_saved")); }} style={{ alignSelf: "flex-start" }} /> : null}
    </Card>
  );

  return (
    <Screen testID="coach-spieler">
      <Btn small kind="ghost" icon="back" label={t("nav_kader")} onPress={back} style={{ alignSelf: "flex-start" }} />
      {head}
      <RecCard key={"rec" + p.id} p={p} />
      {regen}
      {growth}
      {load}
      {mods.befunde || pr.st === "inj" ? <InjuryCard p={p} /> : null}
      {mods.leistung ? <PerfCard p={p} editable /> : null}
      <GamesCard p={p} />
      <PotCard p={p} />
      <ExtraCard p={p} />
      {wide ? <Row align="flex-start" gap={18}>{absCard}{notes}</Row> : <>{absCard}{notes}</>}
      <PlayerSheet player={edit} onClose={() => { setEdit(undefined); if (!E.P(id)) back(); }} />
      <MergeSheet newPlayer={merge} onClose={() => { setMerge(null); if (!E.P(id)) router.replace("/coach/kader"); }} />
      {sheets.el}
    </Screen>
  );
}
