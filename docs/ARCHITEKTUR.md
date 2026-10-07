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

## Fachlogik (`src/core`)

- `dates.ts` – Datumshilfen (ISO-Strings, Montag, KW).
- `classes.ts` – Altersklassen, Infotiefe, Module, Standard-Prinzipien, Spieldauer.
- `engine.ts` – `createEngine(data, {today, now, lang})`: Spieltags-Bezug (MD), Wochenplan inkl. Aufbau/Entlastung,
  Erholungsmodell (9 Altersstufen), Kennzahlen (ACWR rollend 7/28), Profile, Ampel, Empfehlungen,
  Datenhinweise für Potenziale, Spieler-Status und -Tipps.
- `fixtures.ts` – Spielplan-Import (.ics und kopierter Text, z. B. fussball.de).
- `demo.ts` – Demo-Mannschaft (für Demo-Modus, Tests und „Beispieldaten laden“).
- Tests: `src/core/__tests__` (`node --test`).

Wissenschaftliche Grundlagen (in den Info-Texten der App zitiert): Foster et al. 2001 (Session-RPE),
Gabbett 2016 (ACWR), Hooper & Mackinnon 1995 (Wellness), Ratel et al. 2006, Nédélec et al. 2012, Silva et al. 2018,
Fell & Williams 2008 (Erholung), Akenhead et al. 2016, Martín-García et al. 2018 (Spieltags-Logik),
Bosquet et al. 2007 (Tapering), van Dyk et al. 2019, Thorborg et al. 2017, Lloyd et al. 2014 (Kraft/Prävention),
Maughan et al. 2018, Thomas et al. 2016 (Ernährung).
