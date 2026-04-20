import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const COOLDOWN_DAYS = 30

export type SelfUnavailableReason = 'already_completed' | 'supervised_first'

interface ModeStatus {
  available: boolean
  /** If on cooldown, the date when it becomes available again */
  nextDate: Date | null
  loading: boolean
  /** Self only: why the self assessment is not available (no cooldown for self). */
  selfUnavailableReason?: SelfUnavailableReason
}

export interface AssessmentAvailability {
  self: ModeStatus
  supervised: ModeStatus
  loading: boolean
  refetch: () => void
}

export function useAssessmentAvailability(): AssessmentAvailability {
  const { user } = useAuth()
  const [selfStatus, setSelfStatus] = useState<ModeStatus>({ available: true, nextDate: null, loading: true })
  const [supervisedStatus, setSupervisedStatus] = useState<ModeStatus>({ available: true, nextDate: null, loading: true })
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)

    const [selfResult, supervisedResult, overridesResult] = await Promise.all([
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
    ])

    const supervisedOverrideCreatedAt = overridesResult.data?.created_at

    const selfCompletedAt = selfResult.data?.completed_at
    const supervisedCompletedAt = supervisedResult.data?.completed_at

    setSelfStatus(computeSelfStatus(selfCompletedAt, supervisedCompletedAt))
    setSupervisedStatus(computeStatus(supervisedCompletedAt, supervisedOverrideCreatedAt))
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return {
    self: selfStatus,
    supervised: supervisedStatus,
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

function computeStatus(
  completedAt: string | null | undefined,
  overrideCreatedAt: string | null | undefined
): ModeStatus {
  if (!completedAt) {
    return { available: true, nextDate: null, loading: false }
  }

  const completed = new Date(completedAt)
  const nextDate = new Date(completed.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()

  if (now >= nextDate) {
    return { available: true, nextDate: null, loading: false }
  }

  if (overrideCreatedAt) {
    const override = new Date(overrideCreatedAt)
    if (override > completed) {
      return { available: true, nextDate: null, loading: false }
    }
  }

  return { available: false, nextDate, loading: false }
}
