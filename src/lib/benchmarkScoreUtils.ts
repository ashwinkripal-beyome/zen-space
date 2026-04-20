/** Shared benchmark scoring primitives (no dependency on assessment question data). */

/** Max raw sum per zone (14 questions × 3). */
export const BENCHMARK_ZONE_MAX_SCORE = 42

/** Max overall sum (3 zones × 42). */
export const BENCHMARK_OVERALL_MAX_SCORE = 126

/**
 * Legacy 5-point scale (0–4) → current 4-point (0–3).
 * Used for DB migration and transforming historic rows.
 */
export function normalizeLegacyBenchmarkValue(v: number): number {
  if (!Number.isFinite(v)) return 0
  const i = Math.trunc(v)
  if (i <= 0) return 0
  if (i === 1) return 1
  if (i === 2) return 1
  if (i === 3) return 2
  return 3
}

/** Stored digits 0–3 (current); 4 accepted while legacy rows exist. */
export function parseBenchmarkAnswerValue(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 4) return null
  return n
}

/** Per-question points for totals; accepts 0–3, or legacy 4 (→3) until DB migration runs. */
export function benchmarkPointsForTotals(v: number): number {
  if (!Number.isFinite(v)) return 0
  const n = Math.round(v)
  if (n < 0) return 0
  if (n <= 3) return n
  if (n === 4) return 3
  return 3
}
