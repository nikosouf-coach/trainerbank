// Tests: Größen & Ausrüstung – Bereinigung, Stutzen aus der Schuhgröße, fehlende Größen, Bestellliste, CSV und Text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS, translator } from "../i18n";
import {
  ADULT_SIZES, KIDS_SIZES, ORDER_ITEMS, cleanCloth, cleanHalf, cleanSizes, fmtHalf, hasSizes, kidsSizes, missingSizes, orderCsv, orderOf, orderText,
  remindableSizes, sizesComplete, sizesEmpty, sockOf,
} from "../sizes";
import type { TeamData } from "../types";

const NOW = new Date(2026, 10, 5, 10, 0);
const setup = (cls: "u19" | "u11" = "u19"): TeamData => { const D = buildDemo(demoTeam(cls, "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };
const name = (p: { vn: string; nn: string }) => `${p.vn} ${p.nn}`;

test("Größen bereinigen: Liste der Kleidergrößen, halbe Schuhgrößen, Bereiche", () => {
  assert.equal(cleanCloth(" m "), "M"); assert.equal(cleanCloth("xxxl"), "3XL"); assert.equal(cleanCloth("2XL"), "XXL");
  assert.equal(cleanCloth("164"), "164"); assert.equal(cleanCloth("XXXXL"), null); assert.equal(cleanCloth("10"), null); assert.equal(cleanCloth(null), null);
  assert.equal(cleanHalf("42,5", 26, 50), 42.5); assert.equal(cleanHalf(42.3, 26, 50), 42.5, "auf halbe Größen gerundet");
  assert.equal(cleanHalf("abc", 26, 50), null); assert.equal(cleanHalf(25, 26, 50), null); assert.equal(cleanHalf(51, 26, 50), null);
  assert.equal(cleanHalf("", 26, 50), null); assert.equal(cleanHalf(26, 26, 50), 26);
  const s = cleanSizes({ top: "l", bottom: "XXXXL", shoes: "44,5", gloves: 3, print: "  Jojo\n Müller-Lüdenscheidt-Ostermann ", note: " Bitte\r\n\r\n\r\ngrößer " });
  assert.deepEqual(s, { top: "L", bottom: null, shoes: 44.5, gloves: null, print: "Jojo Müller-Lüdensch", note: "Bitte\n\ngrößer" });
  assert.equal(s.print.length, 20);
  assert.ok(sizesEmpty(cleanSizes({ print: "   ", note: "\n" })));
  assert.ok(!sizesComplete(cleanSizes({ top: "M", shoes: 43 })) && sizesComplete(cleanSizes({ top: "M", bottom: "S", shoes: 43 })));
  assert.deepEqual(cleanSizes(cleanSizes(s)), s, "bereinigt bleibt gleich");
  assert.equal(KIDS_SIZES.length + ADULT_SIZES.length, 13);
  assert.ok(kidsSizes("u11") && kidsSizes("u15") && !kidsSizes("u19") && !kidsSizes("sen"));
});

test("Stutzen aus der Schuhgröße, Zahlen in der Sprache", () => {
  assert.equal(sockOf(null), null);
  assert.equal(sockOf(26), "27–30"); assert.equal(sockOf(30), "27–30"); assert.equal(sockOf(30.5), "31–34");
  assert.equal(sockOf(42), "39–42"); assert.equal(sockOf(42.5), "43–46"); assert.equal(sockOf(50), "47–50");
  assert.equal(fmtHalf(42.5, "de"), "42,5"); assert.equal(fmtHalf(43, "de"), "43"); assert.equal(fmtHalf(9.5, "en"), "9.5");
});

test("Fehlende Größen: nur aktive Spieler, unvollständig zählt als fehlend, Erinnerung nur mit Konto", () => {
  const D = setup();
  const miss = missingSizes(D).map(p => p.id);
  assert.deepEqual(miss, ["p4", "p12", "p16", "p20"], "drei ohne Größen, p16 ohne Hose");
  assert.ok(hasSizes(D, "p1") && !hasSizes(D, "p16"));
  for (const [pid, s] of Object.entries(D.sizes)) assert.deepEqual(cleanSizes(s), s, pid + ": schon bereinigt");
  assert.ok(D.players.filter(p => p.pos === "TW" && D.sizes[p.id]).every(p => D.sizes[p.id].gloves != null), "Torhüter mit Handschuhgröße");
  assert.ok(remindableSizes(D).every(p => !!p.userId));
  D.players[3].active = false;
  assert.ok(!missingSizes(D).some(p => p.id === "p4"), "inaktive Spieler zählen nicht");
  D.sizesOk = false;
  assert.deepEqual(missingSizes(D), [], "nicht geladen: nichts als fehlend melden");
  // Kinderteam: Kindergrößen
  const K = setup("u11");
  assert.ok(Object.values(K.sizes).every(s => KIDS_SIZES.includes(s.top || "")), "U11: Kindergrößen");
});

test("Bestellliste: Summen je Größe, Fehlende, Handschuhe nur für Torhüter, Reihenfolge", () => {
  const D = setup(), P = D.players.filter(p => p.active !== false);
  const o = orderOf(D, P, ["gloves", "top", "bottom", "socks"], { lang: "de", name });
  assert.deepEqual(o.totals.map(x => x.item), ["top", "bottom", "socks", "gloves"], "Reihenfolge wie ORDER_ITEMS");
  const top = o.totals[0], bottom = o.totals[1], gloves = o.totals[3];
  assert.equal(top.n + top.missing, P.length, "jeder Spieler zählt einmal");
  assert.equal(top.missing, 3); assert.equal(bottom.missing, 4, "p16 ohne Hose");
  const order = top.counts.map(c => c.size);
  assert.deepEqual(order, [...order].sort((a, b) => [...KIDS_SIZES, ...ADULT_SIZES].indexOf(a) - [...KIDS_SIZES, ...ADULT_SIZES].indexOf(b)), "Größen sortiert");
  const gk = P.filter(p => p.pos === "TW").length;
  assert.equal(gloves.n + gloves.missing, gk, "Handschuhe nur Torhüter");
  assert.deepEqual(o.lines.map(l => l.nr), [...o.lines.map(l => l.nr)].sort((a, b) => (a ?? 1000) - (b ?? 1000)), "nach Rückennummer");
  const l16 = o.lines.find(l => l.pid === "p16")!;
  assert.deepEqual(l16.missing, ["bottom"]); assert.equal(l16.print, D.sizes.p16.print || "Vogt", "ohne Beflockungsname: Nachname");
  const socks = o.totals[2].counts;
  assert.ok(socks.every(c => /^\d{2}–\d{2}$/.test(c.size)) && socks.map(c => parseInt(c.size)).every((v, i, a) => i === 0 || a[i - 1] < v), "Stutzen sortiert");
  assert.deepEqual(orderOf(D, [], ORDER_ITEMS, { lang: "de", name }).totals.map(x => x.n), [0, 0, 0, 0, 0]);
});

test("Bestellliste als CSV und Text", () => {
  const D = setup(), tr = translator("de");
  D.sizes.p2 = cleanSizes({ ...D.sizes.p2, note: "=HYPERLINK(\"x\"); bitte größer", print: "ALBERS" });
  const P = D.players.filter(p => ["p1", "p2", "p4"].includes(p.id));
  const o = orderOf(D, P, ["top", "socks", "gloves"], { lang: "de", name });
  const csv = orderCsv(o, { print: true }, tr);
  assert.ok(csv.startsWith("﻿Nr.;Name;Beflockung;Oberteil;Stutzen;TW-Handschuhe;Hinweis\r\n"), "Kopfzeile mit BOM und Semikolon");
  const rows = csv.slice(1).split("\r\n");
  assert.equal(rows.length, 1 + 3 + 1 + 1 + o.totals.reduce((n, x) => n + x.counts.length + (x.missing ? 1 : 0), 0));
  assert.ok(rows[2].endsWith(`"'=HYPERLINK(""x""); bitte größer"`), "Formel wird nicht ausgeführt, Semikolon in Anführungszeichen");
  assert.match(rows[3], /^4;Mats Ehlert;Ehlert;fehlt;fehlt;;$/, "fehlende Größen markiert, Handschuhe ohne Torhüter leer");
  assert.equal(rows[4], "", "Leerzeile vor den Summen");
  assert.equal(rows[5], "Artikel;Größe;Anzahl");
  const en = orderCsv(o, { print: false }, translator("en"));
  assert.ok(en.startsWith("﻿No.,Name,Top,Socks,GK gloves,Note\r\n"), "Englisch mit Komma, ohne Beflockung");
  const txt = orderText(o, { print: true, title: "Bestellung U19 – 05.11.2026" }, tr);
  const lines = txt.split("\n");
  assert.equal(lines[0], "Bestellung U19 – 05.11.2026");
  assert.ok(lines.some(x => x.startsWith("Oberteil: ") && x.endsWith("(2)")), "Summe Oberteile");
  assert.ok(txt.includes("Größe fehlt noch: Mats Ehlert (Oberteil, Stutzen)"));
  assert.ok(lines.some(x => x.startsWith("#1 Luca Brenner") && x.includes("TW-Handschuhe")), "Zeile je Spieler");
  for (const lang of ["de", "en"] as const) for (const k of ORDER_ITEMS) assert.ok(DICTS[lang]["gr_item_" + k], `${lang}: gr_item_${k}`);
});
