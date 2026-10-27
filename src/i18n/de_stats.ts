// Texte: Statistik (Kennzahlen je Spieler mit Zeitraum und Filtern) und Wert neben dem Namen im Kader – de
import type { Dict } from "./types";

export const de_stats: Dict = {
  nvb_statistik: "Statistik", sx_title: "Statistik", sx_menuSub: "Beteiligung, Belastung, Noten, Spiele, Tests – filtern und vergleichen",
  sx_lead: "{n} Spieler · {p}", sx_leadF: "{n} von {m} Spielern · {p}",
  // Zeitraum
  sx_period: "Zeitraum", sx_p_7: "7 Tage", sx_p_28: "4 Wochen", sx_p_season: "Saison", sx_p_h1: "Hinrunde", sx_p_h2: "Rückrunde",
  sx_now: "aktuell",
  // Ansichten
  sx_v_overview: "Überblick", sx_v_training: "Training", sx_v_load: "Belastung", sx_v_games: "Spiele", sx_v_tests: "Tests", sx_v_dev: "Entwicklung", sx_v_custom: "Eigene",
  sx_colsEdit: "Anpassen", sx_colsPick: "Kennzahlen wählen", sx_colsMax: "Höchstens {n} Kennzahlen gleichzeitig – erst eine abwählen.", sx_colsN: "{n} von höchstens {m} gewählt",
  sx_colsReset: "Ansicht „Überblick“", sx_colsDone: "Übernehmen",
  // Tabelle
  sx_player: "Spieler", sx_team: "Team", sx_teamD: "Ø Mittel · Σ Summe", sx_avg: "Ø", sx_sum: "Σ",
  sx_hint: "Tippe auf eine Spalte zum Sortieren (noch einmal: andersherum), auf einen Spieler für sein Profil.",
  sx_empty: "Keine Spieler für diesen Filter.", sx_noStats: "Keine Kennzahlen verfügbar – die passenden Module im Baukasten einschalten.",
  sx_sortBy: "Sortiert nach {k}", sx_sortNr: "Rückennummer", sx_sortHint: "Sortieren – noch einmal tippen: andersherum",
  sx_sortBest: "beste zuerst", sx_sortWorst: "schwächste zuerst", sx_sortHigh: "höchste zuerst", sx_sortLow: "niedrigste zuerst",
  // Export
  sx_export: "Exportieren", sx_exportT: "Tabelle exportieren", sx_exportD: "CSV-Datei mit allen angezeigten Spielern und Kennzahlen (z. B. für Excel).",
  sx_exportHealth: "Enthält Gesundheitsdaten (Belastung, Morgen-Check, Ausfälle) – nur im Trainerteam weitergeben.",
  sx_exportGo: "CSV-Datei erstellen", sx_exported: "Tabelle exportiert", sx_exportErr: "Die Datei konnte nicht erstellt werden.",
  sx_nr: "Nr.", sx_pos: "Position", sx_teamCsv: "Team (Ø bzw. Summe)",
  // Kategorien
  sx_c_att: "Beteiligung", sx_c_load: "Belastung & RPE", sx_c_well: "Morgen-Check", sx_c_rate: "Benotungen", sx_c_games: "Spiele",
  sx_c_tests: "Leistungsdiagnostik", sx_c_dev: "Entwicklung", sx_c_health: "Ausfälle",
  // Kennzahlen: Name (Auswahl), kurz (Spaltenkopf), Erklärung
  sx_att: "Trainingsbeteiligung", sx_s_att: "Beteiligung", sx_d_att: "Anteil der Mannschaftstrainings, bei denen der Spieler da war – Tage mit Verletzung oder Krankheit zählen nicht.",
  sx_unexc: "Unentschuldigt gefehlt", sx_s_unexc: "Unentsch.", sx_d_unexc: "Trainings und Spiele, bei denen der Spieler unentschuldigt fehlte.",
  sx_acwr: "ACWR (akut : chronisch)", sx_s_acwr: "ACWR", sx_d_acwr: "Belastung der letzten 7 Tage im Verhältnis zum Wochenmittel davor. 0,8–1,3 = Sweet Spot.",
  sx_load: "Ø Wochenlast", sx_s_load: "Last/Wo.", sx_d_load: "Mittlere Belastung je Woche (RPE × Minuten, inklusive Zusatzeinheiten) in AU.",
  sx_rpe: "Ø RPE", sx_s_rpe: "Ø RPE", sx_d_rpe: "Mittlere empfundene Anstrengung (1–10) in Training, Spiel und weiteren Einheiten.",
  sx_rpeRate: "RPE eingetragen", sx_s_rpeRate: "RPE-Quote", sx_d_rpeRate: "Bei wie vielen besuchten Trainings der Spieler sein RPE eingetragen hat.",
  sx_extra: "Zusatzeinheiten", sx_s_extra: "Zusatz", sx_d_extra: "Selbst eingetragene Einheiten (Gym, Laufen, Schulsport …).",
  sx_well: "Ø Wohlbefinden", sx_s_well: "Wohlbef.", sx_d_well: "Summe aus Schlafqualität, Müdigkeit, Muskelkater und Stress (4–28) – weniger ist besser.",
  sx_sleep: "Ø Schlaf", sx_s_sleep: "Schlaf", sx_d_sleep: "Mittlere Schlafdauer laut Morgen-Check.",
  sx_wellRate: "Morgen-Check ausgefüllt", sx_s_wellRate: "Check-in", sx_d_wellRate: "An wie vielen Tagen der Spieler den Morgen-Check ausgefüllt hat (ab seinem ersten).",
  sx_rateG: "Ø Spielnote", sx_s_rateG: "Spielnote", sx_d_rateG: "Mittlere Note (1–10) aus den Spielbewertungen.",
  sx_marks: "Trainingseindruck", sx_s_marks: "Eindruck", sx_d_marks: "Wie oft der Spieler im Training besonders gut (+) oder besonders schwach (−) war.",
  sx_games: "Einsätze", sx_s_games: "Spiele", sx_d_games: "Spiele mit Spielzeit (von allen Spielen im Zeitraum).",
  sx_starts: "Startelf", sx_s_starts: "Startelf", sx_d_starts: "Spiele von Beginn an.",
  sx_min: "Spielminuten", sx_s_min: "Minuten", sx_d_min: "Gespielte Minuten insgesamt.",
  sx_minPct: "Anteil Spielzeit", sx_s_minPct: "Spielzeit", sx_d_minPct: "Gespielte Minuten im Verhältnis zur möglichen Spielzeit aller Spiele.",
  sx_goals: "Tore", sx_s_goals: "Tore", sx_d_goals: "Erzielte Tore.",
  sx_assists: "Vorlagen", sx_s_assists: "Vorlagen", sx_d_assists: "Torvorlagen.",
  sx_scorer: "Scorerpunkte", sx_s_scorer: "Scorer", sx_d_scorer: "Tore und Vorlagen zusammen.",
  sx_clean: "Zu null", sx_s_clean: "Zu null", sx_d_clean: "Torhüter: Spiele ohne Gegentor (ab 60 Minuten Spielzeit).",
  sx_conc: "Gegentore", sx_s_conc: "Gegentore", sx_d_conc: "Torhüter: Gegentore in der eigenen Spielzeit (wenn erfasst).",
  sx_saves: "Paraden", sx_s_saves: "Paraden", sx_d_saves: "Torhüter: Paraden in den Spielen (wenn erfasst).",
  sx_devC: "Kompetenzprofil", sx_s_devC: "Profil", sx_d_devC: "Mittel der letzten Einschätzung durch das Trainerteam (1–5).",
  sx_devS: "Selbsteinschätzung", sx_s_devS: "Selbst", sx_d_devS: "Mittel der letzten Selbsteinschätzung des Spielers (1–5).",
  sx_absDays: "Ausfalltage", sx_s_absDays: "Ausfall", sx_d_absDays: "Tage verletzt oder krank.",
  sx_inj: "Verletzungen", sx_s_inj: "Verletz.", sx_d_inj: "Neue Verletzungen im Zeitraum.",
  sx_d_test: "Letzter Wert bis zum Ende des Zeitraums, darunter die Veränderung zum vorherigen Test.",
  // Wert neben dem Namen (Kader)
  sx_val: "Wert neben dem Namen", sx_valD: "Was im Kader rechts neben jedem Spieler steht – gilt nur für dich.", sx_valNone: "Kein Wert",
  sx_valNow: "Kennzahlen mit „aktuell“ zeigen den neuesten Stand – der Zeitraum gilt für alle anderen.",
  sx_valOf: "{n} von {m}", sx_all: "Alle Statistiken", sx_allSub: "Kennzahlen vergleichen, filtern und sortieren",
  sx_minSub: "{n} Min.", sx_of: "von {n}",
};
