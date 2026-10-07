// Spielerische Elemente der Spieler-App: Erfahrungspunkte (XP), Level, Serie, Wochenringe, Abzeichen.
// Belohnt wird regelmäßiges Eintragen und Dabeisein – nicht hohe Belastung (keine Anreize zur Überlastung).
import { addDays, diff, monday } from "./dates";
import type { Engine } from "./engine";
import { testDef } from "./perf";

export const XP = { well: 10, rpe: 15, att: 10, extra: 5 } as const;
/** Benötigte XP für Level L (L1 = 0, L2 = 100, L3 = 300, L4 = 600, L5 = 1000 …). */
export const xpFor = (level: number): number => 50 * level * (level - 1);

export interface Badge { key: string; earned: boolean; progress: number }
export interface Ring { done: number; total: number }
export interface GameState {
  xp: number; level: number; levelStart: number; levelNext: number; pct: number;
  streak: number; bestStreak: number; checkedToday: boolean;
  week: { checkins: Ring; rpe: Ring; att: Ring };
  badges: Badge[];
}

export function gameOf(E: Engine, pid: string): GameState {
  const D = E.D, TODAY = E.TODAY;
  const well = D.well[pid] || {}, rpe = D.rpe[pid] || {}, extra = D.extra[pid] || [];
  const wellDays = Object.keys(well).filter(d => d <= TODAY).sort();
  const attended = D.sessions.filter(s => s.date <= TODAY && E.attStatus(s.date, pid) === "da");

  // XP: Einträge und Anwesenheit; Zusatzsport höchstens einmal pro Tag
  const extraDays = new Set(extra.filter(x => x.date <= TODAY).map(x => x.date));
  const xp = wellDays.length * XP.well + Object.keys(rpe).filter(d => d <= TODAY).length * XP.rpe + attended.length * XP.att + extraDays.size * XP.extra;
  let level = 1; while (xp >= xpFor(level + 1)) level++;
  const levelStart = xpFor(level), levelNext = xpFor(level + 1);

  // Serie: aufeinanderfolgende Tage mit Morgen-Check (bis heute oder gestern)
  const has = new Set(wellDays);
  const checkedToday = has.has(TODAY);
  let streak = 0; for (let d = checkedToday ? TODAY : addDays(TODAY, -1); has.has(d); d = addDays(d, -1)) streak++;
  let bestStreak = 0, run = 0, prev = "";
  for (const d of wellDays) { run = prev && diff(prev, d) === 1 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); prev = d; }

  // Wochenringe (Montag bis heute)
  const ws = monday(TODAY), days = diff(ws, TODAY) + 1;
  const weekSess = D.sessions.filter(s => s.date >= ws && s.date <= TODAY && !["abs:verletzung", "abs:krank"].includes(E.attStatus(s.date, pid)));
  const weekAtt = weekSess.filter(s => E.attStatus(s.date, pid) === "da");
  const week = {
    checkins: { done: wellDays.filter(d => d >= ws).length, total: days },
    rpe: { done: weekAtt.filter(s => rpe[s.date]).length, total: weekAtt.length },
    att: { done: weekAtt.length, total: weekSess.length },
  };

  // Abzeichen
  const last28 = attended.filter(s => diff(s.date, TODAY) <= 28);
  const rpeQuote = last28.length ? last28.filter(s => rpe[s.date]).length / last28.length : 0;
  const att = E.attendance(pid);
  const p = E.P(pid), tg = p ? E.profile(pid).tg : [8, 10];
  const lastChecks = wellDays.slice(-7).map(d => well[d].schlaf);
  const sleepOk = lastChecks.filter(h => h >= tg[0]).length;
  let perfect = 0;
  for (let w = 1; w <= 4; w++) { const a = addDays(ws, -7 * w); let n = 0; for (let k = 0; k < 7; k++) if (has.has(addDays(a, k))) n++; perfect = Math.max(perfect, n); }
  const ex14 = extra.filter(x => x.date <= TODAY && diff(x.date, TODAY) <= 14).length;
  const sess28 = D.sessions.filter(s => s.date <= TODAY && diff(s.date, TODAY) <= 28).length;
  const b = (key: string, progress: number): Badge => ({ key, earned: progress >= 1, progress: Math.max(0, Math.min(1, progress)) });
  const badges = [
    b("first", wellDays.length ? 1 : 0),
    b("streak7", bestStreak / 7),
    b("perfect", perfect / 7),
    b("rpe", last28.length >= 5 ? rpeQuote / 0.9 : last28.length / 5 * 0.5),
    b("att", att != null && sess28 >= 6 ? att : (att ?? 0) * 0.5),
    b("sleep", sleepOk / 5),
    b("extra", ex14 / 3),
    b("streak30", bestStreak / 30),
  ];
  if (E.mods.leistung) {
    // Neuer Bestwert in einem Test in den letzten 30 Tagen
    const mine = D.tests.filter(x => x.pid === pid), keys = [...new Set(mine.map(x => x.test))];
    const pb = keys.some(k => { const L = mine.filter(x => x.test === k).sort((a, b) => a.date < b.date ? -1 : 1); if (L.length < 2) return false;
      const lo = testDef(k).lower, last = L[L.length - 1], prev = L.slice(0, -1); return diff(last.date, TODAY) <= 30 && prev.every(x => lo ? last.value < x.value : last.value > x.value); });
    badges.push(b("pb", pb ? 1 : 0));
  }
  if (E.mods.spielanalyse) {
    const ss = E.seasonStats(pid);
    badges.push(b("goal", ss.goals ? 1 : 0), b("assist", ss.assists ? 1 : 0), b("top", ss.best != null ? Math.min(1, ss.best / 8) : 0));
  }
  return { xp, level, levelStart, levelNext, pct: (xp - levelStart) / Math.max(1, levelNext - levelStart), streak, bestStreak, checkedToday, week, badges };
}
