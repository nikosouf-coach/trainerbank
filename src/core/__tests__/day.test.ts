// Tests: Trainingstag – mehrere Zuständigkeiten je Block (crew), „Meine Blöcke“, Bereinigung.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCrew, crewOf, isMyBlock, myBlocks, myTask } from "../day";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import type { DayBlock } from "../types";

const blk = (p: Partial<DayBlock>): DayBlock => ({ id: "b", date: "2026-10-21", sort: 0, title: "Spielform", min: 20, staffId: null, exId: null, text: "", points: [], drawing: null, photo: null, groupId: null, ...p });

test("Zuständigkeiten: mehrere Trainer mit Aufgabe, ältere Blöcke mit einem Trainer, Meine Blöcke", () => {
  const old = blk({ staffId: "s1" });
  assert.deepEqual(crewOf(old), [{ staffId: "s1", task: "" }], "älterer Block: Hauptverantwortlicher ohne Aufgabe");
  assert.deepEqual(crewOf(blk({})), []);
  const b = blk({ staffId: "s1", crew: [{ staffId: "s1", task: "ballbesitzende Mannschaft" }, { staffId: "s2", task: "verteidigende Mannschaft" }] });
  assert.ok(isMyBlock(b, "s2") && isMyBlock(b, "s1") && !isMyBlock(b, "s3"));
  assert.equal(myTask(b, "s2"), "verteidigende Mannschaft"); assert.equal(myTask(old, "s1"), "");
  // Bereinigen: leere und doppelte raus, Aufgabe gekürzt, höchstens 6
  const L = cleanCrew([{ staffId: "", task: "x" }, { staffId: "a", task: "  t  " }, { staffId: "a", task: "doppelt" }, { staffId: "b", task: "y".repeat(100) },
    ...["c", "d", "e", "f", "g"].map(staffId => ({ staffId, task: "" }))]);
  assert.deepEqual(L.map(x => x.staffId), ["a", "b", "c", "d", "e", "f"]); assert.equal(L[0].task, "t"); assert.equal(L[1].task.length, 80);
  // Demo: Abschlussspiel mit zwei Trainern – der Co-Trainer sieht ihn in „Meine Blöcke“
  const now = new Date(2026, 9, 14, 9, 0), D = buildDemo(demoTeam("u19", "pro"), "de", now); demoExtras(D, "de", now);
  const fin = D.blocks.find(x => (x.crew || []).length === 2)!;
  assert.ok(fin, "Demo hat einen Block mit zwei Zuständigen");
  assert.ok(myBlocks(D, "s2", "2026-10-14", 14).some(x => x.id === fin.id), "Co-Trainer: Block mit eigener Aufgabe");
});
