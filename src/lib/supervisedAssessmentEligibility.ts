import { parsePlanPhases } from '@/lib/parsePlanDays'
import { normalizeCompletedDays } from '@/lib/reportPlanProgress'

/** Minimum calendar time after the plan report exists before a new supervised assessment is allowed (16 weeks). */
export const SUPERVISED_REASSESSMENT_MIN_WEEK_MS = 16 * 7 * 24 * 60 * 60 * 1000

export type SupervisedBlockedReason = 'not_paid' | 'no_plan' | 'plan_incomplete' | 'min_weeks'

export function planWeekNumbersFromPlanHtml(html: string): number[] {
  const phases = parsePlanPhases(html)
  const days = phases.flatMap(p => p.days)
  const seen = new Set<number>()
  for (const d of days) {
    if (!seen.has(d.day)) seen.add(d.day)
  }
  return [...seen].sort((a, b) => a - b)
}

export function isEveryPlanWeekMarkedComplete(planHtml: string, completedRaw: unknown): boolean {
  const weeks = planWeekNumbersFromPlanHtml(planHtml)
  if (weeks.length === 0) return false
  const completed = normalizeCompletedDays(completedRaw)
  return weeks.every(w => completed.includes(w))
}

export function minWeeksElapsedSincePlanReport(isoOrDate: string | Date, now = Date.now()): boolean {
  const start = typeof isoOrDate === 'string' ? new Date(isoOrDate).getTime() : isoOrDate.getTime()
  return now - start >= SUPERVISED_REASSESSMENT_MIN_WEEK_MS
}

export function dateWhenMinWeeksMetForPlanReport(isoOrDate: string | Date): Date {
  const start = typeof isoOrDate === 'string' ? new Date(isoOrDate).getTime() : isoOrDate.getTime()
  return new Date(start + SUPERVISED_REASSESSMENT_MIN_WEEK_MS)
}

export type SupervisedEligibilityInput = {
  /** At least one linked therapist must have marked this client as a paid customer. */
  isPaidCustomer: boolean
  supervisedCompletedAt: string | null | undefined
  /** Latest supervised override for the client (any therapist). */
  supervisedOverrideCreatedAt: string | null | undefined
  /** Latest report by `created_at` (same source as client plan dashboard). */
  latestReportId: string | null | undefined
  latestReportCreatedAt: string | null | undefined
  planSectionHtml: string | null | undefined
  /** `completed_days` from report_plan_progress for latestReportId, or legacy-normalized array. */
  planCompletedDays: unknown
}

export type SupervisedEligibility = {
  available: boolean
  nextDate: Date | null
  blockedReason: SupervisedBlockedReason | null
}

export function computeSupervisedAssessmentEligibility(input: SupervisedEligibilityInput): SupervisedEligibility {
  if (!input.isPaidCustomer) {
    return { available: false, nextDate: null, blockedReason: 'not_paid' }
  }

  const completedAt = input.supervisedCompletedAt
  if (!completedAt) {
    return { available: true, nextDate: null, blockedReason: null }
  }

  const completedTime = new Date(completedAt).getTime()
  if (input.supervisedOverrideCreatedAt) {
    const o = new Date(input.supervisedOverrideCreatedAt).getTime()
    if (o > completedTime) {
      return { available: true, nextDate: null, blockedReason: null }
    }
  }

  const planHtml = (input.planSectionHtml || '').trim()
  const reportCreated = input.latestReportCreatedAt
  if (!input.latestReportId || !planHtml || !reportCreated) {
    return { available: false, nextDate: null, blockedReason: 'no_plan' }
  }

  if (!isEveryPlanWeekMarkedComplete(planHtml, input.planCompletedDays)) {
    return { available: false, nextDate: null, blockedReason: 'plan_incomplete' }
  }

  if (!minWeeksElapsedSincePlanReport(reportCreated)) {
    return {
      available: false,
      nextDate: dateWhenMinWeeksMetForPlanReport(reportCreated),
      blockedReason: 'min_weeks',
    }
  }

  return { available: true, nextDate: null, blockedReason: null }
}

export function therapistSupervisedCooldownLabel(e: SupervisedEligibility): string {
  if (e.available) return 'Available on the client app'
  if (e.blockedReason === 'not_paid')
    return 'Waiting — a linked therapist must mark this client as a paid customer (shared for all links)'
  if (e.blockedReason === 'no_plan') return 'Waiting — client needs an 18-week plan on their latest report'
  if (e.blockedReason === 'plan_incomplete')
    return 'Waiting — client must mark every week complete on the current plan'
  if (e.blockedReason === 'min_weeks' && e.nextDate) {
    return `On gate until ${e.nextDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} (16 weeks after plan report)`
  }
  return 'Not available yet'
}
