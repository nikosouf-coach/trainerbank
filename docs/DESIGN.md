# Trainerbank – Gestaltung

Leitfaden für Oberfläche und Texte. Umgesetzt in `src/ui/theme.tsx` (Farben, Schrift, Formen) und `src/ui/kit.tsx`
(Bausteine). Neue Seiten setzen sich nur aus diesen Bausteinen zusammen.

## Worum es geht

Trainerbank steuert Training und Belastung einer Fußballmannschaft. Das Trainerteam nutzt die App am Platz (Handy,
eine Hand) und abends bei der Planung (Tablet, Laptop); Spieler (11 bis 19 Jahre) tragen am Handy ein und sehen ihren
Plan. Die erste Ansicht beantwortet immer nur eine Frage: **Was ist jetzt wichtig?** Alles Weitere – Erklärung,
Wissenschaft, Vorschläge – liegt eine Ebene tiefer.

## Prinzipien

1. **Ein Blick, eine Entscheidung.** Übersichten zeigen Zustand und nächsten Schritt in wenigen Wörtern. Erklärungen
   stehen nie als Absatz auf einer Übersicht, sondern auf der Seite dahinter.
2. **Bereiche wie Linien auf dem Platz.** Struktur entsteht durch Gruppen und Abstand, nicht durch viele Kästen: Titel
   eines Bereichs steht über seiner Gruppe, darin Zeilen mit feinen Trennlinien. Jeder Bereich hat dieselbe Form:
   Übersicht → Bereich → Detailseite.
3. **Vereinsfarbe nur für das Wichtigste.** Je Seite ein kräftiges Element (z. B. die nächste Einheit) und die
   Hauptaktion. Statusfarben nur dort, wo sie Belastung oder Gesundheit bedeuten. Alles andere bleibt neutral.
4. **Zahlen vor Sätzen.** Große Ziffern (gleich breit) mit kurzer Beschriftung; Texte in Satzschreibung, keine
   Großbuchstaben-Etiketten.
5. **Tiefe auf Abruf.** Jede Detailseite folgt derselben Reihenfolge: Befund in einem Satz → Daten (Diagramm, Liste)
   → Vorschläge → „Hintergrund & Quellen“ (aufklappbar).

## Muster aus bekannten Apps

| Muster | Vorbild | Wo |
|---|---|---|
| Übersicht → Kategorie → Kennzahl mit „Was heißt das?“ und Quellen | Apple Health | Spielerprofil, Belastung im Team, Meine Daten |
| Gruppierte Listen mit Titel außerhalb der Gruppe | iOS-Einstellungen | Mehr, Bereiche im Profil, Einstellungen |
| Teamliste nach Mannschaftsteilen mit Rückennummer | Spielberichtsbogen | Kader |
| Wochenleiste mit Spieltags-Rhythmus (MD-4 … MD) | Kalender-Apps | Heute, Planung |

## Farben

Neutraltöne mit einem Hauch Grün-Grau (Kreide auf Rasen); Akzent ist die Vereinsfarbe des Teams.

| Token | Hell | Dunkel | Rolle |
|---|---|---|---|
| `bg` | `#F2F4F3` | `#0D1110` | Seitengrund |
| `surface` | `#FFFFFF` | `#161B19` | Gruppen, Karten, Leisten |
| `sunk` | `#E8ECEA` | `#202623` | Kacheln, Eingabefelder, Schieber |
| `faint` | `#8D9792` | `#6C7772` | Pfeile, Platzhalter |
| `ink` | `#121815` | `#E9EEEB` | Text |
| `muted` | `#5E6964` | `#95A19B` | Nebentext |
| `line` | `#DCE1DE` | `#2A312E` | Trennlinien, feine Ränder |

Statusfarben (Belastungszonen): Sweet Spot `ok`, Grenze `warn`, intensiv `hot`, Überlastung `crit`, unterbelastet
`low`, verletzt/krank `inj`, Termin `event`, Aufbau `build`. Im hellen Modus so dunkel gewählt, dass sie als Schrift auf
ihrer eigenen Tönung mindestens 4,5 : 1 Kontrast haben; im Dunkelmodus aufgehellt.

## Schrift

Systemschrift (iOS SF Pro, Android Roboto, Web Systemschrift): schnell, scharf, passt zur dynamischen Schriftgröße.
Charakter entsteht über Größe, Gewicht und gleich breite Ziffern.

| Rolle | Größe/Zeile | Gewicht |
|---|---|---|
| Seitentitel `h1` | 30/36 | 800, eng |
| Bereichstitel `h2` | 19/24 | 700 |
| Zeilen-/Kartentitel `h3` | 16/21 | 700 |
| Text `body` | 15/21 | 400 |
| Nebentext `small` | 13/18 | 400 |
| Kennzeichnung `eyebrow` | 12.5/16 | 600, Satzschreibung |
| Kennzahl | 30–44 | 800, gleich breite Ziffern |

## Formen nach Rolle

- Hauptelement (Hero, nächste Einheit): Vereinsfarbe, Radius 22.
- Gruppen und Karten: `surface`, Radius 16, feiner Rand, kein Schatten.
- Kacheln (Kennzahlen): Radius 14.
- Knöpfe und Auswahl-Chips: Kapselform; Hauptaktion in Vereinsfarbe, sonst getönt (auf Flächen) bzw. hell mit Rand
  (auf dem Seitengrund). Gewählte Filter in Tintenfarbe statt Vereinsfarbe.
- Eingabefelder: getönt, Radius 12, beim Tippen Rand in Vereinsfarbe. Uhrzeiten (`TimeField`): zwei Ziffernfelder,
  der Doppelpunkt steht fest dazwischen – auf dem Handy reicht die Zifferntastatur; nach der Stunde geht es von selbst
  zu den Minuten, „19“ wird beim Verlassen zu 19:00.
- Blätter (Dialoge): Radius 24 oben, runder Schließen-Knopf.

## Seiten

```
Übersicht (Reiter)                     Detailseite
┌────────────────────────────┐        ┌────────────────────────────┐
│ Di, 20. Oktober      [Logo]│        │ ‹ Heute                    │
│ Guten Abend, Nikolas       │        │ Belastung im Team          │
│ ┌────────────────────────┐ │        │ ● 13 von 23 im Sweet Spot  │
│ │ Nächste Einheit        │ │ Hero   │ ┌────────────────────────┐ │
│ │ Intensiv  19:30  RPE 8 │ │        │ │ Verteilung (Balken)    │ │
│ └────────────────────────┘ │        │ └────────────────────────┘ │
│ Heute wichtig              │        │ Überlastung                │
│ ┌────────────────────────┐ │        │ ┌────────────────────────┐ │
│ │ ⚡ 2 Spieler überlastet›│ │ Zeilen │ │ 3 Elias Kraft   1,62  ›│ │
│ │ ☰ Dienste fehlen      ›│ │        │ └────────────────────────┘ │
│ └────────────────────────┘ │        │ Vorschläge                 │
│ Belastung im Team         ›│        │ Hintergrund & Quellen  ⌄   │
└────────────────────────────┘        └────────────────────────────┘
```

Alles linksbündig; Werte in Zeilen rechtsbündig (Werte brechen nie um, Bezeichnungen dürfen es). Auf breiten
Bildschirmen stehen Bereiche in zwei Spalten: „Heute“ (ab 1000 px, nächste Einheit über die ganze Breite), Planung (ab
1100 px: Wochenprofil links – bleibt beim Blättern durch die Tage stehen –, Tage rechts), Spielerprofil und
Kader-Linien (ab 900 px). Detailseiten behalten eine Lesebreite von etwa 780 px.

Datumsspalte (Planung, Kalender): Wochentag klein, Tag groß, Spieltags-Abstand (MD-4 … MD) darunter – auf einen Blick
scanbar wie in Kalender-Apps.

## Zeichentool (Matchplan-Folien, Übungsskizzen)

```
┌────────────────────────────┐
│ [Fertig] Titel    ↶  ↷  ⋯ │  Kopf: Mehr = Präsentieren, Folie wechseln, Ausschnitt, Notizen, Einstellungen
│ ┌────────────────────────┐ │
│ │                        │ │
│ │     Tafel (so groß     │ │  nichts scrollt – Zeichnen und Ziehen gehören dem Finger
│ │      wie möglich)      │ │
│ └────────────────────────┘ │
│ ↗ Pass  Vom Start zum Ziel │  Ebene 2: was gezeichnet wird, Hinweis
│ [→][⇢][⋯][〰] │ [↷✦][∿]    │  Optionen als Muster (Linie | Verlauf automatisch/frei)
│ [─][━][▬] │ ○ ● ● ● ● ● ●  │  (Stärke | Farbe) – feste Höhe, die Tafel springt nie
│ ───────────────────────────│
│ ↖  ●●  ↗  ╱  ▢  ▲  T       │  Ebene 1: Auswahl, Spieler, Pfeile, Linien, Formen, Material, Text
└────────────────────────────┘
```

Erst die Art, dann ihre Optionen – nie mehr als zwei Ebenen. Pfeile malt man mit dem Finger, die App macht daraus
eine saubere Form (gerade oder gleichmäßiger Bogen) – zeichnen soll sich anfühlen wie auf der Taktiktafel, nur ordentlicher. Optionen zeigen, wie das Ergebnis aussieht (Linienmuster,
Stärke, Farbpunkt), statt es zu beschreiben; die gewählte hat den Rahmen in Vereinsfarbe, die Zeile darüber nennt sie
in Worten („Laufweg · gestrichelt“). Arten mit nur einer Reihe Optionen (Auswahl, Spieler) zeigen große Kacheln.
Alles passt in die Breite (ab 320 pt, die Schrift der Arten passt sich an), nichts scrollt waagerecht. Ist ein
Element ausgewählt, zeigt Ebene 2 seine Optionen samt Mehr, Kopieren, Löschen und Fertig. Tablet hochkant: Leiste
mittig, höchstens 480 breit; ab 900 px rechts eine Seitenleiste mit Überschriften je Gruppe („Linie · gepunktet“).

## Statistik (Tabelle)

```
┌────────────────────────────────────┐
│ Statistik ⓘ            [Exportieren]│
│ 23 Spieler · 4 Wochen (19.09.–16.10.)│
│ (7 Tage)(4 Wochen)(Saison)          │  Zeitraum
│ (Alle)(Tor 2)(Abwehr 7)(Mittelfeld… │  Spieler: Mannschaftsteile, Gruppen
│ (Überblick)(Training)(Bel… [Anpassen]│  Ansicht bzw. eigene Kennzahlen
│ ┌──────────┬───────────────────────┐│
│ │Spieler   │Beteiligung  Ø RPE  Sp…││  Kopf antippen: sortieren (▼/▲)
│ │Team      │      89 %    5,9   7,…││  Teamzeile: Ø bzw. Σ
│ │1 Brenner │      93 %    5,7   7,…││  Name bleibt stehen,
│ │  Luca·TW │  14 von 15            ││  Kennzahlen scrollen seitlich
│ └──────────┴───────────────────────┘│
└────────────────────────────────────┘
```

Zahlen rechtsbündig mit gleich breiten Ziffern, darunter klein, worauf sie beruhen („14 von 15“, Veränderung zum
letzten Test, Datum). Farbe nur für Auffälliges – dieselben Statusfarben wie in der Belastung (Rot kritisch, Orange
auffällig, Blau niedrig, Grün gut), Spielnoten in ihren Notenfarben; die sortierte Spalte ist leicht hinterlegt. Am
Handy steht der Nachname oben, Vorname und Position darunter; am Laptop füllt die Tabelle die Breite. „–“ heißt
„keine Daten“, nie 0. Im Kader steht rechts der gewählte Wert; der Knopf neben den Filtern nennt ihn
(„ACWR · aktuell“, „Beteiligung · Saison“) und öffnet die Auswahl mit Zeitraum.

## Bausteine (`src/ui/kit.tsx`)

- `Screen` – Seite; `narrow` für Detailseiten (Lesebreite auf Tablet/Laptop).
- `Header` – Seitentitel, optional Zeile darüber (`eyebrow`), Befund darunter (`sub`, mit Statuspunkt `subColor`),
  Zurück-Link (`onBack`, Ziel als Beschriftung).
- `Section` – Bereich: Titel (+ Info, Aktion rechts, Statuspunkt) über einer Gruppe; `plain` ohne Fläche, `pad` mit
  Innenabstand, `quiet` mit leisem Titel (lange Menüs).
- `Group` – Fläche mit Zeilen; Trennlinien beginnen beim Text (Zeilen geben ihren Einzug über `sepInset` an).
- `NavRow` – Zeile, die zu einer Seite führt: Symbol, Titel, eine Zeile Nebentext, Wert oder Zahl, Pfeil. `MoreRow` für
  „Weitere anzeigen“.
- `PlayerRow` (`src/ui/squad`) – Spieler wie auf dem Spielberichtsbogen: Rückennummer, Bild mit Statuspunkt, Name,
  Position und Alter, nur Auffälliges benannt, Wert rechts.
- `Metric` / `Metrics` – Kennzahl-Kacheln (bis zu drei nebeneinander, vier am Handy als 2 × 2), antippbar.
- `Tips`, `Explain`, `Background` – Bausteine der Detailseiten; `WikiBackground` (`src/ui/insight.tsx`) füllt
  „Hintergrund & Quellen“ aus den Wiki-Einträgen.
- `Card` – beginnt sie mit `CardTitle`, steht der Titel automatisch über der Fläche (wie bei `Section`); `PageTitle`
  blendet einen Kartentitel aus, der dem Seitentitel entspricht.
- `Btn`, `Seg`, `ChoiceChips`, `Chip`, `Field`, `Picker`, `Sheet`, `Banner` … passen ihre Füllung der Fläche an, auf
  der sie liegen (Seitengrund, Gruppe, Kachel).

## Texte

- Satzschreibung, aktive Verben, kurze Wörter. Eine Zeile Nebentext, nicht zwei.
- Beschriftungen beginnen immer groß: `Chip`, `Tag`, `Field`, `Picker`, `ToggleRow`, `Seg` und `ChoiceChips` setzen
  das selbst um (`cap`), weil manche Wörterbuch-Texte auch mitten im Satz stehen („bis“, „angepasst“).
- Aktionen heißen überall gleich („Speichern“ → „Gespeichert“).
- Leere Bereiche sagen, was man tun kann („Noch keine Tests – Wert eintragen“).
- Erklärungen, Studien und Rechenwege gehören auf Detailseiten oder in „Hintergrund & Quellen“.
