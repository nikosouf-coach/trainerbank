// Tests: Notfallkontakte – Telefonnummern, Bereinigung, Prüfung im Formular, fehlende Kontakte, Demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS } from "../i18n";
import { EM_LIMITS, EM_RELS, checkContacts, cleanContact, cleanContacts, cleanMed, cleanPhone, hasEmergency, missingEmergency, needsEmergency, phoneOk, remindable, telHref } from "../emergency";
import type { TeamData } from "../types";

const NOW = new Date(2026, 10, 5, 10, 0);
const setup = (): TeamData => { const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };

test("Telefonnummern: aufräumen, prüfen, Link zum Anrufen", () => {
  assert.equal(cleanPhone(" 0171 / 234 56-78 "), "0171 / 234 56-78");
  assert.equal(cleanPhone("0049 171 2345678"), "+49 171 2345678", "00 am Anfang wird +");
  assert.equal(cleanPhone("Tel.: 0201-123456 (Büro)"), "0201-123456", "Text und leere Klammern fallen weg");
  assert.equal(cleanPhone("1".repeat(40)).length, EM_LIMITS.phone);
  assert.ok(phoneOk("+49 171 2345678")); assert.ok(phoneOk("0201 / 12 34 56")); assert.ok(phoneOk("(0201) 123456"));
  assert.ok(!phoneOk("12345"), "zu wenige Ziffern"); assert.ok(!phoneOk("0171+234567"), "+ nur am Anfang");
  assert.ok(!phoneOk("abc123456")); assert.ok(!phoneOk("")); assert.ok(!phoneOk("1".repeat(21)), "höchstens 20 Ziffern");
  assert.equal(telHref("+49 (171) 234-5678"), "tel:+491712345678");
});

test("Kontakte bereinigen: Name und gültige Nummer nötig, höchstens zwei, keine Nummer doppelt", () => {
  assert.deepEqual(cleanContact({ name: "  Sabine   Muster ", rel: "mother", phone: "0171 2345678" }), { name: "Sabine Muster", rel: "mother", phone: "0171 2345678" });
  assert.equal(cleanContact({ name: "", rel: "mother", phone: "0171 2345678" }), null);
  assert.equal(cleanContact({ name: "Max", rel: "father", phone: "123" }), null);
  assert.equal(cleanContact({ name: "Oma", rel: "kaputt" as never, phone: "0201 123456" })!.rel, "other");
  const L = cleanContacts([
    { name: "A", rel: "mother", phone: "0171 111111" }, { name: "B", rel: "father", phone: "0171-111111" }, null,
    { name: "C", rel: "guardian", phone: "0172 222222" }, { name: "D", rel: "other", phone: "0173 333333" },
  ]);
  assert.deepEqual(L.map(c => c.name), ["A", "C"], "gleiche Nummer zählt einmal, höchstens zwei");
  assert.deepEqual(cleanContacts("kaputt"), []);
  assert.equal(EM_RELS.length, 7);
  assert.equal(cleanMed("  Asthma\r\n\r\n\r\nSpray in der Tasche  "), "Asthma\n\nSpray in der Tasche");
  assert.equal(cleanMed("x".repeat(900)).length, EM_LIMITS.med);
});

test("Formular prüfen: mindestens ein Kontakt, angefangene Kontakte vollständig, keine doppelte Nummer", () => {
  assert.deepEqual(checkContacts([{ name: "", rel: "mother", phone: "" }]), { error: "nf_errNone", n: 1 });
  assert.deepEqual(checkContacts([{ name: "Sabine", rel: "mother", phone: "" }]), { error: "nf_errPhone", n: 1 });
  assert.deepEqual(checkContacts([{ name: "", rel: "mother", phone: "0171 2345678" }]), { error: "nf_errName", n: 1 });
  assert.deepEqual(checkContacts([{ name: "Sabine", rel: "mother", phone: "0171 2345678" }, { name: "Thomas", rel: "father", phone: "12" }]), { error: "nf_errPhone", n: 2 });
  assert.deepEqual(checkContacts([{ name: "Sabine", rel: "mother", phone: "0171 2345678" }, { name: "Thomas", rel: "father", phone: "0171-2345678" }]), { error: "nf_errSame", n: 2 });
  const ok = checkContacts([{ name: "", rel: "mother", phone: "" }, { name: " Thomas ", rel: "father", phone: "0172 9876543" }]);
  assert.deepEqual(ok, { contacts: [{ name: "Thomas", rel: "father", phone: "0172 9876543" }] }, "leerer erster Block zählt nicht");
  for (const lang of ["de", "en"] as const) for (const k of ["nf_errNone", "nf_errName", "nf_errPhone", "nf_errSame"]) assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});

test("Fehlende Kontakte: nur aktive Spieler; Erinnerung nur an Spieler mit Konto", () => {
  const D = setup();
  const miss = missingEmergency(D).map(p => p.id);
  assert.ok(["p5", "p11", "p19"].every(id => miss.includes(id)), "Demo: drei ohne Kontakt");
  assert.ok(hasEmergency(D, "p17") && !hasEmergency(D, "p5"));
  for (const [pid, L] of Object.entries(D.emergency)) {
    assert.deepEqual(cleanContacts(L), L, pid + ": schon bereinigt");
    assert.ok(L.every(c => c.phone.startsWith("0199 ")), pid + ": Demo-Nummern ohne echte Anschlüsse");
  }
  assert.ok(Object.keys(D.emergencyMed).length >= 2);
  D.players[0].active = false; delete D.emergency[D.players[0].id];
  assert.ok(!missingEmergency(D).some(p => p.id === D.players[0].id), "inaktive Spieler zählen nicht");
  assert.ok(remindable(D).every(p => !!p.userId));
  assert.ok(needsEmergency(D, "p5") && !needsEmergency(D, "p17"));
  D.emergencyOk = false;
  assert.deepEqual(missingEmergency(D), [], "nicht geladen: nichts als fehlend melden");
  assert.ok(!needsEmergency(D, "p5"));
});
