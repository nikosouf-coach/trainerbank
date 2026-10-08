// Trainer – Baukasten: Funktionen (Pakete) fürs Trainerteam und was Spieler sehen.
import { useRouter } from "expo-router";
import React from "react";
import { PLAYER_VIEW } from "../../src/core/classes";
import type { PlayerViewKey } from "../../src/core/types";
import { useEngine, useStore } from "../../src/data/store";
import { ModuleList } from "../../src/ui/editors";
import { Card, CardTitle, Col, Header, Info, Screen, ToggleRow } from "../../src/ui/kit";
import { ReminderFields, TestPicker } from "../../src/ui/setupParts";

export default function Baukasten() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const team = E.team, pv = team.settings.playerView || {};
  const setPv = (k: PlayerViewKey, v: boolean) => s.updateTeam({ settings: { ...team.settings, playerView: { ...pv, [k]: v } } });
  const rm = team.settings.reminders || {}, load = !!team.modules.belastung;
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
        <ReminderFields value={rm} onChange={r => s.updateTeam({ settings: { ...team.settings, reminders: r } })} tr={E.tr} load={load} prep={!!team.modules.vorbereitung} />
      </Card>
      {team.modules.leistung ? <Card testID="bk-tests">
        <CardTitle title={t("su_testsT")} info={<Info title={t("su_testsT")} text={t("su_testsD")} />} />
        <TestPicker value={team.settings.tests} onChange={v => s.updateTeam({ settings: { ...team.settings, tests: v } })} grp={E.grp} tr={E.tr} />
      </Card> : null}
    </Screen>
  );
}
