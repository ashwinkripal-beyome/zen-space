ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS final_narrative_section text;
