import React from "react";
import { useStore } from "../../../src/data/store";
import { Header, Screen } from "../../../src/ui/kit";

export default function Placeholder() {
  const s = useStore();
  return <Screen testID="coach-plan"><Header eyebrow={s.D?.team.club || ""} title={s.tr.t("nav_plan")} /></Screen>;
}
