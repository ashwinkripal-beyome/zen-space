import type { ZenPrintProfileFacts } from '@/lib/zenPrintPayloadHelpers'
import {
  parseFinalNarrativeHtml,
  parseFourfoldRitualHtml,
  parsePlanHtmlForPrint,
  parseWellnessReportHtml,
} from '@/lib/zenPrintLayout'

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
// Design tokens — all inline hex/rgb so html2canvas resolves them reliably
// without depending on CSS custom properties
// ---------------------------------------------------------------------------

/** A4 at 96 dpi ~= 794 px */
const PAGE_W_CSS = 794

// Gradients (used both in the HTML and referenced in JS)
const GRAD_BALANCE  = 'linear-gradient(135deg, #1f3168 0%, #374f97 55%, #283f84 100%)'
const GRAD_BLOSSOM  = 'linear-gradient(135deg, #5e2244 0%, #8b3a6a 55%, #6b2e52 100%)'
const GRAD_BLISS    = 'linear-gradient(135deg, #1a4a3a 0%, #2d6b52 55%, #1f5742 100%)'
const GRAD_PRIMARY  = 'linear-gradient(135deg, #5198ca 0%, #3398ca 55%, #337cca 100%)'
const GRAD_DEEP     = 'linear-gradient(135deg, #2d4795 0%, #374f97 55%, #1f3168 100%)'
const GRAD_COVER    = 'linear-gradient(160deg, #060d1f 0%, #0f1e42 42%, #0a152e 100%)'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Profile summary card
// ---------------------------------------------------------------------------
function profileCardHtml(facts: ZenPrintProfileFacts): string {
  const kv = (k: string, v: string) =>
    `<div class="zen-profile-kv"><span class="zen-profile-k">${escapeHtml(k)}</span><span class="zen-profile-v">${escapeHtml(v)}</span></div>`

  const zoneRow = (
    label: string,
    z: { score: string; status: string } | undefined,
    barGrad: string,
    accentColor: string
  ) => {
    if (!z) return ''
    return `<div class="zen-profile-zone" style="border-left:3px solid ${accentColor};background:${accentColor}18">
      <span class="zen-profile-zl" style="color:${accentColor}">${escapeHtml(label)}</span>
      <span class="zen-profile-zs">${escapeHtml(z.score)}</span>
      <span class="zen-profile-zst">${escapeHtml(z.status)}</span>
    </div>`
  }

  const rows: string[] = []
  if (facts.age?.trim())          rows.push(kv('Age', facts.age.trim()))
  if (facts.gender?.trim())       rows.push(kv('Gender', facts.gender.trim()))
  if (facts.totalScore?.trim())   rows.push(kv('Total score', facts.totalScore.trim()))
  if (facts.overallStatus?.trim()) rows.push(kv('Overall status', facts.overallStatus.trim()))

  rows.push(zoneRow('Balance', facts.balance, GRAD_BALANCE, '#374f97'))
  rows.push(zoneRow('Blossom', facts.blossom, GRAD_BLOSSOM, '#8b3a6a'))
  rows.push(zoneRow('Bliss',   facts.bliss,   GRAD_BLISS,   '#2d6b52'))

  const inner = rows.filter(Boolean).join('')
  if (!inner) return ''
  return `<section class="zen-profile-card">${inner}</section>`
}

// ---------------------------------------------------------------------------
// Section wrapper helpers
// ---------------------------------------------------------------------------

/** Renders a major section (ritual / plan) that always starts on a fresh page */
function sectionPageBreak(
  title: string,
  barGrad: string,
  innerHtml: string
): string {
  if (!innerHtml.trim()) return ''
  return `
  <section class="zen-section zen-page-break">
    <div class="zen-section-bar" style="background:${barGrad}">
      <h2 class="zen-section-bar-title">${escapeHtml(title)}</h2>
    </div>
    <div class="zen-section-body">${innerHtml}</div>
  </section>`
}

/** Renders a normal content section (no forced page break) */
function sectionInline(
  title: string,
  barGrad: string,
  innerHtml: string
): string {
  if (!innerHtml.trim()) return ''
  return `
  <section class="zen-section">
    <div class="zen-section-bar" style="background:${barGrad}">
      <h2 class="zen-section-bar-title">${escapeHtml(title)}</h2>
    </div>
    <div class="zen-section-body">${innerHtml}</div>
  </section>`
}

// ---------------------------------------------------------------------------
// Full HTML document builder
// ---------------------------------------------------------------------------
function buildFullHtmlDocument(payload: ZenPlanPrintPayload): string {
  const title       = payload.documentTitle?.trim() || 'Wellness Report — Zen Space'
  const reportRaw   = payload.reportHtml || ''
  const finalRaw    = payload.finalNarrativeHtml || ''
  const ritualRaw   = payload.ritualHtml || ''
  const planRaw     = payload.planHtml || ''

  const coverName  = payload.clientDisplayName?.trim() || 'Your'
  const coverTitle = coverName === 'Your'
    ? 'Wellness Report'
    : `${escapeHtml(coverName)}\u2019s Wellness Report`
  const dateLine = payload.reportDateLabel?.trim()

  const wellnessParsed  = parseWellnessReportHtml(reportRaw)
  const preambleHtml    = wellnessParsed.preambleHtml.trim()
  const wellnessBody    = wellnessParsed.html.trim()
  const hasReport       = reportRaw.trim().length > 0

  const finalInner   = finalRaw.trim()   ? parseFinalNarrativeHtml(finalRaw)          : ''
  const ritualInner  = ritualRaw.trim()  ? parseFourfoldRitualHtml(ritualRaw).html     : ''
  const planInner    = planRaw.trim()    ? parsePlanHtmlForPrint(planRaw)              : ''

  const profileBlock   = payload.profileFacts ? profileCardHtml(payload.profileFacts) : ''

  // Preamble block (shown when there's no structured profile card)
  const usePreambleCard = Boolean(preambleHtml) && !payload.profileFacts
  const preambleBlock   = usePreambleCard
    ? `<div class="zen-preamble zen-prose">${preambleHtml}</div>`
    : ''

  const wellnessSection = (hasReport && wellnessBody)
    ? `<section class="zen-wellness-section">${wellnessBody}</section>`
    : ''

  // Final narrative — inline (no page break) below report
  const finalSection = finalInner.trim()
    ? sectionInline('Final narrative', GRAD_DEEP, finalInner)
    : ''

  // Ritual and plan always start on a new page
  const ritualSection = ritualInner.trim()
    ? sectionPageBreak('Fourfold Zen Ritual', GRAD_PRIMARY, ritualInner)
    : ''

  const planSection = planInner.trim()
    ? sectionPageBreak(
        '18-Week Wellness Plan',
        GRAD_PRIMARY,
        `<div class="zen-plan-prose">${planInner}</div>`
      )
    : ''

  const bodyInner = [
    profileBlock,
    preambleBlock,
    wellnessSection,
    finalSection,
    ritualSection,
    planSection,
  ]
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n')

  const empty = !bodyInner.trim()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* ── Reset & base ─────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: Georgia, 'Times New Roman', ui-serif, serif;
      font-size: 10.8pt;
      line-height: 1.68;
      color: #2c2820;
      background: #f8f7f5;
      width: ${PAGE_W_CSS}px;
    }

    /* ── Layout wrapper ────────────────────────────────────────────────── */
    .zen-wrap {
      max-width: 680px;
      margin: 0 auto;
      padding: 0 8px 40px;
    }

    /* ── Cover ─────────────────────────────────────────────────────────── */
    .zen-cover {
      background: ${GRAD_COVER};
      border-radius: 14px;
      padding: 2.8rem 2rem 2.4rem;
      margin-bottom: 1.4rem;
      text-align: center;
      color: #f0f4ff;
    }
    .zen-cover-eyebrow {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.6rem;
      letter-spacing: 0.45em;
      text-transform: uppercase;
      color: rgba(180, 200, 255, 0.75);
      margin-bottom: 0.7rem;
    }
    .zen-cover-title {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #ffffff;
      line-height: 1.2;
      margin-bottom: 0.4rem;
    }
    .zen-cover-sub {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.82rem;
      color: rgba(180, 200, 255, 0.8);
      margin-top: 0.5rem;
    }
    .zen-cover-date {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.78rem;
      color: rgba(160, 185, 255, 0.72);
      margin-top: 0.3rem;
    }
    .zen-cover-divider {
      width: 48px;
      height: 2px;
      background: rgba(180, 200, 255, 0.35);
      margin: 0.8rem auto;
      border-radius: 2px;
    }

    /* ── Profile summary card ──────────────────────────────────────────── */
    .zen-profile-card {
      background: #ffffff;
      border: 1px solid #e4e0d8;
      border-radius: 10px;
      padding: 0.9rem 1rem;
      margin-bottom: 1.1rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 0.5rem 1rem;
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.8rem;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .zen-profile-kv { display: flex; flex-direction: column; gap: 0.1rem; }
    .zen-profile-k {
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #8a837a;
    }
    .zen-profile-v { font-weight: 700; color: #1e1c18; font-size: 0.82rem; }
    .zen-profile-zone {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.3rem 0.7rem;
      padding: 0.32rem 0.6rem;
      border-radius: 6px;
      margin-top: 0.1rem;
    }
    .zen-profile-zl {
      font-weight: 700;
      font-size: 0.75rem;
      min-width: 4.2rem;
    }
    .zen-profile-zs { font-size: 0.78rem; font-variant-numeric: tabular-nums; color: #2c2820; }
    .zen-profile-zst { font-size: 0.73rem; color: #8a837a; }

    /* ── Preamble ──────────────────────────────────────────────────────── */
    .zen-preamble {
      background: #ffffff;
      border: 1px solid #e4e0d8;
      border-radius: 10px;
      padding: 0.85rem 1rem;
      margin-bottom: 0.8rem;
    }

    /* ── Section wrapper ────────────────────────────────────────────────── */
    .zen-section { margin-bottom: 0.5rem; }
    .zen-page-break {
      break-before: page;
      page-break-before: always;
    }
    /* Section bar is a standalone rounded header pill */
    .zen-section-bar {
      /* background set inline per section */
      border-radius: 9px;
      padding: 0.65rem 1rem 0.6rem;
      margin-bottom: 0.45rem;
    }
    .zen-section-bar-title {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.96);
      margin: 0;
    }
    /* Section body is a transparent wrapper — visual cards come from inner elements */
    .zen-section-body {
      background: transparent;
      padding: 0;
    }

    /* ── Wellness report inner blocks ─────────────────────────────────── */
    .zen-wellness-section { margin-bottom: 0.5rem; }
    .zen-print-wellness-inner { display: flex; flex-direction: column; gap: 0.45rem; }

    /* Each zone/concern block */
    .zen-print-block {
      border-radius: 9px;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .zen-print-bar {
      padding: 0.6rem 1rem;
      /* gradient set inline or by class */
    }
    .zen-print-bar-title {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.96);
      margin: 0;
    }
    /* Override class-based bars with inline gradients */
    .zen-bar-c4 { background: ${GRAD_PRIMARY}; }
    .zen-bar-c1 { background: ${GRAD_BALANCE}; }
    .zen-bar-c2 { background: ${GRAD_BLOSSOM}; }
    .zen-bar-c3 { background: ${GRAD_BLISS}; }

    /* Panel inside a print-block (bar + panel = one card unit) */
    .zen-print-panel {
      background: #ffffff;
      border: 1px solid #e4e0d8;
      border-top: none;
      border-radius: 0 0 9px 9px;
      padding: 0.85rem 1rem 0.9rem;
    }
    /* When panel is a direct child of section-body (final narrative), make it a full card */
    .zen-section-body > .zen-print-panel,
    .zen-section-body > .zen-print-prose {
      border-radius: 9px;
      border-top: 1px solid #e4e0d8;
    }
    .zen-print-block .zen-print-bar { border-radius: 9px 9px 0 0; margin-bottom: 0; }
    .zen-print-block .zen-print-bar + .zen-print-panel { border-radius: 0 0 9px 9px; }

    /* Gentle suggestions tinted strip */
    .zen-print-suggestions {
      border: 1px solid #e4e0d8;
      border-top: none;
      border-radius: 0 0 9px 9px;
      padding: 0.65rem 1rem 0.75rem;
    }
    .zen-print-suggestions-c1 { background: #eceef7; border-color: rgba(55,79,151,0.22); }
    .zen-print-suggestions-c2 { background: #f4eef2; border-color: rgba(139,58,106,0.22); }
    .zen-print-suggestions-c3 { background: #eaf1ee; border-color: rgba(45,107,82,0.22); }

    /* Affirmations box */
    .zen-print-affirmations {
      margin-top: 0.55rem;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      border: 1px solid rgba(81,152,202,0.38);
      background: #f0f6fb;
    }
    .zen-print-affirmations > p:first-child,
    .zen-print-affirmations > h3:first-child,
    .zen-print-affirmations > h4:first-child { margin-top: 0; }

    /* Section body panel (wraps the whole parsed ritual/final content) */
    .zen-print-section-body { padding: 0; }
    .zen-print-section-body .zen-print-panel {
      border: 1px solid #e4e0d8;
      border-radius: 9px;
    }
    .zen-print-section-body .zen-print-block {
      margin-bottom: 0.4rem;
    }

    /* ── Prose typography ──────────────────────────────────────────────── */
    .zen-print-prose,
    .zen-prose {
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .zen-print-prose p, .zen-prose p {
      margin: 0 0 0.55rem;
      orphans: 3;
      widows: 3;
    }
    .zen-print-prose p:last-child, .zen-prose p:last-child { margin-bottom: 0; }
    .zen-print-prose ul, .zen-print-prose ol,
    .zen-prose ul, .zen-prose ol {
      margin: 0 0 0.55rem;
      padding-left: 1.2rem;
    }
    .zen-print-prose li, .zen-prose li {
      margin-bottom: 0.22rem;
      orphans: 2; widows: 2;
    }
    .zen-print-prose strong, .zen-prose strong { font-weight: 700; color: #1e1c18; }

    /* ── Wellness section headings (inner h2 / h3) ──────────────────────── */
    .zen-prose.report-html .zen-inner-h2 {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-weight: 700;
      font-size: 0.82rem;
      color: #1e1c18;
      margin: 1rem 0 0.4rem;
      line-height: 1.3;
      padding-bottom: 0.28rem;
      border-bottom: 1px solid #e4e0d8;
      break-after: avoid;
      page-break-after: avoid;
    }
    .zen-prose.report-html .zen-inner-h3 {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-weight: 600;
      font-size: 0.78rem;
      color: #3b3730;
      margin: 0.75rem 0 0.3rem;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* ── 18-week plan ───────────────────────────────────────────────────── */
    .zen-plan-prose {
      padding: 0.75rem 0.85rem 0.85rem;
    }
    .zen-phase-card {
      margin: 0.5rem 0 0.75rem;
      padding: 0.65rem 0.85rem 0.8rem;
      border-radius: 9px;
      border: 1px solid #e4e0d8;
      background: #ffffff;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .zen-phase-balance { border-color: rgba(55,79,151,0.32); background: #f4f5fb; }
    .zen-phase-blossom { border-color: rgba(139,58,106,0.32); background: #fbf4f8; }
    .zen-phase-bliss   { border-color: rgba(45,107,82,0.32);  background: #f3f9f6; }

    .zen-phase-card > h2 {
      margin-top: 0 !important;
      border-bottom: none !important;
      padding-left: 0 !important;
    }
    /* Phase heading colors */
    .zen-phase-balance .zen-inner-h2, .zen-phase-balance h2 { color: #1f3168 !important; }
    .zen-phase-blossom .zen-inner-h2, .zen-phase-blossom h2 { color: #5e2244 !important; }
    .zen-phase-bliss   .zen-inner-h2, .zen-phase-bliss   h2 { color: #1a4a3a !important; }

    /* Week pill — MUST use inline hex values so html2canvas renders reliably */
    h3.zen-day-heading {
      display: block;
      width: fit-content;
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-size: 0.62rem !important;
      font-weight: 800 !important;
      letter-spacing: 0.12em !important;
      text-transform: uppercase !important;
      color: #ffffff !important;
      padding: 0.3rem 0.75rem !important;
      border-radius: 999px !important;
      margin: 0.7rem 0 0.45rem !important;
      break-after: avoid;
      page-break-after: avoid;
    }
    /* Inline hex gradients — no CSS variable references */
    h3.zen-day-heading.zen-day-c1 {
      background: linear-gradient(135deg, #1f3168 0%, #374f97 55%, #283f84 100%) !important;
    }
    h3.zen-day-heading.zen-day-c2 {
      background: linear-gradient(135deg, #5e2244 0%, #8b3a6a 55%, #6b2e52 100%) !important;
    }
    h3.zen-day-heading.zen-day-c3 {
      background: linear-gradient(135deg, #1a4a3a 0%, #2d6b52 55%, #1f5742 100%) !important;
    }
    /* Phase-card headings within plan prose */
    .zen-plan-prose .zen-inner-h2 {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-weight: 700;
      font-size: 0.88rem;
      margin: 0.8rem 0 0.35rem;
      break-after: avoid;
      page-break-after: avoid;
    }
    .zen-plan-prose .zen-inner-h3 {
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
      font-weight: 600;
      font-size: 0.8rem;
      color: #3b3730;
      margin: 0.65rem 0 0.28rem;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* ── Empty state ───────────────────────────────────────────────────── */
    .zen-empty {
      text-align: center;
      color: #8a837a;
      padding: 2.5rem;
      font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body>
  <div class="zen-wrap">
    <header class="zen-cover">
      <div class="zen-cover-eyebrow">Zen Space · Wellness Report</div>
      <h1 class="zen-cover-title">${coverTitle}</h1>
      <div class="zen-cover-divider"></div>
      ${dateLine ? `<p class="zen-cover-date">${escapeHtml(dateLine)}</p>` : ''}
      <p class="zen-cover-sub">Confidential &middot; for your personal use</p>
    </header>
    ${
      empty
        ? `<p class="zen-empty">No printable content is available for this report yet.</p>`
        : bodyInner
    }
  </div>
</body>
</html>`
}

export { buildFullHtmlDocument }

// ---------------------------------------------------------------------------
// PDF generation constants
// ---------------------------------------------------------------------------
const PDF_W_MM = 210
const PDF_H_MM = 297
const MM_PER_CSS_PX = PDF_W_MM / PAGE_W_CSS
/** A4 page height in CSS pixels at PAGE_W_CSS width */
const PAGE_H_CSS = Math.round(PDF_H_MM / MM_PER_CSS_PX) // ≈ 1123 px
const RENDER_SCALE = 1.5

/**
 * Generates a PDF via html2canvas + jsPDF.
 *
 * Key improvements over the previous approach:
 *  1. Per-page html2canvas crop (y + height) — no single massive canvas that
 *     can clip the end of the document (18-week plan, etc.).
 *  2. DOM-based page-break detection — uses actual element bottom edges
 *     rather than pixel row scanning, giving cleaner cuts.
 *  3. Forced breaks — elements with class `.zen-page-break` (ritual, plan)
 *     always start at the top of a fresh page, matching CSS `break-before: page`.
 *  4. Header bars excluded from cut candidates — never orphans a section title
 *     at the bottom of a page.
 */
export async function downloadZenPlanPdf(
  payload: ZenPlanPrintPayload
): Promise<{ ok: boolean; error?: string }> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    `position:fixed;left:0;top:0;width:${PAGE_W_CSS}px;height:1px;` +
    'border:none;opacity:0;pointer-events:none;z-index:-9999'
  document.body.appendChild(iframe)

  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ])

    const html = buildFullHtmlDocument(payload)

    await new Promise<void>(resolve => {
      const iDoc = iframe.contentDocument!
      const onLoad = () => resolve()
      iframe.addEventListener('load', onLoad, { once: true })
      iDoc.open()
      iDoc.write(html)
      iDoc.close()
      if (iDoc.readyState === 'complete') {
        iframe.removeEventListener('load', onLoad)
        resolve()
      }
    })

    // Allow fonts and layout to fully settle
    await new Promise<void>(r => setTimeout(r, 120))
    const iDoc = iframe.contentDocument!
    const scrollH = Math.max(
      iDoc.documentElement.scrollHeight,
      iDoc.body.scrollHeight,
      PAGE_H_CSS
    )
    // Expand to full height so getBoundingClientRect() returns correct positions
    iframe.style.height = `${scrollH}px`
    await new Promise<void>(r => setTimeout(r, 60))

    // ── Forced break positions ──────────────────────────────────────────
    // Elements with .zen-page-break MUST start at the top of a new page.
    // We record their TOP (not bottom) so we can cut right before them.
    const forcedBreakTops: number[] = Array.from(
      iDoc.querySelectorAll('.zen-page-break')
    )
      .map(el => Math.ceil((el as HTMLElement).getBoundingClientRect().top))
      .filter(y => y > 20 && y < scrollH)
      .sort((a, b) => a - b)

    // ── Soft cut candidates ─────────────────────────────────────────────
    // Collect bottom edges of block elements that are safe to cut after.
    // Deliberately excludes .zen-section-bar and .zen-print-bar (header bars)
    // so we never orphan a section title at the bottom of a page.
    const cutCandidates: number[] = Array.from(
      iDoc.querySelectorAll(
        '.zen-print-block, .zen-phase-card, .zen-section, ' +
        '.zen-profile-card, .zen-preamble, ' +
        'p, li, h2, h3'
      )
    )
      .filter(el => !el.classList.contains('zen-section-bar') && !el.classList.contains('zen-print-bar'))
      .map(el => (el as HTMLElement).getBoundingClientRect().bottom)
      .filter(y => y > 0 && y < scrollH)
      .sort((a, b) => a - b)

    /**
     * Find the best cut point near `targetY`.
     *
     * Priority 1: If a forced break element starts within this page range,
     *             cut RIGHT before it (so it always lands at page top).
     * Priority 2: Find the last block-element bottom edge between
     *             [searchFrom, targetY] as a clean paragraph boundary.
     */
    function findCutY(prevCut: number, targetY: number): number {
      // Priority 1 — forced break
      for (const fbTop of forcedBreakTops) {
        if (fbTop > prevCut && fbTop <= targetY) {
          return fbTop
        }
      }

      // Priority 2 — soft cut near a block boundary
      const minFill = prevCut + Math.floor(PAGE_H_CSS * 0.52)
      const searchFrom = Math.max(minFill, targetY - Math.floor(PAGE_H_CSS * 0.4))
      let best = targetY
      for (const bottom of cutCandidates) {
        if (bottom >= searchFrom && bottom <= targetY) {
          best = bottom + 2
        }
      }
      return Math.ceil(best)
    }

    // Build slice list
    const slices: Array<{ yStart: number; h: number }> = []
    let pos = 0
    while (pos < scrollH) {
      const remaining = scrollH - pos
      if (remaining <= PAGE_H_CSS) {
        slices.push({ yStart: pos, h: remaining })
        break
      }
      const cutY = findCutY(pos, pos + PAGE_H_CSS)
      const h = Math.max(cutY - pos, 10)
      slices.push({ yStart: pos, h })
      pos += h
    }

    // ── Render each page slice ───────────────────────────────────────────
    const pdf = new jsPDF('p', 'mm', 'a4')
    let firstPage = true

    for (const { yStart, h } of slices) {
      const pageCanvas = await html2canvas(iDoc.body, {
        scale: RENDER_SCALE,
        useCORS: true,
        backgroundColor: '#f8f7f5',
        logging: false,
        width: PAGE_W_CSS,
        windowWidth: PAGE_W_CSS,
        scrollX: 0,
        scrollY: 0,
        y: yStart,
        height: h,
      })

      if (!firstPage) pdf.addPage()
      firstPage = false

      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.94),
        'JPEG',
        0,
        0,
        PDF_W_MM,
        h * MM_PER_CSS_PX
      )
    }

    const clientName = (payload.clientDisplayName ?? '').trim()
    const safeName = clientName.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    const filename = safeName
      ? `${safeName}-Wellness-Report.pdf`
      : 'Wellness-Report.pdf'
    pdf.save(filename)

    return { ok: true }
  } catch (err) {
    console.error('[downloadZenPlanPdf]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'PDF generation failed',
    }
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }
}

/**
 * Opens a hidden document and triggers the browser print dialog (Save as PDF).
 * CSS page-break rules fully respected; no html2canvas involved.
 */
export function printZenPlanPdf(payload: ZenPlanPrintPayload): void {
  const html = buildFullHtmlDocument(payload)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }

  const runPrint = () => {
    try {
      win.focus()
      win.print()
    } finally {
      win.addEventListener('afterprint', cleanup, { once: true })
      setTimeout(cleanup, 60_000)
    }
  }

  if (doc.readyState === 'complete') {
    setTimeout(runPrint, 50)
  } else {
    iframe.onload = () => setTimeout(runPrint, 50)
  }
}
