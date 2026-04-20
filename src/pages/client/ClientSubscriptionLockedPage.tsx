import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'

export function ClientSubscriptionLockedPage() {
  const staggerVisible = usePageStaggerVisible(true)
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground" style={pageStaggerItemStyle(0, staggerVisible)}>
        Subscription
      </h1>
      <Card
        className="zen-glass-card-warm ring-0 shadow-none"
        style={pageStaggerItemStyle(1, staggerVisible)}
      >
        <CardHeader>
          <CardTitle>30-day plan locked</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Your therapist or an admin can activate a subscription for your account. No payment gateway in V1—access is
          assigned manually in Supabase (<code className="text-sky-200">subscriptions</code> table).
        </CardContent>
      </Card>
    </div>
  )
}
