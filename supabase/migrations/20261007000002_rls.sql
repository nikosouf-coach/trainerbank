-- =====================================================================
-- Trainerbank – Zugriffsregeln (Row Level Security)
-- Umsetzung von docs/ARCHITEKTUR.md › "Zugriffsregeln (RLS)".
--
-- Rollen
--   Staff   = Zeile in team_staff (owner | coach | physio): sieht/bearbeitet alles im Team.
--   Spieler = players.user_id = auth.uid(): Teamkalender + veröffentlichter Plan,
--             nur eigene Gesundheitsdaten, keine Daten von Mitspielern.
--
-- Alle Policies gelten für die Rolle "authenticated". "anon" hat keinerlei
-- Tabellenrechte; service_role umgeht RLS (nur in Edge Functions verwendet).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Hilfsfunktionen (security definer: lesen team_staff/players ohne RLS,
-- dadurch keine Rekursion in den Policies)
-- ---------------------------------------------------------------------
create or replace function public.is_team_staff(team uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_staff s
    where s.team_id = $1 and s.user_id = auth.uid()
  );
$$;
comment on function public.is_team_staff(uuid) is 'true, wenn der aktuelle Nutzer Staff (owner/coach/physio) des Teams ist.';

create or replace function public.is_team_owner(team uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_staff s
    where s.team_id = $1 and s.user_id = auth.uid() and s.role = 'owner'
  );
$$;
comment on function public.is_team_owner(uuid) is 'true, wenn der aktuelle Nutzer Owner des Teams ist.';

create or replace function public.is_team_member(team uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_team_staff($1)
      or exists (
        select 1 from public.players p
        where p.team_id = $1 and p.user_id = auth.uid()
      );
$$;
comment on function public.is_team_member(uuid) is 'true für Staff und verknüpfte Spieler des Teams.';

create or replace function public.is_own_player(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players p
    where p.id = $1 and p.user_id = auth.uid()
  );
$$;
comment on function public.is_own_player(uuid) is 'true, wenn die Spielerzeile mit dem eigenen Konto verknüpft ist.';

create or replace function public.player_team(pid uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.team_id from public.players p where p.id = $1;
$$;
comment on function public.player_team(uuid) is 'Team-ID eines Spielers (null, wenn unbekannt).';

create or replace function public.is_staff_of_player(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    join public.team_staff s on s.team_id = p.team_id
    where p.id = $1 and s.user_id = auth.uid()
  );
$$;
comment on function public.is_staff_of_player(uuid) is 'true, wenn der aktuelle Nutzer Staff im Team des Spielers ist.';

-- Ergänzung: Staff darf Einwilligungen der eigenen Spieler lesen (consents hat nur user_id)
create or replace function public.is_staff_of_user(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    join public.team_staff s on s.team_id = p.team_id
    where p.user_id = $1 and s.user_id = auth.uid()
  );
$$;
comment on function public.is_staff_of_user(uuid) is 'true, wenn das Konto uid Spieler in einem Team ist, in dem der aktuelle Nutzer Staff ist.';

revoke all on function public.is_team_staff(uuid)      from public, anon;
revoke all on function public.is_team_owner(uuid)      from public, anon;
revoke all on function public.is_team_member(uuid)     from public, anon;
revoke all on function public.is_own_player(uuid)      from public, anon;
revoke all on function public.player_team(uuid)        from public, anon;
revoke all on function public.is_staff_of_player(uuid) from public, anon;
revoke all on function public.is_staff_of_user(uuid)   from public, anon;
grant execute on function public.is_team_staff(uuid)      to authenticated, service_role;
grant execute on function public.is_team_owner(uuid)      to authenticated, service_role;
grant execute on function public.is_team_member(uuid)     to authenticated, service_role;
grant execute on function public.is_own_player(uuid)      to authenticated, service_role;
grant execute on function public.player_team(uuid)        to authenticated, service_role;
grant execute on function public.is_staff_of_player(uuid) to authenticated, service_role;
grant execute on function public.is_staff_of_user(uuid)   to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tabellenrechte
-- Supabase vergibt per Default-Privileges alle Rechte an anon/authenticated.
-- anon braucht keine Tabelle; serverseitige Tabellen bleiben für Clients
-- schreibgeschützt (zusätzlich zu RLS).
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;
revoke all on public.push_log from authenticated;
revoke truncate on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------
-- RLS auf allen Tabellen aktivieren
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.teams               enable row level security;
alter table public.team_staff          enable row level security;
alter table public.players             enable row level security;
alter table public.matches             enable row level security;
alter table public.team_events         enable row level security;
alter table public.calendar_overrides  enable row level security;
alter table public.plan_overrides      enable row level security;
alter table public.week_modes          enable row level security;
alter table public.session_types       enable row level security;
alter table public.sessions            enable row level security;
alter table public.week_plans          enable row level security;
alter table public.attendance          enable row level security;
alter table public.rpe_entries         enable row level security;
alter table public.wellness_entries    enable row level security;
alter table public.extra_activities    enable row level security;
alter table public.absences            enable row level security;
alter table public.growth_measurements enable row level security;
alter table public.potentials          enable row level security;
alter table public.coach_messages      enable row level security;
alter table public.coach_notes         enable row level security;
alter table public.push_tokens         enable row level security;
alter table public.consents            enable row level security;
alter table public.ai_usage            enable row level security;
alter table public.push_log            enable row level security;  -- bewusst ohne Policy: nur service_role

-- ---------------------------------------------------------------------
-- teams: lesen = Mitglied, ändern = Staff, löschen = Owner.
-- Anlegen ausschließlich über RPC create_team (keine Insert-Policy).
-- ---------------------------------------------------------------------
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated
  using (public.is_team_member(id));

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams
  for update to authenticated
  using (public.is_team_staff(id))
  with check (public.is_team_staff(id));

drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams
  for delete to authenticated
  using (public.is_team_owner(id));

-- ---------------------------------------------------------------------
-- team_staff: eigene Zeilen + Staff sieht das Trainerteam.
-- Beitritt nur per RPC (create_team / join_staff). Rollen ändern = Owner,
-- austreten = selbst, entfernen = Owner.
-- ---------------------------------------------------------------------
drop policy if exists team_staff_select on public.team_staff;
create policy team_staff_select on public.team_staff
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_staff(team_id));

drop policy if exists team_staff_update on public.team_staff;
create policy team_staff_update on public.team_staff
  for update to authenticated
  using (public.is_team_owner(team_id))
  with check (public.is_team_owner(team_id));

drop policy if exists team_staff_delete on public.team_staff;
create policy team_staff_delete on public.team_staff
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_team_owner(team_id));

-- ---------------------------------------------------------------------
-- Teamdaten: lesen = Mitglied, schreiben = Staff
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'matches', 'team_events', 'calendar_overrides', 'plan_overrides',
    'week_modes', 'session_types', 'sessions', 'week_plans'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_team_member(team_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_team_staff(team_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_team_staff(team_id))',
      t || '_delete', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- players: Staff alles im Team; Spieler liest/ändert nur die eigene Zeile.
-- Spieler entstehen ohne Staff-Rechte nur über RPC join_team.
-- ---------------------------------------------------------------------
drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_staff(team_id));

drop policy if exists players_insert on public.players;
create policy players_insert on public.players
  for insert to authenticated
  with check (public.is_team_staff(team_id));

drop policy if exists players_update on public.players;
create policy players_update on public.players
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_team_staff(team_id))
  with check (user_id = (select auth.uid()) or public.is_team_staff(team_id));

drop policy if exists players_delete on public.players;
create policy players_delete on public.players
  for delete to authenticated
  using (public.is_team_staff(team_id));

-- ---------------------------------------------------------------------
-- Gesundheitsdaten: Staff des Teams und der Spieler selbst (alle Operationen)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  cond constant text := '(public.is_own_player(player_id) or public.is_staff_of_player(player_id))';
begin
  foreach t in array array['rpe_entries', 'wellness_entries', 'extra_activities'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format('create policy %I on public.%I for select to authenticated using %s',
                   t || '_select', t, cond);
    execute format('create policy %I on public.%I for insert to authenticated with check %s',
                   t || '_insert', t, cond);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s',
                   t || '_update', t, cond, cond);
    execute format('create policy %I on public.%I for delete to authenticated using %s',
                   t || '_delete', t, cond);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- absences: Staff alles; Spieler liest eigene, legt eigene an
-- (reported_by_player = true wird per Trigger erzwungen) und löscht eigene
-- selbst gemeldete.
-- ---------------------------------------------------------------------
drop policy if exists absences_select on public.absences;
create policy absences_select on public.absences
  for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));

drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences
  for insert to authenticated
  with check (
    team_id = public.player_team(player_id)
    and (
      public.is_team_staff(team_id)
      or (public.is_own_player(player_id) and reported_by_player)
    )
  );

drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences
  for update to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id) and team_id = public.player_team(player_id));

drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences
  for delete to authenticated
  using (
    public.is_team_staff(team_id)
    or (public.is_own_player(player_id) and reported_by_player)
  );

-- ---------------------------------------------------------------------
-- attendance: Staff alles, Spieler liest eigene
-- ---------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (public.is_team_staff(team_id) and team_id = public.player_team(player_id));

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (public.is_team_staff(team_id))
  with check (public.is_team_staff(team_id) and team_id = public.player_team(player_id));

drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance
  for delete to authenticated
  using (public.is_team_staff(team_id));

-- ---------------------------------------------------------------------
-- growth_measurements, coach_messages: Staff alles, Spieler liest eigene
-- potentials: Staff alles, Spieler liest eigene mit visible_to_player
-- coach_notes: nur Staff
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  staff constant text := '(public.is_staff_of_player(player_id))';
begin
  foreach t in array array['growth_measurements', 'coach_messages', 'potentials', 'coach_notes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format('create policy %I on public.%I for select to authenticated using (%s)',
      t || '_select', t,
      case t
        when 'coach_notes' then staff
        when 'potentials'  then staff || ' or (public.is_own_player(player_id) and visible_to_player)'
        else staff || ' or public.is_own_player(player_id)'
      end);
    execute format('create policy %I on public.%I for insert to authenticated with check %s',
                   t || '_insert', t, staff);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s',
                   t || '_update', t, staff, staff);
    execute format('create policy %I on public.%I for delete to authenticated using %s',
                   t || '_delete', t, staff);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Kontodaten: nur eigene Zeilen
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists push_tokens_all on public.push_tokens;
create policy push_tokens_all on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- consents: eigene Zeilen; Staff darf die Einwilligungen seiner Spieler lesen
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff_of_user(user_id));

drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists consents_update on public.consents;
create policy consents_update on public.consents
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists consents_delete on public.consents;
create policy consents_delete on public.consents
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ai_usage: eigene Zeilen nur lesen; Zählen erledigt die Edge Function "ai"
-- mit service_role (sonst könnte ein Nutzer sein Limit zurücksetzen).
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- Schutz- und Fach-Trigger
-- Muster: current_user ist bei Client-Zugriffen (PostgREST) 'authenticated'.
-- In SECURITY-DEFINER-RPCs ist current_user der Funktionseigentümer, bei
-- Edge Functions 'service_role' – diese Wege sind vertrauenswürdig.
-- =====================================================================

-- teams: Zeitzone validieren; Codes/Ersteller nur per RPC änderbar
create or replace function public.teams_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  begin
    perform now() at time zone new.timezone;
  exception when others then
    raise exception 'invalid_timezone: %', new.timezone using errcode = '22023';
  end;

  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    if new.id <> old.id
       or new.join_code <> old.join_code
       or new.staff_code <> old.staff_code
       or new.created_by is distinct from old.created_by
       or new.created_at <> old.created_at then
      raise exception 'forbidden: id, codes and creator of a team can only be changed via RPC (regenerate_codes)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger teams_guard
  before insert or update on public.teams
  for each row execute function public.teams_guard();

-- players: Nicht-Staff darf team_id, user_id, active, is_new (und id) nicht ändern.
-- Verknüpfen mit einem Konto geht nur über join_team; Clients (auch Staff) dürfen
-- user_id nur unverändert lassen oder auf null setzen (Verknüpfung lösen). Sonst
-- könnte ein Trainer ein beliebiges fremdes Konto in sein Team holen.
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
    return new;  -- Staff: RLS-WITH-CHECK sichert zusätzlich das Zielteam ab
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

create or replace trigger players_guard
  before insert or update on public.players
  for each row execute function public.players_guard();

-- absences: team_id aus dem Spieler ableiten; Meldung durch Spieler erzwingen
create or replace function public.absences_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is null then
    new.team_id := public.player_team(new.player_id);
  end if;

  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
      if not public.is_staff_of_player(new.player_id) then
        -- Spieler meldet sich selbst ab
        new.reported_by_player := true;
        new.team_id := public.player_team(new.player_id);
      end if;
    else
      new.created_by := old.created_by;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger absences_prepare
  before insert or update on public.absences
  for each row execute function public.absences_prepare();

-- attendance: team_id aus dem Spieler ableiten, falls nicht angegeben
create or replace function public.attendance_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is null then
    new.team_id := public.player_team(new.player_id);
  end if;
  return new;
end;
$$;

create or replace trigger attendance_prepare
  before insert or update on public.attendance
  for each row execute function public.attendance_prepare();

-- created_by bei Client-Zugriffen fälschungssicher setzen bzw. beibehalten
create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by := old.created_by;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger rpe_entries_created_by
  before insert or update on public.rpe_entries
  for each row execute function public.set_created_by();

create or replace trigger potentials_created_by
  before insert or update on public.potentials
  for each row execute function public.set_created_by();

create or replace trigger coach_messages_created_by
  before insert or update on public.coach_messages
  for each row execute function public.set_created_by();

-- RPE-Eintrag ⇒ Anwesenheit 'da', falls an dem Tag eine Einheit stattfand
-- und noch kein Anwesenheitsstatus existiert (security definer, da Spieler
-- attendance nicht schreiben dürfen).
create or replace function public.rpe_mark_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
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

create or replace trigger rpe_entries_mark_attendance
  after insert on public.rpe_entries
  for each row execute function public.rpe_mark_attendance();

-- Ergänzung (gleiche Regel, umgekehrte Reihenfolge): wird der Schnappschuss
-- einer Einheit erst nach den RPE-Einträgen gespeichert, bekommen Spieler mit
-- RPE an diesem Tag ebenfalls 'da' (sofern noch kein Status existiert).
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
  where p.team_id = new.team_id and r.date = new.date
  on conflict (player_id, date) do nothing;
  return null;
end;
$$;

create or replace trigger sessions_mark_attendance
  after insert on public.sessions
  for each row execute function public.sessions_mark_attendance();

revoke all on function public.teams_guard()              from public, anon, authenticated;
revoke all on function public.players_guard()            from public, anon, authenticated;
revoke all on function public.absences_prepare()         from public, anon, authenticated;
revoke all on function public.attendance_prepare()       from public, anon, authenticated;
revoke all on function public.set_created_by()           from public, anon, authenticated;
revoke all on function public.rpe_mark_attendance()      from public, anon, authenticated;
revoke all on function public.sessions_mark_attendance() from public, anon, authenticated;
