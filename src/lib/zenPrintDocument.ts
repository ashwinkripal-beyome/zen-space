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
  /** Cover: first name or full name for “{Name}'s Wellness Report” */
  clientDisplayName?: string
  /** Cover: e.g. “20th April 2026” */
  reportDateLabel?: string
  /** Profile summary card (age, gender, scores) */
  profileFacts?: ZenPrintProfileFacts
}

export type { ZenPrintProfileFacts }

/** Matches assessment swipe cards: Balance / Blossom / Bliss */
const SWIPE_BALANCE = 'linear-gradient(to bottom right, #1f3168, #374f97, #283f84)'
const SWIPE_BLOSSOM = 'linear-gradient(to bottom right, #5e2244, #8b3a6a, #6b2e52)'
const SWIPE_BLISS = 'linear-gradient(to bottom right, #1a4a3a, #2d6b52, #1f5742)'

/** Primary Zen blue (Colour 4) — aligned with src/styles/zen-tokens.css */
const ZEN_C4_FROM = '#5198ca'
const ZEN_C4_VIA = '#3398ca'
const ZEN_C4_TO = '#337cca'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function profileCardHtml(facts: ZenPrintProfileFacts): string {
  const rows: string[] = []
  if (facts.age?.trim()) {
    rows.push(
      `<div class="zen-profile-kv"><span class="zen-profile-k">Age</span><span class="zen-profile-v">${escapeHtml(facts.age.trim())}</span></div>`
    )
  }
  if (facts.gender?.trim()) {
    rows.push(
      `<div class="zen-profile-kv"><span class="zen-profile-k">Gender</span><span class="zen-profile-v">${escapeHtml(facts.gender.trim())}</span></div>`
    )
  }
  if (facts.totalScore?.trim()) {
    rows.push(
      `<div class="zen-profile-kv"><span class="zen-profile-k">Total score</span><span class="zen-profile-v">${escapeHtml(facts.totalScore.trim())}</span></div>`
    )
  }
  if (facts.overallStatus?.trim()) {
    rows.push(
      `<div class="zen-profile-kv"><span class="zen-profile-k">Overall status</span><span class="zen-profile-v">${escapeHtml(facts.overallStatus.trim())}</span></div>`
    )
  }
  const zoneRow = (
    label: string,
    z: { score: string; status: string } | undefined,
    cls: string
  ) => {
    if (!z) return ''
    return `<div class="zen-profile-zone ${cls}"><span class="zen-profile-zl">${label}</span><span class="zen-profile-zs">${escapeHtml(z.score)}</span><span class="zen-profile-zst">${escapeHtml(z.status)}</span></div>`
  }
  rows.push(zoneRow('Balance', facts.balance, 'zen-z1'))
  rows.push(zoneRow('Blossom', facts.blossom, 'zen-z2'))
  rows.push(zoneRow('Bliss', facts.bliss, 'zen-z3'))

  const inner = rows.filter(Boolean).join('')
  if (!inner) return ''
  return `
  <section class="zen-profile-card" aria-label="Profile summary">
    ${inner}
  </section>`
}

function sectionC4(title: string, innerHtml: string, opts?: { breakBefore?: boolean }): string {
  if (!innerHtml.trim()) return ''
  const br = opts?.breakBefore ? ' zen-part-break' : ''
  return `
  <section class="zen-part${br}">
    <div class="zen-print-bar zen-bar-c4"><h2 class="zen-print-bar-title">${escapeHtml(title)}</h2></div>
    <div class="zen-print-section-body">${innerHtml}</div>
  </section>`
}

function buildFullHtmlDocument(payload: ZenPlanPrintPayload): string {
  const title = payload.documentTitle?.trim() || 'Wellness Report — Zen Space'
  const reportRaw = payload.reportHtml || ''
  const finalRaw = payload.finalNarrativeHtml || ''
  const ritualRaw = payload.ritualHtml || ''
  const planRaw = payload.planHtml || ''

  const coverName = payload.clientDisplayName?.trim() || 'Your'
  const coverTitle =
    coverName === 'Your' ? 'Wellness Report' : `${escapeHtml(coverName)}'s Wellness Report`
  const dateLine = payload.reportDateLabel?.trim()

  const wellnessParsed = parseWellnessReportHtml(reportRaw)
  const preambleHtml = wellnessParsed.preambleHtml.trim()
  const usePreambleCard = Boolean(preambleHtml) && !payload.profileFacts
  const wellnessBody = wellnessParsed.html.trim()
  const hasReport = reportRaw.trim().length > 0

  const finalInner = finalRaw.trim() ? parseFinalNarrativeHtml(finalRaw) : ''
  const ritualInner = ritualRaw.trim() ? parseFourfoldRitualHtml(ritualRaw).html : ''
  const planInner = planRaw.trim() ? parsePlanHtmlForPrint(planRaw) : ''

  const profileBlock = payload.profileFacts ? profileCardHtml(payload.profileFacts) : ''

  const preambleBlock =
    usePreambleCard && preambleHtml
      ? `
  <section class="zen-part">
    <div class="zen-print-panel zen-print-prose zen-print-preamble">${preambleHtml}</div>
  </section>`
      : ''

  const wellnessSection =
    hasReport && wellnessBody
      ? `
  <section class="zen-part zen-wellness-report">
    ${wellnessBody}
  </section>`
      : ''

  const finalSection = finalInner.trim()
    ? sectionC4('Final narrative', finalInner, { breakBefore: true })
    : ''
  const ritualSection = ritualInner.trim()
    ? sectionC4('Fourfold Zen Ritual', ritualInner, { breakBefore: true })
    : ''
  const planSection = planInner.trim()
    ? sectionC4('18-Week Plan', `<div class="zen-prose zen-plan-prose report-html">${planInner}</div>`, {
        breakBefore: true,
      })
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
    :root {
      --zen-ink: #2a2620;
      --zen-body: #3d3830;
      --zen-muted: #6b655a;
      --zen-line: #e8e4dc;
      --zen-paper: #faf9f7;
      --zen-c4-from: ${ZEN_C4_FROM};
      --zen-c4-via: ${ZEN_C4_VIA};
      --zen-c4-to: ${ZEN_C4_TO};
      --zen-c4-grad: linear-gradient(135deg, var(--zen-c4-from) 0%, var(--zen-c4-via) 52%, var(--zen-c4-to) 100%);
      --swipe-balance: ${SWIPE_BALANCE};
      --swipe-blossom: ${SWIPE_BLOSSOM};
      --swipe-bliss: ${SWIPE_BLISS};
    }
    @page {
      margin: 14mm 12mm;
    }
    * {
      box-sizing: border-box;
    }
    html {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: ui-serif, Georgia, 'Times New Roman', serif;
      font-size: 10.8pt;
      line-height: 1.62;
      color: var(--zen-body);
      background: var(--zen-paper);
    }
    .zen-wrap {
      max-width: min(42rem, 170mm);
      margin: 0 auto;
      padding: 0 0 2rem;
    }
    .zen-cover {
      text-align: center;
      padding: 1.35rem 1.1rem 1.25rem;
      margin-bottom: 1rem;
      border-radius: 12px;
      background: var(--zen-c4-grad);
      color: #f8fafc;
      break-after: avoid;
      page-break-after: avoid;
    }
    .zen-logo-line {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.62rem;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.88);
      margin-bottom: 0.45rem;
    }
    .zen-doc-title {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 1.45rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #fff;
      margin: 0;
      line-height: 1.25;
    }
    .zen-doc-sub {
      margin: 0.55rem 0 0;
      font-size: 0.82rem;
      color: rgba(255, 255, 255, 0.9);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .zen-doc-date {
      margin: 0.35rem 0 0;
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.85);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .zen-profile-card {
      background: #fff;
      border: 1px solid var(--zen-line);
      border-radius: 10px;
      padding: 0.85rem 1rem 0.95rem;
      margin-bottom: 1rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
      gap: 0.45rem 1rem;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.82rem;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .zen-profile-kv {
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
    }
    .zen-profile-k {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--zen-muted);
    }
    .zen-profile-v {
      font-weight: 600;
      color: var(--zen-ink);
    }
    .zen-profile-zone {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem 0.75rem;
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
      margin-top: 0.15rem;
    }
    .zen-profile-zone.zen-z1 {
      background: linear-gradient(90deg, rgba(31, 49, 104, 0.12), transparent);
      border-left: 3px solid #374f97;
    }
    .zen-profile-zone.zen-z2 {
      background: linear-gradient(90deg, rgba(94, 34, 68, 0.1), transparent);
      border-left: 3px solid #8b3a6a;
    }
    .zen-profile-zone.zen-z3 {
      background: linear-gradient(90deg, rgba(26, 74, 58, 0.1), transparent);
      border-left: 3px solid #2d6b52;
    }
    .zen-profile-zl {
      font-weight: 600;
      color: var(--zen-ink);
      min-width: 4rem;
    }
    .zen-profile-zs {
      font-variant-numeric: tabular-nums;
    }
    .zen-profile-zst {
      color: var(--zen-muted);
      font-size: 0.78rem;
    }
    .zen-part {
      margin-bottom: 0.35rem;
    }
    .zen-part-break {
      break-before: page;
      page-break-before: always;
    }
    .zen-print-bar {
      padding: 0.55rem 1rem;
      break-after: avoid;
      page-break-after: avoid;
      border-radius: 8px 8px 0 0;
    }
    .zen-print-bar-title {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.98rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin: 0;
      line-height: 1.3;
    }
    .zen-bar-c4 {
      background: var(--zen-c4-grad);
      color: #f8fafc;
    }
    .zen-bar-c1 {
      background-image: var(--swipe-balance);
      color: #f5f7fc;
    }
    .zen-bar-c2 {
      background-image: var(--swipe-blossom);
      color: #fdf2f8;
    }
    .zen-bar-c3 {
      background-image: var(--swipe-bliss);
      color: #f0fdf6;
    }
    .zen-print-block {
      margin-bottom: 0.75rem;
    }
    .zen-print-block .zen-print-bar {
      border-radius: 8px;
      margin-bottom: 0;
    }
    .zen-print-panel {
      background: #fff;
      border: 1px solid var(--zen-line);
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 0.85rem 1rem 1rem;
    }
    .zen-print-block .zen-print-panel {
      border-radius: 0 0 8px 8px;
    }
    .zen-print-suggestions {
      margin-top: 0;
      padding: 0.65rem 0.85rem 0.8rem;
      border: 1px solid var(--zen-line);
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    .zen-print-suggestions-c1 {
      background: color-mix(in srgb, #374f97 12%, #fff);
      border-color: rgba(55, 79, 151, 0.25);
    }
    .zen-print-suggestions-c2 {
      background: color-mix(in srgb, #8b3a6a 10%, #fff);
      border-color: rgba(139, 58, 106, 0.25);
    }
    .zen-print-suggestions-c3 {
      background: color-mix(in srgb, #2d6b52 10%, #fff);
      border-color: rgba(45, 107, 82, 0.25);
    }
    .zen-print-affirmations {
      margin-top: 0.5rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(81, 152, 202, 0.45);
      background: color-mix(in srgb, var(--zen-c4-from) 8%, #fff);
    }
    .zen-print-section-body .zen-print-panel {
      border-radius: 8px;
      border-top: 1px solid var(--zen-line);
    }
    .zen-print-section-body > .zen-plan-prose {
      margin-top: 0;
    }
    .zen-print-prose p,
    .zen-prose p {
      margin: 0 0 0.55rem;
    }
    .zen-print-prose ul,
    .zen-print-prose ol,
    .zen-prose ul,
    .zen-prose ol {
      margin: 0 0 0.6rem;
      padding-left: 1.1rem;
    }
    .zen-print-prose li,
    .zen-prose li {
      margin-bottom: 0.25rem;
    }
    .zen-print-prose strong,
    .zen-prose strong {
      font-weight: 600;
      color: var(--zen-ink);
    }
    .zen-wellness-report .zen-print-wellness-inner {
      margin-top: 0.25rem;
    }
    .zen-prose.report-html .zen-inner-h2 {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-weight: 600;
      color: var(--zen-ink);
      margin: 1rem 0 0.4rem;
      line-height: 1.3;
      font-size: 0.98rem;
      padding-bottom: 0.3rem;
      border-bottom: 1px solid #ebe8e2;
      break-after: avoid;
      page-break-after: avoid;
    }
    .zen-prose.report-html .zen-inner-h3 {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-weight: 600;
      font-size: 0.88rem;
      color: #3a3834;
      margin: 0.8rem 0 0.35rem;
      break-after: avoid;
      page-break-after: avoid;
    }
    .zen-phase-card {
      margin: 0.6rem 0 0.9rem;
      padding: 0.6rem 0.7rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--zen-line);
      background: #fff;
    }
    .zen-phase-card > h2 {
      margin-top: 0 !important;
      border-bottom: none !important;
      padding-left: 0 !important;
      border-left: none !important;
    }
    .zen-phase-balance {
      border-color: rgba(55, 79, 151, 0.28);
    }
    .zen-phase-blossom {
      border-color: rgba(139, 58, 106, 0.28);
    }
    .zen-phase-bliss {
      border-color: rgba(45, 107, 82, 0.28);
    }
    .zen-plan-prose.report-html {
      background: #fff;
    }
    .zen-print-affirmations > p:first-child,
    .zen-print-affirmations > h3:first-child,
    .zen-print-affirmations > h4:first-child {
      margin-top: 0;
    }
    .zen-phase-card.zen-phase-balance .zen-inner-h2,
    .zen-phase-card.zen-phase-balance h2 {
      color: #1f3168 !important;
    }
    .zen-phase-card.zen-phase-blossom .zen-inner-h2,
    .zen-phase-card.zen-phase-blossom h2 {
      color: #5e2244 !important;
    }
    .zen-phase-card.zen-phase-bliss .zen-inner-h2,
    .zen-phase-card.zen-phase-bliss h2 {
      color: #1a4a3a !important;
    }
    h3.zen-day-heading {
      display: inline-block;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.7rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.1em !important;
      text-transform: uppercase !important;
      color: #fff !important;
      padding: 0.26rem 0.6rem !important;
      border-radius: 999px !important;
      margin: 0.65rem 0 0.4rem !important;
      break-after: avoid;
      page-break-after: avoid;
    }
    h3.zen-day-heading.zen-day-c1 {
      background: var(--swipe-balance) !important;
    }
    h3.zen-day-heading.zen-day-c2 {
      background: var(--swipe-blossom) !important;
    }
    h3.zen-day-heading.zen-day-c3 {
      background: var(--swipe-bliss) !important;
    }
    .zen-empty {
      text-align: center;
      color: var(--zen-muted);
      padding: 2rem;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
  </style>
</head>
<body>
  <div class="zen-wrap">
    <header class="zen-cover">
      <div class="zen-logo-line">Zen Space</div>
      <h1 class="zen-doc-title">${coverTitle}</h1>
      ${dateLine ? `<p class="zen-doc-date">${escapeHtml(dateLine)}</p>` : ''}
      <p class="zen-doc-sub">Confidential · for your personal use</p>
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

/**
 * Opens a hidden document and triggers the browser print dialog (Save as PDF).
 * Does not use AI; content is rendered from stored HTML fragments.
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
