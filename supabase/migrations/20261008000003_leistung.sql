-- =====================================================================
-- Baustein 5: Leistungsdiagnostik (Sprint, CMJ, 30-15 IFT, Yo-Yo IR1, 505 …).
-- Spieler sehen eigene Werte, wenn „Leistungstests“ im Baukasten freigegeben sind.
-- =====================================================================

create table if not exists public.performance_tests (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  test       text not null check (test in ('sprint10', 'sprint30', 'cmj', 'ift', 'yoyo', 'agility505', 'slalom', 'standweit')),
  date       date not null,
  value      numeric(7, 2) not null check (value > 0 and value < 10000),
  note       text check (note is null or char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists performance_tests_player_idx on public.performance_tests (player_id, test, date);
create index if not exists performance_tests_team_idx on public.performance_tests (team_id, date);

create or replace function public.performance_tests_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.team_id := public.player_team(new.player_id);
  return new;
end;
$$;
create or replace trigger performance_tests_prepare before insert or update on public.performance_tests
  for each row execute function public.performance_tests_prepare();
revoke all on function public.performance_tests_prepare() from public, anon, authenticated;

alter table public.performance_tests enable row level security;
drop policy if exists performance_tests_select on public.performance_tests;
create policy performance_tests_select on public.performance_tests for select to authenticated
  using (public.is_team_staff(team_id) or (public.is_own_player(player_id) and public.player_view(team_id, 'tests')));
drop policy if exists performance_tests_write on public.performance_tests;
create policy performance_tests_write on public.performance_tests for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.performance_tests to authenticated;
