// Tests: Foto-Erlaubnis – wer zustimmen muss (unter 14, 14–17, ab 18, Alter unbekannt), Stand je Kanal, „Nein“ gilt
// immer, eigene Änderung des Spielers (Ja nur ab 18 bzw. im Erwachsenenbereich), Übersicht und Zählung, neu einholen
// bei Volljährigkeit, Bereinigen, Demo, Texte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS } from "../i18n";
import { canSelfConsent, cleanPhotoConsent, missingParty, needsRenewal, photoAge, photoCounts, photoRows, photoState, PHOTO_CHANNELS, selfChange, validBy } from "../photos";
import type { PhotoConsent, Player, TeamData } from "../types";

const C = (x: Partial<PhotoConsent>): PhotoConsent => cleanPhotoConsent({ web: true, social: true, press: true, name: true, by: "both", on: "2026-09-01", note: "", ...x });

test("Wer zustimmen muss: unter 14 Eltern, 14–17 Eltern und Spieler, ab 18 der Spieler", () => {
  assert.deepEqual(validBy(12), ["parents", "both"]);
  assert.deepEqual(validBy(14), ["both"]); assert.deepEqual(validBy(17), ["both"]);
  assert.deepEqual(validBy(18), ["player", "both"]);
  assert.deepEqual(validBy(null), ["player", "parents", "both"]);
});

test("Stand je Kanal: ja, nein, offen, Zustimmung fehlt", () => {
  assert.equal(photoState(undefined, "web", 16), "open");
  assert.equal(photoState(C({ by: "parents" }), "web", 12), "yes");
  assert.equal(photoState(C({ by: "parents" }), "web", 16), "missing", "mit 16 reicht die Erklärung der Eltern allein nicht");
  assert.equal(photoState(C({ by: "both" }), "web", 16), "yes");
  assert.equal(photoState(C({ by: "parents" }), "web", 18), "missing", "volljährig: Eltern reichen nicht mehr");
  assert.equal(photoState(C({ by: "player" }), "web", 18), "yes");
  assert.equal(photoState(C({ social: false }), "social", 18), "no");
  assert.equal(photoState(C({ press: null }), "press", 18), "open");
  assert.equal(photoState(C({ by: null }), "web", 18), "missing", "Ja ohne Erklärung zählt nicht");
});

test("Eigene Änderung: Nein immer, Ja nur wenn selbst zustimmen darf; Erklärung und Datum", () => {
  assert.equal(canSelfConsent(18, false), true); assert.equal(canSelfConsent(17, true), false);
  assert.equal(canSelfConsent(null, true), true); assert.equal(canSelfConsent(null, false), false);
  const teen = selfChange(C({ by: "both" }), { social: false, web: true, press: true }, false, "2026-11-06");
  assert.equal(teen.social, false); assert.equal(teen.by, "both"); assert.equal(teen.on, "2026-09-01");
  const teen2 = selfChange(C({ social: false, by: "both" }), { social: true }, false, "2026-11-06");
  assert.equal(teen2.social, false, "Minderjährige können ein Nein nicht selbst zurücknehmen");
  const fresh = selfChange(undefined, { name: false }, false, "2026-11-06");
  assert.deepEqual([fresh.name, fresh.by, fresh.web], [false, null, null], "nur Ablehnung, keine Erklärung");
  const adult = selfChange(C({ by: "parents", social: null }), { social: true }, true, "2026-11-06");
  assert.deepEqual([adult.social, adult.by, adult.on], [true, "player", "2026-11-06"]);
  const same = selfChange(C({ by: "parents" }), { web: true }, true, "2026-11-06");
  assert.deepEqual([same.by, same.on], ["parents", "2026-09-01"], "ohne Änderung bleibt die Erklärung");
});

test("Übersicht, Zählung, neu einholen bei Volljährigkeit, Bereinigen", () => {
  const P = (id: string, geb: string) => ({ id, vn: id, nn: "X", pos: "ZM", nr: null, geb } as Player);
  const D = { players: [P("a", "2012-05-01"), P("b", "2010-05-01"), P("c", "2008-01-01"), P("d", ""), { ...P("e", "2008-01-01"), active: false }],
    photos: { a: C({ by: "parents" }), b: C({ by: "parents" }), c: C({ by: "parents", social: false }) } } as unknown as TeamData;
  const rows = photoRows(D, "2026-11-06");
  assert.deepEqual(rows.map(r => [r.pid, r.age, r.states.web]), [["a", 14, "missing"], ["b", 16, "missing"], ["c", 18, "missing"], ["d", null, "open"]]);
  assert.deepEqual(photoCounts(rows, "social"), { yes: 0, no: 1, open: 1, missing: 2 });
  assert.deepEqual(rows.filter(needsRenewal).map(r => r.pid), ["c"]);
  assert.deepEqual(rows.map(r => missingParty(r.c, r.age)), ["player", "player", "player", "decl"]);
  assert.equal(missingParty(C({ by: "player" }), 15), "parents"); assert.equal(missingParty(C({ by: "player" }), 10), "parents");
  assert.equal(photoAge(D.players[0], "2026-04-30"), 13);
  const x = cleanPhotoConsent({ web: "ja" as never, by: "x" as never, on: "06.11.2026", note: "  a\n b " + "c".repeat(300) });
  assert.deepEqual([x.web, x.by, x.on, x.note.length, x.note.slice(0, 4)], [null, null, null, 200, "a b "]);
  assert.deepEqual(PHOTO_CHANNELS, ["web", "social", "press", "name"]);
});

test("Demo: Ablehnung, ohne Namen, offen, Zustimmung fehlt, neu einholen", () => {
  const NOW = new Date(2026, 10, 6, 10);
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW);
  const rows = photoRows(D, "2026-11-06"), st = (pid: string, ch: "web" | "social" | "name") => rows.find(r => r.pid === pid)!.states[ch];
  assert.equal(st("p4", "social"), "no"); assert.equal(st("p12", "name"), "no"); assert.equal(st("p7", "web"), "open"); assert.equal(st("p17", "web"), "open");
  assert.ok(rows.some(r => r.states.web === "missing" && r.age != null && r.age < 18), "Spieler unter 18 ohne eigene Zustimmung");
  assert.ok(rows.some(needsRenewal), "volljährig mit Erklärung der Eltern");
  assert.ok(photoCounts(rows, "web").yes >= 15);
});

test("Texte: Schlüssel in beiden Sprachen", () => {
  const keys = ["m_fotos", "md_fotos", "ph_title", "ph_menuSub", "nvb_fotos", "ph_sub", "ph_info", "ph_counts", "ph_not", "ph_notName", "ph_allOk", "ph_yes", "ph_yesName", "ph_miss_player", "ph_miss_parents", "ph_miss_decl", "ph_renew",
    "ph_all", "ph_noDecl", "ph_age", "ph_legend", "ph_whoUnknown", "ph_who18", "ph_who14", "ph_whoKid", "ph_sheet", "ph_yesL", "ph_noL", "ph_openL", "ph_byL", "ph_onL", "ph_noteL", "ph_notePh",
    "ph_weak", "ph_formHint", "ph_saved", "ph_meAll", "ph_meNone", "ph_meSome", "ph_meOpen", "ph_meSelf", "ph_meTeen", "ph_meKid", "ph_meBy", "ph_meNo", "ph_meRevoke", "ph_modOff",
    ...PHOTO_CHANNELS.flatMap(ch => ["ph_ch_" + ch, "ph_short_" + ch, "ph_q_" + ch]), ...["yes", "no", "open", "missing"].map(k => "ph_st_" + k), ...["player", "parents", "both"].map(k => "ph_by_" + k)];
  for (const lang of ["de", "en"] as const) for (const k of keys) assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});
