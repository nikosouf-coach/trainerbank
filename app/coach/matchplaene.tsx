// Trainer – Matchpläne: nächste Spiele (Plan erstellen oder öffnen), Pläne ohne Spiel (z. B. Turnier), frühere Pläne.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { seenStats, shareState, squadOf } from "../../src/core/matchplan";
import type { Match, MatchPlan } from "../../src/core/types";
import { useEngine, useStore } from "../../src/data/store";
import { Btn, Card, CardTitle, Chip, Col, Header, Info, ListItem, Muted, Row, Screen } from "../../src/ui/kit";
import { Icon } from "../../src/ui/icons";
import { useTheme } from "../../src/ui/theme";

export default function Matchplaene() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/mehr");
  const can = s.can("plan"), now = new Date();
  const planOf = (m: Match) => E.D.plans.find(p => p.matchId === m.id) || null;
  const upcoming = E.D.matches.filter(m => m.date >= E.TODAY).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 6);
  const free = E.D.plans.filter(p => !p.matchId);
  const past = E.D.plans.filter(p => p.matchId && (E.D.matches.find(m => m.id === p.matchId)?.date || "") < E.TODAY)
    .sort((a, b) => (E.D.matches.find(m => m.id === a.matchId)?.date || "") < (E.D.matches.find(m => m.id === b.matchId)?.date || "") ? 1 : -1).slice(0, 12);
  const lastPlan = [...E.D.plans].sort((a, b) => (a.updatedAt || "") < (b.updatedAt || "") ? 1 : -1)[0] || null;
  const create = async (matchId: string | null, from?: string | null) => {
    setBusy(matchId || "free");
    try { const id = await s.createPlan(matchId, from); if (id) router.push("/coach/matchplan/" + id); } finally { setBusy(null); }
  };
  const status = (p: MatchPlan) => {
    const st = shareState(p, now), col = st === "live" ? c.ok : st === "scheduled" ? c.warn : c.build;
    const rec = p.share?.squadOnly ? squadOf(p.c) : E.D.players.map(x => x.id);
    const seen = st === "live" || st === "ended" ? seenStats((E.D.planLogs[p.id] || []).filter(l => !p.publishedAt || l.at >= p.publishedAt), rec).seen.length : null;
    return <Row gap={6} wrap>
      <Chip label={st === "live" ? t("mp_st_liveShort") : t("mp_st_" + st)} color={col} />
      {seen != null ? <Chip label={tf("mp_seen", { n: seen, m: rec.length })} color={c.accentTx} /> : null}
    </Row>;
  };
  const chev = <Icon name="chevron" size={18} color={c.muted} />;
  const row = (p: MatchPlan, m: Match | null) => (
    <ListItem key={p.id} testID={"mpl-" + p.id} title={p.title || t("mp_titleFree")} right={chev}
      sub={m ? `${E.wt(m.date)} ${E.de(m.date)} · ${m.zeit} · ${m.heim ? t("home") : t("away")} · ${p.c.fmt}er ${p.c.formation}` : `${p.c.fmt}er ${p.c.formation}`}
      onPress={() => router.push("/coach/matchplan/" + p.id)}>{status(p)}</ListItem>
  );
  return (
    <Screen testID="coach-matchplaene">
      <Header title={t("mp_list")} onBack={back} backLabel={t("mo_title")} info={<Info title={t("mp_title")} text={[t("mp_info"), t("mp_infoShare")]} />} />
      {!E.mods.matchplan ? <Muted>{tf("bk_needs", { m: t("m_matchplan") })}</Muted> : <>
        <Card testID="mpl-next">
          <CardTitle title={t("mp_nextMatches")} />
          {!upcoming.length ? <Muted>{t("mp_noUpcoming")}</Muted> : null}
          {upcoming.map(m => {
            const p = planOf(m);
            if (p) return row(p, m);
            return (
              <ListItem key={m.id} testID={"mpl-m-" + m.id} title={`${t("vs")} ${m.gegner}`} sub={`${E.wt(m.date)} ${E.de(m.date)} · ${m.zeit} · ${m.heim ? t("home") : t("away")} · ${t("comp_" + m.comp)}`}>
                {can ? <Row gap={8} wrap>
                  <Btn small kind="primary" icon="plus" testID={"mpl-new-" + m.id} label={t("mp_create")} disabled={!!busy} onPress={() => create(m.id)} />
                  {lastPlan ? <Btn small testID={"mpl-copy-" + m.id} label={t("mp_copyLast")} disabled={!!busy} onPress={() => create(m.id, lastPlan.id)} /> : null}
                </Row> : <Muted small>{t("mp_none")}</Muted>}
              </ListItem>
            );
          })}
        </Card>
        <Card testID="mpl-free">
          <CardTitle title={t("mp_freePlans")} info={<Info title={t("mp_freePlans")} text={t("mp_freeInfo")} />}
            right={can ? <Btn small icon="plus" testID="mpl-new-free" label={t("mp_create")} disabled={!!busy} onPress={() => create(null)} /> : null} />
          {free.length ? free.map(p => row(p, null)) : <Muted small>{t("mp_freeNone")}</Muted>}
        </Card>
        {past.length ? <Card testID="mpl-past">
          <CardTitle title={t("mp_pastPlans")} />
          <Col gap={0}>{past.map(p => row(p, E.D.matches.find(m => m.id === p.matchId) || null))}</Col>
        </Card> : null}
      </>}
    </Screen>
  );
}
