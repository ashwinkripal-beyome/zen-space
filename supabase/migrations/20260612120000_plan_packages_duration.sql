-- Plan duration packages (3 / 6 / 12 months) for the two paid plans.
-- Adds a durable package length to profiles and payment_orders, and threads the
-- selected number of months through the cash + Razorpay activation RPCs so the
-- therapist Clients page can show "<plan> · <N> months".
--
-- No 1-month package exists; allowed durations are 3, 6, and 12 months.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. profiles.current_plan_months — durable package length for the active plan
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_plan_months integer
  CHECK (current_plan_months IN (3, 6, 12));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. payment_orders.duration_months — package length for each order attempt
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS duration_months integer
  CHECK (duration_months IN (3, 6, 12));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. set_client_paid — cash payment; now records the chosen package length
-- ────────────────────────────────────────────────────────────────────────────

-- Drop the old 2-arg signature; the app now always passes the package length.
DROP FUNCTION IF EXISTS public.set_client_paid(uuid, text);

CREATE OR REPLACE FUNCTION public.set_client_paid(
  p_client_id uuid,
  p_plan      text,
  p_months    integer
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

  IF p_months NOT IN (3, 6, 12) THEN
    RAISE EXCEPTION 'invalid package: months must be 3, 6, or 12';
  END IF;

  IF (SELECT public.is_admin()) THEN
    UPDATE public.profiles
    SET is_paid_customer   = true,
        client_status      = 'pro',
        current_plan        = p_plan,
        current_plan_months = p_months
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
  SET is_paid_customer   = true,
      client_status      = 'pro',
      current_plan        = p_plan,
      current_plan_months = p_months
  WHERE id = p_client_id AND role = 'client';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_paid(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_paid(uuid, text, integer) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. activate_client_plan — Razorpay activation; now records package length
-- ────────────────────────────────────────────────────────────────────────────

-- Drop the old 5-arg signature; the edge function now passes the package length.
DROP FUNCTION IF EXISTS public.activate_client_plan(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.activate_client_plan(
  p_client_id         uuid,
  p_plan              text,
  p_months            integer,
  p_razorpay_order_id text,
  p_payment_id        text,
  p_signature         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plan NOT IN ('18_week_semi_guided', 'one_on_one_intensive') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  IF p_months NOT IN (3, 6, 12) THEN
    RAISE EXCEPTION 'invalid package: months must be 3, 6, or 12';
  END IF;

  -- Mark order as paid.
  UPDATE public.payment_orders
  SET status              = 'paid',
      razorpay_payment_id = p_payment_id,
      razorpay_signature  = p_signature,
      paid_at             = now()
  WHERE razorpay_order_id = p_razorpay_order_id
    AND client_id         = p_client_id;

  -- Update profile.
  UPDATE public.profiles
  SET is_paid_customer   = true,
      client_status      = 'pro',
      current_plan        = p_plan,
      current_plan_months = p_months
  WHERE id = p_client_id AND role = 'client';
END;
$$;

-- Only service role (edge functions) should call this; strip public grant.
REVOKE ALL ON FUNCTION public.activate_client_plan(uuid, text, integer, text, text, text) FROM PUBLIC;
