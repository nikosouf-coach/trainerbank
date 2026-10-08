// Zusätzliche Texte (Trainer: Heute, Kalender, Planung, Einheit) – de
import type { Dict } from "./types";

export const de_coach: Dict = {
  // Spiele, Noten, Videos
  gm_rateT: "Note & Feedback", gm_rating: "Note (1–10)", gm_feedback: "Feedback an den Spieler", gm_feedbackPh: "Was lief gut, woran soll er arbeiten?",
  gm_visible: "Für den Spieler sichtbar", gm_visibleD: "Erscheint in seiner App, wenn Noten im Baukasten freigegeben sind.",
  vd_none: "Noch keine Videos.", vd_add: "Video hinzufügen", vd_edit: "Video bearbeiten", vd_title: "Titel", vd_titlePh: "z. B. Highlights gegen SC Bergtal",
  vd_url: "Link zum Video", vd_urlHint: "YouTube (nicht gelistet), Veo, Hudl, Vimeo, Google Drive, Dropbox …", vd_urlBad: "Bitte einen vollständigen Link mit https:// eingeben.",
  vd_all: "Für alle Spieler", vd_note: "Notiz", vd_visD: "Spieler sehen das Video in ihrer App, wenn Videos im Baukasten freigegeben sind.",
  vd_groups: "An Gruppen", vd_noneSel: "Wähle mindestens einen Spieler oder eine Gruppe.",
  vd_privacy: "Gespeichert wird nur der Link, nicht das Video. Nutze nicht öffentliche Links und achte bei Minderjährigen auf die Einwilligung der Eltern.",
  sp_title: "Spielbericht", sp_result: "Ergebnis", sp_own: "Wir", sp_opp: "Gegner", sp_min: "Min.", sp_goals: "Tore", sp_assists: "Vorlagen", sp_start: "Startelf",
  sp_rate: "Note", sp_none: "Tippe auf einen Spieler, um Minuten, Tore, Vorlagen und Note einzutragen.", sp_fill: "Minuten aus RPE übernehmen", sp_filled: "{n} Spieler übernommen",
  sp_videos: "Videos zum Spiel", sp_open: "Spielbericht", sp_season: "Saison", sp_games: "Spiele", sp_avg: "Ø Note", sp_list: "Spiele & Statistik", sp_listSub: "Ergebnisse, Torschützen, Noten",
  sp_table: "Spielerstatistik", sp_results: "Ergebnisse", sp_noGames: "Noch keine gespielten Spiele.", sp_lib: "Videos", sp_libSub: "Alle Video-Links des Teams",
  sp_player: "Spieldaten", sp_played: "eingesetzt", sp_bench: "nicht eingesetzt", sp_resultSave: "Ergebnis speichern",
  pr_games: "Spiele & Bewertungen", pr_ratings: "Noten & Feedback", pr_noRatings: "Noch keine Noten.", tr_rate: "Note",
  // Zeichentool, Übungsarchiv, Einheiten, Trainerprofile
  bd_full: "Ganzes Feld", bd_half: "Halbes Feld", bd_box: "Strafraum", bd_free: "Freie Fläche", bd_t_a: "Spieler Team A", bd_t_b: "Spieler Team B", bd_t_gk: "Torwart",
  bd_t_cone: "Hütchen", bd_t_ball: "Ball", bd_t_goal: "Minitor", bd_t_pass: "Passweg – ziehen", bd_t_run: "Laufweg – ziehen", bd_t_drib: "Dribbling – ziehen", bd_t_zone: "Zone – ziehen",
  bd_t_move: "Verschieben – ziehen", bd_t_del: "Löschen – antippen", bd_undo: "Rückgängig", bd_clear: "Leeren", bd_draw: "Zeichnung", bd_add: "Zeichnung anlegen",
  ar_title: "Übungsarchiv", ar_sub: "Übungen, Einheiten, Trainerprofile", ar_ex: "Übungen", ar_tpl: "Einheiten", ar_staff: "Trainer", ar_new: "Übung", ar_search: "Übung oder Thema suchen", ar_all: "Alle",
  ar_none: "Keine Übungen gefunden.", ar_newTpl: "Einheit", ar_noTpl: "Noch keine gespeicherten Einheiten.",
  cat_warmup: "Aufwärmen", cat_technik: "Technik", cat_pass: "Passspiel", cat_abschluss: "Torabschluss", cat_spielform: "Spielform", cat_taktik: "Taktik", cat_athletik: "Athletik", cat_torwart: "Torwart", cat_cooldown: "Auslaufen",
  ex_title: "Titel", ex_cat: "Kategorie", ex_themes: "Themen", ex_themesPh: "Thema eingeben", ex_dur: "Dauer (Min.)", ex_players: "Spieler", ex_area: "Feldgröße", ex_rpe: "Intensität (RPE)",
  ex_desc: "Ablauf & Organisation", ex_points: "Coachingpunkte", ex_pointPh: "Neuer Coachingpunkt", ex_who: "Zuständig", ex_nobody: "alle", ex_video: "Video-Link (optional)", ex_saved: "Übung gespeichert",
  ex_del: "Übung löschen", ex_new: "Neue Übung", ex_aiPoints: "KI: Coachingpunkte vorschlagen", ex_edit: "Übung bearbeiten", ex_need: "Bitte einen Titel eingeben.",
  tp_rpeWarn: "Hinweis: Die Vorlage ist intensiver (≈ RPE {t}) als für diesen Tag geplant (RPE {p}). Umfang oder Intensität anpassen.", tp_title: "Name der Einheit", tp_theme: "Thema", tp_blocks: "Ablauf", tp_addEx: "Übung aus Archiv", tp_addText: "Freier Block", tp_text: "Inhalt", tp_total: "Gesamt: {m} Min.", tp_notes: "Notizen",
  tp_saved: "Einheit gespeichert", tp_del: "Einheit löschen", tp_use: "In Planung übernehmen", tp_useD: "Wähle den Trainingstag – Inhalt und Dauer werden ersetzt.", tp_used: "Für {d} übernommen",
  tp_pick: "Übung wählen", tp_fromArchive: "Aus Archiv", tp_saveAs: "Als Einheit speichern", tp_edit: "Einheit bearbeiten", tp_new: "Neue Einheit", tp_noDays: "In den nächsten zwei Wochen gibt es keinen Trainingstag.",
  sf_title: "Trainerprofile", sf_sub: "Aufgabenbereiche und Coachingpunkte", sf_new: "Profil", sf_name: "Name", sf_role: "Rolle", sf_areas: "Aufgabenbereiche", sf_areasPh: "z. B. Standards, Torhüter, Athletik",
  sf_points: "Coachingpunkte in Übungen", sf_noPoints: "Noch keine Coachingpunkte zugeordnet.", sf_phone: "Telefon", sf_email: "E-Mail", sf_note: "Notiz", sf_del: "Profil löschen", sf_saved: "Profil gespeichert", sf_none: "Noch keine Trainerprofile.",
  sr_chef: "Cheftrainer/in", sr_co: "Co-Trainer/in", sr_tw: "Torwarttrainer/in", sr_athletik: "Athletiktrainer/in", sr_physio: "Physio", sr_betreuer: "Betreuer/in", sr_analyst: "Analyst/in",
  rpe_coachQ: "Wie anstrengend war die Einheit für den Spieler? (1 = sehr leicht, 10 = maximal) – zum Nachtragen für Spieler ohne App.",
  abs_order: "Das Enddatum liegt vor dem Beginn.",
};
