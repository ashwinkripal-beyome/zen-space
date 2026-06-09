import { cn } from '@/lib/utils'
import { ReportBody } from '@/components/ReportBody'
import type { ReportDisplayPart } from '@/lib/resolveReportSections'

/** Gradient header bar per section type */
const ZONE_BAR: Record<string, string> = {
  balanceZone: 'bg-gradient-to-r from-[#1f3168] via-[#374f97] to-[#283f84]',
  blossomZone: 'bg-gradient-to-r from-[#5e2244] via-[#8b3a6a] to-[#6b2e52]',
  blissZone:   'bg-gradient-to-r from-[#1a4a3a] via-[#2d6b52] to-[#1f5742]',
  integrated:  'bg-gradient-to-r from-[#2d4795] via-[#374f97] to-[#1f3168]',
  final:       'bg-gradient-to-r from-[#2d4795] via-[#374f97] to-[#1f3168]',
}
const DEFAULT_BAR = 'bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca]'

/** Subtle left-border tint on the body for zone sections */
const ZONE_BODY_BORDER: Record<string, string> = {
  balanceZone: 'border-l-2 border-[#374f97]',
  blossomZone: 'border-l-2 border-[#8b3a6a]',
  blissZone:   'border-l-2 border-[#2d6b52]',
}

function barClass(id: string) {
  return ZONE_BAR[id] ?? DEFAULT_BAR
}

export function ReportSectionsView({
  parts,
  className,
}: {
  parts: ReportDisplayPart[]
  className?: string
}) {
  if (parts.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No report content available.</p>
  }

  return (
    <div className={className ?? 'space-y-3'}>
      {parts.map(part => (
        <section
          key={part.id}
          className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
        >
          {/* Gradient header bar */}
          <div className={cn('px-4 py-2.5', barClass(part.id))}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/95">
              {part.title}
            </h2>
          </div>

          {/* Section body */}
          <div
            className={cn(
              'px-5 py-4',
              ZONE_BODY_BORDER[part.id]
            )}
          >
            <ReportBody content={part.html} />
          </div>
        </section>
      ))}
    </div>
  )
}
