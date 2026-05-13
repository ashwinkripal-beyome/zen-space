-- Global monthly report generation stats for therapists.
-- Returns count of self and supervised reports created in a given calendar month.
-- Counts rows in public.reports joined to assessments.assessment_mode.
-- generate-zen-plan only UPDATEs an existing report row, so it is never counted here.

CREATE OR REPLACE FUNCTION public.get_monthly_report_generation_stats(p_month date)
RETURNS TABLE (
  self_count bigint,
  supervised_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'therapist'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE a.assessment_mode = 'self')    AS self_count,
    COUNT(*) FILTER (WHERE a.assessment_mode = 'supervised') AS supervised_count
  FROM public.reports r
  INNER JOIN public.assessments a ON a.id = r.assessment_id
  WHERE date_trunc('month', r.created_at AT TIME ZONE 'UTC')
      = date_trunc('month', p_month::timestamptz AT TIME ZONE 'UTC');
END;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_report_generation_stats(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monthly_report_generation_stats(date) TO authenticated;
