# Trainerbank

App für Fußballtrainer und ihre Spieler – vom Kinderfußball bis zu den Senioren. Planung, Belastungssteuerung und
Spielerentwicklung an einem Ort, mit einer eigenen Spieler-App, die Spaß macht.

**Technik:** Expo SDK 57 (iOS, Android, Web) · React Native · Expo Router · TypeScript · Supabase (Region Frankfurt) ·
Claude API für den KI-Coach und die Befund-Auswertung.

Einrichten, Veröffentlichen und alle Konten: **[SETUP.md](SETUP.md)** (Schritt für Schritt).

## Funktionen

| Bereich | Trainer | Spieler |
|---|---|---|
| Navigation & Darstellung | untere Leiste frei wählbar (bis zu fünf Bereiche + „Mehr“, Reihenfolge, Vorschau; erreichbar über Mehr → Anpassen, „Startseite anpassen“ und den Hinweis auf der Startseite), Menü „Mehr“ nach Themen mit Suche, Menüpunkte aus- und einblenden – je Konto gespeichert; Hell/Dunkel/wie System (Konto → Darstellung) | Bereiche der unteren Leiste ein-/ausblenden (Meine Daten, Tipps, Chat – dann unter „Ich“), Hell/Dunkel/wie System |
| Heute | nächster Termin → Trainingstag, Spieltag-Check (Matchplan, Aufstellung, Ausfälle, Überlastung, Dienste, offene Aufgaben – jede Zeile führt hin), Belastung im Team (Verteilung auf die ACWR-Zonen mit Empfehlung), Spieler mit Handlungsbedarf, Teamlast, eigene Aufgaben, KI-Coach, laufende Pause/Vorbereitung; Karten an/aus und sortierbar | anpassbare Startseite nach Wichtigkeit (Einträge, Körper heute, Trainer-Nachrichten, Reha, Matchplan, Termine, Aufgaben und Dienste, Bewertung, Programm, Challenge, Ziele, Wochenringe, Kasse; Meilensteine optional) – Karten an/aus und sortierbar; „Meine Daten“ mit Überblick oben (Belastung, Beteiligung, Schlaf, Minuten), Meilensteine zuletzt |
| Kalender & Planung | Woche/Monat (Einträge nach Uhrzeit), Wochenprofil (Intensität je Tag, Bewertung der Woche, Verteilung hart/mittel/leicht), Spieltags-Prinzipien (MD−4 … MD+1), Aufbau-/Erhalt-/Entlastungswochen, Pausen, geplanter RPE (Zukunft) und Ø RPE (Vergangenheit), individuelle Ziele je Spieler (Regeneration, Spielersatz, Reha, Aufbau); mehrere Einheiten am Tag (z. B. 30 Min. Athletik + 90 Min. Training, Torwarttraining, Reha-Gruppe) wöchentlich oder für einzelne Tage | Wochenplan (wenn freigegeben) mit persönlichem Ziel und den eigenen weiteren Einheiten |
| Torhüter | Torwarttraining mit Schwerpunkten und TW-Trainer, Sprünge/Hechtsprünge als Belastung, Hinweis bei vielen Sprüngen vor dem Spiel, Gegentore/Paraden/Zu-null, Torwarttests (Seitsprung, Abschlagweite) | Torwart-Tipp nach Spieltags-Bezug, Sprünge eintragen, eigene Torwart-Statistik |
| Belastung | Session-RPE je Einheit, ACWR, Hooper-Morgencheck, Körperkarte mit Angaben zum Schmerz und Warnzeichen, Beschwerden-Häufungen mit Prävention, Erholungsmodell nach Alter, Zusatzsport | RPE und Morgen-Check eintragen, schmerzende Stelle auf einer altersgerechten Figur antippen, eigene Sportarten, persönliche Ernährungs- und Schlaftipps |
| Kader | Positionen (TW, RV, IV, LV, DM, ZM, OM, LM, RM, ST), Gruppen (Reha, Torhüter, Aufbau, Wachstumsschub, Mannschaftsrat, Talent, eigene) mit Vorschlägen und Sichtbarkeit, Profilbilder, inaktive Spieler | eigenes Profil, eigene freigegebene Gruppen |
| Spiele & Training | Minuten, Tore, Assists, Noten 1–10 mit Feedback, Videos für Team, Spieler oder Gruppen; Trainingseindruck nur für Ausreißer (besonders gut/schwach mit Gründen, Standard Durchschnitt) | Noten, freigegebene Trainingseindrücke, Statistik, Videos |
| Leistungsdiagnostik | Tests wählbar (Sprint, CMJ, 30-15 IFT, Yo-Yo, 505 …), Normwerte, persönliche Laufstrecken; CMJ-Abfall und Fitness verfeinern die Erholung; Platzierung für Spieler an/aus | eigene Tests, Bestwerte und eigener Platz (ohne Werte anderer) |
| Verletzungen | Rückkehr in 4 Stufen, Reha-Plan nach Körperregion und Stufe, Befunde scannen (Foto/PDF), KI-Zusammenfassung mit Einwilligung | eigener Reha-Plan, eigene Befunde |
| Matchplan | Aufstellung per Ziehen (11er/9er/7er/5er, Grundordnungen, Vorschlag nach Position und Verfügbarkeit, Bank, Kapitän), Icons mit Nummer, Name oder Foto in wählbarer Größe, Spielfeld-Design (Rasen, Taktiktafel, weiß); Folien für Taktik und Standards mit Vorschaubildern und Editor im Vollbild (Tafel fest, nichts scrollt beim Zeichnen): Ausschnitt frei wählbar (Voreinstellungen wie 16er vorne oder Ecke rechts, Zoom, Verschieben, Format – der 16er wird groß), Gegner, Pässe, Laufwege und Dribblings (Bogen stufenlos am Griff, rasten an Spielern ein), Linien, Freihand, Zonen (4 Ecken), Kreise, Text; Auswählen mit Griffen und Schnellaktionen (Art, Farbe, gerade, Schritt 1–20, Kopieren, Löschen), Spieler zuweisen, Rückgängig/Wiederholen (ein Schritt je Bewegung), Icongröße und -ansicht je Folie, Folien aus anderen Matchplänen übernehmen; Präsentation im Vollbild (quer auf Tablet/Laptop) mit Ablauf Schritt für Schritt; Aufstellung am Handy: Ziehen nach kurzem Halten, Wischen scrollt; Spielidee (Leitsatz, 3 Schwerpunkte), Gegneranalyse, Aufgabe je Spieler, Wechselplan mit geplanten Minuten; Freigabe bis Spielende (Bereiche, nur Kader, Aufgaben nur eigene) mit Zugriffsprotokoll | freigegebener Plan mit eigener Rolle und Aufgabe, Folien im Vollbild, Wasserzeichen, Bildschirmschutz (Android gesperrt, iOS Aufnahmen geschwärzt) |
| Verein | mehrere Teams verbinden (Code), Vereinsübersicht mit Kennzahlen je Team (nächstes/letztes Spiel, Bilanz, Ausfälle, Beteiligung, Trainings, Matchplan-Status), Funktionäre (Vereinsadmin, sportliche Leitung, NLZ-/Jugendleitung, Koordination) mit Rechten und Teams, Ankündigungen in die Teamchats, Spieler hochziehen oder wechseln (optional mit Belastung, Morgen-Checks und Ausfällen) | bei Hochziehen beide Teams in der App |
| Kaderplanung & Scouting | Schattenkader je Position auf dem Spielfeld oder als Liste (Soll, Ampel fest/wackelt/fehlt, Anforderungsprofil, eingeplanter Kader und Schattenkandidaten in Rangfolge, Grundordnung wechselbar), Saisonplanung mit Jahrgängen, Altersgrenze automatisch, Stand je Spieler (fest, Perspektive, unsicher, Abgang), Aufrücker aus jüngeren Vereinsteams, Zugänge mit Übernahme in den Kader; Scouting-Datenbank (Status bis zur Zusage, Priorität A–C, Niveau/Potenzial, Berichte mit Bewertung je Bereich und Kompetenz, Merklisten, Filter, nächster Schritt) mit Information nach Art. 14 DSGVO und automatischer Löschung | – (nur Trainerteam mit Recht „Scouting“) |
| Trainingstag | verfügbare Spieler, Ablauf in Blöcken mit mehreren Zuständigen je Übung und eigener Aufgabe (z. B. Trainer A: ballbesitzende, Trainer B: verteidigende Mannschaft; „Deine Aufgabe“ auf Startseite und Tagesseite), Coachingpunkten und Skizzen (auch als Foto), Dienste, Todos | – |
| Trainingsplanung | Taktiktafel, Übungsarchiv mit Coachingpunkten, Einheiten-Vorlagen mit Intensitätscheck, Trainerprofile | – |
| Vorbereitung & Pausen | Wochenaufbau mit Ziel-Last, Testtagen, Taper; Pausen ohne Mannschaftstraining; Umsetzung je Spieler | persönliches Programm für die freie Zeit (angepasst bei Verletzung/Aufbau) mit Anleitungen |
| Spielerentwicklung | Kompetenzprofil nach Positionsgruppe (Trainer- und Selbsteinschätzung 1–5, Unterschiede ab 2 Stufen markiert, Verlauf), messbare Ziele (Test, Spielstatistik, Beteiligung, Zähler, Messwert, Meilensteine) mit automatischem Fortschritt und „hinter Plan“, Entwicklungsgespräche mit Vorbereitung aus den Daten, Vereinbarungen und interner Notiz, Saisonrückblick, Team-Überblick mit To-dos | eigene Ziele setzen und Fortschritt eintragen, Selbsteinschätzung, freigegebene Sicht des Trainerteams und Gesprächsprotokolle, „Saison bisher“ |
| Individualtraining | Anfragen beantworten („an dich“ hervorgehoben, Filter, weitergeben); Zusage legt eine Einheit nur für den Spieler an (RPE, Belastung, Tagesplan) | Individualtraining mit Thema, Wunsch-Trainer (Vorauswahl passend zum Thema) und Wunschzeit anfragen (höchstens 2 offen), Antwort und Termin sehen |
| Wochenchallenge | Vorschläge je Altersgruppe (Jonglieren, Wandpässe, schwacher Fuß, Ball-Mastery, Schlaf, Copenhagen …) oder eigene, für alle oder Gruppen, Teilnahme und Teamziel, Bestenliste optional | mitmachen, Bestwert/Menge/Tage eintragen, Teamziel, Serie |
| Chat | Teamchat, Trainerteam, Gruppen-Chats, Einzelchats, eigene Gruppen, Ankündigungs-Modus, Reaktionen, Antworten, Echtzeit, Push ohne Text; Kinderschutz in Jugendteams (Einzelchats nur mit dem Trainerteam, Trainerteam liest mit), Meldungen mit Kopie | Teamchat, Gruppen, Einzelchats nach Einstellung, stumm schalten, löschen, melden |
| Kommunikation | Kontaktliste (Koordinator, Vorstand, Physio, Ärzte), Push-Erinnerungen, Nachrichten | Kontakte, Erinnerungen |
| Aufgaben & Dienste | Todos für Trainer und Spieler, Dienste reihum (fair; Wechsel jedes Mal, wöchentlich, alle 2 Wochen oder monatlich), milder Strafenkatalog mit Automatik (nur mit Zustimmung, nie rückwirkend) | eigene Aufgaben, Dienste, Strafen |
| Mannschaftskasse | Beiträge (einmalig, monatlich, je Saison), Geldstrafen (Senioren), Kassenbuch, offene Beträge je Spieler, Befreiungen, Kassenwart | „Meine Kasse“, optional Kassenstand; Kassenwart bucht Zahlungen |
| Trainerteam & Rechte | zehn Rechte je Mitglied mit Vorlagen (Co-, TW-, Athletiktrainer, Physio, Betreuer, Analyst), serverseitig geprüft | – |
| Offline | Anwesenheit und Einträge ohne Netz, Start mit letztem Stand | RPE, Morgen-Check, Abmeldung ohne Netz – wird nachgereicht |
| Baukasten | Pakete an/aus, was Spieler sehen, Absagen per App an/aus, Ranglisten-Modus | – |

## Ordner

| Pfad | Inhalt |
|---|---|
| `app/` | Bildschirme (Expo Router): `coach/…`, `player/…`, Anmeldung, Konto |
| `src/core/` | Fachlogik ohne React und Datenbank (Wochenplan, Erholung, Leistung, Pausen, Gruppen, Reha, Dienste, Gamification, Entwicklung, Challenge, Chat-Regeln, Matchplan, Verein, Kaderplanung & Scouting) mit Tests |
| `src/data/` | Datenzugriff: Supabase oder Demo-Modus im Speicher |
| `src/ui/` | Bausteine der Oberfläche; Erscheinungsbild in `theme.tsx` (Farben, Typografie, Hell/Dunkel), Marke in `brand.tsx` |
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
