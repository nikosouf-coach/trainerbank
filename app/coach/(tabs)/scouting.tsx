// Trainer – Kaderplanung & Scouting: Schattenkader (Spielfeld und Positionen), Saisonplanung, Scouting-Datenbank.
// Nur mit Recht „Scouting & Kaderplanung“ und eingeschaltetem Modul.
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { formationsOf } from "../../../src/core/matchplan";
import { addRef, autoAssign, eligibleYears, emptyPlanContent, isOut, newScout, playerState, refOf, remapPlan, seasonLabel, slotDepth } from "../../../src/core/scout";
import type { ScoutPlayer } from "../../../src/core/types";
import { isGoalkeeper } from "../../../src/core/units";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { Banner, Btn, Card, CardTitle, Col, Header, Info, Muted, Picker, Row, Screen, Seg, T, ToggleRow } from "../../../src/ui/kit";
import { PositionList, ShadowBoard } from "../../../src/ui/scout/board";
import { currentPlanSeason, SeasonSeg, usePlanData } from "../../../src/ui/scout/common";
import { ScoutDb } from "../../../src/ui/scout/db";
import { ScoutForm } from "../../../src/ui/scout/forms";
import { SeasonView } from "../../../src/ui/scout/season";
import { SlotSheet } from "../../../src/ui/scout/slotSheet";
import { useTheme } from "../../../src/ui/theme";

type View3 = "board" | "season" | "db";
let lastView: View3 = "board", lastMode: "pitch" | "list" = "pitch";

export default function Scouting() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [view, setView0] = useState<View3>(lastView); const [mode, setMode0] = useState(lastMode);
  const [season, setSeason] = useState(currentPlanSeason());
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState<ScoutPlayer | null>(null); const [toSlot, setToSlot] = useState<string | null>(null);
  const setView = (v: View3) => { lastView = v; setView0(v); };
  const setMode = (m: "pitch" | "list") => { lastMode = m; setMode0(m); };
  const P = usePlanData(season);
  useEffect(() => { if (E.team.clubId && E.mods.kaderplanung && s.can("scout")) s.loadRisers(season); }, [season, E.team.clubId]); // eslint-disable-line react-hooks/exhaustive-deps
  const openScout = (id: string) => { setSlot(null); router.push("/coach/scout/" + id); };
  const newCand = (pos?: string, key?: string) => {
    const e = eligibleYears(E.team.cls, season);
    setSlot(null); setToSlot(key || null);
    setForm({ ...newScout(tmpId(), new Date()), pos: pos ? [pos] : [], year: e ? e.max : null });
  };
  const header = <Header eyebrow={t("sk_eyebrow")} title={t("sk_title")} info={<Info title={t("sk_title")} text={t("sk_info")} />} />;
  if (!s.can("scout")) return <Screen testID="coach-scouting">{header}<Banner>{t("sk_noPerm")}</Banner></Screen>;
  if (!E.mods.kaderplanung) return (
    <Screen testID="coach-scouting">{header}
      <Card><T>{t("sk_modOff")}</T>
        {s.can("admin") ? <Btn kind="primary" testID="sk-mod-on" label={t("sk_modOn")} onPress={() => s.updateTeam({ modules: { ...E.team.modules, kaderplanung: true } })} style={{ alignSelf: "flex-start" }} />
          : <Muted small>{t("sk_modAdmin")}</Muted>}
      </Card>
    </Screen>
  );
  const fmt = P.fmt, content = P.content;
  const needN = content ? Object.values(content.slots).filter(x => slotDepth(x, P.info).level !== "ok").length : 0;
  return (
    <Screen testID="coach-scouting">
      {header}
      <Seg testID="sk-view" value={view} onChange={setView} options={[{ key: "board", label: t("sk_v_board") }, { key: "season", label: t("sk_v_season") }, { key: "db", label: t("sk_v_db") }]} />
      {view !== "db" ? <SeasonSeg value={season} onChange={setSeason} /> : null}

      {view !== "db" && !content ? <StartCard season={season} /> : null}

      {view === "board" && content ? <Col gap={12}>
        <Row gap={10} wrap style={{ alignItems: "flex-end" }}>
          <Picker testID="sk-formation" label={t("sk_formation")} value={content.formation} style={{ minWidth: 130 }}
            onChange={f => P.save(remapPlan(content, fmt, f))} options={formationsOf(fmt).map(f => ({ key: f, label: f }))} />
          <View style={{ flex: 1 }} />
          <Seg testID="sk-mode" value={mode} onChange={setMode} options={[{ key: "pitch", label: t("sk_overview") }, { key: "list", label: t("sk_list") }]} />
        </Row>
        <Banner color={needN ? c.warn : c.ok} testID="sk-needs-banner">{needN ? tf("sk_needsN", { n: needN }) : t("sk_needsNone")}</Banner>
        {mode === "pitch" ? <ShadowBoard fmt={fmt} content={content} info={P.info} onSlot={setSlot} /> : <PositionList fmt={fmt} content={content} info={P.info} onSlot={setSlot} />}
      </Col> : null}

      {view === "season" && content ? <SeasonView season={season} onSlot={k => { setView("board"); setSlot(k); }} onOpenScout={openScout} /> : null}

      {view === "db" ? <ScoutDb onOpen={openScout} onNew={() => newCand()} /> : null}

      <SlotSheet season={season} slotKey={slot} onClose={() => setSlot(null)} onOpenScout={openScout} onNewCandidate={(pos, key) => newCand(pos, key)} />
      <ScoutForm value={form} onClose={() => { setForm(null); setToSlot(null); }}
        onSaved={x => { if (toSlot && P.content) { P.save(addRef(P.content, toSlot, "shadow", refOf("s", x.id))); setSlot(toSlot); } setToSlot(null); }} />
      <View style={{ height: 8 }} />
    </Screen>
  );
}

/** Planung einer Saison beginnen: Grundordnung, eigene Spieler zuordnen, Schattenkandidaten der Vorsaison übernehmen */
function StartCard({ season }: { season: number }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const P = usePlanData(season), fmt = P.fmt;
  const prev = E.D.squadPlans.find(p => p.season === season - 1) || null;
  const [formation, setFormation] = useState(prev?.content.formation || formationsOf(fmt)[0]);
  const [auto, setAuto] = useState(true); const [copy, setCopy] = useState(!!prev); const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      let c0 = emptyPlanContent(fmt, formation);
      if (copy && prev) {
        // Schattenkandidaten (und Anforderungsprofile) der Vorsaison übernehmen, eigene Spieler neu zuordnen
        const from = remapPlan({ ...prev.content, slots: Object.fromEntries(Object.entries(prev.content.slots).map(([k, v]) => [k, { ...v, own: v.own.filter(r => !r.startsWith("p:")) }])) }, fmt, formation);
        c0 = { ...from, status: {}, notes: "" };
      }
      if (auto) c0 = autoAssign(c0, fmt, E.D.players.filter(p => !p.neu && !isOut(playerState(p, c0, E.team.cls, season))).map(p => ({ ref: refOf("p", p.id), pos: p.pos, gk: isGoalkeeper(E.D, p) })));
      await s.saveSquadPlan(season, c0);
    } finally { setBusy(false); }
  };
  return (
    <Card testID="sk-start">
      <CardTitle title={tf("sk_start", { s: seasonLabel(season) })} />
      <Muted small>{t("sk_startText")}</Muted>
      <Picker testID="sk-start-formation" label={t("sk_formation")} value={formation} onChange={setFormation} options={formationsOf(fmt).map(f => ({ key: f, label: f }))} style={{ maxWidth: 220 }} />
      <ToggleRow testID="sk-start-auto" label={t("sk_auto")} value={auto} onChange={setAuto} />
      {prev ? <ToggleRow testID="sk-start-copy" label={tf("sk_copyPrev", { s: seasonLabel(season - 1) })} value={copy} onChange={setCopy} /> : null}
      <Btn kind="primary" testID="sk-start-go" label={tf("sk_start", { s: seasonLabel(season) })} disabled={busy} onPress={start} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}
