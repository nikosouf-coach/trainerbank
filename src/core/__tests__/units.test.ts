// Tests: mehrere Einheiten am Tag (wiederkehrend, Tageseinträge, Ausfall), Belastung, RPE je Einheit, Torwart, Trainingseindruck.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSES } from "../classes";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { applyOp, enqueue, outboxKey, type OutboxItem } from "../outbox";
import { teamPatchPerms, viewFor } from "../perms";
import { cleanUnit, freeDateSlot, inUnit, mergeUnits, trainingForm, twPhase } from "../units";
import type { DayUnit, TeamData } from "../types";

// Mittwoch, 7. Oktober 2026, 10:00 – Trainingstage Mo/Mi/Do/Fr 19:30, Spiel sonntags
const NOW = new Date(2026, 9, 7, 10, 0);
const unit = (p: Partial<DayUnit> & { slot: number }): DayUnit => ({ art: "athletik", title: "", zeit: "19:00", dauer: 30, rpe: 6, groupId: null, staffId: null, inhalt: "", ...p });
function setup(): TeamData {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  D.groups.push({ id: "gtw", name: "Torhüter", kind: "tw", vis: true });
  for (const p of D.players) if (p.pos === "TW") p.groups = ["gtw"];
  return D;
}

test("Wiederkehrende Einheiten: Wochentag, Start ab, Ausfall an Spieltagen, bei abgesagtem Training und in Pausen", () => {
  const D = setup();
  D.team.settings.units = {
    1: [unit({ slot: 1 })],                                                       // Mo: Athletik vor dem Training
    2: [unit({ slot: 1, art: "tw", zeit: "18:00", dauer: 60, rpe: 7 })],          // Di: Torwarttraining (kein Mannschaftstraining)
    0: [unit({ slot: 1, art: "praev", zeit: "10:00", dauer: 20, rpe: null })],    // So: Spieltag ⇒ fällt aus
    4: [unit({ slot: 2, art: "kraft", zeit: "18:30", dauer: 45, from: "2026-10-10" })],
  };
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.equal(E.unitsOn("2026-10-05").length, 1, "Montag mit Athletik");
  assert.equal(E.unitsOn("2026-10-06")[0].art, "tw", "Dienstag ohne Mannschaftstraining: Torwarttraining findet statt");
  assert.deepEqual(E.unitsOn("2026-10-11"), [], "Spieltag: wiederkehrende Einheit entfällt");
  assert.deepEqual(E.unitsOn("2026-10-26"), [], "Training durch Termin ersetzt (Herbstferien): Einheit entfällt");
  assert.equal(E.unitsOn("2026-10-08").length, 0, "Start ab 10.10. – vorher nicht");
  assert.equal(E.unitsOn("2026-10-15").length, 1, "… danach jeden Donnerstag");
  const wp = E.weekPlan("2026-10-05");
  assert.equal(wp.items[0].units.length, 1); assert.equal(wp.items[1].units.length, 1); assert.equal(wp.items[6].units.length, 0);
  assert.ok(wp.unitAU > 0, "geplante Last weiterer Einheiten");
  // Richtwert ohne Ziel-RPE
  assert.equal(E.unitRpe(unit({ slot: 3, art: "praev", rpe: null })), 3);
  assert.equal(E.unitTitle(unit({ slot: 3, art: "tw" })), "Torwarttraining");
  assert.equal(E.unitTitle(unit({ slot: 3, title: "Sprint-ABC" })), "Sprint-ABC");
});

test("Tageseinträge ersetzen, sagen ab oder ergänzen – auch an Spieltagen", () => {
  const D = setup();
  D.team.settings.units = { 1: [unit({ slot: 1 })] };
  D.units["2026-10-12"] = [unit({ slot: 1, dauer: 45 })];
  D.units["2026-10-19"] = [unit({ slot: 1, cancel: true })];
  D.units["2026-10-11"] = [unit({ slot: 4, art: "sonst", title: "Ergänzung Nicht-Kader", zeit: "09:30", dauer: 40, rpe: 7 })];
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.equal(E.unitsOn("2026-10-12")[0].dauer, 45, "Tageseintrag ersetzt die wiederkehrende Einheit");
  assert.deepEqual(E.unitsOn("2026-10-19"), [], "abgesagt");
  assert.equal(E.unitsOn("2026-10-11")[0].title, "Ergänzung Nicht-Kader", "zusätzliche Einheit am Spieltag");
  assert.equal(freeDateSlot(D, "2026-10-12"), 2, "nächste freie Nummer");
  assert.deepEqual(mergeUnits([unit({ slot: 2, zeit: "19:00" })], [unit({ slot: 1, zeit: "17:30" })]).map(u => u.slot), [1, 2], "nach Uhrzeit sortiert");
});

test("Mitglieder: Gruppe, Torwarttraining ohne Gruppe = alle Torhüter, sonst alle", () => {
  const D = setup();
  const p1 = D.players.find(p => p.id === "p1")!, p2 = D.players.find(p => p.id === "p2")!;
  assert.ok(inUnit(D, unit({ slot: 1, art: "tw" }), p1) && !inUnit(D, unit({ slot: 1, art: "tw" }), p2));
  assert.ok(inUnit(D, unit({ slot: 1 }), p2), "Athletik für alle");
  assert.ok(!inUnit(D, unit({ slot: 1, groupId: "gtw" }), p2) && inUnit(D, unit({ slot: 1, groupId: "gtw" }), p1));
  assert.ok(!inUnit(D, unit({ slot: 1, groupId: "geloescht" }), p1), "gelöschte Gruppe: niemand");
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.equal(E.unitMembers(unit({ slot: 1, art: "tw" })).length, D.players.filter(p => p.pos === "TW").length);
});

test("RPE weiterer Einheiten zählt zur Tageslast und zur Erholung; Spieler sehen ihre Einheiten zum Eintragen", () => {
  const D = setup();
  D.team.settings.units = { 2: [unit({ slot: 1, art: "tw", zeit: "18:00", dauer: 60, rpe: 7 })] };
  const before = createEngine(D, { lang: "de", now: NOW });
  const p1 = before.P("p1")!, p2 = before.P("p2")!;
  const d0 = before.daily("p1")["2026-10-06"] || 0;
  const open = before.playerOpenTarget(p1);
  assert.equal(open?.slot, 1, "offenes Torwarttraining");
  assert.equal(open?.date, "2026-10-06");
  assert.ok(before.rpeTargets(p1).some(x => x.slot === 1 && x.date === "2026-10-06"));
  assert.ok(!before.rpeTargets(p2).some(x => x.slot === 1), "Feldspieler: kein Torwarttraining");
  applyOp(D, { op: "rpe", pid: "p1", date: "2026-10-06", e: { rpe: 8, min: 60, dives: 32 }, slot: 1 });
  assert.equal(D.att["2026-10-06"]?.p1, undefined, "keine Anwesenheit durch weitere Einheit");
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.equal((E.daily("p1")["2026-10-06"] || 0) - d0, 480, "8 × 60 AU zusätzlich");
  assert.equal(E.rpeOf("p1", "2026-10-06", 1)?.dives, 32);
  const ev = E.lastIntenseBefore(p1, NOW);
  assert.equal(ev?.date, "2026-10-06"); assert.equal(ev?.min, 60);
  assert.notEqual(E.playerOpenTarget(p1)?.slot, 1, "eingetragen ⇒ nicht mehr offen");
  assert.equal(E.unitAvg("2026-10-06", 1), 8);
  assert.ok(E.metrics("p1") && Number.isFinite(E.metrics("p1")!.wk));
  applyOp(D, { op: "rpe", pid: "p1", date: "2026-10-06", e: null, slot: 1 });
  assert.equal(D.rpeU.p1?.["2026-10-06"], undefined, "Löschen räumt auf");
});

test("Offline-Warteschlange: RPE je Einheit getrennt", () => {
  const it = (slot?: number): OutboxItem => ({ team: "t", at: "2026-10-07T08:00:00.000Z", tries: 0, o: { op: "rpe", pid: "p1", date: "2026-10-06", e: { rpe: 6, min: 60 }, ...(slot ? { slot } : {}) } });
  assert.equal(outboxKey(it().o), "rpe:p1:2026-10-06", "Mannschaftstraining wie bisher");
  assert.equal(outboxKey(it(2).o), "rpe:p1:2026-10-06:2");
  assert.equal(enqueue(enqueue([], it()), it(2)).length, 2);
});

test("Geplante weitere Einheiten fließen in den Abgleich mit der gewohnten Last ein", () => {
  const D = setup(), ws = "2026-10-12";
  const base = createEngine(D, { lang: "de", now: NOW }).weekPlan(ws);
  D.team.settings.units = Object.fromEntries([1, 3, 4, 5].map(wd => [wd, [unit({ slot: 1, art: "kraft", zeit: "18:00", dauer: 90, rpe: 8 })]]));
  const heavy = createEngine(D, { lang: "de", now: NOW }).weekPlan(ws);
  assert.ok(heavy.unitAU > 1000, "viel zusätzliche Last");
  assert.ok(heavy.trainAU < base.trainAU, `Mannschaftstraining wird entlastet (${heavy.trainAU} < ${base.trainAU})`);
  assert.ok(heavy.tr.some(x => x.notes.includes("au_down")));
});

test("Trainingseindruck: nur Ausreißer zählen, Standard ist Durchschnitt", () => {
  const D = setup();
  const tr = D.sessions.filter(s => s.typ === "Training" && s.date < "2026-10-07").slice(-3);
  for (const s of tr) (D.att[s.date] ||= {}).p6 = "da";
  D.ratings.push({ id: "m1", pid: "p6", date: tr[0].date, kind: "training", rating: null, text: "", vis: true, mark: "good", tags: ["effort"] });
  D.ratings.push({ id: "m2", pid: "p6", date: tr[1].date, kind: "training", rating: null, text: "", vis: false, mark: "poor", tags: ["focus"] });
  D.ratings.push({ id: "m3", pid: "p6", date: tr[2].date, kind: "training", rating: null, text: "", vis: true, mark: "good", tags: [] });
  const f = trainingForm(D, "p6", "2026-10-07");
  assert.equal(f.good, 2); assert.equal(f.poor, 1); assert.ok(f.n >= 3);
  assert.equal(f.last[0].id, "m3", "neueste zuerst");
  assert.equal(trainingForm(D, "p6", "2026-10-07", 28, true).poor, 0, "Spieler sehen nur freigegebene");
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.equal(E.trainForm("p6").good, 2);
  assert.equal(E.seasonStats("p6").avg, null, "Eindrücke ohne Note verändern den Notenschnitt nicht");
});

test("Torhüter: Spieldaten, Tipp nach Spieltags-Bezug, Sprünge", () => {
  const D = setup();
  const past = D.matches.filter(m => m.date < "2026-10-07").slice(-2);
  past.forEach((m, i) => { (D.stats[m.id] ||= {}).p1 = { min: 90, goals: 0, assists: 0, start: true, conceded: i ? 2 : 0, saves: 4 }; });
  const E = createEngine(D, { lang: "de", now: NOW });
  const gk = E.seasonStats("p1").gk!;
  assert.equal(gk.games, 2); assert.equal(gk.conceded, 2); assert.equal(gk.clean, 1); assert.equal(gk.saves, 8);
  assert.equal(E.seasonStats("p2").gk, null, "Feldspieler ohne Torwartdaten");
  const tip = E.tipTw(E.P("p1")!)!;
  assert.equal(tip.phase, "power", "Mittwoch vor Sonntag (MD-4): Kraft & Explosivität");
  assert.ok(tip.items.length >= 2 && !tip.items.some(x => /undefined|NaN|\{/.test(x)));
  assert.equal(E.tipTw(E.P("p2")!), null);
  assert.equal(twPhase("MD-1"), "act"); assert.equal(twPhase("MD+1"), "rec"); assert.equal(twPhase(""), "dev");
  // viele Sprünge am Tag vor dem Spiel ⇒ Hinweis für Trainer
  applyOp(D, { op: "rpe", pid: "p1", date: "2026-10-10", e: { rpe: 5, min: 60, dives: 30 }, slot: 1 });
  assert.ok(createEngine(D, { lang: "de", now: NOW }).twDivesWarn("p1", "2026-10-10"));
});

test("Einheit bereinigen; Rechte und Sicht", () => {
  const u = cleanUnit({ slot: 0, art: "tw", dauer: 999, zeit: "25:99", rpe: 12, themes: ["fangen", "quatsch", "flanken"] });
  assert.equal(u.slot, 1); assert.equal(u.dauer, 240); assert.equal(u.zeit, "17:30"); assert.equal(u.rpe, 10);
  assert.deepEqual(u.themes, ["fangen", "flanken"]);
  assert.equal(cleanUnit({ slot: 3, art: "sonst", rpe: null }).rpe, null);
  const D = setup(); D.rpeU = { p1: { "2026-10-06": { 1: { rpe: 6, min: 60 } } } };
  assert.deepEqual(viewFor(D, new Set(["plan"]), true).rpeU, {}, "ohne Recht „Gesundheit“ keine RPE weiterer Einheiten");
  assert.deepEqual(teamPatchPerms({ settings: { ...D.team.settings, units: { 1: [] } } }, D.team as never), ["plan"]);
});

test("Demo (alle Altersklassen): Einheiten, RPE je Einheit, Eindrücke und Torwartdaten ohne Fehler", () => {
  const bad = (x: string): boolean => /undefined|NaN|\[object|\{\w+\}/.test(x);
  for (const c of CLASSES) for (const lang of ["de", "en"] as const) {
    const D = buildDemo(demoTeam(c.k, "pro", lang), lang, NOW); demoExtras(D, lang, NOW);
    const E = createEngine(D, { lang, now: NOW });
    if (c.grp === "u11") { assert.equal(D.team.settings.units, undefined, "Kinder: keine weiteren Einheiten"); continue; }
    assert.ok(Object.values(D.team.settings.units || {}).flat().length >= 1, c.k + ": wiederkehrende Einheiten");
    assert.ok(Object.keys(D.rpeU).length > 0, c.k + ": RPE weiterer Einheiten");
    assert.ok(D.ratings.some(r => r.mark), c.k + ": Trainingseindrücke");
    for (let w = -1; w <= 2; w++) { const wp = E.weekPlan(addWeeks(E.TODAY, w)); assert.ok(Number.isFinite(wp.unitAU)); for (const x of wp.items) for (const u of x.units) assert.ok(!bad(E.unitTitle(u))); }
    for (const p of D.players) {
      for (const x of E.rpeTargets(p)) assert.ok(!bad(x.title) && x.dauer > 0);
      const tw = E.tipTw(p); if (tw) assert.ok(!bad(tw.head + tw.items.join(" ")), c.k + " TW-Tipp");
      const f = E.trainForm(p.id); assert.ok(f.good >= 0 && f.poor >= 0);
      assert.ok(Number.isFinite(E.metrics(p.id)?.wk ?? 0));
    }
    const gk = D.players.find(p => p.pos === "TW")!;
    assert.ok(E.seasonStats(gk.id).gk, c.k + ": Torwart-Spieldaten");
    assert.ok(D.tests.some(x => x.test === "tw_lateral" && x.pid === gk.id), c.k + ": Torwarttests");
  }
});
const addWeeks = (d: string, w: number): string => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + 7 * w); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
