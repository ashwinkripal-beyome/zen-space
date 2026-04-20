-- Remove health_condition column from profiles (moved to client observations).
ALTER TABLE public.profiles DROP COLUMN IF EXISTS health_condition;
