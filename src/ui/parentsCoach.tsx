// Eltern-Zugang – Seite fürs Trainerteam: Anfragen bestätigen, Eltern je Kind einladen (Code nur einmal sichtbar,
// 14 Tage, höchstens zwei Elternteile), Verknüpfungen lösen, Einwilligungen der Eltern (unter 16) sehen und Elterninfo
// schreiben (wer gelesen bzw. bestätigt hat). Regeln: core/parents; Prüfung auf dem Server (Migration 20261105000009).
import React, { useState } from "react";
import { Text, View } from "react-native";
import { validBirth } from "../core/birthdays";
import { cleanPost, guardianState, isMinor, isUnder16, MAX_GUARDIANS, pendingGuardians, postStats, POST_BODY_MAX, POST_TITLE_MAX } from "../core/parents";
import type { GuardianLink, ParentPost, Player } from "../core/types";
import { shareOrCopy } from "../data/files";
import { inviteUrl } from "../data/invite";
import { tmpId, useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Btn, Card, CardTitle, Check, Col, Field, Header, Info, ListItem, Muted, Row, Screen, Seg, Sheet, T } from "./kit";
import { useNavBack } from "./nav";
import { PlayerAvatar } from "./playerAvatar";
import { QrCode } from "./qr";
import { useTheme } from "./theme";

type E_ = ReturnType<typeof useEngine>;
const dayOf = (iso: string | null | undefined, lang: "de" | "en"): string => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
};

// =====================================================================
// Seite: Eltern-Zugang (Trainerteam)
// =====================================================================
export function ParentsPage() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const nb = useNavBack("eltern");
  const [tab, setTab] = useState<"kids" | "posts">("kids");
  const [kid, setKid] = useState<string | null>(null);
  if (E.mods.eltern === false) return <Screen testID="coach-eltern"><Header title={t("el_coachTitle")} onBack={nb.onBack} backLabel={nb.backLabel} /><Muted>{t("el_modOff")}</Muted></Screen>;
  const canEdit = s.can("squad");
  const D = E.D, today = E.TODAY;
  const pending = pendingGuardians(D);
  const players = D.players.filter(p => p.active !== false).sort((a, b) => E.name(a).localeCompare(E.name(b), "de"));
  const minors = players.filter(p => isMinor(p, today)), noBirth = players.filter(p => !validBirth(p.geb, today));
  const adults = players.filter(p => validBirth(p.geb, today) && !isMinor(p, today) && D.guardians.some(g => g.pid === p.id));
  const linked = minors.filter(p => D.guardians.some(g => g.pid === p.id && g.status === "active")).length;
  return (
    <Screen testID="coach-eltern">
      <Header title={t("el_coachTitle")} sub={t("el_coachSub")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("el_coachTitle")} text={t("el_coachInfo")} />} />
      {pending.length ? <PendingCard links={pending} canEdit={canEdit} /> : null}
      <Seg testID="el-tab" value={tab} onChange={setTab} options={[{ key: "kids", label: tf("el_tabKids", { n: minors.length }) }, { key: "posts", label: tf("el_tabPosts", { n: D.parentPosts.length }) }]} />
      {tab === "kids" ? (
        <>
          <Card testID="el-kids-list">
            <CardTitle title={t("el_kidsTitle")} />
            <Muted small testID="el-kids-count">{tf("el_kidsCount", { a: linked, b: minors.length })}</Muted>
            {!minors.length ? <Muted>{t("el_kidsNone")}</Muted> : minors.map(p => <KidRow key={p.id} p={p} E={E} onPress={() => setKid(p.id)} />)}
          </Card>
          {noBirth.length ? (
            <Card testID="el-nobirth">
              <CardTitle title={tf("el_noBirthT", { n: noBirth.length })} />
              <Muted small>{t("el_noBirth")}</Muted>
              <Muted small>{noBirth.map(p => E.name(p)).join(", ")}</Muted>
            </Card>
          ) : null}
          {adults.length ? (
            <Card testID="el-adults">
              <CardTitle title={t("el_adultsT")} />
              <Muted small>{t("el_adults")}</Muted>
              {adults.map(p => <KidRow key={p.id} p={p} E={E} onPress={() => setKid(p.id)} />)}
            </Card>
          ) : null}
        </>
      ) : <PostsTab canEdit={canEdit} />}
      <Card testID="el-coach-privacy">
        <CardTitle title={t("el_seeCoachT")} />
        <T v="small">{t("el_seeCoach")}</T>
        <Muted small>{t("el_notSeeCoach")}</Muted>
      </Card>
      <Sheet visible={!!kid} onClose={() => setKid(null)} title={kid ? E.name(E.P(kid)!) : ""} testID="el-kid-sheet" closeLabel={t("close")}>
        {kid ? <KidSheet key={kid} pid={kid} canEdit={canEdit} /> : null}
      </Sheet>
    </Screen>
  );
}

/** Anfragen, die auf Bestätigung warten */
function PendingCard({ links, canEdit }: { links: GuardianLink[]; canEdit: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  return (
    <Card testID="el-requests" tone={c.warn}>
      <CardTitle title={tf(links.length === 1 ? "el_req1" : "el_reqN", { n: links.length })} />
      {links.map(g => {
        const p = E.P(g.pid);
        return (
          <Col key={g.id} gap={6} testID={"el-req-" + g.id} style={{ paddingVertical: 6 }}>
            <T bold>{tf("el_reqWho", { g: g.name, r: t("el_rel_" + g.relation), n: p ? E.name(p) : "–" })}</T>
            <Muted small>{tf("el_reqWhen", { d: dayOf(g.at, E.tr.lang) })}</Muted>
            {canEdit ? (
              <Row gap={8} wrap>
                <Btn small kind="primary" testID={"el-req-ok-" + g.id} label={t("el_reqOk")} onPress={() => s.guardianDecide(g.id, true)} />
                <Btn small testID={"el-req-no-" + g.id} label={t("el_reqNo")} onPress={() => s.guardianDecide(g.id, false)} />
              </Row>
            ) : null}
          </Col>
        );
      })}
      <Muted small>{canEdit ? t("el_reqHint") : t("el_reqView")}</Muted>
    </Card>
  );
}

function KidRow({ p, E, onPress }: { p: Player; E: E_; onPress: () => void }) {
  const { t, tf } = E; const { c } = useTheme();
  const st = guardianState(E.D, p.id, E.TODAY), act = st.links.filter(g => g.status === "active");
  const gc = E.D.guardianConsents[p.id], u16 = isUnder16(p, E.TODAY);
  const parts = [
    act.length ? act.map(g => g.name).join(", ") : st.pending ? "" : st.invite ? tf("el_codeUntil", { d: dayOf(st.invite.expires, E.tr.lang) }) : t("el_nobody"),
    st.pending ? tf("el_waitingN", { n: st.pending }) : "",
    u16 && act.length ? (gc?.parental ? t("el_cParentalOk") : t("el_cParentalMissing")) : "",
    st.minor ? "" : st.links.some(g => g.adultOk) ? t("el_adultKept") : t("el_adultEnds"),
  ].filter(Boolean);
  return (
    <ListItem testID={"el-kid-" + p.id} title={E.name(p)} left={<PlayerAvatar p={p} size={32} />} sub={parts.join(" · ")} onPress={onPress}
      right={<Row gap={6}>
        {act.length ? <Text style={{ fontSize: 13, fontWeight: "800", color: c.ok }}>{`${act.length}/${MAX_GUARDIANS}`}</Text> : null}
        {st.pending ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.warn }} /> : null}
        <Icon name="chevron" size={18} color={c.muted} />
      </Row>} />
  );
}

/** Blatt je Kind: verknüpfte Eltern, Einladung, Einwilligungen */
function KidSheet({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [code, setCode] = useState<{ code: string; expires: string } | null>(null);
  const [busy, setBusy] = useState(false); const [sure, setSure] = useState<string | null>(null);
  const p = E.P(pid);
  if (!p) return null;
  const st = guardianState(E.D, pid, E.TODAY), gc = E.D.guardianConsents[pid], u16 = isUnder16(p, E.TODAY);
  const invite = async () => { setBusy(true); try { const r = await s.guardianInvite(pid); if (r) setCode(r); } finally { setBusy(false); } };
  const shareText = (x: { code: string; expires: string }) => tf("el_shareText", { n: p.vn, t: E.team.name, c: x.code, d: dayOf(x.expires, E.tr.lang), l: inviteUrl("parent", x.code) });
  const share = async (x: { code: string; expires: string }) => {
    try { const r = await shareOrCopy(shareText(x), `Eltern-Code_${p.vn}.txt`); if (r === "copied") s.toast(t("el_copied")); } catch { /* abgebrochen */ }
  };
  return (
    <Col gap={14}>
      <Muted small>{st.birth ? tf("el_kidAge", { n: E.age(p) }) + (st.minor ? "" : " · " + t("el_kidAdult")) : t("el_kidNoBirth")}</Muted>
      <Col gap={8} testID="el-kid-links">
        <T v="small" bold>{t("el_linked")}</T>
        {!st.links.length ? <Muted>{t("el_nobody")}</Muted> : st.links.map(g => (
          <Col key={g.id} gap={6} testID={"el-link-" + g.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.line }}>
            <Row gap={8}><T bold style={{ flex: 1 }}>{g.name}</T>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: g.status === "active" ? c.ok : c.warn }}>{t(g.status === "active" ? "el_active" : "el_waiting")}</Text></Row>
            <Muted small>{t("el_rel_" + g.relation) + " · " + (g.status === "active" ? tf("el_since", { d: dayOf(g.confirmedAt || g.at, E.tr.lang) }) : tf("el_reqWhen", { d: dayOf(g.at, E.tr.lang) }))
              + (!st.minor && g.adultOk ? " · " + t("el_adultKept") : "")}</Muted>
            {canEdit ? (g.status === "pending" ? (
              <Row gap={8} wrap>
                <Btn small kind="primary" testID={"el-kid-ok-" + g.id} label={t("el_reqOk")} onPress={() => s.guardianDecide(g.id, true)} />
                <Btn small testID={"el-kid-no-" + g.id} label={t("el_reqNo")} onPress={() => s.guardianDecide(g.id, false)} />
              </Row>
            ) : sure === g.id ? (
              <Row gap={8} wrap>
                <Btn small kind="danger" testID={"el-kid-del-ok-" + g.id} label={t("el_removeOk")} onPress={async () => { if (await s.guardianRemove(g.id)) setSure(null); }} />
                <Btn small kind="ghost" label={t("um_cancel")} onPress={() => setSure(null)} />
              </Row>
            ) : <Btn small kind="ghost" testID={"el-kid-del-" + g.id} label={t("el_remove")} onPress={() => setSure(g.id)} style={{ alignSelf: "flex-start" }} />) : null}
          </Col>
        ))}
      </Col>
      {u16 && st.links.some(g => g.status === "active") ? (
        <Col gap={4} testID="el-kid-consents">
          <T v="small" bold>{t("el_kidConsents")}</T>
          <Muted small>{`${t("el_cParental")}: ${gc?.parental ? t("el_cOn") : t("el_cOff")} · ${t("el_cHealth")}: ${gc?.health ? t("el_cOn") : t("el_cOff")}`}</Muted>
        </Col>
      ) : null}
      {code ? (
        <Col gap={10} testID="el-code-box" style={{ alignItems: "center", paddingVertical: 6 }}>
          <QrCode value={inviteUrl("parent", code.code)} size={196} label={tf("el_qr", { n: p.vn })} testID="el-code-qr" />
          <Text selectable testID="el-code-value" style={{ fontSize: 24, fontWeight: "800", letterSpacing: 2, color: c.ink, fontVariant: ["tabular-nums"] }}>{code.code}</Text>
          <Muted small style={{ textAlign: "center" }}>{tf("el_codeOnce", { d: dayOf(code.expires, E.tr.lang), n: Math.max(0, MAX_GUARDIANS - st.links.length) })}</Muted>
          <Btn kind="primary" icon="send" testID="el-code-share" label={t("el_codeShare")} onPress={() => share(code)} />
          <Muted small style={{ textAlign: "center" }}>{tf("el_codeDirect", { n: p.vn })}</Muted>
        </Col>
      ) : canEdit && st.canInvite ? (
        <Col gap={8} testID="el-kid-invite">
          {st.invite ? <Muted small>{tf("el_codeActive", { d: dayOf(st.invite.expires, E.tr.lang), n: st.invite.usesLeft })}</Muted> : null}
          <Btn kind={st.invite ? "default" : "primary"} testID="el-invite" label={t(st.invite ? "el_codeNew" : "el_codeCreate")} disabled={busy} onPress={invite} style={{ alignSelf: "flex-start" }} />
          <Muted small>{t("el_codeHint")}</Muted>
        </Col>
      ) : canEdit && st.minor ? <Muted small>{t("el_full")}</Muted>
        : canEdit && !st.birth ? <Banner color={c.warn}>{t("el_needBirth")}</Banner> : null}
    </Col>
  );
}

// =====================================================================
// Elterninfo: schreiben, ändern, löschen; wer gelesen bzw. bestätigt hat
// =====================================================================
function PostsTab({ canEdit }: { canEdit: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [edit, setEdit] = useState<ParentPost | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const posts = [...E.D.parentPosts].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const name = (pid: string) => { const p = E.P(pid); return p ? E.name(p) : "–"; };
  return (
    <Card testID="el-posts-coach">
      <CardTitle title={t("el_posts")} right={canEdit ? <Btn small kind="primary" icon="plus" testID="el-post-new" label={t("el_postNew")}
        onPress={() => setEdit({ id: tmpId(), title: "", body: "", needAck: false, author: "", at: "" })} /> : null} />
      <Muted small>{t("el_postsCoach")}</Muted>
      {!posts.length ? <Muted>{t("el_postsNone")}</Muted> : posts.map((p, i) => {
        const k = postStats(E.D, p, E.TODAY), miss = [...new Set(k.missing.map(g => g.pid))];
        return (
          <Col key={p.id} gap={6} testID={"el-cpost-" + p.id} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Row gap={8}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: c.ink }} onPress={() => setOpen(open === p.id ? null : p.id)}>{p.title}</Text>
              <Btn small kind="ghost" testID={"el-cpost-open-" + p.id} label={open === p.id ? t("el_postClose") : t("el_postOpen")} onPress={() => setOpen(open === p.id ? null : p.id)} />
            </Row>
            <Muted small testID={"el-cpost-stat-" + p.id}>{[p.author, dayOf(p.at, E.tr.lang), tf(p.needAck ? "el_statAck" : "el_statRead", { a: p.needAck ? k.acked : k.read, b: k.total })].filter(Boolean).join(" · ")}</Muted>
            {open === p.id ? (
              <Col gap={8}>
                <T v="small" selectable>{p.body}</T>
                {miss.length ? <Muted small testID={"el-cpost-miss-" + p.id}>{tf(p.needAck ? "el_missAck" : "el_missRead", { n: miss.map(name).join(", ") })}</Muted> : k.total ? <Muted small>{t("el_missNone")}</Muted> : null}
                {canEdit ? (sure === p.id ? (
                  <Row gap={8} wrap>
                    <Btn small kind="danger" testID={"el-cpost-del-ok-" + p.id} label={t("el_postDelete")} onPress={async () => { if (await s.deleteParentPost(p.id)) setSure(null); }} />
                    <Btn small kind="ghost" label={t("um_cancel")} onPress={() => setSure(null)} />
                  </Row>
                ) : (
                  <Row gap={8} wrap>
                    <Btn small testID={"el-cpost-edit-" + p.id} label={t("el_postEdit")} onPress={() => setEdit(p)} />
                    <Btn small kind="ghost" testID={"el-cpost-del-" + p.id} label={t("el_postDelete")} onPress={() => setSure(p.id)} />
                  </Row>
                )) : null}
              </Col>
            ) : null}
          </Col>
        );
      })}
      <Muted small>{t("el_postsKeep")}</Muted>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit && !edit.id.startsWith("tmp-") ? t("el_postEdit") : t("el_postNew")} testID="el-post-sheet" closeLabel={t("um_cancel")}>
        {edit ? <PostForm key={edit.id} post={edit} onDone={() => setEdit(null)} /> : null}
      </Sheet>
    </Card>
  );
}

function PostForm({ post, onDone }: { post: ParentPost; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [title, setTitle] = useState(post.title), [body, setBody] = useState(post.body), [ack, setAck] = useState(post.needAck);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(false);
  const x = cleanPost({ ...post, title, body, needAck: ack }), isNew = post.id.startsWith("tmp-");
  const save = async () => {
    if (!x.title || !x.body) { setErr(true); return; }
    setBusy(true); try { if (await s.saveParentPost(x)) onDone(); } finally { setBusy(false); }
  };
  return (
    <Col gap={12}>
      <Field testID="el-post-title" label={t("el_postTitle")} placeholder={t("el_postTitlePh")} value={title} onChangeText={v => { setTitle(v); setErr(false); }} maxLength={POST_TITLE_MAX} />
      <Field testID="el-post-body" label={t("el_postBody")} placeholder={t("el_postBodyPh")} value={body} onChangeText={v => { setBody(v); setErr(false); }} multiline maxLength={POST_BODY_MAX}
        hint={tf("el_postLen", { n: body.length, m: POST_BODY_MAX })} />
      <Check testID="el-post-ack" label={t("el_postAck")} value={ack} onChange={setAck} />
      <Muted small>{t("el_postPrivacy")}</Muted>
      {!isNew ? <Muted small>{t("el_postEditHint")}</Muted> : null}
      {err ? <Banner color={c.crit} testID="el-post-err">{t("el_postErr")}</Banner> : null}
      <Btn kind="primary" testID="el-post-save" label={t(isNew ? "el_postSend" : "save")} disabled={busy} onPress={save} />
    </Col>
  );
}
