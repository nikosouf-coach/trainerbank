// Trainer – Kader: Spieler mit Filtern (Position, Gruppe, Status), Abwesenheiten, eigene Gruppen.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { posGroup } from "../../../src/core/classes";
import type { Player, TeamGroup } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { Banner, Bar, Btn, Card, CardTitle, Check, Chip, Col, Field, Header, Info, ListItem, Muted, Row, Screen, Seg, Sheet, StatusChip, T, Tag } from "../../../src/ui/kit";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { MergeSheet, PlayerSheet } from "../../../src/ui/squad/PlayerForm";
import { radius, statusColor, useTheme } from "../../../src/ui/theme";

type Tab = "spieler" | "abw" | "gruppen";

export default function Kader() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const params = useLocalSearchParams<{ filter: string; tab: string }>();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>("spieler");
  const [filter, setFilter] = useState("alle");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Player | null | undefined>(undefined);
  const [merge, setMerge] = useState<Player | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [grpEdit, setGrpEdit] = useState<TeamGroup | null>(null);
  const [grpName, setGrpName] = useState("");
  const sheets = usePlanSheets();
  useEffect(() => { if (params.filter) { setFilter(params.filter); setTab("spieler"); } if (params.tab === "abw" || params.tab === "gruppen") setTab(params.tab); }, [params.filter, params.tab]);

  const mods = E.mods, groups = E.team.settings.groups || [];
  const prs = useMemo(() => E.D.players.map(p => E.profile(p.id)), [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const neu = E.D.players.filter(p => p.neu);
  const keys = ["alle", "TW", "Abwehr", "Mittelfeld", "Sturm", ...groups.map(g => "g:" + g.id), ...(mods.belastung ? ["crit", "warn", "low"] : []), "inj"];
  const keyLabel = (k: string) => k.startsWith("g:") ? (groups.find(g => "g:" + g.id === k)?.name || "?") : t("f_" + k);
  const list = prs.filter(x => filter === "alle" || posGroup(x.p.pos) === filter || x.st === filter || (filter.startsWith("g:") && (x.p.groups || []).includes(filter.slice(2))))
    .filter(x => !q || E.name(x.p).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.p.active === false ? 1 : 0) - (b.p.active === false ? 1 : 0) || (a.p.nr ?? 99) - (b.p.nr ?? 99));
  const cols = width >= 1000 ? 4 : width >= 700 ? 3 : 2;

  const saveGroups = (gs: TeamGroup[]) => s.updateTeam({ settings: { ...E.team.settings, groups: gs } });

  const spieler = (
    <>
      {neu.length ? <Banner color={c.low} testID="kader-new">
        <Col gap={6}>
          <T bold>{tf("kd_newApp", { n: neu.length })}</T>
          <T v="small">{t("kd_newAppD")}</T>
          {neu.map(p => <Row key={p.id} gap={8} wrap><T v="small" bold>{E.name(p)}</T><Btn small testID={"kader-merge-" + p.id} label={t("kd_merge")} onPress={() => setMerge(p)} /></Row>)}
        </Col>
      </Banner> : null}
      <Field testID="kader-search" label={t("search")} value={q} onChangeText={setQ} placeholder={t("search")} />
      <Row wrap gap={6}>
        {keys.map(k => {
          const on = filter === k, col = ["crit", "warn", "low", "inj"].includes(k) ? statusColor(c, k) : c.accent;
          return (
            <Pressable key={k} testID={"kader-f-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setFilter(k)}
              style={{ borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? col : c.surface, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11 }}>
              <Text style={{ fontWeight: "700", fontSize: 13, color: on ? "#fff" : c.ink }}>{keyLabel(k)}</Text>
            </Pressable>
          );
        })}
      </Row>
      {list.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }}>
        {list.map(x => (
          <View key={x.p.id} style={{ width: `${100 / cols}%`, padding: 5 }}>
            <Pressable testID={"pcard-" + x.p.id} accessibilityRole="button" accessibilityLabel={E.name(x.p)} onPress={() => router.push("/coach/spieler/" + x.p.id)}
              style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.l, padding: 12, alignItems: "center", gap: 6, opacity: x.p.active === false ? 0.55 : 1, minHeight: 190 }}>
              <Text style={{ position: "absolute", left: 10, top: 8, fontWeight: "800", fontSize: 13, color: c.muted }}>{x.p.nr ?? ""}</Text>
              <PlayerAvatar p={x.p} size={56} status={mods.belastung || x.st === "inj" ? x.st : null} />
              <Text numberOfLines={2} style={{ fontWeight: "800", fontSize: 14.5, color: c.ink, textAlign: "center" }}>{E.name(x.p)}</Text>
              <Row gap={4} wrap style={{ justifyContent: "center" }}><Tag label={x.p.pos} /><Tag label={`${E.age(x.p)} ${t("years")}`} />{x.p.neu ? <Chip label={t("newP")} color={c.low} /> : null}{x.p.active === false ? <Tag label={t("kd_inactive")} /> : null}</Row>
              {(mods.belastung || x.st === "inj") && x.st !== "none" ? <StatusChip status={x.st} label={t("st_" + x.st)} /> : x.ab ? <Chip label={t("ab_" + x.ab.typ)} color={c.build} /> : null}
              <Row gap={10} style={{ justifyContent: "center" }}>
                {mods.belastung && E.lvl(2) ? <Muted small>ACWR <Text style={{ fontWeight: "800", color: c.ink }}>{x.m && x.m.acwr != null && x.st !== "inj" ? E.num(x.m.acwr, 2) : "–"}</Text></Muted> : null}
                {mods.beteiligung ? <Muted small>{t("attShort")} <Text style={{ fontWeight: "800", color: c.ink }}>{x.att != null ? Math.round(x.att * 100) + "%" : "–"}</Text></Muted> : null}
              </Row>
            </Pressable>
          </View>
        ))}
      </View> : <Muted>{t("noPlayers")}</Muted>}
      {E.D.inactive.length ? <Card testID="kader-inactive">
        <CardTitle title={tf("in_title", { n: E.D.inactive.length })} info={<Info title={tf("in_title", { n: E.D.inactive.length })} text={t("in_info")} />}
          right={<Btn small kind="ghost" testID="kader-inactive-toggle" label={showInactive ? t("in_hide") : t("in_show")} onPress={() => setShowInactive(!showInactive)} />} />
        {showInactive ? E.D.inactive.map(p => <ListItem key={p.id} testID={"inactive-" + p.id} title={E.name(p)} sub={`${p.pos}${p.nr ? " · #" + p.nr : ""}`} left={<PlayerAvatar p={p} size={36} />}
          right={<Btn small testID={"reactivate-" + p.id} label={t("in_reactivate")} onPress={async () => { await s.savePlayer({ ...p, active: true }); s.toast(tf("in_done", { n: E.name(p) })); }} />} />) : null}
      </Card> : null}
    </>
  );

  const abw = () => {
    const cur = E.D.absences.filter(a => !a.bis || a.bis >= E.TODAY).sort((a, b) => a.von < b.von ? -1 : 1);
    const past = E.D.absences.filter(a => a.bis && a.bis < E.TODAY).sort((a, b) => (a.bis! < b.bis! ? 1 : -1)).slice(0, 10);
    const row = (a: typeof cur[number]) => {
      const p = E.P(a.pid); if (!p) return null; const col = a.typ === "verletzung" || a.typ === "krank" ? c.inj : c.low;
      return <ListItem key={a.id} testID={"abs-" + a.id} title={E.name(p)} left={<PlayerAvatar p={p} size={36} />}
        sub={`${E.de(a.von)} – ${a.bis ? E.de(a.bis) : t("ongoing")}${a.typ === "verletzung" && a.stufe ? ` · ${t("stage")} ${a.stufe}/4 ${E.tl("stages")[a.stufe - 1]}` : ""}${a.notiz ? " · " + a.notiz : ""}${a.by === "player" ? " · " + t("fromPlayer") : ""}`}
        right={<Row gap={6}><Chip label={t("ab_" + a.typ)} color={col} /><Btn small kind="ghost" icon="trash" label="" a11y={t("del")} testID={"abs-del-" + a.id} onPress={() => { s.deleteAbsence(a.id); s.toast(t("t_del")); }} /></Row>} />;
    };
    const ranking = E.D.players.map(p => ({ p, a: E.attendance(p.id) })).filter(x => x.a != null).sort((a, b) => a.a! - b.a!);
    const wide = width >= 900;
    const left = <Card style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("abs_cur")} right={<Btn small kind="primary" testID="abs-add" label={t("abs_add")} onPress={() => sheets.open({ k: "abs" })} />} />
      {cur.length ? cur.map(row) : <Muted>{t("abs_none")}</Muted>}
      {past.length ? <><Btn small kind="ghost" label={`${t("abs_past")} (${past.length}) ${showPast ? "▴" : "▾"}`} onPress={() => setShowPast(!showPast)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />{showPast ? past.map(row) : null}</> : null}
      {!(E.team.settings.playerAbs ?? true) ? <Muted small>{t("pabs_d")}</Muted> : null}
    </Card>;
    const right = <Card style={{ flex: wide ? 1 : undefined }}>
      <CardTitle title={t("att28")} info={<Info title={t("att28")} text={t("att28note")} />} />
      {ranking.map(x => <ListItem key={x.p.id} title={E.name(x.p)} left={<PlayerAvatar p={x.p} size={32} />} onPress={() => router.push("/coach/spieler/" + x.p.id)}
        right={<T bold>{Math.round(x.a! * 100)} %</T>}><Bar value={x.a!} color={x.a! < 0.8 ? c.warn : c.accent} /></ListItem>)}
    </Card>;
    return wide ? <Row align="flex-start" gap={18}>{left}{right}</Row> : <>{left}{right}</>;
  };

  const gruppen = (
    <>
      <Card>
        <CardTitle title={t("gr_pos")} info={<Info title={t("tab_gruppen")} text={t("gr_info")} />} />
        {(["TW", "Abwehr", "Mittelfeld", "Sturm"] as const).map(g => {
          const ps = E.D.players.filter(p => posGroup(p.pos) === g);
          return <ListItem key={g} title={t("f_" + g)} sub={ps.map(p => p.vn).join(", ")} right={<Tag label={tf("gr_members", { n: ps.length })} />} onPress={() => { setFilter(g); setTab("spieler"); }} />;
        })}
      </Card>
      <Card testID="groups-own">
        <CardTitle title={t("gr_own")} />
        {groups.length ? groups.map(g => {
          const ps = E.D.players.filter(p => (p.groups || []).includes(g.id));
          return <ListItem key={g.id} testID={"group-" + g.id} title={g.name} sub={ps.map(p => p.vn).join(", ") || "–"} onPress={() => setGrpEdit(g)} right={<Tag label={tf("gr_members", { n: ps.length })} />} />;
        }) : <Muted>{t("gr_none")}</Muted>}
        <Row gap={8} wrap align="flex-end">
          <Field testID="group-name" label={t("gr_new")} value={grpName} onChangeText={setGrpName} placeholder={t("gr_namePh")} style={{ flex: 1, minWidth: 200 }} />
          <Btn testID="group-add" kind="primary" label={t("pot_add")} disabled={!grpName.trim()} onPress={() => { const g = { id: tmpId().replace("tmp-", "g-"), name: grpName.trim() }; saveGroups([...groups, g]); setGrpName(""); setGrpEdit(g); }} />
        </Row>
      </Card>
    </>
  );

  const ge = grpEdit ? groups.find(g => g.id === grpEdit.id) || grpEdit : null;
  return (
    <Screen testID="coach-kader">
      <Header eyebrow={`${E.team.name} · ${E.D.players.filter(p => p.active !== false).length} ${t("players")}`} title={t("nav_kader")}
        right={<Btn testID="kader-add" kind="primary" label={t("addPlayer")} onPress={() => setEdit(null)} />} />
      <Seg testID="kader-tab" value={tab} onChange={setTab} options={[{ key: "spieler", label: t("tab_spieler") }, ...(mods.beteiligung ? [{ key: "abw" as Tab, label: t("tab_abw") }] : []), { key: "gruppen", label: t("tab_gruppen") }]} />
      {tab === "spieler" ? spieler : tab === "abw" ? abw() : gruppen}
      <PlayerSheet player={edit} onClose={() => setEdit(undefined)} />
      <MergeSheet newPlayer={merge} onClose={() => setMerge(null)} />
      <Sheet visible={!!ge} onClose={() => setGrpEdit(null)} title={ge ? `${t("gr_edit")} · ${ge.name}` : ""} testID="group-sheet" closeLabel={t("cancel")}>
        {ge ? <Col gap={10}>
          {E.D.players.map(p => { const on = (p.groups || []).includes(ge.id); return (
            <Check key={p.id} testID={"gm-" + p.id} label={`${E.name(p)} · ${p.pos}`} value={on} onChange={v => s.savePlayer({ ...p, groups: v ? [...(p.groups || []), ge.id] : (p.groups || []).filter(x => x !== ge.id) })} />
          ); })}
          <Row gap={8} wrap>
            <Btn kind="primary" label={t("done")} onPress={() => setGrpEdit(null)} />
            <Btn kind="ghost" testID="group-del" label={t("del")} onPress={() => { saveGroups(groups.filter(g => g.id !== ge.id)); E.D.players.filter(p => (p.groups || []).includes(ge.id)).forEach(p => s.savePlayer({ ...p, groups: (p.groups || []).filter(x => x !== ge.id) })); setGrpEdit(null); s.toast(t("t_del")); }} />
          </Row>
        </Col> : null}
      </Sheet>
      {sheets.el}
    </Screen>
  );
}
