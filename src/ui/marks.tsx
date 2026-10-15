// Trainingseindruck: nur Ausreißer (besonders gut / besonders schwach) markieren – Standard ist Durchschnitt.
// Kleiner Knopf für Listen, Blatt mit Gründen und Freigabe, Anzeige im Profil und in der Spieler-App.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { markTagsFor } from "../core/units";
import type { Rating } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { RatingBadge } from "./games";
import { Btn, Card, CardTitle, Col, Field, Info, ListItem, Muted, Row, Sheet, T, ToggleRow } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { radius, useTheme, withAlpha } from "./theme";

export interface MarkTarget { pid: string; date: string; slot: number }

/** Eindruck eines Spielers zu einer Einheit (0 = Mannschaftstraining) */
export const markOf = (ratings: Rating[], t: MarkTarget): Rating | undefined =>
  ratings.find(r => r.pid === t.pid && r.date === t.date && r.kind === "training" && (r.slot || 0) === t.slot);

/** ▲ besonders gut · ▼ besonders schwach · leer = Durchschnitt */
export function MarkBadge({ mark, size = "s" }: { mark: Rating["mark"] | undefined; size?: "s" | "l" }) {
  const E = useEngine(); const { c } = useTheme();
  const col = mark === "good" ? c.ok : mark === "poor" ? c.crit : c.muted, w = size === "l" ? 46 : 34;
  return (
    <View accessibilityLabel={E.t(mark === "good" ? "te_good" : mark === "poor" ? "te_poor" : "te_avg")}
      style={{ minWidth: w, height: w * 0.72, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
        backgroundColor: mark ? col : "transparent", borderWidth: mark ? 0 : 1.5, borderColor: withAlpha(col, 0.5), borderStyle: mark ? "solid" : "dashed" }}>
      <Text style={{ color: mark ? "#fff" : c.muted, fontWeight: "900", fontSize: size === "l" ? 18 : 13 }}>{mark === "good" ? "▲" : mark === "poor" ? "▼" : "·"}</Text>
    </View>
  );
}
/** Eindruck oder (ältere) Note anzeigen */
export function RatingOrMark({ r, soft }: { r: Rating; soft?: boolean }) {
  return r.mark ? <MarkBadge mark={r.mark} /> : <RatingBadge value={r.rating} size="s" soft={soft} />;
}
/** Knopf in Anwesenheits- und Einheitenlisten */
export function MarkButton({ target, onPress, testID }: { target: MarkTarget; onPress: () => void; testID?: string }) {
  const E = useEngine(); const r = markOf(E.D.ratings, target), p = E.P(target.pid);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${E.t("te_rate")} ${p ? E.name(p) : ""}`} onPress={onPress} hitSlop={6}>
      {r && !r.mark && r.rating != null ? <RatingBadge value={r.rating} size="s" /> : <MarkBadge mark={r?.mark} />}
    </Pressable>
  );
}

export function MarkSheet({ target, onClose }: { target: MarkTarget | null; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={!!target} onClose={onClose} title={t("te_sheet")} testID="mark-sheet" closeLabel={t("cancel")}>
      {target ? <MarkForm key={target.pid + target.date + target.slot} target={target} onDone={onClose} /> : null}
    </Sheet>
  );
}

function MarkForm({ target, onDone }: { target: MarkTarget; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const ex = markOf(E.D.ratings, target), p = E.P(target.pid);
  const [mark, setMark] = useState<Rating["mark"]>(ex?.mark ?? null);
  const [tags, setTags] = useState<string[]>(ex?.tags || []);
  const [text, setText] = useState(ex?.text || "");
  // Psychologisch sinnvoll: Lob darf der Spieler direkt sehen, Kritik besser zuerst persönlich ansprechen
  const [vis, setVis] = useState<boolean>(ex ? ex.vis : true);
  const [visTouched, setVisTouched] = useState(!!ex);
  if (!p) return null;
  const u = target.slot ? E.unitsOn(target.date).find(x => x.slot === target.slot) : null;
  const pick = (m: Rating["mark"]) => { setMark(m); if (!visTouched) setVis(m !== "poor"); if (m !== mark) setTags([]); };
  const save = () => {
    if (!mark && !text.trim() && (ex?.rating == null)) { if (ex) s.deleteRating(ex.id); s.toast(t("te_cleared")); onDone(); return; }
    s.saveRating({ id: ex?.id || tmpId(), pid: target.pid, date: target.date, kind: "training", rating: ex?.rating ?? null, text: text.trim(), vis, mark: mark || null, tags: mark ? tags : [], slot: target.slot });
    s.toast(t("t_saved")); onDone();
  };
  const opt = (m: Rating["mark"], label: string, col: string, sym: string, id: string) => {
    const on = mark === m;
    return (
      <Pressable key={id} testID={"mark-" + id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => pick(m)}
        style={{ flex: 1, minWidth: 96, alignItems: "center", gap: 4, paddingVertical: 12, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? withAlpha(col, 0.14) : c.surface }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: col }}>{sym}</Text>
        <Text style={{ fontWeight: on ? "800" : "600", color: c.ink, fontSize: 13.5, textAlign: "center" }}>{label}</Text>
      </Pressable>
    );
  };
  const gk = E.isGK(p), opts = markTagsFor(gk);
  return (
    <Col gap={12}>
      <ListItem title={E.name(p)} sub={`${E.wt(target.date)} ${E.de(target.date)} · ${u ? E.unitTitle(u) : t("un_main")}`} left={<PlayerAvatar p={p} size={36} />} />
      <Muted small>{t("te_info")}</Muted>
      <Row gap={8}>
        {opt("poor", t("te_poor"), c.crit, "▼", "poor")}
        {opt(null, t("te_avg"), c.muted, "·", "avg")}
        {opt("good", t("te_good"), c.ok, "▲", "good")}
      </Row>
      {mark ? <Col gap={6}>
        <T v="small" bold>{t("te_why")}</T>
        <Row wrap gap={6}>
          {opts.map(k => { const on = tags.includes(k), col = mark === "good" ? c.ok : c.crit; return (
            <Pressable key={k} testID={"mtag-" + k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setTags(on ? tags.filter(x => x !== k) : [...tags, k].slice(0, 8))}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? withAlpha(col, 0.14) : c.surface }}>
              <Text style={{ fontWeight: on ? "800" : "600", color: c.ink, fontSize: 13 }}>{t("mt_" + k)}</Text>
            </Pressable>
          ); })}
        </Row>
      </Col> : null}
      <Field testID="mark-text" label={t("te_note")} value={text} onChangeText={setText} placeholder={t("te_notePh")} multiline maxLength={2000} />
      {mark || text.trim() ? <ToggleRow testID="mark-vis" label={t("te_vis")} desc={t("te_visD")} value={vis} onChange={v => { setVis(v); setVisTouched(true); }} /> : null}
      <Row gap={8} wrap>
        <Btn testID="mark-save" kind="primary" label={t("save")} onPress={save} />
        {ex ? <Btn kind="ghost" label={t("del")} onPress={() => { s.deleteRating(ex.id); onDone(); }} /> : null}
      </Row>
    </Col>
  );
}

/** Zusammenfassung im Spielerprofil (Trainer) bzw. eigener Eindruck (Spieler, nur freigegebene) */
export function TrainingFormLine({ pid, player, testID }: { pid: string; player?: boolean; testID?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const f = E.trainForm(pid, 28, !!player);
  if (player && !f.good && !f.poor) return null;
  const parts = [f.good ? `${f.good}× ${t("te_good").toLowerCase()}` : "", f.poor ? `${f.poor}× ${t("te_poor").toLowerCase()}` : ""].filter(Boolean).join(" · ");
  return (
    <Col gap={4} testID={testID}>
      <Row gap={8}>
        <T v="eyebrow" style={{ flex: 1 }}>{player ? t("te_mine") : t("te_title")}</T>
        {f.good ? <Text style={{ color: c.ok, fontWeight: "900", fontSize: 13 }}>▲ {f.good}</Text> : null}
        {f.poor ? <Text style={{ color: c.crit, fontWeight: "900", fontSize: 13 }}>▼ {f.poor}</Text> : null}
      </Row>
      <Muted small>{parts ? parts + " " + tf("te_sumOf", { n: f.n }) : t("te_none")}</Muted>
    </Col>
  );
}

/** Team: auffällige Trainingseindrücke der letzten 4 Wochen (wer häufig heraussticht – positiv wie negativ) */
export function TeamMarksCard() {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const rows = E.D.players.map(p => ({ p, f: E.trainForm(p.id) })).filter(x => x.f.good || x.f.poor)
    .sort((a, b) => (b.f.good + b.f.poor) - (a.f.good + a.f.poor) || b.f.good - a.f.good).slice(0, 8);
  if (!E.D.ratings.some(r => r.mark)) return null;
  return (
    <Card testID="team-marks">
      <CardTitle title={t("te_team")} info={<Info title={t("te_title")} text={t("te_info")} />} />
      {rows.length ? rows.map(({ p, f }) => (
        <ListItem key={p.id} testID={"tm-" + p.id} title={E.name(p)} left={<PlayerAvatar p={p} size={32} />} onPress={() => router.push("/coach/spieler/" + p.id)}
          right={<Row gap={8}>
            {f.good ? <Text style={{ color: c.ok, fontWeight: "900" }}>▲ {f.good}</Text> : null}
            {f.poor ? <Text style={{ color: c.crit, fontWeight: "900" }}>▼ {f.poor}</Text> : null}
          </Row>} />
      )) : <Muted>{t("te_teamNone")}</Muted>}
    </Card>
  );
}
