-- =====================================================================
-- Fahrgemeinschaften zu Spielen und Terminen
-- - rides: Fahrt zu einem Spiel (match_id) oder Termin (event_id) – genau eins von beiden, ref_id = das Ziel.
--   Fahrer: ein Spieler bzw. seine Eltern (driver_pid) oder das Trainerteam (null); Bezeichnung (driver_label, z. B.
--   „Mama von Luca“), Plätze für Mitfahrer 1–8, Abfahrt (depart_time HH:MM, depart_place), Hinweis. Je Ziel höchstens
--   eine Fahrt pro Spieler als Fahrer
-- - ride_seats: Mitfahrer; je Ziel höchstens ein Platz pro Spieler und nie zugleich als Fahrer
-- - ride_needs: Spieler sucht für ein Ziel noch eine Mitfahrgelegenheit
-- - Lesen: alle im Team (Trainerteam und verbundene Spieler). Schreiben nur über ride_save, ride_delete, ride_join,
--   ride_leave und ride_need: Spieler bieten nur die eigene Fahrt an und tragen nur sich selbst ein oder aus; Fahrer
--   nehmen Suchende mit und tragen Mitfahrer aus; das Trainerteam darf alles. Nichts für vergangene Ziele (Datum in der
--   Zeitzone des Teams), Plätze werden nicht überbucht (Fahrt gesperrt), Modul „fahrten“ aus = keine neuen Einträge.
--   Wird eine Fahrt gelöscht oder ein Mitfahrer von anderen ausgetragen, sucht er wieder (kommende Ziele)
-- - ride_names(team): Vorname und Initial der beteiligten Spieler (Spieler sehen den Kader sonst nicht)
-- - Löschen: mit dem Spiel bzw. Termin oder Spieler (cascade); Suchen ab dem Tag nach dem Ziel, Fahrten 30 Tage danach
--   (purge_old_rides); merge_players v13; Export v14
-- =====================================================================

create table if not exists public.rides (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  match_id     uuid references public.matches (id) on delete cascade,
  event_id     uuid references public.team_events (id) on delete cascade,
  ref_id       uuid generated always as (coalesce(match_id, event_id)) stored,
  driver_pid   uuid references public.players (id) on delete cascade,
  driver_label text constraint rides_driver_label_valid check (char_length(btrim(driver_label)) between 1 and 60 and driver_label !~ '[[:cntrl:]]'),
  seats        smallint not null constraint rides_seats_valid check (seats between 1 and 8),
  depart_time  text constraint rides_depart_time_valid check (depart_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  depart_place text constraint rides_depart_place_valid check (char_length(btrim(depart_place)) between 1 and 120 and depart_place !~ '[[:cntrl:]]'),
  note         text constraint rides_note_valid check (char_length(btrim(note)) between 1 and 200 and note !~ '[[:cntrl:]]'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint rides_one_target check (num_nonnulls(match_id, event_id) = 1)
);
create index if not exists rides_team_idx on public.rides (team_id);
create index if not exists rides_ref_idx on public.rides (ref_id);
create index if not exists rides_match_idx on public.rides (match_id) where match_id is not null;
create index if not exists rides_event_idx on public.rides (event_id) where event_id is not null;
create unique index if not exists rides_driver_once on public.rides (ref_id, driver_pid) where driver_pid is not null;
create index if not exists rides_driver_idx on public.rides (driver_pid) where driver_pid is not null;

create table if not exists public.ride_seats (
  ride_id    uuid not null references public.rides (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),
  primary key (ride_id, player_id),
  constraint ride_seats_once unique (ref_id, player_id)
);
create index if not exists ride_seats_team_idx on public.ride_seats (team_id);
create index if not exists ride_seats_player_idx on public.ride_seats (player_id);

create table if not exists public.ride_needs (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  match_id   uuid references public.matches (id) on delete cascade,
  event_id   uuid references public.team_events (id) on delete cascade,
  ref_id     uuid generated always as (coalesce(match_id, event_id)) stored,
  player_id  uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ride_needs_one_target check (num_nonnulls(match_id, event_id) = 1),
  constraint ride_needs_once unique (ref_id, player_id)
);
create index if not exists ride_needs_team_idx on public.ride_needs (team_id);
create index if not exists ride_needs_player_idx on public.ride_needs (player_id);
create index if not exists ride_needs_match_idx on public.ride_needs (match_id) where match_id is not null;
create index if not exists ride_needs_event_idx on public.ride_needs (event_id) where event_id is not null;

alter table public.rides      enable row level security;
alter table public.ride_seats enable row level security;
alter table public.ride_needs enable row level security;

drop policy if exists rides_select on public.rides;
create policy rides_select on public.rides for select to authenticated using (public.is_team_member(team_id));
drop policy if exists ride_seats_select on public.ride_seats;
create policy ride_seats_select on public.ride_seats for select to authenticated using (public.is_team_member(team_id));
drop policy if exists ride_needs_select on public.ride_needs;
create policy ride_needs_select on public.ride_needs for select to authenticated using (public.is_team_member(team_id));

-- Nur lesen – geschrieben wird ausschließlich über die Funktionen unten
revoke all on public.rides, public.ride_seats, public.ride_needs from anon;
revoke insert, update, delete, truncate, references, trigger on public.rides, public.ride_seats, public.ride_needs from authenticated;
grant select on public.rides, public.ride_seats, public.ride_needs to authenticated;

-- ---------------------------------------------------------------------
-- Interne Hilfen (nur innerhalb der Funktionen; security definer liest Spiele und Termine unabhängig von den Regeln)
-- ---------------------------------------------------------------------
-- Text einzeilig: Steuerzeichen und mehrfache Leerzeichen zu einem, gekürzt, leer = null
create or replace function public.ride_line(p text, p_max integer)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), p_max)), '')
$$;

-- Ziel einer Fahrt: Team und Datum des Spiels bzw. Termins (null, wenn unbekannt)
create or replace function public.ride_target(p_kind text, p_ref uuid, out o_team uuid, out o_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_kind = 'match' then
    select m.team_id, m.date into o_team, o_date from public.matches m where m.id = p_ref;
  elsif p_kind = 'event' then
    select e.team_id, e.date into o_team, o_date from public.team_events e where e.id = p_ref;
  end if;
end;
$$;

-- Modul „Fahrgemeinschaften“ an? (Standard an)
create or replace function public.rides_on(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select coalesce(t.modules ->> 'fahrten', 'true') <> 'false' from public.teams t where t.id = p_team), false)
$$;

-- Eigene Spielerzeile im Team (null für das Trainerteam ohne Spielerzeile)
create or replace function public.ride_me(p_team uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from public.players p where p.team_id = p_team and p.user_id = auth.uid() limit 1
$$;

-- Ein Spieler je Ziel nacheinander (Anbieten, Mitfahren, Austragen, Suchen) – gegen doppelte Einträge bei Gleichzeitigkeit
create or replace function public.ride_lock(p_ref uuid, p_player uuid)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended('ride:' || p_ref::text || ':' || p_player::text, 0))
$$;

revoke all on function public.ride_line(text, integer) from public, anon, authenticated;
revoke all on function public.ride_target(text, uuid) from public, anon, authenticated;
revoke all on function public.rides_on(uuid) from public, anon, authenticated;
revoke all on function public.ride_me(uuid) from public, anon, authenticated;
revoke all on function public.ride_lock(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Fahrt anlegen oder ändern. Neu: Trainerteam für jeden (driver_pid null = Fahrt des Trainerteams), Spieler nur als
-- eigener Fahrer (sich selbst bzw. Eltern) und nur ohne andere Fahrt zu diesem Ziel; wer fährt, sucht nicht mehr.
-- Ändern: Trainerteam oder der Fahrer selbst; Ziel und Fahrer bleiben, Plätze nicht unter die Zahl der Mitfahrer
-- ---------------------------------------------------------------------
create or replace function public.ride_save(p_id uuid, p_kind text, p_ref uuid, p_driver_pid uuid, p_driver text,
                                            p_seats integer, p_time text, p_place text, p_note text)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride  public.rides;
  v_kind  text := p_kind;
  v_ref   uuid := p_ref;
  v_team  uuid;
  v_date  date;
  v_me    uuid;
  v_staff boolean;
  v_n     integer;
  v_time  text := case when btrim(coalesce(p_time, '')) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then btrim(p_time) end;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_id is not null then
    select * into v_ride from public.rides where id = p_id;
    if v_ride.id is null or not public.is_team_member(v_ride.team_id) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_kind := case when v_ride.match_id is not null then 'match' else 'event' end;
    v_ref := v_ride.ref_id;
  end if;
  select t.o_team, t.o_date into v_team, v_date from public.ride_target(v_kind, v_ref) t;
  if v_team is null or not public.is_team_member(v_team) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.rides_on(v_team) then
    raise exception 'rides_off' using errcode = 'P0001';
  end if;
  v_staff := public.is_team_staff(v_team);
  v_me := public.ride_me(v_team);
  if p_seats is null or p_seats not between 1 and 8 then
    raise exception 'invalid_seats' using errcode = '22023';
  end if;

  if p_id is null then
    if not v_staff and (v_me is null or p_driver_pid is distinct from v_me) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_date < public.team_today(v_team) then
      raise exception 'ride_past' using errcode = 'P0001';
    end if;
    if p_driver_pid is not null then
      if public.player_team(p_driver_pid) is distinct from v_team then
        raise exception 'different_teams' using errcode = '22023';
      end if;
      perform public.ride_lock(v_ref, p_driver_pid);
      if exists (select 1 from public.rides r where r.ref_id = v_ref and r.driver_pid = p_driver_pid)
         or exists (select 1 from public.ride_seats s where s.ref_id = v_ref and s.player_id = p_driver_pid) then
        raise exception 'already_in_ride' using errcode = 'P0001';
      end if;
    end if;
    insert into public.rides (team_id, match_id, event_id, driver_pid, driver_label, seats, depart_time, depart_place, note)
    values (v_team, case when v_kind = 'match' then v_ref end, case when v_kind = 'event' then v_ref end, p_driver_pid,
            public.ride_line(p_driver, 60), p_seats, v_time, public.ride_line(p_place, 120), public.ride_line(p_note, 200))
    returning * into v_ride;
    if p_driver_pid is not null then
      delete from public.ride_needs where ref_id = v_ref and player_id = p_driver_pid;
    end if;
    return v_ride;
  end if;

  if not v_staff and (v_me is null or v_ride.driver_pid is distinct from v_me) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_date < public.team_today(v_team) then
    raise exception 'ride_past' using errcode = 'P0001';
  end if;
  perform 1 from public.rides where id = p_id for update;
  select count(*) into v_n from public.ride_seats where ride_id = p_id;
  if p_seats < v_n then
    raise exception 'seats_taken' using errcode = 'P0001';
  end if;
  update public.rides
     set driver_label = public.ride_line(p_driver, 60), seats = p_seats, depart_time = v_time,
         depart_place = public.ride_line(p_place, 120), note = public.ride_line(p_note, 200), updated_at = now()
   where id = p_id
  returning * into v_ride;
  return v_ride;
end;
$$;
revoke all on function public.ride_save(uuid, text, uuid, uuid, text, integer, text, text, text) from public, anon;
grant execute on function public.ride_save(uuid, text, uuid, uuid, text, integer, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Fahrt löschen (Trainerteam oder der Fahrer selbst). Bei kommenden Zielen suchen die Mitfahrer danach wieder.
-- Ergebnis: Zahl der Mitfahrer, die wieder suchen
-- ---------------------------------------------------------------------
create or replace function public.ride_delete(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_me   uuid;
  v_date date;
  v_n    integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_ride from public.rides where id = p_id;
  if v_ride.id is null or not public.is_team_member(v_ride.team_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_me := public.ride_me(v_ride.team_id);
  if not public.is_team_staff(v_ride.team_id) and (v_me is null or v_ride.driver_pid is distinct from v_me) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.rides where id = p_id for update;
  select t.o_date into v_date from public.ride_target(case when v_ride.match_id is not null then 'match' else 'event' end, v_ride.ref_id) t;
  if v_date >= public.team_today(v_ride.team_id) then
    insert into public.ride_needs (team_id, match_id, event_id, player_id)
    select v_ride.team_id, v_ride.match_id, v_ride.event_id, s.player_id from public.ride_seats s where s.ride_id = p_id
    on conflict (ref_id, player_id) do nothing;
    get diagnostics v_n = row_count;
  end if;
  delete from public.rides where id = p_id;
  return v_n;
end;
$$;
revoke all on function public.ride_delete(uuid) from public, anon;
grant execute on function public.ride_delete(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Mitfahren: das Trainerteam ordnet jeden zu, Spieler tragen sich selbst ein, Fahrer nehmen Suchende mit. Nicht als
-- Fahrer zum selben Ziel, nicht über die Plätze hinaus; Wechsel aus einer anderen Fahrt (Trainerteam oder der Spieler
-- selbst) gibt den alten Platz frei; wer mitfährt, sucht nicht mehr
-- ---------------------------------------------------------------------
create or replace function public.ride_join(p_ride uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride  public.rides;
  v_me    uuid;
  v_staff boolean;
  v_date  date;
  v_n     integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_ride from public.rides where id = p_ride;
  if v_ride.id is null or not public.is_team_member(v_ride.team_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.rides_on(v_ride.team_id) then
    raise exception 'rides_off' using errcode = 'P0001';
  end if;
  if public.player_team(p_player) is distinct from v_ride.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  v_staff := public.is_team_staff(v_ride.team_id);
  v_me := public.ride_me(v_ride.team_id);
  -- null-sicher: Fahrten des Trainerteams haben keinen Fahrer (driver_pid null)
  if not coalesce(v_staff or (v_me is not null and (p_player = v_me
          or (v_ride.driver_pid is not distinct from v_me
              and exists (select 1 from public.ride_needs n where n.ref_id = v_ride.ref_id and n.player_id = p_player)))), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select t.o_date into v_date from public.ride_target(case when v_ride.match_id is not null then 'match' else 'event' end, v_ride.ref_id) t;
  if v_date < public.team_today(v_ride.team_id) then
    raise exception 'ride_past' using errcode = 'P0001';
  end if;
  perform public.ride_lock(v_ride.ref_id, p_player);
  select * into v_ride from public.rides where id = p_ride for update;
  if v_ride.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.ride_seats where ride_id = p_ride and player_id = p_player) then
    return;
  end if;
  if exists (select 1 from public.rides r where r.ref_id = v_ride.ref_id and r.driver_pid = p_player) then
    raise exception 'already_in_ride' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.ride_seats where ride_id = p_ride;
  if v_n >= v_ride.seats then
    raise exception 'ride_full' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ride_seats s where s.ref_id = v_ride.ref_id and s.player_id = p_player) then
    if not coalesce(v_staff or p_player = v_me, false) then
      raise exception 'already_in_ride' using errcode = 'P0001';
    end if;
    delete from public.ride_seats where ref_id = v_ride.ref_id and player_id = p_player;
  end if;
  insert into public.ride_seats (ride_id, player_id, team_id, ref_id) values (p_ride, p_player, v_ride.team_id, v_ride.ref_id);
  delete from public.ride_needs where ref_id = v_ride.ref_id and player_id = p_player;
end;
$$;
revoke all on function public.ride_join(uuid, uuid) from public, anon;
grant execute on function public.ride_join(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Austragen: Trainerteam, der Spieler selbst oder der Fahrer dieser Fahrt. p_need: sucht danach wieder (nur kommende Ziele)
-- ---------------------------------------------------------------------
create or replace function public.ride_leave(p_ride uuid, p_player uuid, p_need boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_me   uuid;
  v_date date;
  v_n    integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_ride from public.rides where id = p_ride;
  if v_ride.id is null or not public.is_team_member(v_ride.team_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_me := public.ride_me(v_ride.team_id);
  if not coalesce(public.is_team_staff(v_ride.team_id) or (v_me is not null and (p_player = v_me or v_ride.driver_pid is not distinct from v_me)), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.ride_lock(v_ride.ref_id, p_player);
  delete from public.ride_seats where ride_id = p_ride and player_id = p_player;
  get diagnostics v_n = row_count;
  select t.o_date into v_date from public.ride_target(case when v_ride.match_id is not null then 'match' else 'event' end, v_ride.ref_id) t;
  if v_n > 0 and coalesce(p_need, false) and v_date >= public.team_today(v_ride.team_id) then
    insert into public.ride_needs (team_id, match_id, event_id, player_id)
    values (v_ride.team_id, v_ride.match_id, v_ride.event_id, p_player)
    on conflict (ref_id, player_id) do nothing;
  end if;
end;
$$;
revoke all on function public.ride_leave(uuid, uuid, boolean) from public, anon;
grant execute on function public.ride_leave(uuid, uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Mitfahrgelegenheit suchen (p_on) bzw. nicht mehr suchen: Trainerteam oder der Spieler selbst; suchen nur für kommende
-- Ziele und nur ohne Fahrt zu diesem Ziel
-- ---------------------------------------------------------------------
create or replace function public.ride_need(p_kind text, p_ref uuid, p_player uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_date date;
  v_me   uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select t.o_team, t.o_date into v_team, v_date from public.ride_target(p_kind, p_ref) t;
  if v_team is null or not public.is_team_member(v_team) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.player_team(p_player) is distinct from v_team then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  v_me := public.ride_me(v_team);
  if not coalesce(public.is_team_staff(v_team) or (v_me is not null and p_player = v_me), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.ride_lock(p_ref, p_player);
  if not coalesce(p_on, false) then
    delete from public.ride_needs where ref_id = p_ref and player_id = p_player;
    return;
  end if;
  if not public.rides_on(v_team) then
    raise exception 'rides_off' using errcode = 'P0001';
  end if;
  if v_date < public.team_today(v_team) then
    raise exception 'ride_past' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rides r where r.ref_id = p_ref and r.driver_pid = p_player)
     or exists (select 1 from public.ride_seats s where s.ref_id = p_ref and s.player_id = p_player) then
    raise exception 'already_in_ride' using errcode = 'P0001';
  end if;
  insert into public.ride_needs (team_id, match_id, event_id, player_id)
  values (v_team, case when p_kind = 'match' then p_ref end, case when p_kind = 'event' then p_ref end, p_player)
  on conflict (ref_id, player_id) do nothing;
end;
$$;
revoke all on function public.ride_need(text, uuid, uuid, boolean) from public, anon;
grant execute on function public.ride_need(text, uuid, uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Namen in den Fahrgemeinschaften: Vorname und Initial der beteiligten Spieler (Fahrer, Mitfahrer, Suchende)
-- ---------------------------------------------------------------------
create or replace function public.ride_names(p_team uuid)
returns table (player_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         btrim(p.first_name) || case when coalesce(btrim(p.last_name), '') = '' then '' else ' ' || upper(left(btrim(p.last_name), 1)) || '.' end
    from public.players p
   where p.team_id = p_team and public.is_team_member(p_team)
     and (exists (select 1 from public.rides r where r.team_id = p_team and r.driver_pid = p.id)
       or exists (select 1 from public.ride_seats s where s.team_id = p_team and s.player_id = p.id)
       or exists (select 1 from public.ride_needs n where n.team_id = p_team and n.player_id = p.id))
$$;
revoke all on function public.ride_names(uuid) from public, anon;
grant execute on function public.ride_names(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- merge_players v13: zusätzlich Fahrgemeinschaften (sonst wie v12, 20261105000005)
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

  -- Notfallkontakte und Hinweise: der neuere Eintrag gilt (meist der vom Spieler beim Beitreten)
  delete from public.player_emergency e
   where e.player_id = p_existing
     and exists (select 1 from public.player_emergency n where n.player_id = p_new and n.updated_at >= e.updated_at);
  update public.player_emergency set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.player_emergency x where x.player_id = p_existing);
  delete from public.player_emergency_med e
   where e.player_id = p_existing
     and exists (select 1 from public.player_emergency_med n where n.player_id = p_new and n.updated_at >= e.updated_at);
  update public.player_emergency_med set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.player_emergency_med x where x.player_id = p_existing);

  -- Größen: der neuere Eintrag gilt (meist der vom Spieler selbst)
  delete from public.player_sizes e
   where e.player_id = p_existing
     and exists (select 1 from public.player_sizes n where n.player_id = p_new and n.updated_at >= e.updated_at);
  update public.player_sizes set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.player_sizes x where x.player_id = p_existing);

  -- Kader-Nominierungen übernehmen (ohne Doppelungen – Rest geht mit der neuen Zeile)
  update public.match_nominations n set player_id = p_existing
   where n.player_id = p_new
     and not exists (select 1 from public.match_nominations x where x.player_id = p_existing and x.match_id = n.match_id);

  -- Fahrgemeinschaften: eigene Fahrten (als Fahrer), Plätze und Suchen übernehmen – je Ziel nur eins davon; Doppelungen
  -- bleiben bei der neuen Zeile und gehen mit ihr (eine doppelte eigene Fahrt samt Mitfahrern)
  update public.rides r set driver_pid = p_existing
   where r.driver_pid = p_new
     and not exists (select 1 from public.rides x where x.driver_pid = p_existing and x.ref_id = r.ref_id)
     and not exists (select 1 from public.ride_seats x where x.player_id = p_existing and x.ref_id = r.ref_id);
  update public.ride_seats s set player_id = p_existing
   where s.player_id = p_new
     and not exists (select 1 from public.ride_seats x where x.player_id = p_existing and x.ref_id = s.ref_id)
     and not exists (select 1 from public.rides x where x.driver_pid = p_existing and x.ref_id = s.ref_id);
  update public.ride_needs n set player_id = p_existing
   where n.player_id = p_new
     and not exists (select 1 from public.ride_needs x where x.player_id = p_existing and x.ref_id = n.ref_id)
     and not exists (select 1 from public.rides x where x.driver_pid = p_existing and x.ref_id = n.ref_id)
     and not exists (select 1 from public.ride_seats x where x.player_id = p_existing and x.ref_id = n.ref_id);

  -- Umfragen: Antworten übernehmen (ohne Doppelungen – Rest geht mit der neuen Zeile, der Zähler folgt) und eigene Abstimmungen
  update public.poll_answers a set player_id = p_existing
   where a.player_id = p_new
     and not exists (select 1 from public.poll_answers x where x.player_id = p_existing and x.poll_id = a.poll_id);
  update public.polls set author_player = p_existing where author_player = p_new;

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
-- Datenexport v14 (Art. 15/20 DSGVO): zusätzlich eigene Fahrgemeinschaften
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
    'format', 'trainerbank-export-v14',
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
    -- Notfallkontakte und Hinweise für den Notfall der eigenen Spielerzeilen
    'emergency_contacts', coalesce((
      select jsonb_agg(jsonb_build_object('contacts', x.contacts, 'updated_at', x.updated_at)) from public.player_emergency x
       where x.player_id = any (v_players)), '[]'::jsonb),
    'emergency_notes', coalesce((
      select jsonb_agg(jsonb_build_object('note', x.note, 'updated_at', x.updated_at)) from public.player_emergency_med x
       where x.player_id = any (v_players)), '[]'::jsonb),
    -- Größen der eigenen Spielerzeilen
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('top', x.top, 'bottom', x.bottom, 'shoes', x.shoes, 'gloves', x.gloves,
                                          'print_name', x.print_name, 'note', x.note, 'updated_at', x.updated_at))
        from public.player_sizes x where x.player_id = any (v_players)), '[]'::jsonb),
    -- Kader-Nominierungen: eigene (Spiel, Kader oder Abruf, Zu-/Absage mit Grund) – nur veröffentlichte Kader
    'nominations', coalesce((
      select jsonb_agg(jsonb_build_object('match_date', m.date, 'opponent', m.opponent, 'standby', n.standby, 'answer', n.answer,
                                          'reason', n.reason, 'answered_at', n.answered_at, 'answered_by_staff', n.answered_by_staff) order by m.date)
        from public.match_nominations n join public.matches m on m.id = n.match_id join public.match_squads s on s.match_id = n.match_id
       where n.player_id = any (v_players) and s.published_at is not null), '[]'::jsonb),
    -- Umfragen: eigene Antworten (mit Fragen) und selbst gestartete Umfragen; Antworten anderer gehören diesen
    'poll_answers', coalesce((
      select jsonb_agg(jsonb_build_object('poll', p.title, 'kind', p.kind, 'anonymous', p.anonymous, 'questions', p.questions,
                                          'answers', a.answers, 'at', a.updated_at) order by a.created_at)
        from public.poll_answers a join public.polls p on p.id = a.poll_id
       where a.player_id = any (v_players)), '[]'::jsonb),
    'polls_started', coalesce((
      select jsonb_agg(jsonb_build_object('title', p.title, 'kind', p.kind, 'questions', p.questions, 'created_at', p.created_at,
                                          'until', p.until, 'closed_at', p.closed_at) order by p.created_at)
        from public.polls p where p.created_by = v_uid or p.author_player = any (v_players)), '[]'::jsonb),
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
  -- jsonb_build_object nimmt höchstens 100 Argumente: weitere Bereiche in einem zweiten Objekt
  ) || jsonb_build_object(
    -- Fahrgemeinschaften: eigene Fahrten als Fahrer, eigene Plätze (mit Fahrer und Abfahrt) und Suchen – ohne die
    -- Namen anderer Mitfahrer
    'rides_offered', coalesce((
      select jsonb_agg(jsonb_build_object('date', coalesce(m.date, e.date), 'target', coalesce(m.opponent, e.title), 'driver', r.driver_label,
                                          'seats', r.seats, 'depart_time', r.depart_time, 'depart_place', r.depart_place, 'note', r.note,
                                          'passengers', (select count(*) from public.ride_seats s where s.ride_id = r.id), 'created_at', r.created_at)
                       order by coalesce(m.date, e.date))
        from public.rides r left join public.matches m on m.id = r.match_id left join public.team_events e on e.id = r.event_id
       where r.driver_pid = any (v_players)), '[]'::jsonb),
    'ride_seats', coalesce((
      select jsonb_agg(jsonb_build_object('date', coalesce(m.date, e.date), 'target', coalesce(m.opponent, e.title), 'driver', r.driver_label,
                                          'staff_ride', r.driver_pid is null, 'depart_time', r.depart_time, 'depart_place', r.depart_place, 'since', s.created_at)
                       order by coalesce(m.date, e.date))
        from public.ride_seats s join public.rides r on r.id = s.ride_id
        left join public.matches m on m.id = r.match_id left join public.team_events e on e.id = r.event_id
       where s.player_id = any (v_players)), '[]'::jsonb),
    'ride_needs', coalesce((
      select jsonb_agg(jsonb_build_object('date', coalesce(m.date, e.date), 'target', coalesce(m.opponent, e.title), 'since', n.created_at)
                       order by coalesce(m.date, e.date))
        from public.ride_needs n left join public.matches m on m.id = n.match_id left join public.team_events e on e.id = n.event_id
       where n.player_id = any (v_players)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Löschfrist: Suchen ab dem Tag nach dem Ziel, Fahrten (mit Plätzen) 30 Tage nach dem Ziel
-- ---------------------------------------------------------------------
create or replace function public.purge_old_rides()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  k integer;
begin
  delete from public.ride_needs x using public.matches m where m.id = x.match_id and m.date < current_date;
  get diagnostics k = row_count; n := n + k;
  delete from public.ride_needs x using public.team_events e where e.id = x.event_id and e.date < current_date;
  get diagnostics k = row_count; n := n + k;
  delete from public.rides r using public.matches m where m.id = r.match_id and m.date < current_date - 30;
  get diagnostics k = row_count; n := n + k;
  delete from public.rides r using public.team_events e where e.id = r.event_id and e.date < current_date - 30;
  get diagnostics k = row_count; n := n + k;
  return n;
end;
$$;
revoke all on function public.purge_old_rides() from public, anon, authenticated;
grant execute on function public.purge_old_rides() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-old-rides: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-old-rides', '5 4 * * *', 'select public.purge_old_rides()');
exception when others then
  raise notice 'purge-old-rides konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;
