-- =====================================================================
-- Paket B: Matchplan
-- - match_plans: Aufstellung (Grundordnung, Startelf, Bank, Kapitän), Taktik- und Standardfolien mit Ausschnitt,
--   Spielidee, Gegneranalyse, Spieleraufgaben und Wechselplan (Inhalt als JSON, nur Trainerteam)
-- - Freigabe: veröffentlichter Stand (nur freigegebene Bereiche und Folien) mit Zeitraum (Standard: bis Spielende),
--   optional nur für den Kader, Aufgaben standardmäßig nur die eigene. Spieler lesen ausschließlich über
--   match_plan_open() – jeder Aufruf wird protokolliert; erkannte Screenshots meldet match_plan_event()
-- - match_plan_views: Zugriffsprotokoll (Trainerteam liest, Einträge nur über die Funktionen), Löschfrist 6 Monate
-- - Modul „matchplan“ für bestehende Teams einschalten (war bisher nicht wählbar)
-- - merge_players v7, Datenexport v6 (eigene Einträge im Zugriffsprotokoll)
-- =====================================================================

create table if not exists public.match_plans (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams (id) on delete cascade,
  match_id        uuid references public.matches (id) on delete set null,
  title           text not null default '' check (char_length(title) <= 80),
  content         jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 300000),
  share_sections  text[] not null default '{}' check (share_sections <@ array['lineup', 'slides', 'idea', 'opp', 'tasks', 'subs']::text[]),
  share_from      timestamptz,
  share_until     timestamptz,
  share_squad     boolean not null default false,
  share_own_tasks boolean not null default true,
  -- Kader zum Zeitpunkt der Freigabe (Startelf + Bank) – für „nur Kader“
  squad           uuid[] not null default '{}' check (cardinality(squad) <= 40),
  published       jsonb check (published is null or (jsonb_typeof(published) = 'object' and pg_column_size(published) <= 300000)),
  published_at    timestamptz,
  published_by    uuid references auth.users (id) on delete set null,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint match_plans_share_check check (published is null or (share_until is not null and (share_from is null or share_from < share_until)))
);
-- ein Plan je Spiel; Pläne ohne Spiel (z. B. Vorlagen für ein Turnier) beliebig viele
create unique index if not exists match_plans_match_uq on public.match_plans (match_id) where match_id is not null;
create index if not exists match_plans_team_idx on public.match_plans (team_id, updated_at);

create table if not exists public.match_plan_views (
  id        bigint generated always as identity primary key,
  team_id   uuid not null references public.teams (id) on delete cascade,
  plan_id   uuid not null references public.match_plans (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  kind      text not null default 'open' check (kind in ('open', 'shot')),
  platform  text check (platform is null or platform in ('ios', 'android', 'web')),
  at        timestamptz not null default now()
);
create index if not exists match_plan_views_plan_idx on public.match_plan_views (plan_id, player_id, at);
create index if not exists match_plan_views_at_idx on public.match_plan_views (at);

-- Prüfungen: Spiel und Kader aus dem eigenen Team; Zeitpunkt und Person der Veröffentlichung setzt der Server
create or replace function public.match_plans_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new.match_id is not null and (tg_op = 'INSERT' or new.match_id is distinct from old.match_id)
     and not exists (select 1 from public.matches m where m.id = new.match_id and m.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if cardinality(new.squad) > 0 and exists (select 1 from unnest(new.squad) x where public.player_team(x) is distinct from new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.published is null then
    new.share_sections := '{}'; new.share_from := null; new.share_until := null; new.squad := '{}';
    new.published_at := null; new.published_by := null;
  elsif current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' or new.published is distinct from old.published then
      new.published_at := now(); new.published_by := auth.uid();
    else
      new.published_at := old.published_at; new.published_by := old.published_by;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.match_plans_prepare() from public, anon, authenticated;
drop trigger if exists match_plans_prepare on public.match_plans;
create trigger match_plans_prepare before insert or update on public.match_plans
  for each row execute function public.match_plans_prepare();

alter table public.match_plans      enable row level security;
alter table public.match_plan_views enable row level security;

-- Spieler haben keinen direkten Zugriff (auch nicht auf freigegebene Pläne) – nur über match_plan_open()
drop policy if exists match_plans_select on public.match_plans;
create policy match_plans_select on public.match_plans for select to authenticated
  using (public.is_team_staff(team_id));
drop policy if exists match_plans_write on public.match_plans;
create policy match_plans_write on public.match_plans for all to authenticated
  using (public.staff_can(team_id, 'plan')) with check (public.staff_can(team_id, 'plan'));
drop policy if exists match_plan_views_select on public.match_plan_views;
create policy match_plan_views_select on public.match_plan_views for select to authenticated
  using (public.is_team_staff(team_id));
grant select, insert, update, delete on public.match_plans to authenticated;
grant select on public.match_plan_views to authenticated;

-- ---------------------------------------------------------------------
-- Spieler: freigegebene Pläne finden, öffnen (mit Protokoll), Screenshot melden
-- ---------------------------------------------------------------------
-- Spielerzeile des angemeldeten Kontos, die den Plan jetzt sehen darf (Modul an, freigegeben, im Zeitraum, ggf. im Kader)
create or replace function public.match_plan_viewer(p_plan uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
    from public.match_plans mp
    join public.teams t on t.id = mp.team_id
    join public.players p on p.team_id = mp.team_id and p.user_id = auth.uid() and p.active
   where mp.id = p_plan and mp.published is not null
     and (t.modules ->> 'matchplan') is distinct from 'false'
     and now() >= coalesce(mp.share_from, '-infinity'::timestamptz) and now() < mp.share_until
     and (not mp.share_squad or p.id = any (mp.squad))
   limit 1
$$;
revoke all on function public.match_plan_viewer(uuid) from public, anon, authenticated;

create or replace function public.my_match_plans(p_team uuid)
returns table (id uuid, match_id uuid, title text, share_until timestamptz, published_at timestamptz, seen boolean)
language sql
stable
security definer
set search_path = public
as $$
  select mp.id, mp.match_id, mp.title, mp.share_until, mp.published_at,
         exists (select 1 from public.match_plan_views v
                  where v.plan_id = mp.id and v.player_id = p.id and v.kind = 'open' and v.at >= mp.published_at)
    from public.match_plans mp
    join public.teams t on t.id = mp.team_id
    join public.players p on p.team_id = mp.team_id and p.user_id = auth.uid() and p.active
   where mp.team_id = p_team and mp.published is not null
     and (t.modules ->> 'matchplan') is distinct from 'false'
     and now() >= coalesce(mp.share_from, '-infinity'::timestamptz) and now() < mp.share_until
     and (not mp.share_squad or p.id = any (mp.squad))
   order by mp.share_until
$$;
revoke all on function public.my_match_plans(uuid) from public, anon;
grant execute on function public.my_match_plans(uuid) to authenticated;

create or replace function public.match_plan_open(p_plan uuid, p_platform text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  mp    public.match_plans;
  pl    public.players;
  c     jsonb;
  t     jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_pid := public.match_plan_viewer(p_plan);
  if v_pid is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into mp from public.match_plans where id = p_plan;
  select * into pl from public.players where id = v_pid;
  -- Zugriffsprotokoll: höchstens ein Eintrag je Spieler und Plan in 10 Minuten
  if not exists (select 1 from public.match_plan_views v
                  where v.plan_id = p_plan and v.player_id = v_pid and v.kind = 'open' and v.at > now() - interval '10 minutes') then
    insert into public.match_plan_views (team_id, plan_id, player_id, kind, platform)
    values (mp.team_id, p_plan, v_pid, 'open', case when p_platform in ('ios', 'android', 'web') then p_platform end);
  end if;
  c := mp.published;
  -- Aufgaben: jeder sieht nur die eigene (Standard)
  if mp.share_own_tasks and c ? 'tasks' then
    t := c -> 'tasks' -> (v_pid::text);
    c := jsonb_set(c, '{tasks}', case when t is null then '{}'::jsonb else jsonb_build_object(v_pid::text, t) end);
  end if;
  return jsonb_build_object(
    'id', mp.id, 'matchId', mp.match_id, 'title', mp.title, 'content', c, 'pid', v_pid,
    'name', btrim(pl.first_name || coalesce(' ' || pl.last_name, '')),
    'until', mp.share_until, 'at', mp.published_at, 'ownTasks', mp.share_own_tasks);
end;
$$;
revoke all on function public.match_plan_open(uuid, text) from public, anon;
grant execute on function public.match_plan_open(uuid, text) to authenticated;

-- Erkannter Screenshot (iOS, Android 14+): Eintrag im Protokoll, höchstens 20 je Spieler und Plan
create or replace function public.match_plan_event(p_plan uuid, p_kind text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_team uuid;
begin
  if p_kind is distinct from 'shot' then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  v_pid := public.match_plan_viewer(p_plan);
  if v_pid is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select team_id into v_team from public.match_plans where id = p_plan;
  if (select count(*) from public.match_plan_views v where v.plan_id = p_plan and v.player_id = v_pid and v.kind = 'shot') >= 20 then
    return;
  end if;
  insert into public.match_plan_views (team_id, plan_id, player_id, kind, platform)
  values (v_team, p_plan, v_pid, 'shot', case when p_platform in ('ios', 'android', 'web') then p_platform end);
end;
$$;
revoke all on function public.match_plan_event(uuid, text, text) from public, anon;
grant execute on function public.match_plan_event(uuid, text, text) to authenticated;

-- Modul „Matchplan“ war bisher nicht wählbar (überall aus) – für bestehende Teams einschalten
update public.teams set modules = modules || '{"matchplan": true}'::jsonb
 where (modules ->> 'matchplan') is distinct from 'true';

-- ---------------------------------------------------------------------
-- merge_players v7: Matchplan (Kader, Inhalte, Zugriffsprotokoll)
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
-- Löschfristen: Chat-Nachrichten nach 24 Monaten, erledigte Meldungen und abgeschlossene
-- Anfragen für Individualtraining nach 12 Monaten, Zugriffsprotokoll der Matchpläne nach 6 Monaten,
-- Push-Drosselung nach 30 Tagen
-- ---------------------------------------------------------------------
create or replace function public.purge_stale_health_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_health_cutoff date := (current_date - interval '24 months')::date;
  v_org_cutoff    date := (current_date - interval '12 months')::date;
  v_log_cutoff    date := current_date - 30;
  n_rpe int; n_wellness int; n_extra int; n_push int; n_ai int; n_fines int; n_duties int; n_tasks int;
  n_chat int; n_reports int; n_indiv int; n_chatpush int; n_mpviews int;
begin
  delete from public.rpe_entries      where date < v_health_cutoff; get diagnostics n_rpe = row_count;
  delete from public.wellness_entries where date < v_health_cutoff; get diagnostics n_wellness = row_count;
  delete from public.extra_activities where date < v_health_cutoff; get diagnostics n_extra = row_count;
  delete from public.push_log         where day  < v_log_cutoff;    get diagnostics n_push = row_count;
  -- KI-Tageszähler werden nach 30 Tagen ebenfalls nicht mehr gebraucht
  delete from public.ai_usage         where day  < v_log_cutoff;    get diagnostics n_ai = row_count;
  -- Dienste zuerst (Strafen-Dienste hängen per fine_id an der Strafe)
  delete from public.team_duties      where date < v_org_cutoff;    get diagnostics n_duties = row_count;
  delete from public.team_fines       where date < v_org_cutoff and status in ('done', 'waived'); get diagnostics n_fines = row_count;
  delete from public.team_tasks       where done_at is not null and done_at < v_org_cutoff; get diagnostics n_tasks = row_count;
  -- Chat
  delete from public.chat_messages    where created_at < v_health_cutoff; get diagnostics n_chat = row_count;
  delete from public.chat_reports     where status = 'done' and coalesce(handled_at, created_at) < v_org_cutoff; get diagnostics n_reports = row_count;
  delete from public.chat_push_log    where sent_at < v_log_cutoff; get diagnostics n_chatpush = row_count;
  delete from public.indiv_requests   where status <> 'open' and updated_at < v_org_cutoff; get diagnostics n_indiv = row_count;
  delete from public.match_plan_views where at < now() - interval '6 months'; get diagnostics n_mpviews = row_count;
  return jsonb_build_object(
    'rpe_entries', n_rpe, 'wellness_entries', n_wellness, 'extra_activities', n_extra,
    'push_log', n_push, 'ai_usage', n_ai, 'team_duties', n_duties, 'team_fines', n_fines, 'team_tasks', n_tasks,
    'chat_messages', n_chat, 'chat_reports', n_reports, 'chat_push_log', n_chatpush, 'indiv_requests', n_indiv,
    'match_plan_views', n_mpviews,
    'health_cutoff', v_health_cutoff, 'org_cutoff', v_org_cutoff, 'log_cutoff', v_log_cutoff
  );
end;
$$;
revoke all on function public.purge_stale_health_data() from public, anon, authenticated;
grant execute on function public.purge_stale_health_data() to service_role;

-- ---------------------------------------------------------------------
-- Datenexport v6 (Art. 15/20 DSGVO): zusätzlich die eigenen Einträge im Zugriffsprotokoll der Matchpläne
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
    'format', 'trainerbank-export-v6',
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
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated;
