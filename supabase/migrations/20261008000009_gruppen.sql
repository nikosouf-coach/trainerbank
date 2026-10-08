-- =====================================================================
-- Paket 3: Gruppen als eigene Tabellen.
-- - team_groups: Name, Art (Reha, Torhüter, Belastungsaufbau, Wachstumsschub,
--   Mannschaftsrat, Talent, eigene) und Sichtbarkeit für Spieler
-- - group_members: Zuordnung Spieler ↔ Gruppe
-- - Spieler sehen nur Gruppen, die der Trainer freigegeben hat, und nur die
--   eigene Mitgliedschaft (keine Mitgliederlisten, keine verborgenen Gruppen).
-- - Bisherige Gruppen aus teams.settings.groups / players.groups werden übernommen.
-- =====================================================================

create table if not exists public.team_groups (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  kind       text not null default 'custom' check (kind in ('reha', 'tw', 'build', 'growth', 'lead', 'talent', 'custom')),
  visible    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists team_groups_team_idx on public.team_groups (team_id);

create table if not exists public.group_members (
  group_id   uuid not null references public.team_groups (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
create index if not exists group_members_team_idx on public.group_members (team_id);
create index if not exists group_members_player_idx on public.group_members (player_id);

-- Team der Zeile aus dem Spieler; Gruppe und Spieler müssen zum selben Team gehören.
create or replace function public.group_members_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_group_team uuid;
begin
  select g.team_id into v_group_team from public.team_groups g where g.id = new.group_id;
  new.team_id := public.player_team(new.player_id);
  if v_group_team is null or new.team_id is null or new.team_id <> v_group_team then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.group_members_prepare() from public, anon, authenticated;
drop trigger if exists group_members_prepare on public.group_members;
create trigger group_members_prepare before insert or update on public.group_members
  for each row execute function public.group_members_prepare();

-- Ist die Gruppe freigegeben und der angemeldete Spieler Mitglied?
-- (security definer, damit sich die Regeln beider Tabellen nicht gegenseitig aufrufen)
create or replace function public.group_visible_to_me(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.team_groups g
      join public.group_members m on m.group_id = g.id
      join public.players p on p.id = m.player_id
     where g.id = p_group and g.visible and p.user_id = auth.uid()
  )
$$;
revoke all on function public.group_visible_to_me(uuid) from public, anon;
grant execute on function public.group_visible_to_me(uuid) to authenticated, service_role;

alter table public.team_groups enable row level security;
drop policy if exists team_groups_select on public.team_groups;
create policy team_groups_select on public.team_groups for select to authenticated
  using (public.is_team_staff(team_id) or public.group_visible_to_me(id));
drop policy if exists team_groups_write on public.team_groups;
create policy team_groups_write on public.team_groups for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.team_groups to authenticated;

alter table public.group_members enable row level security;
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (public.is_team_staff(team_id)
         or (public.is_own_player(player_id) and public.group_visible_to_me(group_id)));
drop policy if exists group_members_write on public.group_members;
create policy group_members_write on public.group_members for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.group_members to authenticated;

-- Videos an Gruppen: Gruppen-IDs zur Anzeige („an Torhüter“). Wer das Video sieht,
-- bestimmt weiterhin player_ids (Mitglieder zum Zeitpunkt des Versands).
alter table public.videos add column if not exists group_ids uuid[] not null default '{}';
do $$ begin
  alter table public.videos add constraint videos_group_ids_len check (cardinality(group_ids) <= 20);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Übernahme der bisherigen Gruppen (teams.settings.groups, players.groups)
-- ---------------------------------------------------------------------
do $$
declare
  r    record;
  g    jsonb;
  v_id uuid;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'players' and column_name = 'groups') then
    return;
  end if;
  for r in select t.id, t.settings from public.teams t where jsonb_typeof(t.settings -> 'groups') = 'array' loop
    for g in select value from jsonb_array_elements(r.settings -> 'groups') loop
      continue when jsonb_typeof(g) <> 'object' or coalesce(btrim(g ->> 'name'), '') = '';
      insert into public.team_groups (team_id, name, kind, visible)
      values (r.id,
              left(btrim(g ->> 'name'), 60),
              case when g ->> 'kind' in ('reha', 'tw', 'build', 'growth', 'lead', 'talent', 'custom') then g ->> 'kind' else 'custom' end,
              case when jsonb_typeof(g -> 'vis') = 'boolean' then (g -> 'vis')::boolean else false end)
      returning id into v_id;
      execute 'insert into public.group_members (group_id, player_id, team_id)
               select $1, p.id, p.team_id from public.players p where p.team_id = $2 and $3 = any (p.groups)
               on conflict do nothing'
        using v_id, r.id, g ->> 'id';
    end loop;
    update public.teams set settings = settings - 'groups' where id = r.id;
  end loop;
end
$$;

-- Spieler-Schutz ohne die alte Spalte neu anlegen, dann Spalte entfernen.
create or replace function public.players_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- RPC (security definer) oder service_role
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is not null then
      raise exception 'forbidden: players.user_id is linked via join_team only' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.user_id is not null and new.user_id is distinct from old.user_id then
    raise exception 'forbidden: players.user_id is linked via join_team only' using errcode = '42501';
  end if;
  if public.is_team_staff(old.team_id) then
    return new;
  end if;
  if new.id <> old.id
     or new.team_id is distinct from old.team_id
     or new.user_id is distinct from old.user_id
     or new.active  is distinct from old.active
     or new.is_new  is distinct from old.is_new
     or new.created_at <> old.created_at then
    raise exception 'forbidden: players.team_id, user_id, active and is_new can only be changed by team staff'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.players drop constraint if exists players_groups_len;
alter table public.players drop column if exists groups;
