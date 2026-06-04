/** Snapshot of a report row used to decide if report/plan regeneration is needed. */
export type ReportHealthInput = {
  id?: string | null
  report_section?: string | null
  content?: string | null
  final_narrative_section?: string | null
  finalNarrativeSection?: string | null
  plan_section?: string | null
  report_client_info?: string | null
  report_key_concerns?: string | null
  report_current_state?: string | null
  report_balance_zone?: string | null
  report_blossom_zone?: string | null
  report_bliss_zone?: string | null
  report_integrated_interpretation?: string | null
}

export type ZenGenerationHealth = {
  assessmentId: string | null
  assessmentMode: 'self' | 'supervised' | null
  reportId: string | null
  needsReportRegeneration: boolean
  needsPlanRegeneration: boolean
  issues: string[]
  canRegenerate: boolean
}

const REPORT_SUB_COLUMNS: (keyof ReportHealthInput)[] = [
  'report_client_info',
  'report_key_concerns',
  'report_current_state',
  'report_balance_zone',
  'report_blossom_zone',
  'report_bliss_zone',
  'report_integrated_interpretation',
]

function hasReportBody(row: ReportHealthInput | null): boolean {
  if (!row) return false
  return Boolean((row.report_section || row.content || '').trim())
}

function reportSubsectionsPartial(row: ReportHealthInput): boolean {
  const filled = REPORT_SUB_COLUMNS.filter(k => {
    const v = row[k]
    return typeof v === 'string' && v.trim().length > 0
  }).length
  return filled > 0 && filled < REPORT_SUB_COLUMNS.length
}

function planLooksMissing(row: ReportHealthInput | null): boolean {
  if (!row) return true
  const plan = (row.plan_section || '').trim()
  return plan.length < 200
}

/**
 * Assess whether a client's latest report/plan need regeneration (therapist repair flow).
 */
export function assessZenGenerationHealth(params: {
  assessmentId: string | null
  assessmentMode: 'self' | 'supervised' | null
  report: ReportHealthInput | null
  /** When true, client is paid / pro and may need an 18-week plan on self reports. */
  expectPlanForSelfReport?: boolean
}): ZenGenerationHealth {
  const { assessmentId, assessmentMode, report, expectPlanForSelfReport = false } = params
  const issues: string[] = []

  if (!assessmentId) {
    return {
      assessmentId: null,
      assessmentMode,
      reportId: report?.id ?? null,
      needsReportRegeneration: false,
      needsPlanRegeneration: false,
      issues: ['No completed assessment'],
      canRegenerate: false,
    }
  }

  if (!report || !hasReportBody(report)) {
    issues.push('Report body missing')
  } else if (reportSubsectionsPartial(report) && !(report.report_section || '').trim()) {
    issues.push('Report subsections partially saved')
  } else if (reportSubsectionsPartial(report)) {
    issues.push('Report may be from a failed plan run (partial columns)')
  }

  const needsReportRegeneration = !hasReportBody(report)

  const needsPlanRegeneration =
    expectPlanForSelfReport &&
    assessmentMode === 'self' &&
    hasReportBody(report) &&
    planLooksMissing(report)

  if (needsPlanRegeneration) {
    issues.push('18-week plan missing or incomplete')
  }

  const canRegenerate =
    Boolean(assessmentId) &&
    (needsReportRegeneration || needsPlanRegeneration) &&
    assessmentMode === 'self'

  return {
    assessmentId,
    assessmentMode,
    reportId: report?.id ?? null,
    needsReportRegeneration,
    needsPlanRegeneration,
    issues,
    canRegenerate,
  }
}
