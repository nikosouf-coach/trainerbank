// Tests: Verein – Standardrechte (wie in der Datenbank), Kennzahlen je Team, Summen, Ziele für Hochziehen/Wechsel, Demo-Verein.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLUB_PERMS, CLUB_ROLES, canCopyHealth, cleanClubPerms, clubTotals, isClubAdmin, isOfficial, moveTargets, seasonOf, teamSummary } from "../club";
import { addDays, iso } from "../dates";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DEMO_CLUB, demoClubClasses, demoClubStaff, demoClubTeam, demoClubTeamId } from "../demoClub";
import type { TeamData } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0), TODAY = iso(NOW);
const own = (): TeamData => { const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };

test("Standardrechte je Funktion stimmen mit public.club_default_perms überein und enthalten keine Gesundheitsdaten", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261008000025_verein.sql"), "utf8");
  for (const r of CLUB_ROLES) {
    const m = sql.match(new RegExp(`when '${r}'\\s+then array\\[([^\\]]*)\\]`));
    assert.ok(m, r);
    const db = (m![1].match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, ""));
    assert.deepEqual([...db].sort(), [...CLUB_PERMS[r]].sort(), r);
    assert.ok(!CLUB_PERMS[r].includes("health") && !CLUB_PERMS[r].includes("medical"), r);
  }
  assert.deepEqual(cleanClubPerms(["squad", "x", "health", "plan", "squad"]), ["health", "plan", "squad"]);
  assert.ok(isOfficial({ role: "nlz" }) && !isOfficial({ role: "team" }) && !isOfficial({ role: "pending" }) && !isOfficial(null));
  assert.ok(isClubAdmin({ role: "admin" }) && !isClubAdmin({ role: "leiter" }));
});

test("Saisonbeginn: 1. Juli (vor Juli zählt die Vorsaison)", () => {
  assert.equal(seasonOf("2026-10-07"), "2026-07-01");
  assert.equal(seasonOf("2026-06-30"), "2025-07-01");
  assert.equal(seasonOf("2026-07-01"), "2026-07-01");
});

test("Kennzahlen je Team: Spieler, nächstes/letztes Spiel, Bilanz der Saison, Ausfälle nur mit Recht „Kader“", () => {
  const D = own();
  const x = teamSummary(D, NOW, { squad: true, plan: true });
  assert.equal(x.players, D.players.length);
  assert.equal(x.coach, D.staff.find(s => s.role === "chef")!.name);
  const next = [...D.matches].filter(m => m.date >= TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  assert.equal(x.next?.date, next.date); assert.equal(x.next?.opp, next.gegner); assert.equal(x.next?.home, next.heim);
  const played = D.matches.filter(m => m.date <= TODAY && m.result).sort((a, b) => a.date < b.date ? -1 : 1);
  const last = played[played.length - 1];
  assert.deepEqual(x.last, { date: last.date, opp: last.gegner, own: last.result!.own, against: last.result!.opp });
  const season = played.filter(m => m.date >= seasonOf(TODAY));
  assert.equal(x.won + x.drawn + x.lost, season.length);
  assert.equal(x.goalsFor, season.reduce((a, m) => a + m.result!.own, 0));
  // Demo: eine laufende Verletzung (p15), eine Krankmeldung (p8), Schule/Arbeit (p19) – Urlaub erst ab übermorgen
  assert.equal(x.injured, 1); assert.equal(x.sick, 1); assert.equal(x.absent, 1);
  assert.ok(x.attRate != null && x.attRate > 0.5 && x.attRate <= 1);
  assert.equal(x.sessions28, D.sessions.filter(s => s.typ === "Training" && s.date > addDays(TODAY, -28) && s.date <= TODAY).length);
  // Matchplan zum nächsten Spiel (Demo: Entwurf oder Freigabe) – ohne Recht null
  assert.ok(x.planState !== null);
  const y = teamSummary(D, NOW, { squad: false, plan: false });
  assert.equal(y.injured, null); assert.equal(y.sick, null); assert.equal(y.absent, null); assert.equal(y.attRate, null); assert.equal(y.planState, null);
  assert.equal(y.players, x.players);
  // inaktive Spieler zählen nicht, auch nicht bei Ausfällen
  D.players = D.players.filter(p => p.id !== "p15");
  assert.equal(teamSummary(D, NOW, { squad: true, plan: true }).injured, 0);
});

test("Summen der Vereinsübersicht: Verletzte nur aus Teams mit Recht, Spiele in den nächsten 7 Tagen", () => {
  const D = own(), a = teamSummary(D, NOW, { squad: true, plan: true }), b = { ...teamSummary(D, NOW, { squad: false, plan: false }), teamId: "t2" };
  const far = { ...a, teamId: "t3", next: a.next ? { ...a.next, date: addDays(TODAY, 9) } : null };
  const tot = clubTotals([a, b, far], TODAY);
  assert.equal(tot.teams, 3); assert.equal(tot.players, 3 * a.players);
  assert.equal(tot.injured, 2 * (a.injured || 0));
  assert.equal(tot.matches7, (a.next && a.next.date <= addDays(TODAY, 6) ? 1 : 0) * 2);
  assert.equal(clubTotals([b], TODAY).injured, null);
});

test("Ziele für Hochziehen/Wechsel: gleicher Verein oder beide eigene Teams, nur mit Recht „Kader“; Belastung nur mit „Gesundheitsdaten“ in beiden", () => {
  const ms = [
    { teamId: "a", club: "SG", name: "U19", role: "owner", clubId: "c1" },
    { teamId: "b", club: "SG", name: "U17", role: "coach", perms: ["plan", "squad"], clubId: "c1", viaClub: true },
    { teamId: "c", club: "SG", name: "U15", role: "coach", perms: ["plan"], clubId: "c1", viaClub: true },
    { teamId: "d", club: "FC", name: "U19", role: "coach", perms: null, clubId: "c2" },
    { teamId: "e", club: "SG", name: "Damen", role: "owner", clubId: null },
    { teamId: "f", club: "SG", name: "U13", role: "player", clubId: "c1" },
  ];
  assert.deepEqual(moveTargets(ms, { teamId: "a", role: "owner", clubId: "c1" }).map(x => x.teamId), ["b", "e"]);
  // ohne Verein: nur zwischen eigenen Teams
  assert.deepEqual(moveTargets(ms, { teamId: "e", role: "owner", clubId: null }).map(x => x.teamId), ["a"]);
  // Funktionär (Zugriff über den Verein): nur Teams desselben Vereins
  assert.deepEqual(moveTargets(ms, { teamId: "b", role: "coach", clubId: "c1" }).map(x => x.teamId), ["a"]);
  assert.ok(canCopyHealth({ role: "owner" }, { role: "coach", perms: null }));
  assert.ok(!canCopyHealth({ role: "owner" }, { role: "coach", perms: ["plan", "squad"] }));
  assert.ok(!canCopyHealth({ role: "coach", perms: ["squad"] }, { role: "owner" }));
});

test("Demo-Verein: drei weitere Teams mit eigenen Namen, Trainern und Spielplan; Konto als Funktionär im Chat", () => {
  assert.deepEqual(demoClubClasses("u19"), ["sen", "u17", "u15"]);
  assert.deepEqual(demoClubClasses("sen"), ["u19", "u17", "u15"]);
  const base = own(), me = { id: "demo-user", name: "Demo-Trainer" };
  const T = demoClubTeam(base.team, "u17", 1, "de", NOW, me);
  assert.equal(T.team.id, demoClubTeamId(1)); assert.equal(T.team.clubId, DEMO_CLUB); assert.equal(T.team.cls, "u17");
  const names = new Set(base.players.map(p => p.vn + " " + p.nn));
  assert.ok(T.players.every(p => !names.has(p.vn + " " + p.nn)), "keine Namensgleichheit mit dem eigenen Team");
  assert.equal(new Set(T.players.map(p => p.vn + " " + p.nn)).size, T.players.length, "Namen eindeutig");
  assert.ok(T.staff.every(s => !base.staff.some(b => b.name === s.name)), "eigenes Trainerteam");
  assert.ok(T.matches.some(m => m.result), "Ergebnisse");
  assert.equal(T.team.settings.spieltag, 6, "Jugend spielt samstags");
  assert.ok(T.chatPeople.some(p => p.uid === me.id && p.kind === "staff"));
  // deterministisch
  const T2 = demoClubTeam(base.team, "u17", 1, "de", NOW, me);
  assert.deepEqual(T2.players.map(p => p.vn + p.nn), T.players.map(p => p.vn + p.nn));
  const st = demoClubStaff(me, "de", ["demo-t3"]);
  assert.equal(st[0].role, "admin"); assert.deepEqual(st[0].perms, CLUB_PERMS.admin);
  assert.ok(st.some(x => x.role === "pending"));
  assert.deepEqual(st.find(x => x.role === "nlz")?.teams, ["demo-t3"]);
});
