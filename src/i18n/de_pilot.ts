// Testphase und Betrieb: Feedback, Rückmeldungen (Betreiber), Absturzberichte, Updates, Einladung mit QR-Code, Nutzung.
import type { Dict } from "./types";

export const de_pilot: Dict = {
  // Feedback / Fehler melden
  fb_menu: "Feedback / Fehler melden", fb_menuSub: "Fehler, Unklares oder Wünsche an den Entwickler",
  fb_title: "Feedback / Fehler melden",
  fb_intro: "Deine Nachricht geht direkt an den Entwickler der App. Danke, dass du hilfst, sie besser zu machen!",
  fb_kindQ: "Worum geht es?",
  fb_k_bug: "Fehler", fb_k_unclear: "Unklar", fb_k_wish: "Wunsch", fb_k_praise: "Lob",
  fb_l_bug: "Was ist passiert?", fb_ph_bug: "Was hast du gemacht? Was ist passiert? Was hast du erwartet?",
  fb_l_unclear: "Was war unklar oder umständlich?", fb_ph_unclear: "Zum Beispiel: Ich habe nicht gefunden, wo …",
  fb_l_wish: "Was wünschst du dir?", fb_ph_wish: "Was soll die App können – und wofür brauchst du es?",
  fb_l_praise: "Was gefällt dir?", fb_ph_praise: "Was funktioniert für dich besonders gut?",
  fb_privacy: "Bitte keine Gesundheitsangaben und keine Namen anderer Personen eintragen.",
  fb_shot: "Bildschirmfoto anhängen", fb_shotChange: "Anderes Foto", fb_shotRemove: "Entfernen",
  fb_shotHint: "Tipp: Mach zuerst ein Bildschirmfoto der Seite und häng es hier an. Gesundheitsdaten und Namen anderer vorher abdecken.",
  fb_meta: "Wird mitgesendet",
  fb_metaText: "Seite {p} · App {v} · {d}",
  fb_metaAccount: "Dazu dein Konto (für Rückfragen) und das aktive Team.",
  fb_send: "Senden",
  fb_need: "Bitte schreib kurz, worum es geht.",
  fb_thanks: "Danke! Deine Rückmeldung ist angekommen.",
  fb_offline: "Keine Verbindung – bitte später noch einmal senden. Dein Text bleibt hier stehen.",
  fb_demo: "Im Demo-Modus wird nichts gesendet – die Rückmeldung bleibt auf diesem Gerät.",
  err_feedback_rate: "Heute sind schon viele Rückmeldungen von dir angekommen – bitte morgen weiter. Danke!",

  // Rückmeldungen (Betreiber der App)
  fbl_title: "Rückmeldungen", fbl_menuSub: "Meldungen aller Nutzer – nur für dich als Betreiber",
  fbl_open: "Offen", fbl_done: "Erledigt", fbl_all: "Alle",
  fbl_none: "Keine Rückmeldungen.",
  fbl_markDone: "Erledigt", fbl_reopen: "Wieder öffnen", fbl_shot: "Bildschirmfoto", fbl_share: "Teilen", fbl_shareAll: "Alle teilen",
  fbl_delete: "Löschen", fbl_deleteQ: "Rückmeldung löschen?", fbl_deleteText: "Text und Bildschirmfoto werden endgültig gelöscht.",
  fbl_onlyAdmin: "Diese Seite sehen nur die Betreiber der App.",
  fbl_shareHint: "„Teilen“ gibt Meldungen ohne Namen weiter – zum Beispiel an Claude oder in eine Aufgabenliste.",
  fbl_player: "Spieler", fbl_from: "von {n}", fbl_doneAt: "erledigt am {d}",
  fbl_nOpen: "{n} offen", fbl_nDone: "{n} erledigt", fbl_nAll: "{n} insgesamt",

  // Absturzberichte
  cr_toggle: "Absturzberichte senden",
  cr_desc: "Hilft, Fehler schnell zu finden. Gesendet werden nur technische Angaben – Fehlerstelle, App-Version, Gerät und die zuletzt geöffneten Seiten – an Sentry mit Speicherort in der EU. Keine Namen, keine Gesundheitsdaten, keine Bildschirmfotos. Gilt für dieses Gerät.",
  cr_webOnly: "Absturzberichte gibt es in der App auf dem Handy.",
  cr_askTitle: "Hilf mit, Fehler schneller zu finden",
  cr_askText: "Darf die App bei einem Absturz einen technischen Bericht senden – ohne Namen und ohne Gesundheitsdaten? Du kannst das jederzeit im Konto ändern.",
  cr_yes: "Ja, einschalten", cr_no: "Nein danke", cr_on: "Danke! Absturzberichte sind eingeschaltet.",

  // Updates
  up_build: "Build {b}", up_update: "Update vom {d}",
  up_check: "Nach Updates suchen", up_checking: "Suche …",
  up_none: "Die App ist auf dem neuesten Stand.",
  up_ready: "Update geladen – es ist beim nächsten Start aktiv.",
  up_restart: "Jetzt neu starten",

  // Einladung mit QR-Code
  inv_show: "QR-Code zeigen",
  inv_title: "Spieler einladen", inv_titleStaff: "Trainerteam einladen",
  inv_scan: "Mit der Handy-Kamera scannen – die App öffnet sich mit dem Code.",
  inv_steps: ["App installieren", "Registrieren und E-Mail bestätigen", "QR-Code scannen oder den Code in der App eingeben"],
  inv_stepsStaff: ["App installieren", "Registrieren und E-Mail bestätigen", "QR-Code scannen oder unter „Als Trainer oder Funktionär beitreten“ den Code eingeben"],
  inv_install: "App installieren", inv_ios: "iPhone", inv_android: "Android",
  inv_installHint: "Testversion: iPhone über TestFlight, Android über den Test bei Google Play.",
  inv_share: "Einladung teilen",
  inv_shareText: "Tritt unserem Team „{t}“ in der Trainerbank-App bei: {l} – oder in der App den Code {c} eingeben.",
  inv_shareInstall: "App laden – iPhone: {i} · Android: {a}",
  inv_saved: "Einladung gespeichert (Code {c}). Melde dich an oder registriere dich – danach geht es direkt weiter.",
  inv_found: "Du hast eine Einladung: Code {c}.",
  inv_join: "Team beitreten", inv_joinStaff: "Trainerteam beitreten", inv_forget: "Verwerfen",

  // Nutzung im Team
  nu_title: "Nutzung im Team", nu_menuSub: "Registrierungen, Eintragungen und Planung je Woche",
  nu_sub: "Zahlen für das ganze Team – ohne Namen.",
  nu_reg: "Registriert", nu_regText: "{n} von {of} Spielern haben die App", nu_regInvite: "Fehlende Spieler einladen",
  nu_rpe: "RPE eingetragen", nu_rpeD: "von den Anwesenden im Mannschaftstraining",
  nu_well: "Morgen-Check", nu_wellD: "Spieler mit App, je Tag",
  nu_att: "Anwesenheit erfasst", nu_attD: "Mannschaftstrainings",
  nu_plan: "Training geplant", nu_planD: "selbst geplant: Inhalt, Art, RPE oder Ablauf",
  nu_goal: "Ziel {v}", nu_now: "Diese Woche", nu_thisWeek: "diese Woche", nu_kw: "KW {n}", nu_weeks: "Die letzten vier Wochen",
  nu_goals: "Ziele im Piloten",
  nu_goalsText: [
    "Nach der ersten Woche haben mindestens 90 % der Spieler die App.",
    "Ab der zweiten Woche tragen mindestens 75 % der Anwesenden ihr RPE ein.",
    "Wer den Morgen-Check nutzt, macht ihn an mindestens jedem zweiten Tag.",
    "Das Trainerteam erfasst jede Woche die Anwesenheit und plant die Trainings in der App – ohne Google Forms.",
  ],
  nu_noHealth: "RPE und Morgen-Check siehst du nur mit dem Recht „Gesundheit“.",
  nu_sentry: "Abstürze und den Anteil absturzfreier Sitzungen zeigt Sentry.",
};
