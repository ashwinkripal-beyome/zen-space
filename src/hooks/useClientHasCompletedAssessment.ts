import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

/** True if the client has at least one completed assessment (any mode). */
export function useClientHasCompletedAssessment() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hasCompletedAssessment, setHasCompletedAssessment] = useState(false)

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      setHasCompletedAssessment(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('assessments')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[assessments completed check]', error)
      setHasCompletedAssessment(false)
    } else {
      setHasCompletedAssessment(data != null)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { loading, hasCompletedAssessment, refetch }
}
