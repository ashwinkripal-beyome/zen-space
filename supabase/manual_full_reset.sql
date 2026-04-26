-- =============================================================================
-- Zen Space — wipe public app schema (run in Supabase SQL Editor first)
-- =============================================================================
-- Keeps auth.users. Recreates empty public tables when you run:
--   supabase/migrations/20260330220000_zen_space_init.sql
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.upsert_company_with_departments(text, text[], uuid);
DROP FUNCTION IF EXISTS public.join_therapist_session(text);
DROP FUNCTION IF EXISTS public.join_therapist_session(text, uuid);
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, text);
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, integer, text);
DROP FUNCTION IF EXISTS public.create_therapist_otp_session(uuid, integer, text, text, uuid);
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
DROP TABLE IF EXISTS public.company_departments CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Next: run 20260330220000_zen_space_init.sql

-- Backfill profiles for existing auth users (optional):
-- INSERT INTO public.profiles (id, email, role)
-- SELECT id, COALESCE(email, ''), 'client' FROM auth.users
-- ON CONFLICT (id) DO NOTHING;
