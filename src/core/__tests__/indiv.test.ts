// Tests: individuelle Vorgaben (Spielersatz, Startelf, Reha-Stufen, Rückkehr, Aufbau, Torhüter, Wachstum, Abwesenheit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { indivFor, indivOf, matchMinutes } from "../indiv";
import type { TeamData } from "../types";

const NOW = new Date(2026, 9, 7, 18, 0), TODAY = "2026-10-07";

/** Demo-Team mit einem Spiel am Sonntag und Regenerationstraining am Montag (MD+1). */
function setup(): { D: TeamData; md1: string; matchId: string } {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  D.absences = []; D.msgs = {}; D.groups = []; for (const p of D.players) { p.groups = []; p.neu = false; }
  // Montag trainieren, Samstag/Sonntag frei; Spiel am Sonntag 11.10., nächstes Spiel eine Woche später
  D.team.settings.days = { 1: { zeit: "18:00", platz: "halb", dauer: 90 }, 2: { zeit: "18:00", platz: "halb", dauer: 90 }, 4: { zeit: "18:00", platz: "halb", dauer: 90 } } as never;
  D.matches = [{ id: "m1", date: "2026-10-11", zeit: "15:00", gegner: "A", heim: true, comp: "liga" }, { id: "m2", date: "2026-10-18", zeit: "15:00", gegner: "B", heim: false, comp: "liga" }];
  D.events = []; D.cal = {}; D.over = {}; D.phases = [];
  D.stats = { m1: {} };
  D.players.forEach((p, i) => { if (i < 11) D.stats.m1[p.id] = { min: 90, goals: 0, assists: 0, start: true }; else if (i < 14) D.stats.m1[p.id] = { min: i === 11 ? 50 : 15, goals: 0, assists: 0, start: false }; });
  return { D, md1: "2026-10-12", matchId: "m1" };
}

test("Tag nach dem Spiel: Startelf folgt der Regeneration, wenig Einsatz = Spielersatz, Teilzeit = Teil-Ersatz", () => {
  const { D, md1 } = setup();
  const E = createEngine(D, { lang: "de", now: NOW });
  const it = E.weekPlan("2026-10-12").items.find(x => x.date === md1)!;
  assert.equal(it.md, "MD+1");
  assert.ok(it.train && it.train.rpe <= 4, "MD+1 ist eine leichte Einheit");
  const P = D.players;
  const v0 = indivOf(E, P[0].id, md1)!, v11 = indivOf(E, P[11].id, md1)!, v12 = indivOf(E, P[12].id, md1)!, v20 = indivOf(E, P[20].id, md1)!;
  assert.equal(v0.kind, "team"); assert.equal(v0.rpe, it.train!.rpe); assert.equal(v0.differs, false);
  assert.equal(v11.kind, "compHalf"); assert.ok(v11.rpe >= 6); // 50 Min. (zwischen der Hälfte und zwei Dritteln)
  assert.equal(v12.kind, "comp"); assert.ok(v12.rpe >= 7 && v12.dauer >= 45);
  // ohne Eintrag in den Spieldaten (≥ 8 Spieler erfasst) = nicht eingesetzt
  assert.equal(matchMinutes(E, D.matches[0], P[20].id), 0);
  assert.equal(v20.kind, "comp");
  // Torhüter ohne Einsatz: torwartspezifischer Spielersatz
  const tw = P.find((p, i) => p.pos === "TW" && i >= 11)!;
  assert.match(indivOf(E, tw.id, md1)!.how, /Torwart/);
});

test("Reha-Stufen, Rückkehr, Krankheit, Abwesenheit und Pause durch den Trainer", () => {
  const { D } = setup();
  const day = "2026-10-08"; // Donnerstag (MD-3)
  const [a, b, c, d, e, f, g] = D.players;
  D.absences = [
    { id: "x1", pid: a.id, typ: "verletzung", von: "2026-10-01", bis: null, stufe: 1, notiz: "" },
    { id: "x2", pid: b.id, typ: "verletzung", von: "2026-10-01", bis: null, stufe: 2, notiz: "" },
    { id: "x3", pid: c.id, typ: "verletzung", von: "2026-09-01", bis: "2026-10-04", stufe: 4, notiz: "" },
    { id: "x4", pid: d.id, typ: "krank", von: "2026-10-07", bis: "2026-10-09", stufe: null, notiz: "" },
    { id: "x5", pid: e.id, typ: "urlaub", von: "2026-10-07", bis: "2026-10-10", stufe: null, notiz: "" },
  ];
  D.msgs[f.id] = [{ id: "mm", date: TODAY, typ: "pause", text: "Pause bis Freitag", bis: "2026-10-09" }];
  const E = createEngine(D, { lang: "de", now: NOW });
  const team = E.weekPlan("2026-10-05").items.find(x => x.date === day)!.train!;
  const v = (pid: string) => indivOf(E, pid, day)!;
  assert.equal(v(a.id).kind, "reha"); assert.ok(v(a.id).rpe <= 3);
  assert.equal(v(b.id).kind, "reha"); assert.ok(v(b.id).rpe <= 5 && v(b.id).dauer < team.dauer);
  assert.equal(v(c.id).kind, "return"); assert.ok(v(c.id).rpe <= 6 && v(c.id).dauer < team.dauer, "Woche 1 nach Rückkehr: max. RPE 6, weniger Umfang");
  assert.equal(v(d.id).kind, "sick"); assert.equal(v(d.id).rpe, 0);
  assert.equal(v(e.id).kind, "absent");
  assert.equal(v(f.id).kind, "pause");
  assert.equal(v(g.id).differs, v(g.id).kind !== "team");
});

test("Gruppen wirken: Aufbau begrenzt, Torhüter ohne Laufumfang, Wachstum ohne Spitzen", () => {
  const { D } = setup();
  const day = "2026-10-08";
  D.over[day] = { kind: "extensiv", rpe: 8 };
  const [a, b, c] = D.players.filter(p => p.pos !== "TW");
  const tw = D.players.find(p => p.pos === "TW")!;
  D.groups = [{ id: "gb", name: "Aufbau", kind: "build", vis: true }, { id: "gg", name: "Wachstum", kind: "growth", vis: false }];
  a.groups = ["gb"]; b.groups = ["gg"];
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.equal(indivOf(E, a.id, day)!.kind, "build"); assert.ok(indivOf(E, a.id, day)!.rpe <= 6);
  assert.equal(indivOf(E, b.id, day)!.kind, "growth"); assert.ok(indivOf(E, b.id, day)!.rpe <= 7);
  assert.equal(indivOf(E, tw.id, day)!.kind, "tw"); assert.ok(indivOf(E, tw.id, day)!.rpe <= 6);
  const vc = indivOf(E, c.id, day)!;
  assert.ok(vc.rpe <= 8);
  // Liste enthält alle Spieler, an spielfreien Tagen nichts
  assert.equal(indivFor(E, day).length, D.players.length);
  assert.equal(indivFor(E, addDays(day, 2)).length, 0);
});
