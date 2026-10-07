-- =====================================================================
-- Baustein 6: Verletzungen & Befunde (Fotos/PDF), KI-Auswertung.
-- Befunde sind Gesundheitsdaten (Art. 9 DSGVO): nur das Trainerteam und der
-- Spieler selbst sehen sie. Für die KI-Auswertung braucht es die Einwilligung
-- „findings“ des Spielers (in der App) oder eine vom Trainer bestätigte
-- schriftliche Einwilligung (bei Minderjährigen der Eltern).
-- =====================================================================

alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents
  add constraint consents_kind_check
  check (kind in ('privacy', 'health_data', 'parental', 'ai', 'staff_confidentiality', 'findings'));

create table if not exists public.findings (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams (id) on delete cascade,
  player_id      uuid not null references public.players (id) on delete cascade,
  absence_id     uuid references public.absences (id) on delete set null,
  date           date not null,
  title          text not null check (char_length(title) between 1 and 200),
  path           text not null check (char_length(path) <= 300),
  mime           text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  consent_source text not null check (consent_source in ('app', 'schriftlich')),
  ai_text        text check (ai_text is null or char_length(ai_text) <= 20000),
  ai_at          timestamptz,
  note           text check (note is null or char_length(note) <= 2000),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists findings_player_idx on public.findings (player_id, date);

create or replace function public.findings_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.team_id := public.player_team(new.player_id);
  if new.path !~ ('^' || new.team_id::text || '/' || new.player_id::text || '/') then
    raise exception 'invalid_path' using errcode = '22023';
  end if;
  return new;
end;
$$;
create or replace trigger findings_prepare before insert or update on public.findings
  for each row execute function public.findings_prepare();
revoke all on function public.findings_prepare() from public, anon, authenticated;

alter table public.findings enable row level security;
drop policy if exists findings_select on public.findings;
create policy findings_select on public.findings for select to authenticated
  using (public.is_team_staff(team_id) or public.is_own_player(player_id));
drop policy if exists findings_write on public.findings;
create policy findings_write on public.findings for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.findings to authenticated;

-- Speicher: privater Bucket „findings“, Pfad {team_id}/{player_id}/{uuid}.{jpg|pdf}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('findings', 'findings', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 'staff' (lesen/schreiben), 'player' (eigene lesen) oder null
create or replace function public.finding_access(p_folders text[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_folders is null or coalesce(array_length(p_folders, 1), 0) <> 2 then return null; end if;
  if p_folders[1] !~* uuid_re or p_folders[2] !~* uuid_re then return null; end if;
  if not exists (select 1 from public.players p where p.id = p_folders[2]::uuid and p.team_id = p_folders[1]::uuid) then return null; end if;
  if public.is_team_staff(p_folders[1]::uuid) then return 'staff'; end if;
  if exists (select 1 from public.players p where p.id = p_folders[2]::uuid and p.user_id = auth.uid()) then return 'player'; end if;
  return null;
end;
$$;
revoke all on function public.finding_access(text[]) from public, anon;
grant execute on function public.finding_access(text[]) to authenticated, service_role;

drop policy if exists findings_obj_select on storage.objects;
create policy findings_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'findings' and public.finding_access(storage.foldername(name)) is not null);
drop policy if exists findings_obj_insert on storage.objects;
create policy findings_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'findings' and public.finding_access(storage.foldername(name)) = 'staff');
drop policy if exists findings_obj_update on storage.objects;
create policy findings_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'findings' and public.finding_access(storage.foldername(name)) = 'staff');
drop policy if exists findings_obj_delete on storage.objects;
create policy findings_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'findings' and public.finding_access(storage.foldername(name)) = 'staff');
