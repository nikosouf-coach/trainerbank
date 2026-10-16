-- =====================================================================
-- Chat im Team: Teamchat, Trainerteam, Gruppen, Einzelchats und eigene Gruppen-Chats.
-- Kinderschutz (Empfehlungen DFB/Deutsche Sportjugend): In Jugendteams (alles außer Senioren/Ü32) sind Einzelchats
-- nur mit dem Trainerteam möglich, und das Trainerteam (Recht „messages“) liest Einzelchats zwischen Trainer und
-- Spieler mit („transparent“ – im Chat sichtbar). Nachrichten lassen sich melden; Meldungen gehen mit einer Kopie
-- des Textes an das Trainerteam. Push-Nachrichten enthalten keinen Nachrichtentext.
-- Einstellungen: teams.settings.chat = { on, dm: off|staff|all, transparent, teamReadOnly } (Standard je Altersklasse).
-- Außerdem: Datenexport v5 (Entwicklung, Challenges, Individualtraining, Chat) und Löschfristen für Chat.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Einstellungen und Personen
-- ---------------------------------------------------------------------
-- Chat eingeschaltet? (Modul „chat“ und settings.chat.on; fehlend = an)
create or replace function public.chat_on(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select coalesce(t.modules ->> 'chat', 'true') <> 'false' and coalesce(t.settings -> 'chat' ->> 'on', 'true') <> 'false'
                     from public.teams t where t.id = p_team), false)
$$;
-- Einstellung mit Standard je Altersklasse (Jugend: Einzelchats nur mit dem Trainerteam, transparent)
create or replace function public.chat_cfg(p_team uuid, p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case when p_key = 'dm' and t.settings -> 'chat' ->> 'dm' in ('off', 'staff', 'all') then t.settings -> 'chat' ->> 'dm'
         when p_key in ('transparent', 'teamReadOnly', 'on') and t.settings -> 'chat' ->> p_key in ('true', 'false') then t.settings -> 'chat' ->> p_key end,
    case p_key
      when 'dm' then case when t.age_class in ('sen', 'ue32') then 'all' else 'staff' end
      when 'transparent' then case when t.age_class in ('sen', 'ue32') then 'false' else 'true' end
      when 'teamReadOnly' then 'false'
      when 'on' then 'true' end)
    from public.teams t where t.id = p_team
$$;
-- Art einer Person im Team: staff (Trainerteam), player (aktiver Spieler mit Konto) oder null
create or replace function public.chat_kind_of(p_team uuid, p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_uid is null then null
    when exists (select 1 from public.team_staff s where s.team_id = p_team and s.user_id = p_uid and s.role <> 'pending') then 'staff'
    when exists (select 1 from public.players p where p.team_id = p_team and p.user_id = p_uid and p.active) then 'player' end
$$;
-- Anzeigename im Chat: Trainerteam mit Namen aus dem Trainerprofil, Spieler „Vorname N.“ (Datensparsamkeit)
create or replace function public.chat_name_of(p_team uuid, p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when not (public.is_team_member(p_team) or auth.uid() is null) then '–' else left(coalesce(
    (select sp.name from public.staff_profiles sp
       join public.team_staff s on s.team_id = sp.team_id and s.user_id = sp.user_id and s.role <> 'pending'
      where sp.team_id = p_team and sp.user_id = p_uid order by sp.created_at limit 1),
    (select nullif(btrim(pr.display_name), '') from public.team_staff s join public.profiles pr on pr.id = s.user_id
      where s.team_id = p_team and s.user_id = p_uid and s.role <> 'pending'),
    (select btrim(p.first_name || coalesce(' ' || nullif(left(btrim(p.last_name), 1), '') || '.', ''))
       from public.players p where p.team_id = p_team and p.user_id = p_uid and p.active order by p.created_at limit 1),
    '–'), 80) end
$$;
revoke all on function public.chat_on(uuid) from public, anon;
revoke all on function public.chat_cfg(uuid, text) from public, anon;
revoke all on function public.chat_kind_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.chat_name_of(uuid, uuid) from public, anon;
grant execute on function public.chat_on(uuid), public.chat_cfg(uuid, text), public.chat_name_of(uuid, uuid) to authenticated, service_role;
grant execute on function public.chat_kind_of(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table if not exists public.chats (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  kind        text not null check (kind in ('team', 'staff', 'group', 'direct', 'custom')),
  title       text check (title is null or char_length(btrim(title)) between 1 and 60),
  group_id    uuid references public.team_groups (id) on delete cascade,
  pair_key    text,
  read_only   boolean not null default false,
  transparent boolean not null default false,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  last_at     timestamptz,
  check ((kind = 'group') = (group_id is not null)),
  check ((kind = 'direct') = (pair_key is not null)),
  check ((kind = 'custom') = (title is not null))
);
create unique index if not exists chats_team_uq   on public.chats (team_id) where kind = 'team';
create unique index if not exists chats_staff_uq  on public.chats (team_id) where kind = 'staff';
create unique index if not exists chats_group_uq  on public.chats (group_id) where kind = 'group';
create unique index if not exists chats_direct_uq on public.chats (team_id, pair_key) where kind = 'direct';
create index if not exists chats_team_idx on public.chats (team_id);

-- Mitglieder nur für Einzel- und eigene Chats (Team, Trainerteam und Gruppen ergeben sich aus dem Kader)
create table if not exists public.chat_members (
  chat_id  uuid not null references public.chats (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  team_id  uuid not null references public.teams (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

-- Lesestand und Stummschalten je Konto
create table if not exists public.chat_state (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  muted   boolean not null default false,
  primary key (chat_id, user_id)
);

-- Nachrichten: Löschen leert den Text (Platzhalter „Nachricht gelöscht“); Konto gelöscht ⇒ Nachrichten gelöscht
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_name text not null default '' check (char_length(sender_name) <= 80),
  body        text not null check (char_length(body) <= 4000),
  reply_to    uuid references public.chat_messages (id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users (id) on delete set null,
  check (deleted_at is not null or char_length(btrim(body)) >= 1)
);
create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id, created_at);
create index if not exists chat_messages_team_idx on public.chat_messages (team_id, created_at);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at);

create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '✅', '❤️', '😂', '💪', '👏')),
  chat_id    uuid not null references public.chats (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists chat_reactions_chat_idx on public.chat_reactions (chat_id);

-- Meldungen: mit Kopie des Textes (bleibt erhalten, auch wenn die Nachricht gelöscht wird)
create table if not exists public.chat_reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.chat_messages (id) on delete set null,
  chat_id     uuid references public.chats (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  reporter    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('mean', 'bully', 'private', 'other')),
  note        text not null default '' check (char_length(note) <= 500),
  snapshot    text not null default '',
  sender_name text not null default '',
  sent_at     timestamptz,
  status      text not null default 'open' check (status in ('open', 'done')),
  handled_by  uuid references auth.users (id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter)
);
create index if not exists chat_reports_team_idx on public.chat_reports (team_id, status);

-- Push-Drosselung (nur Server)
create table if not exists public.chat_push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);

-- ---------------------------------------------------------------------
-- Wer darf lesen und schreiben?
-- ---------------------------------------------------------------------
-- Teilnehmer: Teamchat alle (Trainerteam + aktive Spieler mit Konto), Trainerteam-Chat nur Staff,
-- Gruppen-Chat Staff + Mitglieder der freigegebenen Gruppe, Einzel-/eigene Chats die Mitglieder (solange im Team)
create or replace function public.chat_participant(p_chat uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.chats c
      cross join lateral (select public.chat_kind_of(c.team_id, p_uid) as k) x
     where c.id = p_chat and x.k is not null and case c.kind
       when 'team' then true
       when 'staff' then x.k = 'staff'
       when 'group' then x.k = 'staff' or exists (
         select 1 from public.team_groups g
           join public.group_members m on m.group_id = g.id
           join public.players p on p.id = m.player_id
          where g.id = c.group_id and g.visible and p.user_id = p_uid and p.active)
       else exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = p_uid)
     end)
$$;
-- Mitlesen (Kinderschutz): transparente Einzel-/eigene Chats für das Trainerteam mit Recht „messages“
create or replace function public.chat_observer(p_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.chats c where c.id = p_chat and c.transparent and c.kind in ('direct', 'custom') and public.staff_can(c.team_id, 'messages'))
$$;
create or replace function public.chat_can_read(p_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chats c
     where c.id = p_chat
       and ((public.chat_participant(c.id, auth.uid()) and (public.chat_on(c.team_id) or public.is_team_staff(c.team_id)))
            or public.chat_observer(c.id)))
$$;
-- Schreiben: Chat an, Teilnehmer, Ankündigungs-Chats nur Staff; Einzelchats nur, solange die Einstellung sie erlaubt
create or replace function public.chat_can_write(p_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chats c
     where c.id = p_chat and public.chat_on(c.team_id) and public.chat_participant(c.id, auth.uid())
       and (public.is_team_staff(c.team_id) or not (c.read_only or (c.kind = 'team' and public.chat_cfg(c.team_id, 'teamReadOnly') = 'true')))
       and (c.kind <> 'direct' or (public.chat_cfg(c.team_id, 'dm') <> 'off' and (public.chat_cfg(c.team_id, 'dm') = 'all'
            or exists (select 1 from public.chat_members cm where cm.chat_id = c.id and public.chat_kind_of(c.team_id, cm.user_id) = 'staff')))))
$$;
-- Moderation: Trainerteam mit Recht „messages“ in Chats, die es lesen darf
create or replace function public.chat_can_moderate(p_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.chats c where c.id = p_chat and public.staff_can(c.team_id, 'messages') and public.chat_can_read(c.id))
$$;
do $$
declare f text;
begin
  foreach f in array array['public.chat_participant(uuid, uuid)', 'public.chat_observer(uuid)', 'public.chat_can_read(uuid)', 'public.chat_can_write(uuid)', 'public.chat_can_moderate(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Chats öffnen und anlegen (nur über diese Funktionen)
-- ---------------------------------------------------------------------
-- Teamchat und Trainerteam-Chat anlegen, falls noch nicht vorhanden
create or replace function public.chat_ensure(p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_member(p_team) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.chats (team_id, kind, created_by) values (p_team, 'team', null) on conflict do nothing;
  insert into public.chats (team_id, kind, created_by) values (p_team, 'staff', null) on conflict do nothing;
end;
$$;

-- Chat öffnen: team, staff, group (p_group) oder direct (p_other = Konto der anderen Person); liefert die ID
create or replace function public.chat_open(p_team uuid, p_kind text, p_group uuid default null, p_other uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_me   text := public.chat_kind_of(p_team, auth.uid());
  v_ot   text;
  v_dm   text;
  v_key  text;
  v_id   uuid;
begin
  if v_me is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.chat_on(p_team) then raise exception 'chat_off' using errcode = 'P0001'; end if;
  if p_kind in ('team', 'staff') then
    if p_kind = 'staff' and v_me <> 'staff' then raise exception 'forbidden' using errcode = '42501'; end if;
    perform public.chat_ensure(p_team);
    select id into v_id from public.chats where team_id = p_team and kind = p_kind;
  elsif p_kind = 'group' then
    if not exists (select 1 from public.team_groups g where g.id = p_group and g.team_id = p_team and g.visible) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if v_me <> 'staff' and not public.group_visible_to_me(p_group) then raise exception 'forbidden' using errcode = '42501'; end if;
    insert into public.chats (team_id, kind, group_id) values (p_team, 'group', p_group) on conflict do nothing;
    select id into v_id from public.chats where group_id = p_group and kind = 'group';
  elsif p_kind = 'direct' then
    v_ot := public.chat_kind_of(p_team, p_other);
    v_dm := public.chat_cfg(p_team, 'dm');
    if v_ot is null or p_other = v_uid then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_dm = 'off' or (v_dm = 'staff' and v_me <> 'staff' and v_ot <> 'staff') then raise exception 'dm_off' using errcode = 'P0001'; end if;
    v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);
    select id into v_id from public.chats where team_id = p_team and kind = 'direct' and pair_key = v_key;
    if v_id is null then
      insert into public.chats (team_id, kind, pair_key, transparent)
      values (p_team, 'direct', v_key, public.chat_cfg(p_team, 'transparent') = 'true' and v_me <> v_ot)
      on conflict do nothing returning id into v_id;
      if v_id is null then
        select id into v_id from public.chats where team_id = p_team and kind = 'direct' and pair_key = v_key;
      else
        insert into public.chat_members (chat_id, user_id, team_id) values (v_id, v_uid, p_team), (v_id, p_other, p_team) on conflict do nothing;
      end if;
    end if;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

-- Eigener Gruppen-Chat (z. B. „Fahrgemeinschaft“, „Kapitäne“): Staff immer; Spieler nur, wenn Einzelchats für alle erlaubt sind
create or replace function public.chat_save_custom(p_team uuid, p_chat uuid, p_title text, p_members uuid[], p_read_only boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_me   text := public.chat_kind_of(p_team, auth.uid());
  v_set  uuid[];
  v_id   uuid := p_chat;
  c      public.chats;
begin
  if v_me is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.chat_on(p_team) then raise exception 'chat_off' using errcode = 'P0001'; end if;
  if v_me <> 'staff' and public.chat_cfg(p_team, 'dm') <> 'all' then raise exception 'dm_off' using errcode = 'P0001'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 60 then raise exception 'invalid_name' using errcode = '22023'; end if;
  select array_agg(distinct u) into v_set from unnest(coalesce(p_members, '{}') || v_uid) u where u is not null;
  if cardinality(v_set) > 60 then raise exception 'limit' using errcode = 'P0001', detail = 'members'; end if;
  if cardinality(v_set) < 2 then raise exception 'invalid_members' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_set) u where public.chat_kind_of(p_team, u) is null) then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.chats (team_id, kind, title, read_only, transparent)
    values (p_team, 'custom', btrim(p_title), coalesce(p_read_only, false) and v_me = 'staff',
            public.chat_cfg(p_team, 'transparent') = 'true'
              and exists (select 1 from unnest(v_set) u where public.chat_kind_of(p_team, u) = 'staff')
              and exists (select 1 from unnest(v_set) u where public.chat_kind_of(p_team, u) = 'player'))
    returning id into v_id;
  else
    select * into c from public.chats where id = v_id and team_id = p_team and kind = 'custom';
    if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if not (c.created_by = v_uid or (v_me = 'staff' and public.chat_participant(c.id, v_uid)) or public.chat_can_moderate(c.id)) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    -- Transparenz bleibt (einmal mitgelesen = immer mitgelesen); neue gemischte Runden in Jugendteams werden transparent
    update public.chats set title = btrim(p_title), read_only = coalesce(p_read_only, false) and v_me = 'staff',
           transparent = transparent or (public.chat_cfg(p_team, 'transparent') = 'true'
              and exists (select 1 from unnest(v_set) u where public.chat_kind_of(p_team, u) = 'staff')
              and exists (select 1 from unnest(v_set) u where public.chat_kind_of(p_team, u) = 'player'))
     where id = v_id;
    delete from public.chat_members where chat_id = v_id and user_id <> all (v_set);
  end if;
  insert into public.chat_members (chat_id, user_id, team_id) select v_id, u, p_team from unnest(v_set) u on conflict do nothing;
  return v_id;
end;
$$;

-- Eigenen Chat verlassen (Ersteller: Chat bleibt für die anderen)
create or replace function public.chat_leave(p_chat uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.chats c where c.id = p_chat and c.kind = 'custom') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.chat_members where chat_id = p_chat and user_id = auth.uid();
  -- leere Chats entfernen
  delete from public.chats c where c.id = p_chat and not exists (select 1 from public.chat_members m where m.chat_id = c.id);
end;
$$;

-- Personen für den Chat: Trainerteam (Name, Funktion) und aktive Spieler mit Konto („Vorname N.“)
create or replace function public.chat_directory(p_team uuid)
returns table (user_id uuid, name text, kind text, player_id uuid, role text)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, public.chat_name_of(p_team, s.user_id), 'staff'::text, null::uuid,
         (select sp.role from public.staff_profiles sp where sp.team_id = p_team and sp.user_id = s.user_id order by sp.created_at limit 1)
    from public.team_staff s
   where s.team_id = p_team and s.role <> 'pending' and public.is_team_member(p_team)
  union all
  select p.user_id, public.chat_name_of(p_team, p.user_id), 'player'::text,
         case when public.is_team_staff(p_team) or p.user_id = auth.uid() then p.id end, null::text
    from public.players p
   where p.team_id = p_team and p.active and p.user_id is not null and public.is_team_member(p_team)
     and not exists (select 1 from public.team_staff s where s.team_id = p_team and s.user_id = p.user_id and s.role <> 'pending')
$$;

do $$
declare f text;
begin
  foreach f in array array['public.chat_ensure(uuid)', 'public.chat_open(uuid, text, uuid, uuid)', 'public.chat_save_custom(uuid, uuid, text, uuid[], boolean)',
                           'public.chat_leave(uuid)', 'public.chat_directory(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------
create or replace function public.chat_messages_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    select c.team_id into new.team_id from public.chats c where c.id = new.chat_id;
    if v_client then
      new.user_id := auth.uid(); new.created_at := now(); new.deleted_at := null; new.deleted_by := null;
      -- Schutz vor Spam: höchstens 30 Nachrichten pro Minute und Konto
      if (select count(*) from public.chat_messages m where m.user_id = new.user_id and m.created_at > now() - interval '1 minute') >= 30 then
        raise exception 'limit' using errcode = 'P0001', detail = 'chat_rate';
      end if;
    end if;
    new.sender_name := public.chat_name_of(new.team_id, new.user_id);
    if new.reply_to is not null and not exists (select 1 from public.chat_messages r where r.id = new.reply_to and r.chat_id = new.chat_id) then
      new.reply_to := null;
    end if;
    return new;
  end if;
  -- Ändern: nur löschen (Text wird geleert), sonst bleibt alles unverändert
  if v_client then
    if old.deleted_at is not null or new.deleted_at is null
       or (new.chat_id, new.team_id, new.user_id, new.reply_to, new.created_at) is distinct from (old.chat_id, old.team_id, old.user_id, old.reply_to, old.created_at) then
      raise exception 'forbidden: messages can only be deleted' using errcode = '42501';
    end if;
    new.deleted_at := now(); new.deleted_by := auth.uid(); new.sender_name := old.sender_name;
  end if;
  if new.deleted_at is not null then new.body := ''; end if;
  return new;
end;
$$;
revoke all on function public.chat_messages_prepare() from public, anon, authenticated;
drop trigger if exists chat_messages_prepare on public.chat_messages;
create trigger chat_messages_prepare before insert or update on public.chat_messages
  for each row execute function public.chat_messages_prepare();

-- Nach dem Senden: letzte Aktivität des Chats, eigener Lesestand, Push (falls eingerichtet)
create or replace function public.chat_messages_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats set last_at = greatest(coalesce(last_at, new.created_at), new.created_at) where id = new.chat_id;
  insert into public.chat_state (chat_id, user_id, read_at) values (new.chat_id, new.user_id, new.created_at)
  on conflict (chat_id, user_id) do update set read_at = greatest(public.chat_state.read_at, excluded.read_at);
  -- Push über die Edge Function chat-push (pg_net + Vault wie bei den Erinnerungen); ohne Einrichtung: nichts
  if to_regnamespace('net') is not null and to_regnamespace('vault') is not null then
    begin
      execute $q$
        select net.http_post(
          url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/chat-push',
          headers := jsonb_build_object('Content-Type', 'application/json',
                       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
          body    := jsonb_build_object('message_id', $1),
          timeout_milliseconds := 10000)
        where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
          and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret')$q$ using new.id;
    exception when others then
      raise notice 'chat-push nicht ausgelöst: %', sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke all on function public.chat_messages_after() from public, anon, authenticated;
drop trigger if exists chat_messages_after on public.chat_messages;
create trigger chat_messages_after after insert on public.chat_messages
  for each row execute function public.chat_messages_after();

create or replace function public.chat_reactions_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select m.chat_id, m.team_id into new.chat_id, new.team_id from public.chat_messages m where m.id = new.message_id and m.deleted_at is null;
  if new.chat_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if current_user in ('authenticated', 'anon') then new.user_id := auth.uid(); end if;
  return new;
end;
$$;
revoke all on function public.chat_reactions_prepare() from public, anon, authenticated;
drop trigger if exists chat_reactions_prepare on public.chat_reactions;
create trigger chat_reactions_prepare before insert on public.chat_reactions
  for each row execute function public.chat_reactions_prepare();

create or replace function public.chat_reports_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  m public.chat_messages;
begin
  if tg_op = 'INSERT' then
    select * into m from public.chat_messages where id = new.message_id;
    if m.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    new.chat_id := m.chat_id; new.team_id := m.team_id; new.snapshot := m.body; new.sender_name := m.sender_name; new.sent_at := m.created_at;
    if current_user in ('authenticated', 'anon') then
      if not public.chat_can_read(m.chat_id) then raise exception 'forbidden' using errcode = '42501'; end if;
      new.reporter := auth.uid(); new.status := 'open'; new.handled_by := null; new.handled_at := null; new.created_at := now();
    end if;
    return new;
  end if;
  if current_user in ('authenticated', 'anon') then
    -- Trainerteam bearbeitet nur den Status
    if (new.message_id, new.chat_id, new.team_id, new.reporter, new.reason, new.note, new.snapshot, new.sender_name, new.sent_at, new.created_at)
       is distinct from (old.message_id, old.chat_id, old.team_id, old.reporter, old.reason, old.note, old.snapshot, old.sender_name, old.sent_at, old.created_at) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      new.handled_by := case when new.status = 'done' then auth.uid() end;
      new.handled_at := case when new.status = 'done' then now() end;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.chat_reports_prepare() from public, anon, authenticated;
drop trigger if exists chat_reports_prepare on public.chat_reports;
create trigger chat_reports_prepare before insert or update on public.chat_reports
  for each row execute function public.chat_reports_prepare();

create or replace function public.chat_state_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.user_id := auth.uid();
    -- Lesestand nie in der Zukunft (Uhr des Geräts)
    if new.read_at > now() then new.read_at := now(); end if;
    if tg_op = 'UPDATE' and new.read_at < old.read_at then new.read_at := old.read_at; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.chat_state_prepare() from public, anon, authenticated;
drop trigger if exists chat_state_prepare on public.chat_state;
create trigger chat_state_prepare before insert or update on public.chat_state
  for each row execute function public.chat_state_prepare();

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.chats          enable row level security;
alter table public.chat_members   enable row level security;
alter table public.chat_state     enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.chat_reports   enable row level security;
alter table public.chat_push_log  enable row level security;

drop policy if exists chats_select on public.chats;
create policy chats_select on public.chats for select to authenticated using (public.chat_can_read(id));
-- Gruppen-Chats: Trainerteam schaltet „nur Trainerteam schreibt“ (Ankündigungen) um; alles andere über die Funktionen
drop policy if exists chats_update on public.chats;
create policy chats_update on public.chats for update to authenticated
  using (kind in ('group', 'staff') and public.staff_can(team_id, 'messages'))
  with check (kind in ('group', 'staff') and public.staff_can(team_id, 'messages'));
create or replace function public.chats_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and (new.team_id, new.kind, new.title, new.group_id, new.pair_key, new.transparent, new.created_by, new.created_at)
     is distinct from (old.team_id, old.kind, old.title, old.group_id, old.pair_key, old.transparent, old.created_by, old.created_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.chats_guard() from public, anon, authenticated;
drop trigger if exists chats_guard on public.chats;
create trigger chats_guard before update on public.chats for each row execute function public.chats_guard();

drop policy if exists chat_members_select on public.chat_members;
create policy chat_members_select on public.chat_members for select to authenticated using (public.chat_can_read(chat_id));

drop policy if exists chat_state_all on public.chat_state;
create policy chat_state_all on public.chat_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.chat_can_read(chat_id));

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select to authenticated using (public.chat_can_read(chat_id));
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and public.chat_can_write(chat_id));
drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update on public.chat_messages for update to authenticated
  using ((user_id = auth.uid() and public.chat_can_read(chat_id)) or public.chat_can_moderate(chat_id))
  with check ((user_id = auth.uid() and public.chat_can_read(chat_id)) or public.chat_can_moderate(chat_id));

drop policy if exists chat_reactions_select on public.chat_reactions;
create policy chat_reactions_select on public.chat_reactions for select to authenticated using (public.chat_can_read(chat_id));
drop policy if exists chat_reactions_insert on public.chat_reactions;
create policy chat_reactions_insert on public.chat_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.chat_on(team_id) and public.chat_participant(chat_id, auth.uid()));
drop policy if exists chat_reactions_delete on public.chat_reactions;
create policy chat_reactions_delete on public.chat_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists chat_reports_select on public.chat_reports;
create policy chat_reports_select on public.chat_reports for select to authenticated
  using (reporter = auth.uid() or public.staff_can(team_id, 'messages'));
drop policy if exists chat_reports_insert on public.chat_reports;
create policy chat_reports_insert on public.chat_reports for insert to authenticated with check (reporter = auth.uid());
drop policy if exists chat_reports_update on public.chat_reports;
create policy chat_reports_update on public.chat_reports for update to authenticated
  using (public.staff_can(team_id, 'messages')) with check (public.staff_can(team_id, 'messages'));

grant select, update on public.chats to authenticated;
grant select on public.chat_members to authenticated;
grant select, insert, update, delete on public.chat_state to authenticated;
grant select, insert, update on public.chat_messages to authenticated;
grant select, insert, delete on public.chat_reactions to authenticated;
grant select, insert, update on public.chat_reports to authenticated;

-- Echtzeit (Supabase Realtime beachtet die Zugriffsregeln); lokal ohne Realtime: nichts
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_messages', 'chat_reactions'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Push: Empfänger einer Nachricht (nur Server). Teilnehmer ohne Absender, nicht stumm, noch nicht gelesen,
-- höchstens eine Push-Nachricht je Chat und Minute; Mitlesende bekommen keine Push-Nachricht.
-- ---------------------------------------------------------------------
create or replace function public.chat_push_targets(p_message uuid)
returns table (user_id uuid, token text, lang text, chat_id uuid, team_id uuid, kind text, title text, sender text, area text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  m public.chat_messages;
  c public.chats;
begin
  select * into m from public.chat_messages where id = p_message;
  if m.id is null or m.deleted_at is not null then return; end if;
  select * into c from public.chats where id = m.chat_id;
  if not public.chat_on(c.team_id) then return; end if;
  return query
  with cand as (
    select s.user_id as uid from public.team_staff s where s.team_id = c.team_id and s.role <> 'pending'
    union
    select p.user_id from public.players p where p.team_id = c.team_id and p.active and p.user_id is not null
  ), rec as (
    select x.uid from cand x
     where x.uid <> m.user_id and public.chat_participant(c.id, x.uid)
       and not exists (select 1 from public.chat_state st where st.chat_id = c.id and st.user_id = x.uid and (st.muted or st.read_at >= m.created_at))
       and not exists (select 1 from public.chat_push_log l where l.chat_id = c.id and l.user_id = x.uid and l.sent_at > now() - interval '60 seconds')
  ), logged as (
    insert into public.chat_push_log (user_id, chat_id, sent_at)
    select r.uid, c.id, now() from rec r
    on conflict on constraint chat_push_log_pkey do update set sent_at = excluded.sent_at
    returning chat_push_log.user_id
  )
  select t.user_id, t.token, coalesce(pr.lang, 'de'), c.id, c.team_id, c.kind,
         case c.kind when 'team' then (select tm.name from public.teams tm where tm.id = c.team_id)
                     when 'group' then (select g.name from public.team_groups g where g.id = c.group_id)
                     when 'custom' then c.title
                     when 'direct' then m.sender_name
                     else null end,
         m.sender_name,
         case when public.chat_kind_of(c.team_id, t.user_id) = 'staff' then 'coach' else 'player' end
    from logged l
    join public.push_tokens t on t.user_id = l.user_id
    left join public.profiles pr on pr.id = l.user_id;
end;
$$;
revoke all on function public.chat_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.chat_push_targets(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Löschfristen: Chat-Nachrichten nach 24 Monaten, erledigte Meldungen und abgeschlossene
-- Anfragen für Individualtraining nach 12 Monaten, Push-Drosselung nach 30 Tagen
-- ---------------------------------------------------------------------
create or replace function public.purge_stale_health_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_health_cutoff date := (current_date - interval '24 months')::date;
  v_org_cutoff    date := (current_date - interval '12 months')::date;
  v_log_cutoff    date := current_date - 30;
  n_rpe int; n_wellness int; n_extra int; n_push int; n_ai int; n_fines int; n_duties int; n_tasks int;
  n_chat int; n_reports int; n_indiv int; n_chatpush int;
begin
  delete from public.rpe_entries      where date < v_health_cutoff; get diagnostics n_rpe = row_count;
  delete from public.wellness_entries where date < v_health_cutoff; get diagnostics n_wellness = row_count;
  delete from public.extra_activities where date < v_health_cutoff; get diagnostics n_extra = row_count;
  delete from public.push_log         where day  < v_log_cutoff;    get diagnostics n_push = row_count;
  -- KI-Tageszähler werden nach 30 Tagen ebenfalls nicht mehr gebraucht
  delete from public.ai_usage         where day  < v_log_cutoff;    get diagnostics n_ai = row_count;
  -- Dienste zuerst (Strafen-Dienste hängen per fine_id an der Strafe)
  delete from public.team_duties      where date < v_org_cutoff;    get diagnostics n_duties = row_count;
  delete from public.team_fines       where date < v_org_cutoff and status in ('done', 'waived'); get diagnostics n_fines = row_count;
  delete from public.team_tasks       where done_at is not null and done_at < v_org_cutoff; get diagnostics n_tasks = row_count;
  -- Chat
  delete from public.chat_messages    where created_at < v_health_cutoff; get diagnostics n_chat = row_count;
  delete from public.chat_reports     where status = 'done' and coalesce(handled_at, created_at) < v_org_cutoff; get diagnostics n_reports = row_count;
  delete from public.chat_push_log    where sent_at < v_log_cutoff; get diagnostics n_chatpush = row_count;
  delete from public.indiv_requests   where status <> 'open' and updated_at < v_org_cutoff; get diagnostics n_indiv = row_count;
  return jsonb_build_object(
    'rpe_entries', n_rpe, 'wellness_entries', n_wellness, 'extra_activities', n_extra,
    'push_log', n_push, 'ai_usage', n_ai, 'team_duties', n_duties, 'team_fines', n_fines, 'team_tasks', n_tasks,
    'chat_messages', n_chat, 'chat_reports', n_reports, 'chat_push_log', n_chatpush, 'indiv_requests', n_indiv,
    'health_cutoff', v_health_cutoff, 'org_cutoff', v_org_cutoff, 'log_cutoff', v_log_cutoff
  );
end;
$$;
revoke all on function public.purge_stale_health_data() from public, anon, authenticated;
grant execute on function public.purge_stale_health_data() to service_role;

-- ---------------------------------------------------------------------
-- Datenexport v5 (Art. 15/20 DSGVO): zusätzlich Entwicklung (nur Freigegebenes und Eigenes), Challenges,
-- Individualtraining und eigene Chat-Nachrichten, Reaktionen, Meldungen und Chat-Mitgliedschaften
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
    'format', 'trainerbank-export-v5',
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
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated;
