// Tests: Karten und Sperren – Regeln (Voreinstellung je Altersklasse, Grenzen), abgeleitete Sperren (Gelbsperre je
// Saison nur in Meisterschaftsspielen, Gelb-Rot, Rot bis zum Urteil), Stand einer Sperre (Spiele nach dem Auslöser,
// verbüßt, bis, aufgehoben), eingetragene ersetzen abgeleitete, Gelb-Warnung, Demo, Spielbericht, Texte.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeSuspensions, allSuspensions, cardRules, cardTally, cleanCardRules, cleanSuspension, countsFor, defaultCardRules, derivedSuspensions,
  pastSuspensions, suspState, suspendedFor, suspendedIn, withCard, yellowWarnings,
} from "../cards";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS } from "../i18n";
import type { CardKind, CardRules, Match, MatchStat, Suspension, TeamData } from "../types";

const SEN: CardRules = { yellowLimit: 5, yellowGames: 1, yrGames: 1, redGames: 2 };
const YOUTH: CardRules = { yellowLimit: 0, yellowGames: 1, yrGames: 0, redGames: null };
/** Spielplan: wöchentlich ab 6.9.2026 (Meisterschaft), dazu zwei Pokalspiele und ein Freundschaftsspiel */
function season(): TeamData {
  const matches: Match[] = [];
  for (let i = 0; i < 12; i++) { const d = new Date(2026, 8, 6 + 7 * i); matches.push({ id: "m" + i, date: iso(d), zeit: "15:00", gegner: "G" + i, heim: i % 2 === 0, comp: "liga" }); }
  matches.push({ id: "c1", date: "2026-09-16", zeit: "19:30", gegner: "Pokal 1", heim: true, comp: "pokal" });
  matches.push({ id: "c2", date: "2026-10-07", zeit: "19:30", gegner: "Pokal 2", heim: false, comp: "pokal" });
  matches.push({ id: "t1", date: "2026-09-23", zeit: "19:00", gegner: "Test", heim: true, comp: "test" });
  return { matches, stats: {}, suspensions: [] } as unknown as TeamData;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const card = (D: TeamData, mid: string, pid: string, c: CardKind, min = 90) => { (D.stats[mid] ||= {})[pid] = { min, goals: 0, assists: 0, start: true, card: c }; };

test("Regeln: Voreinstellung nach Altersklasse, Grenzen, „bis zum Urteil“", () => {
  assert.deepEqual(defaultCardRules("sen"), SEN);
  assert.deepEqual(defaultCardRules("u19"), YOUTH);
  assert.deepEqual(cleanCardRules(undefined, "u19"), YOUTH);
  assert.deepEqual(cleanCardRules({ yellowLimit: 99, yellowGames: 0, yrGames: -1, redGames: 50 }, "sen"), { yellowLimit: 15, yellowGames: 1, yrGames: 0, redGames: 30 });
  assert.deepEqual(cleanCardRules({ yellowLimit: "5", redGames: null }, "sen"), { ...SEN, redGames: null });
  assert.deepEqual(cleanCardRules({ yellowLimit: 0 }, "sen"), { ...SEN, yellowLimit: 0 }, "Gelbsperre ausschalten");
  assert.deepEqual(cardRules({ cls: "u17", settings: { cards: { yellowLimit: 5 } } } as never), { ...YOUTH, yellowLimit: 5 });
  assert.ok(countsFor("league", { comp: "liga" }) && !countsFor("league", { comp: "pokal" }) && countsFor("all", { comp: "pokal" }) && !countsFor("all", { comp: "test" }));
});

test("Sperre bereinigen: Spiele oder bis oder offen, Bereich, Hinweis", () => {
  const b = { id: "s", pid: "p", start: "2026-10-01" };
  assert.deepEqual(cleanSuspension({ ...b, kind: "red", games: "3", scope: "x", note: " Urteil\n Sportgericht " }), { ...b, kind: "red", matchId: null, games: 3, until: null, scope: "all", note: "Urteil Sportgericht" });
  assert.equal(cleanSuspension({ ...b, kind: "x", games: 3, until: "2026-11-30" }).games, null, "bis schlägt Spiele");
  assert.equal(cleanSuspension({ ...b, until: "2026-09-01" }).until, null, "bis nicht vor dem Beginn");
  assert.equal(cleanSuspension({ ...b, games: 99 }).games, 30); assert.equal(cleanSuspension({ ...b, games: null }).games, null);
  assert.equal(cleanSuspension({ ...b, kind: "x" }).kind, "other"); assert.equal(cleanSuspension({ ...b, scope: "league" }).scope, "league");
});

test("Gelbsperre: jede fünfte Gelbe in Meisterschaftsspielen der Saison, Pokal und Gelb-Rot zählen nicht", () => {
  const D = season();
  ["m0", "m1", "m2"].forEach(m => card(D, m, "a", "y"));
  card(D, "c1", "a", "y"); card(D, "t1", "a", "y"); card(D, "m3", "a", "yr");
  assert.equal(derivedSuspensions(D, SEN).filter(s => s.kind === "yellow").length, 0, "drei Gelbe in der Liga");
  assert.deepEqual(yellowWarnings(D, SEN, "2026-10-01"), [], "drei: noch keine Warnung");
  card(D, "m4", "a", "y");
  assert.deepEqual(yellowWarnings(D, SEN, "2026-10-08"), [{ pid: "a", count: 4 }], "vier: Warnung");
  card(D, "m5", "a", "y");
  const y = derivedSuspensions(D, SEN).filter(s => s.kind === "yellow");
  assert.equal(y.length, 1); assert.equal(y[0].matchId, "m5"); assert.equal(y[0].scope, "league"); assert.equal(y[0].games, 1);
  const st = suspState(D, y[0], "2026-10-12");
  assert.deepEqual(st.covered.map(m => m.id), ["m6"], "nächstes Meisterschaftsspiel"); assert.equal(st.left, 1); assert.ok(st.active);
  assert.equal(suspState(D, y[0], "2026-10-19").left, 0, "Tag vorbei: verbüßt");
  assert.deepEqual(cardTally(D, "a", "2026-10-12"), { y: 7, yLeague: 5, yr: 1, r: 0 });
  assert.equal(derivedSuspensions(D, { ...SEN, yellowLimit: 0 }).filter(s => s.kind === "yellow").length, 0, "ausgeschaltet");
  // neue Saison: Zählung beginnt von vorn
  D.matches.push({ id: "n1", date: "2027-08-01", zeit: "15:00", gegner: "N", heim: true, comp: "liga" });
  ["m6", "m7", "m8", "m9"].forEach(m => card(D, m, "a", "y"));
  card(D, "n1", "a", "y");
  assert.equal(derivedSuspensions(D, SEN).filter(s => s.kind === "yellow").length, 1, "4 + 1 über die Saisongrenze: keine zweite Sperre");
});

test("Gelb-Rot und Rot: nach den Regeln, Rot bis zum Urteil, alle Pflichtspiele", () => {
  const D = season();
  card(D, "m1", "b", "yr"); card(D, "m1", "c", "r");
  assert.deepEqual(derivedSuspensions(D, YOUTH).map(s => s.kind), ["red"], "Jugend: Gelb-Rot ohne Folgesperre");
  const yr = derivedSuspensions(D, SEN).find(s => s.kind === "yellow_red")!;
  assert.deepEqual(suspState(D, yr, "2026-09-14").covered.map(m => m.id), ["c1"], "nächstes Pflichtspiel ist das Pokalspiel");
  const red = derivedSuspensions(D, YOUTH).find(s => s.kind === "red")!;
  const st = suspState(D, red, "2026-12-31");
  assert.ok(st.pending && st.active && st.left === null, "bis zum Urteil gilt sie weiter");
  assert.ok(!st.covered.some(m => m.id === "t1") && st.covered[0].id === "c1" && st.covered.length === 12, "alle Pflichtspiele danach, kein Freundschaftsspiel");
  const sen = suspState(D, derivedSuspensions(D, SEN).find(s => s.kind === "red")!, "2026-09-19");
  assert.deepEqual(sen.covered.map(m => m.id), ["c1", "m2"]); assert.equal(sen.left, 1, "Pokal verbüßt, ein Spiel offen");
});

test("Eingetragene Sperren: Urteil ersetzt die abgeleitete, aufgehoben, bis, sonstige", () => {
  const D = season();
  card(D, "m2", "c", "r");
  const verdict: Suspension = { id: "v", pid: "c", kind: "red", matchId: "m2", start: "2026-09-20", games: 3, until: null, scope: "all", note: "Urteil" };
  D.suspensions = [verdict];
  const all = allSuspensions(D, YOUTH);
  assert.deepEqual(all.map(s => s.id), ["v"], "Urteil statt „bis zum Urteil“");
  assert.deepEqual(suspState(D, verdict, "2026-09-21").covered.map(m => m.id), ["m3", "m4", "c2"]);
  D.suspensions = [{ ...verdict, games: 0 }];
  assert.ok(!activeSuspensions(D, YOUTH, "2026-09-21").length, "aufgehoben");
  assert.equal(pastSuspensions(D, YOUTH, "2026-09-21").length, 1, "steht in der Saison als erledigt");
  D.stats = {};
  D.suspensions = [{ id: "z", pid: "d", kind: "other", matchId: null, start: "2026-10-01", games: null, until: "2026-10-31", scope: "all", note: "Vereinssperre" }];
  const z = suspState(D, D.suspensions[0], "2026-10-15");
  assert.deepEqual(z.covered.map(m => m.id), ["m4", "c2", "m5", "m6", "m7"], "Spiele ab dem Beginn bis einschließlich zum Ende");
  assert.ok(z.active && !suspState(D, D.suspensions[0], "2026-11-01").active, "endet nach dem letzten Tag");
  assert.deepEqual(suspendedFor(D, YOUTH, "d", "m5", "2026-10-15").map(x => x.s.id), ["z"]);
  assert.deepEqual([...suspendedIn(D, YOUTH, "m5", "2026-10-15").keys()], ["d"]);
  assert.equal(suspendedFor(D, YOUTH, "d", "m8", "2026-10-15").length, 0);
});

test("Spielbericht: Karte setzen, Werte bleiben, ohne alles gelöscht", () => {
  const st: MatchStat = { min: 70, goals: 1, assists: 0, start: true, pre: 0 };
  assert.deepEqual(withCard(st, "y"), { ...st, card: "y" });
  assert.deepEqual(withCard(undefined, "r"), { min: 0, goals: 0, assists: 0, start: false, card: "r" }, "Bank: nur Karte");
  assert.equal(withCard({ min: 0, goals: 0, assists: 0, start: false, card: "y" }, null), null);
  assert.equal(withCard(undefined, null), null);
});

test("Demo (U19): Rot bis zum Urteil, Urteil mit einem offenen Spiel, Gelb-Warnung erst mit Gelbsperre", () => {
  const NOW = new Date(2026, 10, 5, 10, 0), TODAY = "2026-11-05";
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW);
  const rules = cardRules(D.team), next = D.matches.filter(m => m.date >= TODAY && !m.result && m.comp !== "test").sort((a, b) => (a.date + a.zeit < b.date + b.zeit ? -1 : 1))[0];
  assert.deepEqual(rules, YOUTH);
  const sus = suspendedIn(D, rules, next.id, TODAY), verdict = D.suspensions[0];
  const redPid = Object.values(D.stats).flatMap(m => Object.entries(m)).filter(([, x]) => x.card === "r").map(([pid]) => pid).find(pid => pid !== verdict.pid)!;
  const yrPid = Object.values(D.stats).flatMap(m => Object.entries(m)).find(([, x]) => x.card === "yr")![0];
  assert.ok(sus.get(redPid)?.pending, "Rot im letzten Spiel: Urteil offen");
  assert.equal(verdict.games, 3); assert.equal(sus.get(verdict.pid)?.left, 1, "Urteil 3 Spiele, eines offen");
  assert.ok(!sus.has(yrPid), "Gelb-Rot in der Jugend ohne Sperre");
  assert.deepEqual(yellowWarnings(D, rules, TODAY), [], "ohne Gelbsperre keine Warnung");
  const warn = yellowWarnings(D, { ...rules, yellowLimit: 5 }, TODAY);
  assert.equal(warn.length, 1, "mit Gelbsperre: einer mit vier Gelben"); assert.equal(warn[0].count, 4);
  assert.ok(suspendedIn(D, { ...rules, yrGames: 1 }, next.id, TODAY).has(yrPid), "mit Sperre nach Gelb-Rot");
});

test("Texte: Schlüssel in beiden Sprachen", () => {
  for (const lang of ["de", "en"] as const) for (const k of ["m_karten", "md_karten", "kr_title", "kr_y", "kr_yr", "kr_r", "kr_kind_yellow", "kr_kind_yellow_red", "kr_kind_red", "kr_kind_other", "md_suspended", "nm_suspended"])
    assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});
