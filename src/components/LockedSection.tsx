import { useState } from 'react'
import { Lock, Sparkles, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type LockedSectionProps = {
  title: string
  /** "free" → just reveal; "paid" → nudge to select a plan */
  unlockMode: 'free' | 'paid'
  ctaText?: string
  onUnlock?: () => void
  /** For paid mode: text to show after the CTA describing what plan unlocks it. */
  paidHint?: string
  className?: string
}

/**
 * Animated locked card that replaces a ritual section.
 * - free mode: click once to reveal with a shimmer animation.
 * - paid mode: CTA nudges the client to select a paid plan.
 */
export function LockedSection({
  title,
  unlockMode,
  ctaText,
  onUnlock,
  paidHint,
  className,
}: LockedSectionProps) {
  const [unlocking, setUnlocking] = useState(false)

  const handleUnlock = () => {
    if (unlockMode !== 'free' || !onUnlock) return
    setUnlocking(true)
    // Let the shimmer animation play before calling the parent.
    setTimeout(() => {
      onUnlock()
    }, 600)
  }

  const defaultCta =
    unlockMode === 'free'
      ? `Click here to unlock your ${title.toLowerCase()} for free`
      : `Unlock ${title} with a plan`

  return (
    <div className={cn('relative', className)}>
      <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] px-6 py-8 text-center transition-all duration-500',
          unlocking && 'animate-pulse-once'
        )}
      >
        {/* Shimmer overlay while unlocking */}
        {unlocking && (
          <div className="pointer-events-none absolute inset-0 animate-[shimmer_0.6s_ease-out_forwards] rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              'flex size-12 items-center justify-center rounded-full transition-all duration-300',
              unlockMode === 'free'
                ? 'border border-sky-400/30 bg-sky-500/10'
                : 'border border-violet-400/30 bg-violet-500/10'
            )}
          >
            {unlocking ? (
              <Unlock className="size-6 text-sky-300" aria-hidden />
            ) : (
              <Lock
                className={cn('size-6', unlockMode === 'free' ? 'text-sky-300' : 'text-violet-300')}
                aria-hidden
              />
            )}
          </div>

          <p className="text-sm font-medium text-muted-foreground">
            {ctaText ?? defaultCta}
          </p>

          {unlockMode === 'free' ? (
            <Button
              type="button"
              variant="zenOutline"
              size="sm"
              disabled={unlocking}
              onClick={handleUnlock}
              className="gap-1.5"
            >
              <Sparkles className="size-3.5 text-sky-300" aria-hidden />
              Unlock for free
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="zen"
                size="sm"
                onClick={onUnlock}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Select a plan to unlock
              </Button>
              {paidHint && (
                <p className="text-xs text-muted-foreground">{paidHint}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
