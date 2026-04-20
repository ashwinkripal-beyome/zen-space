-- Enable Realtime for therapist-visible pending-notification updates (RLS applies to events).

DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.assessments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Add public.assessments to supabase_realtime in Dashboard → Replication';
END
$pub$;

DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'Add public.reports to supabase_realtime in Dashboard → Replication';
END
$pub$;
