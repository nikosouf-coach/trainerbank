// Fahrgemeinschaften zu Spielen und Terminen: Wer fährt (ein Spieler bzw. seine Eltern oder das Trainerteam), bietet
// Plätze an; Spieler steigen zu oder melden, dass sie eine Mitfahrgelegenheit suchen. Reine Logik mit denselben Regeln
// wie die Datenbank (ride_save, ride_delete, ride_join, ride_leave, ride_need): Spieler bieten nur die eigene Fahrt an
// und tragen nur sich selbst ein oder aus, Fahrer nehmen Suchende mit und tragen Mitfahrer aus, das Trainerteam darf
// alles; nichts für vergangene Ziele; Plätze werden nicht überbucht; je Ziel höchstens eine Fahrt pro Spieler.
import { addDays } from "./dates";
import { absentOn, cleanTime, mateName } from "./nomination";
import { oneLine } from "./text";
import type { Player, Ride, RideKind, TeamData } from "./types";

export const RIDE_LIMITS = { seats: 8, driver: 60, place: 120, note: 200 } as const;
/** So viele Tage im Voraus zeigt die Startseite Auswärtsspiele – und Ziele, für die schon jemand fährt oder sucht */
export const RIDE_DAYS = 8, RIDE_DAYS_ACTIVE = 14;

type RD = Pick<TeamData, "matches" | "events" | "rides" | "rideSeats" | "rideNeeds">;
type Tr = { t: (k: string) => string; tf: (k: string, o: Record<string, string | number>) => string };

/** Fahrt bereinigen (Plätze 1–8, Uhrzeit HH:MM, Texte einzeilig und gekürzt) */
export function cleanRide(x: { [K in keyof Ride]?: unknown } & { id: string; refId: string }): Ride {
  const n = Math.round(Number(x.seats));
  return {
    id: x.id, kind: x.kind === "event" ? "event" : "match", refId: x.refId,
    driverPid: typeof x.driverPid === "string" && x.driverPid ? x.driverPid : null,
    driver: oneLine(x.driver, RIDE_LIMITS.driver), seats: Number.isFinite(n) ? Math.min(RIDE_LIMITS.seats, Math.max(1, n)) : 1,
    time: cleanTime(x.time), place: oneLine(x.place, RIDE_LIMITS.place), note: oneLine(x.note, RIDE_LIMITS.note),
  };
}

/** Ziel einer Fahrt (Spiel oder Termin) */
export interface RideRef { kind: RideKind; id: string; date: string; time: string; title: string; away: boolean }
export function refOf(D: Pick<TeamData, "matches" | "events">, kind: RideKind, id: string): RideRef | null {
  if (kind === "match") {
    const m = D.matches.find(x => x.id === id);
    return m ? { kind, id, date: m.date, time: m.zeit || "", title: m.gegner, away: !m.heim } : null;
  }
  const e = D.events.find(x => x.id === id);
  return e ? { kind, id, date: e.date, time: e.zeit || "", title: e.titel, away: false } : null;
}
/** Ziel einer Fahrt per ID (Spiel oder Termin) */
export const refById = (D: Pick<TeamData, "matches" | "events">, id: string): RideRef | null => refOf(D, "match", id) || refOf(D, "event", id);
/** Für Termine ohne Anreise (trainingsfrei) gibt es keine Fahrgemeinschaften */
export const rideableEvent = (e: { typ: string }): boolean => e.typ !== "frei";

const byTime = (a: Ride, b: Ride) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.driver.localeCompare(b.driver, "de") || a.id.localeCompare(b.id);
/** Fahrten zu einem Ziel (nach Abfahrt) */
export const ridesOf = (D: Pick<TeamData, "rides">, refId: string): Ride[] => D.rides.filter(r => r.refId === refId).sort(byTime);
/** Mitfahrer einer Fahrt */
export const seatsOf = (D: Pick<TeamData, "rideSeats">, rideId: string): string[] => D.rideSeats.filter(s => s.rideId === rideId).map(s => s.pid);
/** Freie Plätze einer Fahrt */
export const freeSeats = (D: Pick<TeamData, "rideSeats">, r: Ride): number => Math.max(0, r.seats - seatsOf(D, r.id).length);
/** Wer sucht für ein Ziel noch eine Mitfahrgelegenheit */
export const needsOf = (D: Pick<TeamData, "rideNeeds">, refId: string): string[] => D.rideNeeds.filter(n => n.refId === refId).map(n => n.pid);

/** Fahrt eines Spielers zu einem Ziel: als Fahrer (er bzw. seine Eltern fahren) oder als Mitfahrer */
export function rideOfPlayer(D: Pick<TeamData, "rides" | "rideSeats">, refId: string, pid: string): { ride: Ride; role: "driver" | "seat" } | null {
  const own = D.rides.find(r => r.refId === refId && r.driverPid === pid);
  if (own) return { ride: own, role: "driver" };
  const ids = new Set(D.rides.filter(r => r.refId === refId).map(r => r.id));
  const s = D.rideSeats.find(x => x.pid === pid && ids.has(x.rideId));
  const ride = s ? D.rides.find(r => r.id === s.rideId) : undefined;
  return ride ? { ride, role: "seat" } : null;
}
/** Stand eines Spielers für ein Ziel: fährt (selbst bzw. Eltern), fährt mit, sucht oder noch nichts */
export type RideStatus = { role: "driver" | "seat"; ride: Ride } | { role: "need"; ride?: undefined } | { role: null; ride?: undefined };
export function rideStatus(D: Pick<TeamData, "rides" | "rideSeats" | "rideNeeds">, refId: string, pid: string): RideStatus {
  const x = rideOfPlayer(D, refId, pid);
  if (x) return x;
  return needsOf(D, refId).includes(pid) ? { role: "need" } : { role: null };
}

export interface RideSummary { rides: number; seats: number; taken: number; free: number; need: number }
/** Zahlen zu einem Ziel: Fahrten, Plätze, belegt, frei, Suchende */
export function rideSummary(D: Pick<TeamData, "rides" | "rideSeats" | "rideNeeds">, refId: string): RideSummary {
  const R = ridesOf(D, refId), seats = R.reduce((n, r) => n + r.seats, 0), taken = R.reduce((n, r) => n + Math.min(r.seats, seatsOf(D, r.id).length), 0);
  return { rides: R.length, seats, taken, free: seats - taken, need: needsOf(D, refId).length };
}
/** Gibt es zu einem Ziel schon Fahrten oder Suchende? */
export const rideActive = (D: Pick<TeamData, "rides" | "rideNeeds">, refId: string): boolean => D.rides.some(r => r.refId === refId) || D.rideNeeds.some(n => n.refId === refId);

/**
 * Bevorstehende Ziele für Fahrgemeinschaften: Auswärtsspiele ohne Ergebnis in den nächsten `days` Tagen, dazu Spiele
 * und Termine, für die es schon Fahrten oder Suchende gibt, in den nächsten `activeDays` Tagen; nach Datum und Uhrzeit.
 */
export function rideRefsAhead(D: RD, today: string, days = RIDE_DAYS, activeDays = Math.max(days, RIDE_DAYS_ACTIVE)): RideRef[] {
  const until = addDays(today, days), untilActive = addDays(today, activeDays), L: RideRef[] = [];
  for (const m of D.matches) {
    if (m.date < today || m.date > untilActive || m.result) continue;
    if (rideActive(D, m.id) || (!m.heim && m.date <= until)) L.push(refOf(D, "match", m.id)!);
  }
  for (const e of D.events) if (e.date >= today && e.date <= untilActive && rideableEvent(e) && rideActive(D, e.id)) L.push(refOf(D, "event", e.id)!);
  return L.sort((a, b) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99")));
}

/** Name in den Fahrten: fürs Trainerteam der volle Name aus dem Kader, für Spieler Vorname und Initial (vom Server) */
export function rideName(D: Pick<TeamData, "players" | "rideNames">, pid: string, full: boolean): string {
  const p = D.players.find(x => x.id === pid);
  if (full && p) return `${p.vn} ${p.nn}`.trim();
  return D.rideNames[pid] || (p ? mateName(p) : "–");
}
/** Bezeichnung des Fahrers: eigene Angabe, sonst „Fahrt von …“ bzw. „Trainerteam“ */
export const driverLabel = (D: Pick<TeamData, "players" | "rideNames">, r: Ride, full: boolean, tr: Tr): string =>
  r.driver || (r.driverPid ? tr.tf("fg_rideOf", { n: rideName(D, r.driverPid, full) }) : tr.t("fg_staffRide"));
/** „gegen TuS Essen“ bzw. Titel des Termins */
export const refTitle = (ref: Pick<RideRef, "kind" | "title">, tr: Tr): string => ref.kind === "match" ? `${tr.t("vs")} ${ref.title}` : ref.title;

/** Text zum Teilen im Teamchat: je Fahrt Fahrer, Abfahrt, Mitfahrer und freie Plätze; wer noch sucht */
export function ridesText(D: Pick<TeamData, "players" | "rides" | "rideSeats" | "rideNeeds" | "rideNames">, ref: Pick<RideRef, "id" | "kind" | "title">, when: string, tr: Tr): string {
  const { t, tf } = tr, name = (pid: string) => rideName(D, pid, false);
  const out = [tf("fg_chatHead", { w: when, g: refTitle(ref, tr) }), ""];
  const R = ridesOf(D, ref.id);
  for (const r of R) {
    const who = driverLabel(D, r, false, tr);
    const dep = [r.time ? tf("nm_clock", { t: r.time }) : "", r.place].filter(Boolean).join(", ");
    const seats = seatsOf(D, r.id).map(name), free = Math.max(0, r.seats - seats.length);
    out.push(`• ${who}${dep ? ` (${t("fg_depart")} ${dep})` : ""}: ${seats.length ? seats.join(", ") : t("fg_noPassengers")} – ${free ? (free === 1 ? t("fg_free1") : tf("fg_freeN", { n: free })) : t("fg_full")}`);
  }
  if (!R.length) out.push(t("fg_chatNone"));
  const need = needsOf(D, ref.id);
  if (need.length) out.push("", `${t("fg_stillNeed")}: ${need.map(name).join(", ")}`);
  out.push("", t("fg_chatFoot"));
  return out.join("\n");
}

// ---------- Regeln (wie der Server) ----------
/** Wer ändert: Trainerteam oder Spieler (eigene Spielerzeile; null = keine) */
export interface RideActor { staff: boolean; me: string | null }
export type RideOp =
  | { k: "save"; ride: Ride }
  | { k: "delete"; id: string }
  | { k: "join"; rideId: string; pid: string }
  | { k: "leave"; rideId: string; pid: string; need: boolean }
  | { k: "need"; kind: RideKind; refId: string; pid: string; on: boolean };
/** Fehlercodes wie vom Server (err_<code>) */
export type RideErr = "not_found" | "forbidden" | "ride_past" | "ride_full" | "already_in_ride" | "seats_taken";

const isNewId = (id: string): boolean => id.startsWith("tmp-");

/** Prüfung vor einer Änderung – dieselben Regeln wie ride_save … ride_need. Ergebnis: Fehlercode oder null */
export function rideCheck(D: RD, op: RideOp, actor: RideActor, today: string): RideErr | null {
  const past = (kind: RideKind, refId: string): RideErr | null => { const r = refOf(D, kind, refId); return !r ? "not_found" : r.date < today ? "ride_past" : null; };
  const isMe = (pid: string | null) => !!actor.me && pid === actor.me;
  switch (op.k) {
    case "save": {
      const r = op.ride, old = isNewId(r.id) ? null : D.rides.find(x => x.id === r.id) || null;
      if (!isNewId(r.id) && !old) return "not_found";
      const kind = old ? old.kind : r.kind, refId = old ? old.refId : r.refId;
      if (!refOf(D, kind, refId)) return "not_found";
      if (!actor.staff && !isMe(old ? old.driverPid : r.driverPid)) return "forbidden";
      const e = past(kind, refId); if (e) return e;
      if (!old) return r.driverPid && rideOfPlayer(D, refId, r.driverPid) ? "already_in_ride" : null;
      return r.seats < seatsOf(D, old.id).length ? "seats_taken" : null;
    }
    case "delete": {
      const r = D.rides.find(x => x.id === op.id);
      if (!r) return "not_found";
      return actor.staff || isMe(r.driverPid) ? null : "forbidden";
    }
    case "join": {
      const r = D.rides.find(x => x.id === op.rideId);
      if (!r) return "not_found";
      if (!actor.staff && !isMe(op.pid) && !(isMe(r.driverPid) && needsOf(D, r.refId).includes(op.pid))) return "forbidden";
      const e = past(r.kind, r.refId); if (e) return e;
      const seats = seatsOf(D, r.id);
      if (seats.includes(op.pid)) return null;
      if (D.rides.some(x => x.refId === r.refId && x.driverPid === op.pid)) return "already_in_ride";
      if (seats.length >= r.seats) return "ride_full";
      // Wechsel aus einer anderen Fahrt nur durch das Trainerteam oder den Spieler selbst
      return rideOfPlayer(D, r.refId, op.pid) && !actor.staff && !isMe(op.pid) ? "already_in_ride" : null;
    }
    case "leave": {
      const r = D.rides.find(x => x.id === op.rideId);
      if (!r) return "not_found";
      return actor.staff || isMe(op.pid) || isMe(r.driverPid) ? null : "forbidden";
    }
    case "need": {
      if (!actor.staff && !isMe(op.pid)) return "forbidden";
      if (!op.on) return refOf(D, op.kind, op.refId) ? null : "not_found";
      const e = past(op.kind, op.refId); if (e) return e;
      return rideOfPlayer(D, op.refId, op.pid) ? "already_in_ride" : null;
    }
  }
}

const addNeed = (D: RD, kind: RideKind, refId: string, pid: string) => { if (!D.rideNeeds.some(n => n.refId === refId && n.pid === pid)) D.rideNeeds.push({ kind, refId, pid }); };
const dropNeed = (D: RD, refId: string, pid: string) => { D.rideNeeds = D.rideNeeds.filter(n => !(n.refId === refId && n.pid === pid)); };

/**
 * Änderung auf die Teamdaten anwenden – wie der Server: Wer fährt oder mitfährt, sucht nicht mehr; Wechsel gibt den
 * alten Platz frei; wird eine Fahrt gelöscht (kommendes Ziel), suchen ihre Mitfahrer wieder. Ergebnis: wie viele
 * Spieler danach wieder suchen (nur beim Löschen).
 */
export function applyRide(D: RD, op: RideOp, today: string): number {
  switch (op.k) {
    case "save": {
      const x = op.ride, old = D.rides.find(r => r.id === x.id);
      if (old) Object.assign(old, { driver: x.driver, seats: x.seats, time: x.time, place: x.place, note: x.note });
      else { D.rides.push(x); if (x.driverPid) dropNeed(D, x.refId, x.driverPid); }
      return 0;
    }
    case "delete": {
      const r = D.rides.find(x => x.id === op.id); if (!r) return 0;
      const ref = refOf(D, r.kind, r.refId), pax = seatsOf(D, r.id);
      let n = 0;
      if (ref && ref.date >= today) for (const pid of pax) if (!D.rideNeeds.some(z => z.refId === r.refId && z.pid === pid)) { addNeed(D, r.kind, r.refId, pid); n++; }
      D.rideSeats = D.rideSeats.filter(s => s.rideId !== r.id);
      D.rides = D.rides.filter(x => x.id !== r.id);
      return n;
    }
    case "join": {
      const r = D.rides.find(x => x.id === op.rideId); if (!r) return 0;
      if (D.rideSeats.some(s => s.rideId === r.id && s.pid === op.pid)) return 0;
      const same = new Set(D.rides.filter(x => x.refId === r.refId).map(x => x.id));
      D.rideSeats = D.rideSeats.filter(s => !(s.pid === op.pid && same.has(s.rideId)));
      D.rideSeats.push({ rideId: r.id, pid: op.pid });
      dropNeed(D, r.refId, op.pid);
      return 0;
    }
    case "leave": {
      const r = D.rides.find(x => x.id === op.rideId); if (!r) return 0;
      D.rideSeats = D.rideSeats.filter(s => !(s.rideId === r.id && s.pid === op.pid));
      const ref = refOf(D, r.kind, r.refId);
      if (op.need && ref && ref.date >= today) addNeed(D, r.kind, r.refId, op.pid);
      return 0;
    }
    case "need": {
      if (op.on) addNeed(D, op.kind, op.refId, op.pid); else dropNeed(D, op.refId, op.pid);
      return 0;
    }
  }
}

/** Spieler, die einer Fahrt zugeordnet werden können: aktiv, am Tag nicht abwesend, nicht selbst Fahrer – Suchende zuerst */
export function assignable(D: Pick<TeamData, "players" | "absences" | "rides" | "rideSeats" | "rideNeeds">, ride: Ride, date: string): { p: Player; need: boolean; other: Ride | null }[] {
  const need = new Set(needsOf(D, ride.refId)), mine = new Set(seatsOf(D, ride.id));
  return D.players
    .filter(p => p.active !== false && !mine.has(p.id) && !D.rides.some(r => r.refId === ride.refId && r.driverPid === p.id) && !absentOn(D, p.id, date))
    .map(p => { const x = rideOfPlayer(D, ride.refId, p.id); return { p, need: need.has(p.id), other: x && x.role === "seat" ? x.ride : null }; })
    .sort((a, b) => Number(b.need) - Number(a.need) || Number(!!a.other) - Number(!!b.other) || `${a.p.vn} ${a.p.nn}`.localeCompare(`${b.p.vn} ${b.p.nn}`, "de"));
}

/**
 * Noch ohne Angabe (fürs Trainerteam): aktive Spieler, am Tag nicht abwesend, weder Fahrer noch Mitfahrer noch suchend –
 * bei einem Kader nur die Nominierten (viele fahren mit den eigenen Eltern; das ist nur ein Hinweis zum Nachfragen).
 */
export function withoutRide(D: Pick<TeamData, "players" | "absences" | "rides" | "rideSeats" | "rideNeeds" | "noms" | "squads">, ref: RideRef): Player[] {
  const sq = ref.kind === "match" ? D.squads[ref.id] : undefined, nom = sq ? new Set(D.noms.filter(n => n.matchId === ref.id).map(n => n.pid)) : null;
  return D.players.filter(p => p.active !== false && (!nom || nom.has(p.id)) && !absentOn(D, p.id, ref.date) && rideStatus(D, ref.id, p.id).role === null);
}

/** Vorbelegung der Abfahrt: bei Auswärtsspielen 90, bei Heimspielen 60, bei Terminen 30 Minuten vorher ("" ohne Uhrzeit) */
export function defaultDepart(ref: Pick<RideRef, "kind" | "time" | "away">): string {
  const m = /^(\d{2}):(\d{2})$/.exec(ref.time);
  if (!m) return "";
  const x = Math.max(0, +m[1] * 60 + +m[2] - (ref.kind === "event" ? 30 : ref.away ? 90 : 60));
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}
/** Treffpunkt aus dem Kader zum Übernehmen (der Treffpunkt kann auch am Spielort sein – deshalb nicht vorbelegt) */
export function squadMeet(D: Pick<TeamData, "squads">, ref: Pick<RideRef, "kind" | "id">): { time: string; place: string } | null {
  const sq = ref.kind === "match" ? D.squads[ref.id] : undefined;
  return sq && (sq.meetTime || sq.meetPlace) ? { time: sq.meetTime || "", place: sq.meetPlace } : null;
}

/** Bezeichnung des Fahrers aus der Auswahl („Mama von Max“ …); „self“ = leer (zeigt „Fahrt von Max M.“) */
export type DriverWho = "self" | "mum" | "dad" | "parents" | "other";
export function driverText(who: DriverWho, first: string, other: string, tr: Tr): string {
  const n = first.trim();
  if (who === "self") return "";
  if (who === "other") return oneLine(other, RIDE_LIMITS.driver);
  return oneLine(tr.tf(who === "mum" ? "fg_mumOf" : who === "dad" ? "fg_dadOf" : "fg_parentsOf", { n }), RIDE_LIMITS.driver);
}
/** Auswahl aus einer gespeicherten Bezeichnung zurückgewinnen (zum Bearbeiten) */
export function driverWho(label: string, first: string, tr: Tr): { who: DriverWho; other: string } {
  if (!label) return { who: "self", other: "" };
  for (const w of ["mum", "dad", "parents"] as const) if (label === driverText(w, first, "", tr)) return { who: w, other: "" };
  return { who: "other", other: label };
}

/** Spiel bzw. Termin gelöscht: Fahrten (mit Plätzen) und Suchen dazu entfernen (wie cascade in der Datenbank) */
export function dropRideRef(D: Pick<TeamData, "rides" | "rideSeats" | "rideNeeds">, refId: string): void {
  const gone = new Set(D.rides.filter(r => r.refId === refId).map(r => r.id));
  if (gone.size) { D.rides = D.rides.filter(r => !gone.has(r.id)); D.rideSeats = D.rideSeats.filter(s => !gone.has(s.rideId)); }
  D.rideNeeds = D.rideNeeds.filter(n => n.refId !== refId);
}
