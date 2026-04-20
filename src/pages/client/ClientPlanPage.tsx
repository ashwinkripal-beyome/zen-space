import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Download, Loader2 } from 'lucide-react'
import { PlanChecklist } from '@/components/PlanChecklist'
import { PlanTimeline } from '@/components/PlanTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'

export function ClientPlanPage() {
  const { user } = useAuth()
  const { hasTherapists, therapistResolutionPending } = useClientOnboarding()
  const [loading, setLoading] = useState(true)
  const [latestReport, setLatestReport] = useState<{
    id: string
    plan_section: string | null
  } | null>(null)
  const planContent = latestReport?.plan_section ?? null
  const reportId = latestReport?.id ?? null
  const staggerVisible = usePageStaggerVisible(!loading, planContent ? 'plan' : 'empty')

  const load = useCallback(async () => {
    if (!user?.id || hasTherapists !== true) {
      setLoading(false)
      return
    }
    setLoading(true)

    let { data, error } = await supabase
      .from('reports')
      .select('id, plan_section, content')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      const fallback = await supabase
        .from('reports')
        .select('id, content')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      data = fallback.data as typeof data
      error = fallback.error
    }

    if (error) {
      console.error(error)
      setLatestReport(null)
    } else if (data) {
      const row = data as Record<string, unknown>
      setLatestReport({
        id: String(row.id ?? ''),
        plan_section: (row.plan_section as string) || null,
      })
    }
    setLoading(false)
  }, [user?.id, hasTherapists])

  useEffect(() => {
    void load()
  }, [load])

  if (therapistResolutionPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading…</p>
      </div>
    )
  }

  if (hasTherapists === false) {
    return (
      <div className="space-y-6">
        <div style={pageStaggerItemStyle(0, true)}>
          <h1 className="text-3xl font-bold text-foreground">18-Day Plan</h1>
          <p className="mt-2 max-w-xl text-lg text-muted-foreground">
            Your 18-day plan is available once you&apos;re linked with a therapist in Zen Space.
          </p>
        </div>
        <Card className="zen-glass-card zen-ring-secondary ring-0 shadow-none" style={pageStaggerItemStyle(1, true)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CalendarDays className="size-5 text-sky-300" />
              Connect at Zen Garden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p className="text-pretty leading-relaxed">
              Link a Zen Specialist to your account to unlock your personalized plan. Visit your nearest Zen Garden and
              ask to connect with a Zen Specialist—they can help you get set up here.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading plan…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-4 print:hidden"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <h1 className="text-3xl font-bold text-foreground">18-Day Plan</h1>
        {planContent ? (
          <Button type="button" variant="zenOutline" size="sm" onClick={() => window.print()}>
            <Download className="mr-1.5 size-4" aria-hidden />
            Download PDF
          </Button>
        ) : null}
      </div>

      {planContent ? (
        <>
          <Card
            className="zen-glass-card zen-ring-primary ring-0 shadow-none print:hidden"
            style={pageStaggerItemStyle(1, staggerVisible)}
          >
            <CardContent className="px-3 pt-6 md:px-6">
              {user?.id && reportId ? (
                <PlanChecklist html={planContent} userId={user.id} reportId={reportId} />
              ) : (
                <PlanTimeline html={planContent} />
              )}
            </CardContent>
          </Card>

          <div className="hidden print:block print-plan-root space-y-4 text-black">
            <header className="border-b border-neutral-300 pb-3">
              <h1 className="text-2xl font-bold text-neutral-900">18-Day Plan</h1>
              <p className="text-sm text-neutral-600">Zen Space</p>
            </header>
            <PlanTimeline html={planContent} />
          </div>
        </>
      ) : (
        <Card
          className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          style={pageStaggerItemStyle(1, staggerVisible)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CalendarDays className="size-5 text-sky-300" />
              Your 18-Day Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Your personalized 18-day plan will appear here after you generate a Zen Plan report.
            </p>
            <Button asChild variant="zenOutline">
              <Link to="/app/client/assessment">Take an assessment</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
