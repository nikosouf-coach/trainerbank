// Tests der Leistungsdiagnostik (Bewertung, CMJ-Ermüdungscheck, Laufvorgaben, Einfluss auf die Erholung).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { bandOfValue, cmjDrop, runTargets } from "../perf";

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
