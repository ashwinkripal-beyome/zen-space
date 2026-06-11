-- Therapist/admin read-only visibility into corporate company membership.
--   * company_member_counts() — per-company count of linked client profiles,
--     used to show "N members" on each company card.
--   * list_company_members(company_id) — the read-only roster of clients whose
--     profile is linked to any department of that company.
--
-- Both bypass the per-client profiles RLS (a therapist normally only sees their
-- own linked clients) via SECURITY DEFINER, and are gated to therapists/admins.

-- ---------------------------------------------------------------------------
-- company_member_counts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_member_counts()
RETURNS TABLE (company_id uuid, member_count bigint)
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

  RETURN QUERY
  SELECT d.company_id, count(p.id)::bigint AS member_count
  FROM public.company_departments d
  JOIN public.profiles p
    ON p.company_department_id = d.id
   AND p.role = 'client'
  GROUP BY d.company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.company_member_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_member_counts() TO authenticated;

-- ---------------------------------------------------------------------------
-- list_company_members
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_company_members(p_company_id uuid)
RETURNS TABLE (
  id              uuid,
  email           text,
  name            text,
  first_name      text,
  last_name       text,
  gender          text,
  age             smallint,
  client_status   text,
  department_id   uuid,
  department_name text
)
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

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.name,
    p.first_name,
    p.last_name,
    p.gender,
    p.age,
    p.client_status,
    d.id   AS department_id,
    d.name AS department_name
  FROM public.company_departments d
  JOIN public.profiles p
    ON p.company_department_id = d.id
   AND p.role = 'client'
  WHERE d.company_id = p_company_id
  ORDER BY COALESCE(NULLIF(btrim(p.name), ''), p.email) ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_company_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_company_members(uuid) TO authenticated;
