// Tests: Matchplan – Grundordnungen, Aufstellung per Ziehen, Spielminuten, Folien, Freigabe, Bereinigung, Demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import {
  DEFAULT_SECTIONS, FORMATIONS, MP_VIEWS, availFor, changedSincePublish, cleanContent, copyPlan, defaultUntil, emptyContent, fmtOf, forPlayer, lineupFor,
  newPlan, newSlide, oppLineup, placePlayer, plannedMinutes, publishedOf, seenStats, shareState, slotsOf, squadOf, stableJson, suggestLineup, visibleTo,
} from "../matchplan";
import type { MatchPlan, MpContent, Player } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0);
const pl = (id: string, pos: string, nr: number): Player => ({ id, vn: id.toUpperCase(), nn: "X", pos, nr, geb: "2008-01-01" });
const SQUAD: Player[] = [
  pl("tw1", "TW", 1), pl("tw2", "TW", 12), pl("lv", "LV", 3), pl("iv1", "IV", 4), pl("iv2", "IV", 5), pl("rv", "RV", 2), pl("dm1", "DM", 6), pl("dm2", "ZM", 8),
  pl("lm", "LM", 11), pl("om", "OM", 10), pl("rm", "RM", 7), pl("st", "ST", 9), pl("st2", "ST", 19), pl("zm3", "ZM", 14), pl("iv3", "IV", 15), pl("rv2", "RV", 22),
];
const full = (): MpContent => suggestLineup(emptyContent("u19"), SQUAD, () => true);

test("Grundordnungen: Spielform nach Altersklasse, elf/neun/sieben/fünf Positionen inkl. Torwart, Feld in Grenzen", () => {
  assert.equal(fmtOf("sen"), 11); assert.equal(fmtOf("u13"), 9); assert.equal(fmtOf("u11"), 7); assert.equal(fmtOf("u8"), 5);
  for (const fmt of [11, 9, 7, 5] as const) for (const k of Object.keys(FORMATIONS[fmt])) {
    const s = slotsOf(fmt, k);
    assert.equal(s.length, fmt, `${fmt} ${k}`);
    assert.equal(s[0].pos, "TW");
    assert.ok(s.every(x => x.x >= 0 && x.x <= 68 && x.y >= 0 && x.y <= 105), `${k} im Feld`);
    // Formation stimmt mit der Bezeichnung überein (Summe der Ketten)
    assert.equal(k.split("-").map(Number).reduce((a, b) => a + b, 0), fmt - 1, `${k} Summe`);
  }
  const opp = oppLineup(11, "4-4-2");
  assert.equal(opp.length, 11); assert.equal(opp[0].y, 7); assert.equal(opp[0].x, 34);
  assert.ok(opp.every(x => x.t === "opp"));
});

test("Aufstellung: Vorschlag nach Position, Torwart ins Tor, zweiter Torwart auf die Bank", () => {
  const c = full();
  const at = (pos: string) => c.lineup.filter(x => x.label === pos).map(x => x.pid);
  assert.deepEqual(at("TW"), ["tw1"]);
  assert.deepEqual(at("IV").sort(), ["iv1", "iv2"]);
  assert.deepEqual(at("ST"), ["st"]);
  assert.equal(c.lineup.filter(x => x.pid).length, 11);
  assert.equal(c.bench[0], "tw2", "zweiter Torwart zuerst auf die Bank");
  assert.equal(c.bench.length, 5, "Rest der 16 Spieler auf der Bank (max. 7)");
  assert.equal(squadOf(c).length, 16);
});

test("Ziehen: tauschen auf dem Feld, von der Bank einwechseln, auf die Bank, aus dem Kader, frei verschieben", () => {
  let c = full();
  const slotOf = (pid: string) => c.lineup.find(x => x.pid === pid)!;
  // Feld ↔ Feld: tauschen
  const stSlot = slotOf("st").id, omSlot = slotOf("om").id;
  c = placePlayer(c, "st", { k: "slot", id: omSlot });
  assert.equal(c.lineup.find(x => x.id === omSlot)!.pid, "st"); assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, "om");
  // Bank → besetzte Position: Bisheriger geht auf die Bank (an dieselbe Stelle)
  const benchIdx = c.bench.indexOf("st2");
  c = placePlayer(c, "st2", { k: "slot", id: stSlot });
  assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, "st2");
  assert.equal(c.bench[benchIdx], "om"); assert.ok(!c.bench.includes("st2"));
  // Feld → Bank: Position bleibt frei
  c = placePlayer(c, "st2", { k: "bench" });
  assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, null); assert.ok(c.bench.includes("st2"));
  // aus dem Kader
  c = placePlayer(c, "st2", { k: "out" });
  assert.ok(!squadOf(c).includes("st2"));
  // von außen frei aufs Feld: nimmt die freie Position (nah genug → einrasten)
  const free = c.lineup.find(x => x.id === stSlot)!;
  c = placePlayer(c, "st2", { k: "free", x: free.x + 3, y: free.y + 2 });
  assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, "st2");
  assert.equal(c.lineup.find(x => x.id === stSlot)!.x, free.x, "eingerastet: Position bleibt");
  // Spieler auf dem Feld frei verschieben (weit weg von anderen Positionen)
  const lv = slotOf("lv");
  c = placePlayer(c, "lv", { k: "free", x: 4, y: 60 });
  assert.deepEqual([c.lineup.find(x => x.id === lv.id)!.x, c.lineup.find(x => x.id === lv.id)!.y], [4, 60]);
  // volle Elf: von außen frei aufs Feld ohne Position in der Nähe → unverändert
  const before = stableJson(c);
  const c2 = placePlayer(c, "zm3", { k: "out" });
  assert.equal(stableJson(placePlayer(c2, "zm3", { k: "free", x: 64, y: 104 })), stableJson(c2));
  assert.equal(stableJson(c), before);
  // Kapitän verliert die Binde, wenn er aus dem Kader geht
  c = { ...c, captain: "iv1" };
  assert.equal(placePlayer(c, "iv1", { k: "bench" }).captain, "iv1");
  assert.equal(placePlayer(c, "iv1", { k: "out" }).captain, null);
});

test("Grundordnung wechseln: Spieler bleiben auf passender Position, Überzählige auf die Bank", () => {
  const c = full();
  const { lineup, out } = lineupFor(11, "3-5-2", c.lineup);
  assert.equal(out.length, 0);
  assert.equal(lineup.filter(x => x.pid).length, 11);
  assert.equal(lineup.find(x => x.label === "TW")!.pid, "tw1");
  assert.ok(lineup.filter(x => x.label === "ST").some(x => x.pid === "st"), "Stürmer bleibt im Sturm");
  assert.ok(lineup.filter(x => x.label === "IV").every(x => ["iv1", "iv2", "lv", "rv", "dm1"].includes(x.pid || "")), "Dreierkette aus Abwehrspielern");
  // Wechsel auf 7er: vier müssen raus
  const small = lineupFor(7, "2-3-1", c.lineup);
  assert.equal(small.lineup.length, 7); assert.equal(small.out.length, 4);
  assert.equal(small.lineup[0].pid, "tw1");
});

test("Wechselplan: geplante Minuten, Wiedereinwechseln, Hinweise", () => {
  let c = full();
  c = { ...c, subs: [
    { id: "a", min: 60, out: "st", in: "st2", note: "" },
    { id: "b", min: 75, out: "lm", in: "zm3", note: "" },
    { id: "c", min: 80, out: "st2", in: "st", note: "" },
    { id: "d", min: 85, out: "xx", in: "iv3", note: "" },
    { id: "e", min: 70, out: "om", in: "om", note: "" },
    { id: "f", min: 95, out: null, in: "rv", note: "" },
  ] };
  const { min, issues } = plannedMinutes(c, 90);
  assert.equal(min.st, 60 + 10); assert.equal(min.st2, 20); assert.equal(min.lm, 75); assert.equal(min.zm3, 15); assert.equal(min.tw1, 90);
  assert.equal(min.iv3, 5); assert.equal(min.tw2, 0, "Bank ohne Einsatz: 0");
  assert.deepEqual(issues.map(x => x.id + ":" + x.k).sort(), ["d:out_not_on", "e:same", "f:in_on", "f:late"]);
});

test("Folien: Ausschnitt je Art, Spieler außerhalb werden am Rand aufgereiht", () => {
  const c = full();
  c.opp.items = oppLineup(11, "4-4-2");
  const corner = newSlide(c, "ecke_off", "Ecke", true);
  assert.equal(corner.view, "box_att");
  const v = MP_VIEWS.box_att;
  const own = corner.items.filter(x => x.t === "own"), opp = corner.items.filter(x => x.t === "opp");
  assert.equal(own.length, 11); assert.equal(opp.length, 11);
  assert.ok(corner.items.filter(x => !(x.t === "own" && x.label === "TW")).every(x => x.y >= v.y && x.y <= v.y + v.h), "alle im Ausschnitt");
  assert.equal(own.find(x => x.label === "TW")!.y, 98, "eigener Torwart bleibt bei einer Ecke vorne im Tor");
  assert.equal(corner.items.find(x => x.t === "ball")!.x, 67);
  const grund = newSlide(c, "grund", "Grund", false);
  assert.equal(grund.view, "full");
  assert.deepEqual(grund.items.filter(x => x.t === "own").map(x => [x.x, x.y]), c.lineup.map(x => [x.x, x.y]), "ganzes Feld: Positionen aus der Aufstellung");
  assert.notEqual(grund.items[0].id, c.lineup[0].id, "neue IDs");
});

test("Freigabe: Bereiche, Folien nur sichtbare, Aufgaben nur eigene, Zeitraum, nur Kader, Änderungen erkennen", () => {
  const c = full();
  c.tasks = { iv1: "Kette halten", st: "Tief gehen", tw2: "  " };
  c.slides = [newSlide(c, "grund", "A", false), { ...newSlide(c, "ball", "B", false), vis: false }];
  const pub = publishedOf(c, DEFAULT_SECTIONS);
  assert.deepEqual(pub.sections, ["lineup", "slides", "idea", "opp", "tasks"]);
  assert.equal(pub.subs, undefined, "Wechselplan bleibt intern");
  assert.equal(pub.slides!.length, 1, "nur sichtbare Folien");
  assert.deepEqual(Object.keys(pub.tasks!).sort(), ["iv1", "st"], "leere Aufgaben fallen weg");
  assert.deepEqual(forPlayer(pub, "st", true).tasks, { st: "Tief gehen" });
  assert.deepEqual(forPlayer(pub, "lv", true).tasks, {});
  assert.equal(Object.keys(forPlayer(pub, "lv", false).tasks!).length, 2);
  const m = { id: "m1", date: "2026-10-10", zeit: "15:00", gegner: "SV", heim: true, comp: "liga" as const };
  const until = defaultUntil(m, 90, NOW);
  assert.equal(new Date(until).getTime(), new Date(2026, 9, 10, 17, 15).getTime(), "Spielende 15:00 + 90 + 15 Pause + 30");
  const p: MatchPlan = { ...newPlan("p1", m, "u19", "gegen SV"), c, share: { sections: DEFAULT_SECTIONS, from: null, until, squadOnly: true, ownTasks: true }, published: pub, publishedAt: NOW.toISOString() };
  assert.equal(shareState(p, NOW), "live");
  assert.equal(shareState(p, new Date(2026, 9, 10, 17, 16)), "ended");
  assert.equal(shareState({ ...p, share: { ...p.share!, from: new Date(2026, 9, 8).toISOString() } }, NOW), "scheduled");
  assert.equal(shareState({ ...p, published: null }, NOW), "draft");
  assert.ok(visibleTo(p, "st", NOW)); assert.ok(!visibleTo(p, "nobody", NOW), "nur Kader");
  assert.ok(visibleTo({ ...p, share: { ...p.share!, squadOnly: false } }, "nobody", NOW));
  assert.equal(changedSincePublish(p), false);
  // Datenbank sortiert Schlüssel um – kein falscher Hinweis
  const reordered = JSON.parse(JSON.stringify(pub, Object.keys(pub).sort()));
  assert.equal(changedSincePublish({ ...p, published: { ...reordered, ...pub } }), false);
  assert.equal(changedSincePublish({ ...p, c: { ...c, tasks: { ...c.tasks, lm: "Neu" } } }), true);
  assert.equal(changedSincePublish({ ...p, c: { ...c, subs: [{ id: "x", min: 60, out: null, in: null, note: "" }] } }), false, "interner Wechselplan zählt nicht");
  // Spielerliste und Gesehen-Statistik
  const logs = { p1: [{ pid: "st", kind: "open", at: NOW.toISOString() }, { pid: "st", kind: "shot", at: NOW.toISOString() }] };
  const av = availFor([p], logs, "st", NOW);
  assert.equal(av.length, 1); assert.equal(av[0].seen, true);
  assert.equal(availFor([p], logs, "iv1", NOW)[0].seen, false);
  const st = seenStats(logs.p1, squadOf(c));
  assert.deepEqual([st.seen, st.open.length, st.shots], [["st"], squadOf(c).length - 1, 1]);
});

test("Bereinigen: Grenzen, unbekannte Werte, doppelte Spieler, Kapitän nur aus dem Kader", () => {
  const c = cleanContent({
    fmt: 13 as never, formation: "9-9-9", lineup: [{ id: "a", t: "own", x: -50, y: 500, pid: "p1" }, { id: "b", t: "own", x: 10, y: 10, pid: "p1" }, { id: "c", t: "opp", x: 1, y: 1 }],
    bench: ["p1", "p2", "p2"], captain: "zz", slides: [{ id: "s 1", cat: "xx" as never, title: "x".repeat(99), view: "zoom" as never, note: "", vis: true, items: [{ id: "i", t: "pass", x: 1, y: 2 }, { id: "j", t: "laser" as never, x: 0, y: 0 }] }],
    idea: { motto: "M", keys: ["a", " ", "b", "c", "d"], ball: "", gegen: "", umschalt: "" }, tasks: { p1: " x ", p2: "" }, subs: [{ id: "w", min: 999, out: "p1", in: null, note: "" }], mode: "big" as never, size: 9,
  }, "u11");
  assert.equal(c.fmt, 7, "ungültige Spielform → nach Altersklasse");
  assert.equal(c.formation, "2-3-1");
  assert.deepEqual(c.lineup.map(x => [x.x, x.y, x.pid]), [[-2, 108, "p1"], [10, 10, null]], "Koordinaten begrenzt, Spieler nur einmal, Gegner raus");
  assert.deepEqual(c.bench, ["p2"]);
  assert.equal(c.captain, null);
  assert.equal(c.slides[0].cat, "sonst"); assert.equal(c.slides[0].view, "full"); assert.equal(c.slides[0].title.length, 60);
  assert.equal(c.slides[0].items.length, 1); assert.equal(c.slides[0].items[0].x2, 1, "Linie bekommt Endpunkt");
  assert.match(c.slides[0].id, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(c.idea.keys, ["a", "b", "c"]);
  assert.deepEqual(c.tasks, { p1: "x" });
  assert.equal(c.subs[0].min, 150);
  assert.equal(c.mode, "name"); assert.equal(c.size, 1.6);
});

test("Kopie: Aufstellung, Folien, Spielidee, Aufgaben übernehmen; Gegner und Wechsel leer", () => {
  const c = full(); c.tasks = { st: "Tief" }; c.slides = [newSlide(c, "grund", "A", false)]; c.subs = [{ id: "w", min: 60, out: "st", in: "st2", note: "" }];
  c.opp.style = "4-4-2"; c.idea.motto = "Mutig";
  const prev: MatchPlan = { ...newPlan("p0", null, "u19", "Alt"), c };
  const n = copyPlan("p1", prev, null, "Neu");
  assert.equal(n.title, "Neu"); assert.equal(n.c.idea.motto, "Mutig"); assert.deepEqual(n.c.tasks, { st: "Tief" });
  assert.equal(n.c.opp.style, ""); assert.equal(n.c.subs.length, 0);
  assert.notEqual(n.c.slides[0].id, c.slides[0].id); assert.equal(n.share, null);
  assert.deepEqual(squadOf(n.c), squadOf(c));
});

test("Demo: freigegebener Plan fürs nächste Spiel mit Protokoll, früherer Plan beendet", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  demoExtras(D, "de", NOW);
  const next = D.plans.find(p => p.id === "mp-demo-next")!, last = D.plans.find(p => p.id === "mp-demo-last")!;
  assert.ok(next && last);
  assert.equal(shareState(next, NOW), "live"); assert.equal(shareState(last, NOW), "ended");
  assert.equal(next.c.lineup.filter(x => x.pid).length, 11);
  assert.equal(next.c.slides.length, 4);
  assert.ok(Object.keys(next.c.tasks).length >= 4);
  assert.ok(next.c.subs.length >= 2);
  assert.equal(changedSincePublish(next), false);
  assert.ok((D.planLogs[next.id] || []).some(l => l.kind === "shot"));
  assert.equal(stableJson(cleanContent(next.c, "u19")), stableJson(next.c), "Demo-Inhalt ist bereits bereinigt");
  // Kinder: 7er
  const K = buildDemo(demoTeam("u11", "basis", "de"), "de", NOW); demoExtras(K, "de", NOW);
  const kn = K.plans.find(p => p.id === "mp-demo-next")!;
  assert.equal(kn.c.fmt, 7); assert.equal(kn.c.lineup.length, 7);
});
