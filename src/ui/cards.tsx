// Karten & Sperren – Oberfläche: Seite fürs Trainerteam (gesperrte Spieler mit nächstem betroffenen Spiel, Urteil
// eintragen, aufheben, Gelb-Warnung, Karten der Saison, erledigte Sperren, Regeln), Blätter (Sperre, Karte eintragen,
// Regeln), Kartensymbol und Kurztext einer Sperre für Nominierung und Spieltag-Check. Regeln: core/cards.
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  activeSuspensions, cardRules, cardTally, cardsOf, cleanCardRules, defaultCardRules, derivedSuspensions, isDefaultRules, pastSuspensions,
  yellowWarnings, type SuspState,
} from "../core/cards";
import { classDef, classLabel } from "../core/classes";
import { absentOn } from "../core/nomination";
import type { CardKind, CardRules, Suspension } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Col, DateField, Field, Fold, Header, Info, Muted, NumField, Picker, Row, Screen, Sheet, T } from "./kit";
import { useNavBack } from "./nav";
import { PlayerAvatar } from "./playerAvatar";
import { useTheme } from "./theme";

type E_ = ReturnType<typeof useEngine>;
const YELLOW = "#F2C230", RED = "#D7263D";

/** Kartensymbol (Gelb, Gelb-Rot als zwei Karten, Rot) */
export function CardIcon({ kind, size = 14, testID }: { kind: CardKind; size?: number; testID?: string }) {
  const E = useEngine();
  const w = Math.round(size * 0.72), box = (bg: string, extra: object = {}) => <View style={{ width: w, height: size, borderRadius: 2, backgroundColor: bg, ...extra }} />;
  const label = E.t(kind === "y" ? "kr_y" : kind === "yr" ? "kr_yr" : "kr_r");
  if (kind === "yr") {
    return (
      <View testID={testID} accessibilityLabel={label} style={{ width: w + 4, height: size + 2 }}>
        {box(YELLOW, { position: "absolute", left: 0, top: 0 })}{box(RED, { position: "absolute", left: 4, top: 2 })}
      </View>
    );
  }
  return <View testID={testID} accessibilityLabel={label}>{box(kind === "y" ? YELLOW : RED)}</View>;
}

/** „Rot gegen TuS Essen (08.11.)“ bzw. „Sonstige Sperre seit 12.11.“ */
export function suspReason(E: E_, s: Suspension): string {
  const k = E.t("kr_kind_" + s.kind), m = s.matchId ? E.D.matches.find(x => x.id === s.matchId) : undefined;
  return m ? E.tf("kr_from", { k, g: m.gegner, d: E.de(m.date) }) : E.tf("kr_since", { k, d: E.de(s.start) });
}
/** Stand: „bis zum Urteil“, „bis 30.11.“, „noch 1 Spiel“, „verbüßt“, „aufgehoben“ */
export function suspStateText(E: E_, x: SuspState): string {
  if (x.s.games === 0) return E.t("kr_lifted");
  if (x.pending) return E.t("kr_pending");
  if (x.s.until) return x.active ? E.tf("kr_until", { d: E.de(x.s.until) }) : E.t("kr_ended");
  if (!x.left) return E.t("kr_served");
  return x.left === 1 ? E.t("kr_left1") : E.tf("kr_leftN", { n: x.left });
}
/** Kurztext für Nominierung und Spieltag-Check: „Rot – bis zum Urteil“ */
export const suspShort = (E: E_, x: SuspState): string => `${E.t("kr_kind_" + x.s.kind)} – ${suspStateText(E, x)}`;
const gamesText = (E: E_, n: number): string => n === 1 ? E.t("kr_games1") : E.tf("kr_gamesN", { n });

// =====================================================================
// Seite: Karten & Sperren (Trainerteam)
// =====================================================================
export function CardsPage() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [draft, setDraft] = useState<{ s: Suspension; fromAuto: boolean } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const nb = useNavBack("karten");
  if (E.mods.karten === false) return <Screen testID="coach-karten"><Header title={t("kr_title")} onBack={nb.onBack} backLabel={nb.backLabel} /><Muted>{t("kr_modOff")}</Muted></Screen>;
  const rules = cardRules(E.team), canEdit = s.can("perf");
  const active = activeSuspensions(E.D, rules, E.TODAY), past = pastSuspensions(E.D, rules, E.TODAY), warn = yellowWarnings(E.D, rules, E.TODAY);
  const name = (pid: string) => { const p = E.P(pid); return p ? E.name(p) : "–"; };
  const season = E.D.players.map(p => ({ p, x: cardTally(E.D, p.id, E.TODAY) })).filter(z => z.x.y + z.x.yr + z.x.r > 0)
    .sort((a, b) => b.x.r - a.x.r || b.x.yr - a.x.yr || b.x.y - a.x.y || E.name(a.p).localeCompare(E.name(b.p), "de"));
  const open = (x: Suspension) => setDraft(x.auto ? { s: { ...x, id: tmpId(), auto: undefined }, fromAuto: true } : { s: { ...x }, fromAuto: false });
  const fresh = (): Suspension => ({ id: tmpId(), pid: "", kind: "other", matchId: null, start: E.TODAY, games: 1, until: null, scope: "all", note: "" });

  const row = (x: SuspState, i: number) => {
    const p = E.P(x.s.pid);
    return (
      <View key={x.s.id} testID={"kr-s-" + x.s.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
        {p ? <PlayerAvatar p={p} size={34} /> : null}
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{name(x.s.pid)}</Text>
          <Text style={{ fontSize: 13, color: c.ink }}>{suspReason(E, x.s)}</Text>
          <Text testID={"kr-state-" + x.s.id} style={{ fontSize: 13, fontWeight: "700", color: x.active ? c.crit : c.muted }}>
            {suspStateText(E, x) + (x.active && x.s.scope === "league" ? ` · ${t("kr_scopeLeague")}` : "")}
          </Text>
          {x.active ? <Muted small>{x.next ? tf("kr_next", { w: `${E.wt(x.next.date)} ${E.de(x.next.date)}`, g: `${t("vs")} ${x.next.gegner}` }) : t("kr_noNext")}</Muted> : null}
          {x.s.note ? <Muted small>{x.s.note}</Muted> : x.s.auto && x.active ? <Muted small>{t("kr_auto")}</Muted> : null}
        </Col>
        {canEdit ? <Btn small kind={x.pending ? "primary" : "ghost"} testID={"kr-edit-" + x.s.id} label={x.pending ? t("kr_verdict") : t("kr_edit")} onPress={() => open(x.s)} /> : null}
      </View>
    );
  };

  return (
    <Screen testID="coach-karten">
      <Header title={t("kr_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("kr_title")} text={t("kr_info")} />}
        right={canEdit ? <Btn small icon="plus" testID="kr-add-card" label={t("kr_addCard")} onPress={() => setCardOpen(true)} /> : undefined} />

      <Card testID="kr-active">
        <CardTitle title={tf("kr_active", { n: active.length })} right={canEdit ? <Btn small testID="kr-add" label={t("kr_add")} onPress={() => setDraft({ s: fresh(), fromAuto: false })} /> : undefined} />
        {active.length ? active.map(row) : <Muted>{t("kr_activeNone")}</Muted>}
      </Card>

      {warn.length ? (
        <Card testID="kr-warn" tone={c.warn}>
          <CardTitle title={t("kr_warn")} />
          {warn.map(w => (
            <Row key={w.pid} gap={10} testID={"kr-warn-" + w.pid}>
              <CardIcon kind="y" />
              <Text style={{ flex: 1, fontSize: 14, color: c.ink }}><Text style={{ fontWeight: "700" }}>{name(w.pid)}</Text>{" · " + tf("kr_warnLine", { n: w.count })}</Text>
            </Row>
          ))}
        </Card>
      ) : null}

      <Card testID="kr-season">
        <CardTitle title={t("kr_season")} />
        {!season.length ? <Muted>{t("kr_seasonNone")}</Muted> : season.map(({ p, x }, i) => {
          const L = cardsOf(E.D, p.id, seasonFrom(E.TODAY));
          return (
            <View key={p.id} testID={"kr-p-" + p.id} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, gap: 3 }}>
              <Row gap={10}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: c.ink }}>{E.name(p)}</Text>
                {(["y", "yr", "r"] as const).map(k => {
                  const n = k === "y" ? x.y : k === "yr" ? x.yr : x.r;
                  return n ? <Row key={k} gap={4}><CardIcon kind={k} size={13} /><Text style={{ fontSize: 13.5, fontWeight: "700", color: c.ink, fontVariant: ["tabular-nums"] }}>{n}</Text></Row> : null;
                })}
              </Row>
              <Muted small>{L.map(z => `${t(z.card === "y" ? "kr_y" : z.card === "yr" ? "kr_yr" : "kr_r")} ${E.de(z.m.date)}${z.m.comp !== "liga" ? ` (${t("comp_" + z.m.comp)})` : ""}`).join(" · ")}</Muted>
            </View>
          );
        })}
      </Card>

      {past.length ? (
        <Fold testID="kr-history" title={tf("kr_history", { n: past.length })}>
          {past.map(row)}
        </Fold>
      ) : null}

      <Card testID="kr-rules">
        <CardTitle title={t("kr_rules")} right={canEdit ? <Btn small kind="ghost" testID="kr-rules-edit" label={t("kr_rulesEdit")} onPress={() => setRulesOpen(true)} /> : undefined} />
        <Muted small testID="kr-rules-kind">{isDefaultRules(rules, E.team.cls) ? tf("kr_rulesDefault", { c: classLabel(classDef(E.team.cls), E.tr.lang) }) : t("kr_rulesCustom")}</Muted>
        <Col gap={2} testID="kr-rules-text">
          <T v="small">{rules.yellowLimit ? tf("kr_ruleYellow", { n: rules.yellowLimit, g: gamesText(E, rules.yellowGames) }) : t("kr_ruleYellowOff")}</T>
          <T v="small">{rules.yrGames ? tf("kr_ruleYr", { g: gamesText(E, rules.yrGames) }) : t("kr_ruleYrOff")}</T>
          <T v="small">{rules.redGames == null ? t("kr_ruleRedPending") : tf("kr_ruleRed", { g: gamesText(E, rules.redGames) })}</T>
        </Col>
        <Muted small>{t("kr_rulesHint")}</Muted>
      </Card>

      <SuspSheet draft={draft} onClose={() => setDraft(null)} />
      <CardSheet visible={cardOpen} onClose={() => setCardOpen(false)} />
      <RulesSheet visible={rulesOpen} rules={rules} onClose={() => setRulesOpen(false)} />
    </Screen>
  );
}
const seasonFrom = (today: string): string => { const y = +today.slice(0, 4), m = +today.slice(5, 7); return `${m >= 7 ? y : y - 1}-07-01`; };

// ---------------------------------------------------------------------
// Spieler: Hinweis auf „Heute“ – gesperrt (mit dem nächsten betroffenen Spiel) bzw. Gelb-Warnung; nur eigene Daten
// (eingetragene Sperren immer, Sperren aus den Karten, wenn die Spieldaten für Spieler freigegeben sind)
// ---------------------------------------------------------------------
const SUSP_ICON: Record<Suspension["kind"], CardKind | null> = { yellow: "y", yellow_red: "yr", red: "r", other: null };
export function PlayerCardsNotice() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const pid = s.mePid || "";
  if (!pid || E.mods.karten === false) return null;
  const rules = cardRules(E.team);
  const mine = activeSuspensions(E.D, rules, E.TODAY).filter(x => x.s.pid === pid);
  const warn = yellowWarnings(E.D, rules, E.TODAY).find(w => w.pid === pid);
  if (!mine.length && !warn) return null;
  return (
    <Card testID="p-cards" tone={mine.length ? c.crit : c.warn}>
      <CardTitle title={mine.length ? t("kr_youSusp") : t("kr_warn")} />
      {mine.map(x => {
        const k = SUSP_ICON[x.s.kind];
        return (
          <Row key={x.s.id} gap={10} align="flex-start" testID={"p-susp-" + x.s.id}>
            {k ? <View style={{ paddingTop: 2 }}><CardIcon kind={k} /></View> : null}
            <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, color: c.ink }}>{suspReason(E, x.s)}</Text>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: c.crit }}>{suspStateText(E, x) + (x.s.scope === "league" ? ` · ${t("kr_scopeLeague")}` : "")}</Text>
              <Muted small>{x.next ? tf("kr_youNext", { w: `${E.wt(x.next.date)} ${E.de(x.next.date)}`, g: `${t("vs")} ${x.next.gegner}` }) : t("kr_noNext")}</Muted>
            </Col>
          </Row>
        );
      })}
      {warn ? (
        <Row gap={10} testID="p-warn">
          <CardIcon kind="y" />
          <Text style={{ flex: 1, fontSize: 14, color: c.ink }}>{tf("kr_youWarn", { n: warn.count })}</Text>
        </Row>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Blatt: Sperre eintragen bzw. ändern (Urteil, aufheben, wie die Regel, löschen)
// ---------------------------------------------------------------------
type Mode = "games" | "until" | "pending";
function SuspSheet({ draft, onClose }: { draft: { s: Suspension; fromAuto: boolean } | null; onClose: () => void }) {
  const E = useEngine(); const { t } = E;
  const isNew = !!draft && draft.s.id.startsWith("tmp-") && !draft.fromAuto && !draft.s.matchId;
  return (
    <Sheet visible={!!draft} onClose={onClose} title={isNew ? t("kr_sheetNew") : t("kr_sheetEdit")} testID="kr-sheet" closeLabel={t("um_cancel")}>
      {draft ? <SuspForm key={draft.s.id} draft={draft.s} fromAuto={draft.fromAuto} onDone={onClose} /> : null}
    </Sheet>
  );
}

function SuspForm({ draft, fromAuto, onDone }: { draft: Suspension; fromAuto: boolean; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const saved = !draft.id.startsWith("tmp-"), withMatch = !!draft.matchId, free = !withMatch;
  const rules = cardRules(E.team);
  const hasRule = withMatch && derivedSuspensions(E.D, rules).some(x => x.matchId === draft.matchId && x.pid === draft.pid && x.kind === draft.kind);
  const [pid, setPid] = useState(draft.pid);
  const [kind, setKind] = useState(draft.kind);
  const [start, setStart] = useState<string | null>(draft.start);
  const [mode, setMode] = useState<Mode>(draft.until ? "until" : draft.games == null ? "pending" : "games");
  const [games, setGames] = useState<number | null>(draft.games == null || draft.games === 0 ? (draft.kind === "red" ? 2 : 1) : draft.games);
  const [until, setUntil] = useState<string | null>(draft.until);
  const [scope, setScope] = useState(draft.scope);
  const [note, setNote] = useState(draft.note);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const players = E.D.players.filter(p => p.active !== false).sort((a, b) => E.name(a).localeCompare(E.name(b), "de"));
  const p = E.P(draft.pid);
  const run = async (f: () => Promise<boolean>) => { setBusy(true); try { if (await f()) onDone(); } finally { setBusy(false); } };
  const save = () => {
    if (!pid) { setErr(t("kr_errPlayer")); return; }
    if (mode === "until" && !until) { setErr(t("kr_errUntil")); return; }
    setErr("");
    run(() => s.saveSuspension({ ...draft, pid, kind, start: start || E.TODAY, games: mode === "games" ? games || 1 : null, until: mode === "until" ? until : null, scope, note }));
  };
  const modes: { key: Mode; label: string }[] = [{ key: "games", label: t("kr_modeGames") }, { key: "until", label: t("kr_modeUntil") }, ...(kind === "red" || kind === "other" ? [{ key: "pending" as const, label: t("kr_modePending") }] : [])];
  return (
    <Col gap={14}>
      {free && !saved ? (
        <Picker testID="kr-pid" label={t("kr_player")} value={pid} onChange={v => { setPid(v); setErr(""); }}
          options={[{ key: "", label: t("kr_pick") }, ...players.map(x => ({ key: x.id, label: E.name(x), sub: absentOn(E.D, x.id, E.TODAY) ? t("ab_" + absentOn(E.D, x.id, E.TODAY)!.typ) : undefined }))]} />
      ) : (
        <Row gap={10}>{p ? <PlayerAvatar p={p} size={34} /> : null}<Col gap={1} style={{ flex: 1 }}><T bold>{p ? E.name(p) : "–"}</T>{withMatch ? <Muted small>{suspReason(E, draft)}</Muted> : null}</Col></Row>
      )}
      {free ? (
        <Col gap={6}>
          <T v="small" bold>{t("kr_reason")}</T>
          <ChoiceChips testID="kr-kind" value={kind} onChange={v => { setKind(v); if (v !== "red" && v !== "other" && mode === "pending") setMode("games"); }}
            options={(["red", "yellow_red", "yellow", "other"] as const).map(k => ({ key: k, label: t("kr_kind_" + k) }))} />
        </Col>
      ) : null}
      {free ? <DateField testID="kr-start" label={t("kr_startL")} value={start} onChange={setStart} lang={E.tr.lang} /> : null}
      <Col gap={6}>
        <T v="small" bold>{t("kr_mode")}</T>
        <ChoiceChips testID="kr-mode" value={mode} onChange={v => { setMode(v); setErr(""); }} options={modes} />
      </Col>
      {mode === "games" ? <NumField testID="kr-games" label={t("kr_games")} value={games} onChange={setGames} min={1} max={30} step={1} style={{ width: 150 }} /> : null}
      {mode === "until" ? <DateField testID="kr-until" label={t("kr_untilL")} value={until} onChange={setUntil} lang={E.tr.lang} /> : null}
      <Col gap={6}>
        <T v="small" bold>{t("kr_scope")}</T>
        <ChoiceChips testID="kr-scope" value={scope} onChange={setScope} options={[{ key: "all", label: t("kr_scopeAll") }, { key: "league", label: t("kr_scopeLeague") }]} />
      </Col>
      <Field testID="kr-note" label={t("kr_note")} placeholder={t("kr_notePh")} value={note} onChangeText={setNote} maxLength={200} />
      {err ? <Banner color={c.crit} testID="kr-err">{err}</Banner> : null}
      <Row gap={10} wrap>
        <Btn kind="primary" testID="kr-save" label={t("save")} disabled={busy} onPress={save} />
        {withMatch && (fromAuto || saved) && draft.games !== 0 ? (
          <Btn kind="ghost" testID="kr-lift" label={t("kr_lift")} disabled={busy} onPress={() => run(() => s.saveSuspension({ ...draft, games: 0, until: null }, "kr_liftedT"))} />
        ) : null}
        {saved && withMatch && hasRule ? <Btn kind="ghost" testID="kr-rule" label={t("kr_backToRule")} disabled={busy} onPress={() => run(() => s.deleteSuspension(draft.id, "kr_ruleT"))} /> : null}
        {saved && (!withMatch || !hasRule) ? <Btn kind="ghost" testID="kr-del" label={t("kr_delete")} disabled={busy} onPress={() => run(() => s.deleteSuspension(draft.id))} /> : null}
      </Row>
      {fromAuto ? <Muted small>{tf("kr_fromRule", { r: (draft.games == null ? t("kr_pending") : gamesText(E, draft.games)) + (draft.scope === "league" ? ` (${t("kr_scopeLeague")})` : "") })}</Muted> : null}
    </Col>
  );
}

// ---------------------------------------------------------------------
// Blatt: Karte eintragen (ohne Spielbericht)
// ---------------------------------------------------------------------
function CardSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const E = useEngine(); const { t } = E;
  return (
    <Sheet visible={visible} onClose={onClose} title={t("kr_addCard")} testID="kr-card-sheet" closeLabel={t("um_cancel")}>
      {visible ? <CardForm onDone={onClose} /> : null}
    </Sheet>
  );
}
function CardForm({ onDone }: { onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const matches = E.D.matches.filter(m => m.date <= E.TODAY).sort((a, b) => (a.date + a.zeit < b.date + b.zeit ? 1 : -1)).slice(0, 40);
  const [mid, setMid] = useState(matches[0]?.id || "");
  const [pid, setPid] = useState("");
  const cur = mid && pid ? E.D.stats[mid]?.[pid]?.card || null : null;
  const [card, setCard] = useState<CardKind | "none">("y");
  const [busy, setBusy] = useState(false);
  // in diesem Spiel eingesetzte Spieler zuerst
  const players = E.D.players.filter(p => p.active !== false).sort((a, b) => Number(!!E.D.stats[mid]?.[b.id]) - Number(!!E.D.stats[mid]?.[a.id]) || E.name(a).localeCompare(E.name(b), "de"));
  if (!matches.length) return <Muted>{t("sp_none")}</Muted>;
  return (
    <Col gap={14}>
      <Picker testID="kr-cm" label={t("kr_match")} value={mid} onChange={setMid}
        options={matches.map(m => ({ key: m.id, label: `${E.wt(m.date)} ${E.de(m.date)} · ${t("vs")} ${m.gegner}`, sub: t("comp_" + m.comp) }))} />
      <Picker testID="kr-cp" label={t("kr_player")} value={pid} onChange={v => { setPid(v); const c0 = E.D.stats[mid]?.[v]?.card; if (c0) setCard(c0); }}
        options={[{ key: "", label: t("kr_pick") }, ...players.map(p => ({ key: p.id, label: E.name(p), sub: E.D.stats[mid]?.[p.id]?.card ? t(E.D.stats[mid][p.id].card === "y" ? "kr_y" : E.D.stats[mid][p.id].card === "yr" ? "kr_yr" : "kr_r") : undefined }))]} />
      <Col gap={6}>
        <T v="small" bold>{t("kr_card")}</T>
        <ChoiceChips testID="kr-cc" value={card} onChange={setCard} options={[{ key: "y", label: t("kr_y") }, { key: "yr", label: t("kr_yr") }, { key: "r", label: t("kr_r") }, ...(cur ? [{ key: "none" as const, label: t("kr_none") }] : [])]} />
        <Muted small>{t("sp_cardHint")}</Muted>
      </Col>
      <Row gap={10} wrap>
        <Btn kind="primary" testID="kr-card-save" label={t("save")} disabled={busy || !mid || !pid} onPress={async () => {
          setBusy(true); try { if ((await s.saveCard(mid, pid, card === "none" ? null : card)) !== false) onDone(); } finally { setBusy(false); }
        }} />
        <Btn kind="ghost" label={t("um_cancel")} onPress={onDone} />
      </Row>
    </Col>
  );
}

// ---------------------------------------------------------------------
// Blatt: Regeln (je Verband und Altersklasse)
// ---------------------------------------------------------------------
function RulesSheet({ visible, rules, onClose }: { visible: boolean; rules: CardRules; onClose: () => void }) {
  const E = useEngine(); const { t } = E;
  return (
    <Sheet visible={visible} onClose={onClose} title={t("kr_rules")} testID="kr-rules-sheet" closeLabel={t("um_cancel")}>
      {visible ? <RulesForm rules={rules} onDone={onClose} /> : null}
    </Sheet>
  );
}
function RulesForm({ rules, onDone }: { rules: CardRules; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [r, setR] = useState(rules);
  const opts = (L: number[], cur: number) => [...new Set([...L, cur])].sort((a, b) => a - b);
  const limits = opts([0, 3, 4, 5, 6, 10], r.yellowLimit);
  return (
    <Col gap={14}>
      <Col gap={6}>
        <T v="small" bold>{t("kr_rYellowLimit")}</T>
        <ChoiceChips testID="kr-r-yl" value={String(r.yellowLimit)} onChange={v => setR({ ...r, yellowLimit: +v })} options={limits.map(n => ({ key: String(n), label: n ? String(n) : t("kr_off") }))} />
      </Col>
      {r.yellowLimit ? (
        <Col gap={6}>
          <T v="small" bold>{t("kr_rYellowGames")}</T>
          <ChoiceChips testID="kr-r-yg" value={String(r.yellowGames)} onChange={v => setR({ ...r, yellowGames: +v })} options={opts([1, 2, 3], r.yellowGames).map(n => ({ key: String(n), label: String(n) }))} />
        </Col>
      ) : null}
      <Col gap={6}>
        <T v="small" bold>{t("kr_rYrGames")}</T>
        <ChoiceChips testID="kr-r-yr" value={String(r.yrGames)} onChange={v => setR({ ...r, yrGames: +v })} options={opts([0, 1, 2], r.yrGames).map(n => ({ key: String(n), label: n ? gamesText(E, n) : t("kr_noSusp") }))} />
      </Col>
      <Col gap={6}>
        <T v="small" bold>{t("kr_rRedGames")}</T>
        <ChoiceChips testID="kr-r-red" value={r.redGames == null ? "p" : String(r.redGames)} onChange={v => setR({ ...r, redGames: v === "p" ? null : +v })}
          options={[{ key: "p", label: t("kr_modePending") }, ...opts([1, 2, 3, 4], r.redGames ?? 2).map(n => ({ key: String(n), label: gamesText(E, n) }))]} />
      </Col>
      <Muted small>{t("kr_rulesHint")}</Muted>
      <Row gap={10} wrap>
        <Btn kind="primary" testID="kr-rules-save" label={t("save")} onPress={async () => {
          await s.updateTeam({ settings: { ...E.team.settings, cards: cleanCardRules(r, E.team.cls) } });
          s.toast(t("kr_rulesSaved")); onDone();
        }} />
        <Btn kind="ghost" testID="kr-rules-default" label={t("kr_rulesReset")} onPress={() => setR(defaultCardRules(E.team.cls))} />
      </Row>
    </Col>
  );
}
