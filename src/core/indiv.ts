// Individuelle Vorgabe je Spieler und Einheit.
// Der Plan des Trainers gibt die Ziel-Intensität der EINHEIT vor (Design der Einheit, z. B. MD-3 intensiv, RPE 8).
// Was ein einzelner Spieler daraus macht, hängt von seiner Lage ab: Spielminuten am Wochenende, Reha-Stufe,
// Rückkehr nach Verletzung, Belastungsaufbau, Torwart, Wachstumsschub, Belastungsampel, Erholung.
// Grundlagen: Spielersatz-/Kompensationstraining für Nicht-Starter (Anderson et al. 2016; Buchheit 2019),
// stufenweiser Return-to-Play (Ardern et al. 2016, Konsens Bern), Belastungssteigerung ≤ 10–15 %/Woche nach Pausen,
// reduzierte Sprung-/Sprintvolumina im Wachstumsschub (Lloyd & Oliver 2012; Read et al. 2016).
import { addDays, diff, monday } from "./dates";
import type { Engine, PlanTrain } from "./engine";
import { complaintEffect } from "./pain";
import { inKind } from "./groups";
import { cmjDrop } from "./perf";
import { guessArea, rehaGroupOf, rehaPlan } from "./reha";
import type { Match, Player } from "./types";

export type IndivKind = "team" | "comp" | "compHalf" | "reha" | "return" | "build" | "tw" | "growth" | "easy" | "mod" | "pause" | "absent" | "sick";
export interface IndivTarget {
  pid: string; kind: IndivKind;
  /** Ziel-RPE (0 = keine Teilnahme) und Minuten */
  rpe: number; dauer: number;
  /** Gründe (übersetzt), wichtigster zuerst */
  why: string[];
  /** Hinweis für die Umsetzung (übersetzt) */
  how: string;
  /** weicht von der Mannschaftsvorgabe ab */
  differs: boolean;
}

/** Welche Arten zählen als „nimmt am Mannschaftstraining teil“ (für Zählungen in der Planung). */
export const WITH_TEAM: IndivKind[] = ["team", "comp", "compHalf", "return", "build", "tw", "growth", "easy", "mod"];

const cache = new WeakMap<Engine, Map<string, IndivTarget[]>>();

/** Letztes Spiel vor dem Datum, wenn diese Einheit die erste danach ist (höchstens 2 Tage später). */
function matchBefore(E: Engine, date: string): Match | null {
  const m = [...E.D.matches].filter(x => x.date < date && diff(x.date, date) <= 2).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  if (!m) return null;
  // dazwischen schon trainiert? (freie Tage aus den Prinzipien zählen nicht)
  for (let d = addDays(m.date, 1); d < date; d = addDays(d, 1)) {
    const k = E.weekPlan(monday(d)).items.find(x => x.date === d)?.train?.kind;
    if (k && k !== "frei") return null;
  }
  return m;
}

/** Spielminuten eines Spielers (Spieldaten des Trainers, sonst eigene RPE-Angabe). null = unbekannt. */
export function matchMinutes(E: Engine, m: Match, pid: string): number | null {
  const st = E.D.stats[m.id];
  if (st?.[pid]) return st[pid].min;
  const own = E.D.rpe[pid]?.[m.date]; if (own) return own.min;
  // Spieldaten für die Mannschaft erfasst, Spieler fehlt → nicht eingesetzt
  if (st && Object.keys(st).length >= 8) return 0;
  return null;
}

/** Individuelle Vorgaben aller Spieler für einen Trainingstag (leer, wenn kein Training). */
export function indivFor(E: Engine, date: string): IndivTarget[] {
  let byDate = cache.get(E); if (!byDate) { byDate = new Map(); cache.set(E, byDate); }
  const hit = byDate.get(date); if (hit) return hit;
  const it = E.weekPlan(monday(date)).items.find(x => x.date === date);
  const res = it?.train && it.train.kind !== "frei" ? E.D.players.map(p => calc(E, p, it.train!)) : [];
  byDate.set(date, res);
  return res;
}
/** Vorgabe eines Spielers für einen Tag (null = kein Training). */
export const indivOf = (E: Engine, pid: string, date: string): IndivTarget | null => indivFor(E, date).find(x => x.pid === pid) || null;

function calc(E: Engine, p: Player, tr: PlanTrain): IndivTarget {
  const { t, tf } = E, date = tr.date, base = tr.rpe, dur = tr.dauer, G = E.D.groups, kids = E.grp === "u11";
  const out = (kind: IndivKind, rpe: number, dauer: number, why: string[], how = ""): IndivTarget =>
    ({ pid: p.id, kind, rpe, dauer, why, how, differs: kind !== "team" || rpe !== base || dauer !== dur });

  // 1. Abwesend / krank / verletzt
  const ab = E.absenceOn(p.id, date);
  if (ab && ab.typ === "krank") return out("sick", 0, 0, [t("ab_krank")], t("iv_sickHow"));
  if (ab && ab.typ === "verletzung") {
    const st = Math.max(1, Math.min(4, ab.stufe || 1)), name = E.tl("stages")[st - 1] || "";
    // Reha-Plan nach Region und Stufe (Ziel und erste Übungen als Umsetzungshinweis)
    const grp = rehaGroupOf(ab.area || guessArea(ab.notiz)), plan = rehaPlan(t, E.tl, grp, st);
    const why = [tf("iv_rehaWhy", { s: st, n: name }) + " · " + t("rh_g_" + grp) + (ab.notiz ? " · " + ab.notiz : "")];
    const how = `${plan.goal}: ${plan.items.slice(0, 2).join(" · ")}`;
    if (st === 1) return out("reha", Math.min(3, base), Math.min(45, dur), why, how);
    if (st === 2) return out("reha", Math.min(5, base), Math.min(60, Math.round(dur * 0.66 / 5) * 5), why, how);
    if (st === 3) return out("reha", Math.min(base, 7), dur, why, how);
    return out("return", base, dur, why, how);
  }
  if (ab) return out("absent", 0, 0, [t("ab_" + ab.typ)]);
  if (kids) return out("team", base, dur, []);

  // 2. Trainer hat „Pause“ verordnet; Beschwerden heute
  const pause = (E.D.msgs[p.id] || []).find(m => m.typ === "pause" && m.date <= date && (!m.bis || m.bis >= date));
  if (pause) return out("pause", 0, 0, [t("ph_coachPause")], pause.text);
  // Beschwerden mit Körperregion: heute gemeldet (gilt für heute; deutliche Beschwerden auch für morgen),
  // ohne heutigen Eintrag gilt eine deutliche Beschwerde von gestern
  const wT = E.D.well[p.id]?.[E.TODAY], wY = E.D.well[p.id]?.[addDays(E.TODAY, -1)];
  const w = date === E.TODAY ? (wT || (wY?.beschw === "clear" ? wY : null)) : date === addDays(E.TODAY, 1) && wT?.beschw === "clear" ? wT : null;
  const ef = w ? complaintEffect(w, base, p.pos === "TW" || inKind(G, p, "tw")) : null;
  if (ef && w) {
    const why = E.soreWhy(w) + (w.beschw === "clear" ? ` (${t("pw_clear").toLowerCase()})` : "");
    if (ef.kind === "sick") return out("sick", 0, 0, [why], t(ef.how));
    if (ef.kind === "pause") return out("pause", 0, 0, [why], t(ef.how));
  }

  let rpe = base, dauer = dur, kind: IndivKind = "team", how = "";
  const why: string[] = [];
  const cap = (r: number, k: IndivKind, reason: string, h = "", vol = 1): void => {
    const nr = Math.min(rpe, r), nd = vol < 1 ? Math.max(30, Math.min(dauer, Math.round(dur * vol / 5) * 5)) : dauer;
    if (nr < rpe || nd < dauer) { if (kind === "team") { kind = k; if (h) how = h; } why.push(reason); rpe = nr; dauer = nd; }
  };

  // Beschwerde: eine Stufe leichter bzw. mit Einschränkung (kein Spielersatz mit hoher Intensität)
  const sore = !!ef && (ef.kind === "easy" || ef.kind === "mod");
  if (ef && w && sore) {
    const why0 = E.soreWhy(w);
    if (ef.kind === "easy" && ef.cap != null) cap(ef.cap, "easy", why0, t(ef.how));
    if (kind === "team") { kind = "mod"; how = t(ef.how); why.push(why0); }
  }

  // 3. Erste Einheit nach dem Spiel (MD+1/MD+2, leichte Einheit): Die Startelf folgt der Mannschaftsvorgabe
  //    (Regeneration). Wer wenig gespielt hat, holt die Spielbelastung nach (Spielersatz), sonst sinkt seine
  //    Grundbelastung und der nächste volle Einsatz wird zur Belastungsspitze.
  const m = base <= 5 && !sore ? matchBefore(E, date) : null;
  if (m) {
    const min = matchMinutes(E, m, p.id), full = E.matchMin();
    if (min != null && min < Math.round(full * 0.5)) {
      kind = "comp"; rpe = Math.max(rpe, E.grp === "u15" ? 6 : 7); dauer = Math.max(45, Math.min(dur, 60));
      why.push(min ? tf("iv_fewMin", { m: min }) : t("iv_noMin")); how = t(p.pos === "TW" ? "iv_compTwHow" : "iv_compHow");
    } else if (min != null && min < Math.round(full * 0.66)) {
      kind = "compHalf"; rpe = Math.max(rpe, E.grp === "u15" ? 5 : 6); dauer = Math.max(45, Math.min(dur, 60));
      why.push(tf("iv_partMin", { m: min })); how = t(p.pos === "TW" ? "iv_compTwHow" : "iv_compHalfHow");
    }
  }

  // 4. Rückkehr nach Verletzung (≤ 21 Tage) bzw. Reha-Gruppe ohne aktuelle Verletzung
  const ret = E.D.absences.filter(a => a.pid === p.id && a.typ === "verletzung" && a.bis && a.bis < date && diff(a.bis, date) <= 21).sort((a, b) => a.bis! < b.bis! ? 1 : -1)[0];
  if (ret) {
    const d = diff(ret.bis!, date);
    if (d <= 7) cap(6, "return", tf("iv_returnW", { w: 1 }), t("iv_returnHow"), 0.75);
    else if (d <= 14) cap(7, "return", tf("iv_returnW", { w: 2 }), t("iv_returnHow"), 0.9);
  } else if (inKind(G, p, "reha")) cap(6, "return", t("iv_rehaGroup"), t("iv_returnHow"), 0.8);

  // 5. Belastungsaufbau: Gruppe, neue Spieler, noch keine 3 Wochen Daten
  const mt = E.mods.belastung ? E.metrics(p.id) : null;
  if (inKind(G, p, "build")) cap(6, "build", t("iv_buildGroup"), t("iv_buildHow"), 0.8);
  else if (E.mods.belastung && (p.neu || (mt != null && mt.days < 21))) cap(6, "build", t("iv_buildNew"), t("iv_buildHow"), 0.85);

  // 6. Torhüter: Laufumfänge durch torwartspezifische Arbeit ersetzen
  if ((p.pos === "TW" || inKind(G, p, "tw")) && kind !== "comp" && kind !== "compHalf" && ["extensiv", "aufbau"].includes(tr.kind)) cap(6, "tw", t("iv_tw"), t("iv_twHow"));

  // 7. Wachstumsschub: Sprung- und Sprintvolumen begrenzen
  const gi = E.growthInfo(p.id);
  if ((gi && gi.spurt) || inKind(G, p, "growth")) {
    if (rpe >= 8) cap(7, "growth", t("iv_growth"), t("iv_growthHow"));
    else if (kind === "team") { kind = "growth"; how = t("iv_growthHow"); why.push(t("iv_growth")); }
  }

  // 8. Belastungsampel (nur nahe Zukunft – die Werte gelten für heute)
  if (E.mods.belastung && mt && mt.days >= 21 && diff(E.TODAY, date) <= 6 && date >= E.TODAY) {
    const st = E.status(p.id, mt);
    if (st === "crit") cap(Math.max(3, base - 2), "easy", t("iv_crit"), t("iv_critHow"), 0.75);
    else if (st === "warn") cap(Math.max(3, base - 1), "easy", t("iv_warn"), t("iv_warnHow"));
  }

  // 9. Erholung bis zum Start nicht abgeschlossen (nur bei harten Einheiten)
  if (rpe >= 7 && tr.notReady.some(x => x.id === p.id)) cap(6, "easy", t("iv_notRec"), t("iv_notRecHow"));

  // 10. Sprungkraft (CMJ) deutlich unter dem persönlichen Schnitt
  if (E.mods.leistung && date >= E.TODAY && diff(E.TODAY, date) <= 2) {
    const drop = cmjDrop(E.D, p.id, E.TODAY);
    if (drop != null && drop >= 0.08) cap(Math.max(3, rpe - 1), "easy", tf("iv_cmj", { p: Math.round(drop * 100) }), t("iv_notRecHow"));
  }

  return out(kind, rpe, dauer, why, how);
}

/** Kurzlabel der Art (übersetzt). */
export const indivLabel = (E: Engine, k: IndivKind): string => E.t("iv_k_" + k);
