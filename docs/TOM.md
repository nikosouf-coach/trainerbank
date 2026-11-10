# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) – Trainerbank

> **ENTWURF – vor Verwendung durch den Datenschutzbeauftragten prüfen lassen.**
> Stand: 10.11.2026 (Migrationen bis `20261105000010`). Beschreibt, was im Code umgesetzt und durch Tests belegt ist
> (`supabase/tests/rls_test.sql`, `supabase/tests/functions.test.ts`, `src/core/__tests__`), und was organisatorisch
> noch zu regeln ist (**offen**). Ergänzt durch die TOM der Auftragsverarbeiter (Supabase, Expo, Sentry, Anthropic –
> als Anlage zum jeweiligen Vertrag ablegen).

## 1. Vertraulichkeit

| Ziel | Maßnahme | Stand |
|---|---|---|
| Zutritt | Rechenzentrum des Hosters (AWS eu-central-1 über Supabase); keine eigenen Server | laut TOM von Supabase – **Anlage ablegen** |
| Zugang | Anmeldung mit E-Mail und Passwort (nur als Hash gespeichert), Mindestlänge 8 Zeichen in der App und in `supabase/config.toml`; kurze Zugangstoken (1 Stunde) | umgesetzt; **offen:** im Supabase-Dashboard Mindestlänge 8 und Schutz vor geleakten Passwörtern einschalten, Zwei-Faktor für Owner anbieten (DSFA M-15) |
| Zugang Betreiber | Zugang zu Supabase, GitHub, Expo, Sentry, Anthropic nur für [Personen], jeweils mit Zwei-Faktor-Anmeldung; Schlüssel nur in GitHub- und Expo-Secrets bzw. Supabase-Vault, nie im Code oder Chat | **organisatorisch festlegen** und regelmäßig prüfen |
| Zugriff | Zeilenbasierte Zugriffsregeln (RLS) auf allen Tabellen; Teamdaten nur für Mitglieder, Gesundheitsdaten nur mit Recht „Gesundheitsdaten“, Befunde nur mit „Befunde“; Rechte je Mitglied des Trainerteams (`staff_can`); Schreiben heikler Daten nur über geprüfte Funktionen | umgesetzt, 1.400+ automatische Tests |
| Zugriff Eltern | kein Tabellenzugriff; nur ein geprüftes Paket fürs eigene Kind ohne Gesundheitsdetails, Noten, Notizen und Chats; Zugang erst nach Bestätigung durch das Trainerteam | umgesetzt (T61) |
| Trennung | jedes Team getrennt über RLS; Dateien je Team und Spieler in Ordnern mit Pfadprüfung; Demo-Modus ohne echte Daten | umgesetzt |
| Dateien | private Speicherbereiche, nur kurzlebige signierte Links (10–60 Minuten); Fotos und Bilder werden neu kodiert (keine Metadaten wie GPS) | umgesetzt |
| Pseudonymisierung | KI-Kontext ohne Nachnamen, Vereins- und Teamnamen, Spieler ohne KI-Einwilligung nur als Anzahl; Absturzberichte ohne Namen, E-Mail- und IP-Adressen, Fehlertexte gefiltert; Nutzungsstatistik und Vereinsübersicht ohne Namen | umgesetzt |
| Geräte | Gerätespeicher nur für Sitzung, Einstellungen und wartende Einträge (höchstens 14 Tage), beim Abmelden gelöscht; Matchplan mit Wasserzeichen und Bildschirmschutz | umgesetzt |

## 2. Integrität

| Ziel | Maßnahme | Stand |
|---|---|---|
| Weitergabe | nur verschlüsselte Verbindungen (TLS); keine Fremd-Skripte, kein Tracking, keine Werbung; Push-Texte ohne Gesundheitsangaben und ohne Chat-Inhalt | umgesetzt |
| Eingabe | Wertebereiche per Datenbankregeln; `created_by`/`updated_by` und Zeitstempel; nicht fälschbare Felder per Trigger geschützt (z. B. `inactive_since`, `last_seen_at`) | umgesetzt |
| Nachvollziehbarkeit | Einwilligungen mit Art, Version, Zeitpunkt, Widerruf (Nachweis bleibt nach Kontolöschung ohne Konto-ID); Zugriffsprotokoll des Matchplans; Bestätigungen im Eltern-Zugang | umgesetzt; Protokoll für Zugriffe auf Gesundheitsdaten **offen** (DSFA M-17) |
| Änderungen am System | jede Änderung über Pull Request mit automatischen Prüfungen (Datenbank, Zugriffsregeln, Kernlogik, TypeScript, Web); Zusammenführen nur durch [Herausgeber] | umgesetzt |

## 3. Verfügbarkeit und Belastbarkeit

| Ziel | Maßnahme | Stand |
|---|---|---|
| Sicherung | tägliche Sicherungen durch Supabase [Point-in-Time-Recovery je nach Tarif] | **offen:** Tarif prüfen, Wiederherstellung einmal testen (DSFA M-21) |
| Betrieb ohne Netz | Einträge werden auf dem Gerät gesammelt und später gesendet | umgesetzt |
| Missbrauch | Tageslimits für KI-Anfragen; Fehlversuche beim Eltern-Code begrenzt (10 je Stunde); Spam-Grenze für Rückmeldungen | umgesetzt; Grenze für Team-Codes **offen** (DSFA M-16) |
| Updates | Fehlerbehebungen ohne Store-Prüfung (EAS Update) | umgesetzt |

## 4. Löschkonzept (Speicherbegrenzung)

Automatisch, täglich (Zeitpläne `purge-stale-health-data`, `purge-privacy`, `privacy-purge` u. a.; Fristen beginnen
frühestens mit der jeweiligen Migration):

| Daten | Frist | Umsetzung |
|---|---|---|
| Belastung, Morgen-Check, Zusatzsport | 24 Monate nach dem Eintrag | `purge_stale_health_data()` |
| Gesundheitsdaten nach Widerruf (Spieler oder Eltern) | 30 Tage, wenn bis dahin keine neue Einwilligung | `purge_privacy()` (T62) |
| Befunde nach Widerruf der App-Einwilligung | 30 Tage (Datei und Eintrag) | `privacy-purge` |
| Gesundheitsdaten und Befunde inaktiver Spieler | 6 Monate nach Deaktivierung | `purge_privacy()`, `privacy-purge` |
| Spielerprofile inaktiver Spieler | 24 Monate nach Deaktivierung (mit Foto und Dateien) | `privacy-purge` (T63) |
| Teams ohne Nutzung | 24 Monate niemand in der App (Trainerteam, Spieler, Eltern, Funktionäre) | `privacy-purge` (T63) |
| Konten ohne Rolle | 24 Monate nach der letzten Nutzung | `privacy-purge` (T63) |
| Anwesenheit, Abwesenheiten | 24 Monate nach dem Termin bzw. dem Ende | `purge_privacy()` |
| Nachrichten des Trainerteams | 12 Monate nach Ablauf | `purge_privacy()` |
| Push-Token | 6 Monate ohne Aktualisierung | `purge_privacy()` |
| weitere Fristen (Chat, Umfragen, Nominierungen, Fahrten, Sperren, Unfallmeldungen, Eltern-Zugang, Scouting, Stärken-Runde) | siehe Datenschutzerklärung Abschnitt 16 | eigene Löschfunktionen je Modul |

Von Hand: Konto löschen (Spieler, Trainer, Eltern) in der App; Gesundheitsdaten eines Spielers löschen und Auskunft
erstellen im Spielerprofil → Datenschutz (Trainerteam).

## 5. Verfahren zur regelmäßigen Überprüfung

- Automatische Tests bei jeder Änderung: Zugriffsregeln, Löschfristen, Datenpaket der Eltern, Auskunft (prüft, dass
  jede Tabelle mit Spielerbezug enthalten ist).
- Abhängigkeiten werden durch Dependabot gemeldet; Aktualisierungen werden einzeln geprüft.
- DSFA, dieses Dokument und das Verarbeitungsverzeichnis: Überprüfung vor dem Store-Start, danach jährlich und bei
  jeder wesentlichen Änderung. **Offen:** externer Sicherheitstest (DSFA M-24).

## 6. Organisatorische Maßnahmen

| Maßnahme | Stand |
|---|---|
| Datenschutzbeauftragter benannt und der Aufsichtsbehörde gemeldet | **offen** |
| Verträge zur Auftragsverarbeitung mit Supabase, Anthropic, Expo, Sentry (inkl. Unterauftragsverarbeiter und Drittlandgarantien) | **offen** (DSFA M-9) |
| Rollenmodell mit Vereinen festlegen | **offen** (DSFA M-14) |
| Vertraulichkeit im Trainerteam: Einwilligung bzw. Verpflichtung „Vertraulichkeit“ beim Zugang zu Gesundheitsdaten | in der App umgesetzt (`staff_confidentiality`) |
| Leitfäden für Trainerteams (Scouting, Stärken-Runde, Umfragen, Notfallkontakte, Bestellungen, Nominierung, Fahrten, Karten, Fotos, Unfälle, Eltern-Zugang) | **offen** (DSFA M-27 bis M-37) |
| Ablauf bei Datenpannen und bei Anfragen von Betroffenen | `docs/DATENPANNEN.md` |
| Kinderschutz im Chat (Einzelchats nur mit dem Trainerteam, Mitlesen in Jugendteams) | umgesetzt |
