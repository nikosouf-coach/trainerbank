# Datenschutz-Folgenabschätzung (DSFA) – Trainerbank

> **ENTWURF – vor Verwendung anwaltlich bzw. durch den Datenschutzbeauftragten prüfen lassen.**
> Vorlage nach Art. 35 DSGVO, vorausgefüllt auf Grundlage von `docs/ARCHITEKTUR.md` (Stand der Architektur, nicht
> des ausgelieferten Codes). Alle als „umgesetzt“ markierten Maßnahmen sind vor Abschluss der DSFA technisch zu
> verifizieren (z. B. durch Tests und Code-Review).

| | |
|---|---|
| Verantwortlicher | [Herausgeber], [Anschrift], [E-Mail] |
| Datenschutzbeauftragter | [Name, Kontakt] – Stellungnahme siehe Abschnitt 11 |
| Verarbeitungstätigkeit | Betrieb der App „Trainerbank“ (iOS, Android, Web) zur Trainings- und Mannschaftsorganisation mit Belastungssteuerung |
| Version / Datum | [0.1] / [TT.MM.JJJJ] |
| Erstellt von | [Name, Funktion] |
| Beteiligt | [Entwicklung], [DSB], [Vertreter eines Pilotvereins], [Elternvertreter] |
| Status | Entwurf |
| Nächste Überprüfung | vor dem Store-Start, danach jährlich und bei jeder wesentlichen Änderung (z. B. neue Datenart, neuer Dienstleister, Änderung am KI-Coach) |

---

## 1. Prüfung der DSFA-Pflicht (Schwellwertanalyse)

Kriterien nach den Leitlinien der Artikel-29-Datenschutzgruppe (WP 248 rev.01), von der DSK übernommen:

| Kriterium | erfüllt? | Begründung |
|---|---|---|
| Bewerten oder Einstufen (Scoring, Profiling) | ja | Ampel, Belastungskennzahlen (ACWR), Erholungsstatus, Spielerprofile und „Potenziale“ bewerten den Zustand einzelner Spieler |
| Automatisierte Entscheidung mit Rechtswirkung | nein | Empfehlungen unterstützen das Trainerteam; Entscheidungen treffen Menschen |
| Systematische Überwachung | ja (eingeschränkt) | tägliche Erfassung von Belastung und Wohlbefinden über die Saison |
| Sensible Daten (Art. 9) | ja | Belastung, Wohlbefinden, Beschwerden, Krankheit, Verletzung, Größe, Gewicht |
| Umfangreiche Verarbeitung | [zu bewerten] | abhängig von Anzahl der Teams und Spieler; bei Wachstum wahrscheinlich |
| Zusammenführen von Datensätzen | teilweise | Kombination von Belastung, Wohlbefinden, Zusatzsport und Wachstum zu Kennzahlen |
| Schutzbedürftige Betroffene | ja | Kinder und Jugendliche (ab ca. 7 Jahren, viele 14–18); Abhängigkeitsverhältnis Spieler–Trainer |
| Innovative Technologie | ja | KI-Coach auf Basis eines großen Sprachmodells |
| Betroffene an Rechtsausübung oder Vertragsschluss gehindert | nein | – |

**Ergebnis:** Mindestens fünf Kriterien sind erfüllt. Eine DSFA ist **erforderlich**. Zusätzlich kommt Art. 35 Abs. 3
lit. b DSGVO (umfangreiche Verarbeitung besonderer Kategorien) in Betracht. Zu prüfen ist außerdem die
DSK-Liste der Verarbeitungstätigkeiten, für die eine DSFA durchzuführen ist (Art. 35 Abs. 4 DSGVO), insbesondere der
Punkt zum Einsatz künstlicher Intelligenz zur Interaktion mit Betroffenen bzw. zur Bewertung persönlicher Aspekte.

**Folge:** Nach § 38 Abs. 1 Satz 2 BDSG ist ein Datenschutzbeauftragter zu benennen (unabhängig von der
Mitarbeiterzahl).

---

## 2. Systematische Beschreibung der Verarbeitung (Art. 35 Abs. 7 lit. a)

### 2.1 Zwecke

1. Organisation von Trainings- und Spielbetrieb: Kader, Kalender, Wochenplan mit Spieltagsbezug, Anwesenheit,
   Abwesenheiten, Nachrichten des Trainerteams.
2. Belastungs- und Erholungssteuerung: Session-RPE, Belastungskennzahlen, altersabhängiges Erholungsmodell,
   morgendliches Wohlbefinden (Hooper-Fragebogen), Zusatzsport, Wachstum.
3. Begleitung der Rückkehr nach Krankheit oder Verletzung (Stufen 1–4, organisatorisch).
4. Spielerentwicklung: Potenziale und Ziele, Trainernotizen.
5. Optionaler KI-Coach: Beantwortung von Fragen zu Training, Belastung und Erholung.
5a. Verein: mehrere Teams eines Vereins verbinden – Funktionäre mit Rechten je Team, Vereinsübersicht mit Kennzahlen,
   Hochziehen und Wechsel von Spielern (optional mit Belastung), Ankündigungen an die Teams.
5b. Kaderplanung & Scouting: Planung der nächsten Saison (Schattenkader je Position, Stand der eigenen Spieler,
   Altersgrenze, Aufrücker aus jüngeren Teams des Vereins) und Beobachtung von Spielern anderer Teams und Vereine
   (sportliche Eindrücke, Berichte, Status bis zur Zusage).
5c. Notfallkontakte: im Notfall (Unfall, medizinischer Notfall bei Training, Spiel oder Fahrt) schnell eine Person
   erreichen, die der Spieler angegeben hat; freiwillige Hinweise für den Notfall (Gesundheitsdaten).
5d. Größen & Ausrüstung: Kleider- und Schuhgrößen für Sammelbestellungen; Bestellliste (CSV oder Text), die das
   Trainerteam selbst weitergibt (z. B. an einen Ausrüster).
5e. Kader-Nominierung: Kader fürs Spiel (im Kader oder auf Abruf) mit Treffpunkt veröffentlichen; Zu- und Absagen der
   Spieler, wenn das Trainerteam Absagen durch Spieler erlaubt.
5f. Fahrgemeinschaften: Fahrten zu Spielen und Terminen mit freien Plätzen und Abfahrt anbieten, mitfahren, eine
   Mitfahrgelegenheit suchen; Zuordnung durch das Trainerteam.
5g. Karten und Sperren: Karten im Spielbericht, daraus Sperren nach den Regeln des Verbands, eingetragene Urteile und
   sonstige Sperren – damit gesperrte Spieler nicht nominiert werden.
5h. Geburtstage (aus dem vorhandenen Geburtsdatum, nur fürs Trainerteam; Glückwunsch für den Spieler), Foto-Erlaubnis je
   Kanal (Website, Social Media, Presse und Druck, Name) als Nachweis vor dem Veröffentlichen, Unfallmeldungen
   (Gesundheitsdaten) für die Meldung an Verein und Sportversicherung.
5i. Eltern-Zugang: Eltern minderjähriger Spieler mit eigenem Konto (nach Bestätigung durch das Trainerteam) sehen
   Termine, Abwesenheiten und Nominierungen ihres Kindes, melden ab, sagen zu oder ab, lesen Elterninfos und geben für
   Kinder unter 16 die Einwilligungen (geprüfte Einwilligung nach Art. 8 Abs. 2 DSGVO).
6. Erinnerungen per Push-Mitteilung.
7. Betrieb, Sicherheit, Missbrauchsbegrenzung, Nachweis von Einwilligungen.

### 2.2 Betroffene

| Gruppe | Alter | geschätzte Anzahl |
|---|---|---|
| Trainerteam (Owner, Coach, Physio) | Erwachsene | [Anzahl] |
| Funktionäre im Verein (Vereinsadmin, sportliche Leitung, NLZ-/Jugendleitung, Koordination) | Erwachsene | [Anzahl] |
| Spieler mit Konto | ab [Mindestalter] bis Erwachsene, Schwerpunkt 14–18 | [Anzahl] |
| Spieler ohne Konto | ab ca. 7 Jahren (U7 ggf. jünger) | [Anzahl] |
| Erziehungsberechtigte | Erwachsene | [Anzahl] (E-Mail-Adresse bei der Einwilligung; im Eltern-Zugang mit eigenem Konto, höchstens zwei je Kind) |
| Beobachtete Spieler (Scouting) – nutzen die App nicht | Schwerpunkt Jugend (ca. 12–19 Jahre), auch Erwachsene | [Anzahl] |
| Notfallkontakte (Eltern, Angehörige, Vertrauenspersonen) – nutzen die App in dieser Rolle nicht | überwiegend Erwachsene | bis zu zwei je Spieler |

### 2.3 Datenkategorien

Siehe Tabelle in `docs/DATENSCHUTZERKLAERUNG.md`, Abschnitt 4. Zusammengefasst:

- **Kontodaten:** E-Mail, Passwort-Hash, Anzeigename, Sprache.
- **Stammdaten:** Name, Geburtsdatum, Position, Rückennummer, optional Gewicht und Foto.
- **Teamdaten:** Verein, Team, Kalender, Wochenpläne, Einheiten, Einstellungen.
- **Anwesenheit und Abwesenheiten** (inkl. Krankheit/Verletzung, Rückkehrstufe, Notiz).
- **Gesundheitsdaten (Art. 9):** RPE und Minuten, Wohlbefinden (Schlaf, Müdigkeit, Muskelkater, Stress,
  Beschwerden mit Körperregionen), Zusatzsport, Größe, Gewicht, Verletzungsregion, berechnete Kennzahlen und
  individuelle Zielbelastung; wie Gesundheitsdaten behandelt: Mitgliedschaft in Reha-, Aufbau- und
  Wachstumsschub-Gruppen, Leistungstests und Platzierung.
- **Organisation:** Gruppen und Mitgliedschaften, Aufgaben, Dienste, Strafen (Katalog mit Automatik-Regeln),
  Ablauf des Trainingstags mit Zuständigkeiten und Skizzen-Fotos.
- **Freitexte:** Trainernotizen, Potenziale, Nachrichten, Abwesenheitsnotizen, KI-Anfragen.
- **Kaderplanung und Scouting:** Stand eigener Spieler für die nächste Saison mit Notiz, Schattenkader je Position;
  Aufrücker (Name, Position, Jahrgang, Team); externe Spieler mit Name, Jahrgang/Geburtsdatum, Positionen, Fuß,
  Größe, Verein, Status, Priorität, Einschätzung, Merkmalen, Kontaktweg, Videolink, Notiz und Berichten (Bewertung 1–5,
  Empfehlung, Freitexte), Datum der Information nach Art. 14 – **keine Gesundheitsdaten, keine Fotos**.
- **Notfallkontakte:** je Spieler ein bis zwei Personen mit Name, Beziehung (feste Liste) und Telefonnummer, wer
  zuletzt geändert hat; **Hinweise für den Notfall** als Freitext (z. B. Allergie, Asthma, Notfallmedikament) –
  Gesundheitsdaten (Art. 9).
- **Größen:** Oberteil, Hose, Schuhe, Torwarthandschuhe, Name für die Beflockung, Hinweis – keine Gesundheitsdaten.
- **Kader-Nominierung:** Spiel, im Kader oder auf Abruf, Treffpunkt, Hinweis, Zu-/Absage mit freiwilligem Grund (Freitext,
  kann Gesundheitsbezug haben, z. B. „krank“), Zeitpunkt, Antwort durch das Trainerteam.
- **Fahrgemeinschaften:** Spiel oder Termin, Fahrer (Spieler bzw. Eltern als Bezeichnung wie „Mama von Max“, oder
  Trainerteam), Plätze, Abfahrt (Uhrzeit, Ort), Hinweis (Freitext), Mitfahrer, Suchende – keine Adressen, keine
  Telefonnummern (Hinweis in der App), keine Gesundheitsdaten.
- **Karten und Sperren:** Karte je Spiel (Gelb, Gelb-Rot, Rot), eingetragene Sperren (Grund, Spiel, Beginn, Spiele oder
  Ende, Geltungsbereich, Hinweis als Freitext) – sportliche Disziplinarmaßnahmen des Verbands; nach unserer Einschätzung
  keine Daten über Straftaten im Sinne von Art. 10 DSGVO (rechtlich prüfen lassen).
- **Eltern-Zugang:** Verknüpfung Elternkonto ↔ Kind (Name, Beziehung aus fester Liste, Stand, wer wann bestätigt hat,
  Verlängerung durch das volljährige Kind), Einladungscode nur als Hash (Ablauf, verbleibende Nutzungen), falsche
  Codes mit Zeitpunkt, Lese- und Bestätigungsstand der Elterninfo; Elterninfo (Titel, Text, Verfasser). Was Eltern
  eintragen, ist gekennzeichnet (Abmeldungen, Zu-/Absagen, Einwilligungen mit `player_id`, Foto-Erlaubnis).
- **Technische Daten:** Push-Token, KI-Nutzungszähler, Server-Protokolle.
- **Einwilligungsnachweise** inkl. E-Mail der Erziehungsberechtigten bzw. Einwilligungen der Eltern im Eltern-Zugang.

### 2.4 Systeme und Datenflüsse

```
 Spieler-App / Trainer-App (Expo: iOS, Android, Web)
   │  Fachlogik src/core läuft auf dem Gerät (Kennzahlen, Ampel, Wochenplan)
   │  lokal: Anmeldesitzung, Sprache, Einstellungen
   │
   │ TLS
   ▼
 Supabase – Region Frankfurt (AWS eu-central-1)
   ├─ Auth (E-Mail/Passwort, Passwort-Hash)
   ├─ Postgres mit Row Level Security (alle Tabellen in Schema public)
   ├─ Storage (privat: avatars, findings, sketches)
   └─ Edge Functions
        ├─ ai ──────────────── TLS ──► Anthropic Claude API (USA)
        │    Anfrage + reduzierter Kontext (Vorname, Alter, Trainingsdaten)
        └─ push-reminders ──── TLS ──► Expo Push Service (USA) ──► APNs (Apple) / FCM (Google) ──► Gerät
             Push-Token + Mitteilungstext

 Web-App und Website: [Webhoster, Ort]
 E-Mails (Bestätigung, Passwort, Eltern): [E-Mail-Versanddienst, Ort]
```

### 2.5 Zugriffsmatrix (laut RLS-Regeln in ARCHITEKTUR.md)

| Daten | Staff des Teams | Spieler selbst | andere Spieler | Herausgeber |
|---|---|---|---|---|
| Teamdaten (Kalender, Pläne, Einheiten) | lesen/schreiben | lesen | lesen (Teammitglieder) | Administration [Prozess festlegen] |
| `players` | alles im Team | eigene Zeile lesen/ändern (ohne `team_id`, `user_id`, `active`, `is_new`) | nein | dto. |
| `rpe_entries`, `wellness_entries`, `extra_activities` | lesen/schreiben | eigene lesen/schreiben | nein | dto. |
| `absences` | alles | eigene lesen, eigene anlegen (als selbst gemeldet), selbst gemeldete löschen | nein | dto. |
| `growth_measurements`, `attendance` | alles | eigene lesen | nein | dto. |
| `potentials` | alles | eigene lesen, wenn `visible_to_player` | nein | dto. |
| `coach_messages` | alles | eigene lesen | nein | dto. |
| `coach_notes` | alles | nein | nein | dto. |
| `consents` | lesen (eigene Spieler) | eigene | nein | dto. |
| `push_tokens`, `profiles`, `ai_usage` | nur eigene | nur eigene | nein | dto. |
| `team_groups`, `group_members` | alles im Team | nur freigegebene Gruppen mit eigener Mitgliedschaft (keine Mitgliederlisten) | nein | dto. |
| `team_tasks` | alles im Team | eigene lesen, nur „erledigt“ setzen (Trigger) | nein | dto. |
| `team_duties`, `team_fines` | alles im Team | eigene lesen | nein | dto. |
| `session_blocks`, Bucket `sketches` | alles im Team | nein | nein | dto. |
| `my_test_ranks` (RPC) | – | eigener Platz je Test (ab 5 Werten), optional Teambestwert ohne Namen | nein | – |
| `scout_players`, `scout_reports`, `scout_lists`, `squad_plans` | nur mit Recht „scout“ | nein | nein | dto. |
| `club_risers` (RPC) | mit Recht „scout“: Spieler jüngerer Teams des Vereins (nur Name, Position, Jahrgang, Team) | nein | nein | – |
| `player_guardians` | mit Recht „squad“: lesen, bestätigen, ablehnen, lösen (RPCs) | eigene Verknüpfungen lesen; volljährig verlängern oder lösen | nein | dto. |
| `guardian_invites` (ohne `code_hash`), `guardian_code_attempts` | mit Recht „squad“: Einladungen lesen, erstellen (`guardian_invite_create`) | nein | nein | dto. |
| `parent_posts`, `parent_post_reads` | mit Recht „squad“: schreiben, Lesestand lesen | nein | nein | dto. |

Die Rollen Owner, Coach und Physio haben laut Architektur dieselben Datenrechte; nur `regenerate_codes` ist dem
Owner vorbehalten.

**Eltern** (bestätigt, Kind minderjährig bzw. vom volljährigen Kind verlängert, Modul im Team an) haben keinen
direkten Zugriff auf Tabellen des Teams: Sie bekommen nur über `guardian_child_data` ein Paket für ihr eigenes Kind
(Team ohne Codes, Termine im Zeitfenster −14 bis +60 Tage, Abwesenheiten ohne Stufe und Notiz – Krankheit und
Verletzung nur bei eigenen Abmeldungen, sonst ohne Art –, veröffentlichte Nominierungen mit Treffpunkt ohne Kaderliste,
Foto-Erlaubnis, eigene Einwilligungen, Elterninfo der letzten 120 Tage) und schreiben nur über eigene RPCs
(`guardian_absence`, `guardian_answer`, `guardian_consent`, `parent_post_read`, `photo_consent_save`). Die Elterninfo
lesen sie über RLS (`is_guardian_in_team`).

### 2.6 Auftragsverarbeiter und Empfänger

| Empfänger | Funktion | Ort | Status |
|---|---|---|---|
| Supabase | Datenbank, Auth, Storage, Edge Functions | Frankfurt (EU); Drittlandzugriffe zu prüfen | AVV [prüfen/abschließen] |
| Anthropic | Claude API für KI-Coach | USA (laut Anbieterdokumentation Stand 10/2026 Inferenz nur „us“ oder „global“ wählbar) | DPA, Transfermechanismus, Aufbewahrung, ZDR [prüfen] |
| Expo (650 Industries, Inc.) | Push-Versand, App-Updates (EAS Update) | USA | DPA, Transfermechanismus [prüfen] |
| Sentry (Functional Software, Inc.) | Absturzberichte – nur mit Zustimmung auf dem Gerät, ohne Namen, IP-Adressen, Gesundheitsdaten und Bildschirmfotos | Speicherort EU (Deutschland); Zugriffe aus den USA [prüfen] | DPA, Einstellung „IP-Adressen nicht speichern“, Speicherdauer [prüfen] |
| Apple, Google | Push-Zustellung, App Stores | [prüfen] | Rolle [prüfen] |
| [E-Mail-Versand], [Webhoster] | E-Mails, Web-Auslieferung | [Ort] | [prüfen] |

### 2.7 Speicherdauer

Siehe `docs/DATENSCHUTZERKLAERUNG.md`, Abschnitt 16, und `docs/TOM.md`, Abschnitt 4. Die automatischen Löschroutinen
sind umgesetzt (M-11, M-39): u. a. Gesundheitsdaten sofort bei Kontolöschung, 30 Tage nach Widerruf, 6 Monate nach
Deaktivierung, Belastungsdaten 24 Monate nach dem Eintrag.

---

## 3. Notwendigkeit und Verhältnismäßigkeit (Art. 35 Abs. 7 lit. b)

### 3.1 Rechtsgrundlagen

| Verarbeitung | Rechtsgrundlage | Bewertung |
|---|---|---|
| Konto, App-Funktionen | Art. 6 Abs. 1 lit. b | tragfähig für Volljährige; für Minderjährige Geschäftsfähigkeit prüfen (§§ 106 ff. BGB) |
| Teamorganisation durch Trainerteam, Spieler ohne Konto | Art. 6 Abs. 1 lit. f | Abwägung dokumentieren; erhöhter Schutz von Kindern; alternativ Verein als Verantwortlicher (Rollenmodell offen) |
| Gesundheitsdaten | Art. 9 Abs. 2 lit. a (ausdrückliche Einwilligung), unter 16 durch Eltern | Freiwilligkeit wegen Abhängigkeit Spieler–Trainer kritisch; daher Einwilligung freiwillig gestalten und Funktionen ohne sie nutzbar lassen |
| KI-Coach | Art. 6 Abs. 1 lit. a, Art. 9 Abs. 2 lit. a | gesonderte Einwilligung; Spieler-Daten im Trainer-Kontext nur mit Einwilligung des Spielers |
| Einwilligungsnachweise | Art. 6 Abs. 1 lit. c i. V. m. Art. 7 Abs. 1 | tragfähig |
| Sicherheit, Logs, KI-Limit | Art. 6 Abs. 1 lit. f | tragfähig |
| Kaderplanung und Scouting (externe Spieler, Aufrücker, Planung eigener Spieler) | Art. 6 Abs. 1 lit. f | Abwägung dokumentiert (Datenschutzerklärung, Abschnitt 5); erhöhter Schutz Minderjähriger; Information nach Art. 14 ohne Ausnahme nach Abs. 5 lit. b; Widerspruch führt zur Löschung |

### 3.2 Zweckbindung

- Keine Werbung, kein Tracking, keine Analyse-SDKs von Drittanbietern, kein Verkauf.
- Daten sind nach Teams getrennt; kein teamübergreifender Zugriff.
- Keine Verwendung für andere Zwecke (z. B. Scouting durch Dritte, Forschung) ohne neue Rechtsgrundlage. Das
  Scouting im Team (Zweck 5b) dient nur der eigenen Kaderplanung; keine Weitergabe an Dritte (z. B. Berater, andere
  Vereine), keine Bewertungen eigener Spieler im Scouting.
- KI-Anbieter: Ausschluss der Nutzung für Modelltraining vertraglich absichern [prüfen].

### 3.3 Datenminimierung (feldweise)

| Datum | Zweck | erforderlich? | Entscheidung / mildere Alternative |
|---|---|---|---|
| E-Mail | Anmeldung, Wiederherstellung | ja | – |
| Vor- und Nachname | Zuordnung im Team | ja | an KI nur Vorname bzw. Platzhalter |
| Geburtsdatum | Altersklasse, Erholungsmodell (9 Altersstufen), Prüfung unter 16, Profil-Zuordnung | ja | an KI nur Alter in Jahren |
| Position, Rückennummer | Teamorganisation | ja (gering sensibel) | – |
| Gewicht | Ernährungs- und Belastungshinweise [Zweck konkretisieren] | eingeschränkt | optional; **Empfehlung:** für unter 16 standardmäßig ausblenden, keine gewichtsbezogenen Vergleiche oder Ziele |
| Foto | Erkennbarkeit im Kader | nein | optional; Initialen als Standard; Metadaten entfernen |
| RPE + Minuten | Session-RPE-Belastung | ja (Kernfunktion) | – |
| Wohlbefinden (Hooper, Schlafdauer) | Erholungssteuerung | ja | auf validierte Items beschränkt |
| Beschwerden + Körperregion | Physio/Belastungsanpassung | ja, Region grob | nur Körperregion, kein Freitext |
| Zusatzsport | Gesamtbelastung | ja | optional |
| Körpergröße | Wachstumsphasen bei Jugendlichen | nur Jugend | **Empfehlung:** für Seniorenteams ausblenden |
| Abwesenheitsgrund krank/Verletzung, Stufe | Planung, Rückkehr | ja mit Einwilligung | ohne Einwilligung nur „entschuldigt“ ohne Grund |
| Trainernotizen | Spielerentwicklung | ja | Hinweis im UI: keine Diagnosen, nur Trainingsrelevantes |
| Potenziale, Nachrichten | Entwicklung, Kommunikation | ja | strukturierte Typen statt freiem Chat (umgesetzt) |
| Push-Token | Erinnerungen | ja, optional | Löschung bei Inaktivität |
| KI-Zähler | Tageslimit | ja | Löschung nach 30 Tagen |
| Scouting: Name, Jahrgang, Positionen, Verein | Kaderplanung, Wiedererkennen | ja | Geburtsdatum nur optional (Jahrgang genügt) |
| Scouting: Berichte, Bewertung, Empfehlung | Entscheidung über Probetraining/Verpflichtung | ja | sportliche Bereiche (1–5) statt freier Urteile; Hinweis „keine Gesundheitsdaten“; Löschfristen |
| Scouting: Kontaktweg, Videolink | Kontaktaufnahme, Beobachtung | eingeschränkt | optional; kein Adressfeld, kein Foto; nur http(s)-Links |
| Aufrücker | Planung aus dem eigenen Verein | ja | nur Name, Position, Jahrgang, Team (`club_risers`); keine Gesundheits-, Leistungs- oder Kontaktdaten |

Weitere Minimierung: Infotiefe und Module sind je Team konfigurierbar (`teams.depth`, `teams.modules`). **Zu
prüfen:** ob Gesundheitsmodule für Kinderteams (z. B. U7–U11) standardmäßig deaktiviert sind. Empfehlung: ja.

### 3.4 Speicherbegrenzung, Richtigkeit, Transparenz, Betroffenenrechte

- Speicherbegrenzung: Löschkonzept umgesetzt und getestet (M-11, M-39).
- Richtigkeit: Eingabebereiche per Datenbank-Constraint begrenzt (RPE 0–10, Minuten 1–300, Wellness 1–7, Schlaf
  0–16 h); Spieler können eigene Daten einsehen; Korrektur durch Spieler bzw. Trainerteam.
- Transparenz: Datenschutzerklärung mit Kurzfassung für Kinder, Einwilligungstexte mit Kurz- und Langfassung,
  Kennzeichnung von KI-Antworten, Info-Texte mit wissenschaftlichen Quellen.
- Betroffenenrechte: Export (JSON), Kontolöschung und Widerruf in der App; für Spieler ohne Konto Auskunft und
  Löschen der Gesundheitsdaten durch das Trainerteam (M-40); Ablauf für Anfragen in `docs/DATENPANNEN.md`, Teil B.

### 3.5 Drittlandübermittlungen

KI-Coach (Anthropic, USA) nur mit Einwilligung und reduziertem Kontext; Push (Expo, USA) mit Token und
generischen Texten; Supabase-Drittlandzugriffe zu prüfen. Transfermechanismus (EU-US Data Privacy Framework bzw.
Standardvertragsklauseln) je Anbieter **zu verifizieren**; ggf. Transfer Impact Assessment.

---

## 4. Methode der Risikobewertung

Angelehnt an DSK-Kurzpapier Nr. 18 („Risiko für die Rechte und Freiheiten natürlicher Personen“), dessen
Risikomatrix hier vereinfacht als Produkt abgebildet wird:

- **Eintrittswahrscheinlichkeit (E)** und **Schwere (S)** jeweils: 1 geringfügig · 2 überschaubar ·
  3 substanziell · 4 groß.
- **Risiko:** gering (E×S ≤ 3), Risiko (4–8), **hoch** (≥ 9). Vor Abschluss mit der Matrix des Kurzpapiers abgleichen.
- Bewertet wird aus Sicht der Betroffenen (nicht des Herausgebers): Offenlegung, Diskriminierung, Druck,
  körperliche Schäden, Verlust der Kontrolle über Daten.

---

## 5. Risiken für die Betroffenen (brutto, vor zusätzlichen Maßnahmen)

| ID | Szenario | Betroffene | möglicher Schaden | E | S | Risiko |
|---|---|---|---|---|---|---|
| R1 | Fehler in Zugriffsregeln (z. B. neue Tabelle ohne RLS, fehlerhafte Policy, Missbrauch einer `security definer`-Funktion, Leak des Service-Keys) | alle Spieler | Offenlegung von Gesundheitsdaten Minderjähriger an Mitspieler oder Dritte | 3 | 4 | **hoch** |
| R2 | **Missbrauch des Staff-Codes:** Wer den Code kennt (z. B. weitergeleitet in einer Eltern-Gruppe), wird ohne Bestätigung Coach und sieht alle Gesundheitsdaten des Teams | Spieler des Teams | Offenlegung sensibler Daten, Kinderschutzrisiko | 3 | 4 | **hoch** |
| R3 | **Übernahme eines Spielerprofils beim Beitritt:** Verknüpfung erfolgt allein über Vor-/Nachname und Geburtsdatum; wer Team-Code und diese (im Team oft bekannten) Daten hat, sieht die vom Trainer erfassten Daten des Spielers | Spieler ohne Konto | Offenlegung von Gesundheitsdaten, Nachrichten, Potenzialen | 2 | 3 | Risiko |
| R4 | Kontoübernahme (schwaches Passwort, Phishing, verlorenes Gerät), besonders bei Staff-Konten | Spieler eines Teams | Offenlegung aller Teamdaten | 2 | 4 | Risiko (hoch bei Staff) |
| R5 | Zweckentfremdung und Druck im Abhängigkeitsverhältnis: Nachteile bei Aufstellung, Druck „gute“ Werte anzugeben oder einzuwilligen, Gefühl ständiger Überwachung | Spieler, v. a. Jugendliche | Diskriminierung, psychischer Druck, unfreiwillige Einwilligung | 3 | 3 | **hoch** |
| R6 | Drittlandübermittlung (Anthropic, Expo, ggf. Supabase-Support): Zugriff durch Behörden, eingeschränkte Rechtsbehelfe; Re-Identifizierung über Vorname + Alter + Trainingsdaten | Nutzer des KI-Coachs, Push-Nutzer | Kontrollverlust über Gesundheitsdaten | 2 | 3 | Risiko |
| R7 | Fehlerhafte oder ungeeignete KI-Antworten (z. B. Training trotz Verletzung, Gewichts- oder Diättipps an Jugendliche, nicht altersgerechte Inhalte) | Spieler | körperlicher Schaden, Körperbildprobleme | 3 | 3 | **hoch** |
| R8 | Fehlende oder unwirksame Einwilligung: Kind trägt fremde oder eigene E-Mail als Eltern-Adresse ein, falsches Geburtsdatum; Trainer erfasst Gesundheitsdaten für Spieler ohne Konto ohne Einwilligung; KI-Kontext enthält Spieler ohne KI-Einwilligung; Widerruf technisch nicht abbildbar | Kinder, Spieler ohne Konto | rechtswidrige Verarbeitung sensibler Daten | 4 | 3 | **hoch** |
| R9 | Übermäßige Speicherdauer: keine automatische Löschung; ehemalige Spieler bleiben mit Gesundheitshistorie für das Trainerteam sichtbar | ehemalige Spieler | Offenlegung veralteter Gesundheitsdaten, Nachteile beim Vereinswechsel | 4 | 2 | Risiko |
| R10 | Gesundheitsangaben in Push-Mitteilungen auf dem Sperrbildschirm | Spieler | Offenlegung gegenüber Umfeld | 2 | 2 | Risiko |
| R11 | Profilfotos Minderjähriger öffentlich abrufbar (öffentlicher Bucket, erratbare Pfade) oder mit Standort-Metadaten (EXIF/GPS) | Spieler mit Foto | Identifizierung, Auffindbarkeit von Kindern | 2 | 3 | Risiko |
| R12 | Missbrauch des Nachrichtenkanals bzw. **Chats** Erwachsener → Minderjährige („geheime“ Einzelchats, Grooming) | Kinder, Jugendliche | Kinderschutz (Grooming, Grenzverletzungen) | 2 | 4 | **hoch** |
| R13 | Erraten oder Ausprobieren von Team-Codes (Enumeration über `team_by_join_code`, `join_team`) | Teams | Einsicht in Kalender (Trainings- und Spielzeiten von Kindern) | 1 | 3 | gering |
| R14 | Web-Version: Sitzungstoken im Browser-Speicher (XSS, gemeinsam genutzte Rechner) | Web-Nutzer | Kontoübernahme | 2 | 3 | Risiko |
| R15 | Datenverlust oder Nichtverfügbarkeit (Ausfall, Fehlbedienung, fehlerhafte Migration) | alle | Verlust der Trainingshistorie, fehlende Information bei Rückkehr nach Verletzung | 2 | 2 | Risiko |
| R16 | Fehlinterpretation von Kennzahlen (z. B. ACWR als Verletzungsprognose, obwohl wissenschaftlich umstritten) oder falsche Eingaben | Spieler | Über- oder Unterbelastung, Verletzung | 2 | 3 | Risiko |
| R17 | Unklare Verantwortlichkeit (Herausgeber vs. Verein) | alle | erschwerte Durchsetzung von Betroffenenrechten | 3 | 2 | Risiko |
| R18 | Mangelnde Verständlichkeit für Kinder | Kinder | Einwilligung ohne Verständnis | 3 | 2 | Risiko |
| R19 | **Befunde** (Arztbriefe als Bild/PDF): sehr sensible Dokumente; Offenlegung durch falsche Zugriffsregeln, Weitergabe an die KI ohne Einwilligung, Dateien bleiben nach Löschung des Spielers im Speicher | verletzte Spieler | Offenlegung von Diagnosen, Nachteile bei Vereinswechsel | 2 | 4 | **hoch** |
| R20 | KI-Zusammenfassung eines Befunds wird als ärztliche Aussage verstanden (z. B. zu früher Wiedereinstieg) | verletzte Spieler | körperlicher Schaden | 2 | 4 | **hoch** |
| R21 | Daten Dritter in der Kontaktliste (Telefon, Adresse) ohne deren Wissen | Ansprechpersonen | unerwünschte Kontaktaufnahme | 2 | 2 | gering |
| R22 | **Gruppen offenbaren Gesundheit:** Mitgliedschaft in „Reha“, „Belastungsaufbau“ oder „Wachstumsschub“ wird für Mitspieler sichtbar (Mitgliederliste, an die Gruppe gerichtete Videos/Aufgaben) | verletzte Spieler, Jugendliche im Wachstum | Offenlegung von Gesundheitsinformationen, Stigmatisierung | 2 | 3 | Risiko |
| R23 | **Strafen und Dienste als Druckmittel:** Sanktion für fehlende Gesundheitseinträge setzt Spieler unter Druck, Daten zu liefern oder einzuwilligen; rückwirkende Strafen; öffentliche Bloßstellung | Spieler, v. a. Jugendliche | unfreiwillige Preisgabe von Gesundheitsdaten, psychischer Druck | 3 | 3 | **hoch** |
| R24 | **Ranglisten in Leistungstests:** sozialer Vergleich, Rückschluss auf Werte anderer (z. B. über Teambestwert bei kleinen Teams) | Spieler | Druck, Offenlegung von Leistungsdaten anderer | 2 | 2 | gering |
| R25 | Skizzen-Fotos zeigen Personen oder Kinder bzw. enthalten Standortdaten | Personen auf Fotos | Identifizierung | 1 | 2 | gering |
| R26 | **Lokale Kopie auf dem Gerät** (Offline-Start): Staff-Geräte halten Gesundheitsdaten des Teams; Verlust oder geteiltes Gerät | Spieler des Teams | Offenlegung | 2 | 3 | Risiko |
| R27 | **Zu weite Rechte im Trainerteam** (alle sehen alles) bzw. Betreuer/Kassenwart sehen Gesundheitsdaten | Spieler | Offenlegung über das Erforderliche hinaus | 3 | 3 | **hoch** |
| R28 | **Mannschaftskasse:** Befreiungen/offene Beträge deuten auf finanzielle Notlage; Kassenwart (Spieler) sieht Beträge der Mitspieler; Geldstrafen bei Minderjährigen | Spieler, v. a. Jugendliche | Bloßstellung, Druck | 2 | 2 | gering |
| R29 | **Detaillierte Schmerzangaben** werden als Diagnose missverstanden oder führen zu Druck, Beschwerden zu verschweigen | Spieler | gesundheitlicher Schaden | 2 | 3 | Risiko |
| R30 | **Offline-Zeitpunkte** werden manipuliert (Gerätezeit), um Fristen zu umgehen | Team | unfaire Automatik | 2 | 1 | gering |
| R31 | **Trainingseindruck:** negative Markierungen stigmatisieren, werden als Druckmittel genutzt oder erreichen den Spieler unvermittelt über die App | Spieler, v. a. Jugendliche | psychischer Druck, Demotivation | 2 | 2 | gering |
| R32 | **Einheiten für Gruppen** (z. B. Reha-Gruppe, Torhüter) lassen auf die Gruppenzugehörigkeit schließen; Sprünge der Torhüter als zusätzliche Gesundheitsangabe | Spieler in Reha-/Aufbaugruppen, Torhüter | Offenlegung von Gesundheitsinformationen | 1 | 3 | gering |
| R33 | **Cybermobbing und Ausgrenzung im Chat** (Beleidigungen, Bloßstellung, Fotos/private Daten, Gruppen ohne einzelne Mitspieler), Spam | Spieler, v. a. Jugendliche | psychischer Schaden, Ausgrenzung | 3 | 3 | **hoch** |
| R34 | **Mitlesen** von Einzelchats durch das Trainerteam wird als Überwachung empfunden oder trifft Erwachsene; nachträgliches Einschalten legt früher private Chats offen | Spieler, Trainer | Eingriff in die Vertraulichkeit der Kommunikation | 2 | 2 | gering |
| R35 | Chat-Inhalte auf dem Sperrbildschirm (Push) oder in der lokalen Kopie; dauerhafte Speicherung alter Unterhaltungen | Spieler | Offenlegung gegenüber Umfeld, Kontrollverlust | 2 | 2 | gering |
| R36 | **Kompetenzprofil, Ziele und Gesprächsprotokolle** werden als Urteil missverstanden, setzen unter Druck oder gelangen unvermittelt zum Spieler (z. B. schlechte Einschätzung, interne Notiz) | Spieler, v. a. Jugendliche | Demotivation, Stigmatisierung, Offenlegung interner Einschätzungen | 2 | 3 | Risiko |
| R37 | **Wochenchallenge:** sozialer Vergleich (Bestenliste), Überlastung oder Verletzung durch Zusatzaufgaben (Kinder, Spieltag) | Spieler, v. a. Kinder | Druck, Überlastung | 2 | 2 | gering |
| R38 | **Individualtraining:** Einzeltermin zwischen Erwachsenem und Kind ohne Transparenz | Kinder, Jugendliche | Kinderschutz | 1 | 4 | Risiko |
| R39 | **Matchplan:** Spieler erfahren über die App (statt persönlich), dass sie nicht im Kader oder nicht in der Startelf stehen; Aufgaben/Kritik an einzelnen werden für alle sichtbar; das **Zugriffsprotokoll** wird als Überwachung empfunden oder gegen Spieler verwendet („hat den Plan nicht gelesen“) | Spieler, v. a. Jugendliche | psychischer Druck, Bloßstellung, Gefühl der Kontrolle | 2 | 2 | gering |
| R40 | **Verein:** Funktionäre sehen mehr Teams und Daten als nötig (z. B. Gesundheitsdaten ganzer Jahrgänge); Daten wandern beim **Hochziehen/Wechsel** unbemerkt in ein anderes Team; Zugriffe bleiben nach dem Ausscheiden eines Funktionärs oder dem Lösen eines Teams bestehen; Vereinsübersicht wird zum Leistungsvergleich einzelner Spieler genutzt | Spieler, v. a. Jugendliche | Offenlegung über das Erforderliche hinaus, Kontrollverlust | 2 | 3 | Risiko |
| R41 | **Kaderplanung & Scouting:** externe, oft minderjährige Spieler werden ohne ihr Wissen bewertet und dauerhaft gespeichert; Freitexte enthalten Gesundheitsangaben oder abwertende Urteile; Bewertungen werden an Dritte weitergegeben; eigene Spieler erfahren unvermittelt von ihrer Planung („Abgang“); die Aufrücker-Liste legt Daten jüngerer Teams über das Nötige hinaus offen | externe Spieler, eigene Spieler, Spieler jüngerer Teams | Kontrollverlust, Stigmatisierung, Nachteile beim Vereinswechsel | 3 | 3 | **hoch** |
| R42 | **Entwicklungsprogramm & Stärken-Runde:** Mitspieler-Rückmeldungen werden zum Beliebtheitswettbewerb oder zum Mittel der Ausgrenzung (wer keine Stärken erhält, fühlt sich zurückgesetzt; abwertende Botschaften über eigene Begriffe); Spieler erfahren, wer ihnen was geschenkt hat; das Programm wird als Urteil empfunden oder erreicht den Spieler unvermittelt | Spieler, v. a. Jugendliche | psychischer Druck, Ausgrenzung, Offenlegung | 2 | 3 | Risiko |
| R43 | **Umfragen:** Antworten in anonymen Umfragen lassen sich einzelnen Spielern zuordnen (kleine Gruppen, Zeitpunkt der Antwort, Inhalt der Freitexte); Antworten mit Namen setzen unter Druck oder werden vor der Mannschaft bloßgestellt; Spieler-Abstimmungen dienen dem Mobbing („Wer ist der Schlechteste?“); Freitexte enthalten Gesundheitsangaben oder Beleidigungen; Einstellungen werden nach den ersten Antworten verändert (z. B. anonym → mit Namen) | Spieler, v. a. Jugendliche | Offenlegung, psychischer Druck, Ausgrenzung | 2 | 2 | gering |
| R44 | **Notfallkontakte:** Telefonnummern Dritter (Eltern, Angehörige) werden ohne deren Wissen gespeichert oder für andere Zwecke genutzt (z. B. Elterngruppen, Werbung); Hinweise für den Notfall (Allergien, Vorerkrankungen, Medikamente) werden für Mitspieler, Funktionäre oder Trainerteam-Mitglieder ohne Recht sichtbar; im Notfall fehlt der Kontakt, ist veraltet oder ohne Netz nicht abrufbar | Spieler, Kontaktpersonen | Offenlegung von Gesundheitsdaten, Schaden durch verspätete Hilfe | 2 | 3 | Risiko |
| R45 | **Größen & Bestelllisten:** Die exportierte Bestellliste (Namen und Nummern, oft Minderjähriger) wird an Dritte weitergegeben, breit gestreut (z. B. in Elterngruppen) oder nicht gelöscht; Hinweise enthalten Gesundheitsangaben („wegen Knieorthese …“) | Spieler, v. a. Jugendliche | Offenlegung | 2 | 1 | gering |
| R46 | **Kader-Nominierung:** Spieler erfahren über die App (statt persönlich), dass sie nicht im Kader stehen, oder sehen Antworten und Gründe anderer; Absagegründe enthalten Gesundheitsangaben; Druck, trotz Krankheit zuzusagen; Antworten werden nachträglich ohne Kennzeichnung durch das Trainerteam geändert | Spieler, v. a. Jugendliche | Bloßstellung, psychischer Druck, Offenlegung von Gesundheitsangaben | 2 | 2 | gering |
| R47 | **Fahrgemeinschaften:** Wohnorte, Familienverhältnisse oder finanzielle Lage werden ableitbar (wer nie fährt, wer immer sucht); Freitexte enthalten Adressen oder Telefonnummern; Kinder werden ohne Wissen der Eltern einer Fahrt zugeordnet oder fallen nach einer abgesagten Fahrt unbemerkt heraus; fremde Erwachsene erscheinen als Fahrer | Spieler, v. a. Kinder; Eltern | Bloßstellung, Kinderschutz, Sicherheit | 2 | 2 | gering |
| R48 | **Karten und Sperren:** Spieler werden durch Sperren bloßgestellt oder abgestempelt (Liste „Gesperrt“, Gelb-Warnung); Freitexte zu Urteilen enthalten mehr als nötig (z. B. Beleidigungen, Vorwürfe); falsch berechnete Sperren führen zu falscher Nominierung oder zum Einsatz eines gesperrten Spielers | Spieler, v. a. Jugendliche | Bloßstellung, sportrechtliche Folgen für Spieler und Verein | 2 | 2 | gering |
| R49 | **Foto-Erlaubnis:** Fotos Minderjähriger werden ohne gültige Einwilligung veröffentlicht (falsch eingetragen, nur die Eltern bei 14- bis 17-Jährigen, Widerruf nicht beachtet); Spieler fühlen sich gedrängt zuzustimmen | Spieler, v. a. Kinder und Jugendliche | Bloßstellung, Verlust der Kontrolle über Bilder im Netz | 2 | 3 | mittel |
| R50 | **Unfallmeldungen:** Gesundheitsdaten zu Unfällen gelangen an Unbefugte (Trainerteam ohne Recht, Mitspieler) oder werden länger als nötig gespeichert; Freitexte enthalten mehr als nötig (Schuldzuweisungen, Diagnosen Dritter) | Spieler, v. a. Jugendliche | Offenlegung von Gesundheitsdaten, Nachteile im Verein | 2 | 3 | mittel |
| R51 | **Eltern-Zugang – unbefugter Zugriff:** Eine falsche Person verknüpft sich mit einem Kind (Code in eine Gruppe geschickt, weitergegeben oder erraten; Trainerteam bestätigt ohne Prüfung) – besonders kritisch bei Sorgerechtskonflikten oder Kontaktverboten, weil Termine und Treffpunkte des Kindes sichtbar werden | Kinder und Jugendliche; Eltern | Kinderschutz (Aufenthaltsort und Zeiten), Offenlegung | 2 | 4 | Risiko (Kinderschutz: vorrangig behandeln) |
| R52 | **Eltern-Zugang – Übermaß und Überwachung:** Eltern sehen mehr als nötig (Gesundheit, Bewertungen, andere Kinder) oder Jugendliche fühlen sich überwacht (16–17); Elterninfos enthalten Angaben zu einzelnen Kindern; Einwilligungen der Eltern gelten weiter, obwohl das Kind selbst entscheiden darf | Spieler, v. a. Jugendliche | Offenlegung, Verlust von Vertrauen und Selbstbestimmung | 2 | 3 | Risiko |

---

## 6. Maßnahmen

### 6.1 Bereits umgesetzt (laut Architektur – technisch zu verifizieren)

| Gewährleistungsziel (SDM) | Maßnahme | adressiert |
|---|---|---|
| Vertraulichkeit | Row Level Security auf allen Tabellen; Teamdaten lesen nur Mitglieder, schreiben nur Staff; Gesundheitsdaten nur Staff des Teams und Spieler selbst; `coach_notes` nur Staff | R1 |
| Vertraulichkeit | Hilfsfunktionen `is_team_staff`, `is_team_member`, `is_own_player`, `player_team`, `is_staff_of_player` als `security definer`, `stable`, mit festem `search_path = public` | R1 |
| Vertraulichkeit | Trigger verhindert, dass Nicht-Staff `team_id`, `user_id`, `active`, `is_new` ändern; selbst gemeldete Abwesenheiten erzwingen `reported_by_player = true` | R1, R3 |
| Vertraulichkeit | Hosting in der EU (Frankfurt, AWS eu-central-1) | R6 |
| Vertraulichkeit | TLS für alle Verbindungen; Verschlüsselung ruhender Daten durch den Anbieter [laut Anbieter, im AVV/TOM-Anhang prüfen] | R1, R6 |
| Vertraulichkeit | Passwörter nur als Hash (Supabase Auth) | R4 |
| Vertraulichkeit | Least Privilege: Claude-API-Schlüssel und Service-Key nur in Edge Functions, nicht im Client | R1, R6 |
| Vertraulichkeit | `team_by_join_code` liefert nur Vereins- und Teamname; Codes 4–4 Zeichen ohne verwechselbare Zeichen; `regenerate_codes` durch Owner | R2, R13 |
| Datenminimierung | KI-Kontext pseudonymisiert bzw. reduziert (Vorname, Alter, Trainingsdaten; kein Nachname, Geburtsdatum, E-Mail) | R6 |
| Datenminimierung | Gewicht und Foto optional; keine Analyse- oder Werbe-SDKs; kein Tracking | R6, R11 |
| Datenminimierung | Fachlogik (Kennzahlen, Ampel) läuft auf dem Gerät; keine serverseitige Profilbildung | R5 |
| Integrität | Wertebereiche per Constraint; Primärschlüssel je Spieler und Tag; `created_by` für Nachvollziehbarkeit | R16 |
| Intervenierbarkeit | Kontolöschung in der App (Spieler „Ich → Konto löschen“, Staff „Mehr → Konto löschen“); `players.user_id` mit Cascade löscht Spielerzeile und alle Gesundheitsdaten | R9 |
| Intervenierbarkeit | Export der eigenen Daten als JSON in der App | – |
| Transparenz | Einwilligungsnachweise in `consents` (Art, Version, Zeitpunkt, Eltern-E-Mail) | R8 |
| Transparenz | Info-Texte mit sportwissenschaftlichen Quellen; Hinweis „kein Medizinprodukt“ | R16 |
| Verfügbarkeit / Missbrauch | Tageslimit für KI-Anfragen (`ai_usage`) | R6, R7 |
| Kinderschutz | Nachrichten (Empfehlungen) nur vom Staff an einzelne Spieler, strukturierte Typen; alle Staff-Mitglieder sehen alle Nachrichten | R12 |
| Kinderschutz | **Chat:** Standard für Jugendteams (alle außer Senioren/Ü32, serverseitig `chat_cfg`): Einzelchats nur mit dem Trainerteam (keine Einzelchats und keine eigenen Gruppen nur unter Spielern), Einzelchats und gemischte Gruppen zwischen Trainerteam und Spielern sind **transparent** – alle im Trainerteam mit Recht „messages“ lesen mit (nicht mitschreiben), sichtbar im Chat; Transparenz wird beim Anlegen festgelegt und bleibt; nur Mitglieder des eigenen Teams, keine Telefonnummern, Spieler als „Vorname N.“; Spieler ohne Konto nicht im Chat (RLS-Test T45) | R12, R38 |
| Vertraulichkeit / Schutz | Chat: Melden mit Kopie des Textes (bleibt nach Löschen erhalten), Bearbeitung durch das Trainerteam (Recht „messages“), Löschen eigener Nachrichten (Text wird geleert), Moderation durch das Trainerteam, höchstens 30 Nachrichten pro Minute, Ankündigungs-Modus, Hinweis auf Vertrauenspersonen/Kinderschutzbeauftragte des Vereins, Chat-Regeln in der App; Nachrichten nach 24 Monaten gelöscht, erledigte Meldungen nach 12 Monaten (RLS-Test T45, T24) | R33, R35 |
| Datenminimierung | Chat-Push ohne Nachrichtentext („Neue Nachricht von …“), höchstens eine je Chat und Minute, nicht an Mitlesende, stumm schaltbar (`chat_push_targets`, Unit-Test `chatPushText`); lokale Kopie höchstens 40 Nachrichten je Chat | R35 |
| Transparenz | Senioren: Einzelchats für alle, nicht transparent (Standard); spätere Änderung der Einstellung gilt nur für neue Chats | R34 |
| Vertraulichkeit | Spielerentwicklung nur mit Recht „Notizen & Bewertungen“; Trainereinschätzungen und Gesprächsprotokolle erst nach Freigabe sichtbar; interne Gesprächsnotiz in eigener Tabelle (`dev_talk_notes`, nie für Spieler, nicht im Export); Spieler ändern bei Zielen des Trainerteams nur Schritte (Trigger); Einschätzung relativ zur Altersklasse, Unterschiede Selbst-/Fremdbild als Gesprächsanlass; höchstens 5 aktive Ziele empfohlen (RLS-Test T44) | R36 |
| Freiwilligkeit | Wochenchallenge freiwillig; Spieler sehen nur Teilnahme und Teamsumme (`challenge_totals`), Bestenliste nur auf Wunsch des Trainerteams (Vorname + Initial, Top 3, nur bei Bestleistungen); Vorschläge ohne maximale Kraftbelastung für Kinder, Sicherheitshinweis (ohne Schmerzen, nicht am Vortag des Spiels) (RLS-Test T44) | R37 |
| Vertraulichkeit / Schutz | Entwicklungsprogramm nur mit Recht „Notizen & Bewertungen“, für den Spieler erst nach Freigabe (`dev_programs.visible`, Zeitpunkt `published_at` setzt der Server); Selbstanalyse und Stärken-Runde nur mit Schlüsseln aus dem festen Stärken-Katalog (`skill_keys_ok`, kein Freitext, nur Positives); Stärken-Runde nur während einer vom Trainerteam befristeten Runde (`peer_closed`), nur an aktive Mitspieler des eigenen Teams (`different_teams`); Mitspielerliste nur Vorname, Initial, Nummer, Position (`peer_targets`); Empfänger sehen keine Einträge, nur die vom Trainerteam übernommenen Stärken ohne Namen und Anzahl; Export: geschenkte Stärken mit Vorname, erhaltene nur als Anzahl je Stärke; Löschfrist 12 Monate (`purge_old_peer_skills`) (RLS-Test T52) | R42 |
| Vertraulichkeit / Schutz | Umfragen nur mit Recht „Nachrichten“ (Lesen, Ergebnisse, Verwalten); einzelne Antworten liest nur der Spieler selbst – Ergebnisse nur über `poll_results`; anonym: keine Namen, keine Liste „wer fehlt“, Ergebnisse erst ab drei Antworten, Freitexte ohne Namen und nach Inhalt statt nach Eingang sortiert, keine Zeitpunkte; Freitexte nur fürs Trainerteam; Hinweis vor dem Antworten (mit Namen/anonym, wer das Ergebnis sieht); nach der ersten Antwort bleiben Fragen und Einstellungen fest (`poll_answered`, anonym bleibt anonym); Spieler-Abstimmungen nur nach Freigabe durch das Trainerteam (`settings.polls.players`, Recht „Nachrichten“), immer mit Namen, ganzes Team, höchstens zwei laufende, für das Trainerteam sichtbar und von ihm zu beenden oder zu löschen; Antworten nur während der Laufzeit und nur von Angesprochenen; Gruppe gelöscht ⇒ Umfrage gelöscht (nie plötzlich ans ganze Team); Löschfrist 12 Monate nach dem Ende (`purge_old_polls`) (RLS-Test T53) | R43 |
| Vertraulichkeit / Schutz | Notfallkontakte in eigener Tabelle `player_emergency` (ein bis zwei Kontakte mit Name, Beziehung aus fester Liste und gültiger Telefonnummer – `emergency_contacts_ok`); lesen nur der Spieler selbst und das Trainerteam mit Recht „Kader“ oder „Gesundheitsdaten“, ändern nur der Spieler und das Recht „Kader“; Hinweise für den Notfall getrennt in `player_emergency_med` (1–500 Zeichen): lesen und ändern nur der Spieler selbst und das Recht „Gesundheitsdaten“, Eintragen durch den Spieler nur mit Einwilligung (`require_health_consent`); Team setzt der Server, Spieler-ID nicht änderbar, `updated_by` vom Server; Löschung mit dem Spielerprofil (Cascade); Zusammenführen: der neuere Stand gewinnt (`merge_players` v10); Export v11; in der App Pflicht beim Beitreten, Hinweis „Sag der Person Bescheid“, Erinnerung an fehlende Kontakte, auch ohne Netz abrufbar, in der Demo erfundene Nummern und kein Anruf (RLS-Test T54) | R44 |
| Vertraulichkeit / Datenminimierung | Größen in eigener Tabelle `player_sizes` mit festen Listen bzw. Bereichen (keine freien Größenangaben, Beflockung 1–20 Zeichen, Hinweis 1–200), lesen und ändern nur der Spieler selbst und das Trainerteam mit Recht „Kader“; Team setzt der Server, Spieler-ID nicht änderbar; Löschung mit dem Spielerprofil (Cascade), Zusammenführen: der neuere Stand gewinnt (`merge_players` v11); Export v12; Bestellliste nur mit Rückennummer, Name, Beflockung, Größen und Hinweis (keine Geburtsdaten, Kontakte oder Gesundheitsdaten), Freitexte in der CSV nicht als Formel; die App sendet die Liste an niemanden (RLS-Test T55) | R45 |
| Vertraulichkeit / Transparenz | Kader in eigenen Tabellen `match_squads` und `match_nominations`: Spieler sehen nur veröffentlichte Kader, in denen sie nominiert sind (`nominated_me`), und nur die eigene Nominierung; die Kaderliste (`squad_mates`) nur bei Freigabe und nur mit Vorname, Initial, Nummer, Position – nie Antworten oder Gründe; Nicht-Nominierte sehen nichts; Schreiben nur mit Recht „Planung“; Spieler antworten nur über `answer_nomination` (eigene Nominierung, veröffentlicht, „Absagen durch Spieler“ an, vor dem Anpfiff in der Zeitzone des Teams); Grund freiwillig, nur bei Absage, höchstens 200 Zeichen, nur fürs Trainerteam, Hinweis „krank genügt“; Antworten des Trainerteams gekennzeichnet (`answered_by_staff`, Zeitpunkt vom Server); Löschfrist 12 Monate nach dem Spiel (`purge_old_squads`); `merge_players` v12, Export v13 (RLS-Test T56) | R46 |
| Vertraulichkeit / Kinderschutz | Fahrgemeinschaften in eigenen Tabellen `rides`, `ride_seats`, `ride_needs`: lesen nur Mitglieder des Teams (`is_team_member`), Spieler sehen andere nur mit Vorname und Initial (`ride_names`); kein direktes Schreiben – nur über `ride_save`, `ride_delete`, `ride_join`, `ride_leave`, `ride_need` (Spieler nur die eigene Fahrt bzw. sich selbst, Fahrer nehmen nur Suchende mit, Trainerteam alles; nichts für vergangene Ziele; Plätze nicht überbucht, Zeile gesperrt; je Ziel nur eine Fahrt pro Spieler; Modul „fahrten“ aus ⇒ keine neuen Einträge); fällt eine Fahrt aus oder trägt jemand anderes einen Mitfahrer aus, sucht dieser automatisch wieder (niemand fällt unbemerkt heraus); Hinweis in der App „keine Adressen oder Telefonnummern“; Löschfrist: Suchen am Tag nach dem Ziel, Fahrten 30 Tage danach (`purge_old_rides`); `merge_players` v13, Export v14 (RLS-Test T57) | R47 |
| Vertraulichkeit / Richtigkeit | Karten in `match_stats.card` (feste Werte), eingetragene Sperren in `player_suspensions`: lesen nur das Trainerteam und der Spieler selbst (Mitspieler nie), schreiben nur mit Recht „perf“ (`teams_perm_guard`: auch die Regeln `settings.cards`); je Karte höchstens eine eingetragene Sperre, Spiele 0–30 oder ein Ende (nicht beides), Hinweis 1–200 Zeichen ohne Zeilenumbrüche; Sperren aus Karten werden nach einstellbaren Regeln berechnet (Voreinstellung nach WDFV/FVN je Altersklasse, Hinweis „bei eurem Verband prüfen“) statt fest verdrahtet; Urteile ersetzen die berechnete Sperre; Löschfrist 24 Monate (`purge_old_suspensions`); `merge_players` v14, Export v15 (RLS-Test T58) | R48 |
| Vertraulichkeit / Richtigkeit | Foto-Erlaubnis in `photo_consents` (je Spieler eine Zeile): lesen das Trainerteam und der Spieler selbst, schreiben nur über `photo_consent_save` – Trainerteam mit Recht „squad“ (Erklärung aus dem Formular: wer, wann), der Spieler selbst „Nein“ immer, „Ja“ nur volljährig (Geburtsdatum; ohne Geburtsdatum nur im Erwachsenenteam); die App zeigt je Alter, wer zustimmen muss (unter 14 Eltern, 14–17 Eltern und Spieler, ab 18 Spieler), „Zustimmung fehlt“ bei unpassender Erklärung und „neu einholen“ bei Volljährigkeit; `merge_players` v15, Export v16 (RLS-Test T59) | R49 |
| Vertraulichkeit / Speicherbegrenzung | Unfallmeldungen in `accident_reports`: lesen nur das Trainerteam mit Recht „health“ und der Spieler selbst, schreiben nur mit „health“; Spiel aus dem eigenen Team, Verletzung desselben Spielers, Tage nicht in der Zukunft, Längen begrenzt; keine Übermittlung an Versicherungen aus der App (Text zum Teilen); Löschfrist 36 Monate nach dem Unfall (`purge_old_accidents`); Export v16 (RLS-Test T60) | R50 |
| Vertraulichkeit / Kinderschutz | **Eltern-Zugang:** Code je Kind nur als SHA-256-Hash, 14 Tage gültig, höchstens zwei Elternteile, nur für Minderjährige mit Geburtsdatum; höchstens 10 falsche Codes je Stunde und Konto (`guardian_code_attempts`, nach einem Tag gelöscht); jede Anfrage wartet auf Bestätigung durch das Trainerteam mit Recht „squad“; das Kind sieht unter „Ich“, wer verknüpft ist; Modul im Team abschaltbar (`team_parents_on`: dann kein Paket, keine Codes); RLS-Test T61 | R51 |
| Datenminimierung / Transparenz | **Eltern-Zugang:** kein Tabellenzugriff, nur das Paket `guardian_child_data` fürs eigene Kind; Krankheit und Verletzung ohne Art, wenn nicht selbst eingetragen; Abwesenheiten ohne Stufe und Notiz; Nominierung ohne Kaderliste; Einträge der Eltern gekennzeichnet (`answered_by_guardian`, `by_parent`); „krank“ unter 16 nur mit der Einwilligung des Elternteils, ab 16 nur mit der des Kindes (`guardian_sick_ok`); Einwilligungen der Eltern zählen nur unter 16 (`missing_health_consent`); Zugang endet 30 Tage nach dem 18. Geburtstag (außer das Kind verlängert, `purge_guardians`); gelöste Verknüpfung beendet die Einwilligungen dieses Elternteils (Trigger `player_guardians_ended`); Elterninfo nach 12 Monaten gelöscht, Hinweis „keine Angaben zu einzelnen Kindern“ | R52 |
| Kinderschutz | Individualtraining: Anfrage und Zusage für das ganze Trainerteam (Recht „plan“) sichtbar, Einheit erscheint im Tagesplan des Trainerteams mit zuständigem Trainer; Spieler sehen nur die eigene Einheit; Leitfaden empfiehlt Termine auf dem Vereinsgelände bzw. im Sechs-Augen-Prinzip (M-18) | R38 |
| Vertraulichkeit | Gruppen: Spieler sehen nur freigegebene Gruppen und nur die eigene Mitgliedschaft (`group_visible_to_me`, RLS); nie Mitgliederlisten; Wachstumsschub, Talent und eigene Gruppen standardmäßig verborgen; Trigger erzwingt gleiches Team für Gruppe und Spieler; Videos an Gruppen gehen an die Mitglieder zum Zeitpunkt des Versands (`player_ids`) (RLS-Test T33) | R22 |
| Freiwilligkeit | Strafenkatalog ist optional, Automatik-Regeln sind standardmäßig aus und schlagen Dienste statt Geld vor; jede Automatik-Regel wirkt erst ab dem Einschalten (`since`), nie rückwirkend; höchstens ein Eintrag je Regel, Spieler und Einheit (Unique-Index); „Belastung nicht eingetragen“ prüft nur das Vorhandensein eines Eintrags und gilt nur für Spieler mit Konto **und** Gesundheits-Einwilligung – ohne Einwilligung keine Strafe; Trainerteam kann jede Strafe erlassen; Spieler sehen nur eigene Einträge, bei Aufgaben nur „erledigt“ änderbar (RLS-Test T36); veraltete erledigte Einträge löscht `purge_stale_health_data` nach 12 Monaten (T24) | R23, R5, R8 |
| Datenminimierung | Platzierung serverseitig (`my_test_ranks`): nur für die eigene Spielerzeile, erst ab 5 Werten, nie Werte oder Namen anderer; Teambestwert nur, wenn das Trainerteam es einstellt; abschaltbar (RLS-Test T37) | R24 |
| Vertraulichkeit | Skizzen-Fotos im privaten Bucket `sketches` (nur Staff, Pfad `{team}/{block}.jpg`, nur JPEG ≤ 4 MB), Neukodierung vor dem Upload entfernt EXIF/GPS, Löschung mit dem Block und beim Löschen des Teams (RLS-Test T35) | R25 |
| Intervenierbarkeit | Export v3 enthält Gruppen (nur freigegebene), Aufgaben, Dienste und Strafen; Zusammenführen doppelter Spieler übernimmt diese Daten ohne Konflikte | – |
| Vertraulichkeit | **Rechte je Mitglied** (`team_staff.perms`, `staff_can()`): Gesundheitsdaten, Befunde (inkl. Dateien und KI-Auswertung), Notizen, Kasse u. a. nur mit dem jeweiligen Recht; Standard für Co-Trainer ohne Befunde/Kasse, Physio ohne Planung/Kasse; Rechte vergibt nur der Owner; App blendet Module ohne Recht aus (RLS-Test T40) | R27, R1 |
| Vertraulichkeit | Gerätespeicher: wartende Einträge je Konto (14 Tage), letzter Stand höchstens 2,5 MB und 14 Tage, beim Abmelden/Kontolöschen gelöscht; Hinweis auf Bildschirmsperre | R26 |
| Integrität | `entered_at`: Eingabezeitpunkt nie in der Zukunft, nie vor der Einheit, frühester bleibt; Automatik erlässt nur bei rechtzeitig belegter Eingabe (RLS-Test T39) | R30, R23 |
| Datenminimierung | Kasse: Spieler sehen nur eigene Beträge, Kassenstand nur bei Freigabe; Befreiungen in eigener Tabelle (nicht in den für alle lesbaren Einstellungen); keine Konto-/Kartendaten; Geldstrafen bei Jugend standardmäßig aus mit Warnhinweis; „RPE fehlt“ nie als Geldstrafe vorgeschlagen; Kassenwart ohne Gesundheitsdaten und ohne Befreiungen ändern (RLS-Test T41) | R28 |
| Transparenz | Schmerzangaben: Hinweise als Orientierung („abklären lassen“), keine Diagnose; Angaben freiwillig; Prüfung der Schlüssel und Größe in der Datenbank (RLS-Test T42) | R29 |
| Datenminimierung | Trainingseindruck nur für Ausreißer (`good`/`poor`, Durchschnitt wird nicht gespeichert), keine Rangliste; Kritik standardmäßig nicht für Spieler sichtbar (erst persönlich besprechen), Lob sichtbar; nur für Training (Check), höchstens 8 Gründe; Schreiben nur mit Recht „Notizen & Bewertungen“ (RLS-Test T43) | R31 |
| Vertraulichkeit | Weitere Einheiten (`day_units`): Spieler lesen nur Einheiten für alle und für eigene freigegebene Gruppen, nie Teilnehmerlisten; gelöschte Gruppe ⇒ niemand statt alle; RPE je Einheit mit denselben Regeln und derselben Einwilligung wie die übrige Belastung; Anwesenheit nur über das Mannschaftstraining; Sprünge der Torhüter freiwillig, Plausibilitätsgrenze 0–300 (RLS-Test T43) | R32 |
| Datenminimierung / Zugriffssteuerung | **Verein:** Zugriff eines Funktionärs nur auf zugewiesene Teams und nur über eine Zeile im Trainerteam (`club_sync`), damit dieselben Regeln wie für das Trainerteam gelten; Standardrechte ohne Gesundheitsdaten (`club_default_perms`), Hinweis in der App beim Vergeben; Vereinszeilen kann das Team nicht verändern, echte Mitgliedschaften haben Vorrang; Vereinsübersicht nur Kennzahlen je Team (keine Namen), Ausfälle/Beteiligung nur mit „Kader“; Hochziehen/Wechsel nur mit „Kader“ in beiden Teams, Belastung nur auf ausdrückliche Auswahl und mit „Gesundheitsdaten“ in beiden Teams, begrenzt auf 6 Wochen (je Tag zusammengefasst) bzw. 4 Wochen Morgen-Checks; Zugriffe enden sofort beim Entfernen, Niederlegen, Lösen des Teams oder Auflösen des Vereins (Trigger); Anfragen nur über Code und Bestätigung durch den Vereinsadmin; letzter Admin bleibt, Nachfolge bei Kontolöschung; Funktionen im Datenexport (v7) (RLS-Test T47) | R40 |
| Transparenz / Datenminimierung / Speicherbegrenzung | **Kaderplanung & Scouting:** eigenes Recht „scout“ (Standard: Owner und Rolle Trainer, im Verein sportliche Leitung und NLZ; nicht Physio und Koordination; vom Owner je Person abschaltbar), Modul abschaltbar, Spieler ohne jeden Zugriff (RLS); keine Gesundheits- und Fotofelder, Hinweis im Formular; Information nach Art. 14: Erinnerung nach 30 Tagen bzw. sofort bei Kontakt (Probetraining, Gespräche, Zusage), Hinweis in der Übersicht, Infotext und Auskunft (Art. 15) zum Teilen, Datum der Information; Löschung abgeschlossener Kandidaten nach 6 Monaten, übriger nach 24 Monaten ohne Aktivität (Merklisten löschen zählt nicht als Aktivität), Saisonplanungen ab der übernächsten Saison, Löschdatum im Profil sichtbar; Aufrücker nur mit Name, Position, Jahrgang, Team und nur bei passendem Jahrgang; Stand eigener Spieler nur im Trainerteam (wie Trainernotizen) (RLS-Test T48, T24) | R41 |
| Vertraulichkeit / Transparenz | **Matchplan:** nur Trainerteam liest die Tabelle; Spieler ausschließlich über `match_plan_open` (Modul an, freigegeben, im Zeitraum, ggf. nur Kader) und nur den freigegebenen Auszug; Aufgaben standardmäßig nur die eigene, Wechselplan standardmäßig nicht freigegeben, Hinweis in der App, Nicht-Nominierte vorher persönlich zu informieren; Zugriffsprotokoll nur Zeitpunkt/Plattform/erkannter Screenshot, höchstens ein Eintrag je 10 Minuten, nur fürs Trainerteam, für Spieler in der App erklärt und im Export, Löschung nach 6 Monaten; Wasserzeichen mit Name, Bildschirmschutz (Android gesperrt, iOS Aufnahmen geschwärzt) (RLS-Test T46, T24) | R39 |

### 6.2 Zusätzliche Maßnahmen (geplant)

Priorität: **P1** = vor Store-Start, **P2** = innerhalb von 3 Monaten, **P3** = danach.

| ID | Maßnahme | adressiert | Prio | verantwortlich | Status |
|---|---|---|---|---|---|
| M-1 | **Staff-Beitritt nur mit Bestätigung durch den Owner** (Status „ausstehend“ bis zur Freigabe), Benachrichtigung des Owners, Staff-Liste mit Entfernen-Funktion; Staff-Codes mit Ablaufdatum oder Einmalnutzung | R2 | P1 | [ ] | teilweise umgesetzt: Beitritt des Trainerteams erst nach Bestätigung durch den Owner (`approve_staff`/`reject_staff`, Status „ausstehend“), Entfernen, Codes erneuern (`regenerate_codes`); Ablaufdatum der Codes offen |
| M-2 | **Profil-Verknüpfung beim Beitritt durch Staff bestätigen lassen**; bis dahin sieht der Spieler keine zuvor erfassten Daten | R3 | P1 | [ ] | umgesetzt: keine automatische Verknüpfung; neues Profil mit Markierung „neu“, Zusammenführen nur durch das Trainerteam (`merge_players`) |
| M-3 | Automatisierte RLS-Tests in der CI (je Tabelle: Spieler A sieht nicht Spieler B, Spieler sieht keine `coach_notes`, Nicht-Mitglied sieht nichts); Prüfung „RLS aktiv auf allen Tabellen“ bei jeder Migration | R1 | P1 | [ ] | umgesetzt: `supabase/tests/rls_test.sql` (1.409 Prüfungen) bei jeder Änderung in der CI |
| M-4 | Einwilligung serverseitig erzwingen (Policy oder Trigger prüft gültige `health_data`- bzw. `parental`-Einwilligung vor Insert in Gesundheitstabellen); Widerrufsbildschirm; `withdrawn_at`; neue Arten `ai_coach`, `staff_confidentiality` | R8 | P1 | [ ] | umgesetzt: Trigger prüft Einwilligung vor Einträgen in Gesundheitstabellen; `withdrawn_at`; Arten `ai`, `staff_confidentiality`, `findings`; Widerruf im Konto |
| M-5 | Double-Opt-in für Eltern-Einwilligung (Bestätigungslink); Eltern-Adresse ≠ Konto-Adresse; erneute Bestätigung mit 16 | R8 | P1 | [ ] | offen |
| M-6 | Spieler ohne Konto: Trainer bestätigt vorliegende Offline-Einwilligung vor der ersten Eingabe von Gesundheitsdaten; ohne Bestätigung nur Abwesenheit „entschuldigt“ | R8 | P1 | [ ] | offen |
| M-7 | KI-Funktion filtert Kontext auf Spieler mit gültiger KI-Einwilligung; Vornamen durch Platzhalter ersetzen; Nutzlast dokumentieren | R6, R8 | P1 | [ ] | umgesetzt (10.11.2026): Kontext nur mit Vornamen eingewilligter Spieler, andere nur als Anzahl; ohne Vereins- und Teamnamen; Potenzial-Vorschläge nur mit Einwilligung und ohne Trainernotizen; Platzhalter statt Vornamen offen |
| M-8 | KI-Leitplanken im Systemprompt: keine Diagnosen, bei Schmerzen/Verletzung an Arzt verweisen, keine Gewichtsabnahme- oder Diätempfehlungen für Minderjährige, altersgerechte Sprache; Kennzeichnung als KI; Melde-Knopf für problematische Antworten; Testkatalog mit kritischen Fragen | R7 | P1 | [ ] | offen |
| M-9 | Verträge: AVV mit Supabase, DPA mit Anthropic und Expo; Transfermechanismus je Anbieter verifizieren; Aufbewahrung beim KI-Anbieter klären, Zero Data Retention anfragen; Region `inference_geo` bewusst wählen | R6 | P1 | [ ] | offen |
| M-10 | Storage: privater Bucket, Zugriff nur über RLS auf `storage.objects` und kurzlebige signierte URLs; EXIF-/GPS-Metadaten vor Upload entfernen (Neukodierung) | R11 | P1 | [ ] | umgesetzt: private Buckets, signierte Links (10–60 Minuten), Bilder werden neu kodiert (PDF unverändert) |
| M-11 | Löschroutinen (zeitgesteuerte Funktion): Gesundheitsdaten 24 Monate nach letzter Aktivität; inaktive Spieler nach [6] Monaten; Nachrichten [12] Monate nach Ablauf; Push-Token; KI-Zähler nach 30 Tagen | R9 | P1 | [ ] | umgesetzt (10.11.2026, M-39): Löschfristen siehe `docs/TOM.md` Abschnitt 4 |
| M-12 | Push-Texte generisch („Wie war das Training? Trag deine Belastung ein.“), keine Namen anderer Spieler, keine Gesundheitswerte | R10 | P1 | [ ] | umgesetzt: Erinnerungstexte ohne Namen und Werte, Chat-Push ohne Nachrichtentext |
| M-13 | Datenschutzbeauftragten benennen; Verzeichnis von Verarbeitungstätigkeiten (Art. 30); Prozess für Datenpannen (Meldung binnen 72 h, Art. 33/34); Prozess für Betroffenenanfragen | alle | P1 | [ ] | teilweise umgesetzt: `docs/VVT.md`, `docs/DATENPANNEN.md` (Datenpannen und Betroffenenanfragen), `docs/TOM.md`; Datenschutzbeauftragter offen |
| M-14 | Rollenmodell festlegen (Herausgeber allein / Verein mit AVV / gemeinsame Verantwortung) und Verträge mit Vereinen | R17 | P1 | [ ] | offen |
| M-15 | MFA (TOTP) für Staff-Konten anbieten, für Owner empfehlen; Mindestpasswortlänge; Prüfung gegen geleakte Passwörter [Tarif prüfen] | R4 | P2 | [ ] | teilweise umgesetzt: Mindestlänge 8 in App und `config.toml`; im Dashboard setzen, Schutz vor geleakten Passwörtern und Zwei-Faktor offen |
| M-16 | Ratenbegrenzung für `join_team`, `join_staff`, `team_by_join_code` und Anmeldung | R13, R2 | P2 | [ ] | offen |
| M-17 | Protokollierung von Staff-Zugriffen auf Gesundheitsdaten (Audit-Log), einsehbar für Owner | R5, R2 | P2 | [ ] | offen |
| M-18 | Feinere Rollen: Beschwerdedetails optional nur für Physio; Trainerteam-Leitfaden zur fairen Nutzung; für Spieler sichtbar „Das sieht dein Trainerteam“ | R5 | P2 | [ ] | teilweise umgesetzt (Rechte je Mitglied, Paket 11.2); Leitfaden und Spieleranzeige offen |
| M-26 | Abwesenheitsdetails (Notiz, Region) in eigene Tabelle mit Recht „Gesundheitsdaten“; bisher sieht das ganze Trainerteam Art, Stufe, Region und Notiz von Abwesenheiten | R27 | P2 | [ ] | offen |
| M-19 | Gesundheitsmodule für Kinderteams standardmäßig aus; Gewicht für unter 16 ausblenden; Mindestalter für eigene Konten festlegen | R5, R7, R18 | P1 | [ ] | offen |
| M-20 | Web: strikte Content Security Policy, keine Drittanbieter-Skripte, Hinweis zum Abmelden auf geteilten Geräten | R14 | P2 | [ ] | offen |
| M-21 | Backups/Point-in-Time-Recovery nach Tarif prüfen, Wiederherstellung testen; Migrationen nur mit Review | R15 | P2 | [ ] | offen |
| M-22 | Kennzahlen vorsichtig darstellen (ACWR als Orientierung, nicht als Verletzungsprognose); Zweckbestimmung schriftlich fixieren (siehe Abschnitt 9) | R16 | P1 | [ ] | offen |
| M-23 | Kinderfreundliches Onboarding (kurze Erklärung in einfacher Sprache vor den Einwilligungen) | R18 | P2 | [ ] | offen |
| M-24 | Externer Sicherheitstest (Penetrationstest, insbesondere RLS und RPCs) | R1 | P2 | [ ] | offen |
| M-25 | Konsultation der Betroffenen (Art. 35 Abs. 9): Rückmeldung von Pilotverein, Spielern und Eltern zu Einwilligungsablauf und Sichtbarkeit | R5, R18 | P2 | [ ] | offen |
| M-27 | Leitfaden Scouting für Vereine: Information der Spieler bzw. Eltern (wer informiert – Trainerteam oder Verein), sachliche Formulierungen in Berichten, keine Weitergabe von Bewertungen, eigene Spieler persönlich über die Planung informieren; prüfen, ob Status ab „Probetraining“ ohne eingetragene Information gesperrt werden soll | R41 | P2 | [ ] | offen |
| M-28 | Leitfaden Stärken-Runde für Trainerteams: Runde in der Mannschaft ankündigen und erklären (nur Positives, freiwillig), auf Spieler achten, die wenige Stärken erhalten, und deren Programm mit eigenen Stärken füllen; Ergebnisse nur im Einzelgespräch besprechen, nie vor der Mannschaft vergleichen | R42 | P2 | [ ] | offen |
| M-29 | Leitfaden Umfragen für Trainerteams: persönliche oder heikle Themen (Teamklima, Spielzeit, Trainer) nur anonym und mit Ergebnis fürs Trainerteam; in kleinen Gruppen keine anonymen Fragebögen zu persönlichen Themen; Ergebnisse nicht vor der Mannschaft einzelnen zuordnen; Spieler-Abstimmungen im Blick behalten und unpassende sofort löschen | R43 | P2 | [ ] | offen |
| M-30 | Leitfaden Notfallkontakte für Trainerteams: Kontakte vor der Saison und vor Fahrten aktualisieren lassen; Nummern nur für Notfälle nutzen (keine Elterngruppen, keine Werbung, keine Weitergabe); Hinweise für den Notfall nur mit Recht „Gesundheitsdaten“ einsehen und vertraulich behandeln; für Spieler ohne Konto Kontakte mit den Eltern abstimmen; Notfallablauf (112, Erste Hilfe, dann Kontakt anrufen) im Trainerteam besprechen | R44 | P2 | [ ] | offen |
| M-31 | Leitfaden Bestellungen für Trainerteams: Bestellliste nur an den Ausrüster bzw. die bestellende Person im Verein geben, nicht in Gruppen-Chats teilen; nach Abschluss der Bestellung löschen; Hinweise vor dem Weitergeben prüfen | R45 | P2 | [ ] | offen |
| M-32 | Leitfaden Kader-Nominierung für Trainerteams: Nicht-Nominierung persönlich besprechen (vor allem bei Jugendlichen), Kaderliste nur freigeben, wenn das im Team üblich ist; nach Absagegründen nicht nachfragen, Gesundheitsangaben nicht in der App sammeln; Absagen wegen Krankheit nie mit Druck beantworten | R46 | P2 | [ ] | offen |
| M-33 | Leitfaden Fahrgemeinschaften für Trainerteams und Eltern: Fahrten sind private Absprachen der Eltern (Haftung, Kindersitze, Versicherung klären – kein Rechtsrat durch die App); Kinder nur mit Wissen der Eltern zuordnen; keine Adressen oder Nummern in Fahrten, Absprachen im Chat; auf Spieler achten, die oft suchen, und Fahrten diskret organisieren | R47 | P2 | [ ] | offen |
| M-34 | Leitfaden Karten & Sperren für Trainerteams: Regeln zu Saisonbeginn mit dem Verband abgleichen (Spielordnung, Durchführungsbestimmungen, Jugendspielordnung) und in der App einstellen; Sperren im Zweifel beim Staffelleiter bestätigen lassen; im Hinweis nur das Nötige (z. B. „Urteil vom 12.11.: 3 Spiele“), keine Vorwürfe oder Zitate; Sperren nicht vor der Mannschaft thematisieren | R48 | P2 | [ ] | offen |
| M-35 | Leitfaden Foto-Erlaubnis für Vereine: Formular mit Kanälen und Namen (unter 14 Eltern, 14–17 Eltern und Spieler, ab 18 Spieler), Formular beim Verein aufbewahren, vor jedem Beitrag die Liste prüfen, Widerruf sofort umsetzen und Fotos auf Wunsch herunternehmen, keine Fotos ohne Erklärung | R49 | P2 | [ ] | offen |
| M-36 | Rechtliche Prüfung Unfallmeldungen: Rechtsgrundlage (Art. 9 Abs. 2 lit. f DSGVO oder Einwilligung), Information der Spieler bzw. Eltern, Löschfrist 36 Monate; Leitfaden für Trainerteams (nur Nötiges eintragen, keine Schuldzuweisungen, Meldeweg des Vereins) | R50 | P2 | [ ] | offen |
| M-37 | Leitfaden Eltern-Zugang für Trainerteams: Code nur direkt an die Eltern des Kindes geben (persönlich, nicht in Gruppen); Anfragen nur bestätigen, wenn die Person sicher sorgeberechtigt ist, im Zweifel nachfragen; bei Sorgerechtskonflikten oder Kontaktverboten keine Verknüpfung bzw. sofort lösen und die Kinderschutz-Ansprechperson des Vereins einbeziehen; Elterninfo ohne Angaben zu einzelnen Kindern, ohne Gesundheitsangaben | R51, R52 | P1 | [ ] | offen |
| M-38 | Rechtliche Prüfung Eltern-Zugang: Bestätigung durch das Trainerteam als „angemessene Anstrengung“ nach Art. 8 Abs. 2 DSGVO; gemeinsames Sorgerecht (§ 1629 BGB) bei Einwilligungen und Foto-Erlaubnis; Rechtsgrundlage für das Paket an die Eltern (Art. 6 Abs. 1 lit. f) und Widerspruchsmöglichkeit für 16- und 17-Jährige; Information in der Datenschutzerklärung (Abschnitt „Kurz erklärt – für Eltern“, 4.50) | R51, R52 | P1 | [ ] | offen |
| M-39 | **Löschkonzept automatisch:** Gesundheitsdaten 30 Tage nach Widerruf (auch durch Eltern bzw. Lösen der Verknüpfung), Befunde 30 Tage nach Widerruf der App-Einwilligung, Gesundheitsdaten und Befunde inaktiver Spieler nach 6 Monaten, inaktive Spielerprofile nach 24 Monaten, Teams ohne Nutzung und Konten ohne Rolle 24 Monate nach der letzten Nutzung (`profiles.last_seen_at`), Anwesenheit und Abwesenheiten nach 24 Monaten, Nachrichten 12 Monate nach Ablauf, Push-Token nach 6 Monaten (`purge_privacy`, `privacy-purge`) | R8, R9 | P1 | [ ] | umgesetzt (Migration `20261105000010`, Tests T62/T63) |
| M-40 | **Werkzeuge fürs Trainerteam:** Auskunft über alle Daten eines Spielers als Datei, auch ohne Konto und mit internen Notizen, ohne Konto-IDs anderer Personen, anonyme Umfrage-Antworten und Geber der Stärken-Runde (`player_data_export`, nur Owner; Test prüft, dass jede Tabelle mit Spielerbezug enthalten oder ausdrücklich ausgenommen ist); Gesundheitsdaten löschen nach Widerruf auf Papier (`staff_erase_health_data`, Recht „Gesundheitsdaten“) | R8, R9 | P1 | [ ] | umgesetzt |
| M-41 | **Absturzberichte:** E-Mail-Adressen, IDs, Telefonnummern und Codes in Fehlermeldungen vor dem Senden ersetzen (`scrubText`) | R6 | P2 | [ ] | umgesetzt |
| M-42 | **Datenminimierung beim Hochladen von Befunden:** Hinweis, Name, Anschrift, Geburtsdatum und Versicherungsnummer vorher abzudecken (gehen sonst bei der KI-Auswertung an den Anbieter) | R19, R20 | P2 | [ ] | umgesetzt (Hinweis); Schwärzen in der App offen |

---

## 7. Restrisiko (netto, nach Umsetzung der P1-Maßnahmen)

| ID | E | S | Restrisiko | Begründung |
|---|---|---|---|---|
| R1 | 2 | 4 | Risiko | RLS-Tests und Review reduzieren die Wahrscheinlichkeit; Schwere bleibt hoch |
| R2 | 1 | 4 | Risiko | Owner-Freigabe verhindert unbemerkten Beitritt |
| R3 | 1 | 3 | gering | Staff-Bestätigung der Verknüpfung |
| R4 | 2 | 3 | Risiko | nach M-15 (P2) weiter sinkend |
| R5 | 2 | 3 | Risiko | Freiwilligkeit technisch abgesichert; Restrisiko liegt im Verhalten des Trainerteams |
| R6 | 1 | 3 | gering | Einwilligung, reduzierter Kontext, Platzhalter, Verträge |
| R7 | 2 | 3 | Risiko | Leitplanken und Kennzeichnung; KI-Ausgaben bleiben nie vollständig kontrollierbar |
| R8 | 2 | 3 | Risiko | Double-Opt-in und serverseitige Durchsetzung; Altersangabe bleibt manipulierbar |
| R9 | 1 | 2 | gering | Löschroutinen |
| R10 | 1 | 2 | gering | generische Texte |
| R11 | 1 | 3 | gering | privater Bucket, Metadaten entfernt |
| R12 | 1 | 4 | Risiko | Jugend: Einzelchats nur mit dem Trainerteam und transparent, Melden; Kinderschutzkonzept liegt beim Verein |
| R13 | 1 | 2 | gering | – |
| R14 | 2 | 3 | Risiko | nach M-20 (P2) gering |
| R15 | 1 | 2 | gering | – |
| R16 | 1 | 3 | gering | vorsichtige Darstellung, Zweckbestimmung |
| R17 | 1 | 2 | gering | Rollenmodell festgelegt |
| R18 | 2 | 2 | Risiko | nach M-23 (P2) gering |
| R22 | 1 | 3 | gering | nur eigene Mitgliedschaft sichtbar, serverseitig durchgesetzt |
| R23 | 2 | 2 | gering | optional, nicht rückwirkend, nur mit Einwilligung, erlassbar; Restrisiko liegt im Umgang des Trainerteams (Leitfaden M-18) |
| R24 | 1 | 2 | gering | nur eigener Platz, Mindestanzahl, abschaltbar |
| R25 | 1 | 2 | gering | privater Bucket, Metadaten entfernt |
| R26 | 1 | 3 | gering | begrenzte Dauer/Größe, Löschung beim Abmelden; Restrisiko Gerät ohne Sperre |
| R27 | 1 | 3 | gering | Rechte je Person serverseitig, enge Standards |
| R28 | 1 | 2 | gering | nur eigene Beträge, Befreiungen getrennt, Jugend ohne Geld |
| R29 | 1 | 3 | gering | vorsichtige Formulierungen, Freiwilligkeit |
| R30 | 1 | 1 | gering | Plausibilitätsgrenzen in der Datenbank |
| R31 | 1 | 2 | gering | nur Ausreißer, Kritik standardmäßig verborgen, Leitfaden zur fairen Nutzung (M-18) |
| R32 | 1 | 2 | gering | keine Teilnehmerlisten, Einheiten verborgener Gruppen nicht für Spieler |
| R33 | 2 | 2 | gering | Melden mit Kopie, Moderation, Jugend ohne Chats nur unter Spielern; Restrisiko im Verhalten der Nutzer (Kinderschutzkonzept des Vereins) |
| R34 | 1 | 2 | gering | sichtbare Kennzeichnung, Senioren standardmäßig privat, nicht rückwirkend |
| R35 | 1 | 2 | gering | Push ohne Inhalt, Löschfristen, begrenzte lokale Kopie |
| R36 | 1 | 3 | gering | Freigabe durch das Trainerteam, interne Notiz getrennt, Recht „Notizen“ |
| R37 | 1 | 2 | gering | ohne Bestenliste als Standard, freiwillig, Sicherheitshinweis |
| R38 | 1 | 3 | gering | Transparenz im Trainerteam, Leitfaden (Vereinsgelände, Sechs-Augen-Prinzip) |
| R39 | 1 | 2 | gering | Freigabe nur ausgewählter Bereiche, Aufgaben nur die eigene, Hinweis zur persönlichen Information, Protokoll gedrosselt und befristet |
| R40 | 1 | 3 | gering | Zugriff nur zugewiesener Teams mit sparsamen Standardrechten (ohne Gesundheitsdaten), Kennzahlen ohne Namen, Übernahme der Belastung nur ausdrücklich und mit Recht in beiden Teams, sofortiges Ende der Zugriffe |
| R41 | 1 | 3 | gering | eigenes Recht, keine Gesundheitsdaten, Information nach Art. 14 mit Erinnerung, kurze Löschfristen, Aufrücker nur mit Minimaldaten; Leitfaden (M-27) senkt das Risiko unterlassener Information weiter |
| R42 | 1 | 2 | gering | nur Positives aus festem Katalog (kein Freitext, eigene Begriffe nur für das Trainerteam), keine Namen und keine Anzahl beim Empfänger, Auswahl durch das Trainerteam, Runde nur befristet durch das Trainerteam, Freigabe des Programms, Löschfrist 12 Monate; Restrisiko im Umgang (Leitfaden M-28) |
| R43 | 1 | 2 | gering | anonym ohne Namen, ohne „wer fehlt“ und erst ab drei Antworten, Freitexte nur fürs Trainerteam (anonym ohne Namen, nicht nach Eingang sortiert), feste Einstellungen nach der ersten Antwort, Spieler-Abstimmungen nur mit Freigabe, mit Namen und unter Aufsicht des Trainerteams, Löschfrist 12 Monate; Restrisiko Zuordnung durch Beobachten in sehr kleinen Gruppen (Leitfaden M-29) |
| R44 | 1 | 3 | gering | eigene Tabellen mit Zugriffsregeln (Kontakte: „Kader“ oder „Gesundheitsdaten“; Hinweise: nur „Gesundheitsdaten“), Hinweise nur mit Einwilligung, Pflicht beim Beitreten und Erinnerung, ohne Netz abrufbar; Restrisiko veraltete Nummern und zweckfremde Nutzung durch das Trainerteam (Leitfaden M-30) |
| R45 | 1 | 1 | gering | nur Größen und Beflockung, eigene Zugriffsregeln (Recht „Kader“), Liste ohne weitere Stammdaten; Restrisiko Weitergabe der exportierten Liste durch das Trainerteam (Leitfaden M-31) |
| R46 | 1 | 2 | gering | Nicht-Nominierte sehen nichts, Kaderliste nur bei Freigabe und ohne Antworten, Gründe freiwillig und nur fürs Trainerteam, Antworten des Trainerteams gekennzeichnet, Löschfrist 12 Monate; Restrisiko Druck im Team (Leitfaden M-32) |
| R47 | 1 | 2 | gering | nur Team-Mitglieder, Spieler sehen Vorname und Initial, Schreiben nur über geprüfte Funktionen, keine Adressen oder Nummern (Hinweis), automatische erneute Suche bei Ausfall, kurze Löschfristen; Restrisiko Rückschlüsse aus Mustern und Absprachen außerhalb der App (Leitfaden M-33) |
| R48 | 1 | 2 | gering | nur Trainerteam und der Spieler selbst, Schreiben nur mit Recht „Leistung & Statistik“, feste Werte und kurze Hinweise, einstellbare Regeln mit Hinweis auf den Verband, Urteile vorrangig, Löschfrist 24 Monate; Restrisiko falsch eingestellter Regeln (Leitfaden M-34) |
| R49 | 1 | 3 | gering | Erklärung je Kanal mit Alterslogik, „Nein“ des Spielers immer, Volljährige stimmen selbst zu, nur Trainerteam und der Spieler sehen sie; Restrisiko: Veröffentlichung geschieht außerhalb der App (Leitfaden M-35) |
| R50 | 1 | 3 | gering | nur Trainerteam mit Recht „Gesundheitsdaten“ und der Spieler, keine Übermittlung aus der App, Löschfrist 36 Monate; Restrisiko Freitexte (Leitfaden M-36) |
| R51 | 1 | 4 | Risiko | Code nur als Hash, kurz gültig, Fehlversuche begrenzt, Bestätigung durch das Trainerteam, Transparenz für das Kind, Lösen jederzeit (Trainerteam, Eltern, volljähriges Kind), Modul abschaltbar; Restrisiko Bestätigung ohne Prüfung und Konflikte in Familien (Leitfaden M-37) |
| R52 | 1 | 2 | gering | knappes Paket ohne Gesundheitsdetails, kein Tabellenzugriff, Ende mit Volljährigkeit, ab 16 entscheidet das Kind über Einwilligungen; Restrisiko Inhalte der Elterninfo (Hinweis, Leitfaden M-37) |

**Bewertung:** Nach Umsetzung aller P1-Maßnahmen verbleibt **kein hohes Restrisiko**. Eine vorherige Konsultation der
Aufsichtsbehörde nach Art. 36 DSGVO ist dann voraussichtlich nicht erforderlich.

**Ohne M-1, M-2, M-4 bis M-8** verbleiben hohe Risiken (R2, R5, R7, R8). In diesem Fall ist von einem Store-Start
abzuraten bzw. die Aufsichtsbehörde nach Art. 36 DSGVO zu konsultieren.

---

## 8. Offene Punkte

1. Rollenmodell (Herausgeber allein verantwortlich / Verein verantwortlich mit AVV / gemeinsame Verantwortlichkeit).
2. Datenschutzbeauftragter benennen und an DSFA beteiligen.
3. Mindestalter für eigene Konten; Gesundheitsmodule für Kinderteams; Umgang mit U7 (unter 7 Jahren
   geschäftsunfähig, § 104 BGB).
4. Wirksamkeit des Nutzungsvertrags mit Minderjährigen (§§ 106 ff. BGB), auch 16–17 Jahre.
5. Freiwilligkeit der Gesundheits-Einwilligung im Abhängigkeitsverhältnis; Einwilligung bei Registrierung optional
   oder Pflicht.
6. Anthropic: Vertragspartner, DPA, Transfermechanismus (DPF-Zertifizierung oder SCC), Aufbewahrung, Zero Data
   Retention, Wahl von `inference_geo`. Quellen: platform.claude.com/docs/en/manage-claude/api-and-data-retention und
   …/data-residency (Stand 10/2026 – vor Abschluss erneut prüfen).
7. Expo: DPA, Transfermechanismus; Supabase: Drittlandzugriffe, Unterauftragsverarbeiter, Backup- und Log-Dauer.
8. ~~Aufbewahrung von Einwilligungsnachweisen nach Kontolöschung~~ – gelöst: Nachweis bleibt ohne Konto-ID mit
   E-Mail-Hash; Dauer ([3] Jahre) bestätigen.
9. ~~Verhalten bei Löschung des letzten Staff-Kontos~~ – gelöst: Team wird gelöscht bzw. im Verein vom Vereinsadmin
   übernommen; ehemalige Spieler: Profile 24 Monate nach Deaktivierung gelöscht (M-39).
10. Abgrenzung Medizinprodukt (Abschnitt 9) und KI-Verordnung (Art. 50 Transparenz, Art. 4 KI-Kompetenz).
11. ~~Nutzlast der KI-Anfragen und Push-Texte verifizieren~~ – geprüft am 10.11.2026 (M-7, M-12); Datenschutzerklärung
    Abschnitt 11 angepasst.
12. E-Mail-Versanddienst und Webhoster festlegen und in DSFA aufnehmen.
13. Scouting: Verantwortlichkeit für die Daten externer Spieler (Verein oder Herausgeber) und wer die Information nach
    Art. 14 gibt; Abwägung bei Minderjährigen (Art. 6 Abs. 1 lit. f letzter Halbsatz).
14. Notfallkontakte: Information der Kontaktpersonen nach Art. 14 (Hinweis in der App an den Spieler und Abschnitt in
    der Datenschutzerklärung – Ausnahme Art. 14 Abs. 5 lit. b?); Pflichtangabe beim Beitreten und Kopplungsverbot
    (Art. 7 Abs. 4); Rechtsgrundlage im akuten Notfall (Art. 6 Abs. 1 lit. d, Art. 9 Abs. 2 lit. c).
15. Eltern-Zugang (M-38): Genügt die Bestätigung durch das Trainerteam für Art. 8 Abs. 2? Einwilligung eines
    Elternteils bei gemeinsamem Sorgerecht? Soll das Kind (16–17) dem Paket an die Eltern widersprechen können?
16. Löschfristen (M-39): 30 Tage nach Widerruf statt „unverzüglich“ (Zeit für versehentliche Widerrufe und Export),
    Löschung von Teams ohne Nutzung ohne vorherige Benachrichtigung (kein E-Mail-Versand eingerichtet) – rechtlich
    bestätigen lassen; bei Einrichtung eines E-Mail-Dienstes Hinweis vor der Löschung ergänzen.
17. Match-Analyse mit Videos (Konzept vom 10.11.2026): vor dem Bau DSFA erweitern (Videos Minderjähriger, Leistungs-
    bewertung, Gegner im Bild, GPU-Dienstleister).

---

## 9. Abgrenzung zum Medizinprodukt (zu prüfen)

Software ist nach Art. 2 Nr. 1 der Verordnung (EU) 2017/745 (MDR) ein Medizinprodukt, wenn sie vom Hersteller unter
anderem zur Diagnose, Verhütung, Überwachung, Vorhersage, Prognose, Behandlung oder Linderung von Krankheiten oder
von Verletzungen bestimmt ist. Maßgeblich ist die **Zweckbestimmung** des Herstellers, wie sie sich aus
Kennzeichnung, Gebrauchsanweisung, Werbung und Store-Texten ergibt (Orientierung: MDCG 2019-11).

**Beabsichtigte Zweckbestimmung (Entwurf):** Trainerbank ist ein Werkzeug zur Organisation von Training und
Spielbetrieb im Fußball und zur Steuerung der Trainingsbelastung gesunder Sportlerinnen und Sportler auf Grundlage
allgemeiner sportwissenschaftlicher Methoden. Die App ist nicht zur Diagnose, Überwachung, Vorhersage oder Behandlung
von Krankheiten oder Verletzungen bestimmt.

**Kritische Stellen:**

| Funktion | Risiko für Einstufung | Maßnahme |
|---|---|---|
| Befund-Zusammenfassung durch KI | „Diagnose“ bzw. Therapieempfehlung | Ausgabe als Zusammenfassung und Fragen an Arzt/Physio, fester Hinweis „keine medizinische Beratung – über die Rückkehr entscheidet das medizinische Personal“; Stufen setzt weiterhin das Trainerteam |
| Leistungstests, CMJ-Ermüdungscheck | „Überwachung“ des Gesundheitszustands | als Trainingssteuerung gesunder Sportler darstellen (Erholungszeit), keine Krankheitsaussagen |
| Rückkehr nach Verletzung (Stufen 1–4) | „Überwachung“ einer Verletzung | Stufen als organisatorischer Status, den das Trainerteam nach ärztlicher bzw. physiotherapeutischer Freigabe setzt; keine Ableitung von Stufen aus Daten |
| Ampel, ACWR | „Vorhersage/Prognose“ von Verletzungen | nicht als Verletzungsrisiko bezeichnen; als Belastungsorientierung darstellen |
| Beschwerden mit Körperregion | „Diagnose“ | keine Auswertung zu Krankheitsbildern; nur Weitergabe an das Trainerteam |
| KI-Coach | Diagnose- oder Therapieempfehlung im Einzelfall | Leitplanken (M-8), Hinweis „keine medizinische Beratung“ |
| Store- und Werbetexte | Zweckbestimmung durch Werbeaussagen | Formulierungsregeln in `docs/STORE.md` (keine Heil- oder Präventionsversprechen) |

Die Einstufung ist von einer regulatorisch erfahrenen Person zu bestätigen und schriftlich zu dokumentieren.

---

## 10. Ergebnis und Freigabe

| | |
|---|---|
| Ergebnis | [Verarbeitung kann nach Umsetzung der P1-Maßnahmen aufgenommen werden / nicht aufgenommen werden / Konsultation nach Art. 36] |
| Freigabe durch Verantwortlichen | [Name, Datum, Unterschrift] |

## 11. Stellungnahme des Datenschutzbeauftragten (Art. 35 Abs. 2)

[Text des DSB, Datum]

## 12. Standpunkt der Betroffenen (Art. 35 Abs. 9)

[Ergebnis der Rückmeldung von Pilotverein, Spielern und Eltern; oder Begründung, warum darauf verzichtet wurde]

## 13. Änderungshistorie

| Version | Datum | Änderung | Autor |
|---|---|---|---|
| 0.1 | [TT.MM.JJJJ] | Erstentwurf auf Basis ARCHITEKTUR.md | [ ] |
| 0.2 | [TT.MM.JJJJ] | Ergänzt: Spieldaten/Noten, Leistungstests, Befunde mit KI-Auswertung (R19, R20), Vorbereitung/Pausen, Kontaktliste (R21). Umgesetzte Maßnahmen: privater Bucket `findings` mit Pfad- und Zeilenprüfung, eigene Einwilligung `findings` (serverseitig geprüft), Löschung der Dateien bei Spieler-, Konto- und Teamlöschung, Export v2, Sichtbarkeit je Bereich im Baukasten | [ ] |
| 0.3 | [TT.MM.JJJJ] | Ergänzt: Gruppen mit Sichtbarkeit (R22), Aufgaben/Dienste/Strafen mit Automatik (R23), Platzierung in Tests (R24), Trainingstag mit Skizzen-Fotos (R25), Körperregionen bei Beschwerden und Verletzungen. Umgesetzte Maßnahmen: Gruppen-Sichtbarkeit nur eigene Mitgliedschaft (RLS), Automatik nur ab Einschalten und nur mit Gesundheits-Einwilligung, `my_test_ranks` ohne fremde Werte (ab 5), privater Bucket `sketches`, Export v3 | [ ] |
| 0.4 | [TT.MM.JJJJ] | Ergänzt: Offline-Einträge und lokale Kopie (R26, R30), Rechte je Mitglied (R27), Mannschaftskasse mit Kassenwart (R28), Körperkarte mit Schmerzangaben (R29). Umgesetzte Maßnahmen: `staff_can()` in allen Regeln, `entered_at` mit Plausibilitätsprüfung, `cash_entries`/`cash_waivers` mit eigenen Regeln, `complaint_details` geprüft, Export v4 | [ ] |
| 0.5 | [TT.MM.JJJJ] | Ergänzt: mehrere Einheiten am Tag mit RPE je Einheit und Sprüngen der Torhüter (R32), Trainingseindruck nur für Ausreißer (R31), Torwart-Spieldaten und -Tests. Umgesetzte Maßnahmen: `day_units` mit Gruppen-Sichtbarkeit, Anwesenheit nur über Einheit 0, Checks für Eindruck/Sprünge, `merge_players` v5 | [ ] |
| 0.6 | [TT.MM.JJJJ] | Ergänzt: Chat (R12 neu bewertet, R33–R35), Spielerentwicklung (R36), Wochenchallenge (R37), Individualtraining (R38). Umgesetzte Maßnahmen: Chat-Regeln je Altersklasse mit Mitlesen in Jugendteams, Melden mit Kopie, Push ohne Inhalt, Spam-Grenze, Löschfristen; interne Gesprächsnotiz getrennt, Freigabe von Einschätzungen/Protokollen, `challenge_totals` ohne Einzelwerte, Einheit nur für einzelne Spieler (`day_units.player_ids`), Export v5, `merge_players` v6 | [ ] |
| 0.7 | [TT.MM.JJJJ] | Ergänzt: Matchplan mit Freigabe für Spieler und Zugriffsprotokoll (R39). Umgesetzte Maßnahmen: kein direkter Spielerzugriff (nur `match_plan_open`), Freigabe nur ausgewählter Bereiche mit Zeitraum und „nur Kader“, Aufgaben nur die eigene, Protokoll gedrosselt und nach 6 Monaten gelöscht, Wasserzeichen und Bildschirmschutz, Export v6, `merge_players` v7 | [ ] |
| 0.8 | [TT.MM.JJJJ] | Ergänzt: Verein mit Funktionären, Vereinsübersicht, Hochziehen/Wechsel und Ankündigungen (R40). Umgesetzte Maßnahmen: Zugriff als gespiegelte Trainerteam-Zeile (`club_sync`, `team_staff_club_guard`), Standardrechte ohne Gesundheitsdaten, `club_overview` nur Kennzahlen, `club_move_player` mit Rechteprüfung in beiden Teams, Nachfolge des Vereinsadmins bei Kontolöschung, Export v7 | [ ] |
| 0.9 | [TT.MM.JJJJ] | Ergänzt: Kaderplanung & Scouting (Zweck 5b, Betroffene „beobachtete Spieler“, R41, M-27). Umgesetzte Maßnahmen: Recht „scout“, Tabellen nur für das Trainerteam mit diesem Recht, keine Gesundheits- und Fotofelder, Information nach Art. 14 mit Erinnerung, Infotext und Auskunft zum Teilen, Löschfristen 6/24 Monate und für Saisonplanungen, `club_risers` mit Minimaldaten (RLS-Test T48, T24) | [ ] |
| 1.0 | [TT.MM.JJJJ] | Ergänzt: Rückmeldungen aus der App (Tabelle `feedback`, privater Bucket `feedback`, Betreiber `app_admins`; Lesen nur eigene und Betreiber, Spam-Grenze 20 je Tag, Löschfrist 12 Monate nach Erledigung, Cascade bei Kontolöschung, RLS-Test T51), Absturzberichte über Sentry (nur nach Zustimmung auf dem Gerät, Speicherort EU, ohne Namen, E-Mail- und IP-Adressen, Gesundheitsdaten, Bildschirmfotos, Netzwerk- und Konsolendaten), App-Updates über EAS Update, Seite „Nutzung“ nur mit Teamzahlen ohne Namen, Export v8 | [ ] |
| 1.1 | [TT.MM.JJJJ] | Ergänzt: Entwicklungsprogramm mit Selbstanalyse und Stärken-Runde (R42, M-28), Pre-Assists in den Spieldaten. Umgesetzte Maßnahmen: Tabellen `dev_programs`, `dev_self`, `dev_peer_skills` mit eigenen Regeln (Recht „notes“, Freigabe, Schenkende sehen nur eigene Einträge), fester Stärken-Katalog ohne Freitext, befristete Runde (`settings.peer`, Recht „notes“), `peer_targets` mit Minimaldaten, Löschfrist 12 Monate, Export v9, `merge_players` v8 (RLS-Test T52) | [ ] |
| 1.2 | [TT.MM.JJJJ] | Ergänzt: Umfragen – Abstimmungen und Fragebögen, mit Namen oder anonym, für das Team oder eine Gruppe, Spieler-Abstimmungen nach Freigabe (R43, M-29). Umgesetzte Maßnahmen: Tabellen `polls` und `poll_answers` mit eigenen Regeln (Recht „messages“, Antworten liest nur der Spieler selbst), Ergebnisse nur über `poll_results` (anonym ab drei Antworten, ohne Namen und ohne „wer fehlt“, Freitexte nur fürs Trainerteam), feste Inhalte nach der ersten Antwort, `settings.polls` mit Recht „messages“, Löschfrist 12 Monate, Export v10, `merge_players` v9 (RLS-Test T53) | [ ] |
| 1.3 | [TT.MM.JJJJ] | Ergänzt: Notfallkontakte mit Hinweisen für den Notfall (Zweck 5c, Betroffene „Notfallkontakte“, R44, M-30, offener Punkt 14). Umgesetzte Maßnahmen: Tabellen `player_emergency` und `player_emergency_med` mit eigenen Regeln (Kontakte: Recht „squad“ oder „health“ lesen, „squad“ ändern; Hinweise nur „health“ und nur mit Einwilligung), Prüfung `emergency_contacts_ok`, Pflicht beim Beitreten, Export v11, `merge_players` v10 (RLS-Test T54) | [ ] |
| 1.4 | [TT.MM.JJJJ] | Ergänzt: Größen & Ausrüstung mit Bestellliste (Zweck 5d, R45, M-31). Umgesetzte Maßnahmen: Tabelle `player_sizes` mit festen Größenlisten und Bereichen, Lesen und Schreiben nur Spieler selbst und Recht „squad“, Modul `ausruestung`, CSV ohne Formel-Ausführung, Export v12, `merge_players` v11 (RLS-Test T55) | [ ] |
| 1.5 | [TT.MM.JJJJ] | Ergänzt: Kader-Nominierung fürs Spiel mit Zu- und Absagen (Zweck 5e, R46, M-32). Umgesetzte Maßnahmen: Tabellen `match_squads` und `match_nominations` (Schreiben Recht „plan“, Spieler nur eigene veröffentlichte Nominierung), `answer_nomination` mit Regeln (Einstellung `playerAbs`, bis Anpfiff), `squad_mates` mit Minimaldaten nur bei Freigabe, Löschfrist 12 Monate, Export v13, `merge_players` v12 (RLS-Test T56) | [ ] |
| 1.6 | [TT.MM.JJJJ] | Ergänzt: Fahrgemeinschaften zu Spielen und Terminen (Zweck 5f, R47, M-33). Umgesetzte Maßnahmen: Tabellen `rides`, `ride_seats`, `ride_needs` (lesen Team, schreiben nur über `ride_*`-Funktionen mit Regeln), Namen für Spieler nur mit Vorname und Initial (`ride_names`), automatische erneute Suche, Löschfristen (Tag danach bzw. 30 Tage), Export v14, `merge_players` v13 (RLS-Test T57) | [ ] |
| 1.7 | [TT.MM.JJJJ] | Ergänzt: Karten und Sperren (Zweck 5g, R48, M-34). Umgesetzte Maßnahmen: `match_stats.card`, Tabelle `player_suspensions` (lesen Trainerteam und Spieler selbst, schreiben Recht „perf“), Regeln in `settings.cards` mit Recht „perf“, Löschfrist 24 Monate, Export v15, `merge_players` v14 (RLS-Test T58) | [ ] |
| 1.8 | [TT.MM.JJJJ] | Ergänzt: Geburtstage, Foto-Erlaubnis und Unfallmeldungen (Zweck 5h, R49, R50, M-35, M-36). Umgesetzte Maßnahmen: `photo_consents` mit `photo_consent_save` (Trainerteam Recht „squad“, Spieler Nein immer, Ja ab 18), `accident_reports` (Recht „health“, Spieler lesen die eigenen, Löschfrist 36 Monate), Export v16, `merge_players` v15 (RLS-Tests T59, T60) | [ ] |
| 1.9 | [TT.MM.JJJJ] | Ergänzt: Eltern-Zugang (Zweck 5i, Betroffene Erziehungsberechtigte mit Konto, R51, R52, M-37, M-38, offener Punkt 15). Umgesetzte Maßnahmen: `player_guardians` mit Bestätigung durch das Trainerteam, `guardian_invites` (Code nur als Hash, 14 Tage, höchstens zwei), Fehlversuche begrenzt, Paket `guardian_child_data` statt Tabellenzugriff (Krankheit/Verletzung nur bei eigenen Abmeldungen), gekennzeichnete Einträge der Eltern, `guardian_sick_ok` (unter 16 Eltern, ab 16 Kind), Modul-Schalter serverseitig, Ende mit Volljährigkeit, Einwilligungen enden mit der Verknüpfung, Löschfristen (`purge_guardians`), RLS-Test T61 | [ ] |
| 1.10 | 10.11.2026 | Gesamtprüfung Datenschutz: Löschkonzept umgesetzt (M-11, M-39: Gesundheitsdaten und Befunde 30 Tage nach Widerruf, inaktive Spieler 6/24 Monate, Teams und Konten ohne Nutzung 24 Monate, Anwesenheit/Abwesenheiten 24 Monate, Nachrichten, Push-Token), Werkzeuge fürs Trainerteam (M-40: Auskunft je Spieler, Gesundheitsdaten löschen), KI-Kontext minimiert (M-7), Absturzberichte gefiltert (M-41), Hinweis beim Hochladen von Befunden (M-42); Status von M-1 bis M-4, M-10, M-12, M-13, M-15 nach Prüfung des Codes aktualisiert; neue Unterlagen `docs/VVT.md`, `docs/TOM.md`, `docs/DATENPANNEN.md`; offene Punkte 8, 9, 11 erledigt, 16 und 17 neu | [ ] |
