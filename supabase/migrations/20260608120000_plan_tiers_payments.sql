-- Plan tiers, Razorpay payment records, 1-on-1 activity selections, and stopped_pro status.
-- Extends client_status to include 'stopped_pro', adds current_plan to profiles,
-- creates payment_orders and one_on_one_activity_selections tables.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Extend profiles
-- ────────────────────────────────────────────────────────────────────────────

-- Drop old CHECK constraint so we can add stopped_pro.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_client_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_client_status_check
  CHECK (client_status IN ('pro', 'contacted', 'dropped', 'stopped_pro'));

-- Durable plan tier (free = NULL or 'free').
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_plan text
  CHECK (current_plan IN ('free', '18_week_semi_guided', 'one_on_one_intensive'));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. payment_orders — one row per Razorpay order attempt
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_order_id   text NOT NULL UNIQUE,
  razorpay_payment_id text,
  razorpay_signature  text,
  plan                text NOT NULL
                        CHECK (plan IN ('18_week_semi_guided', 'one_on_one_intensive')),
  amount_paise        integer NOT NULL,
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'paid', 'failed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Clients may read their own orders (for status polling).
DROP POLICY IF EXISTS "payment_orders_client_read" ON public.payment_orders;
CREATE POLICY "payment_orders_client_read"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Service role (edge functions) handles all inserts/updates; no direct client writes.

-- ────────────────────────────────────────────────────────────────────────────
-- 3. one_on_one_activity_selections — therapist picks an activity per week
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.one_on_one_activity_selections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_id     uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  week_number   integer NOT NULL CHECK (week_number BETWEEN 1 AND 18),
  activity_name text NOT NULL,
  zone          text NOT NULL,
  corner        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, week_number)
);

ALTER TABLE public.one_on_one_activity_selections ENABLE ROW LEVEL SECURITY;

-- Clients may read their own selections.
DROP POLICY IF EXISTS "activity_selections_client_read" ON public.one_on_one_activity_selections;
CREATE POLICY "activity_selections_client_read"
  ON public.one_on_one_activity_selections FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Linked therapists may read selections for their clients.
DROP POLICY IF EXISTS "activity_selections_therapist_read" ON public.one_on_one_activity_selections;
CREATE POLICY "activity_selections_therapist_read"
  ON public.one_on_one_activity_selections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = one_on_one_activity_selections.client_id
    )
  );

-- Linked therapists may insert/update/delete selections for their clients.
DROP POLICY IF EXISTS "activity_selections_therapist_write" ON public.one_on_one_activity_selections;
CREATE POLICY "activity_selections_therapist_write"
  ON public.one_on_one_activity_selections FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = one_on_one_activity_selections.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = one_on_one_activity_selections.client_id
    )
  );

-- Admin full access.
DROP POLICY IF EXISTS "activity_selections_admin_all" ON public.one_on_one_activity_selections;
CREATE POLICY "activity_selections_admin_all"
  ON public.one_on_one_activity_selections FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Update set_client_status() to support stopped_pro and current_plan
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_client_status(p_client_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid    boolean;
  v_plan    text;
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('pro', 'contacted', 'dropped', 'stopped_pro') THEN
    RAISE EXCEPTION 'invalid status: must be pro, contacted, dropped, stopped_pro, or NULL';
  END IF;

  -- pro → paid + assign 18-week semi-guided (cash/manual upgrade).
  -- stopped_pro → revoke paid access; keep current_plan label for history.
  -- others → not paid, leave current_plan unchanged.
  v_paid := (p_status = 'pro');
  v_plan  := CASE WHEN p_status = 'pro' THEN '18_week_semi_guided' ELSE NULL END;

  IF (SELECT public.is_admin()) THEN
    UPDATE public.profiles
    SET client_status  = p_status,
        is_paid_customer = v_paid,
        current_plan   = COALESCE(v_plan, current_plan)
    WHERE id = p_client_id AND role = 'client';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'client profile not found';
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.therapist_clients tc
    WHERE tc.therapist_id = auth.uid() AND tc.client_id = p_client_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.profiles
  SET client_status  = p_status,
      is_paid_customer = v_paid,
      current_plan   = COALESCE(v_plan, current_plan)
  WHERE id = p_client_id AND role = 'client';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_status(uuid, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. activate_client_plan — called by verify-razorpay-payment edge function
--    via service role; validates plan and marks client as paid.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.activate_client_plan(
  p_client_id         uuid,
  p_plan              text,
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
  SET is_paid_customer = true,
      client_status    = 'pro',
      current_plan     = p_plan
  WHERE id = p_client_id AND role = 'client';
END;
$$;

-- Only service role (edge functions) should call this; strip public grant.
REVOKE ALL ON FUNCTION public.activate_client_plan(uuid, text, text, text, text) FROM PUBLIC;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Upsert helper for activity selections (therapist workflow)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_activity_selection(
  p_client_id     uuid,
  p_report_id     uuid,
  p_week_number   integer,
  p_activity_name text,
  p_zone          text,
  p_corner        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only linked therapists or admin.
  IF NOT (SELECT public.is_admin()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = p_client_id
    ) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  INSERT INTO public.one_on_one_activity_selections
    (client_id, report_id, week_number, activity_name, zone, corner, updated_at)
  VALUES
    (p_client_id, p_report_id, p_week_number, p_activity_name, p_zone, p_corner, now())
  ON CONFLICT (report_id, week_number)
  DO UPDATE SET
    activity_name = EXCLUDED.activity_name,
    zone          = EXCLUDED.zone,
    corner        = EXCLUDED.corner,
    updated_at    = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_activity_selection(uuid, uuid, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_activity_selection(uuid, uuid, integer, text, text, text) TO authenticated;
