-- Client profile: age. Clients may read linked therapists' profile rows (name display).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age smallint;

COMMENT ON COLUMN public.profiles.age IS 'Optional client age; used for onboarding completeness.';

CREATE POLICY "profiles_select_linked_therapist"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = profiles.id AND tc.client_id = auth.uid()
    )
  );
