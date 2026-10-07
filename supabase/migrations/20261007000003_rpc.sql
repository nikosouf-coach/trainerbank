-- =====================================================================
-- Trainerbank – RPCs (supabase.rpc(...)), alle SECURITY DEFINER mit
-- festem search_path. Fehler werden als Exception mit sprechendem Text
-- geworfen (z. B. 'invalid_code'); supabase-js liefert ihn in error.message.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Code-Hilfen
-- ---------------------------------------------------------------------

-- Erzeugt einen Code im Format 'K7QM-4T2X' aus 31 eindeutigen Zeichen
-- (ohne 0/O/1/I/L). Zufall aus gen_random_uuid() (kryptografisch sicher),
-- Ablehnungsverfahren gegen Modulo-Verzerrung. 31^8 ≈ 8,5·10^11 Kombinationen.
create or replace function public.generate_team_code()
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
  while char_length(code) < 8 loop
    bytes := uuid_send(gen_random_uuid());
    -- Byte 6 (Version) und Byte 8 (Variante) einer UUIDv4 sind nicht voll zufällig
    foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15] loop
      b := get_byte(bytes, i);
      if b < 248 then  -- 248 = 8 · 31
        code := code || substr(alphabet, (b % 31) + 1, 1);
        exit when char_length(code) = 8;
      end if;
    end loop;
  end loop;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4);
end;
$$;

-- Code, der weder als join_code noch als staff_code vergeben ist
create or replace function public.generate_unique_team_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := public.generate_team_code();
    exit when not exists (
      select 1 from public.teams t where t.join_code = v_code or t.staff_code = v_code
    );
  end loop;
  return v_code;
end;
$$;

-- Normalisiert Benutzereingaben: Groß-/Kleinschreibung, Bindestriche und
-- Leerzeichen egal ('k7qm 4t2x', 'K7QM4T2X' → 'K7QM-4T2X'). null bei falscher Länge.
create or replace function public.normalize_team_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when char_length(c) = 8 then substr(c, 1, 4) || '-' || substr(c, 5, 4) end
  from (select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) as c) s;
$$;

-- Namensvergleich beim Beitritt: Groß-/Kleinschreibung und Mehrfach-Leerzeichen egal
create or replace function public.normalize_person_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------
-- create_team: Team + Owner-Eintrag + Codes. p_lang setzt die Sprache im
-- Profil des Erstellers (das Team selbst hat keine Sprachspalte).
-- ---------------------------------------------------------------------
create or replace function public.create_team(
  p_club       text,
  p_name       text,
  p_age_class  text,
  p_depth      text,
  p_settings   jsonb,
  p_principles jsonb,
  p_modules    jsonb,
  p_lang       text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_team    uuid;
  v_join    text;
  v_staff   text;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_join  := public.generate_unique_team_code();
    v_staff := public.generate_unique_team_code();
    continue when v_join = v_staff;
    begin
      insert into public.teams (club, name, age_class, depth, settings, principles, modules,
                                join_code, staff_code, created_by)
      values (btrim(p_club), btrim(p_name), p_age_class, coalesce(p_depth, 'basis'),
              coalesce(p_settings, '{}'::jsonb), coalesce(p_principles, '{}'::jsonb),
              coalesce(p_modules, '{}'::jsonb), v_join, v_staff, v_uid)
      returning id into v_team;
      exit;
    exception when unique_violation then
      -- extrem seltene Kollision mit parallel erzeugtem Code: neu würfeln
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  insert into public.team_staff (team_id, user_id, role) values (v_team, v_uid, 'owner');

  if p_lang in ('de', 'en') then
    insert into public.profiles (id, lang) values (v_uid, p_lang)
    on conflict (id) do update set lang = excluded.lang;
  end if;

  return v_team;
end;
$$;

-- ---------------------------------------------------------------------
-- join_team: Spieler tritt per Team-Code bei → player_id
--   1. Konto hat im Team schon eine Spielerzeile → diese zurückgeben
--   2. unverknüpfter Spieler mit gleichem Vor-/Nachnamen (ohne Groß-/Klein-
--      schreibung) und gleichem Geburtsdatum → verknüpfen (leere Felder füllen)
--   3. sonst neue Zeile mit is_new = true
-- Falscher Code → Exception 'invalid_code'.
-- ---------------------------------------------------------------------
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

  -- Beitritte pro Team serialisieren (verhindert doppeltes Verknüpfen)
  perform pg_advisory_xact_lock(hashtextextended('trainerbank.join_team:' || v_team::text, 0));

  select p.id into v_player from public.players p where p.team_id = v_team and p.user_id = v_uid;
  if v_player is not null then
    return v_player;
  end if;

  if nullif(btrim(coalesce(p_first_name, '')), '') is null then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if p_birthdate is not null then
    select p.id into v_player
    from public.players p
    where p.team_id = v_team
      and p.user_id is null
      and p.birthdate = p_birthdate
      and public.normalize_person_name(p.first_name) = public.normalize_person_name(p_first_name)
      and public.normalize_person_name(p.last_name)  = public.normalize_person_name(p_last_name)
    order by p.created_at
    limit 1;
  end if;

  if v_player is not null then
    update public.players p
       set user_id      = v_uid,
           position     = coalesce(p.position, nullif(btrim(p_position), '')),
           shirt_number = coalesce(p.shirt_number, p_shirt_number::smallint),
           weight_kg    = coalesce(p.weight_kg, p_weight_kg)
     where p.id = v_player;
    return v_player;
  end if;

  insert into public.players (team_id, user_id, first_name, last_name, birthdate,
                              position, shirt_number, weight_kg, is_new, active)
  values (v_team, v_uid, btrim(p_first_name), nullif(btrim(coalesce(p_last_name, '')), ''), p_birthdate,
          nullif(btrim(coalesce(p_position, '')), ''), p_shirt_number::smallint, p_weight_kg, true, true)
  returning id into v_player;

  return v_player;
end;
$$;

-- ---------------------------------------------------------------------
-- join_staff: Trainer/Physio tritt per Staff-Code bei (Rolle 'coach')
-- ---------------------------------------------------------------------
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
  values (v_team, v_uid, 'coach')
  on conflict (team_id, user_id) do nothing;   -- bestehende Rolle bleibt erhalten

  return v_team;
end;
$$;

-- ---------------------------------------------------------------------
-- regenerate_codes: neue Spieler- und Staff-Codes (nur Owner).
-- Rückgabe: eine Zeile (join_code, staff_code).
-- ---------------------------------------------------------------------
create or replace function public.regenerate_codes(p_team uuid)
returns table (join_code text, staff_code text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_join  text;
  v_staff text;
begin
  if not public.is_team_owner(p_team) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  loop
    v_join  := public.generate_unique_team_code();
    v_staff := public.generate_unique_team_code();
    exit when v_join <> v_staff;
  end loop;

  return query
    update public.teams t
       set join_code = v_join,
           staff_code = v_staff
     where t.id = p_team
    returning t.join_code, t.staff_code;
end;
$$;

-- ---------------------------------------------------------------------
-- team_by_join_code: nur Verein und Teamname zur Anzeige vor dem Beitritt
-- (auch ohne Login aufrufbar, damit der Name vor der Registrierung
-- angezeigt werden kann).
-- ---------------------------------------------------------------------
create or replace function public.team_by_join_code(p_code text)
returns table (club text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.club, t.name
  from public.teams t
  where t.join_code = public.normalize_team_code(p_code);
$$;

-- ---------------------------------------------------------------------
-- register_push_token: Push-Token dem aktuellen Konto zuordnen. Ein Gerät
-- kann den Besitzer wechseln (Ab-/Anmelden); ein direktes Upsert in
-- push_tokens würde dann an RLS scheitern, weil die Zeile noch dem
-- vorherigen Konto gehört.
-- ---------------------------------------------------------------------
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- ai_usage_bump: atomarer KI-Tageszähler (nur service_role / Edge Function "ai").
--   p_delta > 0: erhöht, wenn das Limit nicht überschritten wird; gibt den
--                neuen Stand zurück, sonst null (= Limit erreicht).
--   p_delta < 0: Gutschrift (z. B. bei Fehler der Claude API).
-- Tagesgrenze: Mitternacht Europe/Berlin.
-- ---------------------------------------------------------------------
create or replace function public.ai_usage_bump(p_user uuid, p_delta int, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'Europe/Berlin')::date;
  v_count int;
begin
  if p_delta > 0 then
    if p_delta > p_limit then
      return null;
    end if;
    insert into public.ai_usage as u (user_id, day, count)
    values (p_user, v_day, p_delta)
    on conflict (user_id, day) do update
      set count = u.count + excluded.count
      where u.count + excluded.count <= p_limit
    returning u.count into v_count;
    return v_count;  -- null, wenn das Limit erreicht ist
  end if;

  update public.ai_usage u
     set count = greatest(u.count + p_delta, 0)
   where u.user_id = p_user and u.day = v_day
  returning u.count into v_count;
  return coalesce(v_count, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------
revoke all on function public.generate_team_code()             from public, anon, authenticated;
revoke all on function public.generate_unique_team_code()      from public, anon, authenticated;
revoke all on function public.normalize_team_code(text)        from public, anon;
revoke all on function public.normalize_person_name(text)      from public, anon;
grant execute on function public.normalize_team_code(text)     to authenticated, service_role;
grant execute on function public.normalize_person_name(text)   to authenticated, service_role;

revoke all on function public.create_team(text, text, text, text, jsonb, jsonb, jsonb, text) from public, anon;
revoke all on function public.join_team(text, text, text, date, text, int, numeric)        from public, anon;
revoke all on function public.join_staff(text)                                             from public, anon;
revoke all on function public.regenerate_codes(uuid)                                       from public, anon;
revoke all on function public.team_by_join_code(text)                                      from public;
revoke all on function public.register_push_token(text, text)                              from public, anon;
revoke all on function public.ai_usage_bump(uuid, int, int)                                from public, anon, authenticated;

grant execute on function public.create_team(text, text, text, text, jsonb, jsonb, jsonb, text) to authenticated, service_role;
grant execute on function public.join_team(text, text, text, date, text, int, numeric)        to authenticated, service_role;
grant execute on function public.join_staff(text)                                             to authenticated, service_role;
grant execute on function public.regenerate_codes(uuid)                                       to authenticated, service_role;
grant execute on function public.team_by_join_code(text)                                      to anon, authenticated, service_role;
grant execute on function public.register_push_token(text, text)                              to authenticated, service_role;
grant execute on function public.ai_usage_bump(uuid, int, int)                                to service_role;
