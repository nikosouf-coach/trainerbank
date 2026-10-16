-- =====================================================================
-- Paket C: Spielerentwicklung, messbare Ziele, Wochenchallenge, Individualtraining.
-- - player_assessments: Kompetenzprofil 1–5 je Kompetenz, vom Trainerteam (Freigabe) oder als Selbsteinschätzung
-- - player_goals + goal_entries: messbare Ziele (Test, Statistik, Beteiligung, Zähler, Messwert, Meilensteine)
-- - dev_talks + dev_talk_notes: Entwicklungsgespräche mit Vereinbarungen; interne Notiz in eigener Tabelle (nie für Spieler)
-- - team_challenges + challenge_entries + challenge_totals(): Wochenchallenge, Teamsumme ohne Werte einzelner
--   (Bestenliste nur, wenn settings.challengeRank an)
-- - indiv_requests: Anfragen für Individualtraining; Zusage legt eine Einheit nur für den Spieler an (day_units.player_ids)
-- - Rechte: Entwicklung = „notes“, Challenges und Individualtraining = „plan“
-- - merge_players v6
-- =====================================================================

-- Hilfsfunktion: gehört eine der Spielerzeilen zum angemeldeten Konto?
create or replace function public.my_player_in(p_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.players p where p.user_id = auth.uid() and p.id = any (p_ids))
$$;
revoke all on function public.my_player_in(uuid[]) from public, anon;
grant execute on function public.my_player_in(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Einheiten nur für einzelne Spieler (Individualtraining)
-- ---------------------------------------------------------------------
alter table public.day_units add column if not exists player_ids uuid[] not null default '{}';
do $$ begin
  alter table public.day_units add constraint day_units_player_ids_check check (cardinality(player_ids) <= 30);
exception when duplicate_object then null; end $$;

create or replace function public.day_units_players_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if cardinality(new.player_ids) > 0 and exists (
    select 1 from unnest(new.player_ids) x where public.player_team(x) is distinct from new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.day_units_players_check() from public, anon, authenticated;
drop trigger if exists day_units_players_check on public.day_units;
create trigger day_units_players_check before insert or update on public.day_units
  for each row execute function public.day_units_players_check();

drop policy if exists day_units_select on public.day_units;
create policy day_units_select on public.day_units for select to authenticated
  using (public.is_team_staff(team_id)
         or (public.is_team_member(team_id) and case
               when cardinality(player_ids) > 0 then public.my_player_in(player_ids)
               else (group_id is null or public.group_visible_to_me(group_id)) end));

-- ---------------------------------------------------------------------
-- Kompetenzprofil
-- ---------------------------------------------------------------------
-- Werte 1–5 je Kompetenz (Schlüssel aus core/dev), höchstens 40 Einträge
create or replace function public.scores_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'object'
     and (select count(*) from jsonb_object_keys(p)) <= 40
     and not exists (
       select 1 from jsonb_each(p) e
        where e.key !~ '^[a-z0-9_]{2,24}$' or jsonb_typeof(e.value) <> 'number'
           or (e.value)::text !~ '^[1-5]$')
$$;

create table if not exists public.player_assessments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  date       date not null default current_date,
  by_player  boolean not null default false,
  scores     jsonb not null default '{}'::jsonb check (public.scores_ok(scores)),
  note       text check (note is null or char_length(note) <= 2000),
  visible    boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists player_assessments_player_idx on public.player_assessments (player_id, date);

-- ---------------------------------------------------------------------
-- Entwicklungsgespräche (vor den Zielen, die darauf verweisen)
-- ---------------------------------------------------------------------
create table if not exists public.dev_talks (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  date        date not null default current_date,
  kind        text not null default 'event' check (kind in ('start', 'mid', 'end', 'event')),
  player_view text check (player_view is null or char_length(player_view) <= 4000),
  strengths   text check (strengths is null or char_length(strengths) <= 4000),
  focus       text check (focus is null or char_length(focus) <= 4000),
  agreements  jsonb not null default '[]'::jsonb check (jsonb_typeof(agreements) = 'array' and jsonb_array_length(agreements) <= 20 and pg_column_size(agreements) <= 12000),
  next_date   date,
  visible     boolean not null default false,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists dev_talks_player_idx on public.dev_talks (player_id, date);
-- interne Notiz zum Gespräch: nur Trainerteam (eigene Tabelle, damit sie nie mit dem Protokoll an Spieler geht)
create table if not exists public.dev_talk_notes (
  talk_id    uuid primary key references public.dev_talks (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  text       text not null check (char_length(text) <= 4000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ziele
-- ---------------------------------------------------------------------
create table if not exists public.player_goals (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  area         text not null default 'tech' check (area in ('tech', 'takt', 'ath', 'ment')),
  kind         text not null default 'process' check (kind in ('process', 'perf', 'outcome')),
  metric       text not null default 'count' check (metric in ('test', 'stat', 'att', 'count', 'value', 'check')),
  unit         text not null default '' check (char_length(unit) <= 20),
  start_value  numeric(10, 2),
  target_value numeric(10, 2),
  lower_better boolean not null default false,
  test         text check (test is null or test in ('sprint10', 'sprint30', 'cmj', 'ift', 'yoyo', 'agility505', 'slalom', 'standweit', 'tw_lateral', 'tw_kick')),
  stat         text check (stat is null or stat in ('goals', 'assists', 'minutes', 'games', 'starts', 'clean')),
  date_from    date not null default current_date,
  due          date,
  why          text check (why is null or char_length(why) <= 1000),
  steps        jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 10 and pg_column_size(steps) <= 4000),
  status       text not null default 'active' check (status in ('active', 'done', 'missed', 'dropped')),
  visible      boolean not null default true,
  by_player    boolean not null default false,
  talk_id      uuid references public.dev_talks (id) on delete set null,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((metric = 'test') = (test is not null)),
  check ((metric = 'stat') = (stat is not null)),
  check (due is null or due >= date_from)
);
create index if not exists player_goals_player_idx on public.player_goals (player_id, status);

create table if not exists public.goal_entries (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.player_goals (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  date       date not null default current_date,
  value      numeric(10, 2) not null check (value between -100000 and 100000),
  note       text check (note is null or char_length(note) <= 500),
  by_player  boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists goal_entries_goal_idx on public.goal_entries (goal_id, date);

-- ---------------------------------------------------------------------
-- Wochenchallenge
-- ---------------------------------------------------------------------
create table if not exists public.team_challenges (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  week_start   date not null check (extract(isodow from week_start) = 1),
  title        text not null check (char_length(btrim(title)) between 1 and 80),
  text         text not null default '' check (char_length(text) <= 600),
  kind         text not null default 'best' check (kind in ('best', 'count', 'days', 'check')),
  unit         text not null default '' check (char_length(unit) <= 12),
  target       numeric(10, 2) check (target is null or target > 0),
  team_target  numeric(12, 2) check (team_target is null or team_target > 0),
  lower_better boolean not null default false,
  group_id     uuid,
  key          text check (key is null or key ~ '^[A-Za-z0-9_]{2,30}$'),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists team_challenges_team_week_idx on public.team_challenges (team_id, week_start);

create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.team_challenges (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  value        numeric(10, 2) check (value is null or value between 0 and 100000),
  days         date[] not null default '{}' check (cardinality(days) <= 7),
  done         boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (challenge_id, player_id)
);
create index if not exists challenge_entries_player_idx on public.challenge_entries (player_id);

-- ---------------------------------------------------------------------
-- Individualtraining
-- ---------------------------------------------------------------------
create table if not exists public.indiv_requests (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  topic       text not null default 'sonst' check (topic in ('technik', 'schuss', 'kopf', 'schwach', 'athletik', 'tw', 'taktik', 'video', 'reha', 'mental', 'sonst')),
  note        text not null default '' check (char_length(note) <= 1000),
  wish        text not null default '' check (char_length(wish) <= 300),
  status      text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled')),
  answer      text not null default '' check (char_length(answer) <= 1000),
  unit_date   date,
  unit_slot   smallint check (unit_slot is null or unit_slot between 1 and 9),
  staff_id    uuid references public.staff_profiles (id) on delete set null,
  answered_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists indiv_requests_team_idx on public.indiv_requests (team_id, status);

-- ---------------------------------------------------------------------
-- Trigger: Team aus dem Spieler, Wächter für Änderungen durch Spieler
-- ---------------------------------------------------------------------
create or replace function public.dev_rows_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_staff boolean;
begin
  new.team_id := public.player_team(new.player_id);
  if new.team_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if tg_op = 'UPDATE' and new.player_id <> old.player_id and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_staff := current_user not in ('authenticated', 'anon') or public.is_team_staff(new.team_id);
  if tg_table_name = 'player_assessments' then
    -- Spieler legen nur Selbsteinschätzungen an; die sieht der Spieler immer
    if not v_staff then new.by_player := true; new.visible := true; end if;
  elsif tg_table_name = 'player_goals' then
    if not v_staff then
      if tg_op = 'INSERT' then
        new.by_player := true; new.visible := true; new.talk_id := null;
      elsif not old.by_player then
        -- Ziele des Trainerteams: Spieler haken nur Schritte ab (Text und alles andere bleibt)
        if (new.title, new.area, new.kind, new.metric, new.unit, new.start_value, new.target_value, new.lower_better, new.test, new.stat,
            new.date_from, new.due, new.why, new.status, new.visible, new.by_player, new.talk_id)
           is distinct from
           (old.title, old.area, old.kind, old.metric, old.unit, old.start_value, old.target_value, old.lower_better, old.test, old.stat,
            old.date_from, old.due, old.why, old.status, old.visible, old.by_player, old.talk_id)
           or jsonb_array_length(new.steps) <> jsonb_array_length(old.steps)
           or exists (select 1 from jsonb_array_elements(new.steps) with ordinality n(e, i)
                        join jsonb_array_elements(old.steps) with ordinality o(e, i) using (i)
                       where n.e ->> 'text' is distinct from o.e ->> 'text') then
          raise exception 'forbidden: players only tick steps' using errcode = '42501';
        end if;
      else
        new.by_player := true; new.visible := true; new.talk_id := old.talk_id;
      end if;
    end if;
    new.updated_at := now();
  elsif tg_table_name = 'dev_talks' then
    new.updated_at := now();
  elsif tg_table_name = 'indiv_requests' then
    if not v_staff then
      if tg_op = 'INSERT' then
        if coalesce((select (t.settings ->> 'indivReq')::boolean from public.teams t where t.id = new.team_id), true) is false then
          raise exception 'indiv_off' using errcode = 'P0001';
        end if;
        if (select count(*) from public.indiv_requests r where r.player_id = new.player_id and r.status = 'open') >= 2 then
          raise exception 'limit' using errcode = 'P0001', detail = 'open_requests';
        end if;
        new.status := 'open'; new.answer := ''; new.unit_date := null; new.unit_slot := null; new.staff_id := null; new.answered_by := null;
      else
        -- Spieler ziehen offene Anfragen nur zurück
        if not (old.status = 'open' and new.status = 'cancelled')
           or (new.topic, new.note, new.wish, new.answer, new.unit_date, new.unit_slot, new.staff_id, new.answered_by)
              is distinct from (old.topic, old.note, old.wish, old.answer, old.unit_date, old.unit_slot, old.staff_id, old.answered_by) then
          raise exception 'forbidden' using errcode = '42501';
        end if;
      end if;
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('accepted', 'declined') then
      new.answered_by := coalesce(auth.uid(), new.answered_by);
    end if;
    if new.staff_id is not null and not exists (select 1 from public.staff_profiles s where s.id = new.staff_id and s.team_id = new.team_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.dev_rows_prepare() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['player_assessments', 'player_goals', 'dev_talks', 'indiv_requests'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_prepare', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.dev_rows_prepare()', t || '_prepare', t);
  end loop;
end
$$;

-- Fortschritt: Team und Spieler aus dem Ziel; Spieler nur für eigene sichtbare Ziele
create or replace function public.goal_entries_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  g public.player_goals;
begin
  select * into g from public.player_goals where id = new.goal_id;
  if g.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  new.team_id := g.team_id; new.player_id := g.player_id;
  if current_user in ('authenticated', 'anon') and not public.is_team_staff(g.team_id) then
    if not (public.is_own_player(g.player_id) and (g.visible or g.by_player)) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    new.by_player := true;
  end if;
  return new;
end;
$$;
revoke all on function public.goal_entries_prepare() from public, anon, authenticated;
drop trigger if exists goal_entries_prepare on public.goal_entries;
create trigger goal_entries_prepare before insert or update on public.goal_entries
  for each row execute function public.goal_entries_prepare();

create or replace function public.dev_talk_notes_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select t.team_id into new.team_id from public.dev_talks t where t.id = new.talk_id;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.dev_talk_notes_prepare() from public, anon, authenticated;
drop trigger if exists dev_talk_notes_prepare on public.dev_talk_notes;
create trigger dev_talk_notes_prepare before insert or update on public.dev_talk_notes
  for each row execute function public.dev_talk_notes_prepare();

-- Challenge-Einträge: Team aus dem Spieler; Challenge muss zum Team gehören und darf höchstens 13 Tage zurückliegen
create or replace function public.challenge_entries_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c public.team_challenges;
begin
  select * into c from public.team_challenges where id = new.challenge_id;
  new.team_id := public.player_team(new.player_id);
  if c.id is null or new.team_id is distinct from c.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if current_user in ('authenticated', 'anon') and not public.is_team_staff(c.team_id) then
    if c.week_start < current_date - 13 or c.week_start > current_date + 6 then
      raise exception 'challenge_closed' using errcode = 'P0001';
    end if;
    if c.group_id is not null and not public.group_visible_to_me(c.group_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if exists (select 1 from unnest(new.days) d where d < c.week_start or d > c.week_start + 6) then
    raise exception 'invalid_day' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.challenge_entries_prepare() from public, anon, authenticated;
drop trigger if exists challenge_entries_prepare on public.challenge_entries;
create trigger challenge_entries_prepare before insert or update on public.challenge_entries
  for each row execute function public.challenge_entries_prepare();

create or replace function public.team_challenges_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.group_id is not null and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id)
     and not exists (select 1 from public.team_groups g where g.id = new.group_id and g.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.team_challenges_prepare() from public, anon, authenticated;
drop trigger if exists team_challenges_prepare on public.team_challenges;
create trigger team_challenges_prepare before insert or update on public.team_challenges
  for each row execute function public.team_challenges_prepare();

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.player_assessments enable row level security;
alter table public.dev_talks          enable row level security;
alter table public.dev_talk_notes     enable row level security;
alter table public.player_goals       enable row level security;
alter table public.goal_entries       enable row level security;
alter table public.team_challenges    enable row level security;
alter table public.challenge_entries  enable row level security;
alter table public.indiv_requests     enable row level security;

drop policy if exists player_assessments_select on public.player_assessments;
create policy player_assessments_select on public.player_assessments for select to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and (by_player or visible)));
drop policy if exists player_assessments_insert on public.player_assessments;
create policy player_assessments_insert on public.player_assessments for insert to authenticated
  with check (public.staff_can_player(player_id, 'notes') or public.is_own_player(player_id));
drop policy if exists player_assessments_update on public.player_assessments;
create policy player_assessments_update on public.player_assessments for update to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and by_player))
  with check (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and by_player));
drop policy if exists player_assessments_delete on public.player_assessments;
create policy player_assessments_delete on public.player_assessments for delete to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and by_player));

drop policy if exists dev_talks_select on public.dev_talks;
create policy dev_talks_select on public.dev_talks for select to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and visible));
drop policy if exists dev_talks_write on public.dev_talks;
create policy dev_talks_write on public.dev_talks for all to authenticated
  using (public.staff_can(team_id, 'notes')) with check (public.staff_can_player(player_id, 'notes'));
drop policy if exists dev_talk_notes_all on public.dev_talk_notes;
create policy dev_talk_notes_all on public.dev_talk_notes for all to authenticated
  using (public.staff_can(team_id, 'notes'))
  with check (exists (select 1 from public.dev_talks t where t.id = talk_id and public.staff_can(t.team_id, 'notes')));

drop policy if exists player_goals_select on public.player_goals;
create policy player_goals_select on public.player_goals for select to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and (visible or by_player)));
drop policy if exists player_goals_insert on public.player_goals;
create policy player_goals_insert on public.player_goals for insert to authenticated
  with check (public.staff_can_player(player_id, 'notes') or public.is_own_player(player_id));
drop policy if exists player_goals_update on public.player_goals;
create policy player_goals_update on public.player_goals for update to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and (visible or by_player)))
  with check (public.staff_can(team_id, 'notes') or public.is_own_player(player_id));
drop policy if exists player_goals_delete on public.player_goals;
create policy player_goals_delete on public.player_goals for delete to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and by_player));

drop policy if exists goal_entries_select on public.goal_entries;
create policy goal_entries_select on public.goal_entries for select to authenticated
  using (public.staff_can(team_id, 'notes') or public.is_own_player(player_id));
drop policy if exists goal_entries_insert on public.goal_entries;
create policy goal_entries_insert on public.goal_entries for insert to authenticated
  with check (public.staff_can(team_id, 'notes') or public.is_own_player(player_id));
drop policy if exists goal_entries_delete on public.goal_entries;
create policy goal_entries_delete on public.goal_entries for delete to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and created_by = auth.uid()));

drop policy if exists team_challenges_select on public.team_challenges;
create policy team_challenges_select on public.team_challenges for select to authenticated
  using (public.is_team_staff(team_id) or (public.is_team_member(team_id) and (group_id is null or public.group_visible_to_me(group_id))));
drop policy if exists team_challenges_write on public.team_challenges;
create policy team_challenges_write on public.team_challenges for all to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));

drop policy if exists challenge_entries_select on public.challenge_entries;
create policy challenge_entries_select on public.challenge_entries for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));
drop policy if exists challenge_entries_write on public.challenge_entries;
create policy challenge_entries_write on public.challenge_entries for all to authenticated
  using (public.staff_can(team_id, 'plan') or public.is_own_player(player_id))
  with check (public.staff_can_player(player_id, 'plan') or public.is_own_player(player_id));

drop policy if exists indiv_requests_select on public.indiv_requests;
create policy indiv_requests_select on public.indiv_requests for select to authenticated
  using (public.staff_can(team_id, 'plan') or public.is_own_player(player_id));
drop policy if exists indiv_requests_insert on public.indiv_requests;
create policy indiv_requests_insert on public.indiv_requests for insert to authenticated
  with check (public.is_own_player(player_id) or public.staff_can_player(player_id, 'plan'));
drop policy if exists indiv_requests_update on public.indiv_requests;
create policy indiv_requests_update on public.indiv_requests for update to authenticated
  using (public.staff_can(team_id, 'plan') or public.is_own_player(player_id))
  with check (public.staff_can(team_id, 'plan') or public.is_own_player(player_id));
drop policy if exists indiv_requests_delete on public.indiv_requests;
create policy indiv_requests_delete on public.indiv_requests for delete to authenticated
  using (public.staff_can(team_id, 'plan'));

grant select, insert, update, delete on public.player_assessments, public.dev_talks, public.dev_talk_notes, public.player_goals,
  public.goal_entries, public.team_challenges, public.challenge_entries, public.indiv_requests to authenticated;

-- ---------------------------------------------------------------------
-- Teamsummen der Challenges (Spieler sehen keine Werte einzelner; Bestenliste nur, wenn eingeschaltet)
-- ---------------------------------------------------------------------
create or replace function public.challenge_totals(p_team uuid, p_week date)
returns table (challenge_id uuid, players integer, done integer, total numeric, top jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rank boolean;
begin
  if not public.is_team_member(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce((t.settings ->> 'challengeRank')::boolean, false) into v_rank from public.teams t where t.id = p_team;
  return query
  select c.id, count(e.player_id)::int, count(*) filter (where e.done)::int, coalesce(sum(e.value), 0)::numeric,
         case when v_rank and c.kind = 'best' then coalesce((
           select jsonb_agg(jsonb_build_object('name', x.name, 'value', x.value) order by x.rn)
             from (select p.first_name || coalesce(' ' || left(p.last_name, 1) || '.', '') as name, e2.value,
                          row_number() over (order by case when c.lower_better then e2.value else -e2.value end) as rn
                     from public.challenge_entries e2 join public.players p on p.id = e2.player_id and p.active
                    where e2.challenge_id = c.id and e2.value is not null) x
            where x.rn <= 3), '[]'::jsonb) else '[]'::jsonb end
    from public.team_challenges c
    left join public.challenge_entries e on e.challenge_id = c.id
   where c.team_id = p_team and c.week_start = p_week
     and (c.group_id is null or public.is_team_staff(p_team) or public.group_visible_to_me(c.group_id))
   group by c.id, c.kind, c.lower_better;
end;
$$;
revoke all on function public.challenge_totals(uuid, date) from public, anon;
grant execute on function public.challenge_totals(uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Team-Einstellungen: Individualtraining-Anfragen und Bestenliste gehören zur Planung; Chat zu admin
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
      when k in ('days', 'dauer', 'fix', 'spieltag', 'anstoss', 'units', 'indivReq', 'challengeRank') then 'plan'
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

-- ---------------------------------------------------------------------
-- merge_players v6: Entwicklung, Challenges, Individualtraining
-- ---------------------------------------------------------------------
create or replace function public.merge_players(p_new uuid, p_existing uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new public.players;
  v_old public.players;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_new is null or p_existing is null or p_new = p_existing then
    raise exception 'invalid_merge' using errcode = '22023';
  end if;

  -- Beide Zeilen sperren (feste Reihenfolge gegen Deadlocks)
  perform 1 from public.players where id in (p_new, p_existing) order by id for update;
  select * into v_new from public.players where id = p_new;
  select * into v_old from public.players where id = p_existing;
  if v_new.id is null or v_old.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (public.is_team_staff(v_new.team_id) and public.is_team_staff(v_old.team_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_new.team_id <> v_old.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if v_old.user_id is not null then
    raise exception 'already_linked' using errcode = '22023';
  end if;
  if v_new.user_id is null then
    raise exception 'not_linked' using errcode = '22023';
  end if;

  -- Konto umhängen (erst lösen wegen unique(team_id, user_id)); leere Stammdaten ergänzen
  update public.players set user_id = null where id = p_new;
  update public.players p
     set user_id      = v_new.user_id,
         is_new       = false,
         birthdate    = coalesce(p.birthdate, v_new.birthdate),
         position     = coalesce(p.position, v_new.position),
         shirt_number = coalesce(p.shirt_number, v_new.shirt_number),
         weight_kg    = coalesce(p.weight_kg, v_new.weight_kg)
   where p.id = p_existing;

  -- Tabellen mit Schlüssel (player_id, date): nur verschieben, wenn kein Konflikt
  -- RPE je Einheit des Tages (0 = Mannschaftstraining, 1–9 = weitere Einheit)
  update public.rpe_entries r set player_id = p_existing
   where r.player_id = p_new
     and not exists (select 1 from public.rpe_entries x where x.player_id = p_existing and x.date = r.date and x.slot = r.slot);
  update public.wellness_entries w set player_id = p_existing
   where w.player_id = p_new
     and not exists (select 1 from public.wellness_entries x where x.player_id = p_existing and x.date = w.date);
  update public.attendance a set player_id = p_existing
   where a.player_id = p_new
     and not exists (select 1 from public.attendance x where x.player_id = p_existing and x.date = a.date);
  update public.coach_notes n set player_id = p_existing
   where n.player_id = p_new
     and not exists (select 1 from public.coach_notes x where x.player_id = p_existing);

  -- Tabellen mit eigener id: vollständig verschieben
  update public.extra_activities    set player_id = p_existing where player_id = p_new;
  update public.absences            set player_id = p_existing where player_id = p_new;
  update public.growth_measurements set player_id = p_existing where player_id = p_new;
  update public.potentials          set player_id = p_existing where player_id = p_new;
  update public.coach_messages      set player_id = p_existing where player_id = p_new;
  update public.consents            set player_id = p_existing where player_id = p_new;

  -- Spieldaten, Noten, Leistungstests, Befunde (Baustein 4–6)
  update public.match_stats s set player_id = p_existing
   where s.player_id = p_new
     and not exists (select 1 from public.match_stats x where x.player_id = p_existing and x.match_id = s.match_id);
  update public.player_ratings    set player_id = p_existing where player_id = p_new;
  update public.performance_tests set player_id = p_existing where player_id = p_new;
  -- Befunde behalten ihren Speicherpfad (Ordner der alten Zeile); Zugriff regelt finding_row_role()
  update public.findings          set player_id = p_existing where player_id = p_new;
  update public.videos set player_ids = array_replace(player_ids, p_new, p_existing) where p_new = any (player_ids);

  -- Gruppen, Aufgaben, Dienste, Strafen (Pakete 3 und 7)
  update public.group_members g set player_id = p_existing
   where g.player_id = p_new
     and not exists (select 1 from public.group_members x where x.player_id = p_existing and x.group_id = g.group_id);
  update public.team_tasks set player_id = p_existing where player_id = p_new;
  update public.team_fines f set player_id = p_existing
   where f.player_id = p_new
     and (f.ref_date is null or not exists (select 1 from public.team_fines x where x.player_id = p_existing and x.rule = f.rule and x.ref_date = f.ref_date));
  update public.team_duties d set player_id = p_existing
   where d.player_id = p_new
     and not exists (select 1 from public.team_duties x where x.player_id = p_existing and x.date = d.date and x.duty = d.duty);

  -- Mannschaftskasse (Paket 11.3): Zahlungen und Befreiungen übernehmen. Zahlungen für Strafen, die als Doppelung
  -- bei der neuen Zeile bleiben (und mit ihr gelöscht werden), verlieren nur den Verweis – die Buchung bleibt.
  update public.cash_entries c set fine_id = null
   where c.player_id = p_new and c.fine_id in (select f.id from public.team_fines f where f.player_id = p_new);
  update public.cash_entries c set player_id = p_existing
   where c.player_id = p_new
     and (c.fee_id is null or not exists (select 1 from public.cash_entries x where x.player_id = p_existing and x.fee_id = c.fee_id and x.period = c.period));
  update public.cash_entries set player_id = null where player_id = p_new;
  insert into public.cash_waivers (team_id, player_id, fee_id, period)
  select w.team_id, p_existing, w.fee_id, w.period from public.cash_waivers w where w.player_id = p_new
  on conflict do nothing;

  -- Spielerentwicklung, Wochenchallenge, Individualtraining (Paket C)
  update public.player_assessments set player_id = p_existing where player_id = p_new;
  update public.player_goals       set player_id = p_existing where player_id = p_new;
  update public.goal_entries       set player_id = p_existing where player_id = p_new;
  update public.dev_talks          set player_id = p_existing where player_id = p_new;
  update public.indiv_requests     set player_id = p_existing where player_id = p_new;
  update public.challenge_entries c set player_id = p_existing
   where c.player_id = p_new
     and not exists (select 1 from public.challenge_entries x where x.player_id = p_existing and x.challenge_id = c.challenge_id);
  update public.day_units set player_ids = array_replace(player_ids, p_new, p_existing) where p_new = any (player_ids);

  -- Rest (Konfliktzeilen) wird per Cascade mit der neuen Zeile gelöscht.
  -- Hinweis: ein Foto {team_id}/{p_new}.jpg muss die App per Storage-API entfernen.
  delete from public.players where id = p_new;
  return p_existing;
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated, service_role;
