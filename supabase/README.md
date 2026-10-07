# Trainerbank – Supabase-Backend

Datenbank, Zugriffsregeln, Storage und Edge Functions der App. Verbindliche Vorlage für Tabellen,
Spalten, Rollen und RLS: [`docs/ARCHITEKTUR.md`](../docs/ARCHITEKTUR.md).

## Was liegt wo

| Pfad | Inhalt |
|---|---|
| `config.toml` | Supabase-CLI-Konfiguration (Projekt `trainerbank`, Auth-Platzhalter, `verify_jwt` je Function) |
| `migrations/…01_schema.sql` | Tabellen, CHECK-Constraints, Fremdschlüssel (Cascade-Regeln), Indizes, Profil-Trigger auf `auth.users`, `push_log` |
| `migrations/…02_rls.sql` | Hilfsfunktionen (`is_team_staff` usw.), RLS auf allen Tabellen, Schutz-Trigger (`players`, `teams`, `absences`), RPE ⇒ Anwesenheit `da` |
| `migrations/…03_rpc.sql` | `create_team`, `join_team`, `join_staff`, `regenerate_codes`, `team_by_join_code`, `register_push_token`, `ai_usage_bump` (nur Server); `join_team`/`join_staff` werden in `…06` ersetzt |
| `migrations/…04_storage.sql` | Privater Bucket `avatars` (JPEG, max. 2 MB) und Policies |
| `migrations/…05_cron.sql` | `pg_cron` + `pg_net`: `push-reminders` alle 15 Minuten |
| `migrations/…06_hardening.sql` | Datenschutz-Härtung: Staff-Freigabe (`pending`), kein Auto-Verknüpfen + `merge_players`, Einwilligungen als Nachweis + Pflicht für Gesundheitsdaten, Löschfristen (`purge_stale_health_data`, täglich 03:30 UTC), Datenexport `my_data_export` |
| `functions/ai` | KI-Coach: prüft Login, Mitgliedschaft, Modul `ki`, Tageslimit; ruft die Claude API auf |
| `functions/delete-account` | Konto löschen (Fotos, verwaiste Teams, Auth-Nutzer ⇒ Cascade) |
| `functions/push-reminders` | RPE-Erinnerung nach Einheiten und Morgen-Check um 08:00 (Expo Push) |
| `functions/_shared` | CORS/JSON, Supabase-Clients, Systemprompts, Zeitlogik (ohne Abhängigkeiten) |
| `tests/run.sh` | Lokale Tests: Wegwerf-Postgres + Supabase-Platzhalter + alle Migrationen + `rls_test.sql` + Unit-Tests |

## Einrichten und Deployen

Voraussetzung: [Supabase CLI](https://supabase.com/docs/guides/cli), Projekt in **Frankfurt (eu-central-1)** anlegen
(Dashboard oder `supabase projects create trainerbank --region eu-central-1`).

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

# Datenbank: alle Migrationen einspielen
supabase db push

# Edge Functions (verify_jwt kommt aus config.toml)
supabase functions deploy ai
supabase functions deploy delete-account
supabase functions deploy push-reminders

# Secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY setzt Supabase selbst)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... CRON_SECRET=$(openssl rand -hex 32) AI_DAILY_LIMIT=40
# optional:
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5-5   # Standard
supabase secrets set EXPO_ACCESS_TOKEN=...                # nur bei aktivierter Expo Push Security
```

Im Dashboard unter Authentication → URL Configuration `site_url` und Redirect-URLs (Deep-Link-Schema der App)
eintragen – in `config.toml` stehen nur Platzhalter.

## Zeitplan für Push-Erinnerungen (einmalig, manuell)

Die Migration `…05_cron.sql` aktiviert `pg_cron`/`pg_net` und plant den Job `push-reminders` (`*/15 * * * *`).
URL und Secret stehen bewusst nicht im Repo, sondern im Vault. Einmal im SQL-Editor ausführen
(`cron_secret` = derselbe Wert wie das Secret `CRON_SECRET`):

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
```

Solange die beiden Secrets fehlen, läuft der Job ohne Wirkung. Waren `pg_cron`/`pg_net` beim `db push` nicht
verfügbar (die Migration meldet das nur per NOTICE), unter Database → Extensions aktivieren und den zweiten
`do $outer$ … $outer$`-Block aus `…05_cron.sql` sowie den `cron.schedule`-Block aus `…06_hardening.sql` im
SQL-Editor ausführen.

Zweiter Job (aus `…06_hardening.sql`): `purge-stale-health-data` täglich 03:30 UTC – löscht RPE-, Wellness- und
Zusatzsport-Einträge älter als 24 Monate sowie `push_log` und `ai_usage` älter als 30 Tage
(`select public.purge_stale_health_data();` liefert die Anzahl gelöschter Zeilen).

Kontrolle:

```sql
select jobname, schedule, active from cron.job;   -- push-reminders, purge-stale-health-data
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, content from net._http_response order by created desc limit 5;
```

Manueller Aufruf: `curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/push-reminders -H "x-cron-secret: <CRON_SECRET>"`

## Lokale Tests

```bash
supabase/tests/run.sh          # Exit 0 = alles bestanden
KEEP_DB=1 supabase/tests/run.sh   # Cluster danach laufen lassen (psql -h /tmp/claude-0/pgtest -p 54329 -U postgres trainerbank_test)
```

Braucht nur die PostgreSQL-16-Binärdateien (`PGBIN`, Standard `/usr/lib/postgresql/16/bin`) – kein Docker.
Das Skript startet einen Wegwerf-Cluster in `PGTEST_DIR` (Standard `/tmp/claude-0/pgtest`, Port `PGTEST_PORT`
54329; als root läuft Postgres als OS-Benutzer `postgres`, dafür wird bei Bedarf `o+x` auf das Elternverzeichnis
gesetzt), legt Supabase-Platzhalter an (Rollen `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`,
`storage.buckets/objects`, `storage.foldername/filename`, Default-Privileges wie bei Supabase), spielt alle
Migrationen zweimal ein (Idempotenz) und führt `rls_test.sql` aus. Die SQL-Tests wechseln die Identität wie
PostgREST (`set local role authenticated; set local request.jwt.claim.sub = '<uuid>'`). Ist Node ≥ 22.6
vorhanden, laufen zusätzlich die Unit-Tests der Edge-Function-Hilfsmodule (`functions.test.ts`).
Die Edge Functions selbst (Deno) werden lokal mit `supabase functions serve` getestet.

## Hinweise für die App

### RPCs (`supabase.rpc(name, params)`)

Fehler kommen als `error.message` (genau der angegebene Text); `consent_required` liefert zusätzlich in
`error.details` die fehlende Einwilligung (`health_data` oder `parental`).

| RPC | Rückgabe | Wer | Fehler |
|---|---|---|---|
| `create_team({ p_club, p_name, p_age_class, p_depth, p_settings, p_principles, p_modules, p_lang })` | `uuid` (Team) | angemeldet; wird Owner; `p_lang` setzt die Profilsprache | `not_authenticated`, CHECK-Verletzung |
| `join_team({ p_code, p_first_name, p_last_name, p_birthdate, p_position, p_shirt_number, p_weight_kg })` | `uuid` (Spieler) | angemeldet; legt **immer neu** an (`is_new = true`) bzw. liefert die vorhandene eigene Zeile im Team | `not_authenticated`, `invalid_code`, `invalid_name` |
| `merge_players({ p_new, p_existing })` | `uuid` (= `p_existing`) | Staff des Teams: Konto von `p_new` an die Trainer-Zeile `p_existing` hängen, Daten verschieben (bei Konflikt gewinnt `p_existing`), `p_new` löschen | `not_authenticated`, `invalid_merge`, `not_found`, `forbidden`, `different_teams`, `already_linked`, `not_linked` |
| `join_staff({ p_code })` | `uuid` (Team) | angemeldet; legt nur eine **Anfrage** (`role = 'pending'`) an, bestehende Rolle bleibt | `not_authenticated`, `invalid_code` |
| `my_pending_teams()` | `[{ team_id, club, name }]` | eigene offene Anfragen | – |
| `approve_staff({ p_team, p_user, p_role = 'coach' })` | – | Owner; `p_role` = `coach` \| `physio` | `forbidden`, `invalid_role`, `not_found` |
| `reject_staff({ p_team, p_user })` | – | Owner | `forbidden`, `not_found` |
| `team_staff_list({ p_team })` | `[{ user_id, role, display_name }]` (inkl. `pending`) | Staff | `forbidden` |
| `regenerate_codes({ p_team })` | `[{ join_code, staff_code }]` | Owner | `forbidden` |
| `team_by_join_code({ p_code })` | `[{ club, name }]` | auch ohne Login | – |
| `register_push_token({ p_token, p_platform })` | – | angemeldet (`'ios'\|'android'\|'web'`); statt Upsert, damit ein Gerät den Besitzer wechseln kann | `not_authenticated` |
| `has_consent({ p_user, p_kind })` | `boolean` | eigenes Konto bzw. Staff für eigene Spieler (sonst `false`) | – |
| `my_data_export()` | `jsonb` (Art. 15/20) | angemeldet: Profil, Einwilligungen, Staff-Rollen, Spielerzeilen, RPE, Wellness, Zusatzsport, Abwesenheiten, Anwesenheit, Wachstum, freigegebene Potenziale, Nachrichten, Push-Tokens, KI-Zähler | `not_authenticated` |

Hilfsfunktionen für Abfragen: `is_team_staff({ team })`, `is_team_member({ team })`, `is_team_owner({ team })`.

### Rollen und Beitritt

- **Staff-Beitritt** ist zweistufig: `join_staff` → Rolle `pending` (sieht nichts außer der eigenen Anfrage und
  `my_pending_teams()`) → Owner bestätigt mit `approve_staff` oder lehnt mit `reject_staff` ab. Owner-Übergabe:
  Owner setzt per `update team_staff set role = 'owner'` (RLS: nur Owner).
- **Spieler-Beitritt** verknüpft nie automatisch mit einer vom Trainer angelegten Zeile (Schutz vor
  Kontoübernahme). Die App zeigt dem Staff neue Spieler (`is_new = true`) und bietet „Zusammenführen mit …“
  (`merge_players`) an. Ein Foto `{team_id}/{p_new}.jpg` danach per Storage-API löschen.
- Clients können `players.user_id` nie auf ein Konto setzen (nur unverändert lassen oder auf `null` = lösen).

### Einwilligungen (`consents`)

- Arten: `privacy`, `health_data`, `parental`, `ai`, `staff_confidentiality`; optional `player_id` (nur eigene
  Spielerzeile), `parent_email` bei `parental`.
- `given_at` setzt der Server; Clients dürfen danach nur `withdrawn_at` setzen (Widerruf, endgültig, Serverzeit).
  Neue Einwilligung = neue Zeile. Löschen ist für Clients gesperrt.
- Nach Kontolöschung bleibt der Nachweis: `user_id = null`, `user_email_hash = sha256(lower(email))`.
- **Gesundheitsdaten, die der Spieler selbst einträgt** (`rpe_entries`, `wellness_entries`, `extra_activities`,
  Insert und Update) brauchen eine aktive `health_data`-Einwilligung; ist der Spieler laut `players.birthdate`
  jünger als 16, zusätzlich `parental`. Sonst `consent_required`. Einträge durch Staff sind nicht blockiert
  (Papier-Einwilligung im Verein). Ohne Geburtsdatum wird keine Eltern-Einwilligung verlangt.

### Sonstiges

- **Push-Daten:** `{ type: 'rpe' | 'wellness', date: 'YYYY-MM-DD' }`.
- **Wochentage für Push-Erinnerungen:** `teams.settings.days` als Array oder Objekt mit Index wie `Date.getDay()`
  (0 = Sonntag … 6 = Samstag; Objektschlüssel `'mo'…'so'` werden ebenfalls erkannt), Eintrag
  `{ zeit: 'HH:MM', dauer: <Minuten> }`; `null`/`false`/`aktiv: false` = kein Training.
  `teams.modules.rpe === false` bzw. `modules.wellness === false` schaltet die jeweilige Erinnerung ab.
- **Typen:** Uhrzeiten `text 'HH:MM'`; RPE-Werte `numeric(3,1)` 0–10; `sessions.md` `smallint` (Tagesabstand zum
  Spiel, z. B. -1 = MD-1); `content`-Felder `text`; `coach_messages.valid_until` `date`; `week_start` muss ein Montag sein.
- **Automatisch gesetzt:** `created_by` (= angemeldeter Nutzer), `team_id` bei `absences`/`attendance` (aus dem
  Spieler), bei Spielermeldungen `reported_by_player = true`. Codes und `created_by` eines Teams sind nur per RPC
  änderbar.
- **KI (`functions.invoke('ai')`)**: Antwort `{ text }`, Fehler `{ error }` mit `unauthorized` 401, `not_member` 403,
  `ki_disabled` 403, `consent_required` 403, `limit` 429, `upstream` 502 (zusätzlich `bad_request` 400,
  `internal` 500). Modus `player` verlangt eine aktive Einwilligung `kind = 'ai'` des aufrufenden Kontos
  (sonst `consent_required`); die Trainer-Modi (`coach`, `session`, `potentials`, `kind`) nicht. Modus `potentials`
  liefert Zeilen `- Kategorie: text` mit den Kategorien Athletik/Technik/Taktik/Mental/Verfügbarkeit
  (en: Athletic/Technical/Tactical/Mental/Availability) = `ath`/`tech`/`takt`/`ment`/`verf`.
- **Fotos:** Pfad `{team_id}/{player_id}.jpg` im privaten Bucket `avatars`, Anzeige per `createSignedUrl`.
  Beim Löschen einer Spielerzeile durch den Trainer das Foto per Storage-API mitlöschen (die Datenbank kann
  Storage-Dateien nicht entfernen); beim Kontolöschen erledigt das `delete-account`.
