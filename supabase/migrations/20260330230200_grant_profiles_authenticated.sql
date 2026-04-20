-- Required for PostgREST: signed-in users read/update their row via anon key + JWT.
-- Without this, .from('profiles').select() returns 42501 and the app never loads a profile.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
