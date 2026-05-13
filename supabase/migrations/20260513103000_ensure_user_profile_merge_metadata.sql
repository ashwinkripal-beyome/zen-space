-- Existing profile rows created before metadata handling kept empty first/last/phone/name/email.
-- When ensure_user_profile runs, backfill those columns from auth.users if still empty.

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_umeta jsonb;
  v_ameta jsonb;
  v_role  text;
  v_first text;
  v_last  text;
  v_phone text;
  v_name  text;
  rec     public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.email, u.raw_user_meta_data, u.raw_app_meta_data
  INTO v_email, v_umeta, v_ameta
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_role := lower(COALESCE(
    NULLIF(trim(COALESCE(v_ameta->>'role', '')), ''),
    NULLIF(trim(COALESCE(v_umeta->>'role', '')), ''),
    'client'
  ));
  IF v_role NOT IN ('admin', 'therapist', 'client') THEN
    v_role := 'client';
  END IF;

  v_first := NULLIF(trim(COALESCE(v_umeta->>'first_name', '')), '');
  v_last  := NULLIF(trim(COALESCE(v_umeta->>'last_name',  '')), '');
  v_phone := NULLIF(trim(COALESCE(v_umeta->>'phone_number', '')), '');
  v_name  := NULLIF(trim(COALESCE(
    v_umeta->>'name',
    NULLIF(trim(CONCAT_WS(' ', v_first, v_last)), '')
  )), '');

  INSERT INTO public.profiles (id, email, role, name, first_name, last_name, phone_number)
  VALUES (auth.uid(), COALESCE(v_email, ''), v_role, v_name, v_first, v_last, v_phone)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles p
  SET
    email = COALESCE(NULLIF(trim(p.email), ''), NULLIF(trim(COALESCE(v_email, '')), '')),
    name = COALESCE(NULLIF(trim(p.name), ''), v_name),
    first_name = COALESCE(NULLIF(trim(p.first_name), ''), v_first),
    last_name = COALESCE(NULLIF(trim(p.last_name), ''), v_last),
    phone_number = COALESCE(NULLIF(trim(p.phone_number), ''), v_phone),
    updated_at = now()
  WHERE p.id = auth.uid()
    AND (
      (NULLIF(trim(p.email), '') IS NULL AND NULLIF(trim(COALESCE(v_email, '')), '') IS NOT NULL)
      OR (NULLIF(trim(p.first_name), '') IS NULL AND v_first IS NOT NULL)
      OR (NULLIF(trim(p.last_name), '') IS NULL AND v_last IS NOT NULL)
      OR (NULLIF(trim(p.phone_number), '') IS NULL AND v_phone IS NOT NULL)
      OR (NULLIF(trim(p.name), '') IS NULL AND v_name IS NOT NULL)
    );

  SELECT * INTO rec FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile row missing for current user';
  END IF;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;
