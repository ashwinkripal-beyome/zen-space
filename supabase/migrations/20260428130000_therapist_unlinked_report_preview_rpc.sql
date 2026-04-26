-- Preview read for unlinked self-assessment reports: RLS on reports + EXISTS(assessments) can fail
-- because the inner subquery is still subject to RLS. SECURITY DEFINER (same family as the leads RPC)
-- performs the join with explicit auth checks.

CREATE OR REPLACE FUNCTION public.get_therapist_unlinked_self_report_preview(
  p_client_id uuid,
  p_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  row jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = v_uid AND pr.role = 'therapist') THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = p_client_id) THEN
    RETURN NULL;
  END IF;

  SELECT
    jsonb_build_object(
      'id', r.id,
      'report_section', r.report_section,
      'ritual_section', r.ritual_section,
      'final_narrative_section', r.final_narrative_section,
      'plan_section', r.plan_section,
      'content', r.content,
      'assessment_id', r.assessment_id,
      'client_id', r.client_id,
      'created_at', r.created_at,
      'score_total', a.score_total,
      'score_data', a.score_data,
      'client_name', c.name,
      'client_first_name', c.first_name,
      'client_last_name', c.last_name,
      'client_gender', c.gender,
      'client_age', c.age
    )
  INTO row
  FROM public.reports r
  INNER JOIN public.assessments a ON a.id = r.assessment_id
  INNER JOIN public.profiles c ON c.id = r.client_id
  WHERE r.id = p_report_id
    AND r.client_id = p_client_id
    AND a.assessment_mode = 'self'
    AND a.status = 'completed'
    AND c.role = 'client';

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_therapist_unlinked_self_report_preview(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_therapist_unlinked_self_report_preview(uuid, uuid) TO authenticated;
