-- Add date-of-birth column; keep age for backwards-compat (computed on save)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob date;
