import type { SupabaseClient } from '@supabase/supabase-js'

/** Active 30-day plan: unlocks follow-up assessments (Benchmark always allowed). */
export async function hasActive30DaySubscription(
  supabase: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from('subscriptions')
    .select('start_date, end_date')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .eq('plan_name', '30-day')

  if (error || !rows?.length) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return rows.some(s => {
    if (s.end_date) {
      const end = new Date(s.end_date)
      end.setHours(0, 0, 0, 0)
      if (end < today) return false
    }
    if (s.start_date) {
      const start = new Date(s.start_date)
      start.setHours(0, 0, 0, 0)
      if (start > today) return false
    }
    return true
  })
}
