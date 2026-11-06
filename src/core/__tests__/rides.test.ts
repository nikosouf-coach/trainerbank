// Tests: Fahrgemeinschaften – Bereinigung, Demo, Ziele für die Startseite, Regeln wie der Server, Änderungen (Wechsel,
// Löschen mit erneuter Suche), Zuordnen, Text für den Teamchat, Texte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS, translator } from "../i18n";
import {
  applyRide, assignable, cleanRide, defaultDepart, driverLabel, driverText, driverWho, dropRideRef, freeSeats, needsOf, refOf, rideCheck, rideName,
  rideRefsAhead, rideStatus, rideSummary, rideableEvent, ridesOf, ridesText, seatsOf, squadMeet, withoutRide, type RideActor,
} from "../rides";
import type { Ride, TeamData } from "../types";

const NOW = new Date(2026, 10, 5, 10, 0);
const TODAY = "2026-11-05";
const setup = (): TeamData => { const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };
const away = (D: TeamData) => D.matches.filter(m => m.date >= TODAY && !m.heim && !m.result).sort((a, b) => (a.date + a.zeit < b.date + b.zeit ? -1 : 1))[0];
const STAFF: RideActor = { staff: true, me: null };
const as = (pid: string): RideActor => ({ staff: false, me: pid });

test("Bereinigung: Plätze 1–8, Uhrzeit, Texte einzeilig und gekürzt", () => {
  const r = cleanRide({ id: "r", refId: "m", kind: "x", driverPid: "", driver: "  Mama\nvon   Max ", seats: "3", time: "9.05", place: "x".repeat(130), note: " nur\tHinfahrt " });
  assert.deepEqual(r, { id: "r", kind: "match", refId: "m", driverPid: null, driver: "Mama von Max", seats: 3, time: "09:05", place: "x".repeat(120), note: "nur Hinfahrt" });
  assert.equal(cleanRide({ id: "r", refId: "m", seats: 0 }).seats, 1); assert.equal(cleanRide({ id: "r", refId: "m", seats: 12 }).seats, 8);
  assert.equal(cleanRide({ id: "r", refId: "m", seats: "viele" }).seats, 1); assert.equal(cleanRide({ id: "r", refId: "e", kind: "event", time: "25:00" }).time, null);
  assert.equal(cleanRide({ id: "r", refId: "m", driver: "y".repeat(80) }).driver.length, 60);
});

test("Demo: drei Fahrten zum nächsten Auswärtsspiel, zwei suchen, p17 noch ohne Angabe", () => {
  const D = setup(), m = away(D), sum = rideSummary(D, m.id);
  assert.ok(m, "es gibt ein Auswärtsspiel");
  assert.deepEqual(sum, { rides: 3, seats: 10, taken: 6, free: 4, need: 2 });
  assert.ok(D.rideSeats.every(s => !D.absences.some(a => a.pid === s.pid && a.von <= m.date && (!a.bis || a.bis >= m.date))), "keine Abwesenden in den Fahrten");
  assert.equal(rideStatus(D, m.id, "p17").role, null);
  const R = ridesOf(D, m.id);
  assert.equal(R.length, 3); assert.ok(R.some(r => r.driverPid === null), "eine Fahrt des Trainerteams");
  assert.ok(R.every(r => r.time && /^\d{2}:\d{2}$/.test(r.time)), "Abfahrt vorbelegt");
  const tr = translator("de"), mum = R.find(r => r.driver.startsWith("Mama von "))!;
  assert.equal(driverLabel(D, mum, false, tr), mum.driver);
  assert.match(driverLabel(D, R.find(r => r.driverPid && !r.driver)!, false, tr), /^Fahrt von \S+ [A-ZÄÖÜ]\.$/);
  assert.equal(driverLabel(D, R.find(r => !r.driverPid)!, false, tr), "Trainerteam");
  assert.equal(needsOf(D, m.id).length, 2);
});

test("Ziele für die Startseite: Auswärtsspiele in 8 Tagen, Ziele mit Fahrten in 14 Tagen", () => {
  const D = setup(), m = away(D);
  assert.ok(rideRefsAhead(D, TODAY).some(r => r.id === m.id), "Demo: Auswärtsspiel mit Fahrten erscheint (bis 14 Tage)");
  const bare = { ...D, rides: [], rideSeats: [], rideNeeds: [] };
  assert.equal(rideRefsAhead(bare, addDaysIso(m.date, -8)).some(r => r.id === m.id), true, "ohne Fahrten: 8 Tage vorher");
  assert.equal(rideRefsAhead(bare, addDaysIso(m.date, -9)).some(r => r.id === m.id), false, "ohne Fahrten: nicht 9 Tage vorher");
  assert.equal(rideRefsAhead(D, addDaysIso(m.date, -14)).some(r => r.id === m.id), true, "mit Fahrten: 14 Tage vorher");
  assert.equal(rideRefsAhead(D, addDaysIso(m.date, -15)).some(r => r.id === m.id), false, "mit Fahrten: nicht 15 Tage vorher");
  const L = rideRefsAhead(D, TODAY, 14);
  assert.ok(L.some(r => r.id === m.id && r.away));
  assert.ok(L.every(r => r.kind === "event" || r.away || D.rides.some(x => x.refId === r.id) || D.rideNeeds.some(x => x.refId === r.id)), "Heimspiele nur mit Fahrten");
  const home = D.matches.find(x => x.date >= TODAY && x.heim && !x.result)!;
  assert.ok(!rideRefsAhead(D, TODAY, 30).some(r => r.id === home.id), "Heimspiel ohne Fahrten nicht dabei");
  D.rideNeeds.push({ kind: "match", refId: home.id, pid: "p1" });
  assert.ok(rideRefsAhead(D, TODAY, 30).some(r => r.id === home.id), "Heimspiel mit Suchendem dabei");
  assert.ok(!rideableEvent({ typ: "frei" }) && !rideableEvent({ typ: "foto" }) && !rideableEvent({ typ: "meeting" }) && rideableEvent({ typ: "lager" }) && rideableEvent({ typ: "sonst" }));
  const ev = D.events.find(e => e.typ === "frei");
  if (ev) { D.rideNeeds.push({ kind: "event", refId: ev.id, pid: "p1" }); assert.ok(!rideRefsAhead(D, TODAY, 60).some(r => r.id === ev.id), "trainingsfrei: keine Fahrten"); }
  assert.ok(!rideRefsAhead(D, addDaysIso(m.date, 1), 30).some(r => r.id === m.id), "vorbei: nicht dabei");
});
const addDaysIso = (s: string, n: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

test("Regeln wie der Server: Anbieten, Mitfahren, Austragen, Suchen", () => {
  const D = setup(), m = away(D), [r1, r2, r3] = ["dr1", "dr2", "dr3"].map(id => D.rides.find(r => r.id === id)!);
  const fresh = (driverPid: string | null, extra: Partial<Ride> = {}): Ride => ({ id: "tmp-1", kind: "match", refId: m.id, driverPid, driver: "", seats: 3, time: null, place: "", note: "", ...extra });
  // Anbieten
  assert.equal(rideCheck(D, { k: "save", ride: fresh("p17") }, as("p17"), TODAY), null, "eigene Fahrt");
  assert.equal(rideCheck(D, { k: "save", ride: fresh("p18") }, as("p17"), TODAY), "forbidden", "nicht für andere");
  assert.equal(rideCheck(D, { k: "save", ride: fresh(null) }, as("p17"), TODAY), "forbidden", "keine Fahrt des Trainerteams");
  assert.equal(rideCheck(D, { k: "save", ride: fresh(r1.driverPid) }, as(r1.driverPid!), TODAY), "already_in_ride", "nur eine eigene Fahrt");
  const pax = seatsOf(D, r1.id)[0];
  assert.equal(rideCheck(D, { k: "save", ride: fresh(pax) }, as(pax), TODAY), "already_in_ride", "Mitfahrer bietet nicht zusätzlich an");
  assert.equal(rideCheck(D, { k: "save", ride: fresh(null) }, STAFF, TODAY), null, "Trainerteam");
  assert.equal(rideCheck(D, { k: "save", ride: fresh("p17") }, STAFF, addDaysIso(m.date, 1)), "ride_past", "vorbei");
  assert.equal(rideCheck(D, { k: "save", ride: fresh("p17", { refId: "gibt-es-nicht" }) }, STAFF, TODAY), "not_found");
  assert.equal(rideCheck(D, { k: "save", ride: { ...r1, seats: 1 } }, as(r1.driverPid!), TODAY), "seats_taken", "nicht unter die Mitfahrer");
  assert.equal(rideCheck(D, { k: "save", ride: { ...r1, seats: 2 } }, as(r1.driverPid!), TODAY), null, "eigene Fahrt ändern");
  assert.equal(rideCheck(D, { k: "save", ride: { ...r3, seats: 5 } }, as("p17"), TODAY), "forbidden", "fremde Fahrt (Trainerteam, ohne Fahrer) nicht ändern");
  // Mitfahren
  assert.equal(rideCheck(D, { k: "join", rideId: r1.id, pid: "p17" }, as("p17"), TODAY), null, "freier Platz");
  assert.equal(rideCheck(D, { k: "join", rideId: r1.id, pid: "p18" }, as("p17"), TODAY), "forbidden", "andere nicht eintragen");
  assert.equal(rideCheck(D, { k: "join", rideId: r3.id, pid: "p18" }, as("p17"), TODAY), "forbidden", "auch nicht in die Fahrt des Trainerteams");
  assert.equal(rideCheck(D, { k: "join", rideId: r2.id, pid: r1.driverPid! }, as(r1.driverPid!), TODAY), "already_in_ride", "Fahrer fährt nicht mit");
  const need = needsOf(D, m.id)[0];
  assert.equal(rideCheck(D, { k: "join", rideId: r1.id, pid: need }, as(r1.driverPid!), TODAY), null, "Fahrer nimmt Suchende mit");
  assert.equal(rideCheck(D, { k: "join", rideId: r1.id, pid: "p17" }, as(r1.driverPid!), TODAY), "forbidden", "aber nur Suchende");
  assert.equal(rideCheck(D, { k: "join", rideId: r2.id, pid: pax }, as(pax), TODAY), null, "selbst wechseln");
  assert.equal(rideCheck(D, { k: "join", rideId: r2.id, pid: pax }, as(r2.driverPid!), TODAY), "forbidden", "Fahrer holt keine Mitfahrer anderer Fahrten");
  const full = { ...r1, seats: 2 }; D.rides = D.rides.map(r => r.id === r1.id ? full : r);
  assert.equal(rideCheck(D, { k: "join", rideId: r1.id, pid: "p17" }, as("p17"), TODAY), "ride_full");
  assert.equal(rideCheck(D, { k: "join", rideId: r1.id, pid: pax }, as(pax), TODAY), null, "schon dabei: nichts zu tun");
  // Austragen, Suchen
  assert.equal(rideCheck(D, { k: "leave", rideId: r1.id, pid: pax, need: false }, as(pax), TODAY), null, "sich selbst");
  assert.equal(rideCheck(D, { k: "leave", rideId: r1.id, pid: pax, need: true }, as(r1.driverPid!), TODAY), null, "Fahrer trägt aus");
  assert.equal(rideCheck(D, { k: "leave", rideId: r3.id, pid: seatsOf(D, r3.id)[0], need: true }, as("p17"), TODAY), "forbidden", "andere nicht austragen");
  assert.equal(rideCheck(D, { k: "need", kind: "match", refId: m.id, pid: "p17", on: true }, as("p17"), TODAY), null);
  assert.equal(rideCheck(D, { k: "need", kind: "match", refId: m.id, pid: "p18", on: true }, as("p17"), TODAY), "forbidden");
  assert.equal(rideCheck(D, { k: "need", kind: "match", refId: m.id, pid: pax, on: true }, as(pax), TODAY), "already_in_ride", "wer mitfährt, sucht nicht");
  assert.equal(rideCheck(D, { k: "need", kind: "match", refId: m.id, pid: "p17", on: false }, as("p17"), addDaysIso(m.date, 2)), null, "Suche beenden geht immer");
  assert.equal(rideCheck(D, { k: "delete", id: r3.id }, as("p17"), TODAY), "forbidden");
  assert.equal(rideCheck(D, { k: "delete", id: r1.id }, as(r1.driverPid!), TODAY), null);
});

test("Änderungen wie der Server: Wechsel, Mitnehmen, Löschen mit erneuter Suche", () => {
  const D = setup(), m = away(D), r1 = D.rides.find(r => r.id === "dr1")!, r2 = D.rides.find(r => r.id === "dr2")!;
  const [n1, n2] = needsOf(D, m.id), pax = seatsOf(D, r2.id)[0];
  applyRide(D, { k: "join", rideId: r1.id, pid: n1 }, TODAY);
  assert.ok(seatsOf(D, r1.id).includes(n1) && !needsOf(D, m.id).includes(n1), "mitgenommen – sucht nicht mehr");
  assert.equal(freeSeats(D, r1), 0);
  applyRide(D, { k: "join", rideId: r1.id, pid: n1 }, TODAY);
  assert.equal(seatsOf(D, r1.id).filter(p => p === n1).length, 1, "doppelt = einmal");
  applyRide(D, { k: "leave", rideId: r2.id, pid: pax, need: false }, TODAY);
  applyRide(D, { k: "join", rideId: r2.id, pid: pax }, TODAY);
  const r3 = D.rides.find(r => r.id === "dr3")!, p3 = seatsOf(D, r3.id)[0];
  applyRide(D, { k: "join", rideId: r2.id, pid: p3 }, TODAY);
  assert.ok(seatsOf(D, r2.id).includes(p3) && !seatsOf(D, r3.id).includes(p3), "Wechsel gibt den alten Platz frei");
  applyRide(D, { k: "leave", rideId: r2.id, pid: p3, need: true }, TODAY);
  assert.ok(needsOf(D, m.id).includes(p3), "von anderen ausgetragen: sucht wieder");
  const before = seatsOf(D, r1.id);
  const n = applyRide(D, { k: "delete", id: r1.id }, TODAY);
  assert.equal(n, before.length, "alle Mitfahrer suchen wieder");
  assert.ok(before.every(p => needsOf(D, m.id).includes(p)) && !D.rides.some(r => r.id === r1.id) && !D.rideSeats.some(s => s.rideId === r1.id));
  assert.ok(needsOf(D, m.id).includes(n2));
  // vergangenes Ziel: Löschen ohne neue Suche
  const r2pax = seatsOf(D, r2.id);
  assert.equal(applyRide(D, { k: "delete", id: r2.id }, addDaysIso(m.date, 1)), 0);
  assert.ok(r2pax.every(p => !needsOf(D, m.id).includes(p) || p === p3));
  // neue Fahrt: Fahrer sucht nicht mehr
  applyRide(D, { k: "save", ride: { id: "tmp-x", kind: "match", refId: m.id, driverPid: n2, driver: "", seats: 2, time: null, place: "", note: "" } }, TODAY);
  assert.ok(!needsOf(D, m.id).includes(n2) && rideStatus(D, m.id, n2).role === "driver");
  // Spiel gelöscht: alles dazu weg
  dropRideRef(D, m.id);
  assert.ok(!D.rides.some(r => r.refId === m.id) && !D.rideNeeds.some(x => x.refId === m.id) && !D.rideSeats.some(s => s.rideId === "tmp-x"));
});

test("Zuordnen und ohne Angabe: Suchende zuerst, keine Fahrer und Abwesenden", () => {
  const D = setup(), m = away(D), r1 = D.rides.find(r => r.id === "dr1")!;
  const L = assignable(D, r1, m.date), need = needsOf(D, m.id);
  assert.deepEqual(L.slice(0, need.length).map(x => x.p.id).sort(), [...need].sort(), "Suchende zuerst");
  assert.ok(L.every(x => !D.rides.some(r => r.refId === m.id && r.driverPid === x.p.id)), "keine Fahrer");
  assert.ok(L.every(x => !seatsOf(D, r1.id).includes(x.p.id)), "nicht schon in dieser Fahrt");
  assert.ok(L.some(x => x.other), "Mitfahrer anderer Fahrten mit Hinweis");
  assert.ok(!L.some(x => x.p.id === "p15"), "Abwesende nicht");
  const ref = refOf(D, "match", m.id)!, wo = withoutRide(D, ref);
  assert.ok(wo.some(p => p.id === "p17") && wo.every(p => rideStatus(D, m.id, p.id).role === null) && !wo.some(p => p.id === "p15"));
});

test("Abfahrt, Treffpunkt, Bezeichnung des Fahrers", () => {
  assert.equal(defaultDepart({ kind: "match", time: "15:00", away: true }), "13:30");
  assert.equal(defaultDepart({ kind: "match", time: "15:00", away: false }), "14:00");
  assert.equal(defaultDepart({ kind: "event", time: "00:20", away: false }), "00:00");
  assert.equal(defaultDepart({ kind: "match", time: "", away: true }), "");
  const D = setup(), m = D.matches.find(x => D.squads[x.id])!;
  assert.deepEqual(squadMeet(D, { kind: "match", id: m.id }), { time: D.squads[m.id].meetTime, place: D.squads[m.id].meetPlace });
  assert.equal(squadMeet(D, { kind: "event", id: m.id }), null);
  const tr = translator("de");
  assert.equal(driverText("mum", " Max ", "", tr), "Mama von Max"); assert.equal(driverText("self", "Max", "", tr), "");
  assert.equal(driverText("other", "Max", "  Oma\nvon Max ", tr), "Oma von Max");
  assert.deepEqual(driverWho("Papa von Max", "Max", tr), { who: "dad", other: "" });
  assert.deepEqual(driverWho("", "Max", tr), { who: "self", other: "" });
  assert.deepEqual(driverWho("Familie Brenner", "Max", tr), { who: "other", other: "Familie Brenner" });
  assert.equal(rideName({ players: [{ id: "a", vn: "Luca", nn: "Brenner" } as never], rideNames: {} }, "a", true), "Luca Brenner");
  assert.equal(rideName({ players: [], rideNames: { a: "Luca B." } }, "a", false), "Luca B.");
  assert.equal(rideName({ players: [], rideNames: {} }, "x", false), "–");
});

test("Text für den Teamchat: Fahrten mit Abfahrt, Mitfahrer (Vorname und Initial), freie Plätze, Suchende", () => {
  const D = setup(), m = away(D), tr = translator("de");
  const txt = ridesText(D, refOf(D, "match", m.id)!, "Sa. 14.11.", tr), L = txt.split("\n");
  assert.equal(L[0], `Fahrgemeinschaften – Sa. 14.11. gegen ${m.gegner}`);
  const rides = L.filter(x => x.startsWith("• "));
  assert.equal(rides.length, 3);
  assert.ok(rides.every(x => x.includes("(Abfahrt 13:30 Uhr, Parkplatz am Vereinsheim)")), "Abfahrt je Fahrt");
  assert.ok(rides.some(x => x.endsWith("– 1 Platz frei")) && rides.some(x => x.endsWith("– 2 Plätze frei")));
  assert.ok(L.some(x => x.startsWith("Suchen noch eine Mitfahrgelegenheit: ")));
  assert.ok(!/[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]{2,}/.test(L.filter(x => x.startsWith("• ") || x.startsWith("Suchen")).join(" ").replace(/Mama von \S+|Fahrt von|Trainerteam|Parkplatz am Vereinsheim|Rückfahrt direkt|Bitte pünktlich|Abfahrt \d/g, "")), "nur Vorname und Initial");
  assert.equal(L[L.length - 1], "Plätze anbieten, mitfahren oder Bescheid sagen: in der App unter Fahrgemeinschaften.");
  const empty = ridesText({ players: [], rides: [], rideSeats: [], rideNeeds: [], rideNames: {} }, { id: "x", kind: "event", title: "Turnier" }, "So.", tr);
  assert.ok(empty.startsWith("Fahrgemeinschaften – So. Turnier") && empty.includes("Noch keine Fahrten eingetragen."));
});

test("Texte: alle Schlüssel in beiden Sprachen", () => {
  for (const lang of ["de", "en"] as const) for (const k of ["m_fahrten", "md_fahrten", "fg_title", "fg_rideOf", "fg_staffRide", "fg_chatHead", "fg_chatFoot", "db_rides", "dp_rides", "md_ridesOk",
    "err_ride_full", "err_already_in_ride", "err_seats_taken", "err_ride_past", "err_rides_off", "err_invalid_seats", "err_not_found", "err_forbidden"]) assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});
