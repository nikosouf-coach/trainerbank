// Trainer – Spielbericht: Ergebnis, Minuten/Tore/Vorlagen/Note je Spieler, Feedback, Videos zum Spiel.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { MatchStat, Video } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { RatingBadge, RatingInput, VideoList, VideoSheet } from "../../../src/ui/games";
import { Btn, Card, CardTitle, Check, Col, Field, Header, Muted, NumField, Row, Screen, Sheet, T, ToggleRow } from "../../../src/ui/kit";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { useTheme } from "../../../src/ui/theme";

function Stepper({ value, onChange, testID }: { value: number; onChange: (n: number) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Row gap={6}>
      <Btn small testID={testID ? testID + "-minus" : undefined} label="−" onPress={() => onChange(Math.max(0, value - 1))} style={{ width: 40 }} />
      <Text testID={testID} style={{ minWidth: 26, textAlign: "center", fontSize: 20, fontWeight: "800", color: c.ink }}>{value}</Text>
      <Btn small testID={testID ? testID + "-plus" : undefined} label="+" onPress={() => onChange(Math.min(20, value + 1))} style={{ width: 40 }} />
    </Row>
  );
}

export default function Spiel() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const m = E.D.matches.find(x => x.id === id);
  const [own, setOwn] = useState<number | null>(m?.result?.own ?? null);
  const [opp, setOpp] = useState<number | null>(m?.result?.opp ?? null);
  const [sel, setSel] = useState<string | null>(null);
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/kalender");
  if (!m) return <Screen testID="coach-spiel"><Header title={t("sp_title")} onBack={back} backLabel={t("nav_kalender")} /><Muted>{t("err_not_found")}</Muted></Screen>;
  const st = E.D.stats[m.id] || {};
  const rated = (pid: string) => E.D.ratings.find(r => r.pid === pid && r.date === m.date && r.kind === "spiel");
  const players = E.D.players.slice().sort((a, b) => (st[b.id]?.min || 0) - (st[a.id]?.min || 0) || (a.nr ?? 99) - (b.nr ?? 99));
  const goals = Object.entries(st).filter(([, x]) => x.goals > 0).map(([pid, x]) => `${E.P(pid)?.vn || "?"}${x.goals > 1 ? " " + x.goals + "×" : ""}`);
  const fillFromRpe = () => { let n = 0; for (const p of E.D.players) { const e = E.D.rpe[p.id]?.[m.date]; if (e && e.min && !st[p.id]) { s.saveStat(m.id, p.id, { min: e.min, goals: 0, assists: 0, start: e.min >= 60 }); n++; } } s.toast(tf("sp_filled", { n })); };
  const sp = sel ? E.P(sel) : null;

  return (
    <Screen testID="coach-spiel">
      <Header onBack={back} backLabel={t("nav_kalender")} eyebrow={`${t("sp_title")} · ${E.wt(m.date)} ${E.de(m.date)} · ${m.heim ? t("home") : t("away")} · ${t("comp_" + m.comp)}`} title={`${t("vs")} ${m.gegner}`} />
      <Card testID="sp-result">
        <CardTitle title={t("sp_result")} />
        <Row gap={10} align="flex-end" wrap>
          <NumField testID="sp-own" label={t("sp_own")} value={own} onChange={setOwn} min={0} max={99} step={1} style={{ width: 90 }} />
          <Text style={{ fontSize: 26, fontWeight: "800", color: c.muted, paddingBottom: 6 }}>:</Text>
          <NumField testID="sp-opp" label={t("sp_opp")} value={opp} onChange={setOpp} min={0} max={99} step={1} style={{ width: 90 }} />
          <Btn testID="sp-result-save" kind="primary" label={t("sp_resultSave")} disabled={own == null || opp == null}
            onPress={() => { s.saveMatch({ ...m, result: { own: own!, opp: opp! } }); s.toast(t("t_saved")); }} />
        </Row>
        {goals.length ? <Muted small>⚽ {goals.join(", ")}</Muted> : null}
      </Card>
      <Card testID="sp-players">
        <CardTitle title={t("tab_spieler")} right={<Btn small testID="sp-fill" label={t("sp_fill")} onPress={fillFromRpe} />} />
        {!Object.keys(st).length ? <Muted small>{t("sp_none")}</Muted> : null}
        {players.map(p => {
          const x = st[p.id], r = rated(p.id), ab = E.absenceOn(p.id, m.date);
          return (
            <Pressable key={p.id} testID={"sp-p-" + p.id} accessibilityRole="button" accessibilityLabel={E.name(p)} onPress={() => setSel(p.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line, opacity: ab && !x ? 0.5 : 1 }}>
              <PlayerAvatar p={p} size={34} />
              <Col gap={1} style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 14.5, color: c.ink }}>{E.name(p)}</Text>
                <Text style={{ fontSize: 12.5, color: c.muted }}>{x ? `${x.min}′${x.start ? " · " + t("sp_start") : ""}${x.goals ? " · ⚽ " + x.goals : ""}${x.assists ? " · 🅰 " + x.assists : ""}` : ab ? t("ab_" + ab.typ) : t("sp_bench")}</Text>
              </Col>
              {r?.text ? <Text style={{ fontSize: 15 }}>💬</Text> : null}
              <RatingBadge value={r?.rating ?? null} size="s" />
            </Pressable>
          );
        })}
      </Card>
      <Card testID="sp-videos">
        <CardTitle title={t("sp_videos")} right={<Btn small icon="plus" testID="sp-video-add" label={t("vd_add")} onPress={() => setVideo(null)} />} />
        <VideoList videos={E.D.videos.filter(v => v.matchId === m.id)} onEdit={setVideo} />
      </Card>
      <VideoSheet video={video} defaults={{ matchId: m.id, date: m.date, title: `${t("vs")} ${m.gegner}` }} onClose={() => setVideo(undefined)} />
      <Sheet visible={!!sp} onClose={() => setSel(null)} title={sp ? E.name(sp) : ""} testID="sp-sheet" closeLabel={t("cancel")}>
        {sp ? <PlayerMatchForm key={sp.id} pid={sp.id} matchId={m.id} date={m.date} onDone={() => setSel(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

function PlayerMatchForm({ pid, matchId, date, onDone }: { pid: string; matchId: string; date: string; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const x = E.D.stats[matchId]?.[pid], r = E.D.ratings.find(z => z.pid === pid && z.date === date && z.kind === "spiel");
  const rpeMin = E.D.rpe[pid]?.[date]?.min;
  const [min, setMin] = useState<number | null>(x?.min ?? rpeMin ?? E.matchMin());
  const [start, setStart] = useState(x?.start ?? true);
  const [goals, setGoals] = useState(x?.goals ?? 0);
  const [assists, setAssists] = useState(x?.assists ?? 0);
  const [rating, setRating] = useState<number | null>(r?.rating ?? null);
  const [text, setText] = useState(r?.text || "");
  const [vis, setVis] = useState(r ? r.vis : true);
  const save = () => {
    const stat: MatchStat = { min: Math.max(0, min || 0), goals, assists, start };
    s.saveStat(matchId, pid, stat.min || goals || assists ? stat : null);
    if (rating != null || text.trim()) s.saveRating({ id: r?.id || tmpId(), pid, date, kind: "spiel", rating, text: text.trim(), vis });
    else if (r) s.deleteRating(r.id);
    s.toast(t("t_saved")); onDone();
  };
  return (
    <Col gap={12}>
      <Row wrap gap={14} align="flex-end">
        <NumField testID="spf-min" label={t("pe_min")} value={min} onChange={setMin} min={0} max={150} step={1} style={{ width: 110 }} />
        <Check testID="spf-start" label={t("sp_start")} value={start} onChange={setStart} />
      </Row>
      <Row wrap gap={24}>
        <Col gap={4}><T v="small" bold>{t("sp_goals")}</T><Stepper testID="spf-goals" value={goals} onChange={setGoals} /></Col>
        <Col gap={4}><T v="small" bold>{t("sp_assists")}</T><Stepper testID="spf-assists" value={assists} onChange={setAssists} /></Col>
      </Row>
      <Col gap={6}><T v="small" bold>{t("gm_rating")}</T><RatingInput testID="spf-rate" value={rating} onChange={setRating} /></Col>
      <Field testID="spf-text" label={t("gm_feedback")} value={text} onChangeText={setText} placeholder={t("gm_feedbackPh")} multiline />
      <ToggleRow label={t("gm_visible")} desc={t("gm_visibleD")} value={vis} onChange={setVis} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn testID="spf-save" kind="primary" label={t("save")} onPress={save} />
        {x ? <Btn kind="ghost" label={t("sp_bench")} onPress={() => { s.saveStat(matchId, pid, null); onDone(); }} /> : null}
      </View>
    </Col>
  );
}

