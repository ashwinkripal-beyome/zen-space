import { isObservationSuperseded } from '@/data/therapistObservationOptions'
import { supabase } from '@/lib/supabase'

export type PendingSupervisedForTherapist = {
  assessmentId: string
  clientId: string
  completedAt: string
}

function assessmentHasLinkedReport(row: { reports: unknown }): boolean {
  const r = row.reports
  if (!r) return false
  if (Array.isArray(r)) return r.length > 0 && Boolean((r[0] as { id?: string })?.id)
  return Boolean((r as { id?: string }).id)
}

/**
 * Latest completed supervised assessment per linked client that still needs a Zen Plan report
 * (no superseded marker, no reports row). Aligns with observations page and DB supersede trigger.
 */
export async function fetchTherapistPendingSupervisedAssessments(
  therapistId: string
): Promise<PendingSupervisedForTherapist[]> {
  const { data: links } = await supabase
    .from('therapist_clients')
    .select('client_id')
    .eq('therapist_id', therapistId)

  const clientIds = (links ?? []).map(l => l.client_id as string)
  if (clientIds.length === 0) return []

  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, client_id, completed_at, therapist_observations, reports ( id )')
    .in('client_id', clientIds)
    .eq('status', 'completed')
    .eq('assessment_mode', 'supervised')
    .order('completed_at', { ascending: false })

  const candidates = (assessments ?? []).filter(a => {
    if (isObservationSuperseded(a.therapist_observations)) return false
    if (assessmentHasLinkedReport(a)) return false
    return true
  })

  const byClient = new Map<string, (typeof candidates)[number]>()
  for (const a of candidates) {
    const cid = String(a.client_id)
    if (byClient.has(cid)) continue
    byClient.set(cid, a)
  }

  return Array.from(byClient.values()).map(a => ({
    assessmentId: String(a.id),
    clientId: String(a.client_id),
    completedAt: String(a.completed_at ?? a.id),
  }))
}
