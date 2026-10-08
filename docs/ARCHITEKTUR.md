# Trainerbank – Architektur

Trainerbank ist eine App für Fußballtrainer (Senioren bis U7) und ihre Spieler: Kalender, Wochenplanung mit
Spieltags-Prinzipien, Belastungssteuerung (Session-RPE, ACWR), Regeneration nach Alter, Anwesenheit,
Abwesenheiten, Spieler-App mit Selbsteingabe und KI-Coach.

## Bausteine

| Teil | Technik | Ordner |
|---|---|---|
| App (iOS, Android, Web) | Expo SDK + React Native + Expo Router, TypeScript | `app/`, `src/` |
| Fachlogik (ohne Abhängigkeiten) | TypeScript | `src/core/` |
| Texte DE/EN | TypeScript-Wörterbücher | `src/i18n/` |
| Datenzugriff | `@supabase/supabase-js` + Demo-Modus im Speicher | `src/data/` |
| Server | Supabase (Postgres, Auth, Storage, Edge Functions), Region Frankfurt | `supabase/` |
| KI | Edge Function `ai` ruft die Claude API serverseitig auf | `supabase/functions/ai` |
| Push | `expo-notifications` + Edge Function `push-reminders` (zeitgesteuert) | `supabase/functions/push-reminders` |

Grundsatz: Die gesamte Fachlogik (Wochenplan, Erholungsmodell, Kennzahlen, Tipps) liegt in `src/core` und kennt
weder React noch Supabase. Sie arbeitet auf einem `TeamData`-Objekt (siehe `src/core/types.ts`). Die App baut
`TeamData` aus der Datenbank (oder aus den Demo-Daten) und ruft die Logik auf.

## Rollen

- **Staff** (`team_staff.role` = `owner` | `coach` | `physio`): sieht und bearbeitet alles im Team.
- **Spieler** (`players.user_id` = eigenes Konto): sieht Teamkalender und veröffentlichten Wochenplan, nur die
  **eigenen** Gesundheitsdaten, eigene Abwesenheiten, für ihn freigegebene Potenziale und Nachrichten des Trainers.
  Spieler sehen keine Daten von Mitspielern.
- Spieler können auch ohne eigenes Konto existieren (vom Trainer angelegt). Beim Beitritt per Team-Code wird ein
  vorhandener Spieler mit gleichem Vor-/Nachnamen und Geburtsdatum verknüpft, sonst neu angelegt.

## Datenmodell (Schema `public`)

Alle IDs `uuid default gen_random_uuid()`, Zeitstempel `timestamptz default now()`, Datumsfelder `date`.

| Tabelle | Spalten | Hinweise |
|---|---|---|
| `profiles` | `id` (pk, → auth.users, cascade), `display_name`, `lang` ('de'/'en'), `created_at` | per Trigger bei Registrierung |
| `teams` | `id`, `club`, `name`, `accent`, `age_class`, `depth` ('org'/'basis'/'pro'), `settings` jsonb, `principles` jsonb, `modules` jsonb, `timezone` (default 'Europe/Berlin'), `join_code` (unique), `staff_code` (unique), `created_by` (→ auth.users, set null), `created_at` | Codes: 4–4 Zeichen, ohne verwechselbare Zeichen |
| `team_staff` | `team_id`, `user_id`, `role`, pk(team_id,user_id) | cascade |
| `players` | `id`, `team_id`, `user_id` (null, → auth.users, **cascade**), `first_name`, `last_name`, `birthdate`, `position`, `shirt_number`, `weight_kg`, `photo_path`, `is_new` bool, `active` bool, `created_at`; unique(team_id,user_id) | Konto löschen ⇒ Spielerzeile + Gesundheitsdaten weg |
| `matches` | `id`, `team_id`, `date`, `time` text 'HH:MM', `opponent`, `home` bool, `competition` ('liga'/'pokal'/'test') | |
| `team_events` | `id`, `team_id`, `date`, `time`, `title`, `type`, `replaces_training` bool | |
| `calendar_overrides` | pk(`team_id`,`date`), `cancel`, `extra`, `time`, `duration` | abgesagt / Zusatztraining |
| `plan_overrides` | pk(`team_id`,`date`), `kind`, `rpe`, `duration`, `content`, `keep_rest` | Anpassungen des Trainers |
| `week_modes` | pk(`team_id`,`week_start`), `mode` ('normal'/'aufbau'/'entlastung') | |
| `session_types` | `id`, `team_id`, `name`, `rpe`, `content` | eigene Trainingsarten (`kind` = 'c:'+id) |
| `sessions` | pk(`team_id`,`date`), `type` ('Training'/'Spiel'), `duration`, `time`, `md`, `target_rpe`, `kind` | Schnappschuss stattgefundener Einheiten |
| `week_plans` | pk(`team_id`,`week_start`), `items` jsonb, `computed_at` | vom Trainer-Client veröffentlichter Plan für Spieler |
| `attendance` | pk(`player_id`,`date`), `team_id`, `status` ('da'/'ent'/'unent') | |
| `rpe_entries` | pk(`player_id`,`date`), `rpe` 0–10, `minutes` 1–300, `created_by`, `created_at` | Trigger setzt Anwesenheit 'da', falls leer |
| `wellness_entries` | pk(`player_id`,`date`), `sleep_hours` 0–16, `sleep_quality`/`fatigue`/`soreness`/`stress` 1–7, `complaint` ('none'/'light'/'clear'), `complaint_location` | Hooper-Fragebogen |
| `extra_activities` | `id`, `player_id`, `date`, `type` ('gym'/'schule'/'lauf'/'verein'/'sonst'), `minutes`, `rpe` | Zusatzsport |
| `absences` | `id`, `team_id`, `player_id`, `type` ('urlaub'/'krank'/'verletzung'/'schule'/'arbeit'/'sonst'), `from_date`, `to_date` (null = offen), `stage` 1–4, `note`, `reported_by_player` bool, `created_by` | |
| `growth_measurements` | `id`, `player_id`, `date`, `height_cm` | |
| `potentials` | `id`, `player_id`, `category` ('ath'/'tech'/'takt'/'ment'/'verf'), `text`, `visible_to_player`, `source` ('trainer'/'daten'/'ki'), `created_by`, `created_at` | |
| `coach_messages` | `id`, `player_id`, `type` ('pause'/'regen'/'zusatz'/'prog'/'info'), `text`, `valid_until`, `created_by`, `created_at` | |
| `coach_notes` | pk(`player_id`), `text`, `updated_at` | nur Staff |
| `push_tokens` | pk(`token`), `user_id`, `platform`, `updated_at` | |
| `consents` | `id`, `user_id`, `kind` ('privacy'/'health_data'/'parental'), `version`, `parent_email`, `given_at` | Nachweis der Einwilligungen |
| `ai_usage` | pk(`user_id`,`day`), `count` | Tageslimit KI |

### Erweiterungen (Migrationen `20261008…`)

| Tabelle | Spalten (Auszug) | Zugriff |
|---|---|---|
| `extra_activities.label`, `.program_item` | freie Bezeichnung; erledigter Programm-Baustein | wie Zusatzsport |
| `match_stats` | pk(`match_id`,`player_id`), `minutes`, `goals`, `assists`, `started` | Staff; Spieler eigene, wenn `player_view(team,'stats')` |
| `player_ratings` | `id`, `player_id`, `date`, `kind` (spiel/training), `rating` 1–10, `text`, `visible` | Staff; Spieler eigene freigegebene, wenn `player_view(team,'ratings')` |
| `videos` | `id`, `title`, `url`, `date`, `match_id`, `player_ids` und `group_ids` (beide leer = ganzes Team), `note`, `visible` | Staff; Mitglieder freigegebene (für sie oder ihre Gruppe bestimmte) |
| `performance_tests` | `id`, `player_id`, `test`, `date`, `value`, `note` | Staff; Spieler eigene, wenn `player_view(team,'tests')` |
| `findings` | `id`, `player_id`, `date`, `title`, `path` (Bucket `findings`), `mime`, `consent` (app/schriftlich), `ai_text`, `ai_at` | Staff und der Spieler selbst; KI nur mit Einwilligung `findings` |
| `exercises`, `session_templates`, `staff_profiles` | Übungen mit Zeichnung (jsonb) und Coachingpunkten, Einheiten-Vorlagen, Trainerprofile | nur Staff |
| `season_phases` | `kind` (prep/break), `date_from`, `date_to`, `first_match`, `weeks` jsonb, `program` jsonb, `visible` | lesen Mitglieder, schreiben Staff |
| `team_contacts` | `name`, `role`, `org`, `phone`, `email`, `address`, `note`, `visible` | Staff; Mitglieder freigegebene, wenn `player_view(team,'contacts')` |
| `team_groups` (…0009) | `id`, `team_id`, `name`, `kind` (reha/tw/build/growth/lead/talent/custom), `visible` | Staff; Spieler nur freigegebene Gruppen, in denen sie Mitglied sind |
| `group_members` (…0009) | pk(`group_id`,`player_id`), `team_id` (Trigger aus dem Spieler, gleiches Team erzwungen) | Staff; Spieler nur die eigene Mitgliedschaft in freigegebenen Gruppen (keine Mitgliederlisten) |
| `wellness_entries.complaint_areas` (…0010) | `text[]` Körperregionen (`region` oder `region:l/r`, Format per Check), leer bei „keine Beschwerden“ | wie Wellness |
| `session_blocks` (…0011) | `date`, `sort`, `title`, `minutes`, `staff_id` (zuständiger Trainer), `exercise_id`, `text`, `points` (Coachingpunkte), `drawing`, `photo_path` (Bucket `sketches`), `group_id`, `updated_by/at` | nur Staff |
| `team_fines` (…0012) | `player_id`, `rule`, `date`, `ref_date` (Einheit der Automatik, eindeutig je Regel/Spieler), `amount`, `status` (open/done/waived), `auto`, `duty_date` | Staff; Spieler eigene |
| `team_duties` (…0012) | `date`, `duty`, `player_id`, `source` (rotation/fine/manual), `fine_id`, `status`; unique(team,date,duty,player) | Staff; Spieler eigene |
| `team_tasks` (…0012) | `title`, `note`, `due`, `staff_id` **oder** `player_id`, `group_id`, `done_at`, `done_by` | Staff; Spieler eigene und dürfen nur „erledigt“ setzen (Trigger) |
| `absences.area` (…0014) | Körperregion der Verletzung (nur bei `type = 'verletzung'`, keine Krankheitsangaben) | wie Abwesenheiten |

`player_view(team, key)` liest `teams.settings.playerView` (Baukasten) und das zugehörige Modul. Erinnerungen stehen
in `teams.settings.reminders` und werden von `push-reminders` ausgewertet. Dienste (`settings.duties`), Strafenkatalog
mit Automatik-Regeln (`settings.fines`, jede Regel mit Startdatum `since` – nie rückwirkend) und die Ranglisten-Einstellung
(`settings.testRank`: aus / eigener Platz / Platz + Teambestwert) liegen ebenfalls in `teams.settings`.

Storage-Buckets: `avatars` (Profilbilder), `findings` (Befunde, Staff + Spieler selbst), `sketches` (Fotos von
Trainingsskizzen, Pfad `{team_id}/{block_id}.jpg`, JPEG ≤ 4 MB, nur Trainerteam).

### Zugriffsregeln (RLS)

Hilfsfunktionen (`security definer`, `stable`, `search_path = public`):
`is_team_staff(team uuid)`, `is_team_member(team uuid)`, `is_own_player(pid uuid)`, `player_team(pid uuid)`,
`is_staff_of_player(pid uuid)`.

- Teamdaten (`matches`, `team_events`, `calendar_overrides`, `plan_overrides`, `week_modes`, `session_types`,
  `sessions`, `week_plans`, `teams`): lesen = Mitglied, schreiben = Staff.
- Gesundheitsdaten (`rpe_entries`, `wellness_entries`, `extra_activities`): Staff des Teams und der Spieler selbst.
- `absences`: Staff alles; Spieler liest eigene, legt eigene an (`reported_by_player = true` erzwungen) und löscht
  eigene selbst gemeldete.
- `growth_measurements`, `attendance`: Staff alles, Spieler liest eigene.
- `potentials`: Staff alles, Spieler liest eigene mit `visible_to_player`.
- `coach_messages`: Staff alles, Spieler liest eigene. `coach_notes`: nur Staff.
- `players`: Staff alles im Team; Spieler liest/ändert nur die eigene Zeile (Trigger verhindert Änderung von
  `team_id`, `user_id`, `active`, `is_new` durch Nicht-Staff).
- `push_tokens`, `profiles`, `consents`, `ai_usage`: nur eigene Zeilen (Staff darf `consents` seiner Spieler lesen).

### RPCs

- `create_team(club, name, age_class, depth, settings, principles, modules, lang)` → Team + Owner-Eintrag, Codes.
- `join_team(code, first_name, last_name, birthdate, position, shirt_number, weight_kg)` → `player_id`.
- `join_staff(code)` → Team-ID (Rolle 'coach').
- `regenerate_codes(team)` (nur Owner).
- `team_by_join_code(code)` → Vereins-/Teamname zur Anzeige vor dem Beitritt (keine weiteren Daten).
- `merge_players(new, existing)` – führt eine doppelte Spielerzeile zusammen (inkl. Gruppen, Aufgaben, Dienste, Strafen).
- `my_data_export()` – Datenexport (Art. 15/20 DSGVO), Format `trainerbank-export-v3`: Profil, Gesundheitsdaten,
  freigegebene Inhalte, eigene sichtbare Gruppen, Aufgaben, Dienste und Strafen.
- `my_test_ranks(player)` – nur für den eigenen Spieler: Platz je Test unter den aktiven Spielern (jeweils letzter
  Wert der letzten 365 Tage, ab 5 Werten) und – wenn eingestellt – der Teambestwert. Werte oder Namen anderer Spieler
  werden nie ausgegeben.

## Fachlogik (`src/core`)

- `dates.ts` – Datumshilfen (ISO-Strings, Montag, KW).
- `classes.ts` – Altersklassen, Infotiefe, Module, Standard-Prinzipien, Spieldauer.
- `engine.ts` – `createEngine(data, {today, now, lang})`: Spieltags-Bezug (MD), Wochenplan inkl. Aufbau/Entlastung,
  Erholungsmodell (9 Altersstufen), Kennzahlen (ACWR rollend 7/28), Profile, Ampel, Empfehlungen,
  Datenhinweise für Potenziale, Spieler-Status und -Tipps.
- `fixtures.ts` – Spielplan-Import (.ics und kopierter Text, z. B. fussball.de).
- `perf.ts` – Leistungstests, Normwerte je Altersgruppe, CMJ-Ermüdungscheck, Fitnessindex, Laufvorgaben aus dem 30-15 IFT.
- `prep.ts` – Vorbereitung und Pausen: Wochenaufbau (Einstieg, Aufbau, 3:1-Entlastung, Taper), Spielerprogramm,
  angebrochene Wochen, Umsetzung.
- `game.ts` – Zuverlässigkeit (Eintragsquote), Serie, Wochenringe, Meilensteine (belohnt Regelmäßigkeit, nicht
  Belastung; keine XP/Level).
- `groups.ts` – Gruppenarten, Vorschläge aus den Daten (Reha, Belastungsaufbau, Wachstumsschub …) und ihre Wirkung
  auf die Planung.
- `indiv.ts` – individuelle Zielbelastung je Spieler und Einheit (Startelf → Regeneration, wenig Spielzeit →
  Spielersatz, Reha-/Rückkehrstufe, Aufbau, Torhüter, Wachstumsschub, Beschwerden).
- `body.ts` – Körperregionen (Seite links/rechts) für Beschwerden und Verletzungen, regionsbezogene Steuerung.
- `day.ts` – Trainingstag: verfügbare Spieler, Blöcke, Zuständigkeiten.
- `duties.ts` – Dienste reihum (fair nach Gesamtzahl), Strafenkatalog mit Automatik (z. B. RPE zu spät → Dienst im
  nächsten Training), nur ab Startdatum der Regel.
- `reha.ts` – Reha-Pläne nach Region und Rückkehrstufe (kriterienbasiert).
- `demo.ts` – Demo-Mannschaft (für Demo-Modus, Tests und „Beispieldaten laden“).
- Tests: `src/core/__tests__` (`node --test`).

Wissenschaftliche Grundlagen (in den Info-Texten der App zitiert): Foster et al. 2001 (Session-RPE),
Gabbett 2016 (ACWR), Hooper & Mackinnon 1995 (Wellness), Ratel et al. 2006, Nédélec et al. 2012, Silva et al. 2018,
Fell & Williams 2008 (Erholung), Akenhead et al. 2016, Martín-García et al. 2018 (Spieltags-Logik),
Bosquet et al. 2007, Mujika 2003 (Tapering), Mujika & Padilla 2000, Bangsbo 2008 (Training in Pausen),
Buchheit 2008 (30-15 IFT), Claudino et al. 2017 (CMJ), Helgerud et al. 2001 (Intervalle), van Dyk et al. 2019, Thorborg et al. 2017, Lloyd et al. 2014 (Kraft/Prävention),
Maughan et al. 2018, Thomas et al. 2016 (Ernährung), Ardern et al. 2016 (Return to Play), Mendiguchia et al. 2017,
van der Horst et al. 2015 (Hamstrings), Vuurberg et al. 2018 (Sprunggelenk), Hölmich 2010, Harøy et al. 2019 (Leiste),
Patricios et al. 2023 (Gehirnerschütterung).
