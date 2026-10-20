// Chat im Team: Liste, Unterhaltung, neuer Chat bzw. eigene Gruppe, Meldungen (Trainerteam) und Einstellungen.
// Kinderschutz: Jugendteams mit Einzelchats nur zum Trainerteam und Mitlesen; Push ohne Nachrichtentext; Melden.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CF_LIMITS, CHAT_FOLDERS, LINK_RE, MSG_MAX, REACTIONS, canCustom, canSend, chatDefaults, chatSettings, chatTitle, cleanChatFolders, dayOf, directTargets, folderOf, isObserver,
  isParticipant, isYouth, msgsOf, openableGroups, previewOf, readOnlyOf, sortChats, timeOf, unreadOf, type ChatFolder, type ChatFolderKey, type ChatFolderPrefs,
} from "../core/chat";
import { addDays } from "../core/dates";
import type { Chat, ChatMsg, ChatPerson, ChatReportReason, ChatSettings, TeamData } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { openChatRef } from "../data/push";
import { Icon } from "./icons";
import { Avatar, Banner, Btn, Card, CardTitle, Check, ChoiceChips, Col, Field, Header, Info, ListItem, Muted, Row, Screen, Seg, Sheet, T, Tag, ToggleRow, hue } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { TeamLogo } from "./teamLogo";
import { radius, useTheme, withAlpha } from "./theme";

type Area = "coach" | "player";
const REASONS: ChatReportReason[] = ["mean", "bully", "private", "other"];

// ---------- Hilfen ----------
/** Ungelesene Nachrichten (ohne stumm geschaltete Chats) – für das Abzeichen am Reiter */
export function useChatBadge(): number {
  const s = useStore(); const D = s.D;
  if (!D || D.team.modules.chat === false || !chatSettings(D.team).on) return 0;
  return s.chats.filter(c => !c.muted).reduce((a, c) => a + unreadOf(D, c.id, s.chatMeId), 0);
}
/** Regelmäßig mit dem Server abgleichen, solange der Chat offen ist (falls Echtzeit etwas verpasst) */
function useChatPolling() {
  const s = useStore(); const sync = useRef(s.chatSync); sync.current = s.chatSync;
  useEffect(() => {
    sync.current();
    const iv = setInterval(() => sync.current(), 20000);
    const sub = AppState.addEventListener("change", st => { if (st === "active") sync.current(); });
    return () => { clearInterval(iv); sub.remove(); };
  }, []);
}
/** Zeit in der Liste: heute Uhrzeit, gestern „Gestern“, sonst Datum */
function useWhen() {
  const E = useEngine();
  return (at: string | null | undefined): string => {
    if (!at) return ""; const d = dayOf(at);
    return d === E.TODAY ? timeOf(at) : d === addDays(E.TODAY, -1) ? E.t("ch_yesterday") : E.de(d);
  };
}
/** Teilnehmer eines Chats (Konten) – für die Info */
function membersOf(D: TeamData, c: Chat): ChatPerson[] {
  const P = D.chatPeople;
  switch (c.kind) {
    case "team": return P;
    case "staff": return P.filter(p => p.kind === "staff");
    case "group": return P.filter(p => p.kind === "staff" || (!!p.pid && (D.players.find(x => x.id === p.pid)?.groups || []).includes(c.groupId || "")));
    default: return c.members.map(u => P.find(p => p.uid === u) || { uid: u, name: "–", kind: "player" as const, pid: null, role: null });
  }
}
function PersonAvatar({ p, size = 40 }: { p: ChatPerson | undefined; size?: number }) {
  const E = useEngine();
  const pl = p?.pid ? E.D.players.find(x => x.id === p.pid) : undefined;
  if (pl) return <PlayerAvatar p={pl} size={size} />;
  const [first, ...rest] = (p?.name || "?").split(" ");
  return <Avatar id={p?.uid || "x"} first={first} last={rest.join(" ")} size={size} />;
}
export function ChatAvatar({ chat, size = 44 }: { chat: Chat; size?: number }) {
  const s = useStore(); const E = useEngine(); const { c } = useTheme();
  if (chat.kind === "team") return <TeamLogo size={size} />;
  if (chat.kind === "direct" && chat.members.includes(s.chatMeId)) return <PersonAvatar p={E.D.chatPeople.find(p => p.uid === chat.members.find(u => u !== s.chatMeId))} size={size} />;
  const col = chat.kind === "staff" ? c.accent : chat.kind === "direct" ? c.low : `hsl(${hue(chat.id)}, 42%, 42%)`;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col, alignItems: "center", justifyContent: "center" }}>
      <Icon name={chat.kind === "staff" ? "kader" : chat.kind === "direct" ? "eye" : "people"} size={size * 0.5} color="#fff" />
    </View>
  );
}
/** Text mit antippbaren Links */
function Linkified({ text, color, testID }: { text: string; color: string; testID?: string }) {
  const parts = text.split(LINK_RE);
  return (
    <Text testID={testID} selectable style={{ color, fontSize: 15.5, lineHeight: 21 }}>
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <Text key={i} style={{ textDecorationLine: "underline", color }} onPress={() => { Linking.openURL(p).catch(() => undefined); }}>{p}</Text>
        : <React.Fragment key={i}>{p}</React.Fragment>)}
    </Text>
  );
}

// ---------- Ordner ----------
/** Ordner des Kontos (bereinigt) und Name eines vorgegebenen Ordners */
function useFolders() {
  const s = useStore(); const { t } = s.tr;
  const F = cleanChatFolders(s.prefs.chatFolders);
  const label = (k: ChatFolderKey): string => F.names?.[k] || t("ch_f_" + k);
  const save = (x: ChatFolderPrefs) => s.setPrefs({ chatFolders: cleanChatFolders(x) });
  return { F, label, save };
}

/** Ordnerleiste über der Chat-Liste: Alle, vorgegebene Ordner, eigene Ordner, bearbeiten */
function FolderBar({ value, onChange, counts, onEdit }: { value: string; onChange: (k: string) => void; counts: Record<string, { n: number; unread: number }>; onEdit: () => void }) {
  const { c } = useTheme(); const s = useStore(); const { t } = s.tr; const { F, label } = useFolders();
  const keys: { k: string; label: string }[] = [{ k: "all", label: t("ch_fAll") },
    ...CHAT_FOLDERS.filter(k => !F.hide?.includes(k) && (k !== "read" || counts.read?.n)).map(k => ({ k, label: label(k) })),
    ...(F.custom || []).map(f => ({ k: "c:" + f.id, label: f.name }))];
  return (
    <Row gap={6}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="chat-folders" style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {keys.map(x => {
        const on = value === x.k, u = counts[x.k]?.unread || 0;
        return (
          <Pressable key={x.k} testID={"chat-folder-" + x.k} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label + (u ? ", " + u : "")} onPress={() => onChange(x.k)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: on ? c.surface : c.ink }}>{x.label}</Text>
            {u ? <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: c.accentInk }}>{u > 99 ? "99+" : u}</Text></View> : null}
          </Pressable>
        );
      })}
    </ScrollView>
    {/* bearbeiten bleibt rechts sichtbar, auch wenn die Ordner seitlich scrollen */}
    <Pressable testID="chat-folders-edit" accessibilityRole="button" accessibilityLabel={t("ch_fEdit")} onPress={onEdit}
      style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }}>
      <Icon name="pen" size={15} color={c.muted} />
    </Pressable>
    </Row>
  );
}

/** Ordner bearbeiten: vorgegebene umbenennen/ausblenden, eigene anlegen, benennen, Chats zuordnen, löschen */
function FolderSheet({ visible, onClose, chats, focus }: { visible: boolean; onClose: () => void; chats: Chat[]; focus?: string | null }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const { F, save } = useFolders();
  const [d, setD] = useState<ChatFolderPrefs>(F); const [open, setOpen] = useState<string | null>(null); const [was, setWas] = useState(false);
  if (visible !== was) { setWas(visible); if (visible) { setD(F); setOpen(focus || null); } }
  const custom = d.custom || [], used = custom.reduce((a, f) => a + f.chats.length, 0);
  const setCustom = (L: ChatFolder[]) => setD({ ...d, custom: L });
  const add = () => { const f = { id: tmpId(), name: tf("ch_fNewN", { n: custom.length + 1 }), chats: [] }; setCustom([...custom, f]); setOpen(f.id); };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("ch_fEdit")} testID="chat-folders-sheet" closeLabel={t("cancel")}>
      <T v="eyebrow">{t("ch_fPre")}</T>
      {CHAT_FOLDERS.map(k => (
        <View key={k} style={{ gap: 6, padding: 10, borderRadius: radius.m, borderWidth: 1, borderColor: c.line }}>
          <Row gap={10} align="flex-end">
            <Field testID={"cf-name-" + k} label={t("ch_f_" + k + "D")} value={d.names?.[k] ?? ""} placeholder={t("ch_f_" + k)} maxLength={CF_LIMITS.name} style={{ flex: 1 }}
              onChangeText={v => setD({ ...d, names: { ...(d.names || {}), [k]: v } })} />
          </Row>
          <ToggleRow testID={"cf-show-" + k} label={t("ch_fShow")} value={!d.hide?.includes(k)} onChange={v => setD({ ...d, hide: v ? (d.hide || []).filter(x => x !== k) : [...(d.hide || []), k] })} />
        </View>
      ))}
      <T v="eyebrow">{t("ch_fOwn")}</T>
      {custom.length ? null : <Muted small>{t("ch_fOwnD")}</Muted>}
      {custom.map(f => {
        const o = open === f.id;
        return (
          <View key={f.id} testID={"cf-" + f.id} style={{ gap: 8, padding: 10, borderRadius: radius.m, borderWidth: 1, borderColor: o ? c.accent : c.line }}>
            <Row gap={8} align="flex-end">
              <Field testID={"cf-cname-" + f.id} label={t("ch_fName")} value={f.name} maxLength={CF_LIMITS.name} style={{ flex: 1 }} onChangeText={v => setCustom(custom.map(x => x.id === f.id ? { ...x, name: v } : x))} />
              <Btn small kind="ghost" icon="trash" label="" a11y={t("ch_fDel")} testID={"cf-del-" + f.id} onPress={() => setCustom(custom.filter(x => x.id !== f.id))} />
            </Row>
            <Pressable testID={"cf-toggle-" + f.id} accessibilityRole="button" accessibilityState={{ expanded: o }} onPress={() => setOpen(o ? null : f.id)}>
              <Row between><T v="small" bold color={c.accentTx}>{tf("ch_fChatsN", { n: f.chats.filter(id => chats.some(ch => ch.id === id)).length })}</T>
                <View style={{ transform: [{ rotate: o ? "270deg" : "90deg" }] }}><Icon name="chevron" size={15} color={c.muted} /></View></Row>
            </Pressable>
            {o ? <Col gap={8}>
              {chats.map(ch => {
                const on = f.chats.includes(ch.id), full = !on && used >= CF_LIMITS.ids;
                return <Check key={ch.id} testID={`cf-chat-${f.id}-${ch.id}`} label={<T v="small" color={full ? c.muted : c.ink}>{chatTitle(ch, E.D, s.chatMeId, t)}</T>} value={on}
                  onChange={v => { if (full) return; setCustom(custom.map(x => x.id === f.id ? { ...x, chats: v ? [...x.chats, ch.id] : x.chats.filter(y => y !== ch.id) } : x)); }} />;
              })}
              {used >= CF_LIMITS.ids ? <Muted small>{tf("ch_fLimit", { n: CF_LIMITS.ids })}</Muted> : null}
            </Col> : null}
          </View>
        );
      })}
      {custom.length < CF_LIMITS.custom ? <Btn small testID="cf-add" icon="plus" label={t("ch_fNew")} onPress={add} style={{ alignSelf: "flex-start" }} /> : null}
      <Row gap={8} style={{ justifyContent: "flex-end" }}>
        <Btn testID="cf-cancel" label={t("cancel")} onPress={onClose} />
        <Btn testID="cf-save" kind="primary" label={t("save")} onPress={() => { save({ ...d, custom: custom.map((f, i) => f.name.trim() ? f : { ...f, name: tf("ch_fNewN", { n: i + 1 }) }) }); onClose(); }} />
      </Row>
    </Sheet>
  );
}

// ---------- Liste ----------
export function ChatListScreen({ area }: { area: Area }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter(); const when = useWhen();
  useChatPolling();
  const D = E.D, me = s.chatMeId, st = chatSettings(D.team);
  const [q, setQ] = useState("");
  const all = useMemo(() => sortChats({ chats: s.chats, chatMsgs: D.chatMsgs })
    .filter(ch => ch.kind === "team" || ch.kind === "staff" || ch.kind === "custom" || msgsOf(D, ch.id).length > 0 || ch.createdBy === me), [s.chats, D, s.version, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const { F } = useFolders();
  const [folder, setFolder] = useState("all"); const [fEdit, setFEdit] = useState<{ focus: string | null } | null>(null);
  // Ordner: vorgegebene nach Art des Chats, eigene nach Zuordnung; gibt es den gewählten nicht mehr → Alle
  const inFolder = (ch: Chat, k: string): boolean => k === "all" ? true : k.startsWith("c:") ? !!F.custom?.find(f => "c:" + f.id === k)?.chats.includes(ch.id) : folderOf(ch, me, s.chatMod) === k;
  const counts: Record<string, { n: number; unread: number }> = {};
  for (const k of ["all", ...CHAT_FOLDERS, ...(F.custom || []).map(f => "c:" + f.id)]) {
    const L = all.filter(ch => inFolder(ch, k)); counts[k] = { n: L.length, unread: L.filter(ch => !ch.muted).reduce((a, ch) => a + unreadOf(D, ch.id, me), 0) };
  }
  const fk = folder === "all" || (folder.startsWith("c:") ? F.custom?.some(f => "c:" + f.id === folder) : !F.hide?.includes(folder as ChatFolderKey) && (folder !== "read" || counts.read.n)) ? folder : "all";
  const inF = all.filter(ch => inFolder(ch, fk));
  const list = q.trim() ? inF.filter(ch => chatTitle(ch, D, me, t).toLowerCase().includes(q.trim().toLowerCase())) : inF;
  const reports = s.chatMod ? D.chatReports.filter(r => r.status === "open").length : 0;
  const rules = <Info title={t("ch_rules")} text={[t("ch_info"), ...E.tr.tl("ch_rulesL"), isYouth(D.team.cls) ? t("ch_rulesYouth") : ""]} testID="chat-rules" />;
  if (!st.on || D.team.modules.chat === false) return (
    <Screen testID="chat-list"><Header title={t("ch_title")} /><Banner testID="chat-off">{area === "coach" ? t("ch_offStaff") : t("ch_off")}</Banner></Screen>
  );
  return (
    <Screen testID="chat-list">
      <Header eyebrow={t("ch_sub")} title={t("ch_title")} info={rules}
        right={<Btn testID="chat-new" kind="primary" small icon="plus" label={t("ch_new")} onPress={() => router.push(`/${area}/chat-neu`)} />} />
      {reports ? <Pressable testID="chat-reports" accessibilityRole="button" onPress={() => router.push("/coach/meldungen")}>
        <Banner color={c.crit}><Row gap={8}><Icon name="flag" size={16} color={c.crit} /><T v="small" bold>{tf("ch_reportsN", { n: reports })}</T></Row></Banner>
      </Pressable> : null}
      <FolderBar value={fk} onChange={setFolder} counts={counts} onEdit={() => setFEdit({ focus: fk.startsWith("c:") ? fk.slice(2) : null })} />
      {all.length > 8 ? <Field testID="chat-search" label={t("ch_search")} value={q} onChangeText={setQ} /> : null}
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        {list.length ? list.map(ch => {
          const L = msgsOf(D, ch.id), last = L.filter(m => !m.failed).at(-1), n = unreadOf(D, ch.id, me), group = ch.kind !== "direct";
          const obs = isObserver(ch, me, s.chatMod);
          return (
            <Pressable key={ch.id} testID={"chat-row-" + ch.id} accessibilityRole="button" accessibilityLabel={chatTitle(ch, D, me, t) + (n ? ", " + n : "")} onPress={() => router.push(`/${area}/chat/${ch.id}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <ChatAvatar chat={ch} size={46} />
              <Col gap={3} style={{ flex: 1, minWidth: 0 }}>
                <Row between gap={8}>
                  <Row gap={6} style={{ flex: 1, minWidth: 0 }}>
                    <T bold numberOfLines={1} style={{ flexShrink: 1 }}>{chatTitle(ch, D, me, t)}</T>
                    {ch.transparent ? <Icon name="eye" size={14} color={c.muted} /> : null}
                    {ch.muted ? <Icon name="mute" size={14} color={c.muted} /> : null}
                  </Row>
                  <Text style={{ fontSize: 12, color: n ? c.accentTx : c.muted, fontWeight: n ? "800" : "400" }}>{when(last?.at || ch.lastAt)}</Text>
                </Row>
                <Row between gap={8}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: c.muted }}>{last ? previewOf(last, me, t, tf, group) : obs ? t("ch_observer") : t("ch_empty")}</Text>
                  {n ? <View testID={"chat-unread-" + ch.id} style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: ch.muted ? c.build : c.accent, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: ch.muted ? "#fff" : c.accentInk, fontWeight: "800", fontSize: 12 }}>{n > 99 ? "99+" : n}</Text>
                  </View> : null}
                </Row>
              </Col>
            </Pressable>
          );
        }) : fk === "all" ? <Muted style={{ paddingVertical: 12 }}>{t("ch_listEmpty")}</Muted>
          : <Col gap={8} style={{ paddingVertical: 12 }}><Muted testID="chat-folder-empty">{t("ch_fEmpty")}</Muted>
            {fk.startsWith("c:") ? <Btn small testID="chat-folder-fill" icon="plus" label={t("ch_fAdd")} onPress={() => setFEdit({ focus: fk.slice(2) })} style={{ alignSelf: "flex-start" }} /> : null}</Col>}
      </Card>
      <Muted small>{t("ch_noAccount")}</Muted>
      <FolderSheet visible={!!fEdit} focus={fEdit?.focus} onClose={() => setFEdit(null)} chats={all} />
    </Screen>
  );
}

// ---------- Unterhaltung ----------
export function ChatThreadScreen({ area }: { area: Area }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter(); const ins = useSafeAreaInsets();
  useChatPolling();
  const D = E.D, me = s.chatMeId, chat = s.chats.find(x => x.id === id), st = chatSettings(D.team);
  const L = msgsOf(D, id || "");
  const [firstUnread] = useState(() => { const r = D.chatRead[id || ""] || ""; return L.find(m => m.at > r && m.uid !== me)?.id || null; });
  const [text, setText] = useState(""); const [reply, setReply] = useState<ChatMsg | null>(null);
  const [act, setAct] = useState<ChatMsg | null>(null); const [report, setReport] = useState<ChatMsg | null>(null); const [info, setInfo] = useState(false);
  const sv = useRef<ScrollView>(null); const stick = useRef(true);
  useEffect(() => {
    if (!id) return;
    s.chatFocus(id); openChatRef.id = id;
    return () => { s.chatFocus(null); if (openChatRef.id === id) openChatRef.id = null; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => router.canGoBack() ? router.back() : router.replace(`/${area}/chat`);
  if (!chat || !id) return (
    <Screen testID="chat-thread"><Header title={t("ch_title")} onBack={back} backLabel={t("btn_back")} /><Muted>{t("ch_noChat")}</Muted></Screen>
  );
  const title = chatTitle(chat, D, me, t), group = chat.kind !== "direct";
  const writable = canSend(D, chat, me), participant = isParticipant(D, chat, me), observer = isObserver(chat, me, s.chatMod);
  const ro = readOnlyOf(chat, st);
  const members = membersOf(D, chat);
  const other = chat.kind === "direct" ? D.chatPeople.find(p => p.uid === chat.members.find(u => u !== me)) : undefined;
  const sub = chat.kind === "direct" ? (other ? (other.kind === "staff" ? (other.role ? t("sr_" + other.role) : t("ch_staffGroup")) : t("ch_playersGroup")) : "")
    : tf("ch_membersN", { n: members.length }) + (ro ? " · " + t("ch_readOnly") : "");
  const why = !st.on ? t("ch_off") : observer ? t("ch_observer") : ro && participant ? t("ch_readOnlyNote") : chat.kind === "direct" ? t("ch_dmReadOnly") : t("ch_off");
  const send = () => {
    const body = text; if (!body.trim()) return;
    setText(""); const rp = reply; setReply(null); stick.current = true;
    s.chatSend(id, body, rp?.id || null);
  };
  let lastDay = "";
  const items: React.ReactNode[] = [];
  L.forEach((m, i) => {
    const day = dayOf(m.at);
    if (day !== lastDay) {
      lastDay = day;
      items.push(<View key={"d" + day} style={{ alignSelf: "center", backgroundColor: c.sunk, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: c.muted }}>{day === E.TODAY ? t("ch_today") : day === addDays(E.TODAY, -1) ? t("ch_yesterday") : `${E.wt(day)} ${E.de(day)}`}</Text>
      </View>);
    }
    if (m.id === firstUnread) items.push(<Row key="unread" gap={8} style={{ marginVertical: 6 }} testID="chat-newmsgs"><View style={{ flex: 1, height: 1, backgroundColor: c.accentTx }} /><Text style={{ fontSize: 12, fontWeight: "800", color: c.accentTx }}>{t("ch_newMsgs")}</Text><View style={{ flex: 1, height: 1, backgroundColor: c.accentTx }} /></Row>);
    const prev = L[i - 1], mine = m.uid === me, firstOf = !prev || prev.uid !== m.uid || dayOf(prev.at) !== day;
    items.push(<Bubble key={m.id} m={m} mine={mine} showName={group && !mine && firstOf} replyMsg={m.replyTo ? L.find(x => x.id === m.replyTo) || null : null}
      me={me} canReact={participant && st.on && !m.deleted} onActions={() => setAct(m)} onRetry={() => s.chatRetry(m)} onReact={e => s.chatReact(m, e)} />);
  });
  return (
    <KeyboardAvoidingView testID="chat-thread" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: ins.top + 6, paddingBottom: 8, paddingHorizontal: 8, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Btn small kind="ghost" icon="back" label="" a11y={t("btn_back")} testID="chat-back" onPress={back} />
        <Pressable testID="chat-head" accessibilityRole="button" accessibilityLabel={title} onPress={() => setInfo(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ChatAvatar chat={chat} size={38} />
          <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
            <T bold numberOfLines={1}>{title}</T>
            {sub ? <Text numberOfLines={1} style={{ fontSize: 12, color: c.muted }}>{sub}</Text> : null}
          </Col>
        </Pressable>
        {participant ? <Btn small kind="ghost" icon="mute" label="" a11y={chat.muted ? t("ch_unmute") : t("ch_mute")} testID="chat-mute"
          style={{ opacity: chat.muted ? 1 : 0.45 }} onPress={() => s.chatMute(chat.id, !chat.muted)} /> : null}
        <Btn small kind="ghost" icon="info" label="" a11y={t("ch_members")} testID="chat-info" onPress={() => setInfo(true)} />
      </View>
      {chat.transparent ? <Pressable testID="chat-transparent" accessibilityRole="button" onPress={() => setInfo(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: withAlpha(c.low, 0.1) }}>
        <Icon name="eye" size={14} color={c.low} /><Text style={{ fontSize: 12, color: c.low, fontWeight: "700", flex: 1 }}>{t("ch_transparent")}</Text>
      </Pressable> : null}
      <ScrollView ref={sv} testID="chat-msgs" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" scrollEventThrottle={100}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 3, width: "100%", maxWidth: 820, alignSelf: "center" }}
        onContentSizeChange={() => { if (stick.current) sv.current?.scrollToEnd({ animated: false }); }}
        onScroll={e => { const n = e.nativeEvent; stick.current = n.contentOffset.y + n.layoutMeasurement.height >= n.contentSize.height - 120; }}>
        {D.chatMore[id] ? <Btn small kind="ghost" testID="chat-older" label={t("ch_older")} onPress={() => { stick.current = false; s.chatOlder(id); }} style={{ alignSelf: "center" }} /> : null}
        {L.length ? items : <Muted style={{ textAlign: "center", marginTop: 30 }}>{observer ? t("ch_observer") : t("ch_empty")}</Muted>}
      </ScrollView>
      {writable ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface, paddingHorizontal: 10, paddingTop: 8, paddingBottom: ins.bottom + 8, gap: 6 }}>
          {reply ? <Row gap={8} testID="chat-reply" style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 8 }}>
            <Icon name="reply" size={16} color={c.accentTx} />
            <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: c.accentTx }}>{tf("ch_replyTo", { name: reply.uid === me ? t("ch_you") : reply.name })}</Text>
              <Text numberOfLines={1} style={{ fontSize: 13, color: c.muted }}>{reply.deleted ? t("ch_deleted") : reply.body}</Text>
            </Col>
            <Btn small kind="ghost" icon="close" label="" a11y={t("cancel")} testID="chat-reply-x" onPress={() => setReply(null)} />
          </Row> : null}
          <Row gap={8} align="flex-end">
            <TextInput testID="chat-input" accessibilityLabel={t("ch_input")} value={text} onChangeText={setText} placeholder={t("ch_input")} placeholderTextColor={c.muted}
              multiline maxLength={MSG_MAX}
              style={{ flex: 1, minHeight: 42, maxHeight: 140, borderWidth: 1, borderColor: c.line, borderRadius: radius.l, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: c.bg, color: c.ink, fontSize: 16 }} />
            <Pressable testID="chat-send" accessibilityRole="button" accessibilityLabel={t("ch_send")} accessibilityState={{ disabled: !text.trim() }} disabled={!text.trim()} onPress={send}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? c.accent : c.sunk, alignItems: "center", justifyContent: "center" }}>
              <Icon name="send" size={20} color={text.trim() ? c.accentInk : c.muted} />
            </Pressable>
          </Row>
          {text.length > MSG_MAX - 300 ? <Muted small>{text.length} / {MSG_MAX}</Muted> : null}
        </View>
      ) : (
        <View testID="chat-noWrite" style={{ borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, paddingTop: 12, paddingBottom: ins.bottom + 12 }}>
          <Muted small style={{ textAlign: "center" }}>{why}</Muted>
        </View>
      )}
      <ActionSheet m={act} chat={chat} me={me} canReply={writable} canReact={participant && st.on} onClose={() => setAct(null)}
        onReply={m => { setReply(m); setAct(null); }} onReport={m => { setAct(null); setReport(m); }} />
      <ReportSheet m={report} onClose={() => setReport(null)} />
      <ChatInfoSheet visible={info} chat={chat} members={members} area={area} onClose={() => setInfo(false)} />
    </KeyboardAvoidingView>
  );
}

function Bubble({ m, mine, showName, replyMsg, me, canReact, onActions, onRetry, onReact }: {
  m: ChatMsg; mine: boolean; showName: boolean; replyMsg: ChatMsg | null; me: string; canReact: boolean; onActions: () => void; onRetry: () => void; onReact: (e: string) => void;
}) {
  const E = useEngine(); const { t } = E; const { c } = useTheme();
  const bg = mine ? c.accent : c.surface, fg = mine ? c.accentInk : c.ink, sub = mine ? withAlpha(c.accentInk === "#ffffff" ? "#ffffff" : "#111111", 0.7) : c.muted;
  const reacts = Object.entries(m.reactions).filter(([, u]) => u.length);
  const press = m.failed ? onRetry : Platform.OS === "web" ? onActions : undefined;
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginTop: showName ? 6 : 0 }}>
      {showName ? <Text style={{ fontSize: 12, fontWeight: "700", color: `hsl(${hue(m.uid || "x")}, 45%, 45%)`, marginLeft: 10, marginBottom: 2 }}>{m.name}</Text> : null}
      <Pressable testID={"msg-" + m.id} accessibilityRole="button" accessibilityLabel={(mine ? t("ch_you") : m.name) + ": " + (m.deleted ? t("ch_deleted") : m.body)}
        onPress={press} onLongPress={m.failed ? onRetry : onActions}
        style={{ maxWidth: "84%", backgroundColor: m.deleted ? "transparent" : bg, borderWidth: mine && !m.deleted ? 0 : 1, borderColor: c.line, borderRadius: 16,
          borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 4, opacity: m.pending ? 0.7 : 1 }}>
        {replyMsg !== null && m.replyTo ? <View style={{ borderLeftWidth: 3, borderLeftColor: mine ? withAlpha("#ffffff", 0.7) : c.accent, paddingLeft: 8, paddingVertical: 2, backgroundColor: withAlpha(mine ? "#ffffff" : c.accent, 0.12), borderRadius: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: mine ? fg : c.accentTx }}>{replyMsg ? (replyMsg.uid === me ? t("ch_you") : replyMsg.name) : "…"}</Text>
          <Text numberOfLines={2} style={{ fontSize: 13, color: sub }}>{replyMsg ? (replyMsg.deleted ? t("ch_deleted") : replyMsg.body) : "…"}</Text>
        </View> : null}
        {m.deleted ? <Text style={{ fontStyle: "italic", color: c.muted, fontSize: 14 }}>{t("ch_deleted")}</Text> : <Linkified text={m.body} color={fg} testID={"msg-body-" + m.id} />}
        <Row gap={4} style={{ alignSelf: "flex-end" }}>
          <Text style={{ fontSize: 11, color: m.deleted ? c.muted : sub }}>{m.pending ? t("ch_sending") : timeOf(m.at)}</Text>
          {mine && !m.pending && !m.failed && !m.deleted ? <Icon name="check" size={12} color={sub} /> : null}
        </Row>
      </Pressable>
      {m.failed ? <Pressable testID={"msg-retry-" + m.id} accessibilityRole="button" onPress={onRetry}><Text style={{ fontSize: 12, color: c.crit, fontWeight: "700", marginTop: 2 }}>{t("ch_failed")}</Text></Pressable> : null}
      {reacts.length ? <Row gap={4} wrap style={{ marginTop: -2, marginHorizontal: 6 }}>
        {reacts.map(([e, u]) => {
          const on = u.includes(me);
          return (
            <Pressable key={e} testID={`react-${m.id}-${e}`} accessibilityRole="button" accessibilityLabel={`${e} ${u.length}`} disabled={!canReact} onPress={() => onReact(e)}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? withAlpha(c.accent, 0.14) : c.surface }}>
              <Text style={{ fontSize: 13 }}>{e}</Text><Text style={{ fontSize: 12, fontWeight: "700", color: c.ink }}>{u.length}</Text>
            </Pressable>
          );
        })}
      </Row> : null}
    </View>
  );
}

function ActionSheet({ m, chat, me, canReply, canReact, onClose, onReply, onReport }: {
  m: ChatMsg | null; chat: Chat; me: string; canReply: boolean; canReact: boolean; onClose: () => void; onReply: (m: ChatMsg) => void; onReport: (m: ChatMsg) => void;
}) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setConfirm(false); }, [m?.id]);
  if (!m) return null;
  const mine = m.uid === me, alive = !m.deleted && !m.pending;
  const canDel = alive && (mine || (s.chatMod && (isObserver(chat, me, true) || isParticipant(s.D!, chat, me))));
  return (
    <Sheet visible onClose={onClose} title={t("ch_more")} testID="msg-actions" closeLabel={t("cancel")}>
      {!m.deleted ? <View style={{ borderLeftWidth: 3, borderLeftColor: c.line, paddingLeft: 10 }}><Muted small>{m.name}</Muted><T numberOfLines={4}>{m.body}</T></View> : null}
      {canReact && alive ? <Row gap={8} wrap testID="msg-react">
        {REACTIONS.map(e => {
          const on = (m.reactions[e] || []).includes(me);
          return <Pressable key={e} testID={"msg-react-" + e} accessibilityRole="button" accessibilityLabel={e} onPress={() => { s.chatReact(m, e); onClose(); }}
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: on ? withAlpha(c.accent, 0.2) : c.sunk }}><Text style={{ fontSize: 22 }}>{e}</Text></Pressable>;
        })}
      </Row> : null}
      <Col gap={8}>
        {canReply && alive ? <Btn testID="msg-reply" icon="reply" label={t("ch_reply")} onPress={() => onReply(m)} style={{ alignSelf: "stretch" }} /> : null}
        {!mine && alive ? <Btn testID="msg-report" icon="flag" label={t("ch_report")} onPress={() => onReport(m)} style={{ alignSelf: "stretch" }} /> : null}
        {m.failed ? <Btn testID="msg-retry" label={t("ch_failed")} onPress={() => { s.chatRetry(m); onClose(); }} /> : null}
        {canDel || m.failed ? (confirm || m.failed
          ? <Btn testID="msg-del-yes" kind="danger" icon="trash" label={m.failed ? t("ch_delete") : t("ch_deleteQ")} onPress={() => { s.chatDelete(m); onClose(); }} style={{ alignSelf: "stretch" }} />
          : <Btn testID="msg-del" icon="trash" label={t("ch_delete")} onPress={() => setConfirm(true)} style={{ alignSelf: "stretch" }} />) : null}
      </Col>
    </Sheet>
  );
}

function ReportSheet({ m, onClose }: { m: ChatMsg | null; onClose: () => void }) {
  const s = useStore(); const { t } = s.tr;
  const [reason, setReason] = useState<ChatReportReason>("mean"); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { setReason("mean"); setNote(""); }, [m?.id]);
  if (!m) return null;
  return (
    <Sheet visible onClose={onClose} title={t("ch_reportT")} testID="report-sheet" closeLabel={t("cancel")}>
      <View style={{ borderLeftWidth: 3, borderLeftColor: "#c8402a", paddingLeft: 10 }}><Muted small>{m.name}</Muted><T numberOfLines={6}>{m.body}</T></View>
      <ChoiceChips testID="report-reason" value={reason} onChange={setReason} options={REASONS.map(r => ({ key: r, label: t("ch_rr_" + r) }))} />
      <Field testID="report-note" label={t("ch_reportNote")} value={note} onChangeText={setNote} multiline maxLength={500} />
      <Banner>{t("ch_reportD")}</Banner>
      <Btn testID="report-send" kind="primary" icon="flag" label={t("ch_reportSend")} disabled={busy}
        onPress={async () => { setBusy(true); try { if (await s.chatReport(m, reason, note)) onClose(); } finally { setBusy(false); } }} />
    </Sheet>
  );
}

function ChatInfoSheet({ visible, chat, members, area, onClose }: { visible: boolean; chat: Chat; members: ChatPerson[]; area: Area; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const router = useRouter();
  const D = E.D, me = s.chatMeId, st = chatSettings(D.team), participant = isParticipant(D, chat, me);
  const staff = D.chatPeople.find(p => p.uid === me)?.kind === "staff";
  const sorted = [...members].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "staff" ? -1 : 1) || a.name.localeCompare(b.name));
  return (
    <Sheet visible={visible} onClose={onClose} title={chatTitle(chat, D, me, t)} testID="chat-info-sheet" closeLabel={t("cancel")}>
      {chat.transparent ? <Banner color="#3a6db5"><Col gap={2}><T v="small" bold>{t("ch_transparent")}</T><T v="small">{t("ch_transparentD")}</T></Col></Banner> : null}
      {participant ? <ToggleRow testID="chat-info-mute" label={t("ch_mute")} value={chat.muted} onChange={v => s.chatMute(chat.id, v)} /> : null}
      {s.chatMod && (chat.kind === "group" || chat.kind === "staff") ? <ToggleRow testID="chat-info-ro" label={t("ch_announce")} value={chat.readOnly} onChange={v => s.chatSetReadOnly(chat.id, v)} /> : null}
      {chat.kind === "team" && readOnlyOf(chat, st) ? <Banner>{t("ch_readOnlyNote")}</Banner> : null}
      {chat.kind === "custom" && (chat.createdBy === me || staff) && st.on ? <Btn testID="chat-info-edit" icon="eintragen" label={t("ch_editGroup")} onPress={() => { onClose(); router.push(`/${area}/chat-neu?edit=${chat.id}`); }} /> : null}
      <ChatFolderPick chat={chat} />
      <T v="eyebrow">{t("ch_members")} · {sorted.length}</T>
      <Col gap={0}>
        {sorted.slice(0, 80).map(p => <ListItem key={p.uid} left={<PersonAvatar p={p} size={32} />} title={p.uid === me ? `${p.name} (${t("ch_you")})` : p.name}
          sub={p.kind === "staff" ? (p.role ? t("sr_" + p.role) : t("ch_staffGroup")) : t("ch_playersGroup")} />)}
      </Col>
      {chat.kind === "custom" && chat.members.includes(me) ? <Btn testID="chat-info-leave" kind="danger" label={t("ch_leave")} onPress={async () => { onClose(); await s.chatLeave(chat.id); router.replace(`/${area}/chat`); }} style={{ alignSelf: "flex-start" }} /> : null}
      <T v="eyebrow">{t("ch_rules")}</T>
      <Col gap={4}>{[...E.tr.tl("ch_rulesL"), isYouth(D.team.cls) ? t("ch_rulesYouth") : ""].filter(Boolean).map((r, i) => <Muted key={i} small>• {r}</Muted>)}</Col>
    </Sheet>
  );
}

/** Info eines Chats: in eigene Ordner legen (sofort gespeichert) */
function ChatFolderPick({ chat }: { chat: Chat }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme(); const { F, save } = useFolders();
  const custom = F.custom || []; if (!custom.length) return null;
  const used = custom.reduce((a, f) => a + f.chats.length, 0);
  return (
    <Col gap={6} testID="chat-info-folders">
      <T v="eyebrow">{t("ch_fInfo")}</T>
      <Row wrap gap={6}>{custom.map(f => {
        const on = f.chats.includes(chat.id);
        return (
          <Pressable key={f.id} testID={"chat-info-folder-" + f.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
            onPress={() => { if (!on && used >= CF_LIMITS.ids) { s.toast(tf("ch_fLimit", { n: CF_LIMITS.ids })); return; }
              save({ ...F, custom: custom.map(x => x.id === f.id ? { ...x, chats: on ? x.chats.filter(y => y !== chat.id) : [...x.chats, chat.id] } : x) }); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface }}>
            <Icon name={on ? "check" : "plus"} size={13} color={on ? c.accentTx : c.muted} strokeWidth={2.4} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: on ? c.accentTx : c.ink }}>{f.name}</Text>
          </Pressable>
        );
      })}</Row>
    </Col>
  );
}

// ---------- Neuer Chat / eigene Gruppe ----------
export function NewChatScreen({ area }: { area: Area }) {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const D = E.D, me = s.chatMeId, st = chatSettings(D.team);
  const meP = D.chatPeople.find(p => p.uid === me), staff = meP?.kind === "staff";
  const existing = edit ? s.chats.find(x => x.id === edit && x.kind === "custom") : undefined;
  const [mode, setMode] = useState<"pick" | "group">(existing ? "group" : "pick");
  const [q, setQ] = useState(""); const [title, setTitle] = useState(existing?.title || "");
  const [members, setMembers] = useState<string[]>(() => (existing?.members || []).filter(u => u !== me));
  const [ro, setRo] = useState(!!existing?.readOnly); const [busy, setBusy] = useState(false);
  const go = (id: string | null) => { if (id) router.replace(`/${area}/chat/${id}`); };
  const open = async (kind: Chat["kind"], groupId?: string | null, other?: string | null) => { setBusy(true); try { go(await s.chatOpen(kind, groupId, other)); } finally { setBusy(false); } };
  const back = () => router.canGoBack() ? router.back() : router.replace(`/${area}/chat`);
  const match = (p: ChatPerson) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase());
  if (!st.on) return <Screen testID="chat-new"><Header title={t("ch_new")} onBack={back} backLabel={t("btn_back")} /><Banner>{t("ch_off")}</Banner></Screen>;

  if (mode === "group") {
    const people = D.chatPeople.filter(p => p.uid !== me && match(p));
    const toggle = (u: string, v: boolean) => setMembers(prev => v ? [...prev, u] : prev.filter(x => x !== u));
    const save = async () => { setBusy(true); try { go(await s.chatSaveCustom(existing?.id || null, title, members, ro)); } finally { setBusy(false); } };
    return (
      <Screen key="group" testID="chat-group">
        <Header title={existing ? t("ch_editGroup") : t("ch_newGroup")} onBack={existing ? back : () => setMode("pick")} backLabel={t("btn_back")} />
        <Card>
          <Field testID="grp-title" label={t("ch_groupName")} value={title} onChangeText={setTitle} placeholder={t("ch_groupNamePh")} maxLength={60} />
          {staff ? <ToggleRow testID="grp-ro" label={t("ch_announce")} value={ro} onChange={setRo} /> : null}
          {st.transparent && staff ? <Muted small>{t("ch_transparentD")}</Muted> : null}
        </Card>
        <Card>
          <CardTitle title={`${t("ch_members")} · ${members.length}`} />
          <Field testID="grp-search" label={t("ch_search")} value={q} onChangeText={setQ} />
          {(["staff", "player"] as const).map(k => {
            const L = people.filter(p => p.kind === k); if (!L.length) return null;
            return (
              <Col key={k} gap={8}>
                <T v="eyebrow">{k === "staff" ? t("ch_staffGroup") : t("ch_playersGroup")}</T>
                {k === "player" ? <Row gap={8}><Btn small testID="grp-all" label={"+ " + t("cg_all")} onPress={() => setMembers(prev => [...new Set([...prev, ...L.map(p => p.uid)])])} /></Row> : null}
                {L.map(p => <Check key={p.uid} testID={"grp-m-" + p.uid} label={<Row gap={8}><PersonAvatar p={p} size={26} /><T>{p.name}</T></Row>} value={members.includes(p.uid)} onChange={v => toggle(p.uid, v)} />)}
              </Col>
            );
          })}
        </Card>
        {!members.length ? <Muted small>{t("ch_pickOne")}</Muted> : null}
        <Btn testID="grp-save" kind="primary" label={existing ? t("ch_saveGroup") : t("ch_create")} disabled={busy || !title.trim() || !members.length} onPress={save} />
      </Screen>
    );
  }

  const groups = openableGroups(D, me), people = directTargets(D, me).filter(match);
  const dmHint = st.dm === "off" ? t("ch_dmOff") : st.dm === "staff" && !staff ? t("ch_dmStaffOnly") : "";
  return (
    <Screen key="pick" testID="chat-new">
      <Header title={t("ch_new")} onBack={back} backLabel={t("btn_back")} />
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        <ListItem testID="new-team" title={D.team.name || t("ch_team")} sub={t("ch_team")} left={<TeamLogo size={36} />} onPress={() => open("team")} />
        {staff ? <ListItem testID="new-staff" title={t("ch_staff")} sub={tf("ch_membersN", { n: D.chatPeople.filter(p => p.kind === "staff").length })} left={<View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Icon name="kader" size={18} color="#fff" /></View>} onPress={() => open("staff")} /> : null}
        {groups.map(g => <ListItem key={g.id} testID={"new-group-" + g.id} title={g.name} sub={t("ch_groupOnlyMembers")}
          left={<View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `hsl(${hue(g.id)}, 42%, 42%)`, alignItems: "center", justifyContent: "center" }}><Icon name="people" size={18} color="#fff" /></View>} onPress={() => open("group", g.id)} />)}
      </Card>
      {canCustom(D, me) ? <Btn testID="new-custom" icon="plus" label={t("ch_newGroup")} onPress={() => setMode("group")} style={{ alignSelf: "flex-start" }} /> : null}
      <Card>
        <CardTitle title={t("ch_people")} />
        {dmHint ? <Banner testID="new-dmhint">{dmHint}</Banner> : null}
        {st.dm !== "off" ? <Field testID="new-search" label={t("ch_search")} value={q} onChangeText={setQ} /> : null}
        <Col gap={0}>
          {people.map(p => <ListItem key={p.uid} testID={"new-dm-" + p.uid} left={<PersonAvatar p={p} size={36} />} title={p.name}
            sub={p.kind === "staff" ? (p.role ? t("sr_" + p.role) : t("ch_staffGroup")) : t("ch_playersGroup")} onPress={() => { if (!busy) open("direct", null, p.uid); }} />)}
          {!people.length && st.dm !== "off" ? <Muted>{t("ch_noPeople")}</Muted> : null}
        </Col>
        {st.transparent ? <Row gap={6}><Icon name="eye" size={14} color={c.muted} /><Muted small style={{ flex: 1 }}>{t("ch_transparentD")}</Muted></Row> : null}
        <Muted small>{t("ch_noAccount")}</Muted>
      </Card>
    </Screen>
  );
}

// ---------- Meldungen (Trainerteam mit Recht „Nachrichten“) ----------
export function ReportsScreen() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const [tab, setTab] = useState<"open" | "done">("open");
  const D = E.D, me = s.chatMeId;
  const L = D.chatReports.filter(r => r.status === tab);
  const nameOf = (uid: string) => D.chatPeople.find(p => p.uid === uid)?.name || "–";
  return (
    <Screen testID="chat-reports-screen">
      <Header title={t("ch_reports")} onBack={() => router.canGoBack() ? router.back() : router.replace("/coach/chat")} backLabel={t("btn_back")} info={<Info title={t("ch_reports")} text={[t("ch_rInfo"), t("ch_reportD")]} />} />
      <Seg testID="rep-tab" value={tab} onChange={setTab} options={[{ key: "open", label: `${t("ch_rOpen")} · ${D.chatReports.filter(r => r.status === "open").length}` }, { key: "done", label: t("ch_rDoneList") }]} />
      {L.length ? L.map(r => {
        const msg = r.chatId && r.msgId ? (D.chatMsgs[r.chatId] || []).find(m => m.id === r.msgId) : undefined, chat = r.chatId ? s.chats.find(x => x.id === r.chatId) : undefined;
        return (
          <Card key={r.id} testID={"rep-" + r.id} tone={r.status === "open" ? c.crit : undefined}>
            <Row between wrap gap={8}>
              <Row gap={8} wrap><Tag label={t("ch_rr_" + r.reason)} />{chat ? <Muted small>{chatTitle(chat, D, me, t)}</Muted> : null}</Row>
              <Muted small>{E.de(dayOf(r.at))} {timeOf(r.at)}</Muted>
            </Row>
            <View style={{ borderLeftWidth: 3, borderLeftColor: c.crit, paddingLeft: 10, gap: 2 }}>
              <Muted small>{tf("ch_rFrom", { name: r.sender, d: r.sentAt ? `${E.de(dayOf(r.sentAt))} ${timeOf(r.sentAt)}` : "" })}</Muted>
              <T selectable>{r.snapshot || "–"}</T>
            </View>
            {r.note ? <Muted small>„{r.note}“</Muted> : null}
            <Muted small>{tf("ch_rBy", { name: nameOf(r.reporter) })}</Muted>
            {msg?.deleted || (!msg && r.msgId == null) ? <Muted small>{t("ch_rGone")}</Muted> : null}
            <Row wrap gap={8}>
              {chat ? <Btn small testID={"rep-open-" + r.id} label={t("ch_rOpenChat")} onPress={() => router.push("/coach/chat/" + chat.id)} /> : null}
              {msg && !msg.deleted ? <Btn small kind="danger" testID={"rep-del-" + r.id} icon="trash" label={t("ch_rDelete")} onPress={() => s.chatDelete(msg)} /> : null}
              <Btn small kind={r.status === "open" ? "primary" : "default"} testID={"rep-done-" + r.id} label={r.status === "open" ? t("ch_rDone") : t("ch_rReopen")} onPress={() => s.chatSetReport(r.id, r.status === "open")} />
            </Row>
          </Card>
        );
      }) : <Muted>{t("ch_reportsNone")}</Muted>}
    </Screen>
  );
}

// ---------- Einstellungen (Baukasten) ----------
export function ChatSettingsCard() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const team = E.team, st: ChatSettings = chatSettings(team), def = chatDefaults(team.cls), youth = isYouth(team.cls);
  const set = (p: Partial<ChatSettings>) => s.updateTeam({ settings: { ...team.settings, chat: { ...st, ...p } } });
  if (!team.modules.chat) return null;
  return (
    <Card testID="bk-chat">
      <CardTitle title={t("ch_settings")} info={<Info title={t("ch_settings")} text={[t("ch_info"), t("ch_transparentD")]} />} right={youth ? <Tag label={t("ch_youthBadge")} /> : undefined} />
      <ToggleRow testID="chs-on" label={t("ch_setOn")} desc={t("ch_setOnD")} value={st.on} onChange={v => set({ on: v })} />
      {st.on ? <>
        <Col gap={6}>
          <T v="small" bold>{t("ch_setDm")}</T>
          <Seg testID="chs-dm" value={st.dm} onChange={(v: ChatSettings["dm"]) => set({ dm: v })} options={(["off", "staff", "all"] as const).map(k => ({ key: k, label: t("ch_dm_" + k) }))} wrap />
          <Muted small>{t("ch_setDmD")}{st.dm === def.dm ? " · " + (youth ? t("ch_youthDefault") : t("ch_seniorDefault")) : ""}</Muted>
        </Col>
        <ToggleRow testID="chs-transp" label={t("ch_setTransp")} desc={t("ch_setTranspD")} value={st.transparent} onChange={v => set({ transparent: v })} />
        {youth && !st.transparent ? <Banner color={c.warn}>{t("ch_setTranspWarn")}</Banner> : null}
        <ToggleRow testID="chs-ro" label={t("ch_setRo")} desc={t("ch_setRoD")} value={st.teamReadOnly} onChange={v => set({ teamReadOnly: v })} />
      </> : null}
    </Card>
  );
}
