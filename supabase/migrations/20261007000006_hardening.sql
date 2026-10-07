-- =====================================================================
-- Trainerbank – Datenschutz-Härtung (Ergebnis des Privacy-Reviews)
--
--  1. Staff-Freigabe: join_staff legt nur eine Anfrage (role 'pending') an;
--     der Owner bestätigt (approve_staff) oder lehnt ab (reject_staff).
--  2. Kein automatisches Verknüpfen in join_team (Risiko Kontoübernahme);
--     Staff führt Spielerzeilen per merge_players zusammen.
--  3. Einwilligungen: neue Arten, Widerruf (withdrawn_at), Bezug zum Spieler,
--     Nachweis bleibt nach Kontolöschung erhalten (user_id → null, E-Mail-Hash).
--  4. Serverseitige Einwilligungsprüfung für Gesundheitsdaten (Art. 9 DSGVO,
--     Art. 8 DSGVO / § 8 BDSG-Entwurf: Eltern-Einwilligung unter 16).
--  5. Löschfristen: Gesundheitsdaten 24 Monate, push_log 30 Tage (täglich 03:30 UTC).
--  6. Datenexport für Betroffene (Art. 15/20 DSGVO): my_data_export().
--
-- Ersetzt per "create or replace" Funktionen aus *_rls.sql und *_rpc.sql;
-- alle Änderungen sind wiederholbar (idempotent).
-- =====================================================================

-- =====================================================================
-- 1. Staff-Freigabe
-- =====================================================================
alter table public.team_staff drop constraint if exists team_staff_role_check;
alter table public.team_staff
  add constraint team_staff_role_check check (role in ('owner', 'coach', 'physio', 'pending'));
comment on column public.team_staff.role is
  'owner | coach | physio = Staff; pending = Beitrittsanfrage per Staff-Code, noch ohne Rechte.';

-- Hilfsfunktionen: 'pending' zählt nicht als Staff (und damit nicht als Mitglied)
create or replace function public.is_team_staff(team uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_staff s
    where s.team_id = $1 and s.user_id = auth.uid() and s.role <> 'pending'
  );
$$;

create or replace function public.is_staff_of_player(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    join public.team_staff s on s.team_id = p.team_id
    where p.id = $1 and s.user_id = auth.uid() and s.role <> 'pending'
  );
$$;

create or replace function public.is_staff_of_user(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    join public.team_staff s on s.team_id = p.team_id
    where p.user_id = $1 and s.user_id = auth.uid() and s.role <> 'pending'
  );
$$;
-- is_team_member (nutzt is_team_staff), is_team_owner (role = 'owner') und
-- avatar_access (nutzt is_team_staff) bleiben unverändert korrekt.

-- join_staff: nur Anfrage stellen (Rolle 'pending'); bestehende Rolle bleibt erhalten
create or replace function public.join_staff(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select t.id into v_team from public.teams t where t.staff_code = public.normalize_team_code(p_code);
  if v_team is null then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  insert into public.team_staff (team_id, user_id, role)
  values (v_team, v_uid, 'pending')
  on conflict (team_id, user_id) do nothing;

  return v_team;
end;
$$;

-- Eigene offene Anfragen mit Verein/Teamname (der Anfragende sieht sonst nichts vom Team)
create or replace function public.my_pending_teams()
returns table (team_id uuid, club text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.club, t.name
  from public.team_staff s
  join public.teams t on t.id = s.team_id
  where s.user_id = auth.uid() and s.role = 'pending'
  order by t.club, t.name;
$$;

-- Anfrage bestätigen (nur Owner); p_role: 'coach' oder 'physio'
create or replace function public.approve_staff(p_team uuid, p_user uuid, p_role text default 'coach')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_owner(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('coach', 'physio') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  update public.team_staff s
     set role = p_role
   where s.team_id = p_team and s.user_id = p_user and s.role = 'pending';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Anfrage ablehnen (nur Owner)
create or replace function public.reject_staff(p_team uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_owner(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.team_staff s
   where s.team_id = p_team and s.user_id = p_user and s.role = 'pending';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Trainerteam inkl. offener Anfragen mit Anzeigenamen (nur Staff;
-- profiles sind per RLS sonst nur für das eigene Konto lesbar)
create or replace function public.team_staff_list(p_team uuid)
returns table (user_id uuid, role text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_staff(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.user_id, s.role, p.display_name
    from public.team_staff s
    left join public.profiles p on p.id = s.user_id
    where s.team_id = p_team
    order by case s.role when 'owner' then 0 when 'coach' then 1 when 'physio' then 2 else 3 end,
             p.display_name nulls last;
end;
$$;

-- =====================================================================
-- 2. join_team ohne automatisches Verknüpfen + merge_players
-- =====================================================================
create or replace function public.join_team(
  p_code         text,
  p_first_name   text,
  p_last_name    text,
  p_birthdate    date,
  p_position     text,
  p_shirt_number int,
  p_weight_kg    numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_team   uuid;
  v_player uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select t.id into v_team from public.teams t where t.join_code = public.normalize_team_code(p_code);
  if v_team is null then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  -- Beitritte pro Team serialisieren (verhindert Doppelanlage bei Doppelklick)
  perform pg_advisory_xact_lock(hashtextextended('trainerbank.join_team:' || v_team::text, 0));

  -- Konto hat im Team schon eine Spielerzeile → diese zurückgeben
  select p.id into v_player from public.players p where p.team_id = v_team and p.user_id = v_uid;
  if v_player is not null then
    return v_player;
  end if;

  if nullif(btrim(coalesce(p_first_name, '')), '') is null then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  -- Immer neue Zeile; Zusammenführen mit einer vom Trainer angelegten Zeile
  -- erfolgt bewusst durch Staff (merge_players), nie automatisch.
  insert into public.players (team_id, user_id, first_name, last_name, birthdate,
                              position, shirt_number, weight_kg, is_new, active)
  values (v_team, v_uid, btrim(p_first_name), nullif(btrim(coalesce(p_last_name, '')), ''), p_birthdate,
          nullif(btrim(coalesce(p_position, '')), ''), p_shirt_number::smallint, p_weight_kg, true, true)
  returning id into v_player;

  return v_player;
end;
$$;

-- Führt die per Beitritt neu entstandene Zeile (p_new, mit Konto) mit einer vom
-- Trainer angelegten Zeile (p_existing, ohne Konto) zusammen. Bei Konflikten
-- (gleicher Primärschlüssel) gewinnt die vorhandene Zeile von p_existing.
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
  update public.rpe_entries r set player_id = p_existing
   where r.player_id = p_new
     and not exists (select 1 from public.rpe_entries x where x.player_id = p_existing and x.date = r.date);
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

  -- Rest (Konfliktzeilen) wird per Cascade mit der neuen Zeile gelöscht.
  -- Hinweis: ein Foto {team_id}/{p_new}.jpg muss die App per Storage-API entfernen.
  delete from public.players where id = p_new;
  return p_existing;
end;
$$;

-- =====================================================================
-- 3. Einwilligungen als dauerhafter Nachweis
-- =====================================================================
alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents
  add constraint consents_kind_check
  check (kind in ('privacy', 'health_data', 'parental', 'ai', 'staff_confidentiality'));

alter table public.consents add column if not exists withdrawn_at timestamptz;
alter table public.consents add column if not exists player_id uuid;
alter table public.consents add column if not exists user_email_hash text;

alter table public.consents drop constraint if exists consents_player_id_fkey;
alter table public.consents
  add constraint consents_player_id_fkey
  foreign key (player_id) references public.players (id) on delete set null;

-- Nachweis überlebt die Kontolöschung: user_id wird null, der E-Mail-Hash bleibt
alter table public.consents alter column user_id drop not null;
alter table public.consents drop constraint if exists consents_user_id_fkey;
alter table public.consents
  add constraint consents_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

create index if not exists consents_player_idx on public.consents (player_id) where player_id is not null;
create index if not exists consents_email_hash_idx on public.consents (user_email_hash);

comment on column public.consents.withdrawn_at    is 'Zeitpunkt des Widerrufs (endgültig; neue Einwilligung = neue Zeile).';
comment on column public.consents.player_id       is 'Optional: Spielerzeile, auf die sich die Einwilligung bezieht.';
comment on column public.consents.user_email_hash is 'sha256(lower(E-Mail)) als Nachweis nach Kontolöschung; per Trigger gesetzt.';

-- E-Mail-Hash des eigenen Kontos (für den Trigger; liefert für fremde Konten null)
create or replace function public.consent_email_hash(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(sha256(convert_to(lower(btrim(u.email)), 'UTF8')), 'hex')
  from auth.users u
  where u.id = p_user
    and (auth.uid() is null or p_user = auth.uid());
$$;

-- Clients: Einwilligung nur für sich selbst anlegen (given_at = jetzt), danach
-- ausschließlich widerrufen (withdrawn_at null → jetzt). Löschen ist für Clients
-- nicht vorgesehen (keine Delete-Policy).
create or replace function public.consents_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    new.user_email_hash := public.consent_email_hash(new.user_id);
    if v_client then
      new.given_at := now();
      new.withdrawn_at := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if v_client then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.kind is distinct from old.kind
       or new.version is distinct from old.version
       or new.parent_email is distinct from old.parent_email
       or new.given_at is distinct from old.given_at
       or new.player_id is distinct from old.player_id
       or new.user_email_hash is distinct from old.user_email_hash then
      raise exception 'forbidden: only withdrawn_at of a consent can be changed' using errcode = '42501';
    end if;
    if old.withdrawn_at is not null and new.withdrawn_at is distinct from old.withdrawn_at then
      raise exception 'forbidden: a withdrawal is final, give a new consent instead' using errcode = '42501';
    end if;
    if old.withdrawn_at is null and new.withdrawn_at is not null then
      new.withdrawn_at := now();  -- Serverzeit statt Client-Zeitstempel
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists consents_guard on public.consents;
create trigger consents_guard
  before insert or update on public.consents
  for each row execute function public.consents_guard();

-- Policies: Spielerbezug nur auf eigene Spielerzeile; kein Löschen durch Clients
drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (player_id is null or public.is_own_player(player_id))
  );

drop policy if exists consents_delete on public.consents;
revoke delete on public.consents from authenticated;

-- =====================================================================
-- 4. Einwilligungsprüfung für selbst eingetragene Gesundheitsdaten
-- =====================================================================

-- Aktive (nicht widerrufene) Einwilligung vorhanden? Auskunft nur über das eigene
-- Konto bzw. für Staff über eigene Spieler (serverseitig: alle).
create or replace function public.has_consent(p_user uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = p_user
      and c.kind = p_kind
      and c.withdrawn_at is null
  )
  and (auth.uid() is null or p_user = auth.uid() or public.is_staff_of_user(p_user));
$$;

-- Fehlende Einwilligung für Einträge des angemeldeten Spielers: null = alles da,
-- sonst 'health_data' oder 'parental' (unter 16 Jahren laut players.birthdate).
create or replace function public.missing_health_consent(pid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_birthdate date;
begin
  if not public.has_consent(auth.uid(), 'health_data') then
    return 'health_data';
  end if;
  select p.birthdate into v_birthdate from public.players p where p.id = pid;
  if v_birthdate is not null
     and v_birthdate > (current_date - interval '16 years')::date
     and not public.has_consent(auth.uid(), 'parental') then
    return 'parental';
  end if;
  return null;
end;
$$;

create or replace function public.require_health_consent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_missing text;
begin
  -- Nur Client-Zugriffe von Nicht-Staff (= der Spieler selbst). Staff-Einträge
  -- (Papier-Einwilligung im Verein), RPCs und service_role sind ausgenommen.
  if current_user in ('authenticated', 'anon') and not public.is_staff_of_player(new.player_id) then
    v_missing := public.missing_health_consent(new.player_id);
    if v_missing is not null then
      raise exception 'consent_required'
        using errcode = 'P0001', detail = v_missing,
              hint = 'Missing active consent of kind ' || v_missing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rpe_entries_consent on public.rpe_entries;
create trigger rpe_entries_consent
  before insert or update on public.rpe_entries
  for each row execute function public.require_health_consent();

drop trigger if exists wellness_entries_consent on public.wellness_entries;
create trigger wellness_entries_consent
  before insert or update on public.wellness_entries
  for each row execute function public.require_health_consent();

drop trigger if exists extra_activities_consent on public.extra_activities;
create trigger extra_activities_consent
  before insert or update on public.extra_activities
  for each row execute function public.require_health_consent();

-- =====================================================================
-- 5. Löschfristen
-- =====================================================================
create or replace function public.purge_stale_health_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_health_cutoff date := (current_date - interval '24 months')::date;
  v_log_cutoff    date := current_date - 30;
  n_rpe int; n_wellness int; n_extra int; n_push int; n_ai int;
begin
  delete from public.rpe_entries      where date < v_health_cutoff; get diagnostics n_rpe = row_count;
  delete from public.wellness_entries where date < v_health_cutoff; get diagnostics n_wellness = row_count;
  delete from public.extra_activities where date < v_health_cutoff; get diagnostics n_extra = row_count;
  delete from public.push_log         where day  < v_log_cutoff;    get diagnostics n_push = row_count;
  -- KI-Tageszähler werden nach 30 Tagen ebenfalls nicht mehr gebraucht
  delete from public.ai_usage         where day  < v_log_cutoff;    get diagnostics n_ai = row_count;
  return jsonb_build_object(
    'rpe_entries', n_rpe, 'wellness_entries', n_wellness, 'extra_activities', n_extra,
    'push_log', n_push, 'ai_usage', n_ai,
    'health_cutoff', v_health_cutoff, 'log_cutoff', v_log_cutoff
  );
end;
$$;

-- Täglich 03:30 (Zeitzone von pg_cron = UTC), nur wenn pg_cron vorhanden ist
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'purge-stale-health-data: pg_cron fehlt – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;
  perform cron.schedule('purge-stale-health-data', '30 3 * * *', 'select public.purge_stale_health_data()');
exception when others then
  raise notice 'purge-stale-health-data konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$$;

-- =====================================================================
-- 6. Datenexport (Art. 15 / Art. 20 DSGVO)
-- Alle Zeilen, die dem angemeldeten Konto gehören bzw. seine Spielerzeilen
-- betreffen. Interne Trainernotizen (coach_notes) und nicht freigegebene
-- Potenziale sind ausgenommen.
-- =====================================================================
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
    'format', 'trainerbank-export-v1',
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
    'push_tokens', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.updated_at) from public.push_tokens t
      where t.user_id = v_uid), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.day) from public.ai_usage u
      where u.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================
-- Rechte
-- =====================================================================
revoke all on function public.my_pending_teams()                  from public, anon;
revoke all on function public.approve_staff(uuid, uuid, text)     from public, anon;
revoke all on function public.reject_staff(uuid, uuid)            from public, anon;
revoke all on function public.team_staff_list(uuid)               from public, anon;
revoke all on function public.merge_players(uuid, uuid)           from public, anon;
revoke all on function public.consent_email_hash(uuid)            from public, anon;
revoke all on function public.has_consent(uuid, text)             from public, anon;
revoke all on function public.missing_health_consent(uuid)        from public, anon;
revoke all on function public.my_data_export()                    from public, anon;
revoke all on function public.purge_stale_health_data()           from public, anon, authenticated;
revoke all on function public.consents_guard()                    from public, anon, authenticated;
revoke all on function public.require_health_consent()            from public, anon, authenticated;

grant execute on function public.my_pending_teams()               to authenticated, service_role;
grant execute on function public.approve_staff(uuid, uuid, text)  to authenticated, service_role;
grant execute on function public.reject_staff(uuid, uuid)         to authenticated, service_role;
grant execute on function public.team_staff_list(uuid)            to authenticated, service_role;
grant execute on function public.merge_players(uuid, uuid)        to authenticated, service_role;
-- consent_email_hash / missing_health_consent werden aus Invoker-Triggern als
-- "authenticated" aufgerufen und geben nur Auskunft über das eigene Konto.
grant execute on function public.consent_email_hash(uuid)         to authenticated, service_role;
grant execute on function public.has_consent(uuid, text)          to authenticated, service_role;
grant execute on function public.missing_health_consent(uuid)     to authenticated, service_role;
grant execute on function public.my_data_export()                 to authenticated, service_role;
grant execute on function public.purge_stale_health_data()        to service_role;
