-- Per-client per-report 18-day checklist completion (cross-device).

CREATE TABLE public.report_plan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports (id) ON DELETE CASCADE,
  completed_days integer[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, report_id)
);

CREATE INDEX report_plan_progress_client_report_idx
  ON public.report_plan_progress (client_id, report_id);

ALTER TABLE public.report_plan_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_plan_progress_select_own"
  ON public.report_plan_progress FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "report_plan_progress_insert_own"
  ON public.report_plan_progress FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND r.client_id = auth.uid()
    )
  );

CREATE POLICY "report_plan_progress_update_own"
  ON public.report_plan_progress FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND r.client_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.report_plan_progress TO authenticated;
