-- Zen Space — full schema (profiles, OTP sessions, assessments → plans, RLS).
-- Run on a fresh project or after manual_full_reset.sql. Destroys prior public app objects.

-- ---------------------------------------------------------------------------
-- Teardown
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.join_therapist_session(text);
DROP FUNCTION IF EXISTS public.join_therapist_session(text, uuid);
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, text);
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, integer, text);
DROP FUNCTION IF EXISTS public.generate_therapist_otp(uuid, text);
DROP FUNCTION IF EXISTS public.ensure_user_profile();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.save_therapist_observations(uuid, jsonb);

DROP TABLE IF EXISTS public.plan_day_status CASCADE;
DROP TABLE IF EXISTS public.plan_days CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.assessment_answers CASCADE;
DROP TABLE IF EXISTS public.assessments CASCADE;
DROP TABLE IF EXISTS public.therapist_session_joins CASCADE;
DROP TABLE IF EXISTS public.therapist_clients CASCADE;
DROP TABLE IF EXISTS public.therapist_email_otps CASCADE;
DROP TABLE IF EXISTS public.therapist_otp_sessions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'therapist', 'client')),
  email text NOT NULL DEFAULT '',
  name text,
  first_name text,
  last_name text,
  gender text,
  phone_number text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := lower(COALESCE(trim(new.raw_user_meta_data->>'role'), 'client'));
BEGIN
  IF v_role NOT IN ('admin', 'therapist', 'client') THEN
    v_role := 'client';
  END IF;

  INSERT INTO public.profiles (id, email, role, name)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    v_role,
    NULLIF(trim(COALESCE(new.raw_user_meta_data->>'name', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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
  v_role text;
  v_name text;
  rec public.profiles%ROWTYPE;
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

  v_name := NULLIF(trim(COALESCE(v_umeta->>'name', '')), '');

  INSERT INTO public.profiles (id, email, role, name)
  VALUES (auth.uid(), COALESCE(v_email, ''), v_role, v_name)
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
-- Assessment OTP sessions (one code, many clients up to max_clients)
-- ---------------------------------------------------------------------------
CREATE TABLE public.therapist_otp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_name text NOT NULL,
  otp text NOT NULL,
  max_clients integer NOT NULL DEFAULT 200 CHECK (max_clients > 0 AND max_clients <= 500),
  clients_used integer NOT NULL DEFAULT 0 CHECK (clients_used >= 0),
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX therapist_otp_sessions_otp_lookup_idx ON public.therapist_otp_sessions (otp);
CREATE INDEX therapist_otp_sessions_therapist_idx ON public.therapist_otp_sessions (therapist_id);
CREATE INDEX therapist_otp_sessions_active_idx
  ON public.therapist_otp_sessions (therapist_id, expires_at DESC)
  WHERE is_active = true;

CREATE TABLE public.therapist_session_joins (
  session_id uuid NOT NULL REFERENCES public.therapist_otp_sessions (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, client_id)
);

CREATE INDEX therapist_session_joins_client_idx ON public.therapist_session_joins (client_id);

CREATE TABLE public.therapist_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.therapist_otp_sessions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, client_id)
);

CREATE INDEX therapist_clients_therapist_idx ON public.therapist_clients (therapist_id);
CREATE INDEX therapist_clients_client_idx ON public.therapist_clients (client_id);

-- ---------------------------------------------------------------------------
-- Assessments, reports, subscriptions, plans
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assessment_kind text NOT NULL DEFAULT 'benchmark' CHECK (assessment_kind IN ('benchmark', 'follow_up', 'check_in')),
  status text NOT NULL DEFAULT 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  score_total integer,
  score_data jsonb,
  therapist_observations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assessments_client_idx ON public.assessments (client_id);
CREATE INDEX assessments_therapist_idx ON public.assessments (therapist_id);

CREATE TABLE public.assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_text text,
  answer_value text,
  swipe_direction text,
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);

CREATE INDEX assessment_answers_assessment_idx ON public.assessment_answers (assessment_id);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  content text,
  current_state text,
  imbalance_score integer,
  blossom_zone_nervous_system integer,
  blossom_zone_emotional integer,
  bliss_zone_spiritual integer,
  daily_reflections text,
  premium_locked_content jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id)
);

CREATE INDEX reports_client_idx ON public.reports (client_id);
CREATE INDEX reports_assessment_idx ON public.reports (assessment_id);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT '30-day',
  is_active boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_client_idx ON public.subscriptions (client_id);

CREATE TABLE public.plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports (id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 365),
  task_title text NOT NULL,
  task_description text,
  focus text,
  is_current_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, day_number, report_id)
);

CREATE INDEX plan_days_client_idx ON public.plan_days (client_id);

CREATE TABLE public.plan_day_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id uuid NOT NULL REFERENCES public.plan_days (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_complete boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_day_id, client_id)
);

CREATE INDEX plan_day_status_client_idx ON public.plan_day_status (client_id);

-- ---------------------------------------------------------------------------
-- RPCs: create OTP session, client join
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_therapist_otp_session(
  therapist_id uuid,
  max_clients integer DEFAULT 200,
  session_name text DEFAULT 'Assessment'
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
  i integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM therapist_id THEN
    RAISE EXCEPTION 'Unauthorized';
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
    is_active
  )
  VALUES (
    therapist_id,
    v_name,
    v_otp,
    v_max,
    v_used,
    v_expires,
    true
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'session_id', v_id,
    'otp', v_otp,
    'expires_at', v_expires,
    'clients_used', v_used,
    'max_clients', v_max,
    'session_name', v_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_therapist_otp_session(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_therapist_session(otp_code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.therapist_otp_sessions%ROWTYPE;
  v_slots integer;
  v_client_id uuid := auth.uid();
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF otp_code_param IS NULL OR btrim(otp_code_param) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  SELECT *
  INTO v_session
  FROM public.therapist_otp_sessions
  WHERE otp = btrim(otp_code_param)
    AND is_active = true
  ORDER BY expires_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.therapist_session_joins j
    WHERE j.session_id = v_session.id
      AND j.client_id = v_client_id
  ) THEN
    INSERT INTO public.therapist_clients (therapist_id, client_id, session_id)
    VALUES (v_session.therapist_id, v_client_id, v_session.id)
    ON CONFLICT (therapist_id, client_id)
    DO UPDATE SET session_id = EXCLUDED.session_id;

    SELECT * INTO v_session FROM public.therapist_otp_sessions WHERE id = v_session.id;

    v_slots := v_session.max_clients - v_session.clients_used;
    RETURN jsonb_build_object(
      'success', true,
      'joined', true,
      'session_name', v_session.session_name,
      'slots_remaining', GREATEST(v_slots, 0),
      'session_id', v_session.id,
      'clients_used', v_session.clients_used,
      'max_clients', v_session.max_clients
    );
  END IF;

  IF v_session.clients_used >= v_session.max_clients THEN
    RETURN jsonb_build_object('success', false, 'error', 'full');
  END IF;

  INSERT INTO public.therapist_session_joins (session_id, client_id)
  VALUES (v_session.id, v_client_id);

  UPDATE public.therapist_otp_sessions
  SET clients_used = clients_used + 1
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  INSERT INTO public.therapist_clients (therapist_id, client_id, session_id)
  VALUES (v_session.therapist_id, v_client_id, v_session.id)
  ON CONFLICT (therapist_id, client_id)
  DO UPDATE SET session_id = EXCLUDED.session_id;

  v_slots := v_session.max_clients - v_session.clients_used;

  RETURN jsonb_build_object(
    'success', true,
    'joined', true,
    'session_name', v_session.session_name,
    'slots_remaining', GREATEST(v_slots, 0),
    'session_id', v_session.id,
    'clients_used', v_session.clients_used,
    'max_clients', v_session.max_clients
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_therapist_session(text) TO authenticated;

-- Helper for RLS: admin check without querying profiles under RLS (avoids 42P17 recursion).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_therapist_observations(
  p_assessment_id uuid,
  p_observations jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.assessments a
  SET therapist_observations = COALESCE(p_observations, '{}'::jsonb)
  WHERE a.id = p_assessment_id
    AND a.status = 'completed'
    AND EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid()
        AND tc.client_id = a.client_id
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'Assessment not found, not completed, or not your client';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_therapist_observations(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_otp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_session_joins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_day_status ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "profiles_select_linked_client"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.client_id = profiles.id AND tc.therapist_id = auth.uid()
    )
  );

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()));

-- therapist OTP / links
CREATE POLICY "therapist_otp_sessions_select_own"
  ON public.therapist_otp_sessions FOR SELECT TO authenticated
  USING (therapist_id = auth.uid() OR (SELECT public.is_admin()));

CREATE POLICY "therapist_clients_select"
  ON public.therapist_clients FOR SELECT TO authenticated
  USING (
    therapist_id = auth.uid()
    OR client_id = auth.uid()
    OR (SELECT public.is_admin())
  );

CREATE POLICY "therapist_clients_admin_write"
  ON public.therapist_clients FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- joins: no direct client access needed; admin only
CREATE POLICY "therapist_session_joins_admin"
  ON public.therapist_session_joins FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.therapist_otp_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_clients TO authenticated;

-- assessments
CREATE POLICY "assessments_select_client"
  ON public.assessments FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "assessments_select_therapist"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = assessments.client_id
    )
  );

CREATE POLICY "assessments_select_admin"
  ON public.assessments FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "assessments_insert_client"
  ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "assessments_update_client"
  ON public.assessments FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- assessment_answers (via assessment ownership)
CREATE POLICY "assessment_answers_select"
  ON public.assessment_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_answers.assessment_id
        AND (a.client_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.therapist_clients tc WHERE tc.therapist_id = auth.uid() AND tc.client_id = a.client_id)
          OR (SELECT public.is_admin()))
    )
  );

CREATE POLICY "assessment_answers_insert_client"
  ON public.assessment_answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.client_id = auth.uid())
  );

CREATE POLICY "assessment_answers_update_client"
  ON public.assessment_answers FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_answers.assessment_id AND a.client_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_answers.assessment_id AND a.client_id = auth.uid())
  );

CREATE POLICY "assessment_answers_delete_client"
  ON public.assessment_answers FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_answers.assessment_id AND a.client_id = auth.uid())
  );

-- reports
CREATE POLICY "reports_select_client"
  ON public.reports FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "reports_select_therapist"
  ON public.reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = reports.client_id
    )
  );

CREATE POLICY "reports_select_admin"
  ON public.reports FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- subscriptions
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "subscriptions_select_therapist"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = subscriptions.client_id
    )
  );

CREATE POLICY "subscriptions_select_admin"
  ON public.subscriptions FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "subscriptions_write_admin"
  ON public.subscriptions FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- plan_days
CREATE POLICY "plan_days_select_client_subscribed"
  ON public.plan_days FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.client_id = auth.uid()
        AND s.is_active = true
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    )
  );

CREATE POLICY "plan_days_select_therapist"
  ON public.plan_days FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = plan_days.client_id
    )
  );

CREATE POLICY "plan_days_select_admin"
  ON public.plan_days FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

-- plan_day_status
CREATE POLICY "plan_day_status_select_client_subscribed"
  ON public.plan_day_status FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.client_id = auth.uid()
        AND s.is_active = true
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    )
  );

CREATE POLICY "plan_day_status_select_therapist"
  ON public.plan_day_status FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_clients tc
      WHERE tc.therapist_id = auth.uid() AND tc.client_id = plan_day_status.client_id
    )
  );

CREATE POLICY "plan_day_status_select_admin"
  ON public.plan_day_status FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "plan_day_status_mutate_client_subscribed"
  ON public.plan_day_status FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.client_id = auth.uid()
        AND s.is_active = true
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    )
  );

CREATE POLICY "plan_day_status_update_client_subscribed"
  ON public.plan_day_status FOR UPDATE TO authenticated
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.client_id = auth.uid()
        AND s.is_active = true
        AND (s.end_date IS NULL OR s.end_date >= CURRENT_DATE)
    )
  )
  WITH CHECK (client_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_clients;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Add public.therapist_clients to supabase_realtime in Dashboard → Replication';
END
$pub$;

DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_otp_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Add public.therapist_otp_sessions to supabase_realtime in Dashboard → Replication';
END
$pub$;
