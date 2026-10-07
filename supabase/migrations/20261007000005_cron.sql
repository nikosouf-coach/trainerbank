-- =====================================================================
-- Trainerbank – Zeitplan für die Edge Function "push-reminders"
--
-- Alle 15 Minuten ruft pg_cron per pg_net die Function auf:
--   POST {project_url}/functions/v1/push-reminders
--   Header x-cron-secret: {cron_secret}
--
-- URL und Secret stehen NICHT im Repo, sondern im Supabase Vault
-- (einmalig manuell anlegen, siehe supabase/README.md):
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Solange die Secrets fehlen, läuft der Job ohne Wirkung (kein Request).
--
-- Die Migration schlägt nicht fehl, wenn pg_cron/pg_net nicht verfügbar sind
-- (z. B. lokale Testdatenbank); sie gibt dann nur einen NOTICE aus.
-- =====================================================================

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron nicht verfügbar (%): Zeitplan wird übersprungen.', sqlerrm;
  end;

  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'pg_net nicht verfügbar (%): Zeitplan wird übersprungen.', sqlerrm;
  end;
end
$$;

do $outer$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'push-reminders: pg_cron/pg_net fehlen – bitte Zeitplan manuell anlegen (README).';
    return;
  end if;

  -- cron.schedule mit vorhandenem Jobnamen aktualisiert den Job (idempotent)
  perform cron.schedule(
    'push-reminders',
    '*/15 * * * *',
    $job$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/push-reminders',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
                   ),
        body    := jsonb_build_object('source', 'pg_cron'),
        timeout_milliseconds := 30000
      )
      where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
        and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret');
    $job$
  );
exception when others then
  raise notice 'push-reminders konnte nicht eingeplant werden (%): bitte manuell anlegen (README).', sqlerrm;
end
$outer$;
