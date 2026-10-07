-- =====================================================================
-- Baustein 8: Vorbereitung & längere Pausen (Saisonphasen) mit Spielerprogramm.
-- - season_phases: Zeitraum, Wochenaufbau (weeks) und Programm (program) als jsonb.
--   Lesbar für alle Teammitglieder (Spieler brauchen die Pausentage für ihren Kalender;
--   Trainingsprogramme sind keine personenbezogenen Daten), schreibbar nur für das Trainerteam.
-- - extra_activities.program_item: abgehakter Programm-Baustein (Verweis auf program[].id).
-- =====================================================================

alter table public.extra_activities add column if not exists program_item text;
do $$ begin
  alter table public.extra_activities add constraint extra_program_item_len check (program_item is null or char_length(program_item) <= 64);
exception when duplicate_object then null; end $$;

create table if not exists public.season_phases (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  kind        text not null check (kind in ('prep', 'break')),
  title       text not null check (char_length(title) between 1 and 120),
  date_from   date not null,
  date_to     date not null,
  first_match date,
  weeks       jsonb not null default '{}'::jsonb check (jsonb_typeof(weeks) = 'object' and pg_column_size(weeks) <= 20000),
  program     jsonb not null default '[]'::jsonb check (jsonb_typeof(program) = 'array' and pg_column_size(program) <= 30000),
  visible     boolean not null default true,
  note        text check (note is null or char_length(note) <= 5000),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint season_phases_range check (date_to >= date_from and date_to - date_from <= 190)
);
create index if not exists season_phases_team_idx on public.season_phases (team_id, date_from);

alter table public.season_phases enable row level security;

drop policy if exists season_phases_select on public.season_phases;
create policy season_phases_select on public.season_phases for select to authenticated
  using (public.is_team_member(team_id));
drop policy if exists season_phases_write on public.season_phases;
create policy season_phases_write on public.season_phases for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));

grant select, insert, update, delete on public.season_phases to authenticated;

-- Sichtbarkeit für Spieler: neuer Schlüssel „program“ (hängt am Modul „vorbereitung“).
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
             when 'ratings'  then coalesce((t.modules ->> 'spielanalyse')::boolean, true)
             when 'stats'    then coalesce((t.modules ->> 'spielanalyse')::boolean, true)
             when 'videos'   then coalesce((t.modules ->> 'videos')::boolean, true)
             when 'tests'    then coalesce((t.modules ->> 'leistung')::boolean, true)
             when 'contacts' then coalesce((t.modules ->> 'kontakte')::boolean, true)
             when 'program'  then coalesce((t.modules ->> 'vorbereitung')::boolean, true)
             else true
           end
    from public.teams t where t.id = p_team), false)
$$;
revoke all on function public.player_view(uuid, text) from public, anon;
grant execute on function public.player_view(uuid, text) to authenticated;
