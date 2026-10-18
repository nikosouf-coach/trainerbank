# Trainerbank

App für Fußballtrainer und ihre Spieler – vom Kinderfußball bis zu den Senioren. Planung, Belastungssteuerung und
Spielerentwicklung an einem Ort, mit einer eigenen Spieler-App, die Spaß macht.

**Technik:** Expo SDK 57 (iOS, Android, Web) · React Native · Expo Router · TypeScript · Supabase (Region Frankfurt) ·
Claude API für den KI-Coach und die Befund-Auswertung.

Einrichten, Veröffentlichen und alle Konten: **[SETUP.md](SETUP.md)** (Schritt für Schritt).

## Funktionen

| Bereich | Trainer | Spieler |
|---|---|---|
| Heute | nächster Termin → Trainingstag, Ampel, Spieler mit Handlungsbedarf, Teamlast, eigene Aufgaben, KI-Coach, laufende Pause/Vorbereitung; Bereiche einklapp- und anpassbar | Zuverlässigkeit, Serie, Wochenringe, Meilensteine, Aufgaben und Dienste, persönliches Tagesziel, Reha-Plan, nächste Termine |
| Kalender & Planung | Woche/Monat, Spieltags-Prinzipien (MD−4 … MD+1), Aufbau-/Erhalt-/Entlastungswochen, Pausen, geplanter RPE (Zukunft) und Ø RPE (Vergangenheit), individuelle Ziele je Spieler (Regeneration, Spielersatz, Reha, Aufbau); mehrere Einheiten am Tag (z. B. 30 Min. Athletik + 90 Min. Training, Torwarttraining, Reha-Gruppe) wöchentlich oder für einzelne Tage | Wochenplan (wenn freigegeben) mit persönlichem Ziel und den eigenen weiteren Einheiten |
| Torhüter | Torwarttraining mit Schwerpunkten und TW-Trainer, Sprünge/Hechtsprünge als Belastung, Hinweis bei vielen Sprüngen vor dem Spiel, Gegentore/Paraden/Zu-null, Torwarttests (Seitsprung, Abschlagweite) | Torwart-Tipp nach Spieltags-Bezug, Sprünge eintragen, eigene Torwart-Statistik |
| Belastung | Session-RPE je Einheit, ACWR, Hooper-Morgencheck, Körperkarte mit Angaben zum Schmerz und Warnzeichen, Beschwerden-Häufungen mit Prävention, Erholungsmodell nach Alter, Zusatzsport | RPE und Morgen-Check eintragen, schmerzende Stelle auf einer altersgerechten Figur antippen, eigene Sportarten, persönliche Ernährungs- und Schlaftipps |
| Kader | Positionen (TW, RV, IV, LV, DM, ZM, OM, LM, RM, ST), Gruppen (Reha, Torhüter, Aufbau, Wachstumsschub, Mannschaftsrat, Talent, eigene) mit Vorschlägen und Sichtbarkeit, Profilbilder, inaktive Spieler | eigenes Profil, eigene freigegebene Gruppen |
| Spiele & Training | Minuten, Tore, Assists, Noten 1–10 mit Feedback, Videos für Team, Spieler oder Gruppen; Trainingseindruck nur für Ausreißer (besonders gut/schwach mit Gründen, Standard Durchschnitt) | Noten, freigegebene Trainingseindrücke, Statistik, Videos |
| Leistungsdiagnostik | Testbatterie (Sprint, CMJ, 30-15 IFT, Yo-Yo, 505 …), Normwerte, persönliche Laufstrecken; CMJ-Abfall und Fitness verfeinern die Erholung; Platzierung für Spieler an/aus | eigene Tests, Bestwerte und eigener Platz (ohne Werte anderer) |
| Verletzungen | Rückkehr in 4 Stufen, Reha-Plan nach Körperregion und Stufe, Befunde scannen (Foto/PDF), KI-Zusammenfassung mit Einwilligung | eigener Reha-Plan, eigene Befunde |
| Matchplan | Aufstellung per Ziehen (11er/9er/7er/5er, Grundordnungen, Vorschlag nach Position und Verfügbarkeit, Bank, Kapitän), Icons mit Nummer, Name oder Foto in wählbarer Größe; Folien für Taktik und Standards mit Ausschnitt (ganzes Feld, Hälften, Strafraum), Gegner, Pässe, Laufwege, Dribblings, Linien, Zonen; Spielidee (Leitsatz, 3 Schwerpunkte), Gegneranalyse, Aufgabe je Spieler, Wechselplan mit geplanten Minuten; Freigabe bis Spielende (Bereiche, nur Kader, Aufgaben nur eigene) mit Zugriffsprotokoll | freigegebener Plan mit eigener Rolle und Aufgabe, Wasserzeichen, Bildschirmschutz (Android gesperrt, iOS Aufnahmen geschwärzt) |
| Verein | mehrere Teams verbinden (Code), Vereinsübersicht mit Kennzahlen je Team (nächstes/letztes Spiel, Bilanz, Ausfälle, Beteiligung, Trainings, Matchplan-Status), Funktionäre (Vereinsadmin, sportliche Leitung, NLZ-/Jugendleitung, Koordination) mit Rechten und Teams, Ankündigungen in die Teamchats, Spieler hochziehen oder wechseln (optional mit Belastung, Morgen-Checks und Ausfällen) | bei Hochziehen beide Teams in der App |
| Trainingstag | verfügbare Spieler, Ablauf in Blöcken mit Zuständigkeit je Trainer, Coachingpunkten und Skizzen (auch als Foto), Dienste, Todos | – |
| Trainingsplanung | Taktiktafel, Übungsarchiv mit Coachingpunkten, Einheiten-Vorlagen mit Intensitätscheck, Trainerprofile | – |
| Vorbereitung & Pausen | Wochenaufbau mit Ziel-Last, Testtagen, Taper; Pausen ohne Mannschaftstraining; Umsetzung je Spieler | persönliches Programm für die freie Zeit (angepasst bei Verletzung/Aufbau) mit Anleitungen |
| Spielerentwicklung | Kompetenzprofil nach Positionsgruppe (Trainer- und Selbsteinschätzung 1–5, Unterschiede ab 2 Stufen markiert, Verlauf), messbare Ziele (Test, Spielstatistik, Beteiligung, Zähler, Messwert, Meilensteine) mit automatischem Fortschritt und „hinter Plan“, Entwicklungsgespräche mit Vorbereitung aus den Daten, Vereinbarungen und interner Notiz, Saisonrückblick, Team-Überblick mit To-dos | eigene Ziele setzen und Fortschritt eintragen, Selbsteinschätzung, freigegebene Sicht des Trainerteams und Gesprächsprotokolle, „Saison bisher“ |
| Individualtraining | Anfragen beantworten; Zusage legt eine Einheit nur für den Spieler an (RPE, Belastung, Tagesplan) | Individualtraining mit Thema und Wunschzeit anfragen (höchstens 2 offen), Antwort und Termin sehen |
| Wochenchallenge | Vorschläge je Altersgruppe (Jonglieren, Wandpässe, schwacher Fuß, Ball-Mastery, Schlaf, Copenhagen …) oder eigene, für alle oder Gruppen, Teilnahme und Teamziel, Bestenliste optional | mitmachen, Bestwert/Menge/Tage eintragen, Teamziel, Serie |
| Chat | Teamchat, Trainerteam, Gruppen-Chats, Einzelchats, eigene Gruppen, Ankündigungs-Modus, Reaktionen, Antworten, Echtzeit, Push ohne Text; Kinderschutz in Jugendteams (Einzelchats nur mit dem Trainerteam, Trainerteam liest mit), Meldungen mit Kopie | Teamchat, Gruppen, Einzelchats nach Einstellung, stumm schalten, löschen, melden |
| Kommunikation | Kontaktliste (Koordinator, Vorstand, Physio, Ärzte), Push-Erinnerungen, Nachrichten | Kontakte, Erinnerungen |
| Aufgaben & Dienste | Todos für Trainer und Spieler, Dienste reihum (fair), milder Strafenkatalog mit Automatik (nur mit Zustimmung, nie rückwirkend) | eigene Aufgaben, Dienste, Strafen |
| Mannschaftskasse | Beiträge (einmalig, monatlich, je Saison), Geldstrafen (Senioren), Kassenbuch, offene Beträge je Spieler, Befreiungen, Kassenwart | „Meine Kasse“, optional Kassenstand; Kassenwart bucht Zahlungen |
| Trainerteam & Rechte | zehn Rechte je Mitglied mit Vorlagen (Co-, TW-, Athletiktrainer, Physio, Betreuer, Analyst), serverseitig geprüft | – |
| Offline | Anwesenheit und Einträge ohne Netz, Start mit letztem Stand | RPE, Morgen-Check, Abmeldung ohne Netz – wird nachgereicht |
| Baukasten | Pakete an/aus, was Spieler sehen, Absagen per App an/aus, Ranglisten-Modus | – |

## Ordner

| Pfad | Inhalt |
|---|---|
| `app/` | Bildschirme (Expo Router): `coach/…`, `player/…`, Anmeldung, Konto |
| `src/core/` | Fachlogik ohne React und Datenbank (Wochenplan, Erholung, Leistung, Pausen, Gruppen, Reha, Dienste, Gamification, Entwicklung, Challenge, Chat-Regeln, Matchplan, Verein) mit Tests |
| `src/data/` | Datenzugriff: Supabase oder Demo-Modus im Speicher |
| `src/ui/` | Bausteine der Oberfläche |
| `src/i18n/` | Texte Deutsch/Englisch |
| `supabase/` | Datenbank-Migrationen, Zugriffsregeln, Edge Functions, Tests ([README](supabase/README.md)) |
| `docs/` | Architektur, Datenschutzerklärung, Einwilligungen, DSFA, Store-Texte, Impressum-Vorlage |
| `.github/workflows/` | CI, Backend-Deploy, App-Build |

## Befehle

```bash
npm install            # einmalig
npx expo start         # App starten (Expo Go auf dem Handy oder Web mit "w")
npm test               # Kernlogik-Tests
npm run test:db        # Datenbank + Zugriffsregeln (braucht PostgreSQL 16)
npm run typecheck      # TypeScript
```

Ohne `.env` startet die App im Demo-Modus mit Beispieldaten.
