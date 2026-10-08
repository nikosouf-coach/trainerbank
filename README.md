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
| Kalender & Planung | Woche/Monat, Spieltags-Prinzipien (MD−4 … MD+1), Aufbau-/Erhalt-/Entlastungswochen, Pausen, geplanter RPE (Zukunft) und Ø RPE (Vergangenheit), individuelle Ziele je Spieler (Regeneration, Spielersatz, Reha, Aufbau) | Wochenplan (wenn freigegeben) mit persönlichem Ziel |
| Belastung | Session-RPE, ACWR, Hooper-Morgencheck mit Beschwerden nach Körperregion, Erholungsmodell nach Alter, Zusatzsport | RPE und Morgen-Check eintragen (Körperkarte), eigene Sportarten, persönliche Ernährungs- und Schlaftipps |
| Kader | Positionen (TW, RV, IV, LV, DM, ZM, OM, LM, RM, ST), Gruppen (Reha, Torhüter, Aufbau, Wachstumsschub, Mannschaftsrat, Talent, eigene) mit Vorschlägen und Sichtbarkeit, Profilbilder, inaktive Spieler | eigenes Profil, eigene freigegebene Gruppen |
| Spiele | Minuten, Tore, Assists, Noten 1–10 mit Feedback, Videos für Team, Spieler oder Gruppen | Noten (gute hervorgehoben), Statistik, Videos |
| Leistungsdiagnostik | Testbatterie (Sprint, CMJ, 30-15 IFT, Yo-Yo, 505 …), Normwerte, persönliche Laufstrecken; CMJ-Abfall und Fitness verfeinern die Erholung; Platzierung für Spieler an/aus | eigene Tests, Bestwerte und eigener Platz (ohne Werte anderer) |
| Verletzungen | Rückkehr in 4 Stufen, Reha-Plan nach Körperregion und Stufe, Befunde scannen (Foto/PDF), KI-Zusammenfassung mit Einwilligung | eigener Reha-Plan, eigene Befunde |
| Trainingstag | verfügbare Spieler, Ablauf in Blöcken mit Zuständigkeit je Trainer, Coachingpunkten und Skizzen (auch als Foto), Dienste, Todos | – |
| Trainingsplanung | Taktiktafel, Übungsarchiv mit Coachingpunkten, Einheiten-Vorlagen mit Intensitätscheck, Trainerprofile | – |
| Vorbereitung & Pausen | Wochenaufbau mit Ziel-Last, Testtagen, Taper; Pausen ohne Mannschaftstraining; Umsetzung je Spieler | persönliches Programm für die freie Zeit (angepasst bei Verletzung/Aufbau) mit Anleitungen |
| Kommunikation | Kontaktliste (Koordinator, Vorstand, Physio, Ärzte), Push-Erinnerungen, Nachrichten | Kontakte, Erinnerungen |
| Aufgaben & Dienste | Todos für Trainer und Spieler, Dienste reihum (fair), milder Strafenkatalog mit Automatik (nur mit Zustimmung, nie rückwirkend) | eigene Aufgaben, Dienste, Strafen |
| Baukasten | Pakete an/aus, was Spieler sehen, Absagen per App an/aus, Ranglisten-Modus | – |

## Ordner

| Pfad | Inhalt |
|---|---|
| `app/` | Bildschirme (Expo Router): `coach/…`, `player/…`, Anmeldung, Konto |
| `src/core/` | Fachlogik ohne React und Datenbank (Wochenplan, Erholung, Leistung, Pausen, Gruppen, Reha, Dienste, Gamification) mit Tests |
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
