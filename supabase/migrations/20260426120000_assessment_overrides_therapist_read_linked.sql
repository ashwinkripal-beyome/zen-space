-- Therapists may read supervised assessment overrides for any linked client (not only rows they created).
-- Eligibility on the client app considers the latest override per client; the therapist dashboard should match.

CREATE POLICY "assessment_overrides_select_therapist_linked_client"
  ON public.assessment_overrides FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid()
        AND tc.client_id = assessment_overrides.client_id
    )
  );
