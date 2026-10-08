// Trainer – Phase (Vorbereitung oder Pause): Wochenaufbau mit Ziel-Last und geplanter Last, Testtage, Spiele,
// Übernahme in die Wochenplanung, Spielerprogramm, Umsetzung durch die Spieler, KI-Fragen.
import { useLocalSearchParams, useRouter } from "expo-router";
import { teamLabel } from "../../../src/core/classes";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, monday, sum } from "../../../src/core/dates";
import { compliance, defaultProgram, skeleton, weekTotal, type WeekSkel } from "../../../src/core/prep";
import type { Phase, PhaseWeek, ProgItem } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { AiPanel } from "../../../src/ui/ai";
import { Icon } from "../../../src/ui/icons";
import { Banner, Bar, Btn, Card, CardTitle, Check, Col, Field, Header, Info, Muted, NumField, Row, Screen, Sheet, T, ToggleRow } from "../../../src/ui/kit";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { ItemIcon, ItemSheet, PhaseSheet, ROLE_COLOR, itemTitle, spanText } from "../../../src/ui/prep";
import { radius, useTheme, withAlpha } from "../../../src/ui/theme";

export default function PhaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [edit, setEdit] = useState(false), [del, setDel] = useState(false), [regen, setRegen] = useState(false);
  const [wk, setWk] = useState<WeekSkel | null>(null), [item, setItem] = useState<ProgItem | null>(null), [all, setAll] = useState(false);
  const ph = E.D.phases.find(p => p.id === id);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/vorbereitung");
  if (!ph) return <Screen testID="coach-phase"><Header title={t("vb_title")} onBack={back} backLabel={t("vb_title")} /><Muted>–</Muted></Screen>;

  const sk = skeleton(ph.kind, ph.from, ph.to), n = sk.length, prep = ph.kind === "prep";
  const save = (patch: Partial<Phase>) => s.savePhase({ ...ph, ...patch });
  const wOf = (ws: string): PhaseWeek => ph.weeks[ws] || {};

  // Bezugsgröße: normale Saisonwoche (aus Daten, sonst geschätzt)
  const S = E.team.settings, dayList = Object.values(S.days);
  const est = dayList.length * (dayList.reduce((a, d) => a + (d.dauer || S.dauer), 0) / Math.max(1, dayList.length)) * 5.5 + E.matchLoad();
  const chronic = E.teamChronic(), ref = Math.round(chronic || est);
  const planned = sk.map(w => { const wp = E.weekPlan(w.ws); return sum(wp.tr.map(p => p.rpe * p.dauer)) + wp.items.filter(x => x.match).length * E.matchLoad(); });
  // Vergangene Wochen: tatsächliche Last (Ø der Spieler mit Einträgen) statt Planung
  const isPast = (ws: string): boolean => addDays(ws, 6) < E.TODAY;
  const actual = sk.map(w => {
    // nur wenn Mannschaftseinheiten erfasst sind – sonst wären es nur die Zusatzeinheiten
    if (!isPast(w.ws) || !E.D.sessions.some(x => x.date >= w.ws && x.date <= addDays(w.ws, 6))) return null;
    const v = E.D.players.map(p => { const dl = E.daily(p.id); const ds = Object.keys(dl).filter(d => d >= w.ws && d <= addDays(w.ws, 6)); return ds.length ? sum(ds.map(d => dl[d])) : null; }).filter((x): x is number => x != null);
    return v.length >= 3 ? sum(v) / v.length : null;
  });
  const shown = sk.map((w, i) => isPast(w.ws) ? actual[i] ?? 0 : planned[i]);
  const scale = Math.max(ref * 1.3, ...shown, 1);
  let builds = 0;
  const minutesOf = (w: WeekSkel): number => w.role === "entry" ? 45 : w.role === "build" ? (builds++ === 0 ? 60 : 90) : w.role === "deload" ? 60 : 90;

  const applyModes = () => {
    const from = monday(E.TODAY); let k = 0;
    for (const w of sk) if (w.ws >= from) { s.setWeekMode(w.ws, w.mode); k++; }
    s.toast(tf("vb_applied", { n: k }));
  };
  const comp = ph.program.length && ph.from <= E.TODAY
    ? E.D.players.map(p => ({ p, c: compliance(E.D, p.id, ph, E.TODAY) })).filter(x => x.c.due > 0).sort((a, b) => (b.c.pct ?? 0) - (a.c.pct ?? 0)) : [];
  const avg = comp.length ? Math.round(comp.reduce((a, x) => a + (x.c.pct || 0), 0) / comp.length * 100) : null;

  const aiContext = (): string => {
    const L = [`${t("vb_kind_" + ph.kind)}: ${ph.title}, ${ph.from} – ${ph.to} (${n} ${t("vb_weeks").replace("{n} ", "")})`, `${teamLabel(E.team)}, ${E.grp}`];
    if (ph.firstMatch) L.push(`${t("vb_firstMatch")}: ${ph.firstMatch}`);
    sk.forEach((w, i) => L.push(`W${w.i} ${w.ws}: ${t("vb_r_" + w.role)}${prep ? `, ${t("vb_target").replace("{p}", String(wOf(w.ws).pct ?? w.pct))}, ${planned[i]} AU` : ""}${(wOf(w.ws).test ?? w.test) ? ", " + t("vb_test") : ""}`));
    L.push(`${t("vb_ref").replace("{au}", String(ref))}`);
    if (ph.program.length) L.push(t("vb_program") + ": " + ph.program.map(it => `${itemTitle(t, it)} ${spanText(tf, it)} ${it.perWeek}x ${it.min}′ RPE ${it.rpe}`).join("; "));
    const ms = E.D.matches.filter(m => m.date >= ph.from && m.date <= addDays(ph.to, 7)).map(m => `${m.date} ${m.gegner} (${m.comp})`);
    if (ms.length) L.push(t("vb_matches") + ": " + ms.join(", "));
    return L.join("\n");
  };

  return (
    <Screen testID="coach-phase">
      <Header eyebrow={t("vb_kind_" + ph.kind)} title={ph.title} onBack={back} backLabel={t("vb_title")}
        right={<Btn small testID="ph-edit" label={t("vb_edit")} onPress={() => setEdit(true)} />} />
      <Muted>{E.wt(ph.from)} {E.de(ph.from)} – {E.wt(ph.to)} {E.de(ph.to)} · {n === 1 ? t("vb_week1") : tf("vb_weeks", { n })}{ph.firstMatch ? ` · ${t("vb_firstMatch").replace(/\s*\(.*\)$/, "")}: ${E.wt(ph.firstMatch)} ${E.de(ph.firstMatch)}` : ""}</Muted>
      {!prep ? <Banner color="#16a3a3">{t("vb_noTraining")}</Banner> : null}

      <Card testID="ph-weeks">
        <CardTitle title={t("vb_period")} info={<Info title={t("vb_period")} text={prep ? [t("vb_periodInfo"), t("vb_refInfo")] : t("vb_breakInfo")} />} />
        {prep ? <Muted small>{tf("vb_ref", { au: E.int(ref) })} ({t(chronic ? "vb_refData" : "vb_refEst")})</Muted> : null}
        {sk.map((w, i) => {
          const pw = wOf(w.ws), pct = pw.pct ?? w.pct, test = pw.test ?? w.test, col = ROLE_COLOR[w.role], target = ref * pct / 100;
          const past = isPast(w.ws), val = shown[i];
          // Sprung gegenüber dem Niveau der letzten bis zu drei Wochen (Rückkehr nach einer Entlastungswoche ist kein Sprung)
          const prev = i ? Math.max(...shown.slice(Math.max(0, i - 3), i)) : 0, spike = prep && !past && prev > 0 && val > prev * 1.15 ? Math.round((val / prev - 1) * 100) : 0;
          const entryHigh = prep && !past && w.role === "entry" && val > target * 1.15;
          const ms = E.D.matches.filter(m => m.date >= w.ws && m.date <= addDays(w.ws, 6));
          const cur = w.ws <= E.TODAY && addDays(w.ws, 6) >= E.TODAY;
          const mins = minutesOf(w);
          return (
            <Pressable key={w.ws} testID={"ph-week-" + w.i} accessibilityRole="button" onPress={() => setWk(w)}
              style={{ borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 10, gap: 6, backgroundColor: cur ? withAlpha(col, 0.07) : undefined, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: cur ? radius.m : 0 }}>
              <Row gap={8} wrap>
                <Text style={{ fontWeight: "800", fontSize: 14, color: c.ink, fontVariant: ["tabular-nums"] }}>{tf("vb_wkLabel", { i: w.i })}</Text>
                <Text style={{ fontSize: 12.5, color: c.muted }}>{E.de(w.ws)} – {E.de(addDays(w.ws, 6))}</Text>
                <View style={{ backgroundColor: withAlpha(col, 0.15), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: col, fontWeight: "800", fontSize: 11.5 }}>{t("vb_r_" + w.role)}</Text></View>
                {test ? <View style={{ backgroundColor: withAlpha("#7b5fd0", 0.15), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: "#7b5fd0", fontWeight: "800", fontSize: 11.5 }}>⏱ {t("vb_test")}</Text></View> : null}
              </Row>
              <Text style={{ fontSize: 13, color: c.ink }}>{t("vb_f_" + (w.role === "build" && pct >= 110 ? "build2" : w.role))}</Text>
              {prep ? <Col gap={3}>
                <View style={{ height: 14, borderRadius: 4, backgroundColor: c.sunk, overflow: "hidden" }}>
                  <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, val / scale * 100)}%`, backgroundColor: spike || entryHigh ? c.warn : col, opacity: past ? 0.55 : 0.85 }} />
                  <View style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(99, target / scale * 100)}%`, width: 3, backgroundColor: c.ink }} />
                </View>
                <Row between><Text style={{ fontSize: 12, color: c.muted }}>{tf("vb_target", { p: pct })} · {E.int(Math.round(target))} AU</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: val ? c.ink : c.muted }}>{past ? (val ? tf("vb_ist", { au: E.int(Math.round(val)) }) : t("vb_noData")) : val ? tf("vb_plAU", { au: E.int(Math.round(val)) }) : t("vb_noPlan")}</Text></Row>
                {spike ? <Text style={{ fontSize: 12, fontWeight: "700", color: c.warn }}>⚠ {tf("vb_spike", { p: spike })}</Text> : null}
                {entryHigh ? <Text style={{ fontSize: 12, fontWeight: "700", color: c.warn }}>⚠ {t("vb_entryHigh")}</Text> : null}
              </Col> : null}
              {ms.length ? <Text style={{ fontSize: 12.5, color: c.accentTx }}>⚽ {ms.map(m => `${E.wt(m.date)} ${t("vs")} ${m.gegner}${m.comp !== "liga" ? " (" + t("comp_" + m.comp) + ")" : ""}`).join(" · ")}{prep && ms.some(m => m.comp === "test") ? " · " + tf("vb_minutes", { m: mins }) : ""}</Text> : null}
              {pw.note ? <Text style={{ fontSize: 12.5, color: c.muted, fontStyle: "italic" }}>{pw.note}</Text> : null}
            </Pressable>
          );
        })}
        {prep ? <Col gap={6}>
          <Btn testID="ph-apply" kind="primary" label={t("vb_apply")} onPress={applyModes} style={{ alignSelf: "flex-start" }} />
          <Muted small>{t("vb_applyInfo")}</Muted>
        </Col> : null}
      </Card>

      <Card testID="ph-program">
        <CardTitle title={t("vb_program")} info={<Info title={t("vb_program")} text={t("vb_programInfo")} />} />
        <ToggleRow testID="ph-vis" label={t("vb_vis")} value={ph.vis} onChange={v => save({ vis: v })} />
        <Row gap={4} wrap>{sk.map(w => <View key={w.i} style={{ backgroundColor: withAlpha(ROLE_COLOR[w.role], 0.13), borderRadius: radius.s, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: c.ink }}>W{w.i}: {weekTotal(ph, w.ws)}×</Text></View>)}</Row>
        {ph.program.length ? [...ph.program].sort((a, b) => a.from - b.from || a.to - b.to).map(it => (
          <Pressable key={it.id} testID={"ph-item-" + it.id} accessibilityRole="button" onPress={() => setItem(it)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line }}>
            <ItemIcon it={it} size={34} />
            <Col gap={2} style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 15, color: c.ink }}>{itemTitle(t, it)}</Text>
              <Text style={{ fontSize: 12.5, color: c.muted }}>{spanText(tf, it)} · {tf("vb_perWeekN", { n: it.perWeek })} · {it.min}′ · RPE {it.rpe}</Text>
            </Col>
            <Icon name="chevron" size={14} color={c.muted} />
          </Pressable>
        )) : <Muted>{t("vb_progEmpty")}</Muted>}
        <Row gap={8} wrap>
          <Btn small testID="ph-item-add" icon="plus" label={t("vb_addItem")} onPress={() => setItem({ id: "new", key: "kraft", min: 35, rpe: 6, perWeek: 1, from: 1, to: n })} />
          <Btn small kind="ghost" testID="ph-regen" label={t("vb_regen")} onPress={() => setRegen(true)} />
        </Row>
      </Card>

      {ph.program.length && ph.from <= E.TODAY ? <Card testID="ph-comp">
        <CardTitle title={t("vb_compliance")} info={<Info title={t("vb_compliance")} text={t("vb_compInfo")} />} right={avg != null ? <Muted small>{tf("vb_avg", { p: avg })}</Muted> : undefined} />
        {comp.length ? comp.slice(0, all ? comp.length : 8).map(({ p, c: x }) => {
          const pct = Math.round((x.pct || 0) * 100), col = pct >= 70 ? c.ok : pct >= 50 ? c.warn : c.crit;
          return (
            <Pressable key={p.id} testID={"ph-comp-" + p.id} accessibilityRole="button" onPress={() => router.push("/coach/spieler/" + p.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 }}>
              <PlayerAvatar p={p} size={28} />
              <Col gap={3} style={{ flex: 1 }}>
                <Row between><Text numberOfLines={1} style={{ fontWeight: "700", color: c.ink, fontSize: 14, flexShrink: 1 }}>{E.name(p)}</Text>
                  <Text style={{ fontWeight: "800", color: col, fontVariant: ["tabular-nums"] }}>{pct} %</Text></Row>
                <Bar value={x.pct || 0} color={col} />
                <Text style={{ fontSize: 11.5, color: c.muted }}>{x.done}/{x.due}{x.ownMin ? " · " + tf("vb_own", { m: x.ownMin }) : ""}</Text>
              </Col>
            </Pressable>
          );
        }) : <Muted>{t("vb_compNone")}</Muted>}
        {comp.length > 8 ? <Btn small kind="ghost" testID="ph-comp-all" label={all ? t("vb_less") : tf("vb_all", { n: comp.length })} onPress={() => setAll(!all)} style={{ alignSelf: "flex-start" }} /> : null}
        {comp.some(x => (x.c.pct || 0) < 0.5) ? <Muted small>{t("vb_compLow")}</Muted> : null}
      </Card> : null}

      {E.mods.ki ? <AiPanel mode="coach" testID="ph-ai" context={aiContext} quick={["vb_ai_q1", "vb_ai_q2", "vb_ai_q3"]} placeholder={t("vb_aiPh")} /> : null}

      <Btn kind="danger" testID="ph-delete" label={t("vb_delete")} onPress={() => setDel(true)} style={{ alignSelf: "flex-start" }} />

      <PhaseSheet visible={edit} kind={ph.kind} ph={ph} onClose={() => setEdit(false)} />
      <WeekSheet w={wk} ph={ph} onClose={() => setWk(null)} onSave={(ws, v) => save({ weeks: { ...ph.weeks, [ws]: v } })} />
      <ItemSheet it={item} n={n} onClose={() => setItem(null)}
        onSave={x => save({ program: x.id === "new" ? [...ph.program, { ...x, id: "pi-" + tmpId().slice(4) }] : ph.program.map(y => y.id === x.id ? x : y) })}
        onDelete={idx => save({ program: ph.program.filter(y => y.id !== idx) })} />
      <Sheet visible={regen} onClose={() => setRegen(false)} title={t("vb_regenQ")} testID="ph-regen-sheet" closeLabel={t("cancel")}>
        <Row gap={10}><Btn label={t("no")} onPress={() => setRegen(false)} />
          <Btn testID="ph-regen-ok" kind="primary" label={t("vb_regen")} onPress={() => { setRegen(false); save({ program: defaultProgram(ph.kind, ph.from, ph.to, E.grp, () => "pi-" + tmpId().slice(4)) }).then(() => s.toast(t("vb_regenDone"))); }} /></Row>
      </Sheet>
      <Sheet visible={del} onClose={() => setDel(false)} title={t("vb_delete")} testID="ph-del-sheet" closeLabel={t("cancel")}>
        <T>{t("vb_deleteQ")}</T>
        <Row gap={10}><Btn label={t("no")} onPress={() => setDel(false)} />
          <Btn testID="ph-del-ok" kind="danger" label={t("vb_delete")} onPress={() => { setDel(false); s.deletePhase(ph.id).then(() => s.toast(t("vb_deleted"))); back(); }} /></Row>
      </Sheet>
    </Screen>
  );
}

/** Eine Woche anpassen: Ziel-Last, Testwoche, Notiz; Sprung in die Wochenplanung. */
function WeekSheet({ w, ph, onClose, onSave }: { w: WeekSkel | null; ph: Phase; onClose: () => void; onSave: (ws: string, v: PhaseWeek) => void }) {
  const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const [v, setV] = useState<PhaseWeek>({}), [key, setKey] = useState<string | null>(null);
  if ((w?.ws || null) !== key) { setKey(w?.ws || null); if (w) { const o = ph.weeks[w.ws] || {}; setV({ pct: o.pct ?? w.pct, test: o.test ?? w.test, note: o.note || "" }); } }
  const prep = ph.kind === "prep";
  return (
    <Sheet visible={!!w} onClose={onClose} title={w ? tf("vb_weekEdit", { i: w.i }) : ""} testID="ph-week-sheet" closeLabel={t("cancel")}>
      {w ? <>
        <Muted>{E.de(w.ws)} – {E.de(addDays(w.ws, 6))} · {t("vb_r_" + w.role)}</Muted>
        {prep ? <NumField testID="ph-week-pct" label={t("vb_pct")} value={v.pct ?? null} onChange={x => setV(o => ({ ...o, pct: x ?? undefined }))} min={30} max={150} step={5} style={{ width: 140 }} /> : null}
        {prep ? <Check testID="ph-week-test" label={t("vb_testWeek")} value={!!v.test} onChange={x => setV(o => ({ ...o, test: x }))} /> : null}
        {prep && v.test ? <Muted small>{w.i === 1 ? t("vb_testIn") : t("vb_testOut")}</Muted> : null}
        <Field testID="ph-week-note" label={t("vb_note")} value={v.note || ""} onChangeText={x => setV(o => ({ ...o, note: x }))} multiline maxLength={500} />
        <Row gap={10} wrap>
          <Btn testID="ph-week-save" kind="primary" label={t("save")} onPress={() => { onSave(w.ws, { pct: v.pct, test: v.test, note: v.note?.trim() || undefined }); onClose(); }} />
          {prep ? <Btn testID="ph-week-plan" label={t("vb_toPlan")} onPress={() => { onClose(); router.push("/coach/plan?date=" + w.ws); }} /> : null}
          {prep && v.test && E.mods.leistung ? <Btn kind="ghost" label={t("vb_toTests")} onPress={() => { onClose(); router.push("/coach/leistung"); }} /> : null}
        </Row>
      </> : null}
    </Sheet>
  );
}
