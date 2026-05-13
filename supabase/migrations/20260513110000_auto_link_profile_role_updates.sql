-- Auto-link every client to every therapist even when profile roles change after creation.
-- The prior migration only handled INSERTs into profiles. In practice, therapist roles
-- may be assigned after the profile row exists, so add an UPDATE OF role trigger and
-- run the cross-join backfill again.

CREATE OR REPLACE FUNCTION public.auto_link_on_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'client' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
    PERFORM public.link_client_to_all_therapists(NEW.id);
  ELSIF NEW.role = 'therapist' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
    PERFORM public.link_therapist_to_all_clients(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_on_profile_insert ON public.profiles;
DROP TRIGGER IF EXISTS trg_auto_link_on_profile_role_change ON public.profiles;

CREATE TRIGGER trg_auto_link_on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_on_profile_role_change();

-- Backfill any pairs missed before this trigger existed, including therapists whose
-- role was assigned after their profile was inserted.
INSERT INTO public.therapist_clients (therapist_id, client_id)
SELECT t.id AS therapist_id, c.id AS client_id
FROM public.profiles t
CROSS JOIN public.profiles c
WHERE t.role = 'therapist'
  AND c.role = 'client'
ON CONFLICT (therapist_id, client_id) DO NOTHING;
