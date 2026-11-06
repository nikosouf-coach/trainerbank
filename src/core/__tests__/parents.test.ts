// Tests: Eltern-Zugang – Code säubern und prüfen, minderjährig bzw. unter 16, Stand je Kind fürs Trainerteam
// (Verknüpfungen, Einladung, höchstens zwei), Elterninfo (gelesen, bestätigt, wer fehlt), Abmelden durch Eltern
// (Arten, Zeitraum, „krank“ nur mit Einwilligung), Termine des Kindes, offene Aufgaben, Demo, Texte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { createEngine } from "../engine";
import { DICTS } from "../i18n";
import { childAgenda, cleanInviteCode, cleanPost, DEMO_PARENT, guardianState, GUARDIAN_RELATIONS, inviteCodeOk, isMinor, isUnder16, MAX_GUARDIANS, parentAbsenceErrors, parentTodo, PARENT_ABS_TYPES, pendingGuardians, postStats } from "../parents";
import type { GuardianLink, ParentPost, Player, TeamData } from "../types";

const TODAY = "2026-11-06";
const P = (id: string, geb: string) => ({ id, vn: id, nn: "X", pos: "ZM", nr: null, geb } as Player);
const G = (id: string, pid: string, userId: string, x: Partial<GuardianLink> = {}): GuardianLink =>
  ({ id, pid, userId, name: "Eltern " + id, relation: "mother", status: "active", adultOk: false, at: "2026-10-01T10:00:00.000Z", confirmedAt: "2026-10-02T10:00:00.000Z", ...x });

test("Code: Groß-/Kleinschreibung, Leerzeichen und Striche egal; keine verwechselbaren Zeichen", () => {
  assert.equal(cleanInviteCode("abcde fghjk"), "ABCDE-FGHJK");
  assert.equal(cleanInviteCode(" AbCdE-fGhJk "), "ABCDE-FGHJK");
  assert.equal(cleanInviteCode("abc"), "ABC", "zu kurz bleibt, wie es ist");
  assert.equal(cleanInviteCode(null), "");
  assert.ok(inviteCodeOk("abcde-fghjk")); assert.ok(inviteCodeOk("23456 789AB"));
  assert.ok(!inviteCodeOk("ABCDE-FGHIK"), "I ist ausgeschlossen"); assert.ok(!inviteCodeOk("ABCD0-FGHJK"), "0 ist ausgeschlossen");
  assert.ok(!inviteCodeOk("ABCD-EFGH"), "Team-Code (acht Zeichen) ist kein Eltern-Code");
});

test("Minderjährig und unter 16 – nur mit Geburtsdatum", () => {
  assert.ok(isMinor(P("a", "2009-11-07"), TODAY), "einen Tag vor dem 18. Geburtstag");
  assert.ok(!isMinor(P("a", "2008-11-06"), TODAY), "am 18. Geburtstag volljährig");
  assert.ok(!isMinor(P("a", ""), TODAY), "ohne Geburtsdatum kein Eltern-Zugang");
  assert.ok(!isMinor(undefined, TODAY));
  assert.ok(isUnder16(P("a", "2010-11-07"), TODAY)); assert.ok(!isUnder16(P("a", "2010-11-06"), TODAY));
  assert.ok(!isUnder16(P("a", "2030-01-01"), TODAY), "Geburtsdatum in der Zukunft ist ungültig");
});

test("Stand je Kind: Verknüpfungen, gültige Einladung, höchstens zwei Elternteile", () => {
  const D = {
    players: [P("a", "2012-05-01"), P("b", "2008-01-01"), P("c", "")],
    guardians: [G("g1", "a", "u1"), G("g2", "a", "u2", { status: "pending", at: "2026-11-05T10:00:00.000Z" }), G("g3", "b", "u3", { adultOk: true })],
    guardianInvites: [{ pid: "a", expires: "2026-11-20T00:00:00.000Z", usesLeft: 0 }, { pid: "c", expires: "2026-11-01T00:00:00.000Z", usesLeft: 2 }],
  } as unknown as TeamData;
  const a = guardianState(D, "a", TODAY);
  assert.deepEqual([a.links.map(g => g.id), a.minor, a.birth, a.canInvite, a.pending, a.invite], [["g1", "g2"], true, true, false, 1, undefined],
    "zwei Elternteile (einer wartet) – keine weitere Einladung; verbrauchter Code zählt nicht");
  assert.equal(MAX_GUARDIANS, 2);
  const b = guardianState(D, "b", TODAY);
  assert.deepEqual([b.minor, b.canInvite], [false, false], "volljährig: keine Einladung");
  const c = guardianState(D, "c", TODAY);
  assert.deepEqual([c.birth, c.minor, c.canInvite, c.invite], [false, false, false, undefined], "ohne Geburtsdatum; abgelaufener Code zählt nicht");
  const one = guardianState({ ...D, guardians: [G("g1", "a", "u1")], guardianInvites: [{ pid: "a", expires: "2026-11-20T00:00:00.000Z", usesLeft: 1 }] } as unknown as TeamData, "a", TODAY);
  assert.deepEqual([one.canInvite, one.invite?.usesLeft], [true, 1]);
  assert.deepEqual(pendingGuardians(D).map(g => g.id), ["g2"]);
});

test("Elterninfo: gelesen, bestätigt, wer fehlt (nur bestätigte Eltern minderjähriger bzw. verlängerter Kinder)", () => {
  const post: ParentPost = { id: "x", title: "Elternabend", body: "Freitag", needAck: true, author: "N", at: "2026-11-05T18:00:00.000Z" };
  const D = {
    players: [P("a", "2012-05-01"), P("b", "2011-05-01"), P("c", "2008-01-01"), P("d", "2007-01-01")],
    guardians: [G("g1", "a", "u1"), G("g2", "a", "u2"), G("g3", "b", "u3"), G("g4", "b", "u4", { status: "pending" }), G("g5", "c", "u5", { adultOk: true }), G("g6", "d", "u6")],
    parentReads: [{ postId: "x", userId: "u1", readAt: "2026-11-05T19:00:00.000Z", ackedAt: "2026-11-05T19:00:00.000Z" },
      { postId: "x", userId: "u3", readAt: "2026-11-05T20:00:00.000Z", ackedAt: null },
      { postId: "x", userId: "u4", readAt: "2026-11-05T20:00:00.000Z", ackedAt: "2026-11-05T20:00:00.000Z" },
      { postId: "y", userId: "u2", readAt: "2026-11-05T20:00:00.000Z", ackedAt: "2026-11-05T20:00:00.000Z" }],
  } as unknown as TeamData;
  const k = postStats(D, post, TODAY);
  assert.deepEqual([k.total, k.read, k.acked], [4, 2, 1], "u1, u2, u3, u5 – ohne wartende (u4) und ohne volljährige ohne Verlängerung (u6)");
  assert.deepEqual(k.missing.map(g => g.id), ["g2", "g3", "g5"], "bestätigen fehlt");
  assert.deepEqual(postStats(D, { ...post, needAck: false }, TODAY).missing.map(g => g.id), ["g2", "g5"], "lesen fehlt");
  const x = cleanPost({ id: "z", title: "  Eltern\nabend  " + "x".repeat(200), body: "a  b \r\n\r\n\r\n\r\n c ", needAck: "ja" as never });
  assert.deepEqual([x.title.length, x.title.slice(0, 11), x.body, x.needAck, x.readAt, x.ackedAt], [120, "Eltern aben", "a b\n\nc", false, null, null]);
});

test("Abmelden durch Eltern: erlaubte Arten, Zeitraum, „krank“ nur mit Einwilligung", () => {
  assert.deepEqual(PARENT_ABS_TYPES, ["krank", "urlaub", "schule", "sonst"], "Verletzungen trägt das Trainerteam ein");
  const ok = (typ: string, von: string, bis: string | null, health = true) => parentAbsenceErrors({ typ: typ as never, von, bis }, TODAY, health);
  assert.deepEqual(ok("urlaub", "2026-11-10", "2026-11-14"), []);
  assert.deepEqual(ok("schule", "2026-10-30", null), [], "bis zu 7 Tage zurück, ohne Ende");
  assert.deepEqual(ok("sonst", "2026-10-29", null), ["from"], "nicht weiter zurück");
  assert.deepEqual(ok("sonst", "2027-11-07", null), ["from"], "höchstens ein Jahr im Voraus");
  assert.deepEqual(ok("sonst", "", null), ["from"]);
  assert.deepEqual(ok("urlaub", "2026-11-10", "2026-11-09"), ["to"]);
  assert.deepEqual(ok("urlaub", "2026-11-10", "2027-02-09"), ["to"], "höchstens 90 Tage");
  assert.deepEqual(ok("urlaub", "2026-11-10", "2027-02-08"), []);
  assert.deepEqual(ok("verletzung", "2026-11-10", null), ["type"]);
  assert.deepEqual(ok("krank", TODAY, null, false), ["consent"]);
  assert.deepEqual(ok("krank", TODAY, null, true), []);
  assert.deepEqual(GUARDIAN_RELATIONS, ["mother", "father", "guardian"]);
});

test("Demo: Eltern-Verknüpfungen, Anfrage, Einladung, Elterninfo; Termine und Aufgaben fürs Kind", () => {
  const NOW = new Date(2026, 10, 6, 10);
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW); demoExtras(D, "de", NOW);
  const mine = D.guardians.filter(g => g.userId === DEMO_PARENT);
  assert.equal(mine.length, 1, "der Demo-Elternteil ist mit einem Kind verknüpft");
  const kid = mine[0].pid;
  assert.ok(isMinor(D.players.find(p => p.id === kid), "2026-11-06"), "nur minderjährige Kinder");
  assert.equal(pendingGuardians(D).length, 1, "eine Anfrage wartet");
  assert.equal(D.guardianInvites.length, 1, "eine Einladung ist offen");
  assert.ok(D.guardians.every(g => isMinor(D.players.find(p => p.id === g.pid), "2026-11-06")));
  assert.equal(D.parentPosts.length, 2);
  const k = postStats(D, D.parentPosts[0], "2026-11-06");
  assert.deepEqual([k.total, k.acked], [2, 1], "zwei bestätigte Elternteile, einer hat bestätigt");
  const E = createEngine(D, { lang: "de" });
  const items = childAgenda(E, kid, 14);
  assert.ok(items.length > 0 && items.some(x => x.kind === "training"), "Training in den nächsten zwei Wochen");
  assert.ok(items.every((x, i) => !i || (items[i - 1].date + items[i - 1].time) <= (x.date + x.time)), "nach Datum und Uhrzeit");
  assert.ok(items.every(x => x.kind !== "training" || !E.matchOn(x.date)), "am Spieltag kein Training");
  const posts = D.parentPosts.map(p => ({ ...p, readAt: null, ackedAt: null }));
  const todo = parentTodo(E, kid, posts, { parental: false, health: false });
  assert.equal(todo.ack, 1, "eine Info mit Lesebestätigung"); assert.equal(todo.unread, 2);
  assert.equal(todo.total, todo.open + todo.ack + todo.consent);
});

test("Texte: Schlüssel in beiden Sprachen", () => {
  const keys = ["m_eltern", "md_eltern", "nvb_eltern", "el_menuSub", "demo_parent", "inv_parent", "el_title", "el_info", "el_none", "el_pending", "el_adult", "el_agenda", "el_match", "el_meet",
    "el_absTitle", "el_absSickHint", "el_absPrivacy", "el_absList", "el_absAway", "el_absByYou", "el_absByParent", "el_absByKid", "el_absByTeam", "el_posts", "el_ack", "el_acked", "el_consents", "el_cInfo",
    "el_cParental", "el_cParentalText", "el_c16", "el_c16Sick", "el_cHealth", "el_cHealthText", "el_absSickHint16", "el_absErr_consent16", "el_photo14", "el_photoKid", "el_photoForm", "el_photoJoint", "el_seeT", "el_see", "el_notSee",
    "el_leaveText", "el_linkTitle", "el_linkIntro", "el_linkOk", "el_linkAfter", "el_redeemed", "el_startTitle", "el_startDesc", "el_myTitle", "el_myMinor", "el_myAdult", "el_adultKeep",
    "el_coachTitle", "el_coachInfo", "el_reqWho", "el_reqHint", "el_kidsCount", "el_codeOnce", "el_codeDirect", "el_shareText", "el_seeCoach", "el_notSeeCoach", "el_statRead", "el_statAck",
    "el_missRead", "el_missAck", "el_postPrivacy", "el_parentView", "ph_meParents", "ph_meConfirm", "ph_confirmed",
    "el_joinHint", "el_photoRevoke", "el_ackHint", "el_photoWaitKid", "el_photoWaitYou", "el_offT", "el_off", "el_refresh", "err_module_off",
    "err_guardians_full", "err_own_player", "err_too_many_attempts", "err_birthdate_required", "err_not_minor", "err_not_linked", "err_invalid_dates", "err_invalid_type", "err_invalid",
    ...GUARDIAN_RELATIONS.map(k => "el_rel_" + k), ...["type", "from", "to", "consent"].map(k => "el_absErr_" + k), ...PARENT_ABS_TYPES.map(k => "ab_" + k)];
  for (const lang of ["de", "en"] as const) for (const k of keys) assert.ok(DICTS[lang][k], `${lang}: ${k}`);
  for (const lang of ["de", "en"] as const) assert.match(String(DICTS[lang].el_shareText), /\{c\}[\s\S]*\{l\}[\s\S]*\{d\}/, `${lang}: Code, Link und Ablauf im Text`);
  // Anrede: Texte an Eltern mit „Sie“ (wie Datenschutzerklärung und Einwilligungstexte), an Spieler mit „du“
  for (const k of ["el_info", "el_none", "el_pending", "el_off", "el_noHint", "el_absSickHint", "el_cInfo", "el_cParentalText", "el_c16", "el_photo14", "el_photoKid", "el_photoForm",
    "el_see", "el_notSee", "el_leaveText", "el_linkIntro", "el_yourNameHint", "el_errName", "el_errRel", "el_errOk", "el_photoRevoke"])
    assert.doesNotMatch(String(DICTS.de[k]), /\b(du|dein|deine|deinen|deinem|deiner|deines|dir|dich)\b/i, `de: ${k} siezt Eltern`);
  for (const k of ["el_myMinor", "el_myAdult", "ph_meParents", "el_joinHint"]) assert.match(String(DICTS.de[k]), /\b(du|dein|deine|deinen|deinem|deiner)\b/i, `de: ${k} duzt Spieler`);
});
