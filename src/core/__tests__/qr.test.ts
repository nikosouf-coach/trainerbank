// Tests: QR-Code (Nayuki-Bibliothek, als Modul angepasst) – Größe, Suchmuster, Taktlinien, Formatbits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Ecc, QrCode, qrMatrix } from "../qr";

const finderOk = (m: boolean[][], x0: number, y0: number): boolean => {
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
    if (m[y0 + y][x0 + x] !== (ring !== 2)) return false;
  }
  return true;
};

test("QR: Einladungslink ergibt Version 3 (29 × 29) mit Suchmustern und Taktlinien", () => {
  const m = qrMatrix("trainerbank://join?code=ABCD-EFGH");
  assert.equal(m.length, 29); assert.ok(m.every(r => r.length === 29));
  const n = m.length;
  assert.ok(finderOk(m, 0, 0) && finderOk(m, n - 7, 0) && finderOk(m, 0, n - 7), "drei Suchmuster");
  for (let i = 8; i < n - 8; i++) { assert.equal(m[6][i], i % 2 === 0, "waagerechte Taktlinie"); assert.equal(m[i][6], i % 2 === 0, "senkrechte Taktlinie"); }
  assert.equal(m[n - 8][8], true, "immer dunkles Modul");
});

test("QR: gleiche Eingabe, gleiches Ergebnis; Fehlerkorrektur und Umlaute", () => {
  assert.deepEqual(qrMatrix("Trainerbank"), qrMatrix("Trainerbank"));
  const q = QrCode.encodeText("https://trainerbank.de/join?code=K7MN-P2QR", Ecc.MEDIUM);
  assert.ok(q.errorCorrectionLevel.ordinal >= Ecc.MEDIUM.ordinal, "mindestens M");
  assert.ok(q.mask >= 0 && q.mask <= 7);
  assert.equal(qrMatrix("Hallo Ümläut 👍").length, 25);
  assert.throws(() => QrCode.encodeText("x".repeat(3000), Ecc.HIGH), /Data too long/);
});
