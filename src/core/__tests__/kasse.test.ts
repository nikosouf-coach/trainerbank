// Tests: Mannschaftskasse – fällige Zeiträume, offene Beträge, Befreiungen, Geldstrafen, Kassenstand, Formatierung.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { balance, duePeriods, duesByPlayer, itemsFor, kasseOf, money, paymentFor, seasonOf } from "../kasse";
import type { CashEntry, FeeDef, FineEntry, KasseSettings } from "../types";

const fee = (x: Partial<FeeDef>): FeeDef => ({ id: "f1", name: "Kasse", amount: 5, every: "month", from: "2026-08-01", ...x });

test("Fällige Zeiträume: monatlich, je Saison (Juli–Juni), einmalig, mit Ende", () => {
  assert.deepEqual(duePeriods(fee({}), "2026-10-08"), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(duePeriods(fee({ from: "2026-11-01" }), "2026-10-08"), [], "noch nicht fällig");
  assert.deepEqual(duePeriods(fee({ to: "2026-09-15" }), "2026-10-08"), ["2026-08", "2026-09"]);
  assert.deepEqual(duePeriods(fee({ from: "2025-11-15", every: "month" }), "2026-02-01"), ["2025-11", "2025-12", "2026-01", "2026-02"], "über den Jahreswechsel");
  assert.deepEqual(duePeriods(fee({ every: "season", from: "2025-08-01" }), "2026-10-08"), ["2025/26", "2026/27"]);
  assert.deepEqual(duePeriods(fee({ every: "once", from: "2026-09-01" }), "2026-10-08"), ["once"]);
  assert.equal(seasonOf("2026-06-30"), "2025/26"); assert.equal(seasonOf("2026-07-01"), "2026/27"); assert.equal(seasonOf("2099-12-31"), "2099/00");
});

test("Offene Beträge: Zahlungen, Befreiungen, Auswahl von Spielern, Geldstrafen nur mit Geldmodus", () => {
  const k: KasseSettings = { on: true, currency: "EUR", money: true, showBalance: true, fees: [fee({}), fee({ id: "f2", name: "Ausflug", amount: 30, every: "once", from: "2026-09-10", pids: ["a"] })] };
  const cash: CashEntry[] = [{ id: "c1", date: "2026-08-05", amount: 5, kind: "in", cat: "fee", pid: "a", feeId: "f1", period: "2026-08", fineId: null, note: "" }];
  const fines: FineEntry[] = [
    { id: "x1", pid: "a", rule: "late", date: "2026-10-01", ref: null, amount: 2, note: "", status: "open", auto: false, dutyDate: null },
    { id: "x2", pid: "a", rule: "late", date: "2026-09-01", ref: null, amount: 2, note: "", status: "waived", auto: false, dutyDate: null },
    { id: "x3", pid: "a", rule: "late_rpe", date: "2026-09-02", ref: "2026-09-01", amount: null, note: "", status: "open", auto: true, dutyDate: "2026-09-03" },
  ];
  const D = { cash, waivers: [{ pid: "a", feeId: "f1", period: "2026-09" }], fines };
  const items = itemsFor(D, k, "a", "2026-10-08", "de", r => r);
  const open = items.filter(i => !i.paid && !i.waived);
  assert.deepEqual(open.map(i => i.key), ["fee:f2:once", "fee:f1:2026-10", "fine:x1"], "nach Datum sortiert (gleicher Tag: Beitrag vor Strafe)");
  assert.ok(items.find(i => i.key === "fee:f1:2026-08")!.paid);
  assert.ok(items.find(i => i.key === "fee:f1:2026-09")!.waived);
  assert.equal(items.some(i => i.fineId === "x2" || i.fineId === "x3"), false, "erlassene Strafe und reine Dienste zählen nicht");
  assert.equal(itemsFor(D, { ...k, money: false }, "a", "2026-10-08", "de", r => r).some(i => i.kind === "fine"), false, "ohne Geldmodus keine Geldstrafen");
  assert.equal(itemsFor(D, k, "b", "2026-10-08", "de", r => r).some(i => i.feeId === "f2"), false, "Beitrag nur für ausgewählte Spieler");
  // ganzer Beitrag erlassen
  const all = itemsFor({ ...D, waivers: [{ pid: "b", feeId: "f1", period: "*" }] }, k, "b", "2026-10-08", "de", r => r);
  assert.ok(all.every(i => i.waived));
  const pay = paymentFor(open.find(i => i.kind === "fine")!, "2026-10-08");
  assert.deepEqual([pay.cat, pay.fineId, pay.feeId, pay.kind, pay.amount], ["fine", "x1", null, "in", 2]);
});

test("Kassenstand, Übersicht je Spieler und Formatierung", () => {
  const cash: CashEntry[] = [
    { id: "1", date: "2026-06-20", amount: 100, kind: "in", cat: "donation", pid: null, feeId: null, period: null, fineId: null, note: "" },
    { id: "2", date: "2026-08-01", amount: 64.5, kind: "out", cat: "event", pid: null, feeId: null, period: null, fineId: null, note: "" },
    { id: "3", date: "2026-09-01", amount: 0.1, kind: "in", cat: "other", pid: null, feeId: null, period: null, fineId: null, note: "" },
    { id: "4", date: "2026-09-01", amount: 0.2, kind: "in", cat: "other", pid: null, feeId: null, period: null, fineId: null, note: "" },
  ];
  assert.deepEqual(balance(cash), { total: 35.8, inSum: 100.3, outSum: 64.5 }, "ohne Rundungsfehler");
  assert.deepEqual(balance(cash, "2026-07-01"), { total: 35.8, inSum: 0.3, outSum: 64.5 });
  assert.equal(money(1234.5, "EUR", "de"), "1.234,50 €");
  assert.equal(money(1234.5, "EUR", "en"), "€1,234.50");
  assert.equal(money(-3, "CHF", "de"), "−3,00 CHF");
  const D = buildDemo(demoTeam("sen", "pro"), "de", new Date(2026, 9, 8, 9)); demoExtras(D, "de", new Date(2026, 9, 8, 9));
  const k = kasseOf(D.team.settings, "akt");
  assert.ok(k.on && k.money && k.fees.length, "Demo Senioren: Kasse mit Geldstrafen");
  const L = duesByPlayer(D, k, "2026-10-08", "de", r => r);
  assert.equal(L.length, D.players.length);
  assert.ok(L[0].open >= L[L.length - 1].open, "nach offenem Betrag sortiert");
  assert.ok(L.some(x => x.open > 0) && L.some(x => x.open === 0));
  const youth = kasseOf({}, "u19"); assert.equal(youth.money, false); assert.equal(youth.on, false);
});
