-- ---------------------------------------------------------------------------
-- 1. reports — add split-section columns + affirmations
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS report_section  text,
  ADD COLUMN IF NOT EXISTS ritual_section  text,
  ADD COLUMN IF NOT EXISTS plan_section    text,
  ADD COLUMN IF NOT EXISTS affirmations    text[];

-- ---------------------------------------------------------------------------
-- 2. assessment_overrides — therapist unlocks an assessment for a client
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_overrides (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_mode  text        NOT NULL CHECK (assessment_mode IN ('self', 'supervised')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, client_id, assessment_mode)
);

CREATE INDEX IF NOT EXISTS assessment_overrides_client_idx
  ON public.assessment_overrides (client_id);
CREATE INDEX IF NOT EXISTS assessment_overrides_therapist_idx
  ON public.assessment_overrides (therapist_id);

-- ---------------------------------------------------------------------------
-- 3. RLS for assessment_overrides
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessment_overrides ENABLE ROW LEVEL SECURITY;

-- Therapists can manage overrides for their linked clients
CREATE POLICY therapist_manage_overrides ON public.assessment_overrides
  FOR ALL
  USING (
    therapist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid()
        AND tc.client_id = assessment_overrides.client_id
    )
  )
  WITH CHECK (
    therapist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid()
        AND tc.client_id = assessment_overrides.client_id
    )
  );

-- Clients can read their own override rows
CREATE POLICY client_read_overrides ON public.assessment_overrides
  FOR SELECT
  USING (client_id = auth.uid());

-- Admin full access
CREATE POLICY admin_all_overrides ON public.assessment_overrides
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.assessment_overrides TO authenticated;
