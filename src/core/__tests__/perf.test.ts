// Tests der Leistungsdiagnostik (Bewertung, CMJ-Ermüdungscheck, Laufvorgaben, Einfluss auf die Erholung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { CUSTOM_TEST_MAX, bandOfValue, bestOf, cleanCustomTests, cmjDrop, isCustomTest, normOf, runTargets, testDef, testName, testRank, testsFor, trendOf } from "../perf";
import { goalProgress, goalUnit, seasonReview } from "../dev";
import type { Goal } from "../types";

const NOW = new Date(2026, 9, 7, 18, 0), TODAY = "2026-10-07";

test("Bewertung nach Orientierungswerten (Zeiten: kleiner ist besser)", () => {
  assert.equal(bandOfValue("sprint10", "u19", 1.72), "top");
  assert.equal(bandOfValue("sprint10", "u19", 1.9), "mittel");
  assert.equal(bandOfValue("cmj", "u19", 45), "top");
  assert.equal(bandOfValue("cmj", "u19", 30), "basis");
});

test("CMJ-Abfall wird erkannt und verlängert die Erholung", () => {
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
  const add = (date: string, value: number) => D.tests.push({ id: date, pid: "p2", test: "cmj", date, value });
  [42, 41, 43, 42].forEach((v, i) => add(addDays(TODAY, -7 * (4 - i)), v));
  add(addDays(TODAY, -1), 37.8); // ca. −10 %
  const drop = cmjDrop(D, "p2", TODAY)!;
  assert.ok(drop > 0.09 && drop < 0.11);
  const E = createEngine(D, { lang: "de", now: NOW });
  const need = E.recoveryNeed(E.P("p2")!, { typ: "Training", rpe: 8, min: 90 });
  assert.ok(need.lines.some(l => l[0].includes("Sprungtest")));
  assert.ok(E.profile("p2").reasons.some(r => r[1].startsWith("CMJ")));
});

test("Laufvorgaben aus V_IFT", () => {
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
  D.tests.push({ id: "x", pid: "p3", test: "ift", date: TODAY, value: 20 });
  const rt = runTargets(D, "p3")!;
  assert.equal(rt.d15_90, 75);   // 20 km/h = 5,56 m/s × 0,9 × 15 s
  assert.equal(rt.d30_85, 142);
});

test("Platzierung: eigener Platz, Gleichstand teilt Platz, erst ab 5 Werten, Teambestwert optional", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", new Date(2026, 9, 8, 9, 0));
  D.tests = [];
  const vals = [1.80, 1.75, 1.90, 1.70, 1.75];
  D.players.slice(0, 5).forEach((p, i) => D.tests.push({ id: "t" + i, pid: p.id, test: "sprint10", date: "2026-10-01", value: vals[i] }));
  const [a, b, , d, e] = D.players;
  assert.deepEqual(testRank(D, a.id, "sprint10", "2026-10-08", false), { rank: 4, n: 5, best: null });
  assert.equal(testRank(D, b.id, "sprint10", "2026-10-08", true)!.rank, 2);
  assert.equal(testRank(D, e.id, "sprint10", "2026-10-08", true)!.rank, 2, "gleiche Zeit = gleicher Platz");
  assert.equal(testRank(D, d.id, "sprint10", "2026-10-08", true)!.best, 1.70);
  D.tests.pop();
  assert.equal(testRank(D, a.id, "sprint10", "2026-10-08", false), null, "unter 5 Werten keine Platzierung");
});

test("Eigene Tests: Katalog, Richtung, Bestwert, Platz, Ziele, Rückblick, Bereinigung", () => {
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
  D.team.settings.customTests = [{ id: "s20", name: "Sprint 20 m", unit: "s", lower: true, dec: 2 }, { id: "jongl", name: "Jonglieren", unit: "x", lower: false, dec: 0, gk: true }];
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.ok(isCustomTest("c:s20") && !isCustomTest("sprint10"));
  const keys = E.testsFor().map(x => x.key);
  assert.ok(keys.includes("c:s20") && keys.includes("c:jongl") && keys.includes("sprint10"), "eingebaut + eigene");
  assert.equal(E.testName("c:s20"), "Sprint 20 m"); assert.equal(E.testName("sprint10"), E.t("ts_sprint10"));
  assert.equal(testName("c:weg", k => k, D.team.settings.customTests), "?", "gelöschter Test bleibt lesbar");
  assert.equal(E.testDef("c:jongl").gk, true); assert.equal(testDef("c:s20", D.team.settings.customTests).lower, true);
  assert.equal(bandOfValue("c:s20", "u19", 3), "none"); assert.equal(normOf("c:s20", "u19"), null);
  assert.equal(testsFor("u11", D.team.settings.customTests).filter(x => x.custom).length, 2, "eigene Tests gelten für jede Altersgruppe");
  // Auswahl des Teams: nur gewählte Tests
  D.team.settings.tests = ["sprint10", "c:s20"];
  assert.deepEqual(createEngine(D, { lang: "de", now: NOW }).testsFor(true).map(x => x.key), ["sprint10", "c:s20"]);
  delete D.team.settings.tests;
  // Werte: kleiner ist besser
  const ps = D.players.slice(0, 6);
  ps.forEach((p, i) => D.tests.push({ id: "s" + i, pid: p.id, test: "c:s20", date: "2026-10-01", value: 3 + i / 10 }));
  D.tests.push({ id: "s9", pid: ps[0].id, test: "c:s20", date: "2026-10-05", value: 2.9 });
  assert.equal(bestOf(D, ps[0].id, "c:s20")!.value, 2.9);
  assert.ok(trendOf(D, ps[0].id, "c:s20")! > 0, "schneller = besser");
  assert.equal(testRank(D, ps[1].id, "c:s20", TODAY, true)!.rank, 2);
  assert.equal(testRank(D, ps[1].id, "c:s20", TODAY, true)!.best, 2.9);
  // Ziel mit eigenem Test: Richtung aus dem Test, Einheit im Ziel
  const g: Goal = { id: "g1", pid: ps[1].id, title: "Schneller", area: "ath", kind: "perf", metric: "test", unit: "s", start: 3.2, target: 3.0, lower: false,
    test: "c:s20", stat: null, from: "2026-09-01", due: null, why: "", steps: [], status: "active", vis: true, by: "coach", talkId: null };
  D.tests.push({ id: "s10", pid: ps[1].id, test: "c:s20", date: "2026-10-06", value: 2.98 });
  assert.equal(goalProgress(D, g, TODAY).reached, true); assert.equal(goalUnit(g), "s");
  // Saisonrückblick enthält eigene Tests
  const r = seasonReview(createEngine(D, { lang: "de", now: NOW }), ps[0].id);
  assert.ok(r.tests.some(x => x.key === "c:s20" && x.better));
  // Bereinigung
  const many = [...Array(20)].map((_, i) => ({ id: "t" + i, name: "Test " + i, unit: "s", lower: true, dec: 1 }));
  const c = cleanCustomTests([{ id: "<x>", name: "Böse" }, { id: "a", name: "  " }, { id: "b", name: "  Liegestütze   60 s ", unit: "Wiederholungen!!", dec: 7, how: "x".repeat(400), gk: 1 }, { id: "b", name: "Doppelt" }, ...many]);
  assert.equal(c.length, CUSTOM_TEST_MAX);
  assert.deepEqual(c[0], { id: "b", name: "Liegestütze 60 s", unit: "Wiederholung", lower: false, dec: 2, how: "x".repeat(300), gk: true });
  assert.deepEqual(cleanCustomTests("kaputt"), []);
});
