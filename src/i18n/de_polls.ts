// Texte: Umfragen (Abstimmungen und Fragebögen) – de
import type { Dict } from "./types";

export const de_polls: Dict = {
  um_title: "Umfragen", nvb_umfragen: "Umfragen", um_menuSub: "Abstimmungen und Fragebögen fürs Team", um_meSub: "Abstimmungen und Fragebögen deines Teams",
  db_polls: "Laufende Umfragen", dp_polls: "Umfragen",
  um_info: "Frag dein Team schnell etwas (Abstimmung) oder hol dir mit einem Fragebogen ehrliches Feedback. Mit Namen siehst du, wer was gewählt hat – praktisch für Fahrten oder Termine. Anonym sieht niemand, wer was geantwortet hat, auch du nicht; Ergebnisse gibt es dann erst ab drei Antworten. Freitexte sieht nur das Trainerteam.",
  um_kind_quick: "Abstimmung", um_kind_survey: "Fragebogen",
  um_newQuick: "Neue Abstimmung", um_newSurvey: "Neuer Fragebogen", um_templates: "Vorlagen", um_templatesD: "Fertige Umfragen für häufige Fragen – vor dem Start kannst du alles anpassen.",
  um_running: "Laufend", um_ended: "Beendet", um_none: "Noch keine Umfragen", um_noneD: "Frag dein Team, wer mit dem Bus fährt – oder hol dir anonym ehrliches Feedback zur Trainingswoche.",
  um_answeredN: "{n} von {m} haben geantwortet", um_answered1: "1 von {m} hat geantwortet",
  um_answersN: "{n} Antworten", um_answers1: "1 Antwort", um_answers0: "Noch keine Antworten",
  um_until: "bis {d}", um_noEnd: "ohne Ende", um_endsToday: "endet heute", um_endedOn: "beendet",
  um_named: "Mit Namen", um_anon: "Anonym", um_resAll: "Ergebnisse für alle", um_resStaff: "Ergebnisse nur fürs Trainerteam",
  um_toTeam: "Ganzes Team", um_toGroup: "An: {g}", um_toGroupHidden: "An eine Gruppe",
  um_by: "von {n}", um_byMe: "von dir", um_fromPlayer: "Von einem Spieler",
  um_playersMay: "Spieler dürfen Abstimmungen starten", um_playersMayD: "Immer mit Namen und fürs ganze Team, je Spieler höchstens zwei gleichzeitig. Du siehst alle und kannst jede beenden oder löschen.",
  um_playersOn: "Spieler dürfen jetzt Abstimmungen starten", um_playersOff: "Spieler können keine Abstimmungen mehr starten",

  // Auswertung
  um_participation: "Beteiligung", um_results: "Ergebnis",
  um_hiddenAnon: "Anonym: Ergebnisse gibt es ab {n} Antworten – damit niemand erraten kann, wer was geantwortet hat.",
  um_resultsStaffOnly: "Die Ergebnisse sieht nur das Trainerteam.", um_resultsAfter: "Das Ergebnis siehst du, sobald du abgestimmt hast.",
  um_avg: "Ø {v}", um_scaleOf: "von 5", um_texts: "Freitext-Antworten", um_textsNone: "Noch keine Freitext-Antworten.", um_textOnlyStaff: "Nur das Trainerteam sieht Freitext-Antworten.",
  um_votersN: "{n} Stimmen", um_voters1: "1 Stimme", um_myPick: "deine Wahl",
  um_missing: "Noch nicht geantwortet", um_allDone: "Alle haben geantwortet.",
  um_remind: "Erinnern ({n})", um_remindAll: "Alle erinnern", um_reminded: "Erinnerung gesendet",
  um_remindMsg: "Bitte stimm noch ab: „{t}“ – du findest die Umfrage auf deiner Startseite.",
  um_remindMsgAll: "Falls du noch nicht mitgemacht hast: „{t}“ – du findest die Umfrage auf deiner Startseite.",
  um_remindAnonD: "Anonym: Du weißt nicht, wer schon geantwortet hat – die Erinnerung geht an alle, die angesprochen sind.",

  // Verwalten
  um_close: "Beenden", um_closedT: "Umfrage beendet", um_reopen: "Wieder öffnen", um_reopenedT: "Umfrage wieder geöffnet",
  um_editT: "Umfrage bearbeiten", um_locked: "Sobald jemand geantwortet hat, bleiben Fragen und Einstellungen fest – ändern kannst du nur noch das Ende.",
  um_changeEnd: "Ende ändern", um_endSaved: "Ende geändert",
  um_delete: "Umfrage löschen", um_deleteQ: "Umfrage mit allen Antworten löschen?", um_deleteYes: "Ja, löschen", um_deleted: "Umfrage gelöscht",
  um_share: "Im Chat ankündigen", um_shareD: "Kurze Nachricht im Teamchat bzw. im Chat der Gruppe.", um_shareMsg: "📊 Neue Umfrage: „{t}“ – bitte in der App abstimmen (Startseite).",
  um_state_open: "läuft", um_state_closed: "beendet",

  // Bearbeiten
  um_question: "Frage", um_questionPh: "z. B. Wie kommst du zum Auswärtsspiel?",
  um_titleF: "Titel", um_titlePh: "z. B. Feedback zur Trainingswoche",
  um_intro: "Einleitung (freiwillig)", um_introPh: "z. B. Dauert eine Minute. Deine Antworten sind anonym.",
  um_options: "Antworten", um_option: "Antwort {n}", um_optionAdd: "Antwort hinzufügen", um_optionDel: "Antwort {n} entfernen",
  um_multi: "Mehrere Antworten erlaubt",
  um_qtype_single: "Auswahl", um_qtype_multi: "Mehrfachauswahl", um_qtype_scale: "Skala 1–5", um_qtype_text: "Freitext",
  um_qN: "Frage {n}", um_qAdd: "Frage hinzufügen", um_qDel: "Frage {n} entfernen", um_qUp: "Frage {n} nach oben", um_qDown: "Frage {n} nach unten",
  um_required: "Pflichtfrage", um_lo: "Beschriftung bei 1", um_hi: "Beschriftung bei 5", um_loPh: "z. B. gar nicht", um_hiPh: "z. B. sehr",
  um_who: "Wer antwortet?", um_groupHidden: "Die Spieler dieser Gruppe sehen die Umfrage, aber nicht den Namen der Gruppe.",
  um_mode: "Mit Namen oder anonym?", um_modeNamedAll: "Alle sehen nach ihrer Antwort, wer was gewählt hat.", um_modeNamedStaff: "Nur das Trainerteam sieht, wer was gewählt hat.",
  um_modeAnon: "Niemand sieht, wer was geantwortet hat – auch das Trainerteam nicht. Ergebnisse ab drei Antworten.",
  um_resWho: "Ergebnis sehen", um_resAllOpt: "Alle", um_resStaffOpt: "Nur Trainerteam",
  um_resAllD: "Spieler sehen das Ergebnis nach ihrer Antwort und nach dem Ende.", um_resStaffD: "Spieler sehen nur ihre eigene Antwort.",
  um_end: "Ende (freiwillig)", um_endD: "Bis einschließlich zu diesem Tag kann man antworten. Ohne Datum läuft die Umfrage, bis du sie beendest.",
  um_start: "Umfrage starten", um_started: "Umfrage gestartet", um_saved: "Umfrage gespeichert",
  um_errTitle: "Bitte eine Frage eingeben.", um_errTitleS: "Bitte einen Titel eingeben.", um_errOptions: "Bitte mindestens zwei verschiedene Antworten eingeben.",
  um_errQ: "Frage {n} ist unvollständig: Text fehlt oder es gibt weniger als zwei Antworten.", um_errNoQ: "Bitte mindestens eine Frage anlegen.",
  um_cancel: "Abbrechen", um_errPast: "Das Ende liegt in der Vergangenheit.", um_end2: "2 Tage", um_end7: "1 Woche", um_lastDay: "Letzter Tag", um_shared: "Im Chat angekündigt",
  um_tplPick: "Vorlage wählen", um_questionsN: "{n} Fragen", um_questions1: "1 Frage", um_minutes: "ca. {n} Min.",

  // Spieler
  um_vote: "Abstimmen", um_send: "Absenden", um_thanks: "Danke! Deine Antwort ist gespeichert.",
  um_change: "Antwort ändern", um_withdraw: "Antwort zurückziehen", um_withdrawn: "Antwort zurückgezogen",
  um_yourAnswer: "Deine Antwort", um_youVoted: "Du hast abgestimmt", um_youTook: "Du hast mitgemacht", um_open: "Öffnen", um_seeAll: "Alle Umfragen",
  um_privNamedAll: "Mit Namen – alle sehen, was du gewählt hast.", um_privNamedStaff: "Mit Namen – nur das Trainerteam sieht deine Antwort.",
  um_privAnon: "Anonym – niemand sieht, was du geantwortet hast.", um_privText: "Freitext sieht nur das Trainerteam.",
  um_needRequired: "Bitte alle Pflichtfragen beantworten.", um_optional: "freiwillig",
  um_toAnswer: "Offen für dich", um_answeredList: "Beantwortet", um_mine: "Von dir gestartet",
  um_startOwn: "Abstimmung starten", um_ownMax: "Du hast schon {n} laufende Abstimmungen. Beende eine, um eine neue zu starten.",
  um_ownInfo: "Eigene Abstimmungen sind immer mit Namen und gehen ans ganze Team. Dein Trainerteam sieht sie und kann sie beenden.",
  um_cardMoreN: "Alle Umfragen ansehen (+{n})", um_playerNone: "Gerade keine Umfragen.", um_cardMore: "Alle Umfragen ansehen",

  // Fehler vom Server
  err_polls_off: "Spieler dürfen gerade keine Abstimmungen starten.", err_poll_closed: "Diese Umfrage ist beendet.",
  err_poll_answered: "Es gibt schon Antworten – Fragen und Einstellungen lassen sich nicht mehr ändern.",
  err_invalid_answer: "Die Antwort passt nicht zur Umfrage. Bitte neu laden.", err_open_polls: "Du hast schon zwei laufende Abstimmungen.",
  err_polls: "Zu viele Umfragen im Team – bitte alte löschen.",
};
