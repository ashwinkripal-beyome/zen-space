-- Rename profession to occupation and add company field
ALTER TABLE public.profiles RENAME COLUMN profession TO occupation;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;
