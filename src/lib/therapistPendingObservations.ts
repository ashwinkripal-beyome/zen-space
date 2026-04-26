import { isObservationSuperseded } from '@/data/therapistObservationOptions'
import { supabase } from '@/lib/supabase'
import { formatClientDisplayName } from '@/lib/clientDisplayName'

export type PendingSupervisedForTherapist = {
  assessmentId: string
  clientId: string
  completedAt: string
}

export type SelfLeadForTherapist = {
  kind: 'self_lead'
  assessmentId: string
  clientId: string
  completedAt: string
  clientName: string
  email: string | null
  phone: string | null
  reportId: string | null
}

export type PendingSupervisedForTherapistItem = PendingSupervisedForTherapist & { kind: 'supervised' }

export type TherapistPendingItem = PendingSupervisedForTherapistItem | SelfLeadForTherapist

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

type SelfLeadRpcRow = {
  assessment_id: string
  client_id: string
  completed_at: string | null
  email: string | null
  name: string | null
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  report_id?: string | null
}

function parseCompletedAt(iso: string | null | undefined, fallback: string): string {
  if (iso && String(iso).trim() !== '') return String(iso)
  return fallback
}

/**
 * Supervised (linked clients needing observations) plus self-assessment leads (no linked therapist yet).
 * Sorted by completed_at descending (best-effort for ISO strings).
 */
export async function fetchTherapistAllPending(therapistId: string): Promise<TherapistPendingItem[]> {
  const [supervised, selfRpc] = await Promise.all([
    fetchTherapistPendingSupervisedAssessments(therapistId),
    supabase.rpc('get_unlinked_self_assessment_leads_for_therapist'),
  ])

  const selfRows = (selfRpc.data ?? []) as SelfLeadRpcRow[]
  if (selfRpc.error) {
    console.error('[get_unlinked_self_assessment_leads_for_therapist]', selfRpc.error)
  }

  const supervisedItems: PendingSupervisedForTherapistItem[] = supervised.map(s => ({
    kind: 'supervised',
    assessmentId: s.assessmentId,
    clientId: s.clientId,
    completedAt: s.completedAt,
  }))

  const selfItems: SelfLeadForTherapist[] = (selfRpc.error ? [] : selfRows).map(row => {
    const name = formatClientDisplayName({
      name: row.name,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
    })
    return {
      kind: 'self_lead' as const,
      assessmentId: String(row.assessment_id),
      clientId: String(row.client_id),
      completedAt: parseCompletedAt(row.completed_at, String(row.assessment_id)),
      clientName: name,
      email: row.email,
      phone: row.phone_number,
      reportId: row.report_id != null && row.report_id !== '' ? String(row.report_id) : null,
    }
  })

  return [...selfItems, ...supervisedItems].sort((a, b) => {
    const ta = new Date(a.completedAt).getTime()
    const tb = new Date(b.completedAt).getTime()
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta
    return 0
  })
}

export async function claimUnlinkedSelfLead(clientId: string) {
  return supabase.rpc('claim_unlinked_self_lead', { p_client_id: clientId })
}

export type TherapistPendingDisplayRow = {
  kind: 'self_lead' | 'supervised'
  assessmentId: string
  clientId: string
  clientName: string
  completedAt: string
  email: string | null
  phone: string | null
  reportId: string | null
}

/** Resolves display names for supervised items; self-lead rows already include contact fields from RPC. */
export async function fetchTherapistPendingDisplayRows(therapistId: string): Promise<TherapistPendingDisplayRow[]> {
  const pending = await fetchTherapistAllPending(therapistId)
  const supervisedClientIds = [
    ...new Set(pending.filter((p): p is PendingSupervisedForTherapistItem => p.kind === 'supervised').map(p => p.clientId)),
  ]

  const byId = new Map<string, { id: string; email?: string | null; name?: string | null; first_name?: string | null; last_name?: string | null }>()
  if (supervisedClientIds.length > 0) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, name, first_name, last_name')
      .in('id', supervisedClientIds)
    if (error) {
      console.error('[profiles for therapist pending]', error)
    }
    for (const p of profiles ?? []) {
      byId.set(p.id, p)
    }
  }

  return pending.map(p => {
    if (p.kind === 'self_lead') {
      return {
        kind: 'self_lead',
        assessmentId: p.assessmentId,
        clientId: p.clientId,
        clientName: p.clientName,
        completedAt: p.completedAt,
        email: p.email,
        phone: p.phone,
        reportId: p.reportId,
      }
    }
    return {
      kind: 'supervised',
      assessmentId: p.assessmentId,
      clientId: p.clientId,
      clientName: formatClientDisplayName(byId.get(p.clientId) ?? undefined),
      completedAt: p.completedAt,
      email: null,
      phone: null,
      reportId: null,
    }
  })
}
