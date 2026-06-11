import type { ComponentType } from 'react'
import {
  Brain,
  Compass,
  Moon,
  Sparkles,
  Sprout,
  Waves,
  type LucideProps,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReportBody } from '@/components/ReportBody'
import type { ReportDisplayPart } from '@/lib/resolveReportSections'

/**
 * One calm accent family (the app's violet/blue primary) across every step.
 * Steps are told apart by their icon and step number, not by colour.
 */
const RITUAL_ICON: Record<string, ComponentType<LucideProps>> = {
  explain: Compass,
  somatic: Waves,
  mental: Brain,
  daily: Sprout,
  reflect: Moon,
  legacy: Sparkles,
}

/** Step number badge for the four ritual steps (explain/legacy have none). */
const RITUAL_STEP: Record<string, string> = {
  somatic: '1',
  mental: '2',
  daily: '3',
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
    <div className={className ?? 'space-y-4'}>
      {parts.map(part => {
        const step = RITUAL_STEP[part.id]
        const Icon = RITUAL_ICON[part.id] ?? Sparkles
        const isFoundation = part.id === 'explain'

        return (
          <section
            key={part.id}
            className={cn(
              'overflow-hidden rounded-2xl zen-glass-card',
              isFoundation ? 'zen-ring-primary' : 'zen-ring-secondary'
            )}
          >
            {/* Foundation step gets a thin accent bar to anchor the ritual */}
            {isFoundation && (
              <div className="h-1 w-full bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca]" />
            )}

            {part.id !== 'legacy' ? (
              <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
                <span
                  className={cn(
                    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    isFoundation
                      ? 'bg-gradient-to-br from-[#5198ca] to-[#337cca] text-white shadow-sm'
                      : 'bg-[rgb(167_139_250/0.14)] text-violet-200'
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {step && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#337cca] text-[9px] font-bold text-white ring-2 ring-black/40">
                      {step}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  {step && (
                    <span className="block text-[10px] font-medium uppercase tracking-widest text-violet-300/80">
                      Step {step}
                    </span>
                  )}
                  <h2 className="truncate text-sm font-semibold tracking-wide text-foreground">
                    {part.title}
                  </h2>
                </div>
              </header>
            ) : null}

            {/* Step body */}
            <div className="px-5 py-4">
              <ReportBody content={part.html} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
