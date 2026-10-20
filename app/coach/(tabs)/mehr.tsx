// Trainer – Mehr: alle Bereiche nach Themen gruppiert (mit Suche), ohne die Bereiche der unteren Leiste.
// „Menü anpassen“: Bereiche der unteren Leiste wählen und ordnen, Menüpunkte aus- und einblenden.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { classDef, classLabel, teamLabel } from "../../../src/core/classes";
import { useEngine, useStore } from "../../../src/data/store";
import { Banner, Btn, Header, Muted, NavRow, Screen, SearchField, Section } from "../../../src/ui/kit";
import { MenuEditor, groupCol } from "../../../src/ui/navEditor";
import { NAV_GROUPS, useNav, type NavItem } from "../../../src/ui/nav";
import { useTheme } from "../../../src/ui/theme";

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
  const row = (n: NavItem) => {
    const badge = nav.badge(n.k);
    return <NavRow key={n.k} testID={"mehr-" + legacyId(n.k)} icon={n.icon} iconColor={groupCol(c, n.group)} title={t(n.title)} value={detailOf(n) || null}
      badge={badge || null} badgeColor={c.crit} a11y={t(n.title)} onPress={() => router.push(n.href)} />;
  };
  return (
    <Screen testID="coach-mehr">
      <Header title={t("mo_title")} right={<Btn small icon="sliders" testID="nav-edit" label={t("nv_edit")} onPress={() => setEdit(true)} />} />
      <SearchField testID="nav-search" value={q} onChange={setQ} placeholder={t("nv_search")} clearLabel={t("cancel")} />
      {NAV_GROUPS.map(g => {
        const L = shown.filter(n => n.group === g);
        return L.length ? <Section key={g} quiet testID={"nav-group-" + g} title={t("nvg_" + g)}>{L.map(row)}</Section> : null;
      })}
      {ql && !shown.length ? <Muted testID="nav-none">{t("nv_none")}</Muted> : null}
      {!ql && nav.bar.length ? <Muted small style={{ paddingHorizontal: 4 }}>{tf("nv_inBarHint", { l: nav.bar.map(k => t(nav.items.find(n => n.k === k)!.short)).join(", ") })}</Muted> : null}
      {hidden.length ? <Section quiet title={tf("nv_hidden", { n: hidden.length })} plain={!showHidden}
        action={{ label: showHidden ? t("in_hide") : t("in_show"), onPress: () => setShowHidden(!showHidden), testID: "nav-hidden-toggle" }}>
        {showHidden ? hidden.map(row) : null}
      </Section> : null}
      {s.isDemo ? <Banner>{t("pa_demoNote")}</Banner> : null}
      {s.isDemo ? <Btn testID="mehr-to-player" icon="person" label={t("toPlayer")} onPress={() => { s.setDemoView("player"); router.replace(s.demoPlayer ? "/player/heute" : "/demo-player"); }} style={{ alignSelf: "flex-start" }} /> : null}
      <MenuEditor visible={edit} onClose={() => setEdit(false)} />
    </Screen>
  );
}
