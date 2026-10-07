import { Redirect } from "expo-router";
import React from "react";
import { useStore } from "../src/data/store";
import { Splash, targetPath } from "../src/ui/guard";

export default function Index() {
  const s = useStore();
  if (s.phase === "loading") return <Splash />;
  return <Redirect href={targetPath(s)} />;
}
