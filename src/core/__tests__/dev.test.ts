// Tests: Kompetenzprofil, Ziele mit Fortschritt, Gesprächsvorbereitung, Saisonrückblick, Wochenchallenge, Individualtraining, Chat-Regeln.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyChallenge, challengeDefsFor, challengeStreak, fromDef, isDone, progressOf, totalsOf, CHALLENGES } from "../challenge";
import { CF_LIMITS, canDirect, chatDefaults, chatNameOf, chatSettings, chatTitle, cleanChatFolders, folderOf, isTransparentPair, pairKey, putMsg, sortChats, totalUnread, unreadOf } from "../chat";
import { addDays, monday } from "../dates";
import { buildDemo, demoTeam } from "../demo";
import { COMPETENCIES, INDIV_TOPICS, POS_GROUPS, areaAvg, assessmentsOf, cleanGoal, cleanScores, compsOf, gapsOf, goalProgress, indivUnit, posGroupOf, prepTalk, seasonReview, statSince, suggestStart } from "../dev";
import { createEngine } from "../engine";
import { DICTS } from "../i18n";
import { inUnit } from "../units";
import type { Assessment, Chat, Goal, TeamData } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0), TODAY = "2026-10-07";
const setup = (): TeamData => buildDemo(demoTeam("u19", "pro", "de"), "de", NOW);
const goal = (p: Partial<Goal>): Goal => ({ id: "g1", pid: "p6", title: "Ziel", area: "ath", kind: "perf", metric: "count", unit: "", start: null, target: null, lower: false,
  test: null, stat: null, from: "2026-09-01", due: "2026-11-30", why: "", steps: [], status: "active", vis: true, by: "coach", talkId: null, ...p });

test("Kompetenzprofil: Positionsgruppen, Bereiche, Mittelwerte und Unterschiede Selbst-/Fremdbild", () => {
  const D = setup();
  for (const pg of POS_GROUPS) { const L = compsOf(pg); assert.ok(L.length >= 12, pg); assert.equal(new Set(L.map(x => x.key)).size, L.length, pg + " ohne Doppelungen"); }
  const p1 = D.players.find(p => p.id === "p1")!, p2 = D.players.find(p => p.id === "p2")!, p17 = D.players.find(p => p.id === "p17")!;
  assert.equal(posGroupOf(D, p1, "u19"), "tw"); assert.equal(posGroupOf(D, p2, "u19"), "iv"); assert.equal(posGroupOf(D, p17, "u19"), "st"); assert.equal(posGroupOf(D, p17, "u11"), "kid");
  const coach: Assessment = { id: "a1", pid: "p2", date: "2026-09-20", by: "coach", scores: { ballan: 3, pass: 4, kopf: 5, beid: 2, zweik: 4, kette: 3 }, note: "", vis: false };
  const self: Assessment = { id: "a2", pid: "p2", date: "2026-09-21", by: "self", scores: { ballan: 3, pass: 4, kopf: 3, beid: 4, zweik: 4 }, note: "", vis: true };
  assert.equal(areaAvg(coach, "iv", "tech"), 3.5);
  const gaps = gapsOf(coach, self, "iv");
  assert.deepEqual(gaps.map(g => [g.key, g.diff]), [["kopf", -2], ["beid", 2]]);
  assert.deepEqual(cleanScores({ ballan: 3, foo: 4, pass: 7, kopf: 2.5 }, "iv"), { ballan: 3 });
  D.assessments = [coach, self, { ...coach, id: "a0", date: "2026-08-01" }];
  assert.equal(assessmentsOf(D, "p2", "coach")[0].id, "a1", "neueste zuerst");
  assert.equal(assessmentsOf(D, "p2", "coach", true).length, 0, "Spieler sehen nur freigegebene Trainereinschätzungen");
  assert.ok(Object.values(COMPETENCIES.kid).flat().length <= 14, "Kinderprofil bleibt kurz");
});

test("Ziele: Fortschritt aus Test, Statistik, Beteiligung, Zähler, Messwert und Meilensteinen", () => {
  const D = setup();
  D.tests.push({ id: "t1", pid: "p6", test: "sprint30", date: "2026-09-02", value: 4.40 }, { id: "t2", pid: "p6", test: "sprint30", date: "2026-10-01", value: 4.33 });
  const s1 = goalProgress(D, goal({ metric: "test", test: "sprint30", start: 4.40, target: 4.30, unit: "s" }), TODAY);
  assert.equal(s1.cur, 4.33); assert.ok(Math.abs((s1.pct || 0) - 0.7) < 0.01, "kleiner ist besser beim Sprint"); assert.equal(s1.reached, false);
  const m = D.matches.filter(x => x.date >= "2026-09-01" && x.date < TODAY);
  m.forEach((x, i) => { (D.stats[x.id] ||= {}).p6 = { min: 90, goals: i % 2, assists: 0, start: true }; });
  const goals = statSince(D, "p6", "goals", "2026-09-01", TODAY);
  const s2 = goalProgress(D, goal({ metric: "stat", stat: "goals", target: goals }), TODAY);
  assert.equal(s2.cur, goals); assert.equal(s2.reached, true); assert.equal(s2.pct, 1);
  const s3 = goalProgress(D, goal({ metric: "att", target: 90, start: 70 }), TODAY);
  assert.ok(s3.cur != null && s3.cur >= 0 && s3.cur <= 100, "Beteiligung in %");
  D.goalEntries.push({ id: "e1", goalId: "g1", pid: "p6", date: "2026-09-10", value: 120, note: "", by: "player" }, { id: "e2", goalId: "g1", pid: "p6", date: "2026-10-01", value: 60, note: "", by: "player" });
  const s4 = goalProgress(D, goal({ metric: "count", target: 300 }), TODAY);
  assert.equal(s4.cur, 180); assert.equal(s4.pct, 0.6);
  const s5 = goalProgress(D, goal({ metric: "value", start: 20, target: 50 }), TODAY);
  assert.equal(s5.cur, 60, "letzter Wert zählt"); assert.equal(s5.reached, true);
  const s6 = goalProgress(D, goal({ metric: "check", steps: [{ text: "a", done: true }, { text: "b", done: false }] }), TODAY);
  assert.equal(s6.cur, 1); assert.equal(s6.target, 2); assert.equal(s6.pct, 0.5);
  // hinter Plan: 90 % der Zeit vorbei, kaum Fortschritt
  const late = goalProgress(D, goal({ metric: "count", target: 3000, from: "2026-08-01", due: "2026-10-12" }), TODAY);
  assert.equal(late.behind, true);
  assert.equal(suggestStart(D, "p6", "test", "sprint30", TODAY), 4.33);
  const cg = cleanGoal(goal({ title: "  x  ", metric: "check", target: 5, steps: [{ text: " ", done: false }, { text: "Schritt", done: true }] }));
  assert.equal(cg.title, "x"); assert.equal(cg.target, null); assert.equal(cg.steps.length, 1);
});

test("Gesprächsvorbereitung und Saisonrückblick aus den Daten", () => {
  const D = setup();
  D.assessments.push({ id: "a1", pid: "p6", date: "2026-09-20", by: "coach", scores: { ballan: 5, pass: 2, dribb: 4, schuss: 3, ausd: 1 }, note: "", vis: true },
    { id: "a2", pid: "p6", date: "2026-09-25", by: "self", scores: { ballan: 5, pass: 4, ausd: 3 }, note: "", vis: true });
  D.talks.push({ id: "k1", pid: "p6", date: "2026-08-20", kind: "start", player: "", strengths: "", focus: "", notes: "", next: null, vis: true,
    agreements: [{ id: "x", text: "Mehr schwacher Fuß", who: "player", due: null, done: false }] });
  const E = createEngine(D, { lang: "de", now: NOW });
  const prep = prepTalk(E, "p6");
  assert.ok(prep.strengths.some(s => s.startsWith("dv_pComp|k=ballan")), "beste Kompetenz als Stärke");
  assert.ok(prep.focus.some(s => s.startsWith("dv_pComp|k=ausd")), "schwächste als Entwicklungsfeld");
  assert.ok(prep.gaps.some(g => g.key === "pass"), "Unterschied Passspiel");
  assert.equal(prep.open.length, 1);
  const r = seasonReview(E, "p6");
  assert.equal(r.from, "2026-07-01");
  assert.ok(r.sessions > 0 && r.attended <= r.sessions);
  assert.equal(r.talks, 1);
  assert.equal(Math.round(r.areas.find(a => a.area === "tech")!.last! * 100) / 100, 3.67, "p6 = Außenverteidiger: Ballan-/mitnahme, Pass, Dribbling");
  const rp = seasonReview(E, "p6", true);
  assert.ok(rp.talks <= r.talks);
});

test("Wochenchallenge: Bestleistung, Menge, Tage, Abhaken, Teamsumme ohne Namen, Serie", () => {
  const D = setup(), ws = monday(TODAY);
  for (const g of ["u11", "u15", "u19", "akt"] as const) assert.ok(challengeDefsFor(g).length >= 5, g);
  assert.ok(!challengeDefsFor("u11").some(d => d.key === "copenhagen"), "keine Kraft-Challenge für Kinder");
  const best = fromDef(CHALLENGES.find(c => c.key === "jonglier")!, ws, "c1", "Jonglieren", "");
  let e = applyChallenge(best, undefined, "p6", { value: 12 }, "t"); e = applyChallenge(best, e, "p6", { value: 8 }, "t");
  assert.equal(e.value, 12, "Bestwert bleibt"); assert.equal(isDone(best, e), true, "ohne Ziel: Versuch zählt");
  const days = fromDef(CHALLENGES.find(c => c.key === "mastery")!, ws, "c2", "Mastery", "");
  let d = applyChallenge(days, undefined, "p6", { day: "2026-10-05" }, "t");
  d = applyChallenge(days, d, "p6", { day: "2026-10-06" }, "t"); d = applyChallenge(days, d, "p6", { day: "2026-10-06" }, "t");
  assert.deepEqual(d.days, ["2026-10-05"], "zweites Tippen nimmt den Tag zurück"); assert.equal(progressOf(days, d), 0.2);
  const cnt = fromDef(CHALLENGES.find(c => c.key === "schwach100")!, ws, "c3", "Schwach", "");
  let c = applyChallenge(cnt, undefined, "p6", { value: 60 }, "t"); c = applyChallenge(cnt, c, "p6", { value: 50 }, "t");
  assert.equal(c.value, 110); assert.equal(c.done, true);
  D.challenges = [best, days, cnt]; D.chEntries = [e, d, c, applyChallenge(best, undefined, "p8", { value: 30 }, "t")];
  const tot = totalsOf(D, best, false);
  assert.equal(tot.players, 2); assert.equal(tot.sum, 42); assert.deepEqual(tot.top, [], "ohne Bestenliste keine Namen");
  assert.equal(totalsOf(D, best, true).top[0].value, 30);
  assert.equal(challengeStreak(D, "p6", TODAY), 1);
  D.challenges.push({ ...best, id: "c0", ws: addDays(ws, -7) }); D.chEntries.push({ ...e, cid: "c0" });
  assert.equal(challengeStreak(D, "p6", TODAY), 2);
});

test("Individualtraining: Einheit nur für den Spieler", () => {
  const D = setup();
  const u = indivUnit({ id: "r1", pid: "p6", topic: "schuss", note: "links", wish: "", status: "open", answer: "", date: null, slot: null, staffId: null, created: "" }, 3, "17:00", 45, "s2", "Individualtraining: Torschuss");
  assert.equal(u.art, "technik"); assert.deepEqual(u.pids, ["p6"]);
  assert.ok(inUnit(D, u, D.players.find(p => p.id === "p6")!)); assert.ok(!inUnit(D, u, D.players.find(p => p.id === "p7")!));
  D.units["2026-10-08"] = [u];
  const E = createEngine(D, { lang: "de", now: NOW });
  assert.ok(E.unitsFor("p6", "2026-10-08").length === 1 && E.unitsFor("p7", "2026-10-08").length === 0);
});

test("Chat: Kinderschutz-Standards, Einzelchats, Titel, Ungelesen, Sortierung", () => {
  assert.deepEqual(chatDefaults("u15"), { on: true, dm: "staff", transparent: true, teamReadOnly: false });
  assert.equal(chatDefaults("sen").dm, "all"); assert.equal(chatDefaults("sen").transparent, false);
  const st = chatSettings({ cls: "u19", settings: { chat: { on: true, dm: "staff", transparent: true, teamReadOnly: false } } });
  assert.ok(canDirect(st, "player", "staff") && !canDirect(st, "player", "player"), "Jugend: nur mit dem Trainerteam");
  assert.ok(canDirect({ ...st, dm: "all" }, "player", "player"));
  assert.ok(!canDirect({ ...st, dm: "off" }, "staff", "player"));
  assert.ok(isTransparentPair(st, "staff", "player") && !isTransparentPair(st, "player", "player") && !isTransparentPair(st, "staff", "staff"));
  assert.equal(chatNameOf({ vn: "Luca", nn: "Brenner" }), "Luca B."); assert.equal(pairKey("b", "a"), "a:b");
  const D = setup();
  D.chatPeople = [{ uid: "u1", name: "Trainer", kind: "staff", pid: null, role: "chef" }, { uid: "u2", name: "Luca B.", kind: "player", pid: "p1", role: null }];
  const ch = (id: string, kind: Chat["kind"], members: string[] = []): Chat => ({ id, kind, title: "", groupId: null, members, readOnly: false, transparent: false, createdBy: null, lastAt: null, muted: false });
  D.chats = [ch("t", "team"), ch("s", "staff"), ch("d", "direct", ["u1", "u2"])];
  const tt = (k: string) => k;
  assert.equal(chatTitle(D.chats[2], D, "u1", tt), "Luca B."); assert.equal(chatTitle(D.chats[1], D, "u1", tt), "ch_staff");
  putMsg(D, { id: "m1", chatId: "d", uid: "u2", name: "Luca B.", body: "Hallo", at: "2026-10-07T08:00:00.000Z", replyTo: null, deleted: false, reactions: {} });
  putMsg(D, { id: "m1", chatId: "d", uid: "u2", name: "Luca B.", body: "Hallo", at: "2026-10-07T08:00:00.000Z", replyTo: null, deleted: false, reactions: {} });
  putMsg(D, { id: "m2", chatId: "t", uid: "u1", name: "Trainer", body: "Morgen 18 Uhr", at: "2026-10-07T07:00:00.000Z", replyTo: null, deleted: false, reactions: {} });
  assert.equal(D.chatMsgs.d.length, 1, "keine Doppelungen");
  assert.equal(unreadOf(D, "d", "u1"), 1); assert.equal(unreadOf(D, "t", "u1"), 0, "eigene Nachrichten zählen nicht");
  D.chatRead.d = "2026-10-07T08:00:00.000Z"; assert.equal(totalUnread(D, "u1"), 0);
  assert.deepEqual(sortChats(D).map(c => c.id), ["d", "t", "s"]);
});

test("Chat-Ordner: Zuordnung (Einzelchats, Gruppen, Mitlesen) und Bereinigung der Einstellungen", () => {
  const ch = (id: string, kind: Chat["kind"], members: string[] = [], transparent = false): Chat => ({ id, kind, title: "", groupId: null, members, readOnly: false, transparent, createdBy: null, lastAt: null, muted: false });
  assert.equal(folderOf(ch("d", "direct", ["u1", "u2"]), "u1", true), "mine");
  assert.equal(folderOf(ch("t", "team"), "u1", true), "groups"); assert.equal(folderOf(ch("c", "custom", ["u1"]), "u1", false), "groups");
  assert.equal(folderOf(ch("x", "direct", ["u2", "u3"], true), "u1", true), "read", "transparenter Chat ohne Mitgliedschaft → Mitlesen");
  assert.equal(folderOf(ch("x", "direct", ["u2", "u3"], true), "u1", false), "mine", "ohne Recht kein Mitlesen");
  const many = [...Array(20)].map((_, i) => ({ id: "f" + i, name: "  Ordner   " + i + " ".repeat(5) + "x".repeat(40), chats: [...Array(30)].map((_, j) => "c" + j) }));
  const F = cleanChatFolders({ names: { mine: "  Persönlich ", groups: "", read: 5, foo: "x" }, hide: ["read", "foo"], custom: [...many, { id: "f0", name: "Doppelt", chats: [] }, { id: "<b>", name: "x", chats: [] }] });
  assert.deepEqual(F.names, { mine: "Persönlich" }); assert.deepEqual(F.hide, ["read"]);
  assert.equal(F.custom!.length, CF_LIMITS.custom);
  assert.ok(F.custom!.every(f => f.name.length <= CF_LIMITS.name && !f.name.includes("  ")));
  assert.equal(F.custom!.reduce((a, f) => a + f.chats.length, 0), CF_LIMITS.ids, "höchstens 100 Zuordnungen");
  assert.deepEqual(cleanChatFolders(null), {}); assert.deepEqual(cleanChatFolders({ custom: [{ id: "a", name: "", chats: ["c1", "c1", 5] }] }).custom, [{ id: "a", name: "…", chats: ["c1"] }]);
});

test("Texte: Kompetenzen, Challenges, Themen in beiden Sprachen, gleiche Schlüssel de/en", () => {
  for (const lang of ["de", "en"] as const) {
    const d = DICTS[lang];
    for (const pg of POS_GROUPS) for (const { key, area } of compsOf(pg)) {
      assert.ok(typeof d["cp_" + key] === "string", `${lang}: cp_${key}`); assert.ok(typeof d["cps_" + key] === "string", `${lang}: cps_${key}`); assert.ok(d["da_" + area], `${lang}: da_${area}`);
    }
    for (const c of CHALLENGES) { assert.ok(d["chk_" + c.key], `${lang}: chk_${c.key}`); assert.ok(d["chkd_" + c.key], `${lang}: chkd_${c.key}`); }
    for (const k of INDIV_TOPICS) assert.ok(d["iq_t_" + k], `${lang}: iq_t_${k}`);
    for (const k of ["team", "staff", "group", "direct", "custom"]) assert.ok(d["ch_" + k], `${lang}: ch_${k}`);
  }
  const de = Object.keys(DICTS.de), en = new Set(Object.keys(DICTS.en));
  assert.deepEqual(de.filter(k => !en.has(k)), []);
  assert.deepEqual([...en].filter(k => !(k in DICTS.de)), []);
});
