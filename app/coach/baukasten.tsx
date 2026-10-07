// Trainer – Baukasten: Funktionen (Pakete) fürs Trainerteam und was Spieler sehen.
import { useRouter } from "expo-router";
import React from "react";
import { PLAYER_VIEW } from "../../src/core/classes";
import type { PlayerViewKey, Reminders } from "../../src/core/types";
import { useEngine, useStore } from "../../src/data/store";
import { ModuleList } from "../../src/ui/editors";
import { Card, CardTitle, Col, Header, Info, Muted, Row, Screen, Seg, TimeField, ToggleRow } from "../../src/ui/kit";

export default function Baukasten() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const team = E.team, pv = team.settings.playerView || {};
  const setPv = (k: PlayerViewKey, v: boolean) => s.updateTeam({ settings: { ...team.settings, playerView: { ...pv, [k]: v } } });
  const rm = team.settings.reminders || {}, load = !!team.modules.belastung;
  const setRm = (p: Partial<Reminders>) => s.updateTeam({ settings: { ...team.settings, reminders: { ...rm, ...p } } });
  return (
    <Screen testID="coach-baukasten">
      <Header title={t("bk_title")} onBack={() => router.back()} backLabel={t("mo_title")} info={<Info title={t("bk_title")} text={t("bk_info")} />} />
      <Card testID="bk-mods">
        <CardTitle title={t("bk_mods")} />
        <ModuleList value={team.modules} onChange={m => s.updateTeam({ modules: m })} tr={E.tr} cls={team.cls} />
      </Card>
      <Card testID="bk-pview">
        <CardTitle title={t("bk_pview")} />
        <Col gap={14}>
          <ToggleRow testID="pv-abs" label={t("pabs_t")} desc={t("pabs_d")} value={team.settings.playerAbs ?? true} onChange={v => s.updateTeam({ settings: { ...team.settings, playerAbs: v } })} />
          {PLAYER_VIEW.map(x => {
            const blocked = !!x.needs && !team.modules[x.needs];
            return <ToggleRow key={x.key} testID={"pv-" + x.key} label={t("pv_" + x.key)} desc={blocked ? tf("bk_needs", { m: t("m_" + x.needs) }) : undefined}
              value={!blocked && (pv[x.key] ?? x.def)} disabled={blocked} onChange={v => setPv(x.key, v)} />;
          })}
        </Col>
      </Card>
      <Card testID="bk-reminders">
        <CardTitle title={t("rm_title")} info={<Info title={t("rm_title")} text={t("rm_info")} />} />
        <Col gap={14}>
          <ToggleRow testID="rm-well" label={t("rm_well")} desc={load ? t("rm_wellD") : tf("rm_needs", { m: t("pk_belastung") })} value={load && rm.well !== false} disabled={!load} onChange={v => setRm({ well: v })} />
          {load && rm.well !== false ? <TimeField testID="rm-wellAt" label={t("rm_wellAt")} value={rm.wellAt || "08:00"} onChange={v => setRm({ wellAt: v })} style={{ width: 120, marginLeft: 62 }} /> : null}
          <ToggleRow testID="rm-rpe" label={t("rm_rpe")} desc={load ? t("rm_rpeD") : tf("rm_needs", { m: t("pk_belastung") })} value={load && rm.rpe !== false} disabled={!load} onChange={v => setRm({ rpe: v })} />
          {load && rm.rpe !== false ? <Row gap={10} wrap style={{ marginLeft: 62 }}>
            <Muted small>{t("rm_rpeDelay")}</Muted>
            <Seg testID="rm-delay" value={String(rm.rpeDelay ?? 30)} onChange={v => setRm({ rpeDelay: Number(v) })} options={["30", "60", "90"].map(k => ({ key: k, label: tf("rm_min", { m: k }) }))} />
          </Row> : null}
          {team.modules.vorbereitung ? <ToggleRow testID="rm-program" label={t("rm_program")} desc={t("rm_programD")} value={rm.program !== false} onChange={v => setRm({ program: v })} /> : null}
        </Col>
      </Card>
    </Screen>
  );
}
