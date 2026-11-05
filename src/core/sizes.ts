// Größen & Ausrüstung: Jeder Spieler trägt seine Größen selbst ein (Oberteil, Hose, Schuhe; Torhüter auch Handschuhe),
// dazu den Namen für die Beflockung und einen Hinweis. Daraus entsteht die Bestellliste fürs Trainerteam: Summen je
// Größe, Liste je Spieler, als CSV-Datei (Excel) oder als Text zum Teilen. Die Stutzengröße ergibt sich aus der
// Schuhgröße. Reine Logik; dieselben Grenzen prüft die Datenbank (player_sizes).
import { groupOf } from "./classes";
import type { Translator } from "./i18n";
import { oneLine, paragraph } from "./text";
import type { ClassKey, Player, PlayerSizes, TeamData } from "./types";

export const KIDS_SIZES = ["116", "128", "140", "152", "164", "176"];
export const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
export const CLOTH_SIZES = [...KIDS_SIZES, ...ADULT_SIZES];
export const SIZE_LIMITS = { shoesMin: 26, shoesMax: 50, glovesMin: 4, glovesMax: 12, print: 20, note: 200 } as const;
/** Stutzen nach Schuhgröße (übliche Einteilung der Ausrüster) */
export const SOCK_RANGES: [number, number][] = [[27, 30], [31, 34], [35, 38], [39, 42], [43, 46], [47, 50]];

export const emptySizes = (): PlayerSizes => ({ top: null, bottom: null, shoes: null, gloves: null, print: "", note: "" });

/** Kleidergröße aus der Liste (Groß-/Kleinschreibung egal; „XXXL“ = „3XL“, „2XL“ = „XXL“) */
export function cleanCloth(v: unknown): string | null {
  const x = String(v ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const k = x === "XXXL" ? "3XL" : x === "2XL" ? "XXL" : x;
  return CLOTH_SIZES.includes(k) ? k : null;
}
/** Größe in halben Schritten zwischen min und max (Komma oder Punkt), sonst null */
export function cleanHalf(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.trim().replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 2) / 2;
  return r >= min && r <= max ? r : null;
}
/** Name für die Beflockung: eine Zeile, höchstens 20 Zeichen */
export const cleanPrint = (v: unknown): string => oneLine(v, SIZE_LIMITS.print);

/** Größen bereinigen (unbekannte Werte fallen weg; Eingaben auch als Text, z. B. „42,5“ oder aus der Datenbank) */
export function cleanSizes(x: { [K in keyof PlayerSizes]?: unknown } | null | undefined): PlayerSizes {
  const v = x || {};
  return {
    top: cleanCloth(v.top), bottom: cleanCloth(v.bottom),
    shoes: cleanHalf(v.shoes, SIZE_LIMITS.shoesMin, SIZE_LIMITS.shoesMax),
    gloves: cleanHalf(v.gloves, SIZE_LIMITS.glovesMin, SIZE_LIMITS.glovesMax),
    print: cleanPrint(v.print), note: paragraph(v.note, SIZE_LIMITS.note),
  };
}
/** Nichts eingetragen (dann wird der Eintrag gelöscht) */
export const sizesEmpty = (s: PlayerSizes): boolean => !s.top && !s.bottom && s.shoes == null && s.gloves == null && !s.print && !s.note;
/** Vollständig: Oberteil, Hose und Schuhe (Handschuhe sind freiwillig) */
export const sizesComplete = (s: PlayerSizes | null | undefined): boolean => !!s && !!s.top && !!s.bottom && s.shoes != null;
/** Hat der Spieler seine Größen vollständig eingetragen? */
export const hasSizes = (D: Pick<TeamData, "sizes">, pid: string): boolean => sizesComplete(D.sizes[pid]);
/** Aktive Spieler ohne vollständige Größen (Reihenfolge des Kaders) – leer, solange die Größen nicht geladen sind */
export const missingSizes = (D: Pick<TeamData, "players" | "sizes" | "sizesOk">): Player[] =>
  D.sizesOk ? D.players.filter(p => p.active !== false && !hasSizes(D, p.id)) : [];
/** Davon mit eigenem Konto – sie können die Größen selbst eintragen (Erinnerung als Nachricht) */
export const remindableSizes = (D: Pick<TeamData, "players" | "sizes" | "sizesOk">): Player[] => missingSizes(D).filter(p => !!p.userId);
/** Kindergrößen (116–176) gleich anbieten? Bis zur U15 – sonst auf Wunsch */
export const kidsSizes = (cls: ClassKey): boolean => ["u11", "u15"].includes(groupOf(cls));

/** Stutzengröße zur Schuhgröße (z. B. 42 → „39–42“, 42,5 → „43–46“) */
export function sockOf(shoes: number | null): string | null {
  if (shoes == null) return null;
  const r = SOCK_RANGES.find(([, hi]) => shoes <= hi) || SOCK_RANGES[SOCK_RANGES.length - 1];
  return `${r[0]}–${r[1]}`;
}
/** Halbe Größen in der Sprache (42,5 bzw. 42.5) */
export const fmtHalf = (n: number, lang: string): string => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(".", lang === "de" ? "," : ".");

// ---------- Bestellliste ----------
export type OrderItem = "top" | "bottom" | "socks" | "shoes" | "gloves";
export const ORDER_ITEMS: OrderItem[] = ["top", "bottom", "socks", "shoes", "gloves"];

/** Größe eines Spielers für einen Artikel (als Text) */
export function sizeFor(s: PlayerSizes | null | undefined, item: OrderItem, lang: string): string | null {
  if (!s) return null;
  switch (item) {
    case "top": return s.top;
    case "bottom": return s.bottom;
    case "socks": return sockOf(s.shoes);
    case "shoes": return s.shoes == null ? null : fmtHalf(s.shoes, lang);
    case "gloves": return s.gloves == null ? null : fmtHalf(s.gloves, lang);
  }
}
/** Braucht der Spieler den Artikel? Handschuhe nur Torhüter (oder wer eine Größe angegeben hat) */
export const needsItem = (p: Player, s: PlayerSizes | null | undefined, item: OrderItem): boolean => item !== "gloves" || p.pos === "TW" || s?.gloves != null;

export interface OrderLine {
  pid: string; nr: number | null; name: string;
  /** Name für die Beflockung (eingetragen oder Nachname) */
  print: string;
  vals: Partial<Record<OrderItem, string>>;
  /** Artikel, die der Spieler braucht, für die aber die Größe fehlt */
  missing: OrderItem[];
  note: string;
}
export interface OrderTotal { item: OrderItem; counts: { size: string; n: number }[]; n: number; missing: number }
export interface Order { lines: OrderLine[]; totals: OrderTotal[] }

/** Reihenfolge der Größen eines Artikels */
const rank = (item: OrderItem, size: string): number =>
  item === "top" || item === "bottom" ? CLOTH_SIZES.indexOf(size) : parseFloat(size.replace(",", "."));

/**
 * Bestellliste: je Spieler die Größen der gewählten Artikel (Rückennummer, dann Name), Summen je Größe und wie viele
 * Größen noch fehlen. Spieler, die einen Artikel nicht brauchen (Handschuhe ohne Torhüter), zählen dort nicht.
 */
export function orderOf(D: Pick<TeamData, "sizes">, players: Player[], items: OrderItem[], opts: { lang: string; name: (p: Player) => string }): Order {
  const its = ORDER_ITEMS.filter(i => items.includes(i));
  const lines: OrderLine[] = players.map(p => {
    const s = D.sizes[p.id], vals: Partial<Record<OrderItem, string>> = {}, missing: OrderItem[] = [];
    for (const i of its) {
      if (!needsItem(p, s, i)) continue;
      const v = sizeFor(s, i, opts.lang);
      if (v) vals[i] = v; else missing.push(i);
    }
    return { pid: p.id, nr: p.nr ?? null, name: opts.name(p), print: s?.print || p.nn, vals, missing, note: s?.note || "" };
  }).sort((a, b) => (a.nr ?? 1000) - (b.nr ?? 1000) || a.name.localeCompare(b.name, opts.lang));
  const byPid = new Map(players.map(p => [p.id, p]));
  const totals: OrderTotal[] = its.map(item => {
    const m = new Map<string, number>(); let missing = 0;
    for (const l of lines) {
      const v = l.vals[item];
      if (v) m.set(v, (m.get(v) || 0) + 1);
      else if (needsItem(byPid.get(l.pid)!, D.sizes[l.pid], item)) missing++;
    }
    const counts = [...m.entries()].map(([size, n]) => ({ size, n })).sort((a, b) => rank(item, a.size) - rank(item, b.size));
    return { item, counts, n: counts.reduce((x, c) => x + c.n, 0), missing };
  });
  return { lines, totals };
}

/** Summen eines Artikels als Text („S 2 · M 8 · L 6“) */
export const totalText = (t: OrderTotal): string => t.counts.map(c => `${c.size}: ${c.n}`).join(" · ");

/**
 * Bestellliste als CSV (Excel): auf Deutsch Semikolon, auf Englisch Komma; mit BOM, damit Umlaute stimmen. Oben je
 * Spieler eine Zeile, darunter die Summen je Artikel und Größe.
 */
export function orderCsv(o: Order, opts: { print: boolean }, tr: Translator): string {
  const { t } = tr, de = tr.lang === "de", sep = de ? ";" : ",";
  // Freitexte der Spieler (Name, Hinweis): Zellen, die mit = + - @ beginnen, nicht als Formel öffnen lassen
  const q = (x: string): string => {
    const v = /^[=+\-@\t\r]/.test(x) ? "'" + x : x;
    return v.includes(sep) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const its = o.totals.map(x => x.item);
  const rows: string[][] = [
    [t("gr_csvNr"), t("gr_csvName"), ...(opts.print ? [t("gr_csvPrint")] : []), ...its.map(i => t("gr_item_" + i)), t("gr_csvNote")],
    ...o.lines.map(l => [l.nr != null ? String(l.nr) : "", l.name, ...(opts.print ? [l.print] : []),
      ...its.map(i => l.vals[i] || (l.missing.includes(i) ? t("gr_csvMissing") : "")), l.note.replace(/\n+/g, " ")]),
    [],
    [t("gr_csvItem"), t("gr_csvSize"), t("gr_csvCount")],
    ...o.totals.flatMap(x => [
      ...x.counts.map(c => [t("gr_item_" + x.item), c.size, String(c.n)]),
      ...(x.missing ? [[t("gr_item_" + x.item), t("gr_csvMissing"), String(x.missing)]] : []),
    ]),
  ];
  return "﻿" + rows.map(r => r.map(q).join(sep)).join("\r\n");
}

/** Bestellliste als Text zum Teilen (z. B. an den Ausrüster): Summen, fehlende Größen, Liste je Spieler */
export function orderText(o: Order, opts: { print: boolean; title: string }, tr: Translator): string {
  const { t, tf } = tr;
  const out = [opts.title, ""];
  for (const x of o.totals) {
    out.push(`${t("gr_item_" + x.item)}: ${x.counts.length ? totalText(x) : "–"} (${x.n})`);
  }
  const miss = o.lines.filter(l => l.missing.length);
  if (miss.length) out.push("", tf("gr_textMissing", { n: miss.map(l => `${l.name} (${l.missing.map(i => t("gr_item_" + i)).join(", ")})`).join("; ") }));
  out.push("");
  for (const l of o.lines) {
    const head = [l.nr != null ? "#" + l.nr : "", l.name, opts.print && l.print ? `„${l.print}“` : ""].filter(Boolean).join(" ");
    const vals = o.totals.map(x => l.vals[x.item] ? `${t("gr_item_" + x.item)} ${l.vals[x.item]}` : "").filter(Boolean).join(" · ");
    out.push(`${head}: ${vals || "–"}${l.note ? ` (${l.note.replace(/\n+/g, " ")})` : ""}`);
  }
  return out.join("\n");
}
