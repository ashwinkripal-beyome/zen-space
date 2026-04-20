import { supabase } from '@/lib/supabase'

const LEGACY_STORAGE_PREFIX = 'zen-plan-checklist:'

function legacyStorageKey(userId: string, reportId: string) {
  return `${LEGACY_STORAGE_PREFIX}${userId}:${reportId}`
}

function readLegacyCompleted(userId: string, reportId: string): number[] {
  try {
    const raw = localStorage.getItem(legacyStorageKey(userId, reportId))
    if (!raw) return []
    const o = JSON.parse(raw) as { completed?: unknown }
    if (!o || typeof o !== 'object' || !Array.isArray(o.completed)) return []
    return normalizeCompletedDays(o.completed)
  } catch {
    return []
  }
}

function clearLegacy(userId: string, reportId: string) {
  try {
    localStorage.removeItem(legacyStorageKey(userId, reportId))
  } catch {
    /* ignore */
  }
}

export function normalizeCompletedDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const nums = raw.filter(
    (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 18
  )
  return [...new Set(nums)].sort((a, b) => a - b)
}

/**
 * Load completed day numbers for a report. Migrates legacy localStorage into Postgres once when DB is empty.
 */
export async function fetchReportPlanProgress(
  clientId: string,
  reportId: string
): Promise<{ completed: number[] }> {
  const { data, error } = await supabase
    .from('report_plan_progress')
    .select('completed_days')
    .eq('client_id', clientId)
    .eq('report_id', reportId)
    .maybeSingle()

  if (error) throw error

  let completed = normalizeCompletedDays(data?.completed_days)

  if (completed.length === 0) {
    const legacy = readLegacyCompleted(clientId, reportId)
    if (legacy.length > 0) {
      await saveReportPlanProgress(clientId, reportId, legacy)
      clearLegacy(clientId, reportId)
      completed = legacy
    }
  }

  return { completed }
}

export async function saveReportPlanProgress(
  clientId: string,
  reportId: string,
  completed: number[]
): Promise<void> {
  const completed_days = normalizeCompletedDays(completed)
  const { error } = await supabase.from('report_plan_progress').upsert(
    {
      client_id: clientId,
      report_id: reportId,
      completed_days,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,report_id' }
  )
  if (error) throw error
}
