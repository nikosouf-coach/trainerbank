// Tests: Matchplan – Grundordnungen, Aufstellung per Ziehen, Spielminuten, Folien, Freigabe, Bereinigung, Demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import {
  DEFAULT_SECTIONS, FORMATIONS, FRAME_MAX, FRAME_MIN_W, FREE_MAX, MP_DASHES, MP_LIMITS, MP_VIEWS, MP_VIEW_KEYS, MP_WIDTHS, availFor, dashOf, isMaterial, bendCtrl, bendThrough, changedSincePublish, clampFrame, cleanContent, copyPlan, copySlide,
  defaultUntil, emptyContent, fitToView, fmtOf, formatFrame, formatOf, forPlayer, frameOf, inFrame, isArea, isArrow, itemMid, linePoint, moveItem, lineupFor, newPlan, newSlide, oppLineup, outsideFrame,
  panFrame, placePlayer, plannedMinutes, presetOf, publishedOf, seenStats, separate, shareState, shiftItem, slotsOf, squadOf, stableJson, strokeBend, suggestLineup, textScale, thinPoints, visibleTo, withFrame, zoomFrame, zoomOf,
} from "../matchplan";
import type { MatchPlan, MpContent, Player } from "../types";

const NOW = new Date(2026, 9, 7, 10, 0);
const pl = (id: string, pos: string, nr: number): Player => ({ id, vn: id.toUpperCase(), nn: "X", pos, nr, geb: "2008-01-01" });
const SQUAD: Player[] = [
  pl("tw1", "TW", 1), pl("tw2", "TW", 12), pl("lv", "LV", 3), pl("iv1", "IV", 4), pl("iv2", "IV", 5), pl("rv", "RV", 2), pl("dm1", "DM", 6), pl("dm2", "ZM", 8),
  pl("lm", "LM", 11), pl("om", "OM", 10), pl("rm", "RM", 7), pl("st", "ST", 9), pl("st2", "ST", 19), pl("zm3", "ZM", 14), pl("iv3", "IV", 15), pl("rv2", "RV", 22),
];
const full = (): MpContent => suggestLineup(emptyContent("u19"), SQUAD, () => true);

test("Grundordnungen: Spielform nach Altersklasse, elf/neun/sieben/fünf Positionen inkl. Torwart, Feld in Grenzen", () => {
  assert.equal(fmtOf("sen"), 11); assert.equal(fmtOf("u13"), 9); assert.equal(fmtOf("u11"), 7); assert.equal(fmtOf("u8"), 5);
  for (const fmt of [11, 9, 7, 5] as const) for (const k of Object.keys(FORMATIONS[fmt])) {
    const s = slotsOf(fmt, k);
    assert.equal(s.length, fmt, `${fmt} ${k}`);
    assert.equal(s[0].pos, "TW");
    assert.ok(s.every(x => x.x >= 0 && x.x <= 68 && x.y >= 0 && x.y <= 105), `${k} im Feld`);
    // Formation stimmt mit der Bezeichnung überein (Summe der Ketten)
    assert.equal(k.split("-").map(Number).reduce((a, b) => a + b, 0), fmt - 1, `${k} Summe`);
  }
  const opp = oppLineup(11, "4-4-2");
  assert.equal(opp.length, 11); assert.equal(opp[0].y, 7); assert.equal(opp[0].x, 34);
  assert.ok(opp.every(x => x.t === "opp"));
});

test("Aufstellung: Vorschlag nach Position, Torwart ins Tor, zweiter Torwart auf die Bank", () => {
  const c = full();
  const at = (pos: string) => c.lineup.filter(x => x.label === pos).map(x => x.pid);
  assert.deepEqual(at("TW"), ["tw1"]);
  assert.deepEqual(at("IV").sort(), ["iv1", "iv2"]);
  assert.deepEqual(at("ST"), ["st"]);
  assert.equal(c.lineup.filter(x => x.pid).length, 11);
  assert.equal(c.bench[0], "tw2", "zweiter Torwart zuerst auf die Bank");
  assert.equal(c.bench.length, 5, "Rest der 16 Spieler auf der Bank (max. 7)");
  assert.equal(squadOf(c).length, 16);
});

test("Ziehen: tauschen auf dem Feld, von der Bank einwechseln, auf die Bank, aus dem Kader, frei verschieben", () => {
  let c = full();
  const slotOf = (pid: string) => c.lineup.find(x => x.pid === pid)!;
  // Feld ↔ Feld: tauschen
  const stSlot = slotOf("st").id, omSlot = slotOf("om").id;
  c = placePlayer(c, "st", { k: "slot", id: omSlot });
  assert.equal(c.lineup.find(x => x.id === omSlot)!.pid, "st"); assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, "om");
  // Bank → besetzte Position: Bisheriger geht auf die Bank (an dieselbe Stelle)
  const benchIdx = c.bench.indexOf("st2");
  c = placePlayer(c, "st2", { k: "slot", id: stSlot });
  assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, "st2");
  assert.equal(c.bench[benchIdx], "om"); assert.ok(!c.bench.includes("st2"));
  // Feld → Bank: Position bleibt frei
  c = placePlayer(c, "st2", { k: "bench" });
  assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, null); assert.ok(c.bench.includes("st2"));
  // aus dem Kader
  c = placePlayer(c, "st2", { k: "out" });
  assert.ok(!squadOf(c).includes("st2"));
  // von außen frei aufs Feld: nimmt die freie Position (nah genug → einrasten)
  const free = c.lineup.find(x => x.id === stSlot)!;
  c = placePlayer(c, "st2", { k: "free", x: free.x + 3, y: free.y + 2 });
  assert.equal(c.lineup.find(x => x.id === stSlot)!.pid, "st2");
  assert.equal(c.lineup.find(x => x.id === stSlot)!.x, free.x, "eingerastet: Position bleibt");
  // Spieler auf dem Feld frei verschieben (weit weg von anderen Positionen)
  const lv = slotOf("lv");
  c = placePlayer(c, "lv", { k: "free", x: 4, y: 60 });
  assert.deepEqual([c.lineup.find(x => x.id === lv.id)!.x, c.lineup.find(x => x.id === lv.id)!.y], [4, 60]);
  // volle Elf: von außen frei aufs Feld ohne Position in der Nähe → unverändert
  const before = stableJson(c);
  const c2 = placePlayer(c, "zm3", { k: "out" });
  assert.equal(stableJson(placePlayer(c2, "zm3", { k: "free", x: 64, y: 104 })), stableJson(c2));
  assert.equal(stableJson(c), before);
  // Kapitän verliert die Binde, wenn er aus dem Kader geht
  c = { ...c, captain: "iv1" };
  assert.equal(placePlayer(c, "iv1", { k: "bench" }).captain, "iv1");
  assert.equal(placePlayer(c, "iv1", { k: "out" }).captain, null);
});

test("Grundordnung wechseln: Spieler bleiben auf passender Position, Überzählige auf die Bank", () => {
  const c = full();
  const { lineup, out } = lineupFor(11, "3-5-2", c.lineup);
  assert.equal(out.length, 0);
  assert.equal(lineup.filter(x => x.pid).length, 11);
  assert.equal(lineup.find(x => x.label === "TW")!.pid, "tw1");
  assert.ok(lineup.filter(x => x.label === "ST").some(x => x.pid === "st"), "Stürmer bleibt im Sturm");
  assert.ok(lineup.filter(x => x.label === "IV").every(x => ["iv1", "iv2", "lv", "rv", "dm1"].includes(x.pid || "")), "Dreierkette aus Abwehrspielern");
  // Wechsel auf 7er: vier müssen raus
  const small = lineupFor(7, "2-3-1", c.lineup);
  assert.equal(small.lineup.length, 7); assert.equal(small.out.length, 4);
  assert.equal(small.lineup[0].pid, "tw1");
});

test("Wechselplan: geplante Minuten, Wiedereinwechseln, Hinweise", () => {
  let c = full();
  c = { ...c, subs: [
    { id: "a", min: 60, out: "st", in: "st2", note: "" },
    { id: "b", min: 75, out: "lm", in: "zm3", note: "" },
    { id: "c", min: 80, out: "st2", in: "st", note: "" },
    { id: "d", min: 85, out: "xx", in: "iv3", note: "" },
    { id: "e", min: 70, out: "om", in: "om", note: "" },
    { id: "f", min: 95, out: null, in: "rv", note: "" },
  ] };
  const { min, issues } = plannedMinutes(c, 90);
  assert.equal(min.st, 60 + 10); assert.equal(min.st2, 20); assert.equal(min.lm, 75); assert.equal(min.zm3, 15); assert.equal(min.tw1, 90);
  assert.equal(min.iv3, 5); assert.equal(min.tw2, 0, "Bank ohne Einsatz: 0");
  assert.deepEqual(issues.map(x => x.id + ":" + x.k).sort(), ["d:out_not_on", "e:same", "f:in_on", "f:late"]);
});

test("Folien: Ausschnitt je Art, Spieler außerhalb werden am Rand aufgereiht", () => {
  const c = full();
  c.opp.items = oppLineup(11, "4-4-2");
  const corner = newSlide(c, "ecke_off", "Ecke", true);
  assert.equal(corner.view, "cor_ar", "Ecke offensiv: Eckfahne rechts mit Strafraum");
  const v = MP_VIEWS.cor_ar;
  const own = corner.items.filter(x => x.t === "own"), opp = corner.items.filter(x => x.t === "opp");
  assert.equal(own.length, 11); assert.equal(opp.length, 11);
  assert.ok(corner.items.filter(x => !(x.t === "own" && x.label === "TW")).every(x => inFrame(v, x.x, x.y)), "alle im Ausschnitt (auch seitlich)");
  assert.ok(inFrame(v, 67, 0) && inFrame(v, 13.84, 0) && inFrame(v, 54.16, 16.5), "Eckfahne und ganzer Strafraum sichtbar");
  assert.equal(newSlide(c, "ecke_def", "E", false).view, "cor_dl");
  assert.equal(newSlide(c, "gegen", "G", true, false).items.filter(x => x.t === "own").length, 0, "ohne eigene Spieler");
  assert.equal(own.find(x => x.label === "TW")!.y, 98, "eigener Torwart bleibt bei einer Ecke vorne im Tor");
  assert.equal(corner.items.find(x => x.t === "ball")!.x, 67);
  const grund = newSlide(c, "grund", "Grund", false);
  assert.equal(grund.view, "full");
  assert.deepEqual(grund.items.filter(x => x.t === "own").map(x => [x.x, x.y]), c.lineup.map(x => [x.x, x.y]), "ganzes Feld: Positionen aus der Aufstellung");
  assert.notEqual(grund.items[0].id, c.lineup[0].id, "neue IDs");
});

test("Ausschnitt: Voreinstellungen, Zoom um einen Punkt, Verschieben, Format, Grenzen", () => {
  // 16er gezoomt: kleiner als die ganze Breite, ganzer Strafraum mit Bogen und Tor im Bild
  const pen = MP_VIEWS.pen_att;
  assert.ok(zoomOf(pen) > 1.3, "16er wird größer dargestellt");
  assert.ok(inFrame(pen, 13.84, -1.6) && inFrame(pen, 54.16, 20.15), "Strafraum, Tor und Bogen");
  assert.ok(inFrame(MP_VIEWS.pen_def, 13.84, 106.6) && inFrame(MP_VIEWS.pen_def, 54.16, 84.85));
  for (const k of MP_VIEW_KEYS) assert.deepEqual(clampFrame(MP_VIEWS[k]), MP_VIEWS[k], k + " liegt in den Grenzen");
  assert.equal(new Set(MP_VIEW_KEYS).size, Object.keys(MP_VIEWS).length);
  // Zoom um die Mitte: Format bleibt, Mitte bleibt
  const f = MP_VIEWS.full, z = zoomFrame(f, 2);
  assert.equal(z.w, 37); assert.equal(z.h, 55.5);
  assert.ok(Math.abs(z.x + z.w / 2 - (f.x + f.w / 2)) < 0.1 && Math.abs(z.y + z.h / 2 - (f.y + f.h / 2)) < 0.1, "Mitte bleibt (auf 0,1 m gerundet)");
  // Zoom um einen Punkt: der Punkt bleibt an derselben relativen Stelle
  const p = zoomFrame(pen, 1.5, 34, 0), rel = (fr: typeof pen) => [(34 - fr.x) / fr.w, (0 - fr.y) / fr.h];
  assert.ok(Math.abs(rel(p)[0] - rel(pen)[0]) < 0.01 && Math.abs(rel(p)[1] - rel(pen)[1]) < 0.01);
  // Grenzen: höchstens ganzes Feld, mindestens FRAME_MIN_W, nicht weit neben das Feld
  assert.deepEqual(zoomFrame(f, 0.5), clampFrame(f), "weiter raus als das ganze Feld geht nicht");
  assert.equal(zoomFrame(pen, 10).w, FRAME_MIN_W);
  const far = panFrame(pen, 500, -500);
  assert.equal(far.x, 68 + 5 - pen.w); assert.equal(far.y, -6);
  assert.deepEqual(clampFrame({ x: NaN, y: 0, w: -1, h: 3 }), MP_VIEWS.full, "Unsinn → ganzes Feld");
  // Format: Mitte bleibt, hochkant wird höchstens so hoch wie das Feld
  const sq = formatFrame(pen, 1);
  assert.equal(formatOf(sq), "square"); assert.equal(sq.w, pen.w); assert.ok(Math.abs(sq.x + sq.w / 2 - (pen.x + pen.w / 2)) < 0.1);
  const tall = formatFrame(f, 1.5); assert.ok(tall.h <= FRAME_MAX.h && tall.w <= FRAME_MAX.w);
  assert.equal(formatOf(MP_VIEWS.full), "tall"); assert.equal(formatOf(MP_VIEWS.pen_att), "wide");
  // Voreinstellung erkennen, sonst eigener Ausschnitt
  const sl = newSlide(full(), "grund", "A", false);
  assert.equal(presetOf(MP_VIEWS.cor_ar), "cor_ar");
  assert.deepEqual(withFrame(sl, MP_VIEWS.pen_def), { ...sl, view: "pen_def", frame: null });
  const own = withFrame(sl, z);
  assert.equal(own.view, "full", "Voreinstellung bleibt als Grundlage");
  assert.deepEqual(frameOf(own), z); assert.deepEqual(frameOf(sl), MP_VIEWS.full);
});

test("Ausschnitt: Spieler außerhalb erkennen und innerhalb des Ausschnitts aufreihen", () => {
  const c = full(); c.opp.items = oppLineup(11, "4-4-2");
  const items = [...c.lineup, ...c.opp.items];
  const pen = MP_VIEWS.pen_att;
  const out = outsideFrame(items, pen);
  assert.ok(out.length > 10, "beim 16er stehen viele außerhalb");
  const fit = fitToView(items, pen);
  assert.ok(fit.filter(x => !(x.t === "own" && x.label === "TW")).every(x => inFrame(pen, x.x, x.y)), "alle (außer dem eigenen Torwart) im Ausschnitt");
  assert.equal(fit.find(x => x.t === "own" && x.label === "TW")!.y, 98, "eigener Torwart bleibt im Tor");
  const zoomIn = zoomFrame(MP_VIEWS.full, 2.5, 34, 52);
  assert.ok(fitToView(items, zoomIn).filter(x => !(x.t === "own" && x.label === "TW")).every(x => inFrame(zoomIn, x.x, x.y)), "auch bei eigenem Ausschnitt");
  assert.deepEqual(fitToView(items, "full"), items, "ganzes Feld: nichts verschieben");
});

test("Linien: Bogen links/rechts, Punkt auf der Kurve, Bereinigung", () => {
  const up = { x: 34, y: 50, x2: 34, y2: 30 };
  assert.equal(bendCtrl(up), null);
  const l = bendCtrl({ ...up, bend: 1 })!, r = bendCtrl({ ...up, bend: -2 })!;
  assert.ok(l.x < 34, "positiv = links in Laufrichtung (nach oben gespielt → kleineres x)");
  assert.ok(r.x > 34 && Math.abs(r.x - 34) > Math.abs(l.x - 34), "negativ = rechts, stärker");
  const mid = linePoint({ ...up, bend: 1 }, 0.5);
  assert.ok(mid.x < 34 && Math.abs(mid.y - 40) < 0.01);
  assert.deepEqual(linePoint(up, 0.25), { x: 34, y: 45 });
  const c = cleanContent({ ...emptyContent("u19"), slides: [{ id: "s1", cat: "ecke_off", title: "E", view: "full", note: "", vis: true,
    items: [{ id: "a", t: "pass", x: 1, y: 1, x2: 5, y2: 5, bend: 7 }, { id: "b", t: "zone", x: 1, y: 1, x2: 5, y2: 5, bend: 1 }, { id: "c", t: "run", x: 1, y: 1, bend: 0 }] }] }, "u19");
  assert.equal(c.slides[0].items[0].bend, 3, "Bogen höchstens ±3"); assert.equal(c.slides[0].items[1].bend, undefined, "Zonen nicht gebogen");
  assert.ok(!("bend" in c.slides[0].items[2]), "gerade wird nicht gespeichert");
});

test("Zeichnen: Bogen durch einen Punkt, Freihand, Kreis, Schritte, Verschieben, Bereinigung", () => {
  // Bogen: Scheitel der Kurve liegt auf dem gezogenen Punkt
  const up = { x: 34, y: 50, x2: 34, y2: 30 };
  const b = bendThrough(up, { x: 30, y: 40 });
  assert.ok(b > 0, "nach links gezogen = positiver Bogen");
  const apex = linePoint({ ...up, bend: b }, 0.5);
  assert.ok(Math.abs(apex.x - 30) < 0.15 && Math.abs(apex.y - 40) < 0.01, "Scheitel am Finger");
  assert.equal(bendThrough(up, { x: 34.2, y: 41 }), 0, "nahe der Geraden = gerade");
  assert.equal(bendThrough(up, { x: -50, y: 40 }), 3, "höchstens 3");
  assert.equal(bendThrough({ x: 10, y: 10, x2: 10.2, y2: 10 }, { x: 0, y: 0 }), 0, "zu kurz");
  // Arten
  assert.ok(isArrow("pass") && isArrow("line") && !isArrow("zone") && !isArrow("free"));
  assert.ok(isArea("zone") && isArea("circle") && !isArea("pass"));
  // Freihand ausdünnen: Anfang/Ende bleiben, höchstens FREE_MAX Punkte
  const P = Array.from({ length: 300 }, (_, i) => ({ x: 10 + i * 0.2, y: 50 + Math.sin(i / 10) * 5 }));
  const T = thinPoints(P, 1.2);
  assert.ok(T.length / 2 <= FREE_MAX && T.length >= 8, "ausgedünnt: " + T.length / 2);
  assert.deepEqual([T[0], T[1]], [10, 50]); assert.equal(T[T.length - 2], 69.8);
  // Verschieben: Freihand als Ganzes, Linie mit Ziel, Rand begrenzt
  const fr = { id: "f", t: "free" as const, x: 10, y: 10, x2: 20, y2: 20, pts: [10, 10, 15, 12, 20, 20] };
  const fm = shiftItem(fr, 5, -2);
  assert.deepEqual(fm.pts, [15, 8, 20, 10, 25, 18]); assert.equal(fm.x, 15); assert.equal(fm.y2, 18);
  assert.deepEqual(moveItem([fr], "f", 12, 11)[0].pts, [12, 11, 17, 13, 22, 21], "moveItem nutzt dasselbe");
  const ln = shiftItem({ id: "l", t: "pass", x: 66, y: 10, x2: 60, y2: 20 }, 10, 0);
  assert.equal(ln.x, 70); assert.equal(ln.x2, 64, "Linie bleibt gleich lang, wenn der Start an den Rand stößt");
  assert.deepEqual(itemMid(fr), { x: 15, y: 12 }); assert.deepEqual(itemMid({ id: "p", t: "pass", x: 0, y: 0, x2: 10, y2: 0 }), { x: 5, y: 0 });
  // Bereinigung: Freihand braucht 2 Punkte, Schritt 1 … 20 nur an Pfeilen/Freihand, Kreis mit Rand, Bogen auf 0,1
  const c = cleanContent({ ...emptyContent("u19"), slides: [{ id: "s1", cat: "grund", title: "", view: "full", note: "", vis: true, items: [
    { id: "a", t: "free", x: 0, y: 0, pts: [1, 2, Infinity, 9, 3, 4, 5, 6], n: 2, solid: true, col: "r" },
    { id: "b", t: "free", x: 0, y: 0, pts: [1, 2] },
    { id: "c", t: "pass", x: 1, y: 1, x2: 9, y2: 9, n: 25, bend: 1.234 },
    { id: "d", t: "circle", x: 30, y: 50, x2: 35, y2: 50, n: 3 },
    { id: "e", t: "run", x: 1, y: 1, x2: 9, y2: 9, n: 0 },
  ] }] }, "u19");
  const L = c.slides[0].items;
  assert.deepEqual(L.map(x => x.id), ["a", "c", "d", "e"], "Freihand mit einem Punkt fällt weg");
  assert.deepEqual(L[0].pts, [1, 2, 3, 4, 5, 6]); assert.equal(L[0].x2, 5); assert.equal(L[0].y2, 6); assert.equal(L[0].n, 2); assert.equal(L[0].solid, true);
  assert.equal(L[1].n, undefined, "Schritt höchstens 20"); assert.equal(L[1].bend, 1.2);
  assert.equal(L[2].x2, 35); assert.equal(L[2].n, undefined, "Kreis ohne Schritt");
  assert.equal(L[3].n, undefined);
  // Gegner auf einem eigenen Spieler: etwas Richtung gegnerisches Tor
  const sep = separate([{ id: "o", t: "own", x: 30, y: 50 }], [{ id: "a", t: "opp", x: 31, y: 51 }, { id: "b", t: "opp", x: 10, y: 50 }]);
  assert.equal(sep[0].y, 46.6); assert.equal(sep[0].x, 31); assert.deepEqual(sep[1], { id: "b", t: "opp", x: 10, y: 50 });
  // höchstens MP_LIMITS.free Freihandlinien je Folie
  const many = cleanContent({ ...emptyContent("u19"), slides: [{ id: "s1", cat: "grund", title: "", view: "full", note: "", vis: true,
    items: Array.from({ length: 12 }, (_, i) => ({ id: "f" + i, t: "free" as const, x: 0, y: 0, pts: [1, 1, 2, 2] })) }] }, "u19");
  assert.equal(many.slides[0].items.length, MP_LIMITS.free);
});

test("Folien individuell: eigener Ausschnitt, Icongröße, Design; ältere Freigaben gelten nicht als geändert", () => {
  const base = full(); base.slides = [newSlide(base, "grund", "A", false)];
  const legacyPub = publishedOf(base, DEFAULT_SECTIONS);
  const plan: MatchPlan = { ...newPlan("p", null, "u19", "T"), c: base, share: { sections: DEFAULT_SECTIONS, from: null, until: "2030-01-01T00:00:00Z", squadOnly: false, ownTasks: true }, published: legacyPub };
  const cleaned = cleanContent(JSON.parse(JSON.stringify(base)), "u19");
  assert.equal(changedSincePublish({ ...plan, c: cleaned }), false, "Bereinigen ändert ältere Pläne nicht");
  assert.equal("look" in cleaned, false, "Rasen ist Standard und wird nicht gespeichert");
  const z = zoomFrame(MP_VIEWS.full, 1.8, 30, 20);
  const c = cleanContent({ ...base, look: "white", slides: [{ ...base.slides[0], frame: z, size: 1.33 }, { ...base.slides[0], id: "x2", frame: MP_VIEWS.pen_att }, { ...base.slides[0], id: "x3", frame: { x: 1, y: 2, w: "a" as never, h: 3 }, size: 0 }] }, "u19");
  assert.deepEqual(c.slides[0].frame, z); assert.equal(c.slides[0].size, 1.3);
  assert.equal(c.slides[1].view, "pen_att"); assert.equal(c.slides[1].frame, undefined, "Voreinstellung statt Rahmen");
  assert.equal(c.slides[2].frame, undefined); assert.equal(c.slides[2].size, undefined);
  assert.equal(c.look, "white"); assert.equal(publishedOf(c, DEFAULT_SECTIONS).look, "white");
  assert.equal(cleanContent({ ...base, look: "neon" as never }, "u19").look, undefined);
  assert.equal(changedSincePublish({ ...plan, c }), true, "Ausschnitt und Design sehen Spieler → geändert");
  // Folie aus einem anderen Plan übernehmen: neue IDs, Inhalt gleich
  const cp = copySlide(c.slides[0], "Kopie");
  assert.notEqual(cp.id, c.slides[0].id); assert.equal(cp.title, "Kopie"); assert.deepEqual(cp.frame, z);
  assert.ok(cp.items.every((x, i) => x.id !== c.slides[0].items[i].id && x.x === c.slides[0].items[i].x));
});

test("Freigabe: Bereiche, Folien nur sichtbare, Aufgaben nur eigene, Zeitraum, nur Kader, Änderungen erkennen", () => {
  const c = full();
  c.tasks = { iv1: "Kette halten", st: "Tief gehen", tw2: "  " };
  c.slides = [newSlide(c, "grund", "A", false), { ...newSlide(c, "ball", "B", false), vis: false }];
  const pub = publishedOf(c, DEFAULT_SECTIONS);
  assert.deepEqual(pub.sections, ["lineup", "slides", "idea", "opp", "tasks"]);
  assert.equal(pub.subs, undefined, "Wechselplan bleibt intern");
  assert.equal(pub.slides!.length, 1, "nur sichtbare Folien");
  assert.deepEqual(Object.keys(pub.tasks!).sort(), ["iv1", "st"], "leere Aufgaben fallen weg");
  assert.deepEqual(forPlayer(pub, "st", true).tasks, { st: "Tief gehen" });
  assert.deepEqual(forPlayer(pub, "lv", true).tasks, {});
  assert.equal(Object.keys(forPlayer(pub, "lv", false).tasks!).length, 2);
  const m = { id: "m1", date: "2026-10-10", zeit: "15:00", gegner: "SV", heim: true, comp: "liga" as const };
  const until = defaultUntil(m, 90, NOW);
  assert.equal(new Date(until).getTime(), new Date(2026, 9, 10, 17, 15).getTime(), "Spielende 15:00 + 90 + 15 Pause + 30");
  const p: MatchPlan = { ...newPlan("p1", m, "u19", "gegen SV"), c, share: { sections: DEFAULT_SECTIONS, from: null, until, squadOnly: true, ownTasks: true }, published: pub, publishedAt: NOW.toISOString() };
  assert.equal(shareState(p, NOW), "live");
  assert.equal(shareState(p, new Date(2026, 9, 10, 17, 16)), "ended");
  assert.equal(shareState({ ...p, share: { ...p.share!, from: new Date(2026, 9, 8).toISOString() } }, NOW), "scheduled");
  assert.equal(shareState({ ...p, published: null }, NOW), "draft");
  assert.ok(visibleTo(p, "st", NOW)); assert.ok(!visibleTo(p, "nobody", NOW), "nur Kader");
  assert.ok(visibleTo({ ...p, share: { ...p.share!, squadOnly: false } }, "nobody", NOW));
  assert.equal(changedSincePublish(p), false);
  // Datenbank sortiert Schlüssel um – kein falscher Hinweis
  const reordered = JSON.parse(JSON.stringify(pub, Object.keys(pub).sort()));
  assert.equal(changedSincePublish({ ...p, published: { ...reordered, ...pub } }), false);
  assert.equal(changedSincePublish({ ...p, c: { ...c, tasks: { ...c.tasks, lm: "Neu" } } }), true);
  assert.equal(changedSincePublish({ ...p, c: { ...c, subs: [{ id: "x", min: 60, out: null, in: null, note: "" }] } }), false, "interner Wechselplan zählt nicht");
  // Spielerliste und Gesehen-Statistik
  const logs = { p1: [{ pid: "st", kind: "open", at: NOW.toISOString() }, { pid: "st", kind: "shot", at: NOW.toISOString() }] };
  const av = availFor([p], logs, "st", NOW);
  assert.equal(av.length, 1); assert.equal(av[0].seen, true);
  assert.equal(availFor([p], logs, "iv1", NOW)[0].seen, false);
  const st = seenStats(logs.p1, squadOf(c));
  assert.deepEqual([st.seen, st.open.length, st.shots], [["st"], squadOf(c).length - 1, 1]);
});

test("Bereinigen: Grenzen, unbekannte Werte, doppelte Spieler, Kapitän nur aus dem Kader", () => {
  const c = cleanContent({
    fmt: 13 as never, formation: "9-9-9", lineup: [{ id: "a", t: "own", x: -50, y: 500, pid: "p1" }, { id: "b", t: "own", x: 10, y: 10, pid: "p1" }, { id: "c", t: "opp", x: 1, y: 1 }],
    bench: ["p1", "p2", "p2"], captain: "zz", slides: [{ id: "s 1", cat: "xx" as never, title: "x".repeat(99), view: "zoom" as never, note: "", vis: true, items: [{ id: "i", t: "pass", x: 1, y: 2 }, { id: "j", t: "laser" as never, x: 0, y: 0 }] }],
    idea: { motto: "M", keys: ["a", " ", "b", "c", "d"], ball: "", gegen: "", umschalt: "" }, tasks: { p1: " x ", p2: "" }, subs: [{ id: "w", min: 999, out: "p1", in: null, note: "" }], mode: "big" as never, size: 9,
  }, "u11");
  assert.equal(c.fmt, 7, "ungültige Spielform → nach Altersklasse");
  assert.equal(c.formation, "2-3-1");
  assert.deepEqual(c.lineup.map(x => [x.x, x.y, x.pid]), [[-2, 108, "p1"], [10, 10, null]], "Koordinaten begrenzt, Spieler nur einmal, Gegner raus");
  assert.deepEqual(c.bench, ["p2"]);
  assert.equal(c.captain, null);
  assert.equal(c.slides[0].cat, "sonst"); assert.equal(c.slides[0].view, "full"); assert.equal(c.slides[0].title.length, 60);
  assert.equal(c.slides[0].items.length, 1); assert.equal(c.slides[0].items[0].x2, 1, "Linie bekommt Endpunkt");
  assert.match(c.slides[0].id, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(c.idea.keys, ["a", "b", "c"]);
  assert.deepEqual(c.tasks, { p1: "x" });
  assert.equal(c.subs[0].min, 150);
  assert.equal(c.mode, "name"); assert.equal(c.size, 1.6);
});

test("Kopie: Aufstellung, Folien, Spielidee, Aufgaben übernehmen; Gegner und Wechsel leer", () => {
  const c = full(); c.tasks = { st: "Tief" }; c.slides = [newSlide(c, "grund", "A", false)]; c.subs = [{ id: "w", min: 60, out: "st", in: "st2", note: "" }];
  c.opp.style = "4-4-2"; c.idea.motto = "Mutig";
  const prev: MatchPlan = { ...newPlan("p0", null, "u19", "Alt"), c };
  const n = copyPlan("p1", prev, null, "Neu");
  assert.equal(n.title, "Neu"); assert.equal(n.c.idea.motto, "Mutig"); assert.deepEqual(n.c.tasks, { st: "Tief" });
  assert.equal(n.c.opp.style, ""); assert.equal(n.c.subs.length, 0);
  assert.notEqual(n.c.slides[0].id, c.slides[0].id); assert.equal(n.share, null);
  assert.deepEqual(squadOf(n.c), squadOf(c));
});

test("Demo: freigegebener Plan fürs nächste Spiel mit Protokoll, früherer Plan beendet", () => {
  const D = buildDemo(demoTeam("u19", "basis", "de"), "de", NOW);
  demoExtras(D, "de", NOW);
  const next = D.plans.find(p => p.id === "mp-demo-next")!, last = D.plans.find(p => p.id === "mp-demo-last")!;
  assert.ok(next && last);
  assert.equal(shareState(next, NOW), "live"); assert.equal(shareState(last, NOW), "ended");
  assert.equal(next.c.lineup.filter(x => x.pid).length, 11);
  assert.equal(next.c.slides.length, 5);
  assert.ok(next.c.slides.some(sl => sl.view === "pen_att" && sl.items.some(x => x.bend)), "Freistoß im gezoomten 16er mit Bogenschuss");
  assert.ok(Object.keys(next.c.tasks).length >= 4);
  assert.ok(next.c.subs.length >= 2);
  assert.equal(changedSincePublish(next), false);
  assert.ok((D.planLogs[next.id] || []).some(l => l.kind === "shot"));
  assert.equal(stableJson(cleanContent(next.c, "u19")), stableJson(next.c), "Demo-Inhalt ist bereits bereinigt");
  // Kinder: 7er
  const K = buildDemo(demoTeam("u11", "basis", "de"), "de", NOW); demoExtras(K, "de", NOW);
  const kn = K.plans.find(p => p.id === "mp-demo-next")!;
  assert.equal(kn.c.fmt, 7); assert.equal(kn.c.lineup.length, 7);
});

test("Zeichentool: Linienstil, Stärke, Drehung, Material und „hinzugefügt von“ – intern ja, für Spieler nicht", () => {
  const c = full();
  const raw = [
    { id: "a", t: "pass", x: 10, y: 10, x2: 30, y2: 40, ls: "dot", w: 3, col: "o", bend: 1.26, by: "st-1" },
    { id: "b", t: "run", x: 10, y: 10, x2: 20, y2: 20, ls: "zickzack", w: 7, by: "<script>" },
    { id: "c", t: "mgoal", x: 30, y: 30, rot: 100 },
    { id: "d", t: "neu", x: 5, y: 5, n: 7, label: "TW12345" },
    { id: "e", t: "ladder", x: 40, y: 60, rot: -90 },
    { id: "f", t: "zone", x: 1, y: 1, x2: 20, y2: 20, ls: "long", col: "k" },
    // Strich ohne Spitze (Freihand), Form nur mit Rand; an anderen Arten fallen die Angaben weg
    { id: "g", t: "free", x: 1, y: 1, pts: [1, 1, 5, 5, 9, 2], nh: true },
    { id: "h", t: "circle", x: 30, y: 30, x2: 35, y2: 30, nf: true },
    { id: "i", t: "pass", x: 1, y: 1, x2: 9, y2: 9, nh: true, nf: true },
    // Textgröße (klein/groß; mittel = ohne Angabe)
    { id: "j", t: "text", x: 10, y: 10, label: "Pressing!", w: 3 },
    { id: "k", t: "text", x: 12, y: 12, label: "x", w: 2 },
  ];
  const L = cleanContent({ ...c, slides: [{ ...newSlide(c, "grund", "A", false), items: raw as never, by: "st-1" }] }, "u19").slides[0];
  const [a, b, mg, nu, la, zo, fr, ci, pa, tx, tx2] = L.items;
  assert.deepEqual([fr.nh, ci.nf, pa.nh, pa.nf], [true, true, undefined, undefined]);
  assert.deepEqual([tx.w, tx.label, tx2.w], [3, "Pressing!", undefined]);
  assert.deepEqual([textScale(tx) > 1, textScale({ w: 1 }) < 1, textScale({})], [true, true, 1]);
  assert.deepEqual([a.ls, a.w, a.col, a.bend, a.by], ["dot", 3, "o", 1.3, "st-1"]);
  assert.equal(b.ls, undefined, "unbekannter Stil fällt weg"); assert.equal(b.w, undefined); assert.equal(b.by, undefined, "ungültige Kennung fällt weg");
  assert.equal(dashOf(b), "short", "Laufweg ohne Stil: gestrichelt wie bisher"); assert.equal(dashOf(a), "dot"); assert.equal(dashOf({ t: "pass" }), "solid");
  assert.equal(mg.rot, 105, "Drehung in 15°-Schritten"); assert.equal(la.rot, 270);
  assert.ok(isMaterial("mgoal") && isMaterial("ladder") && !isMaterial("cone") && !isMaterial("own"));
  assert.deepEqual([nu.n, nu.label], [7, "TW12"]);
  assert.deepEqual([zo.ls, zo.col], ["long", "k"]);
  assert.equal(L.by, "st-1");
  assert.ok(MP_DASHES.length === 4 && MP_WIDTHS.length === 3);
  // Veröffentlichung: wer was angelegt hat, bleibt im Trainerteam
  const pub = publishedOf({ ...c, slides: [L], lineup: c.lineup.map(x => ({ ...x, by: "st-1" })) }, DEFAULT_SECTIONS);
  assert.ok(!JSON.stringify(pub).includes("st-1"));
  assert.equal(pub.slides![0].items[0].ls, "dot", "Stil sehen Spieler");
});

test("Zeichentool: gemalter Strich wird gerade oder ein gleichmäßiger Bogen", () => {
  const a = { x: 10, y: 60 }, b = { x: 40, y: 60 };
  const along = (f: (u: number) => number, n = 31) => Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return { x: a.x + (b.x - a.x) * u, y: a.y - f(u) }; });
  // leicht zittrig = gerade
  assert.equal(strokeBend(a, b, along(u => 0.6 * Math.sin(u * 40))), 0);
  // Bogen aus dem eigenen Modell wird genau getroffen (beide Richtungen)
  for (const bend of [1.5, -2, 0.9, 3]) {
    const it = { x: a.x, y: a.y, x2: b.x, y2: b.y, bend }, pts = Array.from({ length: 41 }, (_, i) => linePoint(it, i / 40));
    assert.equal(strokeBend(a, b, pts), bend, "Bogen " + bend);
    // rückwärts gezeichnet: gleicher Bogen, Vorzeichen andersherum (Kontrollpunkt bleibt)
    assert.equal(strokeBend(b, a, [...pts].reverse()), -bend);
  }
  // ungleichmäßig gezeichneter Bogen (Scheitel nicht in der Mitte) wird gleichmäßig: Bogen zur selben Seite
  const skew = strokeBend(a, b, along(u => 6 * Math.sin(Math.PI * u * u)));
  assert.ok(skew > 0.8 && skew <= 3, "Bogen nach links in Laufrichtung (oben, Bildschirm): " + skew);
  // S-Kurve: passendster einzelner Bogen = gerade
  assert.equal(strokeBend(a, b, along(u => 3 * Math.sin(2 * Math.PI * u))), 0);
  // Halbkreis: stärkster Bogen
  assert.equal(Math.abs(strokeBend(a, b, along(u => 30 * Math.sqrt(u * (1 - u))))), 3);
  // kurzer Strich: Mindestwölbung (Zittern am Handy) entscheidet
  const c = { x: 10, y: 10 }, d = { x: 18, y: 10 }, small = Array.from({ length: 21 }, (_, i) => ({ x: 10 + 8 * i / 20, y: 10 - 1.2 * Math.sin(Math.PI * i / 20) }));
  assert.ok(strokeBend(c, d, small) !== 0); assert.equal(strokeBend(c, d, small, 1.5), 0);
  // zu kurz oder zu wenige Punkte: gerade
  assert.equal(strokeBend(a, { x: 10.2, y: 60 }, along(u => u)), 0); assert.equal(strokeBend(a, b, [a, b]), 0);
});
