-- =====================================================================
-- Paket 11.5: Datenschutz-Funktionen für die Mannschaftskasse.
-- - merge_players v4: Zahlungen und Befreiungen übernehmen (ohne Doppelungen)
-- - my_data_export v4: eigene Zahlungen und Befreiungen (Schmerzangaben stecken in wellness_entries)
-- =====================================================================

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


-- Datenexport (Art. 15/20 DSGVO), Version 4 (zusätzlich Mannschaftskasse)
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
    'format', 'trainerbank-export-v4',
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

