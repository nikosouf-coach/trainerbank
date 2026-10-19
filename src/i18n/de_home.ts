// Startseite Trainer: Belastung im Team, Spieltag-Check.
import type { Dict } from "./types";

export const de_home: Dict = {
  db_matchday: "Spieltag-Check",
  // allgemeine Texte (fehlten bisher)
  hidden: "nur Trainerteam", date: "Datum",
  pl_weekProfile: "Wochenprofil", dv_sumAssessed: "Eingeschätzt (90 Tage)", dv_sumGoals: "Mit laufenden Zielen", dv_sumTalks: "Gespräche fällig", tk_sendShort: "Neu", kd_shown: "{n} von {m} Spielern", pr_adviceT: "Was heißt das fürs Training?",
  mp_newShort: "Neu anlegen", mp_copyLastShort: "Letzten übernehmen",
  ts_title: "Belastung im Team",
  ts_info1: "Grundlage ist das Verhältnis der Belastung der letzten 7 Tage zum Wochenschnitt der letzten 4 Wochen (ACWR, Belastung = Minuten × RPE).",
  ts_info2: "Sweet Spot (0,8–1,3): belastbar, Steigerung um 5–10 % pro Woche möglich. An der Grenze (1,3–1,5): halten. Überlastung (über 1,5): deutlich erhöhtes Verletzungsrisiko – Umfang und Intensität senken. Unterbelastet (unter 0,8): zu wenig Reiz, die Fitness sinkt – Zusatzreize setzen.",
  ts_info3: "Datenaufbau: Für eine Einschätzung braucht es mindestens 3 Wochen mit Einträgen. Tippe auf eine Zone, um die Spieler zu sehen.",
  ts_crit: "{n} Spieler überlastet: in den nächsten 2–3 Einheiten höchstens RPE 5, Sprints und Zweikämpfe dosieren.",
  ts_crit1: "1 Spieler überlastet: in den nächsten 2–3 Einheiten höchstens RPE 5, Sprints und Zweikämpfe dosieren.",
  ts_warn: "{n} Spieler an der Grenze: Belastung halten, nicht weiter steigern.",
  ts_warn1: "1 Spieler an der Grenze: Belastung halten, nicht weiter steigern.",
  ts_low: "{n} Spieler unterbelastet: Zusatzreize setzen (Spielformen, Kompensation, Athletik).",
  ts_low1: "1 Spieler unterbelastet: Zusatzreize setzen (Spielformen, Kompensation, Athletik).",
  ts_allOk: "Das Team ist im Zielbereich – Steigerung um 5–10 % pro Woche möglich.",
  ts_build: "Noch Datenaufbau: jede Einheit mit RPE erfassen, dann folgt die Einschätzung.",
  md_title: "Spieltag-Check", md_inDays: "in {n} Tagen",
  md_planNone: "Noch kein Matchplan", md_planNoneSub: "Aufstellung, Taktik und Standards vorbereiten",
  md_planDraft: "Matchplan noch nicht freigegeben", md_planDraftSub: "Spieler sehen ihn erst nach der Freigabe", md_planScheduled: "Freigabe geplant – startet automatisch",
  md_planLive: "Matchplan freigegeben", md_planChanged: "Matchplan seit der Freigabe geändert", md_planChangedSub: "Freigabe aktualisieren, damit die Spieler den neuen Stand sehen",
  md_lineupOpen: "Aufstellung: {n} von {m} Positionen besetzt", md_lineupOpenSub: "Offene Positionen besetzen",
  md_lineupOut: "Startelf: {n} fällt aus", md_lineupOk: "Aufstellung steht ({f})", md_bench: "{n} auf der Bank",
  md_absent: "{n} fehlen · {a} verfügbar", md_allAvail: "Alle {n} Spieler verfügbar",
  md_load: "{n} Spieler überlastet", md_load1: "1 Spieler überlastet", md_loadSub: "Einsatzzeit dosieren", md_loadOk: "Keine Überlastung im Kader",
  md_duties: "{n} Dienste eingeteilt", md_dutiesNone: "Noch keine Dienste eingeteilt", md_dutiesNoneSub: "z. B. Trikots, Getränke, Fahrdienst",
  md_tasks: "{n} offene Aufgaben bis zum Spiel", md_tasks1: "1 offene Aufgabe bis zum Spiel",
};
