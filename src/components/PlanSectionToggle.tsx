import { type ComponentType } from 'react'
import { ChevronDown, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Collapsible section header for the plan page — mirrors the report-section
 * card style (icon chip + title on a frosted glass surface). The ritual uses
 * the app's violet/blue accent; the 18-week plan uses a subtle emerald chip to
 * tie into the green timeline below. Shared by the client and therapist plan
 * pages so both stay visually in sync.
 */
export function PlanSectionToggle({
  icon: Icon,
  title,
  subtitle,
  expanded,
  onClick,
  accent,
}: {
  icon: ComponentType<LucideProps>
  title: string
  subtitle: string
  expanded: boolean
  onClick: () => void
  accent: 'violet' | 'emerald'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors',
        'zen-glass-card zen-ring-secondary hover:bg-white/[0.08]'
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          accent === 'emerald'
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-[rgb(167_139_250/0.14)] text-violet-200'
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronDown
        className={cn(
          'size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
          expanded && 'rotate-180'
        )}
        aria-hidden
      />
    </button>
  )
}
