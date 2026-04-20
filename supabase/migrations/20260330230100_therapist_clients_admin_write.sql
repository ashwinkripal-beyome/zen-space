-- Idempotent patch: admin INSERT/UPDATE/DELETE on therapist_clients (manual assignment per PRD).
-- Safe if already present in 20260330220000_zen_space_init.sql (e.g. after supabase db reset).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'therapist_clients'
      AND policyname = 'therapist_clients_admin_write'
  ) THEN
    CREATE POLICY "therapist_clients_admin_write"
      ON public.therapist_clients FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_clients TO authenticated;
