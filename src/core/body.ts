// Körperregionen für Beschwerden und ihre Wirkung auf die Steuerung.
// Jede Region hat eine Gewebe-/Belastungsart; daraus folgt, was der Spieler heute (nicht) tun sollte.
// Grundlagen: Muskelverletzungen der unteren Extremität (Ekstrand et al. 2011; Mueller-Wohlfahrt et al. 2013),
// „Neck Check“ bei Infekten (Eichner 1993; IOC-Konsens Schwellnus et al. 2016),
// Gehirnerschütterung: kein Sport am selben Tag, stufenweise Rückkehr (Patricios et al. 2023, CISG Amsterdam).
import type { Complaint } from "./types";

export type BodyCode =
  | "head" | "neck" | "shoulder" | "arm" | "hand" | "chest" | "upback" | "lowback" | "abdomen"
  | "groin" | "hip" | "glute" | "hams" | "quad" | "knee" | "calf" | "shin" | "achilles" | "ankle" | "foot" | "heel"
  | "ill_up" | "ill_down";
export type BodyZone = "head" | "upper" | "trunk" | "hip" | "leg" | "foot" | "ill";
export type BodyType = "head" | "neck" | "upper" | "trunk" | "back" | "muscle" | "joint" | "tendon" | "bone" | "ill_up" | "ill_down";
export type Side = "l" | "r" | "b";

export interface BodyDef { k: BodyCode; zone: BodyZone; type: BodyType; side: boolean }
export const BODY: BodyDef[] = [
  { k: "head", zone: "head", type: "head", side: false },
  { k: "neck", zone: "head", type: "neck", side: false },
  { k: "shoulder", zone: "upper", type: "upper", side: true },
  { k: "arm", zone: "upper", type: "upper", side: true },
  { k: "hand", zone: "upper", type: "upper", side: true },
  { k: "chest", zone: "trunk", type: "trunk", side: false },
  { k: "abdomen", zone: "trunk", type: "trunk", side: false },
  { k: "upback", zone: "trunk", type: "back", side: false },
  { k: "lowback", zone: "trunk", type: "back", side: false },
  { k: "groin", zone: "hip", type: "muscle", side: true },
  { k: "hip", zone: "hip", type: "joint", side: true },
  { k: "glute", zone: "hip", type: "muscle", side: true },
  { k: "quad", zone: "leg", type: "muscle", side: true },
  { k: "hams", zone: "leg", type: "muscle", side: true },
  { k: "knee", zone: "leg", type: "joint", side: true },
  { k: "calf", zone: "leg", type: "muscle", side: true },
  { k: "shin", zone: "leg", type: "bone", side: true },
  { k: "achilles", zone: "foot", type: "tendon", side: true },
  { k: "ankle", zone: "foot", type: "joint", side: true },
  { k: "heel", zone: "foot", type: "bone", side: true },
  { k: "foot", zone: "foot", type: "bone", side: true },
  { k: "ill_up", zone: "ill", type: "ill_up", side: false },
  { k: "ill_down", zone: "ill", type: "ill_down", side: false },
];
export const BODY_ZONES: BodyZone[] = ["head", "upper", "trunk", "hip", "leg", "foot", "ill"];
export const bodyDef = (k: string): BodyDef | undefined => BODY.find(b => b.k === k);

/** „hams:l“ → { k: "hams", side: "l" } (unbekannte Codes → null) */
export function parseArea(code: string): { k: BodyCode; side: Side | null } | null {
  const [k, sd] = String(code || "").split(":"); const d = bodyDef(k); if (!d) return null;
  return { k: d.k, side: d.side && (sd === "l" || sd === "r" || sd === "b") ? sd : null };
}
/** gültige, eindeutige Codes (höchstens 12) */
export function cleanAreas(codes: string[] | undefined): string[] {
  const out: string[] = [];
  for (const c of codes || []) { const a = parseArea(c); if (!a) continue; const v = a.side ? `${a.k}:${a.side}` : a.k; if (!out.some(x => x.split(":")[0] === a.k)) out.push(v); }
  return out.slice(0, 12);
}

/** Wirkung einer Beschwerde auf das Training heute. */
export type BodyEffectKind = "sick" | "pause" | "easy" | "mod";
export interface BodyEffect { kind: BodyEffectKind; cap: number | null; how: string; type: BodyType | null; k: BodyCode | null }
const RANK: Record<BodyEffectKind, number> = { sick: 4, pause: 3, easy: 2, mod: 1 };

/**
 * Wirkung je Region und Stärke. `base` = Ziel-RPE der Einheit, `tw` = Torhüter.
 * Texte kommen als i18n-Schlüssel (bd_<type>_<level>[_tw]).
 */
export function regionEffect(k: BodyCode, level: Exclude<Complaint, "none">, base: number, tw: boolean): BodyEffect {
  const d = bodyDef(k)!, ty = d.type, clear = level === "clear";
  const e = (kind: BodyEffectKind, cap: number | null, key = `bd_${ty}_${level}`): BodyEffect => ({ kind, cap, how: key, type: ty, k });
  switch (ty) {
    case "ill_down": return e("sick", 0);
    case "ill_up": return clear ? e("pause", 0) : e("easy", Math.min(base, 4));
    case "head": return clear ? e("pause", 0) : e("easy", Math.max(2, base - 1));
    case "neck": return clear ? e("pause", 0) : e("mod", null);
    case "muscle": return clear ? e("pause", 0) : e("easy", Math.max(3, base - 1));
    case "tendon": case "joint": case "bone": return clear ? e("pause", 0) : e("easy", Math.max(3, base - 1));
    case "back": return clear ? e("pause", 0) : e("mod", null);
    case "trunk": return clear ? e("pause", 0) : e("mod", null);
    case "upper": return tw ? (clear ? e("easy", Math.min(base, 4), `bd_upper_${level}_tw`) : e("mod", null, "bd_upper_light_tw")) : e("mod", null);
  }
}

/** Lesbare Bezeichnung („Oberschenkel hinten (links)“) */
export function areaLabel(t: (k: string) => string, code: string): string {
  const a = parseArea(code); if (!a) return "";
  return t("bd_" + a.k) + (a.side ? ` (${t("bd_side_" + a.side)})` : "");
}
