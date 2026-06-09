import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { type PlanTier, PLAN_META, PAID_TIERS } from '@/lib/planTiers'
import { startRazorpayCheckout } from '@/lib/razorpay'
import { generateClientPlanAfterPayment } from '@/lib/generateClientPlan'
import { cn } from '@/lib/utils'

type PlanSelectionCardsProps = {
  /** Currently active plan slug from profiles.current_plan (or null/undefined = free). */
  currentPlan?: string | null
  /** Restrict visible plans; defaults to all three. */
  visiblePlans?: PlanTier[]
  /** Called with the purchased plan slug after successful checkout + verification. */
  onPlanPurchased?: (plan: string) => void
}

export function PlanSelectionCards({
  currentPlan,
  visiblePlans = ['free', '18_week_semi_guided', 'one_on_one_intensive'],
  onPlanPurchased,
}: PlanSelectionCardsProps) {
  const { profile, refetchProfile } = useAuth()
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<PlanTier | null>(null)

  const activePlan = (currentPlan ?? 'free') as PlanTier

  const handleSelect = async (tier: PlanTier) => {
    if (!PAID_TIERS.includes(tier)) return
    if (tier === activePlan) return

    const clientName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      profile?.name ||
      profile?.email ||
      'Client'
    const clientEmail = profile?.email ?? ''

    setCheckingOut(tier)
    setCheckoutStatus(null)

    const result = await startRazorpayCheckout(
      tier as '18_week_semi_guided' | 'one_on_one_intensive',
      clientName,
      clientEmail,
      msg => setCheckoutStatus(msg)
    )

    setCheckingOut(null)
    setCheckoutStatus(null)

    if (!result.ok) {
      if (result.error !== 'Payment cancelled') {
        toast.error(result.error)
      }
      return
    }

    toast.success('Payment successful! Activating your plan…')
    refetchProfile()

    // For the 18-week semi-guided plan, auto-generate the plan immediately.
    if (result.plan === '18_week_semi_guided' && profile?.id) {
      setCheckoutStatus('Generating your 18-week plan… (3–5 min)')
      setCheckingOut(tier) // keep loading state visible
      const genResult = await generateClientPlanAfterPayment(profile.id, msg => setCheckoutStatus(msg))
      setCheckingOut(null)
      setCheckoutStatus(null)
      if (!genResult.ok) {
        toast.error(
          `Plan activated, but auto-generation failed: ${genResult.error}. Your therapist can generate it from their dashboard.`
        )
      } else {
        toast.success('Your 18-week plan is ready! Visit your Personal Plan page.')
      }
    }

    onPlanPurchased?.(result.plan)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {visiblePlans.map(tier => {
          const meta = PLAN_META[tier]
          const isActive = tier === activePlan || (tier === 'free' && !activePlan)
          const isLoading = checkingOut === tier

          return (
            <Card
              key={tier}
              className={cn(
                'zen-glass-card relative flex flex-col shadow-none transition-all duration-200',
                isActive
                  ? 'ring-2 ring-emerald-400/50'
                  : 'ring-0 hover:ring-1 hover:ring-white/20',
                tier === '18_week_semi_guided' && !isActive && 'border-sky-400/20'
              )}
            >
              {isActive && (
                <div className="absolute right-3 top-3">
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    Current plan
                  </span>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {meta.tagline}
                </div>
                <CardTitle className="text-xl text-foreground">{meta.label}</CardTitle>
                <div className="text-2xl font-bold text-foreground">{meta.priceLabel}</div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <ul className="space-y-2">
                  {meta.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                {meta.requiresPayment && !isActive && (
                  <Button
                    type="button"
                    variant={tier === '18_week_semi_guided' ? 'zen' : 'zenRose'}
                    className="w-full"
                    disabled={isLoading || checkingOut !== null}
                    onClick={() => void handleSelect(tier)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                        {checkoutStatus ?? 'Processing…'}
                      </>
                    ) : (
                      `Get ${meta.label}`
                    )}
                  </Button>
                )}

                {!meta.requiresPayment && !isActive && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs text-muted-foreground">
                    Your current free plan
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {checkingOut && checkoutStatus && (
        <p className="text-center text-sm text-muted-foreground">{checkoutStatus}</p>
      )}
    </div>
  )
}
