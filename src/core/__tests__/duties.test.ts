// Tests: Dienste reihum (fair, Abwesende übersprungen) und Strafen-Automatik (Frist, Einwilligung, nicht rückwirkend).
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { dutyPeriod, dutySuggest, fineSuggest, fineViolations, nextDutyDate, planRotation } from "../duties";
import { createEngine } from "../engine";
import type { DutyEntry, TeamData } from "../types";

const NOW = new Date(2026, 9, 8, 9, 0), TODAY = "2026-10-08";

function base(): TeamData {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  D.absences = []; D.matches = []; D.events = []; D.cal = {}; D.over = {}; D.phases = []; D.duties = []; D.fines = [];
  D.team.settings.days = { 1: { zeit: "18:00", platz: "halb", dauer: 90 }, 3: { zeit: "18:00", platz: "halb", dauer: 90 }, 4: { zeit: "18:00", platz: "halb", dauer: 90 } } as never;
  return D;
}

test("Dienste reihum: jeder kommt dran, keiner doppelt am Tag, Abwesende übersprungen und ersetzt", () => {
  const D = base();
  const defs = dutySuggest("de").filter(d => d.when === "training").map(d => ({ ...d, every: "each" as const })); // Material (2) + Leibchen (1), jedes Mal neu
  const E = createEngine(D, { lang: "de", now: NOW });
  const p1 = planRotation(E, defs, []);
  const days = [...new Set(p1.add.map(x => x.date))];
  assert.ok(days.length >= 5, "14 Tage mit 3 Trainingstagen pro Woche");
  for (const d of days) {
    const pids = p1.add.filter(x => x.date === d).map(x => x.pid);
    assert.equal(pids.length, 3); assert.equal(new Set(pids).size, 3, "niemand hat zwei Dienste am selben Tag");
  }
  const cnt = new Map<string, number>(); p1.add.forEach(x => cnt.set(x.pid, (cnt.get(x.pid) || 0) + 1));
  assert.ok(Math.max(...cnt.values()) <= 1, "bei 23 Spielern und ≤ 21 Plätzen niemand zweimal");
  // Abwesend am ersten Termin → wird beim nächsten Lauf ersetzt
  const first = p1.add[0], rows: DutyEntry[] = p1.add.map((x, i) => ({ ...x, id: "r" + i }));
  D.absences.push({ id: "a1", pid: first.pid, typ: "urlaub", von: first.date, bis: first.date, stufe: null, notiz: "" });
  const E2 = createEngine(D, { lang: "de", now: NOW });
  const p2 = planRotation(E2, defs, rows);
  assert.deepEqual(p2.remove, ["r0"]);
  assert.equal(p2.add.length, 1); assert.equal(p2.add[0].date, first.date); assert.notEqual(p2.add[0].pid, first.pid);
  // vom Trainer ausgetragen (erlassen) → Platz wird neu besetzt, aber nicht mit demselben Spieler
  const second = rows[1], rows3 = rows.map(r => r.id === second.id ? { ...r, status: "waived" as const } : r);
  const p3 = planRotation(createEngine(base(), { lang: "de", now: NOW }), defs, rows3);
  const refill = p3.add.find(x => x.date === second.date && x.duty === second.duty)!;
  assert.ok(refill && refill.pid !== second.pid);
});

test("Dienste mit Wechsel: wöchentlich derselbe Spieler, nächste Woche ein anderer; Abwesende vertreten; monatlich", () => {
  const D = base();
  const bibs = { id: "bibs", name: "Leibchen waschen", when: "training" as const, count: 1, on: true, every: "week" as const };
  assert.equal(dutySuggest("de").find(d => d.id === "bibs")?.every, "week", "Vorschlag: Leibchen wöchentlich");
  assert.equal(dutyPeriod("week", "2026-10-14"), "2026-10-12"); assert.equal(dutyPeriod("month", "2026-10-14"), "2026-10");
  const [q1, q2, q3] = ["2026-10-12", "2026-10-19", "2026-10-26"].map(d => dutyPeriod("2weeks", d));
  assert.ok((q1 === q2) !== (q2 === q3), "je zwei Wochen am Stück"); assert.equal(dutyPeriod("2weeks", "2026-10-21"), q2, "ganze Woche im selben Abschnitt");
  assert.equal(dutyPeriod(undefined, "2026-10-14"), "2026-10-14");
  const E = createEngine(D, { lang: "de", now: NOW });
  const p1 = planRotation(E, [bibs], [], 14);
  const byWeek = new Map<string, Set<string>>();
  for (const x of p1.add) { const w = dutyPeriod("week", x.date); byWeek.set(w, (byWeek.get(w) || new Set()).add(x.pid)); }
  assert.ok(byWeek.size >= 2, "mindestens zwei Wochen geplant");
  for (const [, s] of byWeek) assert.equal(s.size, 1, "eine Woche = ein Spieler");
  const [w1, w2] = [...byWeek.values()].map(s => [...s][0]);
  assert.notEqual(w1, w2, "nächste Woche ist ein anderer dran");
  // Inhaber fehlt an einem Termin der Woche → nur dort springt jemand ein, danach wieder der Inhaber
  const rows: DutyEntry[] = p1.add.map((x, i) => ({ ...x, id: "r" + i }));
  const wk = rows.filter(r => r.pid === w1), miss = wk[1] || wk[0];
  D.absences.push({ id: "a1", pid: w1, typ: "urlaub", von: miss.date, bis: miss.date, stufe: null, notiz: "" });
  const p2 = planRotation(createEngine(D, { lang: "de", now: NOW }), [bibs], rows, 14);
  assert.deepEqual(p2.remove, [miss.id]); assert.equal(p2.add.length, 1); assert.notEqual(p2.add[0].pid, w1);
  // Inhaber von Hand eingetragen (Woche schon begonnen) → behält den Dienst für die übrigen Termine
  const D3 = base(), E3 = createEngine(D3, { lang: "de", now: NOW });
  const ds = planRotation(E3, [bibs], [], 14).add.map(x => x.date), pick = D3.players[5].id;
  const firstDay = ds.find(d => ds.filter(x => dutyPeriod("week", x) === dutyPeriod("week", d)).length >= 2)!; // Woche mit mehreren Terminen
  const p3 = planRotation(E3, [bibs], [{ id: "m", date: firstDay, duty: "bibs", pid: pick, source: "manual", fineId: null, status: "open" }], 14);
  const sameWeek = p3.add.filter(x => dutyPeriod("week", x.date) === dutyPeriod("week", firstDay));
  assert.ok(sameWeek.length >= 1 && sameWeek.every(x => x.pid === pick), "von Hand eingeteilter Spieler bleibt die Woche über");
  // monatlich: alle Termine der nächsten 14 Tage im selben Monat → ein Spieler je Monat
  const p4 = planRotation(createEngine(base(), { lang: "de", now: NOW }), [{ ...bibs, every: "month" }], [], 14);
  const months = new Map<string, Set<string>>();
  for (const x of p4.add) { const m = x.date.slice(0, 7); months.set(m, (months.get(m) || new Set()).add(x.pid)); }
  for (const [, s] of months) assert.equal(s.size, 1);
});

test("Strafen-Automatik: RPE-Frist 24 Std., nur mit Einwilligung, nicht rückwirkend, keine Doppelungen", () => {
  const D = base();
  const day = addDays(TODAY, -2); // Dienstag? egal – Einheit direkt anlegen
  D.sessions = [{ date: day, typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 6 }];
  const [a, b, c] = D.players;
  D.att[day] = { [a.id]: "da", [b.id]: "da", [c.id]: "unent" };
  for (const p of [a, b]) delete D.rpe[p.id]?.[day];
  const rules = fineSuggest("de").map(r => r.trigger !== "manual" ? { ...r, on: true, since: addDays(TODAY, -5) } : r);
  const E = createEngine(D, { lang: "de", now: NOW });
  const v = fineViolations(E, rules, [], pid => pid === a.id);
  assert.deepEqual(v.filter(x => x.rule.trigger === "late_rpe").map(x => x.pid), [a.id], "nur Spieler mit Einwilligung");
  assert.deepEqual(v.filter(x => x.rule.trigger === "unexcused").map(x => x.pid), [c.id]);
  // vorhanden (auch erlassen) → kein zweites Mal
  const v2 = fineViolations(E, rules, [{ id: "f", pid: a.id, rule: "late_rpe", date: TODAY, ref: day, amount: null, note: "", status: "waived", auto: true, dutyDate: null }], () => true);
  assert.ok(!v2.some(x => x.pid === a.id && x.rule.trigger === "late_rpe"));
  // nicht rückwirkend: Regel erst heute eingeschaltet
  assert.equal(fineViolations(E, rules.map(r => ({ ...r, since: TODAY })), [], () => true).length, 0);
  // Frist noch nicht abgelaufen (Einheit gestern Abend)
  D.sessions = [{ date: addDays(TODAY, -1), typ: "Training", dauer: 90, zeit: "18:00", md: "", ziel: 6 }];
  D.att[addDays(TODAY, -1)] = { [a.id]: "da" };
  const E3 = createEngine(D, { lang: "de", now: NOW });
  assert.equal(fineViolations(E3, rules, [], () => true).filter(x => x.rule.trigger === "late_rpe").length, 0);
});

test("Strafen-Dienst: nächster Termin, der noch nicht begonnen hat", () => {
  const D = base();
  const E = createEngine(D, { lang: "de", now: NOW });
  const def = dutySuggest("de")[0];
  assert.equal(nextDutyDate(E, def), TODAY, "heute 18:00 ist noch nicht vorbei (jetzt 9:00)");
  const E2 = createEngine(D, { lang: "de", now: new Date(2026, 9, 8, 19, 0) });
  assert.equal(nextDutyDate(E2, def), "2026-10-12", "nach Trainingsbeginn: nächster Montag");
});
