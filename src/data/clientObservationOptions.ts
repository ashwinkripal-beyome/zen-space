export type ClientObservationQuestionType = 'chips_and_text' | 'chips_only' | 'text_only'

export interface ClientObservationQuestion {
  key: string
  label: string
  type: ClientObservationQuestionType
  placeholder?: string
  options?: string[]
  /** When true, chip selection allows at most one option (radio-like). */
  singleSelect?: boolean
}

export type ClientObservations = Record<string, { selected: string[]; freeText: string }>

export const CLIENT_OBSERVATION_QUESTIONS: ClientObservationQuestion[] = [
  {
    key: 'primary_concerns',
    label: 'What are your primary concerns or struggles in life?',
    type: 'chips_and_text',
    placeholder: 'Add anything else you want to share…',
    options: [
      'I feel stressed, anxious, or emotionally overwhelmed',
      'I feel stuck or unsure about what I really want in life',
      'I am facing challenges in my relationships',
      'I feel constantly tired, drained, or burnt out',
    ],
  },
  {
    key: 'root_cause',
    label: 'What do you feel is the root cause of these concerns?',
    type: 'chips_and_text',
    placeholder: 'Add anything else you want to share…',
    options: [
      "I have some past emotions or experiences that I haven't fully processed",
      "I feel like I've been under constant stress for a long time",
      'My thoughts tend to go negative or I overthink a lot',
      'I feel disconnected from myself and what I truly need',
    ],
  },
  {
    key: 'coping_techniques',
    label: 'What are your current coping & mindfulness techniques?',
    type: 'chips_and_text',
    placeholder: 'Add anything else you want to share…',
    options: [
      'I distract myself (phone, work, TV, staying busy)',
      'I talk to someone I trust or seek support',
      'I try practices like breathing, meditation, or journaling',
      "I'm not really sure how to cope or I don't do much right now",
    ],
  },
  {
    key: 'stopping_growth',
    label: 'What is stopping you from your growth?',
    type: 'chips_and_text',
    placeholder: 'Describe what you feel holds you back…',
    options: [
      'I feel stuck in my thoughts or overthink a lot',
      'Fear, self-doubt, or lack of confidence holds me back',
      "I don't have clarity on what I truly want or where I'm going",
      'I lack consistency, discipline, or the right support system',
    ],
  },
  {
    key: 'desired_changes',
    label: 'What would you like to change or improve in your life right now?',
    type: 'text_only',
    placeholder: "Describe what you'd like to change or improve…",
  },
  {
    key: 'physical_symptoms',
    label: 'Physical health symptoms you might be feeling',
    type: 'chips_and_text',
    placeholder: 'Describe any other physical symptoms…',
    options: [
      'Headaches',
      'Fatigue',
      'Muscle tension / body pain',
      'Digestive issues',
      'Sleep problems',
      'Shallow breathing',
      'Heart palpitations',
      'Low energy',
      'Skin issues',
      'Appetite changes',
    ],
  },
  {
    key: 'open_to_healing',
    label: 'How open are you towards healing?',
    type: 'chips_only',
    singleSelect: true,
    options: [
      'I am just exploring',
      'I am open but unsure',
      'I am ready to actively work on myself',
      'I am fully committed to transformation',
    ],
  },
]

export function emptyClientObservations(): ClientObservations {
  const out: ClientObservations = {}
  for (const q of CLIENT_OBSERVATION_QUESTIONS) {
    out[q.key] = { selected: [], freeText: '' }
  }
  return out
}

export function normalizeClientObservations(raw: unknown): ClientObservations {
  const empty = emptyClientObservations()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty
  const o = raw as Record<string, unknown>
  for (const q of CLIENT_OBSERVATION_QUESTIONS) {
    const v = o[q.key]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const entry = v as Record<string, unknown>
      let selected = Array.isArray(entry.selected)
        ? entry.selected.filter((x): x is string => typeof x === 'string')
        : []
      if (q.singleSelect && selected.length > 1) {
        selected = selected.slice(0, 1)
      }
      empty[q.key] = {
        selected,
        freeText: typeof entry.freeText === 'string' ? entry.freeText : '',
      }
    }
  }
  return empty
}
