-- Global therapist notifications for completed self assessments waiting for an 18-week plan.
-- A notification stays visible until the client is marked Contacted, Dropped, or Pro/Paid,
-- or until the report receives a plan_section.

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
  INNER JOIN public.reports r ON r.assessment_id = a.id
  WHERE a.assessment_mode = 'self'
    AND a.status = 'completed'
    AND p.role = 'client'
    AND p.client_status IS NULL
    AND COALESCE(p.is_paid_customer, false) = false
    AND COALESCE(BTRIM(r.plan_section), '') = ''
  ORDER BY a.client_id, a.completed_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unlinked_self_assessment_leads_for_therapist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unlinked_self_assessment_leads_for_therapist() TO authenticated;

-- Keep notification badges fresh when marking Contacted, Dropped, or Paid clears the queue item.
DROP TRIGGER IF EXISTS trg_profiles_client_status_bump_therapist_inbox ON public.profiles;
CREATE TRIGGER trg_profiles_client_status_bump_therapist_inbox
  AFTER UPDATE OF client_status, is_paid_customer ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.bump_therapist_inbox();
