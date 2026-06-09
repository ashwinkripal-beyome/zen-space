-- New RPC: set_client_paid
-- Allows therapists/admin to mark a client as paid with an explicit plan.
-- For cash payments; Razorpay flow uses activate_client_plan() via edge function.

CREATE OR REPLACE FUNCTION public.set_client_paid(
  p_client_id uuid,
  p_plan      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plan NOT IN ('18_week_semi_guided', 'one_on_one_intensive') THEN
    RAISE EXCEPTION 'invalid plan: must be 18_week_semi_guided or one_on_one_intensive';
  END IF;

  IF (SELECT public.is_admin()) THEN
    UPDATE public.profiles
    SET is_paid_customer = true,
        client_status    = 'pro',
        current_plan     = p_plan
    WHERE id = p_client_id AND role = 'client';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'client profile not found';
    END IF;
    RETURN;
  END IF;

  -- Therapist must be linked to this client.
  IF NOT EXISTS (
    SELECT 1 FROM public.therapist_clients tc
    WHERE tc.therapist_id = auth.uid() AND tc.client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET is_paid_customer = true,
      client_status    = 'pro',
      current_plan     = p_plan
  WHERE id = p_client_id AND role = 'client';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_paid(uuid, text) TO authenticated;
