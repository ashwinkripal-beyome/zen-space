import { supabase } from '@/lib/supabase'

/**
 * Find the latest report (any assessment mode) for the client that has no
 * 18-week plan yet. Returns the assessment_id of that report, or null.
 */
async function fetchLatestAssessmentNeedingPlan(clientId: string): Promise<string | null> {
  const { data: reports } = await supabase
    .from('reports')
    .select('assessment_id, plan_section')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!reports?.length) return null

  for (const r of reports) {
    const plan = (r.plan_section as string) || ''
    if (!plan.trim() || plan.trim().length < 200) {
      return r.assessment_id as string
    }
  }
  return null
}

export type GenerateClientPlanResult = { ok: true } | { ok: false; error: string }

/**
 * After successful payment, trigger 18-week plan generation for the client's
 * latest report (any assessment mode). The edge function allows client-initiated
 * calls when the client is paid.
 */
export async function generateClientPlanAfterPayment(
  clientId: string,
  onStatus?: (msg: string) => void
): Promise<GenerateClientPlanResult> {
  onStatus?.('Finding your assessment…')
  const assessmentId = await fetchLatestAssessmentNeedingPlan(clientId)

  if (!assessmentId) {
    return { ok: false, error: 'No completed assessment report found needing a plan.' }
  }

  onStatus?.('Generating your 18-week plan… (this may take 3–5 minutes)')

  const { data, error } = await supabase.functions.invoke('generate-zen-plan', {
    body: {
      assessment_id: assessmentId,
      force: false,
      client_initiated: true,
    },
  })

  if (error) {
    const msg = (error as { message?: string })?.message ?? 'Plan generation failed'
    return { ok: false, error: msg }
  }

  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as Record<string, unknown>).error) }
  }

  return { ok: true }
}
