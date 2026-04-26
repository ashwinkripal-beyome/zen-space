import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardPenLine, Download, Loader2 } from 'lucide-react'
import { PlanChecklist } from '@/components/PlanChecklist'
import { PlanTimeline } from '@/components/PlanTimeline'
import { ReportBody } from '@/components/ReportBody'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  reportDetailTabButtonClassName,
  reportDetailTabListClassName,
} from '@/components/layout/AppShell'
import { useAuth } from '@/hooks/useAuth'
import { useAssessmentAvailability } from '@/hooks/useAssessmentAvailability'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'
import { isEveryPlanWeekMarkedComplete } from '@/lib/supervisedAssessmentEligibility'
import { printZenPlanPdf } from '@/lib/zenPrintDocument'
import { zenPrintPdfMetadata } from '@/lib/zenPrintPayloadHelpers'

function formatReassessDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

type PlanPageTab = 'ritual' | 'plan'

export function ClientPlanPage() {
  const { user, profile } = useAuth()
  const { hasTherapists, therapistResolutionPending } = useClientOnboarding()
  const availability = useAssessmentAvailability()
  const [loading, setLoading] = useState(true)
  const [latestReport, setLatestReport] = useState<{
    id: string
    plan_section: string | null
    report_section: string | null
    ritual_section: string | null
    final_narrative_section: string | null
    content: string | null
    created_at: string | null
    assessment: { score_total?: number | null; score_data?: unknown } | null
  } | null>(null)
  const planContent = latestReport?.plan_section ?? null
  const ritualContent = latestReport?.ritual_section ?? null
  const reportId = latestReport?.id ?? null
  const hasPlanOrRitual = Boolean(planContent || ritualContent)
  const [tab, setTab] = useState<PlanPageTab>('plan')
  const [planProgressCompleted, setPlanProgressCompleted] = useState<number[]>([])
  const staggerVisible = usePageStaggerVisible(!loading, hasPlanOrRitual ? 'plan-ritual' : 'empty')

  const allPlanWeeksMarkedComplete = Boolean(
    planContent && isEveryPlanWeekMarkedComplete(planContent, planProgressCompleted)
  )
  const reassessSupervisedAllowed = availability.supervised.available

  const onPlanProgressChange = useCallback(
    (completed: number[]) => {
      setPlanProgressCompleted(completed)
      void availability.refetch()
    },
    [availability.refetch]
  )

  useEffect(() => {
    if (!latestReport) return
    if (planContent && !ritualContent) setTab('plan')
    else if (!planContent && ritualContent) setTab('ritual')
  }, [latestReport?.id, planContent, ritualContent])

  useEffect(() => {
    setPlanProgressCompleted([])
  }, [reportId])

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)

    let { data, error } = await supabase
      .from('reports')
      .select(
        'id, plan_section, report_section, ritual_section, final_narrative_section, content, created_at, assessments ( score_total, score_data )'
      )
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      const fallback = await supabase
        .from('reports')
        .select('id, content, created_at')
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
      const join = row.assessments as Record<string, unknown> | Record<string, unknown>[] | null | undefined
      const assessmentRow = Array.isArray(join) ? join[0] : join
      setLatestReport({
        id: String(row.id ?? ''),
        plan_section: (row.plan_section as string) || null,
        report_section: (row.report_section as string) || null,
        ritual_section: (row.ritual_section as string) || null,
        final_narrative_section: (row.final_narrative_section as string) || null,
        content: (row.content as string) || null,
        created_at: typeof row.created_at === 'string' ? row.created_at : null,
        assessment: assessmentRow
          ? {
              score_total:
                typeof assessmentRow.score_total === 'number' ? assessmentRow.score_total : null,
              score_data: assessmentRow.score_data,
            }
          : null,
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading plan…</p>
      </div>
    )
  }

  const handleDownloadPdf = () => {
    if (!latestReport) return
    const reportHtml = latestReport.report_section || latestReport.content || ''
    const ritualHtml = ritualContent || ''
    const finalHtml = latestReport.final_narrative_section || ''
    const planHtml = latestReport.plan_section || ''
    const meta = zenPrintPdfMetadata(
      latestReport.created_at,
      profile
        ? {
            name: profile.name,
            first_name: profile.first_name,
            last_name: profile.last_name,
            gender: profile.gender,
            age: profile.age ?? null,
          }
        : null,
      latestReport.assessment
    )
    printZenPlanPdf({
      reportHtml,
      finalNarrativeHtml: finalHtml || undefined,
      ritualHtml: ritualHtml || undefined,
      planHtml: planHtml || undefined,
      ...meta,
    })
  }

  const canPrintPdf =
    latestReport &&
    (latestReport.report_section ||
      latestReport.content ||
      latestReport.ritual_section ||
      latestReport.final_narrative_section ||
      latestReport.plan_section)

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-4 print:hidden"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <h1 className="text-3xl font-bold text-foreground">18-Week Plan</h1>
        {canPrintPdf ? (
          <Button
            type="button"
            variant="zenOutline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={!canPrintPdf}
          >
            <Download className="mr-1.5 size-4" aria-hidden />
            Download PDF
          </Button>
        ) : null}
      </div>

      {hasPlanOrRitual ? (
        <>
          <div
            className={reportDetailTabListClassName}
            style={pageStaggerItemStyle(1, staggerVisible)}
          >
            <button
              type="button"
              onClick={() => setTab('ritual')}
              className={reportDetailTabButtonClassName(tab === 'ritual')}
            >
              Fourfold Zen Ritual
            </button>
            <button
              type="button"
              onClick={() => setTab('plan')}
              className={reportDetailTabButtonClassName(tab === 'plan')}
            >
              18-Week Plan
            </button>
          </div>

          <Card
            className="zen-glass-card zen-ring-primary ring-0 shadow-none print:hidden"
            style={pageStaggerItemStyle(2, staggerVisible)}
          >
            <CardContent className="px-3 pt-6 md:px-6">
              {tab === 'ritual' &&
                (ritualContent ? (
                  <ReportBody content={ritualContent} />
                ) : (
                  <p className="py-8 text-muted-foreground">
              Ready to begin your wellness journey?<br /><br />Reach out to us at{' '}
              <a href="tel:+918888888888" className="font-medium text-foreground underline decoration-sky-400/50 underline-offset-2">
                +91 8888888888
              </a>, or visit your nearest Zen Garden with your self-assessment report to unlock your personalised 18-week plan and fourfold Zen ritual.<br /><br />We'd love to hear from you soon.
              </p>
                ))}
              {tab === 'plan' &&
                (planContent ? (
                  user?.id && reportId ? (
                    <PlanChecklist
                      html={planContent}
                      userId={user.id}
                      reportId={reportId}
                      onProgressChange={onPlanProgressChange}
                    />
                  ) : (
                    <PlanTimeline html={planContent} />
                  )
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Your 18-week timeline will appear here once your therapist adds a plan, or when a
                    supervised report with a plan is finalized.
                  </p>
                ))}
            </CardContent>
          </Card>

          {planContent && hasTherapists === true && allPlanWeeksMarkedComplete ? (
            <Card
              className="zen-glass-card zen-ring-secondary ring-0 shadow-none print:hidden"
              style={pageStaggerItemStyle(3, staggerVisible)}
            >
              <CardContent className="space-y-4 px-3 py-6 md:px-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-foreground">Ready for your next check-in</h2>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve marked every week on this plan. When you&apos;re eligible, start a new supervised
                    assessment with your therapist.
                  </p>
                </div>
                {availability.loading ? (
                  <p className="text-sm text-muted-foreground">Checking eligibility…</p>
                ) : reassessSupervisedAllowed ? (
                  <Button asChild variant="zen" className="w-full sm:w-auto">
                    <Link to="/app/client/assessment/supervised/session" className="gap-2">
                      <ClipboardPenLine className="size-4" aria-hidden />
                      Reassess supervised assessment
                    </Link>
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button type="button" variant="zen" className="w-full sm:w-auto" disabled>
                      <ClipboardPenLine className="mr-2 size-4" aria-hidden />
                      Reassess supervised assessment
                    </Button>
                    {availability.supervised.supervisedBlockedReason === 'min_weeks' &&
                    availability.supervised.nextDate ? (
                      <p className="text-xs text-muted-foreground">
                        Unlocks on {formatReassessDate(availability.supervised.nextDate)}. Your therapist can enable it earlier if needed.
                      </p>
                    ) : availability.supervised.supervisedBlockedReason === 'no_plan' ? (
                      <p className="text-xs text-muted-foreground">
                        Waiting for plan details on your latest report. Your therapist can enable reassessment if
                        needed.
                      </p>
                    ) : availability.supervised.supervisedBlockedReason === 'not_paid' ? (
                      <p className="text-xs text-muted-foreground">
                        Your therapist must mark you as a paid customer on their client page before the next
                        supervised assessment is available. You can use the self assessment until then.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Not available yet. Your therapist can enable the next supervised assessment from their
                        dashboard.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <Card
          className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          style={pageStaggerItemStyle(1, staggerVisible)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CalendarDays className="size-5 text-sky-300" />
              Your 18-Week Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p className="text-pretty leading-relaxed">
              Ready to begin your wellness journey?<br /><br />Reach out to us at{' '}
              <a href="tel:+918888888888" className="font-medium text-foreground underline decoration-sky-400/50 underline-offset-2">
                +91 8888888888
              </a>, or visit your nearest Zen Garden with your self-assessment report to unlock your personalised 18-week plan and fourfold Zen ritual.<br /><br />We'd love to hear from you soon.
            
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
