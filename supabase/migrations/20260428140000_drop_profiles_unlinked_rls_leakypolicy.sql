-- The permissive "unlinked self lead" policy on public.profiles joined OR with linked-client access.
-- In practice (PostgREST + multiple EXISTS subqueries on assessments) it can interfere with
-- routine therapist reads of *linked* client profiles, breaking the clients list and similar UIs.
-- Unlinked PII is already exposed only via SECURITY DEFINER RPCs
-- (get_unlinked_self_assessment_leads_for_therapist, get_therapist_unlinked_self_report_preview).

DROP POLICY IF EXISTS "profiles_select_therapist_unlinked_self_lead" ON public.profiles;
