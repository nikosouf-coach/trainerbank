-- =====================================================================
-- Individualtraining beim Wunsch-Trainer anfragen
-- - indiv_requests.ask_staff: bei wem der Spieler anfragt (Profil im Trainerteam; leer = ganzes Trainerteam).
--   Der Spieler wählt ihn beim Anlegen und kann ihn danach nicht mehr ändern; das Trainerteam kann weitergeben.
-- - Der angefragte Trainer sieht die Anfrage auch ohne Recht „Planung“ (zusagen/absagen weiterhin mit „Planung“,
--   weil eine Zusage eine Einheit anlegt).
-- Dienste: der Wechsel (jedes Mal, wöchentlich, alle 2 Wochen, monatlich) liegt in teams.settings.duties[].every –
-- keine Änderung am Schema.
-- =====================================================================

alter table public.indiv_requests add column if not exists ask_staff uuid references public.staff_profiles (id) on delete set null;
create index if not exists indiv_requests_ask_idx on public.indiv_requests (ask_staff) where ask_staff is not null;

-- eigenes Profil im Trainerteam?
create or replace function public.is_my_staff_profile(p_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_staff is not null and exists (select 1 from public.staff_profiles sp where sp.id = p_staff and sp.user_id = (select auth.uid()));
$$;
revoke all on function public.is_my_staff_profile(uuid) from public, anon;
grant execute on function public.is_my_staff_profile(uuid) to authenticated, service_role;

-- Profil gehört zum Team? (auch für Spieler, die staff_profiles nicht lesen dürfen)
create or replace function public.staff_in_team(p_staff uuid, p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_profiles sp where sp.id = p_staff and sp.team_id = p_team);
$$;
revoke all on function public.staff_in_team(uuid, uuid) from public, anon;
grant execute on function public.staff_in_team(uuid, uuid) to authenticated, service_role;

-- Trigger (wie 20261008000022, dazu ask_staff)
create or replace function public.dev_rows_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_staff boolean;
begin
  new.team_id := public.player_team(new.player_id);
  if new.team_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if tg_op = 'UPDATE' and new.player_id <> old.player_id and current_user in ('authenticated', 'anon') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_staff := current_user not in ('authenticated', 'anon') or public.is_team_staff(new.team_id);
  if tg_table_name = 'player_assessments' then
    -- Spieler legen nur Selbsteinschätzungen an; die sieht der Spieler immer
    if not v_staff then new.by_player := true; new.visible := true; end if;
  elsif tg_table_name = 'player_goals' then
    if not v_staff then
      if tg_op = 'INSERT' then
        new.by_player := true; new.visible := true; new.talk_id := null;
      elsif not old.by_player then
        -- Ziele des Trainerteams: Spieler haken nur Schritte ab (Text und alles andere bleibt)
        if (new.title, new.area, new.kind, new.metric, new.unit, new.start_value, new.target_value, new.lower_better, new.test, new.stat,
            new.date_from, new.due, new.why, new.status, new.visible, new.by_player, new.talk_id)
           is distinct from
           (old.title, old.area, old.kind, old.metric, old.unit, old.start_value, old.target_value, old.lower_better, old.test, old.stat,
            old.date_from, old.due, old.why, old.status, old.visible, old.by_player, old.talk_id)
           or jsonb_array_length(new.steps) <> jsonb_array_length(old.steps)
           or exists (select 1 from jsonb_array_elements(new.steps) with ordinality n(e, i)
                        join jsonb_array_elements(old.steps) with ordinality o(e, i) using (i)
                       where n.e ->> 'text' is distinct from o.e ->> 'text') then
          raise exception 'forbidden: players only tick steps' using errcode = '42501';
        end if;
      else
        new.by_player := true; new.visible := true; new.talk_id := old.talk_id;
      end if;
    end if;
    new.updated_at := now();
  elsif tg_table_name = 'dev_talks' then
    new.updated_at := now();
  elsif tg_table_name = 'indiv_requests' then
    if not v_staff then
      if tg_op = 'INSERT' then
        if coalesce((select (t.settings ->> 'indivReq')::boolean from public.teams t where t.id = new.team_id), true) is false then
          raise exception 'indiv_off' using errcode = 'P0001';
        end if;
        if (select count(*) from public.indiv_requests r where r.player_id = new.player_id and r.status = 'open') >= 2 then
          raise exception 'limit' using errcode = 'P0001', detail = 'open_requests';
        end if;
        -- ask_staff (bei wem angefragt) wählt der Spieler selbst; Status und Antwort setzt das Trainerteam
        new.status := 'open'; new.answer := ''; new.unit_date := null; new.unit_slot := null; new.staff_id := null; new.answered_by := null;
      else
        -- Spieler ziehen offene Anfragen nur zurück
        if not (old.status = 'open' and new.status = 'cancelled')
           or (new.topic, new.note, new.wish, new.answer, new.unit_date, new.unit_slot, new.staff_id, new.answered_by, new.ask_staff)
              is distinct from (old.topic, old.note, old.wish, old.answer, old.unit_date, old.unit_slot, old.staff_id, old.answered_by, old.ask_staff) then
          raise exception 'forbidden' using errcode = '42501';
        end if;
      end if;
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('accepted', 'declined') then
      new.answered_by := coalesce(auth.uid(), new.answered_by);
    end if;
    if new.staff_id is not null and not exists (select 1 from public.staff_profiles s where s.id = new.staff_id and s.team_id = new.team_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
    -- Spieler sehen staff_profiles nicht (RLS) – Prüfung daher über eine Hilfsfunktion
    if new.ask_staff is not null and not public.staff_in_team(new.ask_staff, new.team_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;


drop policy if exists indiv_requests_select on public.indiv_requests;
create policy indiv_requests_select on public.indiv_requests for select to authenticated
  using (public.staff_can(team_id, 'plan') or public.is_own_player(player_id)
         or (public.is_team_staff(team_id) and public.is_my_staff_profile(ask_staff)));
revoke all on function public.dev_rows_prepare() from public, anon, authenticated;
