// Wochenchallenge: Karte für Spieler (Eintragen, eigener Fortschritt, Teamziel) und Verwaltung für das Trainerteam.
// Motivationsklima: eigene Verbesserung und gemeinsames Teamziel statt Vergleich (Bestenliste nur auf Wunsch).
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { challengeDefsFor, challengeStreak, entryOf, fromDef, isDone, progressOf, totalsOf, weekChallenges, type ChallengeDef } from "../core/challenge";
import { addDays, monday } from "../core/dates";
import type { Challenge, ChallengeKind, Player } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Bar, Btn, Card, CardTitle, Check, ChoiceChips, Col, Field, Info, Muted, NumField, Picker, Row, Seg, Sheet, T, ToggleRow } from "./kit";
import { radius, useTheme, withAlpha } from "./theme";

export const CH_COLOR = "#e0457b";
const KINDS: ChallengeKind[] = ["best", "count", "days", "check"];

function useNum() { const E = useEngine(); return (v: number | null | undefined) => v == null ? "–" : E.tr.int(v); }

/** Eine Challenge mit Eintragen (Spieler bzw. Trainerteam für einen Spieler) */
export function ChallengeItem({ c: ch, p, testID }: { c: Challenge; p: Player; testID?: string }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const num = useNum();
  const e = entryOf(E.D, ch.id, p.id), done = isDone(ch, e), pr = progressOf(ch, e);
  const rank = !!E.team.settings.challengeRank, tot = totalsOf(E.D, ch, rank);
  const [v, setV] = useState<number | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ch.ws, i));
  const open = ch.ws >= addDays(monday(E.TODAY), -7);
  const id = testID || "ch-" + ch.id;
  return (
    <View testID={id} style={{ gap: 10, padding: 12, borderRadius: radius.l, borderWidth: 1, borderColor: withAlpha(CH_COLOR, done ? 0.6 : 0.3), backgroundColor: withAlpha(CH_COLOR, done ? 0.12 : 0.05) }}>
      <Row between align="flex-start" gap={8}>
        <Col gap={3} style={{ flex: 1 }}>
          <T bold>{ch.title}</T>
          {ch.text ? <Muted small>{ch.text}</Muted> : null}
        </Col>
        {done ? <Text testID={id + "-done"} style={{ fontSize: 22 }}>🎉</Text> : null}
      </Row>
      {ch.kind !== "check" ? <Col gap={4}>
        <Bar value={pr} color={done ? c.ok : CH_COLOR} />
        <Muted small>
          {ch.kind === "best" ? `${t("cg_myBest")}: ${e?.value != null ? num(e.value) + " " + ch.unit : "–"}${ch.target ? " · " + t("cg_target") + " " + num(ch.target) + " " + ch.unit : ""}`
            : ch.kind === "count" ? tf("cg_progress", { a: num(e?.value || 0), b: num(ch.target || 0) }) + " " + ch.unit
            : tf("cg_progress", { a: e?.days.length || 0, b: ch.target || 1 }) + " " + t("cg_days")}
        </Muted>
      </Col> : null}
      {open ? <>
        {ch.kind === "best" ? <Row gap={8} align="flex-end">
          <NumField testID={id + "-val"} label={t("cg_try") + (ch.unit ? ` (${ch.unit})` : "")} value={v} onChange={setV} min={0} max={100000} style={{ flex: 1 }} />
          <Btn testID={id + "-save"} kind="primary" label={t("save")} disabled={v == null} onPress={() => { s.saveChallengeEntry(ch, p.id, { value: v }); setV(null); }} />
        </Row> : null}
        {ch.kind === "count" ? <Col gap={8}>
          <Row gap={6} wrap>{[10, 25, 50, 100].map(n => <Btn key={n} small testID={`${id}-add-${n}`} label={"+" + n} onPress={() => s.saveChallengeEntry(ch, p.id, { value: n })} />)}</Row>
          <Row gap={8} align="flex-end">
            <NumField testID={id + "-val"} label={t("cg_addCount")} value={v} onChange={setV} min={0} max={10000} step={1} style={{ flex: 1 }} />
            <Btn testID={id + "-save"} label={t("save")} disabled={!v} onPress={() => { s.saveChallengeEntry(ch, p.id, { value: v }); setV(null); }} />
          </Row>
        </Col> : null}
        {ch.kind === "days" ? <Row gap={6} wrap>
          {days.map(d => {
            const on = !!e?.days.includes(d), future = d > E.TODAY;
            return (
              <Pressable key={d} testID={`${id}-day-${d}`} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: future }} disabled={future} onPress={() => s.saveChallengeEntry(ch, p.id, { day: d })}
                style={{ width: 42, height: 46, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? CH_COLOR : c.line, backgroundColor: on ? CH_COLOR : c.surface, alignItems: "center", justifyContent: "center", opacity: future ? 0.4 : 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: on ? "#fff" : c.muted }}>{E.wt(d)}</Text>
                {on ? <Icon name="check" size={14} color="#fff" strokeWidth={3} /> : <Text style={{ fontSize: 12, color: c.ink }}>{Number(d.slice(8))}</Text>}
              </Pressable>
            );
          })}
        </Row> : null}
        {ch.kind === "check" ? <Check testID={id + "-check"} label={t("cg_doneCheck")} value={!!e?.done} onChange={x => s.saveChallengeEntry(ch, p.id, { done: x })} /> : null}
      </> : null}
      <Col gap={4}>
        <Muted small>{tf("cg_team", { n: tot.players, d: tot.done })}</Muted>
        {ch.teamTarget ? <><Bar value={tot.sum / ch.teamTarget} color={c.ok} /><Muted small>{tf("cg_teamSum", { s: num(tot.sum), t: num(ch.teamTarget) })} {ch.unit}</Muted></> : null}
        {rank && tot.top.length ? <Row gap={6} wrap>{tot.top.map((x, i) => <Text key={i} style={{ fontSize: 12.5, color: c.ink }}>{["🥇", "🥈", "🥉"][i]} {x.name} {num(x.value)}</Text>)}</Row> : null}
      </Col>
    </View>
  );
}

/** Karte für die Spieler-App: Challenges dieser Woche, Serie */
export function ChallengeCard({ pid }: { pid: string }) {
  const E = useEngine(); const { t, tf } = E;
  const p = E.P(pid); if (!p || !E.mods.challenge) return null;
  const list = weekChallenges(E.D, E.TODAY, p);
  if (!list.length) return null;
  const streak = challengeStreak(E.D, pid, E.TODAY);
  return (
    <Card testID="player-challenge" tone={CH_COLOR}>
      <CardTitle title={t("cg_title")} info={<Info title={t("cg_title")} text={[t("cg_info"), t("cg_safety")]} />} right={streak >= 2 ? <Text style={{ fontSize: 12.5, fontWeight: "800", color: CH_COLOR }}>🔥 {tf("cg_streak", { n: streak })}</Text> : undefined} />
      {list.map(ch => <ChallengeItem key={ch.id} c={ch} p={p} />)}
    </Card>
  );
}

/** Challenge anlegen/bearbeiten: Vorschlag passend zur Altersgruppe oder eigene */
export function ChallengeSheet({ target, onClose }: { target: { ws: string; c?: Challenge } | null; onClose: () => void }) {
  return target ? <ChallengeForm key={target.c?.id || "new" + target.ws} target={target} onClose={onClose} /> : null;
}
function ChallengeForm({ target, onClose }: { target: { ws: string; c?: Challenge }; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const defs = challengeDefsFor(E.grp);
  const [x, setX] = useState<Challenge>(() => target.c ? { ...target.c } : fromDef(defs[0], target.ws, tmpId(), t("chk_" + defs[0].key), t("chkd_" + defs[0].key)));
  const [busy, setBusy] = useState(false);
  const set = (y: Partial<Challenge>) => setX(prev => ({ ...prev, ...y }));
  const pick = (d: ChallengeDef) => setX(prev => ({ ...fromDef(d, prev.ws, prev.id, t("chk_" + d.key), t("chkd_" + d.key)), groupId: prev.groupId }));
  const isNew = x.id.startsWith("tmp-");
  const groups = E.D.groups.filter(g => g.vis);
  const ws0 = monday(E.TODAY);
  const save = async () => { setBusy(true); try { await s.saveChallenge({ ...x, title: x.title.trim().slice(0, 80), text: x.text.trim().slice(0, 600), unit: x.unit.trim().slice(0, 12) }); onClose(); } finally { setBusy(false); } };
  const del = async () => { setBusy(true); try { await s.deleteChallenge(x.id); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible onClose={onClose} title={isNew ? t("cg_new") : x.title} testID="ch-sheet" closeLabel={t("cancel")}>
      {isNew ? <Col gap={6}>
        <T v="small" bold>{t("cg_pick")}</T>
        <Row wrap gap={6}>
          {defs.map(d => {
            const on = x.key === d.key;
            return <Pressable key={d.key} testID={"ch-def-" + d.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => pick(d)}
              style={{ borderWidth: 1.5, borderColor: on ? CH_COLOR : c.line, backgroundColor: on ? CH_COLOR : c.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}>
              <Text style={{ fontWeight: "700", fontSize: 13, color: on ? "#fff" : c.ink }}>{t("chk_" + d.key)}</Text>
            </Pressable>;
          })}
          <Pressable testID="ch-def-own" accessibilityRole="radio" accessibilityState={{ checked: !x.key }} onPress={() => set({ key: null, title: "", text: "" })}
            style={{ borderWidth: 1.5, borderColor: !x.key ? CH_COLOR : c.line, backgroundColor: !x.key ? CH_COLOR : c.surface, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}>
            <Text style={{ fontWeight: "700", fontSize: 13, color: !x.key ? "#fff" : c.ink }}>{t("cg_own")}</Text>
          </Pressable>
        </Row>
      </Col> : null}
      <Field testID="ch-title" label={t("cg_titleF")} value={x.title} onChangeText={v => set({ title: v })} maxLength={80} />
      <Field testID="ch-text" label={t("cg_text")} value={x.text} onChangeText={v => set({ text: v })} multiline maxLength={600} />
      <Col gap={6}><T v="small" bold>{t("cg_kind")}</T>
        <ChoiceChips testID="ch-kind" value={x.kind} onChange={k => set({ kind: k, target: k === "days" ? (x.target || 5) : k === "check" ? null : x.target, unit: k === "days" ? "d" : x.unit })} options={KINDS.map(k => ({ key: k, label: t("cg_k_" + k) }))} />
      </Col>
      {x.kind !== "check" ? <Row wrap gap={10}>
        <NumField testID="ch-target" label={t("cg_target")} value={x.target} onChange={v => set({ target: v && v > 0 ? v : null })} min={0} max={x.kind === "days" ? 7 : 100000} step={x.kind === "days" ? 1 : undefined} style={{ flex: 1, minWidth: 110 }} />
        {x.kind !== "days" ? <Field testID="ch-unit" label={t("cg_unit")} value={x.unit} onChangeText={v => set({ unit: v })} maxLength={12} style={{ flex: 1, minWidth: 90 }} /> : null}
        {x.kind === "count" || x.kind === "best" ? <NumField testID="ch-team" label={t("cg_teamTarget")} value={x.teamTarget} onChange={v => set({ teamTarget: v && v > 0 ? v : null })} min={0} style={{ flex: 1, minWidth: 130 }} /> : null}
      </Row> : null}
      {x.kind === "best" ? <Check testID="ch-lower" label={t("cg_lower")} value={x.lower} onChange={v => set({ lower: v })} /> : null}
      <Col gap={6}><T v="small" bold>{t("cg_week")}</T>
        <Seg testID="ch-week" value={x.ws === ws0 ? "now" : "next"} onChange={(k: "now" | "next") => set({ ws: k === "now" ? ws0 : addDays(ws0, 7) })}
          options={[{ key: "now", label: `${E.de(ws0)} – ${E.de(addDays(ws0, 6))}` }, { key: "next", label: `${E.de(addDays(ws0, 7))} – ${E.de(addDays(ws0, 13))}` }]} />
      </Col>
      {groups.length ? <Picker testID="ch-group" label={t("cg_for")} value={x.groupId || ""} onChange={(k: string) => set({ groupId: k || null })} options={[{ key: "", label: t("cg_all") }, ...groups.map(g => ({ key: g.id, label: g.name }))]} /> : null}
      <Banner>{t("cg_safety")}</Banner>
      <Btn testID="ch-save" kind="primary" label={t("cg_save")} disabled={busy || !x.title.trim() || (x.kind === "days" && !x.target)} onPress={save} />
      {!isNew ? <Btn testID="ch-del" kind="danger" icon="trash" label={t("cg_del")} disabled={busy} onPress={del} style={{ alignSelf: "flex-start" }} /> : null}
    </Sheet>
  );
}

/** Verwaltung (Trainerteam): Challenges dieser und nächster Woche, Teilnahme, Verlauf */
export function ChallengeAdmin() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const num = useNum();
  const [edit, setEdit] = useState<{ ws: string; c?: Challenge } | null>(null);
  const ws0 = monday(E.TODAY), canPlan = s.can("plan");
  const rank = !!E.team.settings.challengeRank;
  const week = (ws: string) => E.D.challenges.filter(x => x.ws === ws);
  const past = [...new Set(E.D.challenges.filter(x => x.ws < ws0).map(x => x.ws))].sort().reverse().slice(0, 6);
  const block = (ws: string, label: string) => {
    const L = week(ws);
    return (
      <Card key={ws} testID={"ch-week-" + ws}>
        <CardTitle title={label} right={canPlan ? <Btn small testID={"ch-new-" + ws} icon="plus" label={t("cg_new")} onPress={() => setEdit({ ws })} /> : undefined} />
        <Muted small>{E.de(ws)} – {E.de(addDays(ws, 6))}</Muted>
        {L.length ? L.map(ch => {
          const tot = totalsOf(E.D, ch, true), es = E.D.chEntries.filter(e => e.cid === ch.id);
          const grp = ch.groupId ? E.D.groups.find(g => g.id === ch.groupId) : null, n = grp ? E.D.players.filter(p => (p.groups || []).includes(grp.id)).length : E.D.players.length;
          return (
            <View key={ch.id} testID={"ch-admin-" + ch.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line }}>
              <Row between gap={8}>
                <Col gap={2} style={{ flex: 1 }}><T bold>{ch.title}</T><Muted small>{t("cg_k_" + ch.kind)}{ch.target ? ` · ${t("cg_target")} ${num(ch.target)} ${ch.unit}` : ""}{grp ? ` · ${grp.name}` : ""}</Muted></Col>
                {canPlan ? <Btn small kind="ghost" icon="eintragen" label="" a11y={t("cg_save")} testID={"ch-edit-" + ch.id} onPress={() => setEdit({ ws, c: ch })} /> : null}
              </Row>
              <Bar value={n ? tot.players / n : 0} color={CH_COLOR} />
              <Muted small>{tf("cg_team", { n: tot.players, d: tot.done })} · {tot.players}/{n}</Muted>
              {ch.teamTarget ? <Muted small>{tf("cg_teamSum", { s: num(tot.sum), t: num(ch.teamTarget) })} {ch.unit}</Muted> : null}
              {es.length ? <Row wrap gap={6}>
                {es.sort((a, b) => (b.value || 0) - (a.value || 0)).map(e => { const p = E.P(e.pid); if (!p) return null; const ok = isDone(ch, e);
                  return <View key={e.pid} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: ok ? withAlpha(c.ok, 0.15) : c.sunk }}>
                    <Text style={{ fontSize: 12, color: c.ink }}>{p.vn} {p.nn ? p.nn[0] + "." : ""} · {ch.kind === "days" ? e.days.length + " " + t("cg_days") : ch.kind === "check" ? (e.done ? "✓" : "–") : num(e.value)}{ok ? " ✓" : ""}</Text>
                  </View>; })}
              </Row> : <Muted small>{t("cg_noEntries")}</Muted>}
            </View>
          );
        }) : <Muted>{t("cg_none")}</Muted>}
      </Card>
    );
  };
  return (
    <Col gap={18}>
      <Card testID="ch-settings">
        <ToggleRow testID="ch-rank" label={t("cg_rank")} desc={t("cg_rankD")} value={rank} disabled={!canPlan} onChange={v => s.updateTeam({ settings: { ...E.team.settings, challengeRank: v } })} />
      </Card>
      {block(ws0, t("cg_title"))}
      {block(addDays(ws0, 7), t("cg_week") + " +1")}
      {past.length ? <Card testID="ch-history">
        <CardTitle title={t("dv_trend")} />
        {past.map(ws => { const L = week(ws); return (
          <Row key={ws} between gap={8} style={{ paddingVertical: 4 }}>
            <T v="small" style={{ flex: 1 }}>{E.de(ws)} · {L.map(x => x.title).join(", ")}</T>
            <Muted small>{L.map(x => { const tt = totalsOf(E.D, x, false); return `${tt.done}/${tt.players}`; }).join(" · ")}</Muted>
          </Row>
        ); })}
      </Card> : null}
      <ChallengeSheet target={edit} onClose={() => setEdit(null)} />
    </Col>
  );
}
