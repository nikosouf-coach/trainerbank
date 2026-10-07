-- =====================================================================
-- Trainerbank – Grundschema (Tabellen, Constraints, Indizes, Basis-Trigger)
-- Verbindliche Vorlage: docs/ARCHITEKTUR.md (Tabellen- und Spaltennamen)
--
-- Konventionen
--   * IDs: uuid default gen_random_uuid() (Postgres-Kern, keine Extension nötig)
--   * Zeitstempel: timestamptz default now(); Datumsfelder: date
--   * Uhrzeiten: text 'HH:MM' (24h), per CHECK geprüft
--   * RPE-Werte: numeric(3,1) 0–10 (ganze Zahlen und halbe Stufen möglich)
--   * Alles, was an einem Team oder Spieler hängt, wird mitgelöscht (cascade).
--   * Konto löschen (auth.users) ⇒ Spielerzeile ⇒ alle Gesundheitsdaten weg.
--
-- Zugriffsregeln (RLS), Hilfsfunktionen und Schutz-Trigger: *_rls.sql
-- RPCs: *_rpc.sql · Storage: *_storage.sql · Zeitplan: *_cron.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profile (1:1 zu auth.users, per Trigger angelegt)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  lang         text not null default 'de' check (lang in ('de', 'en')),
  created_at   timestamptz not null default now()
);
comment on table public.profiles is 'Ein Profil pro Konto; wird bei Registrierung per Trigger angelegt.';

-- ---------------------------------------------------------------------
-- Teams
-- Codes: Format XXXX-XXXX aus dem Alphabet ABCDEFGHJKMNPQRSTUVWXYZ23456789
-- (ohne die verwechselbaren Zeichen 0, O, 1, I, L).
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  club        text not null check (char_length(btrim(club)) between 1 and 100),
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  accent      text check (accent is null or char_length(accent) <= 32),
  age_class   text not null check (char_length(age_class) between 1 and 16),
  depth       text not null default 'basis' check (depth in ('org', 'basis', 'pro')),
  settings    jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  principles  jsonb not null default '{}'::jsonb,
  modules     jsonb not null default '{}'::jsonb check (jsonb_typeof(modules) = 'object'),
  timezone    text not null default 'Europe/Berlin',
  join_code   text not null unique
              check (join_code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  staff_code  text not null unique
              check (staff_code ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint teams_codes_differ check (join_code <> staff_code)
);
comment on column public.teams.join_code  is 'Beitrittscode für Spieler (RPC join_team).';
comment on column public.teams.staff_code is 'Beitrittscode für Trainer/Physio (RPC join_staff).';
comment on column public.teams.timezone   is 'IANA-Zeitzone, wird per Trigger validiert (u. a. für Push-Erinnerungen).';

create index if not exists teams_created_by_idx on public.teams (created_by);

-- ---------------------------------------------------------------------
-- Team-Staff (owner | coach | physio)
-- ---------------------------------------------------------------------
create table if not exists public.team_staff (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role    text not null default 'coach' check (role in ('owner', 'coach', 'physio')),
  primary key (team_id, user_id)
);
create index if not exists team_staff_user_idx on public.team_staff (user_id);

-- ---------------------------------------------------------------------
-- Spieler (mit oder ohne eigenes Konto)
-- ---------------------------------------------------------------------
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete cascade,
  first_name   text not null check (char_length(btrim(first_name)) between 1 and 60),
  last_name    text check (last_name is null or char_length(last_name) <= 60),
  birthdate    date check (birthdate is null or birthdate between date '1900-01-01' and date '2100-12-31'),
  position     text check (position is null or char_length(position) <= 40),
  shirt_number smallint check (shirt_number is null or shirt_number between 0 and 99),
  weight_kg    numeric(5, 1) check (weight_kg is null or (weight_kg > 0 and weight_kg < 250)),
  photo_path   text check (photo_path is null or char_length(photo_path) <= 200),
  is_new       boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint players_team_user_key unique (team_id, user_id)
);
comment on column public.players.user_id is 'Verknüpftes Konto (null = vom Trainer angelegt). Konto löschen ⇒ Zeile + Gesundheitsdaten weg.';
comment on column public.players.is_new  is 'true = per join_team neu angelegt (kein vorhandener Spieler gefunden) – Trainer prüft.';

create index if not exists players_team_idx on public.players (team_id);
create index if not exists players_user_idx on public.players (user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- Teamdaten: Kalender und Planung
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  date        date not null,
  time        text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  opponent    text check (opponent is null or char_length(opponent) <= 120),
  home        boolean not null default true,
  competition text not null default 'liga' check (competition in ('liga', 'pokal', 'test'))
);
create index if not exists matches_team_date_idx on public.matches (team_id, date);
create index if not exists matches_date_idx on public.matches (date);

create table if not exists public.team_events (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams (id) on delete cascade,
  date              date not null,
  time              text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  title             text not null check (char_length(title) between 1 and 120),
  type              text check (type is null or char_length(type) <= 40),
  replaces_training boolean not null default false
);
create index if not exists team_events_team_date_idx on public.team_events (team_id, date);
create index if not exists team_events_date_idx on public.team_events (date);

-- Abgesagtes Training (cancel) bzw. Zusatztraining (extra) an einem Tag
create table if not exists public.calendar_overrides (
  team_id  uuid not null references public.teams (id) on delete cascade,
  date     date not null,
  cancel   boolean not null default false,
  extra    boolean not null default false,
  time     text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration smallint check (duration is null or duration between 1 and 600),
  primary key (team_id, date)
);
create index if not exists calendar_overrides_date_idx on public.calendar_overrides (date);

-- Anpassungen des Trainers am berechneten Wochenplan
create table if not exists public.plan_overrides (
  team_id   uuid not null references public.teams (id) on delete cascade,
  date      date not null,
  kind      text check (kind is null or char_length(kind) <= 60),
  rpe       numeric(3, 1) check (rpe is null or rpe between 0 and 10),
  duration  smallint check (duration is null or duration between 0 and 600),
  content   text check (content is null or char_length(content) <= 4000),
  keep_rest boolean not null default false,
  primary key (team_id, date)
);

-- Wochenmodus; week_start ist immer ein Montag
create table if not exists public.week_modes (
  team_id    uuid not null references public.teams (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  mode       text not null default 'normal' check (mode in ('normal', 'aufbau', 'entlastung')),
  primary key (team_id, week_start)
);

-- Eigene Trainingsarten (im Plan referenziert als kind = 'c:' || id)
create table if not exists public.session_types (
  id      uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name    text not null check (char_length(btrim(name)) between 1 and 60),
  rpe     numeric(3, 1) check (rpe is null or rpe between 0 and 10),
  content text check (content is null or char_length(content) <= 4000)
);
create index if not exists session_types_team_idx on public.session_types (team_id);

-- Schnappschuss stattgefundener Einheiten (eine pro Team und Tag)
create table if not exists public.sessions (
  team_id    uuid not null references public.teams (id) on delete cascade,
  date       date not null,
  type       text not null default 'Training' check (type in ('Training', 'Spiel')),
  duration   smallint check (duration is null or duration between 0 and 600),
  time       text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  md         smallint check (md is null or md between -30 and 30),
  target_rpe numeric(3, 1) check (target_rpe is null or target_rpe between 0 and 10),
  kind       text check (kind is null or char_length(kind) <= 60),
  primary key (team_id, date)
);
comment on column public.sessions.md is 'Spieltags-Bezug als Tagesabstand (0 = Spieltag, -1 = MD-1, +1 = MD+1).';

-- Vom Trainer-Client veröffentlichter Wochenplan für die Spieler-App
create table if not exists public.week_plans (
  team_id     uuid not null references public.teams (id) on delete cascade,
  week_start  date not null check (extract(isodow from week_start) = 1),
  items       jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (team_id, week_start)
);

-- ---------------------------------------------------------------------
-- Spielerbezogene Daten
-- ---------------------------------------------------------------------
create table if not exists public.attendance (
  player_id uuid not null references public.players (id) on delete cascade,
  date      date not null,
  team_id   uuid not null references public.teams (id) on delete cascade,
  status    text not null check (status in ('da', 'ent', 'unent')),
  primary key (player_id, date)
);
create index if not exists attendance_team_date_idx on public.attendance (team_id, date);

-- Session-RPE (Foster et al. 2001): Belastung = rpe × minutes
create table if not exists public.rpe_entries (
  player_id  uuid not null references public.players (id) on delete cascade,
  date       date not null,
  rpe        numeric(3, 1) not null check (rpe between 0 and 10),
  minutes    smallint not null check (minutes between 1 and 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (player_id, date)
);
create index if not exists rpe_entries_date_idx on public.rpe_entries (date);

-- Hooper-Fragebogen (Hooper & Mackinnon 1995)
create table if not exists public.wellness_entries (
  player_id          uuid not null references public.players (id) on delete cascade,
  date               date not null,
  sleep_hours        numeric(3, 1) check (sleep_hours is null or sleep_hours between 0 and 16),
  sleep_quality      smallint check (sleep_quality is null or sleep_quality between 1 and 7),
  fatigue            smallint check (fatigue is null or fatigue between 1 and 7),
  soreness           smallint check (soreness is null or soreness between 1 and 7),
  stress             smallint check (stress is null or stress between 1 and 7),
  complaint          text not null default 'none' check (complaint in ('none', 'light', 'clear')),
  complaint_location text check (complaint_location is null or char_length(complaint_location) <= 120),
  primary key (player_id, date)
);
create index if not exists wellness_entries_date_idx on public.wellness_entries (date);

create table if not exists public.extra_activities (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  date      date not null,
  type      text not null check (type in ('gym', 'schule', 'lauf', 'verein', 'sonst')),
  minutes   smallint not null check (minutes between 1 and 600),
  rpe       numeric(3, 1) check (rpe is null or rpe between 0 and 10)
);
create index if not exists extra_activities_player_date_idx on public.extra_activities (player_id, date);

create table if not exists public.absences (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references public.teams (id) on delete cascade,
  player_id          uuid not null references public.players (id) on delete cascade,
  type               text not null check (type in ('urlaub', 'krank', 'verletzung', 'schule', 'arbeit', 'sonst')),
  from_date          date not null,
  to_date            date,
  stage              smallint check (stage is null or stage between 1 and 4),
  note               text check (note is null or char_length(note) <= 1000),
  reported_by_player boolean not null default false,
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  constraint absences_range check (to_date is null or to_date >= from_date)
);
comment on column public.absences.to_date is 'null = offen (z. B. Verletzung ohne absehbares Ende).';
create index if not exists absences_team_idx on public.absences (team_id, from_date);
create index if not exists absences_player_idx on public.absences (player_id, from_date);

create table if not exists public.growth_measurements (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  date      date not null,
  height_cm numeric(4, 1) not null check (height_cm between 50 and 250)
);
create index if not exists growth_measurements_player_date_idx on public.growth_measurements (player_id, date);

create table if not exists public.potentials (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.players (id) on delete cascade,
  category          text not null check (category in ('ath', 'tech', 'takt', 'ment', 'verf')),
  text              text not null check (char_length(text) between 1 and 2000),
  visible_to_player boolean not null default false,
  source            text not null default 'trainer' check (source in ('trainer', 'daten', 'ki')),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists potentials_player_idx on public.potentials (player_id);

create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  type        text not null check (type in ('pause', 'regen', 'zusatz', 'prog', 'info')),
  text        text not null check (char_length(text) between 1 and 2000),
  valid_until date,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists coach_messages_player_idx on public.coach_messages (player_id, created_at desc);

-- Interne Notizen des Trainerteams (nie für Spieler sichtbar)
create table if not exists public.coach_notes (
  player_id  uuid primary key references public.players (id) on delete cascade,
  text       text not null default '' check (char_length(text) <= 10000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Kontobezogene Daten
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  token      text primary key check (char_length(token) between 1 and 300),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform   text check (platform is null or platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- Nachweis der Einwilligungen (DSGVO Art. 7 / Art. 9, Art. 8 bei Minderjährigen)
create table if not exists public.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('privacy', 'health_data', 'parental')),
  version      text not null check (char_length(version) between 1 and 40),
  parent_email text check (parent_email is null or parent_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  given_at     timestamptz not null default now()
);
create index if not exists consents_user_idx on public.consents (user_id);

-- Tageszähler für die KI-Funktion (geschrieben nur serverseitig)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

-- Deduplizierung der Push-Erinnerungen (geschrieben nur serverseitig)
create table if not exists public.push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (char_length(kind) between 1 and 40),
  day     date not null,
  primary key (user_id, kind, day)
);
create index if not exists push_log_day_idx on public.push_log (day);

-- ---------------------------------------------------------------------
-- Basis-Trigger
-- ---------------------------------------------------------------------

-- updated_at automatisch setzen
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger coach_notes_touch
  before update on public.coach_notes
  for each row execute function public.touch_updated_at();

create or replace trigger push_tokens_touch
  before update on public.push_tokens
  for each row execute function public.touch_updated_at();

-- Profil bei Registrierung anlegen (Metadaten aus supabase.auth.signUp({ options: { data } }))
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_lang text  := lower(coalesce(nullif(btrim(v_meta ->> 'lang'), ''), 'de'));
begin
  if v_lang not in ('de', 'en') then
    v_lang := 'de';
  end if;
  insert into public.profiles (id, display_name, lang)
  values (new.id, left(nullif(btrim(v_meta ->> 'display_name'), ''), 80), v_lang)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger-Funktionen sind keine API (Supabase vergibt EXECUTE zusätzlich explizit an anon/authenticated)
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
