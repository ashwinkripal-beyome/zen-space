-- Therapist observation tags + report body; one report row per assessment.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS therapist_observations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS content text;

-- One report per assessment (skip if init.sql already added UNIQUE on assessment_id).
DO $$
BEGIN
  ALTER TABLE public.reports ADD CONSTRAINT reports_assessment_id_unique UNIQUE (assessment_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.save_therapist_observations(
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
  SET therapist_observations = COALESCE(p_observations, '{}'::jsonb)
  WHERE a.id = p_assessment_id
    AND a.status = 'completed'
    AND EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid()
        AND tc.client_id = a.client_id
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'Assessment not found, not completed, or not your client';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_therapist_observations(uuid, jsonb) TO authenticated;
