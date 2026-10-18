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
-- weitere Einheit (Athletik) an der Beitritts-Zeile am selben Tag: kein Konflikt mit dem Mannschaftstraining (Paket A)
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, slot, rpe, minutes) values (%L, '2026-10-04', 1, 5, 30)$q$,
                          tst.get('p1_player')), 1, 'T05c RPE einer weiteren Einheit an der Beitritts-Zeile');
-- Daten an der Beitritts-Zeile, die beim Zusammenführen mitwandern müssen
select tst.affects(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'cmj', '2026-10-03', 41)$q$,
                          tst.get('p1_player')), 1, 'T05c Leistungstest an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.player_ratings (player_id, date, kind, rating, visible) values (%L, '2026-10-03', 'training', 7.5, true)$q$,
                          tst.get('p1_player')), 1, 'T05c Note an der Beitritts-Zeile');
-- Gruppe, Aufgabe, Dienst und Strafe an der Beitritts-Zeile (Pakete 3 und 7)
with g as (insert into public.team_groups (team_id, name, kind, visible) values (tst.get('team_a')::uuid, 'Merge-Gruppe', 'custom', true) returning id)
select tst.put('grp_merge', id::text) from g;
select tst.affects(format($q$insert into public.group_members (group_id, player_id) values (%L, %L)$q$, tst.get('grp_merge'), tst.get('p1_player')), 1, 'T05c Gruppe an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.team_tasks (team_id, title, player_id) values (%L, 'Pass mitbringen', %L)$q$, tst.get('team_a'), tst.get('p1_player')), 1, 'T05c Aufgabe an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.team_duties (team_id, date, duty, player_id) values (%L, '2026-10-20', 'material', %L)$q$, tst.get('team_a'), tst.get('p1_player')), 1, 'T05c Dienst an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.team_fines (team_id, player_id, rule, amount) values (%L, %L, 'late', 2)$q$, tst.get('team_a'), tst.get('p1_player')), 1, 'T05c Strafe an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.cash_entries (team_id, amount, kind, cat, player_id, fee_id, period) values (%L, 5, 'in', 'fee', %L, 'fee1', '2026-09')$q$, tst.get('team_a'), tst.get('p1_player')), 1, 'T05c Beitrag an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.cash_entries (team_id, amount, kind, cat, player_id, fine_id) values (%L, 2, 'in', 'fine', %L, (select id from public.team_fines where rule = 'late' and player_id = %L))$q$, tst.get('team_a'), tst.get('p1_player'), tst.get('p1_player')), 1, 'T05c Strafzahlung an der Beitritts-Zeile');
select tst.affects(format($q$insert into public.cash_waivers (team_id, player_id, fee_id, period) values (%L, %L, 'fee1', '2026-10')$q$, tst.get('team_a'), tst.get('p1_player')), 1, 'T05c Befreiung an der Beitritts-Zeile');
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
  perform tst.eq((select rpe::text from public.rpe_entries where player_id = tst.get('max')::uuid and date = '2026-10-04' and slot = 0),
                 '4.0', 'T05c Konflikt: vorhandene RPE der Trainer-Zeile bleibt');
  perform tst.eq((select rpe::text from public.rpe_entries where player_id = tst.get('max')::uuid and date = '2026-10-04' and slot = 1),
                 '5.0', 'T05c RPE der weiteren Einheit am selben Tag wurde verschoben (merge v5)');
  delete from public.rpe_entries where slot <> 0;
  perform tst.eq((select count(*) from public.wellness_entries where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Wellness ohne Konflikt wurde verschoben');
  perform tst.eq((select count(*) from public.consents where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Einwilligung zeigt auf die zusammengeführte Zeile');
  perform tst.eq((select count(*) from public.performance_tests where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Leistungstest wurde verschoben');
  perform tst.eq((select count(*) from public.player_ratings where player_id = tst.get('max')::uuid)::text, '1',
                 'T05c Note wurde verschoben');
  perform tst.eq((select count(*) from public.group_members where player_id = tst.get('max')::uuid)::text || '/' ||
                 (select count(*) from public.team_tasks where player_id = tst.get('max')::uuid)::text || '/' ||
                 (select count(*) from public.team_duties where player_id = tst.get('max')::uuid)::text || '/' ||
                 (select count(*) from public.team_fines where player_id = tst.get('max')::uuid)::text, '1/1/1/1',
                 'T05c Gruppe, Aufgabe, Dienst und Strafe wurden verschoben');
  perform tst.eq((select count(*) from public.cash_entries where player_id = tst.get('max')::uuid)::text || '/' ||
                 (select count(*) from public.cash_waivers where player_id = tst.get('max')::uuid)::text || '/' ||
                 (select status from public.team_fines where player_id = tst.get('max')::uuid), '2/1/done',
                 'T05c Zahlungen und Befreiung wurden verschoben, Strafe bleibt bezahlt');
  delete from public.cash_entries; delete from public.cash_waivers;
  delete from public.performance_tests where player_id = tst.get('max')::uuid;
  delete from public.player_ratings where player_id = tst.get('max')::uuid;
  delete from public.team_tasks; delete from public.team_duties; delete from public.team_fines; delete from public.team_groups;
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
-- T25 Baukasten: Absagen durch Spieler abschaltbar (Gruppen: T33)
-- =====================================================================
begin;
update public.teams set settings = settings || '{"playerAbs": false}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$insert into public.absences (player_id, type, from_date) values (%L, 'urlaub', '2026-12-27')$q$, tst.get('max')),
                  'T25 P1 kann sich nicht abmelden, wenn Absagen per App aus sind', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
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
-- T33 Gruppen (Paket 3): Staff verwaltet; Spieler sehen nur freigegebene
-- Gruppen und nur die eigene Mitgliedschaft
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
with ins as (insert into public.team_groups (team_id, name, kind, visible) values (tst.get('team_a')::uuid, 'Reha', 'reha', false) returning id)
select tst.put('grp_reha', id::text) from ins;
with ins as (insert into public.team_groups (team_id, name, kind, visible) values (tst.get('team_a')::uuid, 'Torhüter', 'tw', true) returning id)
select tst.put('grp_tw', id::text) from ins;
select tst.affects(format($q$insert into public.group_members (group_id, player_id) values (%L, %L), (%L, %L), (%L, %L)$q$,
                          tst.get('grp_reha'), tst.get('max'), tst.get('grp_tw'), tst.get('max'), tst.get('grp_tw'), tst.get('p2_player')),
                   3, 'T33 Coach ordnet Spieler Gruppen zu');
do $$ begin
  perform tst.eq((select string_agg(distinct team_id::text, ',') from public.group_members), tst.get('team_a'), 'T33 Team der Mitgliedschaft kommt aus dem Spieler');
end $$;
select tst.throws(format($q$insert into public.team_groups (team_id, name) values (%L, '   ')$q$, tst.get('team_a')),
                  'T33 leerer Gruppenname wird abgelehnt', 'check constraint');
select tst.throws(format($q$insert into public.team_groups (team_id, name, kind) values (%L, 'X', 'geheim')$q$, tst.get('team_a')),
                  'T33 unbekannte Gruppenart wird abgelehnt', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
with ins as (insert into public.team_groups (team_id, name) values (tst.get('team_b')::uuid, 'B-Gruppe') returning id)
select tst.put('grp_b', id::text) from ins;
select tst.throws(format($q$insert into public.group_members (group_id, player_id) values (%L, %L)$q$, tst.get('grp_b'), tst.get('max')),
                  'T33 Spieler eines anderen Teams kann nicht zugeordnet werden', 'different_teams');
do $$ begin
  perform tst.eq((select count(*) from public.team_groups where team_id = tst.get('team_a')::uuid)::text, '0', 'T33 Coach B sieht keine Gruppen von Team A');
  perform tst.eq((select count(*) from public.group_members)::text, '0', 'T33 Coach B sieht keine Mitgliedschaften von Team A');
end $$;
select tst.affects(format($q$update public.team_groups set visible = true where id = %L$q$, tst.get('grp_tw')), 0, 'T33 Coach B ändert keine fremde Gruppe');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select string_agg(name, ',' order by name) from public.team_groups), 'Torhüter', 'T33 P1 sieht nur freigegebene Gruppen, in denen er ist');
  perform tst.eq((select count(*) from public.group_members)::text, '1', 'T33 P1 sieht nur die eigene Mitgliedschaft (nicht die von P2, nicht die verborgene)');
end $$;
select tst.throws(format($q$insert into public.group_members (group_id, player_id) values (%L, %L)$q$, tst.get('grp_tw'), tst.get('erik')),
                  'T33 P1 kann keine Mitglieder eintragen', 'row-level security');
select tst.affects(format($q$delete from public.group_members where player_id = %L$q$, tst.get('max')), 0, 'T33 P1 kann sich nicht austragen');
select tst.affects(format($q$update public.team_groups set visible = true where id = %L$q$, tst.get('grp_reha')), 0, 'T33 P1 kann die Sichtbarkeit nicht ändern');
select tst.throws(format($q$insert into public.team_groups (team_id, name) values (%L, 'Eigene')$q$, tst.get('team_a')),
                  'T33 P1 kann keine Gruppe anlegen', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.team_groups set visible = true where id = %L$q$, tst.get('grp_reha')), 1, 'T33 Coach gibt die Reha-Gruppe frei');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.team_groups)::text, '2', 'T33 nach Freigabe sieht P1 beide eigenen Gruppen');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select string_agg(name, ',') from public.team_groups), 'Torhüter', 'T33 P2 sieht die Reha-Gruppe nicht (kein Mitglied)');
  perform tst.eq((select count(*) from public.group_members)::text, '1', 'T33 P2 sieht nur sich selbst in der Torhüter-Gruppe');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$delete from public.team_groups where id = %L$q$, tst.get('grp_reha')), 1, 'T33 Coach löscht eine Gruppe');
do $$ begin
  perform tst.eq((select count(*) from public.group_members where group_id = tst.get('grp_reha')::uuid)::text, '0', 'T33 Mitgliedschaften verschwinden mit der Gruppe');
end $$;
commit;

begin;
delete from public.team_groups;
commit;

-- =====================================================================
-- T34 Beschwerden mit Körperregion (Paket 5)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into public.wellness_entries (player_id, date, sleep_hours, fatigue, complaint, complaint_areas)
                             values (%L, '2026-10-09', 7.5, 3, 'clear', '{hams:l,ill_up}')$q$, tst.get('max')),
                   1, 'T34 P1 meldet Beschwerden mit Regionen');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas) values (%L, '2026-10-10', 'light', '{ellbogen:l}')$q$, tst.get('max')),
                  'T34 unbekannte Region wird abgelehnt', 'check constraint');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas) values (%L, '2026-10-10', 'light', '{head:l}')$q$, tst.get('max')),
                  'T34 Kopf hat keine Seite', 'check constraint');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas) values (%L, '2026-10-10', 'none', '{knee:r}')$q$, tst.get('max')),
                  'T34 ohne Beschwerde keine Regionen', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.eq((select array_to_string(complaint_areas, ',') from public.wellness_entries where player_id = tst.get('max')::uuid and date = '2026-10-09'),
                 'hams:l,ill_up', 'T34 Trainer sieht die Regionen');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.wellness_entries where player_id = tst.get('max')::uuid)::text, '0', 'T34 Mitspieler sieht keine Beschwerden');
end $$;
commit;

begin;
delete from public.wellness_entries where player_id = tst.get('max')::uuid and date = '2026-10-09';
commit;

-- =====================================================================
-- T35 Trainingstag: Ablauf-Blöcke und Skizzen (Paket 6) – nur Trainerteam
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
with ins as (insert into public.staff_profiles (team_id, name, role) values (tst.get('team_a')::uuid, 'Co Tom', 'co') returning id)
select tst.put('staff_co', id::text) from ins;
with ins as (insert into public.session_blocks (team_id, date, sort, title, minutes, staff_id, points)
             values (tst.get('team_a')::uuid, '2026-10-15', 0, 'Rondo', 12, tst.get('staff_co')::uuid, '["Offene Körperstellung"]') returning id)
select tst.put('block1', id::text) from ins;
do $$ begin
  perform tst.eq((select updated_by::text from public.session_blocks where id = tst.get('block1')::uuid), tst.uid('coachA')::text, 'T35 Bearbeiter wird gesetzt');
end $$;
select tst.affects(format($q$update public.session_blocks set photo_path = %L where id = %L$q$, tst.get('team_a') || '/' || tst.get('block1') || '.jpg', tst.get('block1')), 1, 'T35 Foto-Pfad im Teamordner');
select tst.throws(format($q$update public.session_blocks set photo_path = 'x/y.jpg' where id = %L$q$, tst.get('block1')), 'T35 fremder Foto-Pfad wird abgelehnt', 'check constraint');
select tst.affects(format($q$insert into storage.objects (bucket_id, name) values ('sketches', %L)$q$, tst.get('team_a') || '/' || tst.get('block1') || '.jpg'), 1, 'T35 Coach lädt Skizze hoch');
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('sketches', %L)$q$, tst.get('team_a') || '/skizze.png'), 'T35 nur Bilder mit Block-ID', 'row-level security');
select tst.throws(format($q$insert into public.session_blocks (team_id, date, title, minutes) values (%L, '2026-10-15', '  ', 10)$q$, tst.get('team_a')), 'T35 leerer Titel wird abgelehnt', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.throws(format($q$insert into public.session_blocks (team_id, date, title, minutes, staff_id) values (%L, '2026-10-15', 'X', 10, %L)$q$, tst.get('team_b'), tst.get('staff_co')),
                  'T35 Trainer eines anderen Teams kann nicht zugeteilt werden', 'different_teams');
do $$ begin
  perform tst.eq((select count(*) from public.session_blocks)::text, '0', 'T35 Coach B sieht keine Blöcke von Team A');
  perform tst.eq((select count(*) from storage.objects where bucket_id = 'sketches')::text, '0', 'T35 Coach B sieht keine Skizzen von Team A');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.session_blocks)::text, '0', 'T35 Spieler sieht den Ablauf nicht');
  perform tst.eq((select count(*) from storage.objects where bucket_id = 'sketches')::text, '0', 'T35 Spieler sieht keine Skizzen');
end $$;
select tst.throws(format($q$insert into public.session_blocks (team_id, date, title, minutes) values (%L, '2026-10-15', 'Eigener Block', 10)$q$, tst.get('team_a')),
                  'T35 Spieler kann keinen Block anlegen', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$delete from public.staff_profiles where id = %L$q$, tst.get('staff_co')), 1, 'T35 Trainerprofil löschen');
do $$ begin
  perform tst.eq((select coalesce(staff_id::text, 'null') from public.session_blocks where id = tst.get('block1')::uuid), 'null', 'T35 Block bleibt, Zuständigkeit wird geleert');
end $$;
commit;

begin;
delete from public.session_blocks; delete from storage.objects where bucket_id = 'sketches'; delete from public.staff_profiles;
commit;

-- =====================================================================
-- T36 Aufgaben, Dienste, Strafen (Paket 7)
-- =====================================================================
begin;
with ins as (insert into public.players (team_id, first_name, last_name, birthdate) values (tst.get('team_b')::uuid, 'Bea', 'Fremd', '2007-01-01') returning id)
select tst.put('bea', id::text) from ins;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
with ins as (insert into public.team_fines (team_id, player_id, rule, ref_date, auto, duty_date) values (tst.get('team_a')::uuid, tst.get('max')::uuid, 'late_rpe', '2026-10-06', true, '2026-10-12') returning id)
select tst.put('fine1', id::text) from ins;
select tst.throws(format($q$insert into public.team_fines (team_id, player_id, rule, ref_date, auto) values (%L, %L, 'late_rpe', '2026-10-06', true)$q$, tst.get('team_a'), tst.get('max')),
                  'T36 Automatik-Strafe je Regel/Spieler/Einheit nur einmal', 'duplicate key');
select tst.affects(format($q$insert into public.team_duties (team_id, date, duty, player_id, source, fine_id) values (%L, '2026-10-12', 'material', %L, 'fine', %L)$q$, tst.get('team_a'), tst.get('max'), tst.get('fine1')), 1, 'T36 Dienst als Strafe');
select tst.affects(format($q$insert into public.team_duties (team_id, date, duty, player_id) values (%L, '2026-10-12', 'material', %L)$q$, tst.get('team_a'), tst.get('p2_player')), 1, 'T36 Dienst reihum');
select tst.affects(format($q$insert into public.team_tasks (team_id, title, player_id, due) values (%L, 'Pass mitbringen', %L, '2026-10-18')$q$, tst.get('team_a'), tst.get('max')), 1, 'T36 Aufgabe für Spieler');
select tst.affects(format($q$insert into public.team_tasks (team_id, title) values (%L, 'Hütchen bestellen')$q$, tst.get('team_a')), 1, 'T36 Trainer-Aufgabe');
select tst.throws(format($q$insert into public.team_tasks (team_id, title, player_id) values (%L, 'Fremd', %L)$q$, tst.get('team_a'), tst.get('bea')),
                  'T36 Spieler eines anderen Teams', 'different_teams');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.team_fines)::text, '1', 'T36 P1 sieht eigene Strafe');
  perform tst.eq((select count(*) from public.team_duties)::text, '1', 'T36 P1 sieht nur eigenen Dienst');
  perform tst.eq((select count(*) from public.team_tasks)::text, '1', 'T36 P1 sieht nur eigene Aufgabe (keine Trainer-Todos)');
end $$;
select tst.affects($q$update public.team_tasks set done_at = now()$q$, 1, 'T36 P1 hakt eigene Aufgabe ab');
do $$ begin
  perform tst.eq((select done_by::text from public.team_tasks where title = 'Pass mitbringen'), tst.uid('p1')::text, 'T36 erledigt von P1');
end $$;
select tst.throws($q$update public.team_tasks set title = 'Kein Pass nötig'$q$, 'T36 P1 kann den Titel nicht ändern', 'forbidden');
select tst.affects($q$update public.team_fines set status = 'waived'$q$, 0, 'T36 P1 kann Strafe nicht erlassen');
select tst.affects($q$delete from public.team_duties$q$, 0, 'T36 P1 kann sich nicht austragen');
select tst.throws(format($q$insert into public.team_tasks (team_id, title, player_id) values (%L, 'Selbst', %L)$q$, tst.get('team_a'), tst.get('max')),
                  'T36 P1 legt keine Aufgaben an', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.team_fines)::text, '0', 'T36 P2 sieht keine fremden Strafen');
  perform tst.eq((select count(*) from public.team_duties)::text, '1', 'T36 P2 sieht eigenen Dienst');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$ begin
  perform tst.eq((select count(*) from public.team_fines)::text || '/' || (select count(*) from public.team_duties)::text || '/' || (select count(*) from public.team_tasks)::text, '0/0/0', 'T36 Coach B sieht nichts von Team A');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$delete from public.team_fines where id = %L$q$, tst.get('fine1')), 1, 'T36 Strafe löschen');
do $$ begin
  perform tst.eq((select count(*) from public.team_duties where source = 'fine')::text, '0', 'T36 zugehöriger Dienst verschwindet mit');
end $$;
commit;

begin;
delete from public.team_duties; delete from public.team_tasks; delete from public.team_fines;
delete from public.players where id = tst.get('bea')::uuid;
commit;

-- =====================================================================
-- T37 Platzierung in Tests (Paket 8): eigener Platz ohne Werte anderer
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.performance_tests (team_id, player_id, test, date, value) values
  (%1$L, %2$L, 'sprint10', '2026-10-01', 1.80), (%1$L, %3$L, 'sprint10', '2026-10-01', 1.75), (%1$L, %4$L, 'sprint10', '2026-10-01', 1.90),
  (%1$L, %5$L, 'sprint10', '2026-10-01', 1.70), (%1$L, %6$L, 'sprint10', '2026-10-01', 1.85),
  (%1$L, %2$L, 'cmj', '2026-10-01', 40), (%1$L, %3$L, 'cmj', '2026-10-01', 42)$q$,
  tst.get('team_a'), tst.get('max'), tst.get('erik'), tst.get('tom'), tst.get('p2_player'), tst.get('p4_player')), 7, 'T37 Testwerte für 5 Spieler');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select string_agg(test || ':' || rank || '/' || n || ':' || coalesce(best::text, '-'), ',') from public.my_test_ranks(tst.get('max')::uuid)), 'sprint10:3/5:-',
                 'T37 eigener Platz (3 von 5), ohne Teambestwert, CMJ erst ab 5 Werten');
  perform tst.eq((select count(*) from public.my_test_ranks(tst.get('p2_player')::uuid))::text, '0', 'T37 kein Platz für fremde Spieler');
  perform tst.eq((select count(*) from public.performance_tests where player_id <> tst.get('max')::uuid)::text, '0', 'T37 Werte anderer bleiben verborgen');
end $$;
commit;

begin;
update public.teams set settings = settings || '{"testRank": "best"}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select best::text from public.my_test_ranks(tst.get('max')::uuid) where test = 'sprint10'), '1.70', 'T37 mit Freigabe: Teambestwert ohne Namen');
end $$;
commit;

begin;
update public.teams set settings = settings || '{"testRank": "off"}'::jsonb where id = tst.get('team_a')::uuid;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.my_test_ranks(tst.get('max')::uuid))::text, '0', 'T37 Platzierung abgeschaltet');
end $$;
commit;

begin;
update public.teams set settings = settings - 'testRank' where id = tst.get('team_a')::uuid;
delete from public.performance_tests where date = '2026-10-01' and test in ('sprint10', 'cmj');
commit;

-- =====================================================================
-- T38 Region der Verletzung (Paket 9)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.absences (player_id, team_id, type, from_date, stage, area) values (%L, %L, 'verletzung', '2026-11-02', 2, 'hams:r')$q$, tst.get('max'), tst.get('team_a')), 1, 'T38 Verletzung mit Region');
select tst.throws(format($q$insert into public.absences (player_id, team_id, type, from_date, area) values (%L, %L, 'urlaub', '2026-11-20', 'knee:l')$q$, tst.get('max'), tst.get('team_a')), 'T38 Region nur bei Verletzung', 'check constraint');
select tst.throws(format($q$insert into public.absences (player_id, team_id, type, from_date, stage, area) values (%L, %L, 'verletzung', '2026-11-20', 1, 'ill_down')$q$, tst.get('max'), tst.get('team_a')), 'T38 keine Krankheitszeichen als Region', 'check constraint');
commit;
begin;
delete from public.absences where from_date = '2026-11-02';
commit;

-- =====================================================================
-- T39 Offline-Einträge (Paket 11.1): Eingabezeitpunkt zählt, aber nie Zukunft/vor der Einheit
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes, entered_at) values (%L, current_date - 200, 6, 90, now() - interval '20 hours')$q$, tst.get('max')),
                   1, 'T39 Spieler sendet offline erfassten RPE mit Eingabezeitpunkt');
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes, entered_at) values (%L, current_date - 201, 6, 90, now() + interval '3 days')$q$, tst.get('max')),
                   1, 'T39 Zeitpunkt in der Zukunft wird angenommen …');
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes, entered_at) values (%L, current_date - 202, 6, 90, (current_date - 260)::timestamptz)$q$, tst.get('max')),
                   1, 'T39 Zeitpunkt vor der Einheit wird angenommen …');
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, current_date - 203, 5, 60)$q$, tst.get('max')),
                   1, 'T39 ohne Zeitpunkt (ältere App) wird angenommen …');
select tst.affects(format($q$update public.rpe_entries set rpe = 7, entered_at = now() where player_id = %L and date = current_date - 200$q$, tst.get('max')),
                   1, 'T39 späteres Bearbeiten wird angenommen …');
commit;
do $$
declare pid uuid := tst.get('max')::uuid; v timestamptz;
begin
  select entered_at into v from public.rpe_entries where player_id = pid and date = current_date - 200;
  perform tst.ok(v between now() - interval '21 hours' and now() - interval '19 hours', 'T39 … der früheste Eingabezeitpunkt bleibt (auch nach Bearbeiten)');
  select entered_at into v from public.rpe_entries where player_id = pid and date = current_date - 201;
  perform tst.ok(v <= now(), 'T39 … aber nie in der Zukunft');
  select entered_at into v from public.rpe_entries where player_id = pid and date = current_date - 202;
  perform tst.ok(v >= ((current_date - 202)::timestamp - interval '14 hours') at time zone 'UTC', 'T39 … und nie vor dem Tag der Einheit');
  select entered_at into v from public.rpe_entries where player_id = pid and date = current_date - 203;
  perform tst.ok(v between now() - interval '1 minute' and now(), 'T39 … ohne Angabe gilt der Zeitpunkt des Speicherns');
  perform tst.eq((select count(*) from public.rpe_entries where entered_at is null)::text, '0', 'T39 alle RPE-Einträge haben einen Eingabezeitpunkt');
end
$$;
insert into public.team_tasks (team_id, title, player_id) values (tst.get('team_a')::uuid, 'T39 Aufgabe', tst.get('max')::uuid);
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects($q$update public.team_tasks set done_at = now() + interval '2 days' where title = 'T39 Aufgabe'$q$, 1, 'T39 Spieler hakt offline erledigte Aufgabe ab');
commit;
do $$
begin
  perform tst.ok((select done_at <= now() and done_by is not null from public.team_tasks where title = 'T39 Aufgabe'), 'T39 „erledigt am“ nie in der Zukunft, erledigt von wird gesetzt');
  delete from public.team_tasks where title = 'T39 Aufgabe';
  delete from public.rpe_entries where player_id = tst.get('max')::uuid and date between current_date - 203 and current_date - 200;
end
$$;

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
-- T40 Rechte je Mitglied des Trainerteams (Paket 11.2)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.findings (player_id, date, title, path, mime, consent_source) values (%L, '2026-10-06', 'T40 Befund', %L, 'application/pdf', 'schriftlich')$q$,
                          tst.get('max'), tst.get('team_a') || '/' || tst.get('max') || '/40404040-4040-4040-8040-404040404040.pdf'), 1, 'T40 Owner legt Befund an');
insert into public.team_tasks (team_id, title) values (tst.get('team_a')::uuid, 'T40 Todo für alle Trainer');
insert into public.team_tasks (team_id, title, player_id) values (tst.get('team_a')::uuid, 'T40 Spieleraufgabe', tst.get('max')::uuid);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$
declare t uuid := tst.get('team_a')::uuid;
begin
  perform tst.ok(public.staff_can(t, 'health') and public.staff_can(t, 'plan') and public.staff_can(t, 'squad') and public.staff_can(t, 'tasks'),
                 'T40 Co-Trainer (Standard): Gesundheit, Planung, Kader, Aufgaben');
  perform tst.ok(not public.staff_can(t, 'medical') and not public.staff_can(t, 'cash') and not public.staff_can(t, 'admin'),
                 'T40 Co-Trainer (Standard): keine Befunde, keine Kasse, keine Team-Einstellungen');
  perform tst.eq((select count(*) from public.findings)::text, '0', 'T40 Co-Trainer ohne Recht sieht keine Befunde');
  perform tst.ok((select count(*) from public.rpe_entries) > 0, 'T40 Co-Trainer mit Recht sieht RPE-Daten');
  perform tst.eq((select perms::text from public.team_staff_perms(t) where user_id = tst.uid('coachC')), '{health,plan,squad,perf,notes,messages,tasks,scout}', 'T40 Rechteliste zeigt Standardrechte');
end
$$;
select tst.throws(format($q$insert into storage.objects (bucket_id, name) values ('findings', %L)$q$, tst.get('team_a') || '/' || tst.get('max') || '/41414141-4141-4141-8141-414141414141.pdf'),
                  'T40 Co-Trainer ohne Recht lädt keine Befund-Datei hoch', 'row-level security');
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{testRank}', '"best"') where id = %L$q$, tst.get('team_a')), 1, 'T40 Testeinstellung mit Recht „perf“');
select tst.throws(format($q$update public.teams set settings = jsonb_set(settings, '{playerView}', '{"ratings": false}') where id = %L$q$, tst.get('team_a')), 'T40 was Spieler sehen nur mit „admin“', 'forbidden');
select tst.throws(format($q$update public.teams set name = 'Umbenannt' where id = %L$q$, tst.get('team_a')), 'T40 Teamname nur mit „admin“', 'forbidden');
select tst.throws(format($q$select public.set_staff_perms(%L, %L, '{health,cash,admin}')$q$, tst.get('team_a'), tst.uid('coachC')), 'T40 Rechte vergibt nur der Owner', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.throws(format($q$select public.set_staff_perms(%L, %L, '{health,fliegen}')$q$, tst.get('team_a'), tst.uid('coachC')), 'T40 unbekanntes Recht wird abgelehnt', 'check constraint');
select tst.throws(format($q$select public.set_staff_perms(%L, %L, '{health}')$q$, tst.get('team_a'), tst.uid('coachA')), 'T40 Owner-Zeile hat immer alle Rechte', 'not_found');
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), array['squad', 'messages', 'squad']);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$
declare t uuid := tst.get('team_a')::uuid;
begin
  perform tst.eq((select perms::text from public.team_staff where user_id = tst.uid('coachC') and team_id = t), '{messages,squad}', 'T40 Owner setzt Rechte (sortiert, ohne Doppelte)');
  perform tst.eq((select count(*) from public.rpe_entries)::text, '0', 'T40 ohne „health“ keine RPE-Daten');
  perform tst.eq((select count(*) from public.wellness_entries)::text, '0', 'T40 ohne „health“ kein Morgen-Check');
  perform tst.eq((select count(*) from public.coach_notes)::text, '0', 'T40 ohne „notes“ keine Trainernotizen');
  perform tst.ok((select count(*) from public.players) > 0, 'T40 Kader sieht das ganze Trainerteam');
end
$$;
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, current_date - 300, 5, 60)$q$, tst.get('max')), 'T40 ohne „health“ keine RPE eintragen', 'row-level security');
select tst.throws(format($q$insert into public.team_events (team_id, date, title, type) values (%L, '2026-12-01', 'X', 'sonst')$q$, tst.get('team_a')), 'T40 ohne „plan“ keine Termine', 'row-level security');
select tst.affects(format($q$insert into public.attendance (player_id, date, team_id, status) values (%L, '2026-12-02', %L, 'ent')$q$, tst.get('max'), tst.get('team_a')), 1, 'T40 mit „squad“ Anwesenheit eintragen');
select tst.throws(format($q$insert into public.team_tasks (team_id, title) values (%L, 'X')$q$, tst.get('team_a')), 'T40 ohne „tasks“ keine Aufgaben anlegen', 'row-level security');
select tst.affects($q$update public.team_tasks set done_at = now() where title = 'T40 Todo für alle Trainer'$q$, 1, 'T40 Todo für alle Trainer abhaken (ohne „tasks“)');
select tst.throws($q$update public.team_tasks set title = 'Y' where title = 'T40 Todo für alle Trainer'$q$, 'T40 … aber nicht umbenennen', 'forbidden');
select tst.affects($q$update public.team_tasks set done_at = now() where title = 'T40 Spieleraufgabe'$q$, 0, 'T40 Spieleraufgaben nicht abhaken (ohne „tasks“)');
select tst.throws(format($q$update public.teams set settings = jsonb_set(settings, '{days}', '{}') where id = %L$q$, tst.get('team_a')), 'T40 Trainingstage nur mit „plan“', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), null);
do $$
begin
  perform tst.eq((select perms is null from public.team_staff where user_id = tst.uid('coachC'))::text, 'true', 'T40 zurück auf Standardrechte');
  perform tst.ok((select count(*) from public.findings) = 1, 'T40 Owner sieht Befunde immer');
end
$$;
delete from public.findings where title = 'T40 Befund';
delete from public.attendance where date = '2026-12-02';
delete from public.team_tasks where title like 'T40%';
update public.teams set settings = settings - 'testRank' where id = tst.get('team_a')::uuid;
commit;

-- =====================================================================
-- T41 Mannschaftskasse (Paket 11.3): Kasse/Kassenwart verwalten, Spieler sehen nur Eigenes
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{kasse}', '{"on": true, "currency": "EUR", "money": true, "showBalance": false, "fees": [{"id": "fee1", "name": "Kasse", "amount": 5, "every": "month", "from": "2026-08-01"}]}') where id = %L$q$, tst.get('team_a')),
                   1, 'T41 Owner richtet die Kasse ein');
select tst.affects(format($q$insert into public.cash_entries (team_id, date, amount, kind, cat, player_id, fee_id, period) values (%L, '2026-08-03', 5, 'in', 'fee', %L, 'fee1', '2026-08')$q$, tst.get('team_a'), tst.get('max')),
                   1, 'T41 Beitrag von Max gebucht');
select tst.throws(format($q$insert into public.cash_entries (team_id, date, amount, kind, cat, player_id, fee_id, period) values (%L, '2026-08-04', 5, 'in', 'fee', %L, 'fee1', '2026-08')$q$, tst.get('team_a'), tst.get('max')),
                  'T41 derselbe Zeitraum nur einmal', 'duplicate key');
select tst.affects(format($q$insert into public.cash_entries (team_id, date, amount, kind, cat, note) values (%L, '2026-08-10', 50, 'in', 'donation', 'Sponsor'), (%L, '2026-08-20', 20, 'out', 'event', 'Pizza')$q$, tst.get('team_a'), tst.get('team_a')),
                   2, 'T41 Spende und Ausgabe gebucht');
select tst.throws(format($q$insert into public.cash_entries (team_id, amount, kind, cat, player_id, fee_id) values (%L, 5, 'in', 'fee', %L, 'fee1')$q$, tst.get('team_a'), tst.get('max')),
                  'T41 Beitragszahlung braucht einen Zeitraum', 'check constraint');
select tst.throws(format($q$insert into public.cash_entries (team_id, amount, kind, cat) values (%L, 0, 'in', 'other')$q$, tst.get('team_a')),
                  'T41 Betrag muss positiv sein', 'check constraint');
insert into public.team_fines (team_id, player_id, rule, amount) values (tst.get('team_a')::uuid, tst.get('max')::uuid, 't41', 5);
select tst.throws(format($q$insert into public.cash_entries (team_id, amount, kind, cat, player_id, fine_id) values (%L, 5, 'in', 'fine', %L, (select id from public.team_fines where rule = 't41'))$q$, tst.get('team_a'), tst.get('erik')),
                  'T41 Strafe nur vom betroffenen Spieler bezahlt', 'different_teams');
select tst.affects(format($q$insert into public.cash_entries (team_id, amount, kind, cat, player_id, fine_id) values (%L, 5, 'in', 'fine', %L, (select id from public.team_fines where rule = 't41'))$q$, tst.get('team_a'), tst.get('max')),
                   1, 'T41 Strafe bezahlt (Kassenbuch)');
select tst.eq((select status from public.team_fines where rule = 't41'), 'done', 'T41 bezahlte Strafe ist erledigt');
select tst.affects(format($q$insert into public.cash_waivers (team_id, player_id, fee_id, period) values (%L, %L, 'fee1', '2026-09')$q$, tst.get('team_a'), tst.get('max')), 1, 'T41 Owner erlässt einen Monat');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.cash_entries)::text, '0', 'T41 Co-Trainer ohne Recht „Kasse“ sieht kein Kassenbuch');
  perform tst.eq((select count(*) from public.cash_waivers)::text, '0', 'T41 … und keine Befreiungen');
  perform tst.ok(public.team_cash_balance(tst.get('team_a')::uuid) is null, 'T41 … und keinen Kassenstand (nicht freigegeben)');
end $$;
select tst.throws(format($q$insert into public.cash_entries (team_id, amount, kind, cat) values (%L, 1, 'in', 'other')$q$, tst.get('team_a')), 'T41 Co-Trainer ohne Recht bucht nichts', 'row-level security');
select tst.throws(format($q$update public.teams set settings = jsonb_set(settings, '{kasse,showBalance}', 'true') where id = %L$q$, tst.get('team_a')), 'T41 Kasse einstellen nur mit „Kasse“', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select string_agg(cat, ',' order by cat) from public.cash_entries), 'fee,fine', 'T41 Spieler sieht nur eigene Zahlungen');
  perform tst.eq((select count(*) from public.cash_waivers)::text, '1', 'T41 Spieler sieht eigene Befreiung');
  perform tst.ok(public.team_cash_balance(tst.get('team_a')::uuid) is null, 'T41 Kassenstand nur, wenn freigegeben');
end $$;
select tst.throws(format($q$insert into public.cash_entries (team_id, amount, kind, cat) values (%L, 1, 'in', 'other')$q$, tst.get('team_a')), 'T41 Spieler bucht nichts', 'row-level security');
select tst.affects($q$delete from public.cash_entries$q$, 0, 'T41 Spieler löscht nichts');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.teams set settings = jsonb_set(jsonb_set(settings, '{kasse,showBalance}', 'true'), '{kasse,treasurer}', to_jsonb(%L::text)) where id = %L$q$, tst.get('p2_player'), tst.get('team_a')),
                   1, 'T41 Owner gibt Kassenstand frei und macht P2 zum Kassenwart');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.eq(public.team_cash_balance(tst.get('team_a')::uuid)::text, '40.00', 'T41 freigegebener Kassenstand (5 + 50 − 20 + 5)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.ok(public.is_treasurer(tst.get('team_a')::uuid), 'T41 P2 ist Kassenwart');
  perform tst.eq((select count(*) from public.cash_entries)::text, '4', 'T41 Kassenwart sieht das Kassenbuch');
  perform tst.ok((select count(*) from public.team_fines where rule = 't41') = 1, 'T41 Kassenwart sieht Strafen zum Kassieren');
  perform tst.eq((select count(*) from public.rpe_entries where player_id <> tst.get('p2_player')::uuid)::text, '0', 'T41 Kassenwart sieht keine Gesundheitsdaten anderer');
end $$;
select tst.affects(format($q$insert into public.cash_entries (team_id, date, amount, kind, cat, player_id, fee_id, period) values (%L, '2026-10-02', 5, 'in', 'fee', %L, 'fee1', '2026-10')$q$, tst.get('team_a'), tst.get('max')),
                   1, 'T41 Kassenwart bucht eine Zahlung');
select tst.throws(format($q$insert into public.cash_waivers (team_id, player_id, fee_id, period) values (%L, %L, 'fee1', '2026-10')$q$, tst.get('team_a'), tst.get('max')), 'T41 Kassenwart erlässt keine Beiträge', 'row-level security');
select tst.affects($q$update public.team_fines set amount = 1 where rule = 't41'$q$, 0, 'T41 Kassenwart ändert keine Strafen');
select tst.affects($q$delete from public.cash_entries where cat = 'fine'$q$, 1, 'T41 Kassenwart nimmt die Strafzahlung zurück');
commit;

do $$
begin
  perform tst.eq((select status from public.team_fines where rule = 't41'), 'open', 'T41 zurückgenommene Zahlung ⇒ Strafe wieder offen');
  delete from public.cash_entries where team_id = tst.get('team_a')::uuid;
  delete from public.cash_waivers where team_id = tst.get('team_a')::uuid;
  delete from public.team_fines where rule = 't41';
  update public.teams set settings = settings - 'kasse' where id = tst.get('team_a')::uuid;
end
$$;

-- =====================================================================
-- T42 Körperkarte: Angaben zum Schmerz (Paket 11.4)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas, complaint_details) values (%L, '2026-11-20', 'light', '{hams:r,ill_up}', '{"hams": {"nrs": 6, "q": ["pull"], "onset": "sudden"}}')$q$, tst.get('max')),
                   1, 'T42 Spieler meldet Schmerz mit Angaben');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas, complaint_details) values (%L, '2026-11-21', 'light', '{hams:r}', '{"knee": {"nrs": 3}}')$q$, tst.get('max')),
                  'T42 Angaben nur für gemeldete Regionen', 'check constraint');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas, complaint_details) values (%L, '2026-11-22', 'none', '{}', '{}')$q$, tst.get('max')),
                  'T42 ohne Beschwerde keine Angaben', 'check constraint');
select tst.throws(format($q$insert into public.wellness_entries (player_id, date, complaint, complaint_areas, complaint_details) values (%L, '2026-11-23', 'light', '{hams:r}', '{"hams": 5}')$q$, tst.get('max')),
                  'T42 Angaben je Region als Objekt', 'check constraint');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.wellness_entries where player_id = tst.get('max')::uuid)::text, '0', 'T42 Mitspieler sieht keine Schmerzangaben');
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.eq((select complaint_details -> 'hams' ->> 'nrs' from public.wellness_entries where player_id = tst.get('max')::uuid and date = '2026-11-20'), '6', 'T42 Trainerteam sieht die Angaben');
end $$;
commit;
delete from public.wellness_entries where date = '2026-11-20';

-- =====================================================================
-- T43 Mehrere Einheiten am Tag, Torwarttraining, Trainingseindruck (Paket A)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{units}', '{"1": [{"slot": 1, "art": "athletik", "title": "", "zeit": "17:30", "dauer": 30, "rpe": 6, "groupId": null, "staffId": null, "inhalt": ""}]}') where id = %L$q$, tst.get('team_a')),
                   1, 'T43 Owner legt wiederkehrende Athletik an');
with ins as (insert into public.team_groups (team_id, name, kind, visible) values (tst.get('team_a')::uuid, 'T43 intern', 'custom', false) returning id)
select tst.put('grp_hidden', id::text) from ins;
with ins as (insert into public.team_groups (team_id, name, kind, visible) values (tst.get('team_a')::uuid, 'T43 Torhüter', 'tw', true) returning id)
select tst.put('grp_tw43', id::text) from ins;
insert into public.group_members (group_id, player_id) values (tst.get('grp_hidden')::uuid, tst.get('max')::uuid),
  (tst.get('grp_tw43')::uuid, tst.get('max')::uuid), (tst.get('grp_tw43')::uuid, tst.get('p2_player')::uuid);
select tst.affects(format($q$insert into public.sessions (team_id, date, type, duration, time) values (%L, '2026-09-21', 'Training', 90, '18:00')$q$, tst.get('team_a')), 1, 'T43 Mannschaftstraining am Doppeltag');
select tst.affects(format($q$insert into public.day_units (team_id, date, slot, art, time, duration, target_rpe, group_id) values
                             (%L, '2026-09-21', 1, 'athletik', '17:30', 30, 6, null), (%L, '2026-09-21', 2, 'tw', '16:30', 60, 7, %L), (%L, '2026-09-21', 3, 'reha', '17:00', 45, null, %L)$q$,
                          tst.get('team_a'), tst.get('team_a'), tst.get('grp_tw43'), tst.get('team_a'), tst.get('grp_hidden')),
                   3, 'T43 drei weitere Einheiten an einem Tag (Athletik, Torwarttraining, Reha)');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot) values (%L, '2026-09-21', 1)$q$, tst.get('team_a')), 'T43 je Tag und Nummer eine Einheit', 'duplicate key');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot) values (%L, '2026-09-21', 10)$q$, tst.get('team_a')), 'T43 Nummer 1–9', 'check constraint');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot, art) values (%L, '2026-09-21', 4, 'yoga')$q$, tst.get('team_a')), 'T43 unbekannte Art', 'check constraint');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot, time) values (%L, '2026-09-21', 4, '25:00')$q$, tst.get('team_a')), 'T43 ungültige Uhrzeit', 'check constraint');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot, duration) values (%L, '2026-09-21', 4, 300)$q$, tst.get('team_a')), 'T43 Dauer 5–240 Min.', 'check constraint');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot, group_id) values (%L, '2026-09-21', 4, %L)$q$, tst.get('team_a'), tst.get('grp_b')), 'T43 Gruppe eines anderen Teams', 'different_teams');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
select tst.affects($q$update public.day_units set duration = 35 where date = '2026-09-21' and slot = 1$q$, 1, 'T43 Co-Trainer mit „plan“ ändert eine Einheit');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), array['health', 'squad']);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.day_units where date = '2026-09-21')::text, '3', 'T43 Trainerteam sieht Einheiten auch ohne „plan“');
end $$;
select tst.affects($q$update public.day_units set duration = 40 where date = '2026-09-21'$q$, 0, 'T43 ohne „plan“ keine Änderung an Einheiten');
select tst.throws(format($q$update public.teams set settings = jsonb_set(settings, '{units}', '{}') where id = %L$q$, tst.get('team_a')), 'T43 wiederkehrende Einheiten nur mit „plan“', 'forbidden');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), null);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select string_agg(slot::text, ',' order by slot) from public.day_units where date = '2026-09-21'), '1,2',
                 'T43 Spieler sieht Einheiten für alle und für freigegebene eigene Gruppen (nicht für verborgene)');
end $$;
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, slot, rpe, minutes, dives) values (%L, '2026-09-21', 2, 7, 60, 28)$q$, tst.get('max')),
                   1, 'T43 RPE des Torwarttrainings mit Sprüngen');
do $$ begin
  perform tst.eq((select count(*) from public.attendance where player_id = tst.get('max')::uuid and date = '2026-09-21')::text, '0',
                 'T43 RPE einer weiteren Einheit setzt keine Anwesenheit');
end $$;
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, rpe, minutes) values (%L, '2026-09-21', 6, 90)$q$, tst.get('max')),
                   1, 'T43 RPE des Mannschaftstrainings am selben Tag');
do $$ begin
  perform tst.eq((select status from public.attendance where player_id = tst.get('max')::uuid and date = '2026-09-21'), 'da',
                 'T43 RPE des Mannschaftstrainings setzt Anwesenheit');
end $$;
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, slot, rpe, minutes) values (%L, '2026-09-21', 2, 5, 60)$q$, tst.get('max')), 'T43 je Einheit eine RPE', 'duplicate key');
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, slot, rpe, minutes, dives) values (%L, '2026-09-21', 1, 5, 30, 500)$q$, tst.get('max')), 'T43 Sprünge 0–300', 'check constraint');
select tst.throws(format($q$insert into public.rpe_entries (player_id, date, slot, rpe, minutes) values (%L, '2026-09-21', 10, 5, 30)$q$, tst.get('max')), 'T43 Einheit 0–9', 'check constraint');
select tst.affects($q$update public.day_units set duration = 10$q$, 0, 'T43 Spieler ändert keine Einheiten');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot) values (%L, '2026-09-23', 1)$q$, tst.get('team_a')), 'T43 Spieler legt keine Einheiten an', 'row-level security');
select tst.affects(format($q$insert into public.rpe_entries (player_id, date, slot, rpe, minutes) values (%L, '2026-09-22', 1, 5, 30)$q$, tst.get('max')),
                   1, 'T43 RPE einer weiteren Einheit an einem Tag ohne Mannschaftstraining');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select string_agg(slot::text, ',' order by slot) from public.day_units where date = '2026-09-21'), '1,2', 'T43 Mitspieler in der Torhüter-Gruppe sieht das Torwarttraining');
  perform tst.eq((select count(*) from public.rpe_entries where player_id = tst.get('max')::uuid)::text, '0', 'T43 Mitspieler sieht keine RPE anderer');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.sessions (team_id, date, type, duration, time) values (%L, '2026-09-22', 'Training', 90, '18:00')$q$, tst.get('team_a')), 1, 'T43 Einheit nachträglich gespeichert');
do $$ begin
  perform tst.eq((select count(*) from public.attendance where player_id = tst.get('max')::uuid and date = '2026-09-22')::text, '0',
                 'T43 nachträgliche Einheit: nur die RPE des Mannschaftstrainings setzt Anwesenheit');
  perform tst.eq((select dives::text from public.rpe_entries where player_id = tst.get('max')::uuid and date = '2026-09-21' and slot = 2), '28', 'T43 Trainerteam sieht die Sprünge');
end $$;
with ins as (insert into public.matches (team_id, date, opponent) values (tst.get('team_a')::uuid, '2026-09-20', 'T43 FC') returning id)
select tst.put('m43', id::text) from ins;
select tst.affects(format($q$insert into public.match_stats (match_id, player_id, minutes, conceded, saves) values (%L, %L, 90, 0, 5)$q$, tst.get('m43'), tst.get('max')), 1, 'T43 Torwart-Spieldaten (Gegentore, Paraden)');
select tst.throws(format($q$update public.match_stats set conceded = 31 where match_id = %L$q$, tst.get('m43')), 'T43 Gegentore 0–30', 'check constraint');
select tst.affects(format($q$insert into public.player_ratings (player_id, date, kind, mark, tags, slot, visible) values (%L, '2026-09-21', 'training', 'good', '{catching,diving}', 2, true), (%L, '2026-09-21', 'training', 'poor', '{focus}', 0, false)$q$, tst.get('max'), tst.get('p2_player')),
                   2, 'T43 Trainingseindruck: besonders gut (Torwarttraining) und besonders schwach');
select tst.throws(format($q$insert into public.player_ratings (player_id, date, kind, mark) values (%L, '2026-09-21', 'training', 'top')$q$, tst.get('max')), 'T43 nur gut/schwach', 'check constraint');
select tst.throws(format($q$insert into public.player_ratings (player_id, date, kind, mark) values (%L, '2026-09-20', 'spiel', 'good')$q$, tst.get('max')), 'T43 Eindruck nur für Training', 'check constraint');
select tst.throws(format($q$insert into public.player_ratings (player_id, date, kind, mark, tags) values (%L, '2026-09-21', 'training', 'good', '{a,b,c,d,e,f,g,h,i}')$q$, tst.get('max')), 'T43 höchstens 8 Gründe', 'check constraint');
select tst.affects(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'tw_lateral', '2026-09-21', 210), (%L, 'tw_kick', '2026-09-21', 52)$q$, tst.get('max'), tst.get('max')),
                   2, 'T43 Torwarttests (seitlicher Sprung, Abschlagweite)');
select tst.throws(format($q$insert into public.performance_tests (player_id, test, date, value) values (%L, 'tw_foo', '2026-09-21', 1)$q$, tst.get('max')), 'T43 unbekannter Test', 'check constraint');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.player_ratings where date = '2026-09-21')::text, '0', 'T43 nicht freigegebener Eindruck bleibt beim Trainerteam');
end $$;
commit;

do $$
begin
  delete from public.day_units where team_id = tst.get('team_a')::uuid;
  delete from public.rpe_entries where date in ('2026-09-21', '2026-09-22');
  delete from public.attendance where date in ('2026-09-21', '2026-09-22');
  delete from public.sessions where date in ('2026-09-21', '2026-09-22');
  delete from public.player_ratings where date = '2026-09-21';
  delete from public.matches where id = tst.get('m43')::uuid;
  delete from public.performance_tests where test in ('tw_lateral', 'tw_kick');
  delete from public.team_groups where id in (tst.get('grp_hidden')::uuid, tst.get('grp_tw43')::uuid);
  update public.teams set settings = settings - 'units' where id = tst.get('team_a')::uuid;
end
$$;

-- =====================================================================
-- T44 Spielerentwicklung, Ziele, Wochenchallenge, Individualtraining (Paket C)
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$insert into public.player_assessments (player_id, date, scores, note, visible) values (%L, '2026-09-01', '{"ballan": 4, "pass": 3, "zweik": 2}', 'Startpunkt', false)$q$, tst.get('max')),
                   1, 'T44 Trainerteam legt Kompetenzprofil an');
select tst.throws(format($q$insert into public.player_assessments (player_id, scores) values (%L, '{"pass": 6}')$q$, tst.get('max')), 'T44 Werte nur 1–5', 'check constraint');
select tst.throws(format($q$insert into public.player_assessments (player_id, scores) values (%L, '{"pass": 2.5}')$q$, tst.get('max')), 'T44 nur ganze Stufen', 'check constraint');
with ins as (insert into public.player_goals (player_id, title, area, kind, metric, unit, start_value, target_value, steps, visible)
             values (tst.get('max')::uuid, 'Schwacher Fuß: 500 Pässe', 'tech', 'process', 'count', 'Pässe', 0, 500, '[{"text": "Wandpässe links", "done": false}, {"text": "Video", "done": false}]', true) returning id)
select tst.put('goal44', id::text) from ins;
with ins as (insert into public.player_goals (player_id, title, metric, test, target_value, visible) values (tst.get('max')::uuid, 'Intern: 30 m', 'test', 'sprint30', 4.3, false) returning id)
select tst.put('goal44h', id::text) from ins;
select tst.throws(format($q$insert into public.player_goals (player_id, title, metric) values (%L, 'Test ohne Test', 'test')$q$, tst.get('max')), 'T44 Testziel braucht einen Test', 'check constraint');
select tst.throws(format($q$insert into public.player_goals (player_id, title, metric, date_from, due) values (%L, 'Rückwärts', 'count', '2026-10-01', '2026-09-01')$q$, tst.get('max')), 'T44 Frist nach dem Start', 'check constraint');
select tst.throws(format($q$insert into public.player_goals (player_id, title, steps) values (%L, 'Zu viele Schritte', (select jsonb_agg(jsonb_build_object('text', g, 'done', false)) from generate_series(1, 11) g))$q$, tst.get('max')),
                  'T44 höchstens 10 Schritte', 'check constraint');
with ins as (insert into public.dev_talks (player_id, date, kind, player_view, strengths, focus, agreements, visible)
             values (tst.get('max')::uuid, '2026-09-15', 'start', 'Will Stammspieler werden', 'Passspiel', 'Zweikampf', '[{"id": "a1", "text": "2× pro Woche Zusatzschicht", "who": "player", "due": null, "done": false}]', false) returning id)
select tst.put('talk44', id::text) from ins;
select tst.affects(format($q$insert into public.dev_talk_notes (talk_id, text) values (%L, 'Intern: Eltern sprechen')$q$, tst.get('talk44')), 1, 'T44 interne Notiz zum Gespräch');
with ins as (insert into public.team_challenges (team_id, week_start, title, kind, unit, target, team_target)
             values (tst.get('team_a')::uuid, date_trunc('week', current_date)::date, '100 Kontakte schwacher Fuß', 'count', 'x', 100, 1000) returning id)
select tst.put('ch44', id::text) from ins;
with ins as (insert into public.team_challenges (team_id, week_start, title, kind, unit) values (tst.get('team_a')::uuid, date_trunc('week', current_date)::date, 'Jonglieren', 'best', 'x') returning id)
select tst.put('ch44b', id::text) from ins;
with ins as (insert into public.team_challenges (team_id, week_start, title, kind) values (tst.get('team_a')::uuid, date_trunc('week', current_date)::date - 28, 'Alt', 'check') returning id)
select tst.put('ch44old', id::text) from ins;
select tst.throws(format($q$insert into public.team_challenges (team_id, week_start, title) values (%L, date_trunc('week', current_date)::date + 2, 'Mittwoch')$q$, tst.get('team_a')), 'T44 Woche beginnt am Montag', 'check constraint');
select tst.throws(format($q$insert into public.team_challenges (team_id, week_start, title, group_id) values (%L, date_trunc('week', current_date)::date, 'Fremde Gruppe', %L)$q$, tst.get('team_a'), tst.get('grp_b')),
                  'T44 Challenge nur für Gruppen des Teams', 'different_teams');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
begin
  perform tst.eq((select count(*) from public.player_assessments)::text, '0', 'T44 Spieler sieht nicht freigegebenes Profil nicht');
  perform tst.eq((select string_agg(title, ',') from public.player_goals), 'Schwacher Fuß: 500 Pässe', 'T44 Spieler sieht nur freigegebene Ziele');
  perform tst.eq((select count(*) from public.dev_talks)::text, '0', 'T44 nicht freigegebenes Gespräch bleibt beim Trainerteam');
  perform tst.eq((select count(*) from public.dev_talk_notes)::text, '0', 'T44 interne Notizen nie für Spieler');
end $$;
select tst.affects(format($q$insert into public.player_assessments (player_id, scores, by_player, visible) values (%L, '{"ballan": 5, "pass": 4, "zweik": 4}', false, false)$q$, tst.get('max')),
                   1, 'T44 Spieler legt Selbsteinschätzung an');
do $$ begin
  perform tst.eq((select by_player::text || '/' || visible::text from public.player_assessments), 'true/true', 'T44 Selbsteinschätzung ist immer als eigene markiert und sichtbar');
end $$;
select tst.affects(format($q$update public.player_goals set steps = jsonb_set(steps, '{0,done}', 'true') where id = %L$q$, tst.get('goal44')), 1, 'T44 Spieler hakt Schritt ab');
select tst.throws(format($q$update public.player_goals set title = 'Leicht' where id = %L$q$, tst.get('goal44')), 'T44 Spieler ändert Ziel des Trainerteams nicht', 'forbidden');
select tst.throws(format($q$update public.player_goals set steps = jsonb_set(steps, '{1,text}', '"Nichts"') where id = %L$q$, tst.get('goal44')), 'T44 Spieler ändert Schritte nicht um', 'forbidden');
select tst.throws(format($q$update public.player_goals set status = 'done' where id = %L$q$, tst.get('goal44')), 'T44 Status setzt das Trainerteam', 'forbidden');
select tst.affects(format($q$update public.player_goals set target_value = 1 where id = %L$q$, tst.get('goal44h')), 0, 'T44 verborgenes Ziel nicht änderbar');
with ins as (insert into public.player_goals (player_id, title, metric, target_value, visible, by_player, talk_id) values (tst.get('max')::uuid, 'Eigenes Ziel: 20 Min. Mobility', 'count', 20, false, false, tst.get('talk44')::uuid) returning id)
select tst.put('goal44p', id::text) from ins;
do $$ begin
  perform tst.eq((select by_player::text || '/' || visible::text || '/' || coalesce(talk_id::text, '-') from public.player_goals where id = tst.get('goal44p')::uuid), 'true/true/-',
                 'T44 eigenes Ziel: als Spielerziel sichtbar, ohne Gesprächsbezug');
end $$;
select tst.affects(format($q$update public.player_goals set title = 'Eigenes Ziel: 25 Min. Mobility', target_value = 25 where id = %L$q$, tst.get('goal44p')), 1, 'T44 Spieler ändert eigenes Ziel');
select tst.affects(format($q$insert into public.goal_entries (goal_id, value, note) values (%L, 120, 'Wand links')$q$, tst.get('goal44')), 1, 'T44 Spieler trägt Fortschritt ein');
select tst.throws(format($q$insert into public.goal_entries (goal_id, value) values (%L, 5)$q$, tst.get('goal44h')), 'T44 kein Eintrag für verborgene Ziele', 'not_found');
select tst.affects(format($q$insert into public.challenge_entries (challenge_id, player_id, value, done) values (%L, %L, 60, true)$q$, tst.get('ch44'), tst.get('max')), 1, 'T44 Spieler trägt Challenge ein');
select tst.affects(format($q$insert into public.challenge_entries (challenge_id, player_id, value) values (%L, %L, 37)$q$, tst.get('ch44b'), tst.get('max')), 1, 'T44 Bestleistung eingetragen');
select tst.throws(format($q$insert into public.challenge_entries (challenge_id, player_id, done) values (%L, %L, true)$q$, tst.get('ch44old'), tst.get('max')), 'T44 alte Challenge ist geschlossen', 'closed');
select tst.throws(format($q$insert into public.challenge_entries (challenge_id, player_id, days) values (%L, %L, array[current_date - 30])$q$, tst.get('ch44b'), tst.get('max')), 'T44 Tage nur innerhalb der Woche', 'invalid_day');
do $$
declare r record;
begin
  select * into r from public.challenge_totals(tst.get('team_a')::uuid, date_trunc('week', current_date)::date) where challenge_id = tst.get('ch44b')::uuid;
  perform tst.eq(r.players::text || '/' || r.total::text || '/' || r.top::text, '1/37.00/[]', 'T44 Teamsumme ohne Bestenliste (Standard)');
end $$;
with ins as (insert into public.indiv_requests (player_id, topic, note, wish, status, answer) values (tst.get('max')::uuid, 'schwach', 'Linker Fuß', 'Di oder Do vor dem Training', 'accepted', 'gefälscht') returning id)
select tst.put('iq44', id::text) from ins;
do $$ begin
  perform tst.eq((select status || '/' || answer from public.indiv_requests where id = tst.get('iq44')::uuid), 'open/', 'T44 neue Anfrage ist offen (Status setzt das Trainerteam)');
end $$;
with ins as (insert into public.indiv_requests (player_id, topic) values (tst.get('max')::uuid, 'kopf') returning id) select tst.put('iq44b', id::text) from ins;
select tst.throws(format($q$insert into public.indiv_requests (player_id, topic) values (%L, 'athletik')$q$, tst.get('max')), 'T44 höchstens zwei offene Anfragen', 'limit');
select tst.affects(format($q$update public.indiv_requests set status = 'cancelled' where id = %L$q$, tst.get('iq44b')), 1, 'T44 Spieler zieht Anfrage zurück');
select tst.throws(format($q$update public.indiv_requests set status = 'accepted' where id = %L$q$, tst.get('iq44')), 'T44 Spieler sagt nicht selbst zu', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.player_assessments)::text || '/' || (select count(*) from public.player_goals)::text || '/' || (select count(*) from public.goal_entries)::text
                 || '/' || (select count(*) from public.challenge_entries)::text || '/' || (select count(*) from public.indiv_requests)::text, '0/0/0/0/0',
                 'T44 Mitspieler sieht nichts von Max');
  perform tst.eq((select count(*) from public.team_challenges where week_start = date_trunc('week', current_date)::date)::text, '2', 'T44 Mitspieler sieht die Challenges des Teams');
end $$;
select tst.throws(format($q$insert into public.player_goals (player_id, title) values (%L, 'Fremdes Ziel')$q$, tst.get('max')), 'T44 kein Ziel für andere Spieler', 'row-level security');
select tst.throws(format($q$insert into public.challenge_entries (challenge_id, player_id, value) values (%L, %L, 999)$q$, tst.get('ch44'), tst.get('max')), 'T44 kein Challenge-Eintrag für andere', 'row-level security');
select tst.throws(format($q$insert into public.indiv_requests (player_id, topic) values (%L, 'tw')$q$, tst.get('max')), 'T44 keine Anfrage für andere', 'row-level security');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.eq((select count(*) from public.player_assessments where player_id = tst.get('max')::uuid)::text, '2', 'T44 Trainerteam sieht Fremd- und Selbstbild');
  perform tst.eq((select sum(value)::text from public.goal_entries where goal_id = tst.get('goal44')::uuid), '120.00', 'T44 Trainerteam sieht den Fortschritt');
  perform tst.eq((select (steps -> 0 ->> 'done') from public.player_goals where id = tst.get('goal44')::uuid), 'true', 'T44 abgehakter Schritt kommt beim Trainerteam an');
end $$;
select tst.affects(format($q$update public.indiv_requests set status = 'accepted', answer = 'Do 17:00', unit_date = '2026-10-22', unit_slot = 4 where id = %L$q$, tst.get('iq44')), 1, 'T44 Trainerteam sagt Individualtraining zu');
do $$ begin
  perform tst.eq((select (answered_by = tst.uid('coachA'))::text from public.indiv_requests where id = tst.get('iq44')::uuid), 'true', 'T44 Zusage mit Bearbeiter');
end $$;
select tst.affects(format($q$insert into public.day_units (team_id, date, slot, art, title, time, duration, target_rpe, player_ids) values (%L, '2026-10-22', 4, 'technik', 'Individualtraining', '17:00', 45, 4, array[%L]::uuid[])$q$,
                          tst.get('team_a'), tst.get('max')), 1, 'T44 Einheit nur für Max');
select tst.throws(format($q$insert into public.day_units (team_id, date, slot, player_ids) values (%L, '2026-10-22', 5, array[%L]::uuid[])$q$, tst.get('team_a'), tst.get('p1_player')),
                  'T44 Einheit nur mit Spielern des Teams', 'different_teams');
select tst.affects(format($q$update public.dev_talks set visible = true where id = %L$q$, tst.get('talk44')), 1, 'T44 Gespräch freigegeben');
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{challengeRank}', 'true') where id = %L$q$, tst.get('team_a')), 1, 'T44 Bestenliste eingeschaltet');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{indivReq}', 'true') where id = %L$q$, tst.get('team_a')), 1, 'T44 Co-Trainer (Planung) stellt Individualtraining ein');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
declare r record;
begin
  perform tst.eq((select count(*) from public.day_units where date = '2026-10-22')::text, '1', 'T44 Max sieht seine Einheit');
  perform tst.eq((select string_agg(kind || ':' || coalesce(player_view, ''), ',') from public.dev_talks), 'start:Will Stammspieler werden', 'T44 Max sieht das freigegebene Protokoll');
  perform tst.eq((select count(*) from public.dev_talk_notes)::text, '0', 'T44 interne Notiz bleibt intern (auch nach Freigabe)');
  select * into r from public.challenge_totals(tst.get('team_a')::uuid, date_trunc('week', current_date)::date) where challenge_id = tst.get('ch44b')::uuid;
  perform tst.eq(r.top -> 0 ->> 'name', 'Max M.', 'T44 Bestenliste mit Vorname und Initial');
  select * into r from public.challenge_totals(tst.get('team_a')::uuid, date_trunc('week', current_date)::date) where challenge_id = tst.get('ch44')::uuid;
  perform tst.eq(r.done::text || '/' || r.top::text, '1/[]', 'T44 Mengen-Challenge: nur Teamsumme, keine Bestenliste');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.day_units where date = '2026-10-22')::text, '0', 'T44 Mitspieler sieht fremdes Individualtraining nicht');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$ begin
  perform tst.eq((select count(*) from public.player_assessments)::text || '/' || (select count(*) from public.player_goals)::text || '/' || (select count(*) from public.dev_talks)::text
                 || '/' || (select count(*) from public.team_challenges)::text || '/' || (select count(*) from public.indiv_requests)::text, '0/0/0/0/0', 'T44 anderes Team sieht nichts');
end $$;
select tst.throws(format($q$select * from public.challenge_totals(%L, current_date)$q$, tst.get('team_a')), 'T44 Teamsumme nur für Mitglieder', 'forbidden');
commit;

-- Ohne Recht „Notizen“: keine Entwicklungsdaten
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), '{health,plan,squad}');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.player_assessments)::text || '/' || (select count(*) from public.player_goals)::text || '/' || (select count(*) from public.dev_talks)::text,
                 '0/0/0', 'T44 ohne Recht „Notizen“ keine Entwicklungsdaten');
  perform tst.eq((select count(*) from public.indiv_requests)::text, '2', 'T44 Anfragen mit Recht „Planung“');
end $$;
select tst.throws(format($q$insert into public.player_goals (player_id, title) values (%L, 'Ohne Recht')$q$, tst.get('max')), 'T44 ohne Recht kein Ziel', 'row-level security');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), null);
commit;

do $$
begin
  delete from public.player_assessments where team_id = tst.get('team_a')::uuid;
  delete from public.player_goals where team_id = tst.get('team_a')::uuid;
  delete from public.dev_talks where team_id = tst.get('team_a')::uuid;
  delete from public.team_challenges where team_id = tst.get('team_a')::uuid;
  delete from public.indiv_requests where team_id = tst.get('team_a')::uuid;
  delete from public.day_units where team_id = tst.get('team_a')::uuid;
  update public.teams set settings = settings - 'challengeRank' - 'indivReq' where id = tst.get('team_a')::uuid;
end
$$;

-- =====================================================================
-- T45 Chat: Teamchat, Einzelchats, Kinderschutz, Melden, Push-Empfänger
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select public.chat_ensure(tst.get('team_a')::uuid);
select tst.put('chat_team', public.chat_open(tst.get('team_a')::uuid, 'team')::text);
select tst.throws(format($q$select public.chat_open(%L, 'staff')$q$, tst.get('team_a')), 'T45 Spieler öffnet den Trainerteam-Chat nicht', 'forbidden');
select tst.throws(format($q$select public.chat_open(%L, 'direct', null, %L)$q$, tst.get('team_a'), tst.uid('p2')), 'T45 Jugend: kein Einzelchat zwischen Spielern', 'dm_off');
select tst.throws(format($q$select public.chat_save_custom(%L, null, 'Nur Spieler', array[%L]::uuid[])$q$, tst.get('team_a'), tst.uid('p2')), 'T45 Jugend: Spieler legen keine eigenen Gruppen an', 'dm_off');
select tst.put('chat_dm', public.chat_open(tst.get('team_a')::uuid, 'direct', null, tst.uid('coachA'))::text);
with ins as (insert into public.chat_messages (chat_id, body, user_id, sender_name) values (tst.get('chat_team')::uuid, 'Wer kommt Samstag mit dem Rad?', tst.uid('p2'), 'Gefälscht') returning id)
select tst.put('msg_team', id::text) from ins;
with ins as (insert into public.chat_messages (chat_id, body) values (tst.get('chat_dm')::uuid, 'Trainer, ich habe eine Frage zum Probetraining.') returning id)
select tst.put('msg_dm', id::text) from ins;
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, '   ')$q$, tst.get('chat_team')), 'T45 leere Nachricht abgelehnt', 'check constraint');
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, repeat('x', 4001))$q$, tst.get('chat_team')), 'T45 höchstens 4000 Zeichen', 'check constraint');
do $$
begin
  perform tst.eq((select (user_id = tst.uid('p1'))::text || '/' || sender_name from public.chat_messages where id = tst.get('msg_team')::uuid), 'true/Max M.',
                 'T45 Absender und Name setzt der Server (Vorname + Initial)');
  perform tst.eq((select transparent::text from public.chats where id = tst.get('chat_dm')::uuid), 'true', 'T45 Jugend: Einzelchat Trainer–Spieler ist transparent');
  perform tst.eq((select count(*) from public.chat_members where chat_id = tst.get('chat_dm')::uuid)::text, '2', 'T45 Einzelchat mit zwei Mitgliedern');
  perform tst.ok((select read_at from public.chat_state where chat_id = tst.get('chat_team')::uuid) is not null, 'T45 eigene Nachricht gilt als gelesen');
  perform tst.ok(exists (select 1 from public.chat_directory(tst.get('team_a')::uuid) d where d.user_id = tst.uid('coachA') and d.kind = 'staff'), 'T45 Verzeichnis zeigt das Trainerteam');
  perform tst.eq((select string_agg(coalesce(d.player_id::text, '-'), ',') from public.chat_directory(tst.get('team_a')::uuid) d where d.kind = 'player' and d.user_id <> tst.uid('p1')), '-,-,-',
                 'T45 Verzeichnis: keine Spieler-IDs anderer');
  perform tst.eq((select string_agg(d.name, ',' order by d.name) from public.chat_directory(tst.get('team_a')::uuid) d where d.kind = 'player'), 'Erik B.,Lena J.,Max M.,Paul N.',
                 'T45 Verzeichnis: aktive Spieler mit Konto als „Vorname N.“');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.chat_messages)::text, '1', 'T45 Mitspieler sieht den Teamchat, nicht den Einzelchat');
  perform tst.eq((select count(*) from public.chats where kind = 'direct')::text, '0', 'T45 fremder Einzelchat unsichtbar');
end $$;
select tst.affects(format($q$insert into public.chat_reactions (message_id, emoji) values (%L, '👍')$q$, tst.get('msg_team')), 1, 'T45 Reaktion');
select tst.throws(format($q$insert into public.chat_reactions (message_id, emoji) values (%L, '🍺')$q$, tst.get('msg_team')), 'T45 nur vorgegebene Reaktionen', 'check constraint');
select tst.throws(format($q$insert into public.chat_reactions (message_id, emoji) values (%L, '👍')$q$, tst.get('msg_dm')), 'T45 keine Reaktion in fremden Chats', 'not_found');
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'rein')$q$, tst.get('chat_dm')), 'T45 kein Schreiben in fremde Einzelchats', 'row-level security');
select tst.affects(format($q$update public.chat_messages set deleted_at = now() where id = %L$q$, tst.get('msg_team')), 0, 'T45 Spieler löscht keine fremden Nachrichten');
select tst.affects(format($q$insert into public.chat_reports (message_id, reason, note, snapshot) values (%L, 'mean', 'unfreundlich', 'gefälscht')$q$, tst.get('msg_team')), 1, 'T45 Nachricht melden');
select tst.throws(format($q$insert into public.chat_reports (message_id, reason) values (%L, 'other')$q$, tst.get('msg_dm')), 'T45 nur lesbare Nachrichten melden', 'not_found');
select tst.affects(format($q$insert into public.chat_state (chat_id, muted) values (%L, true)$q$, tst.get('chat_team')), 1, 'T45 Teamchat stumm schalten');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select body from public.chat_messages where chat_id = tst.get('chat_dm')::uuid), 'Trainer, ich habe eine Frage zum Probetraining.',
                 'T45 Kinderschutz: Trainerteam (Recht „messages“) liest den Einzelchat mit');
  perform tst.eq((select snapshot || '/' || sender_name from public.chat_reports), 'Wer kommt Samstag mit dem Rad?/Max M.', 'T45 Meldung mit Kopie des Textes beim Trainerteam');
end $$;
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'Ich mische mich ein')$q$, tst.get('chat_dm')), 'T45 Mitlesen heißt nicht mitschreiben', 'row-level security');
select tst.throws(format($q$select public.chat_save_custom(%L, null, 'Fremde', array[%L]::uuid[])$q$, tst.get('team_a'), tst.uid('coachB')), 'T45 nur Personen des Teams', 'different_teams');
select tst.put('chat_custom', public.chat_save_custom(tst.get('team_a')::uuid, null, 'Fahrgemeinschaft', array[tst.uid('p1'), tst.uid('p2')])::text);
do $$ begin
  perform tst.eq((select kind || '/' || title || '/' || transparent::text from public.chats where id = tst.get('chat_custom')::uuid), 'custom/Fahrgemeinschaft/true', 'T45 Gruppe des Trainerteams (gemischt: transparent)');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.affects(format($q$update public.chat_messages set deleted_at = now() where id = %L$q$, tst.get('msg_team')), 1, 'T45 eigene Nachricht löschen');
select tst.throws(format($q$update public.chat_messages set body = 'anders' where id = %L$q$, tst.get('msg_dm')), 'T45 Nachrichten nicht nachträglich ändern', 'forbidden');
do $$ begin
  perform tst.eq((select body || '/' || (deleted_by = tst.uid('p1'))::text from public.chat_messages where id = tst.get('msg_team')::uuid), '/true', 'T45 gelöscht: Text leer, Löschende(r) vermerkt');
  perform tst.eq((select count(*) from public.chat_reactions)::text, '1', 'T45 Reaktionen sichtbar für Teilnehmer');
  perform tst.ok(exists (select 1 from public.chats where id = tst.get('chat_custom')::uuid), 'T45 Spieler sieht die Gruppe, in der er Mitglied ist');
end $$;
select tst.throws(format($q$select public.chat_save_custom(%L, %L, 'Umbenannt', array[%L]::uuid[])$q$, tst.get('team_a'), tst.get('chat_custom'), tst.uid('p1')), 'T45 Spieler ändert fremde Gruppe nicht', 'dm_off');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.eq((select snapshot from public.chat_reports), 'Wer kommt Samstag mit dem Rad?', 'T45 Kopie bleibt nach dem Löschen erhalten');
end $$;
select tst.affects($q$update public.chat_reports set status = 'done'$q$, 1, 'T45 Meldung erledigt');
select tst.throws($q$update public.chat_reports set snapshot = 'weg'$q$, 'T45 Kopie nicht änderbar', 'forbidden');
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{chat}', '{"teamReadOnly": true}') where id = %L$q$, tst.get('team_a')), 1, 'T45 Teamchat nur für Ankündigungen');
select tst.affects(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'Abfahrt 13:15 am Vereinsheim')$q$, tst.get('chat_team')), 1, 'T45 Trainerteam schreibt Ankündigung');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'Ok')$q$, tst.get('chat_team')), 'T45 Ankündigungs-Chat: Spieler schreiben nicht', 'row-level security');
select tst.affects(format($q$insert into public.chat_reactions (message_id, emoji) select id, '✅' from public.chat_messages where body like 'Abfahrt%%'$q$), 1, 'T45 Ankündigung mit ✅ bestätigen');
commit;

-- Senioren-Einstellung: Einzelchats für alle, nicht transparent
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{chat}', '{"dm": "all", "transparent": false}') where id = %L$q$, tst.get('team_a')), 1, 'T45 Einzelchats für alle');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.put('chat_pp', public.chat_open(tst.get('team_a')::uuid, 'direct', null, tst.uid('p2'))::text);
do $$ begin
  perform tst.eq(public.chat_open(tst.get('team_a')::uuid, 'direct', null, tst.uid('p2'))::text, tst.get('chat_pp'), 'T45 derselbe Einzelchat beim zweiten Öffnen');
  perform tst.eq((select transparent::text from public.chats where id = tst.get('chat_pp')::uuid), 'false', 'T45 Einzelchat ohne Mitlesen');
end $$;
select tst.affects(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'Kommst du heute?')$q$, tst.get('chat_pp')), 1, 'T45 Spieler schreiben sich');
select tst.put('chat_p_custom', public.chat_save_custom(tst.get('team_a')::uuid, null, 'Kabine', array[tst.uid('p2')])::text);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.chat_messages where chat_id = tst.get('chat_pp')::uuid)::text, '0', 'T45 privater Einzelchat bleibt privat');
end $$;
commit;

-- Push-Empfänger (nur Server)
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$select * from public.chat_push_targets(%L)$q$, tst.get('msg_dm')), 'T45 Push-Empfänger nur für den Server', 'permission denied');
commit;
begin;
set local role service_role;
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[t45-coachA]', tst.uid('coachA'), 'ios'), ('ExponentPushToken[t45-p2]', tst.uid('p2'), 'android'),
  ('ExponentPushToken[t45-p1]', tst.uid('p1'), 'ios') on conflict do nothing;
do $$
declare v_msg uuid;
begin
  perform tst.eq((select string_agg(token || ':' || area || ':' || coalesce(title, '-'), ',' order by token) from public.chat_push_targets(tst.get('msg_dm')::uuid)),
                 'ExponentPushToken[t45-coachA]:coach:Max M.', 'T45 Push nur an die andere Person (Mitlesende ohne Push)');
  perform tst.eq((select count(*) from public.chat_push_targets(tst.get('msg_dm')::uuid))::text, '0', 'T45 höchstens eine Push-Nachricht je Minute und Chat');
  select id into v_msg from public.chat_messages where body like 'Abfahrt%';
  perform tst.eq((select string_agg(token, ',' order by token) from public.chat_push_targets(v_msg)), 'ExponentPushToken[t45-p1]', 'T45 Teamchat: stumm geschaltete und Absender ohne Push');
  perform tst.eq((select count(*) from public.chat_push_targets(tst.get('msg_team')::uuid))::text, '0', 'T45 gelöschte Nachricht ohne Push');
end $$;
commit;

-- Chat ausgeschaltet: Spieler sehen nichts mehr, Trainerteam behält den Verlauf
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.teams set settings = jsonb_set(settings, '{chat}', '{"on": false}') where id = %L$q$, tst.get('team_a')), 1, 'T45 Chat ausgeschaltet');
do $$ begin
  perform tst.ok((select count(*) from public.chat_messages where chat_id = tst.get('chat_team')::uuid) > 0, 'T45 Trainerteam sieht den Verlauf weiter');
end $$;
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'Hallo?')$q$, tst.get('chat_team')), 'T45 ausgeschaltet: niemand schreibt', 'row-level security');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.chat_messages)::text || '/' || (select count(*) from public.chats)::text, '0/0', 'T45 ausgeschaltet: Spieler sehen keine Chats');
  perform tst.ok((public.my_data_export() -> 'chat_messages') @> '[{"text": "Kommst du heute?"}]', 'T45 Datenexport enthält eigene Nachrichten');
end $$;
select tst.throws(format($q$select public.chat_open(%L, 'team')$q$, tst.get('team_a')), 'T45 ausgeschaltet: kein Chat öffnen', 'chat_off');
commit;

-- Spam-Schutz: höchstens 30 Nachrichten pro Minute
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
update public.teams set settings = settings - 'chat' where id = tst.get('team_a')::uuid;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
declare i int;
begin
  for i in 1..30 loop insert into public.chat_messages (chat_id, body) values (tst.get('chat_team')::uuid, 'Nachricht ' || i); end loop;
end $$;
select tst.throws(format($q$insert into public.chat_messages (chat_id, body) values (%L, 'eine zu viel')$q$, tst.get('chat_team')), 'T45 Spam-Schutz', 'limit');
commit;

do $$
begin
  delete from public.chats where team_id = tst.get('team_a')::uuid;
  delete from public.push_tokens where token like 'ExponentPushToken[t45-%';
  update public.teams set settings = settings - 'chat' where id = tst.get('team_a')::uuid;
end
$$;

-- =====================================================================
-- T46 Matchplan: nur Trainerteam, Freigabe mit Zeitraum, nur Kader, Aufgaben nur eigene, Zugriffsprotokoll
-- =====================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
with ins as (insert into public.players (team_id, first_name) values (tst.get('team_b')::uuid, 'T46 Fremd') returning id)
select tst.put('p46b', id::text) from ins;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
with ins as (insert into public.matches (team_id, date, time, opponent) values (tst.get('team_a')::uuid, current_date + 2, '15:00', 'T46 SV') returning id)
select tst.put('m46', id::text) from ins;
with ins as (insert into public.match_plans (team_id, match_id, title, content)
             values (tst.get('team_a')::uuid, tst.get('m46')::uuid, 'gegen T46 SV',
                     jsonb_build_object('fmt', 11, 'formation', '4-4-2', 'tasks', jsonb_build_object(tst.get('max'), 'Kette halten', tst.get('p2_player'), 'Tiefe Läufe')))
             returning id)
select tst.put('mp46', id::text) from ins;
select tst.throws(format($q$insert into public.match_plans (team_id, match_id) values (%L, %L)$q$, tst.get('team_a'), tst.get('m46')), 'T46 ein Plan je Spiel', 'duplicate key');
select tst.throws(format($q$insert into public.match_plans (team_id, title) values (%L, repeat('x', 81))$q$, tst.get('team_a')), 'T46 Titel höchstens 80 Zeichen', 'check constraint');
select tst.throws(format($q$insert into public.match_plans (team_id, content) values (%L, '[]')$q$, tst.get('team_a')), 'T46 Inhalt ist ein Objekt', 'check constraint');
select tst.throws(format($q$update public.match_plans set published = '{"sections": []}' where id = %L$q$, tst.get('mp46')), 'T46 Freigabe nur mit Ende', 'check constraint');
select tst.throws(format($q$update public.match_plans set squad = array[%L]::uuid[] where id = %L$q$, tst.get('p46b'), tst.get('mp46')), 'T46 Kader nur aus dem eigenen Team', 'different_teams');
select tst.affects(format($q$update public.match_plans
   set published = jsonb_build_object('sections', '["tasks"]'::jsonb, 'tasks', content -> 'tasks'), share_sections = '{tasks}',
       share_until = now() + interval '1 day', share_squad = true, squad = array[%L]::uuid[], published_at = '2000-01-01', published_by = null
 where id = %L$q$, tst.get('max'), tst.get('mp46')), 1, 'T46 Freigabe (nur Kader: Max)');
do $$ begin
  perform tst.ok((select published_at > now() - interval '1 minute' and published_by = tst.uid('coachA') from public.match_plans where id = tst.get('mp46')::uuid),
                 'T46 Zeitpunkt und Person der Freigabe setzt der Server');
end $$;
select tst.throws(format($q$update public.match_plans set share_sections = '{intern}' where id = %L$q$, tst.get('mp46')), 'T46 nur bekannte Bereiche', 'check constraint');
select tst.affects(format($q$update public.match_plans set title = 'gegen T46 SV (neu)', published_at = '2000-01-01' where id = %L$q$, tst.get('mp46')), 1, 'T46 Titel ändern');
do $$ begin
  perform tst.ok((select published_at > now() - interval '1 minute' from public.match_plans where id = tst.get('mp46')::uuid), 'T46 Freigabezeitpunkt nicht direkt änderbar');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
do $$ begin
  perform tst.eq((select count(*) from public.match_plans)::text, '0', 'T46 fremdes Trainerteam sieht keine Matchpläne');
end $$;
select tst.affects($q$update public.match_plans set title = 'x'$q$, 0, 'T46 fremdes Trainerteam ändert nichts');
select tst.throws(format($q$select public.match_plan_open(%L)$q$, tst.get('mp46')), 'T46 fremdes Trainerteam öffnet nichts', 'not_found');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$
declare x jsonb;
begin
  perform tst.eq((select count(*) from public.match_plans)::text, '0', 'T46 Spieler lesen Matchpläne nie direkt');
  perform tst.eq((select count(*)::text || '/' || bool_or(seen)::text from public.my_match_plans(tst.get('team_a')::uuid)), '1/false', 'T46 Max sieht den freigegebenen Plan (noch ungelesen)');
  x := public.match_plan_open(tst.get('mp46')::uuid, 'ios');
  perform tst.eq(x -> 'content' -> 'tasks' ->> tst.get('max'), 'Kette halten', 'T46 eigene Aufgabe');
  perform tst.ok(not (x -> 'content' -> 'tasks' ? tst.get('p2_player')), 'T46 Aufgaben anderer bleiben verborgen');
  perform tst.eq(x ->> 'name' || '/' || (x ->> 'pid'), 'Max Muster/' || tst.get('max'), 'T46 Name für das Wasserzeichen');
  perform tst.eq(x ->> 'title', 'gegen T46 SV (neu)', 'T46 Titel');
  x := public.match_plan_open(tst.get('mp46')::uuid, 'ios');
  perform public.match_plan_event(tst.get('mp46')::uuid, 'shot', 'android');
  perform tst.eq((select bool_or(seen)::text from public.my_match_plans(tst.get('team_a')::uuid)), 'true', 'T46 als gesehen markiert');
end $$;
select tst.throws(format($q$select public.match_plan_event(%L, 'open')$q$, tst.get('mp46')), 'T46 nur Screenshot-Meldungen', 'invalid_kind');
select tst.throws(format($q$insert into public.match_plan_views (team_id, plan_id, player_id) values (%L, %L, %L)$q$, tst.get('team_a'), tst.get('mp46'), tst.get('max')),
                  'T46 Protokoll nicht direkt schreibbar', 'row-level security');
select tst.affects($q$delete from public.match_plan_views$q$, 0, 'T46 Protokoll nicht löschbar');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from public.my_match_plans(tst.get('team_a')::uuid))::text, '0', 'T46 nur Kader: Paul (nicht im Kader) sieht nichts');
end $$;
select tst.throws(format($q$select public.match_plan_open(%L)$q$, tst.get('mp46')), 'T46 nur Kader: Öffnen abgelehnt', 'not_found');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select string_agg(kind || ':' || coalesce(platform, '-'), ',' order by id) from public.match_plan_views where plan_id = tst.get('mp46')::uuid),
                 'open:ios,shot:android', 'T46 Trainerteam sieht das Zugriffsprotokoll (ein Aufruf je 10 Minuten, Screenshot)');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.match_plans set share_squad = false where id = %L$q$, tst.get('mp46')), 1, 'T46 Freigabe für alle');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$
declare x jsonb := public.match_plan_open(tst.get('mp46')::uuid);
begin
  perform tst.eq((select string_agg(k, ',') from jsonb_object_keys(x -> 'content' -> 'tasks') k), tst.get('p2_player'), 'T46 Paul sieht nur seine Aufgabe');
  perform tst.ok(x -> 'content' -> 'tasks' ->> tst.get('p2_player') = 'Tiefe Läufe', 'T46 Pauls Aufgabe');
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.match_plans set share_own_tasks = false where id = %L$q$, tst.get('mp46')), 1, 'T46 Aufgaben für alle sichtbar');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p2';
do $$ begin
  perform tst.eq((select count(*) from jsonb_object_keys(public.match_plan_open(tst.get('mp46')::uuid) -> 'content' -> 'tasks'))::text, '2', 'T46 alle Aufgaben sichtbar');
end $$;
commit;

-- Zeitraum, Modul aus, Freigabe beenden
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.match_plans set share_from = now() + interval '1 hour' where id = %L$q$, tst.get('mp46')), 1, 'T46 Freigabe erst später');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$select public.match_plan_open(%L)$q$, tst.get('mp46')), 'T46 vor Beginn der Freigabe nicht sichtbar', 'not_found');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.affects(format($q$update public.match_plans set share_from = null, share_until = now() - interval '1 minute' where id = %L$q$, tst.get('mp46')), 1, 'T46 Freigabe abgelaufen');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$select public.match_plan_open(%L)$q$, tst.get('mp46')), 'T46 nach Spielende nicht mehr sichtbar', 'not_found');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
update public.match_plans set share_until = now() + interval '1 day' where id = tst.get('mp46')::uuid;
update public.teams set modules = modules || '{"matchplan": false}' where id = tst.get('team_a')::uuid;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
select tst.throws(format($q$select public.match_plan_open(%L)$q$, tst.get('mp46')), 'T46 Modul aus: nicht sichtbar', 'not_found');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
update public.teams set modules = modules || '{"matchplan": true}' where id = tst.get('team_a')::uuid;
select tst.affects(format($q$update public.match_plans set published = null where id = %L$q$, tst.get('mp46')), 1, 'T46 Freigabe beenden');
do $$ begin
  perform tst.eq((select coalesce(share_until::text, '-') || '/' || cardinality(share_sections)::text || '/' || coalesce(published_at::text, '-') from public.match_plans where id = tst.get('mp46')::uuid),
                 '-/0/-', 'T46 beendete Freigabe räumt Zeitraum und Bereiche auf');
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq((select count(*) from public.my_match_plans(tst.get('team_a')::uuid))::text, '0', 'T46 nach Beenden nichts mehr freigegeben');
  perform tst.ok((public.my_data_export() -> 'match_plan_views') @> '[{"kind": "open", "platform": "ios"}]', 'T46 Datenexport enthält eigene Aufrufe');
end $$;
commit;

-- =====================================================================
-- T47 Verein: anlegen, Teams verbinden, Funktionäre mit Rechten (gespiegelt ins Trainerteam), Übersicht,
-- Spieler hochziehen/wechseln (mit Belastung), Ankündigung, lösen, auflösen
-- =====================================================================
\set p5 'e5000000-0000-4000-8000-0000000000e5'
insert into tst.users (name, id) values ('p5', :'p5');
insert into auth.users (id, email, raw_user_meta_data) values (:'p5', 'p5@test.local', '{"display_name": "Ole"}');

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p5';
select tst.put('p5_player', public.join_team(tst.get('join_a'), 'Ole', 'Wechsel', '2008-05-05', 'ST', 9, 70)::text);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.throws(format($q$select public.club_create('SG Test', %L)$q$, tst.get('team_b')), 'T47 Verein nur mit eigenem Team anlegen', 'forbidden');
select tst.put('club', public.club_create('  SG Test  ', tst.get('team_a')::uuid)::text);
select tst.throws(format($q$select public.club_create('Noch einer', %L)$q$, tst.get('team_a')), 'T47 Team nur in einem Verein', 'already_in_club');
do $$ begin
  perform tst.eq((select name || '/' || role from public.my_clubs()), 'SG Test/admin', 'T47 Ersteller ist Vereinsadmin');
  perform tst.ok((select link_code is not null and staff_code is not null from public.my_clubs()), 'T47 Admin sieht die Codes');
  perform tst.eq((select club_id::text from public.teams where id = tst.get('team_a')::uuid), tst.get('club'), 'T47 eigenes Team verbunden');
end $$;
select tst.put('club_link', (select link_code from public.my_clubs()));
select tst.put('club_staff', (select staff_code from public.my_clubs()));
select tst.throws(format($q$update public.teams set club_id = null where id = %L$q$, tst.get('team_a')), 'T47 Verein nicht direkt änderbar', 'forbidden');
select tst.throws(format($q$update public.clubs set link_code = 'AAAA-BBBB' where id = %L$q$, tst.get('club')), 'T47 Codes nicht direkt änderbar', 'forbidden');
select tst.affects(format($q$update public.clubs set name = 'SG Test 1919', accent = '#aa0000' where id = %L$q$, tst.get('club')), 1, 'T47 Admin ändert Name und Farbe');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.throws(format($q$select public.club_link_team('XXXX-YYYY', %L)$q$, tst.get('team_b')), 'T47 falscher Code', 'invalid_code');
select tst.throws(format($q$select public.club_link_team(%L, %L)$q$, tst.get('club_link'), tst.get('team_a')), 'T47 nur eigenes Team verbinden', 'forbidden');
select tst.eq(public.club_link_team(lower(tst.get('club_link')), tst.get('team_b')::uuid)::text, tst.get('club'), 'T47 Team B mit dem Verein verbunden');
do $$ begin
  perform tst.eq((select role || '/' || coalesce(link_code, '-') from public.my_clubs()), 'team/-', 'T47 Owner eines verbundenen Teams sieht den Verein ohne Codes');
  perform tst.eq((select count(*) from public.club_teams(tst.get('club')::uuid))::text, '2', 'T47 Teams des Vereins');
  perform tst.eq((select count(*) from public.team_staff where team_id = tst.get('team_b')::uuid and club_id is not null)::text, '1', 'T47 Vereinsadmin erhält Zugriff auf Team B');
end $$;
select tst.throws($q$select * from public.club_overview((select club_id from public.teams limit 1))$q$, 'T47 Übersicht nur für Funktionäre', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
select tst.eq(public.club_join(tst.get('club_staff'))::text, tst.get('club'), 'T47 Funktionärs-Anfrage');
select tst.throws(format($q$select * from public.club_overview(%L)$q$, tst.get('club')), 'T47 Anfrage sieht keine Übersicht', 'forbidden');
do $$ begin
  perform tst.eq((select count(*) from public.club_staff)::text, '1', 'T47 Anfrage sieht nur die eigene Zeile');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.throws(format($q$select public.club_set_staff(%L, %L, 'chef', '', null, null)$q$, tst.get('club'), tst.uid('coachC')), 'T47 nur bekannte Funktionen', 'invalid_role');
select tst.throws(format($q$select public.club_set_staff(%L, %L, 'leiter', '', null, array[gen_random_uuid()])$q$, tst.get('club'), tst.uid('coachC')), 'T47 nur Teams des Vereins', 'different_teams');
select public.club_set_staff(tst.get('club')::uuid, tst.uid('coachC'), 'leiter', 'Sportlicher Leiter', null, null);
select tst.throws(format($q$select public.club_set_staff(%L, %L, 'leiter', '', null, null)$q$, tst.get('club'), tst.uid('coachA')), 'T47 letzter Admin bleibt Admin', 'last_admin');
select tst.throws(format($q$select public.club_remove_staff(%L, %L)$q$, tst.get('club'), tst.uid('coachA')), 'T47 letzter Admin bleibt', 'last_admin');
do $$ begin
  perform tst.eq((select array_to_string(perms, ',') from public.team_staff where team_id = tst.get('team_b')::uuid and user_id = tst.uid('coachC') and club_id is not null),
                 'notes,perf,plan,scout,squad,tasks', 'T47 Funktionär erhält Standardrechte im Team B (ohne Gesundheitsdaten)');
  perform tst.eq((select (club_id is null)::text from public.team_staff where team_id = tst.get('team_a')::uuid and user_id = tst.uid('coachC')), 'true',
                 'T47 bestehende Mitgliedschaft (Trainer in Team A) hat Vorrang');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
with ins as (insert into public.rpe_entries (player_id, date, slot, rpe, minutes) values (tst.get('p46b')::uuid, current_date - 1, 0, 6, 80) returning 1) select count(*) from ins;
select tst.throws(format($q$delete from public.team_staff where team_id = %L and user_id = %L$q$, tst.get('team_b'), tst.uid('coachC')), 'T47 Team-Owner entfernt keine Vereinszugriffe', 'managed_by_club');
select tst.throws(format($q$select public.set_staff_perms(%L, %L, array['health'])$q$, tst.get('team_b'), tst.uid('coachC')), 'T47 Team-Owner ändert keine Vereinsrechte', 'managed_by_club');
select tst.throws(format($q$insert into public.team_staff (team_id, user_id, role, club_id) values (%L, %L, 'coach', %L)$q$, tst.get('team_b'), tst.uid('p1'), tst.get('club')), 'T47 keine Vereinszeilen von Hand', 'managed_by_club');
do $$ begin
  perform tst.eq((select string_agg(coalesce(display_name, '?') || ':' || via_club::text, ',' order by via_club, display_name) from public.team_staff_rights(tst.get('team_b')::uuid)),
                 'Coach B:false,Coach A:true,?:true', 'T47 Trainerteam zeigt Zugriffe über den Verein');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.players where team_id = tst.get('team_b')::uuid)::text, '1', 'T47 Funktionär sieht den Kader von Team B');
  perform tst.eq((select count(*) from public.rpe_entries where player_id = tst.get('p46b')::uuid)::text, '0', 'T47 ohne Recht „health“ keine Belastungsdaten');
  perform tst.eq((select count(*) from public.club_overview(tst.get('club')::uuid))::text, '2', 'T47 Übersicht über beide Teams');
  perform tst.eq((select players::text || '/' || coalesce(injured, -1)::text from public.club_overview(tst.get('club')::uuid) where team_id = tst.get('team_b')::uuid), '1/0', 'T47 Kennzahlen Team B');
  perform tst.eq((select count(*) from public.club_staff)::text, '2', 'T47 Funktionäre sehen sich gegenseitig');
end $$;
commit;

-- Spieler hochziehen und wechseln
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
insert into public.rpe_entries (player_id, date, slot, rpe, minutes) values (tst.get('p5_player')::uuid, current_date - 2, 0, 6, 90), (tst.get('p5_player')::uuid, current_date - 2, 1, 5, 30);
insert into public.wellness_entries (player_id, date, sleep_hours, sleep_quality, fatigue, soreness, stress) values (tst.get('p5_player')::uuid, current_date - 1, 8, 5, 5, 5, 5);
insert into public.absences (team_id, player_id, type, from_date) values (tst.get('team_a')::uuid, tst.get('p5_player')::uuid, 'verletzung', current_date - 1);
select tst.throws(format($q$select public.club_move_player(%L, %L, 'swap')$q$, tst.get('tom'), tst.get('team_b')), 'T47 nur hochziehen oder wechseln', 'invalid_mode');
select tst.throws(format($q$select public.club_move_player(%L, %L, 'add')$q$, tst.get('tom'), tst.get('team_a')), 'T47 Zielteam ≠ eigenes Team', 'invalid_target');
select tst.put('tom_b', public.club_move_player(tst.get('tom')::uuid, tst.get('team_b')::uuid, 'add')::text);
select tst.throws(format($q$select public.club_move_player(%L, %L, 'add')$q$, tst.get('tom'), tst.get('team_b')), 'T47 schon im Zielteam', 'already_in_team');
select tst.throws(format($q$select public.club_move_player(%L, %L, 'move', true)$q$, tst.get('p5_player'), tst.get('team_b')), 'T47 Belastung mitnehmen nur mit Recht „health“ in beiden Teams', 'forbidden');
select public.club_set_staff(tst.get('club')::uuid, tst.uid('coachA'), 'admin', 'Vorsitz', array['plan', 'squad', 'health'], null);
select tst.put('p5_b', public.club_move_player(tst.get('p5_player')::uuid, tst.get('team_b')::uuid, 'move', true)::text);
do $$ begin
  perform tst.eq((select team_id::text || '/' || active::text || '/' || coalesce(origin, '-') || '/' || (linked_from::text = tst.get('tom'))::text from public.players where id = tst.get('tom_b')::uuid),
                 tst.get('team_b') || '/true/U19 Junioren/true', 'T47 hochgezogen: Zeile im Zielteam mit Herkunft');
  perform tst.eq((select active::text from public.players where id = tst.get('tom')::uuid), 'true', 'T47 hochgezogen: bleibt im eigenen Team');
  perform tst.eq((select active::text || '/' || coalesce(user_id::text, '-') from public.players where id = tst.get('p5_player')::uuid), 'false/-', 'T47 gewechselt: alte Zeile inaktiv ohne Konto');
  perform tst.eq((select user_id::text || '/' || shirt_number::text from public.players where id = tst.get('p5_b')::uuid), tst.uid('p5')::text || '/9', 'T47 gewechselt: Konto und Rückennummer im Zielteam');
  perform tst.eq((select type || '/' || minutes::text || '/' || rpe::text || '/' || label from public.extra_activities where player_id = tst.get('p5_b')::uuid), 'verein/120/5.8/Training U19 Junioren',
                 'T47 Belastung als Vereinstraining (eine Zeile je Tag, gewichtete RPE)');
  perform tst.eq((select count(*) from public.wellness_entries where player_id = tst.get('p5_b')::uuid)::text, '1', 'T47 Morgen-Checks übernommen');
  perform tst.eq((select type || '/' || team_id::text from public.absences where player_id = tst.get('p5_b')::uuid), 'verletzung/' || tst.get('team_b'), 'T47 laufende Verletzung übernommen');
  perform tst.eq((select count(*) from public.rpe_entries where player_id = tst.get('p5_player')::uuid)::text, '2', 'T47 Historie bleibt im alten Team');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p5';
do $$ begin
  perform tst.eq((select string_agg(team_id::text, ',') from public.players where user_id = auth.uid()), tst.get('team_b'), 'T47 Spieler ist jetzt im neuen Team');
end $$;
commit;

-- Ankündigung
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.throws(format($q$select public.club_announce(%L, '   ')$q$, tst.get('club')), 'T47 leere Ankündigung', 'invalid_body');
select tst.eq(public.club_announce(tst.get('club')::uuid, 'Vereinsfest am Samstag ab 14 Uhr!')::text, '2', 'T47 Ankündigung in beide Teamchats');
select tst.eq(public.club_announce(tst.get('club')::uuid, 'Nur Team B', array[tst.get('team_b')::uuid])::text, '1', 'T47 Ankündigung an ausgewählte Teams');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p5';
do $$ begin
  perform tst.eq((select string_agg(body, ' | ' order by created_at) from public.chat_messages), 'Vereinsfest am Samstag ab 14 Uhr! | Nur Team B', 'T47 Spieler in Team B liest die Ankündigungen');
end $$;
commit;

-- Team lösen, Verein auflösen
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select public.club_unlink_team(tst.get('team_b')::uuid);
do $$ begin
  perform tst.eq((select count(*) from public.team_staff where team_id = tst.get('team_b')::uuid)::text, '1', 'T47 nach dem Lösen nur noch das eigene Trainerteam');
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.players where team_id = tst.get('team_b')::uuid)::text, '0', 'T47 Funktionär hat nach dem Lösen keinen Zugriff mehr');
end $$;
select public.club_remove_staff(tst.get('club')::uuid, tst.uid('coachC'));
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.ok((public.my_data_export() -> 'club_staff') @> '[{"club": "SG Test 1919", "role": "admin", "title": "Vorsitz"}]', 'T47 Datenexport enthält eigene Funktionen im Verein');
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.throws(format($q$select public.club_delete(%L)$q$, tst.get('club')), 'T47 nur der Vereinsadmin löst den Verein auf', 'forbidden');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.club_delete(tst.get('club')::uuid);
do $$ begin
  perform tst.eq((select coalesce(club_id::text, '-') from public.teams where id = tst.get('team_a')::uuid), '-', 'T47 aufgelöst: Team bleibt ohne Verein');
  perform tst.eq((select count(*) from public.team_staff where club_id is not null)::text, '0', 'T47 aufgelöst: keine Vereinszugriffe mehr');
  perform tst.eq((select count(*) from public.team_staff where team_id = tst.get('team_a')::uuid and user_id = tst.uid('coachC'))::text, '1', 'T47 aufgelöst: Trainerrolle in Team A bleibt');
end $$;
commit;
-- Aufräumen: Spieler aus T47 (Zählungen in späteren Tests)
delete from public.players where id in (tst.get('p5_player')::uuid, tst.get('tom_b')::uuid, tst.get('p5_b')::uuid);

-- =====================================================================
-- T48 Kaderplanung & Scouting: Recht „scout“, externe Spieler, Berichte, Merklisten, Saisonplanung,
-- Aufrücker aus dem Verein; Spieler und andere Teams ohne Zugriff
-- =====================================================================
do $$ begin
  perform tst.ok('scout' = any (public.default_perms('coach')) and 'scout' = any (public.default_perms('owner')), 'T48 Trainer und Owner haben standardmäßig „scout“');
  perform tst.ok(not ('scout' = any (public.default_perms('physio'))), 'T48 Physio standardmäßig ohne „scout“');
  perform tst.ok('scout' = any (public.club_default_perms('leiter')) and not ('scout' = any (public.club_default_perms('koord'))), 'T48 sportliche Leitung mit, Koordination ohne „scout“');
end $$;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
with ins as (insert into public.scout_lists (team_id, name) values (tst.get('team_b')::uuid, 'Liste B') returning id) select tst.put('sl_b', id::text) from ins;
with ins as (insert into public.players (team_id, first_name, birthdate) values (tst.get('team_b')::uuid, 'T48 Fremd', '2004-04-04') returning id) select tst.put('pb48', id::text) from ins;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), null);
with ins as (insert into public.scout_lists (team_id, name, color) values (tst.get('team_a')::uuid, 'Top-Ziele', '#aa3300') returning id) select tst.put('sl_a', id::text) from ins;
with ins as (insert into public.scout_players (team_id, first_name, last_name, birthdate, positions, foot, club, status, priority, lists, informed_at)
  values (tst.get('team_a')::uuid, '  Jan ', ' Kaiser ', '2009-04-02', array['IV', 'DM'], 'l', 'SV Nordheim', 'scout', 'a', array[tst.get('sl_a')::uuid], current_date) returning id) select tst.put('sc1', id::text) from ins;
select tst.throws(format($q$insert into public.scout_players (team_id, first_name, positions) values (%L, 'X', array['Libero'])$q$, tst.get('team_a')), 'T48 nur bekannte Positionen', 'check constraint');
select tst.throws(format($q$insert into public.scout_players (team_id, first_name, status) values (%L, 'X', 'gekauft')$q$, tst.get('team_a')), 'T48 nur bekannte Status', 'check constraint');
select tst.throws(format($q$insert into public.scout_players (team_id, first_name, video_url) values (%L, 'X', 'javascript:alert(1)')$q$, tst.get('team_a')), 'T48 Video nur als Link', 'check constraint');
select tst.throws(format($q$insert into public.scout_players (team_id, first_name, lists) values (%L, 'X', array[%L::uuid])$q$, tst.get('team_a'), tst.get('sl_b')), 'T48 nur Merklisten des eigenen Teams', 'different_teams');
select tst.throws(format($q$insert into public.scout_players (team_id, first_name, player_id) values (%L, 'X', %L)$q$, tst.get('team_a'), tst.get('pb48')),
  'T48 übernommener Spieler nur aus dem eigenen Team', 'different_teams');
with ins as (insert into public.players (team_id, first_name, last_name, birthdate, position) values (tst.get('team_a')::uuid, 'Jan', 'Kaiser', '2009-04-02', 'IV') returning id) select tst.put('own48', id::text) from ins;
select tst.affects(format($q$update public.scout_players set player_id = %L where id = %L$q$, tst.get('own48'), tst.get('sc1')), 1, 'T48 Verknüpfung mit eigenem Spieler (nach der Zusage übernommen)');
do $$ begin
  perform tst.eq((select first_name || '|' || last_name || '|' || birth_year from public.scout_players where id = tst.get('sc1')::uuid), 'Jan|Kaiser|2009', 'T48 Namen bereinigt, Jahrgang aus dem Geburtsdatum');
  perform tst.eq((select (created_by = tst.uid('coachA'))::text from public.scout_players where id = tst.get('sc1')::uuid), 'true', 'T48 Ersteller gesetzt');
end $$;
select tst.put('sc1_upd', (select updated_at::text from public.scout_players where id = tst.get('sc1')::uuid));
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
with ins as (insert into public.scout_reports (team_id, scout_id, date, event, kind, minutes, position, scores, grade, verdict, strengths, author_name)
  values (tst.get('team_a')::uuid, tst.get('sc1')::uuid, current_date - 3, 'SV Nordheim – TuS Rheinblick', 'match', 90, 'IV', '{"tech": 4, "takt": 3, "ath": 5, "ment": 4}', 4, 'sign', 'Kopfball, Tempo', 'Gefälscht') returning id) select tst.put('rep1', id::text) from ins;
do $$ begin
  perform tst.eq((select author_name || '|' || (author = tst.uid('coachA'))::text from public.scout_reports where id = tst.get('rep1')::uuid), 'Coach A|true', 'T48 Autor des Berichts setzt der Server');
  perform tst.ok((select updated_at > tst.get('sc1_upd')::timestamptz from public.scout_players where id = tst.get('sc1')::uuid), 'T48 neuer Bericht = Aktivität am Kandidaten');
end $$;
select tst.throws(format($q$insert into public.scout_reports (team_id, scout_id, grade) values (%L, %L, 7)$q$, tst.get('team_a'), tst.get('sc1')), 'T48 Gesamteindruck 1–5', 'check constraint');
select tst.affects(format($q$update public.scout_reports set author_name = 'X', summary = 'Top' where id = %L$q$, tst.get('rep1')), 1, 'T48 Bericht ändern');
do $$ begin
  perform tst.eq((select author_name || '|' || summary from public.scout_reports where id = tst.get('rep1')::uuid), 'Coach A|Top', 'T48 Autor bleibt beim Ändern');
end $$;
with ins as (insert into public.squad_plans (team_id, season, content) values (tst.get('team_a')::uuid, 2027, jsonb_build_object('formation', '4-3-3', 'slots', jsonb_build_object('IV-l', jsonb_build_object('own', '[]'::jsonb, 'shadow', jsonb_build_array('s:' || tst.get('sc1')), 'target', 2, 'need', 'Linksfuß')))) returning id) select tst.put('plan27', id::text) from ins;
select tst.throws(format($q$insert into public.squad_plans (team_id, season) values (%L, 2027)$q$, tst.get('team_a')), 'T48 eine Planung je Saison', 'duplicate');
select tst.throws(format($q$update public.squad_plans set season = 2028 where id = %L$q$, tst.get('plan27')), 'T48 Saison nicht änderbar', 'forbidden');
do $$ begin
  perform tst.eq((select (updated_by = tst.uid('coachA'))::text || '|' || (content -> 'slots' -> 'IV-l' ->> 'need') from public.squad_plans where id = tst.get('plan27')::uuid), 'true|Linksfuß', 'T48 Planung gespeichert');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select tst.throws(format($q$insert into public.scout_reports (team_id, scout_id) values (%L, %L)$q$, tst.get('team_b'), tst.get('sc1')), 'T48 Bericht nur zu Kandidaten des eigenen Teams', 'different_teams');
do $$ begin
  perform tst.eq(((select count(*) from public.scout_players) + (select count(*) from public.scout_reports) + (select count(*) from public.squad_plans where team_id = tst.get('team_a')::uuid))::text, '0', 'T48 anderes Team sieht kein Scouting von Team A');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq((select count(*) from public.scout_players where team_id = tst.get('team_a')::uuid)::text || '/' || (select count(*) from public.scout_reports)::text, '1/1', 'T48 Trainer (Standardrechte) sieht das Scouting');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select public.set_staff_perms(tst.get('team_a')::uuid, tst.uid('coachC'), array['plan', 'squad']);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
do $$ begin
  perform tst.eq(((select count(*) from public.scout_players) + (select count(*) from public.scout_reports) + (select count(*) from public.squad_plans) + (select count(*) from public.scout_lists))::text, '0', 'T48 ohne Recht „scout“ kein Zugriff');
end $$;
select tst.throws(format($q$insert into public.scout_players (team_id, first_name) values (%L, 'X')$q$, tst.get('team_a')), 'T48 ohne Recht „scout“ nichts anlegen', 'row-level security');
select tst.throws(format($q$select * from public.club_risers(%L, array[2010])$q$, tst.get('team_a')), 'T48 Aufrücker nur mit Recht „scout“', 'forbidden');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'p1';
do $$ begin
  perform tst.eq(((select count(*) from public.scout_players) + (select count(*) from public.scout_reports) + (select count(*) from public.squad_plans) + (select count(*) from public.scout_lists))::text, '0', 'T48 Spieler sehen kein Scouting');
end $$;
select tst.throws(format($q$insert into public.squad_plans (team_id, season) values (%L, 2030)$q$, tst.get('team_a')), 'T48 Spieler planen nicht', 'row-level security');
commit;

-- Aufrücker: Team B (jünger) im selben Verein
begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.eq((select count(*) from public.club_risers(tst.get('team_a')::uuid, array[2010]))::text, '0', 'T48 ohne Verein keine Aufrücker');
end $$;
select tst.throws(format($q$select * from public.club_risers(%L, '{}')$q$, tst.get('team_a')), 'T48 Jahrgänge nötig', 'invalid_years');
select tst.put('club48', public.club_create('SG Scouting', tst.get('team_a')::uuid)::text);
with ins as (insert into public.players (team_id, first_name, last_name, birthdate, position) values (tst.get('team_a')::uuid, ' dup ', 'LICHT', '2010-06-06', 'ZM') returning id) select tst.put('dup_a', id::text) from ins;
select tst.put('club48_link', (select link_code from public.my_clubs() where club_id = tst.get('club48')::uuid));
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachB';
select public.club_link_team(tst.get('club48_link'), tst.get('team_b')::uuid);
with ins as (insert into public.players (team_id, first_name, last_name, birthdate, position) values (tst.get('team_b')::uuid, 'Lio', 'Aufrücker', '2010-03-03', 'LV') returning id) select tst.put('ris1', id::text) from ins;
with ins as (insert into public.players (team_id, first_name, last_name, birthdate, position) values (tst.get('team_b')::uuid, 'Dup', 'Licht', '2010-06-06', 'ZM') returning id) select tst.put('ris2', id::text) from ins;
with ins as (insert into public.players (team_id, first_name, last_name, birthdate, position) values (tst.get('team_b')::uuid, 'Zu', 'Jung', '2012-01-01', 'ST') returning id) select tst.put('ris3', id::text) from ins;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
do $$ begin
  perform tst.eq((select string_agg(first_name || ' ' || last_name || '/' || "position" || '/' || birth_year || '/' || team_name, ',') from public.club_risers(tst.get('team_a')::uuid, array[2010, 2011])),
                 'Lio Aufrücker/LV/2010/U17', 'T48 Aufrücker: passender Jahrgang aus dem Verein, ohne Spieler, die schon im Team stehen');
end $$;
select public.club_delete(tst.get('club48')::uuid);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachA';
select tst.put('sc1_upd2', (select updated_at::text from public.scout_players where id = tst.get('sc1')::uuid));
delete from public.scout_lists where id = tst.get('sl_a')::uuid;
do $$ begin
  perform tst.eq((select cardinality(lists)::text from public.scout_players where id = tst.get('sc1')::uuid), '0', 'T48 gelöschte Merkliste aus Kandidaten entfernt');
  perform tst.eq((select updated_at::text from public.scout_players where id = tst.get('sc1')::uuid), tst.get('sc1_upd2'), 'T48 Merkliste löschen startet die Löschfrist nicht neu');
end $$;
select tst.affects(format($q$delete from public.scout_players where id = %L$q$, tst.get('sc1')), 1, 'T48 Kandidat löschen');
do $$ begin
  perform tst.eq((select count(*) from public.scout_reports where id = tst.get('rep1')::uuid)::text, '0', 'T48 Berichte werden mitgelöscht');
end $$;
delete from public.squad_plans where id = tst.get('plan27')::uuid;
commit;
delete from public.players where id in (tst.get('ris1')::uuid, tst.get('ris2')::uuid, tst.get('ris3')::uuid, tst.get('dup_a')::uuid, tst.get('pb48')::uuid, tst.get('own48')::uuid);
delete from public.scout_lists where id = tst.get('sl_b')::uuid;
-- Rechte von Coach C wieder auf Standard (spätere Tests)
update public.team_staff set perms = null where team_id = tst.get('team_a')::uuid and user_id = :'coachC';

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
  perform tst.eq(x ->> 'format', 'trainerbank-export-v7', 'T21b Exportformat v7');
  perform tst.ok(x ? 'match_plan_views', 'T21b Export enthält das Zugriffsprotokoll der Matchpläne');
  perform tst.ok(x ?& array['groups', 'tasks', 'duties', 'fines', 'cash', 'cash_waivers'], 'T21b Export enthält Gruppen, Aufgaben, Dienste, Strafen, Kasse');
  perform tst.ok(x ?& array['assessments', 'goals', 'goal_entries', 'dev_talks', 'challenge_entries', 'indiv_requests', 'chat_messages', 'chat_reactions', 'chat_reports', 'chats'],
                 'T21b Export enthält Entwicklung, Challenges, Individualtraining und Chat');
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
-- Aufgaben, Dienste, Strafen: erledigte/vergangene nach 12 Monaten weg, offene Strafen bleiben
insert into public.team_fines (team_id, player_id, rule, date, status)
select public.player_team(tst.get('p2_player')::uuid), tst.get('p2_player')::uuid, v.r, v.d, v.s
  from (values ('purge_done', (current_date - interval '13 months')::date, 'done'),
               ('purge_open', (current_date - interval '13 months')::date, 'open'),
               ('purge_new',  (current_date - interval '11 months')::date, 'waived')) v(r, d, s);
insert into public.team_duties (team_id, date, duty, player_id, source)
select public.player_team(tst.get('p2_player')::uuid), v.d, 'purge', tst.get('p2_player')::uuid, 'manual'
  from (values ((current_date - interval '13 months')::date), ((current_date - interval '11 months')::date)) v(d);
insert into public.team_tasks (team_id, title, player_id, done_at)
select public.player_team(tst.get('p2_player')::uuid), v.t, tst.get('p2_player')::uuid, v.d
  from (values ('purge alt erledigt', now() - interval '13 months'), ('purge offen', null::timestamptz),
               ('purge neu erledigt', now() - interval '1 month')) v(t, d);

begin;
set local role authenticated;
set local request.jwt.claim.sub = :'coachC';
select tst.throws($q$select public.purge_stale_health_data()$q$, 'T24 Clients dürfen nicht purgen', 'permission denied');
commit;

with ins as (insert into public.match_plans (team_id, title) values (tst.get('team_a')::uuid, 'T24 purge') returning id)
insert into public.match_plan_views (team_id, plan_id, player_id, kind, at)
select tst.get('team_a')::uuid, ins.id, tst.get('p2_player')::uuid, 'open', v.at
  from ins, (values (now() - interval '7 months'), (now() - interval '5 months')) v(at);

-- Scouting: abgeschlossene Kandidaten nach 6 Monaten, übrige nach 24 Monaten ohne Aktivität; alte Saisonplanungen
insert into public.scout_players (team_id, first_name, status)
select public.player_team(tst.get('p2_player')::uuid), v.n, v.s
  from (values ('purge absage alt', 'declined'), ('purge absage neu', 'declined'), ('purge beobachten alt', 'watch'), ('purge beobachten mittel', 'watch')) v(n, s);
alter table public.scout_players disable trigger scout_players_prepare;
update public.scout_players set updated_at = now() - interval '7 months' where first_name in ('purge absage alt', 'purge beobachten mittel');
update public.scout_players set updated_at = now() - interval '25 months' where first_name = 'purge beobachten alt';
alter table public.scout_players enable trigger scout_players_prepare;
insert into public.squad_plans (team_id, season)
select public.player_team(tst.get('p2_player')::uuid), v.y from (values (2020), (extract(year from current_date)::int)) v(y);

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
  perform tst.eq(r ->> 'team_fines', '1', 'T24 erledigte Strafe älter als 12 Monate gelöscht');
  perform tst.eq((select string_agg(rule, ',' order by rule) from public.team_fines where rule like 'purge%'), 'purge_new,purge_open',
                 'T24 offene alte Strafe und jüngere erlassene bleiben');
  perform tst.eq(r ->> 'team_duties', '1', 'T24 Dienst älter als 12 Monate gelöscht');
  perform tst.eq((select count(*) from public.team_duties where duty = 'purge')::text, '1', 'T24 jüngerer Dienst bleibt');
  perform tst.eq(r ->> 'team_tasks', '1', 'T24 erledigte Aufgabe älter als 12 Monate gelöscht');
  perform tst.eq((r ->> 'match_plan_views') || '/' || (select count(*) from public.match_plan_views v join public.match_plans mp on mp.id = v.plan_id where mp.title = 'T24 purge')::text,
                 '1/1', 'T24 Zugriffsprotokoll der Matchpläne nach 6 Monaten gelöscht');
  delete from public.match_plans where title = 'T24 purge';
  perform tst.eq((r ->> 'scout_players') || '/' || (select string_agg(first_name, ',' order by first_name) from public.scout_players where first_name like 'purge%'),
                 '2/purge absage neu,purge beobachten mittel', 'T24 Scouting: Absage nach 6 Monaten, sonst nach 24 Monaten gelöscht');
  perform tst.eq((r ->> 'squad_plans') || '/' || (select count(*) from public.squad_plans where season = 2020)::text, '1/0', 'T24 alte Saisonplanung gelöscht');
  delete from public.scout_players where first_name like 'purge%';
  delete from public.squad_plans where team_id = public.player_team(tst.get('p2_player')::uuid);
  perform tst.eq((select string_agg(title, ',' order by title) from public.team_tasks where title like 'purge%'), 'purge neu erledigt,purge offen',
                 'T24 offene und jüngere erledigte Aufgabe bleiben');
  delete from public.team_fines where rule like 'purge%';
  delete from public.team_duties where duty = 'purge';
  delete from public.team_tasks where title like 'purge%';
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
