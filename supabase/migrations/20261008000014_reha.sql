-- =====================================================================
-- Paket 9: Region der Verletzung (steuert den Reha-Plan nach Region und Stufe).
-- absences.area: Code aus src/core/body.ts (z. B. 'hams:l', 'ankle:r', 'head'), nur bei Verletzungen.
-- Spieler dürfen die Region beim eigenen Eintrag angeben (gleiche Regeln wie für die Abwesenheit).
-- =====================================================================

alter table public.absences add column if not exists area text;
do $$ begin
  alter table public.absences add constraint absences_area_check check (
    area is null or (
      type = 'verletzung'
      and area ~ '^(head|neck|chest|abdomen|upback|lowback|(shoulder|arm|hand|groin|hip|glute|quad|hams|knee|calf|shin|achilles|ankle|heel|foot)(:[lrb])?)$'
    )
  );
exception when duplicate_object then null; end $$;
