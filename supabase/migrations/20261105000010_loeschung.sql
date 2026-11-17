-- =====================================================================
-- Trainerstab – Löschung nach Widerruf und weitere Löschfristen (Art. 5 Abs. 1 lit. e, Art. 17 Abs. 1 lit. b DSGVO)
--
-- - health_basis(player): Gibt es für die Gesundheitsdaten des Spielers (noch) eine Einwilligung in der App?
--   Eigene Einwilligung in Gesundheitsdaten (unter 16 auch die eines bestätigten Elternteils) und unter 16 zusätzlich
--   die Einwilligung der Eltern (eigene Erklärung oder bestätigte Eltern) – wie missing_health_consent, je Spieler.
--   team_health_consent_players(team) liefert das fürs Trainerteam (ersetzt die Rechnung in der App, die Eltern-
--   Einwilligungen nicht kannte).
-- - erase_health_data(player): löscht die Gesundheitsdaten, die auf Einwilligung beruhen – Belastung je Einheit,
--   Morgen-Check mit Beschwerden und Schmerzangaben, Zusatzsport mit Programm-Einheiten, Körpergröße, Gewicht,
--   Hinweise für den Notfall, Mitgliedschaft in Reha-, Aufbau- und Wachstumsschub-Gruppen, daraus abgeleitete
--   Empfehlungen (Pause, Regeneration). Abwesenheiten wegen
--   Krankheit oder Verletzung bleiben für die Anwesenheit als „Sonstiges“ ohne Stufe, Region und Hinweis.
--   Nicht betroffen: Unfallmeldungen (eigene Rechtsgrundlage, 36 Monate) und Befunde (eigene Einwilligung, s. u.).
-- - purge_privacy() (täglich 04:35 UTC):
--   1. Widerruf: Ist das Letzte, was zu den Einwilligungen eines Spielers passiert ist, ein Widerruf (des Spielers
--      oder eines Elternteils, auch durch Lösen der Verknüpfung) und liegt er mehr als 30 Tage zurück, und gibt es
--      keine Einwilligung mehr, werden seine Gesundheitsdaten gelöscht. Wer innerhalb der 30 Tage erneut einwilligt,
--      behält sie.
--   2. Spieler seit 6 Monaten nicht mehr aktiv (players.inactive_since): Gesundheitsdaten gelöscht.
--   3. Push-Token ohne Aktualisierung seit 6 Monaten.
--   4. Nachrichten des Trainerteams 12 Monate nach Ablauf (ohne Ablauf: nach dem Erstellen).
--   5. Anwesenheit 24 Monate nach dem Termin, Abwesenheiten 24 Monate nach ihrem Ende.
-- - privacy_findings_due() / Edge Function privacy-purge (täglich 04:40 UTC über pg_net): Befunde, deren
--   App-Einwilligung seit 30 Tagen widerrufen ist (ohne schriftliche Einwilligung), und Befunde von Spielern, die seit
--   6 Monaten nicht mehr aktiv sind – Datei und Eintrag werden gelöscht.
-- - Zuletzt genutzt: profiles.last_seen_at (die App meldet sich höchstens einmal am Tag über touch_seen()).
--   Die Edge Function privacy-purge löscht außerdem (mit Fotos und Dateien im Speicher):
--   privacy_players_due()  Spielerprofile, die seit 24 Monaten nicht mehr aktiv sind,
--   privacy_teams_due()    Teams, in denen seit 24 Monaten niemand die App genutzt hat (Trainerteam, Spieler, Eltern,
--                          Funktionäre des Vereins) und die älter als 24 Monate sind,
--   privacy_accounts_due() Konten ohne Rolle (kein Spielerprofil, kein Trainerteam, keine Vereinsfunktion, keine
--                          Eltern-Verknüpfung), die seit 24 Monaten nicht genutzt wurden.
--   Alle Fristen beginnen frühestens mit dieser Migration (last_seen_at = Zeitpunkt der Migration).
-- - Für das Trainerteam: staff_erase_health_data(player) – Gesundheitsdaten eines Spielers löschen, z. B. wenn eine
--   schriftliche Einwilligung widerrufen wird (Recht „Gesundheitsdaten“); player_data_export(player) – Auskunft über
--   alle gespeicherten Daten eines Spielers als JSON, auch für Spieler ohne Konto (nur Owner; Art. 15/20 DSGVO).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Einwilligung je Spieler
-- ---------------------------------------------------------------------
create or replace function public.health_basis(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select pl.id, pl.user_id,
           pl.birthdate is not null and pl.birthdate > (public.team_today(pl.team_id) - interval '16 years')::date as u16
      from public.players pl where pl.id = p_player
  )
  select coalesce((
    select (exists (select 1 from public.consents c where c.user_id = p.user_id and c.kind = 'health_data' and c.withdrawn_at is null)
            or (p.u16 and public.guardian_consent_ok(p.id, 'health_data')))
       and (not p.u16
            or exists (select 1 from public.consents c where c.user_id = p.user_id and c.kind = 'parental' and c.withdrawn_at is null)
            or public.guardian_consent_ok(p.id, 'parental'))
      from p), false)
$$;
revoke all on function public.health_basis(uuid) from public, anon, authenticated;

-- Fürs Trainerteam: Spieler des Teams mit gültiger Einwilligung in Gesundheitsdaten (eigene oder der Eltern)
create or replace function public.team_health_consent_players(p_team uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from public.players p
   where p.team_id = p_team and public.is_team_staff(p_team) and public.health_basis(p.id)
$$;
revoke all on function public.team_health_consent_players(uuid) from public, anon;
grant execute on function public.team_health_consent_players(uuid) to authenticated;

-- Letzter Widerruf und letzte Einwilligung zu den Gesundheitsdaten eines Spielers (eigene und der Eltern)
create or replace function public.health_consent_events(p_player uuid, out last_given timestamptz, out last_withdrawn timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select max(c.given_at), max(c.withdrawn_at)
    from public.consents c, public.players p
   where p.id = p_player and c.kind in ('health_data', 'parental')
     and (c.player_id = p.id or (p.user_id is not null and c.user_id = p.user_id))
$$;
revoke all on function public.health_consent_events(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Gesundheitsdaten eines Spielers löschen (Einwilligung entfallen bzw. Frist abgelaufen)
-- ---------------------------------------------------------------------
create or replace function public.erase_health_data(p_player uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  k integer;
begin
  delete from public.rpe_entries where player_id = p_player;           get diagnostics k = row_count; n := n + k;
  delete from public.wellness_entries where player_id = p_player;      get diagnostics k = row_count; n := n + k;
  delete from public.extra_activities where player_id = p_player;      get diagnostics k = row_count; n := n + k;
  delete from public.growth_measurements where player_id = p_player;   get diagnostics k = row_count; n := n + k;
  delete from public.player_emergency_med where player_id = p_player;  get diagnostics k = row_count; n := n + k;
  delete from public.group_members m using public.team_groups g
   where m.player_id = p_player and g.id = m.group_id and g.kind in ('reha', 'build', 'growth');
  get diagnostics k = row_count; n := n + k;
  update public.players set weight_kg = null where id = p_player and weight_kg is not null;
  get diagnostics k = row_count; n := n + k;
  -- Empfehlungen, die aus Belastung und Morgen-Check abgeleitet sind (Pause, Regeneration)
  delete from public.coach_messages where player_id = p_player and type in ('pause', 'regen');
  get diagnostics k = row_count; n := n + k;
  -- Abwesenheiten bleiben für die Anwesenheit nachvollziehbar – ohne Gesundheitsbezug
  update public.absences set type = 'sonst', stage = null, note = null, area = null
   where player_id = p_player and type in ('krank', 'verletzung');
  get diagnostics k = row_count; n := n + k;
  return n;
end;
$$;
revoke all on function public.erase_health_data(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Tägliche Löschung
-- ---------------------------------------------------------------------
create or replace function public.purge_privacy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n_withdrawn int := 0; n_inactive int := 0; n_rows int := 0; n_tokens int; n_msgs int; n_att int; n_abs int;
  k int;
begin
  -- 1. Widerruf ohne neue Einwilligung seit 30 Tagen
  for r in
    select p.id from public.players p, lateral public.health_consent_events(p.id) e
     where e.last_withdrawn is not null and e.last_withdrawn >= coalesce(e.last_given, '-infinity'::timestamptz)
       and e.last_withdrawn < now() - interval '30 days'
       and not public.health_basis(p.id)
  loop
    k := public.erase_health_data(r.id);
    if k > 0 then n_withdrawn := n_withdrawn + 1; n_rows := n_rows + k; end if;
  end loop;
  -- 2. Seit 6 Monaten nicht mehr aktiv
  for r in select p.id from public.players p where not p.active and p.inactive_since < now() - interval '6 months'
  loop
    k := public.erase_health_data(r.id);
    if k > 0 then n_inactive := n_inactive + 1; n_rows := n_rows + k; end if;
  end loop;
  -- 3. Push-Token, die seit 6 Monaten nicht aktualisiert wurden
  delete from public.push_tokens where updated_at < now() - interval '6 months';
  get diagnostics n_tokens = row_count;
  -- 4. Nachrichten des Trainerteams 12 Monate nach Ablauf
  delete from public.coach_messages where coalesce(valid_until, created_at::date) < (current_date - interval '12 months')::date;
  get diagnostics n_msgs = row_count;
  -- 5. Anwesenheit und Abwesenheiten 24 Monate nach dem Eintrag (bei Abwesenheiten: nach ihrem Ende)
  delete from public.attendance where date < (current_date - interval '24 months')::date;
  get diagnostics n_att = row_count;
  delete from public.absences where coalesce(to_date, from_date) < (current_date - interval '24 months')::date;
  get diagnostics n_abs = row_count;
  return jsonb_build_object('players_withdrawn', n_withdrawn, 'players_inactive', n_inactive, 'health_rows', n_rows,
                            'push_tokens', n_tokens, 'coach_messages', n_msgs, 'attendance', n_att, 'absences', n_abs);
end;
$$;
revoke all on function public.purge_privacy() from public, anon, authenticated;
grant execute on function public.purge_privacy() to service_role;

-- Befunde zum Löschen (Datei und Eintrag löscht die Edge Function privacy-purge):
-- App-Einwilligung „Befunde“ des Spielers seit 30 Tagen widerrufen (ohne neue) – nicht bei schriftlicher Einwilligung –
-- oder Spieler seit 6 Monaten nicht mehr aktiv
create or replace function public.privacy_findings_due()
returns table (id uuid, path text)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.path
    from public.findings f join public.players p on p.id = f.player_id
   where (not p.active and p.inactive_since < now() - interval '6 months')
      or (f.consent_source = 'app' and p.user_id is not null
          and (select max(c.withdrawn_at) from public.consents c where c.user_id = p.user_id and c.kind = 'findings') < now() - interval '30 days'
          and not exists (select 1 from public.consents c where c.user_id = p.user_id and c.kind = 'findings' and c.withdrawn_at is null))
   order by f.created_at
   limit 500
$$;
revoke all on function public.privacy_findings_due() from public, anon, authenticated;
grant execute on function public.privacy_findings_due() to service_role;

-- ---------------------------------------------------------------------
-- Zuletzt genutzt (für die Löschfristen von Konten und Teams)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;
update public.profiles set last_seen_at = now() where last_seen_at is null;
alter table public.profiles alter column last_seen_at set default now();
comment on column public.profiles.last_seen_at is 'Zuletzt in der App (höchstens einmal am Tag über touch_seen()); Grundlage der Löschfristen';

-- Die App kann den Wert nicht selbst setzen (nur touch_seen() bzw. der Server)
create or replace function public.profiles_seen_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.last_seen_at := old.last_seen_at;
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_seen_guard() from public, anon, authenticated;
drop trigger if exists profiles_seen_guard on public.profiles;
create trigger profiles_seen_guard before update on public.profiles
  for each row execute function public.profiles_seen_guard();

create or replace function public.touch_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now()
   where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '20 hours')
$$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

-- ---------------------------------------------------------------------
-- Löschfristen für Spielerprofile, Teams und Konten (ausgeführt von der Edge Function privacy-purge)
-- ---------------------------------------------------------------------
-- Spielerprofile, die seit 24 Monaten nicht mehr aktiv sind (Foto und Befund-Dateien löscht die Edge Function vorher)
create or replace function public.privacy_players_due()
returns table (id uuid, team_id uuid, photo_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.team_id, p.photo_path
    from public.players p
   where not p.active and p.inactive_since < now() - interval '24 months'
   order by p.inactive_since
   limit 200
$$;
revoke all on function public.privacy_players_due() from public, anon, authenticated;
grant execute on function public.privacy_players_due() to service_role;

-- Teams, in denen seit 24 Monaten niemand die App genutzt hat: Trainerteam (auch offene Anfragen), Spieler mit
-- Konto, Eltern, Funktionäre des Vereins. Neue Teams (jünger als 24 Monate) nie.
create or replace function public.privacy_teams_due()
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select s.team_id, s.user_id from public.team_staff s
    union all
    select p.team_id, p.user_id from public.players p where p.user_id is not null
    union all
    select g.team_id, g.user_id from public.player_guardians g
    union all
    select t.id, c.user_id from public.teams t join public.club_staff c on c.club_id = t.club_id and c.role <> 'pending'
  )
  select t.id
    from public.teams t
   where t.created_at < now() - interval '24 months'
     and not exists (
       select 1 from members m join public.profiles pr on pr.id = m.user_id
        where m.team_id = t.id and coalesce(pr.last_seen_at, pr.created_at) >= now() - interval '24 months')
   order by t.created_at
   limit 20
$$;
revoke all on function public.privacy_teams_due() from public, anon, authenticated;
grant execute on function public.privacy_teams_due() to service_role;

-- Konten ohne Rolle, seit 24 Monaten nicht genutzt
create or replace function public.privacy_accounts_due()
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id
    from public.profiles pr
   where coalesce(pr.last_seen_at, pr.created_at) < now() - interval '24 months'
     and not exists (select 1 from public.players p where p.user_id = pr.id)
     and not exists (select 1 from public.team_staff s where s.user_id = pr.id and s.role <> 'pending')
     and not exists (select 1 from public.club_staff c where c.user_id = pr.id and c.role <> 'pending')
     and not exists (select 1 from public.player_guardians g where g.user_id = pr.id)
     and not exists (select 1 from public.app_admins a where a.user_id = pr.id)
   order by coalesce(pr.last_seen_at, pr.created_at)
   limit 100
$$;
revoke all on function public.privacy_accounts_due() from public, anon, authenticated;
grant execute on function public.privacy_accounts_due() to service_role;

-- ---------------------------------------------------------------------
-- Für das Trainerteam: Gesundheitsdaten eines Spielers löschen (z. B. Widerruf einer schriftlichen Einwilligung)
-- Befund-Dateien löscht die App vorher selbst (Recht „Befunde“); hier bleiben Befunde unberührt.
-- ---------------------------------------------------------------------
create or replace function public.staff_erase_health_data(p_player uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid := public.player_team(p_player);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_team is null or not public.staff_can(v_team, 'health') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return public.erase_health_data(p_player);
end;
$$;
revoke all on function public.staff_erase_health_data(uuid) from public, anon;
grant execute on function public.staff_erase_health_data(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Auskunft für einen Spieler (Art. 15/20 DSGVO), auch ohne Konto: alle gespeicherten Daten als JSON, inklusive
-- interner Notizen des Trainerteams. Ohne Angaben über andere Personen: keine Namen von Gebern der Stärken-Runde,
-- keine anonymen Umfrage-Antworten, keine Konten-IDs, E-Mail-Adressen oder Speicherpfade.
-- Jede Tabelle mit einer Spalte player_id steht unten oder ist ausdrücklich ausgenommen (RLS-Test T63 prüft das).
-- ---------------------------------------------------------------------
create or replace function public.player_export_tables()
returns table (key text, tbl text, col text, strip text[])
language sql
immutable
set search_path = public
as $$
  values
    ('abwesenheiten',            'absences',             'player_id', array['team_id', 'created_by']),
    ('unfallmeldungen',          'accident_reports',     'player_id', array['team_id', 'updated_by', 'absence_id', 'match_id']),
    ('anwesenheit',              'attendance',           'player_id', array['team_id']),
    ('kasse_buchungen',          'cash_entries',         'player_id', array['team_id', 'created_by']),
    ('kasse_befreiungen',        'cash_waivers',         'player_id', array['team_id']),
    ('challenges',               'challenge_entries',    'player_id', array['team_id']),
    ('nachrichten_trainerteam',  'coach_messages',       'player_id', array['created_by']),
    ('trainernotizen',           'coach_notes',          'player_id', array['team_id', 'created_by', 'updated_by']),
    ('entwicklungsprogramm',     'dev_programs',         'player_id', array['team_id', 'updated_by']),
    ('selbstanalyse',            'dev_self',             'player_id', array['team_id']),
    ('entwicklungsgespraeche',   'dev_talks',            'player_id', array['team_id', 'created_by']),
    ('zusatzsport',              'extra_activities',     'player_id', array['team_id', 'created_by']),
    ('befunde',                  'findings',             'player_id', array['team_id', 'created_by', 'path']),
    ('ziel_fortschritt',         'goal_entries',         'player_id', array['team_id', 'created_by']),
    ('wachstum',                 'growth_measurements',  'player_id', array['team_id', 'created_by']),
    ('individualtraining',       'indiv_requests',       'player_id', array['team_id', 'created_by']),
    ('nominierungen',            'match_nominations',    'player_id', array['team_id', 'answered_by_staff', 'answered_by_guardian']),
    ('matchplan_aufrufe',        'match_plan_views',     'player_id', array['team_id']),
    ('spielstatistik',           'match_stats',          'player_id', array['team_id']),
    ('leistungstests',           'performance_tests',    'player_id', array['team_id', 'created_by']),
    ('foto_erlaubnis',           'photo_consents',       'player_id', array['team_id', 'updated_by']),
    ('kompetenzprofil',          'player_assessments',   'player_id', array['team_id', 'created_by']),
    ('notfallkontakte',          'player_emergency',     'player_id', array['team_id', 'updated_by']),
    ('notfall_hinweise',         'player_emergency_med', 'player_id', array['team_id', 'updated_by']),
    ('ziele',                    'player_goals',         'player_id', array['team_id', 'created_by']),
    ('bewertungen',              'player_ratings',       'player_id', array['team_id', 'created_by']),
    ('groessen',                 'player_sizes',         'player_id', array['team_id', 'updated_by']),
    ('sperren',                  'player_suspensions',   'player_id', array['team_id', 'created_by']),
    ('potenziale',               'potentials',           'player_id', array['team_id', 'created_by']),
    ('mitfahrt_gesucht',         'ride_needs',           'player_id', array['team_id']),
    ('mitfahrt_plaetze',         'ride_seats',           'player_id', array['team_id']),
    ('belastung',                'rpe_entries',          'player_id', array['team_id', 'created_by']),
    ('scouting',                 'scout_players',        'player_id', array['team_id', 'created_by']),
    ('dienste',                  'team_duties',          'player_id', array['team_id', 'created_by']),
    ('strafen',                  'team_fines',           'player_id', array['team_id', 'created_by']),
    ('aufgaben',                 'team_tasks',           'player_id', array['team_id', 'created_by']),
    ('morgen_check',             'wellness_entries',     'player_id', array['team_id'])
$$;
revoke all on function public.player_export_tables() from public, anon, authenticated;

-- Tabellen mit player_id, die nicht (oder nur gesondert) in die Auskunft gehören
create or replace function public.player_export_special()
returns table (tbl text, why text)
language sql
immutable
set search_path = public
as $$
  values
    ('consents',          'gesondert: Einwilligungen des Spielers und der Eltern ohne Konto-IDs und E-Mail-Adressen'),
    ('player_guardians',  'gesondert: verknüpfte Eltern ohne Konto-IDs'),
    ('poll_answers',      'gesondert: nur Antworten auf Umfragen mit Namen'),
    ('group_members',     'gesondert: mit Name und Art der Gruppe'),
    ('guardian_invites',  'ausgenommen: Einladungscodes (nur als Hash gespeichert, Sicherheitsdaten)')
$$;
revoke all on function public.player_export_special() from public, anon, authenticated;

create or replace function public.player_data_export(p_player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p public.players;
  v_team public.teams;
  r record;
  v jsonb;
  v_out jsonb := '{}'::jsonb;
  -- Konten-IDs anderer Personen (Trainerteam, Eltern) und interne Verweise fallen überall weg
  v_common text[] := array['team_id', 'created_by', 'updated_by', 'answered_by', 'answered_by_staff', 'answered_by_guardian',
                           'done_by', 'confirmed_by', 'staff_id', 'user_id'];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_p from public.players where id = p_player;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.team_staff s where s.team_id = v_p.team_id and s.user_id = auth.uid() and s.role = 'owner') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_team from public.teams where id = v_p.team_id;

  for r in select * from public.player_export_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - $1), ''[]''::jsonb) from public.%I x where x.%I = $2', r.tbl, r.col)
      into v using r.strip || v_common, p_player;
    v_out := v_out || jsonb_build_object(r.key, v);
  end loop;

  v_out := v_out || jsonb_build_object(
    'einwilligungen', coalesce((
      select jsonb_agg(jsonb_build_object('art', c.kind, 'version', c.version, 'erteilt', c.given_at, 'widerrufen', c.withdrawn_at,
                                          'von', case when v_p.user_id is not null and c.user_id = v_p.user_id then 'spieler' else 'eltern' end)
                       order by c.given_at)
        from public.consents c
       where c.player_id = p_player or (v_p.user_id is not null and c.user_id = v_p.user_id)), '[]'::jsonb),
    'eltern', coalesce((
      select jsonb_agg(jsonb_build_object('name', g.name, 'beziehung', g.relation, 'status', g.status, 'volljaehrig_verlaengert', g.adult_ok,
                                          'angefragt', g.created_at, 'bestaetigt', g.confirmed_at) order by g.created_at)
        from public.player_guardians g where g.player_id = p_player), '[]'::jsonb),
    'umfragen', coalesce((
      select jsonb_agg(jsonb_build_object('umfrage', po.title, 'fragen', po.questions, 'antworten', a.answers, 'am', a.updated_at) order by a.created_at)
        from public.poll_answers a join public.polls po on po.id = a.poll_id
       where a.player_id = p_player and not po.anonymous), '[]'::jsonb),
    'umfragen_erstellt', coalesce((
      select jsonb_agg(jsonb_build_object('titel', po.title, 'fragen', po.questions, 'am', po.created_at) order by po.created_at)
        from public.polls po where po.author_player = p_player), '[]'::jsonb),
    'gruppen', coalesce((
      select jsonb_agg(jsonb_build_object('gruppe', tg.name, 'art', tg.kind) order by tg.name)
        from public.group_members m join public.team_groups tg on tg.id = m.group_id where m.player_id = p_player), '[]'::jsonb),
    'staerken_erhalten', coalesce((
      select jsonb_agg(jsonb_build_object('staerken', d.skills, 'am', d.updated_at) order by d.updated_at)
        from public.dev_peer_skills d where d.target_id = p_player), '[]'::jsonb),
    'staerken_verschenkt', coalesce((
      select jsonb_agg(jsonb_build_object('staerken', d.skills, 'am', d.updated_at) order by d.updated_at)
        from public.dev_peer_skills d where d.giver_id = p_player), '[]'::jsonb),
    'fahrten_als_fahrer', coalesce((
      select jsonb_agg(to_jsonb(x) - v_common order by x.created_at) from public.rides x where x.driver_pid = p_player), '[]'::jsonb),
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object('titel', x.title, 'link', x.url, 'datum', x.date, 'notiz', x.note) order by x.created_at)
        from public.videos x where p_player = any (x.player_ids)), '[]'::jsonb)
  );

  return jsonb_build_object(
    'format', 'trainerstab-auskunft',
    'version', 1,
    'erstellt', now(),
    'hinweise', jsonb_build_array(
      'Auskunft nach Art. 15 DSGVO über alle Daten, die das Trainerteam in der App Trainerstab zu diesem Spieler gespeichert hat, auch interne Notizen.',
      'Vor dem Weitergeben prüfen: Angaben über andere Personen in Freitexten (z. B. Notizen) schwärzen.',
      'Dateien (Foto, Befunde) sind nicht enthalten; sie lassen sich in der App einzeln öffnen.',
      'Daten aus dem eigenen Konto des Spielers (z. B. Chats) enthält der Datenexport im Konto des Spielers.'),
    'team', jsonb_build_object('verein', v_team.club, 'team', v_team.name),
    'spieler', (to_jsonb(v_p) - array['user_id', 'team_id', 'photo_path', 'linked_from'])
               || jsonb_build_object('konto', v_p.user_id is not null, 'foto', v_p.photo_path is not null),
    'daten', v_out
  );
end;
$$;
revoke all on function public.player_data_export(uuid) from public, anon;
grant execute on function public.player_data_export(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Zeitpläne (ohne pg_cron bzw. pg_net nur ein Hinweis – siehe supabase/README.md)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-privacy: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-privacy', '35 4 * * *', 'select public.purge_privacy()');
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'privacy-purge: pg_net fehlt – Befunde werden erst nach Einrichtung gelöscht (README).';
    return;
  end if;
  perform cron.schedule(
    'privacy-purge',
    '40 4 * * *',
    $job$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/privacy-purge',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body    := jsonb_build_object('source', 'pg_cron'),
        timeout_milliseconds := 60000
      )
      where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
        and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret');
    $job$
  );
end;
$$;
