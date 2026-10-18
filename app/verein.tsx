// Verein (Vereinsabo): Übersicht aller Teams mit Kennzahlen, Ankündigungen, Funktionäre & Rechte, Codes und Teams.
// Funktioniert auch ohne geöffnetes Team (z. B. Jugendleitung ohne eigenes Team).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { clubTotals, isClubAdmin, isOfficial, type ClubStaffEntry, type ClubTeam, type TeamSummary } from "../src/core/club";
import { iso } from "../src/core/dates";
import { useStore } from "../src/data/store";
import { AnnounceSheet, ClubLinkCard, ClubStaffSheet, CodeBox, Confirm, TeamSummaryCard } from "../src/ui/club";
import { Banner, Btn, Card, CardTitle, Chip, Col, Field, Header, Info, ListItem, Muted, Row, Screen, Seg, T, Tag } from "../src/ui/kit";
import { PermChips } from "../src/ui/perms";
import { ColorPicker } from "../src/ui/setupParts";
import { radius, useTheme } from "../src/ui/theme";

function Kpi({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexGrow: 1, flexBasis: 120, backgroundColor: c.sunk, borderRadius: radius.m, padding: 10, gap: 2 }}>
      <T v="eyebrow">{label}</T>
      <Text style={{ fontSize: 24, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

export default function Verein() {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme(); const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const first = s.clubs.find(x => x.id === id) || s.clubs.find(x => x.id === s.D?.team.clubId) || s.clubs.find(x => x.role !== "pending") || s.clubs[0] || null;
  const [cid, setCid] = useState<string | null>(first?.id || null);
  const club = s.clubs.find(x => x.id === cid) || first;
  const official = isOfficial(club), admin = isClubAdmin(club);
  const [sum, setSum] = useState<TeamSummary[] | null>(null);
  const [teams, setTeams] = useState<ClubTeam[] | null>(null);
  const [staff, setStaff] = useState<ClubStaffEntry[] | null>(null);
  const [codes, setCodes] = useState<{ link: string | null; staff: string | null }>({ link: null, staff: null });
  const [edit, setEdit] = useState<ClubStaffEntry | null>(null);
  const [ann, setAnn] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(club?.name || "");
  useEffect(() => { s.refreshClubs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!cid && first) setCid(first.id); }, [first?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setName(club?.name || ""); setCodes({ link: club?.linkCode || null, staff: club?.staffCode || null }); }, [club?.id, club?.name, club?.linkCode, club?.staffCode]);
  const load = useCallback(async () => {
    if (!club || club.role === "pending") { setSum(null); setTeams(null); setStaff(null); return; }
    const api = s.api;
    const [a, b, d] = await Promise.all([
      official ? api.clubOverview(club.id).catch(e => { s.toast(s.errText(e)); return [] as TeamSummary[]; }) : Promise.resolve(null),
      api.clubTeams(club.id).catch(() => [] as ClubTeam[]),
      admin ? api.clubStaffList(club.id).catch(() => [] as ClubStaffEntry[]) : Promise.resolve(null),
    ]);
    setSum(a); setTeams(b); setStaff(d);
  }, [club?.id, club?.role, official, admin, s.api]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); setAsk(null); } };
  const back = () => router.canGoBack() ? router.back() : router.replace("/");
  const open = async (teamId: string) => { setBusy(true); try { if (await s.openTeam(teamId)) router.replace("/"); } finally { setBusy(false); } };
  const changed = async (me: boolean) => { await load(); if (me) await s.clubChanged(); else await s.refreshClubs(); };

  if (!club) return (
    <Screen testID="verein">
      <Header title={t("cl_title")} onBack={back} backLabel={t("btn_back")} />
      <Card testID="cl-none"><CardTitle title={t("cl_none")} /><Muted>{s.D ? t("cl_noneText") : t("cl_noneNoTeam")}</Muted></Card>
      {s.D && s.viewAs === "coach" ? <ClubLinkCard /> : null}
    </Screen>
  );

  const today = iso(new Date()), tot = sum ? clubTotals(sum, today) : null;
  const noAccess = teams && sum ? teams.filter(x => !sum.some(y => y.teamId === x.teamId)).length : 0;
  const pending = (staff || []).filter(x => x.role === "pending"), active = (staff || []).filter(x => x.role !== "pending");
  const teamName = (tid: string) => teams?.find(x => x.teamId === tid)?.name || "–";
  return (
    <Screen testID="verein">
      <Header eyebrow={t("cl_title")} title={club.name} onBack={back} backLabel={t("btn_back")} info={<Info title={t("cl_title")} text={t("cl_info")} />} />
      {s.clubs.length > 1 ? <Seg testID="cl-switch" wrap value={club.id} onChange={k => setCid(k)} options={s.clubs.map(x => ({ key: x.id, label: x.name }))} /> : null}
      <Row wrap gap={6}>
        <Muted small>{t("cl_role")}:</Muted>
        <Chip testID="cl-myrole" label={t("clr_" + club.role) + (club.title && club.title !== t("clr_" + club.role) ? " · " + club.title : "")} color={c.accentTx} />
      </Row>

      {club.role === "pending" ? <Banner testID="cl-pending">{tf("cl_pendingText", { c: club.name })}</Banner> : null}

      {club.role === "team" ? <Card testID="cl-teamonly">
        <T>{tf("cl_teamOnly", { c: club.name })}</T>
        {(teams || []).map(x => <ListItem key={x.teamId} title={x.name} right={x.teamId === s.active?.teamId ? <Chip label={t("cl_current")} color={c.accentTx} /> : undefined} />)}
      </Card> : null}

      {official ? <>
        {tot ? <Row wrap gap={8} testID="cl-kpis">
          <Kpi label={t("cl_k_teams")} value={String(tot.teams)} testID="cl-k-teams" />
          <Kpi label={t("cl_k_players")} value={String(tot.players)} testID="cl-k-players" />
          {tot.injured != null ? <Kpi label={t("cl_k_injured")} value={String(tot.injured)} testID="cl-k-injured" /> : null}
          <Kpi label={t("cl_k_matches")} value={String(tot.matches7)} testID="cl-k-matches" />
        </Row> : null}
        <Btn kind="primary" icon="chat" testID="cl-announce" label={t("cl_announce")} disabled={!sum?.length} onPress={() => setAnn(true)} style={{ alignSelf: "flex-start" }} />
        <T v="eyebrow">{t("cl_teams")}</T>
        {sum == null ? <Muted>{t("loading")}</Muted> : sum.map(x => (
          <TeamSummaryCard key={x.teamId} x={x} current={x.teamId === s.active?.teamId && s.phase === "ready"} busy={busy} onOpen={() => open(x.teamId)} />
        ))}
        {noAccess > 0 ? <Muted small testID="cl-noaccess">{tf("cl_noAccess", { n: noAccess })}</Muted> : null}
        <AnnounceSheet club={club} teams={(sum || []).map(x => ({ teamId: x.teamId, name: x.name }))} visible={ann} onClose={() => setAnn(false)} />
      </> : null}

      {admin ? <Card testID="cl-staff">
        <CardTitle title={t("cl_staff")} />
        <Muted small>{t("cl_staffHint")}</Muted>
        {pending.length ? <Col gap={6} testID="cl-requests">
          <T v="eyebrow">{t("cl_requests")}</T>
          {pending.map(x => (
            <ListItem key={x.userId} testID={"cl-req-" + x.userId} title={x.displayName || "–"} sub={t("clr_pending")}>
              <Btn small kind="primary" testID={"cl-req-open-" + x.userId} label={t("cl_confirm")} onPress={() => setEdit(x)} style={{ alignSelf: "flex-start" }} />
            </ListItem>
          ))}
        </Col> : null}
        {staff == null ? <Muted>{t("loading")}</Muted> : active.map(x => (
          <ListItem key={x.userId} testID={"cl-off-" + x.userId} title={(x.displayName || "–") + (x.userId === s.user?.id ? " (" + t("cl_mine") + ")" : "")}
            sub={[x.title, x.teams == null ? t("cl_teamsAll") : x.teams.length <= 3 ? x.teams.map(teamName).join(", ") : tf("cl_teamsN", { n: x.teams.length })].filter(Boolean).join(" · ")}
            right={<Tag label={t("clr_" + x.role)} />}>
            <PermChips perms={x.perms} testID={"cl-perms-" + x.userId} />
            <Btn small testID={"cl-edit-" + x.userId} label={"🔑 " + t("cl_edit")} onPress={() => setEdit(x)} style={{ alignSelf: "flex-start" }} />
          </ListItem>
        ))}
      </Card> : null}

      {admin ? <Card testID="cl-codes">
        <CardTitle title={t("cl_codes")} />
        <Muted small>{t("cl_codesSub")}</Muted>
        <CodeBox label={t("cl_codeLink")} code={codes.link} share={tf("cl_shareLink", { c: club.name, code: codes.link || "" })} testID="cl-code-link" />
        <CodeBox label={t("cl_codeStaff")} code={codes.staff} share={tf("cl_shareStaff", { c: club.name, code: codes.staff || "" })} testID="cl-code-staff" />
        {ask === "codes" ? <Confirm testID="cl-codes-q" text={t("cl_newCodesQ")} yes={t("cl_newCodes")} busy={busy} onNo={() => setAsk(null)}
          onYes={() => run(async () => { const r = await s.api.clubRegenerateCodes(club.id); setCodes({ link: r.linkCode, staff: r.staffCode }); s.toast(t("cl_saved")); await s.refreshClubs(); })} />
          : <Btn small testID="cl-codes-new" label={t("cl_newCodes")} onPress={() => setAsk("codes")} style={{ alignSelf: "flex-start" }} />}
      </Card> : null}

      {official && teams ? <Card testID="cl-teams">
        <CardTitle title={t("cl_teamsCard")} />
        {teams.map(x => (
          <ListItem key={x.teamId} testID={"cl-tm-" + x.teamId} title={x.name} sub={x.access ? undefined : t("cl_noAccessS")}
            right={admin && ask !== "unlink-" + x.teamId ? <Btn small kind="ghost" testID={"cl-unlink-" + x.teamId} label={t("cl_unlink")} onPress={() => setAsk("unlink-" + x.teamId)} /> : undefined}>
            {ask === "unlink-" + x.teamId ? <Confirm testID={"cl-unlink-q-" + x.teamId} text={tf("cl_unlinkTeamQ", { t: x.name })} yes={t("cl_unlink")} busy={busy} onNo={() => setAsk(null)}
              onYes={() => run(async () => { if (await s.clubUnlink(x.teamId)) await load(); })} /> : null}
          </ListItem>
        ))}
        <Muted small>{t("cl_teamsCardHint")}</Muted>
      </Card> : null}

      {admin ? <Card testID="cl-settings">
        <CardTitle title={t("cl_settings")} />
        <Field testID="cl-name" label={t("cl_name")} value={name} onChangeText={setName} maxLength={100} />
        {name.trim() && name.trim() !== club.name ? <Btn small kind="primary" testID="cl-name-save" label={t("save")} disabled={busy}
          onPress={() => run(async () => { await s.api.clubUpdate(club.id, { name: name.trim() }); await s.refreshClubs(); s.toast(t("cl_saved")); })} style={{ alignSelf: "flex-start" }} /> : null}
        <T v="small" bold color={c.muted}>{t("cl_color")}</T>
        <ColorPicker value={club.accent} onChange={col => run(async () => { await s.api.clubUpdate(club.id, { accent: col }); await s.refreshClubs(); })} />
        {ask === "delete" ? <Confirm danger testID="cl-delete-q" text={t("cl_deleteQ")} yes={t("cl_delete")} busy={busy} onNo={() => setAsk(null)}
          onYes={() => run(async () => { await s.api.clubDelete(club.id); s.toast(t("cl_deleted")); await s.clubChanged(); setCid(null); })} />
          : <Btn small kind="danger" testID="cl-delete" label={t("cl_delete")} onPress={() => setAsk("delete")} style={{ alignSelf: "flex-start" }} />}
      </Card> : null}

      {official && !admin ? (ask === "leave" ? <Confirm danger testID="cl-leave-q" text={t("cl_leaveQ")} yes={t("cl_leave")} busy={busy} onNo={() => setAsk(null)}
        onYes={() => run(async () => { if (s.user) { await s.api.clubRemoveStaff(club.id, s.user.id); s.toast(t("cl_left")); await s.clubChanged(); setCid(null); } })} />
        : <Btn kind="ghost" testID="cl-leave" label={t("cl_leave")} onPress={() => setAsk("leave")} style={{ alignSelf: "flex-start" }} />) : null}

      <ClubStaffSheet club={club} entry={edit} teams={teams || []} onClose={() => setEdit(null)} onSaved={me => { changed(me); }} />
      <View style={{ height: 8 }} />
    </Screen>
  );
}
