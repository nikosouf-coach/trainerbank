// Tests: Körperfigur (Trefferflächen, Seiten, altersgerecht) und Angaben zum Schmerz (Warnzeichen, Steuerung, Häufungen).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY } from "../body";
import { buildDemo, demoTeam } from "../demo";
import { FIG_H, FIG_W, figureFor, figureParts, type FigureKind, type View } from "../figure";
import { cleanPain, cleanPainMap, complaintEffect, painEffect, painSummary, preventionFor, teamHotspots } from "../pain";

const KINDS: FigureKind[] = ["kid", "teen", "adult"], VIEWS: View[] = ["front", "back"];

test("Figur: jede Region antippbar, Mitte trifft nur die eigene Fläche, Seiten aus Sicht des Spielers", () => {
  for (const kind of KINDS) {
    const all = VIEWS.flatMap(v => figureParts(kind, v));
    for (const b of BODY.filter(x => x.zone !== "ill")) {
      const ps = all.filter(p => p.k === b.k);
      assert.ok(ps.length, `${kind}: ${b.k} fehlt`);
      if (b.side) assert.deepEqual([...new Set(ps.map(p => p.side))].sort(), ["l", "r"], `${kind}: ${b.k} beide Seiten`);
    }
    for (const view of VIEWS) {
      const parts = figureParts(kind, view);
      for (const p of parts) {
        const { x, y, w, h } = p.hit, cx = x + w / 2, cy = y + h / 2;
        assert.ok(w >= 6 && h >= 5, `${kind}/${view}/${p.k}: Fläche zu klein (${w}×${h})`);
        assert.ok(x >= 0 && y >= 0 && x + w <= FIG_W && y + h <= FIG_H, `${kind}/${view}/${p.k}: außerhalb`);
        const other = parts.find(q => q !== p && cx >= q.hit.x && cx <= q.hit.x + q.hit.w && cy >= q.hit.y && cy <= q.hit.y + q.hit.h);
        assert.equal(other, undefined, `${kind}/${view}/${p.k}${p.side || ""}: Mitte liegt in ${other?.k}${other?.side || ""}`);
        if (p.side) {
          const leftHalf = cx < FIG_W / 2;
          // vorne: rechte Körperseite links im Bild; hinten: rechte Seite rechts im Bild
          assert.equal(leftHalf, view === "front" ? p.side === "r" : p.side === "l", `${kind}/${view}/${p.k}: Seite ${p.side}`);
        }
      }
    }
  }
  // altersgerecht: Kinder haben einen größeren Kopf
  const head = (k: FigureKind) => figureParts(k, "front").find(p => p.k === "head")!.hit.h;
  assert.ok(head("kid") > head("teen") && head("teen") > head("adult"));
  assert.equal(figureFor("u11"), "kid"); assert.equal(figureFor("u15"), "teen"); assert.equal(figureFor("u19"), "adult"); assert.equal(figureFor("akt"), "adult");
});

test("Schmerz: Warnzeichen verschärfen die Steuerung", () => {
  const ef = (k: Parameters<typeof painEffect>[0], i: Parameters<typeof painEffect>[1], lv: "light" | "clear" = "light") => painEffect(k, i, lv, 7, false);
  assert.equal(ef("knee", null).kind, "easy");
  const w = ef("ankle", { signs: ["weight"] }); assert.equal(w.kind, "pause"); assert.ok(w.flags.includes("pf_doctor"));
  const m = ef("hams", { onset: "sudden", q: ["pull"], when: ["sprint"] }); assert.equal(m.kind, "pause"); assert.ok(m.flags.includes("pf_muscle"));
  const o = ef("achilles", { onset: "gradual", when: ["morning", "after"] }); assert.equal(o.kind, "easy"); assert.ok(o.flags.includes("pf_overuse")); assert.ok((o.cap ?? 9) <= 5);
  assert.ok(ef("shin", { when: ["night"], since: "week" }).flags.includes("pf_bone"));
  assert.equal(ef("quad", { nrs: 8 }).kind, "pause");
  assert.equal(ef("quad", { nrs: 5 }).kind, "pause", "Stärke ≥ 5 zählt wie deutlich");
  assert.ok(ef("head", { cause: "contact" }).flags.includes("pf_concussion"));
  assert.equal(ef("lowback", { q: ["radiate"] }).kind, "pause");
  assert.equal(ef("shoulder", { train: "no" }).kind, "pause");
  const lim = ef("shoulder", { train: "limited" }); assert.equal(lim.kind, "easy"); assert.equal(lim.cap, 6);
  assert.ok(ef("calf", { since: "long" }).flags.includes("pf_long"));
});

test("Schmerz: Eingaben bereinigen, nur gemeldete Regionen, Zusammenfassung", () => {
  assert.deepEqual(cleanPain({ nrs: 12.4, q: ["pull", "pull", "x"], onset: "plötzlich", since: "days", when: ["sprint"], signs: ["swelling", "?"], train: "limited", extra: 1 }),
    { nrs: 10, q: ["pull"], since: "days", when: ["sprint"], signs: ["swelling"], train: "limited" });
  assert.equal(cleanPain({}), null); assert.equal(cleanPain("x"), null);
  assert.deepEqual(Object.keys(cleanPainMap({ hams: { nrs: 3 }, knee: { nrs: 2 }, ill_up: { nrs: 2 } }, ["hams:l", "ill_up"])), ["hams"]);
  const t = (k: string) => k;
  assert.equal(painSummary(t, { q: ["pull"], nrs: 6, onset: "sudden", when: ["sprint"], since: "today", train: "limited" }), "pq_pull · 6/10 · po_sudden · pwh_sprint · ps_today · pt_limited");
  const c = complaintEffect({ sum: 0, schlaf: 8, beschw: "light", areas: ["hams:r", "ankle:l"], pain: { ankle: { signs: ["unstable"] }, hams: { onset: "sudden", q: ["stab"] } } }, 7, false)!;
  assert.equal(c.kind, "pause"); assert.deepEqual(c.flags.sort(), ["pf_doctor", "pf_muscle"]);
});

test("Beschwerden im Team: Spieler je Region, Prävention ab Häufung", () => {
  const D = buildDemo(demoTeam("u19", "pro"), "de", new Date(2026, 9, 8, 9));
  const spots = teamHotspots(D, "2026-10-08");
  const groin = spots.find(h => h.k === "groin")!;
  assert.equal(groin.players.length, 3, "Leiste bei drei Spielern");
  assert.equal(spots[0].k, "groin", "häufigste Region zuerst");
  assert.ok(preventionFor(spots, D.players.length).includes("groin"));
  assert.ok(!preventionFor(spots, D.players.length).includes("knee"), "einzelner Fall ist keine Häufung");
  assert.equal(teamHotspots(D, "2026-10-08", 3).some(h => h.k === "groin" && h.players.length === 3), false, "Zeitraum zählt");
});
