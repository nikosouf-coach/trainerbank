# Datenschutzerklärung – Trainerbank

> **ENTWURF – vor Veröffentlichung anwaltlich prüfen lassen.**
> Dieser Text ist eine Arbeitsvorlage und ersetzt keine Rechtsberatung. Er darf erst veröffentlicht werden, wenn die
> Platzhalter ersetzt, die Prüfhinweise abgearbeitet und die Angaben mit der tatsächlich ausgelieferten App abgeglichen sind.

| | |
|---|---|
| Stand | [TT.MM.JJJJ] |
| Version | [privacy-1.0] – muss mit `consents.version` für `kind = 'privacy'` übereinstimmen |
| Geltungsbereich | App „Trainerbank“ für iOS, Android und Web sowie die Website [Website-URL] |
| Abrufbar unter | [Datenschutz-URL] und in der App unter [Pfad, z. B. „Mehr → Datenschutz“ bzw. „Ich → Datenschutz“] |

### Hinweise zur Bearbeitung (vor Veröffentlichung entfernen)

- Alle Angaben in eckigen Klammern sind Platzhalter.
- Absätze, die mit **Prüfhinweis** beginnen, sind interne Hinweise für die rechtliche Prüfung. Sie werden vor der
  Veröffentlichung gelöscht.
- Anrede: Der Text duzt, weil sich die App auch an Kinder und Jugendliche richtet (Art. 12 Abs. 1 DSGVO verlangt eine
  für Kinder verständliche Sprache). Bei Bedarf einheitlich auf „Sie“ umstellen. Texte, die sich an Eltern richten,
  siezen.
- Grundlage ist der Stand von `docs/ARCHITEKTUR.md`. Vor der Veröffentlichung sind insbesondere die Abschnitte 11 (KI-Coach),
  12 (Push), 16 (Speicherdauer) und 18 (Sicherheit) mit der echten Implementierung abzugleichen.

---

## Kurz erklärt – für Spielerinnen und Spieler

- Trainerbank hilft deinem Trainerteam, Training, Spiele und eure Belastung zu planen. Du kannst selbst eintragen,
  wie anstrengend ein Training war und wie du dich morgens fühlst.
- Angaben dazu, wie es dir körperlich geht (z. B. Belastung, Schlaf, Muskelkater, Beschwerden, Verletzungen), sind
  **Gesundheitsdaten**. Die speichern wir nur, wenn du ausdrücklich zustimmst. Bist du jünger als 16, müssen deine
  Eltern zustimmen.
- **Du siehst nur deine eigenen Daten.** Deine Mitspieler sehen deine Daten nicht. Dein Trainerteam (Trainer,
  Co-Trainer, Physio) sieht die Daten aller Spieler im Team. Bei Leistungstests siehst du höchstens deinen eigenen
  Platz – nie die Werte oder Namen anderer.
- **Chat:** Was du im Chat schreibst, sehen die Mitglieder des jeweiligen Chats (z. B. im Teamchat dein Team) mit
  deinem Vornamen und dem ersten Buchstaben deines Nachnamens. Telefonnummern werden nicht gebraucht. In Jugendteams
  gibt es Einzelchats nur mit dem Trainerteam, und das Trainerteam kann sie mitlesen (Kinderschutz). Push-Mitteilungen
  zeigen nie den Text. Unpassende Nachrichten kannst du melden.
- **Entwicklung:** Deine Selbsteinschätzung und deine eigenen Ziele sieht dein Trainerteam. Einschätzungen und
  Gesprächsprotokolle des Trainerteams siehst du, wenn es sie freigibt.
- **Matchplan:** Gibt dein Trainerteam einen Matchplan frei, kannst du ihn bis Spielende ansehen. Er ist vertraulich:
  Er wird mit deinem Namen als Wasserzeichen angezeigt, und es wird festgehalten, wann du ihn geöffnet hast (und ob
  ein Screenshot erkannt wurde). Das Protokoll wird nach 6 Monaten gelöscht.
- **Verein:** Ist dein Team mit deinem Verein verbunden, können Funktionäre des Vereins (z. B. Jugendleitung) dein Team
  mit den Rechten sehen, die der Vereinsadmin ihnen gibt – deine Gesundheitsdaten nur, wenn ihnen das ausdrücklich
  erlaubt wurde. In der Vereinsübersicht stehen nur Zahlen je Team, keine Namen. Wirst du in ein anderes Team des
  Vereins hochgezogen oder wechselst du, kann das Trainerteam deine Belastung der letzten Wochen mitnehmen, damit du im
  neuen Team nicht überlastet wirst.
- **Kaderplanung:** Für die nächste Saison kann dein Trainerteam festhalten, wie es mit dir plant (z. B. fest,
  Perspektive, unsicher) – das sieht nur das Trainerteam, wie eine Trainernotiz. Trainerteams älterer Teams deines
  Vereins sehen dich als möglichen Aufrücker nur mit Name, Position, Jahrgang und Team. Spieler anderer Teams oder
  Vereine, die ein Trainerteam beobachtet (Scouting), werden darüber informiert; Gesundheitsdaten werden dabei nie
  erfasst.
- Die Daten liegen auf Servern in der EU (Frankfurt). Es gibt **keine Werbung, kein Tracking und keinen Verkauf** von Daten.
- Der KI-Coach ist freiwillig. Wenn du ihn nutzt, geht deine Frage an einen KI-Anbieter in den USA.
- Du kannst deine Daten jederzeit in der App herunterladen und dein Konto mit allen Gesundheitsdaten löschen.
- Fragen? Schreib uns an [E-Mail].

---

## 1. Verantwortlicher

Verantwortlich für die Verarbeitung personenbezogener Daten in der App Trainerbank ist:

[Herausgeber] ([Rechtsform])
[Anschrift: Straße, Hausnummer, PLZ, Ort, Land]
Vertreten durch: [vertretungsberechtigte Person(en)]
E-Mail: [E-Mail]
Telefon: [Telefon]

Im Folgenden „wir“ oder „uns“.

> **Prüfhinweis – Rollenverteilung (wichtigste offene Grundsatzfrage):** Dieser Entwurf geht davon aus, dass der
> Herausgeber für alle Verarbeitungen in der App allein verantwortlich ist (Modell A). Das ist für einen
> Store-Vertrieb an einzelne Nutzer naheliegend, passt aber nicht ohne Weiteres zu den Daten, die Trainer über ihre
> Spieler erfassen, insbesondere über Spieler ohne eigenes Konto. Alternativen:
> - **Modell B:** Der Verein bzw. das Team ist Verantwortlicher für die vom Trainerteam erfassten Teamdaten; der
>   Herausgeber verarbeitet diese im Auftrag (Auftragsverarbeitungsvertrag nach Art. 28 DSGVO mit jedem Verein).
>   Das passt zu einer Abrechnung gegenüber Vereinen.
> - **Modell C:** gemeinsame Verantwortlichkeit von Verein und Herausgeber (Vereinbarung nach Art. 26 DSGVO, deren
>   wesentlicher Inhalt den Betroffenen zur Verfügung zu stellen ist).
>
> Auch zu klären: Trainer, die ohne Verein privat ein Team betreuen. Die Entscheidung wirkt sich auf diese Erklärung,
> die Einwilligungstexte, die DSFA und die Store-Angaben aus.

## 2. Datenschutzbeauftragter

[Name bzw. Firma des Datenschutzbeauftragten]
[Anschrift]
E-Mail: [E-Mail des Datenschutzbeauftragten]

> **Prüfhinweis:** Nach § 38 Abs. 1 Satz 2 BDSG ist ein Datenschutzbeauftragter unabhängig von der Mitarbeiterzahl zu
> benennen, wenn Verarbeitungen stattfinden, die einer Datenschutz-Folgenabschätzung unterliegen. Zusätzlich kommt
> Art. 37 Abs. 1 lit. c DSGVO in Betracht (umfangreiche Verarbeitung von Gesundheitsdaten als Kerntätigkeit). Da für
> Trainerbank eine DSFA voraussichtlich erforderlich ist (siehe `docs/DSFA.md`), ist die Benennung sehr wahrscheinlich
> Pflicht. Die Kontaktdaten sind der Aufsichtsbehörde zu melden.

## 3. Wer nutzt Trainerbank? (Rollen)

| Rolle | Wer | Was die Rolle in der App tut |
|---|---|---|
| **Trainerteam (Staff)** – Owner, Coach, Physio | Erwachsene Trainer, Co-Trainer, Physiotherapeuten, Betreuer eines Teams | legen das Team an, planen Training und Spiele, erfassen Anwesenheit; was ein Mitglied darüber hinaus sieht und bearbeitet (z. B. Gesundheitsdaten, Befunde, Mannschaftskasse), legt der Owner mit **Rechten je Person** fest – der Server setzt das durch |
| **Funktionär im Verein** – Vereinsadmin, sportliche Leitung, NLZ-/Jugendleitung, Koordination | Erwachsene, die im Verein Verantwortung für mehrere Teams tragen | sehen die Vereinsübersicht (nur Kennzahlen je Team) und öffnen die Teams, die ihnen der Vereinsadmin zuweist, mit den Rechten, die er vergibt (Standard: Planung und Kader, **keine Gesundheitsdaten**); schreiben Ankündigungen in die Teamchats; der Vereinsadmin verbindet Teams und verwaltet Funktionäre |
| **Kassenwart** | ein Spieler, den das Trainerteam bestimmt (vor allem bei Senioren) | sieht die Mannschaftskasse aller Spieler und bucht Zahlungen; keine Gesundheitsdaten |
| **Spieler mit eigenem Konto** | Spielerinnen und Spieler ab [Mindestalter für ein eigenes Konto] bis Erwachsene | treten einem Team mit dem Team-Code bei, sehen Teamkalender und veröffentlichten Wochenplan, tragen eigene Daten ein, sehen nur ihre eigenen Daten |
| **Spieler ohne Konto** | Spieler, die das Trainerteam selbst anlegt (z. B. jüngere Kinder) | nutzen die App nicht selbst; das Trainerteam erfasst Daten für sie |
| **Beobachtete Spieler (Scouting)** | Spieler anderer Teams oder Vereine, die ein Trainerteam für seine Kaderplanung beobachtet | nutzen die App nicht; das Trainerteam erfasst sportliche Eindrücke und informiert sie bzw. bei Minderjährigen die Eltern (4.37) |
| **Erziehungsberechtigte** | Eltern bzw. Sorgeberechtigte von Spielern unter 16 Jahren | erteilen die erforderliche Einwilligung; wir speichern dafür ihre E-Mail-Adresse |

Tritt ein Spieler mit dem Team-Code einem Team bei, in dem das Trainerteam ihn bereits ohne Konto angelegt hat
(gleicher Vor- und Nachname und gleiches Geburtsdatum), wird sein Konto mit diesem vorhandenen Spielerprofil verknüpft.
Er sieht dann auch die Daten, die das Trainerteam dort bereits für ihn erfasst hat.

## 4. Welche Daten wir verarbeiten

| Nr. | Kategorie | Daten | Herkunft | Pflicht oder freiwillig |
|---|---|---|---|---|
| 4.1 | Kontodaten | E-Mail-Adresse, Passwort (nur als kryptografischer Hash gespeichert, wir kennen dein Passwort nicht), Anzeigename, App-Sprache, Zeitpunkte von Registrierung und Anmeldung | du | Pflicht für ein Konto |
| 4.2 | Teamzugehörigkeit | Team, Rolle (Owner, Coach, Physio, Spieler), Zeitpunkt des Beitritts; Team-Code bzw. Staff-Code nur zur Prüfung beim Beitritt | du, Trainerteam | Pflicht für die Teamnutzung |
| 4.3 | Spieler-Stammdaten | Vor- und Nachname, Geburtsdatum, Position, Rückennummer; optional Körpergewicht und Profilfoto | du oder das Trainerteam | Name und Geburtsdatum Pflicht; Gewicht und Foto freiwillig |
| 4.4 | Team- und Kalenderdaten | Verein, Teamname, Altersklasse, Teameinstellungen und Spielprinzipien; Spiele (Datum, Uhrzeit, Gegner, Heim/Auswärts, Wettbewerb), Termine, Trainingszeiten, Absagen und Zusatztrainings, Wochenpläne, eigene Trainingsarten, durchgeführte Einheiten | Trainerteam | – |
| 4.5 | Anwesenheit | Status je Termin (anwesend, entschuldigt, unentschuldigt) | Trainerteam; automatisch „anwesend“, wenn eine Belastung eingetragen wird | – |
| 4.6 | Abwesenheiten | Art (Urlaub, krank, Verletzung, Schule, Arbeit, Sonstiges), Zeitraum, Stufe der Rückkehr ins Training (1–4), bei Verletzungen die betroffene Körperregion (z. B. „Sprunggelenk rechts“, keine Diagnose), Notiz, ob selbst gemeldet | du oder das Trainerteam | freiwillig |
| 4.7 | Trainingsbelastung | Belastungsempfinden je Einheit (Session-RPE, Skala 0–10) und Dauer in Minuten – auch für weitere Einheiten am selben Tag (z. B. Athletik, Torwarttraining); bei Torhütern die ungefähre Zahl der Sprünge/Hechtsprünge | du oder das Trainerteam | freiwillig, Einwilligung erforderlich |
| 4.8 | Morgendliches Wohlbefinden | Schlafdauer, Schlafqualität, Müdigkeit, Muskelkater, Stress, Beschwerden (keine, leicht, deutlich) und betroffene Körperregionen (aus einer festen Liste, ggf. mit Seite links/rechts) | du | freiwillig, Einwilligung erforderlich |
| 4.9 | Zusatzsport | Art (z. B. Fitnessstudio, Schulsport, Laufen, anderer Verein), Dauer, Belastungsempfinden | du | freiwillig, Einwilligung erforderlich |
| 4.10 | Wachstum und Körperdaten | Körpergröße mit Messdatum, Körpergewicht | du oder das Trainerteam | freiwillig, Einwilligung erforderlich |
| 4.11 | Inhalte des Trainerteams | Trainernotizen (nur für das Trainerteam sichtbar), Potenziale und Ziele (für dich sichtbar, wenn freigegeben; Quelle Trainer, Datenhinweis oder KI-Vorschlag), Nachrichten des Trainers an dich (Art, Text, Gültigkeit) | Trainerteam | – |
| 4.12 | Berechnete Werte | z. B. Belastungskennzahlen (akute und chronische Belastung, ACWR), Ampelstatus, Erholungsstatus, Empfehlungen und Tipps | werden aus den Daten oben berechnet | – |
| 4.13 | Einwilligungsnachweise | Art der Einwilligung, Version des Textes, Zeitpunkt; bei Spielern unter 16 die E-Mail-Adresse eines Erziehungsberechtigten | du, Erziehungsberechtigte | Pflicht als Nachweis |
| 4.14 | Push-Mitteilungen | Push-Token deines Geräts, Plattform (iOS, Android, Web), Zeitpunkt der letzten Aktualisierung | dein Gerät | freiwillig |
| 4.15 | KI-Coach | Inhalt deiner Anfrage und ein reduzierter Datenkontext (siehe Abschnitt 11); Anzahl der KI-Anfragen pro Tag | du | freiwillig, gesonderte Einwilligung |
| 4.16 | Technische Daten | IP-Adresse, Zeitpunkt, aufgerufener Dienst, Statuscodes, technische Kennung des App-Clients in Server-Protokollen | dein Gerät | technisch erforderlich |
| 4.17 | Kommunikation mit uns | Inhalt deiner Nachricht, E-Mail-Adresse, ggf. Name | du | freiwillig |
| 4.18 | Spieldaten und Bewertungen | Einsatzminuten, Startelf, Tore, Vorlagen je Spiel, bei Torhütern Gegentore und Paraden; Noten (1–10) mit Rückmeldung des Trainerteams zu Spielen; Trainingseindruck (nur „besonders gut“ oder „besonders schwach“ je Einheit, mit Gründen und Notiz – Durchschnitt wird nicht gespeichert); Links zu Videos | Trainerteam | – |
| 4.19 | Leistungstests | Ergebnisse von Leistungstests (z. B. Sprintzeiten, Sprunghöhe, Ausdauertest, bei Torhütern Seitsprung und Abschlagweite) mit Datum; daraus berechnete Einordnung und persönliche Laufvorgaben | Trainerteam | freiwillig |
| 4.20 | Befunde | Fotos oder PDF-Dateien von Arztbriefen und Befunden, Titel, Datum, Art der Einwilligung; auf Wunsch eine KI-Zusammenfassung | Trainerteam | freiwillig, gesonderte Einwilligung |
| 4.21 | Vorbereitung und Pausen | Zeiträume, Wochenaufbau, Trainingsprogramm für die freie Zeit; welche Programm-Einheiten du abgehakt hast (Dauer, Belastungsempfinden) | Trainerteam, du | freiwillig |
| 4.22 | Kontaktliste des Teams | Name, Funktion, Telefon, E-Mail, Adresse und Hinweise von Ansprechpersonen (z. B. Koordinator, Physio, Arztpraxis) | Trainerteam | – |
| 4.23 | Trainingsplanung | Übungen mit Zeichnungen und Coachingpunkten, gespeicherte Einheiten, Profile des Trainerteams (Name, Rolle, Aufgaben, Kontakt); Ablauf eines Trainingstags in Blöcken mit zuständigem Trainer, Coachingpunkten, Zeichnungen und Fotos von Skizzen; weitere Einheiten am Tag (Art, Uhrzeit, Dauer, Ziel-Intensität, Gruppe, zuständiger Trainer, Inhalt) | Trainerteam | – |
| 4.24 | Gruppen | Gruppen des Teams (Name, Art wie Reha, Torhüter, Belastungsaufbau, Wachstumsschub, Mannschaftsrat, Talent oder eigene; ob für Spieler sichtbar) und wer Mitglied ist; an Gruppen gerichtete Videos und Aufgaben | Trainerteam (Vorschläge der App aus den Daten, Entscheidung durch das Trainerteam) | – |
| 4.25 | Aufgaben, Dienste und Strafen | Aufgaben (Titel, Hinweis, Fälligkeit, erledigt am/von), eingeteilte Dienste (z. B. Material, Bälle; Datum, Herkunft: reihum, Strafe oder von Hand, Status), Strafen aus dem Strafenkatalog des Teams (Regel, Datum, betroffene Einheit, ggf. Betrag, Status, automatisch oder von Hand) | Trainerteam; automatisch aus Regeln, die das Trainerteam einschaltet | – |
| 4.26 | Platzierung in Leistungstests | dein Platz je Test unter den aktiven Spielern deines Teams und – wenn das Trainerteam es einstellt – der Teambestwert ohne Namen | berechnet aus 4.19 | – |
| 4.27 | Angaben zum Schmerz | je gemeldeter Körperstelle: Stärke (0–10), Art (z. B. stechend, ziehend), plötzlich oder schleichend, seit wann, in welcher Situation, ob es einen Zusammenprall gab, Schwellung/Instabilität/Belastbarkeit, ob du trainieren kannst | du | freiwillig, Einwilligung erforderlich |
| 4.28 | Mannschaftskasse | Beiträge des Teams (Name, Betrag, Zeitraum), deine Zahlungen (Datum, Betrag, wofür), erlassene Beiträge, Geldstrafen; Kassenbuch des Teams (Einnahmen und Ausgaben, z. B. Mannschaftsabend) | Trainerteam, Kassenwart | – |
| 4.29 | Rechte im Trainerteam | welche Rechte ein Mitglied des Trainerteams hat (z. B. Gesundheitsdaten, Befunde, Kasse) | Owner | – |
| 4.30 | Offline-Einträge | Einträge, die ohne Netz gemacht wurden, mit dem Zeitpunkt der Eingabe auf dem Gerät; letzter geladener Stand der App auf dem Gerät | dein Gerät | – |
| 4.31 | Spielerentwicklung | Kompetenzprofil (Einschätzung je Kompetenz von 1 bis 5 durch das Trainerteam und als Selbsteinschätzung, mit Datum und Notiz), Ziele (Titel, Bereich, Art, Messung, Start- und Zielwert, Zeitraum, Begründung, Schritte, Status) und eingetragener Fortschritt, Entwicklungsgespräche (Datum, Anlass, deine Sicht, Stärken, Entwicklungsfelder, Vereinbarungen, nächster Termin) und eine **interne Notiz** des Trainerteams zum Gespräch | Trainerteam, du | Selbsteinschätzung und eigene Ziele freiwillig |
| 4.32 | Wochenchallenge | Challenges des Teams (Aufgabe, Woche, Ziel) und deine Einträge (Bestwert, Menge, erledigte Tage oder „geschafft“) | Trainerteam, du | freiwillig |
| 4.33 | Individualtraining | deine Anfrage (Thema, Beschreibung, Wunschzeit, gewünschter Trainer), Status, Antwort, zugesagter Termin, zuständiger Trainer; die zugehörige Einheit (wie 4.23, nur für dich) | du, Trainerteam | freiwillig |
| 4.34 | Chat | Chats, in denen du Mitglied bist (Teamchat, Trainerteam, Gruppen, Einzelchats, eigene Gruppen), deine Nachrichten (Text, Zeitpunkt, Antwort auf, gelöscht am/von), Reaktionen, dein Lesestand und ob du einen Chat stumm geschaltet hast; Meldungen (Grund, Anmerkung, **Kopie der gemeldeten Nachricht** mit Absender und Zeitpunkt); Zeitpunkt der letzten Chat-Push-Mitteilung je Chat (zur Drosselung) | du, andere Mitglieder des Teams | freiwillig |
| 4.36 | Verein | Verein (Name, Farbe, Codes) und verbundene Teams; Funktionäre (Konto, Funktion, Bezeichnung, Rechte, zugewiesene Teams; Anfragen); Kennzahlen je Team in der Vereinsübersicht (Zahl der Spieler, nächstes und letztes Spiel, Bilanz, Zahl der Verletzten, Kranken und Abwesenden, Trainingsbeteiligung, Zahl der Trainings, Status des Matchplans – **ohne Namen**); beim Hochziehen oder Wechsel: Spielerprofil im Zielteam (Name, Geburtsdatum, Position, Rückennummer, Gewicht, Herkunftsteam) und – nur auf Wunsch des Trainerteams – Belastung der letzten 6 Wochen (je Tag zusammengefasst als „Training <Team>“), Zusatzsport, Morgen-Checks der letzten 4 Wochen und laufende Abwesenheiten; Ankündigungen des Vereins im Teamchat (wie 4.34) | Funktionäre des Vereins (nach Rechten), Trainerteams der beteiligten Teams | – |
| 4.35 | Matchplan | Aufstellung (Startelf, Bank, Kapitän, Position), Aufgabe für dich, Folien, Spielidee, Gegneranalyse, Wechselplan (geplante Minuten) – vom Trainerteam erstellt; **Zugriffsprotokoll**: wann du einen freigegebenen Matchplan geöffnet hast, Plattform (iOS/Android/Web) und erkannte Screenshots | Trainerteam; du (freigegebene Bereiche) | – |
| 4.37 | Kaderplanung und Scouting | **Saisonplanung:** Grundordnung, je Position Soll, Anforderungsprofil, eingeplante Spieler und Schattenkandidaten in Reihenfolge, dein Stand für die Saison (offen, fest, Perspektive, unsicher, Abgang; das Erreichen der Altersgrenze berechnet die App aus deinem Geburtsjahr) mit kurzer Notiz, Notizen zur Saison. **Aufrücker:** Spieler jüngerer Teams des Vereins mit Vorname, Nachname, Position, Jahrgang und Team. **Scouting** (Spieler, die Trainerbank nicht nutzen): Vor- und Nachname, Jahrgang bzw. Geburtsdatum, Positionen, starker Fuß, Größe, Verein und Mannschaft/Liga, Status (beobachten, Sichtung, Probetraining, Gespräche, Zusage, Absage, kein Interesse), Priorität, Einschätzung von aktuellem Niveau und Potenzial, Merkmale, Merklisten, Quelle, Kontaktweg (z. B. „über den Vater“), Videolink, Notiz, nächster Schritt, Berichte (Datum, Anlass, Art der Beobachtung, Minuten, Position, Bewertung 1–5 je Bereich und Kompetenz, Gesamteindruck, Empfehlung, Stärken, Entwicklungsfelder, Fazit, Verfasser), Datum der Information nach Art. 14 DSGVO; **keine Gesundheitsdaten** | Trainerteam; Aufrücker aus den Kaderdaten der Vereinsteams | – |

**Gesundheitsdaten** im Sinne von Art. 9 DSGVO sind bei Trainerbank: Trainingsbelastung (4.7), Wohlbefinden (4.8),
Zusatzsport (4.9), Körpergröße und Gewicht (4.10), Abwesenheiten wegen Krankheit oder Verletzung einschließlich
Rückkehrstufe und Notiz (4.6), Befunde und ihre Zusammenfassung (4.20), abgehakte Programm-Einheiten (4.21) sowie die
daraus berechneten Werte (4.12). Leistungstests (4.19) und die Platzierung (4.26) behandeln wir genauso vertraulich,
weil sie Rückschlüsse auf die körperliche Verfassung zulassen. Die Mitgliedschaft in Gruppen der Arten **Reha**,
**Belastungsaufbau** und **Wachstumsschub** (4.24) verrät etwas über die Gesundheit und wird ebenfalls wie ein
Gesundheitsdatum behandelt: Mitspieler erfahren davon nie etwas; du selbst siehst nur deine eigene Mitgliedschaft
(Reha und Belastungsaufbau standardmäßig, damit du deinen Plan findest; Wachstumsschub nur, wenn das Trainerteam es
freigibt).

**Gruppen (4.24):** Das Trainerteam entscheidet, ob Spieler eine Gruppe sehen. Spieler sehen nur freigegebene Gruppen,
in denen sie selbst Mitglied sind – nie die Mitgliederliste und nie Gruppen, die verborgen sind. Vorschläge der App
(z. B. „Belastungsaufbau“ nach einer Verletzung) sind nur Vorschläge; erst die Entscheidung des Trainerteams ordnet zu.

**Aufgaben, Dienste und Strafen (4.25):** Ein Strafenkatalog ist freiwillig und soll im Team vereinbart sein (z. B. mit
dem Mannschaftsrat). Automatische Regeln wirken nur ab dem Tag, an dem das Trainerteam sie einschaltet – nie
rückwirkend. Die Regel „Belastung nicht eingetragen“ prüft nur, **ob** innerhalb von 24 Stunden nach der Einheit ein
Eintrag vorliegt, nicht dessen Inhalt, und gilt nur für Spieler mit eigenem Konto und Einwilligung in die Verarbeitung
von Gesundheitsdaten. Wer nicht einwilligt, kann deshalb nie eine solche Strafe erhalten. Das Trainerteam kann jede
Strafe erlassen. Mitspieler sehen weder deine Dienste noch deine Strafen.

**Angaben zum Schmerz (4.27)** sind Gesundheitsdaten und werden wie der Morgen-Check behandelt: nur du und das
Trainerteam mit dem Recht „Gesundheitsdaten“ sehen sie. Die App leitet daraus Hinweise ab (z. B. „Verdacht auf
Muskelverletzung – ärztlich abklären“); das ist Orientierung, keine Diagnose.

**Mannschaftskasse (4.28):** Ob es eine Kasse gibt, entscheidet das Trainerteam. Du siehst nur deine eigenen Beträge
und – wenn freigegeben – den Gesamtstand der Kasse, nie, wer was bezahlt hat. Befreiungen von Beiträgen (die z. B. auf
eine finanzielle Notlage hindeuten können) sehen nur die Kasse und du selbst. Die App wickelt keine Zahlungen ab und
speichert keine Konto- oder Kartendaten. Wird ein Spielerprofil gelöscht, bleiben Buchungen im Kassenbuch ohne Namen
erhalten, damit der Kassenstand stimmt.

**Rechte im Trainerteam (4.29):** Der Owner legt fest, wer im Trainerteam was sieht. Ohne das Recht
„Gesundheitsdaten“ sieht z. B. ein Betreuer keine Belastungs-, Morgen-Check- oder Schmerzangaben – das prüft der Server,
nicht nur die App. Abwesenheiten (inklusive Art und Rückkehrstufe) sieht das ganze Trainerteam, weil sie für die
Planung nötig sind.

**Trainingseindruck (4.18):** Bewertet werden nur Ausreißer – eine besonders gute oder besonders schwache
Trainingsleistung, gern mit Grund (z. B. „Einsatz“, „Konzentration“). Der Durchschnitt ist der Normalfall und wird
nicht gespeichert; es gibt keine Rangliste daraus. Kritik ist standardmäßig nicht für dich sichtbar, damit das
Trainerteam sie zuerst persönlich mit dir besprechen kann; Lob kannst du sehen. Was freigegeben ist, erscheint in deiner
App unter Bewertungen. Eintragen dürfen nur Mitglieder des Trainerteams mit dem Recht „Notizen & Bewertungen“.

**Weitere Einheiten am Tag (4.7, 4.23):** Für jede Einheit – z. B. 30 Minuten Athletik vor dem Mannschaftstraining
oder ein Torwarttraining – kannst du deine Belastung getrennt eintragen; zusammen ergeben sie deine Tagesbelastung.
Einheiten für eine Gruppe siehst du nur, wenn du Mitglied einer für dich freigegebenen Gruppe bist; wer sonst
teilnimmt, siehst du nicht. Bei Torhütern fragt die App zusätzlich nach der ungefähren Zahl der Sprünge und
Hechtsprünge, weil sie den Körper anders belasten als Laufen.

**Spielerentwicklung (4.31):** Bewertet wird relativ zur Altersklasse und als Grundlage für Gespräche, nicht als
Urteil über dich. Trainereinschätzungen und Gesprächsprotokolle siehst du erst, wenn das Trainerteam sie freigibt; die
interne Notiz zum Gespräch siehst du nie. Bei Zielen des Trainerteams kannst du Schritte abhaken und Fortschritt
eintragen; eigene Ziele kannst du selbst anlegen, ändern und löschen. Ziele, deren Fortschritt aus Leistungstests,
Spieldaten oder der Trainingsbeteiligung berechnet wird, nutzen diese Daten nur für die Anzeige des Fortschritts. Zugriff
hat im Trainerteam nur, wer das Recht „Notizen & Bewertungen“ hat.

**Wochenchallenge (4.32):** Mitmachen ist freiwillig. Mitspieler sehen nur, wie viele mitmachen und wie viele es
geschafft haben, sowie die gemeinsame Summe – nicht deine Werte. Nur wenn das Trainerteam die Bestenliste einschaltet,
erscheinen bei Bestleistungs-Challenges die drei besten Werte mit Vorname und Initial.

**Individualtraining (4.33):** Deine Anfrage sieht das Trainerteam mit dem Recht „Planung“ und der Trainer, bei dem du
anfragst. Eine zugesagte Einheit
erscheint nur bei dir; Mitspieler sehen sie nicht.

**Chat (4.34):** Im Chat sieht jedes Mitglied eines Chats die Nachrichten dieses Chats mit Vorname und Initial des
Nachnamens der Absender (beim Trainerteam der Name aus dem Trainerprofil). Spieler ohne App-Konto sind nicht dabei.
In **Jugendteams** (alle Altersklassen außer Senioren und Ü32) sind Einzelchats standardmäßig nur zwischen Spielern und
dem Trainerteam möglich, und **das Trainerteam (mit dem Recht „Nachrichten“) kann Einzelchats zwischen einem Trainer und
einem Spieler mitlesen** – das steht sichtbar im Chat. Das folgt den Empfehlungen des DFB und der Deutschen Sportjugend
zum Kinderschutz (keine „geheimen“ Einzelchats zwischen Trainer und Kind) und schützt Spieler und Trainer. Das
Trainerteam kann die Einstellungen ändern; einmal mitlesbare Chats bleiben mitlesbar. Du kannst eigene Nachrichten
jederzeit löschen (der Text wird entfernt, es bleibt „Nachricht gelöscht“). Meldest du eine Nachricht, geht eine Kopie
an das Trainerteam, damit es auch dann handeln kann, wenn die Nachricht gelöscht wird. Push-Mitteilungen zum Chat
nennen nur, von wem die Nachricht ist und in welchem Chat – nie den Text.

**Matchplan (4.35):** Den Matchplan erstellt das Trainerteam. Spieler sehen ihn nur, wenn er freigegeben ist, nur die
freigegebenen Bereiche und nur im eingestellten Zeitraum (Standard: bis kurz nach Spielende); Aufgaben sieht standardmäßig
jeder nur für sich, der Wechselplan bleibt standardmäßig im Trainerteam. Um die Taktik des Teams vertraulich zu halten,
wird der Plan mit deinem Namen und der Uhrzeit als Wasserzeichen angezeigt, auf Android sind Screenshots und
Bildschirmaufnahmen gesperrt, auf iOS werden Bildschirmaufnahmen geschwärzt und Screenshots erkannt. Jeder Aufruf
(höchstens einer je 10 Minuten) und erkannte Screenshots werden protokolliert; das Trainerteam sieht, wer den Plan schon
gesehen hat. Andere Spieler sehen das Protokoll nicht. Das Protokoll wird nach **6 Monaten** gelöscht.

**Verein (4.36):** Ein Verein verbindet mehrere Teams. Jedes Team bleibt eigenständig; Daten werden nicht
zusammengelegt. Funktionäre sehen nur die Teams, die ihnen der Vereinsadmin zuweist, und nur mit den Rechten, die er
vergibt – genauso wie Mitglieder eines Trainerteams (Abschnitt 8). Gesundheitsdaten gehören nicht zu den Standardrechten
einer Funktion; der Vereinsadmin soll sie nur Personen geben, die Spieler selbst betreuen (z. B. Athletik- oder
Reha-Koordination), und die App weist darauf hin. Die Vereinsübersicht zeigt je Team nur Zahlen, keine Daten einzelner
Spieler; Ausfälle und Beteiligung nur Funktionären mit dem Recht „Kader“. Beim **Hochziehen** (du spielst zusätzlich in
einem höheren Team) oder **Wechsel** (dauerhaft) legt das Trainerteam ein Spielerprofil im Zielteam an; hast du ein
Konto, siehst du dann beide Teams bzw. das neue Team. Beim Wechsel bleibt dein bisheriges Profil mit seiner Historie im
alten Team inaktiv (das alte Trainerteam kann es löschen). Deine **Belastung** (Trainings und Spiele der letzten 6 Wochen,
je Tag zusammengefasst), Zusatzsport, Morgen-Checks der letzten 4 Wochen und laufende Ausfälle werden nur mitgenommen,
wenn das Trainerteam das auswählt und in **beiden** Teams das Recht „Gesundheitsdaten“ hat – damit Belastungssteuerung
und Verletzungsschutz im neuen Team von Anfang an stimmen. Das ist derselbe Zweck, in den du für die Belastungssteuerung
eingewilligt hast; widerrufst du die Einwilligung, gilt das für alle Teams.

**Kaderplanung und Scouting (4.37):** Diesen Bereich sieht nur, wer im Trainerteam (oder als Funktionär des Vereins)
das Recht „Scouting & Kaderplanung“ hat – Spieler nie. Dein **Stand für die nächste Saison** und die Notiz dazu sind
interne Planung des Trainerteams, vergleichbar mit Trainernotizen; sie sind nicht Teil des Datenexports, Auskunft
bekommst du auf Anfrage (Abschnitt 20). Ist dein Team mit einem Verein verbunden, sehen die Trainerteams **älterer
Teams desselben Vereins** dich als möglichen Aufrücker – nur mit Vorname, Nachname, Position, Jahrgang und Team, und
nur, wenn dein Jahrgang in der geplanten Saison bei ihnen spielberechtigt ist. Andere Daten von dir sehen sie dadurch
nicht; dich tatsächlich hochziehen kann nur, wer in deinem Team das Recht „Kader“ hat (siehe 4.36).
Im **Scouting** erfasst das Trainerteam Spieler, die Trainerbank nicht nutzen – nur sportliche Eindrücke, keine
Gesundheitsdaten (die App weist beim Erfassen darauf hin), keine Fotos. Diese Spieler bzw. bei Minderjährigen ihre
Eltern werden nach Art. 14 DSGVO informiert – spätestens einen Monat nach der Erfassung, beim ersten Kontakt (z. B.
Einladung zum Probetraining) sofort. Die App erinnert das Trainerteam daran, stellt einen Informationstext und eine
Auskunft zum Teilen bereit und hält das Datum der Information fest. Wird ein Spieler nach einer Zusage in den Kader
übernommen, legt das Trainerteam ein Spielerprofil mit Name, Jahrgang bzw. Geburtsdatum und Position an; ab dann gilt
für ihn diese Erklärung wie für alle Spieler.

**Platzierung (4.26):** Du siehst nur deinen eigenen Platz (z. B. „Platz 3 von 18“), erst wenn mindestens fünf Spieler
einen Wert haben. Werte oder Namen anderer Spieler werden nie angezeigt. Das Trainerteam kann die Platzierung abschalten.

**Kontaktliste (4.22):** Die Daten der Ansprechpersonen trägt das Trainerteam ein. Es ist dafür verantwortlich, dass
die Personen einverstanden sind, und legt fest, welche Kontakte Spieler sehen. Bei Ärzten und Praxen genügen in der
Regel die öffentlich angegebenen Praxisdaten.

**Kamera und Fotos:** Die App nutzt die Kamera bzw. deine Fotoauswahl nur, wenn du selbst ein Profilbild, einen
Befund oder (als Trainer) das Foto einer Trainingsskizze aufnimmst oder auswählst. Es gibt keinen Zugriff im Hintergrund. Auch Trainernotizen, Potenziale und
Nachrichten (4.11) können Gesundheitsbezug haben, wenn das Trainerteam darin z. B. Beschwerden erwähnt.

Die „Körperregion“ bei Beschwerden oder Verletzungen ist eine Angabe wie „Oberschenkel hinten links“. Trainerbank erfasst **keinen
Standort** (keine GPS- oder Ortungsdaten).

> **Prüfhinweis:** Abgleichen, ob die App weitere Daten verarbeitet (z. B. Absturzberichte, App-Version, Zeitzone des
> Geräts, Kontakte, Kamera). Wenn ja, ergänzen – auch in den Store-Formularen (`docs/STORE.md`).

## 5. Zwecke und Rechtsgrundlagen

| Zweck | Daten (Nr.) | Rechtsgrundlage |
|---|---|---|
| Konto anlegen, Anmeldung, App bereitstellen | 4.1, 4.2, 4.16 | Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag) |
| Teamorganisation durch das Trainerteam: Kader, Kalender, Wochenplan, Anwesenheit, Abwesenheiten ohne Gesundheitsangaben, Nachrichten, Potenziale, Notizen, Trainingstag, Gruppen ohne Gesundheitsbezug, Aufgaben, Dienste und Strafen, Mannschaftskasse, Rechte im Trainerteam, Offline-Einträge, Spielerentwicklung, Wochenchallenge, Individualtraining, Chat, Matchplan, Verein (Funktionäre, Vereinsübersicht, Hochziehen und Wechsel ohne Gesundheitsdaten, Ankündigungen) | 4.2–4.6, 4.11, 4.23–4.25, 4.28–4.36 | für Nutzer mit eigenem Konto Art. 6 Abs. 1 lit. b DSGVO; für Daten, die das Trainerteam über Spieler erfasst, und für Spieler ohne Konto Art. 6 Abs. 1 lit. f DSGVO (siehe Begründung unten) |
| Belastungs- und Erholungssteuerung, Trainingsplanung, Rückkehr ins Training und Reha-Plan, persönliche Tipps zu Ernährung und Schlaf, Gruppen mit Gesundheitsbezug, Platzierung in Tests, Angaben zum Schmerz (Gesundheitsdaten) | 4.6 (krank/Verletzung), 4.7–4.10, 4.12, 4.24 (Reha, Aufbau, Wachstumsschub), 4.26, 4.27 | ausdrückliche Einwilligung, Art. 9 Abs. 2 lit. a i. V. m. Art. 6 Abs. 1 lit. a DSGVO; bei Spielern unter 16 Einwilligung der Erziehungsberechtigten |
| Übernahme der Belastung beim Hochziehen oder Wechsel innerhalb des Vereins (Gesundheitsdaten) | 4.36 | wie die Belastungssteuerung: ausdrückliche Einwilligung, Art. 9 Abs. 2 lit. a i. V. m. Art. 6 Abs. 1 lit. a DSGVO (gleicher Zweck; nur mit Recht „Gesundheitsdaten“ in beiden Teams) |
| KI-Coach | 4.15 | gesonderte ausdrückliche Einwilligung, Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO |
| Push-Erinnerungen und Team-Mitteilungen | 4.14 | Art. 6 Abs. 1 lit. b DSGVO; Zugriff auf das Endgerät nach § 25 Abs. 2 Nr. 2 TDDDG (vom Nutzer ausdrücklich gewünschter Dienst) nach Freigabe in den Systemeinstellungen |
| Nachweis von Einwilligungen | 4.13 | Art. 6 Abs. 1 lit. c i. V. m. Art. 7 Abs. 1 DSGVO |
| Kinderschutz und Schutz vor Missbrauch im Chat (Mitlesen in Jugendteams, Meldungen mit Kopie, Begrenzung auf 30 Nachrichten pro Minute) | 4.34 | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Vereins und der Spieler am Schutz von Kindern und Jugendlichen; § 72a SGB VIII, Kinderschutzkonzepte der Verbände) |
| Kaderplanung und Scouting: Planung der nächsten Saison, Aufrücker aus dem Verein, Beobachtung von Spielern anderer Teams und Vereine | 4.37 | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Vereins an einer vorausschauenden Kaderplanung und Talentsichtung; Abwägung siehe unten) |
| Vertraulichkeit des Matchplans: Wasserzeichen, Bildschirmschutz und Zugriffsprotokoll | 4.35 | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Vereins und der Mannschaft, die Spielvorbereitung vertraulich zu halten; das Protokoll enthält nur Zeitpunkt, Plattform und erkannte Screenshots und wird nach 6 Monaten gelöscht) |
| Sicherheit, Missbrauchsabwehr, Fehleranalyse, Tageslimit für den KI-Coach | 4.15 (Zähler), 4.16 | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und bezahlbaren Betrieb) |
| Speicherung auf deinem Gerät (Anmeldesitzung, Sprache, Einstellungen) | – | § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich); Art. 6 Abs. 1 lit. b DSGVO |
| Beantwortung von Anfragen | 4.17 | Art. 6 Abs. 1 lit. b DSGVO, sonst Art. 6 Abs. 1 lit. f DSGVO |
| [Vertragsabwicklung und Rechnungsstellung mit Vereinen] | [Rechnungsdaten] | [Art. 6 Abs. 1 lit. b und lit. c DSGVO i. V. m. HGB/AO] |
| Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen | je nach Fall | Art. 6 Abs. 1 lit. f DSGVO, bei Gesundheitsdaten Art. 9 Abs. 2 lit. f DSGVO |

**Begründung für Teamorganisationsdaten (Art. 6 Abs. 1 lit. b und lit. f DSGVO):**
Wer sich selbst registriert und einem Team beitritt, möchte Kalender, Wochenplan und Mitteilungen seines Teams
nutzen. Dafür ist die Verarbeitung der Konto- und Teamdaten erforderlich (lit. b). Das Trainerteam erfasst darüber
hinaus Daten über Spieler, mit denen wir keinen eigenen Vertrag haben – etwa Anwesenheit oder Spieler ohne Konto. Hier
stützen wir uns auf das berechtigte Interesse des Teams bzw. Vereins und seines Trainerteams, Trainings- und
Spielbetrieb zu organisieren (lit. f). Diese Daten entsprechen dem, was Mannschaften üblicherweise in Kader- und
Anwesenheitslisten führen; Spieler rechnen im Mannschaftssport damit. Dem steht das Interesse der Spieler – besonders
von Kindern – an der Vertraulichkeit ihrer Daten gegenüber. Wir tragen dem Rechnung, indem nur das Trainerteam des
eigenen Teams diese Daten sieht, nichts veröffentlicht wird, es keine Werbung und kein Tracking gibt und
Löschfristen gelten. Gesundheitsdaten verarbeiten wir **nicht** auf dieser Grundlage, sondern nur mit
Einwilligung. Du kannst der Verarbeitung auf Grundlage berechtigter Interessen widersprechen (Abschnitt 20).

**Begründung für Kaderplanung und Scouting (Art. 6 Abs. 1 lit. f DSGVO):**
Mannschaften planen ihren Kader für die nächste Saison und beobachten dafür auch Spieler anderer Teams und Vereine –
das ist im Vereinsfußball üblich und für Spieler erwartbar, die im Spielbetrieb öffentlich auftreten. Erfasst werden
nur sportliche Eindrücke, die für diese Planung nötig sind; Gesundheitsdaten und Fotos gehören nicht dazu, und als
Kontaktweg genügt ein kurzer Hinweis, wie man in Kontakt kommt (die App fragt keine Anschrift ab). Dem steht das
Interesse der Spieler – oft Minderjähriger – gegenüber, nicht ohne ihr Wissen bewertet zu werden. Wir tragen dem
Rechnung durch: Sichtbarkeit nur im Trainerteam mit eigenem Recht, keine Weitergabe, Information nach Art. 14 DSGVO
mit Erinnerung in der App, kurze Löschfristen (6 Monate nach einer Absage, sonst 24 Monate ohne Aktivität), Auskunft
und Löschung jederzeit, Widerspruch ohne Begründung genügt (der Eintrag wird dann gelöscht). Aufrücker aus dem eigenen
Verein sehen ältere Teams nur mit Name, Position, Jahrgang und Team.

> **Prüfhinweis:** Abwägung für das Scouting Minderjähriger prüfen (Art. 6 Abs. 1 lit. f letzter Halbsatz DSGVO),
> ebenso, wer für Scouting-Daten Verantwortlicher ist (Modell A/B, Abschnitt 1) und ob der Verein die Information nach
> Art. 14 selbst gibt. Ausnahme nach Art. 14 Abs. 5 lit. b DSGVO wird bewusst **nicht** in Anspruch genommen.

> **Prüfhinweis:**
> 1. Abwägung nach lit. f bei Minderjährigen (Art. 6 Abs. 1 lit. f letzter Halbsatz DSGVO) prüfen. Je nach
>    Rollenmodell (Abschnitt 1) ist eher der Verein Verantwortlicher und stützt sich auf das Mitgliedschafts- bzw.
>    Spielverhältnis.
> 2. Nutzungsvertrag mit Minderjährigen: Nach §§ 106 ff. BGB sind Minderjährige bis 18 beschränkt geschäftsfähig. Ob
>    ein unentgeltlicher Nutzungsvertrag mit Pflichten (Nutzungsbedingungen) ohne Zustimmung der Eltern wirksam ist,
>    ist zu prüfen – auch für 16- und 17-Jährige. Das betrifft die Tragfähigkeit von lit. b für Spieler unter 18.
> 3. Art. 8 DSGVO regelt unmittelbar nur Einwilligungen nach Art. 6 Abs. 1 lit. a bei Diensten der
>    Informationsgesellschaft, die Kindern direkt angeboten werden. Die Altersgrenze 16 auch auf die Einwilligung nach
>    Art. 9 und den KI-Coach anzuwenden, ist eine bewusst vorsichtige Auslegung. Bei Vertrieb außerhalb Deutschlands
>    gelten in anderen Mitgliedstaaten andere Altersgrenzen (13–16 Jahre); 16 als einheitliche Grenze ist die strengste
>    Variante.
> 4. Spieler ohne Konto: Für sie kann keine Einwilligung in der App eingeholt werden. Gesundheitsdaten dürfen für sie
>    nur erfasst werden, wenn der Verein die Einwilligung außerhalb der App eingeholt hat (Vorlage in
>    `docs/EINWILLIGUNGEN.md`, Anhang B). Empfehlung: In der App eine Bestätigung des Trainers verlangen und ohne
>    Einwilligung nur Abwesenheiten ohne Grund („entschuldigt“) zulassen.
> 5. Push: Prüfen, ob das Auslesen des Push-Tokens nach § 25 Abs. 2 Nr. 2 TDDDG ohne gesonderte Einwilligung zulässig
>    ist, wenn der Nutzer Erinnerungen aktiv einschaltet und die Betriebssystem-Abfrage bestätigt.

## 6. Gesundheitsdaten – was du wissen solltest

**Wozu:** Damit dein Trainerteam Training und Belastung an dich anpassen kann – zum Beispiel nach einem harten Spiel
mehr Erholung einplanen, eine stufenweise Rückkehr nach einer Verletzung begleiten oder Trainingsumfänge in
Wachstumsphasen anpassen.

**Wer sie sieht:** du selbst und das Trainerteam deines Teams (Owner, Coach, Physio). Mitspieler, andere Teams und
andere Nutzer sehen sie nicht. Wir als Herausgeber greifen nur darauf zu, soweit es für Support, Sicherheit oder
gesetzliche Pflichten zwingend erforderlich ist.

**Freiwillig:** Die Einwilligung ist freiwillig. Ohne Einwilligung kannst du [den Teamkalender, den Wochenplan,
Abwesenheitsmeldungen ohne Gesundheitsangaben und Nachrichten weiterhin nutzen]; die Eingabe von Belastung,
Wohlbefinden, Zusatzsport und Körperdaten ist dann gesperrt. Niemand darf dich zur Einwilligung drängen; deine
Teilnahme an Training und Spielen darf nicht davon abhängen.

**Auch Einträge des Trainerteams:** Die Einwilligung umfasst auch Gesundheitsdaten, die das Trainerteam für dich
einträgt (z. B. Belastung einer Einheit, Abwesenheit wegen Verletzung, Körpergröße).

**Kein Medizinprodukt:** Trainerbank ist ein Werkzeug zur Trainingsorganisation. Die App stellt keine Diagnosen und
gibt keine Therapieempfehlungen. Ampel, Kennzahlen und Tipps beruhen auf allgemeinen sportwissenschaftlichen
Erkenntnissen und ersetzen keine ärztliche oder physiotherapeutische Beurteilung. Bei Schmerzen, Krankheit oder
Verletzung wende dich an eine Ärztin oder einen Arzt.

**Keine automatisierten Entscheidungen:** Trainerbank trifft keine Entscheidungen, die dir gegenüber rechtliche
Wirkung entfalten oder dich in ähnlicher Weise erheblich beeinträchtigen (Art. 22 DSGVO). Ampel und Empfehlungen
unterstützen das Trainerteam; über Training, Aufstellung und Einsatz entscheiden Menschen.

**Widerruf:** Du kannst die Einwilligung jederzeit in der App unter [Pfad, z. B. „Ich → Datenschutz →
Einwilligungen“] widerrufen. Danach werden keine neuen Gesundheitsdaten mehr erfasst und die bestehenden
Gesundheitsdaten [sofort / innerhalb von 30 Tagen] gelöscht. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf
bleibt unberührt.

> **Prüfhinweis:** Ob die Einwilligung bei der Registrierung als Pflicht oder freiwillig ausgestaltet wird, ist eine
> Produktentscheidung mit rechtlicher Tragweite (Kopplungsverbot Art. 7 Abs. 4 DSGVO; Freiwilligkeit bei
> Abhängigkeit vom Trainer). Empfehlung: freiwillig, mit Sperre der Gesundheitsfunktionen ohne Einwilligung. Der
> Text in eckigen Klammern oben muss zur Umsetzung passen. Ebenso die MDR-Abgrenzung prüfen (siehe `docs/DSFA.md`,
> Abschnitt 9).

## 7. Kinder und Jugendliche

- **Eigenes Konto ab [Mindestalter, Empfehlung: 13 Jahre]:** Jüngere Spieler nutzen Trainerbank nicht selbst; das
  Trainerteam kann sie ohne Konto anlegen.
- **Unter 16 Jahren:** Für die Nutzung der App und die Verarbeitung von Gesundheitsdaten ist die Einwilligung eines
  Erziehungsberechtigten erforderlich. Das Alter ergibt sich aus dem Geburtsdatum, das beim Beitritt zum Team
  angegeben wird. Wir speichern die Einwilligung mit der E-Mail-Adresse des Erziehungsberechtigten.
  [Wir senden an diese Adresse eine Bestätigung mit einem Link, über den die Einwilligung bestätigt oder abgelehnt
  werden kann. Bis zur Bestätigung werden keine Gesundheitsdaten verarbeitet.]
- **Mit 16 Jahren:** [Wir bitten dich nach deinem 16. Geburtstag, deine Einwilligungen selbst zu bestätigen.]
- **Rechte der Eltern:** Erziehungsberechtigte können die Rechte ihres Kindes (Abschnitt 20) für dieses ausüben und
  die Einwilligung jederzeit widerrufen – per E-Mail an [E-Mail] [oder über den Link in der Bestätigungs-E-Mail].
- **Spieler ohne Konto:** Für Spieler, die das Trainerteam anlegt, ist das Team bzw. der Verein dafür zuständig, die
  Spieler und ihre Eltern zu informieren und erforderliche Einwilligungen einzuholen.
- **Kein Kontakt durch Fremde:** Spieler sehen keine Daten anderer Spieler. Im Chat schreiben nur Mitglieder des
  eigenen Teams; Spieler sehen dort Vorname und Initial der anderen, keine Telefonnummern.
- **Kinderschutz im Chat:** In Jugendteams sind Einzelchats nur mit dem Trainerteam möglich und für das Trainerteam
  sichtbar; jede Nachricht lässt sich melden. Bei Grenzverletzungen sollten Spieler und Eltern sich auch an die
  Vertrauensperson bzw. die Kinderschutzbeauftragten des Vereins wenden.

> **Prüfhinweis:** Die Bestätigungs-E-Mail an die Eltern („angemessene Anstrengungen“ nach Art. 8 Abs. 2 DSGVO) ist
> laut Datenmodell noch nicht umgesetzt; derzeit wird nur die E-Mail-Adresse gespeichert. Ebenso die erneute
> Bestätigung mit 16. Sätze in eckigen Klammern nur übernehmen, wenn umgesetzt. Mindestalter für eigene Konten
> festlegen; es beeinflusst auch die Zielgruppen-Angaben im Google Play Store (Familienrichtlinie, siehe
> `docs/STORE.md`).

## 8. Wer sieht welche Daten in der App?

| Daten | du selbst | Trainerteam deines Teams | Mitspieler | andere Teams und Nutzer |
|---|---|---|---|---|
| Teamkalender, veröffentlichter Wochenplan | ja | ja | ja | nein |
| Verein und Teamname | ja | ja | ja | nur Anzeige beim Beitritt mit gültigem Team-Code |
| deine Stammdaten (Name, Position, Nummer, Foto) | ja | ja | nein | nein |
| deine Gesundheitsdaten und berechneten Werte | ja | mit Recht „Gesundheitsdaten“ (Befunde: Recht „Befunde“) | nein | nein |
| deine Anwesenheit und Abwesenheiten | ja | ja | nein | nein |
| Potenziale und Ziele | wenn freigegeben | ja | nein | nein |
| Nachrichten des Trainers an dich | ja | ja | nein | nein |
| Trainernotizen | nein | ja | nein | nein |
| deine Gruppen | nur freigegebene, nur die eigene Mitgliedschaft | ja | nein | nein |
| deine Angaben zum Schmerz | ja | mit Recht „Gesundheitsdaten“ | nein | nein |
| deine Beiträge, Zahlungen, Befreiungen | ja | mit Recht „Kasse“; Kassenwart (ohne Befreiungen ändern) | nein | nein |
| Kassenstand des Teams | wenn freigegeben | mit Recht „Kasse“ | wenn freigegeben | nein |
| deine Aufgaben, Dienste und Strafen | ja | ja | nein | nein |
| deine Leistungstests | wenn freigegeben | ja | nein | nein |
| deine Platzierung in Tests | wenn eingeschaltet (nur eigener Platz, ab 5 Werten) | ja (sieht alle Werte) | nein | nein |
| Ablauf des Trainingstags, Skizzen | nein | ja | nein | nein |
| weitere Einheiten (Zeit, Art, Inhalt) | die für dich bestimmten | ja | Einheiten für alle bzw. für ihre eigenen freigegebenen Gruppen – nie, wer teilnimmt | nein |
| dein Trainingseindruck | wenn freigegeben | mit Recht „Notizen & Bewertungen“ zum Eintragen; lesen das Trainerteam | nein | nein |
| deine Einwilligungen | ja | ja (als Nachweis) | nein | nein |
| deine Selbsteinschätzung und eigenen Ziele | ja | mit Recht „Notizen & Bewertungen“ | nein | nein |
| Einschätzungen und Gesprächsprotokolle des Trainerteams | wenn freigegeben (nie die interne Notiz) | mit Recht „Notizen & Bewertungen“ | nein | nein |
| deine Challenge-Einträge | ja | ja | nur Teamsumme bzw. – wenn eingeschaltet – Top 3 bei Bestleistungen | nein |
| deine Anfragen für Individualtraining | ja | mit Recht „Planung“ | nein | nein |
| deine Chat-Nachrichten | ja | in Chats, in denen das Trainerteam Mitglied ist; in Jugendteams auch Einzelchats Trainer–Spieler (Recht „Nachrichten“) | Mitglieder des jeweiligen Chats | nein |
| deine Meldungen im Chat | ja | mit Recht „Nachrichten“ (mit Kopie der Nachricht) | nein | nein |
| Matchplan (Aufstellung, Aufgaben, Taktik …) | die freigegebenen Bereiche im Freigabezeitraum (Aufgaben standardmäßig nur deine) | ja | wie du (freigegebene Bereiche) | nein |
| Zugriffsprotokoll des Matchplans (wann geöffnet, Screenshot erkannt) | in deinem Datenexport | ja | nein | nein |
| Daten deines Teams für Funktionäre des Vereins | – | – | – | Funktionäre, denen der Vereinsadmin dein Team zuweist – mit denselben Rechten wie ein Mitglied des Trainerteams (Gesundheitsdaten nur mit Recht „Gesundheitsdaten“) |
| Kennzahlen deines Teams in der Vereinsübersicht (nur Zahlen, keine Namen) | nein | wenn Funktionär | nein | Funktionäre des Vereins mit Zugriff auf dein Team |
| deine Planung für die nächste Saison (Stand, Notiz, Position im Schattenkader) | nein (Auskunft auf Anfrage, Abschnitt 20) | mit Recht „Scouting & Kaderplanung“ | nein | Trainerteams älterer Teams deines Vereins mit diesem Recht: nur Name, Position, Jahrgang und Team (als möglicher Aufrücker) |
| Scouting (Spieler, die Trainerbank nicht nutzen) | – | mit Recht „Scouting & Kaderplanung“ | nein | nein |
| deine Funktion im Verein (als Funktionär) | ja | Trainerteams der zugewiesenen Teams sehen dich als Mitglied „über Verein“ | nein | andere Funktionäre des Vereins |

Diese Regeln setzt die Datenbank selbst durch (zeilenbasierte Zugriffsregeln), nicht nur die Oberfläche der App.

## 9. Empfänger und Auftragsverarbeiter

Innerhalb der App erhalten nur die in Abschnitt 8 genannten Personen Zugriff. Außerdem setzen wir Dienstleister ein,
die Daten in unserem Auftrag und nach unseren Weisungen verarbeiten (Auftragsverarbeiter, Art. 28 DSGVO):

| Dienstleister | Zweck | Daten | Ort der Verarbeitung | Garantien |
|---|---|---|---|---|
| Supabase [Vertragspartner und Anschrift laut Auftragsverarbeitungsvertrag] | Datenbank, Anmeldung, Dateispeicher (Profilfotos, Befunde, Skizzen-Fotos), Serverfunktionen (Weiterleitung an den KI-Coach, Push-Erinnerungen) | alle in der App gespeicherten Daten, Server-Protokolle | Rechenzentrum in der EU: Frankfurt am Main (AWS eu-central-1) | Auftragsverarbeitungsvertrag [abgeschlossen am …]; zu prüfen: Zugriffe des Anbieters oder seiner Unterauftragsverarbeiter aus Drittländern (z. B. Support) und die dafür geltenden Garantien |
| Anthropic [Vertragspartner und Anschrift laut Vertrag] | KI-Coach (Claude API) – nur mit deiner Einwilligung | Text deiner Anfrage und reduzierter Kontext (Abschnitt 11) | USA | zu prüfen, siehe Abschnitt 10 |
| Expo (650 Industries, Inc.) [Anschrift prüfen] | Versand von Push-Mitteilungen | Push-Token, Plattform, Text der Mitteilung | USA | zu prüfen, siehe Abschnitt 10 |
| Apple (Apple Push Notification Service) bzw. Google (Firebase Cloud Messaging) | Zustellung von Push-Mitteilungen auf dein Gerät | Push-Token, Text der Mitteilung | [zu prüfen] | Rolle und Garantien zu prüfen |
| [E-Mail-Versanddienstleister] | Bestätigungs- und Passwort-E-Mails, [Bestätigung für Erziehungsberechtigte] | E-Mail-Adresse, Link | [Ort] | [Auftragsverarbeitungsvertrag] |
| [Webhoster der Web-App und Website] | Auslieferung der Web-Version und der Website | IP-Adresse, Zugriffsdaten | [Ort] | [Auftragsverarbeitungsvertrag] |
| [E-Mail-Postfach-Anbieter für Support] | Bearbeitung von Anfragen | Inhalt der Anfrage, Kontaktdaten | [Ort] | [Auftragsverarbeitungsvertrag] |

**App Stores:** Wenn du Trainerbank aus dem App Store oder Google Play lädst, verarbeiten Apple bzw. Google dabei
Daten in eigener Verantwortung nach ihren Datenschutzbestimmungen. Wir erhalten von den Stores keine Daten, die dich
persönlich identifizieren, sondern nur zusammengefasste Statistiken [zu prüfen].

**Behörden:** Daten geben wir an Behörden nur heraus, wenn wir gesetzlich dazu verpflichtet sind.

**Kein Verkauf:** Wir verkaufen keine Daten und geben sie nicht zu Werbezwecken weiter.

> **Prüfhinweis:** Für jeden Dienstleister prüfen und dokumentieren: Vertragspartner, Auftragsverarbeitungsvertrag,
> Liste der Unterauftragsverarbeiter, Speicherorte, Garantien für Drittlandübermittlungen. Apple und Google bei der
> Push-Zustellung: Rolle (Auftragsverarbeiter oder eigene Verantwortlichkeit) klären. Platzhalter-Dienstleister
> streichen, wenn sie nicht genutzt werden.

## 10. Übermittlung in Drittländer

Die Datenbank von Trainerbank liegt in der EU (Frankfurt). In folgenden Fällen werden Daten in ein Land außerhalb der
EU bzw. des EWR übermittelt, insbesondere in die USA:

- **KI-Coach (Anthropic, USA)** – nur wenn du den KI-Coach mit gesonderter Einwilligung nutzt.
- **Push-Mitteilungen (Expo, USA; Zustellung über Apple bzw. Google)** – nur wenn du Push-Mitteilungen erlaubst.
- **[Zugriffe von Supabase oder seinen Unterauftragsverarbeitern aus Drittländern, z. B. für Support oder Betrieb –
  zu prüfen].**

Die Übermittlung stützen wir auf einen Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO, für die USA das
EU-US Data Privacy Framework), soweit der Empfänger danach zertifiziert ist, und andernfalls auf
EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Eine Kopie der Garantien kannst du unter [E-Mail]
anfordern.

> **Prüfhinweis:** Für Anthropic, Expo und ggf. Supabase konkret prüfen und hier eintragen:
> (1) aktuelle Zertifizierung unter dem EU-US Data Privacy Framework (Liste unter dataprivacyframework.gov) und ob sie
> die jeweilige Datenart abdeckt, (2) ob Standardvertragsklauseln im Auftragsverarbeitungsvertrag enthalten sind,
> (3) ob ein Transfer Impact Assessment erforderlich ist. Keine Zertifizierung behaupten, die nicht verifiziert ist.
> Eine Stützung allein auf Art. 49 Abs. 1 lit. a DSGVO (Einwilligung) ist für regelmäßige Übermittlungen nicht zu
> empfehlen.

## 11. KI-Coach

Der KI-Coach beantwortet Fragen zu Training, Belastung und Erholung. Er ist **freiwillig** und nur nach einer
gesonderten Einwilligung verfügbar. [Er steht Spielern und dem Trainerteam zur Verfügung.]

**So funktioniert es:**
1. Du stellst eine Frage in der App.
2. Unser Server (Supabase-Funktion in Frankfurt) ergänzt die Frage um einen reduzierten Datenkontext und leitet sie an
   die Claude API von Anthropic weiter. Der Kontext enthält: Vorname, Alter in Jahren und relevante Trainingsdaten
   (z. B. Belastung, Trainingsminuten, [Wohlbefindenswerte], Spieltagsbezug).
3. **Nicht übermittelt werden:** Nachname, Geburtsdatum, E-Mail-Adresse, Profilfoto, [Vereins- und Teamname],
   Trainernotizen.
4. Die Antwort wird dir in der App angezeigt und als KI-generiert gekennzeichnet.

**Speicherung:** Wir speichern Anfragen und Antworten [nicht dauerhaft]. Gespeichert wird nur die Anzahl deiner
KI-Anfragen pro Tag, um ein Tageslimit durchzusetzen. Übernimmt das Trainerteam einen KI-Vorschlag als Potenzial, wird
dieser wie andere Potenziale gespeichert und als KI-Vorschlag gekennzeichnet.

**Beim KI-Anbieter:** Anthropic verarbeitet die Daten als unser Auftragsverarbeiter, um die Antwort zu erzeugen.
[Aufbewahrungsdauer beim Anbieter und Ausschluss der Nutzung zum Training der KI-Modelle laut Vertrag eintragen.]

**Trainerteam und KI:** Nutzt das Trainerteam den KI-Coach für Fragen zu einzelnen Spielern oder zum Team, werden Daten
eines Spielers nur einbezogen, wenn dieser Spieler (bzw. seine Erziehungsberechtigten) in den KI-Coach eingewilligt
hat.

**Grenzen:** KI-Antworten können unvollständig oder falsch sein. Sie sind keine medizinische Beratung. Besprich
Änderungen am Training mit deinem Trainerteam und bei Beschwerden mit einer Ärztin oder einem Arzt.

**Rechtsgrundlage:** deine ausdrückliche Einwilligung (Art. 6 Abs. 1 lit. a, Art. 9 Abs. 2 lit. a DSGVO). Zur
Übermittlung in die USA siehe Abschnitt 10. Du kannst die Einwilligung jederzeit unter [Pfad] widerrufen; danach ist
der KI-Coach für dich gesperrt.

> **Prüfhinweis:**
> 1. Tatsächlichen Inhalt der Anfrage an die API in `supabase/functions/ai` verifizieren und die Liste oben
>    anpassen. Vorname plus Alter plus Trainingsdaten sind weiterhin personenbezogene Daten (keine Anonymisierung).
>    Empfehlung: Vornamen serverseitig durch Platzhalter („Spieler A“) ersetzen und erst in der Antwort zurücktauschen.
> 2. Laut Anbieterdokumentation (platform.claude.com, Stand 10/2026, vor Veröffentlichung erneut prüfen): Anthropic
>    handelt bei der Claude API als Auftragsverarbeiter; Inhalte werden ohne ausdrückliche Erlaubnis nicht zum
>    Modelltraining verwendet; Aufbewahrung ist modellabhängig; Zero Data Retention ist auf Anfrage möglich; als
>    Verarbeitungsort sind nur „us“ oder „global“ wählbar, eine EU-Option gibt es derzeit nicht. Vertragspartner,
>    DPA, Aufbewahrung und Region verbindlich klären; bei „global“ ist der Verarbeitungsort nicht auf die USA
>    beschränkt – dann den Text in Abschnitt 10 anpassen.
> 3. Die Filterung auf Spieler mit KI-Einwilligung (Absatz „Trainerteam und KI“) ist laut Datenmodell noch nicht
>    umgesetzt (`consents.kind` kennt bisher kein `ai_coach`). Bis dahin den KI-Coach für das Trainerteam nur ohne
>    Spielerdaten betreiben oder den Absatz anpassen.
> 4. KI-Verordnung (EU) 2024/1689: Transparenzpflicht nach Art. 50 (Hinweis, dass mit einer KI interagiert wird) und
>    KI-Kompetenz nach Art. 4 – Anwendbarkeit und Geltungsbeginn prüfen.

### 11a. KI-Auswertung von Befunden

Wenn ein Befund gespeichert ist und du (bzw. bei Spielern ohne Konto: du schriftlich gegenüber dem Trainerteam)
**ausdrücklich eingewilligt** hast, kann das Trainerteam eine Zusammenfassung erstellen lassen. Dafür wird die Datei
(Bild oder PDF) zusammen mit wenigen Angaben zum Kontext (Altersgruppe, aktuelle Rückkehrstufe) an den KI-Anbieter
Anthropic übermittelt. Ergebnis ist eine verständliche Zusammenfassung mit Hinweisen für den Trainingsaufbau und
Fragen an Arzt oder Physio – **keine Diagnose und keine medizinische Beratung**; über die Rückkehr entscheidet das
medizinische Personal. Die Zusammenfassung wird am Befund gespeichert und ist für dich sichtbar. Anthropic nutzt die
Daten nach den Vertragsbedingungen nicht zum Training und speichert sie nur kurz zur Missbrauchserkennung (siehe
Abschnitt 10 zur Übermittlung in Drittländer). Die Einwilligung kannst du jederzeit unter Konto → Einwilligungen
widerrufen; danach sind keine neuen Auswertungen möglich.

## 12. Push-Mitteilungen

Trainerbank kann dir Push-Mitteilungen senden, z. B. Erinnerungen an die Eingabe von Belastung oder Wohlbefinden
[und Hinweise des Trainerteams] sowie Hinweise auf neue Chat-Nachrichten (höchstens eine je Chat und Minute, nur für
Chats, die du nicht stumm geschaltet hast). Dafür musst du Mitteilungen in den Systemeinstellungen deines Geräts
erlauben. Du kannst sie dort [und in der App unter Pfad] jederzeit wieder abschalten; einzelne Chats schaltest du im
Chat stumm.

Wir speichern dazu den Push-Token deines Geräts mit Plattform und Zeitpunkt. Der Versand läuft über den Push-Dienst
von Expo und die Zustelldienste von Apple bzw. Google (Abschnitte 9 und 10). **Mitteilungstexte enthalten keine
Gesundheitsangaben und keine Chat-Inhalte** (nur „Neue Nachricht von …“), weil sie auf dem Sperrbildschirm sichtbar
sein können.

## 13. Web-Version und Speicherung auf deinem Gerät

Die App speichert auf deinem Gerät bzw. im Browser nur, was für den Betrieb unbedingt erforderlich ist: die
Anmeldesitzung, die gewählte Sprache und Einstellungen der App. Damit du auch **ohne Netz** (z. B. in der Kabine)
eintragen kannst, speichert die App außerdem Einträge, die noch nicht gesendet wurden (höchstens 14 Tage), und den
zuletzt geladenen Stand deines Teams (höchstens 14 Tage, beim Abmelden gelöscht). Beim Trainerteam kann dieser Stand
Gesundheitsdaten der Spieler enthalten, für die es Rechte hat – Geräte sollten deshalb mit einer Bildschirmsperre
geschützt sein. Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG. Wir setzen
**keine Cookies oder vergleichbaren Techniken zu Analyse-, Werbe- oder Trackingzwecken** ein; deshalb gibt es keinen
Cookie-Banner.

Beim Aufruf der Web-Version oder der Website werden Zugriffsdaten (IP-Adresse, Zeitpunkt, aufgerufene Seite,
Browserkennung) beim Webhoster [Webhoster] verarbeitet, um die Seiten auszuliefern und die Sicherheit zu
gewährleisten (Art. 6 Abs. 1 lit. f DSGVO). [Speicherdauer laut Hoster.]

> **Prüfhinweis:** Prüfen, ob die Website externe Inhalte nachlädt (Schriftarten, Karten, Videos, Analyse). Wenn ja,
> ergänzen oder lokal einbinden.

## 14. Server-Protokolle

Unser Hosting-Anbieter Supabase protokolliert technische Zugriffe (IP-Adresse, Zeitpunkt, aufgerufener Dienst,
Statuscode, technische Client-Kennung), um den Betrieb sicherzustellen, Fehler zu analysieren und Angriffe abzuwehren
(Art. 6 Abs. 1 lit. f DSGVO). Die Protokolle werden nach [Anzahl] Tagen gelöscht.

> **Prüfhinweis:** Protokolldauer hängt vom Supabase-Tarif ab – im Dashboard nachsehen und eintragen.

## 15. Kontakt und Support

Wenn du uns schreibst, verarbeiten wir deine Angaben, um die Anfrage zu beantworten. Schick uns bitte **keine
Gesundheitsdaten per E-Mail**. Für Anfragen zu Auskunft, Löschung oder Export nutze bevorzugt die Funktionen in der
App (Abschnitt 20).

## 16. Speicherdauer und Löschung

Wir speichern Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist.

| Daten | Löschung |
|---|---|
| Konto (E-Mail, Profil, Spielerprofil) | bei Löschung des Kontos sofort. Inaktive Konten: Hinweis per E-Mail nach [24] Monaten ohne Anmeldung, Löschung nach weiteren [3] Monaten. |
| Gesundheitsdaten (4.6 krank/Verletzung, 4.7–4.10, 4.12) | sofort bei Löschung des Kontos; bei Widerruf der Einwilligung [sofort / innerhalb von 30 Tagen]; im Übrigen automatisch **24 Monate nach deiner letzten Aktivität** (letzte Anmeldung oder letzter Eintrag) |
| Gesundheitsdaten von Spielern, die nicht mehr aktiv im Team sind | [6] Monate nach Deaktivierung durch das Trainerteam |
| Spieler ohne Konto | bei Löschung durch das Trainerteam oder Löschung des Teams; spätestens [24] Monate nach dem letzten Eintrag |
| Teamdaten (Kalender, Wochenpläne, Einheiten, Einstellungen) | bei Löschung des Teams; inaktive Teams [24] Monate nach der letzten Aktivität nach vorheriger Benachrichtigung |
| Anwesenheit und Abwesenheiten ohne Gesundheitsbezug | mit dem Spielerprofil bzw. Team; spätestens [24] Monate nach dem Eintrag |
| Nachrichten des Trainers | [12] Monate nach Ablauf ihrer Gültigkeit |
| Trainernotizen, Potenziale | bei Löschung durch das Trainerteam, Löschung des Spielerprofils oder des Teams |
| Gruppenmitgliedschaften | sofort beim Entfernen aus der Gruppe, beim Löschen der Gruppe, des Spielerprofils oder des Teams |
| Aufgaben, Dienste und Strafen | bei Löschung durch das Trainerteam, Löschung des Spielerprofils oder des Teams; automatisch 12 Monate nach dem Datum: vergangene Dienste, erledigte oder erlassene Strafen und erledigte Aufgaben (offene Strafen bleiben, bis das Trainerteam entscheidet) |
| Ablauf des Trainingstags und Skizzen-Fotos | bei Löschung des Blocks durch das Trainerteam oder Löschung des Teams |
| Spielerentwicklung (Einschätzungen, Ziele, Fortschritt, Gespräche, interne Notizen) | bei Löschung durch das Trainerteam (eigene Selbsteinschätzungen und Ziele auch durch dich), Löschung des Spielerprofils oder des Teams |
| Wochenchallenge | mit der Challenge, dem Spielerprofil oder dem Team |
| Anfragen für Individualtraining | automatisch 12 Monate nach Abschluss (zugesagt, abgesagt, zurückgezogen); offene mit dem Spielerprofil bzw. Team |
| Chat-Nachrichten und Reaktionen | automatisch **24 Monate** nach dem Senden; sofort bei Löschung deines Kontos; gelöschte Nachrichten verlieren ihren Text sofort; Einzel- und eigene Chats auch, wenn alle Mitglieder sie verlassen |
| Meldungen im Chat | automatisch 12 Monate, nachdem das Trainerteam sie erledigt hat; deine eigenen Meldungen mit deinem Konto |
| Lesestand, „stumm“, Push-Drosselung | mit dem Konto bzw. Chat; Push-Drosselung nach 30 Tagen |
| Verein und Funktionen | Funktion beim Entfernen durch den Vereinsadmin, beim Niederlegen oder mit deinem Konto; der Verein beim Auflösen durch den Vereinsadmin (die Teams bleiben mit ihren Daten bestehen) oder wenn sein letzter Funktionär das Konto löscht; offene Anfragen mit dem Konto |
| Übernommene Daten beim Hochziehen oder Wechsel | wie die übrigen Daten des Zielteams (Spielerprofil, Gesundheitsdaten); das inaktive Profil im bisherigen Team wie inaktive Spieler |
| Matchplan | bei Löschung durch das Trainerteam oder Löschung des Teams |
| Zugriffsprotokoll des Matchplans | automatisch **6 Monate** nach dem Aufruf; mit dem Plan oder deinem Spielerprofil |
| Saisonplanung (Kaderplanung) | bei Löschung durch das Trainerteam oder des Teams; automatisch, sobald die übernächste Saison begonnen hat (die Planung für 2027/28 also ab dem 1. Juli 2029); dein Eintrag darin mit deinem Spielerprofil |
| Scouting (beobachtete Spieler und Berichte) | bei Löschung durch das Trainerteam, auf Verlangen bzw. nach Widerspruch der Person, mit dem Team; automatisch **6 Monate** nach Absage bzw. „kein Interesse“, sonst **24 Monate** nach der letzten Änderung oder dem letzten Bericht |
| Angaben zum Schmerz | wie Gesundheitsdaten (mit dem Morgen-Check-Eintrag) |
| Mannschaftskasse | Buchungen und Befreiungen bei Löschung durch Kasse/Trainerteam oder des Teams; beim Löschen eines Spielers werden Befreiungen gelöscht und Buchungen anonymisiert |
| Offline-Einträge und Stand auf dem Gerät | nach dem Senden bzw. spätestens nach 14 Tagen; der Stand beim Abmelden und Löschen des Kontos |
| Einwilligungsnachweise | für die Dauer der Verarbeitung und danach [3] Jahre (Verjährungsfrist, Nachweispflicht nach Art. 7 Abs. 1 DSGVO), danach Löschung |
| Push-Token | bei Abmeldung, wenn der Token ungültig wird, spätestens nach [6] Monaten ohne Aktualisierung |
| Zähler für KI-Anfragen | nach [30] Tagen |
| Inhalte von KI-Anfragen | bei uns keine dauerhafte Speicherung; beim Anbieter [laut Vertrag] |
| Server-Protokolle | nach [Anzahl] Tagen |
| Datensicherungen (Backups) | gelöschte Daten können bis zu [Anzahl] Tage in Sicherungen verbleiben und werden dann überschrieben |
| Support-Anfragen | [3] Jahre nach Abschluss der Anfrage, soweit keine gesetzliche Aufbewahrungspflicht besteht |
| [Rechnungs- und Buchungsunterlagen] | [gesetzliche Aufbewahrungsfristen nach § 147 AO und § 257 HGB – aktuelle Fristen prüfen] |

**Wenn du dein Konto löschst,** werden dein Konto, dein Spielerprofil und alle zugehörigen Gesundheitsdaten gelöscht.
Teamdaten, die nicht dir zugeordnet sind (z. B. Kalender), bleiben für das Team erhalten. **Löscht ein Trainer sein
Konto,** bleibt das Team mit seinen Daten für das übrige Trainerteam erhalten; [ist er der letzte Trainer, wird das
Team … – zu regeln].

> **Prüfhinweis:**
> 1. Die automatischen Löschfristen (24 Monate Inaktivität, inaktive Spieler, Nachrichten, Push-Token, KI-Zähler) sind
>    laut Architektur noch nicht implementiert – Löschroutine (z. B. zeitgesteuerte Funktion) umsetzen oder Fristen
>    anpassen.
> 2. Konflikt: `consents` wird bei Kontolöschung voraussichtlich mitgelöscht; zugleich besteht eine Nachweispflicht.
>    Klären, ob ein minimaler Nachweis (z. B. pseudonymisiert, ohne Gesundheitsdaten) aufbewahrt wird.
> 3. Verhalten bei Löschung des letzten Trainers bzw. Owners regeln (Team löschen oder Übertragung).
> 4. Backup-Aufbewahrung (tarifabhängig, Point-in-Time-Recovery) bei Supabase nachsehen.

## 17. Keine Werbung, kein Tracking, kein Verkauf

Trainerbank enthält keine Werbung, keine Tracking- oder Analyse-SDKs von Drittanbietern und kein geräteübergreifendes
Tracking. Wir erstellen keine Werbeprofile und verkaufen keine Daten.

## 18. Datensicherheit

Wir schützen deine Daten mit technischen und organisatorischen Maßnahmen, unter anderem:

- verschlüsselte Übertragung (TLS) zwischen App, Server und Dienstleistern;
- Verschlüsselung der gespeicherten Daten durch den Hosting-Anbieter;
- Speicherung in der EU (Frankfurt);
- Zugriffsregeln direkt in der Datenbank (Row Level Security): Spieler sehen nur eigene Daten, das Trainerteam nur
  sein Team;
- Rechtevergabe nach dem Prinzip der minimalen Berechtigung; geheime Schlüssel (z. B. für die KI) liegen nur auf dem
  Server, nie in der App;
- Passwörter nur als Hash;
- Team-Codes ohne leicht verwechselbare Zeichen; Codes können vom Owner jederzeit neu erzeugt werden;
- Tageslimit für den KI-Coach;
- reduzierter Datenkontext für den KI-Coach;
- Konto- und Datenlöschung sowie Datenexport direkt in der App;
- dokumentierte Einwilligungen mit Version und Zeitpunkt.

Kein System ist vollkommen sicher. Schütze dein Konto mit einem starken Passwort, das du nirgendwo sonst verwendest.

## 19. Musst du Daten angeben?

Für ein Konto brauchst du eine E-Mail-Adresse und ein Passwort; für den Beitritt als Spieler Vor- und Nachnamen und
Geburtsdatum (für die Zuordnung im Team und für altersgerechte Erholungsempfehlungen). Ohne diese Angaben kannst du die
App nicht nutzen. Alle Gesundheitsdaten, Foto, Gewicht, Push-Mitteilungen und der KI-Coach sind freiwillig.

## 20. Deine Rechte

Du hast das Recht auf:

- **Auskunft** über deine Daten (Art. 15 DSGVO),
- **Berichtigung** unrichtiger Daten (Art. 16 DSGVO),
- **Löschung** (Art. 17 DSGVO),
- **Einschränkung** der Verarbeitung (Art. 18 DSGVO),
- **Datenübertragbarkeit** (Art. 20 DSGVO),
- **Widerruf** erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO),
- **Beschwerde** bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO), z. B. bei der für uns zuständigen Behörde:
  [zuständige Aufsichtsbehörde, z. B. bei Sitz in Nordrhein-Westfalen: Landesbeauftragte für Datenschutz und
  Informationsfreiheit Nordrhein-Westfalen – Anschrift prüfen].

> **Widerspruchsrecht (Art. 21 DSGVO):** Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten (Art. 6
> Abs. 1 lit. f DSGVO), kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit
> widersprechen. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe
> nachweisen, die deine Interessen überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder
> Verteidigung von Rechtsansprüchen. Schreib dazu an [E-Mail].

**Direkt in der App:**

| Was | Wo |
|---|---|
| Eigene Daten ansehen und berichtigen | [Pfad, z. B. „Ich → Profil“] |
| Eigene Daten exportieren (JSON-Datei) | [Pfad, z. B. „Ich → Meine Daten exportieren“] |
| Einwilligungen ansehen und widerrufen | [Pfad, z. B. „Ich → Datenschutz → Einwilligungen“] |
| Konto löschen (Spieler) | „Ich → Konto löschen“ |
| Konto löschen (Trainerteam) | „Mehr → Konto löschen“ |
| Konto löschen ohne App | [Konto-Löschen-URL] |

Für alle anderen Anliegen schreib an [E-Mail]. Damit wir keine Daten an Unbefugte herausgeben, schreib bitte von der
E-Mail-Adresse deines Kontos; gegebenenfalls fragen wir nach. Wir antworten innerhalb eines Monats.

Daten, die das Trainerteam über dich erfasst hat, kannst du ebenfalls über uns berichtigen oder löschen lassen.

**Wenn ein Trainerteam dich beobachtet hat (Scouting, 4.37)**, kannst du – bei Minderjährigen deine Eltern – Auskunft,
Berichtigung und Löschung verlangen und der Verarbeitung widersprechen: beim Trainerteam bzw. Verein, der dich
informiert hat, oder bei uns unter [E-Mail]. Das Trainerteam kann die Auskunft direkt in der App erstellen und den
Eintrag mit allen Berichten löschen.
[Prüfhinweis: Bei Modell B (Verein verantwortlich) richten sich diese Anfragen an den Verein; wir leiten sie weiter.]

## 21. Änderungen dieser Datenschutzerklärung

Wir passen diese Erklärung an, wenn sich die App, Dienstleister oder die Rechtslage ändern. Die aktuelle Fassung
findest du immer unter [Datenschutz-URL] und in der App. Bei wesentlichen Änderungen – insbesondere wenn eine neue
Einwilligung erforderlich ist – informieren wir dich in der App vorab und bitten gegebenenfalls erneut um deine
Zustimmung.

Stand: [TT.MM.JJJJ] · Version [privacy-1.0]

---
---

## English version (summary)

> **DRAFT – to be reviewed by a lawyer before publication.** This English version is a short summary for
> convenience. In case of discrepancies, the German version prevails [to be verified].

**Controller:** [Herausgeber], [Anschrift], [E-Mail], [Telefon]. **Data protection officer:** [Name, E-Mail].

**What Trainerbank is:** a training-management app for football coaching staff and their players (calendar, weekly
planning, attendance, absences, load and recovery management, player self-reporting, optional AI coach). It is not a
medical device and does not provide diagnosis or treatment; recommendations are general sports-science guidance.

**Data we process:** account data (e-mail, password hash, display name, language); team membership and role; player
master data (name, date of birth, position, shirt number, optional weight and photo); team calendar, weekly plans and
sessions; attendance; absences including illness or injury and return-to-play stage; session RPE and minutes; morning
wellness (sleep hours and quality, fatigue, muscle soreness, stress, complaints and body region); extra sport; height
measurements; coach notes, potentials/goals and coach messages; derived metrics (e.g. acute:chronic workload, traffic
light); match stats (for goalkeepers also goals conceded and saves), ratings, training impressions (only "particularly good" or
"particularly weak" per session – average is not stored; criticism hidden from the player by default) and videos;
several sessions per day (e.g. athletics before team training, goalkeeper training) with RPE per session and, for
goalkeepers, the approximate number of jumps/dives (health data); performance tests and – if enabled – your own rank (never other players'
values or names, only from 5 results); medical findings (separate consent); team groups and memberships (players see
only their own membership in groups released by the staff); tasks, duties and fines from the team's catalogue
(automatic rules apply only from the day they are switched on and only check *whether* load was logged, for players
who consented); pain details per body spot (intensity, character, onset, situation, swelling/instability – health
data); team kitty (fees, your payments and exemptions, money fines, team cash book – no bank or card data, no payment
processing; players see only their own amounts and, if enabled, the total); permissions of coaching staff members
(the owner decides who sees health data, findings or the kitty – enforced on the server); entries made offline and the
last loaded state on your device (max. 14 days, deleted on sign-out); session plans, coaching points and sketch photos (staff only); consent records (incl. a parent's
e-mail address for players under 16); player development (competency profile 1–5 by the staff and as
self-assessment, measurable goals with progress, development talks with agreements and an internal staff note never
shown to the player); weekly challenges and your entries (team-mates only see participation and the team total; a
top-3 list only if the staff enables it); requests for individual sessions; chat (messages, reactions, read state,
muted chats, reports with a copy of the reported message); match plans created by the staff and an access log of when
you opened a shared match plan (platform, detected screenshots; deleted after 6 months); clubs (connected teams,
officials with role, rights and assigned teams, key figures per team without names, call-ups and transfers with an
optional copy of the last 6 weeks of load, 4 weeks of morning checks and ongoing absences – only with the health-data
right in both teams); squad planning for the next season (your planning status with a short note – visible to the
coaching staff only, like coach notes; older teams of your club see only your name, position, year of birth and team
as a possible call-up) and scouting of players who do not use the app (sporting impressions only, no health data, no
photos; they – or for minors their parents – are informed under Art. 14 GDPR; deleted 6 months after a decline,
otherwise after 24 months without activity); push tokens; AI usage counters; technical server logs. Load, wellness,
complaints and body regions, injury, illness, height and weight, rehab/load-build/growth group membership and test
results are treated as **health data** (Art. 9 GDPR).

**Legal bases:** account and app features – contract (Art. 6(1)(b)); data entered by coaching staff about players and
players without an account – legitimate interests in organising training and matches (Art. 6(1)(f)); health data and
the AI coach – explicit consent (Art. 9(2)(a), Art. 6(1)(a)); consent records – legal obligation (Art. 6(1)(c),
Art. 7(1)); squad planning and scouting – legitimate interests in planning the squad and identifying talent
(Art. 6(1)(f)); security and abuse prevention – legitimate interests (Art. 6(1)(f)); device storage – § 25(2) no. 2 TDDDG.

**Who sees what:** players see only their own data; the coaching staff of the team (owner, coach, physio) see the data
of their team's players; team-mates never see each other's data. In the chat, members of a chat see its messages
with the sender's first name and last initial. In youth teams, direct messages are only possible with the coaching
staff and staff members with the "Messages" permission can read direct messages between a coach and a player
(safeguarding, shown in the chat). Push notifications never contain the message text. Chat messages are deleted after
24 months. Shared match plans are visible to players only for the shared parts and period, shown with a name
watermark (screenshots blocked on Android, detected on iOS); the staff sees who has opened them. If your team is
connected to a club, club officials see the teams assigned to them with the rights granted by the club administrator
(by default planning and squad, no health data); the club overview shows only figures per team. Squad planning and
scouting require a separate "Scouting & squad planning" permission; players never see this area. Enforced by database
row-level security.

**Minors:** own accounts from [minimum age]; under 16, a parent or guardian must consent (we store their e-mail
address). Younger players can be managed by the coaching staff without an account.

**Processors and transfers:** Supabase (database, authentication, storage, server functions; hosted in Frankfurt,
Germany – AWS eu-central-1); Anthropic (Claude API, AI coach only with separate consent; USA); Expo (push
notifications; USA) and Apple/Google push services; [e-mail provider], [web host]. Transfers to the USA rely on the
EU-US Data Privacy Framework where the recipient is certified, otherwise on Standard Contractual Clauses [to be
verified for each provider].

**AI coach:** optional; your question plus reduced context (first name, age, training data) is sent via our server to
the Claude API; surname, date of birth, e-mail and photo are not sent. We store only a daily usage counter. AI answers
can be wrong and are not medical advice.

**Push notifications:** optional; texts contain no health details.

**No advertising, no tracking, no sale of data, no third-party analytics.**

**Retention:** health data is deleted immediately on account deletion, on withdrawal of consent [immediately /
within 30 days], and otherwise 24 months after your last activity; for further periods see the German table in
section 16.

**Your rights:** access, rectification, erasure, restriction, portability, objection (Art. 21), withdrawal of consent,
complaint to a supervisory authority. If a coaching staff has scouted you, you (or your parents) can request access,
correction or deletion and object at any time – via the club that informed you or at [E-Mail]. In the app: export your data (JSON) at [path]; delete your account at
"Ich → Konto löschen" (players) or "Mehr → Konto löschen" (coaching staff), or via [Konto-Löschen-URL]. Contact:
[E-Mail].

Status: [DD.MM.YYYY] · Version [privacy-1.0]
