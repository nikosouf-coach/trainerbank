// Navigation der Trainer-App: Register aller Bereiche, untere Leiste und Menü „Mehr“. Jeder Trainer legt selbst fest,
// welche Bereiche in der unteren Leiste stehen (bis zu fünf, „Mehr“ immer rechts) und welche im Menü erscheinen
// (gespeichert je Konto in profiles.prefs.nav).
import { useRouter } from "expo-router";
import { chatSettings } from "../core/chat";
import { openRequests } from "../core/dev";
import type { Perm } from "../core/perms";
import type { Modules } from "../core/types";
import { useStore } from "../data/store";
import type { IconName } from "./icons";

/** Gruppen im Menü (Reihenfolge) */
export type NavGroup = "team" | "training" | "spiel" | "orga" | "setup";
export const NAV_GROUPS: NavGroup[] = ["team", "training", "spiel", "orga", "setup"];

export interface NavCtx { mods: Partial<Modules>; can: (p: Perm) => boolean; chatOn: boolean }
export interface NavItem {
  /** Schlüssel = Name der Seite in der Tab-Navigation (wenn tab) */
  k: string; href: string; icon: IconName;
  /** i18n: kurz (untere Leiste), Titel und Untertitel (Menü) */
  short: string; title: string; sub: string;
  group: NavGroup;
  /** kann in die untere Leiste (Seite liegt in app/coach/(tabs)) */
  tab: boolean;
  need?: (x: NavCtx) => boolean;
}

export const NAV: NavItem[] = [
  { k: "heute", href: "/coach/heute", icon: "heute", short: "nav_heute", title: "nav_heute", sub: "nvs_heute", group: "orga", tab: true },
  { k: "kalender", href: "/coach/kalender", icon: "kalender", short: "nav_kalender", title: "nav_kalender", sub: "nvs_kalender", group: "orga", tab: true },
  { k: "plan", href: "/coach/plan", icon: "plan", short: "nav_plan", title: "nvt_plan", sub: "nvs_plan", group: "training", tab: true, need: x => !!x.mods.planung },
  { k: "kader", href: "/coach/kader", icon: "kader", short: "nav_kader", title: "nav_kader", sub: "nvs_kader", group: "team", tab: true },
  { k: "chat", href: "/coach/chat", icon: "chat", short: "nav_chat", title: "nav_chat", sub: "nvs_chat", group: "orga", tab: true, need: x => x.chatOn },
  { k: "entwicklung", href: "/coach/entwicklung", icon: "trend", short: "nvb_entwicklung", title: "dv_overview", sub: "dv_menuSub", group: "team", tab: true, need: x => !!x.mods.entwicklung },
  { k: "individual", href: "/coach/individual", icon: "target", short: "nvb_individual", title: "iq_title", sub: "iq_menuSub", group: "team", tab: true, need: x => !!x.mods.entwicklung },
  { k: "challenge", href: "/coach/challenge", icon: "flame", short: "nvb_challenge", title: "cg_title", sub: "cg_menuSub", group: "team", tab: true, need: x => !!x.mods.challenge },
  { k: "leistung", href: "/coach/leistung", icon: "stopwatch", short: "nvb_leistung", title: "lt_title", sub: "lt_sub", group: "training", tab: true, need: x => !!x.mods.leistung },
  { k: "training", href: "/coach/training", icon: "whistle", short: "nvb_training", title: "mh_training", sub: "mh_trainingSub", group: "training", tab: true },
  { k: "vorbereitung", href: "/coach/vorbereitung", icon: "sun", short: "nvb_vorbereitung", title: "vb_title", sub: "vb_sub", group: "training", tab: true, need: x => !!x.mods.vorbereitung },
  { k: "archiv", href: "/coach/archiv", icon: "book", short: "nvb_archiv", title: "ar_title", sub: "ar_sub", group: "training", tab: true, need: x => !!x.mods.archiv },
  { k: "matchplaene", href: "/coach/matchplaene", icon: "board", short: "nvb_matchplaene", title: "mp_list", sub: "mp_menuSub", group: "spiel", tab: true, need: x => !!x.mods.matchplan },
  { k: "spiele", href: "/coach/spiele", icon: "ball", short: "nvb_spiele", title: "sp_list", sub: "sp_listSub", group: "spiel", tab: true, need: x => !!x.mods.spielanalyse },
  { k: "videos", href: "/coach/videos", icon: "video", short: "nvb_videos", title: "sp_lib", sub: "sp_libSub", group: "spiel", tab: true, need: x => !!x.mods.videos },
  { k: "scouting", href: "/coach/scouting", icon: "scout", short: "nav_scout", title: "m_kaderplanung", sub: "sk_menuSub", group: "spiel", tab: true, need: x => !!x.mods.kaderplanung && x.can("scout") },
  { k: "aufgaben", href: "/coach/aufgaben", icon: "checklist", short: "nvb_aufgaben", title: "tk_title2", sub: "tk_menuSub", group: "orga", tab: true },
  { k: "kasse", href: "/coach/kasse", icon: "wallet", short: "nvb_kasse", title: "ks_title", sub: "ks_menuSub", group: "orga", tab: true, need: x => x.can("cash") },
  { k: "kontakte", href: "/coach/kontakte", icon: "phone", short: "nvb_kontakte", title: "ct_title", sub: "ct_sub", group: "orga", tab: true, need: x => !!x.mods.kontakte },
  { k: "team", href: "/coach/team", icon: "shield", short: "nvb_team", title: "mh_team", sub: "nvs_team", group: "setup", tab: true },
  { k: "verein", href: "/verein", icon: "club", short: "cl_title", title: "cl_title", sub: "cl_menuSub", group: "setup", tab: false },
  { k: "baukasten", href: "/coach/baukasten", icon: "grid", short: "nvb_baukasten", title: "bk_title", sub: "bk_sub", group: "setup", tab: true, need: x => x.can("admin") },
  { k: "zugang", href: "/coach/zugang", icon: "key", short: "nvb_zugang", title: "mh_access", sub: "nvs_zugang", group: "setup", tab: true },
  { k: "wiki", href: "/wiki", icon: "help", short: "wk_menu", title: "wk_menu", sub: "wk_menuSub", group: "setup", tab: false },
  { k: "konto", href: "/konto", icon: "person", short: "mh_account", title: "mh_account", sub: "nvs_konto", group: "setup", tab: false },
];
export const navItem = (k: string): NavItem | undefined => NAV.find(n => n.k === k);
/** Höchstens fünf Bereiche in der unteren Leiste (dazu „Mehr“) */
export const MAX_BAR = 5;
/** Standard der Leiste: die ersten fünf verfügbaren */
export const DEFAULT_BAR = ["heute", "kalender", "plan", "kader", "chat", "matchplaene", "entwicklung", "aufgaben"];

/** Verfügbare Bereiche (Module und Rechte) */
export const availNav = (x: NavCtx): NavItem[] => NAV.filter(n => !n.need || n.need(x));
/** Leiste: gespeicherte Auswahl (nur verfügbare Tab-Bereiche, ohne Doppelte, höchstens fünf) bzw. der Standard */
export function barOf(saved: string[] | undefined, avail: NavItem[]): string[] {
  const ok = new Set(avail.filter(n => n.tab).map(n => n.k));
  const L = (saved && saved.length ? saved : DEFAULT_BAR).filter((k, i, a) => ok.has(k) && a.indexOf(k) === i).slice(0, MAX_BAR);
  return L.length ? L : ["heute"];
}

/** Navigation des angemeldeten Trainers: verfügbare Bereiche, Leiste, ausgeblendete Menüpunkte, Speichern */
export function useNav() {
  const s = useStore();
  const D = s.D;
  const x: NavCtx = { mods: D?.team.modules || {}, can: s.can, chatOn: !!D && D.team.modules.chat !== false && chatSettings(D.team).on };
  const items = availNav(x);
  const saved = s.prefs.nav;
  const bar = barOf(saved?.bar, items);
  const hidden = new Set((saved?.hide || []).filter(k => items.some(n => n.k === k) && !bar.includes(k)));
  const save = (nb: string[], nh: string[]) => s.setPrefs({ nav: { bar: nb.slice(0, MAX_BAR), hide: [...new Set(nh)].slice(0, 40) } });
  const reset = () => s.setPrefs({ nav: undefined });
  /** Zahl am Menüpunkt (z. B. offene Anfragen) */
  const badge = (k: string): number => k === "individual" && D ? openRequests(D).length : 0;
  return { items, bar, hidden, save, reset, badge, custom: !!saved?.bar?.length || !!saved?.hide?.length };
}

/** Zurück-Knopf für Bereichsseiten: nicht nötig, wenn die Seite in der unteren Leiste liegt; sonst zurück zu „Mehr“ */
export function useNavBack(k: string): { onBack?: () => void; backLabel: string } {
  const s = useStore(); const router = useRouter(); const nav = useNav();
  if (nav.bar.includes(k)) return { backLabel: "" };
  return { onBack: () => router.canGoBack() ? router.back() : router.replace("/coach/mehr"), backLabel: s.tr.t("mo_title") };
}
