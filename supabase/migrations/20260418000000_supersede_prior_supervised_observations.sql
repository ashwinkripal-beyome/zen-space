-- When a client completes a supervised assessment, older completed supervised assessments
-- for the same client that still have no report are marked superseded so therapists only
-- act on the latest one. Notifications use: completed supervised, not superseded, no report.

CREATE OR REPLACE FUNCTION public.supersede_prior_supervised_assessments_without_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.assessment_mode = 'supervised'
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM 'completed'))
     )
  THEN
    UPDATE public.assessments a
    SET therapist_observations =
      COALESCE(a.therapist_observations, '{}'::jsonb) || jsonb_build_object('_observation_superseded', true)
    WHERE a.client_id = NEW.client_id
      AND a.id <> NEW.id
      AND a.status = 'completed'
      AND a.assessment_mode = 'supervised'
      AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.assessment_id = a.id)
      AND COALESCE(a.therapist_observations->>'_observation_superseded', '') <> 'true';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supersede_prior_supervised_assessments ON public.assessments;

CREATE TRIGGER trg_supersede_prior_supervised_assessments
  AFTER INSERT OR UPDATE OF status ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.supersede_prior_supervised_assessments_without_report();
