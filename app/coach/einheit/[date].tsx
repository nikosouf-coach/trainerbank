// Trainer – Einheit: Anwesenheit per Tipp, RPE nachtragen (auch Sprünge der Torhüter) und Trainingseindruck –
// für das Mannschaftstraining und jede weitere Einheit des Tages (Athletik, Torwarttraining …).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { AttStatus, DayUnit } from "../../../src/core/types";
import { TW_DIVES_MD1 } from "../../../src/core/units";
import { useEngine, useStore } from "../../../src/data/store";
import { Banner, Btn, Card, CardTitle, Chip, Col, Header, Info, Muted, NumField, NumScale, Row, Screen, Seg, Sheet, T } from "../../../src/ui/kit";
import { MarkButton, MarkSheet, type MarkTarget } from "../../../src/ui/marks";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { UnitLine } from "../../../src/ui/units";
import { radius, rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

const NEXT: Record<string, AttStatus | null> = { da: "ent", ent: "unent", unent: null, offen: "da" };

export default function Einheit() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { date = "", slot: slotP } = useLocalSearchParams<{ date: string; slot?: string }>();
  const [rpeFor, setRpeFor] = useState<string | null>(null);
  const [mark, setMark] = useState<MarkTarget | null>(null);
  const [slotSel, setSlotSel] = useState<number | null>(slotP ? Number(slotP) || 0 : null);
  const sess = E.D.sessions.find(x => x.date === date);
  const units = /^\d{4}-\d{2}-\d{2}$/.test(date) ? E.unitsOn(date) : [];
  const slots = [...(sess ? [0] : []), ...units.map(u => u.slot)];
  const slot = slotSel != null && slots.includes(slotSel) ? slotSel : slots[0] ?? 0;
  const unit: DayUnit | null = slot ? units.find(u => u.slot === slot) || null : null;
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/kalender");
  if (!sess && !unit) return <Screen testID="coach-einheit"><Header title={t("nav_kalender")} onBack={back} backLabel={t("nav_kalender")} /><Muted>{t("noSession")}</Muted></Screen>;

  const label = (st: string): string => st.startsWith("abs:") ? t("ab_" + st.slice(4)) : t("at_" + st);
  const col = (st: string): string => st === "da" ? c.ok : st === "ent" ? c.warn : st === "unent" ? c.crit : st === "abs:verletzung" || st === "abs:krank" ? c.inj : st.startsWith("abs:") ? c.low : c.muted;
  const showI = E.lvl(1) && E.grp !== "u11";
  const canMark = (E.mods.spielanalyse || E.mods.beteiligung) && s.can("notes");
  const isTraining = unit ? true : sess!.typ === "Training";
  const dauer = unit ? unit.dauer : sess!.dauer, ziel = unit ? E.unitRpe(unit) : sess!.ziel;
  const title = unit ? E.unitTitle(unit) : sess!.typ === "Spiel" ? `${t("it_match")} ${t("vs")} ${E.matchOn(date)?.gegner || ""}` : E.kn(sess!.kind || "intensiv");
  const players = unit ? E.unitMembers(unit).filter(p => !E.absenceOn(p.id, date)) : E.D.players;
  const cnt: Record<string, number> = {}; if (!unit) E.D.players.forEach(p => { const k = E.attStatus(date, p.id); cnt[k] = (cnt[k] || 0) + 1; });
  const rp = rpeFor ? E.P(rpeFor) : null, cur = rpeFor ? E.rpeOf(rpeFor, date, slot) : undefined;
  const avg = unit ? E.unitAvg(date, slot) : E.sessAvg(date);
  const entered = players.filter(p => E.rpeOf(p.id, date, slot)).length;
  // „da“ beim Mannschaftstraining gilt; für weitere Einheiten zählt, wer nicht entschuldigt/abwesend ist
  const present = (pid: string): boolean => unit ? !["ent", "unent"].includes(E.attStatus(date, pid)) : E.attStatus(date, pid) === "da";
  const fillTarget = () => {
    let n = 0;
    for (const p of players) if (present(p.id) && !E.rpeOf(p.id, date, slot)) { s.saveRpe(p.id, date, { rpe: ziel, min: dauer }, slot); n++; }
    s.toast(tf("un_filled", { n }));
  };

  return (
    <Screen testID="coach-einheit">
      <Header onBack={back} backLabel={t("nav_kalender")} eyebrow={`${E.wt(date)} ${E.de(date)}${sess?.md ? " · " + sess.md : ""}${unit ? " · " + unit.zeit : ""} · ${dauer} ${t("min")}${showI ? ` · ${t("target")} ${ziel}` : ""}`} title={title} />
      {slots.length > 1 ? <Seg testID="ein-slot" wrap value={String(slot)} onChange={k => setSlotSel(Number(k))}
        options={slots.map(k => ({ key: String(k), label: k ? `${units.find(u => u.slot === k)!.zeit} ${E.unitTitle(units.find(u => u.slot === k)!)}` : sess!.typ === "Spiel" ? t("it_match") : t("un_main") }))} /> : null}
      <Row wrap gap={6}>
        {Object.entries(cnt).map(([k, v]) => <Chip key={k} label={`${label(k)} ${v}`} color={col(k)} />)}
        {E.mods.belastung ? <Chip label={tf("un_entered", { a: entered, n: players.length })} color={c.muted} /> : null}
        {showI && avg != null ? <Chip label={`Ø RPE ${E.num(avg, 1)}`} color={rpeColor(c, Math.round(avg))} /> : null}
      </Row>
      {unit ? <Card testID="ein-unit"><UnitLine u={unit} date={date} />{unit.inhalt ? <T v="small">{unit.inhalt}</T> : null}</Card> : null}
      <Card>
        <CardTitle title={unit ? t("un_participants") : t("presence")} info={<Info title={unit ? E.unitTitle(unit) : t("presence")} text={unit ? t("un_allTargetD") : t("tapHint")} />} />
        <Row gap={8} wrap>
          {!unit ? <Btn small testID="att-all" label={t("allPresent")} onPress={() => E.D.players.forEach(p => { if (E.attStatus(date, p.id) === "offen") s.setAttendance(date, p.id, "da"); })} /> : null}
          {E.mods.belastung && s.can("health") && date <= E.TODAY && (unit || isTraining) ? <Btn small testID="fill-target" label={t("un_allTarget")} onPress={fillTarget} /> : null}
        </Row>
        {!players.length ? <Muted>{t("un_noMembers")}</Muted> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {players.map(p => {
            const st = E.attStatus(date, p.id), cl = unit ? c.line : col(st), r = E.rpeOf(p.id, date, slot), gk = E.isGK(p), ok = unit ? present(p.id) : st === "da";
            return (
              <View key={p.id} style={{ flexGrow: 1, flexBasis: 240, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: withAlpha(cl, 0.5), backgroundColor: unit ? c.surface : withAlpha(cl, 0.07), borderRadius: radius.m, padding: 8 }}>
                <Pressable testID={"att-" + p.id} accessibilityRole="button" accessibilityLabel={`${E.name(p)}: ${label(st)}`} disabled={!!unit}
                  onPress={() => s.setAttendance(date, p.id, st.startsWith("abs:") ? "da" : NEXT[st] ?? null)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <PlayerAvatar p={p} size={36} />
                  <Col gap={1} style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 14, color: c.ink }}>{E.name(p)}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: unit ? (ok ? c.muted : col(st)) : cl }}>
                      {unit ? (ok ? (gk ? t("tw_title") : p.pos || "") : label(st)) : label(st)}{r?.dives != null ? " · " + tf("tw_divesN", { n: r.dives }) : ""}
                    </Text>
                  </Col>
                </Pressable>
                {gk && E.twDivesWarn(p.id, date) ? <Text accessibilityLabel={t("tw_divesWarn")} style={{ color: c.warn, fontWeight: "900" }}>⚠</Text> : null}
                {canMark && ok && isTraining ? <MarkButton testID={"rate-" + p.id} target={{ pid: p.id, date, slot }} onPress={() => setMark({ pid: p.id, date, slot })} /> : null}
                {E.mods.belastung && ok ? <Pressable testID={"rpe-" + p.id} accessibilityRole="button" accessibilityLabel={`RPE ${E.name(p)}`} onPress={() => setRpeFor(p.id)}
                  style={{ minWidth: 52, height: 36, borderRadius: radius.s, borderWidth: 1, borderColor: r ? rpeColor(c, r.rpe) : c.line, backgroundColor: r ? rpeColor(c, r.rpe) : c.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ fontWeight: "800", fontSize: 12.5, color: r ? "#fff" : c.muted }}>{r ? "RPE " + r.rpe : "RPE +"}</Text>
                </Pressable> : null}
              </View>
            );
          })}
        </View>
      </Card>
      <MarkSheet target={mark} onClose={() => setMark(null)} />
      <Sheet visible={!!rp} onClose={() => setRpeFor(null)} title={rp ? `RPE · ${E.name(rp)}` : ""} testID="rpe-sheet" closeLabel={t("cancel")}>
        {rp ? <RpeCoachForm key={rp.id + slot} pid={rp.id} date={date} slot={slot} dauer={dauer} gk={E.isGK(rp)} onDone={() => setRpeFor(null)} hasEntry={!!cur} /> : null}
      </Sheet>
    </Screen>
  );
}

/** RPE (und bei Torhütern die Sprünge) für einen Spieler nachtragen */
function RpeCoachForm({ pid, date, slot, dauer, gk, hasEntry, onDone }: { pid: string; date: string; slot: number; dauer: number; gk: boolean; hasEntry: boolean; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const cur = E.rpeOf(pid, date, slot);
  const [dives, setDives] = useState<number | null>(cur?.dives ?? null);
  const save = (n: number) => { s.saveRpe(pid, date, { rpe: n, min: cur?.min ?? dauer, dives: gk ? dives : null }, slot); onDone(); s.toast(t("t_saved")); };
  return (
    <Col gap={12}>
      <Muted>{t("rpe_coachQ")}</Muted>
      {gk ? <Col gap={4}>
        <NumField testID="rpe-dives" label={t("pe_dives")} value={dives} min={0} max={300} onChange={setDives} style={{ width: 200 }} />
        <Muted small>{t("pe_divesD")}</Muted>
        {E.mdOf(date).md === "MD-1" && (dives || 0) > TW_DIVES_MD1 ? <Banner color={c.warn}>{tf("tw_divesWarnD", { n: TW_DIVES_MD1 })}</Banner> : null}
      </Col> : null}
      <NumScale testID="rpe-scale" value={cur?.rpe ?? null} min={1} max={10} color={n => rpeColor(c, n)} onChange={save} />
      {gk && cur ? <Btn small testID="rpe-dives-save" label={t("save")} onPress={() => save(cur.rpe)} style={{ alignSelf: "flex-start" }} /> : null}
      {hasEntry ? <Btn small label={t("del")} onPress={() => { s.saveRpe(pid, date, null, slot); onDone(); }} style={{ alignSelf: "flex-start" }} /> : null}
    </Col>
  );
}
