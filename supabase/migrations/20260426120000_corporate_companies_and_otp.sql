-- Corporate OTP: companies, departments, link_kind on OTP sessions, corporate fields on therapist_clients.
-- + RPCs: create/join/upsert

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX companies_name_norm_idx ON public.companies (lower(btrim(name)));

CREATE TABLE public.company_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_departments_company_idx ON public.company_departments (company_id);

CREATE UNIQUE INDEX company_departments_company_name_norm_uniq
  ON public.company_departments (company_id, (lower(btrim(name))));

-- ---------------------------------------------------------------------------
-- Alter existing tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.therapist_otp_sessions
  ADD COLUMN IF NOT EXISTS link_kind text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL;

ALTER TABLE public.therapist_otp_sessions
  ADD CONSTRAINT therapist_otp_sessions_link_kind_check
  CHECK (link_kind IN ('individual', 'corporate'));

ALTER TABLE public.therapist_otp_sessions
  ADD CONSTRAINT therapist_otp_sessions_corp_coherence_check
  CHECK (
    (link_kind = 'corporate' AND company_id IS NOT NULL)
    OR (link_kind = 'individual' AND company_id IS NULL)
  );

ALTER TABLE public.therapist_clients
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_department_id uuid REFERENCES public.company_departments (id) ON DELETE SET NULL;

-- Company/department pairing is enforced in join_therapist_session (no subquery CHECK: PG disallows
-- subqueries in CHECK constraints).

-- ---------------------------------------------------------------------------
-- RLS: companies
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_auth"
  ON public.companies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "companies_insert_therapist_or_admin"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'therapist')
  );

CREATE POLICY "companies_update_creator_or_admin"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.is_admin() OR created_by = auth.uid())
  WITH CHECK (public.is_admin() OR created_by = auth.uid());

CREATE POLICY "companies_delete_admin"
  ON public.companies FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "company_departments_select_auth"
  ON public.company_departments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "company_departments_write_therapist_or_admin"
  ON public.company_departments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'therapist')
  );

CREATE POLICY "company_departments_update_therapist_or_admin"
  ON public.company_departments FOR UPDATE TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'therapist'))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'therapist'));

CREATE POLICY "company_departments_delete_therapist_or_admin"
  ON public.company_departments FOR DELETE TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'therapist'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_departments TO authenticated;

-- ---------------------------------------------------------------------------
-- upsert_company_with_departments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_company_with_departments(
  p_name text,
  p_department_names text[],
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cid uuid;
  v_in text;
  v_trim text;
  v_n integer;
  v_name text;
  r_dep RECORD;
  v_matched boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role = 'therapist')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  IF p_department_names IS NULL OR array_length(p_department_names, 1) IS NULL OR array_length(p_department_names, 1) = 0 THEN
    RAISE EXCEPTION 'At least one department is required';
  END IF;

  IF p_company_id IS NULL THEN
    INSERT INTO public.companies (name, created_by) VALUES (v_name, v_uid) RETURNING id INTO v_cid;
  ELSE
    v_cid := p_company_id;
    IF public.is_admin() THEN
      UPDATE public.companies SET name = v_name WHERE id = v_cid;
    ELSE
      UPDATE public.companies SET name = v_name WHERE id = v_cid AND created_by = v_uid;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n = 0 THEN
        RAISE EXCEPTION 'Not allowed to update this company';
      END IF;
    END IF;
  END IF;

  FOREACH v_in IN ARRAY p_department_names
  LOOP
    v_trim := btrim(COALESCE(v_in, ''));
    IF v_trim = '' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.company_departments d
      WHERE d.company_id = v_cid AND lower(btrim(d.name)) = lower(v_trim)
    ) THEN
      UPDATE public.company_departments
      SET name = v_trim
      WHERE company_id = v_cid AND lower(btrim(name)) = lower(v_trim);
    ELSE
      INSERT INTO public.company_departments (company_id, name) VALUES (v_cid, v_trim);
    END IF;
  END LOOP;

  -- Remove departments removed from the list (only for updates) when no client is linked
  IF p_company_id IS NOT NULL THEN
    FOR r_dep IN
      SELECT id, name FROM public.company_departments WHERE company_id = v_cid
    LOOP
      v_matched := false;
      FOREACH v_in IN ARRAY p_department_names
      LOOP
        v_trim := btrim(COALESCE(v_in, ''));
        IF v_trim = '' THEN
          CONTINUE;
        END IF;
        IF lower(btrim(r_dep.name)) = lower(v_trim) THEN
          v_matched := true;
          EXIT;
        END IF;
      END LOOP;
      IF v_matched THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.company_department_id = r_dep.id) THEN
        DELETE FROM public.company_departments WHERE id = r_dep.id;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('company_id', v_cid, 'name', v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_company_with_departments(text, text[], uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_therapist_otp_session (new signature: link_kind + company_id)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, text);
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.create_therapist_otp_session(
  therapist_id uuid,
  max_clients integer DEFAULT 200,
  session_name text DEFAULT 'Assessment',
  p_link_kind text DEFAULT 'individual',
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp text;
  v_expires timestamptz := now() + interval '60 minutes';
  v_id uuid;
  v_max integer;
  v_used integer := 0;
  v_name text;
  v_lk text;
  v_cid uuid;
  i integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM therapist_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_lk := COALESCE(NULLIF(btrim(LOWER(COALESCE(p_link_kind, 'individual'))), ''), 'individual');
  IF v_lk NOT IN ('individual', 'corporate') THEN
    v_lk := 'individual';
  END IF;

  IF v_lk = 'corporate' THEN
    IF p_company_id IS NULL THEN
      RAISE EXCEPTION 'Company is required for corporate link';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
      RAISE EXCEPTION 'Invalid company';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.company_departments d WHERE d.company_id = p_company_id) THEN
      RAISE EXCEPTION 'Company must have at least one department';
    END IF;
    v_cid := p_company_id;
  ELSE
    v_cid := NULL;
  END IF;

  v_max := COALESCE(max_clients, 200);
  IF v_max < 1 THEN
    v_max := 1;
  END IF;
  IF v_max > 500 THEN
    v_max := 500;
  END IF;

  v_name := COALESCE(NULLIF(btrim(COALESCE(session_name, '')), ''), 'Assessment');

  FOR i IN 1..25 LOOP
    v_otp := LPAD((FLOOR(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.therapist_otp_sessions s
      WHERE s.otp = v_otp
        AND s.expires_at > now()
        AND s.is_active = true
    );
  END LOOP;

  INSERT INTO public.therapist_otp_sessions (
    therapist_id,
    session_name,
    otp,
    max_clients,
    clients_used,
    expires_at,
    is_active,
    link_kind,
    company_id
  )
  VALUES (
    therapist_id,
    v_name,
    v_otp,
    v_max,
    v_used,
    v_expires,
    true,
    v_lk,
    v_cid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'session_id', v_id,
    'otp', v_otp,
    'expires_at', v_expires,
    'clients_used', v_used,
    'max_clients', v_max,
    'session_name', v_name,
    'link_kind', v_lk,
    'company_id', v_cid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_therapist_otp_session(uuid, integer, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- join_therapist_session(otp, optional department id for corporate)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.join_therapist_session(text);
DROP FUNCTION IF EXISTS public.join_therapist_session(text, uuid);

CREATE OR REPLACE FUNCTION public.join_therapist_session(
  otp_code_param text,
  p_company_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.therapist_otp_sessions%ROWTYPE;
  v_slots integer;
  v_client_id uuid := auth.uid();
  v_in_joins boolean;
  v_is_corp boolean;
  v_corp_cid uuid;
  v_corp_did uuid;
  v_existing_did uuid;
  v_departments jsonb;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF otp_code_param IS NULL OR btrim(otp_code_param) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO v_session
  FROM public.therapist_otp_sessions
  WHERE otp = btrim(otp_code_param) AND is_active = true
  ORDER BY expires_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  v_is_corp := (v_session.link_kind = 'corporate' AND v_session.company_id IS NOT NULL);

  IF NOT v_is_corp AND p_company_department_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unexpected_department');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.therapist_session_joins j
    WHERE j.session_id = v_session.id AND j.client_id = v_client_id
  ) INTO v_in_joins;

  -- Existing join: refresh therapist_clients and return
  IF v_in_joins THEN
    v_corp_cid := CASE WHEN v_is_corp THEN v_session.company_id ELSE NULL END;
    IF v_is_corp THEN
      SELECT company_department_id
      INTO v_existing_did
      FROM public.therapist_clients
      WHERE therapist_id = v_session.therapist_id AND client_id = v_client_id;

      v_corp_did := COALESCE(p_company_department_id, v_existing_did);
      IF v_corp_did IS NULL THEN
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) ORDER BY d.name),
          '[]'::jsonb
        )
        INTO v_departments
        FROM public.company_departments d
        WHERE d.company_id = v_session.company_id;

        RETURN jsonb_build_object(
          'success', false,
          'error', 'department_required',
          'company_id', v_session.company_id,
          'departments', v_departments
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.company_departments d
        WHERE d.id = v_corp_did AND d.company_id = v_session.company_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_department');
      END IF;
    ELSE
      v_corp_did := NULL;
    END IF;

    INSERT INTO public.therapist_clients (therapist_id, client_id, session_id, company_id, company_department_id)
    VALUES (v_session.therapist_id, v_client_id, v_session.id, v_corp_cid, v_corp_did)
    ON CONFLICT (therapist_id, client_id) DO UPDATE SET
      session_id = EXCLUDED.session_id,
      company_id = EXCLUDED.company_id,
      company_department_id = EXCLUDED.company_department_id;

    SELECT * INTO v_session FROM public.therapist_otp_sessions WHERE id = v_session.id;
    v_slots := v_session.max_clients - v_session.clients_used;
    RETURN jsonb_build_object(
      'success', true,
      'joined', true,
      'session_name', v_session.session_name,
      'slots_remaining', GREATEST(v_slots, 0),
      'session_id', v_session.id,
      'clients_used', v_session.clients_used,
      'max_clients', v_session.max_clients,
      'link_kind', v_session.link_kind
    );
  END IF;

  -- New join: capacity
  IF v_session.clients_used >= v_session.max_clients THEN
    RETURN jsonb_build_object('success', false, 'error', 'full');
  END IF;

  -- Corporate: require department
  IF v_is_corp AND p_company_department_id IS NULL THEN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) ORDER BY d.name),
      '[]'::jsonb
    )
    INTO v_departments
    FROM public.company_departments d
    WHERE d.company_id = v_session.company_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'department_required',
      'company_id', v_session.company_id,
      'departments', v_departments
    );
  END IF;

  IF v_is_corp THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_departments d
      WHERE d.id = p_company_department_id AND d.company_id = v_session.company_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_department');
    END IF;
    v_corp_cid := v_session.company_id;
    v_corp_did := p_company_department_id;
  ELSE
    v_corp_cid := NULL;
    v_corp_did := NULL;
  END IF;

  INSERT INTO public.therapist_session_joins (session_id, client_id) VALUES (v_session.id, v_client_id);

  UPDATE public.therapist_otp_sessions
  SET clients_used = clients_used + 1
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  INSERT INTO public.therapist_clients (therapist_id, client_id, session_id, company_id, company_department_id)
  VALUES (v_session.therapist_id, v_client_id, v_session.id, v_corp_cid, v_corp_did)
  ON CONFLICT (therapist_id, client_id) DO UPDATE SET
    session_id = EXCLUDED.session_id,
    company_id = EXCLUDED.company_id,
    company_department_id = EXCLUDED.company_department_id;

  v_slots := v_session.max_clients - v_session.clients_used;
  RETURN jsonb_build_object(
    'success', true,
    'joined', true,
    'session_name', v_session.session_name,
    'slots_remaining', GREATEST(v_slots, 0),
    'session_id', v_session.id,
    'clients_used', v_session.clients_used,
    'max_clients', v_session.max_clients,
    'link_kind', v_session.link_kind
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_therapist_session(text, uuid) TO authenticated;
