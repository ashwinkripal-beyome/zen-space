-- Benchmark assessments: kind column + idempotent answer upserts per question.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS assessment_kind text NOT NULL DEFAULT 'benchmark';

DO $$
BEGIN
  ALTER TABLE public.assessments
    ADD CONSTRAINT assessments_assessment_kind_check
    CHECK (assessment_kind IN ('benchmark', 'follow_up', 'check_in'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS assessment_answers_assessment_question_idx
  ON public.assessment_answers (assessment_id, question_id);
