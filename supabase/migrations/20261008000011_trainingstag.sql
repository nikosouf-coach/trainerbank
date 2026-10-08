-- =====================================================================
-- Paket 6: Trainingstag – Ablauf mit Blöcken, Zuständigkeiten, Coachingpunkten, Skizzen.
-- - session_blocks: ein Block je Zeile (Co-Trainer bearbeiten ihre Blöcke unabhängig voneinander)
-- - Bucket "sketches": Fotos von Skizzen, Pfad {team_id}/{block_id}.jpg – nur Trainerteam
-- Spieler haben keinen Zugriff (sie sehen den veröffentlichten Wochenplan).
-- =====================================================================

create table if not exists public.session_blocks (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  date       date not null,
  sort       smallint not null default 0 check (sort between 0 and 99),
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  minutes    smallint not null default 15 check (minutes between 1 and 180),
  staff_id   uuid references public.staff_profiles (id) on delete set null,
  exercise_id uuid references public.exercises (id) on delete set null,
  text       text check (text is null or char_length(text) <= 4000),
  points     jsonb not null default '[]'::jsonb check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) <= 12 and pg_column_size(points) <= 6000),
  drawing    jsonb check (drawing is null or (jsonb_typeof(drawing) = 'object' and pg_column_size(drawing) <= 60000)),
  photo_path text,
  group_id   uuid references public.team_groups (id) on delete set null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists session_blocks_team_date_idx on public.session_blocks (team_id, date, sort);
do $$ begin
  alter table public.session_blocks add constraint session_blocks_photo_check check (photo_path is null or photo_path = team_id::text || '/' || id::text || '.jpg');
exception when duplicate_object then null; end $$;

-- Verweise müssen zum selben Team gehören; Bearbeiter und Zeitpunkt setzen
create or replace function public.session_blocks_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.staff_id is not null and not exists (select 1 from public.staff_profiles s where s.id = new.staff_id and s.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.exercise_id is not null and not exists (select 1 from public.exercises e where e.id = new.exercise_id and e.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if new.group_id is not null and not exists (select 1 from public.team_groups g where g.id = new.group_id and g.team_id = new.team_id) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
revoke all on function public.session_blocks_prepare() from public, anon, authenticated;
drop trigger if exists session_blocks_prepare on public.session_blocks;
create trigger session_blocks_prepare before insert or update on public.session_blocks
  for each row execute function public.session_blocks_prepare();

alter table public.session_blocks enable row level security;
drop policy if exists session_blocks_staff on public.session_blocks;
create policy session_blocks_staff on public.session_blocks for all to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
grant select, insert, update, delete on public.session_blocks to authenticated;

-- ---------------------------------------------------------------------
-- Speicher: Skizzen-Fotos (privat, nur Trainerteam des Teams im ersten Pfadsegment)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sketches', 'sketches', false, 4194304, array['image/jpeg'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.sketch_access(p_folders text[], p_file text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_folders is null or coalesce(array_length(p_folders, 1), 0) <> 1 or p_folders[1] !~* uuid_re then
    return false;
  end if;
  if coalesce(p_file, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$' then
    return false;
  end if;
  return public.is_team_staff(p_folders[1]::uuid);
end;
$$;
revoke all on function public.sketch_access(text[], text) from public, anon;
grant execute on function public.sketch_access(text[], text) to authenticated, service_role;

drop policy if exists sketches_select on storage.objects;
create policy sketches_select on storage.objects for select to authenticated
  using (bucket_id = 'sketches' and public.sketch_access(storage.foldername(name), storage.filename(name)));
drop policy if exists sketches_insert on storage.objects;
create policy sketches_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sketches' and public.sketch_access(storage.foldername(name), storage.filename(name)));
drop policy if exists sketches_update on storage.objects;
create policy sketches_update on storage.objects for update to authenticated
  using (bucket_id = 'sketches' and public.sketch_access(storage.foldername(name), storage.filename(name)))
  with check (bucket_id = 'sketches' and public.sketch_access(storage.foldername(name), storage.filename(name)));
drop policy if exists sketches_delete on storage.objects;
create policy sketches_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sketches' and public.sketch_access(storage.foldername(name), storage.filename(name)));
