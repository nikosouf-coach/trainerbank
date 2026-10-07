-- =====================================================================
-- Baustein 7: Übungsarchiv (mit Zeichnung und Coachingpunkten),
-- gespeicherte Einheiten (Vorlagen) und Trainerprofile mit Aufgabenbereichen.
-- Nur das Trainerteam liest und schreibt.
-- =====================================================================

create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  category    text not null check (category in ('warmup', 'technik', 'pass', 'abschluss', 'spielform', 'taktik', 'athletik', 'torwart', 'cooldown')),
  themes      text[] not null default '{}' check (cardinality(themes) <= 20),
  duration    smallint not null default 15 check (duration between 1 and 180),
  players     text check (players is null or char_length(players) <= 60),
  area        text check (area is null or char_length(area) <= 60),
  rpe         numeric(3, 1) check (rpe is null or rpe between 0 and 10),
  description text check (description is null or char_length(description) <= 5000),
  points      jsonb not null default '[]'::jsonb check (jsonb_typeof(points) = 'array' and pg_column_size(points) <= 20000),
  drawing     jsonb check (drawing is null or pg_column_size(drawing) <= 60000),
  video_url   text check (video_url is null or (char_length(video_url) <= 1000 and video_url ~* '^https?://')),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists exercises_team_idx on public.exercises (team_id);

create table if not exists public.session_templates (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 160),
  theme      text check (theme is null or char_length(theme) <= 120),
  blocks     jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 30000),
  notes      text check (notes is null or char_length(notes) <= 5000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists session_templates_team_idx on public.session_templates (team_id);

create table if not exists public.staff_profiles (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  role       text not null check (role in ('chef', 'co', 'tw', 'athletik', 'physio', 'betreuer', 'analyst')),
  areas      text[] not null default '{}' check (cardinality(areas) <= 20),
  phone      text check (phone is null or char_length(phone) <= 40),
  email      text check (email is null or char_length(email) <= 200),
  note       text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists staff_profiles_team_idx on public.staff_profiles (team_id);

alter table public.exercises         enable row level security;
alter table public.session_templates enable row level security;
alter table public.staff_profiles    enable row level security;

drop policy if exists exercises_staff on public.exercises;
create policy exercises_staff on public.exercises for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
drop policy if exists session_templates_staff on public.session_templates;
create policy session_templates_staff on public.session_templates for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
drop policy if exists staff_profiles_staff on public.staff_profiles;
create policy staff_profiles_staff on public.staff_profiles for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));

grant select, insert, update, delete on public.exercises, public.session_templates, public.staff_profiles to authenticated;
