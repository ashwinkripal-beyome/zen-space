import { sanitizeReportHtmlFragment } from '@/lib/reportHtmlSanitize'
import { strip18WeekPlanHeadingNodes } from '@/lib/planHtmlUtils'

type WellnessKey =
  | 'pain'
  | 'current'
  | 'balance'
  | 'blossom'
  | 'bliss'
  | 'integrated'

function wellnessKeyFromH2(text: string): WellnessKey | null {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase()
  if (/key\s+concerns?|key\s+pain|pain\s+point/.test(t)) return 'pain'
  if (t.includes('current state')) return 'current'
  if (t.includes('balance zone')) return 'balance'
  if (t.includes('blossom zone')) return 'blossom'
  if (t.includes('bliss zone')) return 'bliss'
  if (t.includes('integrated interpretation')) return 'integrated'
  return null
}

function barClassForWellnessKey(key: WellnessKey): 'zen-bar-c4' | 'zen-bar-c1' | 'zen-bar-c2' | 'zen-bar-c3' {
  if (key === 'balance') return 'zen-bar-c1'
  if (key === 'blossom') return 'zen-bar-c2'
  if (key === 'bliss') return 'zen-bar-c3'
  return 'zen-bar-c4'
}

function titleForWellnessKey(key: WellnessKey, original: string): string {
  const map: Record<WellnessKey, string> = {
    pain: 'Key Concerns',
    current: 'Current State',
    balance: 'Balance Zone',
    blossom: 'Blossom Zone',
    bliss: 'Bliss Zone',
    integrated: 'Integrated Interpretation',
  }
  return map[key] || original.trim()
}

function splitGentleSuggestions(
  container: HTMLElement,
  doc: Document,
  suggestionTint: 'c1' | 'c2' | 'c3'
): string {
  const nodes = Array.from(container.childNodes)
  let splitIdx = -1
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    const txt = el.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
    if (txt.includes('gentle suggestion')) {
      splitIdx = i
      break
    }
  }
  if (splitIdx === -1) {
    return `<div class="zen-print-panel">${container.innerHTML}</div>`
  }
  const before = doc.createElement('div')
  for (let i = 0; i < splitIdx; i++) {
    before.appendChild(nodes[i].cloneNode(true))
  }
  const sugWrap = doc.createElement('div')
  sugWrap.className = `zen-print-suggestions zen-print-suggestions-${suggestionTint}`
  for (let i = splitIdx; i < nodes.length; i++) {
    sugWrap.appendChild(nodes[i].cloneNode(true))
  }
  return `<div class="zen-print-panel">${before.innerHTML}</div>${sugWrap.outerHTML}`
}

function wrapWellnessSection(
  key: WellnessKey,
  title: string,
  innerHtml: string,
  doc: Document
): string {
  const bar = barClassForWellnessKey(key)
  const temp = doc.createElement('div')
  temp.innerHTML = innerHtml
  const isZone = key === 'balance' || key === 'blossom' || key === 'bliss'
  let bodyOut = `<div class="zen-print-panel">${temp.innerHTML}</div>`
  if (isZone && temp.children.length) {
    const tint = key === 'balance' ? 'c1' : key === 'blossom' ? 'c2' : 'c3'
    bodyOut = splitGentleSuggestions(temp, doc, tint)
  }
  return `
  <div class="zen-print-block">
    <div class="zen-print-bar ${bar}"><h2 class="zen-print-bar-title">${escapeXml(title)}</h2></div>
    ${bodyOut}
  </div>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type WellnessParseResult = {
  html: string
  /** When true, structured blocks were used */
  structured: boolean
  /** Opening content before first recognized h2 — omit if profileFacts used in print shell */
  preambleHtml: string
}

/**
 * Split wellness report HTML into bar + white panel blocks. Falls back to single panel if no h2 match.
 */
export function parseWellnessReportHtml(html: string): WellnessParseResult {
  const clean = sanitizeReportHtmlFragment(html)
  if (!clean.trim()) {
    return { html: '', structured: false, preambleHtml: '' }
  }
  const doc = new DOMParser().parseFromString(`<div id="wr">${clean}</div>`, 'text/html')
  const root = doc.getElementById('wr')
  if (!root) {
    return { html: `<div class="zen-print-panel zen-print-prose">${clean}</div>`, structured: false, preambleHtml: '' }
  }

  const children = Array.from(root.childNodes)
  const preamble: Node[] = []
  let i = 0
  while (i < children.length) {
    const n = children[i]
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'H2') {
      const key = wellnessKeyFromH2((n as Element).textContent ?? '')
      if (key) break
    }
    preamble.push(n)
    i++
  }

  const preambleHtml = preamble
    .map(n => {
      const d = doc.createElement('div')
      d.appendChild(n.cloneNode(true))
      return d.innerHTML
    })
    .join('')

  const blocks: string[] = []
  while (i < children.length) {
    const n = children[i]
    if (n.nodeType !== Node.ELEMENT_NODE || (n as Element).tagName !== 'H2') {
      i++
      continue
    }
    const h2 = n as Element
    const key = wellnessKeyFromH2(h2.textContent ?? '')
    if (!key) {
      i++
      continue
    }
    const title = titleForWellnessKey(key, h2.textContent ?? '')
    i++
    const inner = doc.createElement('div')
    while (i < children.length) {
      const n2 = children[i]
      if (n2.nodeType === Node.ELEMENT_NODE && (n2 as Element).tagName === 'H2') {
        const nk = wellnessKeyFromH2((n2 as Element).textContent ?? '')
        if (nk) break
      }
      inner.appendChild(n2.cloneNode(true))
      i++
    }
    blocks.push(wrapWellnessSection(key, title, inner.innerHTML, doc))
  }

  if (blocks.length === 0) {
    return {
      html: `<div class="zen-print-panel zen-print-prose">${clean}</div>`,
      structured: false,
      preambleHtml: '',
    }
  }

  return {
    html: `<div class="zen-print-wellness-inner">${blocks.join('\n')}</div>`,
    structured: true,
    preambleHtml,
  }
}

const RITUAL_SOMATIC = /somatic\s+release|grounding/i
const RITUAL_MENTAL = /mental\s+reprogramming/i
const RITUAL_DAILY = /daily\s+zen\s+garden|zen\s+garden\s+practice/i
function ritualSectionKey(text: string): 'somatic' | 'mental' | 'daily' | 'reflect' | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (RITUAL_SOMATIC.test(t)) return 'somatic'
  if (RITUAL_MENTAL.test(t)) return 'mental'
  if (RITUAL_DAILY.test(t)) return 'daily'
  if (/reflection\s*(?:&|and)\s*integration/i.test(t)) return 'reflect'
  return null
}

/** Paragraph / heading that only labels the affirmations list (stays in affirmations box, not above). */
function isAffirmationsTitleNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as Element
  const tag = el.tagName
  if (tag !== 'P' && tag !== 'H3' && tag !== 'H4') return false
  const t = el.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
  if (!t) return false
  if (/^affirmations?$/i.test(t)) return true
  if (t.length < 90 && /^affirmations?\b/i.test(t)) return true
  return false
}

function wrapMentalWithAffirmations(html: string, doc: Document): string {
  const wrap = doc.createElement('div')
  wrap.innerHTML = html
  const nodes = Array.from(wrap.childNodes)
  let listIdx = -1
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    if (el.nodeType === Node.ELEMENT_NODE) {
      const tag = (el as Element).tagName
      if (tag === 'OL' || tag === 'UL') {
        listIdx = i
        break
      }
    }
  }
  if (listIdx === -1) {
    return `<div class="zen-print-panel zen-print-prose">${html}</div>`
  }

  let titleStartIdx = listIdx
  let k = listIdx - 1
  while (k >= 0) {
    const n = nodes[k]
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.textContent?.trim()) {
        k--
        continue
      }
      break
    }
    if (isAffirmationsTitleNode(n)) {
      titleStartIdx = k
      k--
    } else {
      break
    }
  }

  const before = doc.createElement('div')
  for (let j = 0; j < titleStartIdx; j++) {
    before.appendChild(nodes[j].cloneNode(true))
  }
  const aff = doc.createElement('div')
  aff.className = 'zen-print-affirmations'
  for (let j = titleStartIdx; j <= listIdx; j++) {
    aff.appendChild(nodes[j].cloneNode(true))
  }
  return `<div class="zen-print-panel zen-print-prose">${before.innerHTML}</div>${aff.outerHTML}`
}

export type FourfoldParseResult = { html: string }

export function parseFourfoldRitualHtml(html: string): FourfoldParseResult {
  const clean = sanitizeReportHtmlFragment(html)
  if (!clean.trim()) return { html: '' }
  const doc = new DOMParser().parseFromString(`<div id="fr">${clean}</div>`, 'text/html')
  const root = doc.getElementById('fr')
  if (!root) return { html: `<div class="zen-print-prose">${clean}</div>` }

  const children = [...root.childNodes]
  let start = 0
  if (children[0]?.nodeType === Node.ELEMENT_NODE && (children[0] as Element).tagName === 'H2') {
    const t = (children[0] as Element).textContent ?? ''
    if (/fourfold\s+zen\s+ritual/i.test(t)) {
      start = 1
    }
  }

  const parts: string[] = []
  let i = start
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
    const title = el.textContent?.trim() ?? ''
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
    const innerHtml = inner.innerHTML
    const body =
      key === 'mental'
        ? wrapMentalWithAffirmations(innerHtml, doc)
        : `<div class="zen-print-panel zen-print-prose">${innerHtml}</div>`
    parts.push(`
  <div class="zen-print-block">
    <div class="zen-print-bar zen-bar-c4"><h2 class="zen-print-bar-title">${escapeXml(title)}</h2></div>
    ${body}
  </div>`)
  }

  if (parts.length === 0) {
    return { html: `<div class="zen-print-panel zen-print-prose">${clean}</div>` }
  }
  return { html: parts.join('\n') }
}

/** Plan: phase cards + week headings (or legacy "Day") with colour band by week index 1–18 */
export function parsePlanHtmlForPrint(raw: string): string {
  const clean = sanitizeReportHtmlFragment(raw)
  if (!clean.trim()) return ''
  const doc = new DOMParser().parseFromString(`<div id="plan-print-root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('plan-print-root')
  if (!root) return clean
  strip18WeekPlanHeadingNodes(root)

  const nodes = Array.from(root.childNodes)
  root.innerHTML = ''
  let i = 0
  while (i < nodes.length) {
    const node = nodes[i]
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'H2') {
      const text = (node as Element).textContent || ''
      if (/Phase\s+\d+/i.test(text)) {
        const m = text.match(/Phase\s+(\d+)/i)
        const phaseNum = m ? parseInt(m[1], 10) : 1
        const phaseKey =
          phaseNum <= 1 ? 'balance' : phaseNum === 2 ? 'blossom' : 'bliss'
        const card = doc.createElement('div')
        card.className = `zen-phase-card zen-phase-${phaseKey}`
        card.appendChild(node as Node)
        i++
        while (i < nodes.length) {
          const n2 = nodes[i]
          if (n2.nodeType === Node.ELEMENT_NODE && (n2 as Element).tagName === 'H2') break
          card.appendChild(n2 as Node)
          i++
        }
        root.appendChild(card)
        continue
      }
    }
    root.appendChild(node as Node)
    i++
  }

  root.querySelectorAll('h3').forEach(h3 => {
    const t = h3.textContent?.trim() ?? ''
    const dm = t.match(/^(?:Day|Week)\s+(\d+)/i)
    if (dm) {
      const week = parseInt(dm[1], 10)
      h3.classList.add('zen-day-heading')
      if (week >= 1 && week <= 6) h3.classList.add('zen-day-c1')
      else if (week >= 7 && week <= 12) h3.classList.add('zen-day-c2')
      else if (week >= 13 && week <= 18) h3.classList.add('zen-day-c3')
    } else {
      h3.classList.add('zen-inner-h3')
    }
  })
  root.querySelectorAll('h2').forEach(h2 => h2.classList.add('zen-inner-h2'))

  return root.innerHTML
}

export function parseFinalNarrativeHtml(html: string): string {
  const clean = sanitizeReportHtmlFragment(html)
  if (!clean.trim()) return ''
  return `<div class="zen-print-panel zen-print-prose">${clean}</div>`
}
