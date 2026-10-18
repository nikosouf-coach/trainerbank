// Saisonplanung: Überblick (geplant, Abgänge, Zugänge, Bedarf), Jahrgänge bzw. Altersstruktur, Stand jedes eigenen
// Spielers (fest, Perspektive, unsicher, Abgang; Altersgrenze automatisch), Aufrücker aus dem Verein, Zugänge, Notizen.
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { effectivePerms } from "../../core/perms";
import {
  addRef, autoAssign, eligibleYears, isOut, PLAN_STATUS, planOverview, planSlots, playerState, posMatch, refOf, removeRef, riserSnap, seasonLabel, setPlayerStatus, slotsWith, yearBuckets, yearOf,
  type RefInfo, type RefState,
} from "../../core/scout";
import { isGoalkeeper } from "../../core/units";
import type { PlanStatus, Player, Riser, SpContent } from "../../core/types";
import { useStore } from "../../data/store";
import { Banner, Btn, Card, CardTitle, Col, Field, Muted, Row, Sheet, T } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { posShort, slotShort, stateCol, StateTag, statusCol, usePlanData } from "./common";
import { Chips } from "./forms";

function Kpi({ label, value, color, testID }: { label: string; value: number; color?: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexGrow: 1, flexBasis: 74, backgroundColor: c.sunk, borderRadius: radius.m, padding: 10, gap: 2 }}>
      <T v="eyebrow">{label}</T>
      <Text style={{ fontSize: 24, fontWeight: "900", color: color || c.ink, fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

type F = "all" | RefState;

export function SeasonView({ season, onSlot, onOpenScout }: { season: number; onSlot: (key: string) => void; onOpenScout: (id: string) => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme(); const router = useRouter();
  const P = usePlanData(season); const { D, content, info, risers, fmt, youth } = P;
  const [f, setF] = useState<F>("all"); const [edit, setEdit] = useState<Player | null>(null); const [notes, setNotes] = useState<string | null>(null); const [ask, setAsk] = useState(false);
  useEffect(() => { if (D.team.clubId) s.loadRisers(season); }, [season, D.team.clubId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!content) return null;
  const o = planOverview(D, content, season, risers);
  const e = eligibleYears(D.team.cls, season), label = seasonLabel(season);
  const buckets = yearBuckets(content, D.team.cls, season, info, D.players), maxB = Math.max(1, ...buckets.map(b => b.n));
  const states = D.players.map(p => ({ p, st: playerState(p, content, D.team.cls, season) }));
  const shown = states.filter(x => f === "all" || x.st === f).sort((a, b) => (a.p.pos === "TW" ? 0 : 1) - (b.p.pos === "TW" ? 0 : 1) || (a.p.nr ?? 99) - (b.p.nr ?? 99));
  const counts = (k: RefState) => states.filter(x => x.st === k).length;
  const save = (c2: SpContent) => P.save(c2);
  const assignAll = () => save(autoAssign(content, fmt, o.unassigned.map(p => ({ ref: refOf("p", p.id), pos: p.pos, gk: isGoalkeeper(D, p) }))));
  const planRiser = (r: Riser) => { const c2 = autoAssign(content, fmt, [{ ref: refOf("r", r.id), pos: r.pos, gk: r.pos === "TW" }]); save({ ...c2, ext: { ...(c2.ext || {}), [refOf("r", r.id)]: riserSnap(r) } }); };
  // Hochziehen nur, wenn man im Team des Aufrückers den Kader verwalten darf
  const canRaise = (r: Riser) => s.memberships.some(m => m.teamId === r.teamId && effectivePerms(m.role, m.perms).has("squad")) && s.can("squad");
  const filters: F[] = ["all", "open", "fix", "persp", "unsure", "leave", ...(youth ? ["ageout" as F] : [])];
  return (
    <Col gap={14} testID="sk-season-view">
      <Row gap={8} wrap testID="sk-kpis">
        <Kpi testID="sk-k-planned" label={t("sk_k_planned")} value={o.planned} color={c.ok} />
        <Kpi testID="sk-k-leaving" label={t("sk_k_leaving")} value={o.leaving.length} color={o.leaving.length ? c.crit : undefined} />
        <Kpi testID="sk-k-arrivals" label={t("sk_k_arrivals")} value={o.arrivals.length} color={c.event} />
        <Kpi testID="sk-k-needs" label={t("sk_k_needs")} value={o.needs.length} color={o.needs.length ? c.warn : c.ok} />
      </Row>

      {o.needs.length ? <Card testID="sk-needs">
        <CardTitle title={tf("sk_needsN", { n: o.needs.length })} />
        <Row wrap gap={6}>{o.needs.map(n => (
          <Pressable key={n.key} testID={"sk-need-" + n.key} accessibilityRole="button" onPress={() => onSlot(n.key)}
            style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, backgroundColor: withAlpha(n.level === "need" ? c.crit : c.warn, 0.15) }}>
            <Text style={{ fontWeight: "800", color: n.level === "need" ? c.crit : c.warn }}>{slotShort(t, n.key)} · {n.firm}/{n.target}</Text>
          </Pressable>
        ))}</Row>
      </Card> : <Banner color={c.ok}>{t("sk_needsNone")}</Banner>}

      <Card testID="sk-years">
        <CardTitle title={tf(youth ? "sk_years" : "sk_ages", { s: label })} />
        <Muted small>{e ? tf("sk_yearsHint", { a: e.min, b: e.max }) : t("sk_agesHint")}</Muted>
        <Col gap={8}>{buckets.map(b => (
          <Row key={b.key} gap={10}>
            <Text style={{ width: 92, fontWeight: "700", color: c.ink }} numberOfLines={1}>{b.kind === "younger" ? t("sk_yearsYounger") : b.label}</Text>
            <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: c.sunk, overflow: "hidden" }}>
              <View style={{ width: `${(b.n / maxB) * 100}%`, height: "100%", backgroundColor: b.kind === "younger" ? c.low : c.accent, borderRadius: 7 }} />
            </View>
            <Text style={{ width: 26, textAlign: "right", fontWeight: "900", color: c.ink, fontVariant: ["tabular-nums"] }}>{b.n}</Text>
          </Row>
        ))}</Col>
        {youth && counts("ageout") ? <Muted small testID="sk-ageout">{tf("sk_ageoutN", { n: counts("ageout") })}</Muted> : null}
      </Card>

      <Card testID="sk-players">
        <CardTitle title={t("sk_players")} />
        <Row wrap gap={6}>{filters.map(k => {
          const on = f === k, n = k === "all" ? states.length : counts(k as RefState), col = k === "all" ? c.accent : stateCol(c, k as RefState);
          return (
            <Pressable key={k} testID={"sk-f-" + k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setF(k)}
              style={{ flexDirection: "row", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? withAlpha(col, 0.14) : "transparent" }}>
              <Text style={{ fontWeight: "800", fontSize: 12.5, color: on ? col : c.ink }}>{k === "all" ? t("sk_f_all") : t("sks_" + k)}</Text>
              <Text style={{ fontWeight: "900", fontSize: 12, color: c.muted }}>{n}</Text>
            </Pressable>
          );
        })}</Row>
        {o.unassigned.length ? <Banner color={c.warn}><Row gap={8} wrap><T v="small" style={{ flex: 1, minWidth: 180 }}>{tf("sk_unassigned", { n: o.unassigned.length })}</T>
          <Btn small testID="sk-assign-all" label={t("sk_assignAll")} onPress={assignAll} /></Row></Banner> : null}
        <View>{shown.map(({ p, st }) => {
          const w = slotsWith(content, refOf("p", p.id)), note = content.status[p.id]?.note;
          return (
            <Pressable key={p.id} testID={"sk-pl-" + p.id} accessibilityRole="button" onPress={() => setEdit(p)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <Text style={{ width: 26, textAlign: "center", fontWeight: "900", color: c.muted, fontVariant: ["tabular-nums"] }}>{p.nr ?? "–"}</Text>
              <Col gap={2} style={{ flex: 1 }}>
                <Row gap={6}><T bold numberOfLines={1} style={{ flexShrink: 1 }}>{`${p.vn} ${p.nn}`.trim()}</T>{p.neu ? <StateTag label={t("newP")} color={c.low} /> : null}</Row>
                <Muted small>{[posShort(t, p.pos), yearOf(p) ? String(yearOf(p)) : "", w.length ? "◆ " + w.map(x => slotShort(t, x.key)).join(", ") : isOut(st) ? "" : t("sk_notPlanned")].filter(Boolean).join(" · ")}{note ? ` · „${note}“` : ""}</Muted>
              </Col>
              <StateTag label={t("sks_" + st)} color={stateCol(c, st)} />
            </Pressable>
          );
        })}</View>
      </Card>

      <Card testID="sk-risers">
        <CardTitle title={t("sk_risers")} />
        {!D.team.clubId ? <Muted small>{t("sk_risersNoClub")}</Muted> : <>
          <Muted small>{tf("sk_risersHint", { s: label })}</Muted>
          {risers.length ? risers.map(r => {
            const ref = refOf("r", r.id), w = slotsWith(content, ref);
            return (
              <View key={r.id} testID={"sk-riser-" + r.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <Col gap={2} style={{ flex: 1 }}>
                  <T bold numberOfLines={1}>{`${r.vn} ${r.nn}`.trim()}</T>
                  <Muted small>{[posShort(t, r.pos), String(r.year), r.team, w.length ? tf("sk_planned", { p: w.map(x => slotShort(t, x.key)).join(", ") }) : ""].filter(Boolean).join(" · ")}</Muted>
                </Col>
                {w.length ? <Btn small kind="ghost" testID={"sk-riser-x-" + r.id} label={t("sk_remove")} onPress={() => save(removeRef(content, ref))} />
                  : <Btn small testID={"sk-riser-plan-" + r.id} label={t("sk_plan")} onPress={() => planRiser(r)} />}
                {canRaise(r) ? <Btn small kind="ghost" testID={"sk-riser-raise-" + r.id} label={t("sk_takeRiser")} onPress={async () => { if (await s.movePlayer(r.id, D.team.id, "add", false)) s.loadRisers(season, true); }} /> : null}
              </View>
            );
          }) : <Muted small>{t("sk_risersNone")}</Muted>}
        </>}
      </Card>

      <Card testID="sk-arrivals">
        <CardTitle title={t("sk_arrivals")} />
        {o.arrivals.length ? o.arrivals.map((a: RefInfo) => {
          const sc = a.k === "s" ? D.scouts.find(x => x.id === a.id) : null, inSquad = !!sc?.playerId && D.players.some(p => p.id === sc.playerId);
          const take = !!sc && sc.status === "signed" && !inSquad && s.can("squad");
          return (
            <View key={a.ref} testID={"sk-arrival-" + a.ref} style={{ paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <Row gap={10}>
                <Pressable style={{ flex: 1 }} accessibilityRole={a.k === "s" ? "button" : undefined} disabled={a.k !== "s"} onPress={() => onOpenScout(a.id)}>
                  <T bold numberOfLines={1}>{a.name}</T>
                  <Muted small>{[posShort(t, a.pos), a.year ? String(a.year) : "", a.team || "", "◆ " + slotsWith(content, a.ref).map(x => slotShort(t, x.key)).join(", ")].filter(Boolean).join(" · ")}</Muted>
                </Pressable>
                <Col gap={4} style={{ alignItems: "flex-end" }}>
                  <StateTag label={a.k === "s" && a.status ? t("scs_" + a.status) : t("sks_" + a.state)} color={a.k === "s" && a.status ? statusCol(c, a.status) : stateCol(c, a.state)} />
                  {inSquad ? <Muted small>{t("sk_inSquad")}</Muted> : null}
                </Col>
              </Row>
              {take ? <Btn small kind="primary" icon="plus" testID={"sk-takeover-" + sc!.id} label={t("sk_takeOver")} onPress={async () => { const id = await s.takeOverScout(sc!.id); if (id) router.push("/coach/spieler/" + id); }} style={{ alignSelf: "flex-start" }} /> : null}
            </View>
          );
        }) : <Muted small>{t("sk_arrivalsNone")}</Muted>}
      </Card>

      <Card testID="sk-notes">
        <CardTitle title={t("sk_notes")} />
        <Field testID="sk-notes-field" label={t("sk_notes")} value={notes ?? content.notes} onChangeText={setNotes} placeholder={t("sk_notesPh")} multiline maxLength={2000} />
        {notes != null && notes !== content.notes ? <Btn small kind="primary" testID="sk-notes-save" label={t("save")} onPress={() => { save({ ...content, notes }); setNotes(null); s.toast(t("t_saved")); }} style={{ alignSelf: "flex-start" }} /> : null}
      </Card>

      {ask ? <Banner color={c.crit}><Col gap={8}><T v="small">{tf("sk_deleteQ", { s: label })}</T><Row gap={8}>
        <Btn small label={t("no")} onPress={() => setAsk(false)} />
        <Btn small kind="danger" testID="sk-delete-yes" label={t("sk_delete")} onPress={() => { if (P.plan) s.deleteSquadPlan(P.plan.id); setAsk(false); }} />
      </Row></Col></Banner> : <Btn kind="ghost" testID="sk-delete" label={t("sk_delete")} onPress={() => setAsk(true)} style={{ alignSelf: "flex-start" }} />}

      <PlayerPlanSheet p={edit} season={season} onClose={() => setEdit(null)} />
    </Col>
  );
}

/** Stand eines eigenen Spielers für die Saison, Notiz und Positionen im Schattenkader */
function PlayerPlanSheet({ p, season, onClose }: { p: Player | null; season: number; onClose: () => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const P = usePlanData(season); const { content, D, fmt } = P;
  const [note, setNote] = useState("");
  useEffect(() => { setNote((p && content?.status[p.id]?.note) || ""); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p || !content) return null;
  const st = playerState(p, content, D.team.cls, season), ref = refOf("p", p.id), w = slotsWith(content, ref);
  const cur = content.status[p.id]?.s ?? null;
  const setStatus = (v: PlanStatus | null) => {
    let c2 = setPlayerStatus(content, p.id, v, note.trim());
    // Abgang: aus dem Schattenkader nehmen
    if (v === "leave") c2 = removeRef(c2, ref);
    P.save(c2);
  };
  const slots = [...planSlots(fmt, content.formation)].sort((a, b) => Math.min(posMatch([p.pos], a.pos), 3) - Math.min(posMatch([p.pos], b.pos), 3));
  return (
    <Sheet visible={!!p} onClose={onClose} title={`${p.vn} ${p.nn}`.trim()} testID="sk-player-sheet" closeLabel={t("cancel")}>
      <Col gap={12}>
        <Muted small>{[posShort(t, p.pos), yearOf(p) ? String(yearOf(p)) : ""].filter(Boolean).join(" · ")}</Muted>
        <T v="small" bold color={c.muted}>{tf("sk_status", { s: seasonLabel(season) })}</T>
        {st === "ageout" ? <Banner color={c.crit} testID="sk-ps-ageout"><T v="small">{t("sk_ageoutOne")}</T></Banner> : <>
          <Chips testID="sk-ps-status" value={[cur ?? "open"]} onChange={v => setStatus(v[0] && v[0] !== "open" ? v[0] as PlanStatus : null)} colorOf={k => stateCol(c, k as RefState)}
            options={(["open", ...PLAN_STATUS] as string[]).map(k => ({ key: k, label: t("sks_" + k) }))} />
          <Muted small>{t("skd_" + (cur ?? "open"))}</Muted>
        </>}
        {cur ? <Field testID="sk-ps-note" label={t("sk_note")} value={note} onChangeText={setNote} placeholder={t("sk_notePh")} maxLength={200}
          onBlur={() => { if (note.trim() !== (content.status[p.id]?.note || "")) P.save(setPlayerStatus(content, p.id, cur, note.trim())); }} /> : null}
        {!isOut(st) ? <Col gap={6}>
          <T v="small" bold color={c.muted}>{t("sk_positions")}</T>
          {w.length ? <Row wrap gap={6}>{w.map(x => (
            <Pressable key={x.key + x.kind} testID={"sk-ps-pos-" + x.key} accessibilityRole="button" accessibilityLabel={t("sk_remove")}
              onPress={() => P.save({ ...content, slots: { ...content.slots, [x.key]: { ...content.slots[x.key], own: content.slots[x.key].own.filter(y => y !== ref), shadow: content.slots[x.key].shadow.filter(y => y !== ref) } } })}
              style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, backgroundColor: withAlpha(c.event, 0.15) }}>
              <Text style={{ fontWeight: "800", color: c.event }}>{slotShort(t, x.key)} · {x.rank}.</Text><Text style={{ color: c.event, fontWeight: "900" }}>×</Text>
            </Pressable>
          ))}</Row> : <Muted small>{t("sk_notPlanned")}</Muted>}
          <T v="small" bold color={c.muted}>{t("sk_assign")}</T>
          <Row wrap gap={6}>{slots.filter(sl => !w.some(x => x.key === sl.key)).map(sl => (
            <Pressable key={sl.key} testID={"sk-ps-add-" + sl.key} accessibilityRole="button" onPress={() => P.save(addRef(content, sl.key, "own", ref))}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.m, borderWidth: 1.5, borderColor: posMatch([p.pos], sl.pos) <= 2 ? c.accent : c.line }}>
              <Text style={{ fontWeight: "800", color: posMatch([p.pos], sl.pos) <= 2 ? c.accentTx : c.ink }}>{slotShort(t, sl.key)}</Text>
            </Pressable>
          ))}</Row>
        </Col> : null}
        <Btn kind="primary" testID="sk-ps-done" label={t("done")} onPress={() => { if (cur && note.trim() !== (content.status[p.id]?.note || "")) P.save(setPlayerStatus(content, p.id, cur, note.trim())); onClose(); }} />
      </Col>
    </Sheet>
  );
}
