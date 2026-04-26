-- Corporate migration originally added CHECK with EXISTS (subquery); PostgreSQL rejects that.
-- Drop if a partial run ever created it; safe no-op when absent.
ALTER TABLE public.therapist_clients
  DROP CONSTRAINT IF EXISTS therapist_clients_corp_fk_dept_belongs_company;
