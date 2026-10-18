-- =====================================================================
-- Paket D: Verein / Vereinsabo
-- - clubs: Verein mit Codes (Team verbinden, Funktionäre)
-- - club_staff: Funktionäre (Vereinsadmin, sportliche Leitung, NLZ-/Jugendleitung, Koordinator) mit Rechten und
--   Teams (alle oder ausgewählte). Der Zugriff wird als team_staff-Zeile mit club_id gespiegelt (club_sync) –
--   damit gelten alle bestehenden Zugriffsregeln (staff_can, is_team_staff) unverändert. Vereinszeilen verwaltet
--   nur der Verein (Trigger team_staff_club_guard); echte Mitgliedschaften (Owner, Trainer) haben Vorrang.
-- - teams.club_id: Team gehört zu höchstens einem Verein (verbinden per Code durch den Team-Owner)
-- - club_overview: Kennzahlen je Team (nur Zahlen, Abwesenheiten/Beteiligung nur mit Recht „squad“)
-- - club_move_player: Spieler hochziehen (zusätzlich im höheren Team) oder dauerhaft wechseln; optional Belastung
--   der letzten 6 Wochen, Morgen-Checks (4 Wochen) und laufende Ausfälle mitnehmen (Recht „health“ in beiden Teams)
-- - club_announce: Ankündigung in die Teamchats ausgewählter Teams
-- - Datenexport v7 (eigene Funktionen im Verein)
-- =====================================================================

create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  accent     text not null default '#0b3d91' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  link_code  text not null unique,
  staff_code text not null unique,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.club_staff (
  club_id    uuid not null references public.clubs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'pending' check (role in ('admin', 'leiter', 'nlz', 'koord', 'pending')),
  title      text not null default '' check (char_length(title) <= 60),
  perms      text[] not null default '{}' check (cardinality(perms) <= 12 and perms <@ array['health', 'medical', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'cash', 'admin']::text[]),
  -- null = alle Teams des Vereins
  teams      uuid[] check (teams is null or cardinality(teams) <= 80),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_staff_user_idx on public.club_staff (user_id);

alter table public.teams add column if not exists club_id uuid references public.clubs (id) on delete set null;
create index if not exists teams_club_idx on public.teams (club_id);
alter table public.team_staff add column if not exists club_id uuid references public.clubs (id) on delete cascade;
comment on column public.team_staff.club_id is 'Gesetzt = Zugriff über den Verein (verwaltet von club_sync, nicht vom Team).';
alter table public.players add column if not exists linked_from uuid references public.players (id) on delete set null;
alter table public.players add column if not exists origin text;
do $$ begin
  alter table public.players add constraint players_origin_len check (origin is null or char_length(origin) <= 80);
exception when duplicate_object then null; end $$;

-- Codes (gleiches Format wie Team-Codes, eindeutig über Teams und Vereine)
create or replace function public.generate_unique_club_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := public.generate_team_code();
    exit when not exists (select 1 from public.teams t where t.join_code = v_code or t.staff_code = v_code)
          and not exists (select 1 from public.clubs c where c.link_code = v_code or c.staff_code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.generate_unique_club_code() from public, anon, authenticated;

-- Rolle des angemeldeten Kontos im Verein (ohne offene Anfragen)
create or replace function public.club_role(p_club uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cs.role from public.club_staff cs where cs.club_id = p_club and cs.user_id = auth.uid() and cs.role <> 'pending'
$$;
create or replace function public.is_club_admin(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.club_role(p_club) = 'admin', false)
$$;
revoke all on function public.club_role(uuid) from public, anon;
revoke all on function public.is_club_admin(uuid) from public, anon;
grant execute on function public.club_role(uuid) to authenticated, service_role;
grant execute on function public.is_club_admin(uuid) to authenticated, service_role;

-- Vereinszugriff als team_staff-Zeilen spiegeln (anlegen, Rechte angleichen, entfernen)
create or replace function public.club_sync(p_club uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_club is null then return; end if;
  delete from public.team_staff ts
   where ts.club_id = p_club
     and not exists (
       select 1 from public.club_staff cs join public.teams t on t.club_id = p_club
        where cs.club_id = p_club and cs.user_id = ts.user_id and cs.role <> 'pending' and t.id = ts.team_id
          and (cs.teams is null or t.id = any (cs.teams)));
  insert into public.team_staff (team_id, user_id, role, perms, club_id)
  select t.id, cs.user_id, 'coach', cs.perms, p_club
    from public.club_staff cs join public.teams t on t.club_id = p_club
   where cs.club_id = p_club and cs.role <> 'pending' and (cs.teams is null or t.id = any (cs.teams))
  on conflict (team_id, user_id) do update set perms = excluded.perms
   where public.team_staff.club_id = excluded.club_id;
end;
$$;
revoke all on function public.club_sync(uuid) from public, anon, authenticated;

create or replace function public.club_staff_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.club_sync(coalesce(new.club_id, old.club_id));
  return null;
end;
$$;
revoke all on function public.club_staff_after() from public, anon, authenticated;
drop trigger if exists club_staff_after on public.club_staff;
create trigger club_staff_after after insert or update or delete on public.club_staff
  for each row execute function public.club_staff_after();

create or replace function public.teams_club_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.club_id is distinct from old.club_id then
    -- Team verlässt den Verein: Vereinszeilen dieses Teams entfernen
    if old.club_id is not null then
      delete from public.team_staff where team_id = new.id and club_id = old.club_id;
    end if;
    perform public.club_sync(new.club_id);
  end if;
  return null;
end;
$$;
revoke all on function public.teams_club_after() from public, anon, authenticated;
drop trigger if exists teams_club_after on public.teams;
create trigger teams_club_after after update of club_id on public.teams
  for each row execute function public.teams_club_after();

-- Verein nur über Funktionen ändern (verbinden/lösen)
create or replace function public.teams_club_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and new.club_id is distinct from old.club_id then
    raise exception 'forbidden: club only via club_link_team' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.teams_club_guard() from public, anon, authenticated;
drop trigger if exists teams_club_guard on public.teams;
create trigger teams_club_guard before update on public.teams
  for each row execute function public.teams_club_guard();

-- Vereinszeilen im Trainerteam verwaltet nur der Verein
create or replace function public.team_staff_club_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.club_id is not null)
       or (tg_op in ('UPDATE', 'DELETE') and old.club_id is not null)
       or (tg_op = 'UPDATE' and new.club_id is distinct from old.club_id) then
      raise exception 'managed_by_club' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.team_staff_club_guard() from public, anon, authenticated;
drop trigger if exists team_staff_club_guard on public.team_staff;
create trigger team_staff_club_guard before insert or update or delete on public.team_staff
  for each row execute function public.team_staff_club_guard();

-- Codes und Ersteller nur über Funktionen
create or replace function public.clubs_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and (new.id, new.link_code, new.staff_code, new.created_by) is distinct from (old.id, old.link_code, old.staff_code, old.created_by) then
    raise exception 'forbidden: codes only via club_regenerate_codes' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.clubs_guard() from public, anon, authenticated;
drop trigger if exists clubs_guard on public.clubs;
create trigger clubs_guard before update on public.clubs
  for each row execute function public.clubs_guard();

alter table public.clubs      enable row level security;
alter table public.club_staff enable row level security;
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs for select to authenticated
  using (public.club_role(id) is not null
         or exists (select 1 from public.teams t where t.club_id = clubs.id and public.is_team_staff(t.id)));
drop policy if exists clubs_update on public.clubs;
create policy clubs_update on public.clubs for update to authenticated
  using (public.is_club_admin(id)) with check (public.is_club_admin(id));
drop policy if exists club_staff_select on public.club_staff;
create policy club_staff_select on public.club_staff for select to authenticated
  using (user_id = auth.uid() or public.club_role(club_id) is not null);
grant select, update on public.clubs to authenticated;
grant select on public.club_staff to authenticated;

-- Standardrechte je Funktion (wie src/core/club.ts → CLUB_PERMS)
create or replace function public.club_default_perms(p_role text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'admin'  then array['plan', 'squad']
    when 'leiter' then array['plan', 'squad', 'perf', 'notes', 'tasks']
    when 'nlz'    then array['plan', 'squad', 'perf', 'notes', 'tasks']
    when 'koord'  then array['plan', 'squad']
    else array[]::text[] end
$$;

-- ---------------------------------------------------------------------
-- Verein anlegen, Teams verbinden/lösen, Funktionäre
-- ---------------------------------------------------------------------
create or replace function public.club_create(p_name text, p_team uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_team is not null then
    if not public.is_team_owner(p_team) then raise exception 'forbidden' using errcode = '42501'; end if;
    if (select club_id from public.teams where id = p_team) is not null then raise exception 'already_in_club' using errcode = 'P0001'; end if;
  end if;
  if (select count(*) from public.club_staff where user_id = v_uid and role = 'admin') >= 5 then
    raise exception 'limit' using errcode = 'P0001', detail = 'clubs';
  end if;
  insert into public.clubs (name, link_code, staff_code, created_by)
  values (btrim(p_name), public.generate_unique_club_code(), public.generate_unique_club_code(), v_uid)
  returning id into v_id;
  insert into public.club_staff (club_id, user_id, role, perms) values (v_id, v_uid, 'admin', public.club_default_perms('admin'));
  if p_team is not null then update public.teams set club_id = v_id where id = p_team; end if;
  return v_id;
end;
$$;

create or replace function public.club_link_team(p_code text, p_team uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  if not public.is_team_owner(p_team) then raise exception 'forbidden' using errcode = '42501'; end if;
  select c.id into v_club from public.clubs c where c.link_code = public.normalize_team_code(p_code);
  if v_club is null then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if (select club_id from public.teams where id = p_team) is not null then raise exception 'already_in_club' using errcode = 'P0001'; end if;
  if (select count(*) from public.teams where club_id = v_club) >= 80 then raise exception 'limit' using errcode = 'P0001', detail = 'teams'; end if;
  update public.teams set club_id = v_club where id = p_team;
  return v_club;
end;
$$;

-- Team aus dem Verein lösen: Owner des Teams oder Vereinsadmin
create or replace function public.club_unlink_team(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid := (select club_id from public.teams where id = p_team);
begin
  if v_club is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (public.is_team_owner(p_team) or public.is_club_admin(v_club)) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.teams set club_id = null where id = p_team;
  update public.club_staff set teams = array_remove(teams, p_team) where club_id = v_club and p_team = any (teams);
end;
$$;

-- Als Funktionär beitreten (Anfrage, der Vereinsadmin bestätigt)
create or replace function public.club_join(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select c.id into v_club from public.clubs c where c.staff_code = public.normalize_team_code(p_code);
  if v_club is null then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  insert into public.club_staff (club_id, user_id, role) values (v_club, auth.uid(), 'pending') on conflict (club_id, user_id) do nothing;
  return v_club;
end;
$$;

-- Vereinsadmin: Funktion, Titel, Rechte und Teams eines Funktionärs (Bestätigen einer Anfrage inklusive)
create or replace function public.club_set_staff(p_club uuid, p_user uuid, p_role text, p_title text, p_perms text[], p_teams uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_club_admin(p_club) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('admin', 'leiter', 'nlz', 'koord') then raise exception 'invalid_role' using errcode = '22023'; end if;
  select role into v_old from public.club_staff where club_id = p_club and user_id = p_user;
  if v_old is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_old = 'admin' and p_role <> 'admin'
     and (select count(*) from public.club_staff where club_id = p_club and role = 'admin') <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  if p_teams is not null and exists (select 1 from unnest(p_teams) x where not exists (select 1 from public.teams t where t.id = x and t.club_id = p_club)) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  update public.club_staff
     set role = p_role, title = left(btrim(coalesce(p_title, '')), 60),
         perms = coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_perms, public.club_default_perms(p_role))) x), '{}'),
         teams = p_teams
   where club_id = p_club and user_id = p_user;
end;
$$;

-- Funktionär entfernen (Vereinsadmin) oder selbst austreten; der letzte Admin bleibt
create or replace function public.club_remove_staff(p_club uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := (select role from public.club_staff where club_id = p_club and user_id = p_user);
begin
  if v_role is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (public.is_club_admin(p_club) or p_user = auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_role = 'admin' and (select count(*) from public.club_staff where club_id = p_club and role = 'admin') <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  delete from public.club_staff where club_id = p_club and user_id = p_user;
end;
$$;

-- Verein auflösen (Vereinsadmin): Teams bleiben mit allen Daten bestehen, Zugriffe über den Verein enden
create or replace function public.club_delete(p_club uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_club_admin(p_club) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.clubs where id = p_club;
end;
$$;

create or replace function public.club_regenerate_codes(p_club uuid)
returns table (link_code text, staff_code text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_club_admin(p_club) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    update public.clubs c set link_code = public.generate_unique_club_code(), staff_code = public.generate_unique_club_code()
     where c.id = p_club returning c.link_code, c.staff_code;
end;
$$;

-- Eigene Vereine: als Funktionär (mit Rolle; Codes nur für Admins), als Trainerteam eines verbundenen Teams oder als Anfrage
create or replace function public.my_clubs()
returns table (club_id uuid, name text, accent text, role text, title text, link_code text, staff_code text, teams integer)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select c.id, coalesce(cs.role, 'team') as role, coalesce(cs.title, '') as title
      from public.clubs c
      left join public.club_staff cs on cs.club_id = c.id and cs.user_id = auth.uid()
     where cs.user_id is not null
        or exists (select 1 from public.teams t join public.team_staff s on s.team_id = t.id
                    where t.club_id = c.id and s.user_id = auth.uid() and s.role <> 'pending' and s.club_id is null)
  )
  select c.id, c.name, c.accent, m.role, m.title,
         case when m.role = 'admin' then c.link_code end, case when m.role = 'admin' then c.staff_code end,
         (select count(*)::int from public.teams t where t.club_id = c.id)
    from mine m join public.clubs c on c.id = m.id
   order by c.name
$$;

-- Funktionäre des Vereins mit Anzeigenamen (für Funktionäre des Vereins)
create or replace function public.club_staff_list(p_club uuid)
returns table (user_id uuid, role text, title text, perms text[], teams uuid[], display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.club_role(p_club) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select cs.user_id, cs.role, cs.title, cs.perms, cs.teams, p.display_name
      from public.club_staff cs left join public.profiles p on p.id = cs.user_id
     where cs.club_id = p_club
     order by case cs.role when 'admin' then 0 when 'leiter' then 1 when 'nlz' then 2 when 'koord' then 3 else 4 end, p.display_name nulls last;
end;
$$;

-- Teams des Vereins (für Funktionäre und das Trainerteam verbundener Teams); access = eigener Zugriff auf das Team
create or replace function public.club_teams(p_club uuid)
returns table (team_id uuid, club text, name text, age_class text, access boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.club_role(p_club) is null
     and not exists (select 1 from public.teams t where t.club_id = p_club and public.is_team_staff(t.id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.id, t.club, t.name, t.age_class, public.is_team_staff(t.id)
      from public.teams t where t.club_id = p_club
     order by t.age_class, t.name;
end;
$$;

-- ---------------------------------------------------------------------
-- Vereinsübersicht: Kennzahlen je Team (nur Teams, auf die man Zugriff hat; Abwesenheiten und Beteiligung nur
-- mit Recht „squad“, Matchplan-Status nur mit „plan“). Keine Daten einzelner Spieler.
-- ---------------------------------------------------------------------
create or replace function public.club_overview(p_club uuid)
returns table (team_id uuid, name text, age_class text, players integer, coach text,
               next_date date, next_time text, next_opp text, next_home boolean,
               last_date date, last_opp text, last_for integer, last_against integer,
               won integer, drawn integer, lost integer, goals_for integer, goals_against integer,
               injured integer, sick integer, absent integer, att_rate numeric, sessions28 integer, plan_state text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_season date := make_date(extract(year from current_date)::int - case when extract(month from current_date) < 7 then 1 else 0 end, 7, 1);
begin
  if public.club_role(p_club) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select t.id, t.name, t.age_class,
         (select count(*)::int from public.players p where p.team_id = t.id and p.active),
         (select sp.name from public.staff_profiles sp where sp.team_id = t.id and sp.role = 'chef' order by sp.created_at limit 1),
         nm.date, nm.time, nm.opponent, nm.home,
         lm.date, lm.opponent, lm.goals_for::int, lm.goals_against::int,
         (select count(*)::int from public.matches m where m.team_id = t.id and m.date >= v_season and m.date <= current_date and m.goals_for > m.goals_against),
         (select count(*)::int from public.matches m where m.team_id = t.id and m.date >= v_season and m.date <= current_date and m.goals_for = m.goals_against),
         (select count(*)::int from public.matches m where m.team_id = t.id and m.date >= v_season and m.date <= current_date and m.goals_for < m.goals_against),
         (select coalesce(sum(m.goals_for), 0)::int from public.matches m where m.team_id = t.id and m.date >= v_season and m.date <= current_date and m.goals_for is not null),
         (select coalesce(sum(m.goals_against), 0)::int from public.matches m where m.team_id = t.id and m.date >= v_season and m.date <= current_date and m.goals_against is not null),
         case when public.staff_can(t.id, 'squad') then (select count(distinct a.player_id)::int from public.absences a join public.players p on p.id = a.player_id and p.active
            where a.team_id = t.id and a.type = 'verletzung' and a.from_date <= current_date and (a.to_date is null or a.to_date >= current_date)) end,
         case when public.staff_can(t.id, 'squad') then (select count(distinct a.player_id)::int from public.absences a join public.players p on p.id = a.player_id and p.active
            where a.team_id = t.id and a.type = 'krank' and a.from_date <= current_date and (a.to_date is null or a.to_date >= current_date)) end,
         case when public.staff_can(t.id, 'squad') then (select count(distinct a.player_id)::int from public.absences a join public.players p on p.id = a.player_id and p.active
            where a.team_id = t.id and a.type not in ('verletzung', 'krank') and a.from_date <= current_date and (a.to_date is null or a.to_date >= current_date)) end,
         case when public.staff_can(t.id, 'squad') then (select round(avg(case when a.status = 'da' then 1.0 else 0.0 end), 3) from public.attendance a
            where a.team_id = t.id and a.date > current_date - 28 and a.date <= current_date) end,
         (select count(*)::int from public.sessions s where s.team_id = t.id and s.type = 'Training' and s.date > current_date - 28 and s.date <= current_date),
         case when not public.staff_can(t.id, 'plan') or nm.id is null then null
              else coalesce((select case when mp.published is null then 'draft'
                                         when mp.share_from is not null and now() < mp.share_from then 'scheduled'
                                         when now() < mp.share_until then 'live' else 'ended' end
                               from public.match_plans mp where mp.match_id = nm.id), 'none') end
    from public.teams t
    left join lateral (select m.id, m.date, m.time, m.opponent, m.home from public.matches m where m.team_id = t.id and m.date >= current_date order by m.date, m.time limit 1) nm on true
    left join lateral (select m.date, m.opponent, m.goals_for, m.goals_against from public.matches m where m.team_id = t.id and m.date <= current_date and m.goals_for is not null order by m.date desc limit 1) lm on true
   where t.club_id = p_club and public.is_team_staff(t.id)
   order by t.age_class, t.name;
end;
$$;

-- ---------------------------------------------------------------------
-- Spieler hochziehen (zusätzlich im Zielteam) oder dauerhaft wechseln
-- ---------------------------------------------------------------------
create or replace function public.club_move_player(p_player uuid, p_target uuid, p_mode text, p_copy boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src   public.players;
  v_st  public.teams;
  v_dt  public.teams;
  v_new uuid;
  v_nr  smallint;
  v_old uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('add', 'move') then raise exception 'invalid_mode' using errcode = '22023'; end if;
  select * into src from public.players where id = p_player;
  if src.id is null or not src.active then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_st from public.teams where id = src.team_id;
  select * into v_dt from public.teams where id = p_target;
  if v_dt.id is null or v_dt.id = v_st.id then raise exception 'invalid_target' using errcode = '22023'; end if;
  if not ((v_st.club_id is not null and v_st.club_id = v_dt.club_id) or (public.is_team_owner(v_st.id) and public.is_team_owner(v_dt.id))) then
    raise exception 'different_clubs' using errcode = '22023';
  end if;
  if not (public.staff_can(v_st.id, 'squad') and public.staff_can(v_dt.id, 'squad')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_copy and not (public.staff_can(v_st.id, 'health') and public.staff_can(v_dt.id, 'health')) then
    raise exception 'forbidden: health' using errcode = '42501';
  end if;
  -- schon im Zielteam (gleiches Konto oder gleicher Name und Geburtstag)?
  if exists (select 1 from public.players p where p.team_id = v_dt.id and p.active
               and ((src.user_id is not null and p.user_id = src.user_id)
                    or (public.normalize_person_name(p.first_name) = public.normalize_person_name(src.first_name)
                        and public.normalize_person_name(coalesce(p.last_name, '')) = public.normalize_person_name(coalesce(src.last_name, ''))
                        and p.birthdate is not distinct from src.birthdate))) then
    raise exception 'already_in_team' using errcode = 'P0001';
  end if;
  v_nr := case when src.shirt_number is not null and not exists (select 1 from public.players p where p.team_id = v_dt.id and p.active and p.shirt_number = src.shirt_number)
               then src.shirt_number end;
  -- früher schon einmal im Zielteam (inaktiv, gleiches Konto): diese Zeile wieder aktivieren
  if src.user_id is not null then
    select p.id into v_old from public.players p where p.team_id = v_dt.id and p.user_id = src.user_id and not p.active;
  end if;
  if v_old is not null then
    update public.players set active = true, linked_from = src.id, origin = left(v_st.name, 80),
           position = coalesce(position, src.position), shirt_number = coalesce(shirt_number, v_nr)
     where id = v_old;
    v_new := v_old;
  else
    insert into public.players (team_id, first_name, last_name, birthdate, position, shirt_number, weight_kg, linked_from, origin)
    values (v_dt.id, src.first_name, src.last_name, src.birthdate, src.position, v_nr, src.weight_kg, src.id, left(v_st.name, 80))
    returning id into v_new;
  end if;
  if p_mode = 'move' then
    -- dauerhaft: Konto wechselt ins Zielteam, die alte Zeile bleibt mit ihrer Historie als „inaktiv“ im alten Team
    update public.players set user_id = null, active = false where id = src.id;
    if src.user_id is not null then update public.players set user_id = src.user_id where id = v_new; end if;
  elsif src.user_id is not null and v_old is null then
    -- hochziehen: das Konto ist zusätzlich im Zielteam (Wechsel zwischen den Teams in der App)
    update public.players set user_id = src.user_id where id = v_new;
  end if;
  if p_copy then
    -- Belastung der letzten 6 Wochen als Vereinstraining (eine Zeile je Tag), Zusatzsport, Morgen-Checks (4 Wochen), laufende Ausfälle
    insert into public.extra_activities (player_id, date, type, minutes, rpe, label)
    select v_new, r.date, 'verein', least(600, sum(r.minutes))::smallint, round(sum(r.rpe * r.minutes) / nullif(sum(r.minutes), 0), 1), left('Training ' || v_st.name, 60)
      from public.rpe_entries r where r.player_id = src.id and r.date > current_date - 42 and r.date <= current_date and r.minutes > 0
     group by r.date;
    insert into public.extra_activities (player_id, date, type, minutes, rpe, label, program_item)
    select v_new, e.date, e.type, e.minutes, e.rpe, e.label, e.program_item
      from public.extra_activities e where e.player_id = src.id and e.date > current_date - 42 and e.date <= current_date;
    insert into public.wellness_entries
    select (jsonb_populate_record(null::public.wellness_entries, to_jsonb(w) || jsonb_build_object('player_id', v_new))).*
      from public.wellness_entries w where w.player_id = src.id and w.date > current_date - 28
    on conflict do nothing;
    insert into public.absences (team_id, player_id, type, from_date, to_date, stage, note, area)
    select v_dt.id, v_new, a.type, a.from_date, a.to_date, a.stage, a.note, a.area
      from public.absences a where a.player_id = src.id and a.from_date <= current_date + 60 and (a.to_date is null or a.to_date >= current_date);
  end if;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- Ankündigung in die Teamchats (Funktionäre; nur Teams mit Zugriff und eingeschaltetem Chat)
-- ---------------------------------------------------------------------
create or replace function public.club_announce(p_club uuid, p_body text, p_teams uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t   record;
  v_c uuid;
  n   int := 0;
begin
  if public.club_role(p_club) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 4000 then raise exception 'invalid_body' using errcode = '22023'; end if;
  for t in select x.id from public.teams x
            where x.club_id = p_club and public.is_team_staff(x.id) and (p_teams is null or x.id = any (p_teams))
              and (x.modules ->> 'chat') is distinct from 'false' and public.chat_on(x.id)
  loop
    v_c := public.chat_open(t.id, 'team');
    insert into public.chat_messages (chat_id, body, user_id) values (v_c, btrim(p_body), auth.uid());
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Trainerteam-Liste mit Rechten und der Angabe, ob der Zugriff über den Verein kommt (ersetzt team_staff_perms in der App)
create or replace function public.team_staff_rights(p_team uuid)
returns table (user_id uuid, role text, display_name text, perms text[], via_club boolean)
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
           case when s.role = 'pending' then array[]::text[] else coalesce(s.perms, public.default_perms(s.role)) end,
           s.club_id is not null
    from public.team_staff s
    left join public.profiles p on p.id = s.user_id
    where s.team_id = p_team
    order by case s.role when 'owner' then 0 when 'coach' then 1 when 'physio' then 2 else 3 end, s.club_id nulls first,
             p.display_name nulls last;
end;
$$;
revoke all on function public.team_staff_rights(uuid) from public, anon;
grant execute on function public.team_staff_rights(uuid) to authenticated, service_role;

-- Rechte setzen: nicht für Zugriffe über den Verein (die vergibt der Verein)
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
  if exists (select 1 from public.team_staff s where s.team_id = p_team and s.user_id = p_user and s.club_id is not null) then
    raise exception 'managed_by_club' using errcode = 'P0001';
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

do $$
declare f text;
begin
  foreach f in array array['club_create(text, uuid)', 'club_link_team(text, uuid)', 'club_unlink_team(uuid)', 'club_join(text)',
    'club_set_staff(uuid, uuid, text, text, text[], uuid[])', 'club_remove_staff(uuid, uuid)', 'club_delete(uuid)', 'club_regenerate_codes(uuid)', 'my_clubs()',
    'club_staff_list(uuid)', 'club_teams(uuid)', 'club_overview(uuid)', 'club_move_player(uuid, uuid, text, boolean)', 'club_announce(uuid, text, uuid[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end
$$;
revoke all on function public.club_default_perms(text) from public, anon;
grant execute on function public.club_default_perms(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Datenexport v7 (Art. 15/20 DSGVO): zusätzlich eigene Funktionen im Verein (Rolle, Titel, Rechte, Teams)
-- ---------------------------------------------------------------------
create or replace function public.my_data_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_players uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select coalesce(array_agg(p.id), '{}') into v_players from public.players p where p.user_id = v_uid;

  return jsonb_build_object(
    'format', 'trainerbank-export-v7',
    'exported_at', now(),
    'user_id', v_uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.given_at) from public.consents c where c.user_id = v_uid), '[]'::jsonb),
    'team_staff', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object('club', t.club, 'team_name', t.name) order by t.club, t.name)
      from public.team_staff s join public.teams t on t.id = s.team_id
      where s.user_id = v_uid), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object('club', t.club, 'team_name', t.name) order by p.created_at)
      from public.players p join public.teams t on t.id = p.team_id
      where p.id = any (v_players)), '[]'::jsonb),
    'rpe_entries', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date) from public.rpe_entries r
      where r.player_id = any (v_players)), '[]'::jsonb),
    'wellness_entries', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.date) from public.wellness_entries w
      where w.player_id = any (v_players)), '[]'::jsonb),
    'extra_activities', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.date) from public.extra_activities e
      where e.player_id = any (v_players)), '[]'::jsonb),
    'absences', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.from_date) from public.absences a
      where a.player_id = any (v_players)), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.date) from public.attendance a
      where a.player_id = any (v_players)), '[]'::jsonb),
    'growth_measurements', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.date) from public.growth_measurements g
      where g.player_id = any (v_players)), '[]'::jsonb),
    'potentials', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at) from public.potentials p
      where p.player_id = any (v_players) and p.visible_to_player), '[]'::jsonb),
    'coach_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at) from public.coach_messages m
      where m.player_id = any (v_players)), '[]'::jsonb),
    'match_stats', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.updated_at) from public.match_stats s
      where s.player_id = any (v_players)), '[]'::jsonb),
    'player_ratings', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date) from public.player_ratings r
      where r.player_id = any (v_players) and r.visible), '[]'::jsonb),
    'performance_tests', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.date) from public.performance_tests t
      where t.player_id = any (v_players)), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.date) from public.findings f
      where f.player_id = any (v_players)), '[]'::jsonb),
    -- Gruppen: nur freigegebene (wie in der App); interne Gruppen bleiben wie Trainernotizen ausgenommen
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('group', g.name, 'kind', g.kind, 'player_id', m.player_id, 'since', m.created_at) order by m.created_at)
        from public.group_members m join public.team_groups g on g.id = m.group_id
       where m.player_id = any (v_players) and g.visible), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at) from public.team_tasks t
      where t.player_id = any (v_players)), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.date) from public.team_duties d
      where d.player_id = any (v_players)), '[]'::jsonb),
    'fines', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.date) from public.team_fines f
      where f.player_id = any (v_players)), '[]'::jsonb),
    -- Mannschaftskasse: eigene Zahlungen und Befreiungen
    'cash', coalesce((
      select jsonb_agg(jsonb_build_object('date', c.date, 'amount', c.amount, 'kind', c.kind, 'category', c.cat, 'fee', c.fee_id, 'period', c.period, 'fine_id', c.fine_id, 'note', c.note) order by c.date)
        from public.cash_entries c where c.player_id = any (v_players)), '[]'::jsonb),
    'cash_waivers', coalesce((
      select jsonb_agg(jsonb_build_object('fee', w.fee_id, 'period', w.period, 'since', w.created_at) order by w.created_at)
        from public.cash_waivers w where w.player_id = any (v_players)), '[]'::jsonb),
    -- Spielerentwicklung: eigene Selbsteinschätzungen und Ziele, freigegebene Einschätzungen, Ziele und Gespräche
    -- (interne Gesprächsnotizen bleiben wie Trainernotizen ausgenommen)
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.date, 'by', case when a.by_player then 'self' else 'coach' end, 'scores', a.scores, 'note', a.note) order by a.date)
        from public.player_assessments a where a.player_id = any (v_players) and (a.by_player or a.visible)), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(to_jsonb(g) - 'created_by' order by g.created_at)
        from public.player_goals g where g.player_id = any (v_players) and (g.visible or g.by_player)), '[]'::jsonb),
    'goal_entries', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', e.goal_id, 'date', e.date, 'value', e.value, 'note', e.note, 'by_player', e.by_player) order by e.date)
        from public.goal_entries e join public.player_goals g on g.id = e.goal_id
       where e.player_id = any (v_players) and (g.visible or g.by_player)), '[]'::jsonb),
    'dev_talks', coalesce((
      select jsonb_agg(jsonb_build_object('date', t.date, 'kind', t.kind, 'player_view', t.player_view, 'strengths', t.strengths, 'focus', t.focus,
                                          'agreements', t.agreements, 'next_date', t.next_date) order by t.date)
        from public.dev_talks t where t.player_id = any (v_players) and t.visible), '[]'::jsonb),
    'challenge_entries', coalesce((
      select jsonb_agg(jsonb_build_object('week', c.week_start, 'challenge', c.title, 'value', e.value, 'days', e.days, 'done', e.done) order by c.week_start)
        from public.challenge_entries e join public.team_challenges c on c.id = e.challenge_id
       where e.player_id = any (v_players)), '[]'::jsonb),
    'indiv_requests', coalesce((
      select jsonb_agg(jsonb_build_object('topic', r.topic, 'note', r.note, 'wish', r.wish, 'status', r.status, 'answer', r.answer,
                                          'date', r.unit_date, 'created_at', r.created_at) order by r.created_at)
        from public.indiv_requests r where r.player_id = any (v_players)), '[]'::jsonb),
    -- Chat: eigene Nachrichten (Texte anderer gehören diesen), Reaktionen, Meldungen und Mitgliedschaften
    'chat_messages', coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', m.chat_id, 'sent_at', m.created_at, 'text', m.body, 'deleted_at', m.deleted_at) order by m.created_at)
        from public.chat_messages m where m.user_id = v_uid), '[]'::jsonb),
    'chat_reactions', coalesce((
      select jsonb_agg(jsonb_build_object('message_id', r.message_id, 'emoji', r.emoji, 'at', r.created_at) order by r.created_at)
        from public.chat_reactions r where r.user_id = v_uid), '[]'::jsonb),
    'chat_reports', coalesce((
      select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'status', r.status, 'at', r.created_at) order by r.created_at)
        from public.chat_reports r where r.reporter = v_uid), '[]'::jsonb),
    'chats', coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', c.id, 'kind', c.kind, 'title', c.title, 'muted', coalesce(st.muted, false), 'read_at', st.read_at) order by c.created_at)
        from public.chats c left join public.chat_state st on st.chat_id = c.id and st.user_id = v_uid
       where exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = v_uid)
          or st.user_id is not null), '[]'::jsonb),
    -- Matchplan: eigene Aufrufe und erkannte Screenshots (Inhalte der Pläne gehören dem Trainerteam)
    'match_plan_views', coalesce((
      select jsonb_agg(jsonb_build_object('plan', mp.title, 'kind', v.kind, 'platform', v.platform, 'at', v.at) order by v.at)
        from public.match_plan_views v join public.match_plans mp on mp.id = v.plan_id
       where v.player_id = any (v_players)), '[]'::jsonb),
    'club_staff', coalesce((
      select jsonb_agg(jsonb_build_object('club', c.name, 'role', cs.role, 'title', cs.title, 'perms', cs.perms, 'teams', cs.teams, 'since', cs.created_at) order by cs.created_at)
        from public.club_staff cs join public.clubs c on c.id = cs.club_id where cs.user_id = v_uid), '[]'::jsonb),
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated;
