// Tests: Vorbereitung & Pausen (Wochenaufbau, Spielerprogramm, Umsetzung, Pausentage in der Planung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, monday } from "../dates";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { gameOf } from "../game";
import { compliance, defaultProgram, phaseWeeks, progWeek, skeleton, weekItems, weekTotal } from "../prep";
import type { Phase } from "../types";

const NOW = new Date(2026, 9, 7, 18, 0), TODAY = "2026-10-07";
let n = 0; const idf = (): string => "t" + (n++);

test("Vorbereitung: Einstieg, Aufbau mit Entlastung (3:1), Taper, Ein- und Ausgangstest", () => {
  const sk = skeleton("prep", "2027-01-04", "2027-02-14"); // 6 Wochen
  assert.deepEqual(sk.map(w => w.role), ["entry", "build", "build", "deload", "build", "taper"]);
  assert.deepEqual(sk.map(w => w.pct), [75, 90, 100, 80, 110, 80]);
  assert.deepEqual(sk.filter(w => w.test).map(w => w.i), [1, 5]);
  assert.deepEqual(sk.map(w => w.mode), ["entlastung", "aufbau", "aufbau", "entlastung", "aufbau", "entlastung"]);
  // Steigerung zwischen Aufbauwochen höchstens ~10–15 %
  const b = sk.filter(w => w.role === "build").map(w => w.pct);
  for (let i = 1; i < b.length; i++) assert.ok(b[i] / b[i - 1] <= 1.15);
});

test("Pause: Erholung zuerst, Anlauf am Ende, Programm mit 2–4 Trainingseinheiten pro Woche", () => {
  const sk = skeleton("break", "2026-12-19", "2027-01-17"); // Sa–So, berührt 5 Wochen
  assert.equal(sk.length, 5);
  assert.deepEqual(sk.map(w => w.role), ["rest", "rest", "keep", "keep", "ramp"]);
  const ph: Phase = { id: "x", kind: "break", title: "WP", from: "2026-12-19", to: "2027-01-17", firstMatch: null, weeks: {}, vis: true, note: "",
    program: defaultProgram("break", "2026-12-19", "2027-01-17", "u19", idf) };
  const hard = (i: number) => ph.program.filter(x => x.from <= i && i <= x.to && ["locker", "intervall", "kraft", "sprint"].includes(x.key)).reduce((a, x) => a + x.perWeek, 0);
  assert.equal(hard(1), 0, "Erholungswoche ohne Trainingsreize");
  assert.ok(hard(3) >= 2 && hard(3) <= 4, "Erhalt: 2–4 Einheiten");
  assert.ok(ph.program.some(x => x.key === "sprint" && x.from === 5), "Sprints im Anlauf");
  assert.ok(weekTotal(ph, "2027-01-04") >= 4);
  // Angebrochene erste Woche (nur Sa/So): höchstens zwei Einheiten, Erholung zuerst
  const w1 = weekItems(ph, "2026-12-14");
  assert.ok(w1.reduce((a, x) => a + x.perWeek, 0) <= 2 && w1.length >= 1);
  // U11: spielen statt trainieren
  const kids = defaultProgram("break", "2026-12-19", "2027-01-17", "u11", idf);
  assert.deepEqual([...new Set(kids.map(x => x.key))].sort(), ["andere", "ball"]);
  // U15: Fahrtspiel statt 4×4
  assert.ok(defaultProgram("break", "2026-12-19", "2027-01-17", "u15", idf).some(x => x.key === "fahrtspiel"));
});

test("Angebrochene Woche: wichtigste Reize zuerst, eine Einheit pro Tag", () => {
  const ph: Phase = { id: "y", kind: "break", title: "P", from: "2026-10-26", to: "2026-11-04", firstMatch: null, weeks: {}, vis: true, note: "",
    program: defaultProgram("break", "2026-10-26", "2026-11-04", "u19", idf) };
  const w2 = weekItems(ph, "2026-11-02"); // Mo–Mi
  assert.equal(w2.reduce((a, x) => a + x.perWeek, 0), 3);
  assert.deepEqual(w2.map(x => x.key).sort(), ["intervall", "kraft", "locker"]);
  assert.equal(weekTotal(ph, "2026-10-26"), 3); // Erholungswoche: 2× andere Sportart, 1× Mobility
});

test("Pausentage: kein Mannschaftstraining, nicht als abgesagt markiert; Extra-Termin bleibt möglich", () => {
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
  const ws = monday(addDays(TODAY, 14));
  const E0 = createEngine(D, { lang: "de", now: NOW });
  const trainDays = E0.weekPlan(ws).items.filter(x => x.trainDay).map(x => x.date);
  assert.ok(trainDays.length >= 2);
  D.phases.push({ id: "b1", kind: "break", title: "Pause", from: ws, to: addDays(ws, 6), firstMatch: null, weeks: {}, program: [], vis: true, note: "" });
  D.cal[trainDays[0]] = { extra: true };
  const E = createEngine(D, { lang: "de", now: NOW });
  const items = E.weekPlan(ws).items;
  assert.ok(items.find(x => x.date === trainDays[0])!.trainDay, "ausdrücklich angesetztes Training bleibt");
  for (const d of trainDays.slice(1)) {
    const x = items.find(i => i.date === d)!;
    if (x.match) continue;
    assert.equal(x.trainDay, false); assert.equal(x.brk, true); assert.equal(x.cancelled, false);
  }
  // Modul aus → Pausen werden ignoriert
  D.team.modules.vorbereitung = false;
  const E2 = createEngine(D, { lang: "de", now: NOW });
  assert.ok(E2.weekPlan(ws).items.filter(x => x.trainDay).length >= trainDays.length - 1);
});

test("Umsetzung: abgehakte Programm-Einheiten, laufende Woche anteilig, Abzeichen", () => {
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
  const from = monday(addDays(TODAY, -14)), to = addDays(from, 27);
  const ph: Phase = { id: "b2", kind: "break", title: "Pause", from, to, firstMatch: null, weeks: {}, vis: true, note: "",
    program: [{ id: "k1", key: "kraft", min: 35, rpe: 6, perWeek: 2, from: 1, to: 4 }, { id: "l1", key: "locker", min: 35, rpe: 4, perWeek: 1, from: 1, to: 4 }] };
  D.phases.push(ph);
  const L = (D.extra.p3 ||= []);
  // Woche 1 komplett, Woche 2 eine Einheit, dazu ein doppelt abgehakter Baustein (zählt nur bis perWeek)
  L.push({ id: "a", date: from, art: "gym", min: 35, rpe: 6, prog: "k1" }, { id: "b", date: addDays(from, 2), art: "gym", min: 35, rpe: 6, prog: "k1" },
    { id: "c", date: addDays(from, 3), art: "gym", min: 35, rpe: 6, prog: "k1" }, { id: "d", date: addDays(from, 4), art: "lauf", min: 35, rpe: 4, prog: "l1" },
    { id: "e", date: addDays(from, 8), art: "lauf", min: 30, rpe: 4, prog: "l1" }, { id: "f", date: addDays(from, 9), art: "sonst", min: 90, rpe: 5, label: "Kicken" });
  const w1 = progWeek(D, "p3", ph, from), w2 = progWeek(D, "p3", ph, addDays(from, 7));
  assert.equal(w1.done, 3); assert.equal(w1.total, 3);
  assert.equal(w2.done, 1); assert.equal(w2.ownMin, 90);
  const c = compliance(D, "p3", ph, TODAY);
  // fällig: 3 + 3 + anteilig Woche 3 (Mittwoch → 3/7 von 3 = 1)
  assert.equal(c.due, 7); assert.equal(c.done, 4); assert.ok(Math.abs(c.pct! - 4 / 7) < 1e-9);
  assert.equal(phaseWeeks(from, to).length, 4);
  const E = createEngine(D, { lang: "de", now: NOW }), g = gameOf(E, "p3");
  assert.ok(g.badges.find(b => b.key === "prog")!.earned, "Programmwoche komplett → Abzeichen");
});

test("Demo enthält Phasen mit Programm und Umsetzung", () => {
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
  demoExtras(D, "de", NOW);
  assert.ok(D.phases.length >= 4);
  const past = D.phases[0];
  assert.equal(past.kind, "break");
  const vals = D.players.map(p => compliance(D, p.id, past, TODAY).pct);
  assert.ok(vals.every(v => v != null));
  assert.ok(Math.max(...(vals as number[])) - Math.min(...(vals as number[])) > 0.3, "unterschiedlich fleißige Spieler");
  const E = createEngine(D, { lang: "de", now: NOW });
  const up = D.phases.find(p => p.kind === "break" && p.from > TODAY)!;
  assert.ok(up, "kommende Pause");
  const ws = monday(addDays(up.from, 1));
  assert.ok(E.weekPlan(ws).items.some(x => x.brk));
});
