-- Shared therapist notes on client profiles (visible to all therapists).

CREATE OR REPLACE FUNCTION public.is_therapist()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'therapist'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_therapist() TO authenticated;

-- Therapists may read colleague therapist profiles (name display on shared notes).
DROP POLICY IF EXISTS "profiles_select_therapist_colleagues" ON public.profiles;
CREATE POLICY "profiles_select_therapist_colleagues"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.is_therapist()) AND role = 'therapist');

CREATE TABLE IF NOT EXISTS public.client_therapist_notes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  therapist_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          text        NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 4000),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_therapist_notes_client_idx
  ON public.client_therapist_notes (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS client_therapist_notes_therapist_idx
  ON public.client_therapist_notes (therapist_id);

ALTER TABLE public.client_therapist_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_therapist_notes_select_therapist"
  ON public.client_therapist_notes FOR SELECT TO authenticated
  USING ((SELECT public.is_therapist()));

CREATE POLICY "client_therapist_notes_insert_therapist"
  ON public.client_therapist_notes FOR INSERT TO authenticated
  WITH CHECK (
    therapist_id = auth.uid()
    AND (SELECT public.is_therapist())
  );

CREATE POLICY "client_therapist_notes_delete_therapist"
  ON public.client_therapist_notes FOR DELETE TO authenticated
  USING ((SELECT public.is_therapist()));

CREATE POLICY "client_therapist_notes_admin_all"
  ON public.client_therapist_notes FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

GRANT SELECT, INSERT, DELETE ON public.client_therapist_notes TO authenticated;
