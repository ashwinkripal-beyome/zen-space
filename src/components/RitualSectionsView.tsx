import { cn } from '@/lib/utils'
import { ReportBody } from '@/components/ReportBody'
import type { ReportDisplayPart } from '@/lib/resolveReportSections'

/** Gradient header bar colour per ritual step */
const RITUAL_BAR: Record<string, string> = {
  explain: 'bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca]',
  somatic: 'bg-gradient-to-r from-[#1f3168] via-[#374f97] to-[#283f84]',
  mental:  'bg-gradient-to-r from-[#5e2244] via-[#8b3a6a] to-[#6b2e52]',
  daily:   'bg-gradient-to-r from-[#1a4a3a] via-[#2d6b52] to-[#1f5742]',
  reflect: 'bg-gradient-to-r from-[#2d4795] via-[#374f97] to-[#1f3168]',
  legacy:  'bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca]',
}
const DEFAULT_RITUAL_BAR = 'bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca]'

/** Left-border accent tint on the body per ritual step */
const RITUAL_BODY_BORDER: Record<string, string> = {
  somatic: 'border-l-2 border-[#374f97]',
  mental:  'border-l-2 border-[#8b3a6a]',
  daily:   'border-l-2 border-[#2d6b52]',
  reflect: 'border-l-2 border-[#374f97]',
}

/** Step number badge (empty string = no badge) */
const RITUAL_STEP: Record<string, string> = {
  somatic: '1',
  mental:  '2',
  daily:   '3',
  reflect: '4',
}

export function RitualSectionsView({
  parts,
  className,
}: {
  parts: ReportDisplayPart[]
  className?: string
}) {
  if (parts.length === 0) {
    return null
  }

  return (
    <div className={className ?? 'space-y-3'}>
      {parts.map(part => {
        const step = RITUAL_STEP[part.id]
        const headerBar = RITUAL_BAR[part.id] ?? DEFAULT_RITUAL_BAR
        const bodyBorder = RITUAL_BODY_BORDER[part.id] ?? ''

        return (
          <section
            key={part.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
          >
            {/* Gradient header bar */}
            {part.id !== 'legacy' ? (
              <div className={cn('flex items-center gap-2.5 px-4 py-2.5', headerBar)}>
                {step && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
                    {step}
                  </span>
                )}
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/95">
                  {part.title}
                </h2>
              </div>
            ) : null}

            {/* Step body */}
            <div className={cn('px-5 py-4', bodyBorder)}>
              <ReportBody content={part.html} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
