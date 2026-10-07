import { Stack } from "expo-router";
import React from "react";
import { Guard } from "../../src/ui/guard";
import { useTheme } from "../../src/ui/theme";

export default function PlayerLayout() {
  const { c } = useTheme();
  return <Guard area="player"><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} /></Guard>;
}
