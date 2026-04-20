import { overallStatusLabel, zoneStatusLabel } from '@/lib/zenScoreLabels'

export type ZenPrintProfileFacts = {
  age?: string
  gender?: string
  totalScore?: string
  overallStatus?: string
  balance?: { score: string; status: string }
  blossom?: { score: string; status: string }
  bliss?: { score: string; status: string }
}

type ScoreDataZones = {
  balance?: { sum?: number; band?: string }
  blossom?: { sum?: number; band?: string }
  bliss?: { sum?: number; band?: string }
}

function parseScoreData(raw: unknown): ScoreDataZones | null {
  if (!raw || typeof raw !== 'object') return null
  const z = (raw as { zones?: ScoreDataZones }).zones
  return z && typeof z === 'object' ? z : null
}

/** Long date e.g. "20th April 2026" */
export function formatReportDateLong(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const day = d.getDate()
    const suffix =
      day % 10 === 1 && day !== 11
        ? 'st'
        : day % 10 === 2 && day !== 12
          ? 'nd'
          : day % 10 === 3 && day !== 13
            ? 'rd'
            : 'th'
    const month = d.toLocaleString('en-GB', { month: 'long' })
    const year = d.getFullYear()
    return `${day}${suffix} ${month} ${year}`
  } catch {
    return ''
  }
}

export function displayNameFromProfile(row: {
  name?: string | null
  first_name?: string | null
  last_name?: string | null
} | null): string {
  if (!row) return ''
  const n = row.name?.trim()
  if (n) return n
  const fn = row.first_name?.trim() ?? ''
  const ln = row.last_name?.trim() ?? ''
  const both = `${fn} ${ln}`.trim()
  return both || ''
}

export function buildProfileFactsFromAssessment(
  assessment: { score_total?: number | null; score_data?: unknown } | null | undefined,
  profile: { gender?: string | null; age?: number | null } | null | undefined
): ZenPrintProfileFacts | undefined {
  if (!assessment && !profile?.gender?.trim() && profile?.age == null) return undefined

  const zones = parseScoreData(assessment?.score_data)
  const total = typeof assessment?.score_total === 'number' ? assessment.score_total : null

  const facts: ZenPrintProfileFacts = {}

  if (typeof profile?.age === 'number' && Number.isFinite(profile.age)) {
    facts.age = String(profile.age)
  }

  if (profile?.gender?.trim()) {
    facts.gender = profile.gender.trim()
  }

  if (total !== null) {
    facts.totalScore = String(total)
    facts.overallStatus = overallStatusLabel(total)
  }

  const b = zones?.balance?.sum
  if (typeof b === 'number') {
    facts.balance = { score: String(b), status: zoneStatusLabel(b) }
  }
  const bl = zones?.blossom?.sum
  if (typeof bl === 'number') {
    facts.blossom = { score: String(bl), status: zoneStatusLabel(bl) }
  }
  const bs = zones?.bliss?.sum
  if (typeof bs === 'number') {
    facts.bliss = { score: String(bs), status: zoneStatusLabel(bs) }
  }

  if (
    !facts.age &&
    !facts.gender &&
    !facts.totalScore &&
    !facts.balance &&
    !facts.blossom &&
    !facts.bliss
  ) {
    return undefined
  }

  return facts
}

/** Cover title, date label, and profile facts for `printZenPlanPdf` (optional fields). */
export function zenPrintPdfMetadata(
  createdAtIso: string | null | undefined,
  clientProfile: {
    name?: string | null
    first_name?: string | null
    last_name?: string | null
    gender?: string | null
    age?: number | null
  } | null | undefined,
  assessment: { score_total?: number | null; score_data?: unknown } | null | undefined
): {
  clientDisplayName: string
  reportDateLabel?: string
  documentTitle: string
  profileFacts?: ZenPrintProfileFacts
} {
  const clientDisplayName = displayNameFromProfile(clientProfile ?? null) || 'Your'
  const reportDateLabel = createdAtIso ? formatReportDateLong(createdAtIso) : undefined
  const profileFacts = buildProfileFactsFromAssessment(assessment, clientProfile)
  const documentTitle =
    clientDisplayName === 'Your'
      ? 'Wellness Report — Zen Space'
      : `${clientDisplayName}'s Wellness Report — Zen Space`
  return { clientDisplayName, reportDateLabel, documentTitle, profileFacts }
}
