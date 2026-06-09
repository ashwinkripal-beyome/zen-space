import { useNavigate } from 'react-router-dom'
import { PlanSelectionCards } from '@/components/PlanSelectionCards'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { useAuth } from '@/hooks/useAuth'

export function ClientSubscriptionLockedPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const staggerVisible = usePageStaggerVisible(true)

  const handlePlanPurchased = (plan: string) => {
    if (plan === '18_week_semi_guided') {
      navigate('/app/client/plan')
    }
  }

  return (
    <div className="space-y-8">
      <div style={pageStaggerItemStyle(0, staggerVisible)}>
        <h1 className="text-3xl font-bold text-foreground">Choose your plan</h1>
        <p className="mt-2 text-muted-foreground">
          Select a plan to unlock your personalised Fourfold Zen Ritual and 18-week Zen Garden activity plan.
        </p>
      </div>

      <div style={pageStaggerItemStyle(1, staggerVisible)}>
        <PlanSelectionCards
          currentPlan={profile?.current_plan}
          onPlanPurchased={handlePlanPurchased}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground" style={pageStaggerItemStyle(2, staggerVisible)}>
        Payments are processed securely via Razorpay. Contact your Zen Garden therapist to pay by cash.
      </p>
    </div>
  )
}
