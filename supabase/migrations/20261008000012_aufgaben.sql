-- =====================================================================
-- Paket 7: Aufgaben, Dienste und Strafen.
-- - team_fines:  vergebene Strafen (Katalog in teams.settings.fines), Automatik-Einträge eindeutig je Regel/Spieler/Einheit
-- - team_duties: eingeteilte Dienste (reihum, als Strafe oder von Hand)
-- - team_tasks:  Aufgaben für Trainer (Todos) oder einzelne Spieler
-- Spieler sehen nur eigene Einträge; bei eigenen Aufgaben dürfen sie nur „erledigt“ setzen.
-- =====================================================================

create table if not exists public.team_fines (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  rule       text not null check (char_length(rule) between 1 and 40),
  date       date not null default current_date,
  ref_date   date,
  amount     numeric(6, 2) check (amount is null or amount between 0 and 1000),
  note       text check (note is null or char_length(note) <= 300),
  status     text not null default 'open' check (status in ('open', 'done', 'waived')),
  auto       boolean not null default false,
  duty_date  date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_fines_team_idx on public.team_fines (team_id, date);
create index if not exists team_fines_player_idx on public.team_fines (player_id);
-- Automatik: höchstens ein Eintrag je Regel, Spieler und Einheit (auch wenn erlassen – sonst käme er wieder)
create unique index if not exists team_fines_auto_uidx on public.team_fines (team_id, rule, player_id, ref_date) where ref_date is not null;

create table if not exists public.team_duties (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  date       date not null,
  duty       text not null check (char_length(duty) between 1 and 40),
  player_id  uuid not null references public.players (id) on delete cascade,
  source     text not null default 'rotation' check (source in ('rotation', 'fine', 'manual')),
  fine_id    uuid references public.team_fines (id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'done', 'waived')),
  created_at timestamptz not null default now(),
  unique (team_id, date, duty, player_id)
);
create index if not exists team_duties_team_idx on public.team_duties (team_id, date);
create index if not exists team_duties_player_idx on public.team_duties (player_id);

create table if not exists public.team_tasks (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 200),
  note       text check (note is null or char_length(note) <= 1000),
  due        date,
  staff_id   uuid references public.staff_profiles (id) on delete cascade,
  player_id  uuid references public.players (id) on delete cascade,
  group_id   uuid references public.team_groups (id) on delete set null,
  done_at    timestamptz,
  done_by    uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (staff_id is null or player_id is null)
);
create index if not exists team_tasks_team_idx on public.team_tasks (team_id, due);
create index if not exists team_tasks_player_idx on public.team_tasks (player_id);

-- Team aus dem Spieler bzw. Trainerprofil; Verweise müssen zum selben Team gehören
create or replace function public.team_rows_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pid uuid;
begin
  v_pid := new.player_id;
  if v_pid is not null and public.player_team(v_pid) is distinct from new.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if tg_table_name = 'team_tasks' then
    if new.staff_id is not null and not exists (select 1 from public.staff_profiles s where s.id = new.staff_id and s.team_id = new.team_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
    if new.group_id is not null and not exists (select 1 from public.team_groups g where g.id = new.group_id and g.team_id = new.team_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
  end if;
  if tg_table_name = 'team_duties' then
    if new.fine_id is not null and not exists (select 1 from public.team_fines f where f.id = new.fine_id and f.team_id = new.team_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.team_rows_prepare() from public, anon, authenticated;
drop trigger if exists team_fines_prepare on public.team_fines;
create trigger team_fines_prepare before insert or update on public.team_fines for each row execute function public.team_rows_prepare();
drop trigger if exists team_duties_prepare on public.team_duties;
create trigger team_duties_prepare before insert or update on public.team_duties for each row execute function public.team_rows_prepare();
drop trigger if exists team_tasks_prepare on public.team_tasks;
create trigger team_tasks_prepare before insert or update on public.team_tasks for each row execute function public.team_rows_prepare();

-- Spieler dürfen bei eigenen Aufgaben nur „erledigt“ setzen bzw. zurücknehmen
create or replace function public.team_tasks_player_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_team_staff(old.team_id) then
    return new;
  end if;
  if new.title is distinct from old.title or new.note is distinct from old.note or new.due is distinct from old.due
     or new.staff_id is distinct from old.staff_id or new.player_id is distinct from old.player_id
     or new.group_id is distinct from old.group_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at or new.team_id is distinct from old.team_id then
    raise exception 'forbidden: players can only mark tasks as done' using errcode = '42501';
  end if;
  new.done_by := case when new.done_at is null then null else auth.uid() end;
  return new;
end;
$$;
revoke all on function public.team_tasks_player_guard() from public, anon, authenticated;
drop trigger if exists team_tasks_player_guard on public.team_tasks;
create trigger team_tasks_player_guard before update on public.team_tasks for each row execute function public.team_tasks_player_guard();

alter table public.team_fines enable row level security;
drop policy if exists team_fines_select on public.team_fines;
create policy team_fines_select on public.team_fines for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));
drop policy if exists team_fines_write on public.team_fines;
create policy team_fines_write on public.team_fines for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.team_fines to authenticated;

alter table public.team_duties enable row level security;
drop policy if exists team_duties_select on public.team_duties;
create policy team_duties_select on public.team_duties for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));
drop policy if exists team_duties_write on public.team_duties;
create policy team_duties_write on public.team_duties for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.team_duties to authenticated;

alter table public.team_tasks enable row level security;
drop policy if exists team_tasks_select on public.team_tasks;
create policy team_tasks_select on public.team_tasks for select to authenticated
  using (public.is_team_staff(team_id) or (player_id is not null and public.is_own_player(player_id)));
drop policy if exists team_tasks_staff on public.team_tasks;
create policy team_tasks_staff on public.team_tasks for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
drop policy if exists team_tasks_player_done on public.team_tasks;
create policy team_tasks_player_done on public.team_tasks for update to authenticated
  using (player_id is not null and public.is_own_player(player_id))
  with check (player_id is not null and public.is_own_player(player_id));
grant select, insert, update, delete on public.team_tasks to authenticated;
