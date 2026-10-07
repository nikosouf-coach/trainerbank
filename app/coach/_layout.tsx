import { Stack } from "expo-router";
import React from "react";
import { Guard } from "../../src/ui/guard";
import { useTheme } from "../../src/ui/theme";

export default function CoachLayout() {
  const { c } = useTheme();
  return <Guard area="coach"><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} /></Guard>;
}
