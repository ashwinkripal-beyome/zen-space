import DOMPurify from 'dompurify'

const ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'div']
const ALLOWED_ATTR = ['class', 'data-day']

/** Matches <h3>Day N</h3> (legacy) or <h3>Week N</h3> (current). */
const DAY_OR_WEEK_H3 = /^(?:day|week)\s*(\d+)/i

function strip18PlanTitleNodes(root: HTMLElement) {
  const candidates = root.querySelectorAll('h1, h2, h3, h4, p, div')
  const toRemove: Element[] = []
  candidates.forEach(el => {
    const t = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (/^18[-–]?\s*(?:DAY|WEEK)\s+PERSONALIZED\s+PLAN$/i.test(t)) {
      toRemove.push(el)
    }
  })
  toRemove.forEach(el => el.remove())
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

/** Keep only the activity name, not trailing explanation (em dash, colon, or first sentence). */
function stripActivityBody(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''

  for (const sep of [' — ', ' – ', ' - ', '—', '–']) {
    const i = t.indexOf(sep)
    if (i > 0 && i < 88) {
      t = t.slice(0, i).trim()
      break
    }
  }

  const colonIdx = t.indexOf(':')
  if (colonIdx > 2 && colonIdx < 72 && !/^\d/.test(t.slice(colonIdx + 1).trim())) {
    t = t.slice(0, colonIdx).trim()
  }

  const dotSpace = t.indexOf('. ')
  if (dotSpace >= 10 && dotSpace < 72 && t.length > dotSpace + 20) {
    t = t.slice(0, dotSpace).trim()
  }

  return truncate(t, 72)
}

/** Activity title from a paragraph: prefer leading strong/b, else strip body from full text. */
function titleFromParagraphElement(p: HTMLParagraphElement): string {
  const directStrong = p.querySelector(':scope > strong, :scope > b')
  if (directStrong) {
    const t = directStrong.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (t) return truncate(t, 72)
  }
  const raw = p.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return stripActivityBody(raw)
}

function textFromHtmlFragment(html: string, doc: Document): string {
  const tmp = doc.createElement('div')
  tmp.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'span', 'br'],
    ALLOWED_ATTR: [],
  })
  return tmp.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

/** After &lt;br&gt; split, keep title slots (short / long / short / long …), not body lines. */
function pickAlternatingTitlesFromSegments(segments: string[], docForClone: Document): string[] {
  const cleaned = segments
    .map(seg => stripActivityBody(textFromHtmlFragment(seg, docForClone)))
    .filter(Boolean)
  if (cleaned.length <= 2) return cleaned

  const short = (s: string) => s.length <= 58
  const long = (s: string) => s.length >= 68

  if (cleaned.length === 4 && short(cleaned[0]) && long(cleaned[1]) && short(cleaned[2]) && long(cleaned[3])) {
    return [cleaned[0], cleaned[2]]
  }
  if (cleaned.length === 3 && short(cleaned[0]) && long(cleaned[1]) && short(cleaned[2])) {
    return [cleaned[0], cleaned[2]]
  }
  if (
    cleaned.length === 6 &&
    short(cleaned[0]) &&
    long(cleaned[1]) &&
    short(cleaned[2]) &&
    long(cleaned[3]) &&
    short(cleaned[4]) &&
    long(cleaned[5])
  ) {
    return [cleaned[0], cleaned[2], cleaned[4]]
  }

  const evens = cleaned.filter((_, i) => i % 2 === 0)
  const odds = cleaned.filter((_, i) => i % 2 === 1)
  if (
    cleaned.length >= 4 &&
    evens.length === odds.length + 1 &&
    evens.every(short) &&
    odds.every(long)
  ) {
    return evens
  }

  return cleaned.length > 2 ? cleaned.filter(s => short(s)).slice(0, 2) : cleaned
}

/**
 * Collect activity **titles** only (no short body lines) from week block body.
 */
function collectActivityTitleParts(wrap: HTMLElement, docForClone: Document): string[] {
  const parts: string[] = []

  for (const el of [...wrap.children]) {
    const tag = el.tagName
    if (tag === 'P') {
      const p = el as HTMLParagraphElement
      const inner = p.innerHTML
      if (/<br\s*\/?>/i.test(inner)) {
        const segments = inner.split(/<br\s*\/?>/i)
        const picked = pickAlternatingTitlesFromSegments(segments, docForClone)
        picked.forEach(x => parts.push(x))
        continue
      }
      const t = titleFromParagraphElement(p)
      if (t) parts.push(t)
    } else if (tag === 'UL' || tag === 'OL') {
      for (const li of el.querySelectorAll(':scope > li')) {
        const raw = li.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        const line = raw.split(/\r?\n/)[0]?.trim() || raw
        const t = stripActivityBody(line)
        if (t) parts.push(t)
      }
    }
  }

  return parts.map(s => s.trim()).filter(Boolean)
}

/** Multiple &lt;p&gt; blocks: title / body / title / body → keep titles only. */
function collapseAlternatingActivityBodies(parts: string[]): string[] {
  if (parts.length <= 2) return parts
  const short = (s: string) => s.length <= 58
  const long = (s: string) => s.length >= 68
  if (parts.length === 4 && short(parts[0]) && long(parts[1]) && short(parts[2]) && long(parts[3])) {
    return [parts[0], parts[2]]
  }
  if (parts.length === 3 && short(parts[0]) && long(parts[1]) && short(parts[2])) {
    return [parts[0], parts[2]]
  }
  return parts
}

/** Text after "Activities" label (same line), e.g. "Name A, Name B and Name C". */
function parseActivitiesSummaryFromParagraphPlainText(full: string): string | null {
  const t = full.replace(/\s+/g, ' ').trim()
  if (!t) return null
  let m = t.match(/^activities\s*[:–\-]\s*(.+)$/i)
  if (m?.[1]?.trim()) return m[1].trim()
  m = t.match(/^activities\s+(.+)$/i)
  if (m?.[1]?.trim() && !/^activities$/i.test(m[1].trim())) return m[1].trim()
  return null
}

/**
 * New plan format: first paragraph(s) summarize with "Activities: …names…".
 * Returns the names portion for checklist cards, or null to fall back to legacy parsing.
 */
function extractActivitiesSummaryTitle(wrap: HTMLElement): string | null {
  const pList = [...wrap.children].filter(c => c.tagName === 'P') as HTMLParagraphElement[]
  for (let i = 0; i < Math.min(pList.length, 3); i++) {
    const full = pList[i].textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const parsed = parseActivitiesSummaryFromParagraphPlainText(full)
    if (parsed) return truncate(parsed, 140)
  }
  if (pList.length >= 2) {
    const t0 = pList[0].textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const strongOnly = pList[0].querySelector(':scope > strong, :scope > b')
    const isLabelOnly =
      /^activities$/i.test(t0) ||
      (strongOnly && /^activities$/i.test(strongOnly.textContent?.trim() ?? '') && t0.length <= 14)
    if (isLabelOnly) {
      const t1 = pList[1].textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (t1) return truncate(t1, 140)
    }
  }
  return null
}

function multipleActivitiesFromSummary(summary: string): boolean {
  return summary.includes(',') || /\s+and\s+/i.test(summary)
}

/**
 * Card subtitle: Activities summary line when present; else legacy extraction.
 * Multiple activities inferred from comma / "and" in summary, or from legacy parts.
 */
function extractDayCardTitle(
  innerHtml: string,
  dayLabel: string,
  docForClone: Document
): { title: string; multipleActivities: boolean } {
  const wrap = docForClone.createElement('div')
  wrap.innerHTML = DOMPurify.sanitize(innerHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })

  const activitiesSummary = extractActivitiesSummaryTitle(wrap)
  if (activitiesSummary) {
    return {
      title: activitiesSummary,
      multipleActivities: multipleActivitiesFromSummary(activitiesSummary),
    }
  }

  let parts = collapseAlternatingActivityBodies(collectActivityTitleParts(wrap, docForClone))

  if (parts.length === 0) {
    const plain = wrap.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (plain) return { title: truncate(plain, 72), multipleActivities: false }
    return { title: dayLabel, multipleActivities: false }
  }

  if (parts.length === 1) {
    return { title: parts[0], multipleActivities: false }
  }

  const joined = parts.join(' & ')
  return {
    title: joined ? truncate(joined, 140) : dayLabel,
    multipleActivities: true,
  }
}

export type PlanDayBlock = {
  /** Slot index 1–18; displayed in UI as "Week N". */
  day: number
  title: string
  /** More than one top-level &lt;p&gt; (plan format: one &lt;p&gt; per activity). */
  multipleActivities: boolean
  /** Body after the week heading (no h3). */
  innerHtml: string
}

export type PlanPhaseBlock = {
  /** Phase title from <h2> (e.g. Weeks 1–6). */
  title: string
  days: PlanDayBlock[]
}

/**
 * Split plan HTML into phases (each <h2>) and week blocks under each phase.
 */
export function parsePlanPhases(html: string): PlanPhaseBlock[] {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })
  const doc = new DOMParser().parseFromString(`<div id="plan-root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('plan-root')
  if (!root) return []

  strip18PlanTitleNodes(root)

  const phases: PlanPhaseBlock[] = []
  let currentPhase: PlanPhaseBlock = { title: '', days: [] }
  let currentDay: number | null = null
  let currentNodes: Element[] = []

  const flushDay = () => {
    if (currentDay === null) return
    const wrap = doc.createElement('div')
    currentNodes.forEach(n => wrap.appendChild(n.cloneNode(true)))
    const innerHtml = wrap.innerHTML
    const dayLabel = `Week ${currentDay}`
    const { title, multipleActivities } = extractDayCardTitle(innerHtml, dayLabel, doc)
    currentPhase.days.push({
      day: currentDay,
      title,
      multipleActivities,
      innerHtml,
    })
    currentDay = null
    currentNodes = []
  }

  const commitPhase = () => {
    flushDay()
    if (currentPhase.days.length > 0 || currentPhase.title.trim() !== '') {
      phases.push({
        title: currentPhase.title.trim(),
        days: currentPhase.days,
      })
    }
    currentPhase = { title: '', days: [] }
  }

  for (const node of [...root.children]) {
    if (node.tagName === 'H2') {
      commitPhase()
      currentPhase = {
        title: node.textContent?.trim() ?? 'Phase',
        days: [],
      }
      continue
    }
    if (node.tagName === 'H3') {
      const m = (node.textContent?.trim() ?? '').match(DAY_OR_WEEK_H3)
      if (m) {
        flushDay()
        currentDay = Number.parseInt(m[1], 10)
        if (!Number.isFinite(currentDay) || currentDay < 1) {
          currentDay = null
        }
        continue
      }
    }
    if (currentDay !== null) {
      currentNodes.push(node as Element)
    }
  }
  commitPhase()

  return phases
}

/**
 * All week blocks in document order (flattened phases).
 */
export function parsePlanDays(html: string): PlanDayBlock[] {
  return parsePlanPhases(html).flatMap(p => p.days)
}
