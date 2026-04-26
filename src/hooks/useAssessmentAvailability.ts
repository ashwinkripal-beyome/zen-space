import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  computeSupervisedAssessmentEligibility,
  type SupervisedBlockedReason,
} from '@/lib/supervisedAssessmentEligibility'

export type SelfUnavailableReason = 'already_completed' | 'supervised_first'

interface ModeStatus {
  available: boolean
  /** If gated, when supervised becomes available (min-weeks gate only). */
  nextDate: Date | null
  loading: boolean
  /** Self only: why the self assessment is not available (no cooldown for self). */
  selfUnavailableReason?: SelfUnavailableReason
  /** Supervised only: why reassessment is blocked when not available. */
  supervisedBlockedReason?: SupervisedBlockedReason
}

export interface AssessmentAvailability {
  self: ModeStatus
  supervised: ModeStatus
  /** True when the client profile is marked as a paid customer (required for supervised). */
  isPaidForSupervised: boolean
  loading: boolean
  refetch: () => void
}

export function useAssessmentAvailability(): AssessmentAvailability {
  const { user } = useAuth()
  const [selfStatus, setSelfStatus] = useState<ModeStatus>({ available: true, nextDate: null, loading: true })
  const [supervisedStatus, setSupervisedStatus] = useState<ModeStatus>({
    available: true,
    nextDate: null,
    loading: true,
  })
  const [isPaidForSupervised, setIsPaidForSupervised] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setIsPaidForSupervised(false)
      setLoading(false)
      return
    }
    setLoading(true)

    const [selfResult, supervisedResult, overridesResult, latestReportResult, clientProfileResult] =
      await Promise.all([
      supabase
        .from('assessments')
        .select('completed_at')
        .eq('client_id', user.id)
        .eq('assessment_mode', 'self')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('assessments')
        .select('completed_at')
        .eq('client_id', user.id)
        .eq('assessment_mode', 'supervised')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('assessment_overrides')
        .select('created_at')
        .eq('client_id', user.id)
        .eq('assessment_mode', 'supervised')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('reports')
        .select('id, created_at, plan_section')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('profiles').select('is_paid_customer').eq('id', user.id).maybeSingle(),
    ])

    const paid = (clientProfileResult.data as { is_paid_customer?: boolean } | null)?.is_paid_customer === true
    setIsPaidForSupervised(paid)

    const supervisedOverrideCreatedAt = overridesResult.data?.created_at ?? null
    const selfCompletedAt = selfResult.data?.completed_at
    const supervisedCompletedAt = supervisedResult.data?.completed_at

    let planCompletedDays: unknown = []
    const reportRow = latestReportResult.data as { id?: string; created_at?: string; plan_section?: string } | null
    const reportId = reportRow?.id
    if (reportId) {
      const prog = await supabase
        .from('report_plan_progress')
        .select('completed_days')
        .eq('client_id', user.id)
        .eq('report_id', reportId)
        .maybeSingle()
      planCompletedDays = prog.data?.completed_days ?? []
    }

    const elig = computeSupervisedAssessmentEligibility({
      isPaidCustomer: paid,
      supervisedCompletedAt,
      supervisedOverrideCreatedAt,
      latestReportId: reportId ?? null,
      latestReportCreatedAt: reportRow?.created_at ?? null,
      planSectionHtml: reportRow?.plan_section ?? null,
      planCompletedDays,
    })

    setSelfStatus(computeSelfStatus(selfCompletedAt, supervisedCompletedAt))
    setSupervisedStatus({
      available: elig.available,
      nextDate: elig.nextDate,
      loading: false,
      supervisedBlockedReason: elig.available ? undefined : elig.blockedReason ?? undefined,
    })
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return {
    self: selfStatus,
    supervised: supervisedStatus,
    isPaidForSupervised,
    loading,
    refetch: fetch,
  }
}

/** Self: once only; unavailable if any completed self or any completed supervised (supervised-first). No overrides. */
function computeSelfStatus(
  selfCompletedAt: string | null | undefined,
  supervisedCompletedAt: string | null | undefined
): ModeStatus {
  if (selfCompletedAt) {
    return {
      available: false,
      nextDate: null,
      loading: false,
      selfUnavailableReason: 'already_completed',
    }
  }
  if (supervisedCompletedAt) {
    return {
      available: false,
      nextDate: null,
      loading: false,
      selfUnavailableReason: 'supervised_first',
    }
  }
  return { available: true, nextDate: null, loading: false }
}
