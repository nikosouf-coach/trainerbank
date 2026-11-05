// Tests: Umfragen – Bereinigung, Antworten, Zielgruppe, Sichtbarkeit der Ergebnisse, Auswertung (wie poll_results), Vorlagen, Demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS } from "../i18n";
import {
  ANON_MIN, PLAYER_OPEN_MAX, POLL_LIMITS, answerOf, asPlayerPoll, cut, blankQuestion, canManage, cleanAnswers, cleanPoll, cleanQuestion, fromTemplate, isPollTarget, leaders,
  newPoll, nextQuestionId, openPollsBy, pct, playersMayPoll, pollEditable, pollOpen, pollReady, pollResult, pollTargets, pollTemplates, pollsFor, pollsToAnswer,
  reopened, resultsVisible, sortPolls,
} from "../polls";
import type { Poll, TeamData } from "../types";

const NOW = new Date(2026, 10, 5, 10, 0), TODAY = "2026-11-05";
const setup = (): TeamData => { const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };
const quick = (x: Partial<Poll> = {}): Poll => cleanPoll({ ...newPoll("quick", "t1"), title: "Wie kommst du hin?", questions: [{ ...blankQuestion("q1"), options: ["Bus", "Selbst", "Gar nicht"] }], ...x });

test("Frage bereinigen: Text und Antworten getrimmt, doppelte und leere Antworten raus, Grenzen, unbrauchbare Fragen null", () => {
  const q = cleanQuestion({ id: "q1", type: "single", text: "  Wer  fährt\nmit? ", options: [" Ich ", "ich", "", "Du", 7 as never], required: false }, 0)!;
  assert.equal(q.text, "Wer fährt mit?");
  assert.deepEqual(q.options, ["Ich", "Du", "7"], "Groß-/Kleinschreibung zählt als doppelt");
  assert.equal(q.required, false);
  assert.equal(cleanQuestion({ type: "single", text: "Nur eine", options: ["A", "a"] }, 0), null, "weniger als zwei Antworten");
  assert.equal(cleanQuestion({ type: "scale", text: "   " }, 0), null, "ohne Text");
  const many = cleanQuestion({ type: "multi", text: "x".repeat(300), options: Array.from({ length: 14 }, (_, i) => "Antwort " + i + "y".repeat(100)) }, 4)!;
  assert.equal(many.text.length, POLL_LIMITS.qtext); assert.equal(many.options.length, POLL_LIMITS.options);
  assert.ok(many.options.every(o => o.length <= POLL_LIMITS.option)); assert.equal(many.id, "q5", "ID aus der Position");
  const sc = cleanQuestion({ id: "Q!", type: "scale", text: "Wie war's?", options: ["weg"], lo: "gar nicht", hi: "sehr" }, 1)!;
  assert.deepEqual([sc.id, sc.options, sc.lo, sc.hi, sc.required], ["q2", [], "gar nicht", "sehr", true]);
  const tx = cleanQuestion({ type: "text", text: "Was noch?", lo: "x", hi: "y" }, 0)!;
  assert.deepEqual([tx.lo, tx.hi], ["", ""], "Beschriftungen nur bei der Skala");
  assert.equal(cleanQuestion({ type: "kaputt" as never, text: "A?", options: ["a", "b"] }, 0)!.type, "single");
});

test("Umfrage bereinigen: Abstimmung = eine Auswahlfrage mit dem Titel als Text; Fragebogen mit eindeutigen IDs", () => {
  const p = cleanPoll({ id: "x", kind: "quick", title: "  Pizza oder Burger? ", intro: "weg", questions: [{ id: "q9", type: "text", text: "Freitext" } as never, { id: "q2", type: "multi", text: "egal", options: ["Pizza", "Burger"], required: false, lo: "", hi: "" }] });
  assert.equal(p.title, "Pizza oder Burger?"); assert.equal(p.intro, "", "Einleitung nur im Fragebogen");
  assert.equal(p.questions.length, 1); assert.deepEqual([p.questions[0].id, p.questions[0].type, p.questions[0].text, p.questions[0].required], ["q1", "multi", "Pizza oder Burger?", true]);
  assert.ok(pollReady(p));
  const noTitle = cleanPoll({ id: "y", kind: "quick", title: "", questions: [{ ...blankQuestion("q1"), text: "Aus der Frage", options: ["a", "b"] }] });
  assert.equal(noTitle.title, "Aus der Frage", "ohne Titel gilt der Fragetext");
  assert.equal(pollReady(cleanPoll({ id: "z", kind: "quick", title: "Leer" })), false, "Abstimmung ohne Antworten");
  const s = cleanPoll({
    id: "s", kind: "survey", title: "Feedback", intro: "Zeile 1\n\n\n\nZeile 2  ", anonymous: true, results: "staff", until: "2026-11-09", groupId: "", answers: 3,
    questions: [{ ...blankQuestion("q1", "scale"), text: "A?" }, { ...blankQuestion("q1", "text"), text: "B?" }, { ...blankQuestion("q2"), text: "C?" }, { ...blankQuestion("q3"), text: "" }],
  });
  assert.equal(s.intro, "Zeile 1\n\nZeile 2", "höchstens eine Leerzeile");
  assert.deepEqual(s.questions.map(q => q.id), ["q1", "q2"], "doppelte ID bekommt eine freie Nummer");
  assert.deepEqual(s.questions.map(q => q.text), ["A?", "B?"], "unvollständige Fragen (ohne Antworten, ohne Text) fallen weg");
  assert.deepEqual([s.anonymous, s.results, s.groupId, s.until, s.answers], [true, "staff", null, "2026-11-09", 3]);
  const lim = cleanPoll({ id: "l", kind: "survey", title: "t".repeat(200), questions: Array.from({ length: 20 }, (_, i) => ({ ...blankQuestion("q" + (i + 1), "scale"), text: "F" + i })) });
  assert.equal(lim.title.length, POLL_LIMITS.title); assert.equal(lim.questions.length, POLL_LIMITS.questions);
  const bad = cleanPoll({ id: "b", kind: "nix" as never, title: "T?", until: "morgen", results: "keiner" as never, answers: -2, questions: [{ ...blankQuestion("q1"), options: ["a", "b"] }] });
  assert.deepEqual([bad.kind, bad.until, bad.results, bad.answers, bad.anonymous], ["quick", null, "all", 0, false]);
});

test("Neue Umfragen und Vorlagen: sinnvolle Standards, Vorlagen in beiden Sprachen gültig", () => {
  const q = newPoll("quick", "a"), s = newPoll("survey", "b");
  assert.deepEqual([q.anonymous, q.results, q.questions.length, q.questions[0].options.length], [false, "all", 1, 2]);
  assert.deepEqual([s.anonymous, s.results, s.questions[0].type], [true, "staff", "scale"]);
  assert.equal(nextQuestionId([{ id: "q1" }, { id: "q3" }]), "q4"); assert.equal(nextQuestionId([{ id: "q2" }]), "q3");
  for (const lang of ["de", "en"] as const) {
    const T = pollTemplates(lang), keys = T.map(x => x.key);
    assert.equal(new Set(keys).size, keys.length, lang + ": eindeutige Schlüssel");
    assert.deepEqual(keys, pollTemplates(lang === "de" ? "en" : "de").map(x => x.key), "gleiche Vorlagen in beiden Sprachen");
    for (const t of T) {
      const p = fromTemplate(t, "tpl-" + t.key);
      assert.ok(pollReady(p), `${lang}/${t.key} startklar`);
      assert.equal(p.questions.length, t.questions.length, `${lang}/${t.key}: keine Frage verloren`);
      assert.equal(p.title, t.title); assert.equal(p.anonymous, t.anonymous); assert.equal(p.results, t.results);
      if (t.kind === "survey") assert.ok(p.anonymous, "Fragebögen anonym");
    }
    const tpl = T.find(x => x.key === "next")!;
    assert.equal(tpl.results, "staff", "Saisonplanung: nur das Trainerteam sieht, wer was plant");
  }
  const a = pollTemplates("de")[0], p = fromTemplate(a, "c1");
  p.questions[0].options.push("geändert");
  assert.ok(!pollTemplates("de")[0].questions[0].options.includes("geändert"), "Vorlage bleibt unverändert");
});

test("Antworten prüfen: Auswahl, Mehrfachauswahl, Skala, Freitext, Pflichtfragen", () => {
  const p = cleanPoll({
    id: "s", kind: "survey", title: "F", questions: [
      { ...blankQuestion("q1"), text: "Eins?", options: ["a", "b", "c"] },
      { ...blankQuestion("q2", "multi"), text: "Mehr?", options: ["a", "b", "c"], required: false },
      { ...blankQuestion("q3", "scale"), text: "Skala?" },
      { ...blankQuestion("q4", "text"), text: "Text?", required: false },
    ],
  });
  assert.deepEqual(cleanAnswers(p, { q1: 2, q2: [2, 0, 2, 7, -1, 1.5], q3: 5, q4: "  gut \r\n\r\n\r\n so  ", x: 1 }), { q1: 2, q2: [0, 2], q3: 5, q4: "gut\n\nso" });
  assert.deepEqual(cleanAnswers(p, { q1: 0, q3: 1, q2: [], q4: "   " }), { q1: 0, q3: 1 }, "freiwillige Fragen dürfen leer bleiben");
  assert.equal(cleanAnswers(p, { q1: 3, q3: 2 }), null, "Index außerhalb");
  assert.equal(cleanAnswers(p, { q1: 1 }), null, "Pflichtfrage fehlt");
  assert.equal(cleanAnswers(p, { q1: 1, q3: 6 }), null, "Skala nur 1–5");
  assert.equal(cleanAnswers(p, { q1: "1", q3: 3 }), null, "Zahl als Text zählt nicht");
  assert.equal(cleanAnswers(p, { q1: 1, q3: 2.5 }), null);
  const long = cleanAnswers(p, { q1: 0, q3: 3, q4: "x".repeat(900) })!;
  assert.equal((long.q4 as string).length, POLL_LIMITS.text);
  const emoji = cleanAnswers(p, { q1: 0, q3: 3, q4: "x".repeat(POLL_LIMITS.text - 1) + "😄" })!;
  assert.equal(emoji.q4, "x".repeat(POLL_LIMITS.text - 1), "kein halbes Emoji am Ende (die Datenbank lehnt es ab)");
  assert.equal(cut("ab 😄", 4), "ab", "Leerzeichen am Ende fällt weg");
  const opt = cleanPoll({ id: "o", kind: "survey", title: "O", questions: [{ ...blankQuestion("q1", "text"), text: "?", required: false }] });
  assert.equal(cleanAnswers(opt, {}), null, "gar nichts beantwortet = keine Antwort");
});

test("Status: läuft bis einschließlich zum Ende; wieder öffnen nimmt ein abgelaufenes Ende weg; Inhalt nur ohne Antworten änderbar", () => {
  assert.ok(pollOpen(quick({ until: TODAY }), TODAY)); assert.ok(!pollOpen(quick({ until: "2026-11-04" }), TODAY));
  assert.ok(!pollOpen(quick({ closed: true }), TODAY)); assert.ok(pollOpen(quick(), TODAY), "ohne Ende");
  assert.deepEqual([reopened(quick({ closed: true, until: "2026-11-01" }), TODAY).closed, reopened(quick({ closed: true, until: "2026-11-01" }), TODAY).until], [false, null]);
  assert.equal(reopened(quick({ closed: true, until: "2026-11-10" }), TODAY).until, "2026-11-10");
  assert.ok(pollEditable(quick())); assert.ok(!pollEditable(quick({ answers: 1 })));
  const L = sortPolls([quick({ id: "a", closed: true, created: "2026-11-05T09:00:00Z" }), quick({ id: "b", created: "2026-11-01T09:00:00Z" }), quick({ id: "c", created: "2026-11-03T09:00:00Z" })], TODAY);
  assert.deepEqual(L.map(p => p.id), ["c", "b", "a"], "laufende zuerst, dann neueste");
});

test("Zielgruppe: aktive Spieler des Teams bzw. der Gruppe; Spieler sehen eigene und an sie gerichtete Umfragen", () => {
  const D = setup();
  const council = D.players.filter(p => (p.groups || []).includes("g3"));
  assert.ok(council.length > 0);
  const g = quick({ id: "g", groupId: "g3" });
  assert.deepEqual(pollTargets(D, g).map(p => p.id), council.map(p => p.id));
  assert.equal(pollTargets(D, quick()).length, D.players.filter(p => p.active !== false).length);
  const out = D.players.find(p => !(p.groups || []).includes("g3"))!;
  assert.ok(!isPollTarget(g, out)); assert.ok(isPollTarget(g, council[0])); assert.ok(!isPollTarget(quick(), { ...out, active: false }), "inaktiv");
  D.polls = [g, quick({ id: "own", authorPid: out.id, byPlayer: true, groupId: "g3" }), quick({ id: "all", created: "2026-11-05T08:00:00Z" })];
  D.pollAnswers = [{ pollId: "all", pid: out.id, answers: { q1: 0 }, at: "" }];
  assert.deepEqual(pollsFor(D, out.id, TODAY).map(p => p.id).sort(), ["all", "own"], "eigene Abstimmung auch ohne Zielgruppe");
  assert.deepEqual(pollsToAnswer(D, out.id, TODAY).map(p => p.id), [], "beantwortet bzw. nicht angesprochen");
  assert.deepEqual(pollsToAnswer(D, council[0].id, TODAY).map(p => p.id).sort(), ["all", "g", "own"], "Abstimmung eines Spielers an die Gruppe");
  assert.equal(answerOf(D, "all", out.id)?.answers.q1, 0); assert.equal(answerOf(D, "g", out.id), null);
});

test("Ergebnisse sehen: Trainerteam immer; Spieler nur bei „für alle“ nach der eigenen Antwort, nach dem Ende oder bei der eigenen Abstimmung", () => {
  const all = quick(), staff = quick({ results: "staff" }), me = { staff: false, pid: "p1" };
  assert.ok(resultsVisible(staff, { staff: true }, false, TODAY));
  assert.ok(!resultsVisible(all, me, false, TODAY)); assert.ok(resultsVisible(all, me, true, TODAY));
  assert.ok(resultsVisible({ ...all, closed: true }, me, false, TODAY), "nach dem Ende");
  assert.ok(resultsVisible({ ...all, authorPid: "p1" }, me, false, TODAY), "eigene Abstimmung");
  assert.ok(!resultsVisible(staff, me, true, TODAY)); assert.ok(!resultsVisible({ ...staff, closed: true }, me, true, TODAY));
});

test("Auswertung mit Namen: Anzahl, Anteil, wer was gewählt hat, wer fehlt (nur Trainerteam); Fremde zählen nicht", () => {
  const D = setup(), P = D.players.filter(p => p.active !== false);
  const p = cleanPoll({ id: "n", kind: "survey", title: "N", anonymous: false, results: "all", questions: [
    { ...blankQuestion("q1", "multi"), text: "Wann?", options: ["Fr", "Sa", "So"] },
    { ...blankQuestion("q2", "scale"), text: "Lust?", required: false },
    { ...blankQuestion("q3", "text"), text: "Noch was?", required: false },
  ] });
  D.pollAnswers = [
    { pollId: "n", pid: P[0].id, answers: { q1: [0, 1], q2: 4, q3: "Gern Freitag" }, at: "" },
    { pollId: "n", pid: P[1].id, answers: { q1: [1], q2: 5 }, at: "" },
    { pollId: "n", pid: P[2].id, answers: { q1: [1, 2], q2: 2 }, at: "" },
    { pollId: "n", pid: "gibt-es-nicht", answers: { q1: [0] }, at: "" },
    { pollId: "anders", pid: P[3].id, answers: { q1: [0] }, at: "" },
  ];
  const r = pollResult(D, p, { staff: true });
  assert.deepEqual([r.n, r.targets, r.hidden], [3, P.length, false]);
  const [a, b, c] = r.questions;
  assert.deepEqual([a.answered, a.counts], [3, [1, 3, 1]], "Mehrfachauswahl: Personen statt Kreuze");
  assert.equal(pct(a, 1), 100); assert.equal(pct(a, 0), 33); assert.deepEqual(leaders(a), [1]);
  const nm = (i: number) => `${P[i].vn} ${P[i].nn.slice(0, 1)}.`;
  assert.deepEqual(a.voters![0], [nm(0)]); assert.equal(a.voters![1].length, 3);
  assert.deepEqual([b.answered, b.counts, b.avg], [3, [0, 1, 0, 1, 1], 3.7], "Schnitt auf eine Stelle");
  assert.deepEqual(c.texts, [{ text: "Gern Freitag", name: nm(0) }]);
  assert.deepEqual(r.respondents!.map(x => x.pid), [P[0].id, P[1].id, P[2].id]);
  assert.equal(r.missing!.length, P.length - 3);
  const pl = pollResult(D, p, { staff: false, pid: P[0].id });
  assert.equal(pl.questions[2].texts, undefined, "Freitexte nur fürs Trainerteam"); assert.equal(pl.questions[2].answered, 1);
  assert.equal(pl.missing, undefined, "wer fehlt, sieht nur das Trainerteam"); assert.ok(pl.questions[0].voters, "mit Namen und für alle: Namen sichtbar");
  assert.deepEqual(leaders({ counts: [2, 2, 0] }), [0, 1]); assert.deepEqual(leaders({ counts: [0, 0] }), []);
  assert.equal(pct({ counts: [0, 0], answered: 0 }, 0), 0);
});

test(`Anonyme Auswertung: erst ab ${ANON_MIN} Antworten, ohne Namen, Freitexte nur fürs Trainerteam und nach Inhalt sortiert`, () => {
  const D = setup(), P = D.players;
  const p = cleanPoll({ id: "a", kind: "survey", title: "A", anonymous: true, results: "all", questions: [
    { ...blankQuestion("q1"), text: "Gut?", options: ["ja", "nein"] }, { ...blankQuestion("q2", "text"), text: "Warum?", required: false },
  ] });
  const add = (i: number, q1: number, q2?: string) => D.pollAnswers.push({ pollId: "a", pid: P[i].id, answers: { q1, ...(q2 ? { q2 } : {}) }, at: "2026-11-0" + (i + 1) });
  D.pollAnswers = [];
  add(0, 0, "Zuerst"); add(1, 1);
  const few = pollResult(D, p, { staff: true });
  assert.deepEqual([few.n, few.hidden, few.questions.length], [2, true, 0]);
  assert.equal(few.respondents, undefined); assert.equal(few.missing, undefined, "anonym: auch nicht, wer fehlt");
  add(2, 0, "Später"); add(3, 0, "Am Ende");
  const r = pollResult(D, p, { staff: true });
  assert.equal(r.hidden, false); assert.deepEqual(r.questions[0].counts, [3, 1]); assert.equal(r.questions[0].voters, undefined, "keine Namen");
  assert.ok(r.questions[1].texts!.every(x => x.name === undefined));
  const order = r.questions[1].texts!.map(x => x.text);
  assert.deepEqual([...order].sort(), ["Am Ende", "Später", "Zuerst"]);
  D.pollAnswers.reverse();
  assert.deepEqual(pollResult(D, p, { staff: true }).questions[1].texts!.map(x => x.text), order, "Reihenfolge verrät nicht, wer wann geantwortet hat");
  assert.equal(pollResult(D, p, { staff: false, pid: P[0].id }).questions[1].texts, undefined);
});

test("Abstimmungen von Spielern: immer mit Namen, fürs ganze Team, Ergebnisse für alle; Verwalten nur Trainerteam (Nachrichten) oder Autor", () => {
  const p = asPlayerPoll(quick({ anonymous: true, results: "staff", groupId: "g1", kind: "survey", intro: "x" }), "p5");
  assert.deepEqual([p.kind, p.anonymous, p.results, p.groupId, p.byPlayer, p.authorPid, p.intro], ["quick", false, "all", null, true, "p5", ""]);
  assert.ok(canManage(p, { staff: true, messages: true })); assert.ok(!canManage(p, { staff: true, messages: false }));
  assert.ok(canManage(p, { staff: false, pid: "p5" })); assert.ok(!canManage(p, { staff: false, pid: "p6" }));
  assert.ok(!playersMayPoll({})); assert.ok(!playersMayPoll({ polls: null })); assert.ok(playersMayPoll({ polls: { players: true } }));
  const D = { polls: [p, { ...p, id: "x2" }, { ...p, id: "x3", closed: true }, { ...p, id: "x4", authorPid: "p6" }] } as Pick<TeamData, "polls">;
  assert.equal(openPollsBy(D, "p5", TODAY), 2); assert.equal(PLAYER_OPEN_MAX, 2);
});

test("Demo: laufende Umfragen mit passenden Zählern, Stürmer hat Fahrt und Fragebogen offen, Gruppe nur für ihre Mitglieder", () => {
  const D = setup();
  assert.ok(playersMayPoll(D.team.settings));
  assert.ok(D.polls.length >= 5);
  for (const p of D.polls) {
    assert.equal(p.answers, D.pollAnswers.filter(a => a.pollId === p.id).length, p.id + ": Zähler");
    assert.deepEqual(cleanPoll(p), p, p.id + ": schon bereinigt");
    for (const a of D.pollAnswers.filter(x => x.pollId === p.id)) {
      assert.deepEqual(cleanAnswers(p, a.answers), a.answers, `${p.id}/${a.pid}: gültige Antwort`);
      assert.ok(isPollTarget(p, D.players.find(x => x.id === a.pid)!), `${p.id}/${a.pid}: angesprochen`);
    }
    const ids = D.pollAnswers.filter(a => a.pollId === p.id).map(a => a.pid);
    assert.equal(new Set(ids).size, ids.length, p.id + ": eine Antwort je Spieler");
  }
  const open = pollsToAnswer(D, "p17", TODAY).map(p => p.id);
  assert.ok(open.includes("dpo1") && open.includes("dpo2"), "Stürmer: Fahrt und Fragebogen offen");
  const g = D.polls.find(p => p.groupId)!;
  assert.ok(pollTargets(D, g).length < D.players.length);
  const outsider = D.players.find(p => !isPollTarget(g, p))!;
  assert.ok(!pollsFor(D, outsider.id, TODAY).some(p => p.id === g.id), "Gruppenumfrage nur für Mitglieder");
  const anon = D.polls.find(p => p.anonymous)!;
  const r = pollResult(D, anon, { staff: true });
  assert.ok(!r.hidden && r.questions.some(q => (q.texts || []).length > 0), "anonymer Fragebogen mit Freitexten");
  assert.ok(D.polls.some(p => !pollOpen(p, TODAY)), "eine beendete Umfrage");
  assert.ok(D.polls.some(p => p.byPlayer && p.authorPid), "eine Abstimmung eines Spielers");
  // Englisch: gleiche Struktur
  const E = buildDemo(demoTeam("u19", "pro", "en"), "en", NOW); demoExtras(E, "en", NOW);
  assert.deepEqual(E.polls.map(p => [p.id, p.kind, p.anonymous, p.answers]), D.polls.map(p => [p.id, p.kind, p.anonymous, p.answers]));
});

test("Texte der Umfragen in beiden Sprachen", () => {
  for (const lang of ["de", "en"] as const) {
    const d = DICTS[lang];
    for (const k of ["um_title", "nvb_umfragen", "um_kind_quick", "um_kind_survey", "um_qtype_single", "um_qtype_multi", "um_qtype_scale", "um_qtype_text", "db_polls", "dp_polls",
      "err_polls_off", "err_poll_closed", "err_poll_answered", "err_invalid_answer", "err_open_polls"]) assert.ok(d[k], `${lang}: ${k}`);
  }
});
