-- =====================================================================
-- Individuelles Entwicklungsprogramm – Herzstück der Spielerentwicklung
-- - dev_programs: ein Programm je Spieler (content: Motto, X-Faktor, Situationen „So mache ich den Unterschied“,
--   stärkster Bereich, Improve-Felder mit Ort und Hilfe, Sicht des Trainerteams, ausgewählte Mitspieler-Stärken);
--   Trainerteam mit „notes“, Spieler lesen nur das eigene freigegebene Programm
-- - dev_self: Selbstanalyse des Spielers (Waffen und weitere Stärken – nur Schlüssel aus dem Katalog der App)
-- - dev_peer_skills: Stärken-Runde – Spieler schenken Mitspielern 1–3 Stärken aus dem Katalog (nur positiv, kein
--   Freitext). Lesen: Trainerteam mit „notes“ und der Schenkende; Empfänger sehen keine Einträge, nur was das
--   Trainerteam ins Programm übernimmt. Schreiben nur während einer Runde (teams.settings.peer = {since, until})
-- - peer_targets(team): Mitspieler für die Runde (Vorname, Initial, Rückennummer, Position)
-- - match_stats.pre_assists
-- - teams_perm_guard: settings.peer braucht „notes“; merge_players v8; my_data_export v9;
--   Löschfrist der Stärken-Runde 12 Monate (purge_old_peer_skills)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pre-Assists in den Spieldaten
-- ---------------------------------------------------------------------
alter table public.match_stats add column if not exists pre_assists smallint;
do $$ begin
  alter table public.match_stats add constraint match_stats_pre_assists_check check (pre_assists is null or pre_assists between 0 and 20);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Prüfungen
-- ---------------------------------------------------------------------
-- Stärken-Schlüssel aus dem Katalog der App (core/program → SKILLS): Format wie dort, ohne Doppelungen
create or replace function public.skill_keys_ok(p text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(k ~ '^[a-z0-9_]{2,24}$'), true) and count(*) = count(distinct k)
    from unnest(coalesce(p, '{}'::text[])) k
$$;

-- Inhalt eines Programms: Objekt, höchstens 16 KB, Listen in den Grenzen der App
create or replace function public.dev_program_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'object'
     and pg_column_size(p) <= 16000
     and coalesce((select bool_and(case when p ? x.k then jsonb_typeof(p -> x.k) = 'array' and jsonb_array_length(p -> x.k) <= x.n else true end)
                     from (values ('xf', 3), ('sit', 3), ('zones', 15), ('improve', 4), ('peers', 5)) x(k, n)), true)
     and (not (p ? 'tag') or (jsonb_typeof(p -> 'tag') = 'string' and char_length(p ->> 'tag') <= 24))
$$;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table if not exists public.dev_programs (
  player_id    uuid primary key references public.players (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  content      jsonb not null default '{}'::jsonb check (public.dev_program_ok(content)),
  visible      boolean not null default false,
  published_at timestamptz,
  updated_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dev_programs_team_idx on public.dev_programs (team_id);

create table if not exists public.dev_self (
  player_id  uuid primary key references public.players (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  weapons    text[] not null default '{}' check (cardinality(weapons) <= 3 and public.skill_keys_ok(weapons)),
  skills     text[] not null default '{}' check (cardinality(skills) <= 3 and public.skill_keys_ok(skills)),
  updated_at timestamptz not null default now(),
  check (not (weapons && skills))
);
create index if not exists dev_self_team_idx on public.dev_self (team_id);

create table if not exists public.dev_peer_skills (
  giver_id   uuid not null references public.players (id) on delete cascade,
  target_id  uuid not null references public.players (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  skills     text[] not null check (cardinality(skills) between 1 and 3 and public.skill_keys_ok(skills)),
  updated_at timestamptz not null default now(),
  primary key (giver_id, target_id),
  check (giver_id <> target_id)
);
create index if not exists dev_peer_skills_target_idx on public.dev_peer_skills (target_id);
create index if not exists dev_peer_skills_team_idx on public.dev_peer_skills (team_id, updated_at);

-- ---------------------------------------------------------------------
-- Stärken-Runde: läuft sie heute (Datum in der Zeitzone des Teams)? Ungültige Einstellung = keine Runde
-- ---------------------------------------------------------------------
create or replace function public.peer_round_open(p_team uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_peer  jsonb;
  v_tz    text;
  v_today date;
begin
  select t.settings -> 'peer', t.timezone into v_peer, v_tz from public.teams t where t.id = p_team;
  if v_peer is null or jsonb_typeof(v_peer) <> 'object' then
    return false;
  end if;
  v_today := (now() at time zone coalesce(nullif(v_tz, ''), 'Europe/Berlin'))::date;
  return (v_peer ->> 'since')::date <= v_today and v_today <= (v_peer ->> 'until')::date;
exception when others then
  return false;
end;
$$;
revoke all on function public.peer_round_open(uuid) from public, anon;
grant execute on function public.peer_round_open(uuid) to authenticated, service_role;

-- Empfänger: aktiver Spieler im selben Team (Spieler lesen fremde Spielerzeilen nicht – daher security definer)
create or replace function public.peer_target_ok(p_target uuid, p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.players p where p.id = p_target and p.team_id = p_team and p.active)
$$;
revoke all on function public.peer_target_ok(uuid, uuid) from public, anon;
grant execute on function public.peer_target_ok(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Trigger: Team aus dem Spieler, Freigabezeitpunkt, Runde und Team bei der Stärken-Runde
-- ---------------------------------------------------------------------
create or replace function public.dev_programs_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.player_id <> old.player_id and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  new.team_id := public.player_team(new.player_id);
  if new.team_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  -- „aktualisiert am“ für den Spieler: beim Freigeben und bei jeder Änderung eines freigegebenen Programms
  if new.visible and (tg_op = 'INSERT' or not old.visible or new.content is distinct from old.content) then
    new.published_at := now();
  elsif tg_op = 'UPDATE' then
    new.published_at := old.published_at;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.dev_programs_prepare() from public, anon, authenticated;
drop trigger if exists dev_programs_prepare on public.dev_programs;
create trigger dev_programs_prepare before insert or update on public.dev_programs
  for each row execute function public.dev_programs_prepare();

create or replace function public.dev_self_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.player_id <> old.player_id and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  new.team_id := public.player_team(new.player_id);
  if new.team_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.dev_self_prepare() from public, anon, authenticated;
drop trigger if exists dev_self_prepare on public.dev_self;
create trigger dev_self_prepare before insert or update on public.dev_self
  for each row execute function public.dev_self_prepare();

create or replace function public.dev_peer_skills_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.giver_id, new.target_id) is distinct from (old.giver_id, old.target_id)
     and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  new.team_id := public.player_team(new.giver_id);
  if new.team_id is null or not public.peer_target_ok(new.target_id, new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  -- Spieler schenken nur während einer Runde (Trainerteam und Server, z. B. merge_players, jederzeit)
  if current_user in ('authenticated', 'anon') and not public.is_team_staff(new.team_id) and not public.peer_round_open(new.team_id) then
    raise exception 'peer_closed' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.dev_peer_skills_prepare() from public, anon, authenticated;
drop trigger if exists dev_peer_skills_prepare on public.dev_peer_skills;
create trigger dev_peer_skills_prepare before insert or update on public.dev_peer_skills
  for each row execute function public.dev_peer_skills_prepare();

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.dev_programs    enable row level security;
alter table public.dev_self        enable row level security;
alter table public.dev_peer_skills enable row level security;

drop policy if exists dev_programs_select on public.dev_programs;
create policy dev_programs_select on public.dev_programs for select to authenticated
  using (public.staff_can(team_id, 'notes') or (public.is_own_player(player_id) and visible));
drop policy if exists dev_programs_insert on public.dev_programs;
create policy dev_programs_insert on public.dev_programs for insert to authenticated
  with check (public.staff_can_player(player_id, 'notes'));
drop policy if exists dev_programs_update on public.dev_programs;
create policy dev_programs_update on public.dev_programs for update to authenticated
  using (public.staff_can(team_id, 'notes')) with check (public.staff_can_player(player_id, 'notes'));
drop policy if exists dev_programs_delete on public.dev_programs;
create policy dev_programs_delete on public.dev_programs for delete to authenticated
  using (public.staff_can(team_id, 'notes'));

drop policy if exists dev_self_select on public.dev_self;
create policy dev_self_select on public.dev_self for select to authenticated
  using (public.staff_can(team_id, 'notes') or public.is_own_player(player_id));
drop policy if exists dev_self_insert on public.dev_self;
create policy dev_self_insert on public.dev_self for insert to authenticated
  with check (public.is_own_player(player_id));
drop policy if exists dev_self_update on public.dev_self;
create policy dev_self_update on public.dev_self for update to authenticated
  using (public.is_own_player(player_id)) with check (public.is_own_player(player_id));
drop policy if exists dev_self_delete on public.dev_self;
create policy dev_self_delete on public.dev_self for delete to authenticated
  using (public.is_own_player(player_id) or public.staff_can(team_id, 'notes'));

drop policy if exists dev_peer_skills_select on public.dev_peer_skills;
create policy dev_peer_skills_select on public.dev_peer_skills for select to authenticated
  using (public.staff_can(team_id, 'notes') or public.is_own_player(giver_id));
drop policy if exists dev_peer_skills_insert on public.dev_peer_skills;
create policy dev_peer_skills_insert on public.dev_peer_skills for insert to authenticated
  with check (public.is_own_player(giver_id));
drop policy if exists dev_peer_skills_update on public.dev_peer_skills;
create policy dev_peer_skills_update on public.dev_peer_skills for update to authenticated
  using (public.is_own_player(giver_id)) with check (public.is_own_player(giver_id));
drop policy if exists dev_peer_skills_delete on public.dev_peer_skills;
create policy dev_peer_skills_delete on public.dev_peer_skills for delete to authenticated
  using (public.is_own_player(giver_id) or public.staff_can(team_id, 'notes'));

grant select, insert, update, delete on public.dev_programs, public.dev_self, public.dev_peer_skills to authenticated;

-- ---------------------------------------------------------------------
-- Mitspieler für die Stärken-Runde: nur Mitglieder mit eigener Spielerzeile, nur während einer Runde;
-- Vorname, Initial des Nachnamens, Rückennummer, Position – keine weiteren Daten
-- ---------------------------------------------------------------------
create or replace function public.peer_targets(p_team uuid)
returns table (id uuid, first_name text, last_initial text, shirt_number integer, pos text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.first_name, left(coalesce(p.last_name, ''), 1), p.shirt_number::integer, p.position
    from public.players p
   where p.team_id = p_team and p.active
     and p.user_id is distinct from auth.uid()
     and exists (select 1 from public.players me where me.team_id = p_team and me.user_id = auth.uid() and me.active)
     and public.peer_round_open(p_team)
   order by p.shirt_number nulls last, p.first_name, p.last_name
$$;
revoke all on function public.peer_targets(uuid) from public, anon;
grant execute on function public.peer_targets(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Team-Einstellungen: Stärken-Runde gehört zu „notes“ (sonst wie 20261008000029)
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
      when k in ('tests', 'testRank', 'customTests') then 'perf'
      when k = 'kasse' then 'cash'
      when k = 'peer' then 'notes'
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
-- merge_players v8: zusätzlich Entwicklungsprogramm, Selbstanalyse und Stärken-Runde (sonst wie v7, 20261008000024)
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

  -- Entwicklungsprogramm: Programm und Selbstanalyse nur übernehmen, wenn die bestehende Zeile keins hat; Stärken-Runde
  -- als Schenkender und Empfänger (ohne Doppelungen und ohne Einträge an sich selbst)
  update public.dev_programs set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.dev_programs x where x.player_id = p_existing);
  update public.dev_self set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.dev_self x where x.player_id = p_existing);
  delete from public.dev_peer_skills
   where (giver_id = p_new and target_id = p_existing) or (giver_id = p_existing and target_id = p_new);
  update public.dev_peer_skills g set giver_id = p_existing
   where g.giver_id = p_new
     and not exists (select 1 from public.dev_peer_skills x where x.giver_id = p_existing and x.target_id = g.target_id);
  update public.dev_peer_skills g set target_id = p_existing
   where g.target_id = p_new
     and not exists (select 1 from public.dev_peer_skills x where x.target_id = p_existing and x.giver_id = g.giver_id);

  -- Matchplan (Paket B): Zugriffsprotokoll, Kader der Freigabe, Spieler-IDs in Aufstellung, Folien, Aufgaben und Wechseln
  update public.match_plan_views set player_id = p_existing where player_id = p_new;
  update public.match_plans set squad = array_replace(squad, p_new, p_existing) where p_new = any (squad);
  update public.match_plans
     set content   = replace(content::text, p_new::text, p_existing::text)::jsonb,
         published = case when published is null then null else replace(published::text, p_new::text, p_existing::text)::jsonb end
   where team_id = v_new.team_id
     and (strpos(content::text, p_new::text) > 0 or strpos(coalesce(published::text, ''), p_new::text) > 0);

  -- Rest (Konfliktzeilen) wird per Cascade mit der neuen Zeile gelöscht.
  -- Hinweis: ein Foto {team_id}/{p_new}.jpg muss die App per Storage-API entfernen.
  delete from public.players where id = p_new;
  return p_existing;
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Datenexport v9 (Art. 15/20 DSGVO): zusätzlich Entwicklungsprogramm (freigegeben), Selbstanalyse, selbst verschenkte
-- Stärken (Empfänger nur mit Vornamen) und erhaltene Stärken als Summe ohne Namen (Rechte der Mitspieler, Art. 15 Abs. 4)
-- ---------------------------------------------------------------------
create or replace function public.my_data_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_players uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select coalesce(array_agg(p.id), '{}') into v_players from public.players p where p.user_id = v_uid;

  return jsonb_build_object(
    'format', 'trainerbank-export-v9',
    'exported_at', now(),
    'user_id', v_uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.given_at) from public.consents c where c.user_id = v_uid), '[]'::jsonb),
    'team_staff', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object('club', t.club, 'team_name', t.name) order by t.club, t.name)
      from public.team_staff s join public.teams t on t.id = s.team_id
      where s.user_id = v_uid), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object('club', t.club, 'team_name', t.name) order by p.created_at)
      from public.players p join public.teams t on t.id = p.team_id
      where p.id = any (v_players)), '[]'::jsonb),
    'rpe_entries', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date) from public.rpe_entries r
      where r.player_id = any (v_players)), '[]'::jsonb),
    'wellness_entries', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.date) from public.wellness_entries w
      where w.player_id = any (v_players)), '[]'::jsonb),
    'extra_activities', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.date) from public.extra_activities e
      where e.player_id = any (v_players)), '[]'::jsonb),
    'absences', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.from_date) from public.absences a
      where a.player_id = any (v_players)), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.date) from public.attendance a
      where a.player_id = any (v_players)), '[]'::jsonb),
    'growth_measurements', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.date) from public.growth_measurements g
      where g.player_id = any (v_players)), '[]'::jsonb),
    'potentials', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at) from public.potentials p
      where p.player_id = any (v_players) and p.visible_to_player), '[]'::jsonb),
    'coach_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at) from public.coach_messages m
      where m.player_id = any (v_players)), '[]'::jsonb),
    'match_stats', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.updated_at) from public.match_stats s
      where s.player_id = any (v_players)), '[]'::jsonb),
    'player_ratings', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date) from public.player_ratings r
      where r.player_id = any (v_players) and r.visible), '[]'::jsonb),
    'performance_tests', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.date) from public.performance_tests t
      where t.player_id = any (v_players)), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.date) from public.findings f
      where f.player_id = any (v_players)), '[]'::jsonb),
    -- Gruppen: nur freigegebene (wie in der App); interne Gruppen bleiben wie Trainernotizen ausgenommen
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('group', g.name, 'kind', g.kind, 'player_id', m.player_id, 'since', m.created_at) order by m.created_at)
        from public.group_members m join public.team_groups g on g.id = m.group_id
       where m.player_id = any (v_players) and g.visible), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at) from public.team_tasks t
      where t.player_id = any (v_players)), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.date) from public.team_duties d
      where d.player_id = any (v_players)), '[]'::jsonb),
    'fines', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.date) from public.team_fines f
      where f.player_id = any (v_players)), '[]'::jsonb),
    -- Mannschaftskasse: eigene Zahlungen und Befreiungen
    'cash', coalesce((
      select jsonb_agg(jsonb_build_object('date', c.date, 'amount', c.amount, 'kind', c.kind, 'category', c.cat, 'fee', c.fee_id, 'period', c.period, 'fine_id', c.fine_id, 'note', c.note) order by c.date)
        from public.cash_entries c where c.player_id = any (v_players)), '[]'::jsonb),
    'cash_waivers', coalesce((
      select jsonb_agg(jsonb_build_object('fee', w.fee_id, 'period', w.period, 'since', w.created_at) order by w.created_at)
        from public.cash_waivers w where w.player_id = any (v_players)), '[]'::jsonb),
    -- Spielerentwicklung: eigene Selbsteinschätzungen und Ziele, freigegebene Einschätzungen, Ziele und Gespräche
    -- (interne Gesprächsnotizen bleiben wie Trainernotizen ausgenommen)
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.date, 'by', case when a.by_player then 'self' else 'coach' end, 'scores', a.scores, 'note', a.note) order by a.date)
        from public.player_assessments a where a.player_id = any (v_players) and (a.by_player or a.visible)), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(to_jsonb(g) - 'created_by' order by g.created_at)
        from public.player_goals g where g.player_id = any (v_players) and (g.visible or g.by_player)), '[]'::jsonb),
    'goal_entries', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', e.goal_id, 'date', e.date, 'value', e.value, 'note', e.note, 'by_player', e.by_player) order by e.date)
        from public.goal_entries e join public.player_goals g on g.id = e.goal_id
       where e.player_id = any (v_players) and (g.visible or g.by_player)), '[]'::jsonb),
    'dev_talks', coalesce((
      select jsonb_agg(jsonb_build_object('date', t.date, 'kind', t.kind, 'player_view', t.player_view, 'strengths', t.strengths, 'focus', t.focus,
                                          'agreements', t.agreements, 'next_date', t.next_date) order by t.date)
        from public.dev_talks t where t.player_id = any (v_players) and t.visible), '[]'::jsonb),
    -- Entwicklungsprogramm: freigegebenes Programm, eigene Selbstanalyse, Stärken-Runde
    'dev_program', coalesce((
      select jsonb_agg(jsonb_build_object('content', d.content, 'published_at', d.published_at) order by d.published_at)
        from public.dev_programs d where d.player_id = any (v_players) and d.visible), '[]'::jsonb),
    'dev_self', coalesce((
      select jsonb_agg(jsonb_build_object('weapons', s.weapons, 'skills', s.skills, 'updated_at', s.updated_at) order by s.updated_at)
        from public.dev_self s where s.player_id = any (v_players)), '[]'::jsonb),
    'peer_skills_given', coalesce((
      select jsonb_agg(jsonb_build_object('to', p.first_name, 'skills', g.skills, 'at', g.updated_at) order by g.updated_at)
        from public.dev_peer_skills g join public.players p on p.id = g.target_id
       where g.giver_id = any (v_players)), '[]'::jsonb),
    'peer_skills_received', coalesce((
      select jsonb_object_agg(x.k, x.n order by x.k) from (
        select k, count(*) as n from public.dev_peer_skills g cross join lateral unnest(g.skills) k
         where g.target_id = any (v_players) group by k) x), '{}'::jsonb),
    'challenge_entries', coalesce((
      select jsonb_agg(jsonb_build_object('week', c.week_start, 'challenge', c.title, 'value', e.value, 'days', e.days, 'done', e.done) order by c.week_start)
        from public.challenge_entries e join public.team_challenges c on c.id = e.challenge_id
       where e.player_id = any (v_players)), '[]'::jsonb),
    'indiv_requests', coalesce((
      select jsonb_agg(jsonb_build_object('topic', r.topic, 'note', r.note, 'wish', r.wish, 'status', r.status, 'answer', r.answer,
                                          'date', r.unit_date, 'created_at', r.created_at) order by r.created_at)
        from public.indiv_requests r where r.player_id = any (v_players)), '[]'::jsonb),
    -- Chat: eigene Nachrichten (Texte anderer gehören diesen), Reaktionen, Meldungen und Mitgliedschaften
    'chat_messages', coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', m.chat_id, 'sent_at', m.created_at, 'text', m.body, 'deleted_at', m.deleted_at) order by m.created_at)
        from public.chat_messages m where m.user_id = v_uid), '[]'::jsonb),
    'chat_reactions', coalesce((
      select jsonb_agg(jsonb_build_object('message_id', r.message_id, 'emoji', r.emoji, 'at', r.created_at) order by r.created_at)
        from public.chat_reactions r where r.user_id = v_uid), '[]'::jsonb),
    'chat_reports', coalesce((
      select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'status', r.status, 'at', r.created_at) order by r.created_at)
        from public.chat_reports r where r.reporter = v_uid), '[]'::jsonb),
    'chats', coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', c.id, 'kind', c.kind, 'title', c.title, 'muted', coalesce(st.muted, false), 'read_at', st.read_at) order by c.created_at)
        from public.chats c left join public.chat_state st on st.chat_id = c.id and st.user_id = v_uid
       where exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = v_uid)
          or st.user_id is not null), '[]'::jsonb),
    -- Matchplan: eigene Aufrufe und erkannte Screenshots (Inhalte der Pläne gehören dem Trainerteam)
    'match_plan_views', coalesce((
      select jsonb_agg(jsonb_build_object('plan', mp.title, 'kind', v.kind, 'platform', v.platform, 'at', v.at) order by v.at)
        from public.match_plan_views v join public.match_plans mp on mp.id = v.plan_id
       where v.player_id = any (v_players)), '[]'::jsonb),
    'club_staff', coalesce((
      select jsonb_agg(jsonb_build_object('club', c.name, 'role', cs.role, 'title', cs.title, 'perms', cs.perms, 'teams', cs.teams, 'since', cs.created_at) order by cs.created_at)
        from public.club_staff cs join public.clubs c on c.id = cs.club_id where cs.user_id = v_uid), '[]'::jsonb),
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb),
    -- Rückmeldungen aus der App (ohne Pfad des Bildschirmfotos)
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object('kind', f.kind, 'text', f.text, 'page', f.page, 'app_version', f.app_version,
                                          'platform', f.platform, 'os_version', f.os_version, 'device', f.device,
                                          'screenshot', f.shot_path is not null, 'status', f.status, 'created_at', f.created_at)
                       order by f.created_at)
        from public.feedback f where f.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Löschfrist: Einträge der Stärken-Runde nach 12 Monaten (was im Programm steht, bleibt dort)
-- ---------------------------------------------------------------------
create or replace function public.purge_old_peer_skills()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.dev_peer_skills where updated_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_peer_skills() from public, anon, authenticated;
grant execute on function public.purge_old_peer_skills() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-old-peer-skills: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-old-peer-skills', '50 3 * * *', 'select public.purge_old_peer_skills()');
exception when others then
  raise notice 'purge-old-peer-skills konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;
