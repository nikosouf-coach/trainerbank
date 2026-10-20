// Trainer – Training & Prinzipien: Trainingstage, weitere Einheiten je Woche, Spieltags-Prinzipien, eigene Trainingsarten, Erholungszeiten.
import React, { useState } from "react";
import { BANDS, bandLabel, bandOf } from "../../../src/core/classes";
import { useEngine, useStore } from "../../../src/data/store";
import { DaysEditor, PrinciplesEditor } from "../../../src/ui/editors";
import { KindEditor, type KindEditorTarget } from "../../../src/ui/kindEditor";
import { Banner, Card, CardTitle, Header, Info, Row, Screen, T } from "../../../src/ui/kit";
import { WeeklyUnitsEditor } from "../../../src/ui/units";
import { useTheme } from "../../../src/ui/theme";
import { useNavBack } from "../../../src/ui/nav";

export default function TrainingSettings() {
  const nb = useNavBack("training");
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [kt, setKt] = useState<KindEditorTarget | null>(null);
  const team = E.team, kids = E.grp === "u11";
  const myBands = new Set(E.D.players.map(p => bandOf(E.age(p))));
  return (
    <Screen testID="coach-training">
      <Header title={t("mh_training")} onBack={nb.onBack} backLabel={nb.backLabel} />
      <Card>
        <CardTitle title={t("trSet")} />
        <DaysEditor value={team.settings} onChange={st => s.updateTeam({ settings: st })} tr={E.tr} />
      </Card>
      {!kids ? <Card testID="training-units">
        <CardTitle title={t("un_weeklyT")} info={<Info title={t("un_weeklyT")} text={[t("un_titleInfo"), t("un_loadNote")]} />} />
        <WeeklyUnitsEditor />
      </Card> : null}
      {E.mods.planung ? <Card testID="training-principles">
        <CardTitle title={t("pr_title")} info={<Info title={t("pr_title")} text={t("pr_sub")} />} />
        {kids ? <Banner>{t("w_kids")}</Banner> : <PrinciplesEditor value={team.principles} onChange={pr => s.updateTeam({ principles: pr })} tr={E.tr} cls={team.cls} depth={team.depth} kinds={E.D.kinds}
          days={Object.keys(team.settings.days).map(Number)} spieltag={team.settings.spieltag}
          onNewKind={md => setKt({ kind: null, md })} onEditKind={k => setKt({ kind: k })} />}
      </Card> : null}
      {E.mods.regeneration && E.lvl(2) ? <Card>
        <CardTitle title={t("rt_title")} info={<Info title={t("rt_title")} text={t("rt_note")} />} />
        <Row between><T v="eyebrow" style={{ flex: 1 }}>{t("rt_age")}</T><T v="eyebrow" style={{ width: 80, textAlign: "right" }}>{t("rt_train")}</T><T v="eyebrow" style={{ width: 80, textAlign: "right" }}>{t("rt_match")}</T></Row>
        {BANDS.map((b, i) => (
          <Row key={i} between style={{ paddingVertical: 4 }}>
            <T v="small" bold={myBands.has(i)} style={{ flex: 1, color: myBands.has(i) ? c.accentTx : c.ink }}>{bandLabel(i)}</T>
            <T v="small" style={{ width: 80, textAlign: "right" }}>{b[1]} {t("hours")}</T>
            <T v="small" style={{ width: 80, textAlign: "right" }}>{b[2]} {t("hours")}</T>
          </Row>
        ))}
      </Card> : null}
      <KindEditor target={kt} onClose={() => setKt(null)} />
    </Screen>
  );
}
