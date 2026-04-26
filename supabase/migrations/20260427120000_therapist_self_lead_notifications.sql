-- Unlinked self-assessment leads: all therapists can list; first therapist to link claims the client
-- and others no longer see the lead. Realtime bump so therapist UIs refetch when any link changes.

-- ---------------------------------------------------------------------------
-- Version bump: any change to therapist_clients notifies all subscribers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_inbox_bump (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version bigint NOT NULL DEFAULT 0
);

INSERT INTO public.therapist_inbox_bump (id, version) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_therapist_inbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.therapist_inbox_bump SET version = version + 1 WHERE id = 1;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_therapist_clients_bump_inbox ON public.therapist_clients;
CREATE TRIGGER trg_therapist_clients_bump_inbox
  AFTER INSERT OR UPDATE OR DELETE ON public.therapist_clients
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.bump_therapist_inbox();

ALTER TABLE public.therapist_inbox_bump ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "therapist_inbox_bump_select" ON public.therapist_inbox_bump;
CREATE POLICY "therapist_inbox_bump_select"
  ON public.therapist_inbox_bump FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.therapist_inbox_bump TO authenticated;

DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_inbox_bump;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Add public.therapist_inbox_bump to supabase_realtime in Dashboard → Replication';
END
$pub$;

-- ---------------------------------------------------------------------------
-- List unlinked self-assessment leads (for sales / contact) — therapists only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unlinked_self_assessment_leads_for_therapist()
RETURNS TABLE (
  assessment_id uuid,
  client_id uuid,
  completed_at timestamptz,
  email text,
  name text,
  first_name text,
  last_name text,
  phone_number text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'therapist') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (a.client_id)
    a.id AS assessment_id,
    a.client_id,
    a.completed_at,
    p.email,
    p.name,
    p.first_name,
    p.last_name,
    p.phone_number
  FROM public.assessments a
  INNER JOIN public.profiles p ON p.id = a.client_id
  WHERE a.assessment_mode = 'self'
    AND a.status = 'completed'
    AND p.role = 'client'
    AND NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = a.client_id)
  ORDER BY a.client_id, a.completed_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unlinked_self_assessment_leads_for_therapist() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unlinked_self_assessment_leads_for_therapist() TO authenticated;

-- ---------------------------------------------------------------------------
-- Claim: insert link only if client has no therapist yet and has completed a self assessment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_unlinked_self_lead(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid := auth.uid();
BEGIN
  IF tid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = tid AND pr.role = 'therapist') THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessments a WHERE a.client_id = p_client_id AND a.assessment_mode = 'self' AND a.status = 'completed') THEN
    RAISE EXCEPTION 'not_eligible' USING errcode = 'P0001';
  END IF;
  -- Serialize claims per client: first-come for unlinked self leads; prevents double-link races.
  PERFORM 1 FROM public.profiles c WHERE c.id = p_client_id AND c.role = 'client' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_eligible' USING errcode = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.client_id = p_client_id) THEN
    RAISE EXCEPTION 'already_linked' USING errcode = 'P0001';
  END IF;
  INSERT INTO public.therapist_clients (therapist_id, client_id, session_id)
  VALUES (tid, p_client_id, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_unlinked_self_lead(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_unlinked_self_lead(uuid) TO authenticated;
