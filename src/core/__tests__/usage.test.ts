// Tests: Nutzung im Team – Registrierungen, RPE-Quote der Anwesenden, Morgen-Checks, Anwesenheit und Planung je Woche.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, monday } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { share, toneOf, usageOf, USAGE_GOALS } from "../usage";
import type { TeamData } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0), TODAY = "2026-10-07";
const setup = (): TeamData => buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
const engine = (D: TeamData) => createEngine(D, { lang: "de", now: NOW });

/** Leeres Team mit drei Spielern und zwei Trainings in dieser Woche */
function small(): TeamData {
  const D = setup();
  D.players = D.players.slice(0, 3).map((p, i) => ({ ...p, userId: i < 2 ? "u" + i : null, active: true }));
  D.sessions = []; D.att = {}; D.rpe = {}; D.well = {}; D.over = {}; D.blocks = [];
  const ws = monday(TODAY), mo = ws, tu = addDays(ws, 1);
  for (const d of [mo, tu]) D.sessions.push({ date: d, typ: "Training", dauer: 90, zeit: "19:30", md: "MD-4", ziel: 6 });
  const [a, b, c] = D.players.map(p => p.id);
  D.att[mo] = { [a]: "da", [b]: "da", [c]: "unent" };
  D.rpe[a] = { [mo]: { rpe: 6, min: 90 } };
  D.well[a] = { [mo]: { sum: 12, schlaf: 8, beschw: "none" }, [tu]: { sum: 12, schlaf: 8, beschw: "none" } };
  D.well[c] = { [mo]: { sum: 12, schlaf: 8, beschw: "none" } }; // ohne Konto: zählt nicht
  D.over[tu] = { inhalt: "Pressing 6 gegen 6" };
  return D;
}

test("Nutzung: Registrierungen, RPE der Anwesenden, Morgen-Checks, Anwesenheit und Planung", () => {
  const D = small(), u = usageOf(engine(D), 2);
  assert.equal(u.players, 3); assert.equal(u.registered, 2);
  assert.equal(u.weeks.length, 2);
  const w = u.weeks[0];
  assert.equal(w.ws, monday(TODAY)); assert.equal(w.days, 3, "Mittwoch: drei Tage der laufenden Woche");
  assert.deepEqual(w.rpe, { n: 1, of: 2 }, "zwei Anwesende, einer hat RPE eingetragen");
  assert.deepEqual(w.att, { n: 1, of: 2 }, "Anwesenheit nur am Montag erfasst");
  assert.deepEqual(w.plan, { n: 1, of: 2 }, "Dienstag mit Inhalt");
  assert.deepEqual(w.well, { n: 2, of: 6 }, "zwei Morgen-Checks von zwei Spielern mit Konto an drei Tagen");
  const prev = u.weeks[1];
  assert.equal(prev.ws, addDays(monday(TODAY), -7)); assert.equal(prev.days, 7);
  assert.equal(prev.rpe, null, "ohne Training keine RPE-Quote"); assert.equal(prev.att, null); assert.equal(prev.plan, null);
  assert.deepEqual(prev.well, { n: 0, of: 14 });
});

test("Nutzung: Ablauf zählt als geplant, inaktive und fremde Spieler zählen nicht, Konto frei wählbar", () => {
  const D = small(), tu = addDays(monday(TODAY), 1), mo = monday(TODAY);
  D.blocks.push({ id: "b1", date: mo, sort: 0, title: "Aufwärmen", min: 15, staffId: null, exId: null, text: "", points: [], drawing: null, photo: null, groupId: null, slot: 0 });
  D.att[mo]["fremd"] = "da";
  const u = usageOf(engine(D), 1);
  assert.deepEqual(u.weeks[0].plan, { n: 2, of: 2 });
  D.blocks = []; D.over[mo] = { rpe: 5 };
  assert.deepEqual(usageOf(engine(D), 1).weeks[0].plan, { n: 2, of: 2 }, "angepasstes RPE zählt als geplant");
  D.over[mo] = {};
  assert.deepEqual(usageOf(engine(D), 1).weeks[0].plan, { n: 1, of: 2 }, "leere Anpassung zählt nicht");
  assert.deepEqual(u.weeks[0].rpe, { n: 1, of: 2 }, "unbekannte Spieler-ID zählt nicht");
  const all = usageOf(engine(D), 1, () => true);
  assert.equal(all.registered, 3); assert.deepEqual(all.weeks[0].well, { n: 3, of: 9 });
  D.players[0].active = false;
  assert.equal(usageOf(engine(D), 1).players, 2);
  assert.equal(D.over[tu].inhalt, "Pressing 6 gegen 6");
});

test("Nutzung: Demo-Team liefert Werte, Ziele und Bewertung", () => {
  const u = usageOf(engine(setup()), 4, () => true);
  assert.ok(u.players > 10);
  assert.ok(u.weeks.every(w => w.days >= 1 && w.days <= 7));
  assert.ok(u.weeks.some(w => w.rpe && w.rpe.of > 0), "Demo hat RPE-Einträge");
  assert.equal(share({ n: 3, of: 4 }), 0.75); assert.equal(share(null), null); assert.equal(share({ n: 0, of: 0 }), null);
  assert.equal(toneOf("rpe", 0.75), "ok"); assert.equal(toneOf("rpe", 0.62), "warn"); assert.equal(toneOf("rpe", 0.5), "crit");
  assert.equal(toneOf("registered", USAGE_GOALS.registered), "ok"); assert.equal(toneOf("att", 0.5), "crit"); assert.equal(toneOf("well", null), null);
});
