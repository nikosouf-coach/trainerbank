// Tests: Geburtstage – gültiges Geburtsdatum, nächster Geburtstag mit Alter (über den Jahreswechsel, 29.02.),
// Liste und die nächsten Tage, Kalendertag, fehlende Geburtsdaten, Demo, Texte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageAt, birthdayIn, birthdayList, birthdaysOn, missingBirthdays, nextBirthday, upcomingBirthdays, validBirth } from "../birthdays";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS } from "../i18n";
import type { Player, TeamData } from "../types";

const pl = (id: string, geb: string, active = true): Player => ({ id, vn: "V" + id, nn: "N" + id, pos: "ZM", nr: null, geb, active } as Player);

test("Geburtsdatum: Format, echter Tag, nicht in der Zukunft", () => {
  assert.ok(validBirth("2008-03-12", "2026-11-06"));
  assert.ok(validBirth("2008-02-29", "2026-11-06"));
  for (const x of ["", "2007-02-29", "2008-13-01", "2008-04-31", "12.03.2008", "2027-01-01", "1899-12-31"]) assert.ok(!validBirth(x, "2026-11-06"), x);
  assert.ok(!validBirth(null, "2026-11-06")); assert.ok(!validBirth(undefined, "2026-11-06"));
});

test("Nächster Geburtstag: heute, später im Jahr, im nächsten Jahr, 29.02.", () => {
  assert.deepEqual(nextBirthday(pl("a", "2008-11-06"), "2026-11-06"), { pid: "a", date: "2026-11-06", age: 18, days: 0 });
  assert.deepEqual(nextBirthday(pl("b", "2009-11-09"), "2026-11-06"), { pid: "b", date: "2026-11-09", age: 17, days: 3 });
  assert.deepEqual(nextBirthday(pl("c", "2008-01-02"), "2026-12-30"), { pid: "c", date: "2027-01-02", age: 19, days: 3 });
  assert.equal(birthdayIn("2008-02-29", 2027), "2027-02-28"); assert.equal(birthdayIn("2008-02-29", 2028), "2028-02-29");
  assert.deepEqual(nextBirthday(pl("d", "2008-02-29"), "2027-02-28"), { pid: "d", date: "2027-02-28", age: 19, days: 0 });
  assert.equal(ageAt("2008-02-29", "2027-02-27"), 18); assert.equal(ageAt("2008-02-29", "2027-02-28"), 19);
  assert.equal(ageAt("2008-11-06", "2026-11-05"), 17); assert.equal(ageAt("2008-11-06", "2026-11-06"), 18);
  assert.equal(nextBirthday(pl("e", ""), "2026-11-06"), null);
});

test("Liste, die nächsten Tage, Kalendertag, fehlende Geburtsdaten (nur aktive Spieler)", () => {
  const D = { players: [pl("a", "2008-11-20"), pl("b", "2009-11-06"), pl("c", "2008-11-06", false), pl("d", ""), pl("e", "2008-03-01"), pl("f", "2009-11-08")] } as TeamData;
  assert.deepEqual(birthdayList(D, "2026-11-06").map(b => b.pid), ["b", "f", "a", "e"]);
  assert.deepEqual(upcomingBirthdays(D, "2026-11-06", 7).map(b => [b.pid, b.days, b.age]), [["b", 0, 17], ["f", 2, 17]]);
  assert.deepEqual(upcomingBirthdays(D, "2026-11-06", 0).map(b => b.pid), ["b"]);
  assert.deepEqual(birthdaysOn(D, "2026-11-08"), [{ pid: "f", age: 17 }]);
  assert.deepEqual(birthdaysOn(D, "2009-11-08"), [], "am Tag der Geburt kein Geburtstag");
  assert.deepEqual(missingBirthdays(D, "2026-11-06"), ["d"]);
});

test("Demo: heute ein Geburtstag, in drei Tagen einer – Alter in der Altersklasse", () => {
  const NOW = new Date(2026, 10, 6, 10), TODAY = "2026-11-06";
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW);
  const L = upcomingBirthdays(D, TODAY, 7);
  assert.ok(L.some(b => b.pid === "p4" && b.days === 0) && L.some(b => b.pid === "p11" && b.days === 3), JSON.stringify(L));
  assert.ok(L.every(b => b.age >= 16 && b.age <= 20));
});

test("Texte: Schlüssel in beiden Sprachen", () => {
  for (const lang of ["de", "en"] as const) for (const k of ["m_geburtstage", "md_geburtstage", "gb_title", "gb_menuSub", "nvb_geburtstage", "db_birthdays", "gb_today", "gb_tomorrow", "gb_turns", "gb_congrats", "gb_all",
    "gb_chatDraft", "gb_sub", "gb_none", "gb_info", "gb_missing", "gb_missingHint", "gb_happy", "gb_happySub", "gb_modOff"])
    assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});
