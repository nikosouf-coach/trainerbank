-- =====================================================================
-- Paket 11.4: Körperkarte – Angaben zum Schmerz je Region (Gesundheitsdaten, gleiche Regeln wie der Morgen-Check).
-- wellness_entries.complaint_details: { "<region>": { nrs, q[], onset, since, when[], cause, signs[], train } }
-- Schlüssel nur für gemeldete Regionen (complaint_areas, ohne Seite); ohne Beschwerde keine Angaben.
-- =====================================================================

create or replace function public.pain_keys_ok(d jsonb, areas text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select d is null or (
    jsonb_typeof(d) = 'object'
    and not exists (
      select 1 from jsonb_each(d) e
       where jsonb_typeof(e.value) <> 'object'
          or not exists (select 1 from unnest(coalesce(areas, '{}')) a where split_part(a, ':', 1) = e.key)
    )
  )
$$;
revoke all on function public.pain_keys_ok(jsonb, text[]) from public, anon;
grant execute on function public.pain_keys_ok(jsonb, text[]) to authenticated, service_role;

alter table public.wellness_entries add column if not exists complaint_details jsonb;
do $$ begin
  alter table public.wellness_entries add constraint wellness_complaint_details_check check (
    complaint_details is null or (
      pg_column_size(complaint_details) <= 6000
      and public.pain_keys_ok(complaint_details, complaint_areas)
      and complaint <> 'none'
    ));
exception when duplicate_object then null; end $$;
comment on column public.wellness_entries.complaint_details is 'Angaben zum Schmerz je Region (Stärke 0–10, Art, Beginn, Dauer, Situation, Kontakt, Zeichen, Trainierbarkeit) – Gesundheitsdaten.';
