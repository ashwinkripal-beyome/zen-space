-- Add structured company/department linkage to profiles, expose a safe
-- therapist-callable delete for unused companies, and let therapists delete
-- individual department rows on companies they (or any therapist) manage.

-- ---------------------------------------------------------------------------
-- profiles: company_department_id + company_not_listed
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_department_id uuid
    REFERENCES public.company_departments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_not_listed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_company_department_idx
  ON public.profiles (company_department_id);

-- ---------------------------------------------------------------------------
-- delete_company_safely
-- Therapist or admin can delete a company iff no therapist_clients reference
-- it (or its departments) and no profile rows are linked to its departments.
-- Cascade clears company_departments rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_company_safely(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role = 'therapist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company id is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.company_id = p_company_id) THEN
    RAISE EXCEPTION 'company_in_use';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.therapist_clients tc
    JOIN public.company_departments d ON d.id = tc.company_department_id
    WHERE d.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'company_in_use';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.company_departments d ON d.id = p.company_department_id
    WHERE d.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'company_in_use';
  END IF;

  DELETE FROM public.company_departments WHERE company_id = p_company_id;
  DELETE FROM public.companies WHERE id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_safely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_company_safely(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- delete_company_department_safely
-- Therapist or admin can delete a single department iff no therapist_clients
-- or profiles reference it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_company_department_safely(p_department_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role = 'therapist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_department_id IS NULL THEN
    RAISE EXCEPTION 'Department id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.therapist_clients tc
    WHERE tc.company_department_id = p_department_id
  ) THEN
    RAISE EXCEPTION 'department_in_use';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.company_department_id = p_department_id
  ) THEN
    RAISE EXCEPTION 'department_in_use';
  END IF;

  DELETE FROM public.company_departments WHERE id = p_department_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_department_safely(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_company_department_safely(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- set_client_company_selection
-- A client sets their own company + department selection, or marks not listed.
-- Keeps profiles.company text in sync with the chosen company name for display.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_client_company_selection(
  p_company_id uuid,
  p_department_id uuid,
  p_not_listed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_not_listed THEN
    UPDATE public.profiles
    SET company = NULL,
        company_department_id = NULL,
        company_not_listed = true,
        updated_at = now()
    WHERE id = v_uid;
    RETURN;
  END IF;

  IF p_company_id IS NULL OR p_department_id IS NULL THEN
    RAISE EXCEPTION 'company_and_department_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_departments d
    WHERE d.id = p_department_id AND d.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'invalid_department';
  END IF;

  SELECT name INTO v_company_name FROM public.companies WHERE id = p_company_id;
  IF v_company_name IS NULL THEN
    RAISE EXCEPTION 'invalid_company';
  END IF;

  UPDATE public.profiles
  SET company = v_company_name,
      company_department_id = p_department_id,
      company_not_listed = false,
      updated_at = now()
  WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_company_selection(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_company_selection(uuid, uuid, boolean) TO authenticated;
