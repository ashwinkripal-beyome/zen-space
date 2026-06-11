import type { ComponentType } from 'react'
import {
  Activity,
  ClipboardList,
  Compass,
  FileText,
  Flower2,
  Layers,
  Scale,
  Sparkles,
  UserRound,
  type LucideProps,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReportBody } from '@/components/ReportBody'
import type { ReportDisplayPart } from '@/lib/resolveReportSections'

/**
 * One calm accent family (the app's violet/blue primary) across every section.
 * Sections are told apart by their icon, not by colour. The client-info card
 * gets an elevated "profile card" treatment so it reads as a card, not a text box.
 */
const SECTION_ICON: Record<string, ComponentType<LucideProps>> = {
  clientInfo: UserRound,
  keyConcerns: ClipboardList,
  currentState: Activity,
  balanceZone: Scale,
  blossomZone: Flower2,
  blissZone: Sparkles,
  integrated: Layers,
  final: Compass,
  legacy: FileText,
}

function iconFor(id: string): ComponentType<LucideProps> {
  return SECTION_ICON[id] ?? FileText
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
    <div className={className ?? 'space-y-4'}>
      {parts.map(part => {
        const Icon = iconFor(part.id)
        const isHero = part.id === 'clientInfo'

        return (
          <section
            key={part.id}
            className={cn(
              'overflow-hidden rounded-2xl zen-glass-card',
              isHero ? 'zen-ring-primary' : 'zen-ring-secondary'
            )}
          >
            {/* Thin accent bar on the hero (client) card only */}
            {isHero && (
              <div className="h-1 w-full bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca]" />
            )}

            {/* Section header — icon chip + title, one accent throughout */}
            <header
              className={cn(
                'flex items-center gap-3 border-b border-white/10 px-5',
                isHero ? 'py-4' : 'py-3.5'
              )}
            >
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-xl',
                  isHero
                    ? 'h-10 w-10 bg-gradient-to-br from-[#5198ca] to-[#337cca] text-white shadow-sm'
                    : 'h-9 w-9 bg-[rgb(167_139_250/0.14)] text-violet-200'
                )}
              >
                <Icon className={isHero ? 'size-5' : 'size-[18px]'} aria-hidden />
              </span>
              <h2
                className={cn(
                  'font-semibold text-foreground',
                  isHero ? 'text-base' : 'text-sm tracking-wide'
                )}
              >
                {part.title}
              </h2>
            </header>

            {/* Section body */}
            <div className="px-5 py-4">
              <ReportBody content={part.html} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
