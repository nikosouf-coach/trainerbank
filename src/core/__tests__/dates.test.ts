// Tests: Uhrzeit eintippen (Feld mit festem Doppelpunkt) – Ziffern, Sprung zu den Minuten, eingefügte Zeiten, Ergänzen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { completeTime, splitTime, timeParts, typeHours, typeMinutes } from "../dates";

test("Uhrzeit: Teile und ganze Zeiten (getippt oder eingefügt)", () => {
  assert.deepEqual(timeParts("19:30"), ["19", "30"]);
  assert.deepEqual(timeParts("7:05"), ["07", "05"]);
  assert.deepEqual(timeParts(""), ["", ""]);
  assert.deepEqual(timeParts("19"), ["", ""]);
  assert.deepEqual(splitTime("19:30"), ["19", "30"]);
  assert.deepEqual(splitTime("7.30"), ["7", "30"]);
  assert.deepEqual(splitTime("19 30"), ["19", "30"]);
  assert.deepEqual(splitTime("19h30"), ["19", "30"]);
  assert.deepEqual(splitTime("1930"), ["19", "30"]);
  assert.deepEqual(splitTime("730"), ["7", "30"], "73 ist keine Stunde");
  assert.deepEqual(splitTime("193"), ["19", "3"]);
  assert.deepEqual(splitTime("1:"), ["1", ""]);
  assert.equal(splitTime("19"), null, "zwei Ziffern sind nur die Stunde");
  assert.equal(splitTime("abc"), null);
});

test("Uhrzeit: Stundenfeld – warten, fertig, neu beginnen, aufteilen", () => {
  assert.deepEqual(typeHours("", "30"), { h: "", m: "30", next: false });
  assert.deepEqual(typeHours("1", "30"), { h: "1", m: "30", next: false }, "1 kann 1x werden");
  assert.deepEqual(typeHours("2", ""), { h: "2", m: "", next: false });
  assert.deepEqual(typeHours("7", "30"), { h: "07", m: "30", next: true }, "3–9: fertig");
  assert.deepEqual(typeHours("19", "30"), { h: "19", m: "30", next: true });
  assert.deepEqual(typeHours("23", ""), { h: "23", m: "", next: true });
  assert.deepEqual(typeHours("25", "30"), { h: "05", m: "30", next: true }, "ungültig: mit der 5 neu");
  assert.deepEqual(typeHours("31", "30"), { h: "1", m: "30", next: false }, "ungültig: mit der 1 neu, wartet");
  assert.deepEqual(typeHours("x1", "30"), { h: "1", m: "30", next: false }, "Buchstaben zählen nicht");
  assert.deepEqual(typeHours("1930", ""), { h: "19", m: "30", next: false }, "ganze Zeit");
  assert.deepEqual(typeHours("19:", "30"), { h: "19", m: "", next: true }, "Doppelpunkt getippt: weiter zu den Minuten");
  assert.deepEqual(typeHours("6:5", ""), { h: "06", m: "5", next: true }, "5 kann 5x werden: wartet");
  assert.deepEqual(typeHours("6:7", ""), { h: "06", m: "07", next: false });
  assert.deepEqual(typeHours("19:3", ""), { h: "19", m: "3", next: true });
  assert.deepEqual(typeHours("19:75", ""), { h: "19", m: "", next: true }, "ungültige Minuten fallen weg");
  assert.equal(typeHours("25:30", ""), null, "ungültige Stunde: verwerfen");
});

test("Uhrzeit: Minutenfeld und Ergänzen beim Verlassen", () => {
  assert.deepEqual(typeMinutes("3", "19"), { h: "19", m: "3", next: false });
  assert.deepEqual(typeMinutes("7", "19"), { h: "19", m: "07", next: false }, "6–9: fertig");
  assert.deepEqual(typeMinutes("30", "19"), { h: "19", m: "30", next: false });
  assert.deepEqual(typeMinutes("304", "19"), { h: "19", m: "4", next: false }, "volles Feld: neu mit der 4");
  assert.deepEqual(typeMinutes("309", "19"), { h: "19", m: "09", next: false });
  assert.deepEqual(typeMinutes("", "19"), { h: "19", m: "", next: false });
  assert.deepEqual(typeMinutes(":", "19"), { h: "19", m: "", next: false });
  assert.deepEqual(typeMinutes("20:45", "19"), { h: "20", m: "45", next: false }, "ganze Zeit eingefügt");
  assert.equal(completeTime("19", ""), "19:00");
  assert.equal(completeTime("7", ""), "07:00");
  assert.equal(completeTime("19", "3"), "19:03");
  assert.equal(completeTime("23", "59"), "23:59");
  assert.equal(completeTime("", "30"), null, "ohne Stunde");
  assert.equal(completeTime("24", "00"), null);
});
