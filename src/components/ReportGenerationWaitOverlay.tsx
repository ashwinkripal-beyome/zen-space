import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Full-screen wait state while an edge function generates a Zen Plan report.
 * Keeps users informed and discourages navigation away mid-request.
 */
export function ReportGenerationWaitOverlay({
  open,
  className,
}: {
  open: boolean
  className?: string
}) {
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
      aria-label="Generating report"
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
          <h2 className="text-xl font-semibold tracking-tight">Generating your Zen Plan report</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This step can take <span className="font-medium text-foreground/90">3-4 minutes</span>. Please stay on
            this screen and wait for it to finish.
          </p>
          <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-left text-sm leading-relaxed text-amber-100/95">
            <span className="font-medium text-amber-50">Important:</span> Locking your device, sleeping the computer, or
            closing this tab or browser can interrupt report generation. If that happens, you may need to try again from
            your assessment or observations page.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
