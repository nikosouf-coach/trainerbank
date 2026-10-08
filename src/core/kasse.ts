// Mannschaftskasse: Beiträge (einmalig, monatlich, je Saison), Geldstrafen, Kassenbuch. Reine Logik ohne React.
// Was ein Spieler schuldet, wird aus Beiträgen, Befreiungen, Zahlungen und offenen Geldstrafen berechnet
// (nichts wird doppelt gespeichert) – so stimmen Übersicht, Spieler-App und Kassenstand immer überein.
import type { CashEntry, CashWaiver, FeeDef, FineEntry, Group, KasseSettings, Lang, Player, TeamData } from "./types";

/** Standard: aus; Geldstrafen nur bei Aktiven (Senioren/Ü32) vorgeschlagen; Kassenstand für Spieler sichtbar */
export function kasseOf(s: { kasse?: KasseSettings }, grp: Group): KasseSettings {
  return { on: false, currency: "EUR", money: grp === "akt", showBalance: true, treasurer: null, payInfo: "", fees: [], ...(s.kasse || {}) };
}

export const CURRENCIES = ["EUR", "CHF", "GBP", "USD", "PLN", "DKK", "SEK", "NOK", "CZK"] as const;
const SYM: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };
/** Betrag mit Währung: de „12,50 €“, en „€12.50“; andere Währungen als Kürzel („12,50 CHF“) */
export function money(v: number, cur = "EUR", lang: Lang = "de"): string {
  const neg = v < 0, a = Math.abs(Math.round(v * 100) / 100);
  const num = lang === "de" ? a.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") : a.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sym = SYM[cur];
  const out = lang === "en" && sym ? `${sym}${num}` : `${num} ${sym || cur}`;
  return (neg ? "−" : "") + out;
}

/** Saison (Juli–Juni) eines Datums: „2026/27“ */
export function seasonOf(date: string): string {
  const y = +date.slice(0, 4), m = +date.slice(5, 7), start = m >= 7 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
/** Erster Tag eines Zeitraums (für Sortierung und Fälligkeit) */
export function periodStart(fee: FeeDef, period: string): string {
  if (period === "once") return fee.from;
  if (/^\d{4}-\d{2}$/.test(period)) { const p = period + "-01"; return p < fee.from ? fee.from : p; }
  const p = period.slice(0, 4) + "-07-01"; return p < fee.from ? fee.from : p;
}

/** Fällige Zeiträume eines Beitrags bis heute (einschließlich des laufenden Monats bzw. der laufenden Saison) */
export function duePeriods(fee: FeeDef, today: string): string[] {
  if (!fee.from || fee.from > today) return [];
  const end = fee.to && fee.to < today ? fee.to : today;
  if (fee.every === "once") return ["once"];
  const out: string[] = [];
  if (fee.every === "month") {
    let y = +fee.from.slice(0, 4), m = +fee.from.slice(5, 7);
    const ey = +end.slice(0, 4), em = +end.slice(5, 7);
    while ((y < ey || (y === ey && m <= em)) && out.length < 240) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
    return out;
  }
  let s = +seasonOf(fee.from).slice(0, 4); const e = +seasonOf(end).slice(0, 4);
  while (s <= e && out.length < 50) { out.push(`${s}/${String((s + 1) % 100).padStart(2, "0")}`); s++; }
  return out;
}

export interface DueItem {
  key: string; kind: "fee" | "fine"; pid: string; amount: number; label: string; date: string;
  feeId?: string; period?: string; fineId?: string;
  /** bezahlt (Zahlung im Kassenbuch) bzw. erlassen */
  paid: boolean; waived: boolean; entryId?: string;
}

const appliesTo = (fee: FeeDef, pid: string): boolean => !fee.pids || !fee.pids.length || fee.pids.includes(pid);
/** Zeitraum lesbar: „Okt 2026“, „Saison 2026/27“, einmalig = leer */
export const periodLabel = (period: string, lang: Lang): string => {
  if (period === "once") return "";
  if (/^\d{4}-\d{2}$/.test(period)) {
    const M = lang === "de" ? ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${M[+period.slice(5, 7) - 1]} ${period.slice(0, 4)}`;
  }
  return (lang === "de" ? "Saison " : "Season ") + period;
};

/**
 * Alle Posten eines Spielers: Beiträge je Zeitraum (bezahlt/erlassen/offen) und Geldstrafen.
 * fineName liefert den Namen der Strafe (Katalog). Nur Strafen mit Betrag zählen; erlassene/als Dienst erledigte nicht.
 */
export function itemsFor(D: Pick<TeamData, "cash" | "waivers" | "fines">, k: KasseSettings, pid: string, today: string, lang: Lang, fineName: (rule: string) => string,
  who: { active?: boolean; neu?: boolean } = {}): DueItem[] {
  const out: DueItem[] = [];
  // Beiträge nur für aktive, bestätigte Spieler (inaktive: nur noch Gebuchtes und offene Strafen; „neu“ = Beitritt noch nicht bestätigt)
  const chargeFees = who.active !== false && !who.neu;
  const waived = (fee: string, period: string): boolean => D.waivers.some(w => w.pid === pid && w.feeId === fee && (w.period === "*" || w.period === period));
  for (const fee of k.fees) {
    if (!appliesTo(fee, pid)) continue;
    for (const period of duePeriods(fee, today)) {
      const e = D.cash.find(x => x.feeId === fee.id && x.period === period && x.pid === pid);
      if (!e && !chargeFees) continue;
      const lbl = periodLabel(period, lang);
      out.push({ key: `fee:${fee.id}:${period}`, kind: "fee", pid, amount: e ? e.amount : fee.amount, label: lbl ? `${fee.name} · ${lbl}` : fee.name,
        date: periodStart(fee, period), feeId: fee.id, period, paid: !!e, waived: !e && waived(fee.id, period), entryId: e?.id });
    }
  }
  if (k.money) for (const f of D.fines) {
    if (f.pid !== pid || !f.amount || f.status === "waived") continue;
    const e = D.cash.find(x => x.fineId === f.id);
    // „erledigt“ ohne Zahlung im Kassenbuch (z. B. vor Einführung der Kasse) zählt als bezahlt
    out.push({ key: `fine:${f.id}`, kind: "fine", pid, amount: f.amount, label: fineName(f.rule), date: f.date, fineId: f.id,
      paid: !!e || f.status === "done", waived: false, entryId: e?.id });
  }
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1);
}

export interface PlayerDues { pid: string; open: number; paid: number; items: DueItem[] }
/** Übersicht je Spieler (aktive und – mit offenen Beträgen – inaktive Spieler) */
export function duesByPlayer(D: Pick<TeamData, "cash" | "waivers" | "fines" | "players" | "inactive">, k: KasseSettings, today: string, lang: Lang, fineName: (rule: string) => string): PlayerDues[] {
  const list: PlayerDues[] = [];
  const all: Player[] = [...D.players, ...D.inactive];
  for (const p of all) {
    const items = itemsFor(D, k, p.id, today, lang, fineName, { active: D.players.includes(p), neu: p.neu });
    const open = sumOf(items.filter(i => !i.paid && !i.waived)), paid = sumOf(items.filter(i => i.paid));
    if (D.players.includes(p) || open > 0) list.push({ pid: p.id, open, paid, items });
  }
  return list.sort((a, b) => b.open - a.open);
}
export const sumOf = (L: { amount: number }[]): number => Math.round(L.reduce((a, x) => a + x.amount, 0) * 100) / 100;

/** Kassenstand und Summen (optional ab einem Datum, z. B. Saisonbeginn) */
export function balance(cash: CashEntry[], from?: string): { total: number; inSum: number; outSum: number } {
  const L = from ? cash.filter(e => e.date >= from) : cash;
  const inSum = sumOf(L.filter(e => e.kind === "in")), outSum = sumOf(L.filter(e => e.kind === "out"));
  const total = Math.round((cash.reduce((a, e) => a + (e.kind === "in" ? e.amount : -e.amount), 0)) * 100) / 100;
  return { total, inSum, outSum };
}

/** Kassenbuch-Eintrag für die Zahlung eines Postens */
export function paymentFor(item: DueItem, date: string, note = ""): Omit<CashEntry, "id"> {
  return item.kind === "fee"
    ? { date, amount: item.amount, kind: "in", cat: "fee", pid: item.pid, feeId: item.feeId!, period: item.period!, fineId: null, note }
    : { date, amount: item.amount, kind: "in", cat: "fine", pid: item.pid, feeId: null, period: null, fineId: item.fineId!, note };
}

/** Saisonbeginn (1. Juli) des Datums */
export const seasonStart = (date: string): string => seasonOf(date).slice(0, 4) + "-07-01";

/** Befreiung eines Spielers gilt für diesen Beitrag/Zeitraum? (für Anzeige im Beitrag) */
export const isWaived = (waivers: CashWaiver[], pid: string, feeId: string, period: string): boolean =>
  waivers.some(w => w.pid === pid && w.feeId === feeId && (w.period === "*" || w.period === period));

/** Strafen, die als Geld zählen (für Hinweise im Strafenkatalog) */
export const moneyFines = (fines: FineEntry[]): FineEntry[] => fines.filter(f => (f.amount || 0) > 0);
