// Trainer – Kader fürs Spiel nominieren: Spieler (nach Mannschaftsteilen) in den Kader oder auf Abruf, Abwesende
// markiert, Schnellauswahl (alle verfügbaren, aus dem Matchplan), Treffpunkt, Hinweis, Sichtbarkeit; als Entwurf
// speichern oder veröffentlichen (optional im Teamchat ankündigen). Danach: Zu- und Absagen, Antworten eintragen,
// Offene erinnern, zurückziehen oder löschen.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { posGroup } from "../../../src/core/classes";
import { absentOn, answersAllowed, kickoff, nomsOf, openWithAccount, squadAnnouncement, squadCounts, squadSort } from "../../../src/core/nomination";
import { squadOf } from "../../../src/core/matchplan";
import { cardRules, suspendedIn } from "../../../src/core/cards";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Banner, Btn, Card, CardTitle, Check, Col, Field, Header, Info, Muted, Row, Screen, T, TimeField, ToggleRow } from "../../../src/ui/kit";
import { AnswerSheet, answerStyle, matchLine } from "../../../src/ui/nomination";
import { suspShort } from "../../../src/ui/cards";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { announceChat } from "../../../src/ui/polls";
import { radius, useTheme, withAlpha } from "../../../src/ui/theme";

type Pick_ = "squad" | "standby";
const GROUPS = ["TW", "Abwehr", "Mittelfeld", "Sturm"] as const;

export default function Nominierung() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const m = E.D.matches.find(x => x.id === id) || null;
  const sq = m ? E.D.squads[m.id] : undefined;
  const noms = m ? nomsOf(E.D, m.id) : [];
  const canEdit = s.can("plan");
  const defMeet = useMemo(() => { if (!m || !/^\d{2}:\d{2}$/.test(m.zeit)) return "13:45"; const [h, mi] = m.zeit.split(":").map(Number), x = Math.max(0, h * 60 + mi - 75); return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; }, [m]);
  const [sel, setSel] = useState<Record<string, Pick_>>(() => Object.fromEntries(noms.map(n => [n.pid, n.standby ? "standby" : "squad"])));
  const [meetTime, setMeetTime] = useState(sq?.meetTime || defMeet);
  const [meetPlace, setMeetPlace] = useState(sq?.meetPlace || "");
  const [note, setNote] = useState(sq?.note || "");
  const [showAll, setShowAll] = useState(sq ? sq.showAll : true);
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<string | null>(null);
  const [askDel, setAskDel] = useState(false);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/kalender");
  if (!m) return <Screen testID="coach-nominate"><Header title={t("nm_title")} onBack={back} backLabel={t("btn_back")} /><Muted>{t("err_not_found")}</Muted></Screen>;

  const players = E.D.players.filter(p => p.active !== false || !!sel[p.id]).sort(squadSort);
  const list = players.filter(p => sel[p.id]).map(p => ({ pid: p.id, standby: sel[p.id] === "standby" }));
  const nSquad = list.filter(x => !x.standby).length, nStandby = list.length - nSquad;
  const saved = Object.fromEntries(noms.map(n => [n.pid, n.standby ? "standby" : "squad"]));
  const dirty = JSON.stringify(Object.entries(sel).sort()) !== JSON.stringify(Object.entries(saved).sort())
    || (sq ? meetTime !== (sq.meetTime || defMeet) || meetPlace.trim() !== sq.meetPlace || note.trim() !== sq.note || showAll !== sq.showAll : true);
  const k = squadCounts(noms), allowAns = answersAllowed(E.team, m, new Date()), started = new Date() >= kickoff(m);
  const chat = E.mods.chat !== false ? announceChat(s.chats, { groupId: null }) : null;
  const when = `${E.wt(m.date)} ${E.de(m.date)}`;
  const plan = E.mods.matchplan ? E.D.plans.find(p => p.matchId === m.id) || null : null, planIds = plan ? squadOf(plan.c) : [];
  // gesperrte Spieler (Karten & Sperren): markiert und nicht bei „Alle verfügbaren“
  const sus = E.mods.karten !== false ? suspendedIn(E.D, cardRules(E.team), m.id, E.TODAY) : new Map();

  const toggle = (pid: string, v: Pick_) => setSel(x => { const y = { ...x }; if (y[pid] === v) delete y[pid]; else y[pid] = v; return y; });
  // alle verfügbaren: aktiv, nicht abwesend, keine neue App-Anmeldung, die noch zusammengeführt werden muss
  const pickAvail = () => setSel(x => { const y = { ...x }; for (const p of players) if (p.active !== false && !p.neu && !absentOn(E.D, p.id, m.date) && !sus.has(p.id) && !y[p.id]) y[p.id] = "squad"; return y; });
  const pickPlan = () => setSel(x => { const y = { ...x }; for (const pid of planIds) if (E.P(pid) && !y[pid]) y[pid] = "squad"; return y; });

  const save = async (publish: boolean | null) => {
    if (publish && !list.length) { s.toast(t("nm_noPlayers")); return; }
    const pub = publish === null ? sq?.published || null : publish ? sq?.published || new Date().toISOString() : null;
    const ok = publish === true && !sq?.published ? "nm_publishedT" : publish === false && sq?.published ? "nm_unpublishedT" : "nm_saved";
    setBusy(true);
    try {
      const done = await s.saveSquad({ matchId: m.id, meetTime, meetPlace, note, showAll, published: pub }, list, t(ok));
      if (done !== false && publish === true && !sq?.published && announce && chat) await sendAnnounce();
    } finally { setBusy(false); }
  };
  const sendAnnounce = async () => {
    const cur = E.D.squads[m.id];
    if (!chat || !cur) return;
    await s.chatSend(chat.id, squadAnnouncement(m, cur, E.D, E.tr, when, E.team.settings.playerAbs ?? true));
    s.toast(t("nm_announced"));
  };
  const remind = async () => {
    setBusy(true);
    try { await s.remindSquad(openWithAccount(E.D, m.id).map(p => p.id), tf("nm_remindMsg", { w: when, g: m.gegner }), m.date); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { if ((await s.deleteSquad(m.id)) !== false) back(); } finally { setBusy(false); setAskDel(false); } };
  const remindable = sq?.published && allowAns && s.can("messages") ? openWithAccount(E.D, m.id) : [];

  return (
    <Screen testID="coach-nominate">
      <Header onBack={back} backLabel={t("btn_back")} eyebrow={`${matchLine(E, m)} · ${t("comp_" + m.comp)}`} title={`${t("nm_title")} ${t("vs")} ${m.gegner}`}
        info={<Info title={t("nm_title")} text={t("nm_info")} />} />

      {sq ? (
        <Card testID="nm-status" tone={sq.published ? c.ok : c.warn}>
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: sq.published ? c.ok : c.warn }}>{sq.published ? tf("nm_publishedOn", { d: E.de(sq.published.slice(0, 10)) + sq.published.slice(0, 4) }) : t("nm_draft")}</Text>
          <Muted small>{tf("nm_countLine", { s: k.squad, b: k.standby })}</Muted>
          {sq.published && (E.team.settings.playerAbs ?? true) ? <T bold testID="nm-answers">{tf("nm_answerLine", { y: k.yes, n: k.no, o: k.open })}</T> : null}
          {sq.published && !(E.team.settings.playerAbs ?? true) ? <Muted small>{t("nm_answersOff")}</Muted> : null}
          {sq.published && started ? <Muted small>{t("nm_past")}</Muted> : null}
          {remindable.length ? <Btn small icon="send" testID="nm-remind" label={tf("nm_remind", { n: remindable.length })} disabled={busy} onPress={remind} style={{ alignSelf: "flex-start" }} /> : null}
        </Card>
      ) : null}

      <Card testID="nm-players">
        <CardTitle title={tf("nm_selected", { n: list.length })} />
        <Muted small>{tf("nm_countLine", { s: nSquad, b: nStandby })}</Muted>
        {canEdit ? (
          <Row gap={8} wrap>
            <Btn small testID="nm-all" label={t("nm_allAvail")} onPress={pickAvail} />
            {planIds.length ? <Btn small testID="nm-plan" icon="board" label={t("nm_fromPlan")} onPress={pickPlan} /> : null}
            {list.length ? <Btn small kind="ghost" testID="nm-clear" label={t("nm_clear")} onPress={() => setSel({})} /> : null}
          </Row>
        ) : null}
        {GROUPS.map(g => {
          const L = players.filter(p => posGroup(p.pos) === g);
          if (!L.length) return null;
          return (
            <Col key={g} gap={2} testID={"nm-g-" + g}>
              <T v="eyebrow">{`${t("f_" + g)} (${L.filter(p => sel[p.id]).length}/${L.length})`}</T>
              {L.map(p => {
                const ab = absentOn(E.D, p.id, m.date), n = noms.find(x => x.pid === p.id), cur = sel[p.id], st = n && sq?.published ? answerStyle(E, c, n) : null;
                return (
                  <View key={p.id} testID={"nm-p-" + p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line, opacity: cur || !ab ? 1 : 0.6 }}>
                    <PlayerAvatar p={p} size={32} />
                    <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{E.name(p)}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.muted }}>{[p.nr != null ? "#" + p.nr : "", p.pos].filter(Boolean).join(" · ")}</Text>
                      {ab ? <Text testID={"nm-abs-" + p.id} style={{ fontSize: 12.5, fontWeight: "600", color: c.crit }}>{`${t("nm_unavailable")}: ${t("ab_" + ab.typ)}${ab.bis ? ` (${t("until")} ${E.de(ab.bis)})` : ""}`}</Text> : null}
                      {sus.has(p.id) ? <Text testID={"nm-susp-" + p.id} style={{ fontSize: 12.5, fontWeight: "600", color: c.crit }}>{tf("nm_suspended", { r: suspShort(E, sus.get(p.id)!) })}</Text> : null}
                      {st ? (
                        <Pressable testID={"nm-ans-" + p.id} accessibilityRole="button" accessibilityLabel={`${t("nm_setAnswer")}: ${st.label}`} disabled={!canEdit} onPress={() => setAns(p.id)} hitSlop={4}
                          style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.color }} />
                          <Text style={{ fontSize: 12.5, fontWeight: "700", color: st.color }}>{st.label}{n!.answer === "no" && n!.reason ? ` – ${n!.reason}` : ""}{n!.byStaff ? ` (${t("nm_byStaff")})` : ""}</Text>
                        </Pressable>
                      ) : null}
                    </Col>
                    {canEdit ? (
                      <Row gap={6}>
                        <PickChip testID={"nm-sq-" + p.id} on={cur === "squad"} label={t("nm_inSquad")} color={c.accent} ink={c.accentInk} onPress={() => toggle(p.id, "squad")} />
                        <PickChip testID={"nm-sb-" + p.id} on={cur === "standby"} label={t("nm_standbyShort")} color={c.warn} ink="#ffffff" onPress={() => toggle(p.id, "standby")} />
                      </Row>
                    ) : cur ? <Muted small>{cur === "squad" ? t("nm_inSquad") : t("nm_standbyShort")}</Muted> : null}
                  </View>
                );
              })}
            </Col>
          );
        })}
      </Card>

      {canEdit ? (
        <Card testID="nm-details">
          <CardTitle title={t("nm_meet")} />
          <Row gap={10} wrap align="flex-end">
            <TimeField testID="nm-meet-time" label={t("nm_meetTime")} value={meetTime} onChange={setMeetTime} lang={E.tr.lang} style={{ width: 150 }} />
            <Field testID="nm-meet-place" label={t("nm_meetPlace")} placeholder={t("nm_meetPlacePh")} value={meetPlace} onChangeText={setMeetPlace} maxLength={120} style={{ flex: 1, minWidth: 180 }} />
          </Row>
          <Field testID="nm-note" label={t("nm_note")} placeholder={t("nm_notePh")} value={note} onChangeText={setNote} multiline maxLength={500} />
          <ToggleRow testID="nm-show-all" label={t("nm_showAll")} desc={t("nm_showAllD")} value={showAll} onChange={setShowAll} />
          {!(E.team.settings.playerAbs ?? true) ? <Banner>{t("nm_answersOff")}</Banner> : null}
        </Card>
      ) : null}

      {canEdit ? (
        <Col gap={10}>
          {!sq?.published && chat ? <Check testID="nm-announce" label={t("nm_announce")} value={announce} onChange={setAnnounce} /> : null}
          <Row gap={10} wrap>
            {sq?.published ? <>
              <Btn kind="primary" testID="nm-save" label={t("nm_saveChanges")} disabled={busy || !dirty} onPress={() => save(null)} />
              {chat ? <Btn kind="ghost" icon="chat" testID="nm-announce-now" label={t("nm_announce")} disabled={busy || dirty} onPress={sendAnnounce} /> : null}
              <Btn kind="ghost" testID="nm-unpublish" label={t("nm_unpublish")} disabled={busy} onPress={() => save(false)} />
            </> : <>
              <Btn kind="primary" icon="send" testID="nm-publish" label={t("nm_publish")} disabled={busy || !list.length} onPress={() => save(true)} />
              <Btn kind="ghost" testID="nm-save" label={t("nm_save")} disabled={busy || (!!sq && !dirty)} onPress={() => save(null)} />
            </>}
            {sq ? <Btn kind="ghost" icon="trash" testID="nm-delete" label={t("nm_delete")} disabled={busy} onPress={() => setAskDel(true)} /> : null}
          </Row>
          <Muted small>{t(sq?.published ? "nm_liveHint" : "nm_publishHint")}</Muted>
          {askDel ? (
            <Banner color={c.crit}>
              <Col gap={8}>
                <T bold>{t("nm_deleteQ")}</T>
                <Row gap={8}><Btn small label={t("no")} onPress={() => setAskDel(false)} /><Btn small kind="danger" testID="nm-delete-confirm" label={t("nm_delete")} disabled={busy} onPress={del} /></Row>
              </Col>
            </Banner>
          ) : null}
        </Col>
      ) : <Muted>{tf("pm_denied", { p: t("pm_plan") })}</Muted>}

      <AnswerSheet matchId={m.id} pid={ans} onClose={() => setAns(null)} />
    </Screen>
  );
}

/** Auswahl-Chip „Kader“ bzw. „Abruf“ (nochmal tippen = abwählen) */
function PickChip({ on, label, color, ink, onPress, testID }: { on: boolean; label: string; color: string; ink: string; onPress: () => void; testID: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1,
        borderColor: on ? color : c.line, backgroundColor: on ? color : withAlpha(c.ink, 0.03) }}>
      {on ? <Icon name="check" size={13} color={ink} strokeWidth={2.8} /> : null}
      <Text style={{ fontSize: 13, fontWeight: "700", color: on ? ink : c.muted }}>{label}</Text>
    </Pressable>
  );
}
