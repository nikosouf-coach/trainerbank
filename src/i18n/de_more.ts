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

  // Inaktive Spieler
  in_title: "Inaktive Spieler ({n})", in_info: "Inaktive Spieler zählen in keiner Berechnung und sehen keine Teamdaten mehr. Ihre bisherigen Daten bleiben erhalten.",
  in_reactivate: "Reaktivieren", in_done: "{n} ist wieder im Kader", in_show: "Anzeigen", in_hide: "Ausblenden",
};
