-- Migration: signup metadata, auto therapist-client linking, first-login redirect flag
-- 1. Update handle_new_user to persist first_name, last_name, phone_number from signup metadata.
-- 2. Update ensure_user_profile similarly.
-- 3. Add client_initial_login_redirect_done flag to profiles (default false, backfill existing to true).
-- 4. Auto-link: trigger-based SECURITY DEFINER function links every client to all therapists on create.
-- 5. Backfill: cross-join insert for all existing clients × therapists.

-- ---------------------------------------------------------------------------
-- 1. handle_new_user: populate first_name, last_name, phone_number, name from metadata
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(COALESCE(trim(new.raw_user_meta_data->>'role'), 'client'));
  v_first text;
  v_last  text;
  v_phone text;
  v_name  text;
BEGIN
  IF v_role NOT IN ('admin', 'therapist', 'client') THEN
    v_role := 'client';
  END IF;

  v_first := NULLIF(trim(COALESCE(new.raw_user_meta_data->>'first_name', '')), '');
  v_last  := NULLIF(trim(COALESCE(new.raw_user_meta_data->>'last_name',  '')), '');
  v_phone := NULLIF(trim(COALESCE(new.raw_user_meta_data->>'phone_number', '')), '');
  v_name  := NULLIF(trim(COALESCE(
    new.raw_user_meta_data->>'name',
    NULLIF(trim(CONCAT_WS(' ', v_first, v_last)), '')
  )), '');

  INSERT INTO public.profiles (id, email, role, name, first_name, last_name, phone_number)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    v_role,
    v_name,
    v_first,
    v_last,
    v_phone
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. ensure_user_profile: same metadata fields
-- ---------------------------------------------------------------------------
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

  SELECT * INTO rec FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile row missing for current user';
  END IF;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. client_initial_login_redirect_done flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_initial_login_redirect_done boolean NOT NULL DEFAULT false;

-- Backfill: existing clients have already logged in; mark them done so they go to home.
UPDATE public.profiles
SET client_initial_login_redirect_done = true
WHERE role = 'client';

-- ---------------------------------------------------------------------------
-- 4. Auto-link helpers: link one client to all therapists (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_client_to_all_therapists(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.therapist_clients (therapist_id, client_id)
  SELECT p.id, p_client_id
  FROM public.profiles p
  WHERE p.role = 'therapist'
  ON CONFLICT (therapist_id, client_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_client_to_all_therapists(uuid) TO authenticated;

-- Link one therapist to all existing clients (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.link_therapist_to_all_clients(p_therapist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.therapist_clients (therapist_id, client_id)
  SELECT p_therapist_id, p.id
  FROM public.profiles p
  WHERE p.role = 'client'
  ON CONFLICT (therapist_id, client_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_therapist_to_all_clients(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Trigger: auto-link on new profile insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_link_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'client' THEN
    PERFORM public.link_client_to_all_therapists(NEW.id);
  ELSIF NEW.role = 'therapist' THEN
    PERFORM public.link_therapist_to_all_clients(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_on_profile_insert ON public.profiles;
CREATE TRIGGER trg_auto_link_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_profile_insert();

-- ---------------------------------------------------------------------------
-- 6. Backfill: link all existing clients × all existing therapists
-- ---------------------------------------------------------------------------
INSERT INTO public.therapist_clients (therapist_id, client_id)
SELECT t.id AS therapist_id, c.id AS client_id
FROM public.profiles t
CROSS JOIN public.profiles c
WHERE t.role = 'therapist'
  AND c.role = 'client'
ON CONFLICT (therapist_id, client_id) DO NOTHING;
