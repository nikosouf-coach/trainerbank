// Dienste (Materialdienst, Leibchen …) reihum, Strafenkatalog mit Automatik und Aufgaben.
// Automatik bewusst mild: Dienst statt Geld als Vorschlag, nur Spieler mit App-Konto und Einwilligung
// in Gesundheitsdaten (RPE), nur Einheiten ab dem Tag, an dem die Regel eingeschaltet wurde.
import { addDays, at, diff, monday } from "./dates";
import type { Engine } from "./engine";
import type { DutyDef, DutyEntry, FineEntry, FineRule, Lang } from "./types";

/** Vorschläge für Dienste */
export const dutySuggest = (lang: Lang): DutyDef[] => {
  const en = lang === "en";
  return [
    { id: "material", name: en ? "Kit duty (balls, cones, bibs)" : "Materialdienst (Bälle, Hütchen, Leibchen)", when: "training", count: 2, on: true },
    { id: "bibs", name: en ? "Wash bibs" : "Leibchen waschen", when: "training", count: 1, on: true },
    { id: "drinks", name: en ? "Drinks & first-aid bag" : "Getränke & Sanitasche", when: "match", count: 1, on: false },
    { id: "cabin", name: en ? "Tidy dressing room" : "Kabine aufräumen", when: "match", count: 2, on: false },
  ];
};
/** Vorschläge für den Strafenkatalog (Automatiken standardmäßig aus) */
export const fineSuggest = (lang: Lang): FineRule[] => {
  const en = lang === "en";
  return [
    { id: "late_rpe", name: en ? "RPE not entered within 24 h" : "RPE nicht innerhalb von 24 Std. eingetragen", trigger: "late_rpe", duty: "material", amount: null, note: "", on: false },
    { id: "unexcused", name: en ? "Missed training without notice" : "Unentschuldigt gefehlt", trigger: "unexcused", duty: "bibs", amount: null, note: "", on: false },
    { id: "late", name: en ? "Late for training" : "Zu spät zum Training", trigger: "manual", duty: null, amount: 2, note: "", on: true },
    { id: "phone", name: en ? "Phone in the dressing room" : "Handy in der Kabine", trigger: "manual", duty: null, amount: 1, note: "", on: true },
  ];
};

/** Fällt der Dienst an diesem Tag an? (Training bzw. Spiel) */
function dutyOn(E: Engine, def: DutyDef, d: string): boolean {
  const it = E.weekPlan(monday(d)).items.find(x => x.date === d);
  if (!it) return false;
  const train = !!it.train && it.train.kind !== "frei", match = !!it.match;
  return def.when === "both" ? train || match : def.when === "match" ? match : train;
}

/** Termine ab `from` (einschließlich) innerhalb von `days` Tagen, an denen der Dienst anfällt */
export function dutyDates(E: Engine, def: DutyDef, from: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= days; i++) { const d = addDays(from, i); if (dutyOn(E, def, d)) out.push(d); }
  return out;
}
/** Nächster Termin für den Dienst, der noch nicht begonnen hat */
export function nextDutyDate(E: Engine, def: DutyDef): string | null {
  for (let i = 0; i <= 28; i++) {
    const d = addDays(E.TODAY, i); if (!dutyOn(E, def, d)) continue;
    const m = E.matchOn(d), start = at(d, m && def.when !== "training" ? m.zeit : E.zeitOf(d));
    if (start > E.NOW) return d;
  }
  return null;
}

export interface RotationPlan { add: Omit<DutyEntry, "id">[]; remove: string[] }
/**
 * Reihum verteilen: für jeden Termin der nächsten `days` Tage fehlende Plätze besetzen.
 * Fair: wer zuletzt seltener Dienst hatte (alle Dienste, dann dieser), ist zuerst dran; Abwesende und Spieler mit
 * einem anderen Dienst am selben Tag werden übersprungen. Eingeteilte, die inzwischen fehlen, werden ersetzt.
 */
export function planRotation(E: Engine, defs: DutyDef[], existing: DutyEntry[], days = 14): RotationPlan {
  const add: Omit<DutyEntry, "id">[] = [], remove: string[] = [], from = E.TODAY;
  const players = E.D.players.filter(p => p.active !== false);
  const live = existing.filter(e => e.status !== "waived");
  for (const def of defs.filter(x => x.on && x.count > 0)) {
    // Zähler: Einteilungen der letzten 8 Wochen (inkl. geplanter) – erst alle Dienste, dann dieser Dienst
    const hist = live.filter(e => diff(e.date, from) <= 56);
    const total = (pid: string): number => hist.filter(e => e.pid === pid).length + add.filter(e => e.pid === pid).length;
    const count = (pid: string): number => hist.filter(e => e.duty === def.id && e.pid === pid).length + add.filter(e => e.duty === def.id && e.pid === pid).length;
    const last = (pid: string): string => [...hist.filter(e => e.pid === pid).map(e => e.date), ...add.filter(e => e.pid === pid).map(e => e.date)].sort().at(-1) || "";
    for (const d of dutyDates(E, def, from, days)) {
      const cur = live.filter(e => e.date === d && e.duty === def.id);
      const keep = cur.filter(e => {
        const gone = e.source === "rotation" && e.status === "open" && (!!E.absenceOn(e.pid, d) || !players.some(p => p.id === e.pid));
        if (gone) remove.push(e.id);
        return !gone;
      });
      let need = Math.min(def.count, players.length) - keep.length;
      if (need <= 0) continue;
      // ausgetragene (erlassene) Spieler nicht erneut für diesen Termin einteilen
      const busy = new Set([...live.filter(e => e.date === d).map(e => e.pid), ...add.filter(e => e.date === d).map(e => e.pid), ...keep.map(e => e.pid),
        ...existing.filter(e => e.status === "waived" && e.date === d && e.duty === def.id).map(e => e.pid)]);
      const cand = players.filter(p => !E.absenceOn(p.id, d) && !busy.has(p.id))
        .sort((a, b) => total(a.id) - total(b.id) || count(a.id) - count(b.id) || (last(a.id) < last(b.id) ? -1 : last(a.id) > last(b.id) ? 1 : 0) || (a.nr ?? 99) - (b.nr ?? 99) || a.vn.localeCompare(b.vn));
      for (const p of cand) { if (need-- <= 0) break; add.push({ date: d, duty: def.id, pid: p.id, source: "rotation", fineId: null, status: "open" }); }
    }
  }
  return { add, remove };
}

export interface Violation { rule: FineRule; pid: string; ref: string }
/**
 * Verstöße gegen eingeschaltete Automatik-Regeln (letzte 10 Tage, frühestens ab Einschalten der Regel).
 * late_rpe: anwesend („da“), aber 24 Std. nach Ende keine RPE – nur Spieler, für die `canEnter` gilt
 * (App-Konto und Einwilligung). unexcused: Anwesenheit „unentschuldigt“.
 */
export function fineViolations(E: Engine, rules: FineRule[], existing: FineEntry[], canEnter: (pid: string) => boolean): Violation[] {
  const out: Violation[] = [];
  const has = (rule: string, pid: string, ref: string): boolean => existing.some(f => f.rule === rule && f.pid === pid && f.ref === ref);
  for (const rule of rules.filter(r => r.on && r.trigger !== "manual")) {
    const since = rule.since || E.TODAY;
    for (const s of E.D.sessions.filter(x => x.date >= since && x.date <= E.TODAY && diff(x.date, E.TODAY) <= 10)) {
      const end = at(s.date, s.zeit).getTime() + s.dauer * 60000;
      for (const p of E.D.players) {
        if (has(rule.id, p.id, s.date)) continue;
        const st = E.attStatus(s.date, p.id);
        if (rule.trigger === "late_rpe") {
          if (st !== "da" || E.D.rpe[p.id]?.[s.date] || !canEnter(p.id) || E.NOW.getTime() < end + 24 * 3600e3) continue;
          out.push({ rule, pid: p.id, ref: s.date });
        } else if (rule.trigger === "unexcused" && st === "unent") out.push({ rule, pid: p.id, ref: s.date });
      }
    }
  }
  return out;
}

/**
 * Fairness bei Offline-Einträgen: automatische Strafen „RPE zu spät“, deren RPE inzwischen da ist und
 * nachweislich rechtzeitig (≤ 24 Std. nach Ende) auf dem Gerät eingegeben wurde – z. B. ohne Netz in der Kabine.
 * Diese Strafen werden erlassen (und ein offener Strafdienst gestrichen).
 */
export function lateFinesToWaive(E: Engine, rules: FineRule[], fines: FineEntry[]): FineEntry[] {
  const late = new Set(rules.filter(r => r.trigger === "late_rpe").map(r => r.id));
  return fines.filter(f => {
    if (!f.auto || f.status !== "open" || !f.ref || !late.has(f.rule)) return false;
    const e = E.D.rpe[f.pid]?.[f.ref]; if (!e?.at) return false;
    const s = E.D.sessions.find(x => x.date === f.ref); if (!s) return false;
    const end = at(s.date, s.zeit).getTime() + s.dauer * 60000, t = Date.parse(e.at);
    return Number.isFinite(t) && t <= end + 24 * 3600e3;
  });
}
