// Spielerprofil (Trainer) nach dem Muster Übersicht → Bereich:
// - ProfileOverview (/coach/spieler/[id]): Kopf (Bild, Name, Status, Empfehlung fürs Training, Aktionen), wenige
//   Kennzahlen und die Bereiche als Zeilen mit dem wichtigsten Wert.
// - ProfileSection (/coach/spieler/[id]/[sec]): je Bereich eine Seite mit Befund, Daten, Eingaben und „Hintergrund &
//   Quellen“ (Wiki). Bereiche: load (Belastung & Erholung), health (Gesundheit), rec (Empfehlung an den Spieler),
//   perf (Leistungsdiagnostik), games (Spiele & Bewertungen), pot (Potenziale & Ziele), abs (Abwesenheiten), notes (Notizen).
//   Entwicklung führt auf die bestehende Seite /coach/entwicklung/[id].
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { canDirect, chatSettings } from "../../core/chat";
import { moveTargets } from "../../core/club";
import { diff } from "../../core/dates";
import { assessmentsOf, goalProgress, goalsOf } from "../../core/dev";
import type { Player } from "../../core/types";
import { divesIn } from "../../core/units";
import { useEngine, useStore } from "../../data/store";
import { BodyMapView } from "../bodyMap";
import { LoadChart, Ring } from "../charts";
import { MoveSheet } from "../club";
import { Icon, type IconName } from "../icons";
import { MyTarget } from "../indiv";
import { InjuryCard, currentInjury } from "../injury";
import { WikiBackground } from "../insight";
import { BackLink, Banner, Btn, Chip, Col, Field, Header, Metric, Metrics, Muted, NavRow, PageTitle, Row, Screen, Section, StatusChip, T } from "../kit";
import { PerfCard } from "../perf";
import { usePlanSheets } from "../plan/sheets";
import { PlayerAvatar } from "../playerAvatar";
import { TermInfo } from "../termInfo";
import { radius, statusColor, useTheme } from "../theme";
import { GroupChip } from "./Groups";
import { MergeSheet, PlayerSheet } from "./PlayerForm";
import { ExtraCard, GamesCard, PotCard, RecCard } from "./ProfileCards";

export type SecKey = "load" | "health" | "rec" | "perf" | "games" | "pot" | "abs" | "notes";
export const SEC_KEYS: SecKey[] = ["load", "health", "rec", "perf", "games", "pot", "abs", "notes"];

/** Aktuelle Krankmeldung (Verletzungen laufen über currentInjury) */
function sickNow(E: ReturnType<typeof useEngine>, pid: string) {
  return E.D.absences.find(a => a.pid === pid && a.typ === "krank" && a.von <= E.TODAY && (!a.bis || a.bis >= E.TODAY)) || null;
}
const sickTxt = (E: ReturnType<typeof useEngine>, a: { bis?: string | null }) => `${E.t("ab_krank")}, ${E.t("until")} ${a.bis ? E.de(a.bis) : E.t("ongoing")}`;

/** Bereiche des Profils, die es für dieses Team gibt (Module) – mit Zeilentext und Wert */
function useSections(p: Player | undefined) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  if (!p) return [];
  const pr = E.profile(p.id), mods = E.mods, m = pr.m, rec = pr.rec;
  const fmtH = (h: number) => h < 1 ? "<1 " + t("hours") : Math.round(h) + " " + t("hours");
  const L: { k: SecKey | "dev"; icon: IconName; color: string; title: string; sub?: string; subLines?: number; value?: string | null; valueColor?: string }[] = [];
  if (mods.belastung) {
    const recTxt = !rec ? undefined : rec.none ? t("noIntense") : rec.remaining > 0 ? `${t("recIn")} ${fmtH(rec.remaining)}` : t("recovered");
    L.push({ k: "load", icon: "pulse", color: pr.st !== "none" ? statusColor(c, pr.st) : c.accentTx, title: t("ps_load"),
      sub: [pr.st !== "none" ? t("st_" + pr.st) : "", recTxt].filter(Boolean).join(", "),
      value: E.lvl(2) && m && m.acwr != null && pr.st !== "inj" ? E.num(m.acwr, 2) : null, valueColor: statusColor(c, pr.st) });
  }
  const inj = currentInjury(E, p.id), injOn = !!inj && (!inj.bis || inj.bis >= E.TODAY);
  const sore = pr.w0 && pr.w0.beschw !== "none", sick = injOn ? null : sickNow(E, p.id);
  if (mods.befunde || pr.st === "inj" || sore || pr.gr || mods.belastung) {
    L.push({ k: "health", icon: "heart", color: sore && !injOn && !sick ? (pr.w0!.beschw === "clear" ? c.crit : c.warn) : c.inj, title: t("ps_health"),
      sub: injOn ? `${inj!.notiz || t("ab_verletzung")}${inj!.stufe ? ", " + t("stage") + " " + inj!.stufe + "/4" : ""}` : sick ? sickTxt(E, sick) : sore ? E.soreWhy(pr.w0!) : pr.gr?.spurt ? t("r_spurt") : t("inj_none"),
      value: injOn || sick ? t("sts_inj") : null, valueColor: injOn || sick ? c.inj : undefined });
  }
  const sg = E.suggestRec(p), act = E.activeMsgs(p.id).at(-1);
  L.push({ k: "rec", icon: "send", color: c.accentTx, title: t("rec_title"), sub: act ? `${t("ry_" + act.typ)}: ${act.text}` : `${t("rec_sugg")}: ${t("ry_" + sg.typ)}` });
  if (mods.leistung) {
    const T = E.D.tests.filter(x => x.pid === p.id), last = T.map(x => x.date).sort().at(-1), keys = new Set(T.map(x => x.test)).size;
    L.push({ k: "perf", icon: "stopwatch", color: c.ok, title: t("lt_title"), sub: last ? tf("ps_lastTest", { d: E.de(last) }) : t("ps_noTests"), value: keys ? String(keys) : null });
  }
  if (mods.spielanalyse || mods.videos) {
    const ss = E.seasonStats(p.id);
    L.push({ k: "games", icon: "ball", color: c.low, title: t("pr_games"), sub: mods.spielanalyse ? tf("ps_games", { g: ss.games, m: ss.min }) : undefined,
      value: mods.spielanalyse && ss.avg != null ? E.num(ss.avg, 1) : null });
  }
  if (mods.entwicklung) {
    // Kurzfassung: neue Selbsteinschätzung bzw. noch nie eingeschätzt, laufende Ziele (davon hinter Plan), nächstes Gespräch – Details auf der Entwicklungsseite
    const goals = goalsOf(E.D, p.id).filter(g => g.status === "active"), behind = goals.filter(g => goalProgress(E.D, g, E.TODAY).behind).length;
    const coach = assessmentsOf(E.D, p.id, "coach")[0], self = assessmentsOf(E.D, p.id, "self")[0], selfNew = !!self && (!coach || self.date > coach.date);
    const talk = E.D.talks.filter(x => x.pid === p.id).sort((a, b) => a.date < b.date ? 1 : -1)[0], due = !!talk?.next && talk.next <= E.TODAY;
    L.push({ k: "dev", icon: "trend", color: c.event, title: t("dv_title"), subLines: 2,
      sub: [selfNew ? t("dv_ovSelfNew") : !coach ? t("ps_notAssessed") : "", goals.length ? tf("ps_goals", { n: goals.length }) + (behind ? ", " + tf("dv_ovBehind", { n: behind }) : "") : t("ps_noGoals"), talk?.next ? `${t("dv_ovTalk")} ${E.de(talk.next)}` : ""].filter(Boolean).join(" · "),
      value: due ? t("ps_due") : selfNew ? t("newP") : null, valueColor: due || selfNew ? c.warn : undefined });
  }
  const pot = (E.D.pot[p.id] || []).length;
  L.push({ k: "pot", icon: "star", color: c.warn, title: t("pot_title"), value: pot ? String(pot) : null, sub: pot ? undefined : t("pot_none") });
  if (mods.beteiligung) {
    const abs = E.D.absences.filter(a => a.pid === p.id), cur = abs.find(a => a.von <= E.TODAY && (!a.bis || a.bis >= E.TODAY));
    L.push({ k: "abs", icon: "calendar", color: c.build, title: t("abs"), sub: cur ? `${t("ab_" + cur.typ)}, ${t("until")} ${cur.bis ? E.de(cur.bis) : t("ongoing")}` : abs.length ? undefined : t("noEntries"), value: abs.length ? String(abs.length) : null });
  }
  const note = (E.D.notes[p.id] || "").trim();
  L.push({ k: "notes", icon: "note", color: c.muted, title: t("notes"), sub: note ? note.split("\n")[0] : t("ps_noNote") });
  return L;
}

const back = (router: ReturnType<typeof useRouter>, to: string) => () => router.canGoBack() ? router.back() : router.replace(to);

// ===================================================================== Übersicht
export function ProfileOverview({ id }: { id: string }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const { width } = useWindowDimensions(); const wide = width >= 900;
  const [edit, setEdit] = useState<Player | null | undefined>(undefined);
  const [merge, setMerge] = useState<Player | null>(null);
  const [move, setMove] = useState<Player | null>(null);
  const p = E.P(id);
  const goBack = back(router, "/coach/kader");
  const secs = useSections(p);
  if (!p) return <Screen testID="coach-spieler"><Header title={t("nav_kader")} onBack={goBack} backLabel={t("nav_kader")} /><Muted>{t("err_not_found")}</Muted></Screen>;

  const pr = E.profile(p.id), m = pr.m, mods = E.mods, nx = E.nextItem();
  const adv = E.advice(pr);
  const chatSt = chatSettings(E.team), chatP = mods.chat && chatSt.on ? E.D.chatPeople.find(x => x.pid === p.id) : undefined;
  const meKind = E.D.chatPeople.find(x => x.uid === s.chatMeId)?.kind;
  const canMove = s.can("squad") && !p.neu && !!s.active && !(s.isDemo && s.demoStaff) && moveTargets(s.memberships, { teamId: s.active.teamId, role: s.active.role, clubId: E.team.clubId }).length > 0;
  const openChat = async () => { if (!chatP) return; const cid = await s.chatOpen("direct", null, chatP.uid); if (cid) router.push("/coach/chat/" + cid); };
  const pickPhoto = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (r.canceled || !r.assets?.length) return;
      await s.uploadPhoto(p.id, r.assets[0].uri); s.toast(t("pr_photoSaved"));
    } catch (e) { s.toast(s.errText(e)); }
  };
  const go = (k: string) => router.push(k === "dev" ? "/coach/entwicklung/" + p.id : "/coach/spieler/" + p.id + "/" + k);
  const posName = t("pos_" + p.pos) !== "pos_" + p.pos ? t("pos_" + p.pos) : "";
  const stOn = (mods.belastung || pr.st === "inj") && pr.st !== "none";
  const reasons = pr.reasons.filter(r => !r[1].startsWith("ACWR") && ![t("st_low"), t("st_crit"), t("st_warn")].includes(r[1]));

  const head = (
    <View testID="profile-head" style={{ gap: 14 }}>
      <Row gap={16} align="center">
        <Pressable testID="profile-photo" accessibilityRole="button" accessibilityLabel={t("pr_photo")} onPress={pickPhoto}>
          <PlayerAvatar p={p} size={wide ? 92 : 80} status={stOn ? pr.st : null} />
          <View style={{ position: "absolute", left: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }}>
            <Icon name="camera" size={15} color={c.muted} strokeWidth={2} />
          </View>
        </Pressable>
        <Col gap={3} style={{ flex: 1, minWidth: 0 }}>
          <T v="h1" style={{ fontSize: E.name(p).length > 16 ? 24 : 28, lineHeight: E.name(p).length > 16 ? 29 : 33 }}>{E.name(p)}</T>
          <Text style={{ fontSize: 15, color: c.muted }}>{[p.nr != null ? "#" + p.nr : "", posName || p.pos, `${E.age(p)} ${t("years")}`].filter(Boolean).join("  ·  ")}</Text>
        </Col>
      </Row>
      {stOn || reasons.length || (p.groups || []).length || p.neu || p.origin ? (
        <Row wrap gap={6}>
          {/* Bei Ausfall reicht der konkrete Grund („Krank“, „Reha-Stufe 2“) statt zusätzlich „Verletzt / krank“ */}
          {stOn && !(pr.st === "inj" && reasons.some(r => r[0] === "inj")) ? <StatusChip status={pr.st} label={t("st_" + pr.st)} /> : null}
          {reasons.map(([k, r], i) => <Chip key={i} label={r} color={statusColor(c, k.replace(/^k-/, ""))} />)}
          {(p.groups || []).map(g => { const gg = E.D.groups.find(x => x.id === g); return gg ? <GroupChip key={g} group={gg} /> : null; })}
          {p.neu ? <Chip label={t("newP")} color={c.low} /> : null}
          {p.origin ? <Chip testID="profile-origin" label={E.tf("cl_from", { t: p.origin })} color={c.accentTx} /> : null}
        </Row>
      ) : null}
      {adv && E.lvl(1) ? (
        <Pressable testID="profile-advice" accessibilityRole="button" accessibilityLabel={adv} onPress={() => go(mods.belastung ? "load" : "health")}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: pressed ? c.sunk : c.surface, borderRadius: radius.tile, borderWidth: 1, borderColor: c.line, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 })}>
          <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: statusColor(c, pr.st === "none" ? "build" : pr.st) }} />
          <Text numberOfLines={3} style={{ flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "600", color: c.ink }}>{adv}</Text>
          <Icon name="chevron" size={15} color={c.faint} strokeWidth={2.4} />
        </Pressable>
      ) : null}
      {nx?.train ? <MyTarget pid={p.id} date={nx.date} label={`${E.wt(nx.date)} ${E.de(nx.date)}`} testID="profile-target" /> : null}
      {(chatP && meKind && canDirect(chatSt, meKind, "player")) || p.neu || canMove ? (
        <Row gap={8} wrap>
          {chatP && meKind && canDirect(chatSt, meKind, "player") ? <Btn small testID="profile-chat" icon="chat" label={t("ch_direct")} onPress={openChat} /> : null}
          {p.neu ? <Btn small testID="profile-merge" icon="layers" label={t("kd_merge")} onPress={() => setMerge(p)} /> : null}
          {canMove ? <Btn small testID="profile-move" icon="redo" label={t("cl_move")} onPress={() => setMove(p)} /> : null}
        </Row>
      ) : null}
    </View>
  );

  // Kennzahlen: nur die drei, vier wichtigsten – Details im Bereich „Belastung & Erholung“
  const kpis = mods.belastung || mods.beteiligung ? (
    <Metrics testID="profile-kpis">
      {mods.belastung && E.lvl(2) ? <Metric testID="profile-kpi-acwr" label="ACWR" value={m && m.acwr != null && pr.st !== "inj" ? E.num(m.acwr, 2) : "–"} dot={stOn ? statusColor(c, pr.st) : undefined} sub={stOn ? t("st_" + pr.st) : undefined} onPress={() => go("load")} /> : null}
      {mods.beteiligung ? <Metric testID="profile-kpi-att" label={t("kt_att")} value={pr.att != null ? String(Math.round(pr.att * 100)) : "–"} unit={pr.att != null ? "%" : undefined} color={pr.att != null && pr.att < 0.8 ? c.warn : undefined} sub={t("kt_attSub")} onPress={mods.beteiligung ? () => go("abs") : undefined} /> : null}
      {mods.belastung ? <Metric testID="profile-kpi-sleep" label={t("kt_sleep")} value={pr.sl != null ? E.num(pr.sl, 1) : "–"} unit={pr.sl != null ? "h" : undefined} color={pr.sl != null && pr.sl < pr.tg[0] ? c.warn : undefined} sub={`${t("sleepTarget")} ${pr.tg[0]}–${pr.tg[1]} h`} onPress={() => go("load")} /> : null}
    </Metrics>
  ) : null;

  const list = (
    <Section title={t("ps_areas")} testID="profile-secs">
      {secs.map(x => <NavRow key={x.k} testID={"profile-sec-" + x.k} icon={x.icon} iconColor={x.color} title={x.title} sub={x.sub} subLines={x.subLines} value={x.value} valueColor={x.valueColor} onPress={() => go(x.k)} />)}
    </Section>
  );

  return (
    <Screen testID="coach-spieler">
      <Row between>
        <BackLink label={t("nav_kader")} onPress={goBack} />
        <Btn small kind="ghost" testID="profile-edit" icon="pen" label={t("pr_edit")} onPress={() => setEdit(p)} />
      </Row>
      {wide ? <Row align="flex-start" gap={24}>
        <Col gap={20} style={{ flex: 1, minWidth: 0 }}>{head}{kpis}</Col>
        <Col gap={20} style={{ flex: 1, minWidth: 0 }}>{list}</Col>
      </Row> : <>{head}{kpis}{list}</>}
      <PlayerSheet player={edit} onClose={() => { setEdit(undefined); if (!E.P(id)) goBack(); }} />
      <MergeSheet newPlayer={merge} onClose={() => { setMerge(null); if (!E.P(id)) router.replace("/coach/kader"); }} />
      <MoveSheet player={move} onClose={moved => { setMove(null); if (moved) router.replace("/coach/kader"); }} />
    </Screen>
  );
}

// ===================================================================== Bereichsseiten
function LoadSection({ p }: { p: Player }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pr = E.profile(p.id), m = pr.m, rec = pr.rec, nx = E.nextItem();
  const series = m ? m.series.slice(-28) : [];
  const fmtH = (h: number) => h < 1 ? "<1 " + t("hours") : Math.round(h) + " " + t("hours");
  const recCol = !rec || rec.none ? c.ok : rec.notReady ? c.crit : rec.remaining > 0 ? c.warn : c.ok;
  const lvl2 = E.lvl(2);
  return (
    <>
      <Metrics testID="profile-load-kpis">
        {lvl2 ? <>
          <Metric label="ACWR" value={m && m.acwr != null ? E.num(m.acwr, 2) : "–"} dot={pr.st !== "none" ? statusColor(c, pr.st) : undefined} />
          <Metric label={t("k_7")} value={m ? E.int(m.wk) : "–"} unit="AU" />
          <Metric label={t("k_wk")} value={m ? E.int(m.chronic) : "–"} unit="AU" />
        </> : null}
        <Metric label={t("k_well")} value={pr.w0 ? String(pr.w0.sum) : "–"} sub={t("k_wellSub")} />
        <Metric label={t("k_sleep")} value={pr.sl != null ? E.num(pr.sl, 1) : "–"} unit={pr.sl != null ? "h" : undefined} color={pr.sl != null && pr.sl < pr.tg[0] ? c.warn : undefined} sub={`${t("sleepTarget")} ${pr.tg[0]}–${pr.tg[1]} h`} />
        {E.isGK(p) ? <Metric label={t("tw_dives7")} value={(() => { const dv = divesIn(E.D, p.id, E.TODAY, 7); return dv.n ? String(dv.sum) : "–"; })()} /> : null}
      </Metrics>
      {nx?.train ? <MyTarget pid={p.id} date={nx.date} detail label={`${E.wt(nx.date)} ${E.de(nx.date)}`} testID="profile-target-detail" /> : null}
      {rec ? (
        <Section title={t("regen")} pad testID="profile-regen">
          {rec.none ? <Muted>{t("noIntense")}</Muted> : <>
            <Row gap={14}>
              <Ring pct={rec.pct} color={recCol} size={64} />
              <Col gap={3} style={{ flex: 1 }}>
                <T bold style={{ color: recCol, fontSize: 16 }}>{rec.remaining > 0 ? t("recIn") + " " + fmtH(rec.remaining) : t("recovered")}</T>
                <Muted small>{t("lastIntense")}: {E.wt(rec.ev!.date)} {E.de(rec.ev!.date)}, {rec.ev!.typ === "Spiel" ? t("it_match") : t("it_training")}{lvl2 ? ", RPE " + rec.ev!.rpe : ""}, {rec.ev!.min} {t("min")}</Muted>
                {rec.next ? <Muted small>{t("nextIntense")}: {E.wt(rec.next.date)} {E.de(rec.next.date)}{rec.next.match ? ", " + t("it_match") : ""}</Muted> : null}
              </Col>
            </Row>
            {lvl2 && rec.need ? <Col gap={4}>
              {rec.need.lines.map(([l, v], i) => <Row key={i} between><Muted small style={{ flex: 1 }}>{l}</Muted><T v="small" bold>{i > 0 && v > 0 ? "+" : ""}{v} {t("hours")}</T></Row>)}
              <Row between><T v="small" bold>{t("totalRec")}</T><T v="small" bold>{rec.need.h} {t("hours")}</T></Row>
            </Col> : null}
          </>}
        </Section>
      ) : null}
      {lvl2 && series.length ? (
        <Section title={t("loadTitle")} pad testID="profile-loadchart">
          <LoadChart series={series} label={t("loadTitle")} dateLabel={E.de} />
          <Row wrap gap={14}>
            <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.accent }} /><Muted small>{t("lg_load")}</Muted></Row>
            <Row gap={6}><View style={{ width: 14, height: 2, backgroundColor: c.ink }} /><Muted small>{t("lg_acwr")}</Muted><TermInfo k="acwr" testID="term-acwr-chart" /></Row>
            <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.ok, opacity: 0.35 }} /><Muted small>{t("lg_sweet")}</Muted></Row>
          </Row>
        </Section>
      ) : null}
      <ExtraCard p={p} />
      <WikiBackground keys={["acwr", "au", "recovery", "hooper", "sleep"]} testID="profile-load-bg" />
    </>
  );
}

function HealthSection({ p }: { p: Player }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pr = E.profile(p.id), mods = E.mods;
  const sore = pr.w0 && pr.w0.beschw !== "none" ? E.soreEffect(p, pr.w0) || { how: "" } : null;
  return (
    <>
      {sore ? <Banner color={pr.w0!.beschw === "clear" ? c.crit : c.warn} testID="profile-sore">
        <Col gap={6}>
          <T bold>{E.soreWhy(pr.w0!)}, {t(pr.w0!.beschw === "clear" ? "pw_clear" : "pw_light")}</T>
          <BodyMapView areas={pr.w0!.areas || []} pain={pr.w0!.pain} color={pr.w0!.beschw === "clear" ? c.crit : c.warn} testID="profile-body" compact />
          {pr.w0!.ort ? <T v="small">„{pr.w0!.ort}“</T> : null}
          {sore.how ? <T v="small">{t(sore.how)}</T> : null}
          {"flags" in sore && sore.flags.length ? <Col gap={2} testID="profile-flags">{sore.flags.map(f => <T key={f} v="small" bold>⚠ {t(f)}</T>)}</Col> : null}
        </Col>
      </Banner> : null}
      {mods.befunde || pr.st === "inj" ? <InjuryCard p={p} /> : null}
      {pr.gr ? (
        <Section title={t("growth")} pad testID="profile-growth">
          <Metrics>
            <Metric label={t("height")} value={E.num(pr.gr.cm, 1)} unit="cm" />
            <Metric label={t("growthRate")} value={E.num(pr.gr.rate, 1)} unit="cm" color={pr.gr.spurt ? c.warn : undefined} />
          </Metrics>
          <T v="small" color={pr.gr.spurt ? c.ink : c.muted}>{pr.gr.spurt ? t("spurt") : t("noSpurt")}</T>
        </Section>
      ) : null}
      {!sore && !(mods.befunde || pr.st === "inj") && !pr.gr ? <Muted>{t("inj_none")}</Muted> : null}
      <WikiBackground keys={["rtp", "complaints", "phv", "prevention"]} testID="profile-health-bg" />
    </>
  );
}

function AbsSection({ p }: { p: Player }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const sheets = usePlanSheets();
  const abs = E.D.absences.filter(a => a.pid === p.id).sort((a, b) => a.von < b.von ? 1 : -1);
  return (
    <>
      <Btn testID="profile-abs-add" kind="primary" icon="plus" label={t("pr_absAdd")} onPress={() => sheets.open({ k: "abs", pid: p.id })} style={{ alignSelf: "flex-start" }} />
      {abs.length ? (
        <Section title={t("abs")} testID="profile-abs">
          {abs.map(a => {
            const done = !!a.bis && a.bis < E.TODAY;
            return <NavRow key={a.id} title={t("ab_" + a.typ) + (a.notiz ? ": " + a.notiz : "")} sub={`${E.de(a.von)} – ${a.bis ? E.de(a.bis) : t("ongoing")}, ${diff(a.von, a.bis || E.TODAY) + 1} ${t("days")}`}
              right={a.typ === "verletzung" ? <Chip label={done ? "✓" : `${t("stage")} ${a.stufe || 1}/4`} color={done ? c.ok : c.inj} /> : undefined} />;
          })}
        </Section>
      ) : <Muted>{t("noEntries")}</Muted>}
      {sheets.el}
    </>
  );
}

function NotesSection({ p }: { p: Player }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [note, setNote] = useState<string | null>(null);
  const noteVal = note ?? (E.D.notes[p.id] || "");
  return (
    <Section pad testID="profile-notes">
      <Field testID="profile-note" label={t("notes")} value={noteVal} onChangeText={setNote} placeholder={t("notesPh")} multiline />
      {note != null && note !== (E.D.notes[p.id] || "") ? <Btn small kind="primary" testID="profile-note-save" label={t("pr_notesSave")} onPress={() => { s.saveNote(p.id, note); setNote(null); s.toast(t("t_saved")); }} style={{ alignSelf: "flex-start" }} /> : null}
    </Section>
  );
}

/** Bereichsseite des Profils */
export function ProfileSection({ id, sec }: { id: string; sec: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(id);
  const goBack = back(router, "/coach/spieler/" + id);
  if (!p) return <Screen narrow testID="coach-spieler-sec"><Header title={t("nav_kader")} onBack={back(router, "/coach/kader")} backLabel={t("nav_kader")} /><Muted>{t("err_not_found")}</Muted></Screen>;
  const k = (SEC_KEYS as string[]).includes(sec) ? sec as SecKey : "load";
  const pr = E.profile(p.id), adv = E.advice(pr);
  const title = { load: t("ps_load"), health: t("ps_health"), rec: t("rec_title"), perf: t("lt_title"), games: t("pr_games"), pot: t("pot_title"), abs: t("abs"), notes: t("notes") }[k];
  // Befund in einem Satz (wo es einen gibt)
  const inj = currentInjury(E, p.id), injOn = !!inj && (!inj.bis || inj.bis >= E.TODAY), sick = injOn ? null : sickNow(E, p.id);
  const sub = k === "load" ? (E.lvl(1) && adv ? adv : pr.st !== "none" ? t("st_" + pr.st) : undefined)
    : k === "health" ? (injOn ? tf("ps_injSince", { n: inj!.notiz || t("ab_verletzung"), d: E.de(inj!.von) }) : sick ? sickTxt(E, sick) : pr.w0 && pr.w0.beschw !== "none" ? E.soreWhy(pr.w0) : undefined)
    : k === "rec" ? t("ps_recSub") : undefined;
  const subColor = k === "load" && pr.st !== "none" ? statusColor(c, pr.st) : k === "health" ? (injOn || sick ? c.inj : c.warn) : undefined;
  const body = {
    load: <LoadSection p={p} />,
    health: <HealthSection p={p} />,
    rec: <RecCard key={"rec" + p.id} p={p} />,
    perf: <><PerfCard p={p} editable /><WikiBackground keys={["bands", "sprint", "cmj", "ift", "yoyo", "agility"]} testID="profile-perf-bg" /></>,
    games: <GamesCard p={p} />,
    pot: <PotCard p={p} />,
    abs: <AbsSection p={p} />,
    notes: <NotesSection p={p} />,
  }[k];
  return (
    <Screen narrow testID={"coach-spieler-" + k}>
      <Header onBack={goBack} backLabel={E.name(p)} title={title} sub={sub} subColor={subColor} />
      <PageTitle title={title}>{body}</PageTitle>
    </Screen>
  );
}

