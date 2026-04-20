import { useEffect, useState } from 'react'
import { type ImbalanceTier, imbalanceTier } from '@/lib/zenScoreLabels'
import { cn } from '@/lib/utils'

const tierBarGradient: Record<ImbalanceTier, string> = {
  low: 'from-sky-400/90 via-teal-400/90 to-emerald-400/95',
  mild: 'from-sky-400/90 via-teal-400/90 to-emerald-400/95',
  moderate: 'from-orange-600/95 via-orange-400/90 to-amber-300/90',
  high: 'from-fuchsia-600/95 via-red-500/90 to-rose-500/90',
}

function pctDirect(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / max) * 1000) / 10))
}

function pctWellness(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(((max - value) / max) * 1000) / 10))
}

export function AnimatedScoreMeter({
  value,
  max,
  variant = 'direct',
  className,
  barClassName,
  delayMs = 0,
}: {
  value: number
  max: number
  /** `wellness`: lower score = fuller bar; animates from full down to target. */
  variant?: 'direct' | 'wellness'
  className?: string
  barClassName?: string
  delayMs?: number
}) {
  const targetPct = variant === 'wellness' ? pctWellness(value, max) : pctDirect(value, max)
  const barGradient = tierBarGradient[imbalanceTier(value, max)]
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    setSettled(false)
    const t = window.setTimeout(() => setSettled(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs, value, max, variant])

  const widthPct = settled ? targetPct : variant === 'wellness' ? 100 : 0

  return (
    <div
      className={cn(
        /* Solid track colour — not paired light/dark utilities */
        'h-2.5 w-full overflow-hidden rounded-full bg-white/10',
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          barGradient,
          barClassName
        )}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  )
}
