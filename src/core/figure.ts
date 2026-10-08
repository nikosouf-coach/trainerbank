// Körperfigur zum Antippen (vorne/hinten), altersgerecht: Kinder (großer Kopf, kürzere Beine), Jugend, Erwachsene.
// Reine Geometrie ohne React: Formen zum Zeichnen und Trefferflächen (Antippen) in einem 100 × 220-Koordinatensystem.
// Seiten aus Sicht des Spielers: vorne steht seine rechte Seite links im Bild, hinten rechts im Bild.
import type { BodyCode, Side } from "./body";
import type { Group } from "./types";

export type FigureKind = "kid" | "teen" | "adult";
export type View = "front" | "back";
export const FIG_W = 100, FIG_H = 220;

/** Figur passend zur Altersklasse */
export const figureFor = (grp: Group): FigureKind => grp === "u11" ? "kid" : grp === "u15" ? "teen" : "adult";

interface Prop { head: number; neck: number; torso: number; leg: number; sh: number; hip: number; limb: number; arm: number }
const PROPS: Record<FigureKind, Prop> = {
  // Kopfhöhe ≈ 1/5 (Kind), 1/6,5 (Jugend), 1/7,5 (Erwachsene) der Körpergröße
  kid: { head: 40, neck: 5, torso: 60, leg: 104, sh: 40, hip: 30, limb: 12, arm: 0.95 },
  teen: { head: 32, neck: 6, torso: 64, leg: 108, sh: 45, hip: 32, limb: 11, arm: 1.05 },
  adult: { head: 28, neck: 7, torso: 66, leg: 112, sh: 50, hip: 34, limb: 11, arm: 1.12 },
};

/** Zeichenform: Ellipse oder abgerundetes Rechteck oder Pfad */
export type Shape =
  | { t: "ell"; cx: number; cy: number; rx: number; ry: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { t: "path"; d: string };
export interface Hit { x: number; y: number; w: number; h: number }
export interface Part { k: BodyCode; side: Side | null; view: View; shape: Shape; hit: Hit }

const r1 = (n: number): number => Math.round(n * 10) / 10;
const rect = (x: number, y: number, w: number, h: number, r = 3): Shape => ({ t: "rect", x: r1(x), y: r1(y), w: r1(w), h: r1(h), r });
const ell = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: "ell", cx: r1(cx), cy: r1(cy), rx: r1(rx), ry: r1(ry) });
const hit = (x: number, y: number, w: number, h: number): Hit => ({ x: r1(x), y: r1(y), w: r1(w), h: r1(h) });

/** Alle Teile einer Figur in einer Ansicht */
export function figureParts(kind: FigureKind, view: View): Part[] {
  const P = PROPS[kind], out: Part[] = [];
  const top = 3, headY = top + P.head / 2, torsoTop = top + P.head + P.neck, hipY = torsoTop + P.torso, L = P.leg;
  const shHalf = P.sh / 2, hipHalf = P.hip / 2;
  const add = (k: BodyCode, side: Side | null, shape: Shape, h: Hit): void => { out.push({ k, side, view, shape, hit: h }); };
  // Seite im Bild: vorne liegt die rechte Körperseite links im Bild
  const sides: { sd: Side; dir: -1 | 1 }[] = view === "front" ? [{ sd: "r", dir: -1 }, { sd: "l", dir: 1 }] : [{ sd: "l", dir: -1 }, { sd: "r", dir: 1 }];

  // Kopf und Hals
  add("head", null, ell(50, headY, P.head * 0.4, P.head / 2), hit(50 - P.head * 0.42, top, P.head * 0.84, P.head));
  add("neck", null, rect(50 - P.limb * 0.55, top + P.head - 2, P.limb * 1.1, P.neck + 4, 2), hit(50 - P.limb * 0.8, top + P.head, P.limb * 1.6, P.neck));

  // Rumpf (vorne Brust/Bauch, hinten oberer/unterer Rücken)
  const split = torsoTop + P.torso * (view === "front" ? 0.44 : 0.48);
  const tw0 = shHalf - 4, tw1 = hipHalf;
  const xAt = (y: number): number => tw0 + (tw1 - tw0) * ((y - torsoTop) / P.torso);
  const trap = (y0: number, y1: number): Shape => ({ t: "path", d: `M${r1(50 - xAt(y0))},${r1(y0)} L${r1(50 + xAt(y0))},${r1(y0)} L${r1(50 + xAt(y1))},${r1(y1)} L${r1(50 - xAt(y1))},${r1(y1)} Z` });
  const upper: BodyCode = view === "front" ? "chest" : "upback", lower: BodyCode = view === "front" ? "abdomen" : "lowback";
  add(upper, null, trap(torsoTop + 2, split), hit(50 - tw0 + 3, torsoTop + 4, (tw0 - 3) * 2, split - torsoTop - 4));
  add(lower, null, trap(split, hipY), hit(50 - xAt(split) + 1, split, (xAt(split) - 1) * 2, hipY - split - 4));

  for (const { sd, dir } of sides) {
    // Schulter, Arm, Hand
    const shX = 50 + dir * (shHalf - 3), armX = 50 + dir * (shHalf + P.limb * 0.35), armTop = torsoTop + 6, armLen = P.torso * P.arm;
    add("shoulder", sd, ell(shX, torsoTop + 5, P.limb * 0.85, P.limb * 0.75), hit(shX - P.limb * 0.85, torsoTop - 1, P.limb * 1.7, P.limb * 1.3));
    add("arm", sd, rect(armX - P.limb * 0.42, armTop, P.limb * 0.84, armLen, P.limb * 0.42), hit(armX - P.limb * 0.6, armTop + P.limb * 0.6, P.limb * 1.2, armLen - P.limb * 0.6));
    add("hand", sd, ell(armX, armTop + armLen + P.limb * 0.55, P.limb * 0.45, P.limb * 0.65), hit(armX - P.limb * 0.65, armTop + armLen, P.limb * 1.3, P.limb * 1.4));

    // Bein: Mitte des Beins, Breite Oberschenkel
    const lx = 50 + dir * (hipHalf / 2 + 0.5), th = P.limb * 1.45, sh = P.limb * 1.05;
    const y = (f: number): number => hipY + L * f;
    const outerX = dir < 0 ? lx - th / 2 : lx, innerX = dir < 0 ? lx : lx - th / 2;
    if (view === "front") {
      add("hip", sd, rect(outerX, hipY - 9, th / 2, 14, 3), hit(outerX - (dir < 0 ? 2 : 0), hipY - 9, th / 2 + 2, L * 0.13 + 9));
      add("groin", sd, rect(innerX, y(0.0), th / 2, L * 0.14, 2), hit(innerX, y(0.0), th / 2, L * 0.14));
      add("quad", sd, rect(lx - th / 2, y(0.13), th, L * 0.3, 4), hit(lx - th / 2, y(0.14), th, L * 0.28));
      add("knee", sd, ell(lx, y(0.47), th * 0.42, L * 0.05), hit(lx - th / 2, y(0.42), th, L * 0.1));
      add("shin", sd, rect(lx - sh / 2, y(0.52), sh, L * 0.36, 3), hit(lx - th / 2, y(0.52), th, L * 0.36));
      add("ankle", sd, ell(lx, y(0.91), sh * 0.5, L * 0.03), hit(lx - th / 2, y(0.88), th, L * 0.06));
      add("foot", sd, ell(lx + dir * 1.5, y(0.97), sh * 0.75, L * 0.035), hit(lx - th / 2 + dir * 1.5, y(0.94), th, L * 0.07));
    } else {
      add("glute", sd, ell(lx, hipY + 2, th * 0.56, 11), hit(lx - th / 2, hipY - 9, th, L * 0.12 + 9));
      add("hams", sd, rect(lx - th / 2, y(0.12), th, L * 0.3, 4), hit(lx - th / 2, y(0.12), th, L * 0.3));
      add("knee", sd, rect(lx - th * 0.4, y(0.43), th * 0.8, L * 0.08, 3), hit(lx - th / 2, y(0.42), th, L * 0.1));
      add("calf", sd, ell(lx, y(0.64), sh * 0.62, L * 0.12), hit(lx - th / 2, y(0.52), th, L * 0.26));
      add("achilles", sd, rect(lx - sh * 0.22, y(0.78), sh * 0.44, L * 0.12, 2), hit(lx - th / 2, y(0.78), th, L * 0.12));
      add("heel", sd, ell(lx, y(0.95), sh * 0.5, L * 0.04), hit(lx - th / 2, y(0.9), th, L * 0.1));
    }
  }
  return out;
}

/**
 * Silhouette hinter den Regionen (Kopf, Hals, Rumpf, Arme mit Händen, Beine mit Füßen als durchgehende Formen),
 * damit die Figur als Körper wirkt und keine Lücken zwischen den Regionen sichtbar sind.
 */
export function figureSilhouette(kind: FigureKind): Shape[] {
  const P = PROPS[kind], out: Shape[] = [];
  const top = 3, torsoTop = top + P.head + P.neck, hipY = torsoTop + P.torso, L = P.leg, shHalf = P.sh / 2, hipHalf = P.hip / 2;
  out.push(ell(50, top + P.head / 2, P.head * 0.4, P.head / 2));
  out.push(rect(50 - P.limb * 0.6, top + P.head - 4, P.limb * 1.2, P.neck + 8, 3));
  const tw0 = shHalf - 2, tw1 = hipHalf + 1;
  out.push({ t: "path", d: `M${r1(50 - tw0)},${r1(torsoTop)} Q50,${r1(torsoTop - 3)} ${r1(50 + tw0)},${r1(torsoTop)} L${r1(50 + tw1)},${r1(hipY + 4)} L${r1(50 - tw1)},${r1(hipY + 4)} Z` });
  for (const dir of [-1, 1]) {
    const armX = 50 + dir * (shHalf + P.limb * 0.35), armTop = torsoTop + 3, armLen = P.torso * P.arm;
    out.push(ell(50 + dir * (shHalf - 3), torsoTop + 5, P.limb * 0.95, P.limb * 0.8));
    out.push(rect(armX - P.limb * 0.45, armTop, P.limb * 0.9, armLen + P.limb * 0.6, P.limb * 0.45));
    out.push(ell(armX, armTop + 3 + armLen + P.limb * 0.55, P.limb * 0.5, P.limb * 0.7));
    const lx = 50 + dir * (hipHalf / 2 + 0.5), th = P.limb * 1.5, sh = P.limb * 1.1;
    out.push(rect(lx - th / 2, hipY - 6, th, L * 0.5 + 6, th * 0.45));
    out.push(rect(lx - sh / 2, hipY + L * 0.45, sh, L * 0.5, sh * 0.45));
    out.push(ell(lx + dir * 1.5, hipY + L * 0.97, sh * 0.8, L * 0.04));
  }
  return out;
}

/** Teile, die zu einem Code passen (Seite beachten; „b“ = beide Seiten) */
export function partsFor(parts: Part[], code: string): Part[] {
  const [k, sd] = code.split(":");
  return parts.filter(p => p.k === k && (!p.side || !sd || sd === "b" || p.side === sd));
}
