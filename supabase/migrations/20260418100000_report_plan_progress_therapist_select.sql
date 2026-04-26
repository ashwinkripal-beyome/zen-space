-- Therapists linked to a client may read that client's 18-week checklist progress (read-only UI).

CREATE POLICY "report_plan_progress_select_therapist_linked"
  ON public.report_plan_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid()
        AND tc.client_id = report_plan_progress.client_id
    )
  );
