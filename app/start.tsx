import { useRouter } from "expo-router";
import { teamLabel } from "../src/core/classes";
import React from "react";
import { Pressable } from "react-native";
import { useStore } from "../src/data/store";
import { Btn, Card, Col, Header, Muted, Screen, T } from "../src/ui/kit";

export default function Start() {
  const s = useStore(); const { t } = s.tr; const router = useRouter();
  const opt = (key: string, title: string, desc: string, href: string) => (
    <Pressable key={key} testID={"start-" + key} accessibilityRole="button" onPress={() => router.push(href)}>
      <Card><T v="h3">{title}</T><Muted small>{desc}</Muted></Card>
    </Pressable>
  );
  return (
    <Screen testID="start">
      <Header eyebrow={s.user?.displayName || ""} title={t("st_title")} />
      <Col gap={12} style={{ maxWidth: 560 }}>
        {opt("create", t("st_create"), t("st_create_d"), "/setup")}
        {opt("join", t("st_join"), t("st_join_d"), "/join")}
        {opt("staff", t("st_staff"), t("st_staff_d"), "/staff-join")}
        {s.memberships.length ? <Col gap={8}><T v="eyebrow">{t("st_teams")}</T>{s.memberships.map(m => <Btn key={m.teamId + m.role} label={teamLabel(m)} onPress={async () => { await s.selectTeam(m); router.replace("/"); }} />)}</Col> : null}
        <Btn kind="ghost" label={t("au_logout")} onPress={async () => { await s.signOut(); router.replace("/"); }} />
      </Col>
    </Screen>
  );
}
