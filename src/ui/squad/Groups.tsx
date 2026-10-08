// Kader → Gruppen: Positionsgruppen, eigene Gruppen mit Art (Reha, Torhüter, Belastungsaufbau, Wachstumsschub …),
// Vorschläge, Sichtbarkeit für Spieler, Mitglieder (mit Vorschlag), Nachricht und Video an die Gruppe.
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { posGroup } from "../../core/classes";
import { GROUP_KINDS, kindDef, membersOf, suggestMembers } from "../../core/groups";
import type { GroupKind, MsgType, TeamGroup } from "../../core/types";
import { tmpId, useEngine, useStore } from "../../data/store";
import { VideoSheet } from "../games";
import { Btn, Card, CardTitle, Check, Col, DateField, Field, Info, ListItem, Muted, Picker, Row, Sheet, T, Tag, ToggleRow } from "../kit";
import { radius, useTheme, withAlpha } from "../theme";

export const KIND_COLOR: Record<GroupKind, string> = { reha: "#d6336c", tw: "#f0762b", build: "#16a3a3", growth: "#7b5fd0", lead: "#3a6db5", talent: "#2f9e44", custom: "#5c6b7a" };
const RTYPES: MsgType[] = ["info", "regen", "zusatz", "prog", "pause"];

/** Farbiges Kennzeichen der Gruppenart. */
export function KindChip({ kind }: { kind: GroupKind | undefined }) {
  const E = useEngine(); const k = kind || "custom", col = KIND_COLOR[k];
  return <View style={{ backgroundColor: withAlpha(col, 0.14), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: col, fontWeight: "800", fontSize: 11 }}>{E.t("gk_" + k)}</Text></View>;
}

/** Gruppe als farbige Marke (Name, Farbe nach Art). */
export function GroupChip({ group, testID }: { group: TeamGroup; testID?: string }) {
  const col = KIND_COLOR[group.kind || "custom"];
  return <View testID={testID} style={{ backgroundColor: withAlpha(col, 0.14), borderColor: withAlpha(col, 0.4), borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: col, fontWeight: "800", fontSize: 12.5 }}>{group.name}</Text></View>;
}

export function GroupsTab({ onFilter }: { onFilter: (key: string) => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const groups = E.D.groups;
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState(""), [busy, setBusy] = useState(false);
  const create = async (kind: GroupKind, label?: string, withSuggest = false) => {
    if (busy) return; setBusy(true);
    try {
      const g = await s.saveGroup({ id: tmpId(), name: (label || t("gk_" + kind)).trim().slice(0, 60), kind, vis: kindDef(kind).vis });
      if (!g.id.startsWith("tmp-")) {
        if (withSuggest) for (const pid of suggestMembers(E, kind)) await s.setGroupMember(g.id, pid, true);
        setEditId(g.id);
      }
    } finally { setBusy(false); }
  };
  const missing = GROUP_KINDS.filter(k => k.kind !== "custom" && !groups.some(g => g.kind === k.kind))
    .filter(k => !(k.kind === "growth" && !E.isGrowthAge()));
  const edit = editId ? groups.find(g => g.id === editId) || null : null;
  return (
    <>
      <Card>
        <CardTitle title={t("gr_pos")} info={<Info title={t("tab_gruppen")} text={t("gr_info")} />} />
        {(["TW", "Abwehr", "Mittelfeld", "Sturm"] as const).map(g => {
          const ps = E.D.players.filter(p => posGroup(p.pos) === g);
          return <ListItem key={g} testID={"gpos-" + g} title={t("f_" + g)} sub={ps.map(p => p.vn).join(", ")} right={<Tag label={tf("gr_members", { n: ps.length })} />} onPress={() => onFilter(g)} />;
        })}
      </Card>
      <Card testID="groups-own">
        <CardTitle title={t("gr_own")} info={<Info title={t("gr_own")} text={t("gr_kindInfo")} />} />
        {groups.length ? groups.map(g => {
          const ps = membersOf(E.D.players, g.id);
          return (
            <ListItem key={g.id} testID={"group-" + g.id} title={g.name} sub={`${t("gk_" + (g.kind || "custom"))}${kindDef(g.kind).steer ? " ⚙" : ""} · ${ps.map(p => p.vn).join(", ") || t("gr_empty")}`} onPress={() => setEditId(g.id)}
              left={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: KIND_COLOR[g.kind || "custom"] }} />}
              right={<Row gap={6}><Tag label={tf("gr_members", { n: ps.length })} />{g.vis ? <Text accessibilityLabel={t("gr_vis")} style={{ color: c.muted }}>👁</Text> : null}</Row>} />
          );
        }) : <Muted>{t("gr_none")}</Muted>}
        <Row gap={8} wrap align="flex-end">
          <Field testID="group-name" label={t("gr_new")} value={name} onChangeText={setName} placeholder={t("gr_namePh")} maxLength={60} style={{ flex: 1, minWidth: 200 }} />
          <Btn testID="group-add" kind="primary" label={t("pot_add")} disabled={!name.trim() || busy} onPress={async () => { await create("custom", name); setName(""); }} />
        </Row>
      </Card>
      {missing.length ? <Card testID="groups-suggest">
        <CardTitle title={t("gr_suggest")} />
        <Muted small>{t("gr_suggestD")}</Muted>
        {missing.map(k => {
          const n = suggestMembers(E, k.kind).length;
          return (
            <Pressable key={k.kind} testID={"gsug-" + k.kind} accessibilityRole="button" accessibilityLabel={t("gk_" + k.kind)} disabled={busy} onPress={() => create(k.kind, undefined, true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.line }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: KIND_COLOR[k.kind] }} />
              <Col gap={2} style={{ flex: 1 }}>
                <T bold>{t("gk_" + k.kind)}{k.steer ? "  ⚙" : ""}</T>
                <Muted small>{t("gk_" + k.kind + "_d")}</Muted>
                {n ? <Text style={{ fontSize: 12, fontWeight: "700", color: KIND_COLOR[k.kind] }}>{tf("gr_sugN", { n })}</Text> : null}
              </Col>
              <Text style={{ color: c.accentTx, fontWeight: "800", fontSize: 20 }}>+</Text>
            </Pressable>
          );
        })}
        <Muted small>⚙ {t("gr_steer")}</Muted>
      </Card> : null}
      {edit ? <GroupSheet key={edit.id} group={edit} onClose={() => setEditId(null)} /> : null}
    </>
  );
}

/** Blatt: Gruppe bearbeiten (Name, Art, Sichtbarkeit, Mitglieder, Nachricht/Video an die Gruppe). */
function GroupSheet({ group: g, onClose }: { group: TeamGroup; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const [name, setName] = useState(g.name);
  const [msg, setMsg] = useState(false), [video, setVideo] = useState(false), [ask, setAsk] = useState(false);
  const members = membersOf(E.D.players, g.id);
  const sug = suggestMembers(E, g.kind || "custom").filter(id => !members.some(p => p.id === id));
  const commit = () => { const n = name.trim(); if (n && n !== g.name) s.saveGroup({ ...g, name: n.slice(0, 60) }); };
  const close = () => { commit(); onClose(); };
  const def = kindDef(g.kind);
  return (
    <>
      <Sheet visible={!msg && !video} onClose={close} title={`${t("gr_edit")} · ${g.name}`} testID="group-sheet" closeLabel={t("done")}>
        <Field testID="group-rename" label={t("gr_name")} value={name} onChangeText={setName} onBlur={commit} maxLength={60} />
        <Picker testID="group-kind" label={t("gr_kind")} value={g.kind || "custom"} options={GROUP_KINDS.map(k => ({ key: k.kind, label: t("gk_" + k.kind) }))} onChange={k => s.saveGroup({ ...g, name: name.trim() || g.name, kind: k })} />
        <Muted small>{t("gk_" + (g.kind || "custom") + "_d")}{def.steer ? "  ⚙ " + t("gr_steerOn") : ""}</Muted>
        <ToggleRow testID="group-vis" label={t("gr_vis")} desc={t("gr_visD")} value={!!g.vis} onChange={v => s.saveGroup({ ...g, name: name.trim() || g.name, vis: v })} />
        <Row between wrap gap={8}>
          <T v="h3">{tf("gr_members", { n: members.length })}</T>
          {sug.length ? <Btn small testID="group-suggest" icon="spark" label={tf("gr_sugMembers", { n: sug.length })} onPress={async () => { for (const id of sug) await s.setGroupMember(g.id, id, true); }} /> : null}
        </Row>
        <Col gap={8}>
          {E.D.players.map(p => <Check key={p.id} testID={"gm-" + p.id} label={`${E.name(p)} · ${p.pos}${sug.includes(p.id) ? "  ★" : ""}`} value={(p.groups || []).includes(g.id)} onChange={v => s.setGroupMember(g.id, p.id, v)} />)}
        </Col>
        {sug.length ? <Muted small>★ {t("gr_sugHint")}</Muted> : null}
        <Row gap={8} wrap>
          <Btn testID="group-msg" icon="spark" label={t("gr_msg")} disabled={!members.length} onPress={() => { commit(); setMsg(true); }} />
          {E.mods.videos ? <Btn testID="group-video" label={"▶ " + t("gr_video")} disabled={!members.length} onPress={() => { commit(); setVideo(true); }} /> : null}
        </Row>
        <Row gap={8} wrap>
          <Btn kind="primary" testID="group-done" label={t("done")} onPress={close} />
          <Btn kind="ghost" testID="group-del" label={t("del")} onPress={() => setAsk(true)} />
        </Row>
        {ask ? <Row gap={8} wrap>
          <T v="small" bold style={{ flex: 1 }}>{tf("gr_delQ", { n: g.name })}</T>
          <Btn small label={t("no")} onPress={() => setAsk(false)} />
          <Btn small kind="danger" testID="group-del-confirm" label={t("del")} onPress={() => { s.deleteGroup(g.id); s.toast(t("t_del")); onClose(); }} />
        </Row> : null}
      </Sheet>
      <GroupMessageSheet visible={msg} group={g} onClose={() => setMsg(false)} />
      {video ? <VideoSheet video={null} defaults={{ groupIds: [g.id], pids: members.map(p => p.id) }} onClose={() => setVideo(false)} /> : null}
    </>
  );
}

/** Nachricht an alle Mitglieder einer Gruppe (je Spieler eine Trainer-Nachricht). */
function GroupMessageSheet({ visible, group, onClose }: { visible: boolean; group: TeamGroup; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E;
  const [typ, setTyp] = useState<MsgType>("info"), [text, setText] = useState(""), [bis, setBis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const members = membersOf(E.D.players, group.id);
  const send = async () => {
    setBusy(true);
    try { for (const p of members) await s.saveMessage(p.id, { id: tmpId(), date: E.TODAY, typ, text: text.trim(), bis }); }
    finally { setBusy(false); }
    s.toast(tf("gr_msgSent", { n: members.length })); setText(""); onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`${t("gr_msg")} · ${group.name}`} testID="group-msg-sheet" closeLabel={t("cancel")}>
      <Muted small>{t("gr_to")}: {members.map(p => p.vn).join(", ")}</Muted>
      <Picker testID="gmsg-typ" label={t("rec_typ")} value={typ} onChange={setTyp} options={RTYPES.map(k => ({ key: k, label: t("ry_" + k) }))} />
      <Field testID="gmsg-text" label={t("gr_msgText")} value={text} onChangeText={setText} multiline maxLength={1000} />
      <DateField label={t("until")} value={bis} onChange={setBis} lang={E.tr.lang} />
      <Btn testID="gmsg-send" kind="primary" label={tf("gr_send", { n: members.length })} disabled={!text.trim() || !members.length || busy} onPress={send} style={{ alignSelf: "flex-start" }} />
    </Sheet>
  );
}
