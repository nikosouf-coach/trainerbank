-- =====================================================================
-- Kader-Nominierung fürs Spiel
-- - match_squads: Kader je Spiel – Treffpunkt (Uhrzeit, Ort), Hinweis, ob die Nominierten den ganzen Kader sehen
--   (show_all), veröffentlicht (published_at, setzt der Server; null = Entwurf). Lesen: Trainerteam; Spieler nur
--   veröffentlichte Kader, in denen sie nominiert sind. Schreiben: Recht „plan“ (wie Spiele und Matchpläne)
-- - match_nominations: im Kader oder auf Abruf (standby), Zu-/Absage mit Grund (nur bei Absage). Lesen: Trainerteam;
--   Spieler die eigene Nominierung (veröffentlicht). Schreiben: Recht „plan“ (auch Antworten – answered_by_staff).
--   Spieler antworten über answer_nomination: nur wenn „Absagen durch Spieler“ erlaubt ist (settings.playerAbs, wie
--   bei Trainings) und bis zum Anpfiff (Zeitzone des Teams)
-- - squad_mates(team): Kaderliste für nominierte Spieler (Vorname und Initial, Nummer, Position, auf Abruf), nur
--   wenn show_all
-- - Löschen: mit dem Spiel bzw. Spieler (cascade); Kader 12 Monate nach dem Spiel (purge_old_squads);
--   merge_players v12; Export v13
-- =====================================================================

-- Team eines Spiels bzw. Kaders (security definer: Prüfung unabhängig von den Leserechten; die Regeln entscheiden)
create or replace function public.match_team(p_match uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.team_id from public.matches m where m.id = p_match
$$;
revoke all on function public.match_team(uuid) from public, anon;
grant execute on function public.match_team(uuid) to authenticated, service_role;

create table if not exists public.match_squads (
  match_id     uuid primary key references public.matches (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  meet_time    text constraint match_squads_meet_time_valid check (meet_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  meet_place   text constraint match_squads_meet_place_valid check (char_length(btrim(meet_place)) between 1 and 120 and meet_place !~ '[[:cntrl:]]'),
  note         text constraint match_squads_note_valid check (char_length(btrim(note)) between 1 and 500),
  show_all     boolean not null default true,
  published_at timestamptz,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);
create index if not exists match_squads_team_idx on public.match_squads (team_id);

create table if not exists public.match_nominations (
  match_id          uuid not null references public.match_squads (match_id) on delete cascade,
  player_id         uuid not null references public.players (id) on delete cascade,
  team_id           uuid not null references public.teams (id) on delete cascade,
  standby           boolean not null default false,
  answer            text constraint match_nominations_answer_valid check (answer in ('yes', 'no')),
  reason            text constraint match_nominations_reason_valid check (char_length(btrim(reason)) between 1 and 200 and reason !~ '[[:cntrl:]]'),
  answered_at       timestamptz,
  answered_by_staff boolean not null default false,
  created_at        timestamptz not null default now(),
  primary key (match_id, player_id),
  constraint match_nominations_reason_no check (reason is null or answer = 'no')
);
create index if not exists match_nominations_team_idx on public.match_nominations (team_id);
create index if not exists match_nominations_player_idx on public.match_nominations (player_id);

-- Kader: Team aus dem Spiel, Spiel nicht wechselbar, Zeitpunkt der Veröffentlichung, Änderung und Konto setzt der Server
create or replace function public.match_squads_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.match_id <> old.match_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.team_id := public.match_team(new.match_id);
    if new.team_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    new.team_id := old.team_id;
  end if;
  if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
    new.published_at := now();
  elsif new.published_at is not null then
    new.published_at := old.published_at;
  end if;
  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.match_squads_prepare() from public, anon, authenticated;
drop trigger if exists match_squads_prepare on public.match_squads;
create trigger match_squads_prepare before insert or update on public.match_squads
  for each row execute function public.match_squads_prepare();

-- Nominierung: Team aus dem Kader, Spieler aus demselben Team; Antworten des Trainerteams (Clients) mit Zeitpunkt und
-- answered_by_staff – Spieler antworten nur über answer_nomination
create or replace function public.match_nominations_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_team uuid;
begin
  if tg_op = 'UPDATE' and (new.match_id <> old.match_id or new.player_id <> old.player_id) and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or new.match_id <> old.match_id or new.player_id <> old.player_id then
    v_team := public.match_team(new.match_id);
    if v_team is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if public.player_team(new.player_id) is distinct from v_team then
      raise exception 'different_teams' using errcode = '22023';
    end if;
    new.team_id := v_team;
  else
    new.team_id := old.team_id;
  end if;
  if new.answer is distinct from 'no' then
    new.reason := null;
  end if;
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_at := now();
    end if;
    if tg_op = 'INSERT' or new.answer is distinct from old.answer or new.reason is distinct from old.reason then
      new.answered_at := case when new.answer is null then null else now() end;
      new.answered_by_staff := new.answer is not null;
    else
      new.answered_at := old.answered_at;
      new.answered_by_staff := old.answered_by_staff;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.match_nominations_prepare() from public, anon, authenticated;
drop trigger if exists match_nominations_prepare on public.match_nominations;
create trigger match_nominations_prepare before insert or update on public.match_nominations
  for each row execute function public.match_nominations_prepare();

-- Hilfen für die Regeln (security definer, damit sich die Regeln der beiden Tabellen nicht gegenseitig aufrufen)
create or replace function public.squad_published(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.match_squads s where s.match_id = p_match and s.published_at is not null)
$$;
create or replace function public.nominated_me(p_match uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.match_nominations n join public.players p on p.id = n.player_id
                  where n.match_id = p_match and p.user_id = auth.uid())
$$;
revoke all on function public.squad_published(uuid) from public, anon;
revoke all on function public.nominated_me(uuid) from public, anon;
grant execute on function public.squad_published(uuid) to authenticated, service_role;
grant execute on function public.nominated_me(uuid) to authenticated, service_role;

alter table public.match_squads      enable row level security;
alter table public.match_nominations enable row level security;

drop policy if exists match_squads_select on public.match_squads;
create policy match_squads_select on public.match_squads for select to authenticated
  using (public.is_team_staff(team_id) or (published_at is not null and public.nominated_me(match_id)));
drop policy if exists match_squads_insert on public.match_squads;
create policy match_squads_insert on public.match_squads for insert to authenticated
  with check (public.staff_can(team_id, 'plan'));
drop policy if exists match_squads_update on public.match_squads;
create policy match_squads_update on public.match_squads for update to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));
drop policy if exists match_squads_delete on public.match_squads;
create policy match_squads_delete on public.match_squads for delete to authenticated
  using (public.staff_can(team_id, 'plan'));

drop policy if exists match_nominations_select on public.match_nominations;
create policy match_nominations_select on public.match_nominations for select to authenticated
  using (public.is_team_staff(team_id) or (public.is_own_player(player_id) and public.squad_published(match_id)));
drop policy if exists match_nominations_insert on public.match_nominations;
create policy match_nominations_insert on public.match_nominations for insert to authenticated
  with check (public.staff_can(team_id, 'plan'));
drop policy if exists match_nominations_update on public.match_nominations;
create policy match_nominations_update on public.match_nominations for update to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));
drop policy if exists match_nominations_delete on public.match_nominations;
create policy match_nominations_delete on public.match_nominations for delete to authenticated
  using (public.staff_can(team_id, 'plan'));

grant select, insert, update, delete on public.match_squads, public.match_nominations to authenticated;

-- ---------------------------------------------------------------------
-- Spieler sagen zu oder ab (eigene Nominierung, veröffentlicht, „Absagen durch Spieler“ an, vor dem Anpfiff)
-- ---------------------------------------------------------------------
create or replace function public.answer_nomination(p_match uuid, p_answer text, p_reason text default null)
returns public.match_nominations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid   uuid;
  v_match public.matches;
  v_team  public.teams;
  v_nom   public.match_nominations;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_answer is null or p_answer not in ('yes', 'no') then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;
  select n.player_id into v_pid
    from public.match_nominations n join public.players p on p.id = n.player_id
   where n.match_id = p_match and p.user_id = auth.uid();
  if v_pid is null or not public.squad_published(p_match) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_match from public.matches where id = p_match;
  select * into v_team from public.teams where id = v_match.team_id;
  if coalesce((v_team.settings ->> 'playerAbs')::boolean, true) = false then
    raise exception 'answers_off' using errcode = 'P0001';
  end if;
  if now() >= ((v_match.date + coalesce(nullif(v_match.time, ''), '23:59')::time)
               at time zone coalesce(nullif(v_team.timezone, ''), 'Europe/Berlin')) then
    raise exception 'match_started' using errcode = 'P0001';
  end if;
  v_reason := case when p_answer = 'no'
                   then nullif(btrim(left(btrim(regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g')), 200)), '') end;
  update public.match_nominations
     set answer = p_answer, reason = v_reason, answered_at = now(), answered_by_staff = false
   where match_id = p_match and player_id = v_pid
  returning * into v_nom;
  return v_nom;
end;
$$;
revoke all on function public.answer_nomination(uuid, text, text) from public, anon;
grant execute on function public.answer_nomination(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Kaderliste für nominierte Spieler (nur wenn show_all): Vorname und Initial, Nummer, Position, auf Abruf
-- ---------------------------------------------------------------------
create or replace function public.squad_mates(p_team uuid)
returns table (match_id uuid, player_id uuid, name text, nr integer, pos text, standby boolean)
language sql
stable
security definer
set search_path = public
as $$
  select n.match_id, n.player_id,
         btrim(p.first_name) || case when coalesce(btrim(p.last_name), '') = '' then '' else ' ' || upper(left(btrim(p.last_name), 1)) || '.' end,
         p.shirt_number::integer, coalesce(p.position, ''), n.standby
    from public.match_nominations n
    join public.match_squads s on s.match_id = n.match_id
    join public.matches m on m.id = n.match_id
    join public.players p on p.id = n.player_id
   where s.team_id = p_team and s.published_at is not null and s.show_all
     and m.date >= public.team_today(p_team) - 1
     and public.nominated_me(n.match_id)
$$;
revoke all on function public.squad_mates(uuid) from public, anon;
grant execute on function public.squad_mates(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- merge_players v12: zusätzlich Kader-Nominierungen (sonst wie v11, 20261105000004)
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
-- Datenexport v13 (Art. 15/20 DSGVO): zusätzlich eigene Kader-Nominierungen
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
    'format', 'trainerbank-export-v13',
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
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Löschfrist: Kader mit Nominierungen und Antworten 12 Monate nach dem Spiel
-- ---------------------------------------------------------------------
create or replace function public.purge_old_squads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.match_squads s
   using public.matches m
   where m.id = s.match_id and m.date < (current_date - interval '12 months')::date;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_squads() from public, anon, authenticated;
grant execute on function public.purge_old_squads() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-old-squads: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-old-squads', '45 3 * * *', 'select public.purge_old_squads()');
exception when others then
  raise notice 'purge-old-squads konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;
