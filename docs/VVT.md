# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) – Trainerstab

> **ENTWURF – vor Verwendung durch den Datenschutzbeauftragten bzw. anwaltlich prüfen lassen.**
> Stand: 10.11.2026 (Migrationen bis `20261105000010`). Das Verzeichnis ist schriftlich bzw. elektronisch zu führen
> und der Aufsichtsbehörde auf Anfrage vorzulegen (Art. 30 Abs. 3 und 4). Es verweist für die Einzelheiten der
> Datenarten auf die Nummern in `docs/DATENSCHUTZERKLAERUNG.md` (Abschnitt 4) und für die Risiken auf `docs/DSFA.md`.
> Bei jeder neuen Funktion, jedem neuen Dienstleister und jeder neuen Löschfrist hier nachziehen.

## A. Angaben zum Verantwortlichen

| | |
|---|---|
| Verantwortlicher | Nikolas Swehla (Einzelperson; Gründung einer Gesellschaft geplant), Am Lindenbruch 26, 45327 Essen, kontakt@trainerstab.app |
| Vertreten durch | [vertretungsberechtigte Person(en)] |
| Datenschutzbeauftragter | [Name bzw. Firma, Kontakt] – Benennung nach § 38 Abs. 1 Satz 2 BDSG sehr wahrscheinlich Pflicht (DSFA erforderlich) |
| Rollenmodell | **offen** (DSFA M-14): Dieses Verzeichnis geht wie die Datenschutzerklärung von Modell A aus (Herausgeber allein verantwortlich). Bei Modell B (Verein verantwortlich, Herausgeber Auftragsverarbeiter) führt der Herausgeber zusätzlich ein Verzeichnis nach Art. 30 Abs. 2 und jeder Verein ein eigenes. |

## B. Gemeinsame Angaben für alle Tätigkeiten

- **Systeme:** App Trainerstab (iOS, Android, Web), Website trainerstab.app (GitHub Pages), Datenbank, Anmeldung, Dateispeicher und Serverfunktionen bei
  Supabase (Region Frankfurt, eu-central-1).
- **Auftragsverarbeiter:** Supabase (Hosting, Datenbank, Anmeldung, Speicher, Serverfunktionen), Anthropic (KI, nur mit
  Einwilligung), Expo/650 Industries (Push-Versand, App-Updates), Sentry/Functional Software (Absturzberichte, nur mit
  Zustimmung, Speicherort EU), Apple und Google (Zustellung von Push-Mitteilungen; Rolle zu klären), [E-Mail-Versand],
  [Webhoster], [Support-Postfach]. Verträge nach Art. 28: **offen** (DSFA M-9).
- **Drittländer:** USA (Anthropic, Expo; ggf. Zugriffe von Sentry und Supabase-Unterauftragsverarbeitern) – Grundlage
  EU-US Data Privacy Framework oder Standardvertragsklauseln, je Anbieter zu verifizieren (Datenschutzerklärung
  Abschnitt 10).
- **Technische und organisatorische Maßnahmen:** `docs/TOM.md`.
- **Löschung:** automatisch per Datenbankfunktionen und der Serverfunktion `privacy-purge` (täglich), im Einzelnen je
  Tätigkeit unten und in Datenschutzerklärung Abschnitt 16.

## C. Verarbeitungstätigkeiten

| Nr. | Tätigkeit | Zweck | Betroffene | Datenkategorien (Datenschutzerklärung 4.x) | Rechtsgrundlage | Empfänger (außer Auftragsverarbeiter) | Löschfrist |
|---|---|---|---|---|---|---|---|
| 1 | Konto und Anmeldung | Zugang zur App, Sicherheit | alle Nutzer | 4.1 Kontodaten (inkl. Zeitpunkt der letzten Nutzung), 4.16 technische Daten | Art. 6 Abs. 1 lit. b; lit. f (Sicherheit) | – | bei Kontolöschung sofort; Konten ohne Rolle 24 Monate nach der letzten Nutzung; Server-Protokolle [Tage laut Supabase] |
| 2 | Teamverwaltung und Kader | Organisation des Teams | Trainerteam, Spieler | 4.2–4.4, 4.22–4.25, 4.29 | Art. 6 Abs. 1 lit. b; Spieler ohne Konto: lit. f bzw. Mitgliedschaft im Verein | Mitglieder des Teams nach Rolle und Recht | mit Team bzw. Spielerprofil; inaktive Spielerprofile 24 Monate nach Deaktivierung; Teams ohne Nutzung 24 Monate |
| 3 | Anwesenheit und Abwesenheiten | Trainingsplanung, Beteiligung | Spieler | 4.5, 4.6 (krank/Verletzung = Gesundheitsdaten) | Art. 6 Abs. 1 lit. b; Gesundheitsbezug: Art. 9 Abs. 2 lit. a | Trainerteam; Eltern (nur „abwesend“) | 24 Monate nach dem Eintrag bzw. dem Ende; Gesundheitsbezug bei Widerruf nach 30 Tagen entfernt |
| 4 | Belastungssteuerung und Gesundheit | Belastung, Erholung, Verletzungsvorbeugung | Spieler | 4.7–4.10, 4.12, 4.27, Notfall-Hinweise (4.43) | Art. 9 Abs. 2 lit. a, Art. 6 Abs. 1 lit. a; unter 16 Einwilligung der Eltern (Art. 8) | Trainerteam mit Recht „Gesundheitsdaten“ | 24 Monate nach dem Eintrag; 30 Tage nach Widerruf; 6 Monate nach Deaktivierung; sofort bei Kontolöschung oder durch das Trainerteam |
| 5 | Befunde und KI-Auswertung | Rückkehr nach Verletzung | Spieler | 4.20 | Art. 9 Abs. 2 lit. a (gesonderte Einwilligung, auch schriftlich) | Trainerteam mit Recht „Befunde“ | 30 Tage nach Widerruf der App-Einwilligung; 6 Monate nach Deaktivierung; mit Spielerprofil |
| 6 | KI-Coach | Fragen zu Training und Belastung | Spieler, Trainerteam | 4.15; Kontext ohne Nachnamen, Vereins- und Teamnamen | Art. 6 Abs. 1 lit. a, Art. 9 Abs. 2 lit. a | – (Anthropic als Auftragsverarbeiter) | Inhalte nicht gespeichert; Zähler 30 Tage |
| 7 | Leistung und Spielerentwicklung | sportliche Entwicklung | Spieler | 4.18, 4.19, 4.26, 4.31, 4.32, 4.41, 4.47 | Art. 6 Abs. 1 lit. b bzw. f | Trainerteam; Spieler nach Freigabe | mit Spielerprofil; Stärken-Runde 12 Monate; Sperren 24 Monate |
| 8 | Kommunikation | Austausch im Team | alle Nutzer | 4.11, 4.14, 4.34, 4.42, 4.51 | Art. 6 Abs. 1 lit. b; Push: § 25 Abs. 2 Nr. 2 TDDDG | Chat-Mitglieder; Mitlesende in Jugendteams | Chat 24 Monate; Nachrichten 12 Monate nach Ablauf; Umfragen 12 Monate; Push-Token 6 Monate ohne Aktualisierung; Elterninfo 12 Monate |
| 9 | Organisation rund ums Spiel | Kader, Fahrten, Ausrüstung, Kasse | Spieler, Eltern | 4.28, 4.44–4.46, 4.33 | Art. 6 Abs. 1 lit. b | Trainerteam, Team | Nominierungen 12 Monate; Fahrten 1–30 Tage; Kasse mit Team |
| 10 | Notfallkontakte | Erreichbarkeit im Notfall | Kontaktpersonen (Dritte) | 4.43 | Art. 6 Abs. 1 lit. f; im Notfall lit. d | Trainerteam | sofort beim Ändern; mit Spielerprofil |
| 11 | Foto-Erlaubnis | Nachweis vor Veröffentlichungen | Spieler, Eltern | 4.48 | Art. 6 Abs. 1 lit. c i. V. m. Art. 7 Abs. 1 (Nachweis) | Trainerteam | aktuelle Erklärung; mit Spielerprofil |
| 12 | Unfallmeldungen | Meldung an Verein und Versicherung | Spieler | 4.49 (Gesundheitsdaten) | Art. 9 Abs. 2 lit. f bzw. a – rechtlich zu prüfen (DSFA M-36) | Trainerteam mit Recht „Gesundheitsdaten“; Verein, Versicherung (durch das Trainerteam) | 36 Monate nach dem Unfall |
| 13 | Eltern-Zugang | Information und Einwilligungen der Eltern | Erziehungsberechtigte, Kinder | 4.50, 4.13 | Art. 6 Abs. 1 lit. b bzw. f; Einwilligungen nach Art. 8 Abs. 2 | Trainerteam (Bestätigung) | Codes 14 Tage; Anfragen 30 Tage; Verknüpfung bis Lösen, 30 Tage nach 18. Geburtstag bzw. 30 Tage nach Deaktivierung des Kindes |
| 14 | Verein | teamübergreifende Steuerung | Funktionäre, Spieler | 4.36 | Art. 6 Abs. 1 lit. b bzw. f | Funktionäre (nur zugewiesene Teams, Standard ohne Gesundheitsdaten) | mit Funktion bzw. Verein |
| 15 | Kaderplanung und Scouting | Planung, Beobachtung externer Spieler | beobachtete Spieler (Dritte, auch Minderjährige) | 4.37 | Art. 6 Abs. 1 lit. f; Information nach Art. 14 | Trainerteam mit Recht „Scouting“ | 6 bzw. 24 Monate; Saisonplanung nach der übernächsten Saison |
| 16 | Matchplan | Spielvorbereitung | Spieler | 4.35 | Art. 6 Abs. 1 lit. b | Trainerteam; Spieler nach Freigabe | Zugriffsprotokoll 6 Monate; Plan mit Team |
| 17 | Einwilligungsverwaltung | Nachweis (Art. 7 Abs. 1) | alle mit Einwilligungen, Eltern | 4.13 | Art. 6 Abs. 1 lit. c | – | Nachweis bleibt nach Kontolöschung ohne Konto-ID mit E-Mail-Hash; [3] Jahre nach Ende der Verarbeitung |
| 18 | Betroffenenrechte | Auskunft, Export, Löschung | alle | Export (alle Kategorien), Auskunft je Spieler durch den Owner | Art. 6 Abs. 1 lit. c | Antragsteller | Antrag und Antwort [3] Jahre (Nachweis) |
| 19 | Rückmeldungen und Support | Fehler beheben, Anfragen beantworten | Nutzer | 4.17, 4.38 | Art. 6 Abs. 1 lit. b bzw. f | Betreiber (`app_admins`) | erledigt 12 Monate; Support [3] Jahre |
| 20 | Absturzberichte | Fehler finden | Nutzer mit Zustimmung | 4.39 (ohne Namen, E-Mail, IP; Fehlertexte gefiltert) | Art. 6 Abs. 1 lit. a, § 25 Abs. 1 TDDDG | – (Sentry als Auftragsverarbeiter) | [laut Sentry-Tarif] |
| 21 | App-Updates | sichere, fehlerfreie App | alle Nutzer | 4.40 | Art. 6 Abs. 1 lit. b; § 25 Abs. 2 Nr. 2 TDDDG | – (Expo als Auftragsverarbeiter) | [laut Expo] |
| 22 | Datensicherung | Wiederherstellung nach Fehlern | alle | alle Kategorien | Art. 6 Abs. 1 lit. f, Art. 32 | – | [Tage laut Supabase-Tarif], danach überschrieben |
| 23 | Match-Analyse (geplant, nicht umgesetzt) | Videoanalyse mit Kennzahlen und Rating | Spieler, Gegner (nur Rückennummer) | noch festzulegen – Konzept vom 10.11.2026 | noch festzulegen (DSFA vor Start erweitern) | – | Konzept: Video Saisonende plus 3 Monate, höchstens 12 Monate |

## D. Pflege

- Verantwortlich für die Pflege: Nikolas Swehla. Überprüfung: bei jeder neuen Funktion, mindestens jährlich.
- Änderungen:

| Datum | Änderung |
|---|---|
| 10.11.2026 | Erstfassung aus Datenschutzerklärung, DSFA 1.10 und Migrationen bis `20261105000010` |
