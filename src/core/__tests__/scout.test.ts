// Tests: Kaderplanung & Scouting – Saison und Jahrgänge, Positionen der Planung, Verteilung, Grundordnung wechseln,
// Bereinigung, Besetzung (Bedarf), Überblick, Bewertungen, Filter/Sortierung, Datenschutz-Fristen, Demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import {
  addRef, agesOut, autoAssign, candidatesFor, cleanPlanContent, cleanReport, cleanScout, deleteAt, eligibleYears, emptyFilter, emptyPlanContent, filterScouts,
  infoState, isYounger, makeResolver, moveRef, newReport, newScout, parseRef, pipelineCounts, planOverview, planSeasons, planSlots, playerState, playsUp, posMatch,
  refOf, refsIn, remapPlan, removeRef, reportStats, riserYears, seasonLabel, seasonOfDate, setPlayerStatus, setSlot, slotDepth, slotsWith, sortScouts, statsBy,
  takeoverPlayer, yearBuckets,
} from "../scout";
import type { Player, ScoutPlayer, ScoutReport, TeamData } from "../types";

const NOW = new Date(2026, 9, 18, 10, 0);
const pl = (id: string, pos: string, geb: string): Player => ({ id, vn: id.toUpperCase(), nn: "X", pos, nr: null, geb });
const sp = (id: string, pos: string[], o: Partial<ScoutPlayer> = {}): ScoutPlayer => ({ ...newScout(id, NOW), vn: id, nn: "Test", pos, year: 2010, ...o });
const demo = (): TeamData => { const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };

test("Saison: Wechsel am 1. Juli, Bezeichnung, wählbare Spielzeiten", () => {
  assert.equal(seasonOfDate(new Date(2026, 5, 30)), 2025);
  assert.equal(seasonOfDate(new Date(2026, 6, 1)), 2026);
  assert.equal(seasonLabel(2027), "2027/28"); assert.equal(seasonLabel(2099), "2099/00");
  assert.deepEqual(planSeasons(NOW), [2026, 2027, 2028]);
});

test("Jahrgänge: spielberechtigt, Altersgrenze, hochspielen, Aufrücker; Senioren ohne Altersgrenze", () => {
  assert.deepEqual(eligibleYears("u19", 2027), { min: 2009, max: 2010 });
  assert.deepEqual(eligibleYears("u17", 2026), { min: 2010, max: 2011 });
  assert.equal(eligibleYears("sen", 2027), null);
  assert.ok(agesOut({ geb: "2008-12-31" }, "u19", 2027) && !agesOut({ geb: "2009-01-01" }, "u19", 2027));
  assert.ok(playsUp({ year: 2011 }, "u19", 2027) && !playsUp({ year: 2010 }, "u19", 2027));
  assert.ok(!agesOut({ geb: "1990-01-01" }, "sen", 2027), "Senioren: keine Altersgrenze");
  assert.deepEqual(riserYears("u19", 2027), [2009, 2010]);
  assert.deepEqual(riserYears("sen", 2027), [2008], "Senioren: wer aus der A-Jugend herauswächst");
  assert.deepEqual(riserYears("ue32", 2027), []);
  assert.ok(isYounger("u17", "u19") && isYounger("u19", "sen") && !isYounger("sen", "u19") && !isYounger("ue32", "sen"));
});

test("Positionen der Planung: eindeutige Schlüssel je Grundordnung (links/zentral/rechts)", () => {
  assert.deepEqual(planSlots(11, "4-3-3").map(s => s.key), ["TW", "LV", "IV-l", "IV-r", "RV", "DM", "ZM-l", "ZM-r", "LA", "ST", "RA"]);
  assert.deepEqual(planSlots(11, "3-5-2").filter(s => s.pos === "IV").map(s => s.key), ["IV-l", "IV-c", "IV-r"]);
  for (const f of ["4-2-3-1", "4-4-2", "4-1-2-1-2", "5-3-2", "3-4-3"]) {
    const k = planSlots(11, f).map(s => s.key);
    assert.equal(new Set(k).size, 11, f);
  }
  assert.equal(planSlots(7, "3-2-1").length, 7);
  assert.equal(planSlots(11, "unbekannt").length, 11, "unbekannte Grundordnung: Standard");
});

test("Verweise, Kader/Schatten setzen, Reihenfolge, Entfernen", () => {
  assert.deepEqual(parseRef("r:demo-t3:p4"), { k: "r", id: "demo-t3:p4" });
  assert.equal(parseRef("x:1"), null); assert.equal(parseRef("p:"), null);
  let c = emptyPlanContent(11, "4-3-3");
  c = addRef(c, "ST", "shadow", "s:a"); c = addRef(c, "ST", "shadow", "s:b"); c = addRef(c, "ST", "shadow", "s:c", 0);
  assert.deepEqual(c.slots.ST.shadow, ["s:c", "s:a", "s:b"]);
  c = moveRef(c, "ST", "shadow", "s:b", -1);
  assert.deepEqual(c.slots.ST.shadow, ["s:c", "s:b", "s:a"]);
  c = addRef(c, "ST", "own", "s:a");
  assert.deepEqual([c.slots.ST.own, c.slots.ST.shadow], [["s:a"], ["s:c", "s:b"]], "in den Kader: aus dem Schatten entfernt");
  c = addRef(c, "LA", "shadow", "s:c");
  assert.deepEqual(slotsWith(c, "s:c").map(x => x.key + "/" + x.kind + x.rank).sort(), ["LA/shadow1", "ST/shadow1"]);
  c = removeRef(c, "s:c");
  assert.deepEqual(refsIn(c).sort(), ["s:a", "s:b"]);
  c = setSlot(c, "ST", { target: 9, need: "x".repeat(200) });
  assert.equal(c.slots.ST.target, 5); assert.equal(c.slots.ST.need.length, 120);
  assert.equal(addRef(c, "GIBTSNICHT", "own", "p:1"), c);
  for (let i = 0; i < 12; i++) c = addRef(c, "TW", "shadow", "s:t" + i);
  assert.equal(c.slots.TW.shadow.length, 10, "höchstens 10 Schattenkandidaten je Position");
});

test("Verteilung eigener Spieler: Torhüter ins Tor, genaue Position, Ausweichposition, gleichmäßig", () => {
  const players = [pl("g1", "TW", "2009-01-01"), pl("g2", "TW", "2010-01-01"), pl("i1", "IV", "2009-01-01"), pl("i2", "IV", "2009-01-01"), pl("i3", "IV", "2010-01-01"),
    pl("l1", "LM", "2009-01-01"), pl("s1", "ST", "2009-01-01"), pl("z1", "ZM", "2009-01-01")];
  const c = autoAssign(emptyPlanContent(11, "4-3-3"), 11, players.map(p => ({ ref: refOf("p", p.id), pos: p.pos, gk: p.pos === "TW" })));
  assert.deepEqual(c.slots.TW.own, ["p:g1", "p:g2"]);
  assert.deepEqual([c.slots["IV-l"].own.length, c.slots["IV-r"].own.length].sort(), [1, 2], "Innenverteidiger verteilt");
  assert.deepEqual(c.slots.LA.own, ["p:l1"], "linkes Mittelfeld → Linksaußen (Ausweichposition)");
  assert.deepEqual(c.slots.ST.own, ["p:s1"]);
  assert.ok(c.slots["ZM-l"].own.includes("p:z1") || c.slots["ZM-r"].own.includes("p:z1"));
  assert.equal(refsIn(c).length, players.length, "jeder genau einmal");
  assert.equal(autoAssign(c, 11, [{ ref: "p:g1", pos: "TW", gk: true }]), c, "schon eingeplant: unverändert");
});

test("Grundordnung wechseln: niemand geht verloren, Positionen werden sinnvoll übertragen", () => {
  let c = emptyPlanContent(11, "4-3-3");
  c = addRef(c, "LV", "own", "p:lv"); c = addRef(c, "LA", "shadow", "s:la"); c = addRef(c, "ST", "own", "p:st"); c = addRef(c, "IV-l", "own", "p:iv");
  c = setSlot(c, "ST", { target: 3, need: "Tempo" });
  const d = remapPlan(c, 11, "3-5-2");
  assert.equal(d.formation, "3-5-2");
  assert.deepEqual(refsIn(d).sort(), refsIn(c).sort());
  assert.ok(d.slots["IV-l"].own.includes("p:iv"));
  assert.ok(d.slots.LM.own.includes("p:lv"), "Linksverteidiger → linke Bahn");
  const st = Object.entries(d.slots).find(([, s]) => s.own.includes("p:st"))!;
  assert.ok(st[0].startsWith("ST") && st[1].target === 3 && st[1].need === "Tempo");
  assert.equal(remapPlan(c, 11, "4-3-3"), c);
});

test("Bereinigung: unbekannte Positionen, falsche Verweise, doppelte, Grenzen, Stand nur bekannte Werte", () => {
  const raw = {
    formation: "4-3-3",
    slots: { ST: { own: ["p:1", "p:1", "kaputt", 5], shadow: ["p:1", "s:2"], target: "7", need: 3 }, XX: { own: ["p:9"] } },
    status: { "p1": { s: "fix", note: "ok" }, "p2": { s: "verkauft" }, "<script>": { s: "fix" } },
    notes: 42, ext: { "r:9": { n: "Lio", pos: "LV", y: "2010", t: "U17" }, "r:nicht-im-plan": { n: "x" } },
  };
  const c = cleanPlanContent(raw, 11);
  assert.deepEqual(c.slots.ST, { own: ["p:1"], shadow: ["s:2"], target: 5, need: "" });
  assert.equal(c.slots.XX, undefined);
  assert.deepEqual(Object.keys(c.status), ["p1"]);
  assert.equal(c.notes, ""); assert.deepEqual(c.ext, {}, "Angaben nur zu Aufrückern in der Planung");
  assert.equal(cleanPlanContent(null, 7).formation, "2-3-1");
});

test("Stand, Besetzung und Überblick: Altersgrenze, Abgang, unsicher, Zugang, Aufrücker; Bedarf je Position", () => {
  const D = demo(), season = 2027;
  const old = D.players.find(p => agesOut(p, "u19", season))!, young = D.players.filter(p => !agesOut(p, "u19", season));
  let c = emptyPlanContent(11, "4-3-3");
  c = setPlayerStatus(c, young[0].id, "leave", "Wechsel");
  c = setPlayerStatus(c, young[1].id, "unsure");
  assert.equal(playerState(old, c, "u19", season), "ageout");
  assert.equal(playerState(young[0], c, "u19", season), "leave");
  assert.equal(playerState(young[2], c, "u19", season), "open");
  assert.equal(setPlayerStatus(c, young[1].id, null).status[young[1].id], undefined);
  c = addRef(c, "ST", "own", refOf("p", young[1].id));
  c = addRef(c, "ST", "own", refOf("p", young[2].id));
  const signed = D.scouts.find(s => s.status === "signed")!, pending = D.scouts.find(s => s.status === "talks")!;
  c = addRef(c, "IV-l", "own", refOf("s", pending.id));
  c = addRef(c, "IV-l", "own", refOf("s", signed.id));
  c = addRef(c, "IV-r", "own", refOf("p", old.id));
  const risers = [{ id: "r1", vn: "Lio", nn: "A", pos: "LV", year: 2010, teamId: "t2", team: "U17", cls: "u17" as const }];
  c = addRef(c, "LV", "own", "r:r1");
  const info = makeResolver(D, c, season, risers);
  assert.equal(info("r:r1")?.state, "riser"); assert.equal(info("s:" + signed.id)?.state, "signed"); assert.equal(info("s:" + pending.id)?.state, "pending");
  assert.equal(info("s:gibtsnicht"), null);
  assert.deepEqual(slotDepth(c.slots.ST, info), { firm: 1, maybe: 1, out: 0, level: "risk" });
  assert.deepEqual(slotDepth(c.slots["IV-l"], info).level, "risk");
  assert.deepEqual(slotDepth(c.slots["IV-r"], info), { firm: 0, maybe: 0, out: 1, level: "need" });
  const o = planOverview(D, c, season, risers);
  assert.ok(o.leaving.some(x => x.p.id === old.id && x.state === "ageout") && o.leaving.some(x => x.p.id === young[0].id && x.state === "leave"));
  assert.deepEqual(o.arrivals.map(a => a.ref).sort(), ["r:r1", "s:" + signed.id].sort());
  assert.ok(o.needs.some(n => n.key === "TW") && o.unassigned.length > 0);
  // Aufrücker ohne geladene Liste: Angaben aus der Planung
  const c2 = { ...c, ext: { "r:r1": { n: "Lio A", pos: "LV", y: 2010, t: "U17" } } };
  assert.equal(makeResolver(D, c2, season, [])("r:r1")?.name, "Lio A");
  const b = yearBuckets(c, "u19", season, info, D.players);
  assert.deepEqual(b.map(x => x.key).slice(0, 2), ["2009", "2010"]);
  assert.ok(b.every(x => x.kind !== "older"), "Ältere zählen nicht (Altersgrenze)");
});

test("Bewertungen: Durchschnitt, Bereiche, Trend, Empfehlungen; Bereinigung von Berichten", () => {
  const r = (id: string, date: string, grade: number | null, scores: Record<string, number>, verdict: "sign" | "watch" | "no" | null): ScoutReport =>
    ({ ...newReport(id, "s1", date, "ST"), grade, scores, verdict });
  const st = reportStats([r("a", "2026-09-01", 3, { tech: 3, ath: 4 }, "watch"), r("b", "2026-10-01", 4, { tech: 4, takt: 3 }, "sign"), r("c", "2026-08-01", null, { tech: 2 }, null)]);
  assert.equal(st.n, 3); assert.equal(st.grade, 3.5); assert.equal(st.trend, 1); assert.equal(st.last, "2026-10-01");
  assert.equal(st.areas.tech, 3); assert.equal(st.areas.ath, 4); assert.equal(st.areas.ment, null);
  assert.deepEqual(st.verdicts, { sign: 1, watch: 1, no: 0 });
  assert.equal(reportStats([]).grade, null);
  const cr = cleanReport({ ...newReport("x", "s", "kein-datum", "XX"), scores: { tech: 9, takt: 3, "bad key": 2 }, grade: 0, kind: "quatsch" as never, min: 400 });
  assert.deepEqual(cr.scores, { takt: 3 }); assert.equal(cr.grade, null); assert.equal(cr.kind, "other"); assert.equal(cr.min, null); assert.equal(cr.pos, null);
  assert.match(cr.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("Kandidaten: Positionsabgleich, Vorschläge je Position, Filter, Sortierung, Pipeline", () => {
  assert.equal(posMatch(["IV", "DM"], "IV"), 0); assert.equal(posMatch(["DM", "IV"], "IV"), 1);
  assert.equal(posMatch(["LM"], "LA"), 2); assert.equal(posMatch(["RV"], "IV"), 2); assert.equal(posMatch(["TW"], "IV"), 9); assert.equal(posMatch([], "ST"), 9);
  const L = [sp("a", ["ST"], { prio: "b" }), sp("b", ["LA", "ST"], { prio: "a" }), sp("c", ["ST"], { status: "declined", prio: "a" }), sp("d", ["IV"], { prio: "a" }),
    sp("e", ["ST"], { prio: "b", tags: ["Kopfball"], club: "SV Älterdorf" })];
  const stats = statsBy([{ ...newReport("r1", "a", "2026-10-01", "ST"), grade: 4 }, { ...newReport("r2", "e", "2026-10-01", "ST"), grade: 2 }]);
  assert.deepEqual(candidatesFor("ST", L, stats).map(s => s.id), ["a", "e", "b"], "Hauptposition zuerst, dann Bewertung; abgeschlossene nicht");
  assert.deepEqual(candidatesFor("TW", L, stats).map(s => s.id), []);
  assert.equal(candidatesFor("TW", L, stats, true).length, 4, "alle Positionen auf Wunsch");
  const f = emptyFilter();
  assert.deepEqual(filterScouts(L, f, stats, NOW).map(s => s.id), ["a", "b", "d", "e"]);
  assert.deepEqual(filterScouts(L, { ...f, status: "closed" }, stats, NOW).map(s => s.id), ["c"]);
  assert.deepEqual(filterScouts(L, { ...f, area: "Abwehr" }, stats, NOW).map(s => s.id), ["d"]);
  assert.deepEqual(filterScouts(L, { ...f, q: "alterdorf" }, stats, NOW).map(s => s.id), ["e"], "ohne Umlaute/Groß-Klein");
  assert.deepEqual(filterScouts(L, { ...f, q: "kopf" }, stats, NOW).map(s => s.id), ["e"], "auch in Merkmalen");
  assert.deepEqual(filterScouts(L, { ...f, minGrade: 3 }, stats, NOW).map(s => s.id), ["a"]);
  assert.deepEqual(sortScouts(L, "prio", stats).map(s => s.id).slice(0, 3), ["b", "d", "c"], "Priorität A zuerst, abgeschlossene zuletzt");
  assert.deepEqual(sortScouts(L, "grade", stats).map(s => s.id).slice(0, 2), ["a", "e"]);
  const pc = pipelineCounts(L);
  assert.equal(pc.open, 4); assert.equal(pc.closed, 1); assert.equal(pc.watch, 4); assert.equal(pc.all, 5);
});

test("Datenschutz: Information nach Art. 14 (1 Monat bzw. erster Kontakt), automatische Löschung", () => {
  const base = { createdAt: new Date(2026, 9, 1).toISOString() };
  assert.deepEqual(infoState({ ...base, informed: null, status: "watch" }, NOW), { state: "soon", days: 13 });
  assert.equal(infoState({ ...base, informed: null, status: "trial" }, NOW).state, "due", "Kontakt: sofort informieren");
  assert.equal(infoState({ ...base, informed: null, status: "scout" }, NOW).state, "soon", "Sichtung ohne Kontakt: Monatsfrist");
  assert.equal(infoState({ ...base, informed: null, status: "signed" }, NOW).state, "due");
  assert.equal(infoState({ createdAt: new Date(2026, 8, 1).toISOString(), informed: null, status: "watch" }, NOW).state, "due", "nach einem Monat");
  assert.equal(infoState({ ...base, informed: "2026-10-02", status: "talks" }, NOW).state, "ok");
  assert.equal(deleteAt({ status: "declined", updatedAt: "2026-10-18T10:00:00Z" }), "2027-04-18");
  assert.equal(deleteAt({ status: "watch", updatedAt: "2026-10-18T10:00:00Z" }), "2028-10-18");
});

test("Bereinigung und Übernahme: Kandidat ohne Ballast, Spielerprofil nach der Zusage", () => {
  const x = cleanScout({ ...sp("a", ["LA", "XX", "LA", "ST", "IV", "TW"]), vn: "  Joel ", geb: "2009-03-04", year: 1900, cm: 999, foot: "x" as never,
    tags: [" schnell ", "schnell", "", "a".repeat(40)], video: "javascript:alert(1)", status: "verkauft" as never, prio: "z" as never, level: 6, potential: 4, informed: "gestern" });
  assert.equal(x.vn, "Joel"); assert.deepEqual(x.pos, ["LA", "ST", "IV"]); assert.equal(x.year, 2009); assert.equal(x.cm, null); assert.equal(x.foot, null);
  assert.deepEqual(x.tags, ["schnell", "a".repeat(30)]); assert.equal(x.video, null); assert.equal(x.status, "watch"); assert.equal(x.prio, null);
  assert.equal(x.level, null); assert.equal(x.potential, 4); assert.equal(x.informed, null);
  const p = takeoverPlayer({ ...x, nn: "Mensah" }, "tmp-1");
  assert.deepEqual([p.vn, p.nn, p.pos, p.geb, p.nr], ["Joel", "Mensah", "LM", "2009-03-04", null]);
});

test("Demo: Kandidaten, Berichte, Merklisten und Planung der nächsten Saison mit Schattenkader", () => {
  const D = demo();
  assert.equal(D.scouts.length, 16); assert.ok(D.scoutReports.length >= 20); assert.equal(D.scoutLists.length, 3);
  const plan = D.squadPlans[0];
  assert.equal(plan.season, 2027);
  const c = cleanPlanContent(plan.content, 11);
  assert.deepEqual(c, plan.content, "Demo-Planung ist bereinigt");
  const shadows = Object.values(c.slots).flatMap(s => s.shadow);
  assert.ok(shadows.length >= 8 && new Set(shadows).size === shadows.length, "Schattenkandidaten, jeder einmal");
  assert.ok(Object.values(c.slots).some(s => s.own.some(r => r.startsWith("s:"))), "Zugang (Zusage) im Kader");
  assert.ok(D.players.every(p => agesOut(p, "u19", 2027) || refsIn(c).includes("p:" + p.id) || p.neu || c.status[p.id]?.s === "leave"), "Bleibende eingeplant");
  assert.ok(D.scouts.some(s => infoState(s, NOW).state === "due"), "ein Hinweis zur Information");
  assert.equal(D.scouts.filter(s => s.status === "signed").length, 1);
  assert.ok(D.scouts.every(s => s.year === 2009 || s.year === 2010), "Jahrgänge der nächsten Saison");
  const k = buildDemo(demoTeam("u9", "basis", "de"), "de", NOW); demoExtras(k, "de", NOW);
  assert.equal(k.scouts.length, 0, "Kinderfußball: kein Scouting in der Demo");
});
