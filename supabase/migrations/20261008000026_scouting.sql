-- =====================================================================
-- Paket E: Kaderplanung & Scouting
-- - Recht „scout“ (Scouting & Kaderplanung) für Trainerteam und Funktionäre: Standard für Trainer, sportliche
--   Leitung und NLZ-/Jugendleitung; nicht für Physio, Koordination und Vereinsadmin (bewusst vergeben)
-- - scout_players: externe Spieler (kein App-Konto) mit Status-Pipeline, Priorität, Einschätzung, Merklisten,
--   nächstem Schritt und „informiert am“ (Art. 14 DSGVO); keine Gesundheitsdaten
-- - scout_reports: Scouting-Berichte (Bereiche/Kompetenzen 1–5, Gesamteindruck, Empfehlung, Stärken, Schwächen)
-- - scout_lists: Merklisten des Teams
-- - squad_plans: Saisonplanung je Saison (Schattenkader je Position, Stand der eigenen Spieler) als JSON
-- - club_risers: Aufrücker aus jüngeren Teams des Vereins (Name, Position, Jahrgang, Team – keine weiteren Daten)
-- - Löschfristen: abgeschlossene Kandidaten (Absage, kein Interesse) 6 Monate, alle übrigen 24 Monate nach der
--   letzten Änderung; Saisonplanungen zwei Spielzeiten nach ihrem Beginn
-- =====================================================================

-- ---------------------------------------------------------------------
-- Recht „scout“
-- ---------------------------------------------------------------------
alter table public.team_staff drop constraint if exists team_staff_perms_check;
alter table public.team_staff add constraint team_staff_perms_check check (
  perms is null or (cardinality(perms) <= 12 and perms <@ array['health', 'medical', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'cash', 'admin', 'scout']::text[]));
alter table public.club_staff drop constraint if exists club_staff_perms_check;
alter table public.club_staff add constraint club_staff_perms_check check (
  cardinality(perms) <= 12 and perms <@ array['health', 'medical', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'cash', 'admin', 'scout']::text[]);

-- Standardrechte je Rolle (gleich wie src/core/perms.ts → defaultPerms)
create or replace function public.default_perms(p_role text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'owner'  then array['health', 'medical', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'cash', 'admin', 'scout']
    when 'coach'  then array['health', 'plan', 'squad', 'perf', 'notes', 'messages', 'tasks', 'scout']
    when 'physio' then array['health', 'medical', 'perf', 'messages']
    else array[]::text[]
  end
$$;

-- Standardrechte je Funktion im Verein (wie src/core/club.ts → CLUB_PERMS)
create or replace function public.club_default_perms(p_role text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'admin'  then array['plan', 'squad']
    when 'leiter' then array['plan', 'squad', 'perf', 'notes', 'tasks', 'scout']
    when 'nlz'    then array['plan', 'squad', 'perf', 'notes', 'tasks', 'scout']
    when 'koord'  then array['plan', 'squad']
    else array[]::text[] end
$$;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table if not exists public.scout_lists (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  color      text not null default '#3a6db5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort       smallint not null default 0 check (sort between 0 and 999),
  created_at timestamptz not null default now()
);
create index if not exists scout_lists_team_idx on public.scout_lists (team_id);

create table if not exists public.scout_players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  first_name  text not null check (char_length(btrim(first_name)) between 1 and 60),
  last_name   text not null default '' check (char_length(last_name) <= 60),
  birth_year  smallint check (birth_year between 1950 and 2035),
  birthdate   date check (birthdate is null or birthdate between '1950-01-01' and '2035-12-31'),
  positions   text[] not null default '{}' check (cardinality(positions) <= 3
                and positions <@ array['TW', 'LV', 'IV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST']::text[]),
  foot        text check (foot in ('r', 'l', 'b')),
  height_cm   smallint check (height_cm between 100 and 230),
  club        text not null default '' check (char_length(club) <= 80),
  club_team   text not null default '' check (char_length(club_team) <= 80),
  status      text not null default 'watch' check (status in ('watch', 'scout', 'trial', 'talks', 'signed', 'declined', 'dropped')),
  priority    text check (priority in ('a', 'b', 'c')),
  level       smallint check (level between 1 and 5),
  potential   smallint check (potential between 1 and 5),
  tags        text[] not null default '{}' check (cardinality(tags) <= 10 and char_length(array_to_string(tags, '')) <= 300),
  lists       uuid[] not null default '{}' check (cardinality(lists) <= 20),
  source      text not null default '' check (char_length(source) <= 80),
  contact     text not null default '' check (char_length(contact) <= 200),
  video_url   text check (video_url is null or (char_length(video_url) <= 500 and video_url ~* '^https?://')),
  note        text not null default '' check (char_length(note) <= 2000),
  next_date   date,
  next_note   text not null default '' check (char_length(next_note) <= 120),
  informed_at date,
  player_id   uuid references public.players (id) on delete set null,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists scout_players_team_idx on public.scout_players (team_id, updated_at);
comment on table public.scout_players is 'Externe Spieler (Scouting). Keine Gesundheitsdaten. Information nach Art. 14 DSGVO (informed_at), Löschfristen in purge_stale_health_data().';

create table if not exists public.scout_reports (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  scout_id    uuid not null references public.scout_players (id) on delete cascade,
  date        date not null default current_date,
  event       text not null default '' check (char_length(event) <= 120),
  kind        text not null default 'match' check (kind in ('match', 'tournament', 'training', 'video', 'trial', 'other')),
  minutes     smallint check (minutes between 0 and 300),
  position    text check (position is null or position in ('TW', 'LV', 'IV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST')),
  scores      jsonb not null default '{}' check (jsonb_typeof(scores) = 'object' and pg_column_size(scores) <= 4000),
  grade       smallint check (grade between 1 and 5),
  verdict     text check (verdict in ('sign', 'watch', 'no')),
  strengths   text not null default '' check (char_length(strengths) <= 1000),
  weaknesses  text not null default '' check (char_length(weaknesses) <= 1000),
  summary     text not null default '' check (char_length(summary) <= 2000),
  author      uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text not null default '' check (char_length(author_name) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists scout_reports_scout_idx on public.scout_reports (scout_id, date);
create index if not exists scout_reports_team_idx on public.scout_reports (team_id);

create table if not exists public.squad_plans (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  -- Beginn der Saison (2027 = Saison 2027/28)
  season     smallint not null check (season between 2020 and 2100),
  content    jsonb not null default '{}' check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, season)
);

-- ---------------------------------------------------------------------
-- Prüfungen: gleiches Team, Merklisten des Teams, übernommener Spieler aus dem Team, Autor vom Server
-- ---------------------------------------------------------------------
create or replace function public.scout_players_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if cardinality(new.lists) > 0 and exists (
       select 1 from unnest(new.lists) x where not exists (select 1 from public.scout_lists l where l.id = x and l.team_id = new.team_id)) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.player_id is not null and (tg_op = 'INSERT' or new.player_id is distinct from old.player_id)
     and public.player_team(new.player_id) is distinct from new.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.birthdate is not null then new.birth_year := extract(year from new.birthdate)::smallint; end if;
  new.first_name := btrim(new.first_name); new.last_name := btrim(new.last_name);
  select coalesce(array_agg(distinct x), '{}') into new.lists from unnest(new.lists) x;
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  -- Aktivität = Änderung durch das Trainerteam (bzw. neuer Bericht über scout_reports_touch). Änderungen durch den
  -- Server (Merkliste gelöscht, übernommener Spieler gelöscht) starten die Löschfrist nicht neu.
  if tg_op = 'INSERT' or current_user in ('authenticated', 'anon') then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.scout_players_prepare() from public, anon, authenticated;
drop trigger if exists scout_players_prepare on public.scout_players;
create trigger scout_players_prepare before insert or update on public.scout_players
  for each row execute function public.scout_players_prepare();

-- ohne security definer: current_user ist dann die Rolle der Anfrage; Kandidat und Profil liest die Regel des Teams
create or replace function public.scout_reports_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select sp.team_id from public.scout_players sp where sp.id = new.scout_id) is distinct from new.team_id
     or (tg_op = 'UPDATE' and (new.team_id <> old.team_id or new.scout_id <> old.scout_id)) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.author := auth.uid();
      new.author_name := left(coalesce((select p.display_name from public.profiles p where p.id = auth.uid()), ''), 80);
    else
      new.author := old.author; new.author_name := old.author_name; new.created_at := old.created_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.scout_reports_prepare() from public, anon, authenticated;
drop trigger if exists scout_reports_prepare on public.scout_reports;
create trigger scout_reports_prepare before insert or update on public.scout_reports
  for each row execute function public.scout_reports_prepare();

-- Neuer oder geänderter Bericht = Aktivität am Kandidaten (Löschfrist beginnt neu)
create or replace function public.scout_reports_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.scout_players set updated_at = now() where id = new.scout_id;
  return null;
end;
$$;
revoke all on function public.scout_reports_touch() from public, anon, authenticated;
drop trigger if exists scout_reports_touch on public.scout_reports;
create trigger scout_reports_touch after insert or update on public.scout_reports
  for each row execute function public.scout_reports_touch();

-- Merkliste gelöscht: aus den Kandidaten entfernen
create or replace function public.scout_lists_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.scout_players set lists = array_remove(lists, old.id) where team_id = old.team_id and old.id = any (lists);
  return old;
end;
$$;
revoke all on function public.scout_lists_cleanup() from public, anon, authenticated;
drop trigger if exists scout_lists_cleanup on public.scout_lists;
create trigger scout_lists_cleanup before delete on public.scout_lists
  for each row execute function public.scout_lists_cleanup();

create or replace function public.squad_plans_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.team_id <> old.team_id or new.season <> old.season) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.squad_plans_prepare() from public, anon, authenticated;
drop trigger if exists squad_plans_prepare on public.squad_plans;
create trigger squad_plans_prepare before insert or update on public.squad_plans
  for each row execute function public.squad_plans_prepare();

-- ---------------------------------------------------------------------
-- Zugriffsregeln: nur Trainerteam bzw. Funktionäre mit Recht „scout“; Spieler nie
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['scout_lists', 'scout_players', 'scout_reports', 'squad_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.staff_can(team_id, %L)) with check (public.staff_can(team_id, %L))',
                   t || '_all', t, 'scout', 'scout');
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Aufrücker: Spieler jüngerer Teams desselben Vereins mit passendem Jahrgang (für die Saisonplanung)
-- ---------------------------------------------------------------------
create or replace function public.club_risers(p_team uuid, p_years int[])
returns table (player_id uuid, first_name text, last_name text, "position" text, birth_year int, team_id uuid, team_name text, age_class text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_club uuid := (select t.club_id from public.teams t where t.id = p_team);
begin
  if not public.staff_can(p_team, 'scout') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_years is null or cardinality(p_years) = 0 or cardinality(p_years) > 20 then raise exception 'invalid_years' using errcode = '22023'; end if;
  if v_club is null then return; end if;
  return query
    select p.id, p.first_name, coalesce(p.last_name, ''), coalesce(p.position, ''), extract(year from p.birthdate)::int, t.id, t.name, t.age_class
      from public.players p join public.teams t on t.id = p.team_id
     where t.club_id = v_club and t.id <> p_team and p.active and p.birthdate is not null
       and extract(year from p.birthdate)::int = any (p_years)
       -- nicht, wer schon im eigenen Team steht (gleiches Konto oder gleicher Name und Geburtstag)
       and not exists (select 1 from public.players q where q.team_id = p_team and q.active
                         and ((p.user_id is not null and q.user_id = p.user_id)
                              or (public.normalize_person_name(q.first_name) = public.normalize_person_name(p.first_name)
                                  and public.normalize_person_name(coalesce(q.last_name, '')) = public.normalize_person_name(coalesce(p.last_name, ''))
                                  and q.birthdate = p.birthdate)))
     order by t.age_class, extract(year from p.birthdate), p.last_name, p.first_name
     limit 300;
end;
$$;
revoke all on function public.club_risers(uuid, int[]) from public, anon;
grant execute on function public.club_risers(uuid, int[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Löschfristen: zusätzlich Scouting (abgeschlossene Kandidaten 6 Monate, sonst 24 Monate ohne Aktivität)
-- und Saisonplanungen zwei Spielzeiten nach Beginn
-- ---------------------------------------------------------------------
create or replace function public.purge_stale_health_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_health_cutoff date := (current_date - interval '24 months')::date;
  v_org_cutoff    date := (current_date - interval '12 months')::date;
  v_log_cutoff    date := current_date - 30;
  v_season        int  := extract(year from current_date)::int - case when extract(month from current_date) < 7 then 1 else 0 end;
  n_rpe int; n_wellness int; n_extra int; n_push int; n_ai int; n_fines int; n_duties int; n_tasks int;
  n_chat int; n_reports int; n_indiv int; n_chatpush int; n_mpviews int; n_scouts int; n_scouts_closed int; n_squad int;
begin
  delete from public.rpe_entries      where date < v_health_cutoff; get diagnostics n_rpe = row_count;
  delete from public.wellness_entries where date < v_health_cutoff; get diagnostics n_wellness = row_count;
  delete from public.extra_activities where date < v_health_cutoff; get diagnostics n_extra = row_count;
  delete from public.push_log         where day  < v_log_cutoff;    get diagnostics n_push = row_count;
  -- KI-Tageszähler werden nach 30 Tagen ebenfalls nicht mehr gebraucht
  delete from public.ai_usage         where day  < v_log_cutoff;    get diagnostics n_ai = row_count;
  -- Dienste zuerst (Strafen-Dienste hängen per fine_id an der Strafe)
  delete from public.team_duties      where date < v_org_cutoff;    get diagnostics n_duties = row_count;
  delete from public.team_fines       where date < v_org_cutoff and status in ('done', 'waived'); get diagnostics n_fines = row_count;
  delete from public.team_tasks       where done_at is not null and done_at < v_org_cutoff; get diagnostics n_tasks = row_count;
  -- Chat
  delete from public.chat_messages    where created_at < v_health_cutoff; get diagnostics n_chat = row_count;
  delete from public.chat_reports     where status = 'done' and coalesce(handled_at, created_at) < v_org_cutoff; get diagnostics n_reports = row_count;
  delete from public.chat_push_log    where sent_at < v_log_cutoff; get diagnostics n_chatpush = row_count;
  delete from public.indiv_requests   where status <> 'open' and updated_at < v_org_cutoff; get diagnostics n_indiv = row_count;
  delete from public.match_plan_views where at < now() - interval '6 months'; get diagnostics n_mpviews = row_count;
  -- Scouting (externe Spieler): Berichte werden mitgelöscht
  delete from public.scout_players    where status in ('declined', 'dropped') and updated_at < now() - interval '6 months'; get diagnostics n_scouts_closed = row_count;
  delete from public.scout_players    where updated_at < now() - interval '24 months'; get diagnostics n_scouts = row_count;
  delete from public.squad_plans      where season < v_season - 1; get diagnostics n_squad = row_count;
  return jsonb_build_object(
    'rpe_entries', n_rpe, 'wellness_entries', n_wellness, 'extra_activities', n_extra,
    'push_log', n_push, 'ai_usage', n_ai, 'team_duties', n_duties, 'team_fines', n_fines, 'team_tasks', n_tasks,
    'chat_messages', n_chat, 'chat_reports', n_reports, 'chat_push_log', n_chatpush, 'indiv_requests', n_indiv,
    'match_plan_views', n_mpviews, 'scout_players', n_scouts + n_scouts_closed, 'squad_plans', n_squad,
    'health_cutoff', v_health_cutoff, 'org_cutoff', v_org_cutoff, 'log_cutoff', v_log_cutoff
  );
end;
$$;
revoke all on function public.purge_stale_health_data() from public, anon, authenticated;
grant execute on function public.purge_stale_health_data() to service_role;
