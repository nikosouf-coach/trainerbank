// Tests für die spielerischen Elemente (XP, Level, Serie, Abzeichen).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { gameOf, xpFor } from "../game";

const NOW = new Date(2026, 9, 7, 18, 0);

test("Level-Schwellen steigen", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(xpFor), [0, 100, 300, 600, 1000]);
});

test("Spieler mit Einträgen hat XP, Level und Abzeichen", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  const E = createEngine(D, { lang: "de", now: NOW });
  const g = gameOf(E, "p1");
  assert.ok(g.xp > 0);
  assert.ok(g.level >= 1 && g.xp >= g.levelStart && g.xp < g.levelNext);
  assert.equal(g.badges.length, 8);
  assert.ok(g.week.checkins.done <= g.week.checkins.total);
  assert.ok(g.streak <= g.bestStreak || g.streak === 0);
});

test("Serie zählt aufeinanderfolgende Check-ins", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  D.well.p2 = {};
  for (const d of ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]) D.well.p2[d] = { sum: 8, schlaf: 8, beschw: "none" };
  const g = gameOf(createEngine(D, { lang: "de", now: NOW }), "p2");
  assert.equal(g.streak, 4);
  assert.equal(g.checkedToday, true);
});
