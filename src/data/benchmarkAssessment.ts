import { benchmarkPointsForTotals, parseBenchmarkAnswerValue } from '@/lib/benchmarkScoreUtils'

export type BenchmarkSection = 'Balance' | 'Blossom' | 'Bliss'

export {
  BENCHMARK_OVERALL_MAX_SCORE,
  BENCHMARK_ZONE_MAX_SCORE,
  benchmarkPointsForTotals,
  normalizeLegacyBenchmarkValue,
} from '@/lib/benchmarkScoreUtils'

export type ZoneBand = 'low_imbalance' | 'mild_imbalance' | 'moderate_imbalance' | 'high_imbalance'

export interface BenchmarkQuestion {
  id: string
  section: BenchmarkSection
  category: string
  text: string
}

/** Stored digit: 0 = not true, 1 = a little true, 2 = mostly true, 3 = completely true */
export type AnswerValue = 0 | 1 | 2 | 3

export function formatBenchmarkAnswerLabel(a: {
  value: number
  skipped: boolean
} | null | undefined): string {
  if (!a) return 'Not answered'
  const display = benchmarkPointsForTotals(a.value)
  switch (display) {
    case 0:
      return 'Not True'
    case 1:
      return 'A Little True'
    case 2:
      return 'Mostly True'
    case 3:
      return 'Completely True'
    default:
      return 'Not answered'
  }
}

/** e.g. "2 - Mostly True", or "— - Not answered" when missing. */
export function formatBenchmarkAnswerWithScore(
  row: { answer_value: string | null | undefined; skipped: boolean | null | undefined } | null | undefined
): string {
  if (!row) return '— - Not answered'
  const parsed =
    row.answer_value != null && row.answer_value !== ''
      ? parseBenchmarkAnswerValue(row.answer_value)
      : null
  const display = parsed != null ? benchmarkPointsForTotals(parsed) : null
  const label = formatBenchmarkAnswerLabel(
    display != null ? { value: display, skipped: false } : null
  )
  const num = display != null ? String(display) : '—'
  return `${num} - ${label}`
}

/** Display title for the in-app benchmark flow (header, review, etc.). */
export const BENCHMARK_ASSESSMENT_TITLE = 'Benchmark'

export const BENCHMARK_QUESTIONS: BenchmarkQuestion[] = [
  // Balance Zone (14)
  {
    id: 'benchmark-balance-01',
    section: 'Balance',
    category: 'Nervous System Dysregulation',
    text: 'My mind often feels tense or unsafe',
  },
  {
    id: 'benchmark-balance-02',
    section: 'Balance',
    category: 'Nervous System Dysregulation',
    text: 'I find it difficult to recover after conflicts or difficult moments',
  },
  {
    id: 'benchmark-balance-03',
    section: 'Balance',
    category: 'Nervous System Dysregulation',
    text: 'I have difficulty falling asleep or staying asleep',
  },
  {
    id: 'benchmark-balance-04',
    section: 'Balance',
    category: 'Stress, Anxiety & Overthinking',
    text: 'My mind feels constantly chaotic, active or overthinking',
  },
  {
    id: 'benchmark-balance-05',
    section: 'Balance',
    category: 'Stress, Anxiety & Overthinking',
    text: 'I worry excessively about the future or past',
  },
  {
    id: 'benchmark-balance-06',
    section: 'Balance',
    category: 'Stress, Anxiety & Overthinking',
    text: 'I feel mentally heavy or burnt out',
  },
  {
    id: 'benchmark-balance-07',
    section: 'Balance',
    category: 'Body Awareness & Energy',
    text: 'My body often feels stiff, unrested & I experience body pain',
  },
  {
    id: 'benchmark-balance-08',
    section: 'Balance',
    category: 'Body Awareness & Energy',
    text: 'I experience digestive discomfort (gas, bloating, acidity, constipation, IBS)',
  },
  {
    id: 'benchmark-balance-09',
    section: 'Balance',
    category: 'Body Awareness & Energy',
    text: 'I experience low energy, tiredness, or heaviness during the day',
  },
  {
    id: 'benchmark-balance-10',
    section: 'Balance',
    category: 'Focus, Clarity & Productivity',
    text: 'I struggle to focus on tasks',
  },
  {
    id: 'benchmark-balance-11',
    section: 'Balance',
    category: 'Focus, Clarity & Productivity',
    text: 'My thoughts feel scattered or foggy',
  },
  {
    id: 'benchmark-balance-12',
    section: 'Balance',
    category: 'Focus, Clarity & Productivity',
    text: 'I doubt my decisions often & I feel overwhelmed by responsibilities',
  },
  {
    id: 'benchmark-balance-13',
    section: 'Balance',
    category: 'Wealth & Mind',
    text: 'When I think about money or financial responsibilities, I feel physical tension, anxiety, or restlessness in my body.',
  },
  {
    id: 'benchmark-balance-14',
    section: 'Balance',
    category: 'Wealth & Mind',
    text: 'Thoughts about money often make my mind feel busy, stressed, or difficult to calm down.',
  },
  // Blossom Zone (14)
  {
    id: 'benchmark-blossom-01',
    section: 'Blossom',
    category: 'Emotional Awareness & Understanding',
    text: 'I always find it difficult to identify what I am feeling & why I feel the way I feel',
  },
  {
    id: 'benchmark-blossom-02',
    section: 'Blossom',
    category: 'Emotional Awareness & Understanding',
    text: 'I avoid sitting with difficult emotions & conversations',
  },
  {
    id: 'benchmark-blossom-03',
    section: 'Blossom',
    category: 'Emotional Awareness & Understanding',
    text: 'I feel emotionally numb or disconnected from my feelings',
  },
  {
    id: 'benchmark-blossom-04',
    section: 'Blossom',
    category: 'Emotional Expression & Channelising',
    text: 'I bottle up emotions until they explode',
  },
  {
    id: 'benchmark-blossom-05',
    section: 'Blossom',
    category: 'Emotional Expression & Channelising',
    text: 'I feel emotionally overwhelmed easily',
  },
  {
    id: 'benchmark-blossom-06',
    section: 'Blossom',
    category: 'Emotional Expression & Channelising',
    text: 'I struggle to express my emotions freely without inhibitions',
  },
  {
    id: 'benchmark-blossom-07',
    section: 'Blossom',
    category: 'Self-Acceptance & Compassion',
    text: 'I am harsh or critical toward myself & find it difficult to love & appreciate myself',
  },
  {
    id: 'benchmark-blossom-08',
    section: 'Blossom',
    category: 'Self-Acceptance & Compassion',
    text: 'I blame myself for past mistakes & I struggle to forgive myself',
  },
  {
    id: 'benchmark-blossom-09',
    section: 'Blossom',
    category: 'Self-Acceptance & Compassion',
    text: 'I feel I do not give myself enough care, time, rest or emotional support',
  },
  {
    id: 'benchmark-blossom-10',
    section: 'Blossom',
    category: 'Self-Love & Boundaries',
    text: 'I find it difficult to be kind or gentle with myself',
  },
  {
    id: 'benchmark-blossom-11',
    section: 'Blossom',
    category: 'Self-Love & Boundaries',
    text: "I struggle to say no without guilt & I put others' needs before my own",
  },
  {
    id: 'benchmark-blossom-12',
    section: 'Blossom',
    category: 'Self-Love & Boundaries',
    text: 'I feel unworthy in most areas of my life',
  },
  {
    id: 'benchmark-blossom-13',
    section: 'Blossom',
    category: 'Wealth & emotions',
    text: 'I often feel that I must work very hard or sacrifice myself in order to feel financially secure.',
  },
  {
    id: 'benchmark-blossom-14',
    section: 'Blossom',
    category: 'Wealth & emotions',
    text: 'Even when I earn or receive money, I sometimes feel worried about losing it or not having enough in the future',
  },
  // Bliss Zone (14)
  {
    id: 'benchmark-bliss-01',
    section: 'Bliss',
    category: 'Inner Stillness & Presence',
    text: 'I lack inner peace & feel restless even when nothing is happening',
  },
  {
    id: 'benchmark-bliss-02',
    section: 'Bliss',
    category: 'Inner Stillness & Presence',
    text: 'Silence or quiet moments make me uncomfortable',
  },
  {
    id: 'benchmark-bliss-03',
    section: 'Bliss',
    category: 'Inner Stillness & Presence',
    text: 'I feel disconnected from the present moment',
  },
  {
    id: 'benchmark-bliss-04',
    section: 'Bliss',
    category: 'Intuition & Inner Guidance',
    text: 'I doubt my intuition and inner voice, I need reassurance from others to feel confident in my choices',
  },
  {
    id: 'benchmark-bliss-05',
    section: 'Bliss',
    category: 'Intuition & Inner Guidance',
    text: 'I struggle to let go of control and surrender to the flow',
  },
  {
    id: 'benchmark-bliss-06',
    section: 'Bliss',
    category: 'Intuition & Inner Guidance',
    text: 'I rely more on logic & fact than my gut feeling',
  },
  {
    id: 'benchmark-bliss-07',
    section: 'Bliss',
    category: 'Purpose & Meaning',
    text: 'I feel confused about what truly matters to me in life',
  },
  {
    id: 'benchmark-bliss-08',
    section: 'Bliss',
    category: 'Purpose & Meaning',
    text: 'I question the meaning of life',
  },
  {
    id: 'benchmark-bliss-09',
    section: 'Bliss',
    category: 'Purpose & Meaning',
    text: 'I feel unfulfilled even after achieving what I want to achieve',
  },
  {
    id: 'benchmark-bliss-10',
    section: 'Bliss',
    category: 'Transcendence & Soul Connection',
    text: 'I feel disconnected from myself at a deeper level',
  },
  {
    id: 'benchmark-bliss-11',
    section: 'Bliss',
    category: 'Transcendence & Soul Connection',
    text: 'I struggle to relax and let things unfold',
  },
  {
    id: 'benchmark-bliss-12',
    section: 'Bliss',
    category: 'Transcendence & Soul Connection',
    text: 'I rarely feel gratitude, awe, or a sense of connection with this life or universe beyond daily occurrences',
  },
  {
    id: 'benchmark-bliss-13',
    section: 'Bliss',
    category: 'Wealth & Purpose',
    text: "I don't feel confident that money will flow into my life in a stable and supportive way",
  },
  {
    id: 'benchmark-bliss-14',
    section: 'Bliss',
    category: 'Wealth & Purpose',
    text: 'I find it hard to believe I deserve financial abundance while living a balanced and fulfilling life',
  },
]

export const BENCHMARK_TOTAL_QUESTIONS = BENCHMARK_QUESTIONS.length

export function zoneBand(score: number): ZoneBand {
  if (score <= 11) return 'low_imbalance'
  if (score <= 21) return 'mild_imbalance'
  if (score <= 31) return 'moderate_imbalance'
  return 'high_imbalance'
}

export function overallBand(score: number): ZoneBand {
  if (score <= 32) return 'low_imbalance'
  if (score <= 63) return 'mild_imbalance'
  if (score <= 95) return 'moderate_imbalance'
  return 'high_imbalance'
}

export interface BenchmarkScoreResult {
  balance: { sum: number; band: ZoneBand }
  blossom: { sum: number; band: ZoneBand }
  bliss: { sum: number; band: ZoneBand }
  overall: { sum: number; band: ZoneBand }
}

/** Values keyed by question id; missing keys treated as 0 for scoring (should not happen at submit). */
export function computeBenchmarkScores(valuesByQuestionId: Record<string, number>): BenchmarkScoreResult {
  let balance = 0
  let blossom = 0
  let bliss = 0
  for (const q of BENCHMARK_QUESTIONS) {
    const v = valuesByQuestionId[q.id]
    const n = typeof v === 'number' ? benchmarkPointsForTotals(v) : 0
    if (q.section === 'Balance') balance += n
    else if (q.section === 'Blossom') blossom += n
    else bliss += n
  }
  const overall = balance + blossom + bliss
  return {
    balance: { sum: balance, band: zoneBand(balance) },
    blossom: { sum: blossom, band: zoneBand(blossom) },
    bliss: { sum: bliss, band: zoneBand(bliss) },
    overall: { sum: overall, band: overallBand(overall) },
  }
}
