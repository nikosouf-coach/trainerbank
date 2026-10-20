// Trainer – Mehr: alle Bereiche nach Themen gruppiert (mit Suche), ohne die Bereiche der unteren Leiste.
// „Menü anpassen“: Bereiche der unteren Leiste wählen und ordnen, Menüpunkte aus- und einblenden.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { classDef, classLabel, teamLabel } from "../../../src/core/classes";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Banner, Btn, Col, Header, Muted, Screen, SearchField, T } from "../../../src/ui/kit";
import { MenuEditor, groupCol } from "../../../src/ui/navEditor";
import { NAV_GROUPS, useNav, type NavItem } from "../../../src/ui/nav";
import { radius, useTheme, withAlpha } from "../../../src/ui/theme";

/** Alte Kennungen der Menüpunkte (Tests, Verweise) */
const legacyId = (k: string): string => k === "matchplaene" ? "matchplan" : k;

export default function Mehr() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const nav = useNav();
  const [q, setQ] = useState(""); const [edit, setEdit] = useState(false); const [showHidden, setShowHidden] = useState(false);
  const team = E.team, club = s.clubs.find(x => x.id === team.clubId) || null;
  // Beschreibung (für die Suche) – sichtbar bleibt nur eine kurze Angabe rechts (Team, Verein, Konto)
  const detailOf = (n: NavItem): string => n.k === "team" ? teamLabel(team) : n.k === "verein" ? (club ? club.name : "") : n.k === "konto" ? (s.myStaff?.name || "") : "";
  const subOf = (n: NavItem): string => {
    if (n.k === "team") return `${teamLabel(team)} · ${classLabel(classDef(team.cls), E.tr.lang)} · ${t("dp_" + team.depth)}`;
    if (n.k === "verein") return club ? tf("cl_menuSubLinked", { c: club.name, n: club.teams }) : team.clubId ? t("cl_open") : t("cl_menuSub");
    if (n.k === "training") return tf("mh_trainingSub", { n: Object.keys(team.settings.days).length });
    if (n.k === "individual" && nav.badge("individual")) return `${t("iq_open")}: ${nav.badge("individual")}`;
    if (n.k === "konto") return [s.myStaff?.name, s.isDemo ? t("w_demoHint") : s.user?.email].filter(Boolean).join(" · ");
    return t(n.sub);
  };
  const ql = q.trim().toLowerCase();
  const match = (n: NavItem) => !ql || `${t(n.title)} ${subOf(n)} ${t(n.short)}`.toLowerCase().includes(ql);
  const shown = nav.items.filter(n => !nav.bar.includes(n.k) && (!nav.hidden.has(n.k) || !!ql) && match(n));
  const hidden = nav.items.filter(n => nav.hidden.has(n.k) && !ql);
  const row = (n: NavItem, last: boolean) => {
    const col = groupCol(c, n.group), badge = nav.badge(n.k);
    return (
      <Pressable key={n.k} testID={"mehr-" + legacyId(n.k)} accessibilityRole="button" accessibilityLabel={t(n.title)} onPress={() => router.push(n.href)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14, minHeight: 52, backgroundColor: pressed ? c.sunk : "transparent",
          borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line })}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: withAlpha(col, 0.13), alignItems: "center", justifyContent: "center" }}>
          <Icon name={n.icon} size={18} color={col} />
        </View>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontWeight: "600", fontSize: 15.5, letterSpacing: -0.1, color: c.ink }}>{t(n.title)}</Text>
        {detailOf(n) ? <Text numberOfLines={1} style={{ maxWidth: "42%", fontSize: 13.5, color: c.muted }}>{detailOf(n)}</Text> : null}
        {badge ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.crit, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 12 }}>{badge}</Text></View> : null}
        <Icon name="chevron" size={18} color={c.muted} />
      </Pressable>
    );
  };
  const card = (L: NavItem[]) => (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.l, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}>{L.map((n, i) => row(n, i === L.length - 1))}</View>
  );
  return (
    <Screen testID="coach-mehr">
      <Header eyebrow={t("mo_sub")} title={t("mo_title")} right={<Btn small icon="sliders" testID="nav-edit" label={t("nv_edit")} onPress={() => setEdit(true)} />} />
      <SearchField testID="nav-search" value={q} onChange={setQ} placeholder={t("nv_search")} clearLabel={t("cancel")} />
      {NAV_GROUPS.map(g => {
        const L = shown.filter(n => n.group === g);
        return L.length ? <Col key={g} gap={8} testID={"nav-group-" + g}><T v="eyebrow" color={c.muted}>{t("nvg_" + g)}</T>{card(L)}</Col> : null;
      }) }
      {ql && !shown.length ? <Muted testID="nav-none">{t("nv_none")}</Muted> : null}
      {!ql && nav.bar.length ? <Muted small>{tf("nv_inBarHint", { l: nav.bar.map(k => t(nav.items.find(n => n.k === k)!.short)).join(", ") })}</Muted> : null}
      {hidden.length ? <Col gap={8}>
        <Pressable testID="nav-hidden-toggle" accessibilityRole="button" accessibilityState={{ expanded: showHidden }} onPress={() => setShowHidden(!showHidden)}>
          <T v="eyebrow" color={c.muted}>{tf("nv_hidden", { n: hidden.length })} {showHidden ? "▲" : "▼"}</T>
        </Pressable>
        {showHidden ? card(hidden) : null}
      </Col> : null}
      {s.isDemo ? <Banner>{t("pa_demoNote")}</Banner> : null}
      {s.isDemo ? <Btn testID="mehr-to-player" label={t("toPlayer")} onPress={() => { s.setDemoView("player"); router.replace(s.demoPlayer ? "/player/heute" : "/demo-player"); }} style={{ alignSelf: "flex-start" }} /> : null}
      <MenuEditor visible={edit} onClose={() => setEdit(false)} />
    </Screen>
  );
}
