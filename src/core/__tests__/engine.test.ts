// Tests der Fachlogik. Ausführen: npm run test:core (kompiliert mit tsc und startet node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSES, BANDS } from "../classes";
import { addDays, iso, monday, parse } from "../dates";
import { buildDemo, demoTeam, sampleFixtures } from "../demo";
import { createEngine, parsePotentials } from "../engine";
import { parseFixtures } from "../fixtures";
import type { Depth, Lang } from "../types";

// Fester Zeitpunkt: Mittwoch, 7. Oktober 2026, 10:00
const NOW = new Date(2026, 9, 7, 10, 0, 0);

const bad = (s: string): boolean => /undefined|NaN|\[object/.test(s);

test("Demo-Daten und Wochenpläne für alle Altersklassen und Tiefen ohne Fehler", () => {
  for (const c of CLASSES) for (const depth of ["org", "basis", "pro"] as Depth[]) for (const lang of ["de", "en"] as Lang[]) {
    const D = buildDemo(demoTeam(c.k, depth, lang), lang, NOW);
    const E = createEngine(D, { lang, now: NOW });
    for (let w = -1; w <= 4; w++) {
      const ws = addDays(monday(E.TODAY), 7 * w);
      for (const mode of ["normal", "aufbau", "entlastung"] as const) {
        D.wkMode[ws] = mode;
        const E2 = createEngine(D, { lang, now: NOW });
        const wp = E2.weekPlan(ws);
        assert.equal(wp.items.length, 7);
        assert.ok(Number.isFinite(wp.trainAU) && Number.isFinite(wp.baseAU), "AU endlich");
        for (const tr of wp.tr) { assert.ok(tr.rpe >= 0 && tr.rpe <= 10); assert.ok(!bad(tr.inhalt), "Inhalt " + tr.kind); assert.ok(!bad(E2.whyOf(tr))); }
      }
      D.wkMode[ws] = "normal";
    }
    for (const p of D.players) {
      const pr = E.profile(p.id);
      assert.ok(!pr.reasons.some(r => bad(r[1])), "Gründe " + c.k);
      assert.ok(!bad(E.advice(pr)));
      const s = E.suggestRec(p); assert.ok(!bad(s.text));
      const st = E.playerState(p); assert.ok(!bad(st.why));
      for (const tip of [E.tipRegen(p, pr), E.tipGym(p, pr), E.tipFood(p), E.tipSleep(pr)]) { assert.ok(!bad(tip.head + tip.items.join(" "))); }
      const tx = E.tipExtra(p, pr); if (tx) assert.ok(!bad(tx.head + tx.budget + tx.done));
      for (const h of E.dataHints(p)) assert.ok(!bad(h.text));
    }
    assert.ok(!bad(E.aiContext(() => true)));
  }
});

test("Spieltags-Bezug: Sonntagsspiel → Mo MD+1, Di MD+2, Mi MD-4, Sa MD-1", () => {
  const D = buildDemo(demoTeam("u19"), "de", NOW);
  const E = createEngine(D, { lang: "de", now: NOW });
  const sun = D.matches.map(m => m.date).filter(d => d > E.TODAY && parse(d).getDay() === 0).sort()[0];
  const mon = addDays(sun, -6);
  // Die Vorwoche muss ebenfalls ein Sonntagsspiel haben
  assert.ok(D.matches.some(m => m.date === addDays(sun, -7)));
  assert.equal(E.mdOf(mon).md, "MD+1");
  assert.equal(E.mdOf(addDays(mon, 1)).md, "MD+2");
  assert.equal(E.mdOf(addDays(mon, 2)).md, "MD-4");
  assert.equal(E.mdOf(addDays(mon, 5)).md, "MD-1");
  assert.equal(E.mdOf(sun).md, "MD");
});

test("Prinzipien: MD-4 intensiv, MD+2 frei (U19-Standard)", () => {
  const team = demoTeam("u19");
  team.settings.days[2] = { zeit: "19:30", platz: "halb", dauer: 90 }; // Dienstag dazu
  const D = buildDemo(team, "de", NOW);
  const E = createEngine(D, { lang: "de", now: NOW });
  const wp = E.weekPlan(monday(E.TODAY));
  const tue = wp.items[1], wed = wp.items[2];
  assert.equal(tue.md, "MD+2"); assert.equal(tue.train?.kind, "frei");
  assert.equal(wed.md, "MD-4"); assert.equal(wed.train?.kind, "intensiv");
});

test("Entlastung senkt die Trainingslast um mindestens 25 %, Aufbau erhöht oder erklärt die Grenze", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  const ws = monday(iso(NOW));
  const base = createEngine(D, { lang: "de", now: NOW }).weekPlan(ws);
  D.wkMode[ws] = "entlastung";
  const ent = createEngine(D, { lang: "de", now: NOW }).weekPlan(ws);
  assert.ok(ent.trainAU <= base.trainAU * 0.75, `Entlastung ${ent.trainAU} vs ${base.trainAU}`);
  D.wkMode[ws] = "aufbau";
  const auf = createEngine(D, { lang: "de", now: NOW }).weekPlan(ws);
  assert.ok(auf.trainAU > base.trainAU || auf.limit, "Aufbau wirkt oder nennt die Grenze");
  assert.ok(auf.tr.some(p => p.changes.length > 0), "Änderungen sichtbar");
});

test("Englische Woche: Aufbau wird begründet abgelehnt", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  const pokal = D.matches.find(m => m.comp === "pokal")!;
  const ws = monday(pokal.date);
  D.wkMode[ws] = "aufbau";
  const wp = createEngine(D, { lang: "de", now: NOW }).weekPlan(ws);
  assert.ok(wp.items.filter(x => x.match).length >= 2);
  assert.equal(wp.limit?.congested, true);
});

test("Erholungsmodell nach Alter", () => {
  const D = buildDemo(demoTeam("u19"), "de", NOW);
  const E = createEngine(D, { lang: "de", now: NOW });
  const p17 = { ...D.players[0], id: "x17", geb: iso(new Date(2009, 0, 1)) };
  const p30 = { ...D.players[0], id: "x30", geb: iso(new Date(1996, 0, 1)) };
  assert.equal(E.recoveryNeed(p17, { typ: "Training", rpe: 8, min: 90 }).h, BANDS[2][1]);
  assert.equal(E.recoveryNeed(p17, { typ: "Spiel", rpe: 8, min: 90 }).h, BANDS[2][2]);
  assert.equal(E.recoveryNeed(p30, { typ: "Spiel", rpe: 8, min: 90 }).h, BANDS[5][2]);
  assert.equal(E.recoveryNeed(p30, { typ: "Spiel", rpe: 8, min: 45 }).h, Math.round(BANDS[5][2] * 0.75));
});

test("Spielplan-Import: Text und .ics", () => {
  const team = demoTeam("u19");
  const f = parseFixtures(sampleFixtures(team, NOW), team.club, team.name, "15:00");
  assert.equal(f.length, 3); assert.equal(f[0].heim, true); assert.equal(f[1].heim, false);
  const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=Europe/Berlin:20261122T130000\nSUMMARY:TuS Beispiel U19 - Mein Verein U19\nEND:VEVENT\nEND:VCALENDAR";
  const g = parseFixtures(ics, "Mein Verein", "U19", "15:00");
  assert.deepEqual(g[0], { date: "2026-11-22", zeit: "13:00", comp: "liga", gegner: "TuS Beispiel U19", heim: false });
});

test("KI-Potenziale werden zerlegt", () => {
  const r = parsePotentials("- Athletik: Mehr Sprints\n- **Belastbarkeit**: Konstant da\n- Mental: Führung\nText");
  assert.deepEqual(r.map(x => x.cat), ["ath", "verf", "ment"]);
});

test("Demo-Daten sind deterministisch", () => {
  const a = buildDemo(demoTeam("u19"), "de", NOW), b = buildDemo(demoTeam("u19"), "de", NOW);
  assert.deepEqual(a.rpe, b.rpe); assert.deepEqual(a.sessions, b.sessions);
});
