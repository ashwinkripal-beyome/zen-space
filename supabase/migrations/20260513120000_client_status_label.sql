-- Add client_status column to profiles for manual therapist-set lifecycle labels.
-- Allowed values: 'pro', 'contacted', 'dropped', NULL (null means auto-derived: new_user or lead).
-- 'pro' is the only manual status that enables supervised assessments (is_paid_customer = true).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_status text
  CHECK (client_status IN ('pro', 'contacted', 'dropped'));

-- RPC: set_client_status
-- Linked therapists and admins may set the status.
-- Setting 'pro' also sets is_paid_customer = true; all other values clear it.
-- Passing NULL clears the manual status (reverts to derived new_user/lead).
CREATE OR REPLACE FUNCTION public.set_client_status(p_client_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid boolean;
BEGIN
  -- Validate input
  IF p_status IS NOT NULL AND p_status NOT IN ('pro', 'contacted', 'dropped') THEN
    RAISE EXCEPTION 'invalid status: must be pro, contacted, dropped, or NULL';
  END IF;

  v_paid := COALESCE(p_status = 'pro', false);

  IF (SELECT public.is_admin()) THEN
    UPDATE public.profiles
    SET client_status = p_status,
        is_paid_customer = v_paid
    WHERE id = p_client_id AND role = 'client';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'client profile not found';
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.therapist_clients tc
    WHERE tc.therapist_id = auth.uid() AND tc.client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET client_status = p_status,
      is_paid_customer = v_paid
  WHERE id = p_client_id AND role = 'client';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_status(uuid, text) TO authenticated;

-- Backfill: existing paid customers get status 'pro'
UPDATE public.profiles
SET client_status = 'pro'
WHERE role = 'client' AND is_paid_customer = true AND client_status IS NULL;
