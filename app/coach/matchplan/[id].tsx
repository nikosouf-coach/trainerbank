// Trainer – Matchplan: Aufstellung per Ziehen, Taktik & Standards (Folien mit Ausschnitt), Spielidee, Gegner,
// Spieleraufgaben, Wechselplan und Freigabe für Spieler (bis Spielende, mit Zugriffsprotokoll). Speichert automatisch.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_SECTIONS, changedSincePublish, forPlayer, publishedOf, shareState, squadOf } from "../../../src/core/matchplan";
import type { MpContent } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { Banner, Btn, Chip, Col, Field, Header, Info, Muted, Picker, Row, Screen, Sheet, T } from "../../../src/ui/kit";
import { TabBar } from "../../../src/ui/matchplan/common";
import { DisplayControls, FormationControls, LineupEditor } from "../../../src/ui/matchplan/lineup";
import { IdeaEditor, OppEditor, SharePanel, SubsEditor, TasksEditor } from "../../../src/ui/matchplan/sections";
import { SlidesPanel } from "../../../src/ui/matchplan/slides";
import { PlanContentView } from "../../../src/ui/matchplan/viewer";
import { useTheme } from "../../../src/ui/theme";

type Tab = "lineup" | "slides" | "idea" | "opp" | "tasks" | "subs" | "share";

export default function MatchplanEditor() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme(); const router = useRouter();
  const { id = "", tab: tab0 } = useLocalSearchParams<{ id: string; tab?: string }>();
  const stored = E.D.plans.find(x => x.id === id) || null;
  const [draft, setDraft] = useState<{ c: MpContent; title: string } | null>(stored ? { c: stored.c, title: stored.title } : null);
  const [tab, setTab] = useState<Tab>((["lineup", "slides", "idea", "opp", "tasks", "subs", "share"].includes(tab0 || "") ? tab0 : "lineup") as Tab);
  const [saving, setSaving] = useState<"idle" | "dirty" | "saving">("idle");
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft); latest.current = draft;
  const baseRef = useRef(stored); baseRef.current = stored;
  const dirty = useRef(false);
  const ro = !s.can("plan");
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/matchplaene");

  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const d = latest.current, base = baseRef.current;
    if (!dirty.current || !d || !base) return;
    dirty.current = false; setSaving("saving");
    await s.savePlan({ ...base, c: d.c, title: d.title });
    setSaving(dirty.current ? "dirty" : "idle");
  };
  const update = (p: Partial<{ c: MpContent; title: string }>) => {
    if (ro || !draft) return;
    setDraft({ ...draft, ...p }); dirty.current = true; setSaving("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { flush(); }, 900);
  };
  useEffect(() => () => { flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stored || !draft) return (
    <Screen testID="coach-matchplan">
      <Header title={t("mp_title")} onBack={back} backLabel={t("mp_list")} />
      <Muted>{t("mp_notFound")}</Muted>
    </Screen>
  );
  const plan = { ...stored, c: draft.c, title: draft.title };
  const m = plan.matchId ? E.D.matches.find(x => x.id === plan.matchId) || null : null;
  const st = shareState(plan, new Date()), changed = changedSincePublish(plan);
  const stCol = st === "live" ? col.ok : st === "scheduled" ? col.warn : col.build;
  const setC = (c: MpContent) => update({ c });
  const tabs: { key: Tab; label: string; badge?: string | null }[] = [
    { key: "lineup", label: t("mp_tab_lineup") }, { key: "slides", label: t("mp_tab_slides"), badge: draft.c.slides.length ? String(draft.c.slides.length) : null },
    { key: "idea", label: t("mp_tab_idea") }, { key: "opp", label: t("mp_tab_opp") }, { key: "tasks", label: t("mp_tab_tasks") },
    { key: "subs", label: t("mp_tab_subs") }, { key: "share", label: t("mp_tab_share"), badge: st === "live" ? (changed ? "●" : "✓") : null },
  ];
  const pv = preview != null ? forPlayer(publishedOf(plan.c, plan.share?.sections || DEFAULT_SECTIONS), preview, plan.share?.ownTasks ?? true) : null;
  const squad = squadOf(plan.c);
  return (
    <Screen testID="coach-matchplan">
      <Header onBack={async () => { await flush(); back(); }} backLabel={t("mp_list")}
        eyebrow={[t("mp_title"), m ? `${E.wt(m.date)} ${E.de(m.date)} · ${m.zeit} · ${m.heim ? t("home") : t("away")}` : t("mp_noMatch")].join(" · ")}
        title={draft.title || t("mp_titleFree")}
        info={<Info title={t("mp_title")} text={[t("mp_info"), t("mp_infoShare")]} />}
        right={<Chip testID="mp-status" label={st === "live" ? t("mp_st_liveShort") : t("mp_st_" + st)} color={stCol} />} />
      <Row wrap gap={8}>
        {!ro ? <Btn small testID="mp-rename" label={t("mp_rename")} onPress={() => setTitleEdit(draft.title)} /> : null}
        <Btn small testID="mp-preview" label={t("mp_preview")} onPress={() => setPreview(squad[0] || E.D.players[0]?.id || "")} />
        {!ro ? <Btn small kind="ghost" testID="mp-delete" label={t("mp_delete")} onPress={() => setDel(true)} /> : null}
        <Muted small testID="mp-saved">{saving === "saving" ? t("mp_saving") : saving === "dirty" ? t("mp_unsaved") : stored.updatedAt ? tf("mp_savedAt", { d: new Date(stored.updatedAt).toTimeString().slice(0, 5) }) : ""}</Muted>
      </Row>
      {ro ? <Banner testID="mp-ro">{t("mp_ro")}</Banner> : null}
      <TabBar tabs={tabs} value={tab} onChange={k => { setTab(k); if (k === "share") flush(); }} testID="mp-tabs" />
      {tab === "lineup" ? <Col gap={14}>
        {!ro ? <FormationControls c={draft.c} onChange={setC} date={m?.date || null} /> : <T bold>{draft.c.fmt}er · {draft.c.formation}</T>}
        <LineupEditor c={draft.c} onChange={setC} date={m?.date || null} ro={ro} />
        <DisplayControls c={draft.c} onChange={setC} />
      </Col> : null}
      {tab === "slides" ? <SlidesPanel c={draft.c} onChange={setC} ro={ro} planId={stored.id} /> : null}
      {tab === "idea" ? <IdeaEditor c={draft.c} onChange={setC} ro={ro} /> : null}
      {tab === "opp" ? <OppEditor c={draft.c} onChange={setC} ro={ro} /> : null}
      {tab === "tasks" ? <TasksEditor c={draft.c} onChange={setC} ro={ro} /> : null}
      {tab === "subs" ? <SubsEditor c={draft.c} onChange={setC} ro={ro} /> : null}
      {tab === "share" ? <SharePanel plan={plan} onBefore={() => { flush(); }} /> : null}

      <Sheet visible={titleEdit != null} onClose={() => setTitleEdit(null)} title={t("mp_rename")} testID="mp-title-sheet" closeLabel={t("cancel")}>
        <Field testID="mp-title" label={t("mp_titleF")} value={titleEdit || ""} onChangeText={setTitleEdit} maxLength={80} />
        <Btn testID="mp-title-save" kind="primary" label={t("save")} disabled={!(titleEdit || "").trim()} onPress={() => { update({ title: (titleEdit || "").trim().slice(0, 80) }); setTitleEdit(null); }} />
      </Sheet>
      <Sheet visible={preview != null} onClose={() => setPreview(null)} title={t("mp_preview")} testID="mp-preview-sheet" closeLabel={t("close")}>
        <Muted small>{t("mp_previewD")}</Muted>
        <Picker testID="mp-preview-player" label={t("mp_previewAs")} value={preview || ""} onChange={setPreview}
          options={E.D.players.map(p => ({ key: p.id, label: (p.nr != null ? p.nr + " " : "") + E.name(p) + (squad.includes(p.id) ? "" : " · " + t("mp_notInSquad")) }))} />
        {plan.share?.squadOnly && preview && !squad.includes(preview) ? <Banner color={col.warn}>{t("mp_previewNoAccess")}</Banner> : null}
        {pv ? <PlanContentView pub={pv} pid={preview} match={m} /> : null}
      </Sheet>
      <Sheet visible={del} onClose={() => setDel(false)} title={t("mp_delete")} testID="mp-del-sheet" closeLabel={t("cancel")}>
        <T>{st === "live" ? t("mp_deleteLive") : t("mp_deleteQ")}</T>
        <Btn testID="mp-del-yes" kind="danger" label={t("mp_delete")} onPress={async () => { dirty.current = false; setDel(false); await s.deletePlan(stored.id); router.replace("/coach/matchplaene"); }} />
      </Sheet>
    </Screen>
  );
}
