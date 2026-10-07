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
6. Erinnerungen per Push-Mitteilung.
7. Betrieb, Sicherheit, Missbrauchsbegrenzung, Nachweis von Einwilligungen.

### 2.2 Betroffene

| Gruppe | Alter | geschätzte Anzahl |
|---|---|---|
| Trainerteam (Owner, Coach, Physio) | Erwachsene | [Anzahl] |
| Spieler mit Konto | ab [Mindestalter] bis Erwachsene, Schwerpunkt 14–18 | [Anzahl] |
| Spieler ohne Konto | ab ca. 7 Jahren (U7 ggf. jünger) | [Anzahl] |
| Erziehungsberechtigte | Erwachsene | [Anzahl] (nur E-Mail-Adresse) |

### 2.3 Datenkategorien

Siehe Tabelle in `docs/DATENSCHUTZERKLAERUNG.md`, Abschnitt 4. Zusammengefasst:

- **Kontodaten:** E-Mail, Passwort-Hash, Anzeigename, Sprache.
- **Stammdaten:** Name, Geburtsdatum, Position, Rückennummer, optional Gewicht und Foto.
- **Teamdaten:** Verein, Team, Kalender, Wochenpläne, Einheiten, Einstellungen.
- **Anwesenheit und Abwesenheiten** (inkl. Krankheit/Verletzung, Rückkehrstufe, Notiz).
- **Gesundheitsdaten (Art. 9):** RPE und Minuten, Wohlbefinden (Schlaf, Müdigkeit, Muskelkater, Stress,
  Beschwerden mit Körperregion), Zusatzsport, Größe, Gewicht, berechnete Kennzahlen.
- **Freitexte:** Trainernotizen, Potenziale, Nachrichten, Abwesenheitsnotizen, KI-Anfragen.
- **Technische Daten:** Push-Token, KI-Nutzungszähler, Server-Protokolle.
- **Einwilligungsnachweise** inkl. E-Mail der Erziehungsberechtigten.

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
   ├─ Storage (Profilfotos)
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

Die Rollen Owner, Coach und Physio haben laut Architektur dieselben Datenrechte; nur `regenerate_codes` ist dem
Owner vorbehalten.

### 2.6 Auftragsverarbeiter und Empfänger

| Empfänger | Funktion | Ort | Status |
|---|---|---|---|
| Supabase | Datenbank, Auth, Storage, Edge Functions | Frankfurt (EU); Drittlandzugriffe zu prüfen | AVV [prüfen/abschließen] |
| Anthropic | Claude API für KI-Coach | USA (laut Anbieterdokumentation Stand 10/2026 Inferenz nur „us“ oder „global“ wählbar) | DPA, Transfermechanismus, Aufbewahrung, ZDR [prüfen] |
| Expo (650 Industries, Inc.) | Push-Versand | USA | DPA, Transfermechanismus [prüfen] |
| Apple, Google | Push-Zustellung, App Stores | [prüfen] | Rolle [prüfen] |
| [E-Mail-Versand], [Webhoster] | E-Mails, Web-Auslieferung | [Ort] | [prüfen] |

### 2.7 Speicherdauer

Vorschlag siehe `docs/DATENSCHUTZERKLAERUNG.md`, Abschnitt 16 (u. a. Gesundheitsdaten: sofort bei Kontolöschung oder
Widerruf, sonst 24 Monate nach letzter Aktivität). **Automatische Löschroutinen sind noch nicht umgesetzt.**

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

### 3.2 Zweckbindung

- Keine Werbung, kein Tracking, keine Analyse-SDKs von Drittanbietern, kein Verkauf.
- Daten sind nach Teams getrennt; kein teamübergreifender Zugriff.
- Keine Verwendung für andere Zwecke (z. B. Scouting durch Dritte, Forschung) ohne neue Rechtsgrundlage.
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

Weitere Minimierung: Infotiefe und Module sind je Team konfigurierbar (`teams.depth`, `teams.modules`). **Zu
prüfen:** ob Gesundheitsmodule für Kinderteams (z. B. U7–U11) standardmäßig deaktiviert sind. Empfehlung: ja.

### 3.4 Speicherbegrenzung, Richtigkeit, Transparenz, Betroffenenrechte

- Speicherbegrenzung: Löschkonzept vorgeschlagen; Umsetzung offen (siehe M-11).
- Richtigkeit: Eingabebereiche per Datenbank-Constraint begrenzt (RPE 0–10, Minuten 1–300, Wellness 1–7, Schlaf
  0–16 h); Spieler können eigene Daten einsehen; Korrektur durch Spieler bzw. Trainerteam.
- Transparenz: Datenschutzerklärung mit Kurzfassung für Kinder, Einwilligungstexte mit Kurz- und Langfassung,
  Kennzeichnung von KI-Antworten, Info-Texte mit wissenschaftlichen Quellen.
- Betroffenenrechte: Export (JSON) und Kontolöschung in der App; Widerruf in der App [umzusetzen]; Auskunft und
  Widerspruch per E-Mail.

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
| R12 | Missbrauch des Nachrichtenkanals Erwachsener → Minderjährige | Kinder, Jugendliche | Kinderschutz (Grooming) | 1 | 4 | Risiko |
| R13 | Erraten oder Ausprobieren von Team-Codes (Enumeration über `team_by_join_code`, `join_team`) | Teams | Einsicht in Kalender (Trainings- und Spielzeiten von Kindern) | 1 | 3 | gering |
| R14 | Web-Version: Sitzungstoken im Browser-Speicher (XSS, gemeinsam genutzte Rechner) | Web-Nutzer | Kontoübernahme | 2 | 3 | Risiko |
| R15 | Datenverlust oder Nichtverfügbarkeit (Ausfall, Fehlbedienung, fehlerhafte Migration) | alle | Verlust der Trainingshistorie, fehlende Information bei Rückkehr nach Verletzung | 2 | 2 | Risiko |
| R16 | Fehlinterpretation von Kennzahlen (z. B. ACWR als Verletzungsprognose, obwohl wissenschaftlich umstritten) oder falsche Eingaben | Spieler | Über- oder Unterbelastung, Verletzung | 2 | 3 | Risiko |
| R17 | Unklare Verantwortlichkeit (Herausgeber vs. Verein) | alle | erschwerte Durchsetzung von Betroffenenrechten | 3 | 2 | Risiko |
| R18 | Mangelnde Verständlichkeit für Kinder | Kinder | Einwilligung ohne Verständnis | 3 | 2 | Risiko |

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
| Kinderschutz | Nachrichten nur vom Staff an einzelne Spieler, strukturierte Typen; kein Chat zwischen Spielern; alle Staff-Mitglieder sehen alle Nachrichten | R12 |

### 6.2 Zusätzliche Maßnahmen (geplant)

Priorität: **P1** = vor Store-Start, **P2** = innerhalb von 3 Monaten, **P3** = danach.

| ID | Maßnahme | adressiert | Prio | verantwortlich | Status |
|---|---|---|---|---|---|
| M-1 | **Staff-Beitritt nur mit Bestätigung durch den Owner** (Status „ausstehend“ bis zur Freigabe), Benachrichtigung des Owners, Staff-Liste mit Entfernen-Funktion; Staff-Codes mit Ablaufdatum oder Einmalnutzung | R2 | P1 | [ ] | offen |
| M-2 | **Profil-Verknüpfung beim Beitritt durch Staff bestätigen lassen**; bis dahin sieht der Spieler keine zuvor erfassten Daten | R3 | P1 | [ ] | offen |
| M-3 | Automatisierte RLS-Tests in der CI (je Tabelle: Spieler A sieht nicht Spieler B, Spieler sieht keine `coach_notes`, Nicht-Mitglied sieht nichts); Prüfung „RLS aktiv auf allen Tabellen“ bei jeder Migration | R1 | P1 | [ ] | offen |
| M-4 | Einwilligung serverseitig erzwingen (Policy oder Trigger prüft gültige `health_data`- bzw. `parental`-Einwilligung vor Insert in Gesundheitstabellen); Widerrufsbildschirm; `withdrawn_at`; neue Arten `ai_coach`, `staff_confidentiality` | R8 | P1 | [ ] | offen |
| M-5 | Double-Opt-in für Eltern-Einwilligung (Bestätigungslink); Eltern-Adresse ≠ Konto-Adresse; erneute Bestätigung mit 16 | R8 | P1 | [ ] | offen |
| M-6 | Spieler ohne Konto: Trainer bestätigt vorliegende Offline-Einwilligung vor der ersten Eingabe von Gesundheitsdaten; ohne Bestätigung nur Abwesenheit „entschuldigt“ | R8 | P1 | [ ] | offen |
| M-7 | KI-Funktion filtert Kontext auf Spieler mit gültiger KI-Einwilligung; Vornamen durch Platzhalter ersetzen; Nutzlast dokumentieren | R6, R8 | P1 | [ ] | offen |
| M-8 | KI-Leitplanken im Systemprompt: keine Diagnosen, bei Schmerzen/Verletzung an Arzt verweisen, keine Gewichtsabnahme- oder Diätempfehlungen für Minderjährige, altersgerechte Sprache; Kennzeichnung als KI; Melde-Knopf für problematische Antworten; Testkatalog mit kritischen Fragen | R7 | P1 | [ ] | offen |
| M-9 | Verträge: AVV mit Supabase, DPA mit Anthropic und Expo; Transfermechanismus je Anbieter verifizieren; Aufbewahrung beim KI-Anbieter klären, Zero Data Retention anfragen; Region `inference_geo` bewusst wählen | R6 | P1 | [ ] | offen |
| M-10 | Storage: privater Bucket, Zugriff nur über RLS auf `storage.objects` und kurzlebige signierte URLs; EXIF-/GPS-Metadaten vor Upload entfernen (Neukodierung) | R11 | P1 | [ ] | offen |
| M-11 | Löschroutinen (zeitgesteuerte Funktion): Gesundheitsdaten 24 Monate nach letzter Aktivität; inaktive Spieler nach [6] Monaten; Nachrichten [12] Monate nach Ablauf; Push-Token; KI-Zähler nach 30 Tagen | R9 | P1 | [ ] | offen |
| M-12 | Push-Texte generisch („Wie war das Training? Trag deine Belastung ein.“), keine Namen anderer Spieler, keine Gesundheitswerte | R10 | P1 | [ ] | zu prüfen |
| M-13 | Datenschutzbeauftragten benennen; Verzeichnis von Verarbeitungstätigkeiten (Art. 30); Prozess für Datenpannen (Meldung binnen 72 h, Art. 33/34); Prozess für Betroffenenanfragen | alle | P1 | [ ] | offen |
| M-14 | Rollenmodell festlegen (Herausgeber allein / Verein mit AVV / gemeinsame Verantwortung) und Verträge mit Vereinen | R17 | P1 | [ ] | offen |
| M-15 | MFA (TOTP) für Staff-Konten anbieten, für Owner empfehlen; Mindestpasswortlänge; Prüfung gegen geleakte Passwörter [Tarif prüfen] | R4 | P2 | [ ] | offen |
| M-16 | Ratenbegrenzung für `join_team`, `join_staff`, `team_by_join_code` und Anmeldung | R13, R2 | P2 | [ ] | offen |
| M-17 | Protokollierung von Staff-Zugriffen auf Gesundheitsdaten (Audit-Log), einsehbar für Owner | R5, R2 | P2 | [ ] | offen |
| M-18 | Feinere Rollen: Beschwerdedetails optional nur für Physio; Trainerteam-Leitfaden zur fairen Nutzung; für Spieler sichtbar „Das sieht dein Trainerteam“ | R5 | P2 | [ ] | offen |
| M-19 | Gesundheitsmodule für Kinderteams standardmäßig aus; Gewicht für unter 16 ausblenden; Mindestalter für eigene Konten festlegen | R5, R7, R18 | P1 | [ ] | offen |
| M-20 | Web: strikte Content Security Policy, keine Drittanbieter-Skripte, Hinweis zum Abmelden auf geteilten Geräten | R14 | P2 | [ ] | offen |
| M-21 | Backups/Point-in-Time-Recovery nach Tarif prüfen, Wiederherstellung testen; Migrationen nur mit Review | R15 | P2 | [ ] | offen |
| M-22 | Kennzahlen vorsichtig darstellen (ACWR als Orientierung, nicht als Verletzungsprognose); Zweckbestimmung schriftlich fixieren (siehe Abschnitt 9) | R16 | P1 | [ ] | offen |
| M-23 | Kinderfreundliches Onboarding (kurze Erklärung in einfacher Sprache vor den Einwilligungen) | R18 | P2 | [ ] | offen |
| M-24 | Externer Sicherheitstest (Penetrationstest, insbesondere RLS und RPCs) | R1 | P2 | [ ] | offen |
| M-25 | Konsultation der Betroffenen (Art. 35 Abs. 9): Rückmeldung von Pilotverein, Spielern und Eltern zu Einwilligungsablauf und Sichtbarkeit | R5, R18 | P2 | [ ] | offen |

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
| R12 | 1 | 4 | Risiko | strukturierter, für Staff transparenter Kanal; Kinderschutzkonzept liegt beim Verein |
| R13 | 1 | 2 | gering | – |
| R14 | 2 | 3 | Risiko | nach M-20 (P2) gering |
| R15 | 1 | 2 | gering | – |
| R16 | 1 | 3 | gering | vorsichtige Darstellung, Zweckbestimmung |
| R17 | 1 | 2 | gering | Rollenmodell festgelegt |
| R18 | 2 | 2 | Risiko | nach M-23 (P2) gering |

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
8. Aufbewahrung von Einwilligungsnachweisen nach Kontolöschung (Cascade vs. Nachweispflicht).
9. Verhalten bei Löschung des letzten Staff-Kontos eines Teams; Verbleib der Daten ehemaliger Spieler.
10. Abgrenzung Medizinprodukt (Abschnitt 9) und KI-Verordnung (Art. 50 Transparenz, Art. 4 KI-Kompetenz).
11. Tatsächliche Nutzlast der KI-Anfragen und Push-Texte im Code verifizieren.
12. E-Mail-Versanddienst und Webhoster festlegen und in DSFA aufnehmen.

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
