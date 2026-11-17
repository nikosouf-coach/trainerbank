// Kader-Nominierung – Oberfläche: Karte fürs Trainerteam (Stand des Kaders, zur Nominierung), Karte für Spieler auf
// „Heute“ (Nominierung, Treffpunkt, Kader, Zu-/Absage) und das Blatt „Antwort eintragen“ fürs Trainerteam. Die Seite
// zum Nominieren liegt unter app/coach/nominierung/[id].tsx. Regeln: core/nomination.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { answersAllowed, nomsOf, squadCounts } from "../core/nomination";
import type { Match, NomAnswer, Nomination } from "../core/types";
import type { MySquad } from "../core/nomination";
import { useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Btn, Card, ChoiceChips, Chip, Col, Field, Muted, Row, Sheet, T } from "./kit";
import { useNextMatch } from "./matchday";
import { radius, useTheme, withAlpha } from "./theme";

type E_ = ReturnType<typeof useEngine>;
/** „Sa. 07.11. · 15:00 · Heim“ */
export const matchLine = (E: E_, m: Match): string => [`${E.wt(m.date)} ${E.de(m.date)}`, m.zeit, m.heim ? E.t("home") : E.t("away")].filter(Boolean).join(" · ");

/** Farbe und Text der Antwort */
export function answerStyle(E: E_, c: ReturnType<typeof useTheme>["c"], n: Pick<Nomination, "answer">): { color: string; label: string } {
  return n.answer === "yes" ? { color: c.ok, label: E.t("nm_status_yes") } : n.answer === "no" ? { color: c.crit, label: E.t("nm_status_no") } : { color: c.muted, label: E.t("nm_status_open") };
}

/**
 * Trainerteam: Stand des Kaders eines Spiels (keiner, Entwurf, veröffentlicht mit Zu-/Absagen) und Weg zur Nominierung.
 * compact: nur eine Zeile (Tagesansicht).
 */
export function CoachSquadCard({ match, compact }: { match: Match; compact?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const sq = E.D.squads[match.id], noms = nomsOf(E.D, match.id), k = squadCounts(noms);
  const open = () => router.push("/coach/nominierung/" + match.id);
  if (!sq && (!s.can("plan") || match.result || match.date < E.TODAY)) return null;
  const answers = sq?.published && (E.team.settings.playerAbs ?? true);
  const status = !sq ? t("nm_none") : !sq.published ? t("nm_draft") : answers ? tf("nm_answerLine", { y: k.yes, n: k.no, o: k.open }) : tf("nm_countLine", { s: k.squad, b: k.standby });
  const col = !sq ? c.accentTx : !sq.published ? c.warn : k.no ? c.warn : k.open ? c.accentTx : c.ok;
  if (compact) {
    return (
      <Pressable testID="nm-card" accessibilityRole="button" accessibilityLabel={`${t("nm_title")}: ${status}`} onPress={open}>
        <Row gap={6} wrap>
          <Icon name="kader" size={18} color={c.ink} /><T bold>{t("nm_title")}</T>
          <Chip testID="nm-card-status" label={sq ? (sq.published ? (answers ? `${k.yes}/${noms.length}` : String(noms.length)) : t("nm_draftShort")) : t("nm_nominate")} color={col} />
        </Row>
      </Pressable>
    );
  }
  return (
    <Card testID="nm-card" tone={col}>
      <Row gap={8} wrap>
        <Icon name="kader" size={18} color={c.ink} /><T bold>{t("nm_card")}</T>
      </Row>
      {sq ? <Muted small>{tf("nm_countLine", { s: k.squad, b: k.standby })}</Muted> : null}
      <Text testID="nm-card-status" style={{ fontSize: 14, fontWeight: "700", color: col }}>{status}</Text>
      <Btn small kind="primary" testID="nm-card-open" label={sq ? t("nm_open") : t("nm_nominate")} onPress={open} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}

/** Startseite Trainerteam: Kader fürs nächste Spiel (in den nächsten 7 Tagen, ohne Ergebnis) */
export function NextSquadCard() {
  const m = useNextMatch();
  return m ? <CoachSquadCard match={m} /> : null;
}

/** Blatt: Antwort für einen Spieler eintragen (Trainerteam) */
export function AnswerSheet({ matchId, pid, onClose }: { matchId: string; pid: string | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const n = pid ? E.D.noms.find(x => x.matchId === matchId && x.pid === pid) || null : null, p = pid ? E.P(pid) : null;
  return (
    <Sheet visible={!!pid && !!n} onClose={onClose} title={p ? `${t("nm_setAnswer")} · ${E.name(p)}` : t("nm_setAnswer")} testID="nm-ans-sheet" closeLabel={t("um_cancel")}>
      {pid && n ? <AnswerForm key={pid} n={n} onDone={onClose} save={(a, r) => s.setNomAnswer(matchId, pid, a, r)} staff /> : null}
    </Sheet>
  );
}

function AnswerForm({ n, onDone, save, staff }: { n: Nomination; onDone: () => void; save: (a: NomAnswer | null, reason: string) => Promise<boolean | unknown>; staff?: boolean }) {
  const E = useEngine(); const { t } = E;
  const [a, setA] = useState<"yes" | "no" | "open">(n.answer || "open");
  const [reason, setReason] = useState(n.reason);
  const [busy, setBusy] = useState(false);
  return (
    <Col gap={12}>
      {staff ? <Muted small>{t("nm_setAnswerD")}</Muted> : null}
      <ChoiceChips testID="nm-ans" value={a} onChange={setA} options={[{ key: "yes", label: t("nm_status_yes") }, { key: "no", label: t("nm_status_no") }, { key: "open", label: t("nm_status_open") }]} />
      {a === "no" ? <Field testID="nm-ans-reason" label={t("nm_reason")} placeholder={t("nm_reasonPh")} value={reason} onChangeText={setReason} maxLength={200} /> : null}
      <Row gap={10} wrap>
        <Btn kind="primary" testID="nm-ans-save" label={t("save")} disabled={busy} onPress={async () => {
          setBusy(true); try { if ((await save(a === "open" ? null : a, a === "no" ? reason : "")) !== false) onDone(); } finally { setBusy(false); }
        }} />
        <Btn kind="ghost" label={t("um_cancel")} onPress={onDone} />
      </Row>
    </Col>
  );
}

/** Spieler – „Heute“: kommende Nominierungen mit Treffpunkt, Kader und Zu-/Absage (wenn erlaubt) */
export function PlayerSquadCard() {
  const s = useStore();
  if (!s.mySquads.length) return null;
  return <Col gap={12} testID="player-squads">{s.mySquads.map(x => <OneSquad key={x.m.id} x={x} />)}</Col>;
}

function OneSquad({ x }: { x: MySquad }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const { m, sq, nom, mates } = x;
  const allowed = answersAllowed(E.team, m, new Date());
  const [mode, setMode] = useState<"view" | "no">("view");
  const [reason, setReason] = useState(nom.reason);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(!nom.answer);
  const answer = async (a: NomAnswer, r = "") => {
    setBusy(true);
    try { if ((await s.answerNomination(m.id, a, r)) !== false) { setMode("view"); setEdit(false); } } finally { setBusy(false); }
  };
  const tone = nom.answer === "yes" ? c.ok : nom.answer === "no" ? c.crit : c.accent;
  const main = mates.filter(y => !y.standby), sb = mates.filter(y => y.standby);
  const meet = [sq.meetTime ? tf("nm_clock", { t: sq.meetTime }) : "", sq.meetPlace].filter(Boolean).join(" · ");
  return (
    <Card testID={"psq-" + m.id} style={{ borderWidth: 1.5, borderColor: withAlpha(tone, 0.55) }}>
      <Row gap={12} align="flex-start">
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(tone, 0.14), alignItems: "center", justifyContent: "center" }}>
          <Icon name={nom.answer === "yes" ? "check" : "ball"} size={20} color={tone} strokeWidth={2.2} />
        </View>
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <T v="eyebrow">{t(nom.standby ? "nm_youStandby" : "nm_youIn")}</T>
          <T v="h3" numberOfLines={2}>{`${t("vs")} ${m.gegner}`}</T>
          <Muted small>{matchLine(E, m)}</Muted>
        </Col>
      </Row>
      {meet ? (
        <Row gap={8}>
          <Icon name="clock" size={16} color={c.muted} />
          <Text style={{ flex: 1, fontSize: 14, color: c.ink }}><Text style={{ fontWeight: "700" }}>{t("nm_meet")}: </Text>{meet}</Text>
        </Row>
      ) : null}
      {sq.note ? <Muted small>{sq.note}</Muted> : null}
      {main.length ? (
        <Col gap={2} testID={"psq-list-" + m.id}>
          <T v="small" bold>{tf("nm_squadList", { n: main.length })}</T>
          <Muted small>{main.map(y => (y.nr != null ? `#${y.nr} ` : "") + y.name).join(", ")}</Muted>
          {sb.length ? <Muted small>{`${t("nm_standby")}: ${sb.map(y => y.name).join(", ")}`}</Muted> : null}
        </Col>
      ) : null}
      {nom.answer && !edit ? (
        <Row gap={10} wrap align="center">
          <View testID={"psq-answer-" + m.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: withAlpha(tone, 0.12), borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
            <Icon name={nom.answer === "yes" ? "check" : "close"} size={15} color={tone} strokeWidth={2.6} />
            <Text style={{ fontWeight: "700", fontSize: 14, color: tone }}>{t(nom.answer === "yes" ? "nm_youYes" : "nm_youNo")}</Text>
          </View>
          {allowed ? <Btn small kind="ghost" testID={"psq-change-" + m.id} label={t("nm_change")} onPress={() => setEdit(true)} /> : null}
        </Row>
      ) : null}
      {nom.answer === "no" && nom.reason && !edit ? <Muted small>{nom.reason}</Muted> : null}
      {allowed && edit ? (mode === "no" ? (
        <Col gap={8}>
          <Field testID={"psq-reason-" + m.id} label={t("nm_reason")} placeholder={t("nm_reasonPh")} value={reason} onChangeText={setReason} maxLength={200} />
          <Muted small>{t("nm_reasonHint")}</Muted>
          <Row gap={10} wrap>
            <Btn kind="danger" testID={"psq-no-send-" + m.id} label={t("nm_confirmNo")} disabled={busy} onPress={() => answer("no", reason)} />
            <Btn kind="ghost" label={t("um_cancel")} onPress={() => setMode("view")} />
          </Row>
        </Col>
      ) : (
        <Row gap={10} wrap>
          <Btn kind="primary" icon="check" testID={"psq-yes-" + m.id} label={t("nm_yes")} disabled={busy} onPress={() => answer("yes")} />
          <Btn kind="ghost" icon="close" testID={"psq-no-" + m.id} label={t("nm_no")} disabled={busy} onPress={() => setMode("no")} />
          {nom.answer ? <Btn kind="ghost" label={t("um_cancel")} onPress={() => setEdit(false)} /> : null}
        </Row>
      )) : null}
      {!allowed && !nom.answer ? <Banner>{(E.team.settings.playerAbs ?? true) ? t("nm_past") : t("nm_tellCoach")}</Banner> : null}
    </Card>
  );
}
