// Texte: Gestaltung (Detailseiten, Bereiche, neue Übersichten) – de
import type { Dict } from "./types";

export const de_design: Dict = {
  wdl: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  // Bausteine der Detailseiten
  ix_explain: "Was heißt das?", ix_tips: "Vorschläge", ix_bg: "Hintergrund & Quellen",
  // Belastung im Team
  tl_leadCrit1: "1 Spieler überlastet, {ok} im Sweet Spot", tl_leadCrit: "{n} Spieler überlastet, {ok} im Sweet Spot",
  tl_leadWarn1: "1 Spieler an der Grenze, {ok} im Sweet Spot", tl_leadWarn: "{n} Spieler an der Grenze, {ok} im Sweet Spot",
  tl_leadOk: "{ok} von {all} Spielern im Sweet Spot", tl_leadBuild: "Noch zu wenige Einträge für eine Einschätzung",
  tl_toPlan: "Woche in der Planung anpassen", tl_showAll: "Alle {n} anzeigen", tl_week: "7 Tage {a} AU, Schnitt {b} AU",
  tl_off: "Das Modul Belastung ist ausgeschaltet.",
  // Kader
  yrs: "J.", sts_crit: "Überlastet", sts_warn: "An der Grenze", sts_low: "Unterbelastet", sts_inj: "Ausfall",
  // Spielerprofil: Bereiche
  ps_areas: "Bereiche", ps_load: "Belastung & Erholung", ps_health: "Gesundheit", ps_lastTest: "Letzter Test am {d}", ps_noTests: "Noch keine Tests",
  ps_games: "{g} Spiele, {m} Min.", ps_goals: "{n} laufende Ziele", ps_noGoals: "Noch keine Ziele", ps_noNote: "Noch keine Notiz",
  ps_injSince: "{n} seit {d}", ps_recSub: "Vorschlag der App prüfen, anpassen und an den Spieler senden.",
  k_wellSub: "4 bis 28, weniger ist besser",
  kt_att: "Beteiligung", kt_attSub: "Letzte 28 Tage", kt_sleep: "Schlaf",
  // Spieler: Körper heute und Meine Daten
  pk_why: "Grund", pk_helps: "Das hilft dir jetzt", pk_moreTips: "Alle Tipps", pk_moreTipsSub: "Regeneration, Kraft, Ernährung, Schlaf",
  pdx_week: "Woche & Abzeichen", pdx_season: "Saison & Feedback", pdx_tests: "Meine Tests", pdx_att: "Beteiligung & Abwesenheiten",
  pdx_none: "Dein Trainer hat noch keine Daten für dich freigegeben.",
  gm_relS: "Zuverlässigkeit",
  ps_due: "Fällig", ps_notAssessed: "Noch nicht eingeschätzt",
  nvs_belastung: "Zonen, Spieler, Vorschläge, Hintergrund",
  notReady1: "1 Spieler bis dahin nicht erholt",
};
