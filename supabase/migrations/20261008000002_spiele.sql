-- =====================================================================
-- Baustein 4: Ergebnisse, Spieldaten (Minuten, Tore, Assists), Noten mit
-- Feedback (Spiel und Training) und Videos.
-- Spieler sehen nur eigene Einträge – und nur, wenn das Team den Bereich
-- im Baukasten freigegeben hat (teams.settings.playerView / teams.modules).
-- =====================================================================

alter table public.matches add column if not exists goals_for smallint check (goals_for is null or goals_for between 0 and 99);
alter table public.matches add column if not exists goals_against smallint check (goals_against is null or goals_against between 0 and 99);

-- Freigabe eines Bereichs für Spieler (Baukasten). Fehlender Schlüssel = freigegeben.
create or replace function public.player_view(p_team uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select coalesce((t.settings -> 'playerView' ->> p_key)::boolean, true)
       and case p_key
             when 'ratings' then coalesce((t.modules ->> 'spielanalyse')::boolean, true)
             when 'stats'   then coalesce((t.modules ->> 'spielanalyse')::boolean, true)
             when 'videos'  then coalesce((t.modules ->> 'videos')::boolean, true)
             when 'tests'   then coalesce((t.modules ->> 'leistung')::boolean, true)
             when 'contacts' then coalesce((t.modules ->> 'kontakte')::boolean, true)
             else true
           end
    from public.teams t where t.id = p_team), false)
$$;
revoke all on function public.player_view(uuid, text) from public, anon;
grant execute on function public.player_view(uuid, text) to authenticated;

create table if not exists public.match_stats (
  match_id   uuid not null references public.matches (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  minutes    smallint not null default 0 check (minutes between 0 and 150),
  goals      smallint not null default 0 check (goals between 0 and 20),
  assists    smallint not null default 0 check (assists between 0 and 20),
  started    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index if not exists match_stats_player_idx on public.match_stats (player_id);

create table if not exists public.player_ratings (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  date       date not null,
  kind       text not null check (kind in ('spiel', 'training')),
  rating     numeric(3, 1) check (rating is null or rating between 1 and 10),
  text       text check (text is null or char_length(text) <= 2000),
  visible    boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists player_ratings_player_date_idx on public.player_ratings (player_id, date);

create table if not exists public.videos (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  url        text not null check (char_length(url) <= 1000 and url ~* '^https?://'),
  date       date,
  match_id   uuid references public.matches (id) on delete set null,
  player_ids uuid[] not null default '{}' check (cardinality(player_ids) <= 60),
  note       text check (note is null or char_length(note) <= 1000),
  visible    boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists videos_team_idx on public.videos (team_id, date);

-- team_id aus dem Spieler ableiten und Spiel/Spieler im selben Team erzwingen
create or replace function public.match_stats_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.team_id := public.player_team(new.player_id);
  if new.team_id is distinct from (select m.team_id from public.matches m where m.id = new.match_id) then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create or replace trigger match_stats_prepare before insert or update on public.match_stats
  for each row execute function public.match_stats_prepare();

create or replace function public.player_ratings_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.team_id := public.player_team(new.player_id);
  return new;
end;
$$;
create or replace trigger player_ratings_prepare before insert or update on public.player_ratings
  for each row execute function public.player_ratings_prepare();

alter table public.match_stats    enable row level security;
alter table public.player_ratings enable row level security;
alter table public.videos         enable row level security;

drop policy if exists match_stats_select on public.match_stats;
create policy match_stats_select on public.match_stats for select to authenticated
  using (public.is_team_staff(team_id) or (public.is_own_player(player_id) and public.player_view(team_id, 'stats')));
drop policy if exists match_stats_write on public.match_stats;
create policy match_stats_write on public.match_stats for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));

drop policy if exists player_ratings_select on public.player_ratings;
create policy player_ratings_select on public.player_ratings for select to authenticated
  using (public.is_team_staff(team_id) or (public.is_own_player(player_id) and visible and public.player_view(team_id, 'ratings')));
drop policy if exists player_ratings_write on public.player_ratings;
create policy player_ratings_write on public.player_ratings for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));

drop policy if exists videos_select on public.videos;
create policy videos_select on public.videos for select to authenticated
  using (
    public.is_team_staff(team_id)
    or (visible and public.is_team_member(team_id) and public.player_view(team_id, 'videos')
        and (cardinality(player_ids) = 0
             or exists (select 1 from public.players p where p.user_id = (select auth.uid()) and p.id = any (player_ids))))
  );
drop policy if exists videos_write on public.videos;
create policy videos_write on public.videos for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));

grant select, insert, update, delete on public.match_stats, public.player_ratings, public.videos to authenticated;
revoke all on function public.match_stats_prepare()    from public, anon, authenticated;
revoke all on function public.player_ratings_prepare() from public, anon, authenticated;
