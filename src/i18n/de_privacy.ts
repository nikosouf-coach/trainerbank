// Texte: Datenschutz im Spielerprofil (Auskunft, Gesundheitsdaten löschen) – de
import type { Dict } from "./types";

export const de_privacy: Dict = {
  dsp_title: "Datenschutz",
  dsp_sub: "Auskunft, Gesundheitsdaten löschen",
  dsp_intro: "Hier erfüllt ihr Rechte des Spielers: Auskunft über alle gespeicherten Daten und Löschen der Gesundheitsdaten, wenn eine Einwilligung widerrufen wird.",
  dsp_exportT: "Auskunft erstellen",
  dsp_exportD: "Alle Daten, die ihr in der App zu {n} gespeichert habt – auch interne Notizen – als Datei. Für Auskunftsanfragen (Art. 15 DSGVO), auch bei Spielern ohne Konto. Vor dem Weitergeben Angaben über andere Personen in Freitexten schwärzen.",
  dsp_export: "Auskunft erstellen",
  dsp_exportOwner: "Eine Auskunft kann nur der Owner des Teams erstellen.",
  dsp_exportDone: "Auskunft erstellt",
  dsp_eraseT: "Gesundheitsdaten löschen",
  dsp_eraseD: "Wenn {n} oder die Eltern eine Einwilligung widerrufen, z. B. auf Papier. Gelöscht werden Belastung, Morgen-Check, Zusatzsport, Größe und Gewicht, Hinweise für den Notfall, Reha-, Aufbau- und Wachstumsgruppen und Empfehlungen wie Pause oder Regeneration. Abwesenheiten bleiben als „Sonstiges“ ohne Details, Unfallmeldungen bleiben (eigene Rechtsgrundlage).",
  dsp_eraseFind: "Befunde ({k}) werden mit gelöscht.",
  dsp_eraseFindNo: "Befunde ({k}) bleiben – dafür fehlt dir das Recht „Befunde“.",
  dsp_eraseApp: "Widerruft ein Spieler in der App, löscht die App seine Gesundheitsdaten nach 30 Tagen automatisch.",
  dsp_erase: "Gesundheitsdaten löschen",
  dsp_eraseQ: "Gesundheitsdaten von {n} endgültig löschen? Das lässt sich nicht rückgängig machen.",
  dsp_eraseYes: "Endgültig löschen",
  dsp_erased: "Gesundheitsdaten gelöscht",
  dsp_eraseNoPerm: "Löschen nur mit dem Recht „Gesundheitsdaten“.",
  cs_withdrawParental: "Für Spieler unter 16 entfällt damit die Grundlage für Gesundheitsdaten. Sie werden nach 30 Tagen gelöscht, wenn bis dahin keine neue Einwilligung vorliegt.",
  cs_withdrawFindings: "Befunde, die mit deiner Einwilligung in der App gespeichert sind, werden nach 30 Tagen gelöscht (Datei und Eintrag), wenn du nicht erneut einwilligst. Befunde mit schriftlicher Einwilligung bleiben.",
  cs_withdrawAi: "Der KI-Coach ist danach für dich gesperrt, und das Trainerteam bezieht deine Daten nicht mehr in Fragen an die KI ein.",
  pot_kiNoConsent: "KI-Vorschläge gibt es nur, wenn der Spieler (unter 16 mit seinen Eltern) in den KI-Coach eingewilligt hat.",
  bf_redact: "Vor dem Hochladen Name, Anschrift, Geburtsdatum und Versicherungsnummer auf dem Befund abdecken – für Training und Auswertung braucht es sie nicht.",
};
