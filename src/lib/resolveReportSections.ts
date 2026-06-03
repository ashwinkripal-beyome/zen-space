import {
  parseReportDelimitersFromContent,
  parseRitualDelimitersFromContent,
  splitRitualReportHtml,
  splitWellnessReportHtml,
} from '@/lib/reportHtmlSections'

export type ReportDisplayPart = {
  id: string
  title: string
  html: string
}

export type ReportRowInput = {
  report_client_info?: string | null
  report_key_concerns?: string | null
  report_current_state?: string | null
  report_balance_zone?: string | null
  report_blossom_zone?: string | null
  report_bliss_zone?: string | null
  report_integrated_interpretation?: string | null
  /** Snake-case form (raw DB row). */
  final_narrative_section?: string | null
  /** Camel-case form (page state objects). */
  finalNarrativeSection?: string | null
  report_section?: string | null
  content?: string | null
  ritual_explain?: string | null
  ritual_somatic?: string | null
  ritual_mental?: string | null
  ritual_daily?: string | null
  ritual_reflect?: string | null
  ritual_section?: string | null
}

const REPORT_PARTS: { id: string; title: string; column: keyof ReportRowInput }[] = [
  { id: 'clientInfo', title: 'Client info', column: 'report_client_info' },
  { id: 'keyConcerns', title: 'Key concerns', column: 'report_key_concerns' },
  { id: 'currentState', title: 'Current state', column: 'report_current_state' },
  { id: 'balanceZone', title: 'Balance zone', column: 'report_balance_zone' },
  { id: 'blossomZone', title: 'Blossom zone', column: 'report_blossom_zone' },
  { id: 'blissZone', title: 'Bliss zone', column: 'report_bliss_zone' },
  { id: 'integrated', title: 'Integrated interpretation', column: 'report_integrated_interpretation' },
]

const RITUAL_PARTS: { id: string; title: string; column: keyof ReportRowInput }[] = [
  { id: 'explain', title: 'Your daily foundation', column: 'ritual_explain' },
  { id: 'somatic', title: 'Somatic release & grounding', column: 'ritual_somatic' },
  { id: 'mental', title: 'Your Mental reprogramming Statements', column: 'ritual_mental' },
  { id: 'daily', title: 'Daily Zen Garden practice', column: 'ritual_daily' },
  { id: 'reflect', title: 'Reflection & integration', column: 'ritual_reflect' },
]

function pick(row: ReportRowInput, col: keyof ReportRowInput): string {
  const v = row[col]
  return typeof v === 'string' ? v.trim() : ''
}

/** Reads the final-narrative field regardless of which casing the caller used. */
function pickFinalNarrative(row: ReportRowInput): string {
  return (row.final_narrative_section || row.finalNarrativeSection || '').trim()
}

function hasAnyReportColumns(row: ReportRowInput): boolean {
  return REPORT_PARTS.some(p => pick(row, p.column))
}

function hasAnyRitualColumns(row: ReportRowInput): boolean {
  return RITUAL_PARTS.some(p => pick(row, p.column))
}

function fromHtmlSplit(row: ReportRowInput): { report: Record<string, string>; final: string } {
  const reportHtml = (row.report_section || row.content || '').trim()
  const split = splitWellnessReportHtml(reportHtml)
  const final =
    pickFinalNarrative(row) ||
    parseReportDelimitersFromContent(row.content || '').finalNarrative ||
    ''

  return {
    report: {
      clientInfo: split.clientInfo || split.preamble || '',
      keyConcerns: split.keyConcerns || '',
      currentState: split.currentState || '',
      balanceZone: split.balanceZone || '',
      blossomZone: split.blossomZone || '',
      blissZone: split.blissZone || '',
      integrated: split.integrated || '',
    },
    final,
  }
}

function fromContentDelimiters(row: ReportRowInput): { report: Record<string, string>; final: string } {
  const parsed = parseReportDelimitersFromContent(row.content || '')
  return {
    report: {
      clientInfo: parsed.clientInfo || '',
      keyConcerns: parsed.keyConcerns || '',
      currentState: parsed.currentState || '',
      balanceZone: parsed.balanceZone || '',
      blossomZone: parsed.blossomZone || '',
      blissZone: parsed.blissZone || '',
      integrated: parsed.integrated || '',
    },
    final: pickFinalNarrative(row) || parsed.finalNarrative || '',
  }
}

/** Resolve eight report parts for display (body sections + final narrative). */
export function resolveReportDisplayParts(row: ReportRowInput): ReportDisplayPart[] {
  const htmlById: Record<string, string> = {}

  if (hasAnyReportColumns(row)) {
    for (const p of REPORT_PARTS) {
      htmlById[p.id] = pick(row, p.column)
    }
    const final = pickFinalNarrative(row)
    const parts: ReportDisplayPart[] = REPORT_PARTS.filter(p => htmlById[p.id]).map(p => ({
      id: p.id,
      title: p.title,
      html: htmlById[p.id],
    }))
    if (final) parts.push({ id: 'final', title: 'Final narrative', html: final })
    if (parts.length > 0) return parts
  }

  let merged = fromHtmlSplit(row)
  if (!Object.values(merged.report).some(Boolean)) {
    merged = fromContentDelimiters(row)
  }

  const parts: ReportDisplayPart[] = []
  for (const p of REPORT_PARTS) {
    const html = merged.report[p.id] || ''
    if (html) parts.push({ id: p.id, title: p.title, html })
  }
  if (merged.final) parts.push({ id: 'final', title: 'Final narrative', html: merged.final })

  if (parts.length === 0) {
    const fallback = (row.report_section || row.content || '').trim()
    if (fallback) parts.push({ id: 'legacy', title: 'Report', html: fallback })
  }

  return parts
}

/** Resolve five ritual parts for display. */
export function resolveRitualDisplayParts(row: ReportRowInput): ReportDisplayPart[] {
  if (hasAnyRitualColumns(row)) {
    const parts: ReportDisplayPart[] = []
    for (const p of RITUAL_PARTS) {
      const html = pick(row, p.column)
      if (html) parts.push({ id: p.id, title: p.title, html })
    }
    if (parts.length > 0) return parts
  }

  const ritualHtml = (row.ritual_section || '').trim()
  let split = splitRitualReportHtml(ritualHtml)
  if (!Object.values(split).some(Boolean)) {
    split = parseRitualDelimitersFromContent(row.content || '')
  }

  const parts: ReportDisplayPart[] = []
  for (const p of RITUAL_PARTS) {
    const html = (split as Record<string, string | undefined>)[p.id] || ''
    if (html) parts.push({ id: p.id, title: p.title, html })
  }

  if (parts.length === 0 && ritualHtml) {
    parts.push({ id: 'legacy', title: 'Fourfold Zen ritual', html: ritualHtml })
  }

  return parts
}

/** Whether report tab has any displayable body (excludes final-only). */
export function hasReportBodyParts(parts: ReportDisplayPart[]): boolean {
  return parts.some(p => p.id !== 'final' && p.id !== 'legacy')
}
