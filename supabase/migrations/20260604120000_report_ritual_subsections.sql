-- Additive subsection columns for report body and Fourfold Zen Ritual (production-safe).
-- Legacy columns (report_section, ritual_section, content, etc.) remain unchanged.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_client_info text,
  ADD COLUMN IF NOT EXISTS report_key_concerns text,
  ADD COLUMN IF NOT EXISTS report_current_state text,
  ADD COLUMN IF NOT EXISTS report_balance_zone text,
  ADD COLUMN IF NOT EXISTS report_blossom_zone text,
  ADD COLUMN IF NOT EXISTS report_bliss_zone text,
  ADD COLUMN IF NOT EXISTS report_integrated_interpretation text,
  ADD COLUMN IF NOT EXISTS ritual_explain text,
  ADD COLUMN IF NOT EXISTS ritual_somatic text,
  ADD COLUMN IF NOT EXISTS ritual_mental text,
  ADD COLUMN IF NOT EXISTS ritual_daily text,
  ADD COLUMN IF NOT EXISTS ritual_reflect text;
