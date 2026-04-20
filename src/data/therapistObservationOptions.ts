export type TherapistObservationCategoryKey =
  | 'personality_traits'
  | 'behavioral_patterns'
  | 'emotional_patterns'
  | 'life_context'
  | 'physical_symptoms'
  | 'social_patterns'
  | 'strengths'

export type TherapistObservations = Partial<Record<TherapistObservationCategoryKey, string[]>>

export const THERAPIST_OBSERVATION_CATEGORIES: {
  key: TherapistObservationCategoryKey
  label: string
  options: string[]
}[] = [
  {
    key: 'personality_traits',
    label: 'Personality traits',
    options: [
      'Logical',
      'Emotional',
      'Avoidant',
      'Expressive',
      'Analytical',
      'Intuitive',
      'Reserved',
      'Outgoing',
      'Perfectionistic',
      'Easygoing',
    ],
  },
  {
    key: 'behavioral_patterns',
    label: 'Behavioral patterns',
    options: [
      'Overthinking',
      'Distraction',
      'Shutdown',
      'People-pleasing',
      'Procrastination',
      'Hyper-productivity',
      'Conflict avoidance',
      'Impulsivity',
      'Rumination',
      'Withdrawal',
    ],
  },
  {
    key: 'emotional_patterns',
    label: 'Emotional patterns',
    options: [
      'Suppression',
      'Reactivity',
      'Numbness',
      'Anxiety spikes',
      'Low mood',
      'Guilt-heavy',
      'Shame-heavy',
      'Emotional flooding',
      'Difficulty naming feelings',
    ],
  },
  {
    key: 'life_context',
    label: 'Life context',
    options: [
      'Work stress',
      'Childhood history',
      'Relationship strain',
      'Family pressure',
      'Financial stress',
      'Major life transition',
      'Grief or loss',
      'Caregiving load',
      'Isolation',
      'Burnout',
    ],
  },
  {
    key: 'physical_symptoms',
    label: 'Physical symptoms',
    options: [
      'Gut issues',
      'Headaches',
      'Fatigue',
      'Tension / pain',
      'Sleep disruption',
      'Low appetite',
      'Hyperarousal in body',
      'Shallow breathing',
    ],
  },
  {
    key: 'social_patterns',
    label: 'Social patterns',
    options: [
      'Introverted',
      'Struggles socially',
      'People-pleasing',
      'Boundary challenges',
      'Conflict with peers',
      'Over-giving',
      'Fear of judgment',
      'Prefer small circles',
    ],
  },
  {
    key: 'strengths',
    label: 'Strengths',
    options: [
      'Self-aware',
      'Positive outlook',
      'Disciplined',
      'Curious',
      'Resilient',
      'Empathetic',
      'Open to growth',
      'Asks for help when safe',
    ],
  },
]

export function emptyObservations(): TherapistObservations {
  return {}
}

export function normalizeObservations(raw: unknown): TherapistObservations {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: TherapistObservations = {}
  for (const { key } of THERAPIST_OBSERVATION_CATEGORIES) {
    const v = o[key]
    if (Array.isArray(v)) {
      out[key] = v.filter((x): x is string => typeof x === 'string')
    }
  }
  return out
}

/** Set by DB when a newer supervised assessment supersedes older ones without a report. */
export function isObservationSuperseded(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const v = (raw as Record<string, unknown>)['_observation_superseded']
  return v === true || v === 'true'
}
