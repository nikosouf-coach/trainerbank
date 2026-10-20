// Trainingsprinzipien: MD-Logik, Beispielwoche, Reihenfolge, Hinweise, Bereinigung – und Umrechnung alter Übungsskizzen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS, KIND_RPE, MDS, PR_ROWS, defaultPrinciples } from "../classes";
import { CONTENT } from "../content";
import { addDays, monday } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { PR_NOTE_MAX, cleanPrinciples, exampleWeek, mdInWeek, mdLabel, principleHints, principleRows } from "../principles";
import { emptySketch, toSketch } from "../sketch";
import { translator } from "../i18n";
import type { DrawingV1, Principles } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0, 0);

test("MD-Logik: Erholung zuerst, dann rückwärts zum nächsten Spiel", () => {
  assert.equal(mdLabel(0, 3), "MD");
  // normale Woche (7 Tage): Tag 1/2 nach dem Spiel sind MD+1/MD+2, nicht MD-6/MD-5
  assert.equal(mdLabel(1, 6), "MD+1"); assert.equal(mdLabel(2, 5), "MD+2"); assert.equal(mdLabel(3, 4), "MD-4"); assert.equal(mdLabel(6, 1), "MD-1");
  // englische Woche: Spiel in zwei Tagen hat Vorrang vor MD+2
  assert.equal(mdLabel(2, 2), "MD-2"); assert.equal(mdLabel(1, 1), "MD-1");
  // lange Pause: MD-6/MD-5 gibt es erst bei mehr als 7 Tagen zwischen zwei Spielen
  assert.equal(mdLabel(3, 5), "MD-5"); assert.equal(mdLabel(3, 6), "MD-6");
  // kein nahes Spiel
  assert.equal(mdLabel(3, 99), "MD+3"); assert.equal(mdLabel(5, 99), "");
  for (let wd = 0; wd < 7; wd++) for (let sp = 0; sp < 7; sp++) {
    const md = mdInWeek(wd, sp);
    assert.ok(md === "MD" || MDS.includes(md), md);
    assert.ok(md !== "MD-6" && md !== "MD-5", "in einer normalen Woche kein MD-6/MD-5");
  }
});

test("Beispielwoche und Reihenfolge der Zeilen", () => {
  // Spiel Sonntag, Training Mo Mi Do Fr
  const w = exampleWeek(0, [1, 3, 4, 5]);
  assert.deepEqual(w.map(d => d.wd), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(w.map(d => d.md), ["MD+1", "MD+2", "MD-4", "MD-3", "MD-2", "MD-1", "MD"]);
  assert.deepEqual(w.filter(d => d.train).map(d => d.wd), [1, 3, 4, 5]);
  assert.ok(w.find(d => d.wd === 0)!.match);
  const r = principleRows(0, [1, 3, 4, 5]);
  assert.deepEqual(r.week, [{ md: "MD+1", wd: 1 }, { md: "MD-4", wd: 3 }, { md: "MD-3", wd: 4 }, { md: "MD-2", wd: 5 }]);
  assert.deepEqual(r.other, ["MD+2", "MD-6", "MD-5", "MD-1"]);
  // Spiel Samstag, Training Di Do: Woche beginnt nach dem Spiel
  const r2 = principleRows(6, [2, 4]);
  assert.deepEqual(r2.week.map(x => x.md), ["MD-4", "MD-2"]);
  // Training am Spieltag zählt nicht als Trainingstag
  assert.ok(!exampleWeek(0, [0, 2]).find(d => d.wd === 0)!.train);
  // jede Zeile genau einmal
  for (let sp = 0; sp < 7; sp++) { const x = principleRows(sp, [0, 1, 2, 3, 4, 5, 6]); assert.equal(x.week.length + x.other.length, MDS.length); }
});

test("Empfehlung ist in sich stimmig (keine Hinweise) – Hinweise bei Widersprüchen", () => {
  for (const g of ["akt", "u19", "u15"] as const) assert.deepEqual(principleHints(defaultPrinciples(g), 0, [1, 3, 4, 5]), [], g);
  const p: Principles = { ...defaultPrinciples("u19"), "MD-3": { kind: "intensiv", rpe: 8 }, "MD-1": { kind: "aktiv", rpe: 7 } };
  const h = principleHints(p, 0, [1, 3, 4, 5, 6]).map(x => x.k);
  assert.ok(h.includes("hard2"), "MD-4 und MD-3 beide hart");
  assert.ok(h.includes("md1"), "MD-1 zu hart");
  assert.ok(h.includes("kindHigh"), "Aktivierung mit RPE 7");
  const soft: Principles = { ...defaultPrinciples("u19"), "MD-4": { kind: "intensiv", rpe: 4 }, "MD-3": { kind: "extensiv", rpe: 5 } };
  const h2 = principleHints(soft, 0, [1, 3, 4, 5]).map(x => x.k);
  assert.ok(h2.includes("kindLow") && h2.includes("noHard"));
});

test("Trainingsarten: jede mit Inhalt, Intensität und Texten; Kraft und Technik getrennt", () => {
  assert.ok(KINDS.includes("aufbau") && KINDS.includes("technik"));
  const de = translator("de"), en = translator("en");
  for (const k of KINDS) {
    assert.ok(CONTENT[k], "Inhalt " + k); assert.ok(KIND_RPE[k] != null, "RPE " + k);
    for (const t of [de, en]) for (const key of ["k_" + k, "kdesc_" + k, "w_" + k]) assert.notEqual(t.t(key), key, key);
  }
  assert.equal(de.t("k_aufbau"), "Kraft"); assert.equal(de.t("k_technik"), "Technik"); assert.equal(de.t("k_schnell"), "Schnelligkeit");
});

test("Prinzipien bereinigen", () => {
  const c = cleanPrinciples({ "MD-4": { kind: "unbekannt", rpe: 99 }, "MD-3": { kind: "c:abc-1", rpe: 6.4, note: "  Pressing 4 gg 4  " }, "MD+2": { kind: "frei", rpe: 5 }, "MD-2": { kind: "technik", rpe: -3, note: "x".repeat(400) } }, "u19");
  const def = defaultPrinciples("u19");
  assert.deepEqual(Object.keys(c).sort(), [...PR_ROWS].sort());
  assert.equal(c["MD-4"].kind, def["MD-4"].kind); assert.equal(c["MD-4"].rpe, 10);
  assert.deepEqual(c["MD-3"], { kind: "c:abc-1", rpe: 6, note: "Pressing 4 gg 4" });
  assert.equal(c["MD+2"].rpe, 0);
  assert.equal(c["MD-2"].rpe, 0); assert.equal(c["MD-2"].note!.length, PR_NOTE_MAX);
  assert.deepEqual(cleanPrinciples(null, "u15"), defaultPrinciples("u15"));
  assert.deepEqual(cleanPrinciples("kaputt", "u11"), defaultPrinciples("u11"));
});

test("Eigene Beschreibung wird Inhalt der Einheit im Wochenplan", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  const E0 = createEngine(D, { lang: "de", now: NOW });
  const ws = addDays(monday(E0.TODAY), 7);
  const tr0 = E0.weekPlan(ws).tr.find(p => p.kind !== "frei" && p.md && !p.coach && !D.over[p.date])!;
  assert.ok(tr0, "Trainingstag mit Bezug");
  D.team.principles = { ...D.team.principles, [tr0.md]: { ...D.team.principles[tr0.md], note: "Pressing-Spielformen 4 gg 4" } };
  const E = createEngine(D, { lang: "de", now: NOW });
  const tr = E.weekPlan(ws).tr.find(p => p.date === tr0.date)!;
  assert.equal(tr.inhalt, "Pressing-Spielformen 4 gg 4");
  assert.ok(E.aiContext(() => true).includes("Pressing-Spielformen 4 gg 4"));
});

test("Alte Übungsskizzen werden ins Format der Matchplan-Tafel umgerechnet", () => {
  assert.deepEqual(emptySketch(), { v: 2, view: "att", items: [] });
  assert.equal(toSketch(null), null); assert.equal(toSketch({} as never), null);
  const half: DrawingV1 = { pitch: "half", items: [{ id: "a", t: "a", x: 20, y: 30, n: 7 }, { id: "g", t: "gk", x: 34, y: 2 }, { id: "p", t: "pass", x: 10, y: 10, x2: 30, y2: 20 }] };
  const s = toSketch(half)!;
  assert.equal(s.v, 2); assert.equal(s.view, "att");
  assert.deepEqual(s.items[0], { id: "a", t: "own", x: 20, y: 30, n: 7, pid: null });
  assert.equal(s.items[1].t, "neu"); assert.equal(s.items[1].label, "TW");
  assert.deepEqual([s.items[2].x2, s.items[2].y2], [30, 20]);
  const full = toSketch({ pitch: "full", items: [{ id: "t", t: "goal", x: 0, y: 34 }] })!;
  assert.equal(full.view, "full"); assert.deepEqual([full.items[0].x, full.items[0].y, full.items[0].rot], [34, 105, 90]);
  const free = toSketch({ pitch: "free", items: [{ id: "c", t: "cone", x: 0, y: 0 }] })!;
  assert.ok(free.plain && free.frame); assert.deepEqual([free.items[0].x, free.items[0].y], [14, 37.5]);
  // neues Format bleibt erhalten, unbekannte Ansicht → ganzes Feld
  const v2 = toSketch({ v: 2, view: "x" as never, look: "white", plain: true, items: [{ id: "m", t: "mgoal", x: 10, y: 10 }] })!;
  assert.equal(v2.view, "full"); assert.equal(v2.look, "white"); assert.equal(v2.items[0].t, "mgoal");
});
