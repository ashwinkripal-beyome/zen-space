/** Aligns with supabase/functions/_shared/zenReportPrompt.ts and src/data/benchmarkAssessment.ts */

import { BENCHMARK_OVERALL_MAX_SCORE, BENCHMARK_ZONE_MAX_SCORE } from '@/lib/benchmarkScoreUtils'

export type ImbalanceTier = 'low' | 'mild' | 'moderate' | 'high'

/** Wellness meter tint: matches zone/overall imbalance bands when `max` is zone (42) or overall (126). */
export function imbalanceTier(score: number, max: number): ImbalanceTier {
  if (max <= 0 || !Number.isFinite(score)) return 'low'
  if (max === BENCHMARK_ZONE_MAX_SCORE) {
    if (score <= 11) return 'low'
    if (score <= 21) return 'mild'
    if (score <= 31) return 'moderate'
    return 'high'
  }
  if (max === BENCHMARK_OVERALL_MAX_SCORE) {
    if (score <= 32) return 'low'
    if (score <= 63) return 'mild'
    if (score <= 95) return 'moderate'
    return 'high'
  }
  const q = max / 4
  if (score <= q) return 'low'
  if (score <= 2 * q) return 'mild'
  if (score <= 3 * q) return 'moderate'
  return 'high'
}

export function overallStatusLabel(score: number): string {
  if (score <= 32) return 'No Imbalance'
  if (score <= 63) return 'Mild Imbalance'
  if (score <= 95) return 'Moderate Imbalance'
  return 'High Imbalance'
}

export function zoneStatusLabel(score: number): string {
  if (score <= 11) return 'No Imbalance'
  if (score <= 21) return 'Mild Imbalance'
  if (score <= 31) return 'Moderate Imbalance'
  return 'High Imbalance'
}
