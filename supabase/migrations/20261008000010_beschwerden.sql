-- =====================================================================
-- Paket 5: Beschwerden mit Körperregion (Morgen-Check).
-- wellness_entries.complaint_areas: Codes wie 'hams:l', 'knee:r', 'ill_up' (src/core/body.ts).
-- Gleiche Zugriffsregeln und Einwilligung wie die übrigen Gesundheitsdaten der Zeile.
-- =====================================================================

alter table public.wellness_entries add column if not exists complaint_areas text[] not null default '{}';

do $$ begin
  alter table public.wellness_entries add constraint wellness_complaint_areas_check check (
    cardinality(complaint_areas) <= 12
    and array_to_string(complaint_areas, ',') ~ '^((head|neck|chest|abdomen|upback|lowback|ill_up|ill_down|(shoulder|arm|hand|groin|hip|glute|quad|hams|knee|calf|shin|achilles|ankle|heel|foot)(:[lrb])?)(,|$))*$'
  );
exception when duplicate_object then null; end $$;

-- Ohne Beschwerde keine Regionen (verhindert widersprüchliche Zeilen)
do $$ begin
  alter table public.wellness_entries add constraint wellness_complaint_areas_none check (complaint <> 'none' or cardinality(complaint_areas) = 0);
exception when duplicate_object then null; end $$;
