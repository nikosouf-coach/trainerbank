-- =====================================================================
-- Trainerbank – RLS-/RPC-Tests (ausgeführt von supabase/tests/run.sh)
--
-- Identitätswechsel wie bei PostgREST:
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<uuid>';
-- Jede Prüfung meldet "PASS: …" bzw. "FAIL: …" (NOTICE) und landet in
-- tst.results. Am Ende bricht das Skript mit Fehler ab, wenn etwas
-- fehlgeschlagen ist.
-- =====================================================================
\set ON_ERROR_STOP 1
\o /dev/null
set client_min_messages = notice;

\set coachA 'a0000000-0000-4000-8000-00000000000a'
\set coachB 'b0000000-0000-4000-8000-00000000000b'
\set coachC 'c0000000-0000-4000-8000-00000000000c'
\set p1     '10000000-0000-4000-8000-000000000001'
\set p2     '20000000-0000-4000-8000-000000000002'
\set p3     '30000000-0000-4000-8000-000000000003'
\set p4     '40000000-0000-4000-8000-000000000004'

-- ---------------------------------------------------------------------
-- Test-Infrastruktur (Schema tst)
-- ---------------------------------------------------------------------
create schema tst;
grant usage on schema tst to public;

create table tst.results (id serial primary key, name text not null, ok boolean not null, detail text);
create table tst.ctx     (key text primary key, val text);
create table tst.users   (name text primary key, id uuid not null unique);

create function tst.record(p_name text, p_ok boolean, p_detail text default null)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
begin
  insert into tst.results (name, ok, detail) values (p_name, p_ok, p_detail);
  if p_ok then
    raise notice 'PASS: %', p_name;
  else
    raise notice 'FAIL: %  [%]', p_name, coalesce(p_detail, '-');
  end if;
end
$$;

create function tst.ok(p_cond boolean, p_name text)
returns void language plpgsql
as $$
begin
  perform tst.record(p_name, coalesce(p_cond, false),
                     case when p_cond is null then 'condition is NULL' when not p_cond then 'condition is false' end);
end
$$;

create function tst.eq(p_actual text, p_expected text, p_name text)
returns void language plpgsql
as $$
begin
  perform tst.record(p_name, p_actual is not distinct from p_expected,
                     format('expected %s, got %s', coalesce(p_expected, 'NULL'), coalesce(p_actual, 'NULL')));
end
$$;

-- Erwartet einen Fehler; optional muss der Fehlertext p_like enthalten
create function tst.throws(p_sql text, p_name text, p_like text default null)
returns void language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is null or sqlerrm ilike '%' || p_like || '%' then
      perform tst.record(p_name, true, sqlerrm);
    else
      perform tst.record(p_name, false, 'unexpected error: ' || sqlerrm);
    end if;
    return;
  end;
  perform tst.record(p_name, false, 'no error raised');
end
$$;

-- Erwartet genau p_rows betroffene Zeilen (RLS filtert UPDATE/DELETE stillschweigend)
create function tst.affects(p_sql text, p_rows int, p_name text)
returns void language plpgsql
as $$
declare
  n int;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    perform tst.record(p_name, false, 'error: ' || sqlerrm);
    return;
  end;
  perform tst.record(p_name, n = p_rows, format('expected %s rows, got %s', p_rows, n));
end
$$;

create function tst.put(p_key text, p_val text)
returns void language sql security definer set search_path = pg_catalog
as $$
  insert into tst.ctx (key, val) values (p_key, p_val)
  on conflict (key) do update set val = excluded.val;
$$;

create function tst.get(p_key text)
returns text language sql stable security definer set search_path = pg_catalog
as $$ select val from tst.ctx where key = p_key $$;

create function tst.uid(p_name text)
returns uuid language sql stable security definer set search_path = pg_catalog
as $$ select id from tst.users where name = p_name $$;

-- ---------------------------------------------------------------------
-- Testkonten
-- ---------------------------------------------------------------------
insert into tst.users (name, id) values
  ('coachA', :'coachA'), ('coachB', :'coachB'), ('coachC', :'coachC'),
  ('p1', :'p1'), ('p2', :'p2'), ('p3', :'p3'), ('p4', :'p4');

insert into auth.users (id, email, raw_user_meta_data)
select id, name || '@test.local',
       case name
         when 'coachA' then '{"display_name": "Coach A", "lang": "de"}'
         when 'coachB' then '{"display_name": "Coach B", "lang": "en"}'
         when 'p1'     then '{"display_name": "Max", "lang": "fr"}'
         else '{}'
       end::jsonb
from tst.users;

-- =====================================================================
-- T01 Profil-Trigger
-- =====================================================================
do $$
begin
  perform tst.eq((select count(*) from public.profiles)::text, '7',
                 'T01 Profil-Trigger legt für jedes neue Konto ein Profil an');
  perform tst.eq((select display_name || '/' || lang from public.profiles where id = tst.uid('coachB')),
                 'Coach B/en', 'T01 display_name und lang aus raw_user_meta_data');
  perform tst.eq((select display_name || '/' || lang from public.profiles where id = tst.uid('p1')),
                 'Max/de', 'T01 ungültige Sprache fällt auf de zurück');
  perform tst.eq((select coalesce(display_name, '<null>') || '/' || lang from public.profiles where id = tst.uid('coachC')),
                 '<null>/de', 'T01 ohne Metadaten: display_name null, lang de');
end
$$;

-- =====================================================================
-- T02 create_team durch Coach A
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';

select tst.put('team_a', public.create_team(
  'SG Essen-Schönebeck', 'U19', 'u19', 'pro',
  '{"days": {"2": {"zeit": "18:30", "dauer": 90}}}'::jsonb, '{}'::jsonb, '{"ki": true}'::jsonb, 'en')::text);

do $$
declare
  v_team uuid := tst.get('team_a')::uuid;
  r public.teams;
begin
  select * into r from public.teams where id = v_team;
  perform tst.ok(r.id is not null, 'T02 Coach A sieht sein neu angelegtes Team');
  perform tst.ok(r.join_code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$',
                 'T02 join_code im Format XXXX-XXXX ohne 0/O/1/I/L');
  perform tst.ok(r.staff_code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' and r.staff_code <> r.join_code,
                 'T02 staff_code gültig und verschieden vom join_code');
  perform tst.eq(r.created_by::text, tst.uid('coachA')::text, 'T02 created_by = Ersteller');
  perform tst.eq(r.timezone, 'Europe/Berlin', 'T02 Standard-Zeitzone Europe/Berlin');
  perform tst.eq(r.modules ->> 'ki', 'true', 'T02 Module übernommen');
  perform tst.eq((select role from public.team_staff where team_id = v_team and user_id = tst.uid('coachA')),
                 'owner', 'T02 Owner-Eintrag in team_staff');
  perform tst.eq((select lang from public.profiles where id = tst.uid('coachA')), 'en',
                 'T02 p_lang setzt die Profilsprache des Erstellers');
end
$$;

select tst.throws($q$select public.create_team('X', 'Y', 'u19', 'falsch', '{}', '{}', '{}', 'de')$q$,
                  'T02 create_team prüft depth (CHECK)', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '';
select tst.throws($q$select public.create_team('X', 'Y', 'u19', 'basis', '{}', '{}', '{}', 'de')$q$,
                  'T02 create_team ohne Login abgelehnt', 'not_authenticated');
commit;

-- =====================================================================
-- T03 Coach A bearbeitet sein Team und legt Kader + Teamdaten an
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';

select tst.affects(format($q$update public.teams set name = 'U19 Junioren', accent = '#0a7' where id = %L$q$,
                          tst.get('team_a')), 1, 'T03 Coach A ändert sein Team');
select tst.throws(format($q$update public.teams set join_code = 'AAAA-BBBB' where id = %L$q$, tst.get('team_a')),
                  'T03 Codes sind nicht direkt änderbar (nur regenerate_codes)', 'forbidden');
select tst.throws(format($q$update public.teams set timezone = 'Mars/Olympus' where id = %L$q$, tst.get('team_a')),
                  'T03 ungültige Zeitzone wird abgelehnt', 'invalid_timezone');

with ins as (
  insert into public.players (team_id, first_name, last_name, birthdate)
  values (tst.get('team_a')::uuid, 'Max', 'Muster', '2007-05-01')
  returning id
) select tst.put('max', id::text) from ins;
with ins as (
  insert into public.players (team_id, first_name, last_name, birthdate, position, shirt_number)
  values (tst.get('team_a')::uuid, 'Erik', 'Beispiel', '2007-03-03', 'IV', 4)
  returning id
) select tst.put('erik', id::text) from ins;
with ins as (
  insert into public.players (team_id, first_name, last_name, birthdate)
  values (tst.get('team_a')::uuid, 'Tom', 'Ohnekonto', '2006-01-01')
  returning id
) select tst.put('tom', id::text) from ins;

select tst.affects(format($q$insert into public.matches (team_id, date, time, opponent, home, competition)
                             values (%L, '2026-10-10', '15:00', 'TuS Gegner', true, 'liga')$q$, tst.get('team_a')),
                   1, 'T03 Coach legt Spiel an');
select tst.affects(format($q$insert into public.team_events (team_id, date, time, title, type)
                             values (%L, '2026-10-08', '19:00', 'Teamabend', 'team')$q$, tst.get('team_a')),
                   1, 'T03 Coach legt Termin an');
select tst.affects(format($q$insert into public.week_plans (team_id, week_start, items)
                             values (%L, '2026-10-05', '[{"date": "2026-10-05", "kind": "kraft"}]')$q$, tst.get('team_a')),
                   1, 'T03 Coach veröffentlicht Wochenplan');
select tst.affects(format($q$insert into public.sessions (team_id, date, type, duration, time, md, target_rpe, kind)
                             values (%L, '2026-10-05', 'Training', 90, '18:30', -5, 6, 'kraft')$q$, tst.get('team_a')),
                   1, 'T03 Coach speichert Einheit (Schnappschuss)');
select tst.affects(format($q$insert into public.session_types (team_id, name, rpe, content)
                             values (%L, 'Kraft-Zirkel', 6, 'Zirkel mit 8 Stationen')$q$, tst.get('team_a')),
                   1, 'T03 Coach legt Trainingsart an');
select tst.affects(format($q$insert into public.calendar_overrides (team_id, date, cancel)
                             values (%L, '2026-10-07', true)$q$, tst.get('team_a')),
                   1, 'T03 Coach sagt Training ab');
select tst.affects(format($q$insert into public.plan_overrides (team_id, date, kind, rpe, duration, content)
                             values (%L, '2026-10-08', 'regen', 3, 60, 'locker')$q$, tst.get('team_a')),
                   1, 'T03 Coach passt Plan an');
select tst.affects(format($q$insert into public.week_modes (team_id, week_start, mode)
                             values (%L, '2026-10-05', 'aufbau')$q$, tst.get('team_a')),
                   1, 'T03 Coach setzt Wochenmodus');
select tst.throws(format($q$insert into public.week_modes (team_id, week_start, mode)
                            values (%L, '2026-10-06', 'normal')$q$, tst.get('team_a')),
                  'T03 week_start muss ein Montag sein', 'check constraint');
select tst.affects(format($q$insert into public.coach_notes (player_id, text) values (%L, 'Knie beobachten')$q$,
                          tst.get('max')), 1, 'T03 Coach schreibt interne Notiz');

do $$
begin
  perform tst.eq((select count(*) from public.players where team_id = tst.get('team_a')::uuid)::text, '3',
                 'T03 Coach sieht seinen Kader');
end
$$;
commit;

-- =====================================================================
-- T04 Coach B (anderes Team) sieht nichts von Team A
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';

select tst.put('team_b', public.create_team('FC Anders', 'U17', 'u17', 'basis', '{}', '{}', '{}', 'en')::text);

do $$
declare
  a uuid := tst.get('team_a')::uuid;
begin
  perform tst.eq((select count(*) from public.teams)::text, '1', 'T04 Coach B sieht nur sein eigenes Team');
  perform tst.eq((select count(*) from public.teams where id = a)::text, '0', 'T04 Coach B sieht Team A nicht');
  perform tst.eq((select count(*) from public.players where team_id = a)::text, '0', 'T04 Coach B sieht keine Spieler von Team A');
  perform tst.eq((select count(*) from public.team_staff where team_id = a)::text, '0', 'T04 Coach B sieht Trainerteam A nicht');
  perform tst.eq((select count(*) from public.matches where team_id = a)::text, '0', 'T04 Coach B sieht keine Spiele von Team A');
  perform tst.eq((select count(*) from public.team_events where team_id = a)::text, '0', 'T04 Coach B sieht keine Termine von Team A');
  perform tst.eq((select count(*) from public.week_plans where team_id = a)::text, '0', 'T04 Coach B sieht keine Wochenpläne von Team A');
  perform tst.eq((select count(*) from public.sessions where team_id = a)::text, '0', 'T04 Coach B sieht keine Einheiten von Team A');
  perform tst.eq((select count(*) from public.coach_notes)::text, '0', 'T04 Coach B sieht keine Notizen von Team A');
  perform tst.ok(not public.is_team_member(a), 'T04 is_team_member(Team A) = false für Coach B');
end
$$;

select tst.affects(format($q$update public.teams set name = 'gehackt' where id = %L$q$, tst.get('team_a')),
                   0, 'T04 Coach B kann Team A nicht ändern');
select tst.affects(format($q$delete from public.matches where team_id = %L$q$, tst.get('team_a')),
                   0, 'T04 Coach B kann Spiele von Team A nicht löschen');
select tst.affects(format($q$update public.players set active = false where team_id = %L$q$, tst.get('team_a')),
                   0, 'T04 Coach B kann Spieler von Team A nicht ändern');
select tst.throws(format($q$insert into public.matches (team_id, date) values (%L, '2026-10-11')$q$, tst.get('team_a')),
                  'T04 Coach B kann keine Spiele in Team A anlegen', 'row-level security');
select tst.throws(format($q$insert into public.players (team_id, first_name) values (%L, 'Spion')$q$, tst.get('team_a')),
                  'T04 Coach B kann keine Spieler in Team A anlegen', 'row-level security');
select tst.throws(format($q$insert into public.coach_notes (player_id, text) values (%L, 'x')$q$, tst.get('erik')),
                  'T04 Coach B kann keine Notizen zu Spielern von Team A anlegen', 'row-level security');
select tst.throws(format($q$select public.regenerate_codes(%L)$q$, tst.get('team_a')),
                  'T04 Coach B kann Codes von Team A nicht erneuern', 'forbidden');
select tst.throws($q$insert into public.teams (club, name, age_class, join_code, staff_code)
                     values ('X', 'Y', 'u19', 'ABCD-EFGH', 'HGFE-DCBA')$q$,
                  'T04 Teams nur per RPC anlegbar', 'row-level security');
commit;

-- Codes für die folgenden Tests merken (als Superuser gelesen)
select tst.put('join_a', join_code), tst.put('staff_a', staff_code)
from public.teams where id = tst.get('team_a')::uuid;

-- =====================================================================
-- T05 join_team (ohne automatisches Verknüpfen)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';

select tst.throws($q$select public.join_team('ZZZZ-ZZZZ', 'Max', 'Muster', '2007-05-01', null, null, null)$q$,
                  'T05 join_team mit falschem Code schlägt fehl', 'invalid_code');
select tst.throws($q$select public.join_team('', 'Max', 'Muster', '2007-05-01', null, null, null)$q$,
                  'T05 join_team mit leerem Code schlägt fehl', 'invalid_code');
select tst.throws(format($q$select public.join_team(%L, '  ', 'Muster', null, null, null, null)$q$, tst.get('join_a')),
                  'T05 join_team ohne Vornamen schlägt fehl', 'invalid_name');

do $$
begin
  perform tst.eq((select count(*) from public.team_by_join_code('ZZZZ-ZZZZ'))::text, '0',
                 'T05 team_by_join_code: falscher Code liefert nichts');
  perform tst.eq((select club || ' / ' || name from public.team_by_join_code(lower(replace(tst.get('join_a'), '-', ' ')))),
                 'SG Essen-Schönebeck / U19 Junioren',
                 'T05 team_by_join_code liefert Verein/Team (Groß-/Kleinschreibung, Leerzeichen egal)');
  perform tst.eq((select count(*) from public.teams)::text, '0', 'T05 vor dem Beitritt sieht P1 kein Team');
end
$$;

-- P1 gibt exakt Name + Geburtsdatum des vom Trainer angelegten "Max Muster" an
select tst.put('p1_player', public.join_team(lower(replace(tst.get('join_a'), '-', '  ')),
                                            '  Max ', 'Muster', '2007-05-01', 'ZM', 8, 72.5)::text);

do $$
declare
  r public.players;
begin
  perform tst.ok(tst.get('p1_player') <> tst.get('max'),
                 'T05 kein automatisches Verknüpfen: P1 erhält eine neue Spielerzeile (Schutz vor Kontoübernahme)');
  select * into r from public.players where id = tst.get('p1_player')::uuid;
  perform tst.eq(r.user_id::text, tst.uid('p1')::text, 'T05 neue Zeile gehört P1');
  perform tst.ok(r.is_new, 'T05 neue Zeile ist is_new');
  perform tst.eq(r.first_name || ' ' || r.last_name || '/' || r.position || '/' || r.shirt_number || '/' || r.weight_kg,
                 'Max Muster/ZM/8/72.5', 'T05 Angaben des Spielers werden übernommen');
  perform tst.eq(public.join_team(tst.get('join_a'), 'Ganz', 'Anders', null, null, null, null)::text, tst.get('p1_player'),
                 'T05 erneuter Beitritt liefert die vorhandene Spielerzeile');
  perform tst.eq((select count(*) from public.players where id = tst.get('max')::uuid)::text, '0',
                 'T05 P1 sieht die gleichnamige Trainer-Zeile nicht');
  perform tst.eq((select count(*) from public.teams)::text, '1', 'T05 nach dem Beitritt sieht P1 sein Team');
  perform tst.eq((select count(*) from public.players)::text, '1', 'T05 P1 sieht nur die eigene Spielerzeile');
  perform tst.ok(public.is_team_member(tst.get('team_a')::uuid), 'T05 is_team_member(Team A) = true für P1');
  perform tst.ok(not public.is_team_staff(tst.get('team_a')::uuid), 'T05 P1 ist kein Staff');
  perform tst.ok(not public.is_team_member(tst.get('team_b')::uuid), 'T05 P1 ist kein Mitglied von Team B');
  perform tst.eq((select count(*) from public.team_staff)::text, '0', 'T05 P1 sieht das Trainerteam nicht');
end
$$;
commit;

do $$
begin
  perform tst.ok((select user_id from public.players where id = tst.get('max')::uuid) is null,
                 'T05 vom Trainer angelegter Max Muster bleibt unverknüpft');
end
$$;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
select tst.put('p2_player', public.join_team(tst.get('join_a'), 'Paul', 'Neu', '2008-02-02', 'ST', 9, 68)::text);
do $$
begin
  perform tst.ok((select is_new from public.players where id = tst.get('p2_player')::uuid),
                 'T05 unbekannter Spieler wird mit is_new = true angelegt');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p3';
select tst.put('p3_player', public.join_team(tst.get('join_a'), 'Erik', 'Beispiel', '2007-03-03', null, null, null)::text);
commit;

do $$
begin
  perform tst.ok(tst.get('p3_player') <> tst.get('erik')
                 and (select user_id from public.players where id = tst.get('erik')::uuid) is null,
                 'T05 auch exakt gleicher Name + Geburtsdatum verknüpft nicht automatisch');
end
$$;

-- =====================================================================
-- T05b Einwilligungen und serverseitige Prüfung für Gesundheitsdaten
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-04', 6, 90)$q$,
                         tst.get('p1_player')),
                  'T05b RPE ohne Einwilligung wird abgelehnt', 'consent_required');
select tst.affects($q$insert into public.consents (kind, version, given_at) values ('privacy', '2026-10', '2020-01-01')$q$,
                   1, 'T05b P1 willigt in die Datenschutzerklärung ein');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, fatigue) values (%L, '2026-10-04', 3)$q$,
                         tst.get('p1_player')),
                  'T05b Datenschutz-Einwilligung allein genügt nicht für Gesundheitsdaten', 'consent_required');
select tst.throws(format($q$insert into public.consents (kind, version, player_id) values ('health_data', '2026-10', %L)$q$,
                         tst.get('p2_player')),
                  'T05b Einwilligung mit fremder Spielerzeile wird abgelehnt', 'row-level security');
select tst.affects(format($q$insert into public.consents (kind, version, player_id) values ('health_data', '2026-10', %L)$q$,
                          tst.get('p1_player')),
                   1, 'T05b P1 willigt in die Verarbeitung von Gesundheitsdaten ein');
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-04', 6, 90)$q$,
                          tst.get('p1_player')), 1, 'T05b mit Einwilligung: RPE gespeichert');
select tst.affects(format($q$insert into public.wellness_entries (player_id, date, fatigue) values (%L, '2026-10-04', 3)$q$,
                          tst.get('p1_player')), 1, 'T05b mit Einwilligung: Wellness gespeichert');
do $$
begin
  perform tst.ok((select bool_and(given_at > now() - interval '1 hour') from public.consents),
                 'T05b given_at wird serverseitig gesetzt (kein Rückdatieren)');
  perform tst.eq((select min(user_email_hash) from public.consents),
                 encode(sha256(convert_to('p1@test.local', 'UTF8')), 'hex'),
                 'T05b user_email_hash = sha256(lower(E-Mail)) per Trigger');
  perform tst.ok(public.has_consent(tst.uid('p1'), 'health_data'), 'T05b has_consent(eigenes Konto, health_data) = true');
  perform tst.ok(not public.has_consent(tst.uid('p1'), 'parental'), 'T05b has_consent(eigenes Konto, parental) = false');
end
$$;
select tst.throws($q$update public.consents set kind = 'ai' where kind = 'privacy'$q$,
                  'T05b Art einer Einwilligung ist nicht änderbar', 'forbidden');
select tst.throws($q$delete from public.consents$q$, 'T05b Einwilligungen können vom Nutzer nicht gelöscht werden', 'permission denied');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
select tst.affects($q$insert into public.consents (kind, version) values ('health_data', '2026-10')$q$, 1,
                   'T05b P2 willigt in Gesundheitsdaten ein');
do $$
begin
  perform tst.ok(not public.has_consent(tst.uid('p1'), 'health_data'),
                 'T05b has_consent gibt keine Auskunft über fremde Konten');
end
$$;
commit;

-- P4 ist 14 Jahre alt: zusätzlich Eltern-Einwilligung nötig
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p4';
select tst.put('p4_player', public.join_team(tst.get('join_a'), 'Lena', 'Jung', '2012-01-01', null, null, null)::text);
select tst.affects($q$insert into public.consents (kind, version) values ('health_data', '2026-10')$q$, 1,
                   'T05b P4 (14) willigt in Gesundheitsdaten ein');
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-06', 5, 60)$q$,
                         tst.get('p4_player')),
                  'T05b unter 16 ohne Eltern-Einwilligung abgelehnt', 'consent_required');
select tst.affects($q$insert into public.consents (kind, version, parent_email) values ('parental', '2026-10', 'eltern@example.org')$q$,
                   1, 'T05b Eltern-Einwilligung für P4');
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-06', 5, 60)$q$,
                          tst.get('p4_player')), 1, 'T05b unter 16 mit Eltern-Einwilligung: RPE gespeichert');
select tst.affects($q$update public.consents set withdrawn_at = '2000-01-01' where kind = 'parental'$q$, 1,
                   'T05b Eltern-Einwilligung widerrufen');
do $$
begin
  perform tst.ok((select withdrawn_at > now() - interval '1 hour' from public.consents where kind = 'parental'),
                 'T05b withdrawn_at = Serverzeit');
  perform tst.ok(not public.has_consent(tst.uid('p4'), 'parental'), 'T05b widerrufene Einwilligung zählt nicht');
end
$$;
select tst.throws($q$update public.consents set withdrawn_at = null where kind = 'parental'$q$,
                  'T05b Widerruf ist endgültig', 'forbidden');
select tst.throws(format($q$update public.rpe_entries set rpe = 3 where player_id = %L$q$, tst.get('p4_player')),
                  'T05b nach Widerruf: Ändern der RPE abgelehnt', 'consent_required');
select tst.throws(format($q$insert into public.extra_activities (player_id, date, type, minutes) values (%L, '2026-10-06', 'lauf', 30)$q$,
                         tst.get('p4_player')),
                  'T05b nach Widerruf: Zusatzsport abgelehnt', 'consent_required');
commit;

-- Staff-Einträge sind nicht an die App-Einwilligung gebunden (Papier-Einwilligung im Verein)
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-06', 6, 90)$q$,
                          tst.get('tom')), 1, 'T05b Staff trägt RPE für Spieler ohne Konto ein');
select tst.affects(format($q$update public.rpe_entries set rpe = 4 where player_id = %L$q$, tst.get('p4_player')), 1,
                   'T05b Staff darf RPE trotz fehlender Eltern-Einwilligung korrigieren');
do $$
begin
  perform tst.ok(public.has_consent(tst.uid('p4'), 'health_data'), 'T05b Staff darf Einwilligungsstatus eigener Spieler prüfen');
end
$$;
commit;

-- =====================================================================
-- T05c merge_players: Trainer führt Beitritts-Zeile und eigene Zeile zusammen
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
-- Konflikt-Daten: Trainer hat für "Max Muster" am 04.10. bereits RPE 4 erfasst
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-04', 4, 60)$q$,
                          tst.get('max')), 1, 'T05c Trainer-RPE für Max am 04.10.');
-- Daten an der Beitritts-Zeile, die beim Zusammenführen mitwandern müssen
select tst.affects(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'cmj', '2026-10-03', 41)$q$,
                          tst.get('p1_player')), 1, 'T05c Leistungstest an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.player_ratings (player_id, date, kind, rating, visible) values (%L, '2026-10-03', 'training', 7.5, true)$q$,
                          tst.get('p1_player')), 1, 'T05c Note an der Beitritts-Zeile');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$select public.merge_players(%L, %L)$q$, tst.get('p1_player'), tst.get('max')),
                  'T05c Spieler darf nicht zusammenführen', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.throws(format($q$select public.merge_players(%L, %L)$q$, tst.get('p1_player'), tst.get('max')),
                  'T05c fremder Coach darf nicht zusammenführen', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.throws(format($q$select public.merge_players(%L, %L)$q$, tst.get('p1_player'), tst.get('p2_player')),
                  'T05c Ziel mit Konto wird abgelehnt', 'already_linked');
select tst.throws(format($q$select public.merge_players(%L, %L)$q$, tst.get('tom'), tst.get('erik')),
                  'T05c Quelle ohne Konto wird abgelehnt', 'not_linked');
select tst.throws(format($q$select public.merge_players(%L, %L)$q$, tst.get('max'), tst.get('max')),
                  'T05c gleiche Zeile wird abgelehnt', 'invalid_merge');
do $$
declare
  r public.players;
begin
  perform tst.eq(public.merge_players(tst.get('p1_player')::uuid, tst.get('max')::uuid)::text, tst.get('max'),
                 'T05c merge_players liefert die vorhandene Zeile');
  select * into r from public.players where id = tst.get('max')::uuid;
  perform tst.eq(r.user_id::text, tst.uid('p1')::text, 'T05c Konto von P1 hängt jetzt an Max Muster');
  perform tst.ok(not r.is_new, 'T05c zusammengeführte Zeile ist nicht is_new');
  perform tst.eq(r.position || '/' || r.shirt_number || '/' || r.weight_kg, 'ZM/8/72.5',
                 'T05c leere Stammdaten werden ergänzt');
  perform tst.eq((select count(*) from public.players where id = tst.get('p1_player')::uuid)::text, '0',
                 'T05c Beitritts-Zeile wurde gelöscht');
  perform tst.eq((select rpe::text from public.rpe_entries where player_id = tst.get('max')::uuid and date = '2026-10-04'),
                 '4.0', 'T05c Konflikt: vorhandene RPE der Trainer-Zeile bleibt');
  perform tst.eq((select count(*) from public.wellness_entries where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Wellness ohne Konflikt wurde verschoben');
  perform tst.eq((select count(*) from public.consents where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Einwilligung zeigt auf die zusammengeführte Zeile');
  perform tst.eq((select count(*) from public.performance_tests where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Leistungstest wurde verschoben');
  perform tst.eq((select count(*) from public.player_ratings where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Note wurde verschoben');
  delete from public.performance_tests where player_id = tst.get('max')::uuid;
  delete from public.player_ratings where player_id = tst.get('max')::uuid;
end
$$;
commit;

-- =====================================================================
-- T06 P1: eigene Gesundheitsdaten eintragen und lesen
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';

select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes, created_by)
                             values (%L, '2026-10-06', 6, 90, %L)$q$, tst.get('max'), tst.uid('p2')),
                   1, 'T06 P1 trägt eigene RPE ein');
select tst.affects(format($q$insert into public.wellness_entries
                               (player_id, date, sleep_hours, sleep_quality, fatigue, soreness, stress, complaint)
                             values (%L, '2026-10-06', 8, 2, 3, 3, 2, 'none')$q$, tst.get('max')),
                   1, 'T06 P1 trägt eigenen Wellness-Check ein');
select tst.affects(format($q$insert into public.extra_activities (player_id, date, type, minutes, rpe)
                             values (%L, '2026-10-06', 'gym', 45, 5)$q$, tst.get('max')),
                   1, 'T06 P1 trägt Zusatzsport ein');
select tst.affects(format($q$update public.rpe_entries set rpe = 7 where player_id = %L and date = '2026-10-06'$q$,
                          tst.get('max')), 1, 'T06 P1 ändert eigene RPE');
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes)
                            values (%L, '2026-10-02', 11, 60)$q$, tst.get('max')),
                  'T06 RPE > 10 wird abgelehnt', 'check constraint');

do $$
begin
  perform tst.eq((select count(*) from public.rpe_entries)::text, '2', 'T06 P1 liest eigene RPE');
  perform tst.eq((select count(*) from public.wellness_entries)::text, '2', 'T06 P1 liest eigene Wellness-Checks');
  perform tst.eq((select count(*) from public.extra_activities)::text, '1', 'T06 P1 liest eigenen Zusatzsport');
  perform tst.eq((select created_by::text from public.rpe_entries
                  where player_id = tst.get('max')::uuid and date = '2026-10-06'),
                 tst.uid('p1')::text, 'T06 created_by wird auf auth.uid() gesetzt (nicht fälschbar)');
end
$$;
commit;

-- =====================================================================
-- T07 / T08 Isolation zwischen Spielern
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes)
                             values (%L, '2026-10-06', 5, 80)$q$, tst.get('p2_player')),
                   1, 'T07 P2 trägt eigene RPE ein');
select tst.affects(format($q$insert into public.wellness_entries (player_id, date, sleep_hours, fatigue)
                             values (%L, '2026-10-06', 7, 4)$q$, tst.get('p2_player')),
                   1, 'T07 P2 trägt eigenen Wellness-Check ein');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
declare
  other uuid := tst.get('p2_player')::uuid;
begin
  perform tst.eq((select count(*) from public.rpe_entries where player_id = other)::text, '0',
                 'T07 P1 sieht keine RPE von P2');
  perform tst.eq((select count(*) from public.wellness_entries where player_id = other)::text, '0',
                 'T07 P1 sieht keine Wellness-Daten von P2');
  perform tst.eq((select count(*) from public.players where id <> tst.get('max')::uuid)::text, '0',
                 'T07 P1 sieht keine anderen Spielerzeilen');
  perform tst.eq((select count(*) from public.coach_notes)::text, '0', 'T07 P1 sieht keine Trainernotizen');
end
$$;

select tst.throws(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes)
                            values (%L, '2026-10-07', 5, 60)$q$, tst.get('p2_player')),
                  'T08 P1 kann keine RPE für P2 eintragen', 'row-level security');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, fatigue)
                            values (%L, '2026-10-07', 3)$q$, tst.get('p2_player')),
                  'T08 P1 kann keinen Wellness-Check für P2 eintragen', 'row-level security');
select tst.throws(format($q$insert into public.extra_activities (player_id, date, type, minutes)
                            values (%L, '2026-10-07', 'lauf', 30)$q$, tst.get('p2_player')),
                  'T08 P1 kann keinen Zusatzsport für P2 eintragen', 'row-level security');
select tst.affects(format($q$update public.rpe_entries set rpe = 1 where player_id = %L$q$, tst.get('p2_player')),
                   0, 'T08 P1 kann RPE von P2 nicht ändern');
select tst.affects(format($q$delete from public.rpe_entries where player_id = %L$q$, tst.get('p2_player')),
                   0, 'T08 P1 kann RPE von P2 nicht löschen');

-- T09 Schutz-Trigger auf players
select tst.throws(format($q$update public.players set team_id = %L where id = %L$q$, tst.get('team_b'), tst.get('max')),
                  'T09 P1 kann seine team_id nicht ändern', 'forbidden');
select tst.throws(format($q$update public.players set active = false where id = %L$q$, tst.get('max')),
                  'T09 P1 kann active nicht ändern', 'forbidden');
select tst.throws(format($q$update public.players set is_new = true where id = %L$q$, tst.get('max')),
                  'T09 P1 kann is_new nicht ändern', 'forbidden');
select tst.throws(format($q$update public.players set user_id = null where id = %L$q$, tst.get('max')),
                  'T09 P1 kann user_id nicht ändern', 'forbidden');
select tst.affects(format($q$update public.players set position = 'IV', weight_kg = 73 where id = %L$q$, tst.get('max')),
                   1, 'T09 P1 darf eigene Stammdaten (Position, Gewicht) ändern');
select tst.affects(format($q$update public.players set position = 'TW' where id = %L$q$, tst.get('p2_player')),
                   0, 'T09 P1 kann fremde Spielerzeile nicht ändern');
select tst.affects(format($q$delete from public.players where id = %L$q$, tst.get('max')),
                   0, 'T09 P1 kann seine Spielerzeile nicht löschen');
commit;

-- Staff darf die geschützten Spalten ändern
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.players set is_new = false where id = %L$q$, tst.get('p2_player')),
                   1, 'T09 Staff darf is_new zurücksetzen');
select tst.throws(format($q$update public.players set user_id = %L where id = %L$q$, tst.uid('coachB'), tst.get('tom')),
                  'T09 Staff kann kein fremdes Konto mit einem Spieler verknüpfen', 'forbidden');
select tst.throws(format($q$insert into public.players (team_id, user_id, first_name) values (%L, %L, 'Fremd')$q$,
                         tst.get('team_a'), tst.uid('coachB')),
                  'T09 Staff kann keinen Spieler mit fremdem Konto anlegen', 'forbidden');
select tst.affects(format($q$update public.players set user_id = null where id = %L$q$, tst.get('p3_player')),
                   1, 'T09 Staff darf eine Verknüpfung lösen');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p3';
do $$
begin
  perform tst.eq((select count(*) from public.teams)::text, '0', 'T09 nach gelöster Verknüpfung sieht P3 das Team nicht mehr');
  perform tst.ok(public.join_team(tst.get('join_a'), 'Erik', 'Beispiel', '2007-03-03', null, null, null)::text
                 <> tst.get('p3_player'),
                 'T09 erneuter Beitritt nach Lösen legt neue Zeile an (Zusammenführen nur durch Staff)');
end
$$;
commit;

-- =====================================================================
-- T10 Abwesenheiten
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into public.absences (team_id, player_id, type, from_date, to_date, reported_by_player)
                             values (%L, %L, 'krank', '2026-10-07', '2026-10-08', false)$q$,
                          tst.get('team_b'), tst.get('max')),
                   1, 'T10 P1 meldet sich krank');
do $$
declare
  r public.absences;
begin
  select * into r from public.absences where player_id = tst.get('max')::uuid and type = 'krank';
  perform tst.ok(r.reported_by_player, 'T10 reported_by_player = true wird erzwungen');
  perform tst.eq(r.team_id::text, tst.get('team_a'), 'T10 team_id = player_team(player_id) wird erzwungen');
  perform tst.eq(r.created_by::text, tst.uid('p1')::text, 'T10 created_by = auth.uid()');
end
$$;
select tst.throws(format($q$insert into public.absences (player_id, type, from_date) values (%L, 'krank', '2026-10-07')$q$,
                         tst.get('p2_player')),
                  'T10 P1 kann P2 nicht abmelden', 'row-level security');
select tst.throws(format($q$insert into public.absences (player_id, type, from_date, to_date)
                            values (%L, 'urlaub', '2026-10-10', '2026-10-01')$q$, tst.get('max')),
                  'T10 to_date vor from_date wird abgelehnt', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.absences (player_id, type, from_date, stage)
                             values (%L, 'verletzung', '2026-10-01', 2)$q$, tst.get('max')),
                   1, 'T10 Coach erfasst Verletzung (team_id wird abgeleitet)');
do $$
begin
  perform tst.eq((select count(*) from public.absences where team_id = tst.get('team_a')::uuid)::text, '2',
                 'T10 Coach sieht alle Abwesenheiten des Teams');
  perform tst.ok(not (select reported_by_player from public.absences where type = 'verletzung'),
                 'T10 vom Staff erfasste Abwesenheit ist nicht selbst gemeldet');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from public.absences)::text, '2', 'T10 P1 liest eigene Abwesenheiten');
end
$$;
select tst.affects($q$update public.absences set note = 'geändert'$q$, 0, 'T10 P1 kann Abwesenheiten nicht ändern');
select tst.affects($q$delete from public.absences where type = 'verletzung'$q$, 0,
                   'T10 P1 kann vom Trainer erfasste Abwesenheit nicht löschen');
select tst.affects($q$delete from public.absences where type = 'krank'$q$, 1,
                   'T10 P1 löscht eigene selbst gemeldete Abwesenheit');
select tst.affects(format($q$insert into public.absences (player_id, type, from_date) values (%L, 'urlaub', '2026-12-20')$q$,
                          tst.get('max')), 1, 'T10 P1 meldet Urlaub (ohne team_id)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
begin
  perform tst.eq((select count(*) from public.absences)::text, '0', 'T10 P2 sieht keine Abwesenheiten von P1');
end
$$;
commit;

-- =====================================================================
-- T25 Baukasten: Absagen durch Spieler abschaltbar, Gruppen nur durch Staff
-- =====================================================================
begin;
update public.teams set settings = settings || '{"playerAbs": false}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$insert into public.absences (player_id, type, from_date) values (%L, 'urlaub', '2026-12-27')$q$, tst.get('max')),
                  'T25 P1 kann sich nicht abmelden, wenn Absagen per App aus sind', 'row-level security');
select tst.throws(format($q$update public.players set groups = '{reha}' where id = %L$q$, tst.get('max')),
                  'T25 P1 kann seine Gruppen nicht selbst ändern', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.players set groups = '{reha}' where id = %L$q$, tst.get('max')), 1,
                   'T25 Coach ordnet Spieler einer Gruppe zu');
select tst.affects(format($q$insert into public.absences (player_id, type, from_date) values (%L, 'urlaub', '2026-12-27')$q$, tst.get('max')), 1,
                   'T25 Coach trägt Abwesenheit trotz abgeschalteter Spieler-Absagen ein');
commit;

begin;
update public.teams set settings = settings || '{"playerAbs": true}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into public.absences (player_id, type, from_date) values (%L, 'urlaub', '2027-01-03')$q$, tst.get('max')), 1,
                   'T25 mit eingeschalteten Absagen meldet sich P1 wieder selbst ab');
commit;
-- Aufräumen, damit spätere Zählungen unverändert bleiben
begin;
delete from public.absences where player_id = tst.get('max')::uuid and from_date in ('2026-12-27', '2027-01-03');
update public.players set groups = '{}' where id = tst.get('max')::uuid;
commit;

-- =====================================================================
-- T26 Spieldaten, Noten, Videos (Baustein 4)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.put('m26', (select id::text from public.matches where team_id = tst.get('team_a')::uuid order by date limit 1));
select tst.affects(format($q$insert into public.match_stats (match_id, player_id, minutes, goals, assists, started) values (%L, %L, 90, 1, 0, true)$q$, tst.get('m26'), tst.get('max')), 1,
                   'T26 Coach erfasst Spieldaten');
select tst.affects(format($q$insert into public.player_ratings (player_id, date, kind, rating, text, visible) values (%L, '2026-10-04', 'spiel', 7.5, 'Gut', true)$q$, tst.get('max')), 1,
                   'T26 Coach vergibt sichtbare Note');
select tst.affects(format($q$insert into public.player_ratings (player_id, date, kind, rating, text, visible) values (%L, '2026-10-05', 'training', 5.0, 'intern', false)$q$, tst.get('max')), 1,
                   'T26 Coach vergibt interne Note');
select tst.affects(format($q$insert into public.videos (team_id, title, url, player_ids) values (%L, 'Alle', 'https://example.com/a', '{}')$q$, tst.get('team_a')), 1, 'T26 Video für alle');
select tst.affects(format($q$insert into public.videos (team_id, title, url, player_ids) values (%L, 'Nur P2', 'https://example.com/b', ARRAY[%L]::uuid[])$q$, tst.get('team_a'), tst.get('p2_player')), 1, 'T26 Video nur für P2');
select tst.throws(format($q$insert into public.videos (team_id, title, url) values (%L, 'X', 'javascript:alert(1)')$q$, tst.get('team_a')), 'T26 nur http(s)-Links', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from public.match_stats)::text, '1', 'T26 P1 sieht eigene Spieldaten');
  perform tst.eq((select count(*) from public.player_ratings)::text, '1', 'T26 P1 sieht nur freigegebene Note');
  perform tst.eq((select count(*) from public.videos)::text, '1', 'T26 P1 sieht Video für alle, nicht das für P2');
end
$$;
select tst.throws(format($q$insert into public.player_ratings (player_id, date, kind, rating) values (%L, '2026-10-06', 'spiel', 10)$q$, tst.get('max')),
                  'T26 P1 kann sich keine Note geben', 'row-level security');
commit;

begin;
update public.teams set settings = settings || '{"playerView": {"ratings": false}}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from public.player_ratings)::text, '0', 'T26 Noten im Baukasten aus: P1 sieht keine Noten');
end
$$;
commit;

begin;
update public.teams set settings = settings - 'playerView' where id = tst.get('team_a')::uuid;
delete from public.player_ratings; delete from public.match_stats; delete from public.videos;
commit;

-- =====================================================================
-- T27 Leistungstests (Baustein 5)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'cmj', '2026-10-06', 41.5)$q$, tst.get('max')), 1,
                   'T27 Coach trägt CMJ ein');
select tst.throws(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'bankdruecken', '2026-10-06', 80)$q$, tst.get('max')),
                  'T27 unbekannter Test wird abgelehnt', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.performance_tests)::text, '1', 'T27 P1 sieht eigene Testwerte');
end $$;
select tst.throws(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'cmj', '2026-10-07', 60)$q$, tst.get('max')),
                  'T27 P1 kann keine Testwerte eintragen', 'row-level security');
commit;

begin;
update public.teams set settings = settings || '{"playerView": {"tests": false}}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.performance_tests)::text, '0', 'T27 Tests im Baukasten aus: P1 sieht keine Werte');
end $$;
commit;

begin;
update public.teams set settings = settings - 'playerView' where id = tst.get('team_a')::uuid;
delete from public.performance_tests;
commit;

-- =====================================================================
-- T28 Befunde (Baustein 6): Gesundheitsdaten nur für Trainerteam und den Spieler selbst
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.findings (player_id, date, title, path, mime, consent_source) values (%L, '2026-10-06', 'MRT Knie', %L, 'application/pdf', 'schriftlich')$q$,
                          tst.get('max'), tst.get('team_a') || '/' || tst.get('max') || '/11111111-1111-4111-8111-111111111111.pdf'), 1, 'T28 Coach legt Befund an');
select tst.throws(format($q$insert into public.findings (player_id, date, title, path, mime, consent_source) values (%L, '2026-10-06', 'X', 'fremd/pfad.pdf', 'application/pdf', 'app')$q$, tst.get('max')),
                  'T28 Pfad muss zu Team und Spieler passen', 'invalid_path');
select tst.affects(format($q$insert into storage.objects (bucket_id, name) values ('findings', %L)$q$,
                          tst.get('team_a') || '/' || tst.get('max') || '/11111111-1111-4111-8111-111111111111.pdf'), 1, 'T28 Coach lädt Befund-Datei hoch');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.findings)::text, '1', 'T28 P1 sieht eigenen Befund');
  perform tst.eq((select count(*) from storage.objects where bucket_id = 'findings')::text, '1', 'T28 P1 sieht eigene Befund-Datei');
end $$;
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('findings', %L)$q$,
                         tst.get('team_a') || '/' || tst.get('max') || '/22222222-2222-4222-8222-222222222222.pdf'), 'T28 P1 kann keine Befunde hochladen', 'row-level security');
select tst.affects($q$insert into public.consents (kind, version) values ('findings', '2026-10')$q$, 1, 'T28 P1 willigt in Befund-Auswertung ein');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.findings)::text, '0', 'T28 P2 sieht keine Befunde von P1');
  perform tst.eq((select count(*) from storage.objects where bucket_id = 'findings')::text, '0', 'T28 P2 sieht keine Befund-Dateien von P1');
end $$;
commit;

begin;
delete from public.findings; delete from storage.objects where bucket_id = 'findings';
delete from public.consents where kind = 'findings';
commit;

-- =====================================================================
-- T29 Übungsarchiv, Vorlagen, Trainerprofile (Baustein 7): nur Trainerteam
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.exercises (team_id, title, category, points, drawing) values (%L, 'Rondo 4 gegen 2', 'pass', '[{"text":"Körperstellung offen"}]', '{"pitch":"free","items":[]}')$q$, tst.get('team_a')), 1, 'T29 Coach legt Übung an');
select tst.affects(format($q$insert into public.session_templates (team_id, title, blocks) values (%L, 'Pressing-Tag', '[]')$q$, tst.get('team_a')), 1, 'T29 Coach speichert Einheit');
select tst.affects(format($q$insert into public.staff_profiles (team_id, name, role, areas) values (%L, 'Co Max', 'co', '{Standards}')$q$, tst.get('team_a')), 1, 'T29 Coach legt Trainerprofil an');
select tst.throws(format($q$insert into public.exercises (team_id, title, category) values (%L, 'X', 'yoga')$q$, tst.get('team_a')), 'T29 unbekannte Kategorie wird abgelehnt', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.exercises)::text, '0', 'T29 Spieler sieht das Übungsarchiv nicht');
  perform tst.eq((select count(*) from public.staff_profiles)::text, '0', 'T29 Spieler sieht keine Trainerprofile');
end $$;
commit;

begin;
delete from public.exercises; delete from public.session_templates; delete from public.staff_profiles;
commit;

-- =====================================================================
-- T30 Vorbereitung & Pausen (Baustein 8): Trainer plant, Spieler lesen, Programm abhaken
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.season_phases (team_id, kind, title, date_from, date_to, program)
                             values (%L, 'break', 'Winterpause', '2026-12-19', '2027-01-10', '[{"id":"pi1","key":"kraft","min":35,"rpe":6,"perWeek":1,"from":1,"to":3}]')$q$, tst.get('team_a')),
                   1, 'T30 Coach legt Pause mit Programm an');
select tst.throws(format($q$insert into public.season_phases (team_id, kind, title, date_from, date_to) values (%L, 'prep', 'X', '2027-01-10', '2027-01-01')$q$, tst.get('team_a')),
                  'T30 Ende vor Beginn wird abgelehnt', 'check constraint');
select tst.throws(format($q$insert into public.season_phases (team_id, kind, title, date_from, date_to) values (%L, 'urlaub', 'X', '2027-01-01', '2027-01-10')$q$, tst.get('team_a')),
                  'T30 unbekannte Phasenart wird abgelehnt', 'check constraint');
do $$ begin
  perform tst.ok(public.player_view(tst.get('team_a')::uuid, 'program'), 'T30 Programm ist für Spieler standardmäßig sichtbar');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select title from public.season_phases), 'Winterpause', 'T30 Spieler sieht die Pause seines Teams');
end $$;
select tst.affects($q$update public.season_phases set title = 'Urlaub'$q$, 0, 'T30 Spieler kann Phasen nicht ändern');
select tst.throws(format($q$insert into public.season_phases (team_id, kind, title, date_from, date_to) values (%L, 'break', 'X', '2027-01-01', '2027-01-10')$q$, tst.get('team_a')),
                  'T30 Spieler kann keine Phase anlegen', 'row-level security');
select tst.affects(format($q$insert into public.extra_activities (player_id, date, type, minutes, rpe, label, program_item)
                             values (%L, '2026-12-21', 'gym', 35, 6, 'Kraft & Prävention', 'pi1')$q$, tst.get('max')),
                   1, 'T30 Spieler hakt Programm-Einheit ab');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$ begin
  perform tst.eq((select count(*) from public.season_phases)::text, '0', 'T30 fremdes Team sieht die Phase nicht');
end $$;
commit;

begin;
delete from public.season_phases; delete from public.extra_activities where program_item = 'pi1';
commit;

-- =====================================================================
-- T31 Kontaktliste (Baustein 9): Staff verwaltet, Spieler sehen freigegebene Kontakte
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.team_contacts (team_id, name, role, org, phone, visible) values
                             (%1$L, 'Praxis Dr. Sommer', 'arzt', 'Sportmedizin', '0201 123', true),
                             (%1$L, 'Vorstand Jugend', 'vorstand', null, null, false)$q$, tst.get('team_a')),
                   2, 'T31 Coach legt Kontakte an');
select tst.throws(format($q$insert into public.team_contacts (team_id, name, role) values (%L, 'X', 'fan')$q$, tst.get('team_a')),
                  'T31 unbekannte Rolle wird abgelehnt', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select string_agg(name, ',') from public.team_contacts), 'Praxis Dr. Sommer', 'T31 Spieler sieht nur freigegebene Kontakte');
end $$;
select tst.throws(format($q$insert into public.team_contacts (team_id, name, role) values (%L, 'X', 'sonst')$q$, tst.get('team_a')),
                  'T31 Spieler kann keine Kontakte anlegen', 'row-level security');
select tst.affects($q$update public.team_contacts set phone = '0'$q$, 0, 'T31 Spieler kann Kontakte nicht ändern');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.teams set settings = settings || '{"playerView":{"contacts":false}}'::jsonb where id = %L$q$, tst.get('team_a')),
                   1, 'T31 Coach blendet Kontakte für Spieler aus');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.team_contacts)::text, '0', 'T31 ausgeblendet: Spieler sieht keine Kontakte');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$ begin
  perform tst.eq((select count(*) from public.team_contacts)::text, '0', 'T31 fremdes Team sieht keine Kontakte');
end $$;
commit;

begin;
delete from public.team_contacts;
update public.teams set settings = settings - 'playerView' where id = tst.get('team_a')::uuid;
commit;

-- =====================================================================
-- T32 Trainerprofil, Logo, Einstellungen (Paket 1)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.staff_profiles (team_id, name, role, user_id, license, birthdate) values (%L, 'Coach Anna', 'chef', %L, 'bplus', '1990-05-01')$q$, tst.get('team_a'), tst.uid('coachA')),
                   1, 'T32 Coach legt eigenes, verknüpftes Profil an');
select tst.throws(format($q$insert into public.staff_profiles (team_id, name, role, user_id) values (%L, 'Fremd', 'co', %L)$q$, tst.get('team_a'), tst.uid('p1')),
                  'T32 Verknüpfung mit einem Spielerkonto wird abgelehnt', 'invalid_staff_user');
select tst.throws(format($q$insert into public.staff_profiles (team_id, name, role, user_id) values (%L, 'Doppelt', 'co', %L)$q$, tst.get('team_a'), tst.uid('coachA')),
                  'T32 ein Konto nur einmal pro Team', 'duplicate key');
select tst.affects(format($q$update public.teams set logo_path = %L where id = %L$q$, tst.get('team_a') || '/logo.jpg', tst.get('team_a')), 1, 'T32 Coach setzt Vereinslogo');
select tst.throws(format($q$update public.teams set logo_path = 'x/logo.jpg' where id = %L$q$, tst.get('team_a')), 'T32 Logo-Pfad muss im Teamordner liegen', 'check constraint');
select tst.affects(format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, tst.get('team_a') || '/logo.jpg'), 1, 'T32 Coach lädt Logo hoch');
select tst.affects($q$update public.profiles set prefs = '{"info": false}' where id = auth.uid()$q$, 1, 'T32 eigene Einstellungen speichern');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select name || '/' || role from public.team_coaches(tst.get('team_a')::uuid) limit 1), 'Coach Anna/chef', 'T32 Spieler sieht Name und Rolle des Trainers');
  perform tst.eq((select count(*) from public.staff_profiles)::text, '0', 'T32 Spieler liest keine vollständigen Trainerprofile (Telefon, Geburtsdatum)');
  perform tst.eq((select count(*) from storage.objects where name = tst.get('team_a') || '/logo.jpg')::text, '1', 'T32 Spieler sieht das Vereinslogo');
  perform tst.eq((select count(*) from public.team_coaches(tst.get('team_b')::uuid))::text, '0', 'T32 fremdes Trainerteam bleibt verborgen');
end $$;
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, tst.get('team_a') || '/staff-' || gen_random_uuid() || '.jpg'),
                  'T32 Spieler kann kein Trainerfoto hochladen', 'row-level security');
select tst.affects(format($q$update storage.objects set owner = owner where name = %L$q$, tst.get('team_a') || '/logo.jpg'), 0, 'T32 Spieler kann das Logo nicht überschreiben');
select tst.affects($q$update public.profiles set prefs = '{"info": true}' where id <> auth.uid()$q$, 0, 'T32 fremde Einstellungen sind tabu');
commit;

begin;
delete from public.staff_profiles; delete from storage.objects where name like '%/logo.jpg';
update public.teams set logo_path = null; update public.profiles set prefs = '{}';
commit;

-- =====================================================================
-- T11 Potenziale, T12 Notizen, T13 Nachrichten
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.potentials (player_id, category, text, visible_to_player, source) values
                               (%1$L, 'tech', 'Schwächerer Fuß', true,  'trainer'),
                               (%1$L, 'ment', 'Fokus nach Fehlern', false, 'ki'),
                               (%2$L, 'ath',  'Antritt', true, 'daten')$q$, tst.get('max'), tst.get('p2_player')),
                   3, 'T11 Coach legt Potenziale an');
select tst.affects(format($q$insert into public.coach_messages (player_id, type, text, valid_until)
                             values (%L, 'regen', 'Heute locker auslaufen', '2026-10-10')$q$, tst.get('max')),
                   1, 'T13 Coach schreibt Nachricht an P1');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select string_agg(category, ',') from public.potentials), 'tech',
                 'T11 P1 sieht nur eigene, freigegebene Potenziale');
  perform tst.eq((select count(*) from public.coach_notes)::text, '0', 'T12 Trainernotizen sind für P1 unsichtbar');
  perform tst.eq((select count(*) from public.coach_messages)::text, '1', 'T13 P1 sieht Nachricht des Trainers');
end
$$;
select tst.throws(format($q$insert into public.potentials (player_id, category, text) values (%L, 'tech', 'x')$q$, tst.get('max')),
                  'T11 P1 kann keine Potenziale anlegen', 'row-level security');
select tst.affects($q$update public.potentials set visible_to_player = true$q$, 0,
                   'T11 P1 kann Potenziale nicht freischalten');
select tst.throws(format($q$insert into public.coach_notes (player_id, text) values (%L, 'x')$q$, tst.get('max')),
                  'T12 P1 kann keine Trainernotiz anlegen', 'row-level security');
select tst.throws(format($q$insert into public.coach_messages (player_id, type, text) values (%L, 'info', 'x')$q$, tst.get('max')),
                  'T13 P1 kann keine Trainernachricht anlegen', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
begin
  perform tst.eq((select count(*) from public.coach_messages)::text, '0', 'T13 P2 sieht die Nachricht an P1 nicht');
  perform tst.eq((select string_agg(category, ',') from public.potentials), 'ath', 'T11 P2 sieht nur sein Potenzial');
end
$$;
commit;

-- =====================================================================
-- T14 Teamdaten: lesbar für Spieler, nicht schreibbar
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from public.matches)::text, '1', 'T14 P1 liest Spiele');
  perform tst.eq((select count(*) from public.team_events)::text, '1', 'T14 P1 liest Termine');
  perform tst.eq((select count(*) from public.week_plans)::text, '1', 'T14 P1 liest veröffentlichten Wochenplan');
  perform tst.eq((select count(*) from public.sessions)::text, '1', 'T14 P1 liest Einheiten');
  perform tst.eq((select count(*) from public.session_types)::text, '1', 'T14 P1 liest Trainingsarten');
  perform tst.eq((select count(*) from public.calendar_overrides)::text, '1', 'T14 P1 liest Kalenderänderungen');
  perform tst.eq((select count(*) from public.plan_overrides)::text, '1', 'T14 P1 liest Plananpassungen');
  perform tst.eq((select count(*) from public.week_modes)::text, '1', 'T14 P1 liest Wochenmodus');
end
$$;
select tst.throws(format($q$insert into public.matches (team_id, date) values (%L, '2026-10-17')$q$, tst.get('team_a')),
                  'T14 P1 kann keine Spiele anlegen', 'row-level security');
select tst.affects($q$update public.matches set opponent = 'x'$q$, 0, 'T14 P1 kann Spiele nicht ändern');
select tst.affects($q$delete from public.matches$q$, 0, 'T14 P1 kann Spiele nicht löschen');
select tst.throws(format($q$insert into public.team_events (team_id, date, title) values (%L, '2026-10-17', 'x')$q$, tst.get('team_a')),
                  'T14 P1 kann keine Termine anlegen', 'row-level security');
select tst.affects($q$update public.team_events set title = 'x'$q$, 0, 'T14 P1 kann Termine nicht ändern');
select tst.throws(format($q$insert into public.week_plans (team_id, week_start) values (%L, '2026-10-12')$q$, tst.get('team_a')),
                  'T14 P1 kann keinen Wochenplan veröffentlichen', 'row-level security');
select tst.affects($q$update public.week_plans set items = '[]'$q$, 0, 'T14 P1 kann Wochenplan nicht ändern');
select tst.affects($q$delete from public.week_plans$q$, 0, 'T14 P1 kann Wochenplan nicht löschen');
select tst.affects($q$update public.teams set name = 'x'$q$, 0, 'T14 P1 kann das Team nicht ändern');
select tst.affects($q$delete from public.teams$q$, 0, 'T14 P1 kann das Team nicht löschen');
commit;

-- =====================================================================
-- T15 RPE-Eintrag setzt Anwesenheit 'da', wenn eine Einheit existiert
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.attendance (player_id, date, status) values (%L, '2026-10-05', 'ent')$q$,
                          tst.get('p2_player')), 1, 'T15 Coach setzt Anwesenheit (team_id wird abgeleitet)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-05', 7, 90)$q$,
                          tst.get('max')), 1, 'T15 P1 trägt RPE für einen Tag mit Einheit ein');
do $$
begin
  perform tst.eq((select status from public.attendance where player_id = tst.get('max')::uuid and date = '2026-10-05'),
                 'da', 'T15 RPE-Eintrag setzt Anwesenheit da');
  perform tst.eq((select count(*) from public.attendance where date = '2026-10-06')::text, '0',
                 'T15 ohne Einheit wird keine Anwesenheit gesetzt');
end
$$;
select tst.throws(format($q$insert into public.attendance (player_id, date, status) values (%L, '2026-10-09', 'da')$q$,
                         tst.get('max')),
                  'T15 P1 kann Anwesenheit nicht selbst setzen', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-10-05', 5, 60)$q$,
                          tst.get('p2_player')), 1, 'T15 P2 trägt RPE ein, obwohl als entschuldigt markiert');
do $$
begin
  perform tst.eq((select status from public.attendance where player_id = tst.get('p2_player')::uuid and date = '2026-10-05'),
                 'ent', 'T15 vorhandener Anwesenheitsstatus bleibt erhalten');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.sessions (team_id, date, type, duration, time)
                             values (%L, '2026-10-06', 'Training', 75, '18:30')$q$, tst.get('team_a')),
                   1, 'T15 Coach speichert Einheit nachträglich');
do $$
begin
  perform tst.eq((select count(*) from public.attendance where date = '2026-10-06' and status = 'da')::text, '4',
                 'T15 nachträglicher Schnappschuss setzt da für Spieler mit RPE');
end
$$;
commit;

-- =====================================================================
-- T16 join_staff (Anfrage 'pending'), Freigabe durch Owner, regenerate_codes
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
select tst.throws($q$select public.join_staff('ZZZZ-ZZZZ')$q$, 'T16 join_staff mit falschem Code schlägt fehl', 'invalid_code');
select tst.throws(format($q$select public.join_staff(%L)$q$, tst.get('join_a')),
                  'T16 Spieler-Code gilt nicht als Staff-Code', 'invalid_code');
do $$
begin
  perform tst.eq(public.join_staff(lower(tst.get('staff_a')))::text, tst.get('team_a'),
                 'T16 join_staff liefert Team-ID (Code formatunabhängig)');
  perform tst.eq((select role from public.team_staff where user_id = tst.uid('coachC')), 'pending',
                 'T16 join_staff legt nur eine Anfrage (pending) an');
  perform tst.eq(public.join_staff(tst.get('staff_a'))::text, tst.get('team_a'), 'T16 join_staff ist wiederholbar');
  perform tst.ok(not public.is_team_staff(tst.get('team_a')::uuid), 'T16 pending zählt nicht als Staff');
  perform tst.ok(not public.is_team_member(tst.get('team_a')::uuid), 'T16 pending zählt nicht als Mitglied');
  perform tst.eq((select count(*) from public.teams)::text, '0', 'T16 pending sieht das Team nicht');
  perform tst.eq((select count(*) from public.players)::text, '0', 'T16 pending sieht keine Spieler');
  perform tst.eq((select count(*) from public.rpe_entries)::text, '0', 'T16 pending sieht keine Gesundheitsdaten');
  perform tst.eq((select count(*) from public.matches)::text, '0', 'T16 pending sieht keinen Kalender');
  perform tst.eq((select count(*) from public.team_staff)::text, '1', 'T16 pending sieht nur die eigene Anfrage');
  perform tst.eq((select club || ' / ' || name from public.my_pending_teams()), 'SG Essen-Schönebeck / U19 Junioren',
                 'T16 my_pending_teams zeigt Verein/Team der offenen Anfrage');
end
$$;
select tst.throws(format($q$select public.approve_staff(%L, %L)$q$, tst.get('team_a'), tst.uid('coachC')),
                  'T16 Selbstfreigabe ist nicht möglich', 'forbidden');
select tst.throws(format($q$select * from public.team_staff_list(%L)$q$, tst.get('team_a')),
                  'T16 pending darf die Staff-Liste nicht lesen', 'forbidden');
select tst.affects(format($q$update public.team_staff set role = 'coach' where user_id = %L$q$, tst.uid('coachC')),
                   0, 'T16 pending kann seine Rolle nicht selbst ändern');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.put('ignore', public.join_staff(tst.get('staff_a'))::text);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$select * from public.team_staff_list(%L)$q$, tst.get('team_a')),
                  'T16 Spieler darf die Staff-Liste nicht lesen', 'forbidden');
select tst.throws(format($q$select public.approve_staff(%L, %L)$q$, tst.get('team_a'), tst.uid('coachC')),
                  'T16 Spieler darf keine Anfrage freigeben', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$
begin
  perform tst.eq((select string_agg(role || ':' || coalesce(display_name, '-'), ',')
                  from public.team_staff_list(tst.get('team_a')::uuid)),
                 'owner:Coach A,pending:Coach B,pending:-',
                 'T16 team_staff_list zeigt Rollen und Anzeigenamen inkl. Anfragen');
end
$$;
select tst.throws(format($q$select public.approve_staff(%L, %L, 'owner')$q$, tst.get('team_a'), tst.uid('coachC')),
                  'T16 approve_staff nur mit Rolle coach/physio', 'invalid_role');
select tst.throws(format($q$select public.approve_staff(%L, %L)$q$, tst.get('team_a'), tst.uid('p2')),
                  'T16 approve_staff ohne offene Anfrage', 'not_found');
select public.approve_staff(tst.get('team_a')::uuid, tst.uid('coachC'));
select public.reject_staff(tst.get('team_a')::uuid, tst.uid('coachB'));
select tst.throws(format($q$select public.reject_staff(%L, %L)$q$, tst.get('team_a'), tst.uid('coachC')),
                  'T16 reject_staff nur für offene Anfragen', 'not_found');
do $$
begin
  perform tst.eq((select role from public.team_staff where user_id = tst.uid('coachC')), 'coach',
                 'T16 Owner gibt Anfrage frei (Rolle coach)');
  perform tst.eq((select count(*) from public.team_staff where user_id = tst.uid('coachB'))::text, '0',
                 'T16 Owner lehnt Anfrage ab (Zeile entfernt)');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$
begin
  perform tst.eq((select count(*) from public.players)::text, '7', 'T16 freigegebener Coach sieht den Kader');
  perform tst.eq((select count(*) from public.rpe_entries)::text, '7', 'T16 freigegebener Coach sieht die RPE-Daten des Teams');
  perform tst.eq((select count(*) from public.team_staff)::text, '2', 'T16 Staff sieht das Trainerteam');
  perform tst.eq(public.join_staff(tst.get('staff_a'))::text, tst.get('team_a'), 'T16 join_staff als Staff ändert nichts');
  perform tst.eq((select role from public.team_staff where user_id = tst.uid('coachC')), 'coach',
                 'T16 bestehende Rolle bleibt beim erneuten join_staff');
end
$$;
select tst.throws(format($q$select public.regenerate_codes(%L)$q$, tst.get('team_a')),
                  'T16 nur der Owner darf Codes erneuern', 'forbidden');
select tst.throws(format($q$select public.approve_staff(%L, %L)$q$, tst.get('team_a'), tst.uid('coachB')),
                  'T16 nur der Owner darf Anfragen freigeben', 'forbidden');
select tst.affects(format($q$update public.team_staff set role = 'owner' where user_id = %L$q$, tst.uid('coachC')),
                   0, 'T16 Coach kann sich nicht selbst zum Owner machen');
select tst.affects(format($q$delete from public.teams where id = %L$q$, tst.get('team_a')),
                   0, 'T16 Coach (nicht Owner) kann das Team nicht löschen');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$
begin
  perform tst.eq((select count(*) from public.teams where id = tst.get('team_a')::uuid)::text, '0',
                 'T16 abgelehnter Coach sieht Team A nicht');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$
declare
  r record;
begin
  select * into r from public.regenerate_codes(tst.get('team_a')::uuid);
  perform tst.ok(r.join_code <> tst.get('join_a') and r.staff_code <> tst.get('staff_a')
                 and r.join_code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$',
                 'T16 Owner erneuert beide Codes');
  perform tst.eq((select join_code from public.teams where id = tst.get('team_a')::uuid), r.join_code,
                 'T16 neuer Code ist gespeichert');
  perform tst.eq((select count(*) from public.team_by_join_code(tst.get('join_a')))::text, '0',
                 'T16 alter Code ist ungültig');
  perform tst.put('join_a', r.join_code);
  perform tst.put('staff_a', r.staff_code);
end
$$;
commit;

-- =====================================================================
-- T17 Einwilligungen
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects($q$insert into public.consents (kind, version) values ('ai', '2026-10')$q$, 1,
                   'T17 P1 willigt in KI-Nutzung ein (user_id = auth.uid() per Default)');
select tst.affects($q$insert into public.consents (kind, version, parent_email) values ('parental', '2026-10', 'eltern@example.org')$q$,
                   1, 'T17 Elterneinwilligung mit E-Mail');
select tst.throws($q$insert into public.consents (kind, version, parent_email) values ('parental', '2026-10', 'kaputt')$q$,
                  'T17 ungültige Eltern-E-Mail wird abgelehnt', 'check constraint');
select tst.throws(format($q$insert into public.consents (user_id, kind, version) values (%L, 'privacy', '1')$q$, tst.uid('p2')),
                  'T17 P1 kann keine Einwilligung für P2 anlegen', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$
begin
  perform tst.eq((select count(*) from public.consents where user_id = tst.uid('p1'))::text, '4',
                 'T17 Staff liest Einwilligungen seiner Spieler');
end
$$;
select tst.throws($q$delete from public.consents$q$, 'T17 Staff kann Einwilligungen nicht löschen', 'permission denied');
select tst.affects($q$update public.consents set withdrawn_at = now()$q$, 0, 'T17 Staff kann Einwilligungen nicht widerrufen');
select tst.affects($q$insert into public.consents (kind, version) values ('staff_confidentiality', '2026-10')$q$, 1,
                   'T17 Coach gibt Vertraulichkeitserklärung ab');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$
begin
  perform tst.eq((select count(*) from public.consents)::text, '0', 'T17 fremder Coach sieht keine Einwilligungen');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
begin
  perform tst.eq((select count(*) from public.consents where user_id is distinct from tst.uid('p2'))::text, '0',
                 'T17 P2 sieht Einwilligungen von P1 nicht');
end
$$;
commit;

-- =====================================================================
-- T18 KI-Zähler und Push-Log nur serverseitig
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$insert into public.ai_usage (user_id, day, count) values (%L, current_date, 0)$q$, tst.uid('p1')),
                  'T18 P1 kann ai_usage nicht schreiben', 'permission denied');
select tst.throws($q$update public.ai_usage set count = 0$q$, 'T18 P1 kann ai_usage nicht zurücksetzen', 'permission denied');
select tst.throws(format($q$select public.ai_usage_bump(%L, 1, 40)$q$, tst.uid('p1')),
                  'T18 ai_usage_bump ist für Clients gesperrt', 'permission denied');
select tst.throws($q$select * from public.push_log$q$, 'T18 push_log ist für Clients gesperrt', 'permission denied');
commit;

begin;
set local role service_role;
do $$
declare
  u uuid := tst.uid('p1');
begin
  perform tst.eq(public.ai_usage_bump(u, 1, 2)::text, '1', 'T18 ai_usage_bump zählt hoch (1)');
  perform tst.eq(public.ai_usage_bump(u, 1, 2)::text, '2', 'T18 ai_usage_bump zählt hoch (2)');
  perform tst.eq(public.ai_usage_bump(u, 1, 2)::text, null, 'T18 ai_usage_bump: Limit erreicht → null');
  perform tst.eq(public.ai_usage_bump(u, -1, 2)::text, '1', 'T18 ai_usage_bump: Gutschrift');
  perform tst.eq(public.ai_usage_bump(u, 1, 2)::text, '2', 'T18 ai_usage_bump nach Gutschrift');
end
$$;
insert into public.push_log (user_id, kind, day) values (:'p1', 'rpe', '2026-10-06');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count from public.ai_usage)::text, '2', 'T18 P1 liest eigenen KI-Zähler');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
begin
  perform tst.eq((select count(*) from public.ai_usage)::text, '0', 'T18 P2 sieht KI-Zähler von P1 nicht');
end
$$;
commit;

-- =====================================================================
-- T19 Push-Tokens und Profile: nur eigene Zeilen
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select public.register_push_token('ExponentPushToken[geraet-1]', 'ios');
do $$
begin
  perform tst.eq((select count(*) from public.push_tokens)::text, '1', 'T19 P1 registriert Push-Token');
  perform tst.eq((select count(*) from public.profiles)::text, '1', 'T19 P1 sieht nur das eigene Profil');
end
$$;
select tst.affects($q$update public.profiles set display_name = 'Maxi'$q$, 1, 'T19 P1 ändert eigenes Profil');
select tst.affects(format($q$update public.profiles set display_name = 'x' where id = %L$q$, tst.uid('p2')), 0,
                   'T19 P1 kann fremdes Profil nicht ändern');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
begin
  perform tst.eq((select count(*) from public.push_tokens)::text, '0', 'T19 P2 sieht Push-Token von P1 nicht');
end
$$;
select tst.throws(format($q$insert into public.push_tokens (token, user_id) values ('ExponentPushToken[x]', %L)$q$, tst.uid('p1')),
                  'T19 P2 kann kein Token für P1 anlegen', 'row-level security');
select public.register_push_token('ExponentPushToken[geraet-1]', 'android');
do $$
begin
  perform tst.eq((select count(*) from public.push_tokens where platform = 'android')::text, '1',
                 'T19 Gerät wechselt per register_push_token den Besitzer');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from public.push_tokens)::text, '0', 'T19 vorheriger Besitzer verliert das Token');
end
$$;
select public.register_push_token('ExponentPushToken[geraet-p1]', 'ios');
commit;

-- =====================================================================
-- T20 Storage: avatars/{team_id}/{player_id}.jpg
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into storage.objects (bucket_id, name, owner) values ('avatars', %L, %L)$q$,
                          tst.get('team_a') || '/' || tst.get('max') || '.jpg', tst.uid('p1')),
                   1, 'T20 P1 lädt eigenes Foto hoch');
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$,
                         tst.get('team_a') || '/' || tst.get('p2_player') || '.jpg'),
                  'T20 P1 kann kein Foto für P2 hochladen', 'row-level security');
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$,
                         tst.get('team_b') || '/' || tst.get('max') || '.jpg'),
                  'T20 falsches Team im Pfad wird abgelehnt', 'row-level security');
select tst.throws($q$insert into storage.objects (bucket_id, name) values ('avatars', 'kein-uuid/foto.jpg')$q$,
                  'T20 ungültiger Pfad wird sauber (ohne Cast-Fehler) abgelehnt', 'row-level security');
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$,
                         tst.get('team_a') || '/' || tst.get('max') || '.png'),
                  'T20 falsche Dateiendung wird abgelehnt', 'row-level security');
select tst.affects(format($q$update storage.objects set owner = owner where name = %L$q$,
                          tst.get('team_a') || '/' || tst.get('max') || '.jpg'),
                   1, 'T20 P1 überschreibt eigenes Foto (upsert)');
select tst.affects($q$delete from storage.objects$q$, 0, 'T20 P1 darf Fotos nicht löschen (nur Staff)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$,
                          tst.get('team_a') || '/' || tst.get('p2_player') || '.jpg'),
                   1, 'T20 Staff lädt Foto für Spieler hoch');
do $$
begin
  perform tst.eq((select count(*) from storage.objects where bucket_id = 'avatars')::text, '2',
                 'T20 Staff sieht alle Fotos des Teams');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from storage.objects)::text, '1', 'T20 P1 sieht nur das eigene Foto');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$
begin
  perform tst.eq((select count(*) from storage.objects)::text, '0', 'T20 fremder Coach sieht keine Fotos');
end
$$;
select tst.affects($q$delete from storage.objects$q$, 0, 'T20 fremder Coach kann keine Fotos löschen');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$delete from storage.objects where name = %L$q$,
                          tst.get('team_a') || '/' || tst.get('p2_player') || '.jpg'),
                   1, 'T20 Staff löscht Foto');
commit;

-- =====================================================================
-- T21 anon (nicht angemeldet)
-- =====================================================================
begin;
set local role anon;
select tst.throws($q$select * from public.teams$q$, 'T21 anon hat keinen Zugriff auf teams', 'permission denied');
select tst.throws($q$select * from public.players$q$, 'T21 anon hat keinen Zugriff auf players', 'permission denied');
select tst.throws($q$select public.join_team('AAAA-AAAA', 'a', 'b', null, null, null, null)$q$,
                  'T21 anon darf join_team nicht aufrufen', 'permission denied');
do $$
begin
  perform tst.eq((select count(*) from public.team_by_join_code(tst.get('join_a')))::text, '1',
                 'T21 anon darf team_by_join_code aufrufen (Anzeige vor Registrierung)');
end
$$;
commit;

-- =====================================================================
-- T21b Datenexport (Art. 15/20 DSGVO)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
declare
  x jsonb := public.my_data_export();
  pid text := tst.get('max');
begin
  perform tst.eq(x ->> 'user_id', tst.uid('p1')::text, 'T21b Export gehört dem angemeldeten Konto');
  perform tst.eq(x -> 'profile' ->> 'display_name', 'Maxi', 'T21b Export enthält das Profil');
  perform tst.ok(x ?& array['consents', 'team_staff', 'players', 'rpe_entries', 'wellness_entries', 'extra_activities',
                            'absences', 'attendance', 'growth_measurements', 'potentials', 'coach_messages',
                            'match_stats', 'player_ratings', 'performance_tests', 'findings',
                            'push_tokens', 'ai_usage'],
                 'T21b Export enthält alle Bereiche');
  perform tst.eq(x ->> 'format', 'trainerbank-export-v2', 'T21b Exportformat v2');
  perform tst.eq(jsonb_array_length(x -> 'players')::text, '1', 'T21b Export: eigene Spielerzeile');
  perform tst.eq(jsonb_array_length(x -> 'consents')::text, '4', 'T21b Export: eigene Einwilligungen');
  perform tst.eq(jsonb_array_length(x -> 'rpe_entries')::text, '3', 'T21b Export: eigene RPE-Einträge');
  perform tst.eq(jsonb_array_length(x -> 'wellness_entries')::text, '2', 'T21b Export: eigene Wellness-Einträge');
  perform tst.eq(jsonb_array_length(x -> 'absences')::text, '2', 'T21b Export: eigene Abwesenheiten');
  perform tst.eq(jsonb_array_length(x -> 'coach_messages')::text, '1', 'T21b Export: Nachrichten an P1');
  perform tst.eq(jsonb_array_length(x -> 'potentials')::text, '1', 'T21b Export: nur freigegebene Potenziale');
  perform tst.ok(not (x ? 'coach_notes'), 'T21b Export enthält keine internen Trainernotizen');
  perform tst.ok((select bool_and(e ->> 'player_id' = pid) from jsonb_array_elements(x -> 'rpe_entries') e)
                 and (select bool_and(e ->> 'player_id' = pid) from jsonb_array_elements(x -> 'attendance') e),
                 'T21b Export enthält keine Daten anderer Spieler');
end
$$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '';
select tst.throws($q$select public.my_data_export()$q$, 'T21b Export ohne Login abgelehnt', 'not_authenticated');
commit;

begin;
set local role anon;
select tst.throws($q$select public.my_data_export()$q$, 'T21b anon darf my_data_export nicht aufrufen', 'permission denied');
commit;

-- =====================================================================
-- T22 Konto von P1 löschen ⇒ Spielerzeile und Gesundheitsdaten weg,
--     Einwilligungen bleiben als Nachweis (ohne Kontobezug)
-- =====================================================================
do $$
declare
  pid uuid := tst.get('max')::uuid;
begin
  perform tst.ok((select count(*) from public.rpe_entries where player_id = pid) = 3
                 and (select count(*) from public.wellness_entries where player_id = pid) = 2
                 and (select count(*) from public.extra_activities where player_id = pid) = 1
                 and (select count(*) from public.absences where player_id = pid) = 2
                 and (select count(*) from public.attendance where player_id = pid) = 2
                 and (select count(*) from public.consents where user_id = tst.uid('p1')) = 4,
                 'T22 Vorbedingung: P1 hat Gesundheitsdaten und Einwilligungen');
end
$$;

delete from auth.users where id = :'p1';

do $$
declare
  pid uuid := tst.get('max')::uuid;
  u   uuid := tst.uid('p1');
begin
  perform tst.eq((select count(*) from public.players where id = pid)::text, '0', 'T22 Spielerzeile gelöscht');
  perform tst.eq((select count(*) from public.rpe_entries where player_id = pid)::text, '0', 'T22 RPE gelöscht');
  perform tst.eq((select count(*) from public.wellness_entries where player_id = pid)::text, '0', 'T22 Wellness gelöscht');
  perform tst.eq((select count(*) from public.extra_activities where player_id = pid)::text, '0', 'T22 Zusatzsport gelöscht');
  perform tst.eq((select count(*) from public.absences where player_id = pid)::text, '0', 'T22 Abwesenheiten gelöscht');
  perform tst.eq((select count(*) from public.attendance where player_id = pid)::text, '0', 'T22 Anwesenheit gelöscht');
  perform tst.eq((select count(*) from public.potentials where player_id = pid)::text, '0', 'T22 Potenziale gelöscht');
  perform tst.eq((select count(*) from public.coach_messages where player_id = pid)::text, '0', 'T22 Nachrichten gelöscht');
  perform tst.eq((select count(*) from public.coach_notes where player_id = pid)::text, '0', 'T22 Notizen gelöscht');
  perform tst.eq((select count(*) from public.consents where user_id = u)::text, '0', 'T22 Einwilligungen ohne Kontobezug');
  perform tst.eq((select count(*) from public.consents
                  where user_id is null and player_id is null
                    and user_email_hash = encode(sha256(convert_to('p1@test.local', 'UTF8')), 'hex'))::text, '4',
                 'T22 Einwilligungen bleiben als Nachweis erhalten (E-Mail-Hash)');
  perform tst.eq((select count(*) from public.push_tokens where user_id = u)::text, '0', 'T22 Push-Tokens gelöscht');
  perform tst.eq((select count(*) from public.ai_usage where user_id = u)::text, '0', 'T22 KI-Zähler gelöscht');
  perform tst.eq((select count(*) from public.push_log where user_id = u)::text, '0', 'T22 Push-Log gelöscht');
  perform tst.eq((select count(*) from public.profiles where id = u)::text, '0', 'T22 Profil gelöscht');
  perform tst.eq((select count(*) from public.players where team_id = tst.get('team_a')::uuid)::text, '6',
                 'T22 übrige Spieler und Team bleiben bestehen');
  perform tst.eq((select count(*) from public.rpe_entries where player_id = tst.get('p2_player')::uuid)::text, '2',
                 'T22 Daten anderer Spieler bleiben bestehen');
end
$$;

-- =====================================================================
-- T23 Team löschen (Owner) und Ersteller löschen (created_by → null)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.affects(format($q$delete from public.teams where id = %L$q$, tst.get('team_b')), 1,
                   'T23 Owner löscht sein Team');
commit;

delete from auth.users where id = :'coachA';

do $$
begin
  perform tst.ok((select created_by from public.teams where id = tst.get('team_a')::uuid) is null,
                 'T23 teams.created_by wird beim Löschen des Erstellers null');
  perform tst.eq((select count(*) from public.team_staff where team_id = tst.get('team_a')::uuid)::text, '1',
                 'T23 team_staff-Zeile des gelöschten Kontos entfernt');
  perform tst.eq((select count(*) from public.teams where id = tst.get('team_b')::uuid)::text, '0',
                 'T23 gelöschtes Team ist weg');
end
$$;

-- =====================================================================
-- T24 Löschfristen: purge_stale_health_data()
-- =====================================================================
insert into public.rpe_entries (player_id, date, rpe, minutes)
values (tst.get('p2_player')::uuid, (current_date - interval '25 months')::date, 5, 60),
       (tst.get('p2_player')::uuid, (current_date - interval '23 months')::date, 5, 60);
insert into public.wellness_entries (player_id, date, fatigue)
values (tst.get('p2_player')::uuid, (current_date - interval '25 months')::date, 3);
insert into public.extra_activities (player_id, date, type, minutes)
values (tst.get('p2_player')::uuid, (current_date - interval '25 months')::date, 'lauf', 30);
insert into public.push_log (user_id, kind, day)
values (:'p2', 'rpe', current_date - 31), (:'p2', 'rpe', current_date - 1);

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
select tst.throws($q$select public.purge_stale_health_data()$q$, 'T24 Clients dürfen nicht purgen', 'permission denied');
commit;

begin;
set local role service_role;
do $$
declare
  r jsonb := public.purge_stale_health_data();
  pid uuid := tst.get('p2_player')::uuid;
begin
  perform tst.eq(r ->> 'rpe_entries', '1', 'T24 RPE älter als 24 Monate gelöscht');
  perform tst.eq(r ->> 'wellness_entries', '1', 'T24 Wellness älter als 24 Monate gelöscht');
  perform tst.eq(r ->> 'extra_activities', '1', 'T24 Zusatzsport älter als 24 Monate gelöscht');
  perform tst.eq(r ->> 'push_log', '1', 'T24 push_log älter als 30 Tage gelöscht');
  perform tst.eq((select count(*) from public.rpe_entries where player_id = pid)::text, '3',
                 'T24 jüngere RPE (inkl. 23 Monate) bleiben erhalten');
  perform tst.eq((select count(*) from public.push_log)::text, '1', 'T24 jüngeres push_log bleibt');
end
$$;
commit;

-- =====================================================================
-- Zusammenfassung
-- =====================================================================
\o
select count(*) filter (where ok)     as bestanden,
       count(*) filter (where not ok) as fehlgeschlagen
from tst.results;

do $$
declare
  n int;
begin
  select count(*) into n from tst.results where not ok;
  if n > 0 then
    raise exception '% Prüfung(en) fehlgeschlagen', n;
  end if;
end
$$;
