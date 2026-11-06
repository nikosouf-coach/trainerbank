// Fahrgemeinschaften – Oberfläche: Seite zu einem Spiel bzw. Termin (Fahrten mit Plätzen und Mitfahrern, Suchende;
// Spieler bieten die eigene Fahrt an, fahren mit oder suchen; Fahrer nehmen Suchende mit; das Trainerteam ordnet zu,
// legt eigene Fahrten an und teilt den Stand im Teamchat), Karten für beide Startseiten, Karte und Zeile für Spiel-
// und Tagesseite, Verweis im Kalender der Spieler. Regeln: core/rides (prüft auch der Server).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { absentOn, cleanTime } from "../core/nomination";
import {
  RIDE_LIMITS, assignable, defaultDepart, driverLabel, driverText, driverWho, freeSeats, needsOf, refById, refOf, refTitle, rideActive, rideName,
  rideRefsAhead, rideStatus, rideSummary, rideableEvent, ridesOf, ridesText, seatsOf, squadMeet, withoutRide,
  type DriverWho, type RideRef, type RideSummary,
} from "../core/rides";
import type { Ride, RideKind } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Icon } from "./icons";
import { Banner, Btn, Card, CardTitle, ChoiceChips, Chip, Col, Field, Fold, Header, IconTile, Info, Muted, Picker, Row, Screen, Sheet, T, TimeField } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { announceChat } from "./polls";
import { radius, useTheme, withAlpha } from "./theme";

type E_ = ReturnType<typeof useEngine>;
export type RideArea = "coach" | "player";

/** Seite der Fahrgemeinschaften zu einem Spiel bzw. Termin */
export const ridesHref = (area: RideArea, ref: Pick<RideRef, "kind" | "id">): string => `/${area}/fahrten/${ref.id}?k=${ref.kind}`;

/** „2 Fahrten · 3 frei · 1 sucht“ bzw. „Noch keine Fahrten“ */
export function summaryText(E: E_, x: RideSummary): string {
  const { t, tf } = E;
  if (!x.rides && !x.need) return t("fg_none");
  const L = [x.rides === 1 ? t("fg_rides1") : tf("fg_ridesN", { n: x.rides })];
  if (x.rides) L.push(x.free ? (x.free === 1 ? t("fg_freeShort1") : tf("fg_freeShortN", { n: x.free })) : t("fg_full"));
  if (x.need) L.push(x.need === 1 ? t("fg_need1") : tf("fg_needN", { n: x.need }));
  return L.join(" · ");
}
/** „Sa. 14.11. · 15:00 · Auswärts“ */
export const refLine = (E: E_, ref: RideRef): string =>
  [`${E.wt(ref.date)} ${E.de(ref.date)}`, ref.time, ref.kind === "match" ? (ref.away ? E.t("away") : E.t("home")) : ""].filter(Boolean).join(" · ");
/** Abfahrt: „13:15 Uhr · Parkplatz am Vereinsheim“ */
const departLine = (E: E_, r: { time: string | null; place: string }): string => [r.time ? E.tf("nm_clock", { t: r.time }) : "", r.place].filter(Boolean).join(" · ");
const freeLabel = (E: E_, n: number): string => n ? (n === 1 ? E.t("fg_freeShort1") : E.tf("fg_freeShortN", { n })) : E.t("fg_full");

/** Stand eines Spielers in einem Satz (Startseite, eigene Karte) */
function statusLine(E: E_, refId: string, pid: string): { text: string; role: "driver" | "seat" | "need" | null } {
  const st = rideStatus(E.D, refId, pid), { t, tf } = E;
  if (st.role === "driver") return { role: st.role, text: tf("fg_stDriver", { s: st.ride.seats, t: seatsOf(E.D, st.ride.id).length }) };
  if (st.role === "seat") return { role: st.role, text: tf("fg_stSeat", { d: driverLabel(E.D, st.ride, false, E.tr) }) };
  return { role: st.role, text: st.role === "need" ? t("fg_stNeed") : t("fg_stNone") };
}

// =====================================================================
// Seite: Fahrgemeinschaften zu einem Spiel bzw. Termin (Trainerteam und Spieler)
// =====================================================================
export function RidesPage({ area }: { area: RideArea }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "", k } = useLocalSearchParams<{ id: string; k?: string }>();
  const target = k === "match" || k === "event" ? refOf(E.D, k, id) : refById(E.D, id);
  const staff = area === "coach", me = staff ? null : s.mePid || null;
  const [draft, setDraft] = useState<Ride | null>(null);
  const [assign, setAssign] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [askDel, setAskDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = () => router.canGoBack() ? router.back() : router.replace(staff ? "/coach/kalender" : "/player/kalender");
  if (!target || E.mods.fahrten === false) {
    return <Screen testID="rides-page"><Header title={t("fg_title")} onBack={back} backLabel={t("btn_back")} /><Muted>{t("err_not_found")}</Muted></Screen>;
  }
  const past = target.date < E.TODAY;
  const R = ridesOf(E.D, target.id), sum = rideSummary(E.D, target.id), need = needsOf(E.D, target.id);
  const st = me ? rideStatus(E.D, target.id, me) : null;
  const myRide = st && st.role === "driver" ? st.ride : null, canTake = !past && !!myRide && freeSeats(E.D, myRide) > 0;
  const name = (pid: string) => rideName(E.D, pid, staff);
  const chat = staff && E.mods.chat !== false ? announceChat(s.chats, { groupId: null }) : null;
  const run = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); } finally { setBusy(false); } };
  const fresh = (driverPid: string | null): Ride => ({ id: tmpId(), kind: target.kind, refId: target.id, driverPid, driver: "", seats: 3, time: defaultDepart(target) || null, place: "", note: "" });
  const share = () => run(async () => {
    if (!chat) return;
    await s.chatSend(chat.id, ridesText(E.D, target, `${E.wt(target.date)} ${E.de(target.date)}`, E.tr));
    s.toast(t("fg_shared"));
  });
  const without = staff && !past ? withoutRide(E.D, target) : [];
  const withFree = R.filter(r => freeSeats(E.D, r) > 0);

  const meCard = me && st ? (() => {
    const line = statusLine(E, target.id, me), tone = line.role === "need" ? c.warn : line.role ? c.ok : c.accentTx;
    return (
      <Card testID="fg-me" tone={tone}>
        <T v="eyebrow">{t("fg_meTitle")}</T>
        <Text testID="fg-me-status" style={{ fontSize: 16, fontWeight: "800", color: line.role ? tone : c.ink }}>{line.text}</Text>
        {st.role === "driver" || st.role === "seat" ? (
          <Muted small>{[st.role === "driver" ? driverLabel(E.D, st.ride, false, E.tr) : "", departLine(E, st.ride) ? `${t("fg_depart")}: ${departLine(E, st.ride)}` : ""].filter(Boolean).join(" · ")}</Muted>
        ) : null}
        {st.role === "need" ? <Muted small>{t("fg_stNeedHint")}</Muted> : null}
        {st.role === null ? <Muted small>{t("fg_stNoneHint")}</Muted> : null}
        {absentOn(E.D, me, target.date) ? <Muted small>{t("fg_meAbsent")}</Muted> : null}
        {past ? null : st.role === "seat" ? (
          <Btn small kind="ghost" testID="fg-me-leave" label={t("fg_leave")} disabled={busy} onPress={() => run(() => s.leaveRide(st.ride.id, me, false))} style={{ alignSelf: "flex-start" }} />
        ) : st.role === "need" ? (
          <Btn small kind="ghost" testID="fg-me-needoff" label={t("fg_needOff")} disabled={busy} onPress={() => run(() => s.setRideNeed(target.kind, target.id, me, false))} style={{ alignSelf: "flex-start" }} />
        ) : st.role === null ? (
          <Row wrap gap={10}>
            <Btn small kind="primary" icon="car" testID="fg-me-offer" label={t("fg_offer")} onPress={() => setDraft(fresh(me))} />
            <Btn small testID="fg-me-need" label={t("fg_need")} disabled={busy} onPress={() => run(() => s.setRideNeed(target.kind, target.id, me, true))} />
          </Row>
        ) : null}
      </Card>
    );
  })() : null;

  const rideCard = (r: Ride) => {
    const pax = seatsOf(E.D, r.id), free = Math.max(0, r.seats - pax.length), mine = !!me && r.driverPid === me, here = !!me && pax.includes(me);
    const manage = !past && (staff || mine), dep = departLine(E, r);
    const tone = mine || here ? c.ok : null;
    return (
      <Card key={r.id} testID={"fg-ride-" + r.id} style={tone ? { borderWidth: 1.5, borderColor: withAlpha(tone, 0.55) } : undefined}>
        <Row gap={12} align="flex-start">
          <IconTile name="car" color={free ? c.ok : c.muted} size={38} />
          <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text testID={"fg-driver-" + r.id} numberOfLines={2} style={{ fontSize: 16, fontWeight: "800", color: c.ink }}>{driverLabel(E.D, r, staff, E.tr)}</Text>
            {staff && r.driverPid && r.driver ? <Muted small>{tf("fg_forWhom", { n: name(r.driverPid) })}</Muted> : null}
            {dep ? <Muted small>{`${t("fg_depart")}: ${dep}`}</Muted> : null}
            {r.note ? <Muted small>{r.note}</Muted> : null}
          </Col>
          <Chip testID={"fg-free-" + r.id} label={freeLabel(E, free)} color={free ? c.ok : c.muted} />
        </Row>
        <View testID={"fg-pax-" + r.id} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {pax.map(pid => {
            const ab = absentOn(E.D, pid, target.date), rm = manage && pid !== me;
            return (
              <View key={pid} testID={`fg-pax-${r.id}-${pid}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingLeft: 10, paddingRight: rm ? 6 : 10, borderRadius: radius.pill, backgroundColor: withAlpha(ab ? c.crit : c.ok, 0.12) }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.ink }}>{name(pid) + (pid === me ? ` (${t("fg_you")})` : "") + (ab ? ` · ${t("fg_absent")}` : "")}</Text>
                {rm ? (
                  <Pressable testID={`fg-rm-${r.id}-${pid}`} accessibilityRole="button" accessibilityLabel={tf("fg_removeA", { n: name(pid) })} hitSlop={8} disabled={busy}
                    onPress={() => run(() => s.leaveRide(r.id, pid, true))} style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(c.ink, 0.06) }}>
                    <Icon name="close" size={12} color={c.muted} strokeWidth={2.6} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {!pax.length ? <Muted small>{t("fg_noPassengers")}</Muted> : null}
        </View>
        {!past && (me || staff) ? (
          <Row wrap gap={8}>
            {me && !mine && !here && st?.role !== "driver" && free ? (
              <Btn small kind="primary" testID={"fg-join-" + r.id} label={st?.role === "seat" ? t("fg_switch") : t("fg_join")} disabled={busy} onPress={() => run(() => s.joinRide(r.id, me))} />
            ) : null}
            {here ? <Btn small kind="ghost" testID={"fg-leave-" + r.id} label={t("fg_leave")} disabled={busy} onPress={() => run(() => s.leaveRide(r.id, me!, false))} /> : null}
            {staff && free ? <Btn small icon="plus" testID={"fg-assign-" + r.id} label={t("fg_assign")} onPress={() => setAssign(r.id)} /> : null}
            {manage ? <Btn small kind="ghost" testID={"fg-edit-" + r.id} label={t("fg_edit")} onPress={() => setDraft({ ...r })} /> : null}
            {manage ? <Btn small kind="ghost" testID={"fg-del-" + r.id} label={t("fg_delete")} onPress={() => setAskDel(askDel === r.id ? null : r.id)} /> : null}
          </Row>
        ) : null}
        {askDel === r.id ? (
          <Col gap={8} testID={"fg-del-ask-" + r.id}>
            <Muted small>{pax.length ? t("fg_deleteQPax") : t("fg_deleteQ")}</Muted>
            <Row gap={10} wrap>
              <Btn small kind="danger" testID={"fg-del-confirm-" + r.id} label={t("fg_delete")} disabled={busy} onPress={() => run(async () => { await s.deleteRide(r.id); setAskDel(null); })} />
              <Btn small kind="ghost" label={t("um_cancel")} onPress={() => setAskDel(null)} />
            </Row>
          </Col>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen testID="rides-page">
      <Header onBack={back} backLabel={t("btn_back")} eyebrow={`${t("fg_title")} · ${refLine(E, target)}`} title={refTitle(target, E.tr)}
        info={<Info title={t("fg_title")} text={t("fg_info")} />} />
      {past ? <Banner testID="fg-past">{t("fg_pastBanner")}</Banner> : null}

      <Card testID="fg-summary">
        <Row gap={10}>
          <IconTile name="car" color={sum.need ? c.warn : sum.rides ? c.ok : c.accentTx} size={34} />
          <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
            <Text testID="fg-summary-line" style={{ fontSize: 15.5, fontWeight: "800", color: c.ink }}>{summaryText(E, sum)}</Text>
            {sum.rides ? <Muted small>{tf("fg_seatLine", { t: sum.taken, s: sum.seats })}</Muted> : null}
          </Col>
        </Row>
        {staff && !past ? (
          <Row wrap gap={8}>
            <Btn small kind="primary" icon="plus" testID="fg-add" label={t("fg_add")} onPress={() => setDraft(fresh(null))} />
            {chat ? <Btn small icon="send" testID="fg-share" label={t("fg_share")} disabled={busy} onPress={share} /> : null}
          </Row>
        ) : null}
      </Card>

      {meCard}

      {R.map(rideCard)}
      {!R.length ? <Muted testID="fg-none">{past ? t("fg_noneShort") : t(staff ? "fg_noneStaff" : "fg_nonePlayer")}</Muted> : null}

      {need.length ? (
        <Card testID="fg-needs" tone={c.warn}>
          <CardTitle title={tf("fg_needsT", { n: need.length })} />
          {need.map((pid, i) => (
            <Row key={pid} gap={10} testID={"fg-need-" + pid} style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: "600", color: c.ink }}>{name(pid) + (pid === me ? ` (${t("fg_you")})` : "")}</Text>
              {canTake && pid !== me ? <Btn small kind="primary" testID={"fg-take-" + pid} label={t("fg_take")} disabled={busy} onPress={() => run(() => s.joinRide(myRide!.id, pid))} /> : null}
              {staff && !past && withFree.length ? <Btn small testID={"fg-pick-" + pid} label={t("fg_assignShort")} onPress={() => setPickFor(pid)} /> : null}
              {staff && !past ? (
                <Pressable testID={"fg-need-rm-" + pid} accessibilityRole="button" accessibilityLabel={tf("fg_needRmA", { n: name(pid) })} hitSlop={8} disabled={busy}
                  onPress={() => run(() => s.setRideNeed(target.kind, target.id, pid, false))} style={{ padding: 4 }}>
                  <Icon name="close" size={16} color={c.muted} />
                </Pressable>
              ) : null}
            </Row>
          ))}
          {canTake ? <Muted small>{t("fg_takeHint")}</Muted> : null}
        </Card>
      ) : null}

      {without.length ? (
        <Fold testID="fg-without" title={tf("fg_withoutT", { n: without.length })}
          summary={<Muted small>{without.slice(0, 5).map(p => p.vn).join(", ") + (without.length > 5 ? " …" : "")}</Muted>}>
          <Muted small>{t(target.kind === "match" && E.D.squads[target.id] ? "fg_withoutSquad" : "fg_withoutD")}</Muted>
          <T v="small">{without.map(p => E.name(p)).join(", ")}</T>
        </Fold>
      ) : null}

      <RideSheet draft={draft} target={target} staff={staff} onClose={() => setDraft(null)} />
      <AssignSheet rideId={assign} target={target} onClose={() => setAssign(null)} />
      <PickRideSheet pid={pickFor} target={target} onClose={() => setPickFor(null)} />
    </Screen>
  );
}

// ---------------------------------------------------------------------
// Blatt: Fahrt anbieten bzw. bearbeiten
// ---------------------------------------------------------------------
function RideSheet({ draft, target, staff, onClose }: { draft: Ride | null; target: RideRef; staff: boolean; onClose: () => void }) {
  const E = useEngine(); const { t } = E;
  const isNew = !!draft && draft.id.startsWith("tmp-");
  return (
    <Sheet visible={!!draft} onClose={onClose} title={isNew ? t(staff ? "fg_sheetAdd" : "fg_sheetNew") : t("fg_sheetEdit")} testID="fg-sheet" closeLabel={t("um_cancel")}>
      {draft ? <RideForm key={draft.id} draft={draft} target={target} staff={staff} onDone={onClose} /> : null}
    </Sheet>
  );
}

const SEATS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
type SeatKey = typeof SEATS[number];

function RideForm({ draft, target, staff, onDone }: { draft: Ride; target: RideRef; staff: boolean; onDone: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const isNew = draft.id.startsWith("tmp-");
  const first = (pid: string) => E.P(pid)?.vn?.trim() || (E.D.rideNames[pid] || "").split(" ")[0] || "";
  const adult = (pid: string) => { const p = E.P(pid); return !p?.geb || E.age(p) >= 17; };
  const init = driverWho(draft.driver, first(draft.driverPid || ""), E.tr);
  const [forWho, setForWho] = useState<"staff" | "player">(draft.driverPid ? "player" : "staff");
  const [pid, setPid] = useState(draft.driverPid || "");
  const [who, setWho] = useState<DriverWho>(isNew ? (draft.driverPid && adult(draft.driverPid) ? "self" : "parents") : init.who);
  const [other, setOther] = useState(init.other);
  const [staffLabel, setStaffLabel] = useState(draft.driverPid ? "" : draft.driver);
  const [seats, setSeats] = useState<SeatKey>(String(draft.seats) as SeatKey);
  const [time, setTime] = useState(draft.time || "");
  const [place, setPlace] = useState(draft.place);
  const [note, setNote] = useState(draft.note);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const meet = squadMeet(E.D, target);
  const playerRide = isNew ? (staff ? forWho === "player" : true) : !!draft.driverPid;
  const whoKeys: DriverWho[] = [...(staff || !pid || adult(pid) ? ["self" as const] : []), "mum", "dad", "parents", "other"];
  const eligible = staff && isNew
    ? E.D.players.filter(p => p.active !== false && !absentOn(E.D, p.id, target.date) && rideStatus(E.D, target.id, p.id).role !== "driver" && rideStatus(E.D, target.id, p.id).role !== "seat")
      .sort((a, b) => E.name(a).localeCompare(E.name(b), "de"))
    : [];
  const needs = needsOf(E.D, target.id);
  const label = playerRide ? driverText(who, first(pid), other, E.tr) : staffLabel.trim();
  const shown = playerRide ? (label || (pid ? tf("fg_rideOf", { n: rideName(E.D, pid, false) }) : "")) : (label || t("fg_staffRide"));

  const save = async () => {
    if (playerRide && !pid) { setErr(t("fg_errPlayer")); return; }
    if (playerRide && who === "other" && !other.trim()) { setErr(t("fg_errWho")); return; }
    setErr(""); setBusy(true);
    try {
      const x: Ride = { ...draft, driverPid: isNew ? (playerRide ? pid : null) : draft.driverPid, driver: label, seats: Number(seats), time: cleanTime(time), place, note };
      if ((await s.saveRide(x)) !== false) onDone();
    } finally { setBusy(false); }
  };

  return (
    <Col gap={14}>
      {staff && isNew ? (
        <ChoiceChips testID="fg-for" value={forWho} onChange={v => { setForWho(v); setErr(""); }}
          options={[{ key: "staff", label: t("fg_forStaff") }, { key: "player", label: t("fg_forPlayer") }]} />
      ) : null}
      {staff && isNew && forWho === "player" ? (
        <Picker testID="fg-pid" label={t("fg_player")} value={pid} onChange={v => { setPid(v); setErr(""); }}
          options={[{ key: "", label: t("fg_pickPlayer") }, ...eligible.map(p => ({ key: p.id, label: E.name(p), sub: needs.includes(p.id) ? t("fg_searching") : undefined }))]} />
      ) : null}
      {staff && !isNew && draft.driverPid ? <Muted small>{tf("fg_forWhom", { n: rideName(E.D, draft.driverPid, true) })}</Muted> : null}
      {playerRide ? (
        <Col gap={8}>
          <T v="small" bold>{t("fg_who")}</T>
          <ChoiceChips testID="fg-who" value={who} onChange={setWho}
            options={whoKeys.map(k => ({ key: k, label: t(k === "self" ? (staff ? "fg_whoSelfStaff" : "fg_whoSelf") : "fg_who_" + k) }))} />
          {who === "other" ? <Field testID="fg-who-other" label={t("fg_whoOtherL")} placeholder={t("fg_whoOtherPh")} value={other} onChangeText={setOther} maxLength={RIDE_LIMITS.driver} /> : null}
        </Col>
      ) : (
        <Field testID="fg-staff-label" label={t("fg_staffLabel")} placeholder={t("fg_staffLabelPh")} value={staffLabel} onChangeText={setStaffLabel} maxLength={RIDE_LIMITS.driver} />
      )}
      {shown ? <Muted small testID="fg-shown">{tf("fg_shownAs", { l: shown })}</Muted> : null}
      <Col gap={6}>
        <T v="small" bold>{t("fg_seats")}</T>
        <ChoiceChips testID="fg-seats" value={seats} onChange={setSeats} options={SEATS.map(n => ({ key: n, label: n }))} />
        <Muted small>{t(playerRide ? "fg_seatsD" : "fg_seatsDStaff")}</Muted>
      </Col>
      <Row gap={10} wrap align="flex-end">
        <TimeField testID="fg-time" label={t("fg_time")} value={time} onChange={setTime} lang={E.tr.lang} style={{ width: 130 }} />
        <Field testID="fg-place" label={t("fg_place")} placeholder={t("fg_placePh")} value={place} onChangeText={setPlace} maxLength={RIDE_LIMITS.place} style={{ flex: 1, minWidth: 180 }} />
      </Row>
      {meet ? (
        <Btn small kind="ghost" icon="clock" testID="fg-usemeet" label={tf("fg_useMeet", { w: departLine(E, meet) })} style={{ alignSelf: "flex-start" }}
          onPress={() => { if (meet.time) setTime(meet.time); if (meet.place) setPlace(meet.place); }} />
      ) : null}
      <Field testID="fg-note" label={t("fg_note")} placeholder={t("fg_notePh")} value={note} onChangeText={setNote} maxLength={RIDE_LIMITS.note} />
      <Muted small>{t("fg_privacy")}</Muted>
      {err ? <Banner color={c.crit} testID="fg-err">{err}</Banner> : null}
      <Row gap={10} wrap>
        <Btn kind="primary" testID="fg-save" label={isNew ? t(staff ? "fg_addBtn" : "fg_offerBtn") : t("save")} disabled={busy} onPress={save} />
        <Btn kind="ghost" label={t("um_cancel")} onPress={onDone} />
      </Row>
    </Col>
  );
}

// ---------------------------------------------------------------------
// Blätter fürs Trainerteam: Spieler einer Fahrt zuordnen, Suchenden eine Fahrt zuordnen
// ---------------------------------------------------------------------
function AssignSheet({ rideId, target, onClose }: { rideId: string | null; target: RideRef; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const r = rideId ? E.D.rides.find(x => x.id === rideId) || null : null;
  const [busy, setBusy] = useState(false);
  const free = r ? freeSeats(E.D, r) : 0, L = r ? assignable(E.D, r, target.date) : [];
  return (
    <Sheet visible={!!r} onClose={onClose} title={r ? tf("fg_assignT", { d: driverLabel(E.D, r, true, E.tr) }) : t("fg_assign")} testID="fg-assign-sheet" closeLabel={t("close")}>
      {r ? (
        <Col gap={10}>
          <T bold testID="fg-assign-free">{free ? (free === 1 ? t("fg_free1") : tf("fg_freeN", { n: free })) : t("fg_fullLong")}</T>
          {free && !L.length ? <Muted>{t("fg_assignNone")}</Muted> : null}
          {free ? L.map(({ p, need, other }) => (
            <Pressable key={p.id} testID={"fg-as-" + p.id} accessibilityRole="button" accessibilityLabel={E.name(p)} disabled={busy}
              onPress={async () => { setBusy(true); try { await s.joinRide(r.id, p.id); } finally { setBusy(false); } }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line, opacity: pressed || busy ? 0.6 : 1 })}>
              <PlayerAvatar p={p} size={32} />
              <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{E.name(p)}</Text>
                {need ? <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.warn }}>{t("fg_searching")}</Text>
                  : other ? <Text style={{ fontSize: 12.5, color: c.muted }}>{tf("fg_inOther", { d: driverLabel(E.D, other, true, E.tr) })}</Text> : null}
              </Col>
              <Icon name="plus" size={18} color={c.accentTx} />
            </Pressable>
          )) : null}
          <Btn kind="ghost" testID="fg-assign-close" label={t("close")} onPress={onClose} style={{ alignSelf: "flex-start" }} />
        </Col>
      ) : null}
    </Sheet>
  );
}

function PickRideSheet({ pid, target, onClose }: { pid: string | null; target: RideRef; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const R = ridesOf(E.D, target.id).filter(r => freeSeats(E.D, r) > 0 && r.driverPid !== pid);
  return (
    <Sheet visible={!!pid} onClose={onClose} title={pid ? tf("fg_pickT", { n: rideName(E.D, pid, true) }) : t("fg_assign")} testID="fg-pick-sheet" closeLabel={t("close")}>
      {pid ? (
        <Col gap={4}>
          {!R.length ? <Muted>{t("fg_pickNone")}</Muted> : null}
          {R.map(r => (
            <Pressable key={r.id} testID={"fg-pr-" + r.id} accessibilityRole="button" accessibilityLabel={driverLabel(E.D, r, true, E.tr)} disabled={busy}
              onPress={async () => { setBusy(true); try { if ((await s.joinRide(r.id, pid)) !== false) onClose(); } finally { setBusy(false); } }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line, opacity: pressed || busy ? 0.6 : 1 })}>
              <IconTile name="car" color={c.ok} size={32} />
              <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{driverLabel(E.D, r, true, E.tr)}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.muted }}>{[freeLabel(E, freeSeats(E.D, r)), departLine(E, r)].filter(Boolean).join(" · ")}</Text>
              </Col>
              <Icon name="chevron" size={16} color={c.muted} />
            </Pressable>
          ))}
        </Col>
      ) : null}
    </Sheet>
  );
}

// =====================================================================
// Karten und Verweise
// =====================================================================
/** Spieler – „Heute“: Fahrgemeinschaften zu den nächsten Auswärtsspielen bzw. Zielen mit Fahrten (höchstens zwei) */
export function PlayerRidesCard() {
  const s = useStore(); const E = useEngine();
  const me = s.mePid || "";
  if (!me || E.mods.fahrten === false) return null;
  const refs = rideRefsAhead(E.D, E.TODAY).filter(r => !absentOn(E.D, me, r.date)).slice(0, 2);
  if (!refs.length) return null;
  return <Col gap={12} testID="player-rides">{refs.map(r => <PlayerRideRef key={r.id} target={r} me={me} />)}</Col>;
}

function PlayerRideRef({ target, me }: { target: RideRef; me: string }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const [busy, setBusy] = useState(false);
  const line = statusLine(E, target.id, me), sum = rideSummary(E.D, target.id);
  const tone = line.role === "need" ? c.warn : line.role ? c.ok : c.accent;
  const st = rideStatus(E.D, target.id, me), dep = st.role === "seat" || st.role === "driver" ? departLine(E, st.ride) : "";
  return (
    <Card testID={"prc-" + target.id} style={{ borderWidth: 1.5, borderColor: withAlpha(tone, 0.5) }}>
      <Row gap={12} align="flex-start">
        <IconTile name="car" color={tone} size={40} />
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <T v="eyebrow">{t("fg_card")}</T>
          <T v="h3" numberOfLines={2}>{refTitle(target, E.tr)}</T>
          <Muted small>{refLine(E, target)}</Muted>
        </Col>
      </Row>
      <Text testID={"prc-status-" + target.id} style={{ fontSize: 14.5, fontWeight: "700", color: line.role ? tone : c.ink }}>{line.text}</Text>
      {dep ? <Muted small>{`${t("fg_depart")}: ${dep}`}</Muted> : null}
      <Muted small testID={"prc-sum-" + target.id}>{summaryText(E, sum)}</Muted>
      <Row wrap gap={10}>
        <Btn small kind="primary" testID={"prc-open-" + target.id} label={t("fg_openShort")} onPress={() => router.push(ridesHref("player", target))} />
        {line.role === null ? (
          <Btn small testID={"prc-need-" + target.id} label={t("fg_need")} disabled={busy}
            onPress={async () => { setBusy(true); try { await s.setRideNeed(target.kind, target.id, me, true); } finally { setBusy(false); } }} />
        ) : null}
      </Row>
    </Card>
  );
}

/** Trainerteam – Startseite: Fahrgemeinschaften der nächsten Tage (Auswärtsspiele und Ziele mit Fahrten) */
export function CoachRidesCard() {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  if (E.mods.fahrten === false) return null;
  const refs = rideRefsAhead(E.D, E.TODAY).slice(0, 3);
  if (!refs.length) return null;
  return (
    <Card testID="coach-rides">
      <CardTitle title={t("fg_title")} />
      {refs.map((r, i) => {
        const sum = rideSummary(E.D, r.id), col = sum.need ? c.warn : sum.rides ? c.ok : c.accentTx;
        return (
          <Pressable key={r.id} testID={"crc-" + r.id} accessibilityRole="button" accessibilityLabel={`${refTitle(r, E.tr)}: ${summaryText(E, sum)}`} onPress={() => router.push(ridesHref("coach", r))}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
            <IconTile name="car" color={col} size={34} />
            <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: c.ink }}>{refTitle(r, E.tr)}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: sum.need ? c.warn : c.muted, fontWeight: sum.need ? "700" : "400" }}>{`${E.wt(r.date)} ${E.de(r.date)} · ${summaryText(E, sum)}`}</Text>
            </Col>
            <Icon name="chevron" size={16} color={c.muted} />
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Spielseite (Trainerteam): Stand der Fahrgemeinschaften – bei Auswärtsspielen und sobald es Fahrten gibt */
export function RidesCard({ area, kind, refId }: { area: RideArea; kind: RideKind; refId: string }) {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const target = refOf(E.D, kind, refId);
  if (!target || E.mods.fahrten === false) return null;
  const active = rideActive(E.D, refId);
  if (!active && !(target.date >= E.TODAY && target.away)) return null;
  const sum = rideSummary(E.D, refId), col = sum.need ? c.warn : sum.rides ? c.ok : c.accentTx;
  return (
    <Card testID="fg-card" tone={col}>
      <Row gap={8}><Icon name="car" size={18} color={c.ink} /><T bold>{t("fg_title")}</T></Row>
      <Text testID="fg-card-status" style={{ fontSize: 14, fontWeight: "700", color: col }}>{summaryText(E, sum)}</Text>
      <Btn small kind="primary" testID="fg-card-open" label={active ? t("fg_openShort") : t("fg_organize")} onPress={() => router.push(ridesHref(area, target))} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}

/**
 * Kurzform für Tagesseite (Trainerteam) und Kalender der Spieler: Symbol, „Fahrten“, Stand – für kommende Spiele und
 * Termine (nicht trainingsfrei) und für vergangene mit Fahrten
 */
export function RidesLink({ area, kind, refId }: { area: RideArea; kind: RideKind; refId: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const target = refOf(E.D, kind, refId);
  if (!target || E.mods.fahrten === false) return null;
  if (kind === "event") { const e = E.D.events.find(x => x.id === refId); if (e && !rideableEvent(e)) return null; }
  const active = rideActive(E.D, refId);
  if (!active && target.date < E.TODAY) return null;
  const sum = rideSummary(E.D, refId), col = sum.need ? c.warn : sum.rides ? c.ok : c.accentTx;
  const short = [sum.rides ? freeLabel(E, sum.free) : "", sum.need ? (sum.need === 1 ? t("fg_need1") : tf("fg_needN", { n: sum.need })) : ""].filter(Boolean).join(" · ");
  // ohne Fahrten: Trainerteam „Fahrten · organisieren“, Spieler schlicht „Fahrgemeinschaft“
  const text = active ? `${t("fg_titleShort")} · ${short}` : area === "coach" ? `${t("fg_titleShort")} · ${t("fg_organizeShort")}` : t("fg_card");
  return (
    <Pressable testID={"fg-link-" + refId} accessibilityRole="button" accessibilityLabel={`${t("fg_title")}: ${summaryText(E, sum)}`} onPress={() => router.push(ridesHref(area, target))} hitSlop={4}
      style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 }}>
      <Icon name="car" size={16} color={col} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: col }}>{text}</Text>
    </Pressable>
  );
}
