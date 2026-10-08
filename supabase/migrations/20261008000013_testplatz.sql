-- =====================================================================
-- Paket 8: Platzierung in Leistungstests für Spieler – ohne Werte anderer.
-- my_test_ranks(spieler): je Test eigener Platz und Anzahl Spieler mit Wert (letzter Wert der letzten
-- 365 Tage je aktivem Spieler), optional der Teambestwert ohne Namen (teams.settings.testRank = 'best').
-- Nur für die eigene Spielerzeile, nur wenn Tests für Spieler freigegeben sind, erst ab 5 Spielern mit Wert.
-- =====================================================================

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
begin
  if not public.is_own_player(p_player) then
    return;
  end if;
  select p.team_id into v_team from public.players p where p.id = p_player;
  if v_team is null or not public.player_view(v_team, 'tests') then
    return;
  end if;
  select coalesce(t.settings ->> 'testRank', 'rank') into v_mode from public.teams t where t.id = v_team;
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
  ), scored as (
    -- kleinere Zeiten sind besser (Sprint, 505, Slalom), sonst größere Werte
    select l.player_id, l.test, l.value,
           case when l.test in ('sprint10', 'sprint30', 'agility505', 'slalom') then l.value else -l.value end as score
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
