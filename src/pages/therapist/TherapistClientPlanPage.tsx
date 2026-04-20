import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Download, Loader2 } from 'lucide-react'
import { PlanChecklist } from '@/components/PlanChecklist'
import { PlanTimeline } from '@/components/PlanTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'

export function TherapistClientPlanPage() {
  const { user } = useAuth()
  const { clientId } = useParams<{ clientId: string }>()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [latestReport, setLatestReport] = useState<{
    id: string
    plan_section: string | null
  } | null>(null)

  const planContent = latestReport?.plan_section ?? null
  const reportId = latestReport?.id ?? null
  const staggerVisible = usePageStaggerVisible(!loading, `${clientId}-${forbidden}-${planContent ? 'plan' : 'empty'}`)

  const load = useCallback(async () => {
    if (!user?.id || !clientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setForbidden(false)

    const { data: link, error: linkErr } = await supabase
      .from('therapist_clients')
      .select('id')
      .eq('therapist_id', user.id)
      .eq('client_id', clientId)
      .maybeSingle()

    if (linkErr || !link) {
      if (linkErr) console.error('[therapist_clients link]', linkErr)
      setForbidden(true)
      setLatestReport(null)
      setLoading(false)
      return
    }

    let { data, error } = await supabase
      .from('reports')
      .select('id, plan_section, content')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      const fallback = await supabase
        .from('reports')
        .select('id, content')
        .eq('client_id', clientId)
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
    } else {
      setLatestReport(null)
    }
    setLoading(false)
  }, [user?.id, clientId])

  useEffect(() => {
    void load()
  }, [load])

  if (!clientId) {
    return null
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading plan…</p>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="space-y-4 text-foreground">
        <Button asChild variant="zenOutline" size="sm">
          <Link to="/app/therapist/clients">← Clients</Link>
        </Button>
        <p className="text-muted-foreground">This client isn&apos;t linked to your practice.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div style={pageStaggerItemStyle(0, staggerVisible)}>
        <Button asChild variant="zenOutline" size="sm">
          <Link to={`/app/therapist/clients/${clientId}`}>← Client</Link>
        </Button>
      </div>

      <div
        className="flex flex-wrap items-start justify-between gap-4 print:hidden"
        style={pageStaggerItemStyle(1, staggerVisible)}
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
            style={pageStaggerItemStyle(2, staggerVisible)}
          >
            <CardContent className="px-3 pt-6 md:px-6">
              {reportId ? (
                <PlanChecklist html={planContent} userId={clientId} reportId={reportId} readOnly />
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
          style={pageStaggerItemStyle(2, staggerVisible)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CalendarDays className="size-5 text-sky-300" />
              18-Day Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              This client&apos;s personalized 18-day plan will appear here after a Zen Plan report has been generated
              from a completed assessment.
            </p>
            <Button asChild variant="zenOutline">
              <Link to={`/app/therapist/clients/${clientId}/observations`}>Observations &amp; generate report</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
