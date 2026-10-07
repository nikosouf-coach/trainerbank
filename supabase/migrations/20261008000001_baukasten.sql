-- =====================================================================
-- Baustein 2: eigene Gruppen je Spieler, Absagen durch Spieler schaltbar,
-- freie Bezeichnung für Zusatzsport („Sonstiges“).
-- Teameinstellungen (Baukasten, Sichtbarkeit für Spieler, Gruppen) liegen
-- in teams.settings / teams.modules (jsonb) und brauchen keine neuen Spalten.
-- =====================================================================

alter table public.players add column if not exists groups text[] not null default '{}';
do $$ begin
  alter table public.players add constraint players_groups_len check (cardinality(groups) <= 30);
exception when duplicate_object then null; end $$;

alter table public.extra_activities add column if not exists label text;
do $$ begin
  alter table public.extra_activities add constraint extra_label_len check (label is null or char_length(label) <= 60);
exception when duplicate_object then null; end $$;

-- Liest einen Ja/Nein-Schalter aus teams.settings (z. B. playerAbs).
create or replace function public.team_setting_bool(p_team uuid, p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (t.settings ->> p_key)::boolean from public.teams t where t.id = p_team), p_default)
$$;
revoke all on function public.team_setting_bool(uuid, text, boolean) from public, anon;
grant execute on function public.team_setting_bool(uuid, text, boolean) to authenticated;

-- Spieler dürfen Abwesenheiten nur eintragen/löschen, wenn das Team es erlaubt.
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences
  for insert to authenticated
  with check (
    team_id = public.player_team(player_id)
    and (
      public.is_team_staff(team_id)
      or (public.is_own_player(player_id) and reported_by_player
          and public.team_setting_bool(team_id, 'playerAbs', true))
    )
  );

drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences
  for delete to authenticated
  using (
    public.is_team_staff(team_id)
    or (public.is_own_player(player_id) and reported_by_player
        and public.team_setting_bool(team_id, 'playerAbs', true))
  );

-- Spieler dürfen ihre Gruppen nicht selbst ändern.
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
    return new;
  end if;
  if new.id <> old.id
     or new.team_id is distinct from old.team_id
     or new.user_id is distinct from old.user_id
     or new.active  is distinct from old.active
     or new.is_new  is distinct from old.is_new
     or new.groups  is distinct from old.groups
     or new.created_at <> old.created_at then
    raise exception 'forbidden: players.team_id, user_id, active, is_new and groups can only be changed by team staff'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
