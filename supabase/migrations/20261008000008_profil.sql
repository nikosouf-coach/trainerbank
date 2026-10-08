-- =====================================================================
-- Paket 1: Trainerprofil, Vereinslogo, persönliche Einstellungen.
-- - profiles.prefs: Info-Buttons an/aus, Startseite (Karten und Reihenfolge)
-- - teams.logo_path: Vereinslogo im Bucket avatars ({team_id}/logo.jpg)
-- - staff_profiles: Verknüpfung mit Konto (user_id), Geburtsdatum, Lizenz, Foto
-- - team_coaches(team): Name/Rolle/Aufgaben/Foto des Trainerteams für alle Teammitglieder
--   (Spieler sehen so, von wem Nachrichten kommen – ohne Telefon, E-Mail, Geburtsdatum)
-- - Speicher: Logo und Trainerfotos lesen alle Teammitglieder, schreiben nur Staff
-- =====================================================================

alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_prefs_check check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) <= 8000);
exception when duplicate_object then null; end $$;

alter table public.teams add column if not exists logo_path text;
do $$ begin
  alter table public.teams add constraint teams_logo_path_check check (logo_path is null or logo_path = id::text || '/logo.jpg');
exception when duplicate_object then null; end $$;

alter table public.staff_profiles add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.staff_profiles add column if not exists birthdate date;
alter table public.staff_profiles add column if not exists license text;
alter table public.staff_profiles add column if not exists photo_path text;
do $$ begin
  alter table public.staff_profiles add constraint staff_profiles_license_len check (license is null or char_length(license) <= 40);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.staff_profiles add constraint staff_profiles_photo_check check (photo_path is null or photo_path ~ ('^' || team_id::text || '/staff-[0-9a-f-]{36}\.jpg$'));
exception when duplicate_object then null; end $$;
create unique index if not exists staff_profiles_team_user_uidx on public.staff_profiles (team_id, user_id) where user_id is not null;

-- Ein Profil darf nur mit einem Konto verknüpft werden, das zum Trainerteam gehört (nicht „pending“).
create or replace function public.staff_profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is not null and not exists (
    select 1 from public.team_staff s where s.team_id = new.team_id and s.user_id = new.user_id and s.role <> 'pending'
  ) then
    raise exception 'invalid_staff_user' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists staff_profiles_guard on public.staff_profiles;
create trigger staff_profiles_guard before insert or update of user_id, team_id on public.staff_profiles
  for each row execute function public.staff_profiles_guard();
revoke all on function public.staff_profiles_guard() from public, anon, authenticated;

-- Trainerteam für alle Teammitglieder (nur unkritische Felder)
create or replace function public.team_coaches(p_team uuid)
returns table (id uuid, name text, role text, areas text[], photo_path text, user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, sp.name, sp.role, sp.areas, sp.photo_path, sp.user_id
    from public.staff_profiles sp
   where sp.team_id = p_team and public.is_team_member(p_team)
   order by case sp.role when 'chef' then 0 else 1 end, sp.created_at
$$;
revoke all on function public.team_coaches(uuid) from public, anon;
grant execute on function public.team_coaches(uuid) to authenticated, service_role;

-- Speicher avatars: zusätzlich logo.jpg und staff-<uuid>.jpg (lesen: Teammitglieder; schreiben: Staff)
create or replace function public.avatar_access(p_folders text[], p_file text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_team   uuid;
  v_player text;
begin
  if p_folders is null or coalesce(array_length(p_folders, 1), 0) <> 1 then
    return null;
  end if;
  if p_folders[1] !~* uuid_re then
    return null;
  end if;
  v_team := p_folders[1]::uuid;

  if public.is_team_staff(v_team) then
    return 'staff';
  end if;

  -- Logo und Trainerfotos: nur lesen
  if (p_file = 'logo.jpg' or coalesce(p_file, '') ~* '^staff-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
     and public.is_team_member(v_team) then
    return 'member';
  end if;

  v_player := substring(coalesce(p_file, '') from '^(.*)\.jpg$');
  if v_player is null or v_player !~* uuid_re then
    return null;
  end if;

  if exists (
    select 1 from public.players p
    where p.id = v_player::uuid and p.team_id = v_team and p.user_id = auth.uid()
  ) then
    return 'player';
  end if;
  return null;
end;
$$;
revoke all on function public.avatar_access(text[], text) from public, anon;
grant execute on function public.avatar_access(text[], text) to authenticated, service_role;

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) in ('staff', 'player')
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) in ('staff', 'player')
  )
  with check (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) in ('staff', 'player')
  );
