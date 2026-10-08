-- =====================================================================
-- Paket 11.2: Rechte je Mitglied des Trainerteams.
-- team_staff.perms: einzelne Rechte (null = Standard der Rolle). Der Owner hat immer alle Rechte.
--   health   Gesundheitsdaten sehen/eintragen (RPE, Morgen-Check, Zusatzsport, Wachstum)
--   medical  Befunde (Arztbriefe) inkl. Dateien
--   plan     Kalender, Spiele, Termine, Planung, Vorbereitung, Videos
--   squad    Kader, Gruppen, Anwesenheit, Abwesenheiten, Kontakte
--   perf     Leistungstests und Spielstatistik
--   notes    Trainernotizen, Potenziale, Noten/Bewertungen
--   messages Nachrichten an Spieler
--   tasks    Aufgaben, Dienste, Strafenkatalog
--   cash     Mannschaftskasse
--   admin    Team-Einstellungen, Baukasten, was Spieler sehen
-- Rollen ändern, Rechte vergeben, Codes erneuern und Anfragen annehmen bleibt dem Owner vorbehalten.
-- Durchgesetzt in den Zugriffsregeln (RLS), nicht nur in der App.
-- =====================================================================

alter table public.team_staff add column if not exists perms text[];
do $$ begin
  alter table public.team_staff add constraint team_staff_perms_check check (
    perms is null or (cardinality(perms) <= 12 and perms <@ array['health', 'medical', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'cash', 'admin']::text[]));
exception when duplicate_object then null; end $$;
comment on column public.team_staff.perms is 'Einzelne Rechte; null = Standard der Rolle (default_perms). Owner hat immer alle.';

-- Standardrechte je Rolle (gleich wie src/core/perms.ts → defaultPerms)
create or replace function public.default_perms(p_role text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'owner'  then array['health', 'medical', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'cash', 'admin']
    when 'coach'  then array['health', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks']
    when 'physio' then array['health', 'medical', 'perf', 'messages']
    else array[]::text[]
  end
$$;

-- Hat der angemeldete Nutzer im Team dieses Recht?
create or replace function public.staff_can(team uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_staff s
     where s.team_id = team and s.user_id = auth.uid() and s.role <> 'pending'
       and (s.role = 'owner' or perm = any (coalesce(s.perms, public.default_perms(s.role))))
  )
$$;
create or replace function public.staff_can_player(pid uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_can(public.player_team(pid), perm)
$$;
revoke all on function public.default_perms(text) from public, anon;
revoke all on function public.staff_can(uuid, text) from public, anon;
revoke all on function public.staff_can_player(uuid, text) from public, anon;
grant execute on function public.default_perms(text) to authenticated, service_role;
grant execute on function public.staff_can(uuid, text) to authenticated, service_role;
grant execute on function public.staff_can_player(uuid, text) to authenticated, service_role;

-- Trainerteam-Liste mit Rechten (für die Rechteverwaltung; team_staff_list bleibt unverändert)
create or replace function public.team_staff_perms(p_team uuid)
returns table (user_id uuid, role text, display_name text, perms text[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_staff(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.user_id, s.role, p.display_name,
           case when s.role = 'pending' then array[]::text[] else coalesce(s.perms, public.default_perms(s.role)) end
    from public.team_staff s
    left join public.profiles p on p.id = s.user_id
    where s.team_id = p_team
    order by case s.role when 'owner' then 0 when 'coach' then 1 when 'physio' then 2 else 3 end,
             p.display_name nulls last;
end;
$$;
revoke all on function public.team_staff_perms(uuid) from public, anon;
grant execute on function public.team_staff_perms(uuid) to authenticated, service_role;

-- Owner: Rechte eines Mitglieds setzen (null = Standard der Rolle). Eigene Owner-Zeile ist nicht änderbar.
create or replace function public.set_staff_perms(p_team uuid, p_user uuid, p_perms text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_owner(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.team_staff s set perms = (select array_agg(distinct x order by x) from unnest(p_perms) x)
   where s.team_id = p_team and s.user_id = p_user and s.role in ('coach', 'physio');
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_staff_perms(uuid, uuid, text[]) from public, anon;
grant execute on function public.set_staff_perms(uuid, uuid, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Team-Einstellungen: welches Recht braucht welche Änderung? (Owner darf alles)
-- ---------------------------------------------------------------------
create or replace function public.teams_perm_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  k text;
  need text;
begin
  if current_user not in ('authenticated', 'anon') or public.is_team_owner(old.id) then
    return new;
  end if;
  for k in select jsonb_object_keys(coalesce(old.settings, '{}'::jsonb) || coalesce(new.settings, '{}'::jsonb)) loop
    continue when (old.settings -> k) is not distinct from (new.settings -> k);
    need := case
      when k in ('days', 'dauer', 'fix', 'spieltag', 'anstoss') then 'plan'
      when k in ('duties', 'fines') then 'tasks'
      when k in ('tests', 'testRank') then 'perf'
      when k = 'kasse' then 'cash'
      else 'admin' end;
    if not public.staff_can(old.id, need) then
      raise exception 'forbidden: % needs %', k, need using errcode = '42501';
    end if;
  end loop;
  if new.principles is distinct from old.principles and not public.staff_can(old.id, 'plan') then
    raise exception 'forbidden: principles need plan' using errcode = '42501';
  end if;
  if (new.club, new.name, new.accent, new.age_class, new.depth, new.modules, new.timezone, new.logo_path)
     is distinct from (old.club, old.name, old.accent, old.age_class, old.depth, old.modules, old.timezone, old.logo_path)
     and not public.staff_can(old.id, 'admin') then
    raise exception 'forbidden: team needs admin' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.teams_perm_guard() from public, anon, authenticated;
drop trigger if exists teams_perm_guard on public.teams;
create trigger teams_perm_guard before update on public.teams for each row execute function public.teams_perm_guard();

-- ---------------------------------------------------------------------
-- Teamdaten (Kalender, Planung): lesen = Mitglied, schreiben = Recht „plan“
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  w constant text := '(public.staff_can(team_id, ''plan''))';
begin
  foreach t in array array['matches', 'team_events', 'calendar_overrides', 'plan_overrides', 'week_modes', 'session_types', 'sessions', 'week_plans'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check %s', t || '_insert', t, w);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s', t || '_update', t, w, w);
    execute format('create policy %I on public.%I for delete to authenticated using %s', t || '_delete', t, w);
  end loop;
end
$$;

-- Kader: alle im Trainerteam sehen ihn, ändern nur mit „squad“ (Spieler ihre eigene Zeile wie bisher)
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated
  with check (public.staff_can(team_id, 'squad'));
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated
  using (user_id = (select auth.uid()) or public.staff_can(team_id, 'squad'))
  with check (user_id = (select auth.uid()) or public.staff_can(team_id, 'squad'));
drop policy if exists players_delete on public.players;
create policy players_delete on public.players for delete to authenticated
  using (public.staff_can(team_id, 'squad'));

-- Gesundheitsdaten: der Spieler selbst oder Staff mit „health“
do $$
declare
  t text;
  cond constant text := '(public.is_own_player(player_id) or public.staff_can_player(player_id, ''health''))';
begin
  foreach t in array array['rpe_entries', 'wellness_entries', 'extra_activities'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using %s', t || '_select', t, cond);
    execute format('create policy %I on public.%I for insert to authenticated with check %s', t || '_insert', t, cond);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s', t || '_update', t, cond, cond);
    execute format('create policy %I on public.%I for delete to authenticated using %s', t || '_delete', t, cond);
  end loop;
end
$$;

-- Wachstum (Gesundheit), Nachrichten, Potenziale und Notizen
do $$
declare
  t text;
  p text;
  own text;
begin
  foreach t in array array['growth_measurements', 'coach_messages', 'potentials', 'coach_notes'] loop
    p := case t when 'growth_measurements' then 'health' when 'coach_messages' then 'messages' else 'notes' end;
    own := case t when 'coach_notes' then '' when 'potentials' then ' or (public.is_own_player(player_id) and visible_to_player)' else ' or public.is_own_player(player_id)' end;
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    -- Nachrichten und Potenziale sieht das ganze Trainerteam (Transparenz), Wachstum und Notizen nur mit dem Recht
    execute format('create policy %I on public.%I for select to authenticated using (%s%s)', t || '_select', t,
      case when t in ('coach_messages', 'potentials') then 'public.is_staff_of_player(player_id)' else format('public.staff_can_player(player_id, %L)', p) end, own);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.staff_can_player(player_id, %L))', t || '_insert', t, p);
    execute format('create policy %I on public.%I for update to authenticated using (public.staff_can_player(player_id, %L)) with check (public.staff_can_player(player_id, %L))', t || '_update', t, p, p);
    execute format('create policy %I on public.%I for delete to authenticated using (public.staff_can_player(player_id, %L))', t || '_delete', t, p);
  end loop;
end
$$;

-- Abwesenheiten: sehen alle im Trainerteam (Planung), eintragen/ändern mit „squad“ oder „health“
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated
  with check (
    team_id = public.player_team(player_id)
    and (
      public.staff_can(team_id, 'squad') or public.staff_can(team_id, 'health')
      or (public.is_own_player(player_id) and reported_by_player and public.team_setting_bool(team_id, 'playerAbs', true))
    )
  );
drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences for update to authenticated
  using (public.staff_can(team_id, 'squad') or public.staff_can(team_id, 'health'))
  with check ((public.staff_can(team_id, 'squad') or public.staff_can(team_id, 'health')) and team_id = public.player_team(player_id));
drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences for delete to authenticated
  using (
    public.staff_can(team_id, 'squad') or public.staff_can(team_id, 'health')
    or (public.is_own_player(player_id) and reported_by_player and public.team_setting_bool(team_id, 'playerAbs', true))
  );

-- Anwesenheit: „squad“
drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (public.staff_can(team_id, 'squad') and team_id = public.player_team(player_id));
drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update to authenticated
  using (public.staff_can(team_id, 'squad'))
  with check (public.staff_can(team_id, 'squad') and team_id = public.player_team(player_id));
drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete to authenticated
  using (public.staff_can(team_id, 'squad'));

-- Spiele, Noten, Videos, Tests, Vorbereitung, Kontakte, Gruppen, Aufgaben: Schreiben je nach Recht
drop policy if exists match_stats_write on public.match_stats;
create policy match_stats_write on public.match_stats for all to authenticated
  using (public.staff_can(team_id, 'perf')) with check (public.staff_can(team_id, 'perf'));
drop policy if exists player_ratings_write on public.player_ratings;
create policy player_ratings_write on public.player_ratings for all to authenticated
  using (public.staff_can(team_id, 'notes')) with check (public.staff_can(team_id, 'notes'));
drop policy if exists videos_write on public.videos;
create policy videos_write on public.videos for all to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));
drop policy if exists performance_tests_write on public.performance_tests;
create policy performance_tests_write on public.performance_tests for all to authenticated
  using (public.staff_can(team_id, 'perf')) with check (public.staff_can(team_id, 'perf'));
drop policy if exists season_phases_write on public.season_phases;
create policy season_phases_write on public.season_phases for all to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));
drop policy if exists team_contacts_write on public.team_contacts;
create policy team_contacts_write on public.team_contacts for all to authenticated
  using (public.staff_can(team_id, 'squad')) with check (public.staff_can(team_id, 'squad'));
drop policy if exists team_groups_write on public.team_groups;
create policy team_groups_write on public.team_groups for all to authenticated
  using (public.staff_can(team_id, 'squad')) with check (public.staff_can(team_id, 'squad'));
drop policy if exists group_members_write on public.group_members;
create policy group_members_write on public.group_members for all to authenticated
  using (public.staff_can(team_id, 'squad')) with check (public.staff_can(team_id, 'squad'));
drop policy if exists team_fines_write on public.team_fines;
create policy team_fines_write on public.team_fines for all to authenticated
  using (public.staff_can(team_id, 'tasks')) with check (public.staff_can(team_id, 'tasks'));
drop policy if exists team_duties_write on public.team_duties;
create policy team_duties_write on public.team_duties for all to authenticated
  using (public.staff_can(team_id, 'tasks')) with check (public.staff_can(team_id, 'tasks'));
drop policy if exists team_tasks_staff on public.team_tasks;
create policy team_tasks_staff on public.team_tasks for all to authenticated
  using (public.staff_can(team_id, 'tasks')) with check (public.staff_can(team_id, 'tasks'));
-- Eigene Todos (oder Todos für alle Trainer) darf jeder im Trainerteam abhaken – nur „erledigt“ (Trigger)
drop policy if exists team_tasks_staff_done on public.team_tasks;
create policy team_tasks_staff_done on public.team_tasks for update to authenticated
  using (public.is_team_staff(team_id) and player_id is null
         and (staff_id is null or exists (select 1 from public.staff_profiles sp where sp.id = staff_id and sp.user_id = (select auth.uid()))))
  with check (public.is_team_staff(team_id));

create or replace function public.team_tasks_player_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.staff_can(old.team_id, 'tasks') then
    return new;
  end if;
  -- Spieler und Trainer ohne Recht „tasks“: nur erledigt/nicht erledigt
  if new.title is distinct from old.title or new.note is distinct from old.note or new.due is distinct from old.due
     or new.staff_id is distinct from old.staff_id or new.player_id is distinct from old.player_id
     or new.group_id is distinct from old.group_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at or new.team_id is distinct from old.team_id then
    raise exception 'forbidden: only done can be changed' using errcode = '42501';
  end if;
  if new.done_at is not null and new.done_at > now() then
    new.done_at := now();
  end if;
  new.done_by := case when new.done_at is null then null else auth.uid() end;
  return new;
end;
$$;
revoke all on function public.team_tasks_player_guard() from public, anon, authenticated;

-- Befunde: nur Staff mit „medical“ (und der Spieler selbst) – Tabelle und Dateien
drop policy if exists findings_select on public.findings;
create policy findings_select on public.findings for select to authenticated
  using (public.staff_can(team_id, 'medical') or public.is_own_player(player_id));
drop policy if exists findings_write on public.findings;
create policy findings_write on public.findings for all to authenticated
  using (public.staff_can(team_id, 'medical')) with check (public.staff_can(team_id, 'medical'));

create or replace function public.finding_access(p_folders text[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_folders is null or coalesce(array_length(p_folders, 1), 0) <> 2 then return null; end if;
  if p_folders[1] !~* uuid_re or p_folders[2] !~* uuid_re then return null; end if;
  if not exists (select 1 from public.players p where p.id = p_folders[2]::uuid and p.team_id = p_folders[1]::uuid) then return null; end if;
  if public.staff_can(p_folders[1]::uuid, 'medical') then return 'staff'; end if;
  if exists (select 1 from public.players p where p.id = p_folders[2]::uuid and p.user_id = auth.uid()) then return 'player'; end if;
  return null;
end;
$$;
create or replace function public.finding_row_role(p_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when bool_or(public.staff_can(f.team_id, 'medical')) then 'staff'
           when bool_or(public.is_own_player(f.player_id)) then 'player'
         end
    from public.findings f where f.path = p_name
$$;
