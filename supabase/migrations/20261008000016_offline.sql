-- =====================================================================
-- Paket 11.1: Offline-Einträge.
-- - rpe_entries.entered_at: Zeitpunkt der Eingabe auf dem Gerät (auch ohne Netz). Zählt für Fristen
--   (z. B. Strafen-Automatik „RPE nicht innerhalb von 24 Std.“), nicht der Zeitpunkt des Sendens.
--   Schutz gegen Manipulation: nie in der Zukunft, nie vor dem Tag der Einheit (mit Zeitzonen-Puffer),
--   bei Änderungen bleibt der früheste Zeitpunkt.
-- - team_tasks: „erledigt am“ von Spielern nie in der Zukunft.
-- =====================================================================

alter table public.rpe_entries add column if not exists entered_at timestamptz;
update public.rpe_entries set entered_at = created_at where entered_at is null;
alter table public.rpe_entries alter column entered_at set default now();
alter table public.rpe_entries alter column entered_at set not null;

create or replace function public.rpe_entered_at()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_floor timestamptz := (new.date::timestamp - interval '14 hours') at time zone 'UTC';
begin
  if new.entered_at is null or new.entered_at > now() then
    new.entered_at := now();
  end if;
  if new.entered_at < v_floor then
    new.entered_at := least(v_floor, now());
  end if;
  if tg_op = 'UPDATE' and old.entered_at is not null and old.date = new.date then
    new.entered_at := least(old.entered_at, new.entered_at);
  end if;
  return new;
end;
$$;
revoke all on function public.rpe_entered_at() from public, anon, authenticated;
drop trigger if exists rpe_entries_entered_at on public.rpe_entries;
create trigger rpe_entries_entered_at before insert or update on public.rpe_entries
  for each row execute function public.rpe_entered_at();

-- Spieler setzen bei eigenen Aufgaben nur „erledigt“ – Zeitpunkt (auch offline) nie in der Zukunft
create or replace function public.team_tasks_player_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_team_staff(old.team_id) then
    return new;
  end if;
  if new.title is distinct from old.title or new.note is distinct from old.note or new.due is distinct from old.due
     or new.staff_id is distinct from old.staff_id or new.player_id is distinct from old.player_id
     or new.group_id is distinct from old.group_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at or new.team_id is distinct from old.team_id then
    raise exception 'forbidden: players can only mark tasks as done' using errcode = '42501';
  end if;
  if new.done_at is not null and new.done_at > now() then
    new.done_at := now();
  end if;
  new.done_by := case when new.done_at is null then null else auth.uid() end;
  return new;
end;
$$;
revoke all on function public.team_tasks_player_guard() from public, anon, authenticated;
