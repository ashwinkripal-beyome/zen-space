import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const FIVE_MIN_MS = 5 * 60 * 1000

/**
 * When enabled, refetches after Postgres changes to assessments, reports, or the therapist inbox
 * bump (any therapist link change) so all therapists’ pending counts stay in sync. Also polls occasionally.
 */
export function useTherapistPendingRealtime(
  userId: string | undefined,
  enabled: boolean,
  onRefetch: () => void,
  options?: { pollIntervalMs?: number; channelScope?: string }
) {
  const onRefetchRef = useRef(onRefetch)
  onRefetchRef.current = onRefetch
  const pollMs = options?.pollIntervalMs ?? FIVE_MIN_MS
  const channelScope = options?.channelScope ?? 'default'

  useEffect(() => {
    if (!userId || !enabled) return

    const tick = () => onRefetchRef.current()

    const channel = supabase
      .channel(`therapist-pending:${userId}:${channelScope}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assessments' },
        () => tick()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => tick()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'therapist_inbox_bump' },
        () => tick()
      )
      .subscribe()

    const interval = window.setInterval(() => tick(), pollMs)

    return () => {
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [userId, enabled, pollMs, channelScope])
}

export { FIVE_MIN_MS as THERAPIST_PENDING_POLL_MS }
