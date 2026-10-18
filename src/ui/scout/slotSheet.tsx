// Position im Schattenkader bearbeiten: Soll, Anforderungsprofil, eingeplanter Kader (Reihenfolge) und
// Schattenkandidaten (Rang) – Auswahl aus eigenen Spielern, Aufrückern, Zugängen und dem Scouting.
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  addRef, candidatesFor, isOut, moveRef, planSlots, playerState, posMatch, refOf, removeRef, riserSnap, setSlot, slotDepth, slotsWith, yearOf, type RefInfo,
} from "../../core/scout";
import type { Riser, SpContent } from "../../core/types";
import { useStore } from "../../data/store";
import { Icon } from "../icons";
import { Btn, Col, Field, Muted, Row, Sheet, T, ToggleRow } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";
import { GradeBadge, levelCol, posShort, PrioBadge, SectionHead, slotShort, stateCol, StateTag, statusCol, usePlanData } from "./common";

function IconBtn({ icon, onPress, label, testID, disabled }: { icon: "up" | "down" | "close"; onPress: () => void; label: string; testID?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4}
      style={{ width: 32, height: 32, borderRadius: radius.s, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} size={16} color={icon === "close" ? c.crit : c.ink} />
    </Pressable>
  );
}

/** Zeile eines Eintrags (Kader oder Schatten) mit Rang, Stand und Reihenfolge */
function RefRow({ i, n, onUp, onDown, onRemove, onOpen, testID }: { i: RefInfo; n: number; onUp: () => void; onDown: () => void; onRemove: () => void; onOpen?: () => void; testID: string }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const sub = [posShort(t, i.pos), i.year ? String(i.year) : "", i.team || ""].filter(Boolean).join(" · ");
  const body = (
    <Col gap={3} style={{ flex: 1 }}>
      <Row gap={6}>
        <Text style={{ fontWeight: "900", color: c.muted, fontSize: 12, width: 18, fontVariant: ["tabular-nums"] }}>{n}.</Text>
        <T bold numberOfLines={1} style={{ flex: 1 }}>{i.name}</T>
        {i.prio ? <PrioBadge p={i.prio} size={18} /> : null}
        {i.k === "s" ? <GradeBadge g={i.grade ?? null} /> : null}
      </Row>
      <Row gap={6} wrap style={{ paddingLeft: 24 }}>
        <StateTag label={i.k === "s" && i.status ? t("scs_" + i.status) : t("sks_" + i.state)} color={i.k === "s" && i.status ? statusCol(c, i.status) : stateCol(c, i.state)} />
        {sub ? <Muted small>{sub}</Muted> : null}
      </Row>
    </Col>
  );
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
      {onOpen ? <Pressable accessibilityRole="button" onPress={onOpen} style={{ flex: 1 }}>{body}</Pressable> : body}
      <IconBtn icon="up" label={t("sk_up")} onPress={onUp} testID={testID + "-up"} />
      <IconBtn icon="down" label={t("sk_down")} onPress={onDown} testID={testID + "-down"} />
      <IconBtn icon="close" label={t("sk_remove")} onPress={onRemove} testID={testID + "-x"} />
    </View>
  );
}

/** Eintrag in der Auswahl */
function PickRow({ title, sub, right, onPress, testID }: { title: string; sub: string; right?: React.ReactNode; onPress: () => void; testID: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.m, backgroundColor: c.sunk }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={15} color={c.accentInk} /></View>
      <Col gap={1} style={{ flex: 1 }}><T bold numberOfLines={1}>{title}</T><Muted small>{sub}</Muted></Col>
      {right}
    </Pressable>
  );
}

export function SlotSheet({ season, slotKey, onClose, onNewCandidate, onOpenScout }: {
  season: number; slotKey: string | null; onClose: () => void; onNewCandidate: (pos: string, slotKey: string) => void; onOpenScout: (id: string) => void;
}) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const P = usePlanData(season); const { content, info, stats, D, risers } = P;
  const [pick, setPick] = useState<null | "own" | "shadow">(null); const [all, setAll] = useState(false);
  const [need, setNeed] = useState("");
  useEffect(() => { setPick(null); setAll(false); setNeed((slotKey && content?.slots[slotKey]?.need) || ""); }, [slotKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!content || !slotKey || !content.slots[slotKey]) return null;
  const sl = planSlots(P.fmt, content.formation).find(x => x.key === slotKey); if (!sl) return null;
  const st = content.slots[slotKey], d = slotDepth(st, info), lc = levelCol(c, d.level);
  const save = (c2: SpContent) => { P.save(c2); };
  const add = (kind: "own" | "shadow", ref: string, r?: Riser) => {
    let c2 = addRef(content, slotKey, kind, ref);
    if (r) c2 = { ...c2, ext: { ...(c2.ext || {}), [ref]: riserSnap(r) } };
    save(c2);
  };
  const inSlot = new Set([...st.own, ...st.shadow]);
  const elsewhere = (ref: string): string => { const w = slotsWith(content, ref).filter(x => x.key !== slotKey).map(x => slotShort(t, x.key)); return w.length ? tf("sk_planned", { p: w.join(", ") }) : ""; };
  const byMatch = <X,>(L: X[], pos: (x: X) => string[]) => [...L].sort((a, b) => Math.min(posMatch(pos(a), sl.pos), 3) - Math.min(posMatch(pos(b), sl.pos), 3));
  const ownOpts = byMatch(D.players.filter(p => !isOut(playerState(p, content, D.team.cls, season)) && !inSlot.has(refOf("p", p.id))), p => [p.pos]);
  const riserOpts = byMatch(risers.filter(r => !inSlot.has(refOf("r", r.id))), r => [r.pos]);
  const riserShadow = riserOpts.filter(r => all || posMatch([r.pos], sl.pos) <= 3);
  const riserSub = (r: Riser) => [posShort(t, r.pos), String(r.year), r.team, elsewhere(refOf("r", r.id))].filter(Boolean).join(" · ");
  const signedOpts = D.scouts.filter(x => x.status === "signed" && !inSlot.has(refOf("s", x.id)));
  const candOpts = candidatesFor(sl.pos, D.scouts, stats, all).filter(x => x.status !== "signed" && !inSlot.has(refOf("s", x.id)));
  const list = (kind: "own" | "shadow") => {
    const L = st[kind].map(info).filter((x): x is RefInfo => !!x);
    if (!L.length) return <Muted small>{kind === "own" ? t("sk_none") : t("sk_noneShadow")}</Muted>;
    return <View>{L.map((x, n) => (
      <RefRow key={x.ref} i={x} n={n + 1} testID={`sk-${kind}-${n}`}
        onUp={() => save(moveRef(content, slotKey, kind, x.ref, -1))} onDown={() => save(moveRef(content, slotKey, kind, x.ref, 1))}
        onRemove={() => { const c2 = { ...content, slots: { ...content.slots, [slotKey]: { ...st, [kind]: st[kind].filter(y => y !== x.ref) } } }; save(slotsWith(c2, x.ref).length ? c2 : removeRef(c2, x.ref)); }}
        onOpen={x.k === "s" ? () => onOpenScout(x.id) : undefined} />
    ))}</View>;
  };
  const scoutSub = (x: (typeof D.scouts)[number]) => [x.pos.map(p => posShort(t, p)).join("/"), yearOf(x) ? String(yearOf(x)) : "", x.club, t("scs_" + x.status), elsewhere(refOf("s", x.id))].filter(Boolean).join(" · ");
  return (
    <Sheet visible={!!slotKey} onClose={onClose} testID="sk-slot-sheet" closeLabel={t("cancel")}
      title={`${t("pos_" + sl.pos)}${sl.side ? " · " + t("sk_side_" + sl.side) : ""}`}>
      <Col gap={14}>
        <Row gap={10} wrap>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: withAlpha(lc, 0.15) }}>
            <Text testID="sk-slot-level" style={{ color: lc, fontWeight: "800" }}>{t("sk_lvl_" + d.level)} · {d.maybe ? tf("sk_depthMaybe", { f: d.firm, t: st.target, m: d.maybe }) : tf("sk_depth", { f: d.firm, t: st.target })}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Muted small>{t("sk_target")}</Muted>
          <Btn small testID="sk-target-minus" label="−" disabled={st.target <= 1} onPress={() => save(setSlot(content, slotKey, { target: st.target - 1 }))} />
          <Text testID="sk-target" style={{ fontWeight: "900", fontSize: 16, color: c.ink, minWidth: 16, textAlign: "center" }}>{st.target}</Text>
          <Btn small testID="sk-target-plus" label="+" disabled={st.target >= 5} onPress={() => save(setSlot(content, slotKey, { target: st.target + 1 }))} />
        </Row>
        <Field testID="sk-need" label={t("sk_need")} value={need} onChangeText={setNeed} placeholder={t("sk_needPh")} maxLength={120} multiline
          onBlur={() => { if (need.trim() !== st.need) save(setSlot(content, slotKey, { need: need.trim() })); }} />

        <Col gap={4}>
          <SectionHead title={tf("sk_squad", { s: `${season}/${String((season + 1) % 100).padStart(2, "0")}` })} n={st.own.length}
            right={<Btn small kind={pick === "own" ? "primary" : "default"} testID="sk-add-own" icon="plus" label={t("sk_addPlayer")} onPress={() => setPick(pick === "own" ? null : "own")} />} />
          {list("own")}
          {pick === "own" ? <Col gap={6} testID="sk-pick-own" style={{ marginTop: 6 }}>
            <T v="small" bold>{t("sk_pickOwn")}</T>
            {ownOpts.length ? ownOpts.map(p => (
              <PickRow key={p.id} testID={"sk-pick-p-" + p.id} title={`${p.vn} ${p.nn}`.trim()} onPress={() => add("own", refOf("p", p.id))}
                sub={[posShort(t, p.pos), yearOf(p) ? String(yearOf(p)) : "", t("sks_" + playerState(p, content, D.team.cls, season)), elsewhere(refOf("p", p.id))].filter(Boolean).join(" · ")} />
            )) : <Muted small>{t("sk_pickEmpty")}</Muted>}
            {riserOpts.length ? <><T v="small" bold>{t("sk_pickRisers")}</T>{riserOpts.map(r => (
              <PickRow key={r.id} testID={"sk-pick-r-" + r.id} title={`${r.vn} ${r.nn}`.trim()} sub={riserSub(r)} onPress={() => add("own", refOf("r", r.id), r)} />
            ))}</> : null}
            {signedOpts.length ? <><T v="small" bold>{t("sk_pickSigned")}</T>{signedOpts.map(x => (
              <PickRow key={x.id} testID={"sk-pick-s-" + x.id} title={`${x.vn} ${x.nn}`.trim()} sub={scoutSub(x)} onPress={() => add("own", refOf("s", x.id))} />
            ))}</> : null}
          </Col> : null}
        </Col>

        <Col gap={4}>
          <SectionHead title={t("sk_shadow")} n={st.shadow.length}
            right={<Btn small kind={pick === "shadow" ? "primary" : "default"} testID="sk-add-shadow" icon="plus" label={t("sk_addCand")} onPress={() => setPick(pick === "shadow" ? null : "shadow")} />} />
          {list("shadow")}
          {pick === "shadow" ? <Col gap={6} testID="sk-pick-shadow" style={{ marginTop: 6 }}>
            <Row between wrap gap={8}>
              <T v="small" bold>{t("sk_pickCands")}</T>
              <Btn small kind="ghost" testID="sk-new-cand" icon="plus" label={t("sk_newCand")} onPress={() => onNewCandidate(sl.pos, slotKey)} />
            </Row>
            <ToggleRow testID="sk-allpos" label={t("sk_allPos")} value={all} onChange={setAll} />
            {candOpts.length ? candOpts.slice(0, 30).map(x => (
              <PickRow key={x.id} testID={"sk-pick-c-" + x.id} title={`${x.vn} ${x.nn}`.trim()} sub={scoutSub(x)} onPress={() => add("shadow", refOf("s", x.id))}
                right={<Row gap={6}>{x.prio ? <PrioBadge p={x.prio} size={18} /> : null}<GradeBadge g={stats.get(x.id)?.grade ?? null} /></Row>} />
            )) : <Muted small>{t("sk_pickEmpty")}</Muted>}
            {riserShadow.length ? <><T v="small" bold>{t("sk_pickRisers")}</T>{riserShadow.slice(0, 20).map(r => (
              <PickRow key={r.id} testID={"sk-pick-rs-" + r.id} title={`${r.vn} ${r.nn}`.trim()} sub={riserSub(r)} onPress={() => add("shadow", refOf("r", r.id), r)} />
            ))}</> : null}
          </Col> : null}
        </Col>
      </Col>
    </Sheet>
  );
}
