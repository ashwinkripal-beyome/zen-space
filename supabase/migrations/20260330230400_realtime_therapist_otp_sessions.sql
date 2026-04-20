-- Broadcast OTP session row changes (e.g. clients_used) to therapist dashboards.
DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_otp_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Add public.therapist_otp_sessions under Dashboard → Database → Publications';
END
$pub$;
