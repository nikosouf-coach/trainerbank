// Trainer – Vorbereitung & Pausen: laufende, geplante und vergangene Phasen; neue Phase anlegen.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import type { PhaseKind } from "../../src/core/types";
import { useEngine } from "../../src/data/store";
import { Btn, Card, Divider, Header, Info, Muted, Row, Screen, T } from "../../src/ui/kit";
import { PhaseSheet, PhaseSummary } from "../../src/ui/prep";

export default function Vorbereitung() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const [add, setAdd] = useState<PhaseKind | null>(null);
  const L = [...E.D.phases].sort((a, b) => a.from < b.from ? -1 : 1);
  const groups: [string, typeof L][] = [
    ["vb_running", L.filter(p => p.from <= E.TODAY && p.to >= E.TODAY)],
    ["vb_planned", L.filter(p => p.from > E.TODAY)],
    ["vb_past", L.filter(p => p.to < E.TODAY).reverse()],
  ];
  return (
    <Screen testID="coach-vorbereitung">
      <Header title={t("vb_title")} onBack={() => router.back()} backLabel={t("mo_title")} info={<Info title={t("vb_title")} text={[t("vb_periodInfo"), t("vb_breakInfo")]} />} />
      <Row gap={8} wrap>
        <Btn testID="vb-add-prep" kind="primary" icon="plus" label={t("vb_newPrep")} onPress={() => setAdd("prep")} />
        <Btn testID="vb-add-break" icon="plus" label={t("vb_newBreak")} onPress={() => setAdd("break")} />
      </Row>
      {!L.length ? <Card><Muted>{t("vb_none")}</Muted></Card> : null}
      {groups.filter(([, g]) => g.length).map(([k, g]) => (
        <Card key={k} style={{ gap: 0 }}>
          <T v="eyebrow">{t(k)}</T>
          {g.map((ph, i) => <React.Fragment key={ph.id}>{i ? <Divider /> : null}<PhaseSummary testID={"vb-ph-" + ph.id} ph={ph} onPress={() => router.push("/coach/phase/" + ph.id)} /></React.Fragment>)}
        </Card>
      ))}
      <PhaseSheet visible={!!add} kind={add || "prep"} ph={null} onClose={() => setAdd(null)} onSaved={id => router.push("/coach/phase/" + id)} />
    </Screen>
  );
}
