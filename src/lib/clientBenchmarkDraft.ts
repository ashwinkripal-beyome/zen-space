import { benchmarkPointsForTotals, parseBenchmarkAnswerValue } from '@/lib/benchmarkScoreUtils'
import { supabase } from '@/lib/supabase'

export type BenchmarkDraftAnswer = {
  value: number
  swipe_direction: string
  skipped: boolean
}

export { parseBenchmarkAnswerValue } from '@/lib/benchmarkScoreUtils'

/** Read-only: existing draft benchmark + answers (no insert). */
export async function fetchClientBenchmarkDraftForReview(
  clientId: string,
  assessmentMode: 'supervised' | 'self' = 'supervised'
): Promise<{
  assessmentId: string
  answers: Record<string, BenchmarkDraftAnswer>
} | null> {
  const { data: draft } = await supabase
    .from('assessments')
    .select('id')
    .eq('client_id', clientId)
    .eq('assessment_kind', 'benchmark')
    .eq('assessment_mode', assessmentMode)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const id = draft?.id
  if (!id) return null

  const { data: rows } = await supabase
    .from('assessment_answers')
    .select('question_id, answer_value, swipe_direction, skipped')
    .eq('assessment_id', id)

  const map: Record<string, BenchmarkDraftAnswer> = {}
  for (const row of rows ?? []) {
    const qid = row.question_id as string
    const v = parseBenchmarkAnswerValue(row.answer_value as string)
    if (v === null) continue
    map[qid] = {
      value: benchmarkPointsForTotals(v),
      swipe_direction: (row.swipe_direction as string) ?? '',
      skipped: false,
    }
  }

  return { assessmentId: id, answers: map }
}
