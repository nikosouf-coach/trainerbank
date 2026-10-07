-- =====================================================================
-- Baustein 9: Kontaktliste, Datenschutz-Funktionen für die neuen Tabellen,
-- Befund-Dateien nach dem Zusammenführen von Spielern.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kontaktliste (Koordinator, Vorstand, Physio, Arztpraxis, Trainer …)
--    Staff verwaltet; Spieler sehen freigegebene Kontakte, wenn „contacts“ im
--    Baukasten an ist.
-- ---------------------------------------------------------------------
create table if not exists public.team_contacts (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  role       text not null check (role in ('trainer', 'koordinator', 'vorstand', 'physio', 'arzt', 'betreuer', 'sonst')),
  org        text check (org is null or char_length(org) <= 160),
  phone      text check (phone is null or char_length(phone) <= 40),
  email      text check (email is null or char_length(email) <= 200),
  address    text check (address is null or char_length(address) <= 300),
  note       text check (note is null or char_length(note) <= 1000),
  visible    boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists team_contacts_team_idx on public.team_contacts (team_id);

alter table public.team_contacts enable row level security;
drop policy if exists team_contacts_select on public.team_contacts;
create policy team_contacts_select on public.team_contacts for select to authenticated
  using (public.is_team_staff(team_id)
         or (visible and public.is_team_member(team_id) and public.player_view(team_id, 'contacts')));
drop policy if exists team_contacts_write on public.team_contacts;
create policy team_contacts_write on public.team_contacts for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.team_contacts to authenticated;

-- ---------------------------------------------------------------------
-- 2. Befunde: Pfadprüfung nur beim Anlegen bzw. wenn sich der Pfad ändert
--    (beim Zusammenführen wandert die Zeile zum anderen Spieler, die Datei bleibt).
--    Zugriff auf Dateien zusätzlich über die zugehörige Befund-Zeile.
-- ---------------------------------------------------------------------
create or replace function public.findings_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.team_id := public.player_team(new.player_id);
  if tg_op = 'INSERT' or new.path is distinct from old.path then
    if new.path !~ ('^' || new.team_id::text || '/' || new.player_id::text || '/') then
      raise exception 'invalid_path' using errcode = '22023';
    end if;
  elsif new.team_id is distinct from old.team_id then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.findings_prepare() from public, anon, authenticated;

create or replace function public.finding_row_role(p_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when bool_or(public.is_team_staff(f.team_id)) then 'staff'
           when bool_or(public.is_own_player(f.player_id)) then 'player'
         end
    from public.findings f where f.path = p_name
$$;
revoke all on function public.finding_row_role(text) from public, anon;
grant execute on function public.finding_row_role(text) to authenticated, service_role;

drop policy if exists findings_obj_select on storage.objects;
create policy findings_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'findings' and (public.finding_access(storage.foldername(name)) is not null or public.finding_row_role(name) is not null));
drop policy if exists findings_obj_delete on storage.objects;
create policy findings_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'findings' and (public.finding_access(storage.foldername(name)) = 'staff' or public.finding_row_role(name) = 'staff'));

-- ---------------------------------------------------------------------
-- 3. Spieler zusammenführen: auch Spieldaten, Noten, Tests, Befunde, Videos
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
  update public.rpe_entries r set player_id = p_existing
   where r.player_id = p_new
     and not exists (select 1 from public.rpe_entries x where x.player_id = p_existing and x.date = r.date);
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

  -- Rest (Konfliktzeilen) wird per Cascade mit der neuen Zeile gelöscht.
  -- Hinweis: ein Foto {team_id}/{p_new}.jpg muss die App per Storage-API entfernen.
  delete from public.players where id = p_new;
  return p_existing;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Datenexport (Art. 15/20 DSGVO), Version 2: inkl. Spieldaten, freigegebener
--    Noten, Leistungstests und Befunde (Metadaten; Dateien lädt die App einzeln).
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
    'format', 'trainerbank-export-v2',
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
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated, service_role;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;
