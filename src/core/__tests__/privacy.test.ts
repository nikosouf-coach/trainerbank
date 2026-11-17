// Tests: Gesundheitsdaten eines Spielers im Speicher löschen (wie public.erase_health_data auf dem Server).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { HEALTH_GROUPS, eraseHealthLocal } from "../privacy";
import { scrubText } from "../text";
import type { TeamData } from "../types";

const NOW = new Date(2026, 10, 10, 10, 0);
const setup = (): TeamData => { const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW); return D; };

test("Gesundheitsdaten löschen: Belastung, Morgen-Check, Zusatzsport, Wachstum, Notfall-Hinweise, Gewicht, Gruppen, Empfehlungen", () => {
  const D = setup();
  const p = D.players.find(x => D.rpe[x.id] && D.well[x.id]) || D.players[0];
  const other = D.players.find(x => x.id !== p.id && D.rpe[x.id])!;
  const otherRpe = JSON.stringify(D.rpe[other.id]);
  // Ausgangslage vollständig machen
  D.extra[p.id] = [{ id: "x1", date: "2026-11-08", art: "lauf", min: 30, rpe: 5 } as never];
  D.growth[p.id] = [{ date: "2026-10-01", cm: 178 } as never];
  D.emergencyMed[p.id] = "Asthma-Spray in der Tasche";
  p.kg = 72;
  const reha = { id: "g-reha", name: "Reha", kind: "reha" as const }, tw = { id: "g-tw", name: "Torhüter", kind: "tw" as const };
  D.groups.push(reha, tw); p.groups = ["g-reha", "g-tw"];
  D.msgs[p.id] = [{ id: "m1", date: "2026-11-09", typ: "pause", text: "Morgen frei", bis: null }, { id: "m2", date: "2026-11-09", typ: "info", text: "Trikot mitbringen", bis: null }];
  D.absences.push({ id: "a-v", pid: p.id, typ: "verletzung", von: "2026-11-01", bis: null, stufe: 2, notiz: "Knie", area: "knee:r" },
                  { id: "a-u", pid: p.id, typ: "urlaub", von: "2026-12-20", bis: "2026-12-28", stufe: null, notiz: "Mallorca" });

  const n = eraseHealthLocal(D, p.id);
  assert.ok(n > 5, "mehrere Einträge entfernt");
  for (const k of ["rpe", "rpeU", "well", "extra", "growth", "emergencyMed"] as const) assert.equal((D[k] as Record<string, unknown>)[p.id], undefined, k + " gelöscht");
  assert.equal(p.kg, null, "Gewicht gelöscht");
  assert.deepEqual(p.groups, ["g-tw"], "nur Gesundheitsgruppen fallen weg");
  assert.deepEqual(D.msgs[p.id].map(m => m.typ), ["info"], "Pause und Regeneration fallen weg, Infos bleiben");
  const v = D.absences.find(a => a.id === "a-v")!, u = D.absences.find(a => a.id === "a-u")!;
  assert.deepEqual([v.typ, v.stufe, v.notiz, v.area], ["sonst", null, "", null], "Verletzung bleibt als Sonstiges ohne Details");
  assert.deepEqual([u.typ, u.notiz], ["urlaub", "Mallorca"], "Urlaub bleibt unverändert");
  assert.equal(JSON.stringify(D.rpe[other.id]), otherRpe, "andere Spieler unberührt");
  assert.equal(eraseHealthLocal(D, p.id), 0, "zweiter Aufruf ändert nichts mehr");
  assert.deepEqual(HEALTH_GROUPS, ["reha", "build", "growth"]);
});

test("Fehlermeldungen für Absturzberichte: E-Mail, ID, Telefon, Codes ersetzt", () => {
  assert.equal(scrubText('duplicate key value (email)=(max.muster@verein.de) already exists'), "duplicate key value (email)=([E-Mail]) already exists");
  assert.equal(scrubText("Spieler 2f1c9a4e-1b2c-4d5e-8f90-0a1b2c3d4e5f nicht gefunden"), "Spieler [ID] nicht gefunden");
  assert.equal(scrubText("Ruf an: +49 171 2345678"), "Ruf an: [Telefon]");
  assert.equal(scrubText("Code ABCD-EF23 ungültig"), "Code [Code] ungültig");
  assert.equal(scrubText("Netzwerkfehler 504"), "Netzwerkfehler 504", "kurze Zahlen bleiben");
  assert.equal(scrubText(undefined), "");
});
