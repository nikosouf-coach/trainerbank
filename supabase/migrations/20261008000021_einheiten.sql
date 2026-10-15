-- =====================================================================
-- Paket A: Mehrere Einheiten am Tag, Torwarttraining, Trainingseindruck.
-- - day_units: weitere Einheiten (Nummer 1–9) für einzelne Tage – festgehalten, geändert, abgesagt oder
--   zusätzlich. Wiederkehrende Einheiten stehen je Wochentag in teams.settings.units (Recht „plan“).
-- - rpe_entries: Einheit (slot, 0 = Mannschaftstraining/Spiel) und Sprünge/Hechtsprünge der Torhüter;
--   Schlüssel (player_id, date, slot). Anwesenheit setzt weiterhin nur die RPE des Mannschaftstrainings.
-- - session_blocks: Ablauf auch für weitere Einheiten (slot)
-- - player_ratings: Trainingseindruck (besonders gut/schwach, Gründe) und Einheit
-- - match_stats: Gegentore und Paraden (Torhüter)
-- - performance_tests: Torwarttests (seitlicher Sprung, Abschlagweite)
-- - merge_players v5 (RPE je Einheit)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Weitere Einheiten für einzelne Tage
-- ---------------------------------------------------------------------
create table if not exists public.day_units (
  team_id    uuid not null references public.teams (id) on delete cascade,
  date       date not null,
  slot       smallint not null check (slot between 1 and 9),
  art        text not null default 'sonst' check (art in ('athletik', 'kraft', 'tw', 'technik', 'taktik', 'praev', 'reha', 'sonst')),
  title      text not null default '' check (char_length(title) <= 60),
  time       text not null default '17:30' check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration   smallint not null default 30 check (duration between 5 and 240),
  target_rpe smallint check (target_rpe is null or target_rpe between 0 and 10),
  -- Gruppe ohne Fremdschlüssel: wird die Gruppe gelöscht, gehört niemand mehr zur Einheit (statt plötzlich alle)
  group_id   uuid,
  staff_id   uuid references public.staff_profiles (id) on delete set null,
  content    text not null default '' check (char_length(content) <= 2000),
  themes     text[] not null default '{}' check (cardinality(themes) <= 8),
  cancelled  boolean not null default false,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, date, slot)
);
create index if not exists day_units_team_date_idx on public.day_units (team_id, date);

-- Gruppe und Trainer müssen zum Team gehören (beim Schreiben); Bearbeiter und Zeitpunkt setzen
create or replace function public.day_units_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  if new.group_id is not null and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id)
     and not exists (select 1 from public.team_groups g where g.id = new.group_id and g.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.staff_id is not null and not exists (select 1 from public.staff_profiles s where s.id = new.staff_id and s.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(new.themes) x where char_length(x) not between 1 and 40) then
    raise exception 'invalid_theme' using errcode = '22023';
  end if;
  new.title := btrim(new.title);
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
revoke all on function public.day_units_prepare() from public, anon, authenticated;
drop trigger if exists day_units_prepare on public.day_units;
create trigger day_units_prepare before insert or update on public.day_units
  for each row execute function public.day_units_prepare();

-- Lesen: Trainerteam alles; Spieler Einheiten für alle bzw. für freigegebene eigene Gruppen
alter table public.day_units enable row level security;
drop policy if exists day_units_select on public.day_units;
create policy day_units_select on public.day_units for select to authenticated
  using (public.is_team_staff(team_id)
         or (public.is_team_member(team_id) and (group_id is null or public.group_visible_to_me(group_id))));
drop policy if exists day_units_insert on public.day_units;
create policy day_units_insert on public.day_units for insert to authenticated
  with check (public.staff_can(team_id, 'plan'));
drop policy if exists day_units_update on public.day_units;
create policy day_units_update on public.day_units for update to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));
drop policy if exists day_units_delete on public.day_units;
create policy day_units_delete on public.day_units for delete to authenticated
  using (public.staff_can(team_id, 'plan'));
grant select, insert, update, delete on public.day_units to authenticated;

-- ---------------------------------------------------------------------
-- RPE je Einheit, Sprünge der Torhüter
-- ---------------------------------------------------------------------
alter table public.rpe_entries add column if not exists slot smallint not null default 0;
alter table public.rpe_entries add column if not exists dives smallint;
do $$ begin
  alter table public.rpe_entries add constraint rpe_entries_slot_check check (slot between 0 and 9);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rpe_entries add constraint rpe_entries_dives_check check (dives is null or dives between 0 and 300);
exception when duplicate_object then null; end $$;
do $$
begin
  if exists (select 1 from pg_constraint c where c.conrelid = 'public.rpe_entries'::regclass and c.contype = 'p' and cardinality(c.conkey) = 2) then
    alter table public.rpe_entries drop constraint rpe_entries_pkey;
    alter table public.rpe_entries add constraint rpe_entries_pkey primary key (player_id, date, slot);
  end if;
end
$$;

-- Anwesenheit „da“ nur über die RPE des Mannschaftstrainings bzw. Spiels (weitere Einheiten sagen nichts über das Training)
create or replace function public.rpe_mark_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  if new.slot <> 0 then
    return null;
  end if;
  select p.team_id into v_team from public.players p where p.id = new.player_id;
  if v_team is not null
     and exists (select 1 from public.sessions s where s.team_id = v_team and s.date = new.date) then
    insert into public.attendance (player_id, date, team_id, status)
    values (new.player_id, new.date, v_team, 'da')
    on conflict (player_id, date) do nothing;
  end if;
  return null;
end;
$$;
create or replace function public.sessions_mark_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.attendance (player_id, date, team_id, status)
  select r.player_id, r.date, new.team_id, 'da'
  from public.rpe_entries r
  join public.players p on p.id = r.player_id
  where p.team_id = new.team_id and r.date = new.date and r.slot = 0
  on conflict (player_id, date) do nothing;
  return null;
end;
$$;
revoke all on function public.rpe_mark_attendance()      from public, anon, authenticated;
revoke all on function public.sessions_mark_attendance() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Ablauf weiterer Einheiten, Trainingseindruck, Torwart-Spieldaten und -Tests
-- ---------------------------------------------------------------------
alter table public.session_blocks add column if not exists slot smallint not null default 0;
do $$ begin
  alter table public.session_blocks add constraint session_blocks_slot_check check (slot between 0 and 9);
exception when duplicate_object then null; end $$;
create index if not exists session_blocks_team_date_slot_idx on public.session_blocks (team_id, date, slot, sort);

alter table public.player_ratings add column if not exists mark text;
alter table public.player_ratings add column if not exists tags text[] not null default '{}';
alter table public.player_ratings add column if not exists slot smallint not null default 0;
do $$ begin
  alter table public.player_ratings add constraint player_ratings_mark_check
    check (mark is null or (mark in ('good', 'poor') and kind = 'training'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.player_ratings add constraint player_ratings_tags_check
    check (cardinality(tags) <= 8 and array_position(tags, null) is null);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.player_ratings add constraint player_ratings_slot_check check (slot between 0 and 9);
exception when duplicate_object then null; end $$;

alter table public.match_stats add column if not exists conceded smallint;
alter table public.match_stats add column if not exists saves smallint;
do $$ begin
  alter table public.match_stats add constraint match_stats_gk_check
    check ((conceded is null or conceded between 0 and 30) and (saves is null or saves between 0 and 60));
exception when duplicate_object then null; end $$;

alter table public.performance_tests drop constraint if exists performance_tests_test_check;
alter table public.performance_tests add constraint performance_tests_test_check
  check (test in ('sprint10', 'sprint30', 'cmj', 'ift', 'yoyo', 'agility505', 'slalom', 'standweit', 'tw_lateral', 'tw_kick'));

-- ---------------------------------------------------------------------
-- Wiederkehrende Einheiten (settings.units) gehören zur Planung (Recht „plan“)
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
      when k in ('days', 'dauer', 'fix', 'spieltag', 'anstoss', 'units') then 'plan'
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
-- merge_players v5: RPE je Einheit (Konflikt nur bei gleichem Tag und gleicher Einheit)
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

  -- Rest (Konfliktzeilen) wird per Cascade mit der neuen Zeile gelöscht.
  -- Hinweis: ein Foto {team_id}/{p_new}.jpg muss die App per Storage-API entfernen.
  delete from public.players where id = p_new;
  return p_existing;
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated, service_role;
