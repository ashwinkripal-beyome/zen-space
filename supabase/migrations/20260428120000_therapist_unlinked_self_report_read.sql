-- Let any therapist read unlinked self-assessment data (report, profile, answers) for lead preview.
-- Adds report_id to the leads listing RPC.

-- ---------------------------------------------------------------------------
-- RLS: therapist read when client is unlinked and assessment is self + completed
-- ---------------------------------------------------------------------------
CREATE POLICY "reports_select_therapist_unlinked_self_lead"
  ON public.reports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'therapist')
    AND EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = reports.assessment_id
        AND a.assessment_mode = 'self'
        AND a.status = 'completed'
    )
    AND NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = reports.client_id)
  );

CREATE POLICY "assessments_select_therapist_unlinked_self_lead"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'therapist')
    AND assessment_mode = 'self'
    AND status = 'completed'
    AND NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = assessments.client_id)
  );

CREATE POLICY "assessment_answers_select_therapist_unlinked_self_lead"
  ON public.assessment_answers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'therapist')
    AND EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_answers.assessment_id
        AND a.assessment_mode = 'self'
        AND a.status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = a.client_id)
    )
  );

CREATE POLICY "profiles_select_therapist_unlinked_self_lead"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'therapist')
    AND profiles.role = 'client'
    AND NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = profiles.id)
    AND EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.client_id = profiles.id
        AND a.assessment_mode = 'self'
        AND a.status = 'completed'
    )
  );

-- ---------------------------------------------------------------------------
-- Leads list: include report id for deep-linking
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE cannot change the OUT row type; drop first if upgrading from 20260427120000.
DROP FUNCTION IF EXISTS public.get_unlinked_self_assessment_leads_for_therapist();

CREATE OR REPLACE FUNCTION public.get_unlinked_self_assessment_leads_for_therapist()
RETURNS TABLE (
  assessment_id uuid,
  client_id uuid,
  completed_at timestamptz,
  email text,
  name text,
  first_name text,
  last_name text,
  phone_number text,
  report_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'therapist') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (a.client_id)
    a.id AS assessment_id,
    a.client_id,
    a.completed_at,
    p.email,
    p.name,
    p.first_name,
    p.last_name,
    p.phone_number,
    r.id AS report_id
  FROM public.assessments a
  INNER JOIN public.profiles p ON p.id = a.client_id
  LEFT JOIN public.reports r ON r.assessment_id = a.id
  WHERE a.assessment_mode = 'self'
    AND a.status = 'completed'
    AND p.role = 'client'
    AND NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = a.client_id)
  ORDER BY a.client_id, a.completed_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unlinked_self_assessment_leads_for_therapist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unlinked_self_assessment_leads_for_therapist() TO authenticated;
