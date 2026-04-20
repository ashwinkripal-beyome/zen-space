-- Fix 42P17: infinite recursion on profiles RLS when policies subquery profiles for "is admin".
-- Run after older init that used EXISTS (SELECT 1 FROM profiles ... admin).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "therapist_otp_sessions_select_own" ON public.therapist_otp_sessions;
CREATE POLICY "therapist_otp_sessions_select_own"
  ON public.therapist_otp_sessions FOR SELECT TO authenticated
  USING (therapist_id = auth.uid() OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "therapist_clients_select" ON public.therapist_clients;
CREATE POLICY "therapist_clients_select"
  ON public.therapist_clients FOR SELECT TO authenticated
  USING (
    therapist_id = auth.uid()
    OR client_id = auth.uid()
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "therapist_clients_admin_write" ON public.therapist_clients;
CREATE POLICY "therapist_clients_admin_write"
  ON public.therapist_clients FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "therapist_session_joins_admin" ON public.therapist_session_joins;
CREATE POLICY "therapist_session_joins_admin"
  ON public.therapist_session_joins FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "assessments_select_admin" ON public.assessments;
CREATE POLICY "assessments_select_admin"
  ON public.assessments FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "assessment_answers_select" ON public.assessment_answers;
CREATE POLICY "assessment_answers_select"
  ON public.assessment_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_answers.assessment_id
        AND (a.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.therapist_clients tc
            WHERE tc.therapist_id = auth.uid() AND tc.client_id = a.client_id
          )
          OR (SELECT public.is_admin()))
    )
  );

DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin"
  ON public.reports FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "subscriptions_select_admin" ON public.subscriptions;
CREATE POLICY "subscriptions_select_admin"
  ON public.subscriptions FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "subscriptions_write_admin" ON public.subscriptions;
CREATE POLICY "subscriptions_write_admin"
  ON public.subscriptions FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "plan_days_select_admin" ON public.plan_days;
CREATE POLICY "plan_days_select_admin"
  ON public.plan_days FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "plan_day_status_select_admin" ON public.plan_day_status;
CREATE POLICY "plan_day_status_select_admin"
  ON public.plan_day_status FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));
