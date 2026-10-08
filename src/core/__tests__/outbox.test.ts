// Tests: Offline-Warteschlange (Ersetzen, Reihenfolge, Löschen ungesendeter Einträge, Verfall) und faire Automatik.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoTeam } from "../demo";
import { fineSuggest, lateFinesToWaive } from "../duties";
import { createEngine } from "../engine";
import { applyOp, applyOutbox, enqueue, isNetworkMessage, outboxKey, prune, uuid4, withClientId, OUTBOX_MAX, type OutboxItem } from "../outbox";
import type { FineEntry } from "../types";

const NOW = new Date(2026, 9, 8, 9, 0);
const item = (o: OutboxItem["o"], at = "2026-10-08T08:00:00.000Z", team = "t1"): OutboxItem => ({ team, at, tries: 0, o });

test("Gleicher Datensatz ersetzt den wartenden Eintrag; Zeitpunkt der ersten RPE-Eingabe bleibt", () => {
  let L: OutboxItem[] = [];
  L = enqueue(L, item({ op: "rpe", pid: "p1", date: "2026-10-07", e: { rpe: 6, min: 90 } }, "2026-10-07T20:00:00.000Z"));
  L = enqueue(L, item({ op: "well", pid: "p1", date: "2026-10-08", w: { sum: 20, schlaf: 8, beschw: "none" } }));
  L = enqueue(L, item({ op: "rpe", pid: "p1", date: "2026-10-07", e: { rpe: 7, min: 90 } }, "2026-10-08T09:00:00.000Z"));
  assert.equal(L.length, 2);
  const r = L.find(x => x.o.op === "rpe")!;
  assert.equal(r.at, "2026-10-07T20:00:00.000Z", "Frist zählt ab der ersten Eingabe");
  assert.equal((r.o as { e: { rpe: number } }).e.rpe, 7, "neuester Wert wird gesendet");
  assert.equal(L[1].o.op, "rpe", "ersetzter Eintrag rückt ans Ende (Reihenfolge der Bearbeitung)");
  // andere Teams bleiben getrennt
  L = enqueue(L, item({ op: "rpe", pid: "p1", date: "2026-10-07", e: { rpe: 5, min: 60 } }, undefined, "t2"));
  assert.equal(L.length, 3);
});

test("Noch nicht gesendete Datensätze: Löschen entfernt sie nur aus der Warteschlange", () => {
  const x = withClientId({ op: "extra", pid: "p1", x: { id: "tmp-1", date: "2026-10-08", art: "lauf", min: 30, rpe: 4 } });
  assert.equal(x.op, "extra");
  const id = (x as { x: { id: string } }).x.id;
  assert.match(id, /^c-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  let L = enqueue([], item(x));
  L = enqueue(L, item({ op: "extraDel", pid: "p1", id }));
  assert.deepEqual(L, [], "nichts zu senden");
  // gespeicherte (Server-)ID: Löschen wird gesendet
  L = enqueue([], item({ op: "extraDel", pid: "p1", id: "0b0d1d6e-1111-4222-8333-444455556666" }));
  assert.equal(L.length, 1);
  assert.equal(outboxKey(L[0].o), "extra:0b0d1d6e-1111-4222-8333-444455556666");
});

test("Warteschlange begrenzt und verfällt nach 14 Tagen", () => {
  let L: OutboxItem[] = [];
  for (let i = 0; i < OUTBOX_MAX + 5; i++) L = enqueue(L, item({ op: "att", date: "2026-10-01", pid: "p" + i, st: "da" }));
  assert.equal(L.length, OUTBOX_MAX);
  assert.equal((L[0].o as { pid: string }).pid, "p5", "älteste fallen zuerst weg");
  const P = prune([item({ op: "task", id: "a", done: true, at: null }, "2026-09-20T08:00:00.000Z"), item({ op: "task", id: "b", done: true, at: null }, "2026-10-01T08:00:00.000Z"), { ...item({ op: "task", id: "c", done: true, at: null }), at: "kaputt" }], NOW);
  assert.deepEqual(P.map(x => (x.o as { id: string }).id), ["b"]);
});

test("Anwenden nach dem Neuladen ist wiederholbar (kein doppelter Eintrag) und setzt Anwesenheit wie die Datenbank", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  const s = D.sessions[D.sessions.length - 1], pid = D.players[0].id;
  if (D.att[s.date]) delete D.att[s.date][pid];
  if (D.rpe[pid]) delete D.rpe[pid][s.date];
  const n0 = (D.extra[pid] || []).length;
  const L = [item({ op: "rpe", pid, date: s.date, e: { rpe: 6, min: 80, at: "2026-10-07T20:00:00.000Z" } }, undefined, "demo"),
    item(withClientId({ op: "extra", pid, x: { id: "tmp-9", date: s.date, art: "gym", min: 45, rpe: 5 } }), undefined, "demo"),
    item({ op: "abs", a: { id: "c-x", pid, typ: "krank", von: "2026-10-09", bis: null, stufe: null, notiz: "" } }, undefined, "demo")];
  assert.equal(applyOutbox(D, L, "demo"), 3);
  applyOutbox(D, L, "demo");
  assert.equal(D.rpe[pid][s.date].rpe, 6);
  assert.equal(D.att[s.date][pid], "da");
  assert.equal(D.extra[pid].length, n0 + 1, "Zusatzsport nur einmal");
  assert.equal(D.absences.filter(a => a.id === "c-x").length, 1, "Abwesenheit nur einmal");
  applyOp(D, { op: "absDel", id: "c-x" });
  assert.equal(D.absences.some(a => a.id === "c-x"), false);
  assert.equal(applyOutbox(D, L, "anderes-team"), 0);
});

test("Gerätespeicher: Teamdaten überstehen JSON unverändert", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  assert.deepEqual(JSON.parse(JSON.stringify(D)), D);
});

test("Netzfehler werden erkannt, andere Fehler nicht", () => {
  for (const m of ["TypeError: Failed to fetch", "Network request failed", "FetchError: request to https://x failed, reason: getaddrinfo ENOTFOUND", "The Internet connection appears to be offline."]) assert.ok(isNetworkMessage(m), m);
  for (const m of ["new row violates row-level security policy", "duplicate key value", "consent_required", ""]) assert.ok(!isNetworkMessage(m), m);
  const ids = new Set(Array.from({ length: 200 }, () => uuid4())); assert.equal(ids.size, 200);
});

test("Automatik fair: offline rechtzeitig eingetragene RPE erlässt die Strafe, verspätete nicht", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  const rules = fineSuggest("de").map(r => ({ ...r, on: true, since: "2026-09-01" }));
  const s = D.sessions.filter(x => x.typ === "Training").slice(-1)[0];
  const [a, b, c] = D.players.map(p => p.id);
  const [h, m] = s.zeit.split(":").map(Number);
  const end = new Date(+s.date.slice(0, 4), +s.date.slice(5, 7) - 1, +s.date.slice(8, 10), h, m).getTime() + s.dauer * 60000;
  D.rpe[a] = { ...(D.rpe[a] || {}), [s.date]: { rpe: 6, min: s.dauer, at: new Date(end + 2 * 3600e3).toISOString() } };   // offline 2 Std. nach Ende
  D.rpe[b] = { ...(D.rpe[b] || {}), [s.date]: { rpe: 6, min: s.dauer, at: new Date(end + 30 * 3600e3).toISOString() } };  // 30 Std. – zu spät
  D.rpe[c] = { ...(D.rpe[c] || {}), [s.date]: { rpe: 6, min: s.dauer } };                                                 // Zeitpunkt unbekannt (alt)
  const f = (pid: string, extra: Partial<FineEntry> = {}): FineEntry => ({ id: "f-" + pid, pid, rule: "late_rpe", date: s.date, ref: s.date, amount: null, note: "", status: "open", auto: true, dutyDate: null, ...extra });
  const fines = [f(a), f(b), f(c), f("x", { pid: a, id: "f-done", status: "done" }), f("y", { pid: a, id: "f-manual", rule: "late" })];
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.deepEqual(lateFinesToWaive(E, rules, fines).map(x => x.id), ["f-" + a]);
});
