// Verein (Paket D): Karte in den Team-Einstellungen, Team-Kacheln der Vereinsübersicht, Ankündigung,
// Funktionäre & Rechte (Vereinsadmin) und Teamwechsel eines Spielers (Hochziehen/Wechsel).
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import { classDef, classLabel } from "../core/classes";
import { CLUB_PERMS, CLUB_ROLES, canCopyHealth, cleanClubPerms, moveTargets, type ClubInfo, type ClubRole, type ClubStaffEntry, type ClubTeam, type TeamSummary } from "../core/club";
import { parse } from "../core/dates";
import { PERMS, samePerms, type Perm } from "../core/perms";
import type { Translator } from "../core/i18n";
import type { Player } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, Chip, Col, Field, Info, Muted, Row, Seg, Sheet, T, ToggleRow } from "./kit";
import { radius, useTheme } from "./theme";

/** „Sa 19.10.“ ohne Engine (die Vereinsübersicht funktioniert auch ohne geöffnetes Team) */
export function dayLabel(tr: Translator, d: string): string {
  const x = parse(d), dd = String(x.getDate()).padStart(2, "0"), mm = String(x.getMonth() + 1).padStart(2, "0");
  return `${tr.tl("wd")[x.getDay()] || ""} ${tr.lang === "en" ? dd + "/" + mm : dd + "." + mm + "."}`;
}

/** Rückfrage direkt im Inhalt (ohne Dialog) */
export function Confirm({ text, yes, onYes, onNo, busy, testID, danger }: { text: string; yes: string; onYes: () => void; onNo: () => void; busy?: boolean; testID?: string; danger?: boolean }) {
  const s = useStore(); const { c } = useTheme();
  return (
    <Banner color={danger ? c.crit : c.warn} testID={testID}>
      <Col gap={8}>
        <T v="small">{text}</T>
        <Row gap={8} wrap>
          <Btn small label={s.tr.t("no")} onPress={onNo} />
          <Btn small kind={danger ? "danger" : "primary"} testID={testID ? testID + "-yes" : undefined} label={yes} disabled={busy} onPress={onYes} />
        </Row>
      </Col>
    </Banner>
  );
}

/** Code mit Teilen-Knopf */
export function CodeBox({ label, code, share, testID }: { label: string; code: string | null; share: string; testID: string }) {
  const s = useStore(); const { c } = useTheme();
  return (
    <Col gap={6}>
      <T v="small" bold color={c.muted}>{label}</T>
      <Row gap={10} wrap>
        <Text selectable testID={testID} style={{ fontSize: 22, fontWeight: "800", letterSpacing: 2, color: c.ink, fontVariant: ["tabular-nums"] }}>{code || "–"}</Text>
        {code ? <Btn small label={s.tr.t("cd_share")} onPress={() => { Share.share({ message: share }).catch(() => undefined); }} /> : null}
      </Row>
    </Col>
  );
}

/** Team-Einstellungen: Verein anlegen, per Code verbinden oder lösen (Team-Owner) */
export function ClubLinkCard() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const team = E.team, owner = s.active?.role === "owner" && !(s.isDemo && s.demoStaff);
  const club = team.clubId ? s.clubs.find(x => x.id === team.clubId) || null : null;
  const [mode, setMode] = useState<"none" | "create" | "link">("none");
  const [name, setName] = useState(team.club || ""); const [code, setCode] = useState("");
  const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<boolean>) => { setBusy(true); try { if (await fn()) { setMode("none"); setAsk(false); } } finally { setBusy(false); } };
  return (
    <Card testID="club-card">
      <CardTitle title={t("cl_card")} info={<Info title={t("cl_card")} text={t("cl_info")} />} />
      {team.clubId ? <Col gap={10}>
        <T bold testID="club-linked">{tf("cl_linkedTo", { c: club?.name || team.club || "–" })}</T>
        <Row gap={8} wrap>
          <Btn small kind="primary" testID="club-open" label={t("cl_open")} onPress={() => router.push("/verein")} />
          {owner && !ask ? <Btn small kind="ghost" testID="club-unlink" label={t("cl_unlink")} onPress={() => setAsk(true)} /> : null}
        </Row>
        {ask ? <Confirm testID="club-unlink-q" text={t("cl_unlinkQ")} yes={t("cl_unlink")} busy={busy} onNo={() => setAsk(false)} onYes={() => run(() => s.clubUnlink(team.id))} /> : null}
        {!owner ? <Muted small>{t("cl_ownerOnly")}</Muted> : null}
      </Col> : <Col gap={10}>
        <Muted small>{t("cl_pitch")}</Muted>
        {!owner ? <Muted small>{t("cl_ownerOnly")}</Muted> : <>
          <Row gap={8} wrap>
            <Btn small testID="club-mode-create" kind={mode === "create" ? "primary" : "default"} icon="plus" label={t("cl_create")} onPress={() => setMode(mode === "create" ? "none" : "create")} />
            <Btn small testID="club-mode-link" kind={mode === "link" ? "primary" : "default"} label={t("cl_link")} onPress={() => setMode(mode === "link" ? "none" : "link")} />
          </Row>
          {mode === "create" ? <Col gap={8}>
            <Field testID="club-name" label={t("cl_name")} value={name} onChangeText={setName} maxLength={100} />
            <Muted small>{t("cl_createHint")}</Muted>
            <Btn small kind="primary" testID="club-create" label={t("cl_create")} disabled={busy || !name.trim()} onPress={() => run(() => s.clubCreate(name.trim()))} style={{ alignSelf: "flex-start" }} />
          </Col> : null}
          {mode === "link" ? <Col gap={8}>
            <Field testID="club-code" label={t("cl_linkCode")} value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABCD-EFGH" />
            <Muted small>{t("cl_linkHint")}</Muted>
            <Btn small kind="primary" testID="club-link" label={t("cl_link")} disabled={busy || code.replace(/[^A-Za-z0-9]/g, "").length < 8} onPress={() => run(() => s.clubLink(code))} style={{ alignSelf: "flex-start" }} />
          </Col> : null}
        </>}
      </Col>}
    </Card>
  );
}

/** Startseite: Hinweis, wenn das Team über den Verein geöffnet ist (mit den eigenen Rechten) */
export function ViaClubBanner() {
  const s = useStore(); const { t, tf } = s.tr; const router = useRouter();
  if (!s.active?.viaClub || s.viewAs !== "coach") return null;
  const pm = PERMS.filter(p => s.perms.has(p)).map(p => t("pm_" + p)).join(", ");
  return (
    <Banner testID="via-club">
      <Col gap={6}>
        <T v="small">{tf("cl_viaBanner", { r: pm || "–" })}</T>
        <Btn small testID="via-club-open" label={t("cl_open")} onPress={() => router.push("/verein")} style={{ alignSelf: "flex-start" }} />
      </Col>
    </Banner>
  );
}

/** Kachel eines Teams in der Vereinsübersicht – nur Kennzahlen, keine Daten einzelner Spieler */
export function TeamSummaryCard({ x, current, onOpen, busy }: { x: TeamSummary; current: boolean; onOpen?: () => void; busy?: boolean }) {
  const s = useStore(); const tr = s.tr, { t, tf } = tr; const { c } = useTheme();
  const res = x.last ? (x.last.own > x.last.against ? c.ok : x.last.own < x.last.against ? c.crit : c.warn) : c.muted;
  const plan = x.planState == null ? null : x.planState === "none" ? t("cl_planNone") : x.planState === "live" ? t("mp_st_liveShort") : t("mp_st_" + x.planState);
  const planCol = x.planState === "live" ? c.ok : x.planState === "scheduled" ? c.warn : x.planState === "none" ? c.crit : c.build;
  return (
    <Card testID={"cl-team-" + x.teamId} style={current ? { borderWidth: 2, borderColor: c.accent } : undefined}>
      <Row between align="flex-start" gap={10}>
        <Col gap={2} style={{ flex: 1 }}>
          <T v="h3">{x.name}</T>
          <Muted small>{[classLabel(classDef(x.cls), tr.lang), tf("cl_playersN", { n: x.players }), x.coach].filter(Boolean).join(" · ")}</Muted>
        </Col>
        {current ? <Chip label={t("cl_current")} color={c.accentTx} /> : onOpen ? <Btn small testID={"cl-open-" + x.teamId} label={t("cl_openTeam")} disabled={busy} onPress={onOpen} /> : null}
      </Row>
      <View style={{ backgroundColor: c.sunk, borderRadius: radius.m, padding: 10, gap: 4 }}>
        <T v="small" bold testID={"cl-next-" + x.teamId}>{x.next ? `${dayLabel(tr, x.next.date)} ${x.next.time} · ${x.next.opp} (${x.next.home ? t("cl_homeS") : t("cl_awayS")})` : t("cl_noNext")}</T>
        {x.last ? <T v="small" color={res}>{tf("cl_last", { r: `${x.last.own}:${x.last.against}`, o: x.last.opp })}</T> : null}
        <Muted small>{tf("cl_season", { w: x.won, d: x.drawn, l: x.lost, gf: x.goalsFor, ga: x.goalsAgainst })}</Muted>
      </View>
      <Row wrap gap={6}>
        {x.injured != null ? <Chip testID={"cl-inj-" + x.teamId} label={tf("cl_injured", { n: x.injured })} color={x.injured ? c.inj : c.build} /> : null}
        {x.sick != null ? <Chip label={tf("cl_sick", { n: x.sick })} color={x.sick ? c.warn : c.build} /> : null}
        {x.absent ? <Chip label={tf("cl_absent", { n: x.absent })} color={c.low} /> : null}
        {x.attRate != null ? <Chip label={tf("cl_att", { p: Math.round(x.attRate * 100) })} color={x.attRate >= 0.8 ? c.ok : x.attRate >= 0.65 ? c.warn : c.crit} /> : null}
        <Chip label={tf("cl_sessions", { n: x.sessions28 })} color={c.build} />
        {plan ? <Chip testID={"cl-plan-" + x.teamId} label={"📋 " + plan} color={planCol} /> : null}
      </Row>
    </Card>
  );
}

/** Ankündigung in die Teamchats ausgewählter Teams */
export function AnnounceSheet({ club, teams, visible, onClose }: { club: ClubInfo; teams: { teamId: string; name: string }[]; visible: boolean; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  const [body, setBody] = useState(""); const [all, setAll] = useState(true); const [sel, setSel] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setAll(true); setSel(teams.map(x => x.teamId)); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = all ? null : sel;
  const send = async () => {
    setBusy(true);
    try { const n = await s.clubAnnounce(club.id, body, pick); if (n != null) { setBody(""); onClose(); } } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("cl_announceT")} testID="cl-announce-sheet" closeLabel={t("cancel")}>
      <Col gap={12}>
        <Muted small>{t("cl_announceHint")}</Muted>
        <Field testID="cl-announce-text" label={t("cl_announceText")} value={body} onChangeText={setBody} multiline maxLength={4000} placeholder={t("cl_announcePh")} />
        <ToggleRow testID="cl-announce-all" label={t("cl_allTeams")} value={all} onChange={setAll} />
        {!all ? <Row wrap gap={6}>{teams.map(x => {
          const on = sel.includes(x.teamId);
          return <Btn key={x.teamId} small testID={"cl-announce-t-" + x.teamId} kind={on ? "primary" : "default"} label={(on ? "✓ " : "") + x.name} onPress={() => setSel(L => on ? L.filter(y => y !== x.teamId) : [...L, x.teamId])} />;
        })}</Row> : null}
        <Btn kind="primary" testID="cl-announce-send" icon="chat" label={t("cl_send")} disabled={busy || !body.trim() || (!all && !sel.length)} onPress={send} />
      </Col>
    </Sheet>
  );
}

/** Vereinsadmin: Funktion, Bezeichnung, Rechte und Teams eines Funktionärs (auch Anfrage bestätigen) */
export function ClubStaffSheet({ club, entry, teams, onClose, onSaved }: { club: ClubInfo; entry: ClubStaffEntry | null; teams: ClubTeam[]; onClose: () => void; onSaved: (me: boolean) => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const [role, setRole] = useState<ClubRole>("koord"); const [title, setTitle] = useState(""); const [perms, setPerms] = useState<Perm[]>([]);
  const [all, setAll] = useState(true); const [sel, setSel] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!entry) return;
    const r: ClubRole = entry.role === "pending" ? "koord" : entry.role;
    setRole(r); setTitle(entry.title); setPerms(entry.role === "pending" ? [...CLUB_PERMS[r]] : cleanClubPerms(entry.perms));
    setAll(entry.teams == null); setSel(entry.teams || []); setAsk(false);
  }, [entry]);
  if (!entry) return null;
  const me = entry.userId === s.user?.id;
  const setR = (r: ClubRole) => { if (samePerms(perms, CLUB_PERMS[role])) setPerms([...CLUB_PERMS[r]]); setRole(r); };
  const toggle = (p: Perm, on: boolean) => setPerms(x => cleanClubPerms(on ? [...x, p] : x.filter(y => y !== p)));
  const save = async () => {
    setBusy(true);
    try { await s.api.clubSetStaff(club.id, entry.userId, role, title, perms, all ? null : sel); s.toast(t("cl_saved")); onSaved(me); onClose(); }
    catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await s.api.clubRemoveStaff(club.id, entry.userId); s.toast(me ? t("cl_left") : t("cl_saved")); onSaved(me); onClose(); }
    catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!entry} onClose={onClose} title={`${t("cl_staffT")} · ${entry.displayName || "–"}`} testID="cl-staff-sheet" closeLabel={t("cancel")}>
      <Col gap={12}>
        <Col gap={6}>
          <T v="eyebrow">{t("cl_role")}</T>
          <Seg testID="cl-role" wrap value={role} onChange={setR} options={CLUB_ROLES.map(r => ({ key: r, label: t("clr_" + r) }))} />
          <Muted small>{t("clr_" + role + "D")}</Muted>
        </Col>
        <Field testID="cl-title" label={t("cl_titleF")} value={title} onChangeText={setTitle} maxLength={60} placeholder={t("cl_titlePh")} />
        <Col gap={2}>
          <Row between><T v="eyebrow">{t("cl_rights")}</T>{!samePerms(perms, CLUB_PERMS[role]) ? <Btn small kind="ghost" testID="cl-perm-default" label={t("cl_rightsDefault")} onPress={() => setPerms([...CLUB_PERMS[role]])} /> : null}</Row>
          {PERMS.map(p => <ToggleRow key={p} testID={"cl-perm-" + p} label={t("pm_" + p)} desc={t("pm_" + p + "D")} value={perms.includes(p)} onChange={v => toggle(p, v)} />)}
        </Col>
        {perms.includes("health") || perms.includes("medical") ? <Banner color={c.warn} testID="cl-health-warn"><T v="small">{t("cl_healthWarn")}</T></Banner> : null}
        <Col gap={6}>
          <T v="eyebrow">{t("cl_teamsF")}</T>
          <ToggleRow testID="cl-teams-all" label={t("cl_teamsAll")} desc={t("cl_teamsAllD")} value={all} onChange={setAll} />
          {!all ? <Row wrap gap={6}>{teams.map(x => {
            const on = sel.includes(x.teamId);
            return <Btn key={x.teamId} small testID={"cl-team-pick-" + x.teamId} kind={on ? "primary" : "default"} label={(on ? "✓ " : "") + x.name} onPress={() => setSel(L => on ? L.filter(y => y !== x.teamId) : [...L, x.teamId])} />;
          })}</Row> : null}
          {!all && !sel.length ? <Muted small>{t("cl_teamsPick")}</Muted> : null}
        </Col>
        <Row wrap gap={8}>
          <Btn kind="primary" testID="cl-staff-save" disabled={busy || (!all && !sel.length)} label={entry.role === "pending" ? t("cl_confirm") : t("save")} onPress={save} />
          {!ask ? <Btn kind="ghost" testID="cl-staff-remove" disabled={busy} label={entry.role === "pending" ? t("cl_reject") : me ? t("cl_leave") : t("cl_remove")} onPress={() => setAsk(true)} /> : null}
        </Row>
        {ask ? <Confirm danger testID="cl-staff-remove-q" text={me ? t("cl_leaveQ") : tf("cl_removeQ", { n: entry.displayName || "–" })} yes={me ? t("cl_leave") : entry.role === "pending" ? t("cl_reject") : t("cl_remove")} busy={busy} onNo={() => setAsk(false)} onYes={remove} /> : null}
      </Col>
    </Sheet>
  );
}

/** Spieler ins andere Team: zusätzlich (Hochziehen) oder dauerhaft; optional mit Belastung (Recht „Gesundheitsdaten“ in beiden Teams) */
export function MoveSheet({ player, onClose }: { player: Player | null; onClose: (moved: boolean) => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const cur = s.active, targets = cur ? moveTargets(s.memberships, { teamId: cur.teamId, role: cur.role, clubId: E.team.clubId }) : [];
  const [target, setTarget] = useState<string | null>(null); const [mode, setMode] = useState<"add" | "move">("add"); const [copy, setCopy] = useState(true); const [busy, setBusy] = useState(false);
  useEffect(() => { if (player) { setTarget(targets.length === 1 ? targets[0].teamId : null); setMode("add"); setCopy(true); } }, [player]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!player || !cur) return null;
  const tm = targets.find(x => x.teamId === target) || null;
  // Demo: das eigene Team hat alle Rechte (Owner) – wie in der Datenbank
  const fromPerms = { role: cur.role, perms: cur.perms }, okCopy = tm ? canCopyHealth(fromPerms, tm) && s.can("health") : false;
  const name = E.name(player);
  const go = async () => {
    if (!tm) return;
    setBusy(true);
    try { const ok = await s.movePlayer(player.id, tm.teamId, mode, okCopy && copy); if (ok) onClose(mode === "move"); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!player} onClose={() => onClose(false)} title={tf("cl_moveT", { n: name })} testID="cl-move-sheet" closeLabel={t("cancel")}>
      {!targets.length ? <Muted testID="cl-move-none">{t("cl_noTargets")}</Muted> : <Col gap={12}>
        <Col gap={6}>
          <T v="eyebrow">{t("cl_target")}</T>
          <Row wrap gap={6}>{targets.map(x => (
            <Btn key={x.teamId} small testID={"cl-move-t-" + x.teamId} kind={target === x.teamId ? "primary" : "default"} label={x.name + (x.viaClub ? " · " + t("cl_via") : "")} onPress={() => setTarget(x.teamId)} />
          ))}</Row>
        </Col>
        <Seg testID="cl-move-mode" wrap value={mode} onChange={setMode} options={[{ key: "add", label: t("cl_mode_add") }, { key: "move", label: t("cl_mode_move") }]} />
        <Muted small>{tf(mode === "add" ? "cl_mode_addD" : "cl_mode_moveD", { n: player.vn })}</Muted>
        {tm ? (okCopy ? <ToggleRow testID="cl-move-copy" label={t("cl_copy")} desc={t("cl_copyD")} value={copy} onChange={setCopy} />
          : <Banner color={c.build} testID="cl-move-nocopy"><T v="small">{t("cl_copyNo")}</T></Banner>) : null}
        <Btn kind="primary" testID="cl-move-go" disabled={busy || !tm} label={mode === "move" ? t("cl_doMove") : t("cl_doAdd")} onPress={go} />
      </Col>}
    </Sheet>
  );
}
