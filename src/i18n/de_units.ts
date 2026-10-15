// Texte: mehrere Einheiten am Tag, Torwarttraining, Trainingseindruck – de
import type { Dict } from "./types";

export const de_units: Dict = {
  // Arten weiterer Einheiten
  ua_athletik: "Athletik", ua_kraft: "Kraft & Stabilität", ua_tw: "Torwarttraining", ua_technik: "Technik", ua_taktik: "Taktik/Video",
  ua_praev: "Prävention & Mobilität", ua_reha: "Reha/Aufbau", ua_sonst: "Weitere Einheit",
  uad_athletik: "z. B. Schnelligkeit, Sprungkraft, Laufkoordination", uad_kraft: "Krafttraining, Rumpf, Stabilität", uad_tw: "Torhüter mit Torwarttrainer",
  uad_technik: "Technik in Kleingruppen", uad_taktik: "Videoanalyse oder Taktik im Gehen (Walk-through)", uad_praev: "Verletzungsprävention, Mobilität, Aktivierung",
  uad_reha: "Reha- und Aufbaugruppe", uad_sonst: "eigene Einheit",

  // Einheiten am Tag
  un_title: "Einheiten des Tages", un_titleInfo: "Mehrere Einheiten am Tag – z. B. 30 Min. Athletik und danach 90 Min. Mannschaftstraining oder ein Torwarttraining. Jede Einheit hat Uhrzeit, Dauer, Ziel-RPE und Zuständige; Spieler tragen ihre RPE je Einheit ein und alles zählt zur Belastung.",
  un_main: "Mannschaftstraining", un_add: "Einheit hinzufügen", un_new: "Neue Einheit", un_edit: "Einheit bearbeiten",
  un_name: "Bezeichnung (optional)", un_namePh: "z. B. Sprint-ABC, Kraftzirkel", un_time: "Beginn", un_dur: "Dauer (Min.)", un_rpe: "Ziel-RPE",
  un_rpeAuto: "Richtwert", un_for: "Für", un_all: "Ganzes Team", un_gks: "Alle Torhüter", un_staff: "Zuständig", un_staffNone: "Niemand festgelegt",
  un_content: "Inhalt / Schwerpunkt", un_contentPh: "Was wird gemacht? (für Trainerteam und Spieler)", un_themes: "Schwerpunkte", un_save: "Einheit speichern",
  un_del: "Einheit löschen", un_cancelDay: "An diesem Tag absagen", un_restore: "Wieder ansetzen", un_cancelled: "abgesagt", un_weekly: "jede Woche", un_members: "{n} Spieler", un_membersNone: "Niemand zugeordnet", un_groupGone: "Gruppe gelöscht",
  un_hiddenGroup: "Diese Gruppe ist für Spieler nicht sichtbar – die Einheit erscheint deshalb nicht in der Spieler-App, und Spieler können dafür keine RPE eintragen.",
  un_showGroup: "Gruppe für Spieler sichtbar machen", un_max: "Höchstens {n} weitere Einheiten pro Tag.",
  un_weeklyT: "Weitere Einheiten jede Woche", un_weeklyD: "z. B. 30 Min. Athletik vor dem Training oder ein Torwarttraining. Sie erscheinen automatisch im Plan und in der Spieler-App und zählen zur Belastung.",
  un_weeklyNone: "Keine weiteren Einheiten.", un_weeklyAdd: "Einheit für {d} hinzufügen", un_noTraining: "kein Mannschaftstraining",
  un_blockedNote: "Fällt an Spieltagen, in Pausen und bei abgesagtem Mannschaftstraining automatisch aus.",
  un_loadNote: "Zählt zur Belastung (RPE × Minuten). Die Ziel-RPE gibst du vor – sie wird nicht automatisch angepasst; die Wochensteuerung berücksichtigt sie beim Mannschaftstraining.",
  un_editWeekly: "Wochenrhythmus bearbeiten", un_dayOnly: "Änderungen hier gelten nur für diesen Tag. Für jede Woche: Einstellungen → Trainingstage.",
  un_fromWeekly: "aus dem Wochenrhythmus", un_extraDay: "nur an diesem Tag", un_saved: "Einheit gespeichert", un_deleted: "Einheit gelöscht",
  un_cancelledT: "Einheit abgesagt", un_restored: "Einheit wieder angesetzt", un_noMembers: "Für diese Einheit ist niemand eingeteilt.", un_avg: "Ø RPE {r}", un_entered: "{a} von {n} eingetragen",
  un_allTarget: "Alle mit Ziel-RPE", un_allTargetD: "Fehlende Einträge mit der Ziel-RPE und Dauer der Einheit ergänzen (nur, wer da war).",
  un_filled: "{n} Einträge ergänzt", un_blocks: "Ablauf: {u}",
  un_load: "Weitere Einheiten (Ø je Spieler)",
  un_participants: "Teilnehmer",

  // RPE-Eintrag (Spieler)
  pe_dives: "Sprünge/Hechtsprünge (ca.)", pe_divesD: "Nur Torhüter: ungefähre Zahl der Sprünge, Hechtsprünge und Landungen – sie belasten anders als Laufen.",
  pe_unitOf: "{u} · {t} Uhr",

  // Trainingseindruck
  te_title: "Trainingseindruck", te_info: "Bewertet werden nur Ausreißer: Standard ist Durchschnitt und wird nicht gespeichert. Markiere nur besonders gute oder besonders schwache Trainingsleistungen – gern mit Grund. So bleibt es schnell und aussagekräftig.",
  te_sheet: "Trainingseindruck", te_good: "Besonders gut", te_avg: "Durchschnitt", te_poor: "Besonders schwach", te_why: "Woran lag's? (optional)",
  te_note: "Notiz (optional)", te_notePh: "z. B. sehr gute Kommunikation in der Kette", te_vis: "Spieler sieht den Eindruck", te_visD: "Erscheint in seiner App unter Bewertungen (inkl. Notiz).", te_sumOf: "in den letzten 4 Wochen ({n} Einheiten besucht)", te_none: "Keine besonderen Eindrücke – im Rahmen.", te_rate: "Eindruck", te_cleared: "Durchschnitt (nicht gespeichert)", te_team: "Auffällige Eindrücke (4 Wochen)",
  te_teamNone: "Keine Ausreißer markiert.", te_mine: "Dein Trainingseindruck", te_mineGood: "Starke Einheit", te_minePoor: "Da geht mehr",
  mt_effort: "Einsatz", mt_focus: "Konzentration", mt_quality: "Technische Qualität", mt_duels: "Zweikämpfe", mt_tempo: "Tempo/Intensität",
  mt_ideas: "Spielverständnis", mt_coach: "Umsetzung der Vorgaben", mt_lead: "Führung/Kommunikation",
  mt_catching: "Fangen", mt_diving: "Hechtsprünge", mt_crosses: "Flanken", mt_oneOnOne: "1-gegen-1", mt_feet: "Spiel mit dem Fuß", mt_position: "Stellungsspiel", mt_voice: "Coaching/Kommandos",

  // Torwart
  tw_title: "Torwart", tw_conceded: "Gegentore", tw_saves: "Paraden", tw_clean: "Zu null", tw_perGame: "Gegentore/Spiel", tw_dives7: "Sprünge (7 Tage)",
  tw_divesWarn: "Viele Sprünge am Tag vor dem Spiel", tw_divesWarnD: "Am Tag vor dem Spiel eher wenige, kurze Aktionen – Richtwert höchstens ca. {n} Sprünge.",
  tw_today: "Heute {t} Uhr Torwarttraining ({m} Min.)", tw_src: "Orientierung aus der Torwart-Trainingspraxis (Periodisierung nach Spieltag) – keine feste Vorgabe; dein Torwarttrainer entscheidet.",
  tw_tip: "Torwart heute", tw_statsInfo: "Gegentore zählen in der eigenen Spielzeit. Zu null: ohne Gegentor bei mindestens 60 Minuten Einsatz (bzw. ganzer Spielzeit).",
  tw_g_rec: "Nach dem Spiel: Regeneration", tw_g_light: "Lockerer Tag", tw_g_power: "Kraft & Explosivität", tw_g_game: "Spielnahe Situationen",
  tw_g_tech: "Technik & Spiel mit dem Ball", tw_g_act: "Aktivierung vor dem Spiel", tw_g_dev: "Entwicklung (spielfreie Woche)", tw_g_match: "Spieltag",
  tw_gi_rec: "Heute keine Sprünge oder Hechtsprünge: lockeres Bewegen, Mobilität, Fangschule im Stand. Wer gespielt hat, regeneriert.",
  tw_gi_light: "Locker: Technik im Stand und in der Bewegung, Spieleröffnung und Fußarbeit, nur wenige Sprünge.",
  tw_gi_power: "Belastungsreichster Torwarttag der Woche: Sprünge und Hechtsprünge in kurzen Serien mit vollen Pausen (Qualität vor Menge), dazu Kraft und Explosivität.",
  tw_gi_game: "Spielnahe Situationen: Flanken, 1-gegen-1, Strafraumbeherrschung, Abschlüsse aus dem Spiel – mittleres Volumen.",
  tw_gi_tech: "Technik und Spiel mit dem Ball (Spieleröffnung, Passen unter Druck), eher wenige Sprünge.",
  tw_gi_act: "Kurz und frisch: Reaktion, kurze Wege, sichere Ballannahme. Wenige Hechtsprünge (Richtwert höchstens ca. {n}).",
  tw_gi_dev: "Spielfreie Woche: Zeit für Technik, Schwächen und Athletik – die Belastung über die Woche verteilen.",
  tw_gi_match: "Aufwärmen mit Schussserien, Flanken und Spieleröffnung – nicht mehr als im Training gewohnt.",
  tw_gi_always: "Torhüter-Belastung steckt weniger in Laufmetern als in Sprüngen, Landungen und Richtungswechseln – trag nach der Einheit auch die ungefähre Zahl der Sprünge ein.",
  tw_th_grund: "Grundstellung", tw_th_fangen: "Fangtechnik", tw_th_fallen: "Fallen", tw_th_hechten: "Hechtsprung", tw_th_flanken: "Flanken & hohe Bälle",
  tw_th_eins: "1-gegen-1", tw_th_fuss: "Spiel mit dem Fuß", tw_th_abwurf: "Abwurf & Abschlag", tw_th_position: "Stellungsspiel & Winkel", tw_th_reaktion: "Reaktion",
  tw_th_strafraum: "Strafraumbeherrschung", tw_th_elfmeter: "Elfmeter", tw_th_coaching: "Coaching & Kommunikation", tw_th_athletik: "TW-Athletik",
  tw_onlyGk: "Nur Torhüter", tw_noGk: "Keine Torhüter im Kader (Position TW oder Torhüter-Gruppe).",
  tw_divesN: "{n} Sprünge",
  sp_conceded: "Gegentore", sp_saves: "Paraden",

  // Torwarttests
  ts_tw_lateral: "Seitsprung (TW)", ts_tw_kick: "Abschlagweite (TW)",
  tsd_tw_lateral: "Seitliche Sprungkraft · Abdruck zum Ball", tsd_tw_kick: "Weite des Abschlags",
  tsp_tw_lateral: "Aus der Grundstellung einbeinig seitlich abspringen und beidbeinig landen; Weite vom Innenrand des Absprungfußes bis zur nächsten Landestelle. Je 3 Versuche pro Seite, Mittel der besten Werte beider Seiten.",
  tsp_tw_kick: "Abschlag aus der Hand (Volley oder Dropkick) – gemessen bis zum ersten Aufsprung. 3 Versuche, bester zählt. Gleicher Ball, möglichst windstill.",
};
