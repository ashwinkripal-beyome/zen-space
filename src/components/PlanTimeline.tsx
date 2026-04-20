import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { ReportBody } from '@/components/ReportBody'
import { ReportHtml } from '@/components/ReportHtml'

const ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'div']
const ALLOWED_ATTR = ['class', 'data-day']

function strip18DayNodes(root: HTMLElement) {
  const candidates = root.querySelectorAll('h1, h2, h3, h4, p, div')
  const toRemove: Element[] = []
  candidates.forEach(el => {
    const t = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (/^18[-–]?\s*DAY\s+PERSONALIZED\s+PLAN$/i.test(t)) {
      toRemove.push(el)
    }
  })
  toRemove.forEach(el => el.remove())
}

function parsePhases(html: string): { title: string; innerHtml: string }[] {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })
  const doc = new DOMParser().parseFromString(`<div id="plan-root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('plan-root')
  if (!root) return []

  strip18DayNodes(root)

  const phases: { title: string; nodes: Element[] }[] = []
  let current: { title: string; nodes: Element[] } = { title: '', nodes: [] }

  for (const node of [...root.children]) {
    if (node.tagName === 'H2') {
      if (current.nodes.length > 0 || current.title) {
        phases.push(current)
      }
      current = { title: node.textContent?.trim() ?? 'Phase', nodes: [] }
    } else {
      current.nodes.push(node as Element)
    }
  }
  if (current.nodes.length > 0 || current.title) {
    phases.push(current)
  }

  return phases.map(p => {
    const wrap = doc.createElement('div')
    p.nodes.forEach(n => wrap.appendChild(n.cloneNode(true)))
    return { title: p.title, innerHtml: wrap.innerHTML }
  })
}

export function PlanTimeline({
  html,
  id,
  className,
}: {
  html: string
  /** Optional id for print/PDF targeting */
  id?: string
  className?: string
}) {
  const phases = useMemo(() => parsePhases(html), [html])

  if (phases.length === 0) {
    return (
      <div id={id} className={className}>
        <ReportBody content={html} />
      </div>
    )
  }

  return (
    <div id={id} className={className}>
      <div className="relative pl-0 md:pl-1">
        <div
          className="absolute left-[5px] top-3 bottom-3 w-0.5 rounded-full bg-emerald-500/40 md:left-[7px]"
          aria-hidden
        />
        <div className="space-y-12">
          {phases.map((phase, i) => (
            <section key={i} className="relative pl-5 md:pl-8">
              <div
                className="absolute left-0 top-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]"
                aria-hidden
              />
              {phase.title ? (
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{phase.title}</h2>
              ) : null}
              {phase.innerHtml.trim() ? (
                <ReportHtml content={phase.innerHtml} className={phase.title ? 'mt-4' : undefined} />
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
