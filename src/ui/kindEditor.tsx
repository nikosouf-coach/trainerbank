// Blatt zum Anlegen/Bearbeiten einer eigenen Trainingsart (optional mit KI-Entwurf).
// Wird in der Planung (einzelner Tag) und in den Trainingsprinzipien (Spieltags-Bezug) genutzt.
import React, { useState } from "react";
import { ActivityIndicator } from "react-native";
import { defaultPrinciples, groupOf } from "../core/classes";
import type { CustomKind, Kind } from "../core/types";
import { tmpId, useStore } from "../data/store";
import { useAi } from "./ai";
import { Icon } from "./icons";
import { Btn, Col, Field, Muted, NumScale, Row, Sheet, T } from "./kit";
import { rpeColor, useTheme } from "./theme";

export interface KindEditorTarget {
  /** Bestehende Trainingsart (bearbeiten) oder null (neu). */
  kind: CustomKind | null;
  /** Neue Art direkt einem Spieltags-Bezug (Prinzipien) zuordnen. */
  md?: string;
  /** Neue Art direkt einem Tag (Planung) zuordnen. */
  date?: string;
}

/** Inhalt des Blatts (mit `key` neu mounten, wenn sich das Ziel ändert). */
function Body({ target, onClose }: { target: KindEditorTarget; onClose: (saved?: CustomKind) => void }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme(); const E = s.engine;
  const k = target.kind;
  const [name, setName] = useState(k?.name || "");
  const [rpe, setRpe] = useState(k?.rpe ?? 5);
  const [inhalt, setInhalt] = useState(k?.inhalt || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const ai = useAi();
  if (!E) return null;
  const team = E.team, kids = groupOf(team.cls) === "u11", showRpe = !kids && E.lvl(1);
  const cap = E.CAP;

  const save = async () => {
    const nm = name.trim(); if (!nm) { setMsg(t("kind_needName")); return; }
    setBusy(true);
    try {
      const saved = await s.saveKind({ id: k?.id || tmpId(), name: nm, rpe, inhalt });
      const ref = `c:${saved.id}` as Kind;
      if (target.md) await s.updateTeam({ principles: { ...team.principles, [target.md]: { kind: ref, rpe: Math.min(cap, rpe) } } });
      if (target.date) { const o = { ...(s.D?.over[target.date] || {}) }; o.kind = ref; o.rpe = Math.min(cap, rpe); delete o.inhalt; await s.setOver(target.date, o); }
      s.toast(t("kind_saved")); onClose(saved);
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!k) return; const ref = "c:" + k.id, D = s.D; if (!D) return;
    setBusy(true);
    try {
      const def = defaultPrinciples(groupOf(team.cls)); let changed = false; const pr = { ...team.principles };
      for (const md of Object.keys(pr)) if (pr[md].kind === ref) { pr[md] = def[md]; changed = true; }
      if (changed) await s.updateTeam({ principles: pr });
      for (const [dt, o] of Object.entries(D.over)) if (o.kind === ref) { const n = { ...o }; delete n.kind; await s.setOver(dt, Object.keys(n).length ? n : null); }
      await s.deleteKind(k.id); s.toast(t("t_del")); onClose();
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  const draft = async () => {
    const nm = name.trim() || t("kind_title"); setName(nm);
    const dauer = team.settings.dauer;
    const prompt = s.lang === "en"
      ? `Design a training session titled "${nm}". Target intensity RPE ${rpe} (CR-10), duration ${dauer} min.`
      : `Entwirf eine Trainingseinheit mit dem Titel „${nm}“. Ziel-Intensität RPE ${rpe} (CR-10), Dauer ${dauer} Min.`;
    const r = await ai.run("kind", prompt, E.aiContext(pid => s.aiPlayers.includes(pid)));
    if (r) setInhalt(r.replace(/\*\*/g, ""));
  };

  return (
    <Col gap={12}>
      <Field testID="kind-name" label={t("kind_name")} value={name} onChangeText={setName} placeholder={t("kind_namePh")} />
      {showRpe ? <Col gap={6}>
        <Row gap={6}><T v="small" bold color={c.muted}>{t("kind_rpe")}:</T><T v="small" bold>{rpe} · {E.intWord(rpe)}</T></Row>
        <NumScale testID="kind-rpe" value={rpe} onChange={setRpe} color={n => rpeColor(c, n)} />
      </Col> : null}
      <Field testID="kind-inhalt" label={t("kind_inhalt")} value={inhalt} onChangeText={setInhalt} placeholder={t("kind_inhaltPh")} multiline />
      {team.modules.ki ? <Row gap={8}>
        <Btn testID="kind-ai" label={t("kind_ai")} icon="spark" disabled={ai.busy} onPress={draft} />
        {ai.busy ? <ActivityIndicator color={c.accent} /> : null}
      </Row> : null}
      {ai.err ? <Muted small>{ai.err}</Muted> : null}
      {msg ? <Muted>{msg}</Muted> : null}
      <Row gap={10} wrap>
        <Btn testID="kind-save" kind="primary" label={t("save")} disabled={busy} onPress={save} />
        {k ? <Btn testID="kind-del" label={t("del")} disabled={busy} onPress={remove} /> : null}
      </Row>
      {!k ? <Row gap={6} align="flex-start"><Icon name="info" size={16} color={c.muted} /><Muted small style={{ flex: 1 }}>{t("kind_hint")}</Muted></Row> : null}
    </Col>
  );
}

/** Blatt für eigene Trainingsarten. `target` = null → geschlossen. */
export function KindEditor({ target, onClose }: { target: KindEditorTarget | null; onClose: (saved?: CustomKind) => void }) {
  const s = useStore(); const { t } = s.tr;
  const key = target ? (target.kind?.id || "new") + (target.md || "") + (target.date || "") : "none";
  return (
    <Sheet visible={!!target} onClose={() => onClose()} title={target?.kind ? t("kind_edit") : t("kind_title")} testID="kind-sheet" closeLabel={t("cancel")}>
      {target ? <Body key={key} target={target} onClose={onClose} /> : null}
    </Sheet>
  );
}
