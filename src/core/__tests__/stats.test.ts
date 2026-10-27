// Tests: Statistik – Zeiträume, verfügbare Kennzahlen (Module, Rechte), Werte je Spieler, Teamwert und Sortierung.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { compareStat, periodRange, statValue, statsFor, teamValue, type StatDef } from "../stats";
import type { TeamData } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0), TODAY = "2026-10-07";
const setup = (): TeamData => buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
const engine = (D: TeamData) => createEngine(D, { lang: "de", now: NOW });
const def = (E: ReturnType<typeof engine>, k: string): StatDef => { const d = statsFor(E, true).find(x => x.key === k); assert.ok(d, "Kennzahl " + k); return d!; };
const R28 = { from: addDays(TODAY, -27), to: TODAY };

test("Statistik: Zeiträume (7 Tage, 4 Wochen, Saison, Hinrunde, Rückrunde)", () => {
  assert.deepEqual(periodRange("7", TODAY), { from: "2026-10-01", to: TODAY });
  assert.deepEqual(periodRange("28", TODAY), { from: "2026-09-10", to: TODAY });
  assert.deepEqual(periodRange("season", TODAY), { from: "2026-07-01", to: TODAY });
  assert.deepEqual(periodRange("h1", TODAY), { from: "2026-07-01", to: TODAY }, "Hinrunde läuft noch");
  assert.equal(periodRange("h2", TODAY), null, "Rückrunde hat noch nicht begonnen");
  assert.deepEqual(periodRange("h1", "2027-02-10"), { from: "2026-07-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("h2", "2027-02-10"), { from: "2027-01-01", to: "2027-02-10" });
  assert.deepEqual(periodRange("season", "2027-02-10"), { from: "2026-07-01", to: "2027-02-10" });
});

test("Statistik: verfügbare Kennzahlen nach Modulen und Recht Gesundheit, Tests vor Entwicklung", () => {
  const D = setup(), E = engine(D);
  const all = statsFor(E, true).map(d => d.key);
  for (const k of ["att", "unexc", "acwr", "load", "rpe", "rpeRate", "well", "sleep", "rateG", "marks", "games", "min", "goals", "devC", "absDays", "inj"]) assert.ok(all.includes(k), k);
  const tests = all.filter(k => k.startsWith("t:"));
  assert.ok(tests.length > 0, "Leistungstests des Teams");
  assert.ok(all.indexOf(tests[tests.length - 1]) < all.indexOf("devC"), "Tests vor Entwicklung");
  assert.ok(all.indexOf(tests[0]) > all.indexOf("clean"), "Tests nach Spielen");
  assert.ok(!statsFor(E, false).some(d => d.cat === "health"), "ohne Recht Gesundheit keine Ausfälle");
  assert.equal(new Set(all).size, all.length, "keine Doppelten");
  // Module aus
  D.team.modules = { ...D.team.modules, beteiligung: false, spielanalyse: false, leistung: false };
  const less = statsFor(engine(D), true).map(d => d.key);
  for (const k of ["att", "unexc", "rpeRate", "rateG", "games", "goals", "clean"]) assert.ok(!less.includes(k), k + " aus");
  assert.ok(!less.some(k => k.startsWith("t:")), "keine Tests ohne Leistungsdiagnostik");
  assert.ok(less.includes("marks") && less.includes("rpe"), "Trainingseindruck immer, RPE mit Belastung");
  D.team.modules = { ...D.team.modules, belastung: false };
  assert.ok(!statsFor(engine(D), true).some(d => d.cat === "load" || d.cat === "well"), "ohne Belastung kein RPE, keine Last, kein Morgen-Check");
});

test("Statistik: Trainingsbeteiligung, unentschuldigt und RPE-Quote", () => {
  const D = setup(), d = (n: number) => addDays(TODAY, -n);
  D.sessions = [
    { date: d(20), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
    { date: d(15), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
    { date: d(10), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
    { date: d(8), typ: "Spiel", dauer: 90, zeit: "15:00", md: "", ziel: 8 },
    { date: d(5), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
    { date: d(3), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
    { date: d(2), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
    { date: d(1), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 5 },
  ];
  D.att = {
    [d(20)]: { p6: "da", p7: "da" }, [d(15)]: { p6: "da", p7: "da" }, [d(10)]: { p6: "ent", p7: "da" }, [d(8)]: { p6: "unent", p7: "da" },
    // d(5): p6 krank (ohne Eintrag) – zählt nicht; d(3): keine Anwesenheit erfasst – zählt für niemanden
    [d(5)]: { p7: "da" }, [d(2)]: { p6: "unent", p7: "da" },
    // d(1): verletzt, aber da – zählt als da
    [d(1)]: { p6: "da", p7: "da" },
  };
  D.absences = [
    { id: "a1", pid: "p6", typ: "krank", von: d(6), bis: d(4), stufe: null, notiz: "" },
    { id: "a2", pid: "p6", typ: "verletzung", von: d(1), bis: d(1), stufe: 1, notiz: "" },
  ];
  D.rpe.p6 = { [d(20)]: { rpe: 6, min: 90 } };
  const E = engine(D);
  const att = statValue(E, "p6", def(E, "att"), R28);
  assert.equal(att.of, 5, "Trainings mit erfasster Anwesenheit, ohne Krankheitstag ohne Eintrag");
  assert.equal(att.n, 3); assert.equal(att.v, 60); assert.equal(att.tone, "crit");
  const p7 = statValue(E, "p7", def(E, "att"), R28);
  assert.equal(p7.v, 100); assert.equal(p7.of, 6); assert.equal(p7.tone, null);
  const ux = statValue(E, "p6", def(E, "unexc"), R28);
  assert.equal(ux.v, 2, "Training und Spiel"); assert.equal(ux.tone, "warn");
  const rr = statValue(E, "p6", def(E, "rpeRate"), R28);
  assert.equal(rr.of, 3, "besuchte Trainings"); assert.equal(rr.n, 1); assert.ok(Math.abs(rr.v! - 100 / 3) < 1e-9);
  // 7 Tage: nur d(5)…d(1)
  const a7 = statValue(E, "p6", def(E, "att"), { from: d(6), to: TODAY });
  assert.equal(a7.of, 2); assert.equal(a7.n, 1);
  // Ausfalltage im Zeitraum: 3 Tage krank + 1 Tag verletzt
  assert.equal(statValue(E, "p6", def(E, "absDays"), R28).v, 4);
  assert.equal(statValue(E, "p6", def(E, "inj"), R28).v, 1);
});

test("Statistik: Spiele, Minuten, Scorer, Torhüter zu null – nur mit Spieldaten", () => {
  const D = setup();
  D.matches = [
    { id: "m1", date: addDays(TODAY, -12), zeit: "15:00", gegner: "A", heim: true, comp: "liga" },
    { id: "m2", date: addDays(TODAY, -5), zeit: "15:00", gegner: "B", heim: false, comp: "liga" },
    { id: "m3", date: addDays(TODAY, -2), zeit: "15:00", gegner: "C", heim: true, comp: "liga" },
  ];
  D.stats = {
    m1: { p6: { min: 90, goals: 1, assists: 1, start: true }, p1: { min: 90, goals: 0, assists: 0, start: true, conceded: 0 } },
    m2: { p6: { min: 25, goals: 0, assists: 1, start: false }, p1: { min: 90, goals: 0, assists: 0, start: true, conceded: 2 } },
    // m3 ohne Spieldaten: zählt nicht
  };
  const E = engine(D), mm = E.matchMin();
  assert.deepEqual(statValue(E, "p6", def(E, "games"), R28), { v: 2, of: 2 });
  assert.deepEqual(statValue(E, "p6", def(E, "starts"), R28), { v: 1, of: 2 });
  assert.equal(statValue(E, "p6", def(E, "min"), R28).v, 115);
  assert.ok(Math.abs(statValue(E, "p6", def(E, "minPct"), R28).v! - 115 / (2 * mm) * 100) < 1e-9);
  assert.equal(statValue(E, "p6", def(E, "goals"), R28).v, 1);
  assert.equal(statValue(E, "p6", def(E, "scorer"), R28).v, 3);
  assert.equal(statValue(E, "p1", def(E, "clean"), R28).v, 1, "Torhüter ohne Gegentor");
  assert.equal(statValue(E, "p6", def(E, "clean"), R28).v, null, "nur Torhüter");
  assert.equal(statValue(E, "p1", def(E, "conc"), R28).v, 2, "Gegentore in seiner Spielzeit");
  assert.equal(statValue(E, "p1", def(E, "saves"), R28).v, null, "Paraden nicht erfasst: kein Wert statt 0");
  assert.equal(statValue(E, "p8", def(E, "games"), R28).v, 0, "nicht eingesetzt");
  assert.equal(statValue(E, "p6", def(E, "games"), { from: addDays(TODAY, -3), to: TODAY }).v, null, "keine Spiele mit Daten im Zeitraum");
});

test("Statistik: Leistungstest zum Ende des Zeitraums mit Veränderung, ACWR nur bis heute", () => {
  const D = setup();
  D.tests = D.tests.filter(x => !(x.pid === "p6" && x.test === "sprint30"));
  D.tests.push({ id: "t1", pid: "p6", test: "sprint30", date: "2026-08-20", value: 4.40 }, { id: "t2", pid: "p6", test: "sprint30", date: "2026-10-01", value: 4.33 });
  const E = engine(D), sp = statsFor(E, true).find(x => x.test === "sprint30");
  assert.ok(sp, "Sprint 30 m im Team"); assert.equal(sp!.better, "low"); assert.equal(sp!.now, true);
  const v = statValue(E, "p6", sp!, R28);
  assert.equal(v.v, 4.33); assert.equal(v.date, "2026-10-01");
  assert.ok(v.trend! > 0.015 && v.trend! < 0.017, "schneller = besser (positiv)");
  const before = statValue(E, "p6", sp!, { from: "2026-07-01", to: "2026-09-15" });
  assert.equal(before.v, 4.40, "letzter Wert bis zum Ende des Zeitraums"); assert.equal(before.trend, null);
  assert.equal(statValue(E, "p6", sp!, { from: "2026-07-01", to: "2026-08-01" }).v, null);
  const acwr = def(E, "acwr");
  assert.equal(statValue(E, "p6", acwr, { from: "2026-07-01", to: "2026-09-30" }).v, null, "ACWR nur als aktueller Stand");
});

test("Statistik: Trainingseindruck, Morgen-Check und Teamwert", () => {
  const D = setup();
  D.ratings = [
    { id: "r1", pid: "p6", date: addDays(TODAY, -3), kind: "training", rating: null, text: "", vis: false, mark: "good" },
    { id: "r2", pid: "p6", date: addDays(TODAY, -6), kind: "training", rating: null, text: "", vis: false, mark: "good" },
    { id: "r3", pid: "p6", date: addDays(TODAY, -9), kind: "training", rating: null, text: "", vis: false, mark: "poor" },
    { id: "r4", pid: "p6", date: addDays(TODAY, -4), kind: "spiel", rating: 7.5, text: "", vis: true },
    { id: "r5", pid: "p6", date: addDays(TODAY, -11), kind: "spiel", rating: 6.5, text: "", vis: true },
  ];
  D.well.p6 = { [addDays(TODAY, -1)]: { sum: 12, schlaf: 8, beschw: "none" }, [addDays(TODAY, -2)]: { sum: 16, schlaf: 7, beschw: "none" } };
  const E = engine(D);
  assert.deepEqual(statValue(E, "p6", def(E, "marks"), R28), { v: 1, good: 2, poor: 1, tone: "ok" });
  const rg = statValue(E, "p6", def(E, "rateG"), R28); assert.equal(rg.v, 7); assert.equal(rg.n, 2);
  const w = statValue(E, "p6", def(E, "well"), R28); assert.equal(w.v, 14); assert.equal(w.n, 2);
  assert.equal(statValue(E, "p6", def(E, "sleep"), R28).v, 7.5);
  const wr = statValue(E, "p6", def(E, "wellRate"), { from: addDays(TODAY, -6), to: TODAY });
  assert.equal(wr.of, 3, "ab dem ersten Morgen-Check"); assert.equal(wr.n, 2);
  delete D.well.p7;
  assert.equal(statValue(engine(D), "p7", def(E, "wellRate"), R28).v, null, "nie ausgefüllt: kein Wert statt 0 %");
  // Teamwert und Sortierung
  const att = def(E, "att"), ux = def(E, "unexc"), rpe = def(E, "rpe");
  assert.equal(teamValue(att, [80, null, 100]), 90, "Mittel der vorhandenen Werte");
  assert.equal(teamValue(ux, [1, 2, null]), 3, "Summe");
  assert.equal(teamValue(att, [null, null]), null);
  const by = (d: StatDef, L: (number | null)[], dir: 1 | -1 = 1) => [...L].sort((a, b) => compareStat(d, a, b, dir));
  assert.deepEqual(by(att, [70, null, 95, 80]), [95, 80, 70, null], "beste zuerst, ohne Wert am Ende");
  assert.deepEqual(by(att, [70, null, 95, 80], -1), [70, 80, 95, null], "umgekehrt, ohne Wert weiter am Ende");
  assert.deepEqual(by(ux, [3, 0, 1]), [0, 1, 3], "kleiner ist besser");
  assert.deepEqual(by(rpe, [5, 7, 6]), [7, 6, 5], "neutral: höchste zuerst");
});
