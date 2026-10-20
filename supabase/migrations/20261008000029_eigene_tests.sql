-- =====================================================================
-- Leistungsdiagnostik: eigene Tests des Teams
-- - teams.settings.customTests: [{id, name, unit, lower, dec, how?, gk?}] – höchstens 12 (App: core/perf.cleanCustomTests)
-- - performance_tests.test und player_goals.test: eingebaute Tests oder "c:<id>" eines eigenen Tests des Teams
--   (Ergebnis nur, wenn der Test im Team existiert); Werte 0 … 99 999,99 (z. B. 0 Treffer)
-- - my_test_ranks: Richtung eigener Tests („kleiner ist besser“) aus den Team-Einstellungen
-- - Änderungen an customTests brauchen das Recht „perf“ (wie tests, testRank)
-- =====================================================================

-- Form der eigenen Tests (Größe begrenzt; Inhalte bereinigt die App)
do $$ begin
  alter table public.teams add constraint teams_custom_tests_check
    check ((settings -> 'customTests') is null
           or (jsonb_typeof(settings -> 'customTests') = 'array' and jsonb_array_length(settings -> 'customTests') <= 12
               and pg_column_size(settings -> 'customTests') <= 8000));
exception when duplicate_object then null; end $$;

-- Testschlüssel: eingebaut oder eigener Test
alter table public.performance_tests drop constraint if exists performance_tests_test_check;
alter table public.performance_tests add constraint performance_tests_test_check
  check (test in ('sprint10', 'sprint30', 'cmj', 'ift', 'yoyo', 'agility505', 'slalom', 'standweit', 'tw_lateral', 'tw_kick')
         or test ~ '^c:[A-Za-z0-9_-]{1,40}$');
alter table public.performance_tests drop constraint if exists performance_tests_value_check;
alter table public.performance_tests add constraint performance_tests_value_check check (value >= 0 and value < 100000);

alter table public.player_goals drop constraint if exists player_goals_test_check;
alter table public.player_goals add constraint player_goals_test_check
  check (test is null or test in ('sprint10', 'sprint30', 'cmj', 'ift', 'yoyo', 'agility505', 'slalom', 'standweit', 'tw_lateral', 'tw_kick')
         or test ~ '^c:[A-Za-z0-9_-]{1,40}$');

-- Gibt es den eigenen Test im Team? (läuft mit den Rechten des Aufrufers – das Trainerteam liest sein Team)
create or replace function public.team_has_test(p_team uuid, p_test text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_test !~ '^c:' or exists (
    select 1 from public.teams t, jsonb_array_elements(case when jsonb_typeof(t.settings -> 'customTests') = 'array' then t.settings -> 'customTests' else '[]'::jsonb end) e
     where t.id = p_team and 'c:' || (e ->> 'id') = p_test);
$$;
revoke all on function public.team_has_test(uuid, text) from public, anon;
grant execute on function public.team_has_test(uuid, text) to authenticated, service_role;

-- Testwerte: Team aus dem Spieler, eigener Test muss im Team angelegt sein
create or replace function public.performance_tests_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.team_id := public.player_team(new.player_id);
  -- nur bei neuen Werten bzw. geändertem Test prüfen (z. B. Zusammenführen von Spielern verschiebt bestehende Werte)
  if (tg_op = 'INSERT' or new.test is distinct from old.test) and not public.team_has_test(new.team_id, new.test) then
    raise exception 'unknown_test' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.performance_tests_prepare() from public, anon, authenticated;

-- Platzierung: kleinere Werte sind besser bei Zeiten (Sprint, 505, Slalom) und bei eigenen Tests mit lower = true
create or replace function public.my_test_ranks(p_player uuid)
returns table (test text, rank integer, n integer, best numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_mode text;
  v_custom jsonb;
begin
  if not public.is_own_player(p_player) then
    return;
  end if;
  select p.team_id into v_team from public.players p where p.id = p_player;
  if v_team is null or not public.player_view(v_team, 'tests') then
    return;
  end if;
  select coalesce(t.settings ->> 'testRank', 'rank'),
         case when jsonb_typeof(t.settings -> 'customTests') = 'array' then t.settings -> 'customTests' else '[]'::jsonb end
    into v_mode, v_custom from public.teams t where t.id = v_team;
  if v_mode = 'off' then
    return;
  end if;
  return query
  with latest as (
    select distinct on (pt.player_id, pt.test) pt.player_id, pt.test, pt.value
      from public.performance_tests pt
      join public.players p on p.id = pt.player_id and p.active
     where pt.team_id = v_team and pt.date >= current_date - 365
     order by pt.player_id, pt.test, pt.date desc, pt.created_at desc
  ), lower_better as (
    select unnest(array['sprint10', 'sprint30', 'agility505', 'slalom']) as test
    union
    select 'c:' || (e ->> 'id') from jsonb_array_elements(v_custom) e where coalesce((e ->> 'lower')::boolean, false)
  ), scored as (
    select l.player_id, l.test, l.value,
           case when l.test in (select lb.test from lower_better lb) then l.value else -l.value end as score
      from latest l
  ), ranked as (
    select s.player_id, s.test,
           rank() over (partition by s.test order by s.score) as rk,
           count(*) over (partition by s.test) as cnt,
           min(s.score) over (partition by s.test) as best_score
      from scored s
  )
  select r.test, r.rk::integer, r.cnt::integer,
         case when v_mode = 'best' then abs(r.best_score) else null end
    from ranked r
   where r.player_id = p_player and r.cnt >= 5;
end;
$$;
revoke all on function public.my_test_ranks(uuid) from public, anon;
grant execute on function public.my_test_ranks(uuid) to authenticated, service_role;

-- Rechte: customTests wie tests/testRank → „perf“ (sonst wie 20261008000022)
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
