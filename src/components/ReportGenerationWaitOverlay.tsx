import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ReportGenerationWaitVariant = 'report' | 'plan' | 'report-and-plan'

const WAIT_COPY: Record<
  ReportGenerationWaitVariant,
  { title: string; description: string; warning: string; ariaLabel: string }
> = {
  report: {
    title: 'Generating your Zen Plan report',
    description:
      'This step can take 3–4 minutes. Please stay on this screen and wait for it to finish.',
    warning:
      'Locking your device, sleeping the computer, or closing this tab or browser can interrupt report generation. If that happens, you may need to try again from your assessment or observations page.',
    ariaLabel: 'Generating report',
  },
  plan: {
    title: 'Generating 18-week plan & Fourfold ritual',
    description:
      'This step can take 3–4 minutes. Please stay on this client page and wait for it to finish.',
    warning:
      'Locking your device, sleeping the computer, or closing this tab or browser can interrupt plan generation. If that happens, use Fix report & plan on this page to try again.',
    ariaLabel: 'Generating plan',
  },
  'report-and-plan': {
    title: 'Regenerating report and plan',
    description:
      'This can take several minutes (often 4–6 minutes when both run). Please stay on this client page until it finishes.',
    warning:
      'Locking your device, sleeping the computer, or closing this tab or browser can interrupt generation. If that happens, use Fix report & plan on this page to try again.',
    ariaLabel: 'Regenerating report and plan',
  },
}

/**
 * Full-screen wait state while an edge function generates Zen Plan content.
 * Keeps users informed and discourages navigation away mid-request.
 */
export function ReportGenerationWaitOverlay({
  open,
  variant = 'report',
  className,
}: {
  open: boolean
  variant?: ReportGenerationWaitVariant
  className?: string
}) {
  const copy = WAIT_COPY[variant]
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  // Portal to body: layout panels use backdrop-blur, which makes `fixed` descendants
  // position against the panel (and overflow can hide them) instead of the viewport.
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center p-4',
        'bg-background/80 backdrop-blur-md',
        className
      )}
      role="alert"
      aria-live="polite"
      aria-busy="true"
      aria-label={copy.ariaLabel}
    >
      <div className="zen-glass-card zen-ring-primary w-full max-w-md space-y-6 rounded-2xl p-8 text-center shadow-xl ring-0">
        <div className="flex justify-center">
          <div className="relative flex size-[4.5rem] items-center justify-center">
            <span
              className="absolute inset-[-6px] rounded-full border-2 border-sky-400/35 motion-safe:animate-[spin_8s_linear_infinite]"
              aria-hidden
            />
            <span
              className="absolute inset-0 rounded-full bg-sky-400/15 motion-safe:animate-pulse motion-safe:duration-[2s]"
              aria-hidden
            />
            <Loader2 className="relative size-11 animate-spin text-sky-300" aria-hidden />
          </div>
        </div>

        <div className="space-y-3 text-foreground">
          <h2 className="text-xl font-semibold tracking-tight">{copy.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
          <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-left text-sm leading-relaxed text-amber-100/95">
            <span className="font-medium text-amber-50">Important:</span> {copy.warning}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
