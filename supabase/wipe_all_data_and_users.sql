-- =============================================================================
-- Zen Space — wipe ALL app data AND all auth users (fresh sign-ups)
-- =============================================================================
-- Run in: Supabase Dashboard → SQL Editor (use the **postgres** role / service).
--
-- What it does:
--   1. Truncates every public Zen Space table (schema, RLS, triggers stay).
--   2. Deletes rows in `auth` that belong to those users (sessions, identities, users).
--
-- After running: sign up therapists/clients again. `handle_new_user` recreates
-- `public.profiles` on first login/sign-up.
--
-- Optional: if you use Supabase Storage for uploads, uncomment the storage section.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Public app data (order + CASCADE satisfies foreign keys)
-- ---------------------------------------------------------------------------
-- If a table does not exist on your project yet, remove that line or run the
-- matching migration first.

TRUNCATE TABLE
  public.plan_day_status,
  public.plan_days,
  public.report_plan_progress,
  public.subscriptions,
  public.assessment_answers,
  public.reports,
  public.assessments,
  public.assessment_overrides,
  public.therapist_session_joins,
  public.therapist_clients,
  public.therapist_otp_sessions,
  public.profiles
RESTART IDENTITY CASCADE;

-- Legacy table name from early teardown scripts (only if the table exists):
-- TRUNCATE TABLE public.therapist_email_otps RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 2) Auth — remove all users so you can register new accounts
-- ---------------------------------------------------------------------------
-- Run top to bottom. If a line errors with “relation does not exist”, comment
-- it out and continue. `identities` must be cleared before `users` if your
-- project does not use ON DELETE CASCADE from users → identities.

DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- If `DELETE FROM auth.users` fails (FK from another auth table), try these
-- one at a time, then repeat the four lines above:
-- DELETE FROM auth.mfa_challenges;
-- DELETE FROM auth.mfa_factors;
-- DELETE FROM auth.one_time_tokens;
-- DELETE FROM auth.oauth_authorizations;
-- DELETE FROM auth.oauth_consents;

-- ---------------------------------------------------------------------------
-- 3) Optional: Storage (uncomment if you use buckets tied to old users)
-- ---------------------------------------------------------------------------
-- DELETE FROM storage.objects;

-- =============================================================================
-- Alternative: destroy public schema entirely (then re-apply migrations)
-- =============================================================================
-- See `supabase/manual_full_reset.sql` — drops public tables + functions, then
-- run `supabase/migrations/20260330220000_zen_space_init.sql` and later
-- migrations in order. Use that only when you want a full schema rebuild.
-- =============================================================================
