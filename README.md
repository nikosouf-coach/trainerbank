# Trainerbank

App für Fußballtrainer und ihre Spieler – vom Kinderfußball bis zu den Senioren. Planung, Belastungssteuerung und
Spielerentwicklung an einem Ort, mit einer eigenen Spieler-App, die Spaß macht.

**Technik:** Expo SDK 54 (iOS, Android, Web) · React Native · Expo Router · TypeScript · Supabase (Region Frankfurt) ·
Claude API für den KI-Coach und die Befund-Auswertung.

Einrichten, Veröffentlichen und alle Konten: **[SETUP.md](SETUP.md)** (Schritt für Schritt).

## Funktionen

| Bereich | Trainer | Spieler |
|---|---|---|
| Heute | nächster Termin, Ampel, Spieler mit Handlungsbedarf, Teamlast, KI-Coach, laufende Pause/Vorbereitung | Level, XP, Serie, Wochenringe, Abzeichen, Aufgaben, nächste Termine, Ziele |
| Kalender & Planung | Woche/Monat, Spieltags-Prinzipien (MD−4 … MD+1), Aufbau-/Entlastungswochen, Erholungscheck pro Spieler | Wochenplan (wenn freigegeben) |
| Belastung | Session-RPE, ACWR, Hooper-Morgencheck, Erholungsmodell nach Alter, Zusatzsport | RPE und Morgen-Check eintragen, eigene Sportarten |
| Kader | Positionen (TW, RV, IV, LV, DM, ZM, OM, LM, RM, ST), Positionsgruppen und eigene Gruppen, Profilbilder, inaktive Spieler | eigenes Profil und Profilbild |
| Spiele | Minuten, Tore, Assists, Noten 1–10 mit Feedback, Videos zu Spielen | Noten, Statistik, Videos |
| Leistungsdiagnostik | Testbatterie (Sprint, CMJ, 30-15 IFT, Yo-Yo, 505 …), Normwerte, persönliche Laufstrecken; CMJ-Abfall und Fitness verfeinern die Erholung | eigene Tests und Bestwerte |
| Verletzungen | Rückkehr in 4 Stufen, Befunde scannen (Foto/PDF), KI-Zusammenfassung mit Einwilligung | eigene Befunde |
| Trainingsplanung | Taktiktafel, Übungsarchiv mit Coachingpunkten, Einheiten-Vorlagen mit Intensitätscheck, Trainerprofile | – |
| Vorbereitung & Pausen | Wochenaufbau mit Ziel-Last, Testtagen, Taper; Pausen ohne Mannschaftstraining; Umsetzung je Spieler | Programm für die freie Zeit mit Anleitungen und XP |
| Kommunikation | Kontaktliste (Koordinator, Vorstand, Physio, Ärzte), Push-Erinnerungen, Nachrichten | Kontakte, Erinnerungen |
| Baukasten | Pakete an/aus, was Spieler sehen, Absagen per App an/aus | – |

## Ordner

| Pfad | Inhalt |
|---|---|
| `app/` | Bildschirme (Expo Router): `coach/…`, `player/…`, Anmeldung, Konto |
| `src/core/` | Fachlogik ohne React und Datenbank (Wochenplan, Erholung, Leistung, Pausen, Gamification) mit Tests |
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
