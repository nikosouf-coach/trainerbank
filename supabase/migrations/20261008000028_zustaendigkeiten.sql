-- =====================================================================
-- Trainingstag: mehrere Zuständigkeiten je Block
-- - session_blocks.crew: [{"staff": <Trainerprofil>, "task": "ballbesitzende Mannschaft"}, …] (höchstens 6, jeder
--   Trainer einmal, nur Trainerprofile des Teams). staff_id bleibt der Hauptverantwortliche (erster Eintrag) – für
--   „Meine Blöcke“, Rechte und ältere App-Versionen.
-- =====================================================================

alter table public.session_blocks add column if not exists crew jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.session_blocks add constraint session_blocks_crew_check
    check (jsonb_typeof(crew) = 'array' and jsonb_array_length(crew) <= 6 and pg_column_size(crew) <= 3000);
exception when duplicate_object then null; end $$;

-- Trigger (wie 20261008000011, dazu crew)
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
  -- Zuständigkeiten: [{staff, task}] – nur Trainerprofile des Teams, Aufgabe höchstens 80 Zeichen, jeder Trainer einmal
  if exists (select 1 from jsonb_array_elements(new.crew) e
              where jsonb_typeof(e) <> 'object'
                 or char_length(coalesce(e ->> 'task', '')) > 80
                 or case when coalesce(e ->> 'staff', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                         then not exists (select 1 from public.staff_profiles s where s.id = (e ->> 'staff')::uuid and s.team_id = new.team_id)
                         else true end)
     or (select count(*) from jsonb_array_elements(new.crew)) <> (select count(distinct e ->> 'staff') from jsonb_array_elements(new.crew) e) then
    raise exception 'invalid_crew' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'different_teams' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
