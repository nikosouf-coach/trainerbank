// Übungsskizzen: Umrechnung des alten Formats (eigene Spielfelder quer/halb/16er/frei) in das Format der
// Matchplan-Tafel (Feld hochkant 68 × 105 m, eigenes Tor unten) – so gibt es ein Zeichentool für alles.
import { MP_LIMITS, MP_VIEWS, clampFrame, cleanItems, isRotatable } from "./matchplan";
import type { BoardItem, Drawing, DrawingV1, MpFrame, MpItem, MpLook, MpTool, MpView, Sketch } from "./types";

/** Neue, leere Skizze: Angriffshälfte (wie bisher „Hälfte“) */
export const emptySketch = (): Sketch => ({ v: 2, view: "att", items: [] });

const isV2 = (d: Drawing): d is Sketch => (d as Sketch).v === 2;

/** Altes Feld → Ausschnitt und Umrechnung der Koordinaten */
const OLD: Record<DrawingV1["pitch"], { view: MpView; frame?: MpFrame; plain?: boolean; map: (x: number, y: number) => [number, number]; rot: number }> = {
  // Hälfte (68 × 52,5, Tor oben): gleiche Koordinaten wie die Angriffshälfte
  half: { view: "att", map: (x, y) => [x, y], rot: 0 },
  // 16er-Bereich (50 × 30, Tor oben, Mitte bei 25): 9 m nach rechts
  box: { view: "full", frame: { x: 6, y: -3, w: 56, h: 36 }, map: (x, y) => [x + 9, y], rot: 0 },
  // ganzes Feld quer (105 × 68): gedreht – das linke Tor wird das eigene (unten)
  full: { view: "full", map: (x, y) => [y, 105 - x], rot: 90 },
  // freie Fläche (40 × 30) mitten auf dem Feld, ohne Feldlinien
  free: { view: "full", frame: { x: 11, y: 34.5, w: 46, h: 36 }, plain: true, map: (x, y) => [x + 14, y + 37.5], rot: 0 },
};
const KIND: Record<BoardItem["t"], MpTool> = { a: "own", b: "opp", gk: "neu", cone: "cone", ball: "ball", goal: "goal", pass: "pass", run: "run", drib: "drib", zone: "zone" };

function fromV1(d: DrawingV1): Sketch {
  const o = OLD[d.pitch] || OLD.half;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const items: MpItem[] = (d.items || []).map(b => {
    const t = KIND[b.t] || "cone", [x, y] = o.map(b.x, b.y);
    const it: MpItem = { id: b.id, t, x: r1(x), y: r1(y) };
    if (b.x2 != null && b.y2 != null) { const [x2, y2] = o.map(b.x2, b.y2); it.x2 = r1(x2); it.y2 = r1(y2); }
    if (b.t === "gk") it.label = "TW"; else if (b.n != null && (t === "own" || t === "opp")) it.n = b.n;
    if (isRotatable(t) && o.rot) it.rot = o.rot;
    return it;
  });
  const s: Sketch = { v: 2, view: o.view, items: cleanItems(items, MP_LIMITS.items) };
  if (o.frame) s.frame = clampFrame(o.frame);
  if (o.plain) s.plain = true;
  return s;
}

/** Gespeicherte Skizze (neu oder alt, auch fehlerhaft) → Skizze im neuen Format; null = keine */
export function toSketch(d: Drawing | null | undefined): Sketch | null {
  if (!d || typeof d !== "object") return null;
  if (isV2(d)) {
    const s: Sketch = { v: 2, view: MP_VIEWS[d.view] ? d.view : "full", items: cleanItems(d.items, MP_LIMITS.items) };
    if (d.frame) s.frame = clampFrame(d.frame);
    if (d.look && (["grass", "dark", "white"] as MpLook[]).includes(d.look)) s.look = d.look;
    if (d.plain) s.plain = true;
    return s;
  }
  return Array.isArray((d as DrawingV1).items) ? fromV1(d as DrawingV1) : null;
}
