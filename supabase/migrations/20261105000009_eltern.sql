-- =====================================================================
-- Eltern-Zugang (Teil 1): eigene Elternkonten, Verknüpfung mit dem Kind per Einladungscode, die das Trainerteam
-- bestätigt; Eltern sehen nur Organisatorisches ihres Kindes (Termine, Abmeldungen, Kader-Nominierung, Elterninfo,
-- Einwilligungen) – keine Belastung, Gesundheitsangaben, Noten, Notizen, Chats oder Daten anderer Kinder.
-- - player_guardians: Verknüpfung Elternkonto ↔ Kind (höchstens zwei je Kind), wartet auf Bestätigung; Zugang nur,
--   solange das Kind minderjährig ist (Geburtsdatum) – ein volljähriges Kind kann ihn selbst verlängern (adult_ok)
-- - guardian_invites: Einladungscode je Kind (nur als Hash gespeichert, 14 Tage gültig, für bis zu zwei Elternteile);
--   guardian_code_attempts begrenzt Fehlversuche (10 je Stunde)
-- - parent_posts / parent_post_reads: Elterninfo vom Trainerteam (Recht „squad“), gelesen und bestätigt
-- - guardian_child_data: alles, was Eltern sehen, als ein Paket (Datenminimierung: nur nötige Felder, Zeitfenster;
--   Krankheit und Verletzung nur bei eigenen Abmeldungen, sonst nur „abwesend“)
-- - guardian_absence, guardian_answer, guardian_consent, parent_post_read: Abmelden, Zu-/Absage, Einwilligungen
-- - Einwilligungen für Kinder unter 16 (Art. 8 DSGVO): bestätigte Eltern willigen selbst ein (consents mit player_id);
--   missing_health_consent und photo_consent_save berücksichtigen das
-- - Löschfristen (purge_guardians, täglich): Einladungen nach Ablauf, unbestätigte Anfragen nach 30 Tagen,
--   Verknüpfungen 30 Tage nach dem 18. Geburtstag (außer das Kind hat verlängert), Elterninfo nach 12 Monaten;
--   endet eine Verknüpfung, enden auch die Einwilligungen dieses Elternteils fürs Kind (Widerruf als Nachweis)
-- - merge_players v16, Export v17
-- =====================================================================

alter table public.match_nominations add column if not exists answered_by_guardian boolean not null default false;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------
create table if not exists public.player_guardians (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null constraint player_guardians_name_valid check (char_length(btrim(name)) between 2 and 60 and name !~ '[[:cntrl:]]'),
  relation     text not null default 'guardian' constraint player_guardians_relation_valid check (relation in ('mother', 'father', 'guardian')),
  status       text not null default 'pending' constraint player_guardians_status_valid check (status in ('pending', 'active')),
  adult_ok     boolean not null default false,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  constraint player_guardians_unique unique (player_id, user_id)
);
create index if not exists player_guardians_user_idx on public.player_guardians (user_id);
create index if not exists player_guardians_team_idx on public.player_guardians (team_id);

create table if not exists public.guardian_invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  code_hash  text not null unique,
  uses_left  smallint not null default 2 constraint guardian_invites_uses_valid check (uses_left between 0 and 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists guardian_invites_player_idx on public.guardian_invites (player_id);

create table if not exists public.guardian_code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists guardian_code_attempts_idx on public.guardian_code_attempts (user_id, at);

create table if not exists public.parent_posts (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  title      text not null constraint parent_posts_title_valid check (char_length(btrim(title)) between 1 and 120 and title !~ '[[:cntrl:]]'),
  body       text not null constraint parent_posts_body_valid check (char_length(btrim(body)) between 1 and 4000),
  need_ack   boolean not null default false,
  author     text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parent_posts_team_idx on public.parent_posts (team_id, created_at);

create table if not exists public.parent_post_reads (
  post_id  uuid not null references public.parent_posts (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  read_at  timestamptz not null default now(),
  acked_at timestamptz,
  primary key (post_id, user_id)
);
create index if not exists parent_post_reads_user_idx on public.parent_post_reads (user_id);

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------
-- Minderjährig: Geburtsdatum bekannt und jünger als 18 (Tag des Teams) – ohne Geburtsdatum kein Eltern-Zugang
create or replace function public.player_minor(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.birthdate > (public.team_today(p.team_id) - interval '18 years')::date
                     from public.players p where p.id = p_player), false)
$$;

-- Modul „Eltern-Zugang“ im Team an? (fehlt der Schlüssel: an, außer im Erwachsenenbereich – wie in der App)
-- Aus: Eltern sehen nichts und können nichts eintragen, Codes gelten nicht; Verknüpfungen bleiben bestehen
create or replace function public.team_parents_on(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select coalesce((t.modules ->> 'eltern')::boolean, t.age_class not in ('sen', 'ue32'))
                     from public.teams t where t.id = p_team), false)
$$;

-- Bestätigter Elternteil des Kindes mit Zugang (minderjährig oder vom volljährigen Kind verlängert, Modul an)
create or replace function public.is_guardian_of(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.player_guardians g
                  where g.player_id = p_player and g.user_id = auth.uid() and g.status = 'active'
                    and (g.adult_ok or public.player_minor(g.player_id)) and public.team_parents_on(g.team_id))
$$;

create or replace function public.is_guardian_in_team(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.player_guardians g
                  where g.team_id = p_team and g.user_id = auth.uid() and g.status = 'active'
                    and (g.adult_ok or public.player_minor(g.player_id))) and public.team_parents_on(p_team)
$$;

-- Einwilligung eines Elternteils (bestimmter Nutzer) für das Kind
create or replace function public.guardian_consent_given(p_player uuid, p_kind text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.consents c
                  where c.player_id = p_player and c.kind = p_kind and c.user_id = p_user and c.withdrawn_at is null)
$$;

-- Einwilligung irgendeines bestätigten Elternteils für das Kind (geprüfte Eltern-Einwilligung)
create or replace function public.guardian_consent_ok(p_player uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.consents c
                   join public.player_guardians g on g.user_id = c.user_id and g.player_id = c.player_id and g.status = 'active'
                  where c.player_id = p_player and c.kind = p_kind and c.withdrawn_at is null)
$$;

-- Gibt es eine (bestätigte) Verknüpfung dieses Kontos mit dem Kind? (für Zugriffsregeln ohne Rechte auf die Tabelle)
create or replace function public.guardian_link_exists(p_player uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.player_guardians g where g.player_id = p_player and g.user_id = p_user and g.status = 'active')
$$;
revoke all on function public.guardian_link_exists(uuid, uuid) from public, anon;
grant execute on function public.guardian_link_exists(uuid, uuid) to authenticated;

create or replace function public.guardian_code_hash(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

create or replace function public.generate_guardian_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text := '';
  bytes bytea;
  b     int;
  i     int;
begin
  while char_length(code) < 10 loop
    bytes := uuid_send(gen_random_uuid());
    foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15] loop
      b := get_byte(bytes, i);
      if b < 248 then
        code := code || substr(alphabet, (b % 31) + 1, 1);
        exit when char_length(code) = 10;
      end if;
    end loop;
  end loop;
  return substr(code, 1, 5) || '-' || substr(code, 6, 5);
end;
$$;

revoke all on function public.team_parents_on(uuid), public.player_minor(uuid), public.is_guardian_of(uuid), public.is_guardian_in_team(uuid),
  public.guardian_consent_given(uuid, text, uuid), public.guardian_consent_ok(uuid, text), public.guardian_code_hash(text),
  public.generate_guardian_code() from public, anon;
grant execute on function public.team_parents_on(uuid), public.player_minor(uuid), public.is_guardian_of(uuid), public.is_guardian_in_team(uuid),
  public.guardian_consent_ok(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------
alter table public.player_guardians enable row level security;
alter table public.guardian_invites enable row level security;
alter table public.guardian_code_attempts enable row level security;
alter table public.parent_posts enable row level security;
alter table public.parent_post_reads enable row level security;

-- Verknüpfungen: der Elternteil selbst, das Trainerteam (Recht „squad“) und das Kind (Transparenz) – schreiben nur per Funktion
drop policy if exists player_guardians_select on public.player_guardians;
create policy player_guardians_select on public.player_guardians for select to authenticated
  using (user_id = (select auth.uid()) or public.staff_can(team_id, 'squad') or public.is_own_player(player_id));
drop policy if exists guardian_invites_select on public.guardian_invites;
create policy guardian_invites_select on public.guardian_invites for select to authenticated
  using (public.staff_can(team_id, 'squad'));
revoke all on public.player_guardians, public.guardian_invites, public.guardian_code_attempts from anon, authenticated;
grant select on public.player_guardians to authenticated;
-- Einladungen: ohne den Hash des Codes (Spaltenrechte)
grant select (id, team_id, player_id, uses_left, created_by, created_at, expires_at) on public.guardian_invites to authenticated;

-- Elterninfo: schreibt das Trainerteam (Recht „squad“), lesen Trainerteam und bestätigte Eltern des Teams
create or replace function public.parent_posts_prepare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.team_id <> old.team_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.created_at := now();
      new.created_by := auth.uid();
      new.author := (select left(coalesce(nullif(btrim(pr.display_name), ''), '–'), 80) from public.profiles pr where pr.id = auth.uid());
    else
      new.created_at := old.created_at; new.created_by := old.created_by; new.author := old.author;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.parent_posts_prepare() from public, anon, authenticated;
drop trigger if exists parent_posts_prepare on public.parent_posts;
create trigger parent_posts_prepare before insert or update on public.parent_posts for each row execute function public.parent_posts_prepare();

drop policy if exists parent_posts_select on public.parent_posts;
create policy parent_posts_select on public.parent_posts for select to authenticated
  using (public.staff_can(team_id, 'squad') or public.is_guardian_in_team(team_id));
drop policy if exists parent_posts_insert on public.parent_posts;
create policy parent_posts_insert on public.parent_posts for insert to authenticated with check (public.staff_can(team_id, 'squad'));
drop policy if exists parent_posts_update on public.parent_posts;
create policy parent_posts_update on public.parent_posts for update to authenticated
  using (public.staff_can(team_id, 'squad')) with check (public.staff_can(team_id, 'squad'));
drop policy if exists parent_posts_delete on public.parent_posts;
create policy parent_posts_delete on public.parent_posts for delete to authenticated using (public.staff_can(team_id, 'squad'));
revoke all on public.parent_posts, public.parent_post_reads from anon;
grant select, insert, update, delete on public.parent_posts to authenticated;

drop policy if exists parent_post_reads_select on public.parent_post_reads;
create policy parent_post_reads_select on public.parent_post_reads for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.parent_posts p where p.id = post_id and public.staff_can(p.team_id, 'squad')));
revoke insert, update, delete on public.parent_post_reads from authenticated;
grant select on public.parent_post_reads to authenticated;

-- Einwilligungen: das Trainerteam sieht auch die Einwilligungen der Eltern für seine Spieler
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff_of_user(user_id)
         or (player_id is not null and public.is_staff_of_player(player_id) and public.guardian_link_exists(player_id, user_id)));

-- Antwort der Eltern bei der Nominierung kennzeichnen (nur guardian_answer setzt die Kennung)
create or replace function public.match_nominations_guardian()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.answer is distinct from old.answer or new.answered_at is distinct from old.answered_at then
    new.answered_by_guardian := new.answer is not null and coalesce(current_setting('trainerbank.by_guardian', true), '') = 'on';
  else
    new.answered_by_guardian := old.answered_by_guardian;
  end if;
  return new;
end;
$$;
revoke all on function public.match_nominations_guardian() from public, anon, authenticated;
drop trigger if exists match_nominations_guardian on public.match_nominations;
create trigger match_nominations_guardian before insert or update on public.match_nominations
  for each row execute function public.match_nominations_guardian();

-- ---------------------------------------------------------------------
-- Verknüpfen: Einladung (Trainerteam), Code einlösen (Eltern), bestätigen, lösen, verlängern
-- ---------------------------------------------------------------------
create or replace function public.guardian_invite_create(p_player uuid)
returns table (invite_code text, invite_expires timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_code text;
  v_n    int;
  v_exp  timestamptz := now() + interval '14 days';
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_team := public.player_team(p_player);
  if v_team is null or not public.staff_can(v_team, 'squad') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.team_parents_on(v_team) then
    raise exception 'module_off' using errcode = 'P0001';
  end if;
  if (select p.birthdate from public.players p where p.id = p_player) is null then
    raise exception 'birthdate_required' using errcode = 'P0001';
  end if;
  if not public.player_minor(p_player) then
    raise exception 'not_minor' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.player_guardians where player_id = p_player;
  if v_n >= 2 then
    raise exception 'guardians_full' using errcode = 'P0001';
  end if;
  delete from public.guardian_invites where player_id = p_player;
  v_code := public.generate_guardian_code();
  insert into public.guardian_invites (team_id, player_id, code_hash, uses_left, created_by, expires_at)
  values (v_team, p_player, public.guardian_code_hash(v_code), 2 - v_n, auth.uid(), v_exp);
  return query select v_code, v_exp;
end;
$$;

-- Einlösen: Fehlversuche werden gezählt (ohne Ausnahme, damit die Zählung bleibt); höchstens zwei Elternteile je Kind
create or replace function public.guardian_redeem(p_code text, p_name text, p_relation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_inv  public.guardian_invites;
  v_link uuid;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g'));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.guardian_code_attempts where user_id = v_uid and at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 2 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_relation is null or p_relation not in ('mother', 'father', 'guardian') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select * into v_inv from public.guardian_invites
   where code_hash = public.guardian_code_hash(p_code) and expires_at > now() and uses_left > 0
   for update;
  if v_inv.id is null then
    insert into public.guardian_code_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if exists (select 1 from public.players p where p.id = v_inv.player_id and p.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'own_player');
  end if;
  if not public.team_parents_on(v_inv.team_id) then
    return jsonb_build_object('ok', false, 'error', 'module_off');
  end if;
  select id into v_link from public.player_guardians where player_id = v_inv.player_id and user_id = v_uid;
  if v_link is null then
    if (select count(*) from public.player_guardians where player_id = v_inv.player_id) >= 2 then
      return jsonb_build_object('ok', false, 'error', 'guardians_full');
    end if;
    insert into public.player_guardians (team_id, player_id, user_id, name, relation)
    values (v_inv.team_id, v_inv.player_id, v_uid, v_name, p_relation)
    returning id into v_link;
    update public.guardian_invites set uses_left = uses_left - 1 where id = v_inv.id;
  end if;
  return jsonb_build_object('ok', true, 'link_id', v_link,
    'first_name', (select p.first_name from public.players p where p.id = v_inv.player_id),
    'team', (select t.name from public.teams t where t.id = v_inv.team_id));
end;
$$;

create or replace function public.guardian_decide(p_link uuid, p_ok boolean)
returns public.player_guardians
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.player_guardians;
begin
  select * into v_g from public.player_guardians where id = p_link for update;
  if v_g.id is null or not public.staff_can(v_g.team_id, 'squad') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not coalesce(p_ok, false) then
    delete from public.player_guardians where id = p_link;
    return null;
  end if;
  update public.player_guardians set status = 'active', confirmed_at = coalesce(confirmed_at, now()), confirmed_by = coalesce(confirmed_by, auth.uid())
   where id = p_link returning * into v_g;
  return v_g;
end;
$$;

-- Lösen: Trainerteam, der Elternteil selbst oder das volljährige Kind
create or replace function public.guardian_remove(p_link uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.player_guardians;
begin
  select * into v_g from public.player_guardians where id = p_link;
  if v_g.id is null or not (public.staff_can(v_g.team_id, 'squad') or v_g.user_id = auth.uid()
                            or (public.is_own_player(v_g.player_id) and not public.player_minor(v_g.player_id))) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.player_guardians where id = p_link;
end;
$$;

-- Verknüpfung gelöst (Eltern, Trainerteam, volljähriges Kind oder Löschfrist): die Einwilligungen dieses Elternteils
-- für das Kind enden mit – als Widerruf mit Zeitpunkt (der Nachweis bleibt), neue Verknüpfung = neue Einwilligung
create or replace function public.player_guardians_ended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.consents set withdrawn_at = now()
   where user_id = old.user_id and player_id = old.player_id and kind in ('parental', 'health_data') and withdrawn_at is null;
  return old;
end;
$$;
revoke all on function public.player_guardians_ended() from public, anon, authenticated;
drop trigger if exists player_guardians_ended on public.player_guardians;
create trigger player_guardians_ended after delete on public.player_guardians
  for each row execute function public.player_guardians_ended();

-- Volljähriges Kind verlängert bzw. beendet den Zugang seiner Eltern
create or replace function public.guardian_adult_ok(p_link uuid, p_ok boolean)
returns public.player_guardians
language plpgsql
security definer
set search_path = public
as $$
declare
  v_g public.player_guardians;
begin
  select * into v_g from public.player_guardians where id = p_link;
  if v_g.id is null or not public.is_own_player(v_g.player_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.player_minor(v_g.player_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.player_guardians set adult_ok = coalesce(p_ok, false) where id = p_link returning * into v_g;
  return v_g;
end;
$$;

-- ---------------------------------------------------------------------
-- Was Eltern sehen
-- ---------------------------------------------------------------------
create or replace function public.guardian_children()
returns table (link_id uuid, player_id uuid, first_name text, last_name text, team_id uuid, team_name text, club text,
               age_class text, status text, relation text, access boolean, module_on boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.player_id, p.first_name, coalesce(p.last_name, ''), g.team_id, t.name, t.club, t.age_class, g.status, g.relation,
         g.status = 'active' and (g.adult_ok or public.player_minor(g.player_id)) and public.team_parents_on(g.team_id),
         public.team_parents_on(g.team_id)
    from public.player_guardians g
    join public.players p on p.id = g.player_id
    join public.teams t on t.id = g.team_id
   where g.user_id = auth.uid()
   order by p.first_name, p.last_name
$$;

-- Paket fürs Kind: Team (ohne Codes), Spiele, Termine, Trainingsänderungen, Pausen im Zeitfenster; Abwesenheiten des
-- Kindes ohne Stufe und Hinweis; Nominierungen mit Treffpunkt (ohne Kaderliste); Foto-Erlaubnis; eigene Einwilligungen;
-- Elterninfo der letzten 120 Tage mit eigenem Lesestand
create or replace function public.guardian_child_data(p_player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_team  uuid;
  v_today date;
  v_from  date;
  v_to    date;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_guardian_of(p_player) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_team := public.player_team(p_player);
  v_today := public.team_today(v_team);
  v_from := v_today - 14;
  v_to := v_today + 60;
  return jsonb_build_object(
    'team', (select to_jsonb(t) - 'join_code' - 'staff_code' - 'principles' - 'created_by' - 'owner_id' from public.teams t where t.id = v_team),
    'player', (select jsonb_build_object('id', p.id, 'team_id', p.team_id, 'first_name', p.first_name, 'last_name', p.last_name, 'birthdate', p.birthdate,
                                         'shirt_number', p.shirt_number, 'position', p.position, 'active', p.active)
                 from public.players p where p.id = p_player),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'team_id', m.team_id, 'date', m.date, 'time', m.time, 'opponent', m.opponent,
                                                             'home', m.home, 'competition', m.competition) order by m.date, m.time)
                           from public.matches m where m.team_id = v_team and m.date between v_from and v_to), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'team_id', e.team_id, 'date', e.date, 'time', e.time, 'title', e.title, 'type', e.type,
                                                            'replaces_training', e.replaces_training) order by e.date)
                          from public.team_events e where e.team_id = v_team and e.date between v_from and v_to), '[]'::jsonb),
    'cal', coalesce((select jsonb_agg(jsonb_build_object('date', c.date, 'cancel', c.cancel, 'extra', c.extra, 'time', c.time, 'duration', c.duration))
                       from public.calendar_overrides c where c.team_id = v_team and c.date between v_from and v_to), '[]'::jsonb),
    'breaks', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'date_from', s.date_from, 'date_to', s.date_to) order by s.date_from)
                          from public.season_phases s
                         where s.team_id = v_team and s.kind = 'break' and s.visible and s.date_to >= v_from and s.date_from <= v_to), '[]'::jsonb),
    -- Krankheit und Verletzung (Gesundheitsdaten) nur bei eigenen Abmeldungen – sonst nur „abwesend“ (Art leer)
    'absences', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'player_id', a.player_id,
                                                              'type', case when a.created_by is not distinct from v_uid or a.type not in ('krank', 'verletzung') then a.type end,
                                                              'from_date', a.from_date, 'to_date', a.to_date,
                                                              'reported_by_player', a.reported_by_player, 'mine', a.created_by is not distinct from v_uid,
                                                              'by_parent', exists (select 1 from public.player_guardians g where g.player_id = a.player_id and g.user_id = a.created_by))
                                                 order by a.from_date)
                            from public.absences a
                           where a.player_id = p_player and coalesce(a.to_date, v_to) >= v_from and a.from_date <= v_to), '[]'::jsonb),
    'noms', coalesce((select jsonb_agg(jsonb_build_object('match_id', n.match_id, 'player_id', n.player_id, 'standby', n.standby, 'answer', n.answer,
                                                          'reason', n.reason, 'answered_at', n.answered_at, 'answered_by_staff', n.answered_by_staff,
                                                          'answered_by_guardian', n.answered_by_guardian))
                        from public.match_nominations n join public.matches m on m.id = n.match_id
                       where n.player_id = p_player and m.date between v_today - 1 and v_to and public.squad_published(n.match_id)), '[]'::jsonb),
    'squads', coalesce((select jsonb_agg(jsonb_build_object('match_id', s.match_id, 'meet_time', s.meet_time, 'meet_place', s.meet_place, 'note', s.note,
                                                            'show_all', false, 'published_at', s.published_at))
                          from public.match_squads s join public.matches m on m.id = s.match_id
                         where s.team_id = v_team and m.date between v_today - 1 and v_to and s.published_at is not null
                           and exists (select 1 from public.match_nominations n where n.match_id = s.match_id and n.player_id = p_player)), '[]'::jsonb),
    'photo', (select to_jsonb(c) - 'updated_by' from public.photo_consents c where c.player_id = p_player),
    'consents', jsonb_build_object('parental', public.guardian_consent_given(p_player, 'parental', v_uid),
                                   'health_data', public.guardian_consent_given(p_player, 'health_data', v_uid)),
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'body', x.body, 'need_ack', x.need_ack, 'author', x.author,
                                                           'created_at', x.created_at, 'read_at', r.read_at, 'acked_at', r.acked_at) order by x.created_at desc)
                         from public.parent_posts x
                         left join public.parent_post_reads r on r.post_id = x.id and r.user_id = v_uid
                        where x.team_id = v_team and x.created_at >= now() - interval '120 days'), '[]'::jsonb),
    'guardians', (select count(*) from public.player_guardians g where g.player_id = p_player)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Was Eltern tun: abmelden, zu- und absagen, einwilligen, Elterninfo lesen
-- ---------------------------------------------------------------------
-- Abmelden: Krank, Urlaub, Schule, Sonstiges (ohne Hinweis und Stufe) – nur, wenn Absagen durch Spieler erlaubt sind;
-- „Krank“ ist eine Gesundheitsangabe und braucht die Einwilligung des Elternteils in Gesundheitsdaten
create or replace function public.guardian_absence(p_player uuid, p_type text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  uuid;
  v_today date;
  v_row   public.absences;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_guardian_of(p_player) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_team := public.player_team(p_player);
  v_today := public.team_today(v_team);
  if not public.team_setting_bool(v_team, 'playerAbs', true) then
    raise exception 'answers_off' using errcode = 'P0001';
  end if;
  if p_type is null or p_type not in ('krank', 'urlaub', 'schule', 'sonst') then
    raise exception 'invalid_type' using errcode = '22023';
  end if;
  if p_type = 'krank' and not public.guardian_consent_given(p_player, 'health_data', auth.uid()) then
    raise exception 'consent_required' using errcode = 'P0001', detail = 'health_data';
  end if;
  if p_from is null or p_from < v_today - 7 or p_from > v_today + 365
     or (p_to is not null and (p_to < p_from or p_to > p_from + 90)) then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  insert into public.absences (team_id, player_id, type, from_date, to_date, reported_by_player, created_by)
  values (v_team, p_player, p_type, p_from, coalesce(p_to, p_from), true, auth.uid())
  returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'player_id', v_row.player_id, 'type', v_row.type, 'from_date', v_row.from_date, 'to_date', v_row.to_date,
                            'reported_by_player', true, 'mine', true);
end;
$$;

-- Eigene Abmeldung zurücknehmen (nicht rückwirkend)
create or replace function public.guardian_absence_delete(p_absence uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a public.absences;
begin
  select * into v_a from public.absences where id = p_absence;
  if v_a.id is null or v_a.created_by is distinct from auth.uid() or not public.is_guardian_of(v_a.player_id)
     or coalesce(v_a.to_date, v_a.from_date) < public.team_today(v_a.team_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.absences where id = p_absence;
end;
$$;

-- Zu- und Absage für das Kind (wie answer_nomination; als Antwort der Eltern gekennzeichnet)
create or replace function public.guardian_answer(p_match uuid, p_player uuid, p_answer text, p_reason text default null)
returns public.match_nominations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match  public.matches;
  v_team   public.teams;
  v_nom    public.match_nominations;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_answer is null or p_answer not in ('yes', 'no') then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;
  if not public.is_guardian_of(p_player)
     or not exists (select 1 from public.match_nominations n where n.match_id = p_match and n.player_id = p_player)
     or not public.squad_published(p_match) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_match from public.matches where id = p_match;
  select * into v_team from public.teams where id = v_match.team_id;
  if coalesce((v_team.settings ->> 'playerAbs')::boolean, true) = false then
    raise exception 'answers_off' using errcode = 'P0001';
  end if;
  if now() >= ((v_match.date + coalesce(nullif(v_match.time, ''), '23:59')::time)
               at time zone coalesce(nullif(v_team.timezone, ''), 'Europe/Berlin')) then
    raise exception 'match_started' using errcode = 'P0001';
  end if;
  v_reason := case when p_answer = 'no'
                   then nullif(btrim(left(btrim(regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g')), 200)), '') end;
  perform set_config('trainerbank.by_guardian', 'on', true);
  update public.match_nominations
     set answer = p_answer, reason = v_reason, answered_at = now(), answered_by_staff = false
   where match_id = p_match and player_id = p_player
  returning * into v_nom;
  perform set_config('trainerbank.by_guardian', 'off', true);
  return v_nom;
end;
$$;

-- Einwilligung des Elternteils für das Kind geben oder widerrufen: App-Nutzung (unter 16) und Gesundheitsdaten
create or replace function public.guardian_consent(p_player uuid, p_kind text, p_give boolean, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_guardian_of(p_player) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('parental', 'health_data') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  if coalesce(p_give, false) then
    if not public.guardian_consent_given(p_player, p_kind, auth.uid()) then
      insert into public.consents (user_id, kind, version, player_id) values (auth.uid(), p_kind, coalesce(nullif(btrim(p_version), ''), '1'), p_player);
    end if;
  else
    update public.consents set withdrawn_at = now()
     where user_id = auth.uid() and player_id = p_player and kind = p_kind and withdrawn_at is null;
  end if;
end;
$$;

create or replace function public.parent_post_read(p_post uuid, p_ack boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select team_id into v_team from public.parent_posts where id = p_post;
  if v_team is null or not public.is_guardian_in_team(v_team) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.parent_post_reads (post_id, user_id, read_at, acked_at)
  values (p_post, auth.uid(), now(), case when coalesce(p_ack, false) then now() end)
  on conflict (post_id, user_id) do update
    set acked_at = coalesce(public.parent_post_reads.acked_at, excluded.acked_at);
end;
$$;

-- Trainerteam: geprüfte Einwilligungen der Eltern je Spieler (für Kinder unter 16)
create or replace function public.team_guardian_consents(p_team uuid)
returns table (player_id uuid, kind text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.player_id, c.kind
    from public.consents c
    join public.player_guardians g on g.user_id = c.user_id and g.player_id = c.player_id and g.status = 'active'
   where g.team_id = p_team and c.withdrawn_at is null and c.kind in ('parental', 'health_data')
     and public.is_team_staff(p_team)
$$;

-- Gesundheitsdaten des Kindes: unter 16 zählt auch die geprüfte Einwilligung eines bestätigten Elternteils
create or replace function public.missing_health_consent(pid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_birthdate date;
  v_u16       boolean;
begin
  select p.birthdate into v_birthdate from public.players p where p.id = pid;
  v_u16 := v_birthdate is not null and v_birthdate > (current_date - interval '16 years')::date;
  if not public.has_consent(auth.uid(), 'health_data') and not (v_u16 and public.guardian_consent_ok(pid, 'health_data')) then
    return 'health_data';
  end if;
  if v_u16 and not public.has_consent(auth.uid(), 'parental') and not public.guardian_consent_ok(pid, 'parental') then
    return 'parental';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Löschfristen
-- ---------------------------------------------------------------------
create or replace function public.purge_guardians()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  k integer;
begin
  delete from public.guardian_invites where expires_at < now();
  get diagnostics k = row_count; n := n + k;
  delete from public.guardian_code_attempts where at < now() - interval '1 day';
  delete from public.player_guardians where status = 'pending' and created_at < now() - interval '30 days';
  get diagnostics k = row_count; n := n + k;
  delete from public.player_guardians g
   using public.players p
   where p.id = g.player_id and not g.adult_ok
     and p.birthdate is not null and p.birthdate <= (current_date - interval '18 years' - interval '30 days')::date;
  get diagnostics k = row_count; n := n + k;
  delete from public.parent_posts where created_at < now() - interval '12 months';
  get diagnostics k = row_count; n := n + k;
  return n;
end;
$$;

revoke all on function public.guardian_invite_create(uuid), public.guardian_redeem(text, text, text), public.guardian_decide(uuid, boolean),
  public.guardian_remove(uuid), public.guardian_adult_ok(uuid, boolean), public.guardian_children(), public.guardian_child_data(uuid),
  public.guardian_absence(uuid, text, date, date), public.guardian_absence_delete(uuid), public.guardian_answer(uuid, uuid, text, text),
  public.guardian_consent(uuid, text, boolean, text), public.parent_post_read(uuid, boolean), public.team_guardian_consents(uuid),
  public.purge_guardians() from public, anon;
grant execute on function public.guardian_invite_create(uuid), public.guardian_redeem(text, text, text), public.guardian_decide(uuid, boolean),
  public.guardian_remove(uuid), public.guardian_adult_ok(uuid, boolean), public.guardian_children(), public.guardian_child_data(uuid),
  public.guardian_absence(uuid, text, date, date), public.guardian_absence_delete(uuid), public.guardian_answer(uuid, uuid, text, text),
  public.guardian_consent(uuid, text, boolean, text), public.parent_post_read(uuid, boolean), public.team_guardian_consents(uuid) to authenticated;
revoke all on function public.purge_guardians() from authenticated;
grant execute on function public.purge_guardians() to service_role;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-guardians: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-guardians', '25 4 * * *', 'select public.purge_guardians()');
exception when others then
  raise notice 'purge-guardians konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------
-- Foto-Erlaubnis (Ersatz für 20261105000008): zusätzlich bestätigte Eltern (Erklärung der Eltern; reine Widerrufe lassen
-- eine gemeinsame Erklärung bestehen) und 14- bis 17-Jährige, die der Erklärung ihrer Eltern zustimmen (→ beide)
-- ---------------------------------------------------------------------
create or replace function public.photo_consent_save(p_player uuid, p_web boolean, p_social boolean, p_press boolean, p_name boolean,
                                                     p_by text, p_on date, p_note text)
returns public.photo_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team     uuid;
  v_old      public.photo_consents;
  v_row      public.photo_consents;
  v_birth    date;
  v_cls      text;
  v_today    date;
  v_self     boolean;
  v_confirm  boolean;
  v_withdraw boolean;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_team := public.player_team(p_player);
  if v_team is null or not (public.is_team_member(v_team) or public.is_guardian_of(p_player)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('photo_consent:' || p_player::text));
  select * into v_old from public.photo_consents where player_id = p_player;
  v_today := public.team_today(v_team);
  -- nur Widerrufe bzw. unverändert?
  v_withdraw := (p_web is not distinct from v_old.web or p_web = false) and (p_social is not distinct from v_old.social or p_social = false)
                and (p_press is not distinct from v_old.press or p_press = false) and (p_name is not distinct from v_old.name_ok or p_name = false);

  if public.staff_can(v_team, 'squad') then
    if p_by is not null and p_by not in ('player', 'parents', 'both') then
      raise exception 'invalid_by' using errcode = '22023';
    end if;
    if p_on is not null and p_on > v_today + 1 then
      raise exception 'date_future' using errcode = '22023';
    end if;
    insert into public.photo_consents (player_id, team_id, web, social, press, name_ok, given_by, given_on, note, updated_at, updated_by)
    values (p_player, v_team, p_web, p_social, p_press, p_name, p_by, p_on, v_note, now(), auth.uid())
    on conflict (player_id) do update
      set web = excluded.web, social = excluded.social, press = excluded.press, name_ok = excluded.name_ok, given_by = excluded.given_by,
          given_on = excluded.given_on, note = excluded.note, updated_at = now(), updated_by = auth.uid()
    returning * into v_row;
    return v_row;
  end if;

  if public.is_guardian_of(p_player) and public.player_minor(p_player) then
    insert into public.photo_consents (player_id, team_id, web, social, press, name_ok, given_by, given_on, note, updated_at, updated_by)
    values (p_player, v_team, p_web, p_social, p_press, p_name,
            case when v_withdraw and v_old.given_by is not null then v_old.given_by else 'parents' end,
            case when v_withdraw and v_old.given_on is not null then v_old.given_on else v_today end, v_old.note, now(), auth.uid())
    on conflict (player_id) do update
      set web = excluded.web, social = excluded.social, press = excluded.press, name_ok = excluded.name_ok, given_by = excluded.given_by,
          given_on = excluded.given_on, updated_at = now(), updated_by = auth.uid()
    returning * into v_row;
    return v_row;
  end if;

  if not public.is_own_player(p_player) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select p.birthdate into v_birth from public.players p where p.id = p_player;
  select t.age_class into v_cls from public.teams t where t.id = v_team;
  v_self := case when v_birth is not null then v_birth <= (v_today - interval '18 years')::date else v_cls in ('sen', 'ue32') end;
  -- je Kanal: unverändert, „Nein“ oder (volljährig) „Ja“ – zurück auf „offen“ nur über das Trainerteam
  if (p_web is distinct from v_old.web and not coalesce(p_web = false or (p_web and v_self), false))
     or (p_social is distinct from v_old.social and not coalesce(p_social = false or (p_social and v_self), false))
     or (p_press is distinct from v_old.press and not coalesce(p_press = false or (p_press and v_self), false))
     or (p_name is distinct from v_old.name_ok and not coalesce(p_name = false or (p_name and v_self), false)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- 14 bis 17: der Erklärung der Eltern zustimmen
  v_confirm := not v_self and p_by = 'both' and v_old.given_by = 'parents'
               and v_birth is not null and v_birth <= (v_today - interval '14 years')::date;
  if v_old.player_id is not null and not v_confirm and p_web is not distinct from v_old.web and p_social is not distinct from v_old.social
     and p_press is not distinct from v_old.press and p_name is not distinct from v_old.name_ok then
    return v_old;
  end if;
  insert into public.photo_consents (player_id, team_id, web, social, press, name_ok, given_by, given_on, note, updated_at, updated_by)
  values (p_player, v_team, p_web, p_social, p_press, p_name,
          case when v_self then 'player' when v_confirm then 'both' else v_old.given_by end,
          case when v_self or v_confirm then v_today else v_old.given_on end, v_old.note, now(), auth.uid())
  on conflict (player_id) do update
    set web = excluded.web, social = excluded.social, press = excluded.press, name_ok = excluded.name_ok, given_by = excluded.given_by,
        given_on = excluded.given_on, updated_at = now(), updated_by = auth.uid()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.photo_consent_save(uuid, boolean, boolean, boolean, boolean, text, date, text) from public, anon;
grant execute on function public.photo_consent_save(uuid, boolean, boolean, boolean, boolean, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- merge_players v16: zusätzlich Eltern-Verknüpfungen (sonst wie v15, 20261105000008)
-- ---------------------------------------------------------------------
create or replace function public.merge_players(p_new uuid, p_existing uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new public.players;
  v_old public.players;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_new is null or p_existing is null or p_new = p_existing then
    raise exception 'invalid_merge' using errcode = '22023';
  end if;

  -- Beide Zeilen sperren (feste Reihenfolge gegen Deadlocks)
  perform 1 from public.players where id in (p_new, p_existing) order by id for update;
  select * into v_new from public.players where id = p_new;
  select * into v_old from public.players where id = p_existing;
  if v_new.id is null or v_old.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (public.is_team_staff(v_new.team_id) and public.is_team_staff(v_old.team_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_new.team_id <> v_old.team_id then
    raise exception 'different_teams' using errcode = '22023';
  end if;
  if v_old.user_id is not null then
    raise exception 'already_linked' using errcode = '22023';
  end if;
  if v_new.user_id is null then
    raise exception 'not_linked' using errcode = '22023';
  end if;

  -- Konto umhängen (erst lösen wegen unique(team_id, user_id)); leere Stammdaten ergänzen
  update public.players set user_id = null where id = p_new;
  update public.players p
     set user_id      = v_new.user_id,
         is_new       = false,
         birthdate    = coalesce(p.birthdate, v_new.birthdate),
         position     = coalesce(p.position, v_new.position),
         shirt_number = coalesce(p.shirt_number, v_new.shirt_number),
         weight_kg    = coalesce(p.weight_kg, v_new.weight_kg)
   where p.id = p_existing;

  -- Tabellen mit Schlüssel (player_id, date): nur verschieben, wenn kein Konflikt
  -- RPE je Einheit des Tages (0 = Mannschaftstraining, 1–9 = weitere Einheit)
  update public.rpe_entries r set player_id = p_existing
   where r.player_id = p_new
     and not exists (select 1 from public.rpe_entries x where x.player_id = p_existing and x.date = r.date and x.slot = r.slot);
  update public.wellness_entries w set player_id = p_existing
   where w.player_id = p_new
     and not exists (select 1 from public.wellness_entries x where x.player_id = p_existing and x.date = w.date);
  update public.attendance a set player_id = p_existing
   where a.player_id = p_new
     and not exists (select 1 from public.attendance x where x.player_id = p_existing and x.date = a.date);
  update public.coach_notes n set player_id = p_existing
   where n.player_id = p_new
     and not exists (select 1 from public.coach_notes x where x.player_id = p_existing);

  -- Tabellen mit eigener id: vollständig verschieben
  update public.extra_activities    set player_id = p_existing where player_id = p_new;
  update public.absences            set player_id = p_existing where player_id = p_new;
  update public.growth_measurements set player_id = p_existing where player_id = p_new;
  update public.potentials          set player_id = p_existing where player_id = p_new;
  update public.coach_messages      set player_id = p_existing where player_id = p_new;
  update public.consents            set player_id = p_existing where player_id = p_new;

  -- Spieldaten, Noten, Leistungstests, Befunde (Baustein 4–6)
  update public.match_stats s set player_id = p_existing
   where s.player_id = p_new
     and not exists (select 1 from public.match_stats x where x.player_id = p_existing and x.match_id = s.match_id);
  update public.player_ratings    set player_id = p_existing where player_id = p_new;
  update public.performance_tests set player_id = p_existing where player_id = p_new;
  -- Befunde behalten ihren Speicherpfad (Ordner der alten Zeile); Zugriff regelt finding_row_role()
  update public.findings          set player_id = p_existing where player_id = p_new;
  update public.videos set player_ids = array_replace(player_ids, p_new, p_existing) where p_new = any (player_ids);

  -- Gruppen, Aufgaben, Dienste, Strafen (Pakete 3 und 7)
  update public.group_members g set player_id = p_existing
   where g.player_id = p_new
     and not exists (select 1 from public.group_members x where x.player_id = p_existing and x.group_id = g.group_id);
  update public.team_tasks set player_id = p_existing where player_id = p_new;
  update public.team_fines f set player_id = p_existing
   where f.player_id = p_new
     and (f.ref_date is null or not exists (select 1 from public.team_fines x where x.player_id = p_existing and x.rule = f.rule and x.ref_date = f.ref_date));
  update public.team_duties d set player_id = p_existing
   where d.player_id = p_new
     and not exists (select 1 from public.team_duties x where x.player_id = p_existing and x.date = d.date and x.duty = d.duty);

  -- Mannschaftskasse (Paket 11.3): Zahlungen und Befreiungen übernehmen. Zahlungen für Strafen, die als Doppelung
  -- bei der neuen Zeile bleiben (und mit ihr gelöscht werden), verlieren nur den Verweis – die Buchung bleibt.
  update public.cash_entries c set fine_id = null
   where c.player_id = p_new and c.fine_id in (select f.id from public.team_fines f where f.player_id = p_new);
  update public.cash_entries c set player_id = p_existing
   where c.player_id = p_new
     and (c.fee_id is null or not exists (select 1 from public.cash_entries x where x.player_id = p_existing and x.fee_id = c.fee_id and x.period = c.period));
  update public.cash_entries set player_id = null where player_id = p_new;
  insert into public.cash_waivers (team_id, player_id, fee_id, period)
  select w.team_id, p_existing, w.fee_id, w.period from public.cash_waivers w where w.player_id = p_new
  on conflict do nothing;

  -- Spielerentwicklung, Wochenchallenge, Individualtraining (Paket C)
  update public.player_assessments set player_id = p_existing where player_id = p_new;
  update public.player_goals       set player_id = p_existing where player_id = p_new;
  update public.goal_entries       set player_id = p_existing where player_id = p_new;
  update public.dev_talks          set player_id = p_existing where player_id = p_new;
  update public.indiv_requests     set player_id = p_existing where player_id = p_new;
  update public.challenge_entries c set player_id = p_existing
   where c.player_id = p_new
     and not exists (select 1 from public.challenge_entries x where x.player_id = p_existing and x.challenge_id = c.challenge_id);
  update public.day_units set player_ids = array_replace(player_ids, p_new, p_existing) where p_new = any (player_ids);

  -- Entwicklungsprogramm: Programm und Selbstanalyse nur übernehmen, wenn die bestehende Zeile keins hat; Stärken-Runde
  -- als Schenkender und Empfänger (ohne Doppelungen und ohne Einträge an sich selbst)
  update public.dev_programs set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.dev_programs x where x.player_id = p_existing);
  update public.dev_self set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.dev_self x where x.player_id = p_existing);
  delete from public.dev_peer_skills
   where (giver_id = p_new and target_id = p_existing) or (giver_id = p_existing and target_id = p_new);
  update public.dev_peer_skills g set giver_id = p_existing
   where g.giver_id = p_new
     and not exists (select 1 from public.dev_peer_skills x where x.giver_id = p_existing and x.target_id = g.target_id);
  update public.dev_peer_skills g set target_id = p_existing
   where g.target_id = p_new
     and not exists (select 1 from public.dev_peer_skills x where x.target_id = p_existing and x.giver_id = g.giver_id);

  -- Notfallkontakte und Hinweise: der neuere Eintrag gilt (meist der vom Spieler beim Beitreten)
  delete from public.player_emergency e
   where e.player_id = p_existing
     and exists (select 1 from public.player_emergency n where n.player_id = p_new and n.updated_at >= e.updated_at);
  update public.player_emergency set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.player_emergency x where x.player_id = p_existing);
  delete from public.player_emergency_med e
   where e.player_id = p_existing
     and exists (select 1 from public.player_emergency_med n where n.player_id = p_new and n.updated_at >= e.updated_at);
  update public.player_emergency_med set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.player_emergency_med x where x.player_id = p_existing);

  -- Größen: der neuere Eintrag gilt (meist der vom Spieler selbst)
  delete from public.player_sizes e
   where e.player_id = p_existing
     and exists (select 1 from public.player_sizes n where n.player_id = p_new and n.updated_at >= e.updated_at);
  update public.player_sizes set player_id = p_existing
   where player_id = p_new and not exists (select 1 from public.player_sizes x where x.player_id = p_existing);

  -- Kader-Nominierungen übernehmen (ohne Doppelungen – Rest geht mit der neuen Zeile)
  update public.match_nominations n set player_id = p_existing
   where n.player_id = p_new
     and not exists (select 1 from public.match_nominations x where x.player_id = p_existing and x.match_id = n.match_id);

  -- Fahrgemeinschaften: eigene Fahrten (als Fahrer), Plätze und Suchen übernehmen – je Ziel nur eins davon; Doppelungen
  -- bleiben bei der neuen Zeile und gehen mit ihr (eine doppelte eigene Fahrt samt Mitfahrern)
  update public.rides r set driver_pid = p_existing
   where r.driver_pid = p_new
     and not exists (select 1 from public.rides x where x.driver_pid = p_existing and x.ref_id = r.ref_id)
     and not exists (select 1 from public.ride_seats x where x.player_id = p_existing and x.ref_id = r.ref_id);
  update public.ride_seats s set player_id = p_existing
   where s.player_id = p_new
     and not exists (select 1 from public.ride_seats x where x.player_id = p_existing and x.ref_id = s.ref_id)
     and not exists (select 1 from public.rides x where x.driver_pid = p_existing and x.ref_id = s.ref_id);
  update public.ride_needs n set player_id = p_existing
   where n.player_id = p_new
     and not exists (select 1 from public.ride_needs x where x.player_id = p_existing and x.ref_id = n.ref_id)
     and not exists (select 1 from public.rides x where x.driver_pid = p_existing and x.ref_id = n.ref_id)
     and not exists (select 1 from public.ride_seats x where x.player_id = p_existing and x.ref_id = n.ref_id);

  -- Eltern-Verknüpfungen übernehmen (doppelte Verknüpfung desselben Elternteils entfällt), Einladungen verfallen
  delete from public.player_guardians n using public.player_guardians e
   where n.player_id = p_new and e.player_id = p_existing and e.user_id = n.user_id;
  update public.player_guardians set player_id = p_existing where player_id = p_new;
  delete from public.guardian_invites where player_id = p_new;

  -- Foto-Erlaubnis: die zuletzt geänderte Erklärung gilt
  if exists (select 1 from public.photo_consents n where n.player_id = p_new
             and n.updated_at > coalesce((select e.updated_at from public.photo_consents e where e.player_id = p_existing), '-infinity'::timestamptz)) then
    delete from public.photo_consents where player_id = p_existing;
    update public.photo_consents set player_id = p_existing, team_id = public.player_team(p_existing) where player_id = p_new;
  end if;
  -- Unfallmeldungen übernehmen
  update public.accident_reports set player_id = p_existing where player_id = p_new;

  -- Eingetragene Sperren übernehmen (je Karte nur eine – doppelte bleiben bei der neuen Zeile)
  update public.player_suspensions x set player_id = p_existing
   where x.player_id = p_new
     and (x.match_id is null
          or not exists (select 1 from public.player_suspensions y where y.player_id = p_existing and y.match_id = x.match_id and y.kind = x.kind));

  -- Umfragen: Antworten übernehmen (ohne Doppelungen – Rest geht mit der neuen Zeile, der Zähler folgt) und eigene Abstimmungen
  update public.poll_answers a set player_id = p_existing
   where a.player_id = p_new
     and not exists (select 1 from public.poll_answers x where x.player_id = p_existing and x.poll_id = a.poll_id);
  update public.polls set author_player = p_existing where author_player = p_new;

  -- Matchplan (Paket B): Zugriffsprotokoll, Kader der Freigabe, Spieler-IDs in Aufstellung, Folien, Aufgaben und Wechseln
  update public.match_plan_views set player_id = p_existing where player_id = p_new;
  update public.match_plans set squad = array_replace(squad, p_new, p_existing) where p_new = any (squad);
  update public.match_plans
     set content   = replace(content::text, p_new::text, p_existing::text)::jsonb,
         published = case when published is null then null else replace(published::text, p_new::text, p_existing::text)::jsonb end
   where team_id = v_new.team_id
     and (strpos(content::text, p_new::text) > 0 or strpos(coalesce(published::text, ''), p_new::text) > 0);

  -- Rest (Konfliktzeilen) wird per Cascade mit der neuen Zeile gelöscht.
  -- Hinweis: ein Foto {team_id}/{p_new}.jpg muss die App per Storage-API entfernen.
  delete from public.players where id = p_new;
  return p_existing;
end;
$$;

revoke all on function public.merge_players(uuid, uuid) from public, anon;
grant execute on function public.merge_players(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Datenexport v17 (Art. 15/20 DSGVO): zusätzlich Eltern-Verknüpfungen, gelesene Elterninfos, verknüpfte Eltern
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
    'format', 'trainerbank-export-v17',
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
    -- Entwicklungsprogramm: freigegebenes Programm, eigene Selbstanalyse, Stärken-Runde
    'dev_program', coalesce((
      select jsonb_agg(jsonb_build_object('content', d.content, 'published_at', d.published_at) order by d.published_at)
        from public.dev_programs d where d.player_id = any (v_players) and d.visible), '[]'::jsonb),
    'dev_self', coalesce((
      select jsonb_agg(jsonb_build_object('weapons', s.weapons, 'skills', s.skills, 'updated_at', s.updated_at) order by s.updated_at)
        from public.dev_self s where s.player_id = any (v_players)), '[]'::jsonb),
    'peer_skills_given', coalesce((
      select jsonb_agg(jsonb_build_object('to', p.first_name, 'skills', g.skills, 'at', g.updated_at) order by g.updated_at)
        from public.dev_peer_skills g join public.players p on p.id = g.target_id
       where g.giver_id = any (v_players)), '[]'::jsonb),
    'peer_skills_received', coalesce((
      select jsonb_object_agg(x.k, x.n order by x.k) from (
        select k, count(*) as n from public.dev_peer_skills g cross join lateral unnest(g.skills) k
         where g.target_id = any (v_players) group by k) x), '{}'::jsonb),
    -- Notfallkontakte und Hinweise für den Notfall der eigenen Spielerzeilen
    'emergency_contacts', coalesce((
      select jsonb_agg(jsonb_build_object('contacts', x.contacts, 'updated_at', x.updated_at)) from public.player_emergency x
       where x.player_id = any (v_players)), '[]'::jsonb),
    'emergency_notes', coalesce((
      select jsonb_agg(jsonb_build_object('note', x.note, 'updated_at', x.updated_at)) from public.player_emergency_med x
       where x.player_id = any (v_players)), '[]'::jsonb),
    -- Größen der eigenen Spielerzeilen
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('top', x.top, 'bottom', x.bottom, 'shoes', x.shoes, 'gloves', x.gloves,
                                          'print_name', x.print_name, 'note', x.note, 'updated_at', x.updated_at))
        from public.player_sizes x where x.player_id = any (v_players)), '[]'::jsonb),
    -- Kader-Nominierungen: eigene (Spiel, Kader oder Abruf, Zu-/Absage mit Grund) – nur veröffentlichte Kader
    'nominations', coalesce((
      select jsonb_agg(jsonb_build_object('match_date', m.date, 'opponent', m.opponent, 'standby', n.standby, 'answer', n.answer,
                                          'reason', n.reason, 'answered_at', n.answered_at, 'answered_by_staff', n.answered_by_staff) order by m.date)
        from public.match_nominations n join public.matches m on m.id = n.match_id join public.match_squads s on s.match_id = n.match_id
       where n.player_id = any (v_players) and s.published_at is not null), '[]'::jsonb),
    -- Umfragen: eigene Antworten (mit Fragen) und selbst gestartete Umfragen; Antworten anderer gehören diesen
    'poll_answers', coalesce((
      select jsonb_agg(jsonb_build_object('poll', p.title, 'kind', p.kind, 'anonymous', p.anonymous, 'questions', p.questions,
                                          'answers', a.answers, 'at', a.updated_at) order by a.created_at)
        from public.poll_answers a join public.polls p on p.id = a.poll_id
       where a.player_id = any (v_players)), '[]'::jsonb),
    'polls_started', coalesce((
      select jsonb_agg(jsonb_build_object('title', p.title, 'kind', p.kind, 'questions', p.questions, 'created_at', p.created_at,
                                          'until', p.until, 'closed_at', p.closed_at) order by p.created_at)
        from public.polls p where p.created_by = v_uid or p.author_player = any (v_players)), '[]'::jsonb),
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
  -- jsonb_build_object nimmt höchstens 100 Argumente: weitere Bereiche in einem zweiten Objekt
  ) || jsonb_build_object(
    -- Fahrgemeinschaften: eigene Fahrten als Fahrer, eigene Plätze (mit Fahrer und Abfahrt) und Suchen – ohne die
    -- Namen anderer Mitfahrer
    'rides_offered', coalesce((
      select jsonb_agg(jsonb_build_object('date', coalesce(m.date, e.date), 'target', coalesce(m.opponent, e.title), 'driver', r.driver_label,
                                          'seats', r.seats, 'depart_time', r.depart_time, 'depart_place', r.depart_place, 'note', r.note,
                                          'passengers', (select count(*) from public.ride_seats s where s.ride_id = r.id), 'created_at', r.created_at)
                       order by coalesce(m.date, e.date))
        from public.rides r left join public.matches m on m.id = r.match_id left join public.team_events e on e.id = r.event_id
       where r.driver_pid = any (v_players)), '[]'::jsonb),
    'ride_seats', coalesce((
      select jsonb_agg(jsonb_build_object('date', coalesce(m.date, e.date), 'target', coalesce(m.opponent, e.title), 'driver', r.driver_label,
                                          'staff_ride', r.driver_pid is null, 'depart_time', r.depart_time, 'depart_place', r.depart_place, 'since', s.created_at)
                       order by coalesce(m.date, e.date))
        from public.ride_seats s join public.rides r on r.id = s.ride_id
        left join public.matches m on m.id = r.match_id left join public.team_events e on e.id = r.event_id
       where s.player_id = any (v_players)), '[]'::jsonb),
    'ride_needs', coalesce((
      select jsonb_agg(jsonb_build_object('date', coalesce(m.date, e.date), 'target', coalesce(m.opponent, e.title), 'since', n.created_at)
                       order by coalesce(m.date, e.date))
        from public.ride_needs n left join public.matches m on m.id = n.match_id left join public.team_events e on e.id = n.event_id
       where n.player_id = any (v_players)), '[]'::jsonb),
    -- Karten stehen in match_stats (card); eingetragene Sperren der eigenen Spielerzeilen
    'suspensions', coalesce((
      select jsonb_agg(jsonb_build_object('kind', x.kind, 'match_date', m.date, 'opponent', m.opponent, 'start', x.start_date, 'games', x.games,
                                          'until', x.until_date, 'scope', x.scope, 'note', x.note, 'updated_at', x.updated_at) order by x.start_date)
        from public.player_suspensions x left join public.matches m on m.id = x.match_id
       where x.player_id = any (v_players)), '[]'::jsonb),
    -- Foto-Erlaubnis und Unfallmeldungen der eigenen Spielerzeilen
    'photo_consents', coalesce((
      select jsonb_agg(jsonb_build_object('website', c.web, 'social_media', c.social, 'press', c.press, 'name', c.name_ok, 'declared_by', c.given_by,
                                          'declared_on', c.given_on, 'note', c.note, 'updated_at', c.updated_at))
        from public.photo_consents c
       where c.player_id = any (v_players)), '[]'::jsonb),
    'accident_reports', coalesce((
      select jsonb_agg(jsonb_build_object('date', a.accident_date, 'time', a.accident_time, 'place', a.place, 'activity', a.activity, 'match_date', m.date,
                                          'opponent', m.opponent, 'how', a.how, 'injury', a.injury, 'body_area', a.body_area, 'first_aid', a.first_aid,
                                          'treatment', a.treatment, 'witnesses', a.witnesses, 'reported_to_club', a.club_on, 'reported_to_insurer', a.insurer_on,
                                          'claim_number', a.claim_no, 'closed', a.closed, 'note', a.note, 'updated_at', a.updated_at) order by a.accident_date)
        from public.accident_reports a left join public.matches m on m.id = a.match_id
       where a.player_id = any (v_players)), '[]'::jsonb),
    -- Eltern-Zugang: eigene Verknüpfungen als Elternteil, gelesene Elterninfos; als Spieler: verknüpfte Eltern
    'guardian_links', coalesce((
      select jsonb_agg(jsonb_build_object('child', p.first_name, 'team', t.name, 'name', g.name, 'relation', g.relation, 'status', g.status,
                                          'adult_ok', g.adult_ok, 'created_at', g.created_at, 'confirmed_at', g.confirmed_at) order by g.created_at)
        from public.player_guardians g join public.players p on p.id = g.player_id join public.teams t on t.id = g.team_id
       where g.user_id = v_uid), '[]'::jsonb),
    'parent_post_reads', coalesce((
      select jsonb_agg(jsonb_build_object('title', x.title, 'read_at', r.read_at, 'acked_at', r.acked_at) order by r.read_at)
        from public.parent_post_reads r join public.parent_posts x on x.id = r.post_id
       where r.user_id = v_uid), '[]'::jsonb),
    'my_guardians', coalesce((
      select jsonb_agg(jsonb_build_object('name', g.name, 'relation', g.relation, 'status', g.status, 'adult_ok', g.adult_ok, 'created_at', g.created_at)
                       order by g.created_at)
        from public.player_guardians g
       where g.player_id = any (v_players)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_data_export() from public, anon;
grant execute on function public.my_data_export() to authenticated, service_role;
