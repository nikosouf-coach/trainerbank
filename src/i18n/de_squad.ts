// Texte für Kader, Spielerprofil, Abwesenheiten, Gruppen, Baukasten und Einstellungen (Trainer) – de
import type { Dict } from "./types";

export const de_squad: Dict = {
  // Baukasten: Pakete und Module
  pk_basis: "Basis", pkd_basis: "Immer enthalten: Kalender, Kader, Spieler-App, Termine.",
  pk_belastung: "Belastung & Erholung", pkd_belastung: "Session-RPE, Ampel, Erholung nach Alter, Wachstum.",
  pk_planung: "Trainingsplanung", pkd_planung: "Wochenplan, Übungsarchiv mit Zeichentool, Vorbereitung und Pausen.",
  pk_leistung: "Leistung & Gesundheit", pkd_leistung: "Leistungstests und Verletzungsverlauf mit Befunden.",
  pk_analyse: "Spielanalyse", pkd_analyse: "Spieldaten, Noten mit Feedback und Videos.",
  pk_ki: "KI-Coach", pkd_ki: "Ausarbeitungen und Antworten mit deinem Teamkontext.",
  m_leistung: "Leistungsdiagnostik", md_leistung: "Sprint, Sprung, Ausdauer und Richtungswechsel mit Normwerten – verfeinert Belastung und Erholung.",
  m_befunde: "Verletzungen & Befunde", md_befunde: "Verletzungsverlauf, Befunde scannen und KI-Empfehlungen zum Wiedereinstieg.",
  m_spielanalyse: "Spieldaten & Bewertungen", md_spielanalyse: "Minuten, Tore, Assists, Noten von 1–10 und Feedback an Spieler.",
  m_videos: "Videos", md_videos: "Video-Links zu Spielen, Bewertungen und Übungen.",
  m_archiv: "Übungsarchiv & Zeichentool", md_archiv: "Übungen zeichnen, Einheiten speichern, nach Themen suchen, Trainerprofile mit Coachingpunkten.",
  m_vorbereitung: "Vorbereitung & Pausen", md_vorbereitung: "Vorbereitungen und längere Pausen planen, Freizeitprogramm für Spieler.",
  m_kontakte: "Kontakte", md_kontakte: "Ansprechpartner wie Koordinator, Vorstand, Physio und Arztpraxen.",
  bk_title: "Baukasten", bk_sub: "Funktionen und was Spieler sehen",
  bk_info: "Wähle, welche Funktionen dein Trainerteam nutzt und was deine Spieler in ihrer App sehen. Jedes Paket kann später einzeln gebucht werden; in der Testphase sind alle Pakete freigeschaltet.",
  bk_mods: "Funktionen fürs Trainerteam", bk_pview: "Das sehen deine Spieler", bk_needs: "benötigt „{m}“",
  pv_plan: "Wochenplan & Trainingsinhalte", pv_load: "Eigene Belastung, Erholung & Ampel", pv_att: "Eigene Trainingsbeteiligung",
  pv_tips: "Tipps zu Regeneration, Kraft, Ernährung & Schlaf", pv_goals: "Ziele & Potenziale (nur freigegebene)", pv_ai: "KI-Coach für Spieler",
  pv_ratings: "Noten & Feedback", pv_stats: "Spielstatistik (Minuten, Tore, Assists)", pv_tests: "Leistungstests", pv_videos: "Videos", pv_contacts: "Kontaktliste",
  pabs_t: "Absagen durch Spieler", pabs_d: "Spieler dürfen Trainings in der App absagen und Abwesenheiten eintragen. Aus: Nur das Trainerteam trägt ein.",
  // Mehr (Übersicht)
  mh_team: "Verein & Mannschaft", mh_training: "Training & Prinzipien", mh_access: "Spieler-App & Trainerteam", mh_account: "Konto & Datenschutz",
  mh_trainingSub: "{n} Trainingstage · Prinzipien · eigene Trainingsarten",
  // Team-Codes & Trainerteam
  cd_title: "Spieler einladen", cd_sub: "Spieler laden die App, geben den Team-Code ein und legen ihr Profil an.",
  cd_join: "Team-Code für Spieler", cd_staff: "Trainer-Code (für Co-Trainer, Physio)", cd_share: "Teilen", cd_new: "Neue Codes erzeugen",
  cd_newQ: "Neue Codes erzeugen? Die alten Codes funktionieren danach nicht mehr.", cd_shareText: "Tritt unserem Team „{t}“ in der Trainerbank-App bei: Code {c}",
  cd_hidden: "Codes werden beim Öffnen geladen.", cd_show: "Codes anzeigen", cd_ownerOnly: "Nur der Teaminhaber kann Codes neu erzeugen.",
  st_title2: "Trainerteam", st_pending: "Offene Anfragen", st_approve: "Annehmen", st_reject: "Ablehnen", st_asCoach: "als Trainer", st_asPhysio: "als Physio",
  role_owner: "Inhaber", role_coach: "Trainer", role_physio: "Physio", role_pending: "Anfrage", st_none: "Noch keine weiteren Trainer.",
  // Kader & Gruppen
  tab_gruppen: "Gruppen", gr_pos: "Positionsgruppen (automatisch)", gr_own: "Eigene Gruppen", gr_new: "Neue Gruppe", gr_name: "Name der Gruppe",
  gr_namePh: "z. B. Reha-Gruppe, Kapitänsrat, Offensive", gr_members: "{n} Spieler", gr_edit: "Mitglieder", gr_none: "Noch keine eigenen Gruppen.",
  gr_delQ: "Gruppe löschen? Die Spieler bleiben erhalten.", gr_info: "Positionsgruppen ergeben sich aus der Position. Eigene Gruppen kannst du frei anlegen und zum Filtern im Kader nutzen.",
  kd_newApp: "{n} neue Spieler aus der App", kd_newAppD: "Haben sich Spieler selbst angemeldet, die du schon angelegt hattest? Führe die Einträge zusammen, damit keine Daten doppelt sind.",
  kd_merge: "Zusammenführen", kd_mergeT: "Mit vorhandenem Spieler zusammenführen", kd_mergeD: "Die Daten aus der App werden dem gewählten Spieler zugeordnet. Der doppelte Eintrag wird entfernt.",
  kd_mergeGo: "Zusammenführen", kd_merged: "Zusammengeführt", kd_inactive: "inaktiv",
  // Spielerformular
  pf_new: "Spieler anlegen", pf_edit: "Spieler bearbeiten", pf_vn: "Vorname", pf_nn: "Nachname", pf_geb: "Geburtsdatum", pf_pos: "Position", pf_nr: "Rückennummer",
  pf_kg: "Gewicht (kg)", pf_groups: "Gruppen", pf_active: "Aktiv im Kader", pf_activeD: "Inaktive Spieler (z. B. abgemeldet) erscheinen nicht in Planung und Auswertungen.",
  pf_del: "Spieler löschen", pf_delQ: "Spieler wirklich löschen?", pf_delD: "Alle Daten dieses Spielers (Belastung, Wellness, Abwesenheiten, Notizen) werden gelöscht.",
  pf_saved: "Spieler gespeichert", pf_need: "Bitte Vor- und Nachname eingeben.",
  pr_photo: "Foto ändern", pr_photoD: "Das Bild sieht auch der Spieler in seiner App.", pr_photoSaved: "Foto gespeichert",
  pot_cat: "Bereich",
  pr_notesSave: "Notiz speichern", pr_absAdd: "+ Abwesenheit", pr_edit: "Bearbeiten",
  pos_TW: "Torwart", pos_RV: "Rechter Verteidiger", pos_IV: "Innenverteidiger", pos_LV: "Linker Verteidiger", pos_DM: "Defensives Mittelfeld",
  pos_ZM: "Zentrales Mittelfeld", pos_OM: "Offensives Mittelfeld", pos_LM: "Linkes Mittelfeld", pos_RM: "Rechtes Mittelfeld", pos_ST: "Sturm",
};
