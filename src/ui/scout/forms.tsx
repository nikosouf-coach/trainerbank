// Scouting: Kandidat anlegen/bearbeiten, Bericht schreiben, Merklisten verwalten, in den Schattenkader setzen.
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { classDef } from "../../core/classes";
import { COMPETENCIES, type PosGroup } from "../../core/dev";
import { iso } from "../../core/dates";
import {
  addRef, areaFromDetails, CLOSED, FEET, newReport, PIPELINE, planSlots, posMatch, PRIOS, refOf, REPORT_KINDS, SCOUT_AREAS, SCOUT_LIMITS, SCOUT_POS, seasonLabel, slotsWith, VERDICTS,
} from "../../core/scout";
import type { ScoutList, ScoutPlayer, ScoutReport } from "../../core/types";
import { useEngine, useStore, tmpId } from "../../data/store";
import { Banner, Btn, Col, DateField, Field, Muted, NumField, Row, Sheet, T, ToggleRow } from "../kit";
import { radius, useTheme } from "../theme";
import { Dots, posShort, Scale5, SeasonSeg, slotShort, statusCol, usePlanData } from "./common";

/** Auswahl-Chips (einfach, erneut antippen löscht; mehrfach mit Reihenfolge) */
export function Chips<K extends string>({ options, value, onChange, testID, multi, max, colorOf }: {
  options: { key: K; label: string }[]; value: K[]; onChange: (v: K[]) => void; testID?: string; multi?: boolean; max?: number; colorOf?: (k: K) => string;
}) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => {
        const i = value.indexOf(o.key), on = i >= 0, col = colorOf ? colorOf(o.key) : c.accent;
        return (
          <Pressable key={o.key} testID={testID ? testID + "-" + o.key : undefined} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={{ checked: on }} accessibilityLabel={o.label}
            onPress={() => onChange(on ? value.filter(x => x !== o.key) : multi ? (max && value.length >= max ? value : [...value, o.key]) : [o.key])}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? col : c.surface, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 11 }}>
            {multi && on && (max ?? 2) > 1 ? <Text style={{ fontWeight: "900", fontSize: 11, color: "#fff" }}>{i + 1}</Text> : null}
            <Text style={{ fontWeight: "700", fontSize: 13.5, color: on ? "#fff" : c.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kandidat anlegen bzw. bearbeiten */
export function ScoutForm({ value, onClose, onSaved }: { value: ScoutPlayer | null; onClose: () => void; onSaved?: (x: ScoutPlayer) => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [x, setX] = useState<ScoutPlayer | null>(value);
  const [tags, setTags] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { setX(value); setTags((value?.tags || []).join(", ")); }, [value]);
  if (!x) return null;
  const set = (p: Partial<ScoutPlayer>) => setX({ ...x, ...p });
  const isNew = x.id.startsWith("tmp-");
  const save = async () => {
    setBusy(true);
    try {
      const saved = await s.saveScout({ ...x, tags: tags.split(",").map(v => v.trim()).filter(Boolean) });
      if (saved) { s.toast(t("t_saved")); onSaved?.(saved); onClose(); }
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!value} onClose={onClose} title={isNew ? t("sc_newT") : t("sc_editT")} testID="sc-form" closeLabel={t("cancel")}>
      <Col gap={12}>
        <Row gap={10} wrap>
          <Field testID="sc-f-vn" label={t("sc_first") + " *"} value={x.vn} onChangeText={v => set({ vn: v })} maxLength={60} style={{ flex: 1, minWidth: 140 }} autoCapitalize="words" />
          <Field testID="sc-f-nn" label={t("sc_last")} value={x.nn} onChangeText={v => set({ nn: v })} maxLength={60} style={{ flex: 1, minWidth: 140 }} autoCapitalize="words" />
        </Row>
        <Row gap={10} wrap>
          <NumField testID="sc-f-year" label={t("sc_year")} value={x.geb ? Number(x.geb.slice(0, 4)) : x.year} min={1950} max={2035} onChange={v => set({ year: v != null ? Math.round(v) : null, geb: null })} style={{ width: 120 }} />
          <DateField testID="sc-f-geb" label={t("sc_geb")} value={x.geb} lang={s.lang} onChange={v => set({ geb: v, year: v ? Number(v.slice(0, 4)) : x.year })} style={{ flex: 1, minWidth: 160 }} />
        </Row>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_pos")}</T>
          <Chips testID="sc-f-pos" multi max={3} value={x.pos} onChange={v => set({ pos: v })} options={SCOUT_POS.map(p => ({ key: p, label: posShort(t, p) }))} /></Col>
        <Row gap={10} wrap style={{ alignItems: "flex-end" }}>
          <Col gap={6} style={{ flex: 1, minWidth: 200 }}><T v="small" bold color={c.muted}>{t("sc_foot")}</T>
            <Chips testID="sc-f-foot" value={x.foot ? [x.foot] : []} onChange={v => set({ foot: v[0] || null })} options={FEET.map(f => ({ key: f, label: t("scf_" + f) }))} /></Col>
          <NumField testID="sc-f-cm" label={t("sc_height")} value={x.cm} min={100} max={230} onChange={v => set({ cm: v != null ? Math.round(v) : null })} style={{ width: 120 }} />
        </Row>
        <Row gap={10} wrap>
          <Field testID="sc-f-club" label={t("sc_club")} value={x.club} onChangeText={v => set({ club: v })} maxLength={80} style={{ flex: 1, minWidth: 160 }} />
          <Field testID="sc-f-team" label={t("sc_clubTeam")} value={x.clubTeam} onChangeText={v => set({ clubTeam: v })} maxLength={80} style={{ flex: 1, minWidth: 160 }} />
        </Row>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_status")}</T>
          <Chips testID="sc-f-status" value={[x.status]} onChange={v => v[0] && set({ status: v[0] })} colorOf={k => statusCol(c, k)} options={[...PIPELINE, ...CLOSED].map(k => ({ key: k, label: t("scs_" + k) }))} /></Col>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_prio")}</T>
          <Chips testID="sc-f-prio" value={x.prio ? [x.prio] : []} onChange={v => set({ prio: v[0] || null })} options={PRIOS.map(p => ({ key: p, label: t("scp_" + p) }))} /></Col>
        <Row gap={18} wrap>
          <Col gap={4}><T v="small" bold color={c.muted}>{t("sc_level")}</T><Dots testID="sc-f-level" value={x.level} onChange={v => set({ level: v })} size={16} label={t("sc_level")} />
            <Muted small>{x.level ? t("scl_" + x.level) : "–"}</Muted></Col>
          <Col gap={4}><T v="small" bold color={c.muted}>{t("sc_potential")}</T><Dots testID="sc-f-pot" value={x.potential} onChange={v => set({ potential: v })} size={16} color={c.event} label={t("sc_potential")} />
            <Muted small>{x.potential ? t("scl_" + x.potential) : "–"}</Muted></Col>
        </Row>
        <Muted small>{t("sc_levelHint")}</Muted>
        <Field testID="sc-f-tags" label={t("sc_tags")} value={tags} onChangeText={setTags} placeholder={t("sc_tagsPh")} maxLength={300} />
        {E.D.scoutLists.length ? <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_lists")}</T>
          <Chips testID="sc-f-lists" multi max={20} value={x.lists} onChange={v => set({ lists: v })} options={E.D.scoutLists.map(l => ({ key: l.id, label: l.name }))} /></Col> : null}
        <Field testID="sc-f-source" label={t("sc_source")} value={x.source} onChangeText={v => set({ source: v })} placeholder={t("sc_sourcePh")} maxLength={80} />
        <Field testID="sc-f-contact" label={t("sc_contact")} value={x.contact} onChangeText={v => set({ contact: v })} maxLength={200} hint={t("sc_contactHint")} />
        <Field testID="sc-f-video" label={t("sc_video")} value={x.video || ""} onChangeText={v => set({ video: v || null })} placeholder="https://" autoCapitalize="none" maxLength={500} />
        <Field testID="sc-f-note" label={t("sc_note")} value={x.note} onChangeText={v => set({ note: v })} multiline maxLength={2000} />
        <Banner color={c.warn}><T v="small">{t("sc_noHealth")}</T></Banner>
        <Btn kind="primary" testID="sc-f-save" label={t("save")} disabled={busy || !x.vn.trim()} onPress={save} />
      </Col>
    </Sheet>
  );
}

/** Positionsgruppe für die Kompetenzen eines Berichts */
const pgOf = (pos: string | null, kids: boolean): PosGroup => kids ? "kid" : pos === "TW" ? "tw" : pos === "IV" ? "iv" : pos === "LV" || pos === "RV" ? "av"
  : pos === "LM" || pos === "RM" || pos === "LA" || pos === "RA" ? "fl" : pos === "ST" ? "st" : "zm";

/** Scouting-Bericht schreiben bzw. ändern */
export function ReportSheet({ scout, value, onClose }: { scout: ScoutPlayer | null; value: ScoutReport | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [r, setR] = useState<ScoutReport | null>(value); const [details, setDetails] = useState(false); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  useEffect(() => { setR(value); setAsk(false); setDetails(!!value && Object.keys(value.scores).some(k => !SCOUT_AREAS.includes(k as never))); }, [value]);
  if (!r || !scout) return null;
  const set = (p: Partial<ScoutReport>) => setR({ ...r, ...p });
  const kids = classDef(E.team.cls).grp === "u11", pg = pgOf(r.pos || scout.pos[0] || null, kids);
  const setScore = (k: string, v: number | null) => {
    const scores = { ...r.scores }; if (v == null) delete scores[k]; else scores[k] = v;
    // Bereich aus den Details (wenn bewertet)
    for (const a of SCOUT_AREAS) { const keys = COMPETENCIES[pg][a]; if (keys.includes(k)) { const av = areaFromDetails(scores, keys); if (av != null) scores[a] = av; } }
    setR({ ...r, scores });
  };
  const isNew = r.id.startsWith("tmp-");
  const save = async () => { setBusy(true); try { if (await s.saveScoutReport({ ...r, sid: scout.id })) onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible={!!value} onClose={onClose} title={`${t("sc_repT")} · ${scout.vn} ${scout.nn}`.trim()} testID="sc-rep-sheet" closeLabel={t("cancel")}>
      <Col gap={12}>
        <Row gap={10} wrap>
          <DateField testID="sc-r-date" label={t("sc_repDate")} value={r.date} lang={s.lang} onChange={v => v && set({ date: v })} style={{ width: 150 }} />
          <NumField testID="sc-r-min" label={t("sc_minutes")} value={r.min} min={0} max={300} onChange={v => set({ min: v != null ? Math.round(v) : null })} style={{ width: 150 }} />
        </Row>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_repKind")}</T>
          <Chips testID="sc-r-kind" value={[r.kind]} onChange={v => v[0] && set({ kind: v[0] })} options={REPORT_KINDS.map(k => ({ key: k, label: t("sck_" + k) }))} /></Col>
        <Field testID="sc-r-event" label={t("sc_event")} value={r.event} onChangeText={v => set({ event: v })} placeholder={t("sc_eventPh")} maxLength={120} />
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_repPos")}</T>
          <Chips testID="sc-r-pos" value={r.pos ? [r.pos] : []} onChange={v => set({ pos: v[0] || null })}
            options={[...scout.pos, ...SCOUT_POS.filter(p => !scout.pos.includes(p))].map(p => ({ key: p, label: posShort(t, p) }))} /></Col>
        <Col gap={8}>
          <T v="small" bold color={c.muted}>{t("sc_areas")}</T>
          {SCOUT_AREAS.map(a => (
            <View key={a} style={{ gap: 6 }}>
              <Row gap={10} wrap><Text style={{ width: 118, fontWeight: "700", color: c.ink }} numberOfLines={1}>{t("da_" + a)}</Text><Scale5 compact testID={"sc-r-" + a} value={r.scores[a] ?? null} onChange={v => setScore(a, v)} /></Row>
              {details ? <Col gap={6} style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: c.line }}>
                {COMPETENCIES[pg][a].map(k => (
                  <Row key={k} gap={10} wrap><Text style={{ width: 150, fontSize: 13, color: c.muted }} numberOfLines={2}>{t("cp_" + k)}</Text>
                    <Scale5 compact testID={"sc-r-c-" + k} value={r.scores[k] ?? null} onChange={v => setScore(k, v)} /></Row>
                ))}
              </Col> : null}
            </View>
          ))}
          <ToggleRow testID="sc-r-details" label={t("sc_details")} desc={t("sc_detailsHint")} value={details} onChange={setDetails} />
        </Col>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_grade")}</T>
          <Scale5 testID="sc-r-grade" value={r.grade} onChange={v => set({ grade: v })} labels={[1, 2, 3, 4, 5].map(i => t("scl_" + i))} />
          <Muted small>{r.grade ? t("scl_" + r.grade) : t("sc_levelHint")}</Muted></Col>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("sc_verdict")}</T>
          <Chips testID="sc-r-verdict" value={r.verdict ? [r.verdict] : []} onChange={v => set({ verdict: v[0] || null })}
            colorOf={k => k === "sign" ? c.ok : k === "watch" ? c.warn : c.crit} options={VERDICTS.map(v => ({ key: v, label: t("scv_" + v) }))} /></Col>
        <Field testID="sc-r-strengths" label={t("sc_strengths")} value={r.strengths} onChangeText={v => set({ strengths: v })} multiline maxLength={1000} />
        <Field testID="sc-r-weak" label={t("sc_weaknesses")} value={r.weaknesses} onChangeText={v => set({ weaknesses: v })} multiline maxLength={1000} />
        <Field testID="sc-r-summary" label={t("sc_summary")} value={r.summary} onChangeText={v => set({ summary: v })} multiline maxLength={2000} />
        <Btn kind="primary" testID="sc-r-save" label={t("save")} disabled={busy} onPress={save} />
        {!isNew ? (ask ? <Banner color={c.crit}><Col gap={8}><T v="small">{t("sc_repDeleteQ")}</T><Row gap={8}>
            <Btn small label={t("no")} onPress={() => setAsk(false)} />
            <Btn small kind="danger" testID="sc-r-delete-yes" label={t("sc_repDelete")} onPress={() => { s.deleteScoutReport(r.id); onClose(); }} />
          </Row></Col></Banner>
          : <Btn kind="ghost" testID="sc-r-delete" label={t("sc_repDelete")} onPress={() => setAsk(true)} />) : null}
      </Col>
    </Sheet>
  );
}
export const blankReport = (sc: ScoutPlayer): ScoutReport => newReport(tmpId(), sc.id, iso(new Date()), sc.pos[0] || null);

const LIST_COLORS = ["#c8402a", "#3a6db5", "#22865a", "#c98a0b", "#7b5fd0", "#d9622b", "#0b7285", "#5c677d"];
/** Merklisten verwalten */
export function ListsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [name, setName] = useState(""); const [ask, setAsk] = useState<string | null>(null);
  const L = E.D.scoutLists;
  const add = async () => { const n = name.trim(); if (!n) return; const l: ScoutList = { id: tmpId(), name: n, color: LIST_COLORS[L.length % LIST_COLORS.length], sort: L.length }; if (await s.saveScoutList(l)) setName(""); };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("sc_listsManage")} testID="sc-lists-sheet" closeLabel={t("cancel")}>
      <Col gap={10}>
        {L.length ? L.map(l => (
          <View key={l.id} testID={"sc-list-" + l.id} style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Row gap={10}>
              <Pressable accessibilityRole="button" accessibilityLabel={l.name} onPress={() => s.saveScoutList({ ...l, color: LIST_COLORS[(LIST_COLORS.indexOf(l.color) + 1) % LIST_COLORS.length] })}
                style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: l.color }} />
              <T bold style={{ flex: 1 }}>{l.name}</T>
              <Muted small>{E.D.scouts.filter(x => x.lists.includes(l.id)).length}</Muted>
              <Btn small kind="ghost" testID={"sc-list-del-" + l.id} label={t("sc_listDelete")} onPress={() => setAsk(l.id)} />
            </Row>
            {ask === l.id ? <Row gap={8}><Btn small label={t("no")} onPress={() => setAsk(null)} /><Btn small kind="danger" testID={"sc-list-del-yes-" + l.id} label={t("sc_listDelete")} onPress={() => { s.deleteScoutList(l.id); setAsk(null); }} /></Row> : null}
          </View>
        )) : <Muted>{t("sc_listsNone")}</Muted>}
        {L.length < SCOUT_LIMITS.lists ? <Row gap={8} style={{ alignItems: "flex-end" }}>
          <Field testID="sc-list-name" label={t("sc_listNew")} value={name} onChangeText={setName} placeholder={t("sc_listName")} maxLength={SCOUT_LIMITS.listName} style={{ flex: 1 }} />
          <Btn kind="primary" testID="sc-list-add" icon="plus" label={t("sc_listNew")} disabled={!name.trim()} onPress={add} />
        </Row> : <Muted small>{E.tf("sc_listsMax", { n: SCOUT_LIMITS.lists })}</Muted>}
      </Col>
    </Sheet>
  );
}

/** Kandidat in den Schattenkader einer Saison setzen (Position wählen) */
export function PlanPickSheet({ scout, visible, onClose, season, onSeason }: { scout: ScoutPlayer; visible: boolean; onClose: () => void; season: number; onSeason: (s: number) => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const P = usePlanData(season), ref = refOf("s", scout.id);
  const [own, setOwn] = useState(false);
  useEffect(() => { setOwn(scout.status === "signed"); }, [scout.status, visible]);
  const slots = P.content ? planSlots(P.fmt, P.content.formation) : [];
  const where = P.content ? slotsWith(P.content, ref) : [];
  return (
    <Sheet visible={visible} onClose={onClose} title={t("sc_addToPlan")} testID="sc-plan-sheet" closeLabel={t("cancel")}>
      <Col gap={12}>
        <SeasonSeg value={season} onChange={onSeason} testID="sc-plan-season" />
        {!P.content ? <Muted testID="sc-plan-none">{tf("sc_planNone", { s: seasonLabel(season) })}</Muted> : <>
          {scout.status === "signed" ? <ToggleRow testID="sc-plan-own" label={t("sc_asOwn")} value={own} onChange={setOwn} /> : <Muted small>{t("sc_asShadow")}</Muted>}
          <T v="small" bold color={c.muted}>{t("sc_planPick")}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[...slots].sort((a, b) => Math.min(posMatch(scout.pos, a.pos), 3) - Math.min(posMatch(scout.pos, b.pos), 3)).map(sl => {
              const on = where.some(w => w.key === sl.key), fit = posMatch(scout.pos, sl.pos) <= 2;
              return (
                <Pressable key={sl.key} testID={"sc-plan-slot-" + sl.key} accessibilityRole="button" accessibilityState={{ selected: on }}
                  onPress={() => { P.save(addRef(P.content!, sl.key, own ? "own" : "shadow", ref)); s.toast(t("t_saved")); onClose(); }}
                  style={{ minWidth: 64, paddingVertical: 9, paddingHorizontal: 12, borderRadius: radius.m, borderWidth: 1.5, alignItems: "center",
                    borderColor: on ? c.event : fit ? c.accent : c.line, backgroundColor: on ? c.event : c.surface }}>
                  <Text style={{ fontWeight: "800", color: on ? "#fff" : fit ? c.accentTx : c.ink }}>{slotShort(t, sl.key)}</Text>
                </Pressable>
              );
            })}
          </View>
        </>}
      </Col>
    </Sheet>
  );
}
