import { Stack } from "expo-router";
import React from "react";
import { Guard } from "../../src/ui/guard";
import { useTheme } from "../../src/ui/theme";
import { WithTopBars } from "../../src/ui/topBars";

export default function CoachLayout() {
  const { c } = useTheme();
  return <Guard area="coach"><WithTopBars><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} /></WithTopBars></Guard>;
}
