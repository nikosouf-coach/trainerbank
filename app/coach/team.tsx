// Trainer – Verein & Mannschaft: Name, Vereinsfarbe, Altersklasse, Infotiefe, Sprache.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { defaultPrinciples, groupOf } from "../../src/core/classes";
import type { ClassKey, Depth } from "../../src/core/types";
import { useEngine, useStore } from "../../src/data/store";
import { ClassPicker, DepthPicker } from "../../src/ui/editors";
import { Icon } from "../../src/ui/icons";
import { Btn, Card, CardTitle, Field, Header, Row, Screen, Seg, T } from "../../src/ui/kit";
import { useTheme } from "../../src/ui/theme";

const COLORS = ["#0b3d91", "#1d4ed8", "#0f766e", "#15803d", "#b91c1c", "#9f1239", "#c2410c", "#a16207", "#6d28d9", "#111827"];

export default function TeamSettingsScreen() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const team = E.team;
  const [club, setClub] = useState(team.club); const [name, setName] = useState(team.name);
  const dirty = club.trim() !== team.club || name.trim() !== team.name;
  const setCls = (k: ClassKey) => {
    const g0 = groupOf(team.cls), g1 = groupOf(k);
    s.updateTeam(g0 === g1 ? { cls: k } : { cls: k, principles: defaultPrinciples(g1), depth: g1 === "u11" && team.depth === "pro" ? "basis" : team.depth });
  };
  return (
    <Screen testID="coach-team">
      <Header title={t("mh_team")} onBack={() => router.back()} backLabel={t("mo_title")} />
      <Card>
        <CardTitle title={t("club")} />
        <Row wrap gap={10}>
          <Field testID="set-club" label={t("clubName")} value={club} onChangeText={setClub} style={{ flex: 1, minWidth: 200 }} />
          <Field testID="set-team" label={t("team")} value={name} onChangeText={setName} style={{ width: 170 }} />
        </Row>
        {dirty ? <Btn small kind="primary" testID="set-save" label={t("save")} disabled={!club.trim()} onPress={() => { s.updateTeam({ club: club.trim(), name: name.trim() || team.name }); s.toast(t("t_saved")); }} style={{ alignSelf: "flex-start" }} /> : null}
        <T v="small" bold color={c.muted}>{t("color")}</T>
        <Row wrap gap={8}>
          {COLORS.map(col => (
            <Pressable key={col} testID={"set-color-" + col.slice(1)} accessibilityRole="radio" accessibilityState={{ checked: team.accent === col }} accessibilityLabel={col} onPress={() => s.updateTeam({ accent: col })}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col, alignItems: "center", justifyContent: "center", borderWidth: team.accent === col ? 3 : 0, borderColor: c.ink }}>
              {team.accent === col ? <Icon name="check" size={18} color="#fff" strokeWidth={3} /> : null}
            </Pressable>
          ))}
        </Row>
      </Card>
      <Card>
        <CardTitle title={t("ageClass")} />
        <ClassPicker value={team.cls} onChange={setCls} tr={E.tr} />
      </Card>
      <Card>
        <CardTitle title={t("depthT")} />
        <DepthPicker value={team.depth} onChange={(d: Depth) => s.updateTeam({ depth: d })} tr={E.tr} kids={E.grp === "u11"} />
        <Row gap={10}><T v="eyebrow">{t("lang")}</T><Seg testID="set-lang" value={s.lang} onChange={l => s.setLang(l)} options={[{ key: "de", label: "Deutsch" }, { key: "en", label: "English" }]} /></Row>
      </Card>
      <View style={{ height: 8 }} />
    </Screen>
  );
}
