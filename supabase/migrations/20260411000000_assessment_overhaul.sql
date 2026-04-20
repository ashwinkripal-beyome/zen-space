-- Assessment System Overhaul
-- 1. profiles: add profession
-- 2. assessments: add assessment_mode, client_observations
-- 3. RPC: save_client_observations

-- ---------------------------------------------------------------------------
-- profiles — new optional fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profession text;

-- ---------------------------------------------------------------------------
-- assessments — assessment_mode (supervised | self) + client_observations
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_mode text NOT NULL DEFAULT 'supervised',
  ADD COLUMN IF NOT EXISTS client_observations jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.assessments
    ADD CONSTRAINT assessments_assessment_mode_check
    CHECK (assessment_mode IN ('supervised', 'self'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ---------------------------------------------------------------------------
-- RPC: save_client_observations — client saves their own observations
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_client_observations(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.save_client_observations(
  p_assessment_id uuid,
  p_observations jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.assessments a
  SET client_observations = COALESCE(p_observations, '{}'::jsonb)
  WHERE a.id = p_assessment_id
    AND a.client_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'Assessment not found or not owned by current user';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_client_observations(uuid, jsonb) TO authenticated;
