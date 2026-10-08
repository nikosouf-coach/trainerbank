// Tests für die Rückmeldung in der Spieler-App (Zuverlässigkeit, Serie, Meilensteine).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { addDays } from "../dates";
import { gameOf } from "../game";

const NOW = new Date(2026, 9, 7, 18, 0);

test("Spieler mit Einträgen: Zuverlässigkeit zwischen 0 und 1, Meilensteine", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  const E = createEngine(D, { lang: "de", now: NOW });
  const g = gameOf(E, "p1");
  assert.ok(g.reliability != null && g.reliability > 0 && g.reliability <= 1);
  assert.ok(g.rel.checkins.done <= g.rel.checkins.total && g.rel.rpe.done <= g.rel.rpe.total);
  assert.ok(g.badges.length >= 8);
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

test("Zuverlässigkeit: alle Angaben = 100 %, Verletzungstage zählen nicht", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  const pid = "p3", TODAY = "2026-10-07";
  D.well[pid] = {}; D.rpe[pid] = {};
  for (let k = 3; k < 28; k++) D.well[pid][addDays(TODAY, -k)] = { sum: 8, schlaf: 8, beschw: "none" };
  D.absences = D.absences.filter(a => a.pid !== pid);
  D.absences.push({ id: "x", pid, typ: "verletzung", von: "2026-10-05", bis: TODAY, stufe: 1, notiz: "" });
  for (const s of D.sessions.filter(s => s.date < TODAY)) { (D.att[s.date] ||= {})[pid] = "da"; D.rpe[pid][s.date] = { rpe: 5, min: 90 }; }
  const g = gameOf(createEngine(D, { lang: "de", now: NOW }), pid);
  assert.equal(g.rel.checkins.done, g.rel.checkins.total, "verletzte Tage ohne Check-in zählen nicht als fehlend");
  assert.equal(g.reliability, 1);
});
