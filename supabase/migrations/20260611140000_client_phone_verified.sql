-- Client WhatsApp phone verification (one-time, mandatory at signup).
-- The login itself stays email + password. Every client must additionally prove
-- ownership of a WhatsApp number once. Verification runs through Supabase Auth's
-- phone-change OTP flow (delivered over WhatsApp by the `whatsapp-send-otp`
-- Send-SMS Auth Hook); GoTrue stamps auth.users.phone_confirmed_at on success.
-- We mirror that onto profiles so RLS-bound app code and route gates can read it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

COMMENT ON COLUMN public.profiles.phone_verified_at IS
  'When the client confirmed ownership of their WhatsApp number via OTP; NULL = not yet verified. Mirrored from auth.users.phone_confirmed_at.';

-- ---------------------------------------------------------------------------
-- Sync trigger: auth.users.phone / phone_confirmed_at -> public.profiles
-- Fires when GoTrue confirms a phone (verifyOtp type='phone_change' / 'sms').
-- SECURITY DEFINER + auth-schema trigger mirrors the existing handle_new_user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_phone_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when the confirmed phone actually changed (avoids redundant writes
  -- on every auth.users update, e.g. last_sign_in_at refreshes).
  IF NEW.phone_confirmed_at IS DISTINCT FROM OLD.phone_confirmed_at
     OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE public.profiles p
    SET
      phone_number = COALESCE(NULLIF(NEW.phone, ''), p.phone_number),
      phone_verified_at = NEW.phone_confirmed_at,
      updated_at = now()
    WHERE p.id = NEW.id
      AND (
        p.phone_verified_at IS DISTINCT FROM NEW.phone_confirmed_at
        OR p.phone_number IS DISTINCT FROM NULLIF(NEW.phone, '')
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_phone_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_phone_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_phone_verification();

-- ---------------------------------------------------------------------------
-- Backfill: any existing auth user who already has a confirmed phone.
-- ---------------------------------------------------------------------------
UPDATE public.profiles p
SET phone_verified_at = u.phone_confirmed_at,
    phone_number = COALESCE(NULLIF(u.phone, ''), p.phone_number),
    updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND u.phone_confirmed_at IS NOT NULL
  AND p.phone_verified_at IS NULL;
