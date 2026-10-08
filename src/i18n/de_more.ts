// Texte: Kontaktliste, Erinnerungen, inaktive Spieler – de
import type { Dict } from "./types";

export const de_more: Dict = {
  // Kontaktliste
  ct_title: "Kontakte", ct_sub: "Koordinator, Vorstand, Physio, Arztpraxen, Trainerteam",
  ct_new: "Kontakt", ct_edit: "Kontakt bearbeiten", ct_none: "Noch keine Kontakte. Lege an, wen Spieler und Trainer erreichen sollen – z. B. Jugendkoordinator, Physio oder Sportarzt.",
  ct_name: "Name", ct_role: "Rolle", ct_org: "Funktion / Praxis / Verein", ct_phone: "Telefon", ct_email: "E-Mail", ct_address: "Adresse", ct_note: "Hinweis (z. B. Sprechzeiten)",
  ct_vis: "Für Spieler sichtbar", ct_visD: "Spieler sehen den Kontakt in ihrer App (Ich → Kontakte).",
  ct_hidden: "nur Trainerteam", ct_call: "Anrufen", ct_mail: "E-Mail", ct_del: "Kontakt löschen", ct_saved: "Kontakt gespeichert", ct_deleted: "Kontakt gelöscht",
  ct_fromStaff: "Trainerprofile übernehmen", ct_fromStaffDone: "{n} Trainer übernommen", ct_fromStaffNone: "Alle Trainerprofile sind schon in der Liste.",
  ct_emergency: "Notfall 112 · Ärztlicher Bereitschaftsdienst 116 117",
  ct_r_trainer: "Trainerteam", ct_r_koordinator: "Koordination", ct_r_vorstand: "Vorstand", ct_r_physio: "Physiotherapie", ct_r_arzt: "Ärzte & Praxen", ct_r_betreuer: "Betreuung", ct_r_sonst: "Sonstige",
  ct_playerNone: "Dein Trainer hat noch keine Kontakte freigegeben.", ct_off: "Die Kontaktliste ist für Spieler ausgeschaltet.",

  // Erinnerungen
  rm_title: "Erinnerungen für Spieler",
  rm_info: "Push-Nachrichten aufs Handy der Spieler. Es bekommt nur, wer noch nichts eingetragen hat – höchstens eine Nachricht pro Art und Tag. Spieler müssen Mitteilungen in ihrer App erlauben (Ich → Konto).",
  rm_well: "Morgen-Check", rm_wellD: "Täglich zur gewählten Uhrzeit. In Pausen nicht.", rm_wellAt: "Uhrzeit",
  rm_rpe: "RPE nach Training und Spiel", rm_rpeD: "Nach dem Ende der Einheit. In Pausen nur bei angesetzten Terminen.", rm_rpeDelay: "Abstand nach dem Ende",
  rm_min: "{m} Min.",
  rm_program: "Pausenprogramm", rm_programD: "Montags und donnerstags um 17 Uhr, solange eine Pause mit Programm läuft.",
  rm_needs: "Benötigt das Paket „{m}“.",

  // Einrichtung: Module und Trainingszeiten
  su_preset: "Vorauswahl", su_presetHint: "Die Stufe wählt passende Module vor. Danach kannst du jedes Modul einzeln an- oder abwählen.",
  su_mods: "Deine Module", su_modsCount: "{n} von {m} Modulen aktiv", su_modsLater: "Später jederzeit änderbar unter Mehr → Baukasten.",
  su_allOn: "Alle an", su_allOff: "Alle aus", su_reset: "Vorauswahl wiederherstellen",
  dur_all: "Dauer einer Trainingseinheit", dur_allHint: "Gilt für alle Trainingstage – einzelne Tage kannst du unten anpassen.",
  days_pick: "Trainingstage", su_noDays: "Wähle mindestens einen Trainingstag.",
  su_daysT: "Trainingstage und Dauer", su_daysB: "An welchen Tagen trainiert ihr, wann und wie lange? Spieltag und Anstoß bestimmen die Wochenplanung.",

  // Einrichtung (Schritte)
  su_s_me: "Über dich", su_s_meB: "Dein Trainerprofil – so spricht dich die App an, und so sehen dich Spieler und Trainerteam.",
  su_s_team: "Dein Team", su_s_teamB: "Altersklasse, Verein, Mannschaft und Logo.",
  su_logo: "Vereinslogo", su_color: "Vereinsfarbe",
  su_s_mods: "Funktionen", su_infoT: "Info-Buttons (i) anzeigen", su_infoD: "Kleine (i)-Knöpfe erklären Begriffe wie ACWR oder RPE genau dort, wo sie auftauchen. Jederzeit änderbar unter Mehr → Konto.",
  su_s_orga: "Spieler & Trainerteam", su_s_orgaB: "Was Spieler in ihrer App sehen und dürfen – und wer mit dir trainiert.",
  su_pvT: "Spieler-App", su_staffT: "Weitere Trainer", su_staffD: "Co-, Torwart- und Athletiktrainer, Physio. Sie bekommen später einen eigenen Zugang mit ihren Aufgaben.", su_addStaff: "Trainer hinzufügen",
  su_s_load: "Erinnerungen", su_s_loadB: "Push-Nachrichten, damit die Spieler ihre Daten eintragen.",
  su_s_science: "Sportwissenschaft", su_s_scienceB: "Wie genau die App rechnet und welche Tests dein Team macht.",
  su_testsT: "Testbatterie", su_testsD: "Diese Tests erscheinen in der Leistungsdiagnostik. Empfohlen: zu Beginn und am Ende der Vorbereitung sowie in der Winterpause.",
  su_fixD: "Aus: Die App darf in Aufbau- und Entlastungswochen auch die Dauer anpassen, nicht nur die Intensität.",
  su_s_sum: "Alles bereit", su_meT: "Trainer", su_info: "Info-Buttons",
  su_demoNote: "Demo: Deine Angaben bleiben nur auf diesem Gerät und verschwinden beim Beenden der Demo.",
  su_needName: "Bitte Vor- und Nachnamen eintragen.", su_needClub: "Bitte den Vereinsnamen eintragen.",
  // Trainerprofil
  pf_photo: "Foto", pf_role: "Deine Rolle", pf_license: "Trainerlizenz", pf_birth: "Geburtsdatum (optional)", pf_phone: "Telefon (optional)",
  pf_privacy: "Telefon und Foto sieht nur, wem du sie freigibst (Kontaktliste). Das Geburtsdatum sieht nur das Trainerteam.",
  pf_title: "Mein Trainerprofil", pf_saved: "Profil gespeichert",
  ko_display: "Anzeige", sf_edit: "Bearbeiten",
  lic_none: "Keine / noch keine", lic_kinder: "Kindertrainer-Zertifikat", lic_c: "Trainer-C-Lizenz", lic_b: "Trainer-B-Lizenz", lic_bplus: "B+ / Elite-Jugend-Lizenz",
  lic_a: "Trainer-A-Lizenz", lic_pro: "Fußball-Lehrer / UEFA Pro", lic_tw: "Torwarttrainer-Lizenz", lic_athletik: "Athletiktrainer-Lizenz", lic_other: "Andere Qualifikation",
  ph_coachN: "Von {n}", pl_newRatingN: "Neue Bewertung von {n}",
  hi_morning: "Guten Morgen", hi_day: "Hallo", hi_evening: "Guten Abend", coach_from: "{n}",

  // Startseite
  db_title: "Startseite anpassen", db_hint: "Wähle, welche Karten du auf der Startseite siehst, und ihre Reihenfolge. Gilt für dein Konto auf allen Geräten.",
  db_next: "Nächster Termin", db_tasks: "Meine Aufgaben", db_phase: "Vorbereitung & Pausen", db_status: "Ampel-Übersicht", db_attn: "Braucht Aufmerksamkeit",
  db_absent: "Abwesend nächste Einheit", db_week: "Diese Woche", db_events: "Events", db_last: "Letzte Einheit", db_load: "Teamlast", db_ai: "KI-Coach",
  db_na: "Mit deinen Modulen nicht verfügbar", db_up: "Nach oben", db_down: "Nach unten", db_reset: "Standard wiederherstellen", db_edit: "Startseite anpassen",
  db_attnNone: "Alle im grünen Bereich.", db_absNone: "Alle verfügbar.", db_more: "+{n} weitere",

  // Wiki
  wk_title: "Begriffe erklärt", wk_sub: "Alle Fachbegriffe der App – kurz und verständlich. Tippe auf einen Begriff für Details und Quellen.",
  wk_search: "Suchen", wk_searchPh: "z. B. ACWR, RPE, Taper", wk_none: "Nichts gefunden.", wk_src: "Quellen", wk_open: "Im Wiki öffnen", wk_menu: "Begriffe erklärt (Wiki)", wk_menuSub: "RPE, ACWR, Tests, Wachstum, Planung …",
  wk_c_belastung: "Belastung", wk_c_erholung: "Erholung", wk_c_planung: "Planung", wk_c_leistung: "Leistung", wk_c_wachstum: "Wachstum", wk_c_gesundheit: "Gesundheit", wk_c_app: "App",

  // Inaktive Spieler
  in_title: "Inaktive Spieler ({n})", in_info: "Inaktive Spieler zählen in keiner Berechnung und sehen keine Teamdaten mehr. Ihre bisherigen Daten bleiben erhalten.",
  in_reactivate: "Reaktivieren", in_done: "{n} ist wieder im Kader", in_show: "Anzeigen", in_hide: "Ausblenden",
};
