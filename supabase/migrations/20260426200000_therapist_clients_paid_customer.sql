-- Paid status is one flag per *client* (on profiles), so all linked therapists see the same value.
-- Supervised assessments require the client to be marked as a paid customer.
-- Self assessment remains available when linked but not yet marked paid.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_paid_customer boolean NOT NULL DEFAULT false;

-- Linked therapists and admins may set the flag; therapists cannot change other profile fields.
CREATE OR REPLACE FUNCTION public.set_client_is_paid_customer(p_client_id uuid, p_is_paid boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT public.is_admin()) THEN
    UPDATE public.profiles
    SET is_paid_customer = p_is_paid
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
  SET is_paid_customer = p_is_paid
  WHERE id = p_client_id AND role = 'client';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_is_paid_customer(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_is_paid_customer(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "assessments_insert_client" ON public.assessments;
CREATE POLICY "assessments_insert_client"
  ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND (
      assessment_mode = 'self'
      OR (
        assessment_mode = 'supervised'
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = client_id
            AND p.is_paid_customer = true
        )
      )
    )
  );
