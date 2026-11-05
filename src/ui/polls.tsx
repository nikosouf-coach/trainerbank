// Umfragen – Oberfläche für Trainerteam und Spieler: Abstimmungen und Fragebögen anlegen (auch aus Vorlagen),
// abstimmen bzw. ausfüllen, Ergebnisse (anonym erst ab drei Antworten, Freitexte nur fürs Trainerteam), erinnern,
// beenden, löschen und die Karten für die Startseiten. Die Regeln selbst stehen in core/polls und in der Datenbank.
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addDays } from "../core/dates";
import type { Engine } from "../core/engine";
import {
  ANON_MIN, PLAYER_OPEN_MAX, POLL_LIMITS, POLL_QTYPES, answerOf, asPlayerPoll, blankQuestion, cleanAnswers, cleanPoll, cleanQuestion, leaders, nextQuestionId, openPollsBy,
  pct, pollEditable, pollOpen, pollResult, pollTargets, pollTemplates, reopened, resultsVisible, sortPolls, type PollTemplate,
} from "../core/polls";
import type { Chat, Poll, PollQResult, PollQType, PollQuestion, PollResult, PollValue } from "../core/types";
import { useEngine, useStore } from "../data/store";
import { Icon, type IconName } from "./icons";
import { Banner, Bar, Btn, Card, CardTitle, Check, ChoiceChips, Col, DateField, Field, Group, Muted, NavRow, NumScale, Row, Section, Seg, Sheet, T, cap } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

// ---------- Hilfen ----------
type TF = (k: string, o: Record<string, string | number>) => string;
const isChoice = (t: PollQType): boolean => t === "single" || t === "multi";
/** Erster Buchstabe klein (Etiketten mitten in einer Zeile: „mit Namen“, „anonym“) */
const low = (s: string): string => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const questionsText = (tf: TF, n: number): string => tf(n === 1 ? "um_questions1" : "um_questionsN", { n });
const answersText = (t: (k: string) => string, tf: TF, n: number): string => n === 0 ? t("um_answers0") : n === 1 ? t("um_answers1") : tf("um_answersN", { n });
/** Zahl mit einer Nachkommastelle in der Sprache der App */
const dec = (E: Engine, v: number): string => (Math.round(v * 10) / 10).toFixed(1).replace(".", E.tr.lang === "de" ? "," : ".");
const pctText = (E: Engine, n: number): string => E.tr.lang === "de" ? `${n} %` : `${n}%`;

/** Status: „bis Sa 08.11.“, „endet heute“, „ohne Ende“, „beendet“ */
export function pollState(E: Engine, p: Poll): string {
  if (!pollOpen(p, E.TODAY)) return E.t("um_endedOn");
  if (!p.until) return E.t("um_noEnd");
  return p.until === E.TODAY ? E.t("um_endsToday") : E.tf("um_until", { d: `${E.wt(p.until)} ${E.de(p.until)}` });
}
/** Kurzbeschreibung: Art · mit Namen/anonym · Status */
export const pollMeta = (E: Engine, p: Poll): string => [E.t("um_kind_" + p.kind), low(E.t(p.anonymous ? "um_anon" : "um_named")), pollState(E, p)].join(" · ");
/** An wen: ganzes Team oder Gruppe (Spieler sehen den Namen nur bei freigegebenen Gruppen) */
export function pollTarget(E: Engine, p: Poll, staff: boolean): string {
  if (!p.groupId) return E.t("um_toTeam");
  const g = E.D.groups.find(x => x.id === p.groupId);
  return g && (staff || g.vis) ? E.tf("um_toGroup", { g: g.name }) : E.t("um_toGroupHidden");
}
/** Wer sie gestartet hat (Trainerteam: aktueller Name aus dem Profil) */
export function pollAuthor(E: Engine, p: Poll, mePid: string | null): string {
  if (p.byPlayer && p.authorPid && p.authorPid === mePid) return E.t("um_byMe");
  const st = !p.byPlayer && p.createdBy ? E.D.staff.find(x => !!x.userId && x.userId === p.createdBy) : null;
  const n = st?.name || p.author;
  return n ? E.tf("um_by", { n }) : "";
}
/** Datenschutz-Hinweis für Antwortende */
const privacyText = (t: (k: string) => string, p: Poll): string =>
  p.anonymous ? t("um_privAnon") : t(p.results === "all" ? "um_privNamedAll" : "um_privNamedStaff");
/** Chat, in dem eine Umfrage angekündigt werden kann: Gruppenchat bzw. Teamchat */
export const announceChat = (chats: Chat[], p: Pick<Poll, "groupId">): Chat | null =>
  (p.groupId ? chats.find(c => c.kind === "group" && c.groupId === p.groupId) : chats.find(c => c.kind === "team")) || null;

/**
 * Ergebnis für die angemeldete Person – in der Demo lokal mit ihrer Sicht gerechnet, sonst vom Server (neu geladen,
 * sobald sich Antworten, Status oder die eigene Antwort ändern).
 */
export function usePollResult(p: Poll | null, enabled: boolean, rev = ""): PollResult | null {
  const s = useStore(); const D = s.D;
  const key = p ? [p.id, p.answers, p.closed, p.until, rev].join("|") : "";
  const tried = useRef("");
  useEffect(() => {
    if (!p || !enabled || s.isDemo || tried.current === key) return;
    tried.current = key; void s.loadPollResults(p.id);
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p || !enabled || !D) return null;
  return s.isDemo ? pollResult(D, p, { staff: s.viewAs === "coach", pid: s.mePid }) : D.pollResults[p.id] || null;
}

function IconBtn({ icon, label, onPress, disabled, testID }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={16} color={c.ink} strokeWidth={2} />
    </Pressable>
  );
}

// ---------- Ergebnisse ----------
function ChoiceResult({ q, r, mine, showVoters }: { q: PollQuestion; r: PollQResult; mine: number[]; showVoters: boolean }) {
  const E = useEngine(); const { c } = useTheme();
  const lead = new Set(leaders(r));
  return (
    <Col gap={12}>
      {q.options.map((o, i) => {
        const n = r.counts[i] || 0, on = lead.has(i), my = mine.includes(i), voters = r.voters?.[i] || [];
        return (
          <Col key={i} gap={5} testID={`pr-${q.id}-${i}`}>
            <Row between gap={10} align="flex-start">
              <Text style={{ flex: 1, color: c.ink, fontSize: 15, lineHeight: 20, fontWeight: on ? "800" : "600" }}>
                {o}{my ? <Text style={{ color: c.accentTx, fontSize: 13, fontWeight: "700" }}>{"  ✓ " + E.t("um_myPick")}</Text> : null}
              </Text>
              <Text style={{ color: on ? c.ink : c.muted, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{`${n} · ${pctText(E, pct(r, i))}`}</Text>
            </Row>
            <Bar value={r.answered ? n / r.answered : 0} color={on ? c.accent : c.faint} />
            {showVoters && voters.length ? <Muted small>{voters.join(", ")}</Muted> : null}
          </Col>
        );
      })}
    </Col>
  );
}

function ScaleResult({ q, r, mine }: { q: PollQuestion; r: PollQResult; mine: number | null }) {
  const E = useEngine(); const { c } = useTheme();
  const max = Math.max(1, ...r.counts), H = 52;
  return (
    <Row gap={18} align="flex-end" wrap>
      <Col gap={0} style={{ minWidth: 70 }}>
        <Text testID={`pr-${q.id}-avg`} style={{ fontSize: 32, lineHeight: 36, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"], letterSpacing: -0.5 }}>{r.avg != null ? dec(E, r.avg) : "–"}</Text>
        <Muted small>{"Ø " + E.t("um_scaleOf")}</Muted>
      </Col>
      <Col gap={4} style={{ flex: 1, minWidth: 190 }}>
        <Row gap={6} align="flex-end">
          {[1, 2, 3, 4, 5].map(v => {
            const n = r.counts[v - 1] || 0;
            return (
              <Col key={v} gap={3} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: n ? c.ink : c.faint, fontVariant: ["tabular-nums"] }}>{n}</Text>
                <View style={{ width: "72%", height: Math.max(3, Math.round(H * n / max)), borderRadius: 4, backgroundColor: mine === v ? c.accent : n === max && n > 0 ? withAlpha(c.accent, 0.55) : c.faint }} />
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.muted }}>{v}</Text>
              </Col>
            );
          })}
        </Row>
        {q.lo || q.hi ? <Row between gap={10}><Muted small>{q.lo ? "1 = " + q.lo : ""}</Muted><Muted small>{q.hi ? "5 = " + q.hi : ""}</Muted></Row> : null}
      </Col>
    </Row>
  );
}

function TextResult({ r, staff }: { r: PollQResult; staff: boolean }) {
  const E = useEngine(); const { c } = useTheme();
  if (!staff) return <Muted small>{E.t("um_textOnlyStaff")}</Muted>;
  const L = r.texts || [];
  if (!L.length) return <Muted small>{E.t("um_textsNone")}</Muted>;
  return (
    <Col gap={8}>
      {L.map((x, i) => (
        <View key={i} style={{ backgroundColor: c.sunk, borderRadius: radius.m, paddingVertical: 10, paddingHorizontal: 12, gap: 3 }}>
          <T selectable>{x.text}</T>
          {x.name ? <Muted small>{x.name}</Muted> : null}
        </View>
      ))}
    </Col>
  );
}

/** Ergebnis aller Fragen (mine: eigene Antwort zum Markieren) */
export function PollResultView({ p, r, staff, mine, testID = "poll-result" }: { p: Poll; r: PollResult | null; staff: boolean; mine?: Record<string, PollValue> | null; testID?: string }) {
  const E = useEngine(); const { t, tf } = E;
  if (!r) return <Muted small>{t("loading")}</Muted>;
  if (r.hidden) return <Banner testID={testID + "-hidden"}>{tf("um_hiddenAnon", { n: ANON_MIN })}</Banner>;
  return (
    <Col gap={20} testID={testID}>
      {p.questions.map((q, i) => {
        const x = r.questions.find(y => y.id === q.id);
        if (!x) return null;
        const my = mine?.[q.id];
        return (
          <Col key={q.id} gap={10}>
            {p.kind === "survey" ? <Col gap={2}><T v="eyebrow">{tf("um_qN", { n: i + 1 })}</T><T bold>{q.text}</T></Col> : null}
            {isChoice(q.type) ? <ChoiceResult q={q} r={x} mine={Array.isArray(my) ? my : typeof my === "number" ? [my] : []} showVoters={!p.anonymous} />
              : q.type === "scale" ? <ScaleResult q={q} r={x} mine={typeof my === "number" ? my : null} />
                : <TextResult r={x} staff={staff} />}
            <Muted small>{answersText(t, tf, x.answered)}</Muted>
          </Col>
        );
      })}
    </Col>
  );
}

// ---------- Antworten ----------
function OptionList({ q, value, onChange, testID }: { q: PollQuestion; value: PollValue | undefined; onChange: (v: PollValue | undefined) => void; testID: string }) {
  const { c } = useTheme(); const multi = q.type === "multi";
  const sel = multi ? (Array.isArray(value) ? value : []) : typeof value === "number" ? [value] : [];
  const pick = (i: number) => {
    if (!multi) { onChange(i); return; }
    const n = sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i].sort((a, b) => a - b);
    onChange(n.length ? n : undefined);
  };
  return (
    <Col gap={6} testID={testID}>
      {q.options.map((o, i) => {
        const on = sel.includes(i);
        return (
          <Pressable key={i} testID={`${testID}-${i}`} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={multi ? { checked: on } : { selected: on }} accessibilityLabel={o} onPress={() => pick(i)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 13, minHeight: 48, borderRadius: radius.m, borderWidth: 1.5,
              borderColor: on ? c.accent : c.line, backgroundColor: on ? withAlpha(c.accent, 0.08) : pressed ? c.sunk : "transparent" })}>
            <View style={{ width: 22, height: 22, borderRadius: multi ? 6 : 11, borderWidth: 2, borderColor: on ? c.accent : c.faint, backgroundColor: on ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {on ? (multi ? <Icon name="check" size={14} color={c.accentInk} strokeWidth={3} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accentInk }} />) : null}
            </View>
            <Text style={{ flex: 1, color: c.ink, fontSize: 15.5, lineHeight: 21, fontWeight: on ? "700" : "500" }}>{o}</Text>
          </Pressable>
        );
      })}
    </Col>
  );
}

/** Eingaben für alle Fragen (Auswahl, Mehrfachauswahl, Skala 1–5, Freitext) */
export function PollAnswerForm({ p, value, onChange, testID = "poll-form" }: { p: Poll; value: Record<string, PollValue>; onChange: (v: Record<string, PollValue>) => void; testID?: string }) {
  const E = useEngine(); const { t } = E;
  const set = (id: string, v: PollValue | undefined) => { const n = { ...value }; if (v === undefined) delete n[id]; else n[id] = v; onChange(n); };
  return (
    <Col gap={20} testID={testID}>
      {p.questions.map((q, i) => {
        const v = value[q.id];
        return (
          <Col key={q.id} gap={8}>
            {p.kind === "survey" ? (
              <Row gap={8} align="flex-start">
                <T bold style={{ flex: 1 }}>{`${i + 1}. ${q.text}`}</T>
                {!q.required ? <Muted small>{t("um_optional")}</Muted> : null}
              </Row>
            ) : null}
            {isChoice(q.type) ? <OptionList q={q} value={v} onChange={x => set(q.id, x)} testID={`${testID}-${q.id}`} />
              : q.type === "scale" ? (
                <Col gap={6}>
                  <NumScale testID={`${testID}-${q.id}`} min={1} max={5} value={typeof v === "number" ? v : null} onChange={n => set(q.id, n === v ? undefined : n)} labels={[q.lo, "", "", "", q.hi]} />
                  {q.lo || q.hi ? <Row between gap={10}><Muted small>{q.lo ? "1 = " + q.lo : ""}</Muted><Muted small>{q.hi ? "5 = " + q.hi : ""}</Muted></Row> : null}
                </Col>
              ) : (
                <Col gap={4}>
                  <Field testID={`${testID}-${q.id}`} label={t("um_yourAnswer")} value={typeof v === "string" ? v : ""} onChangeText={x => set(q.id, x ? x : undefined)} multiline maxLength={POLL_LIMITS.text} />
                  <Muted small>{t("um_privText")}</Muted>
                </Col>
              )}
          </Col>
        );
      })}
    </Col>
  );
}

// ---------- Spieler: Umfrage öffnen (beantworten, Ergebnis, eigene Abstimmung verwalten) ----------
export function PollSheet({ poll, onClose }: { poll: Poll | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pid = s.mePid || "";
  const p = poll ? s.myPolls.find(x => x.id === poll.id) || E.D.polls.find(x => x.id === poll.id) || null : null;
  const mine = p ? answerOf(E.D, p.id, pid) : null, open = !!p && pollOpen(p, E.TODAY);
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState<Record<string, PollValue>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => { setEdit(false); setVal(mine?.answers || {}); setErr(""); setDel(false); }, [poll?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const form = !!p && open && (edit || !mine);
  const vis = !!p && resultsVisible(p, { staff: false, pid }, !!mine, E.TODAY);
  const r = usePollResult(p, !!p && vis && !form, mine?.at || "");
  const own = !!p && !!pid && p.authorPid === pid;
  const send = async () => {
    if (!p) return;
    const a = cleanAnswers(p, val);
    if (!a) { setErr(t("um_needRequired")); return; }
    setBusy(true);
    try { await s.answerPoll(p, pid, a); setEdit(false); } finally { setBusy(false); }
  };
  const meta = p ? [pollMeta(E, p), pollAuthor(E, p, pid)].filter(Boolean).join(" · ") : "";
  return (
    <Sheet visible={!!poll} onClose={onClose} title={p?.title || poll?.title} testID="poll-sheet" closeLabel={t("close")}>
      {p ? (
        <>
          <Muted small>{meta}</Muted>
          {p.intro ? <T>{p.intro}</T> : null}
          {form || !mine ? <Banner color={p.anonymous ? c.ok : undefined} testID="poll-privacy">{privacyText(t, p)}</Banner> : null}
          {form ? (
            <>
              <PollAnswerForm p={p} value={val} onChange={v => { setVal(v); setErr(""); }} />
              {err ? <Banner color={c.crit}>{err}</Banner> : null}
              <Row gap={10} wrap>
                <Btn kind="primary" testID="poll-send" label={t(p.kind === "quick" ? "um_vote" : "um_send")} disabled={busy || !Object.keys(val).length} onPress={send} />
                {mine ? <Btn kind="ghost" testID="poll-edit-cancel" label={t("um_cancel")} onPress={() => { setEdit(false); setVal(mine.answers); setErr(""); }} /> : null}
              </Row>
            </>
          ) : (
            <>
              {mine ? <Row gap={6}><Icon name="check" size={17} color={c.ok} strokeWidth={2.6} /><T bold color={c.ok}>{t("um_youVoted")}</T></Row> : null}
              {vis ? <PollResultView p={p} r={r} staff={false} mine={mine?.answers} />
                : <Muted small>{p.results === "staff" ? t("um_resultsStaffOnly") : t("um_resultsAfter")}</Muted>}
              {open && mine ? (
                <Row gap={8} wrap>
                  <Btn small testID="poll-change" label={t("um_change")} onPress={() => { setVal(mine.answers); setEdit(true); }} />
                  <Btn small kind="ghost" testID="poll-withdraw" label={t("um_withdraw")} onPress={() => { s.withdrawPollAnswer(p, pid); }} />
                </Row>
              ) : null}
            </>
          )}
          {own ? (
            <Col gap={8} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 12 }}>
              <T v="small" bold color={c.muted}>{t("um_mine")}</T>
              <Row gap={8} wrap>
                {open ? <Btn small testID="poll-own-close" label={t("um_close")} onPress={() => s.setPollState(p, { closed: true, until: p.until }, t("um_closedT"))} />
                  : <Btn small testID="poll-own-reopen" label={t("um_reopen")} disabled={openPollsBy({ polls: s.myPolls }, pid, E.TODAY) >= PLAYER_OPEN_MAX}
                    onPress={() => { const x = reopened(p, E.TODAY); s.setPollState(p, { closed: x.closed, until: x.until }, t("um_reopenedT")); }} />}
                {!del ? <Btn small kind="ghost" testID="poll-own-delete" label={t("um_delete")} onPress={() => setDel(true)} />
                  : <Btn small kind="danger" testID="poll-own-delete-yes" label={t("um_deleteYes")} onPress={() => { s.deletePoll(p.id); onClose(); }} />}
              </Row>
            </Col>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

/** Abstimmung direkt auf der Startseite (Fragebögen öffnen das Blatt) */
function QuickVote({ p, onVoted, onOpen }: { p: Poll; onVoted: () => void; onOpen: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const pid = s.mePid || "", mine = answerOf(E.D, p.id, pid);
  const [val, setVal] = useState<PollValue | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const vis = resultsVisible(p, { staff: false, pid }, !!mine, E.TODAY);
  const r = usePollResult(p, !!mine && vis, mine?.at || "");
  const vote = async () => {
    if (val === undefined) return;
    setBusy(true);
    try { await s.answerPoll(p, pid, { q1: val }); onVoted(); } finally { setBusy(false); }
  };
  return (
    <Col gap={10} testID={"pq-" + p.id}>
      <Col gap={2}>
        <T bold style={{ fontSize: 16.5 }}>{p.title}</T>
        <Muted small>{[pollAuthor(E, p, pid), pollState(E, p)].filter(Boolean).join(" · ")}</Muted>
      </Col>
      {mine ? (
        <>
          <Row gap={6}><Icon name="check" size={16} color={c.ok} strokeWidth={2.6} /><T v="small" bold color={c.ok}>{t("um_youVoted")}</T></Row>
          {vis ? <PollResultView p={p} r={r} staff={false} mine={mine.answers} testID={"pq-res-" + p.id} /> : <Muted small>{t("um_resultsStaffOnly")}</Muted>}
          <Btn small kind="ghost" testID={"pq-change-" + p.id} label={t("um_change")} onPress={onOpen} style={{ alignSelf: "flex-start" }} />
        </>
      ) : (
        <>
          <OptionList q={p.questions[0]} value={val} onChange={setVal} testID={"pq-opt-" + p.id} />
          <Row between gap={10} wrap>
            <Muted small style={{ flex: 1, minWidth: 160 }}>{privacyText(t, p)}</Muted>
            <Btn kind="primary" small testID={"pq-vote-" + p.id} label={t("um_vote")} disabled={busy || val === undefined} onPress={vote} />
          </Row>
        </>
      )}
    </Col>
  );
}

/** Startseite des Spielers: offene Umfragen (Abstimmungen gleich hier, Fragebögen als Zeile) – leer = keine Karte */
export function PlayerPollsCard({ onAll }: { onAll: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const pid = s.mePid || "";
  const [done, setDone] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Poll | null>(null);
  const L = s.myPolls.filter(p => pollOpen(p, E.TODAY) && (!answerOf(E.D, p.id, pid) || done.includes(p.id))).slice(0, 3);
  if (!L.length) return <PollSheet poll={sheet} onClose={() => setSheet(null)} />;
  return (
    <Card testID="player-polls">
      <CardTitle title={t("dp_polls")} right={<Icon name="poll" size={20} color={c.accentTx} strokeWidth={2} />} />
      {L.map((p, i) => (
        <View key={p.id} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 14 } : undefined}>
          {p.kind === "quick" ? <QuickVote p={p} onVoted={() => setDone(d => [...d, p.id])} onOpen={() => setSheet(p)} /> : (
            <Pressable testID={"ps-" + p.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={() => setSheet(p)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name="eintragen" size={19} color={c.accentTx} strokeWidth={2} /></View>
              <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
                <T bold numberOfLines={2}>{p.title}</T>
                <Muted small>{[t("um_kind_survey"), questionsText(tf, p.questions.length), tf("um_minutes", { n: Math.max(1, Math.round(p.questions.length / 2)) }), low(t(p.anonymous ? "um_anon" : "um_named"))].join(" · ")}</Muted>
              </Col>
              {answerOf(E.D, p.id, pid) ? <Icon name="check" size={18} color={c.ok} strokeWidth={2.6} /> : <Text style={{ color: c.accentTx, fontWeight: "700", fontSize: 14 }}>{t("um_open")}</Text>}
            </Pressable>
          )}
        </View>
      ))}
      <Btn small kind="ghost" testID="player-polls-all" label={t("um_cardMore")} onPress={onAll} style={{ alignSelf: "flex-start" }} />
      <PollSheet poll={sheet} onClose={() => setSheet(null)} />
    </Card>
  );
}

// ---------- Trainerteam ----------
/** Zeile einer Umfrage (Trainerteam): Titel, Art und Status, Beteiligung */
export function PollRow({ p, onPress }: { p: Poll; onPress: () => void }) {
  const E = useEngine(); const { c } = useTheme();
  const open = pollOpen(p, E.TODAY), n = pollTargets(E.D, p).length;
  return (
    <NavRow testID={"poll-" + p.id} icon="poll" iconColor={open ? c.accentTx : c.muted} title={p.title} sub={pollMeta(E, p) + (p.byPlayer ? " · " + pollAuthor(E, p, null) : "")} subLines={2}
      value={`${p.answers}/${n}`} valueColor={open && n > 0 && p.answers >= n ? c.ok : undefined} onPress={onPress} />
  );
}

/** Startseite des Trainerteams: laufende Umfragen (nur mit Recht „Nachrichten“; leer = keine Karte) */
export function CoachPollsCard() {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  if (!s.can("messages")) return null;
  const L = sortPolls(E.D.polls, E.TODAY).filter(p => pollOpen(p, E.TODAY)).slice(0, 4);
  if (!L.length) return null;
  return (
    <Section testID="coach-polls-card" title={t("db_polls")} action={{ label: t("um_seeAll"), onPress: () => router.push("/coach/umfragen"), testID: "coach-polls-all" }}>
      {L.map(p => <PollRow key={p.id} p={p} onPress={() => router.push(`/coach/umfrage/${p.id}`)} />)}
    </Section>
  );
}

/** Vorlagen für häufige Fragen */
export function PollTemplatesSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (x: PollTemplate) => void }) {
  const E = useEngine(); const { t, tf } = E;
  const L = pollTemplates(E.tr.lang);
  return (
    <Sheet visible={visible} onClose={onClose} title={t("um_tplPick")} testID="poll-tpl" closeLabel={t("close")}>
      <Muted small>{t("um_templatesD")}</Muted>
      <Group>
        {L.map(x => (
          <NavRow key={x.key} testID={"poll-tpl-" + x.key} icon={x.kind === "quick" ? "poll" : "eintragen"} title={x.title} subLines={2}
            sub={[t("um_kind_" + x.kind), low(t(x.anonymous ? "um_anon" : "um_named")), x.kind === "survey" ? questionsText(tf, x.questions.length) : x.questions[0].options.join(" / ")].join(" · ")}
            onPress={() => onPick(x)} />
        ))}
      </Group>
    </Sheet>
  );
}

// ---------- Bearbeiten ----------
function OptionsEditor({ q, onChange, testID }: { q: PollQuestion; onChange: (q: PollQuestion) => void; testID: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const set = (i: number, v: string) => onChange({ ...q, options: q.options.map((o, j) => j === i ? v : o) });
  return (
    <Col gap={8}>
      <T v="small" bold color={c.muted}>{t("um_options")}</T>
      {q.options.map((o, i) => (
        <Row key={i} gap={8} align="flex-end">
          <Field testID={`${testID}-o${i}`} label={tf("um_option", { n: i + 1 })} value={o} onChangeText={v => set(i, v)} maxLength={POLL_LIMITS.option} style={{ flex: 1 }} />
          {q.options.length > 2 ? <View style={{ paddingBottom: 5 }}><IconBtn testID={`${testID}-del${i}`} icon="close" label={tf("um_optionDel", { n: i + 1 })} onPress={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })} /></View> : null}
        </Row>
      ))}
      {q.options.length < POLL_LIMITS.options ? <Btn small kind="ghost" icon="plus" testID={`${testID}-add`} label={t("um_optionAdd")} onPress={() => onChange({ ...q, options: [...q.options, ""] })} style={{ alignSelf: "flex-start" }} /> : null}
    </Col>
  );
}

function QuestionEditor({ q, i, n, onChange, onMove, onDelete }: { q: PollQuestion; i: number; n: number; onChange: (q: PollQuestion) => void; onMove: (d: number) => void; onDelete: () => void }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const setType = (ty: PollQType) => onChange({ ...q, type: ty, options: isChoice(ty) ? (q.options.length >= 2 ? q.options : ["", ""]) : [], lo: ty === "scale" ? q.lo : "", hi: ty === "scale" ? q.hi : "" });
  return (
    <View testID={`pe-q-${i}`} style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.m, padding: 12, gap: 10 }}>
      <Row between gap={8}>
        <T v="eyebrow">{tf("um_qN", { n: i + 1 })}</T>
        <Row gap={6}>
          <IconBtn testID={`pe-q-${i}-up`} icon="up" label={tf("um_qUp", { n: i + 1 })} disabled={i === 0} onPress={() => onMove(-1)} />
          <IconBtn testID={`pe-q-${i}-down`} icon="down" label={tf("um_qDown", { n: i + 1 })} disabled={i === n - 1} onPress={() => onMove(1)} />
          <IconBtn testID={`pe-q-${i}-del`} icon="trash" label={tf("um_qDel", { n: i + 1 })} disabled={n === 1} onPress={onDelete} />
        </Row>
      </Row>
      <Seg testID={`pe-q-${i}-type`} wrap value={q.type} onChange={setType} options={POLL_QTYPES.map(k => ({ key: k, label: t("um_qtype_" + k) }))} />
      <Field testID={`pe-q-${i}-text`} label={t("um_question")} value={q.text} onChangeText={v => onChange({ ...q, text: v })} maxLength={POLL_LIMITS.qtext} />
      {isChoice(q.type) ? <OptionsEditor q={q} onChange={onChange} testID={`pe-q-${i}`} /> : null}
      {q.type === "scale" ? (
        <Row wrap gap={8}>
          <Field testID={`pe-q-${i}-lo`} label={t("um_lo")} placeholder={t("um_loPh")} value={q.lo} onChangeText={v => onChange({ ...q, lo: v })} maxLength={POLL_LIMITS.label} style={{ flex: 1, minWidth: 140 }} />
          <Field testID={`pe-q-${i}-hi`} label={t("um_hi")} placeholder={t("um_hiPh")} value={q.hi} onChangeText={v => onChange({ ...q, hi: v })} maxLength={POLL_LIMITS.label} style={{ flex: 1, minWidth: 140 }} />
        </Row>
      ) : null}
      <Check testID={`pe-q-${i}-req`} label={t("um_required")} value={q.required} onChange={v => onChange({ ...q, required: v })} />
    </View>
  );
}

/**
 * Umfrage anlegen oder bearbeiten. Sobald jemand geantwortet hat, nur noch das Ende (Fragen und Einstellungen bleiben
 * fest). asPlayer: eigene Abstimmung eines Spielers (immer mit Namen, ganzes Team, Ergebnisse für alle).
 */
export function PollEditor({ initial, onClose, asPlayer }: { initial: Poll | null; onClose: () => void; asPlayer?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [d, setD] = useState<Poll | null>(null);
  const [err, setErr] = useState("");
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setD(initial ? { ...initial, questions: initial.questions.map(q => ({ ...q, options: [...q.options] })) } : null);
    setErr(""); setAnnounce(true); setBusy(false);
  }, [initial]);
  const up = (f: (x: Poll) => Poll) => { setD(x => x ? f(x) : x); setErr(""); };
  const isNew = !!d && d.id.startsWith("tmp-");
  const locked = !!d && !isNew && !pollEditable(d);
  const chat = d && isNew && !asPlayer ? announceChat(s.chats, d) : null;
  const group = d?.groupId ? E.D.groups.find(g => g.id === d.groupId) : null;
  const endKey = !d?.until ? "none" : d.until === addDays(E.TODAY, 2) ? "2" : d.until === addDays(E.TODAY, 7) ? "7" : null;
  const setQ = (i: number, q: PollQuestion) => up(x => ({ ...x, questions: x.questions.map((y, j) => j === i ? q : y) }));
  const move = (i: number, dir: number) => up(x => { const L = [...x.questions], j = i + dir; if (j < 0 || j >= L.length) return x; [L[i], L[j]] = [L[j], L[i]]; return { ...x, questions: L }; });

  const check = (x: Poll): string | null => {
    if (!x.title.trim()) return t(x.kind === "quick" ? "um_errTitle" : "um_errTitleS");
    if (x.kind === "quick") { if (!cleanQuestion({ ...x.questions[0], text: x.title }, 0)) return t("um_errOptions"); }
    else {
      if (!x.questions.length) return t("um_errNoQ");
      for (let i = 0; i < x.questions.length; i++) if (!cleanQuestion(x.questions[i], i)) return tf("um_errQ", { n: i + 1 });
    }
    if (isNew && x.until && x.until < E.TODAY) return t("um_errPast");
    return null;
  };
  const save = async () => {
    if (!d) return;
    if (locked) {
      if (d.until && d.until < E.TODAY && !d.closed) { setErr(t("um_errPast")); return; }
      setBusy(true);
      try { await s.setPollState(d, { closed: d.closed, until: d.until }, t("um_endSaved")); onClose(); } finally { setBusy(false); }
      return;
    }
    const e = check(d); if (e) { setErr(e); return; }
    let x = cleanPoll(d);
    if (asPlayer) {
      const pid = s.mePid; if (!pid) return;
      if (isNew && openPollsBy({ polls: s.myPolls }, pid, E.TODAY) >= PLAYER_OPEN_MAX) { setErr(tf("um_ownMax", { n: PLAYER_OPEN_MAX })); return; }
      x = asPlayerPoll(x, pid);
      if (isNew) { const me = E.P(pid); x = { ...x, author: me ? `${me.vn} ${me.nn.slice(0, 1)}.` : "" }; }
    } else if (isNew) x = { ...x, author: s.myStaff?.name || s.user?.displayName || "", createdBy: s.user?.id || null };
    setBusy(true);
    try { await s.savePoll(x, isNew && announce && chat ? chat.id : null); onClose(); } finally { setBusy(false); }
  };
  const title = !d ? "" : locked ? t("um_changeEnd") : !isNew ? t("um_editT") : asPlayer ? t("um_startOwn") : t(d.kind === "quick" ? "um_newQuick" : "um_newSurvey");
  return (
    <Sheet visible={!!initial} onClose={onClose} title={title} testID="poll-editor" closeLabel={t("um_cancel")}>
      {d ? (
        <>
          {locked ? <Banner>{t("um_locked")}</Banner> : null}
          {!locked && d.kind === "quick" ? (
            <>
              <Field testID="pe-title" label={t("um_question")} placeholder={t("um_questionPh")} value={d.title} onChangeText={v => up(x => ({ ...x, title: v }))} maxLength={POLL_LIMITS.title} />
              <OptionsEditor q={d.questions[0] || blankQuestion("q1")} onChange={q => up(x => ({ ...x, questions: [q] }))} testID="pe-q1" />
              <Check testID="pe-multi" label={t("um_multi")} value={d.questions[0]?.type === "multi"}
                onChange={v => up(x => ({ ...x, questions: [{ ...(x.questions[0] || blankQuestion("q1")), type: v ? "multi" : "single" }] }))} />
            </>
          ) : null}
          {!locked && d.kind === "survey" ? (
            <>
              <Field testID="pe-title" label={t("um_titleF")} placeholder={t("um_titlePh")} value={d.title} onChangeText={v => up(x => ({ ...x, title: v }))} maxLength={POLL_LIMITS.title} />
              <Field testID="pe-intro" label={t("um_intro")} placeholder={t("um_introPh")} value={d.intro} onChangeText={v => up(x => ({ ...x, intro: v }))} multiline maxLength={POLL_LIMITS.intro} />
              {d.questions.map((q, i) => (
                <QuestionEditor key={q.id} q={q} i={i} n={d.questions.length} onChange={x => setQ(i, x)} onMove={dir => move(i, dir)}
                  onDelete={() => up(x => ({ ...x, questions: x.questions.filter((_, j) => j !== i) }))} />
              ))}
              {d.questions.length < POLL_LIMITS.questions
                ? <Btn small icon="plus" testID="pe-qadd" label={t("um_qAdd")} onPress={() => up(x => ({ ...x, questions: [...x.questions, blankQuestion(nextQuestionId(x.questions), "single")] }))} style={{ alignSelf: "flex-start" }} />
                : null}
            </>
          ) : null}
          {!locked && !asPlayer ? (
            <>
              <Col gap={6}>
                <T v="small" bold color={c.muted}>{t("um_who")}</T>
                <ChoiceChips testID="pe-who" value={d.groupId || "team"} onChange={k => up(x => ({ ...x, groupId: k === "team" ? null : k }))}
                  options={[{ key: "team", label: t("um_toTeam") }, ...E.D.groups.map(g => ({ key: g.id, label: g.name }))]} />
                {group && !group.vis ? <Muted small>{t("um_groupHidden")}</Muted> : null}
              </Col>
              <Col gap={6}>
                <T v="small" bold color={c.muted}>{t("um_mode")}</T>
                <Seg testID="pe-mode" value={d.anonymous ? "anon" : "named"} onChange={k => up(x => ({ ...x, anonymous: k === "anon" }))}
                  options={[{ key: "named", label: t("um_named") }, { key: "anon", label: t("um_anon") }]} />
                <Muted small>{d.anonymous ? t("um_modeAnon") : t(d.results === "all" ? "um_modeNamedAll" : "um_modeNamedStaff")}</Muted>
              </Col>
              <Col gap={6}>
                <T v="small" bold color={c.muted}>{t("um_resWho")}</T>
                <Seg testID="pe-res" value={d.results} onChange={k => up(x => ({ ...x, results: k }))}
                  options={[{ key: "all", label: t("um_resAllOpt") }, { key: "staff", label: t("um_resStaffOpt") }]} />
                <Muted small>{t(d.results === "all" ? "um_resAllD" : "um_resStaffD")}</Muted>
              </Col>
            </>
          ) : null}
          <Col gap={6}>
            <T v="small" bold color={c.muted}>{t("um_end")}</T>
            <ChoiceChips testID="pe-end" value={endKey} onChange={k => up(x => ({ ...x, until: k === "none" ? null : addDays(E.TODAY, Number(k)) }))}
              options={[{ key: "none", label: t("um_noEnd") }, { key: "2", label: t("um_end2") }, { key: "7", label: t("um_end7") }]} />
            <DateField testID="pe-until" label={t("um_lastDay")} value={d.until} onChange={v => up(x => ({ ...x, until: v }))} lang={E.tr.lang} />
            <Muted small>{t("um_endD")}</Muted>
          </Col>
          {asPlayer && !locked ? <Banner>{t("um_ownInfo")}</Banner> : null}
          {chat ? <Col gap={4}><Check testID="pe-share" label={t("um_share")} value={announce} onChange={setAnnounce} /><Muted small>{t("um_shareD")}</Muted></Col> : null}
          {err ? <Banner color={c.crit} testID="pe-err">{err}</Banner> : null}
          <Row gap={10} wrap>
            <Btn kind="primary" testID="pe-save" label={isNew ? t("um_start") : t("save")} disabled={busy} onPress={save} />
            <Btn kind="ghost" testID="pe-cancel" label={t("um_cancel")} onPress={onClose} />
          </Row>
        </>
      ) : null}
    </Sheet>
  );
}

/** Kurzer Hinweis, an wen die Umfrage geht und wer sie gestartet hat (Detailseite) */
export function PollFacts({ p, staff }: { p: Poll; staff: boolean }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const items: { icon: IconName; label: string }[] = [
    { icon: p.anonymous ? "eye" : "people", label: cap(t(p.anonymous ? "um_anon" : "um_named")) },
    { icon: "chart", label: t(p.results === "all" ? "um_resAll" : "um_resStaff") },
    { icon: "kader", label: pollTarget(E, p, staff) },
    { icon: "clock", label: cap(pollState(E, p)) },
  ];
  const by = pollAuthor(E, p, staff ? null : s.mePid);
  if (by) items.push({ icon: "person", label: cap(by) });
  return (
    <Row wrap gap={8} testID="poll-facts">
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.sunk, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 }}>
          <Icon name={x.icon} size={14} color={c.muted} strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.ink }}>{x.label}</Text>
        </View>
      ))}
    </Row>
  );
}
