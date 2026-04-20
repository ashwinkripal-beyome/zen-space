-- Migrate benchmark answers from legacy 5-point digits (0–4) to 4-point (0–3).
-- Mapping matches src/lib/benchmarkScoreUtils.ts normalizeLegacyBenchmarkValue:
--   0→0, 1→1, 2→1 (former "somewhat"), 3→2 (former "mostly"), 4→3 (former "completely").
-- Run once before or with the client release that stores only 0–3; re-running after users
-- submit answers on the new scale would incorrectly remap scores 2→1.

UPDATE public.assessment_answers aa
SET
  answer_value = (
    CASE trim(aa.answer_value)::integer
      WHEN 0 THEN '0'
      WHEN 1 THEN '1'
      WHEN 2 THEN '1'
      WHEN 3 THEN '2'
      WHEN 4 THEN '3'
      ELSE aa.answer_value
    END
  ),
  skipped = false
FROM public.assessments a
WHERE aa.assessment_id = a.id
  AND a.assessment_kind = 'benchmark'
  AND aa.answer_value ~ '^[0-4]$';

-- Recompute score_total and score_data for completed benchmark assessments (zones + overall bands match TS).
WITH pts AS (
  SELECT
    aa.assessment_id,
    aa.question_id,
    CASE trim(aa.answer_value)::integer
      WHEN 0 THEN 0
      WHEN 1 THEN 1
      WHEN 2 THEN 2
      WHEN 3 THEN 3
      ELSE 0
    END AS p
  FROM public.assessment_answers aa
  INNER JOIN public.assessments a ON a.id = aa.assessment_id AND a.assessment_kind = 'benchmark'
  WHERE aa.answer_value ~ '^[0-3]$'
),
agg AS (
  SELECT
    assessment_id,
    COALESCE(SUM(p) FILTER (WHERE question_id LIKE 'benchmark-balance-%'), 0)::integer AS balance_sum,
    COALESCE(SUM(p) FILTER (WHERE question_id LIKE 'benchmark-blossom-%'), 0)::integer AS blossom_sum,
    COALESCE(SUM(p) FILTER (WHERE question_id LIKE 'benchmark-bliss-%'), 0)::integer AS bliss_sum
  FROM pts
  GROUP BY assessment_id
),
scored AS (
  SELECT
    assessment_id,
    balance_sum,
    blossom_sum,
    bliss_sum,
    (balance_sum + blossom_sum + bliss_sum)::integer AS overall_sum
  FROM agg
)
UPDATE public.assessments a
SET
  score_total = s.overall_sum,
  score_data = jsonb_build_object(
    'kind',
    'benchmark',
    'zones',
    jsonb_build_object(
      'balance',
      jsonb_build_object(
        'sum',
        s.balance_sum,
        'band',
        CASE
          WHEN s.balance_sum <= 11 THEN 'low_imbalance'
          WHEN s.balance_sum <= 21 THEN 'mild_imbalance'
          WHEN s.balance_sum <= 31 THEN 'moderate_imbalance'
          ELSE 'high_imbalance'
        END
      ),
      'blossom',
      jsonb_build_object(
        'sum',
        s.blossom_sum,
        'band',
        CASE
          WHEN s.blossom_sum <= 11 THEN 'low_imbalance'
          WHEN s.blossom_sum <= 21 THEN 'mild_imbalance'
          WHEN s.blossom_sum <= 31 THEN 'moderate_imbalance'
          ELSE 'high_imbalance'
        END
      ),
      'bliss',
      jsonb_build_object(
        'sum',
        s.bliss_sum,
        'band',
        CASE
          WHEN s.bliss_sum <= 11 THEN 'low_imbalance'
          WHEN s.bliss_sum <= 21 THEN 'mild_imbalance'
          WHEN s.bliss_sum <= 31 THEN 'moderate_imbalance'
          ELSE 'high_imbalance'
        END
      )
    ),
    'overall',
    jsonb_build_object(
      'sum',
      s.overall_sum,
      'band',
      CASE
        WHEN s.overall_sum <= 32 THEN 'low_imbalance'
        WHEN s.overall_sum <= 63 THEN 'mild_imbalance'
        WHEN s.overall_sum <= 95 THEN 'moderate_imbalance'
        ELSE 'high_imbalance'
      END
    )
  )
FROM scored s
WHERE a.id = s.assessment_id
  AND a.assessment_kind = 'benchmark'
  AND a.status = 'completed';

-- Align saved report zone scores with migrated assessment aggregates (reports UNIQUE per assessment).
UPDATE public.reports r
SET
  imbalance_score = NULLIF(trim(a.score_data #>> '{zones,balance,sum}'), '')::integer,
  blossom_zone_emotional = NULLIF(trim(a.score_data #>> '{zones,blossom,sum}'), '')::integer,
  bliss_zone_spiritual = NULLIF(trim(a.score_data #>> '{zones,bliss,sum}'), '')::integer
FROM public.assessments a
WHERE r.assessment_id = a.id
  AND a.assessment_kind = 'benchmark'
  AND a.score_data IS NOT NULL
  AND jsonb_typeof(a.score_data -> 'zones') = 'object';
