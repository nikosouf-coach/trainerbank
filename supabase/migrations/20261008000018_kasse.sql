-- =====================================================================
-- Paket 11.3: Mannschaftskasse.
-- - teams.settings.kasse: an/aus, Währung, Geldstrafen an/aus, Kassenstand für Spieler sichtbar,
--   Kassenwart (Spieler-ID), Zahlungshinweis, Beiträge (Name, Betrag, einmalig/monatlich/Saison)
-- - cash_entries: Kassenbuch (Einnahmen/Ausgaben), Zahlungen von Beiträgen (fee_id + period) und Strafen (fine_id)
-- - cash_waivers: erlassene Beiträge je Spieler (eigene Tabelle, damit Befreiungen nicht in den
--   für alle lesbaren Team-Einstellungen stehen – sie können auf finanzielle Notlagen hinweisen)
-- Zugriff: Trainerteam mit Recht „cash“ und der Kassenwart; Spieler sehen nur eigene Zahlungen/Befreiungen.
-- Eine Zahlung mit fine_id markiert die Strafe als bezahlt (und Löschen wieder als offen).
-- =====================================================================

-- Ist der angemeldete Nutzer Kassenwart (Spieler, in teams.settings.kasse.treasurer eingetragen)?
create or replace function public.is_treasurer(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams t
      join public.players p on p.team_id = t.id and p.user_id = auth.uid() and p.active
     where t.id = team and (t.settings -> 'kasse' ->> 'treasurer') = p.id::text
  )
$$;
create or replace function public.can_manage_cash(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_can(team, 'cash') or public.is_treasurer(team)
$$;
revoke all on function public.is_treasurer(uuid) from public, anon;
revoke all on function public.can_manage_cash(uuid) from public, anon;
grant execute on function public.is_treasurer(uuid) to authenticated, service_role;
grant execute on function public.can_manage_cash(uuid) to authenticated, service_role;

create table if not exists public.cash_entries (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  date       date not null default current_date,
  amount     numeric(8, 2) not null check (amount > 0 and amount <= 100000),
  kind       text not null check (kind in ('in', 'out')),
  cat        text not null default 'other' check (cat in ('fee', 'fine', 'donation', 'event', 'drinks', 'material', 'other')),
  -- Kassenbuch bleibt beim Löschen eines Spielers erhalten (ohne Namen)
  player_id  uuid references public.players (id) on delete set null,
  fee_id     text check (fee_id is null or char_length(fee_id) between 1 and 40),
  period     text check (period is null or period ~ '^(once|\d{4}-\d{2}|\d{4}/\d{2})$'),
  fine_id    uuid references public.team_fines (id) on delete set null,
  note       text check (note is null or char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((cat = 'fee') = (fee_id is not null)),
  check (fee_id is null or (period is not null and player_id is not null and kind = 'in')),
  check (fine_id is null or (cat = 'fine' and kind = 'in'))
);
create index if not exists cash_entries_team_idx on public.cash_entries (team_id, date);
create index if not exists cash_entries_player_idx on public.cash_entries (player_id);
-- je Spieler, Beitrag und Zeitraum höchstens eine Zahlung; je Strafe höchstens eine Zahlung
create unique index if not exists cash_entries_fee_uidx on public.cash_entries (team_id, player_id, fee_id, period) where fee_id is not null;
create unique index if not exists cash_entries_fine_uidx on public.cash_entries (fine_id) where fine_id is not null;

create table if not exists public.cash_waivers (
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  fee_id     text not null check (char_length(fee_id) between 1 and 40),
  -- '*' = ganzer Beitrag, sonst ein Zeitraum
  period     text not null check (period ~ '^(\*|once|\d{4}-\d{2}|\d{4}/\d{2})$'),
  created_at timestamptz not null default now(),
  primary key (team_id, player_id, fee_id, period)
);
create index if not exists cash_waivers_player_idx on public.cash_waivers (player_id);

-- Verweise müssen zum Team passen; created_by fälschungssicher
create or replace function public.cash_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.player_id is not null and public.player_team(new.player_id) is distinct from new.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if tg_table_name = 'cash_entries' then
    if new.fine_id is not null and not exists (
      select 1 from public.team_fines f where f.id = new.fine_id and f.team_id = new.team_id and f.player_id is not distinct from new.player_id) then
      raise exception 'different_teams' using errcode = '22023';
    end if;
    if current_user in ('authenticated', 'anon') then
      new.created_by := case when tg_op = 'INSERT' then auth.uid() else old.created_by end;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.cash_prepare() from public, anon, authenticated;
drop trigger if exists cash_entries_prepare on public.cash_entries;
create trigger cash_entries_prepare before insert or update on public.cash_entries for each row execute function public.cash_prepare();
drop trigger if exists cash_waivers_prepare on public.cash_waivers;
create trigger cash_waivers_prepare before insert or update on public.cash_waivers for each row execute function public.cash_prepare();

-- Zahlung einer Strafe ⇒ Strafe „bezahlt“; Zahlung gelöscht ⇒ wieder offen (security definer:
-- der Kassenwart darf Strafen sonst nicht ändern)
create or replace function public.cash_fine_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.fine_id is not null then
    update public.team_fines set status = 'done' where id = new.fine_id and status = 'open';
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.fine_id is not null and (tg_op = 'DELETE' or new.fine_id is distinct from old.fine_id) then
    update public.team_fines set status = 'open' where id = old.fine_id and status = 'done';
  end if;
  return null;
end;
$$;
revoke all on function public.cash_fine_status() from public, anon, authenticated;
drop trigger if exists cash_entries_fine_status on public.cash_entries;
create trigger cash_entries_fine_status after insert or update or delete on public.cash_entries for each row execute function public.cash_fine_status();

alter table public.cash_entries enable row level security;
drop policy if exists cash_entries_select on public.cash_entries;
create policy cash_entries_select on public.cash_entries for select to authenticated
  using (public.can_manage_cash(team_id) or (player_id is not null and public.is_own_player(player_id)));
drop policy if exists cash_entries_write on public.cash_entries;
create policy cash_entries_write on public.cash_entries for all to authenticated
  using (public.can_manage_cash(team_id)) with check (public.can_manage_cash(team_id));
grant select, insert, update, delete on public.cash_entries to authenticated;

alter table public.cash_waivers enable row level security;
drop policy if exists cash_waivers_select on public.cash_waivers;
create policy cash_waivers_select on public.cash_waivers for select to authenticated
  using (public.can_manage_cash(team_id) or public.is_own_player(player_id));
drop policy if exists cash_waivers_write on public.cash_waivers;
create policy cash_waivers_write on public.cash_waivers for all to authenticated
  using (public.staff_can(team_id, 'cash')) with check (public.staff_can(team_id, 'cash'));
grant select, insert, update, delete on public.cash_waivers to authenticated;

-- Der Kassenwart sieht die Strafen des Teams (zum Kassieren), ändert sie aber nicht
drop policy if exists team_fines_select on public.team_fines;
create policy team_fines_select on public.team_fines for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id) or public.is_treasurer(team_id));

-- Kassenstand für Mitglieder, wenn freigegeben (sonst nur Kasse/Kassenwart)
create or replace function public.team_cash_balance(p_team uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_show boolean;
begin
  if not public.is_team_member(p_team) then
    return null;
  end if;
  select coalesce((t.settings -> 'kasse' ->> 'showBalance')::boolean, false) and coalesce((t.settings -> 'kasse' ->> 'on')::boolean, false)
    into v_show from public.teams t where t.id = p_team;
  if not (v_show or public.can_manage_cash(p_team)) then
    return null;
  end if;
  return (select coalesce(sum(case when kind = 'in' then amount else -amount end), 0) from public.cash_entries where team_id = p_team);
end;
$$;
revoke all on function public.team_cash_balance(uuid) from public, anon;
grant execute on function public.team_cash_balance(uuid) to authenticated, service_role;
