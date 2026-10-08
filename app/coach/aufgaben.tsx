// Trainer – Aufgaben & Dienste: Aufgaben für Trainer und Spieler, Dienste reihum, Strafenkatalog.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { useEngine } from "../../src/data/store";
import { Header, Info, Screen, Seg } from "../../src/ui/kit";
import { DutiesTab, FinesTab, TasksTab } from "../../src/ui/tasks/coach";

type Tab = "tasks" | "duties" | "fines";

export default function Aufgaben() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const params = useLocalSearchParams<{ tab: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "duties" || params.tab === "fines" ? params.tab : "tasks");
  return (
    <Screen testID="coach-aufgaben">
      <Header onBack={() => router.canGoBack() ? router.back() : router.replace("/coach/mehr")} backLabel={t("mo_title")} title={t("tk_title2")}
        info={<Info title={t("tk_title2")} text={t("tk_info")} />} />
      <Seg testID="tk-tab" value={tab} onChange={setTab} options={[{ key: "tasks", label: t("tk_tab") }, { key: "duties", label: t("dy_title") }, { key: "fines", label: t("fn_title") }]} />
      {tab === "tasks" ? <TasksTab /> : tab === "duties" ? <DutiesTab /> : <FinesTab />}
    </Screen>
  );
}
