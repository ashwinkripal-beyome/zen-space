import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronDown, ClipboardPenLine, Download, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PlanChecklist } from '@/components/PlanChecklist'
import { PlanTimeline } from '@/components/PlanTimeline'
import { PlanSelectionCards } from '@/components/PlanSelectionCards'
import { PracticeDisclaimerDialog } from '@/components/PracticeDisclaimerDialog'
import { RitualSectionsView } from '@/components/RitualSectionsView'
import { resolveRitualDisplayParts } from '@/lib/resolveReportSections'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useAssessmentAvailability } from '@/hooks/useAssessmentAvailability'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'
import { isEveryPlanWeekMarkedComplete } from '@/lib/supervisedAssessmentEligibility'
import { downloadZenPlanPdf } from '@/lib/zenPrintDocument'
import { assemblePrintRitualHtml, zenPrintPdfMetadata } from '@/lib/zenPrintPayloadHelpers'
import { cn } from '@/lib/utils'

function formatReassessDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ClientPlanPage() {
  const { user, profile, refetchProfile } = useAuth()
  useClientOnboarding() // keep provider subscription
  const availability = useAssessmentAvailability()
  const [loading, setLoading] = useState(true)
  const [latestReport, setLatestReport] = useState<{
    id: string
    plan_section: string | null
    report_section: string | null
    ritual_section: string | null
    final_narrative_section: string | null
    content: string | null
    ritual_explain: string | null
    ritual_somatic: string | null
    ritual_mental: string | null
    ritual_daily: string | null
    ritual_reflect: string | null
    created_at: string | null
    assessment: { score_total?: number | null; score_data?: unknown } | null
  } | null>(null)
  const planContent = latestReport?.plan_section ?? null
  const ritualContent = latestReport?.ritual_section ?? null
  const ritualDisplayParts = latestReport ? resolveRitualDisplayParts(latestReport) : []
  const reportId = latestReport?.id ?? null
  const hasPlanOrRitual = Boolean(
    planContent ||
    ritualContent ||
    latestReport?.ritual_explain ||
    latestReport?.ritual_somatic ||
    latestReport?.ritual_mental ||
    latestReport?.ritual_daily ||
    latestReport?.ritual_reflect
  )
  const [planExpanded, setPlanExpanded] = useState(false)
  const [planDisclaimerAcked, setPlanDisclaimerAcked] = useState(false)
  const [planDisclaimerOpen, setPlanDisclaimerOpen] = useState(false)
  const [ritualExpanded, setRitualExpanded] = useState(false)
  const [ritualDisclaimerAcked, setRitualDisclaimerAcked] = useState(false)
  const [ritualDisclaimerOpen, setRitualDisclaimerOpen] = useState(false)
  const [planProgressCompleted, setPlanProgressCompleted] = useState<number[]>([])
  const [pdfLoading, setPdfLoading] = useState(false)
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
    setPlanProgressCompleted([])
  }, [reportId])

  useEffect(() => {
    setPlanExpanded(false)
    setPlanDisclaimerAcked(false)
    setPlanDisclaimerOpen(false)
    setRitualExpanded(false)
    setRitualDisclaimerAcked(false)
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
        'id, plan_section, report_section, ritual_section, final_narrative_section, content, ritual_explain, ritual_somatic, ritual_mental, ritual_daily, ritual_reflect, created_at, assessments ( score_total, score_data )'
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
        ritual_explain: (row.ritual_explain as string) || null,
        ritual_somatic: (row.ritual_somatic as string) || null,
        ritual_mental: (row.ritual_mental as string) || null,
        ritual_daily: (row.ritual_daily as string) || null,
        ritual_reflect: (row.ritual_reflect as string) || null,
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
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading your plan…</p>
      </div>
    )
  }

  const handleDownloadPdf = async () => {
    if (!latestReport || pdfLoading) return
    const reportHtml = latestReport.report_section || latestReport.content || ''
    const ritualHtml = assemblePrintRitualHtml(latestReport)
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
    setPdfLoading(true)
    const result = await downloadZenPlanPdf({
      reportHtml,
      finalNarrativeHtml: finalHtml || undefined,
      ritualHtml: ritualHtml || undefined,
      planHtml: planHtml || undefined,
      ...meta,
    })
    setPdfLoading(false)
    if (!result.ok) {
      toast.error('Could not generate PDF. ' + (result.error ?? ''))
    }
  }

  const canPrintPdf =
    latestReport &&
    (latestReport.report_section ||
      latestReport.content ||
      latestReport.ritual_section ||
      latestReport.final_narrative_section ||
      latestReport.plan_section)

  const confirmPlanDisclaimer = () => {
    setPlanDisclaimerOpen(false)
    setPlanDisclaimerAcked(true)
    setPlanExpanded(true)
  }

  const togglePlanSection = () => {
    if (planExpanded) {
      setPlanExpanded(false)
      return
    }
    if (!planDisclaimerAcked) {
      setPlanDisclaimerOpen(true)
      return
    }
    setPlanExpanded(true)
  }

  const confirmRitualDisclaimer = () => {
    setRitualDisclaimerOpen(false)
    setRitualDisclaimerAcked(true)
    setRitualExpanded(true)
  }

  const toggleRitualSection = () => {
    if (ritualExpanded) {
      setRitualExpanded(false)
      return
    }
    if (!ritualDisclaimerAcked) {
      setRitualDisclaimerOpen(true)
      return
    }
    setRitualExpanded(true)
  }

  const ritualEmptyMessage = (
    <p className="py-4 text-muted-foreground">
      Ready to begin your wellness journey?
      <br />
      <br />
      Reach out to us at{' '}
      <a
        href="tel:+917259294992"
        className="font-medium text-foreground underline decoration-sky-400/50 underline-offset-2"
      >
        +91 7259294992
      </a>
      , or visit your nearest Zen Garden with your self-assessment report to unlock your personalised 18-week plan and
      fourfold Zen ritual.
      <br />
      <br />
      We&apos;d love to hear from you soon.
    </p>
  )

  return (
    <div className="space-y-6">
      <PracticeDisclaimerDialog
        open={planDisclaimerOpen}
        variant="plan18"
        onContinue={confirmPlanDisclaimer}
      />
      <PracticeDisclaimerDialog
        open={ritualDisclaimerOpen}
        variant="fourfold"
        onContinue={confirmRitualDisclaimer}
      />
      <div
        className="flex flex-wrap items-start justify-between gap-4 print:hidden"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">Your Personalized Plan</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => void load()}
            title="Refresh"
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>
        {canPrintPdf ? (
          <Button
            type="button"
            variant="zenOutline"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={!canPrintPdf || pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-1.5 size-4" aria-hidden />
            )}
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </Button>
        ) : null}
      </div>

      {hasPlanOrRitual ? (
        <>
          <Card
            className="zen-glass-card zen-ring-primary ring-0 shadow-none print:hidden"
            style={pageStaggerItemStyle(1, staggerVisible)}
          >
            <CardContent className="px-3 pt-6 md:px-6">
              <div>
                <button
                  type="button"
                  onClick={toggleRitualSection}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                  aria-expanded={ritualExpanded}
                >
                  <span className="text-base font-semibold text-foreground">Fourfold Zen Ritual</span>
                  <ChevronDown
                    className={cn(
                      'size-5 shrink-0 text-muted-foreground transition-transform',
                      ritualExpanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                <div className={cn('mt-4 px-0.5', !ritualExpanded && 'hidden')} aria-hidden={!ritualExpanded}>
                  {ritualDisplayParts.length > 0 ? (
                    <RitualSectionsView parts={ritualDisplayParts} />
                  ) : ritualContent ? (
                    <RitualSectionsView parts={[{ id: 'legacy', title: 'Fourfold Zen ritual', html: ritualContent }]} />
                  ) : (
                    ritualEmptyMessage
                  )}
                </div>
              </div>

              <div className="mt-8 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={togglePlanSection}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                  aria-expanded={planExpanded}
                >
                  <span className="text-base font-semibold text-foreground">18-Week Plan</span>
                  <ChevronDown
                    className={cn(
                      'size-5 shrink-0 text-muted-foreground transition-transform',
                      planExpanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                <div className={cn('mt-4', !planExpanded && 'hidden')} aria-hidden={!planExpanded}>
                  {planContent ? (
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
                  ) : profile?.is_paid_customer ? (
                    <p className="py-8 text-center text-muted-foreground">
                      Your 18-week plan is being generated — check back in a few minutes, or refresh the page.
                    </p>
                  ) : (
                    <div className="space-y-5 py-4">
                      <p className="text-sm text-muted-foreground">
                        Your personalised 18-week Zen Garden activity plan is generated when you activate a paid plan.
                      </p>
                      <PlanSelectionCards
                        currentPlan={profile?.current_plan}
                        visiblePlans={['18_week_semi_guided', 'one_on_one_intensive']}
                        onPlanPurchased={() => {
                          refetchProfile()
                          void load()
                          toast.success('Plan activated! Your 18-week plan is being generated.')
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {planContent && allPlanWeeksMarkedComplete ? (
            <Card
              className="zen-glass-card zen-ring-secondary ring-0 shadow-none print:hidden"
              style={pageStaggerItemStyle(2, staggerVisible)}
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
              Your Personalized Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-muted-foreground">
            <p className="text-pretty leading-relaxed">
              Complete your self-assessment first, then activate a plan to unlock your personalised 18-week Zen Garden
              activity plan and full Fourfold Zen Ritual.
            </p>
            <PlanSelectionCards
              currentPlan={profile?.current_plan}
              visiblePlans={['18_week_semi_guided', 'one_on_one_intensive']}
              onPlanPurchased={() => {
                refetchProfile()
                void load()
                toast.success('Plan activated!')
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
