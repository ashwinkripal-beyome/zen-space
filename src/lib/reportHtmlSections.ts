import { sanitizeReportHtmlFragment } from '@/lib/reportHtmlSanitize'

export type WellnessHtmlParts = {
  clientInfo: string
  keyConcerns: string
  currentState: string
  balanceZone: string
  blossomZone: string
  blissZone: string
  integrated: string
}

export type RitualHtmlParts = {
  explain: string
  somatic: string
  mental: string
  daily: string
  reflect: string
}

type WellnessKey = keyof WellnessHtmlParts | null

function wellnessKeyFromH2(text: string): WellnessKey {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase()
  if (/key\s+concerns?|key\s+pain|pain\s+point/.test(t)) return 'keyConcerns'
  if (t.includes('current state')) return 'currentState'
  if (t.includes('balance zone')) return 'balanceZone'
  if (t.includes('blossom zone')) return 'blossomZone'
  if (t.includes('bliss zone')) return 'blissZone'
  if (t.includes('integrated interpretation')) return 'integrated'
  return null
}

function ritualSectionKey(text: string): keyof RitualHtmlParts | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (/fourfold\s+zen\s+ritual/i.test(t)) return null
  if (/somatic\s+release|grounding/i.test(t)) return 'somatic'
  if (/mental\s+reprogramming/i.test(t)) return 'mental'
  if (/daily\s+zen\s+garden|zen\s+garden\s+practice/i.test(t)) return 'daily'
  if (/reflection\s*(?:&|and)\s*integration/i.test(t)) return 'reflect'
  return null
}

function collectUntilNextH2(
  children: ChildNode[],
  start: number,
  doc: Document,
  matchKey: (text: string) => WellnessKey
): { html: string; nextIndex: number } {
  const inner = doc.createElement('div')
  let i = start
  while (i < children.length) {
    const n = children[i]
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'H2') {
      const nk = matchKey((n as Element).textContent ?? '')
      if (nk) break
    }
    inner.appendChild(n.cloneNode(true))
    i++
  }
  return { html: inner.innerHTML.trim(), nextIndex: i }
}

/** Split legacy report_section HTML into subsection bodies (headings stripped from slices). */
export function splitWellnessReportHtml(html: string): Partial<WellnessHtmlParts> & { preamble: string } {
  const empty: Partial<WellnessHtmlParts> & { preamble: string } = { preamble: '' }
  const clean = sanitizeReportHtmlFragment(html)
  if (!clean.trim()) return empty

  const doc = new DOMParser().parseFromString(`<div id="wr">${clean}</div>`, 'text/html')
  const root = doc.getElementById('wr')
  if (!root) return { ...empty, preamble: clean }

  const children = Array.from(root.childNodes)
  const parts: Partial<WellnessHtmlParts> = {}
  const preambleNodes: ChildNode[] = []
  let i = 0

  while (i < children.length) {
    const n = children[i]
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'H2') {
      const key = wellnessKeyFromH2((n as Element).textContent ?? '')
      if (key) break
    }
    preambleNodes.push(n)
    i++
  }

  const preambleWrap = doc.createElement('div')
  preambleNodes.forEach(n => preambleWrap.appendChild(n.cloneNode(true)))
  const preamble = preambleWrap.innerHTML.trim()

  while (i < children.length) {
    const n = children[i]
    if (n.nodeType !== Node.ELEMENT_NODE || (n as Element).tagName !== 'H2') {
      i++
      continue
    }
    const key = wellnessKeyFromH2((n as Element).textContent ?? '')
    if (!key) {
      i++
      continue
    }
    i++
    const { html: slice, nextIndex } = collectUntilNextH2(children, i, doc, wellnessKeyFromH2)
    parts[key] = slice
    i = nextIndex
  }

  if (preamble && !parts.clientInfo) {
    parts.clientInfo = preamble
  } else if (preamble && parts.clientInfo) {
    parts.clientInfo = `${preamble}\n\n${parts.clientInfo}`
  } else if (preamble) {
    return { ...parts, preamble }
  }

  return { ...parts, preamble: '' }
}

/** Split legacy ritual_section HTML into five subsection bodies. */
export function splitRitualReportHtml(html: string): Partial<RitualHtmlParts> {
  const clean = sanitizeReportHtmlFragment(html)
  if (!clean.trim()) return {}

  const doc = new DOMParser().parseFromString(`<div id="fr">${clean}</div>`, 'text/html')
  const root = doc.getElementById('fr')
  if (!root) return {}

  const children = [...root.childNodes]
  let start = 0
  if (children[0]?.nodeType === Node.ELEMENT_NODE && (children[0] as Element).tagName === 'H2') {
    const t = (children[0] as Element).textContent ?? ''
    if (/fourfold\s+zen\s+ritual/i.test(t)) start = 1
  }

  const parts: Partial<RitualHtmlParts> = {}
  const explainNodes: ChildNode[] = []
  let i = start

  while (i < children.length) {
    const n = children[i]
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element
      const tag = el.tagName
      if (tag === 'H2' || tag === 'H3') {
        const key = ritualSectionKey(el.textContent ?? '')
        if (key) break
      }
    }
    explainNodes.push(n)
    i++
  }

  const explainWrap = doc.createElement('div')
  explainNodes.forEach(n => explainWrap.appendChild(n.cloneNode(true)))
  const explainHtml = explainWrap.innerHTML.trim()
  if (explainHtml) parts.explain = explainHtml

  while (i < children.length) {
    const n = children[i]
    if (n.nodeType !== Node.ELEMENT_NODE) {
      i++
      continue
    }
    const el = n as Element
    const tag = el.tagName
    if (tag !== 'H2' && tag !== 'H3') {
      i++
      continue
    }
    const key = ritualSectionKey(el.textContent ?? '')
    if (!key) {
      i++
      continue
    }
    i++
    const inner = doc.createElement('div')
    while (i < children.length) {
      const n2 = children[i]
      if (n2.nodeType === Node.ELEMENT_NODE) {
        const t2 = (n2 as Element).tagName
        if (t2 === 'H2' || t2 === 'H3') {
          const k2 = ritualSectionKey((n2 as Element).textContent ?? '')
          if (k2) break
        }
      }
      inner.appendChild(n2.cloneNode(true))
      i++
    }
    parts[key] = inner.innerHTML.trim()
  }

  return parts
}

/** Client-side delimiter parse (mirrors edge) for content fallback. */
const CLIENT_INFO_DELIM = '---SECTION:CLIENT_INFO---'
const KEY_CONCERNS_DELIM = '---SECTION:KEY_CONCERNS---'
const CURRENT_STATE_DELIM = '---SECTION:CURRENT_STATE---'
const BALANCE_ZONE_DELIM = '---SECTION:BALANCE_ZONE---'
const BLOSSOM_ZONE_DELIM = '---SECTION:BLOSSOM_ZONE---'
const BLISS_ZONE_DELIM = '---SECTION:BLISS_ZONE---'
const INTEGRATED_DELIM = '---SECTION:INTEGRATED---'
const FINAL_DELIM = '---SECTION:FINAL---'
const REPORT_DELIM = '---SECTION:REPORT---'

const RITUAL_EXPLAIN_DELIM = '---SECTION:RITUAL_EXPLAIN---'
const RITUAL_SOMATIC_DELIM = '---SECTION:RITUAL_SOMATIC---'
const RITUAL_MENTAL_DELIM = '---SECTION:RITUAL_MENTAL---'
const RITUAL_DAILY_DELIM = '---SECTION:RITUAL_DAILY---'
const RITUAL_REFLECT_DELIM = '---SECTION:RITUAL_REFLECT---'

function sliceBetween(content: string, delim: string, nextDelims: string[]): string {
  const idx = content.indexOf(delim)
  if (idx === -1) return ''
  const start = idx + delim.length
  let end = content.length
  for (const nd of nextDelims) {
    const ni = content.indexOf(nd, start)
    if (ni !== -1 && ni < end) end = ni
  }
  return content.substring(start, end).trim()
}

export function parseReportDelimitersFromContent(content: string): Partial<WellnessHtmlParts> & {
  finalNarrative: string
} {
  let body = content
  const ri = content.indexOf(REPORT_DELIM)
  const fi = content.indexOf(FINAL_DELIM)
  if (ri !== -1 && fi !== -1 && fi > ri && !content.includes(CLIENT_INFO_DELIM)) {
    body = content.substring(ri + REPORT_DELIM.length, fi)
  }

  if (!body.includes(CLIENT_INFO_DELIM) && !body.includes(KEY_CONCERNS_DELIM)) {
    return { finalNarrative: fi !== -1 ? content.substring(fi + FINAL_DELIM.length).trim() : '' }
  }

  return {
    clientInfo: sliceBetween(body, CLIENT_INFO_DELIM, [
      KEY_CONCERNS_DELIM,
      CURRENT_STATE_DELIM,
      BALANCE_ZONE_DELIM,
      FINAL_DELIM,
    ]),
    keyConcerns: sliceBetween(body, KEY_CONCERNS_DELIM, [
      CURRENT_STATE_DELIM,
      BALANCE_ZONE_DELIM,
      FINAL_DELIM,
    ]),
    currentState: sliceBetween(body, CURRENT_STATE_DELIM, [BALANCE_ZONE_DELIM, FINAL_DELIM]),
    balanceZone: sliceBetween(body, BALANCE_ZONE_DELIM, [BLOSSOM_ZONE_DELIM, FINAL_DELIM]),
    blossomZone: sliceBetween(body, BLOSSOM_ZONE_DELIM, [BLISS_ZONE_DELIM, FINAL_DELIM]),
    blissZone: sliceBetween(body, BLISS_ZONE_DELIM, [INTEGRATED_DELIM, FINAL_DELIM]),
    integrated: sliceBetween(body, INTEGRATED_DELIM, [FINAL_DELIM]),
    finalNarrative: sliceBetween(content, FINAL_DELIM, [
      RITUAL_EXPLAIN_DELIM,
      '---SECTION:RITUAL---',
      '---SECTION:PLAN---',
    ]),
  }
}

export function parseRitualDelimitersFromContent(content: string): Partial<RitualHtmlParts> {
  const ritualStart = Math.max(
    content.indexOf(RITUAL_EXPLAIN_DELIM),
    content.indexOf('---SECTION:RITUAL---')
  )
  const body = ritualStart >= 0 ? content.substring(ritualStart) : content
  if (!body.includes(RITUAL_EXPLAIN_DELIM) && !body.includes(RITUAL_MENTAL_DELIM)) return {}

  return {
    explain: sliceBetween(body, RITUAL_EXPLAIN_DELIM, [RITUAL_SOMATIC_DELIM, RITUAL_MENTAL_DELIM]),
    somatic: sliceBetween(body, RITUAL_SOMATIC_DELIM, [RITUAL_MENTAL_DELIM, RITUAL_DAILY_DELIM]),
    mental: sliceBetween(body, RITUAL_MENTAL_DELIM, [RITUAL_DAILY_DELIM, RITUAL_REFLECT_DELIM]),
    daily: sliceBetween(body, RITUAL_DAILY_DELIM, [RITUAL_REFLECT_DELIM, '---SECTION:PLAN---']),
    reflect: sliceBetween(body, RITUAL_REFLECT_DELIM, ['---SECTION:PLAN---', FINAL_DELIM]),
  }
}
