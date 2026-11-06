// Tests: Kader-Nominierung – Bereinigung, Anpfiff und Antwortregeln, Reihenfolge, Demo, Sicht der Spieler, Ankündigung.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardRules, suspendedIn } from "../cards";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS, translator } from "../i18n";
import {
  absentOn, answersAllowed, applyAnswer, cleanReason, cleanSquad, cleanTime, kickoff, mateName, mySquads, nomsOf, openWithAccount,
  squadAnnouncement, squadCounts, squadMatesOf, squadSort,
} from "../nomination";
import type { Nomination, TeamData } from "../types";

const NOW = new Date(2026, 10, 5, 10, 0);
const setup = (): TeamData => { const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };
const TODAY = "2026-11-05";

test("Bereinigung: Uhrzeit, Treffpunkt, Hinweis, Grund", () => {
  assert.equal(cleanTime("9:30"), "09:30"); assert.equal(cleanTime("13.45"), "13:45"); assert.equal(cleanTime(" 07:05 "), "07:05");
  assert.equal(cleanTime("24:00"), null); assert.equal(cleanTime("12:60"), null); assert.equal(cleanTime("abc"), null); assert.equal(cleanTime(null), null);
  const sq = cleanSquad({ matchId: "m1", meetTime: "13.45", meetPlace: "  Vereinsheim\n Kabine 2 ", note: " Weiße\r\n\r\n\r\nTrikots ", showAll: undefined, published: "" });
  assert.deepEqual(sq, { matchId: "m1", meetTime: "13:45", meetPlace: "Vereinsheim Kabine 2", note: "Weiße\n\nTrikots", showAll: true, published: null });
  assert.equal(cleanSquad({ matchId: "m1", showAll: false, meetPlace: "x".repeat(200) }).meetPlace.length, 120);
  assert.equal(cleanReason("  Familien-\nfeier  "), "Familien- feier"); assert.equal(cleanReason("x".repeat(300)).length, 200);
});

test("Anpfiff und Antwortregeln: bis zum Anpfiff, nur mit „Absagen durch Spieler“", () => {
  const m = { date: "2026-11-07", zeit: "15:00" };
  assert.equal(kickoff(m).getTime(), new Date(2026, 10, 7, 15, 0).getTime());
  assert.equal(kickoff({ date: "2026-11-07", zeit: "" }).getTime(), new Date(2026, 10, 7, 23, 59).getTime(), "ohne Uhrzeit: Ende des Tages");
  const team = { settings: { playerAbs: true } } as never, off = { settings: { playerAbs: false } } as never, def = { settings: {} } as never;
  assert.ok(answersAllowed(team, m, new Date(2026, 10, 7, 14, 59)));
  assert.ok(!answersAllowed(team, m, new Date(2026, 10, 7, 15, 0)), "ab Anpfiff geschlossen");
  assert.ok(!answersAllowed(off, m, new Date(2026, 10, 6)), "Einstellung aus");
  assert.ok(answersAllowed(def, m, new Date(2026, 10, 6)), "Standard: erlaubt");
  const n: Nomination = { matchId: "m", pid: "p", standby: false, answer: null, reason: "", at: null, byStaff: false };
  assert.deepEqual(applyAnswer(n, "yes", "egal", "T", false), { ...n, answer: "yes", reason: "", at: "T", byStaff: false }, "Grund nur bei Absage");
  assert.deepEqual(applyAnswer(n, "no", " krank ", "T", true), { ...n, answer: "no", reason: "krank", at: "T", byStaff: true });
  assert.deepEqual(applyAnswer({ ...n, answer: "no", reason: "x", at: "T", byStaff: true }, null, "", "U", true), n, "wieder offen");
});

test("Reihenfolge und Namen: Tor, Abwehr, Mittelfeld, Sturm; Vorname und Initial", () => {
  const P = [{ pos: "ST", nr: 9, vn: "A", nn: "A" }, { pos: "TW", nr: 22, vn: "B", nn: "B" }, { pos: "IV", nr: 4, vn: "C", nn: "C" }, { pos: "ZM", nr: 8, vn: "D", nn: "D" }, { pos: "TW", nr: 1, vn: "E", nn: "E" }];
  assert.deepEqual([...P].sort(squadSort).map(p => p.pos + p.nr), ["TW1", "TW22", "IV4", "ZM8", "ST9"]);
  assert.equal(mateName({ vn: " Luca ", nn: "brenner" }), "Luca B."); assert.equal(mateName({ vn: "Kai", nn: "" }), "Kai");
});

test("Demo: veröffentlichter Kader fürs nächste Spiel, nur verfügbare Spieler, Antworten", () => {
  const D = setup();
  const m = D.matches.filter(x => x.date >= TODAY && !x.result).sort((a, b) => (a.date + a.zeit < b.date + b.zeit ? -1 : 1))[0];
  const sq = D.squads[m.id], noms = nomsOf(D, m.id), k = squadCounts(noms);
  // 16 im Kader, bis zu 2 auf Abruf – aus den Verfügbaren (nicht abwesend, nicht gesperrt)
  const sus = suspendedIn(D, cardRules(D.team), m.id, TODAY);
  const total = Math.min(18, D.players.filter(p => p.active !== false && !absentOn(D, p.id, m.date) && !sus.has(p.id)).length);
  assert.ok(sq && sq.published && sq.showAll && /^\d{2}:\d{2}$/.test(sq.meetTime || ""), "veröffentlicht mit Treffpunkt");
  assert.ok(total > 16, "mindestens einer auf Abruf");
  assert.equal(k.squad, 16); assert.equal(k.standby, total - 16); assert.equal(k.no, 1); assert.equal(k.yes + k.no + k.open, total);
  assert.ok(noms.every(n => !absentOn(D, n.pid, m.date)), "keine Abwesenden nominiert");
  assert.ok(sus.size >= 2 && noms.every(n => !sus.has(n.pid)), "keine Gesperrten nominiert");
  assert.ok(noms.some(n => n.byStaff), "eine Antwort vom Trainerteam");
  assert.equal(noms.find(n => n.answer === "no")!.reason, "Familienfeier");
  const p17 = noms.find(n => n.pid === "p17")!;
  assert.ok(p17 && !p17.answer && !p17.standby, "p17 nominiert, noch offen");
  const mates = squadMatesOf(D, m.id);
  assert.equal(mates.length, total); assert.ok(mates.slice(16).every(x => x.standby), "Abruf am Ende");
  assert.deepEqual(D.squadMates[m.id], mates);
  const mine = mySquads(D, "p17", TODAY);
  assert.equal(mine.length, 1); assert.equal(mine[0].mates.length, total);
  const out = D.players.find(p => !noms.some(n => n.pid === p.id))!;
  assert.deepEqual(mySquads(D, out.id, TODAY), [], "nicht nominiert: nichts sichtbar");
  D.squads[m.id] = { ...sq, published: null };
  assert.deepEqual(mySquads(D, "p17", TODAY), [], "Entwurf: nichts sichtbar");
  D.squads[m.id] = { ...sq, showAll: false };
  assert.deepEqual(mySquads(D, "p17", TODAY)[0].mates, [], "ohne Freigabe keine Kaderliste");
  assert.ok(openWithAccount(D, m.id).every(p => !!p.userId));
});

test("Ankündigung im Chat: Spiel, Treffpunkt, Kader nach Mannschaftsteilen, Abruf, Hinweis, Bitte um Antwort", () => {
  const D = setup(), tr = translator("de");
  const m = D.matches.filter(x => x.date >= TODAY && !x.result).sort((a, b) => (a.date + a.zeit < b.date + b.zeit ? -1 : 1))[0];
  const txt = squadAnnouncement(m, D.squads[m.id], D, tr, "Sa. 07.11.", true);
  const L = txt.split("\n");
  assert.equal(L[0], `Kader für Sa. 07.11. gegen ${m.gegner}`);
  assert.ok(L.some(x => x.startsWith("Treffpunkt: ") && x.includes(" Uhr · ")), "Treffpunkt mit Uhrzeit und Ort");
  assert.ok(L.some(x => x.startsWith("Kader (16): #1 Luca B.")), "Kader beginnt mit dem Torhüter");
  assert.ok(L.some(x => x.startsWith("Auf Abruf: ")));
  assert.equal(L[L.length - 1], "Bitte in der App zu- oder absagen.");
  const priv = squadAnnouncement(m, { ...D.squads[m.id], showAll: false }, D, tr, "Sa.", false);
  assert.ok(priv.includes("Wer nominiert ist, sieht es in der App.") && !priv.includes("Luca") && priv.endsWith("Bitte beim Trainerteam melden."));
  for (const lang of ["de", "en"] as const) for (const k of ["err_answers_off", "err_match_started", "nm_chatHead", "db_squad", "dp_squad", "md_squadOk"]) assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});
