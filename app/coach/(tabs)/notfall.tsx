// Trainer – Notfallkontakte: wer hat einen Kontakt, wer fehlt (Erinnerung an Spieler mit Konto), je Spieler die
// Kontakte mit Anrufen und – mit Recht „Gesundheitsdaten“ – die Hinweise für den Notfall. Auch ohne Netz verfügbar.
import React, { useState } from "react";
import { Text } from "react-native";
import { hasEmergency, missingEmergency, remindable } from "../../../src/core/emergency";
import { useEngine, useStore } from "../../../src/data/store";
import { EmergencySheet, EmergencyView } from "../../../src/ui/emergency";
import { Bar, Btn, Card, Col, Header, Info, Muted, Row, Screen, Seg, T } from "../../../src/ui/kit";
import { useNavBack } from "../../../src/ui/nav";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { useTheme } from "../../../src/ui/theme";

export default function Notfall() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const nb = useNavBack("notfall");
  const [filter, setFilter] = useState<"all" | "missing">("all");
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const header = <Header title={t("nf_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("nf_title")} text={t("nf_info")} />} />;
  if (!s.can("squad") && !s.can("health")) return <Screen testID="coach-emergency">{header}<Muted>{tf("pm_denied", { p: t("pm_squad") })}</Muted></Screen>;
  const P = E.D.players.filter(p => p.active !== false);
  const miss = missingEmergency(E.D), rem = remindable(E.D), done = P.length - miss.length;
  const L = filter === "missing" ? P.filter(p => !hasEmergency(E.D, p.id)) : P;
  const remind = async () => { setBusy(true); try { await s.remindEmergency(rem.map(p => p.id)); } finally { setBusy(false); } };
  return (
    <Screen testID="coach-emergency">
      {header}
      {E.D.emergencyOk ? (
        <Card testID="nf-summary">
          <T v="h3">{tf("nf_countN", { n: done, m: P.length })}</T>
          <Bar value={P.length ? done / P.length : 0} color={miss.length ? c.warn : c.ok} />
          {miss.length ? <Muted small>{miss.map(p => E.name(p)).join(", ")}</Muted> : <Muted small>{t("nf_allSet")}</Muted>}
          {rem.length && s.can("messages") ? <Btn small icon="send" testID="nf-remind" label={tf("nf_remind", { n: rem.length })} disabled={busy} onPress={remind} style={{ alignSelf: "flex-start" }} /> : null}
          {miss.length > rem.length ? <Muted small>{tf("nf_noAccount", { n: miss.length - rem.length })}</Muted> : null}
          <Muted small>{t("nf_offline")}</Muted>
        </Card>
      ) : null}
      <Seg testID="nf-filter" value={filter} onChange={setFilter}
        options={[{ key: "all", label: t("nf_filterAll") }, { key: "missing", label: `${t("nf_filterMissing")} (${miss.length})` }]} />
      {L.map(p => {
        const has = hasEmergency(E.D, p.id), med = s.can("health") && !!E.D.emergencyMed[p.id];
        return (
          <Card key={p.id} testID={"nf-p-" + p.id}>
            <Row between gap={10}>
              <Row gap={10} style={{ flex: 1, minWidth: 0 }}>
                <PlayerAvatar p={p} size={34} />
                <Col gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <T bold numberOfLines={1}>{E.name(p)}</T>
                  <Muted small>{[p.nr != null ? "#" + p.nr : "", p.pos].filter(Boolean).join(" · ")}</Muted>
                </Col>
              </Row>
              <Btn small kind="ghost" icon="pen" testID={"nf-edit-" + p.id} label={has ? t("edit") : t("nf_enterCoach")} onPress={() => setEdit(p.id)} />
            </Row>
            {has || med ? <EmergencyView pid={p.id} showMed={s.can("health")} /> : null}
            {!has && E.D.emergencyOk ? <Text style={{ color: c.crit, fontWeight: "700", fontSize: 14 }}>{t("nf_none")}</Text> : null}
          </Card>
        );
      })}
      {!L.length ? <Muted>{t("nf_allSet")}</Muted> : null}
      <EmergencySheet pid={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}
