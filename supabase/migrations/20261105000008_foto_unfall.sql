-- =====================================================================
-- Foto-Erlaubnis und Unfallmeldungen (Geburtstage brauchen keine Tabelle: players.birthdate, sichtbar wie bisher)
-- - photo_consents: je Spieler eine Erklärung – Vereinswebsite, Social Media, Presse und Druck, Name zum Foto
--   (ja/nein/offen), wer erklärt hat (Spieler, Eltern, beide), Datum, Hinweis. Lesen: Trainerteam und der Spieler selbst;
--   schreiben nur über photo_consent_save – Trainerteam mit Recht „squad“ (aus dem Formular) oder der Spieler selbst:
--   „Nein“ immer, „Ja“ nur volljährig (bzw. ohne Geburtsdatum in einem Erwachsenenteam), dann gilt die Erklärung als seine
-- - accident_reports: Sportunfall (Tag, Uhrzeit, Ort, Tätigkeit, Spiel, Verletzung aus den Abwesenheiten, Hergang,
--   Verletzung, Körperregion, Erste Hilfe, Behandlung, Zeugen, Meldung an Verein und Versicherung, Schadennummer,
--   abgeschlossen, Hinweis) – Gesundheitsdaten: lesen das Trainerteam mit Recht „health“ und der Spieler selbst; schreiben
--   nur das Trainerteam mit „health“; Löschfrist 36 Monate nach dem Unfall (purge_old_accidents, täglich)
-- - merge_players v15 (Foto-Erlaubnis: die zuletzt geänderte gilt; Unfallmeldungen wandern mit), Export v16
-- =====================================================================

-- ---------------------------------------------------------------------
-- Foto-Erlaubnis
-- ---------------------------------------------------------------------
create table if not exists public.photo_consents (
  player_id  uuid primary key references public.players (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  web        boolean,
  social     boolean,
  press      boolean,
  name_ok    boolean,
  given_by   text constraint photo_consents_by_valid check (given_by in ('player', 'parents', 'both')),
  given_on   date constraint photo_consents_on_valid check (given_on between date '2000-01-01' and date '2100-12-31'),
  note       text constraint photo_consents_note_valid check (char_length(btrim(note)) between 1 and 200 and note !~ '[[:cntrl:]]'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index if not exists photo_consents_team_idx on public.photo_consents (team_id);
alter table public.photo_consents enable row level security;
drop policy if exists photo_consents_select on public.photo_consents;
create policy photo_consents_select on public.photo_consents for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));
revoke all on public.photo_consents from anon;
revoke insert, update, delete on public.photo_consents from authenticated;
grant select on public.photo_consents to authenticated;

-- Speichern: Trainerteam (Recht „squad“) trägt die Erklärung aus dem Formular ein; der Spieler selbst sagt „Nein“ immer
-- und „Ja“ nur volljährig (ohne Geburtsdatum nur in einem Erwachsenenteam) – dann gilt die Erklärung als seine (heute)
create or replace function public.photo_consent_save(p_player uuid, p_web boolean, p_social boolean, p_press boolean, p_name boolean,
                                                     p_by text, p_on date, p_note text)
returns public.photo_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  uuid;
  v_old   public.photo_consents;
  v_row   public.photo_consents;
  v_birth date;
  v_cls   text;
  v_today date;
  v_self  boolean;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_team := public.player_team(p_player);
  if v_team is null or not public.is_team_member(v_team) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('photo_consent:' || p_player::text));
  select * into v_old from public.photo_consents where player_id = p_player;
  v_today := public.team_today(v_team);

  if public.staff_can(v_team, 'squad') then
    if p_by is not null and p_by not in ('player', 'parents', 'both') then
      raise exception 'invalid_by' using errcode = '22023';
    end if;
    if p_on is not null and p_on > v_today + 1 then
      raise exception 'date_future' using errcode = '22023';
    end if;
    insert into public.photo_consents (player_id, team_id, web, social, press, name_ok, given_by, given_on, note, updated_at, updated_by)
    values (p_player, v_team, p_web, p_social, p_press, p_name, p_by, p_on, v_note, now(), auth.uid())
    on conflict (player_id) do update
      set web = excluded.web, social = excluded.social, press = excluded.press, name_ok = excluded.name_ok, given_by = excluded.given_by,
          given_on = excluded.given_on, note = excluded.note, updated_at = now(), updated_by = auth.uid()
    returning * into v_row;
    return v_row;
  end if;

  if not public.is_own_player(p_player) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select p.birthdate into v_birth from public.players p where p.id = p_player;
  select t.age_class into v_cls from public.teams t where t.id = v_team;
  v_self := case when v_birth is not null then v_birth <= (v_today - interval '18 years')::date else v_cls in ('sen', 'ue32') end;
  -- je Kanal: unverändert, „Nein“ oder (volljährig) „Ja“ – zurück auf „offen“ nur über das Trainerteam
  if (p_web is distinct from v_old.web and not coalesce(p_web = false or (p_web and v_self), false))
     or (p_social is distinct from v_old.social and not coalesce(p_social = false or (p_social and v_self), false))
     or (p_press is distinct from v_old.press and not coalesce(p_press = false or (p_press and v_self), false))
     or (p_name is distinct from v_old.name_ok and not coalesce(p_name = false or (p_name and v_self), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_old.player_id is not null and p_web is not distinct from v_old.web and p_social is not distinct from v_old.social
     and p_press is not distinct from v_old.press and p_name is not distinct from v_old.name_ok then
    return v_old;
  end if;
  insert into public.photo_consents (player_id, team_id, web, social, press, name_ok, given_by, given_on, note, updated_at, updated_by)
  values (p_player, v_team, p_web, p_social, p_press, p_name,
          case when v_self then 'player' else v_old.given_by end, case when v_self then v_today else v_old.given_on end, v_old.note, now(), auth.uid())
  on conflict (player_id) do update
    set web = excluded.web, social = excluded.social, press = excluded.press, name_ok = excluded.name_ok, given_by = excluded.given_by,
        given_on = excluded.given_on, updated_at = now(), updated_by = auth.uid()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.photo_consent_save(uuid, boolean, boolean, boolean, boolean, text, date, text) from public, anon;
grant execute on function public.photo_consent_save(uuid, boolean, boolean, boolean, boolean, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- Unfallmeldungen (Gesundheitsdaten)
-- ---------------------------------------------------------------------
create table if not exists public.accident_reports (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  player_id     uuid not null references public.players (id) on delete cascade,
  accident_date date not null constraint accident_reports_date_valid check (accident_date between date '2000-01-01' and date '2100-12-31'),
  accident_time text constraint accident_reports_time_valid check (accident_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  place         text constraint accident_reports_place_valid check (char_length(btrim(place)) between 1 and 120 and place !~ '[[:cntrl:]]'),
  activity      text not null default 'training' constraint accident_reports_activity_valid check (activity in ('training', 'match', 'travel', 'other')),
  match_id      uuid references public.matches (id) on delete set null,
  absence_id    uuid references public.absences (id) on delete set null,
  how           text not null constraint accident_reports_how_valid check (char_length(btrim(how)) between 1 and 1000),
  injury        text not null constraint accident_reports_injury_valid check (char_length(btrim(injury)) between 1 and 300),
  body_area     text constraint accident_reports_area_valid check (body_area ~ '^[a-z_]{2,20}(:[lrb])?$'),
  first_aid     text constraint accident_reports_first_aid_valid check (char_length(btrim(first_aid)) between 1 and 300),
  treatment     text constraint accident_reports_treatment_valid check (char_length(btrim(treatment)) between 1 and 300),
  witnesses     text constraint accident_reports_witnesses_valid check (char_length(btrim(witnesses)) between 1 and 300),
  club_on       date,
  insurer_on    date,
  claim_no      text constraint accident_reports_claim_valid check (char_length(btrim(claim_no)) between 1 and 60 and claim_no !~ '[[:cntrl:]]'),
  closed        boolean not null default false,
  note          text constraint accident_reports_note_valid check (char_length(btrim(note)) between 1 and 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  constraint accident_reports_club_after check (club_on is null or club_on >= accident_date),
  constraint accident_reports_insurer_after check (insurer_on is null or insurer_on >= accident_date)
);
create index if not exists accident_reports_team_idx on public.accident_reports (team_id);
create index if not exists accident_reports_player_idx on public.accident_reports (player_id);
create index if not exists accident_reports_date_idx on public.accident_reports (accident_date);

-- Team aus dem Spieler; Spiel aus demselben Team (nur bei Spiel oder Weg), Verletzung desselben Spielers; Tage nicht in
-- der Zukunft (ein Tag Spielraum für Zeitzonen); Spieler nicht wechselbar (außer beim Zusammenführen); Konto und Zeit
create or replace function public.accident_reports_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_today date;
begin
  if tg_op = 'UPDATE' and new.player_id <> old.player_id and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  new.team_id := public.player_team(new.player_id);
  if new.team_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if new.activity not in ('match', 'travel') then
    new.match_id := null;
  end if;
  if new.match_id is not null and public.match_team(new.match_id) is distinct from new.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.absence_id is not null and not exists (select 1 from public.absences a where a.id = new.absence_id and a.player_id = new.player_id) then
    raise exception 'different_player' using errcode = '22023';
  end if;
  v_today := public.team_today(new.team_id);
  if new.accident_date > v_today + 1 or new.club_on > v_today + 1 or new.insurer_on > v_today + 1 then
    raise exception 'date_future' using errcode = '22023';
  end if;
  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    new.updated_by := auth.uid();
    if tg_op = 'INSERT' then
      new.created_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.accident_reports_prepare() from public, anon, authenticated;
drop trigger if exists accident_reports_prepare on public.accident_reports;
create trigger accident_reports_prepare before insert or update on public.accident_reports
  for each row execute function public.accident_reports_prepare();

alter table public.accident_reports enable row level security;
drop policy if exists accident_reports_select on public.accident_reports;
create policy accident_reports_select on public.accident_reports for select to authenticated
  using (public.staff_can(team_id, 'health') or public.is_own_player(player_id));
drop policy if exists accident_reports_insert on public.accident_reports;
create policy accident_reports_insert on public.accident_reports for insert to authenticated
  with check (public.staff_can(team_id, 'health'));
drop policy if exists accident_reports_update on public.accident_reports;
create policy accident_reports_update on public.accident_reports for update to authenticated
  using (public.staff_can(team_id, 'health')) with check (public.staff_can(team_id, 'health'));
drop policy if exists accident_reports_delete on public.accident_reports;
create policy accident_reports_delete on public.accident_reports for delete to authenticated
  using (public.staff_can(team_id, 'health'));
revoke all on public.accident_reports from anon;
grant select, insert, update, delete on public.accident_reports to authenticated;

-- Löschfrist: 36 Monate nach dem Unfall (Verjährung von Ansprüchen; danach braucht es niemand mehr)
create or replace function public.purge_old_accidents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.accident_reports where accident_date < (current_date - interval '36 months')::date;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_accidents() from public, anon, authenticated;
grant execute on function public.purge_old_accidents() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-old-accidents: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-old-accidents', '20 4 * * *', 'select public.purge_old_accidents()');
exception when others then
  raise notice 'purge-old-accidents konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------
-- merge_players v15: zusätzlich Foto-Erlaubnis und Unfallmeldungen (sonst wie v14, 20261105000007)
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

  -- Foto-Erlaubnis: die zuletzt geänderte Erklärung gilt
  if exists (select 1 from public.photo_consents n where n.player_id = p_new
             and n.updated_at > coalesce((select e.updated_at from public.photo_consents e where e.player_id = p_existing), '-infinity'::timestamptz)) then
    delete from public.photo_consents where player_id = p_existing;
    update public.photo_consents set player_id = p_existing, team_id = public.player_team(p_existing) where player_id = p_new;
  end if;
  -- Unfallmeldungen übernehmen
  update public.accident_reports set player_id = p_existing where player_id = p_new;

  -- Eingetragene Sperren übernehmen (je Karte nur eine – doppelte bleiben bei der neuen Zeile)
  update public.player_suspensions x set player_id = p_existing
   where x.player_id = p_new
     and (x.match_id is null
          or not exists (select 1 from public.player_suspensions y where y.player_id = p_existing and y.match_id = x.match_id and y.kind = x.kind));

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
-- Datenexport v16 (Art. 15/20 DSGVO): zusätzlich Foto-Erlaubnis und Unfallmeldungen
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
    'format', 'trainerstab-export-v16',
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
       where n.player_id = any (v_players)), '[]'::jsonb),
    -- Karten stehen in match_stats (card); eingetragene Sperren der eigenen Spielerzeilen
    'suspensions', coalesce((
      select jsonb_agg(jsonb_build_object('kind', x.kind, 'match_date', m.date, 'opponent', m.opponent, 'start', x.start_date, 'games', x.games,
                                          'until', x.until_date, 'scope', x.scope, 'note', x.note, 'updated_at', x.updated_at) order by x.start_date)
        from public.player_suspensions x left join public.matches m on m.id = x.match_id
       where x.player_id = any (v_players)), '[]'::jsonb),
    -- Foto-Erlaubnis und Unfallmeldungen der eigenen Spielerzeilen
    'photo_consents', coalesce((
      select jsonb_agg(jsonb_build_object('website', c.web, 'social_media', c.social, 'press', c.press, 'name', c.name_ok, 'declared_by', c.given_by,
                                          'declared_on', c.given_on, 'note', c.note, 'updated_at', c.updated_at))
        from public.photo_consents c
       where c.player_id = any (v_players)), '[]'::jsonb),
    'accident_reports', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.accident_date, 'time', a.accident_time, 'place', a.place, 'activity', a.activity, 'match_date', m.date,
                                          'opponent', m.opponent, 'how', a.how, 'injury', a.injury, 'body_area', a.body_area, 'first_aid', a.first_aid,
                                          'treatment', a.treatment, 'witnesses', a.witnesses, 'reported_to_club', a.club_on, 'reported_to_insurer', a.insurer_on,
                                          'claim_number', a.claim_no, 'closed', a.closed, 'note', a.note, 'updated_at', a.updated_at) order by a.accident_date)
        from public.accident_reports a left join public.matches m on m.id = a.match_id
       where a.player_id = any (v_players)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;
