-- =====================================================================
-- Trainerbank – Storage: privater Bucket "avatars" für Spielerfotos
--
-- Objektpfad: {team_id}/{player_id}.jpg   (players.photo_path speichert diesen Pfad)
--   * Staff des Teams (erstes Pfadsegment): lesen, schreiben, löschen
--   * Spieler: eigenes Foto lesen und schreiben (Upload mit upsert)
-- Anzeige in der App über signierte URLs (createSignedUrl), da der Bucket privat ist.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Prüft den Zugriff auf ein Avatar-Objekt anhand von storage.foldername(name)
-- und storage.filename(name). Rückgabe: 'staff', 'player' oder null (kein Zugriff).
-- Ungültige Pfade (keine UUID, falsche Tiefe/Endung) ergeben null statt eines Fehlers.
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

drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) is not null
  );

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) is not null
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) is not null
  )
  with check (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) is not null
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.avatar_access(storage.foldername(name), storage.filename(name)) = 'staff'
  );
