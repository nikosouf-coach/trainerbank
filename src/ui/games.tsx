// Spiele & Bewertungen: Notenfarben (wie bei Sofascore), Noten-Eingabe, Bewertungsblatt, Video-Liste und Video-Blatt.
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { Rating, Video } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Btn, Check, Col, DateField, Field, ListItem, Muted, Picker, Row, Sheet, T, ToggleRow } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { radius, useTheme, withAlpha } from "./theme";

/** Farbe zur Note (1–10). */
export function ratingColor(r: number | null | undefined): string {
  if (r == null) return "#8b939e";
  return r >= 9 ? "#2f6fde" : r >= 8 ? "#13854f" : r >= 7 ? "#2fae5f" : r >= 6.5 ? "#c9a400" : r >= 6 ? "#e8820c" : "#d9452f";
}
/** Spieler-Ansicht: nur gute Noten (ab 7,0) farbig hervorheben, alle anderen neutral dunkel. */
export const SOFT_NEUTRAL = "#4a5361";
export const softRatingColor = (r: number | null | undefined): string => r != null && r >= 7 ? ratingColor(r) : SOFT_NEUTRAL;
export const fmtRating = (r: number, lang: "de" | "en"): string => lang === "en" ? r.toFixed(1) : r.toFixed(1).replace(".", ",");

/** Farbiges Notenkästchen. */
export function RatingBadge({ value, size = "m", soft }: { value: number | null; size?: "s" | "m" | "l"; soft?: boolean }) {
  const E = useEngine(); const bg = soft ? softRatingColor(value) : ratingColor(value);
  const w = size === "l" ? 58 : size === "s" ? 34 : 42, fs = size === "l" ? 22 : size === "s" ? 12.5 : 15;
  return (
    <View accessibilityLabel={value != null ? "Note " + fmtRating(value, E.tr.lang) : "–"} style={{ minWidth: w, height: w * 0.72, borderRadius: 7, backgroundColor: bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: fs, fontVariant: ["tabular-nums"] }}>{value != null ? fmtRating(value, E.tr.lang) : "–"}</Text>
    </View>
  );
}

/** Note mit −/+ in 0,5-Schritten (Tippen auf die Zahl entfernt die Note). */
export function RatingInput({ value, onChange, testID }: { value: number | null; onChange: (v: number | null) => void; testID?: string }) {
  const step = (d: number) => onChange(Math.max(1, Math.min(10, Math.round(((value ?? 6.5) + d) * 2) / 2)));
  return (
    <Row gap={10}>
      <Btn small testID={testID ? testID + "-minus" : undefined} label="−" a11y="−0,5" onPress={() => step(value == null ? 0 : -0.5)} style={{ width: 44 }} />
      <Pressable testID={testID} accessibilityRole="button" onPress={() => onChange(value == null ? 6.5 : null)}><RatingBadge value={value} size="l" /></Pressable>
      <Btn small testID={testID ? testID + "-plus" : undefined} label="+" a11y="+0,5" onPress={() => step(value == null ? 0 : 0.5)} style={{ width: 44 }} />
    </Row>
  );
}

export interface RatingTarget { pid: string; date: string; kind: "spiel" | "training"; existing?: Rating }

/** Blatt: Note und Feedback für einen Spieler zu Spiel oder Training. */
export function RatingSheet({ target, onClose }: { target: RatingTarget | null; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={!!target} onClose={onClose} title={t("gm_rateT")} testID="rating-sheet" closeLabel={t("cancel")}>
      {target ? <RatingForm key={target.pid + target.date + (target.existing?.id || "")} target={target} onDone={onClose} /> : null}
    </Sheet>
  );
}
function RatingForm({ target, onDone }: { target: RatingTarget; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const ex = target.existing || E.D.ratings.find(r => r.pid === target.pid && r.date === target.date && r.kind === target.kind);
  const p = E.P(target.pid);
  const [rating, setRating] = useState<number | null>(ex?.rating ?? null);
  const [text, setText] = useState(ex?.text || "");
  const [vis, setVis] = useState(ex ? ex.vis : true);
  if (!p) return null;
  return (
    <Col gap={12}>
      <ListItem title={E.name(p)} sub={`${E.wt(target.date)} ${E.de(target.date)} · ${target.kind === "spiel" ? t("it_match") : t("it_training")}`} left={<PlayerAvatar p={p} size={36} />} />
      <Col gap={6}><T v="small" bold>{t("gm_rating")}</T><RatingInput testID="rate" value={rating} onChange={setRating} /></Col>
      <Field testID="rate-text" label={t("gm_feedback")} value={text} onChangeText={setText} placeholder={t("gm_feedbackPh")} multiline />
      <ToggleRow testID="rate-vis" label={t("gm_visible")} desc={t("gm_visibleD")} value={vis} onChange={setVis} />
      <Row gap={8} wrap>
        <Btn testID="rate-save" kind="primary" label={t("save")} disabled={rating == null && !text.trim()} onPress={() => {
          s.saveRating({ id: ex?.id || tmpId(), pid: target.pid, date: target.date, kind: target.kind, rating, text: text.trim(), vis }); s.toast(t("t_saved")); onDone();
        }} />
        {ex ? <Btn kind="ghost" label={t("del")} onPress={() => { s.deleteRating(ex.id); onDone(); }} /> : null}
      </Row>
    </Col>
  );
}

/** Quelle eines Video-Links für die Anzeige. */
export function videoSource(url: string): string {
  const h = (url.match(/^https?:\/\/([^/]+)/i)?.[1] || "").replace(/^www\./, "").toLowerCase();
  if (/youtu/.test(h)) return "YouTube"; if (/vimeo/.test(h)) return "Vimeo"; if (/veo/.test(h)) return "Veo"; if (/hudl/.test(h)) return "Hudl";
  if (/drive\.google|docs\.google/.test(h)) return "Google Drive"; if (/dropbox/.test(h)) return "Dropbox"; if (/onedrive|sharepoint/.test(h)) return "OneDrive";
  return h || "Link";
}

/** Liste von Videos (Tippen öffnet den Link). */
export function VideoList({ videos, onEdit, empty }: { videos: Video[]; onEdit?: (v: Video) => void; empty?: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  if (!videos.length) return <Muted>{empty || t("vd_none")}</Muted>;
  return (
    <Col gap={8}>
      {videos.map(v => {
        const m = v.matchId ? E.D.matches.find(x => x.id === v.matchId) : null;
        const gnames = (v.groupIds || []).map(id => E.D.groups.find(g => g.id === id)?.name).filter(Boolean) as string[];
        const inGroups = new Set(E.D.players.filter(p => (p.groups || []).some(g => (v.groupIds || []).includes(g))).map(p => p.id));
        const names = (ids: string[]) => ids.map(id => E.P(id)?.vn).filter(Boolean).join(", ");
        const extra = v.pids.filter(id => !inGroups.has(id));
        // Spieler (ohne Bearbeiten) sehen nur freigegebene Gruppen, nie die Namen anderer Empfänger
        const who = gnames.length ? E.tf("vd_toGroups", { g: gnames.join(", ") }) + (onEdit && extra.length ? " + " + names(extra) : "") : onEdit ? names(v.pids) : "";
        return (
          <Row key={v.id} gap={10} testID={"video-" + v.id}>
            <Pressable accessibilityRole="link" accessibilityLabel={v.title} onPress={() => Linking.openURL(v.url).catch(() => undefined)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 56, height: 40, borderRadius: 8, backgroundColor: withAlpha(c.crit, 0.14), alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: c.crit, fontSize: 18 }}>▶</Text>
              </View>
              <Col gap={1} style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontWeight: "700", fontSize: 14.5, color: c.ink }}>{v.title}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: c.muted }}>{[videoSource(v.url), v.date ? E.de(v.date) : "", m ? `${t("vs")} ${m.gegner}` : "", who].filter(Boolean).join(" · ")}{!v.vis ? " · " + t("pot_hidden") : ""}</Text>
              </Col>
            </Pressable>
            {onEdit ? <Btn small kind="ghost" label={t("edit")} onPress={() => onEdit(v)} /> : null}
          </Row>
        );
      })}
    </Col>
  );
}

/** Blatt: Video-Link anlegen/bearbeiten. `video` = undefined → geschlossen. */
export function VideoSheet({ video, defaults, onClose }: { video: Video | null | undefined; defaults?: Partial<Video>; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={video !== undefined} onClose={onClose} title={video ? t("vd_edit") : t("vd_add")} testID="video-sheet" closeLabel={t("cancel")}>
      {video !== undefined ? <VideoForm key={video?.id || "new"} video={video} defaults={defaults} onDone={onClose} /> : null}
    </Sheet>
  );
}
function VideoForm({ video, defaults, onDone }: { video: Video | null; defaults?: Partial<Video>; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const v0 = { ...(defaults || {}), ...(video || {}) } as Partial<Video>;
  const [title, setTitle] = useState(v0.title || "");
  const [url, setUrl] = useState(v0.url || "");
  const [date, setDate] = useState<string | null>(v0.date ?? E.TODAY);
  const [matchId, setMatchId] = useState(v0.matchId || "");
  const [pids, setPids] = useState<string[]>(v0.pids || []);
  const [note, setNote] = useState(v0.note || "");
  const [vis, setVis] = useState(v0.vis ?? true);
  const [all, setAll] = useState(!(v0.pids || []).length);
  const [gids, setGids] = useState<string[]>((v0.groupIds || []).filter(id => E.D.groups.some(g => g.id === id)));
  const memberIds = (gid: string) => E.D.players.filter(p => (p.groups || []).includes(gid)).map(p => p.id);
  /** Gruppe an/aus: Mitglieder werden Empfänger bzw. entfernt (wenn nicht über eine andere gewählte Gruppe dabei). */
  const toggleGroup = (gid: string, on: boolean) => {
    const next = on ? [...gids, gid] : gids.filter(x => x !== gid); setGids(next);
    if (on) setPids([...new Set([...pids, ...memberIds(gid)])]);
    else { const keep = new Set(next.flatMap(memberIds)); setPids(pids.filter(id => keep.has(id) || !memberIds(gid).includes(id))); }
  };
  const okUrl = /^https?:\/\/\S+\.\S+/i.test(url.trim());
  const matches = E.D.matches.filter(m => m.date <= E.TODAY).slice(-12).reverse();
  return (
    <Col gap={12}>
      <Field testID="vd-title" label={t("vd_title")} value={title} onChangeText={setTitle} placeholder={t("vd_titlePh")} maxLength={200} />
      <Field testID="vd-url" label={t("vd_url")} value={url} onChangeText={setUrl} placeholder="https://…" autoCapitalize="none" keyboardType="email-address" hint={t("vd_urlHint")} />
      <Row wrap gap={10}>
        <DateField label={t("f_date")} value={date} onChange={setDate} lang={E.tr.lang} style={{ flex: 1, minWidth: 140 }} />
        <Picker testID="vd-match" label={t("it_match")} value={matchId} onChange={setMatchId} options={[{ key: "", label: "–" }, ...matches.map(m => ({ key: m.id, label: `${E.de(m.date)} ${t("vs")} ${m.gegner}` }))]} style={{ flex: 1, minWidth: 180 }} />
      </Row>
      <Check testID="vd-all" label={t("vd_all")} value={all} onChange={v => { setAll(v); if (v) { setPids([]); setGids([]); } }} />
      {!all && E.D.groups.length ? <Col gap={6}>
        <T v="small" bold>{t("vd_groups")}</T>
        <Row wrap gap={10}>{E.D.groups.map(g => <Check key={g.id} testID={"vd-group-" + g.id} label={`${g.name} (${memberIds(g.id).length})`} value={gids.includes(g.id)} onChange={on => toggleGroup(g.id, on)} />)}</Row>
      </Col> : null}
      {!all ? <Row wrap gap={10}>{E.D.players.map(p => <Check key={p.id} testID={"vd-p-" + p.id} label={p.vn + " " + (p.nn || "")[0] + "."} value={pids.includes(p.id)} onChange={on => setPids(on ? [...pids, p.id] : pids.filter(x => x !== p.id))} />)}</Row> : null}
      {!all && !pids.length ? <Muted small>{t("vd_noneSel")}</Muted> : null}
      <Field label={t("vd_note")} value={note} onChangeText={setNote} multiline />
      <ToggleRow label={t("gm_visible")} desc={t("vd_visD")} value={vis} onChange={setVis} />
      <Row gap={8} wrap>
        <Btn testID="vd-save" kind="primary" label={t("save")} disabled={!title.trim() || !okUrl || (!all && !pids.length)} onPress={() => {
          s.saveVideo({ id: video?.id || tmpId(), title: title.trim(), url: url.trim(), date, matchId: matchId || null, pids: all ? [] : pids, groupIds: all ? [] : gids, note: note.trim(), vis }); s.toast(t("t_saved")); onDone();
        }} />
        {video ? <Btn kind="ghost" label={t("del")} onPress={() => { s.deleteVideo(video.id); onDone(); }} /> : null}
      </Row>
      {url && !okUrl ? <Muted small>{t("vd_urlBad")}</Muted> : null}
      <Row gap={6}><Icon name="info" size={14} color="#8b939e" /><Muted small style={{ flex: 1 }}>{t("vd_privacy")}</Muted></Row>
    </Col>
  );
}

/** Kleine Kennzahl-Kachel für Saisonwerte. */
export function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 90, backgroundColor: color ? withAlpha(color, 0.12) : c.sunk, borderRadius: radius.m, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: color || c.ink, fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: c.muted, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}
