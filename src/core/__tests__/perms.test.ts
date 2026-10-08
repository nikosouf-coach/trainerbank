// Tests: Rechte im Trainerteam (Standard je Rolle wie in der Datenbank, Sicht ohne Rechte, benötigte Rechte für Einstellungen).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDemo, demoTeam } from "../demo";
import { PERMS, PERM_PRESETS, defaultPerms, effectivePerms, presetOf, teamPatchPerms, viewFor } from "../perms";

const NOW = new Date(2026, 9, 8, 9, 0);

test("Standardrechte je Rolle stimmen mit der Datenbank überein (default_perms)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261008000017_rechte.sql"), "utf8");
  for (const role of ["owner", "coach", "physio"]) {
    const m = sql.match(new RegExp(`when '${role}'\\s+then array\\[([^\\]]*)\\]`));
    assert.ok(m, role);
    const db = m![1].split(",").map(x => x.trim().replace(/'/g, ""));
    assert.deepEqual(db, defaultPerms(role), role);
  }
  const check = sql.match(/perms <@ array\[([^\]]*)\]/)!;
  assert.deepEqual(check[1].split(",").map(x => x.trim().replace(/'/g, "")), PERMS, "gleiche Schlüssel im Check");
});

test("Wirksame Rechte: Owner alle, gespeicherte Auswahl, unbekannte Schlüssel ignoriert, Spieler keine", () => {
  assert.equal(effectivePerms("owner", ["plan"]).size, PERMS.length);
  assert.deepEqual([...effectivePerms("coach", null)].sort(), [...defaultPerms("coach")].sort());
  assert.deepEqual([...effectivePerms("coach", ["cash", "fliegen"])], ["cash"]);
  assert.equal(effectivePerms("player", ["health"]).size, 0);
  assert.equal(effectivePerms("pending", null).size, 0);
  assert.equal(presetOf(PERM_PRESETS.betreuer), "betreuer");
  assert.equal(presetOf(["health"]), null);
});

test("Sicht ohne Gesundheits-/Befund-/Notizrecht: Module aus, Demo-Daten ausgeblendet, Original unverändert", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  assert.equal(viewFor(D, new Set(PERMS), true), D, "volle Rechte: dasselbe Objekt");
  const V = viewFor(D, new Set(["plan", "squad"]), true);
  assert.equal(V.team.modules.belastung, false); assert.equal(V.team.modules.befunde, false);
  assert.deepEqual(V.rpe, {}); assert.deepEqual(V.well, {}); assert.deepEqual(V.findings, []); assert.deepEqual(V.notes, {});
  assert.ok(Object.keys(D.rpe).length > 0 && D.team.modules.belastung, "Original bleibt");
  const R = viewFor(D, new Set(["plan"]), false);
  assert.equal(R.rpe, D.rpe, "ohne strip bleiben Daten (Server filtert)");
});

test("Benötigte Rechte für Team-Änderungen: nur echte Änderungen zählen", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", NOW);
  const team = D.team as unknown as Record<string, unknown> & { settings: object };
  assert.deepEqual(teamPatchPerms({ settings: { ...D.team.settings, testRank: "best" } }, team), ["perf"]);
  assert.deepEqual(teamPatchPerms({ settings: { ...D.team.settings, fines: [] } }, team), ["tasks"]);
  assert.deepEqual(teamPatchPerms({ settings: { ...D.team.settings, playerAbs: false } }, team), ["admin"]);
  assert.deepEqual(teamPatchPerms({ name: D.team.name, club: D.team.club }, team), [], "unverändert = kein Recht nötig");
  assert.deepEqual(teamPatchPerms({ name: "Neu" }, team), ["admin"]);
  assert.deepEqual(teamPatchPerms({ settings: { ...D.team.settings, dauer: 75 }, principles: D.team.principles }, team), ["plan"]);
});
