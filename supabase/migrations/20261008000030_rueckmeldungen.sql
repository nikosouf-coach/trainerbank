-- =====================================================================
-- Trainerbank – Rückmeldungen aus der App (Fehler, Unklares, Wünsche, Lob)
--
--   * Jedes Konto schickt Rückmeldungen mit Seite, App-Version und Gerät (ohne Namen), optional mit Bildschirmfoto
--     (Bucket "feedback", Pfad {user_id}/{uuid}.jpg).
--   * Lesen: eigene Rückmeldungen und die Betreiber der App (Tabelle app_admins, nur per SQL im Dashboard eintragen:
--       insert into public.app_admins (user_id) select id from auth.users where email = 'du@example.de';)
--   * Betreiber: Liste, erledigt/offen, löschen (RPCs feedback_list, feedback_set_done, feedback_delete).
--   * Konto löschen ⇒ eigene Rückmeldungen weg (Cascade; Bildschirmfotos löscht die Edge Function delete-account).
--   * Löschfrist: erledigte Rückmeldungen ohne Bildschirmfoto nach 12 Monaten (purge_old_feedback, täglich).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Betreiber der App
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
comment on table public.app_admins is 'Betreiber der App (sehen alle Rückmeldungen). Nur per SQL im Dashboard eintragen.';
alter table public.app_admins enable row level security;

drop policy if exists app_admins_self on public.app_admins;
create policy app_admins_self on public.app_admins
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_app_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
comment on function public.is_app_admin() is 'true, wenn das angemeldete Konto Betreiber der App ist.';
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Rückmeldungen
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete set null,
  role        text check (role is null or role in ('owner', 'coach', 'physio', 'pending', 'player')),
  kind        text not null check (kind in ('bug', 'unclear', 'wish', 'praise')),
  text        text not null check (char_length(btrim(text)) between 3 and 2000),
  page        text check (page is null or char_length(page) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  update_id   text check (update_id is null or char_length(update_id) <= 80),
  platform    text check (platform is null or platform in ('ios', 'android', 'web')),
  os_version  text check (os_version is null or char_length(os_version) <= 40),
  device      text check (device is null or char_length(device) <= 80),
  shot_path   text check (shot_path is null or char_length(shot_path) <= 200),
  status      text not null default 'open' check (status in ('open', 'done')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
comment on table public.feedback is 'Rückmeldungen aus der App. Lesen: eigene Zeilen und Betreiber (app_admins).';
comment on column public.feedback.page is 'Zuletzt geöffnete Seite vor der Rückmeldung (IDs durch :id ersetzt).';
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id);
create index if not exists feedback_team_idx on public.feedback (team_id) where team_id is not null;

alter table public.feedback enable row level security;

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
-- Ändern und löschen nur über die RPCs der Betreiber (keine Policies für update/delete)

-- Vor dem Speichern: Konto, Status und Zeit festlegen, Team und Rolle prüfen, Bildschirmfoto-Pfad prüfen, Spam begrenzen
create or replace function public.feedback_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
  v_role   text;
begin
  if not v_client then
    return new;
  end if;
  new.user_id := auth.uid(); new.status := 'open'; new.created_at := now(); new.done_at := null;
  new.text := btrim(new.text);
  if new.team_id is not null then
    select s.role into v_role from public.team_staff s where s.team_id = new.team_id and s.user_id = new.user_id;
    if v_role is null and exists (select 1 from public.players p where p.team_id = new.team_id and p.user_id = new.user_id) then
      v_role := 'player';
    end if;
    if v_role is null then
      new.team_id := null; -- fremdes Team: Rückmeldung bleibt, aber ohne Teambezug
    end if;
  end if;
  new.role := v_role;
  if new.shot_path is not null
     and new.shot_path !~ ('^' || new.user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$') then
    raise exception 'invalid_body' using errcode = '22023';
  end if;
  -- Schutz vor Spam: höchstens 20 Rückmeldungen in 24 Stunden je Konto
  if (select count(*) from public.feedback f where f.user_id = new.user_id and f.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'limit' using errcode = 'P0001', detail = 'feedback_rate';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_prepare on public.feedback;
create trigger feedback_prepare
  before insert on public.feedback
  for each row execute function public.feedback_prepare();

-- ---------------------------------------------------------------------
-- RPCs für Betreiber
-- ---------------------------------------------------------------------
-- Liste (offen, erledigt oder alle) mit Team und Anzeigename (für Rückfragen)
create or replace function public.feedback_list(p_status text default 'open')
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_app_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'kind', f.kind, 'text', f.text, 'page', f.page, 'app_version', f.app_version, 'update_id', f.update_id,
             'platform', f.platform, 'os_version', f.os_version, 'device', f.device, 'shot_path', f.shot_path,
             'status', f.status, 'created_at', f.created_at, 'done_at', f.done_at, 'role', f.role,
             'team', case when t.id is null then null else btrim(t.club || ' ' || t.name) end,
             'reporter', pr.display_name)
           order by f.created_at desc)
      from (select * from public.feedback x
             where p_status = 'all' or x.status = p_status
             order by x.created_at desc limit 300) f
      left join public.teams t on t.id = f.team_id
      left join public.profiles pr on pr.id = f.user_id), '[]'::jsonb);
end;
$$;

-- Anzahl offener Rückmeldungen (für die Zahl am Menüpunkt); 0 für alle, die keine Betreiber sind
create or replace function public.feedback_open_count()
returns integer
language sql stable security definer
set search_path = public
as $$
  select case when public.is_app_admin() then (select count(*)::int from public.feedback where status = 'open') else 0 end;
$$;

create or replace function public.feedback_set_done(p_id uuid, p_done boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.feedback
     set status = case when p_done then 'done' else 'open' end,
         done_at = case when p_done then now() else null end
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Löschen; liefert den Pfad des Bildschirmfotos (die App entfernt die Datei vorher bzw. danach)
create or replace function public.feedback_delete(p_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if not public.is_app_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.feedback where id = p_id returning shot_path into v_path;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_path;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public.feedback_list(text)', 'public.feedback_open_count()', 'public.feedback_set_done(uuid, boolean)',
                           'public.feedback_delete(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Storage: privater Bucket "feedback" für Bildschirmfotos ({user_id}/{uuid}.jpg)
--   * Hochladen: nur in den eigenen Ordner, kein Überschreiben
--   * Lesen: eigene Fotos und Betreiber · Löschen: eigene Fotos und Betreiber
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.feedback_shot_owner(p_folders text[], p_file text)
returns boolean
language sql stable
set search_path = public
as $$
  select auth.uid() is not null
     and p_folders is not null and coalesce(array_length(p_folders, 1), 0) = 1
     and p_folders[1] = auth.uid()::text
     and coalesce(p_file, '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$';
$$;
revoke all on function public.feedback_shot_owner(text[], text) from public, anon;
grant execute on function public.feedback_shot_owner(text[], text) to authenticated, service_role;

drop policy if exists feedback_shots_insert on storage.objects;
create policy feedback_shots_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback' and public.feedback_shot_owner(storage.foldername(name), storage.filename(name)));

drop policy if exists feedback_shots_select on storage.objects;
create policy feedback_shots_select on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback' and (public.feedback_shot_owner(storage.foldername(name), storage.filename(name)) or public.is_app_admin()));

drop policy if exists feedback_shots_delete on storage.objects;
create policy feedback_shots_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'feedback' and (public.feedback_shot_owner(storage.foldername(name), storage.filename(name)) or public.is_app_admin()));

-- ---------------------------------------------------------------------
-- Datenexport v8 (Art. 15/20 DSGVO): zusätzlich die eigenen Rückmeldungen
-- ---------------------------------------------------------------------
create or replace function public.my_data_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_players uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select coalesce(array_agg(p.id), '{}') into v_players from public.players p where p.user_id = v_uid;

  return jsonb_build_object(
    'format', 'trainerbank-export-v8',
    'exported_at', now(),
    'user_id', v_uid,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.given_at) from public.consents c where c.user_id = v_uid), '[]'::jsonb),
    'team_staff', coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object('club', t.club, 'team_name', t.name) order by t.club, t.name)
      from public.team_staff s join public.teams t on t.id = s.team_id
      where s.user_id = v_uid), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(to_jsonb(p) || jsonb_build_object('club', t.club, 'team_name', t.name) order by p.created_at)
      from public.players p join public.teams t on t.id = p.team_id
      where p.id = any (v_players)), '[]'::jsonb),
    'rpe_entries', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date) from public.rpe_entries r
      where r.player_id = any (v_players)), '[]'::jsonb),
    'wellness_entries', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.date) from public.wellness_entries w
      where w.player_id = any (v_players)), '[]'::jsonb),
    'extra_activities', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.date) from public.extra_activities e
      where e.player_id = any (v_players)), '[]'::jsonb),
    'absences', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.from_date) from public.absences a
      where a.player_id = any (v_players)), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.date) from public.attendance a
      where a.player_id = any (v_players)), '[]'::jsonb),
    'growth_measurements', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.date) from public.growth_measurements g
      where g.player_id = any (v_players)), '[]'::jsonb),
    'potentials', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at) from public.potentials p
      where p.player_id = any (v_players) and p.visible_to_player), '[]'::jsonb),
    'coach_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at) from public.coach_messages m
      where m.player_id = any (v_players)), '[]'::jsonb),
    'match_stats', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.updated_at) from public.match_stats s
      where s.player_id = any (v_players)), '[]'::jsonb),
    'player_ratings', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.date) from public.player_ratings r
      where r.player_id = any (v_players) and r.visible), '[]'::jsonb),
    'performance_tests', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.date) from public.performance_tests t
      where t.player_id = any (v_players)), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.date) from public.findings f
      where f.player_id = any (v_players)), '[]'::jsonb),
    -- Gruppen: nur freigegebene (wie in der App); interne Gruppen bleiben wie Trainernotizen ausgenommen
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('group', g.name, 'kind', g.kind, 'player_id', m.player_id, 'since', m.created_at) order by m.created_at)
        from public.group_members m join public.team_groups g on g.id = m.group_id
       where m.player_id = any (v_players) and g.visible), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at) from public.team_tasks t
      where t.player_id = any (v_players)), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.date) from public.team_duties d
      where d.player_id = any (v_players)), '[]'::jsonb),
    'fines', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.date) from public.team_fines f
      where f.player_id = any (v_players)), '[]'::jsonb),
    -- Mannschaftskasse: eigene Zahlungen und Befreiungen
    'cash', coalesce((
      select jsonb_agg(jsonb_build_object('date', c.date, 'amount', c.amount, 'kind', c.kind, 'category', c.cat, 'fee', c.fee_id, 'period', c.period, 'fine_id', c.fine_id, 'note', c.note) order by c.date)
        from public.cash_entries c where c.player_id = any (v_players)), '[]'::jsonb),
    'cash_waivers', coalesce((
      select jsonb_agg(jsonb_build_object('fee', w.fee_id, 'period', w.period, 'since', w.created_at) order by w.created_at)
        from public.cash_waivers w where w.player_id = any (v_players)), '[]'::jsonb),
    -- Spielerentwicklung: eigene Selbsteinschätzungen und Ziele, freigegebene Einschätzungen, Ziele und Gespräche
    -- (interne Gesprächsnotizen bleiben wie Trainernotizen ausgenommen)
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.date, 'by', case when a.by_player then 'self' else 'coach' end, 'scores', a.scores, 'note', a.note) order by a.date)
        from public.player_assessments a where a.player_id = any (v_players) and (a.by_player or a.visible)), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(to_jsonb(g) - 'created_by' order by g.created_at)
        from public.player_goals g where g.player_id = any (v_players) and (g.visible or g.by_player)), '[]'::jsonb),
    'goal_entries', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', e.goal_id, 'date', e.date, 'value', e.value, 'note', e.note, 'by_player', e.by_player) order by e.date)
        from public.goal_entries e join public.player_goals g on g.id = e.goal_id
       where e.player_id = any (v_players) and (g.visible or g.by_player)), '[]'::jsonb),
    'dev_talks', coalesce((
      select jsonb_agg(jsonb_build_object('date', t.date, 'kind', t.kind, 'player_view', t.player_view, 'strengths', t.strengths, 'focus', t.focus,
                                          'agreements', t.agreements, 'next_date', t.next_date) order by t.date)
        from public.dev_talks t where t.player_id = any (v_players) and t.visible), '[]'::jsonb),
    'challenge_entries', coalesce((
      select jsonb_agg(jsonb_build_object('week', c.week_start, 'challenge', c.title, 'value', e.value, 'days', e.days, 'done', e.done) order by c.week_start)
        from public.challenge_entries e join public.team_challenges c on c.id = e.challenge_id
       where e.player_id = any (v_players)), '[]'::jsonb),
    'indiv_requests', coalesce((
      select jsonb_agg(jsonb_build_object('topic', r.topic, 'note', r.note, 'wish', r.wish, 'status', r.status, 'answer', r.answer,
                                          'date', r.unit_date, 'created_at', r.created_at) order by r.created_at)
        from public.indiv_requests r where r.player_id = any (v_players)), '[]'::jsonb),
    -- Chat: eigene Nachrichten (Texte anderer gehören diesen), Reaktionen, Meldungen und Mitgliedschaften
    'chat_messages', coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', m.chat_id, 'sent_at', m.created_at, 'text', m.body, 'deleted_at', m.deleted_at) order by m.created_at)
        from public.chat_messages m where m.user_id = v_uid), '[]'::jsonb),
    'chat_reactions', coalesce((
      select jsonb_agg(jsonb_build_object('message_id', r.message_id, 'emoji', r.emoji, 'at', r.created_at) order by r.created_at)
        from public.chat_reactions r where r.user_id = v_uid), '[]'::jsonb),
    'chat_reports', coalesce((
      select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'status', r.status, 'at', r.created_at) order by r.created_at)
        from public.chat_reports r where r.reporter = v_uid), '[]'::jsonb),
    'chats', coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', c.id, 'kind', c.kind, 'title', c.title, 'muted', coalesce(st.muted, false), 'read_at', st.read_at) order by c.created_at)
        from public.chats c left join public.chat_state st on st.chat_id = c.id and st.user_id = v_uid
       where exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = v_uid)
          or st.user_id is not null), '[]'::jsonb),
    -- Matchplan: eigene Aufrufe und erkannte Screenshots (Inhalte der Pläne gehören dem Trainerteam)
    'match_plan_views', coalesce((
      select jsonb_agg(jsonb_build_object('plan', mp.title, 'kind', v.kind, 'platform', v.platform, 'at', v.at) order by v.at)
        from public.match_plan_views v join public.match_plans mp on mp.id = v.plan_id
       where v.player_id = any (v_players)), '[]'::jsonb),
    'club_staff', coalesce((
      select jsonb_agg(jsonb_build_object('club', c.name, 'role', cs.role, 'title', cs.title, 'perms', cs.perms, 'teams', cs.teams, 'since', cs.created_at) order by cs.created_at)
        from public.club_staff cs join public.clubs c on c.id = cs.club_id where cs.user_id = v_uid), '[]'::jsonb),
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb),
    -- Rückmeldungen aus der App (ohne Pfad des Bildschirmfotos)
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object('kind', f.kind, 'text', f.text, 'page', f.page, 'app_version', f.app_version,
                                          'platform', f.platform, 'os_version', f.os_version, 'device', f.device,
                                          'screenshot', f.shot_path is not null, 'status', f.status, 'created_at', f.created_at)
                       order by f.created_at)
        from public.feedback f where f.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Löschfrist: erledigte Rückmeldungen ohne Bildschirmfoto nach 12 Monaten
-- (mit Foto löscht der Betreiber in der App – sonst bliebe die Datei im Speicher)
-- ---------------------------------------------------------------------
create or replace function public.purge_old_feedback()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.feedback
   where status = 'done' and shot_path is null and coalesce(done_at, created_at) < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_feedback() from public, anon, authenticated;
grant execute on function public.purge_old_feedback() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-old-feedback: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-old-feedback', '45 3 * * *', 'select public.purge_old_feedback()');
exception when others then
  raise notice 'purge-old-feedback konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;
