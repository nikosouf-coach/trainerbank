// Reha-Pläne nach Körperregion und Rückkehrstufe (kriterienbasiert: weiter zur nächsten Stufe, wenn die
// Kriterien erfüllt sind – nicht nach Kalender). Grundlagen: Return-to-Play-Konsens (Ardern et al. 2016),
// Muskelverletzungen/Hamstrings (Mendiguchia et al. 2017; van der Horst et al. 2015), Sprunggelenk
// (Vuurberg et al. 2018), Leiste (Hölmich 2010; Harøy et al. 2019), Gehirnerschütterung (CISG, Patricios et al. 2023).
// Die Pläne sind Orientierung für Trainerteam und Spieler – die Freigabe trifft das medizinische Personal.
import { parseArea } from "./body";

export type RehaGroup = "hams" | "quad" | "calf" | "groin" | "knee" | "ankle" | "back" | "upper" | "head" | "general";
export const REHA_GROUPS: RehaGroup[] = ["hams", "quad", "calf", "groin", "knee", "ankle", "back", "upper", "head", "general"];

/** Reha-Gruppe aus der Körperregion der Verletzung (Absence.area) */
export function rehaGroupOf(area: string | null | undefined): RehaGroup {
  const a = area ? parseArea(area) : null; if (!a) return "general";
  switch (a.k) {
    case "hams": case "glute": return "hams";
    case "quad": return "quad";
    case "calf": case "achilles": case "shin": return "calf";
    case "groin": case "hip": return "groin";
    case "knee": return "knee";
    case "ankle": case "foot": case "heel": return "ankle";
    case "lowback": case "upback": case "neck": case "abdomen": case "chest": return "back";
    case "shoulder": case "arm": case "hand": return "upper";
    case "head": return "head";
    default: return "general";
  }
}

/** Region aus einer freien Notiz erraten (für ältere Einträge ohne Region) */
export function guessArea(note: string | null | undefined): string | null {
  const n = (note || "").toLowerCase();
  const rules: [RegExp, string][] = [
    [/oberschenkel hinten|hamstring|back of (the )?thigh|beuger/, "hams"], [/oberschenkel vorn|quad|front thigh|strecker/, "quad"],
    [/wade|calf|achilles/, "calf"], [/leiste|adduktor|groin/, "groin"], [/knie|knee|kreuzband|meniskus|acl/, "knee"],
    [/sprunggelenk|knöchel|ankle|umgeknickt|bänder/, "ankle"], [/rücken|back|lws/, "lowback"], [/schulter|shoulder|arm|hand|finger|handgelenk|wrist/, "shoulder"],
    [/kopf|gehirnerschütterung|concussion|head/, "head"], [/fuß|foot|ferse|heel|zeh/, "foot"], [/hüfte|hip/, "hip"],
  ];
  for (const [re, k] of rules) if (re.test(n)) return k;
  return null;
}

export interface RehaPlan { group: RehaGroup; stage: number; goal: string; items: string[]; next: string }
/** Plan einer Stufe (Texte aus i18n: rh_<gruppe>_<stufe>_g / _i / _n) */
export function rehaPlan(t: (k: string) => string, tl: (k: string) => string[], group: RehaGroup, stage: number): RehaPlan {
  const st = Math.max(1, Math.min(4, stage || 1)), k = `rh_${group}_${st}`;
  const items = tl(k + "_i");
  return { group, stage: st, goal: t(k + "_g"), items: items.length ? items : tl(`rh_general_${st}_i`), next: t(k + "_n") };
}
