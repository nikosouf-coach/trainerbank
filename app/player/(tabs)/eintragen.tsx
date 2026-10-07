import React from "react";
import { useStore } from "../../../src/data/store";
import { Header, Screen } from "../../../src/ui/kit";

export default function Placeholder() {
  const s = useStore();
  return <Screen testID="player-eintragen"><Header eyebrow={s.D?.team.name || ""} title={s.tr.t("pn_eintragen")} /></Screen>;
}
