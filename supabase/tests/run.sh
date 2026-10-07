#!/usr/bin/env bash
# =====================================================================
# Trainerbank – lokale Datenbanktests (ohne Docker / Supabase CLI)
#
# Startet einen Wegwerf-Postgres-Cluster, legt Supabase-Platzhalter an
# (Rollen anon/authenticated/service_role, Schemas auth und storage),
# spielt alle Migrationen in Reihenfolge ein und führt rls_test.sql aus.
#
# Aufruf:  supabase/tests/run.sh
# Variablen (optional):
#   PGBIN       Postgres-Binärdateien   (Standard: /usr/lib/postgresql/16/bin)
#   PGTEST_DIR  Arbeitsverzeichnis      (Standard: /tmp/claude-0/pgtest)
#   PGTEST_PORT Port                    (Standard: 54329)
#   KEEP_DB=1   Cluster nach dem Lauf nicht stoppen (zum Nachschauen)
# Als root wird Postgres als OS-Benutzer "postgres" gestartet.
# Exit-Code 0 = alle Tests bestanden.
# =====================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
BASE="${PGTEST_DIR:-/tmp/claude-0/pgtest}"
PORT="${PGTEST_PORT:-54329}"
DATA="$BASE/data"
LOG="$BASE/postgres.log"
OUT="$BASE/test-output.log"
DB="trainerbank_test"

# Als root: Serverprozesse als "postgres" ausführen
if [ "$(id -u)" -eq 0 ]; then
  as_pg() { runuser -u postgres -- "$@"; }
else
  as_pg() { "$@"; }
fi

psql_run() {
  "$PGBIN/psql" -X -q -h "$BASE" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"
}

stop_cluster() {
  if [ "${KEEP_DB:-0}" = "1" ]; then
    echo "KEEP_DB=1: Cluster läuft weiter (psql -h $BASE -p $PORT -U postgres $DB)"
    return
  fi
  if [ -f "$DATA/postmaster.pid" ]; then
    as_pg "$PGBIN/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null 2>&1 || true
  fi
}
trap stop_cluster EXIT

echo "==> Wegwerf-Cluster in $BASE (Port $PORT)"
mkdir -p "$BASE"
# Laufenden Cluster aus einem früheren Lauf beenden und Daten verwerfen
if [ -f "$DATA/postmaster.pid" ]; then
  as_pg "$PGBIN/pg_ctl" -D "$DATA" -m immediate -w stop >/dev/null 2>&1 || true
fi
rm -rf "$DATA"
if [ "$(id -u)" -eq 0 ]; then
  chown postgres:postgres "$BASE"
  # Der postgres-Benutzer muss das Elternverzeichnis durchqueren können (nur x-Bit, kein Lesen)
  parent="$(dirname "$BASE")"
  if ! runuser -u postgres -- test -x "$parent"; then
    echo "    Hinweis: setze o+x auf $parent, damit der postgres-Benutzer $BASE erreicht"
    chmod o+x "$parent"
  fi
fi

as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 --no-sync >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -w \
  -o "-p $PORT -k $BASE -c listen_addresses='' -c fsync=off -c synchronous_commit=off -c full_page_writes=off" \
  start >/dev/null

psql_run -d postgres -c "create database $DB"

echo "==> Supabase-Platzhalter (Rollen, auth, storage)"
psql_run -d "$DB" <<'SQL'
-- Rollen wie bei Supabase
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- Schema auth (minimal)
create schema auth;
create table auth.users (
  id                 uuid primary key,
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Schema extensions (bei Supabase vorhanden)
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Schema storage (minimal, Funktionen wie in supabase/storage)
create schema storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid,
  unique (bucket_id, name)
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare _parts text[];
begin
  _parts := string_to_array(name, '/');
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
create function storage.filename(name text) returns text
language plpgsql immutable
as $$
declare _parts text[];
begin
  _parts := string_to_array(name, '/');
  return _parts[array_length(_parts, 1)];
end
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;
grant select on storage.buckets to anon;

-- Rechte wie bei Supabase: Default-Privileges für alles, was Migrationen anlegen
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete, truncate, references, trigger on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL

echo "==> Migrationen"
shopt -s nullglob
migrations=("$SUPABASE_DIR"/migrations/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "Keine Migrationen gefunden" >&2
  exit 1
fi
MIGLOG="$BASE/migration.log"
for f in "${migrations[@]}"; do
  echo "    $(basename "$f")"
  if ! psql_run -d "$DB" -f "$f" >"$MIGLOG" 2>&1; then
    sed 's/^/      /' "$MIGLOG"
    echo "FEHLER in Migration $(basename "$f")" >&2
    exit 1
  fi
  # NOTICEs anzeigen (z. B. fehlendes pg_cron), außer den erwartbaren "drop ... if exists"-Hinweisen
  { grep -v 'does not exist, skipping' "$MIGLOG" || true; } | sed -e 's/^psql:[^ ]* NOTICE:  /NOTICE: /' -e 's/^/      /'
done

echo "==> Idempotenz: alle Migrationen ein zweites Mal"
for f in "${migrations[@]}"; do
  if ! psql_run -d "$DB" -f "$f" >"$MIGLOG" 2>&1; then
    echo "FEHLER: $(basename "$f") ist nicht wiederholbar" >&2
    tail -5 "$MIGLOG" >&2
    exit 1
  fi
done

echo "==> SQL-Tests (rls_test.sql)"
set +e
psql_run -d "$DB" -f "$SCRIPT_DIR/rls_test.sql" >"$OUT" 2>&1
sql_status=$?
set -e

# Ausgabe ohne psql-Präfixe anzeigen
sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //' -e 's/^psql:[^ ]* ERROR:  /ERROR: /' "$OUT"

sql_passed=$(grep -c 'PASS: ' "$OUT" || true)
sql_failed=$(grep -c 'FAIL: ' "$OUT" || true)

# Optional: Unit-Tests der Edge-Function-Hilfsmodule (Node >= 22.6 mit Type-Stripping)
unit_summary="übersprungen (Node >= 22.6 nicht gefunden)"
unit_status=0
if command -v node >/dev/null 2>&1 && node --experimental-strip-types --no-warnings -e "" >/dev/null 2>&1; then
  echo
  echo "==> Unit-Tests Edge Functions (functions.test.ts)"
  set +e
  node --experimental-strip-types --no-warnings --test --test-reporter=spec "$SCRIPT_DIR/functions.test.ts" >"$BASE/unit-output.log" 2>&1
  unit_status=$?
  set -e
  grep -E '^\s*(✔|✖)' "$BASE/unit-output.log" | grep -v 'tests\|suites' || cat "$BASE/unit-output.log"
  unit_pass=$(grep -E '^ℹ pass ' "$BASE/unit-output.log" | awk '{print $3}')
  unit_fail=$(grep -E '^ℹ fail ' "$BASE/unit-output.log" | awk '{print $3}')
  unit_summary="${unit_pass:-?} bestanden, ${unit_fail:-?} fehlgeschlagen"
fi

echo
echo "================================================================"
echo "SQL (RLS/RPC/Trigger): $sql_passed bestanden, $sql_failed fehlgeschlagen (psql-Exit $sql_status)"
echo "Unit (Edge Functions): $unit_summary"
if [ "$sql_status" -ne 0 ] || [ "$sql_failed" -ne 0 ] || [ "$unit_status" -ne 0 ]; then
  echo "ERGEBNIS: FAIL"
  echo "================================================================"
  exit 1
fi
echo "ERGEBNIS: PASS"
echo "================================================================"
