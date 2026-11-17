// Tests: Entwicklungsprogramm – Stärken-Katalog, Bereinigung, Stärken-Runde, X-Faktor-Vorschläge, Spielerkarte, Demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS } from "../i18n";
import { teamPatchPerms } from "../perms";
import {
  IMPROVE_KINDS, IMPROVE_WHERE, LIMITS, PEER_DAYS, SKILLS, ZONES, cardStats, cleanGift, cleanProgram, cleanSelf, cleanSkills, cleanTag, emptyProgram, endRound,
  indivTopicFor, isCustomSkill, matesOf, oppShort, peerCounts, peerOpen, peerProgress, peerRoundOf, programContent, programStatus, programTodo, skillsFor, startRound,
  visibleProgram, xfSuggest, zoneRect,
} from "../program";
import type { DevProgram, PeerGift, TeamData } from "../types";

const NOW = new Date(2026, 10, 5, 10, 0), TODAY = "2026-11-05";
const setup = (): TeamData => { const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };

test("Katalog: eindeutige Schlüssel im Datenbank-Format, Texte in beiden Sprachen, Torhüter eigene Stärken", () => {
  const keys = SKILLS.map(x => x.key);
  assert.equal(new Set(keys).size, keys.length, "keine Doppelungen");
  for (const k of keys) assert.match(k, /^[a-z0-9_]{2,24}$/, k);
  for (const lang of ["de", "en"] as const) {
    for (const k of keys) assert.ok(DICTS[lang]["sk_" + k], `${lang}: sk_${k}`);
    for (const k of IMPROVE_KINDS) for (const p of ["ep_ik_", "ep_ikd_"]) assert.ok(DICTS[lang][p + k], `${lang}: ${p}${k}`);
    for (const k of IMPROVE_WHERE) assert.ok(DICTS[lang]["ep_w_" + k], `${lang}: ep_w_${k}`);
  }
  const gk = skillsFor(true).map(x => x.key), field = skillsFor(false).map(x => x.key);
  assert.ok(gk.includes("reflexe") && !gk.includes("abschluss"), "Torhüter: Reflexe statt Abschluss");
  assert.ok(field.includes("festmachen") && !field.includes("reflexe"), "Feldspieler: ohne Torwart-Stärken");
  assert.ok(gk.includes("passspiel") && field.includes("passspiel"), "gemeinsame Stärken für alle");
});

test("Stärkster Bereich: 15 Zonen decken das Feld lückenlos ab", () => {
  assert.equal(ZONES.length, 15);
  const area = ZONES.reduce((a, z) => { const r = zoneRect(z)!; return a + r.w * r.h; }, 0);
  assert.ok(Math.abs(area - 68 * 105) < 0.01, "Fläche = ganzes Feld");
  assert.deepEqual(zoneRect("o3"), { x: 24.84, y: 0, w: 18.32, h: 35 }, "Zentrum im Angriffsdrittel oben");
  assert.equal(zoneRect("x1"), null); assert.equal(zoneRect("o6"), null); assert.equal(zoneRect("m"), null);
});

test("Bereinigung: Grenzen, Doppelungen, eigene Begriffe nur für das Trainerteam", () => {
  assert.equal(cleanTag("  #Fest machen!! "), "Festmachen");
  assert.equal(cleanTag("#".repeat(3) + "A".repeat(40)).length, LIMITS.tag);
  assert.deepEqual(cleanSkills(["festmachen", "festmachen", "foo", "t:Flugbälle links", 5, "t:  ", "passspiel"], 3, true), ["festmachen", "t:Flugbälle links", "passspiel"]);
  assert.deepEqual(cleanSkills(["t:Eigenes", "physis"], 3, false), ["physis"], "Spieler nur aus dem Katalog");
  assert.deepEqual(cleanSkills(["t:Abc", "t:ABC"], 3, true), ["t:Abc"], "eigene Begriffe ohne Groß-/Kleinschreibungs-Doppelung");
  const p = cleanProgram({
    pid: "p1", tag: "#FESTMACHEN", xf: ["festmachen", "schusstechnik", "passspiel", "physis"], sit: ["  Wenn ich den Ball festmache ", "", "x".repeat(300), "4", "5"],
    zones: ["o3", "o3", "zz", "m2"],
    improve: [
      { kind: "off", topic: "Coaching Mitspieler", skill: "coaching", where: ["training", "nirgends" as never], help: ["team", "mates", "x y"], how: "", goalId: "g-1" },
      { kind: "excel", topic: "Letzter Pass", skill: null, where: ["indiv", "training"], help: ["team"], how: "10 Min.", goalId: null },
      { kind: "excel", topic: "Doppelt", skill: null, where: [], help: [], how: "", goalId: null },
      { kind: "extra", topic: "", skill: null, where: [], help: [], how: "", goalId: null },
    ],
    coach: { weapons: ["festmachen", "t:Flugbälle"], skills: ["festmachen", "pressing"] }, peers: ["physis", "t:Frei", "kopfball"], vis: true,
  });
  assert.equal(p.tag, "FESTMACHEN");
  assert.deepEqual(p.xf, ["festmachen", "schusstechnik", "passspiel"], "höchstens 3 Waffen");
  assert.equal(p.sit.length, 3); assert.equal(p.sit[0], "Wenn ich den Ball festmache"); assert.equal(p.sit[1].length, LIMITS.sitLen);
  assert.deepEqual(p.zones, ["o3", "m2"], "gültige Zonen in fester Reihenfolge");
  assert.deepEqual(p.improve.map(x => x.kind), ["excel", "off"], "je Feld eins, leere Felder entfallen, feste Reihenfolge");
  assert.deepEqual(p.improve[0].where, ["training", "indiv"]); assert.deepEqual(p.improve[1].where, ["training"]);
  assert.deepEqual(p.improve[1].help, ["team", "mates"], "Hilfe nur bekannte Formen"); assert.equal(p.improve[1].goalId, "g-1");
  assert.deepEqual(p.coach, { weapons: ["festmachen", "t:Flugbälle"], skills: ["pressing"] }, "weitere Stärken ohne die Waffen");
  assert.deepEqual(p.peers, ["physis", "kopfball"], "Mitspieler-Stärken nur aus dem Katalog");
  assert.deepEqual(Object.keys(programContent(p)).sort(), ["coach", "improve", "peers", "sit", "tag", "xf", "zones"], "Inhalt ohne Spieler, Freigabe und Zeit");
  assert.deepEqual(cleanSelf({ pid: "p1", weapons: ["physis", "t:X", "schusstechnik"], skills: ["physis", "kopfball"] }), { pid: "p1", weapons: ["physis", "schusstechnik"], skills: ["kopfball"], at: null });
  assert.deepEqual(cleanGift(["mut", "mut", "t:x", "ruhe", "einsatz", "physis"]), ["mut", "ruhe", "einsatz"]);
  assert.ok(isCustomSkill("t:Abc") && !isCustomSkill("abschluss"));
});

test("Status und Hinweise: leer, Entwurf, freigegeben; Spieler sehen nur Freigegebenes", () => {
  const e = emptyProgram("p2");
  assert.equal(programStatus(null), "none"); assert.equal(programStatus(e), "none"); assert.equal(programStatus({ ...e, vis: true }), "none", "leeres Programm zählt nicht");
  const d: DevProgram = { ...e, xf: ["passspiel"] };
  assert.equal(programStatus(d), "draft"); assert.equal(programStatus({ ...d, vis: true }), "live");
  assert.deepEqual(programTodo(d), ["sit", "improve", "zones", "coach"]);
  const D = setup(); D.programs = [d, { ...d, pid: "p3", vis: true }];
  assert.equal(visibleProgram(D, "p2"), null, "Entwurf bleibt beim Trainerteam"); assert.equal(visibleProgram(D, "p3")?.pid, "p3");
});

test("Stärken-Runde: offen, beenden, Zählung ohne Namen, Teilnahme, Mitspieler", () => {
  const r = startRound(TODAY, 14);
  assert.deepEqual(r, { since: TODAY, until: "2026-11-18" });
  assert.equal(peerOpen({ peer: r }, TODAY), true); assert.equal(peerOpen({ peer: r }, "2026-11-19"), false); assert.equal(peerOpen({}, TODAY), false);
  assert.equal(peerRoundOf({ peer: { since: "2026-11-10", until: "2026-11-01" } }), null, "ungültige Runde");
  const e = endRound(r, "2026-11-08");
  assert.deepEqual(e, { since: TODAY, until: "2026-11-07" }); assert.equal(peerOpen({ peer: e }, "2026-11-08"), false);
  assert.deepEqual(endRound(r, TODAY), { since: "2026-11-04", until: "2026-11-04" }, "am ersten Tag beendet: bleibt gültig");
  assert.deepEqual(PEER_DAYS, [7, 14, 21]);
  const g = (giver: string, target: string, skills: string[], at = "2026-11-06T10:00:00Z"): PeerGift => ({ giver, target, skills, at });
  const gifts = [g("a", "x", ["physis", "kopfball"]), g("b", "x", ["physis", "physis", "abschluss"]), g("c", "x", ["physis", "t:frei"]), g("x", "x", ["mut"]), g("d", "x", ["mut"], "2026-10-01T10:00:00Z"), g("a", "y", ["ruhe"])];
  const c = peerCounts(gifts, "x", TODAY);
  assert.equal(c.givers, 3, "eigene und alte Einträge zählen nicht");
  assert.deepEqual(c.list, [{ key: "physis", n: 3 }, { key: "abschluss", n: 1 }, { key: "kopfball", n: 1 }], "je Mitspieler einmal, sortiert nach Nennungen, dann Katalog");
  assert.equal(peerCounts(gifts, "x", null).givers, 4);
  assert.deepEqual(peerProgress(gifts, [{ id: "a" }, { id: "b" }, { id: "x" }], TODAY), { givers: 2, received: 1, players: 3 });
  const D = setup();
  const m = matesOf(D.players, "p17");
  assert.equal(m.length, D.players.length - 1); assert.ok(!m.some(x => x.id === "p17"));
  assert.equal(m[0].name, "Luca B.", "nur Vorname und Initial");
});

test("X-Faktor: Vorschläge, wo sich Spieler, Mitspieler und Trainerteam treffen", () => {
  const s = xfSuggest({ weapons: ["festmachen", "schusstechnik"], skills: ["flugbaelle"] }, { pid: "p", weapons: ["physis", "schusstechnik"], skills: ["festmachen"], at: null },
    [{ key: "physis", n: 5 }, { key: "festmachen", n: 2 }, { key: "kopfball", n: 4 }, { key: "abschluss", n: 1 }]);
  assert.deepEqual(s.map(x => x.key), ["festmachen", "schusstechnik", "physis"]);
  assert.deepEqual(s[0].by, ["self", "mates", "coach"]);
  assert.deepEqual(xfSuggest({ weapons: ["dribbling"], skills: [] }, null, []).map(x => x.key), ["dribbling"], "Waffen des Trainerteams auch allein");
  assert.deepEqual(xfSuggest({ weapons: [], skills: [] }, null, [{ key: "kopfball", n: 6 }]), [], "eine Sicht allein ist kein Muster");
});

test("Spielerkarte: Saisonzahlen, Pre-Assists, Notenverlauf (nur freigegeben), Torhüter", () => {
  const D = setup(), p17 = D.players.find(p => p.id === "p17")!, p1 = D.players.find(p => p.id === "p1")!;
  const ms = D.matches.filter(m => m.date >= "2026-07-01" && m.date <= TODAY).sort((a, b) => a.date < b.date ? -1 : 1);
  assert.ok(ms.length >= 3);
  for (const m of ms) { delete D.stats[m.id]; }
  D.ratings = D.ratings.filter(r => r.pid !== "p17");
  D.stats[ms[0].id] = { p17: { min: 90, goals: 2, assists: 0, start: true, pre: 1 }, p1: { min: 90, goals: 0, assists: 0, start: true, conceded: 0 } };
  D.stats[ms[1].id] = { p17: { min: 25, goals: 0, assists: 1, start: false }, p1: { min: 90, goals: 0, assists: 0, start: true, conceded: 2 } };
  D.stats[ms[2].id] = { p17: { min: 0, goals: 0, assists: 0, start: false } };
  D.ratings.push({ id: "r1", pid: "p17", date: ms[1].date, kind: "spiel", rating: 6, text: "", vis: true }, { id: "r0", pid: "p17", date: ms[0].date, kind: "spiel", rating: 8, text: "", vis: true },
    { id: "r2", pid: "p17", date: ms[2].date, kind: "spiel", rating: 3, text: "", vis: false }, { id: "r3", pid: "p17", date: ms[2].date, kind: "training", rating: 9, text: "", vis: true });
  const s = cardStats(D, p17, TODAY);
  assert.deepEqual([s.games, s.minutes, s.goals, s.assists, s.pre, s.avg], [2, 115, 2, 1, 1, 7]);
  assert.deepEqual(s.series.map(x => x.rating), [8, 6], "älteste zuerst, nur Spielnoten, nur freigegeben");
  assert.equal(s.series[0].opp, ms[0].gegner); assert.equal(s.gk, false); assert.equal(s.clean, null);
  assert.equal(cardStats(D, p17, TODAY, false).series.length, 3, "Trainerteam: auch nicht freigegebene");
  const g = cardStats(D, p1, TODAY);
  assert.deepEqual([g.gk, g.clean, g.conceded, g.pre], [true, 1, 2, null], "Torhüter: Spiele zu null, Gegentore; Pre-Assists nicht erfasst");
  const none = cardStats({ ...D, stats: {}, ratings: [] }, p17, TODAY);
  assert.deepEqual([none.has, none.games, none.avg, none.pre], [false, 0, null, null]);
});

test("Kurzform des Gegners für den Notenverlauf", () => {
  assert.equal(oppShort("SV Nordheim"), "NOR"); assert.equal(oppShort("1. FC Talheim"), "TAL"); assert.equal(oppShort("FC Eintracht Waldau"), "WAL");
  assert.equal(oppShort("Rot-Weiß Auenfeld"), "AUE"); assert.equal(oppShort("Borussia Dortmund U19"), "DOR"); assert.equal(oppShort("FC Bayern München II"), "BAY");
  assert.equal(oppShort(""), "");
});

test("Rechte: Stärken-Runde gehört zu Notizen/Bewertungen", () => {
  assert.deepEqual(teamPatchPerms({ settings: { peer: startRound(TODAY, 7) } }, { settings: {} }), ["notes"]);
});

test("Demo: Programme (freigegeben und Entwurf), Selbstanalyse, Stärken-Runde mit Einträgen", () => {
  const D = setup();
  const p17 = visibleProgram(D, "p17"), p8 = visibleProgram(D, "p8");
  assert.ok(p17 && p17.xf.length === 3 && p17.sit.length === 3 && p17.improve.length === 4 && p17.zones.length > 0, "Stürmer mit vollständigem Programm");
  assert.ok(p8 && p8.improve.length >= 2, "zweites Beispiel");
  assert.ok(D.programs.some(p => programStatus(p) === "draft"), "ein Entwurf fürs Trainerteam");
  for (const p of D.programs) assert.deepEqual(cleanProgram(p), p, "Demo-Programme sind bereinigt");
  assert.ok(D.selfSkills.some(x => x.pid === "p17" && x.weapons.length));
  assert.equal(peerOpen(D.team.settings, TODAY), true, "Runde läuft");
  const c = peerCounts(D.peerGifts, "p17", peerRoundOf(D.team.settings)!.since);
  assert.ok(c.givers >= 3 && c.list.length >= 3, "Stürmer hat Stärken von Mitspielern");
  for (const g of D.peerGifts) { assert.notEqual(g.giver, g.target); assert.deepEqual(cleanGift(g.skills), g.skills); }
  const goals = new Set(D.goals.map(g => g.id));
  for (const p of D.programs) for (const x of p.improve) if (x.goalId) assert.ok(goals.has(x.goalId), "verknüpfte Ziele existieren");
  for (const m of Object.values(D.stats)) for (const x of Object.values(m)) if (x.pre != null) assert.ok(x.pre >= 0 && x.pre <= 3);
});

test("Individualtraining aus dem Programm: Thema passend zum Feld", () => {
  const f = (skill: string | null, where: ("video" | "training")[] = ["training"], gk = false) => indivTopicFor({ skill, where }, gk);
  assert.equal(f("beidfuss"), "schwach"); assert.equal(f("kopfball"), "kopf"); assert.equal(f("abschluss"), "schuss"); assert.equal(f("dribbling"), "technik");
  assert.equal(f("pressing"), "taktik"); assert.equal(f("pressing", ["video"]), "video"); assert.equal(f("antritt"), "athletik"); assert.equal(f("coaching"), "mental");
  assert.equal(f(null), "sonst"); assert.equal(f(null, ["video"]), "video");
  assert.equal(f("reflexe"), "tw", "Torwart-Stärke"); assert.equal(f("passspiel", ["training"], true), "tw", "Torhüter: Technik beim TW-Trainer");
  assert.equal(f("kommunikation", ["training"], true), "mental"); assert.equal(f("sprungkraft", ["training"], true), "athletik");
});
