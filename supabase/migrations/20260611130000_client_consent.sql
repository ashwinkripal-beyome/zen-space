-- Client informed-consent gate.
-- Every client must accept the Zen Garden Wellness Assessment consent before
-- the app is made available to them. We store the timestamp of acceptance on
-- the profile; NULL means "not yet consented" (covers all existing clients).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;

COMMENT ON COLUMN public.profiles.consent_given_at IS
  'When the client accepted the wellness assessment informed-consent agreement; NULL = not yet consented.';

-- ---------------------------------------------------------------------------
-- record_client_consent
-- The signed-in client stamps their own consent. Idempotent: re-calling keeps
-- the original acceptance time. Server-stamped so the moment cannot be spoofed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_client_consent()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_result timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET consent_given_at = COALESCE(consent_given_at, v_now),
      updated_at = v_now
  WHERE id = v_uid AND role = 'client'
  RETURNING consent_given_at INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client profile not found';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_client_consent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_client_consent() TO authenticated;
