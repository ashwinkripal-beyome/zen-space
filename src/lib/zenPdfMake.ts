import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'

import { sanitizeReportHtmlFragment } from '@/lib/reportHtmlSanitize'
import type { ZenPrintProfileFacts } from '@/lib/zenPrintPayloadHelpers'

export type ZenPlanPrintPayload = {
  /** Main report body (HTML fragment) */
  reportHtml: string
  /** Optional closing narrative */
  finalNarrativeHtml?: string
  /** Fourfold Zen Ritual (HTML fragment) */
  ritualHtml?: string
  /** 18-week plan (HTML fragment) */
  planHtml?: string
  /** Browser tab / PDF metadata title */
  documentTitle?: string
  /** Cover: first name or full name for "{Name}'s Wellness Report" */
  clientDisplayName?: string
  /** Cover: e.g. "20th April 2026" */
  reportDateLabel?: string
  /** Profile summary card (age, gender, scores) */
  profileFacts?: ZenPrintProfileFacts
}

export type { ZenPrintProfileFacts }

// ---------------------------------------------------------------------------
// Palette — solid mid-tones drawn from the gradient design. pdfmake has no
// gradient support, so each zone uses a single representative colour.
// ---------------------------------------------------------------------------
const C = {
  balance: '#2f4a91',
  blossom: '#7a335f',
  bliss: '#22624a',
  primary: '#3479c2',
  deep: '#243a78',
  coverBg: '#0a152e',
  paper: '#f8f7f5',
  ink: '#2c2820',
  muted: '#8a837a',
  cardBorder: '#e4e0d8',
  white: '#ffffff',
} as const

// ---------------------------------------------------------------------------
// Section / heading colour detection (mirrors the HTML print layout rules)
// ---------------------------------------------------------------------------
/** Colour for a recognised section heading (zone / phase / concern / ritual part). */
function sectionColor(text: string): string | null {
  const t = text.toLowerCase()
  if (/balance zone/.test(t)) return C.balance
  if (/blossom zone/.test(t)) return C.blossom
  if (/bliss zone/.test(t)) return C.bliss
  if (/phase\s*1\b/.test(t)) return C.balance
  if (/phase\s*2\b/.test(t)) return C.blossom
  if (/phase\s*3\b/.test(t)) return C.bliss
  if (/key\s+concern|key\s+pain|pain\s+point|current state|integrated interpretation/.test(t)) {
    return C.deep
  }
  // Fourfold Zen Ritual sub-sections
  if (/somatic\s+release|grounding|mental\s+reprogramming|zen\s+garden|reflection\s*(?:&|and)\s*integration/.test(t)) {
    return C.primary
  }
  return null
}

/** True for legacy "18-Week Personalized Plan" headings we drop entirely. */
function isLegacyPlanHeading(text: string): boolean {
  return /\b\d+\s*-?\s*(day|week)\b.*\bplan\b/i.test(text) || /personalized\s+plan/i.test(text)
}

function weekColor(week: number): string {
  if (week <= 6) return C.balance
  if (week <= 12) return C.blossom
  return C.bliss
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Full-width coloured section bar with white uppercase title. */
function bar(
  text: string,
  color: string,
  opts?: { fontSize?: number; marginTop?: number; marginBottom?: number }
): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            text: text.toUpperCase(),
            color: C.white,
            bold: true,
            fontSize: opts?.fontSize ?? 10.5,
            characterSpacing: 0.6,
            margin: [10, 7, 10, 7],
          },
        ],
      ],
    },
    layout: {
      fillColor: () => color,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, opts?.marginTop ?? 12, 0, opts?.marginBottom ?? 7],
    unbreakable: true,
  }
}

/** Auto-width "WEEK N" pill — text centred inside a tight coloured cell. */
function weekPill(label: string, color: string): Content {
  return {
    table: {
      widths: ['auto'],
      body: [
        [
          {
            text: label.toUpperCase(),
            color: C.white,
            bold: true,
            fontSize: 8,
            characterSpacing: 1,
            alignment: 'center',
            margin: [12, 4, 12, 4],
          },
        ],
      ],
    },
    layout: {
      fillColor: () => color,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 10, 0, 5],
    unbreakable: true,
  }
}

// ---------------------------------------------------------------------------
// HTML → pdfmake conversion (operates on the sanitised, restricted tag set:
// h2, h3, p, ul, ol, li, strong, em, br, div)
// ---------------------------------------------------------------------------

type InlineRun = { text: string; bold?: boolean; italics?: boolean }

function inlineRuns(node: Node, inherited?: { bold?: boolean; italics?: boolean }): InlineRun[] {
  const out: InlineRun[] = []
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      // Normalize structural whitespace from HTML indentation — newlines between
      // tags become spaces; multiple spaces collapse. Only emit if non-empty.
      const t = (child.textContent ?? '').replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ')
      if (t.trim()) out.push({ text: t, ...inherited })
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as Element
    const tag = el.tagName
    if (tag === 'BR') {
      out.push({ text: '\n' })
      return
    }
    if (tag === 'STRONG' || tag === 'B') {
      out.push(...inlineRuns(el, { ...inherited, bold: true }))
      return
    }
    if (tag === 'EM' || tag === 'I') {
      out.push(...inlineRuns(el, { ...inherited, italics: true }))
      return
    }
    // Any other inline-ish element: descend, keeping inherited styling
    out.push(...inlineRuns(el, inherited))
  })
  return out
}

/**
 * Builds the content for a single <li> element.
 * Block children (<p>, <div>) become separate paragraphs in a stack so that
 * pdfmake places the list marker flush with the FIRST line of the first
 * paragraph, not on a blank leading line.
 */
function listItemContent(li: Element): Content {
  const paragraphs: Content[] = []
  let pendingRuns: InlineRun[] = []

  const flushRuns = () => {
    if (pendingRuns.length) {
      paragraphs.push({ text: pendingRuns, margin: [0, 0, 0, 3] })
      pendingRuns = []
    }
  }

  li.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent ?? '').replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ')
      if (t.trim()) pendingRuns.push({ text: t })
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName
      if (tag === 'P' || tag === 'DIV') {
        flushRuns()
        const pRuns = inlineRuns(el)
        if (pRuns.length) paragraphs.push({ text: pRuns, margin: [0, 0, 0, 3] })
      } else if (tag === 'BR') {
        flushRuns()
      } else {
        pendingRuns.push(...inlineRuns(el))
      }
    }
  })
  flushRuns()

  if (paragraphs.length === 0) return { text: '' }
  if (paragraphs.length === 1) return paragraphs[0]
  return { stack: paragraphs }
}

function listItems(listEl: Element): Content[] {
  return Array.from(listEl.children)
    .filter(li => li.tagName === 'LI')
    .map(li => listItemContent(li))
}

function emitBlock(node: Node, out: Content[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent?.trim()
    if (t) out.push({ text: t, margin: [0, 0, 0, 6] })
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  const tag = el.tagName
  const txt = (el.textContent ?? '').replace(/\s+/g, ' ').trim()

  switch (tag) {
    case 'H2': {
      if (!txt || isLegacyPlanHeading(txt)) return
      const color = sectionColor(txt)
      if (color) {
        out.push(bar(txt, color, { fontSize: 9.5, marginTop: 11, marginBottom: 5 }))
      } else {
        out.push({ text: txt, bold: true, fontSize: 12, color: C.ink, margin: [0, 11, 0, 4] })
      }
      return
    }
    case 'H3': {
      if (!txt) return
      const wm = txt.match(/^(?:week|day)\s+(\d+)/i)
      if (wm) {
        out.push(weekPill(txt, weekColor(parseInt(wm[1], 10))))
        return
      }
      const color = sectionColor(txt)
      if (color) {
        out.push(bar(txt, color, { fontSize: 9, marginTop: 9, marginBottom: 4 }))
        return
      }
      out.push({ text: txt, bold: true, fontSize: 10.5, color: '#3b3730', margin: [0, 8, 0, 3] })
      return
    }
    case 'P': {
      const runs = inlineRuns(el)
      if (runs.length) out.push({ text: runs, margin: [0, 0, 0, 6] })
      return
    }
    case 'UL': {
      const items = listItems(el)
      if (items.length) out.push({ ul: items, margin: [0, 1, 0, 7] })
      return
    }
    case 'OL': {
      const items = listItems(el)
      if (items.length) out.push({ ol: items, margin: [0, 1, 0, 7] })
      return
    }
    case 'DIV': {
      el.childNodes.forEach(child => emitBlock(child, out))
      return
    }
    default: {
      const runs = inlineRuns(el)
      if (runs.length) out.push({ text: runs, margin: [0, 0, 0, 6] })
    }
  }
}

function htmlToBlocks(html: string | undefined): Content[] {
  const clean = sanitizeReportHtmlFragment(html ?? '')
  if (!clean.trim()) return []
  const doc = new DOMParser().parseFromString(`<div id="zp-root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('zp-root')
  if (!root) return []
  const out: Content[] = []
  root.childNodes.forEach(node => emitBlock(node, out))
  return out
}

// ---------------------------------------------------------------------------
// Profile summary card
// ---------------------------------------------------------------------------
function profileCard(facts: ZenPrintProfileFacts): Content | null {
  const rows: TableCell[][] = []
  const kv = (k: string, v?: string) => {
    if (!v?.trim()) return
    rows.push([
      { text: k.toUpperCase(), color: C.muted, fontSize: 7.5, characterSpacing: 0.5, margin: [10, 6, 6, 6] },
      { text: v.trim(), bold: true, color: C.ink, fontSize: 9.5, margin: [0, 6, 10, 6] },
    ])
  }
  kv('Age', facts.age)
  kv('Gender', facts.gender)
  kv('Total score', facts.totalScore)
  kv('Overall status', facts.overallStatus)

  const zoneRow = (label: string, z: { score: string; status: string } | undefined, color: string) => {
    if (!z) return
    rows.push([
      { text: label, color, bold: true, fontSize: 9.5, margin: [10, 6, 6, 6] },
      {
        text: [
          { text: z.score, bold: true, color: C.ink },
          { text: `   ${z.status}`, color: C.muted },
        ],
        fontSize: 9.5,
        margin: [0, 6, 10, 6],
      },
    ])
  }
  zoneRow('Balance', facts.balance, C.balance)
  zoneRow('Blossom', facts.blossom, C.blossom)
  zoneRow('Bliss', facts.bliss, C.bliss)

  if (!rows.length) return null

  return {
    table: { widths: ['auto', '*'], body: rows },
    layout: {
      fillColor: () => C.white,
      hLineColor: () => C.cardBorder,
      vLineColor: () => C.cardBorder,
      hLineWidth: (i: number, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
      vLineWidth: (i: number, node) => (i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0),
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 12],
    unbreakable: true,
  }
}

// ---------------------------------------------------------------------------
// Cover page (page 1) — dark full-bleed background, centred title
// ---------------------------------------------------------------------------
function coverContent(payload: ZenPlanPrintPayload): Content {
  const name = payload.clientDisplayName?.trim()
  const coverTitle =
    !name || name === 'Your' ? 'Wellness Report' : `${name}’s Wellness Report`
  const dateLine = payload.reportDateLabel?.trim()

  const stack: Content[] = [
    { text: 'ZEN SPACE', color: '#7e9bd6', characterSpacing: 5, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 44] },
    { text: 'WELLNESS REPORT', color: '#90b0e6', characterSpacing: 4, fontSize: 8, alignment: 'center', margin: [0, 0, 0, 14] },
    { text: coverTitle, color: C.white, bold: true, fontSize: 30, alignment: 'center', margin: [0, 0, 0, 16] },
    { canvas: [{ type: 'line', x1: 230, y1: 0, x2: 286, y2: 0, lineWidth: 1, lineColor: '#5a78b8' }], margin: [0, 0, 0, 16] },
  ]
  if (dateLine) {
    stack.push({ text: dateLine, color: '#9fb6e6', fontSize: 11, alignment: 'center', margin: [0, 0, 0, 6] })
  }
  stack.push({ text: 'Confidential · for personal use only', color: '#6f8bc4', fontSize: 9, alignment: 'center' })

  return {
    stack,
    margin: [0, 286, 0, 0],
    pageBreak: 'after',
  }
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------
function buildDocDefinition(payload: ZenPlanPrintPayload): TDocumentDefinitions {
  const content: Content[] = [coverContent(payload)]

  if (payload.profileFacts) {
    const card = profileCard(payload.profileFacts)
    if (card) content.push(card)
  }

  // Wellness report — inner zone headings become their own coloured bars
  const wellness = htmlToBlocks(payload.reportHtml)
  if (wellness.length) content.push(...wellness)

  // Final narrative
  const final = htmlToBlocks(payload.finalNarrativeHtml)
  if (final.length) {
    content.push(bar('Final Narrative', C.deep, { fontSize: 10.5, marginTop: 14 }))
    content.push(...final)
  }

  // Fourfold Zen Ritual — always starts on a fresh page
  const ritual = htmlToBlocks(payload.ritualHtml)
  if (ritual.length) {
    content.push(bar('Fourfold Zen Ritual', C.primary, { fontSize: 11, marginTop: 0, marginBottom: 8 }))
    ;(content[content.length - 1] as { pageBreak?: string }).pageBreak = 'before'
    content.push(...ritual)
  }

  // 18-Week Wellness Plan — always starts on a fresh page
  const plan = htmlToBlocks(payload.planHtml)
  if (plan.length) {
    content.push(bar('18-Week Wellness Plan', C.primary, { fontSize: 11, marginTop: 0, marginBottom: 8 }))
    ;(content[content.length - 1] as { pageBreak?: string }).pageBreak = 'before'
    content.push(...plan)
  }

  const footerLabel = (payload.clientDisplayName ?? '').trim() || 'Wellness Report'

  return {
    pageSize: 'A4',
    pageMargins: [42, 50, 42, 54],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: C.ink, lineHeight: 1.35 },
    background: (currentPage, pageSize) => ({
      canvas: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w: pageSize.width,
          h: pageSize.height,
          color: currentPage === 1 ? C.coverBg : C.paper,
        },
      ],
    }),
    footer: (currentPage, pageCount) => {
      if (currentPage === 1) return undefined
      return {
        margin: [42, 14, 42, 0],
        columns: [
          { text: footerLabel, color: C.muted, fontSize: 7.5 },
          { text: `Page ${currentPage - 1} of ${pageCount - 1}`, color: C.muted, fontSize: 7.5, alignment: 'right' },
        ],
      }
    },
    content,
    info: {
      title: payload.documentTitle?.trim() || 'Wellness Report — Zen Space',
      author: 'Zen Space',
    },
  }
}

// ---------------------------------------------------------------------------
// Public entry — generates and downloads a text-based PDF via pdfmake
// ---------------------------------------------------------------------------
export async function downloadZenPlanPdfMake(
  payload: ZenPlanPrintPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [pdfMakeMod, vfsMod] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ])
    const pdfMake = (pdfMakeMod as { default?: unknown }).default ?? pdfMakeMod
    const vfs =
      (vfsMod as { default?: unknown }).default ??
      (vfsMod as { vfs?: unknown }).vfs ??
      vfsMod
    ;(pdfMake as { vfs: unknown }).vfs = vfs

    const docDefinition = buildDocDefinition(payload)

    const clientName = (payload.clientDisplayName ?? '').trim()
    const safeName = clientName.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    const filename = safeName ? `${safeName}-Wellness-Report.pdf` : 'Wellness-Report.pdf'

    await new Promise<void>((resolve, reject) => {
      try {
        ;(pdfMake as { createPdf: (d: TDocumentDefinitions) => { download: (n: string, cb?: () => void) => void } })
          .createPdf(docDefinition)
          .download(filename, () => resolve())
      } catch (e) {
        reject(e)
      }
    })

    return { ok: true }
  } catch (err) {
    console.error('[downloadZenPlanPdfMake]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'PDF generation failed',
    }
  }
}
