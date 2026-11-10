# Ablauf bei Datenpannen und bei Anfragen von Betroffenen – Trainerbank

> **ENTWURF – vor Verwendung durch den Datenschutzbeauftragten prüfen lassen.** Stand: 10.11.2026.
> Teil A gilt für Datenpannen (Art. 33 und 34 DSGVO), Teil B für Anfragen von Betroffenen (Art. 12 bis 22 DSGVO).
> Platzhalter in eckigen Klammern vor dem Store-Start ausfüllen.

## Teil A – Datenpannen

Eine Datenpanne ist jede Verletzung der Sicherheit, die dazu führt, dass personenbezogene Daten vernichtet, verloren,
verändert, unbefugt offengelegt oder unbefugt zugänglich werden. Beispiele für Trainerbank: ein geleakter
Service-Schlüssel, eine fehlerhafte Zugriffsregel, durch die ein Team Daten eines anderen sieht, ein verlorenes Gerät
eines Trainers mit angemeldeter App, ein falsch versandter Export, eine Panne bei einem Auftragsverarbeiter.

### A1. Erkennen und intern melden (sofort)

- Wer etwas bemerkt, meldet es **sofort** an [Name, Telefon, E-Mail] und den Datenschutzbeauftragten [Kontakt] –
  auch nur bei Verdacht. Hinweise kommen z. B. über Rückmeldungen in der App, Support-E-Mails, Meldungen von Supabase,
  Expo, Sentry oder Anthropic, GitHub-Sicherheitswarnungen.
- Uhrzeit des Bekanntwerdens festhalten: Ab dann laufen die **72 Stunden** für die Meldung an die Aufsichtsbehörde.

### A2. Eindämmen (in den ersten Stunden)

| Lage | Sofortmaßnahme |
|---|---|
| Schlüssel geleakt (Supabase Secret/Service, Anthropic, Expo, Sentry, `CRON_SECRET`) | Schlüssel beim Anbieter widerrufen und neu erzeugen; neu **nur** in GitHub-Secrets, Expo bzw. Supabase-Vault eintragen; Edge Functions neu ausrollen |
| Fehlerhafte Zugriffsregel | Funktion bzw. Modul abschalten (Modul-Schalter oder Rücknahme der Migration), Korrektur mit Test, dann wieder einschalten |
| Konto übernommen | Konto sperren (Supabase → Authentication), Sitzungen beenden, Passwort zurücksetzen lassen; bei Trainerkonto Rechte im Team entziehen |
| Gerät verloren | Abmelden auf allen Geräten veranlassen (Passwort ändern), Konto ggf. vorübergehend sperren |
| Panne beim Auftragsverarbeiter | Informationen anfordern (Art. 33 Abs. 2), betroffene Funktion bis zur Klärung abschalten (z. B. KI-Coach) |

Spuren sichern (Protokolle aus Supabase, Zeitpunkte, betroffene Tabellen und Teams), bevor etwas gelöscht wird.

### A3. Bewerten (bis spätestens 48 Stunden)

- Welche Daten, wie viele Personen, welche Teams? Sind **Gesundheitsdaten** oder Daten von **Minderjährigen**
  betroffen? Waren die Daten verschlüsselt oder nur kurz zugänglich? Wer hatte Zugriff?
- Risiko einschätzen (Methode wie DSFA Abschnitt 4):
  - **kein Risiko** (z. B. Zugriff nur durch eigenes Trainerteam, sofort behoben): dokumentieren, keine Meldung;
  - **Risiko**: Meldung an die Aufsichtsbehörde;
  - **hohes Risiko** (z. B. Gesundheitsdaten Minderjähriger an Unbefugte): Meldung **und** Benachrichtigung der
    Betroffenen. Bei Gesundheitsdaten und Kindern ist im Zweifel von hohem Risiko auszugehen.

### A4. Melden an die Aufsichtsbehörde (innerhalb von 72 Stunden)

- Zuständig: Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW) – Meldung über
  das Formular auf der Website der LDI [Link vor dem Store-Start heraussuchen und hier eintragen]. Bei anderem Sitz
  des Verantwortlichen die dortige Behörde.
- Inhalt (Art. 33 Abs. 3): Art der Panne, Kategorien und ungefähre Zahl der Betroffenen und Datensätze, Kontakt des
  Datenschutzbeauftragten, wahrscheinliche Folgen, ergriffene und geplante Maßnahmen.
- Unvollständige Informationen trotzdem fristgerecht melden und nachreichen (Art. 33 Abs. 4); eine verspätete
  Meldung begründen.

### A5. Betroffene benachrichtigen (bei hohem Risiko, unverzüglich)

- In klarer, einfacher Sprache (Art. 34 Abs. 2): was passiert ist, welche Daten, mögliche Folgen, was wir tun, was
  sie tun können (z. B. Passwort ändern), Kontakt.
- Weg: E-Mail an die Konten; für Spieler ohne Konto über das Trainerteam bzw. den Verein; bei Minderjährigen an die
  Eltern. Ist das unverhältnismäßig aufwendig, öffentliche Bekanntmachung (Art. 34 Abs. 3 lit. c).
- Betroffene Teams (Owner) zusätzlich informieren, damit sie Spieler und Eltern erreichen.

### A6. Dokumentieren und nacharbeiten (immer, auch ohne Meldung)

Jede Panne wird festgehalten (Art. 33 Abs. 5):

| Datum, Uhrzeit bekannt geworden | Was ist passiert | Betroffene Daten und Personen | Risiko | gemeldet an LDI (wann) | Betroffene benachrichtigt (wann, wie) | Maßnahmen | Ursache und Vorbeugung |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Danach: Ursache beheben, automatischen Test ergänzen, DSFA und TOM bei Bedarf anpassen.

## Teil B – Anfragen von Betroffenen

### B1. Allgemein

- Eingang: Support-E-Mail [Adresse], Rückmeldung in der App, über das Trainerteam oder den Verein. Eingang mit Datum
  festhalten.
- Frist: **ein Monat**, bei Komplexität um zwei Monate verlängerbar – dann innerhalb des ersten Monats mit Begründung
  mitteilen (Art. 12 Abs. 3). Kostenlos.
- Identität prüfen: Anfrage aus dem eigenen Konto oder Rückmeldung an die im Konto hinterlegte E-Mail-Adresse. Für
  Kinder unter 16 handeln die Eltern; Jugendliche ab 16 können ihre Rechte selbst ausüben.
- Jede Anfrage mit Datum, Inhalt, Antwort und Erledigung dokumentieren (Nachweis, [3] Jahre).

### B2. Je Recht

| Recht | So erfüllen wir es |
|---|---|
| Auskunft (Art. 15), Datenübertragbarkeit (Art. 20) | Spieler mit Konto: „Konto → Meine Daten exportieren“ (JSON). Spieler ohne Konto oder vollständige Auskunft mit internen Notizen: Der Owner des Teams erstellt sie im Spielerprofil → Datenschutz → „Auskunft erstellen“. Vor der Herausgabe Angaben über andere Personen in Freitexten schwärzen (Art. 15 Abs. 4). Dateien (Foto, Befunde) bei Bedarf einzeln beilegen. Zusätzlich die Informationen nach Art. 15 Abs. 1 (Zwecke, Empfänger, Dauer, Rechte) – sie stehen in der Datenschutzerklärung. |
| Berichtigung (Art. 16) | Spieler korrigieren eigene Angaben in der App; alles andere korrigiert das Trainerteam; Eltern ihre Angaben im Eltern-Zugang. |
| Löschung (Art. 17) | Konto löschen in der App (löscht Spielerprofil und Gesundheitsdaten). Widerruf in der App löscht Gesundheitsdaten und Befunde nach 30 Tagen automatisch. Widerruf auf Papier oder Löschwunsch eines Spielers ohne Konto: Trainerteam → Spielerprofil → Datenschutz → „Gesundheitsdaten löschen“ bzw. Spieler löschen. |
| Einschränkung (Art. 18) | Trainerteam setzt den Spieler auf inaktiv (der Eltern-Zugang ruht); die Daten bleiben bis zur Klärung unverändert. Achtung: Nach 6 Monaten Inaktivität löscht Trainerbank die Gesundheitsdaten – bei längerer Klärung vorher sichern (Auskunft erstellen). |
| Widerspruch (Art. 21) | bei Verarbeitung auf Grundlage berechtigter Interessen (z. B. Scouting, Notfallkontakte): Einzelfall prüfen; Scouting-Einträge löscht das Trainerteam auf Verlangen. |
| Widerruf einer Einwilligung (Art. 7 Abs. 3) | in der App unter Konto → Einwilligungen bzw. im Eltern-Zugang; Folgen stehen im Bestätigungsblatt. |
| Beschwerde (Art. 77) | Hinweis auf die Aufsichtsbehörde steht in der Datenschutzerklärung. |

### B3. Anfragen über das Trainerteam

Bitten Spieler oder Eltern das Trainerteam um Auskunft oder Löschung, erledigt der Owner das mit den Werkzeugen oben
und meldet es an [Support-E-Mail], damit die Frist und die Erledigung dokumentiert sind.
