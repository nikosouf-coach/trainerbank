// Tests: Beschwerden mit Körperregion – Wirkung auf Training und Vorgabe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAreas, complaintEffect, parseArea } from "../body";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { indivOf } from "../indiv";

const NOW = new Date(2026, 9, 8, 9, 0), TODAY = "2026-10-08";

test("Regionen: Codes prüfen, Seite nur bei Armen und Beinen, keine Doppelungen", () => {
  assert.deepEqual(cleanAreas(["hams:l", "hams:r", "head:l", "elbow", "ill_up", "knee:x"]), ["hams:l", "head", "ill_up", "knee"]);
  assert.deepEqual(parseArea("calf:b"), { k: "calf", side: "b" });
  assert.equal(parseArea("xyz"), null);
});

test("Wirkung: deutlich Muskel = Pause, Fieber = krank, Schnupfen = locker, Torwart-Schulter, stärkste Region zählt", () => {
  const w = (beschw: "light" | "clear", areas: string[]) => ({ sum: 12, schlaf: 8, beschw, areas });
  assert.equal(complaintEffect(w("clear", ["hams:r"]), 8, false)!.kind, "pause");
  assert.equal(complaintEffect(w("light", ["ill_down"]), 8, false)!.kind, "sick");
  const cold = complaintEffect(w("light", ["ill_up"]), 8, false)!;
  assert.equal(cold.kind, "easy"); assert.ok(cold.cap! <= 4);
  assert.equal(complaintEffect(w("light", ["shoulder:l"]), 8, false)!.kind, "mod");
  assert.equal(complaintEffect(w("clear", ["shoulder:l"]), 8, true)!.how, "bd_upper_clear_tw");
  assert.equal(complaintEffect(w("light", ["shoulder:l", "knee:r"]), 8, false)!.kind, "easy", "Knie leicht wiegt schwerer als Schulter leicht");
  assert.equal(complaintEffect(w("light", []), 8, false), null, "leichte Beschwerde ohne Region: keine Änderung");
  assert.equal(complaintEffect(w("clear", []), 8, false)!.kind, "pause");
});

test("Vorgabe: Beschwerde heute senkt die Vorgabe, Muskel deutlich = Pause, kein Spielersatz bei Beschwerden", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  D.absences = []; D.msgs = {}; D.groups = []; for (const p of D.players) { p.groups = []; p.neu = false; }
  D.team.settings.days = { 1: { zeit: "18:00", platz: "halb", dauer: 90 }, 4: { zeit: "18:00", platz: "halb", dauer: 90 } } as never;
  D.matches = []; D.events = []; D.cal = {}; D.over = { [TODAY]: { kind: "intensiv", rpe: 8 } }; D.phases = [];
  const [a, b, c] = D.players.filter(p => p.pos !== "TW");
  for (const p of D.players) delete D.well[p.id]?.[TODAY];
  (D.well[a.id] ||= {})[TODAY] = { sum: 14, schlaf: 8, beschw: "light", areas: ["calf:l"] };
  (D.well[b.id] ||= {})[TODAY] = { sum: 20, schlaf: 8, beschw: "clear", areas: ["hams:r"] };
  (D.well[c.id] ||= {})[TODAY] = { sum: 14, schlaf: 8, beschw: "light", areas: ["ill_down"] };
  const E = createEngine(D, { lang: "de", now: NOW });
  const va = indivOf(E, a.id, TODAY)!, vb = indivOf(E, b.id, TODAY)!, vc = indivOf(E, c.id, TODAY)!;
  assert.equal(va.kind, "easy"); assert.ok(va.rpe <= 7); assert.match(va.why.join(" "), /Wade \(links\)/);
  assert.equal(vb.kind, "pause"); assert.equal(vb.rpe, 0);
  assert.equal(vc.kind, "sick");
  assert.equal(E.playerState(b).k, "pause"); assert.equal(E.playerState(a).k, "easy");
  // morgen: nur die deutliche Beschwerde wirkt nach
  const tm = "2026-10-12";
  assert.equal(indivOf(E, a.id, tm)!.kind === "easy" && indivOf(E, a.id, tm)!.why.some(x => /Wade/.test(x)), false);
});
