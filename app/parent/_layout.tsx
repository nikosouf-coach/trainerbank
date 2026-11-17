import { Stack } from "expo-router";
import React from "react";
import { Guard } from "../../src/ui/guard";
import { useTheme } from "../../src/ui/theme";
import { WithTopBars } from "../../src/ui/topBars";

// Eltern-Ansicht: nur für Eltern mit verknüpftem Kind (bzw. Demo-Ansicht „Eltern“)
export default function ParentLayout() {
  const { c } = useTheme();
  return <Guard area="parent"><WithTopBars><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, freezeOnBlur: true }} /></WithTopBars></Guard>;
}
