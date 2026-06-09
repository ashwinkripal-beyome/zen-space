import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PracticeDisclaimerDialog } from '@/components/PracticeDisclaimerDialog'
import { ReportSectionsView } from '@/components/ReportSectionsView'
import { RitualSectionsView } from '@/components/RitualSectionsView'
import { LockedSection } from '@/components/LockedSection'
import { PlanSelectionCards } from '@/components/PlanSelectionCards'
import { resolveReportDisplayParts, resolveRitualDisplayParts } from '@/lib/resolveReportSections'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'
import { downloadZenPlanPdf } from '@/lib/zenPrintDocument'
import { assemblePrintRitualHtml, zenPrintPdfMetadata } from '@/lib/zenPrintPayloadHelpers'
import {
  reportDetailTabButtonClassName,
  reportDetailTabListClassName,
} from '@/components/layout/AppShell'

type Tab = 'report' | 'ritual'

type ReportData = {
  reportSection: string | null
  ritualSection: string | null
  finalNarrativeSection: string | null
  planSection: string | null
  content: string | null
  report_client_info: string | null
  report_key_concerns: string | null
  report_current_state: string | null
  report_balance_zone: string | null
  report_blossom_zone: string | null
  report_bliss_zone: string | null
  report_integrated_interpretation: string | null
  ritual_explain: string | null
  ritual_somatic: string | null
  ritual_mental: string | null
  ritual_daily: string | null
  ritual_reflect: string | null
  createdAt: string | null
  assessment: { score_total?: number | null; score_data?: unknown } | null
}

export function ClientReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const { user, profile, refetchProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)
  const [tab, setTab] = useState<Tab>('report')
  const [fourfoldDisclaimerOpen, setFourfoldDisclaimerOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  /** Whether the free mental-reprogramming section has been locally revealed. */
  const [mentalUnlocked, setMentalUnlocked] = useState(false)
  const staggerVisible = usePageStaggerVisible(!loading, `${reportId}-${Boolean(report)}`)

  const load = useCallback(async () => {
    if (!user?.id || !reportId) {
      setLoading(false)
      return
    }
    setLoading(true)

    let { data, error } = await supabase
      .from('reports')
      .select(
        'report_section, ritual_section, final_narrative_section, plan_section, content, report_client_info, report_key_concerns, report_current_state, report_balance_zone, report_blossom_zone, report_bliss_zone, report_integrated_interpretation, ritual_explain, ritual_somatic, ritual_mental, ritual_daily, ritual_reflect, created_at, assessments ( score_total, score_data )'
      )
      .eq('id', reportId)
      .eq('client_id', user.id)
      .maybeSingle()

    if (error) {
      const fallback = await supabase
        .from('reports')
        .select('report_section, ritual_section, content, created_at')
        .eq('id', reportId)
        .eq('client_id', user.id)
        .maybeSingle()
      data = fallback.data as typeof data
      error = fallback.error
    }

    if (error || !data) {
      console.error(error)
      setReport(null)
    } else {
      const row = data as Record<string, unknown>
      const join = row.assessments as Record<string, unknown> | Record<string, unknown>[] | null | undefined
      const assessmentRow = Array.isArray(join) ? join[0] : join
      setReport({
        reportSection: (row.report_section as string) || null,
        ritualSection: (row.ritual_section as string) || null,
        finalNarrativeSection: (row.final_narrative_section as string) || null,
        planSection: (row.plan_section as string) || null,
        content: (row.content as string) || null,
        report_client_info: (row.report_client_info as string) || null,
        report_key_concerns: (row.report_key_concerns as string) || null,
        report_current_state: (row.report_current_state as string) || null,
        report_balance_zone: (row.report_balance_zone as string) || null,
        report_blossom_zone: (row.report_blossom_zone as string) || null,
        report_bliss_zone: (row.report_bliss_zone as string) || null,
        report_integrated_interpretation: (row.report_integrated_interpretation as string) || null,
        ritual_explain: (row.ritual_explain as string) || null,
        ritual_somatic: (row.ritual_somatic as string) || null,
        ritual_mental: (row.ritual_mental as string) || null,
        ritual_daily: (row.ritual_daily as string) || null,
        ritual_reflect: (row.ritual_reflect as string) || null,
        createdAt: typeof row.created_at === 'string' ? row.created_at : null,
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
  }, [user?.id, reportId])

  useEffect(() => {
    void load()
  }, [load])

  const handlePrintPdf = async () => {
    if (!report || pdfLoading) return
    const reportContent = report.reportSection || report.content || ''
    const ritualContent = assemblePrintRitualHtml(report)
    const finalContent = report.finalNarrativeSection || ''
    const planContent = report.planSection || ''
    const meta = zenPrintPdfMetadata(
      report.createdAt,
      profile
        ? {
            name: profile.name,
            first_name: profile.first_name,
            last_name: profile.last_name,
            gender: profile.gender,
            age: profile.age ?? null,
          }
        : null,
      report.assessment
    )
    setPdfLoading(true)
    const result = await downloadZenPlanPdf({
      reportHtml: reportContent,
      finalNarrativeHtml: finalContent || undefined,
      ritualHtml: ritualContent || undefined,
      planHtml: planContent || undefined,
      ...meta,
    })
    setPdfLoading(false)
    if (!result.ok) {
      toast.error('Could not generate PDF. ' + (result.error ?? ''))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading report…</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="space-y-4 text-foreground">
        <div style={pageStaggerItemStyle(0, staggerVisible)}>
          <Button asChild variant="zenOutline" size="sm">
            <Link to="/app/client/report">
              <ChevronLeft className="mr-1 size-4" /> Back to reports
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground" style={pageStaggerItemStyle(1, staggerVisible)}>
          Report not found or you don&apos;t have access.
        </p>
      </div>
    )
  }

  const reportContent = report.reportSection || report.content || ''
  const ritualContent = report.ritualSection || ''
  const finalContent = report.finalNarrativeSection || ''
  const planSection = report.planSection || ''
  const reportDisplayParts = resolveReportDisplayParts(report)
  const ritualDisplayParts = resolveRitualDisplayParts(report)

  // Gating: show locked UI only for non-paid clients whose plan hasn't been generated yet.
  const isPaid = profile?.is_paid_customer === true
  const hasMentalContent = Boolean(
    report.ritual_mental ||
    ritualDisplayParts.some(p => p.id === 'mental')
  )
  // somatic/daily/reflect signal that generate-zen-plan has run
  const hasPaidRitualContent = Boolean(
    report.ritual_somatic || report.ritual_daily || report.ritual_reflect
  )
  // Show the progressive unlock UI only when the client is free and the plan ritual hasn't been generated
  const showProgressiveLock = !isPaid && !hasPaidRitualContent

  // Parts to show after mental is unlocked (mental only, without somatic/daily/reflect)
  const mentalOnlyParts = ritualDisplayParts.filter(p => p.id === 'mental' || p.id === 'explain' || p.id === 'legacy')

  const openFourfoldTab = () => {
    setFourfoldDisclaimerOpen(true)
  }

  const confirmFourfoldTab = () => {
    setFourfoldDisclaimerOpen(false)
    setTab('ritual')
  }

  const handlePlanPurchased = (plan: string) => {
    refetchProfile()
    if (plan === '18_week_semi_guided') {
      toast.success('Plan activated! Your 18-week plan is being generated — check back in a few minutes.')
    }
  }

  return (
    <div className="space-y-6">
      <PracticeDisclaimerDialog
        open={fourfoldDisclaimerOpen}
        variant="fourfold"
        onContinue={confirmFourfoldTab}
      />
      <div
        className="flex flex-wrap items-center justify-between gap-3 print:hidden"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <Button asChild variant="zenOutline" size="sm">
          <Link to="/app/client/report">
            <ChevronLeft className="mr-1 size-4" /> Back to reports
          </Link>
        </Button>
        <Button
          type="button"
          variant="zenOutline"
          size="sm"
          onClick={() => void handlePrintPdf()}
          disabled={(!reportContent && !ritualContent && !finalContent && !planSection) || pdfLoading}
        >
          {pdfLoading ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-1.5 size-4" aria-hidden />
          )}
          {pdfLoading ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>

      <div
        className={reportDetailTabListClassName}
        style={pageStaggerItemStyle(1, staggerVisible)}
      >
        <button
          type="button"
          onClick={() => setTab('report')}
          className={reportDetailTabButtonClassName(tab === 'report')}
        >
          Report
        </button>
        <button
          type="button"
          onClick={() => {
            if (tab === 'ritual') return
            openFourfoldTab()
          }}
          className={reportDetailTabButtonClassName(tab === 'ritual')}
        >
          Fourfold Zen Ritual
        </button>
      </div>

      <Card
        className="zen-glass-card zen-ring-primary ring-0 shadow-none print:hidden"
        style={pageStaggerItemStyle(2, staggerVisible)}
      >
        <CardContent className="pt-6">
          {tab === 'report' && <ReportSectionsView parts={reportDisplayParts} />}

          {tab === 'ritual' && (() => {
            // Paid client or plan already generated — show everything normally.
            if (!showProgressiveLock) {
              if (ritualDisplayParts.length > 0) {
                return <RitualSectionsView parts={ritualDisplayParts} />
              }
              if (ritualContent) {
                return <RitualSectionsView parts={[{ id: 'legacy', title: 'Fourfold Zen ritual', html: ritualContent }]} />
              }
              return (
                <p className="py-8 text-muted-foreground">
                  Your plan and ritual are being prepared. Check back shortly.
                </p>
              )
            }

            // Progressive unlock UI for free clients.
            return (
              <div className="space-y-8">
                {/* Step 1 — Mental Reprogramming (free unlock) */}
                {!mentalUnlocked ? (
                  <LockedSection
                    title="Your Mental Reprogramming Statements"
                    unlockMode="free"
                    ctaText="Click here to unlock your mental reprogramming statements for free"
                    onUnlock={() => setMentalUnlocked(true)}
                  />
                ) : (
                  <>
                    {/* Show mental content once unlocked */}
                    {hasMentalContent && mentalOnlyParts.length > 0 ? (
                      <RitualSectionsView parts={mentalOnlyParts} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Mental reprogramming statements will appear here after your therapist generates your report.
                      </p>
                    )}

                    {/* Step 2 — Somatic release (paid) */}
                    <LockedSection
                      title="Somatic Release & Grounding"
                      unlockMode="paid"
                      ctaText="Unlock your Somatic Release & Grounding ritual with a paid plan"
                      paidHint="Available on 18-week semi-guided and 1-on-1 intensive guided plans"
                      onUnlock={() => navigate('/app/client/subscription-locked')}
                    />

                    {/* Plan upgrade cards */}
                    <div className="border-t border-white/10 pt-8">
                      <h3 className="mb-1 text-lg font-semibold text-foreground">
                        Unlock your full Fourfold Zen Ritual & 18-week plan
                      </h3>
                      <p className="mb-5 text-sm text-muted-foreground">
                        Choose a plan to get your personalised Somatic Release, Daily Zen practice, Reflection ritual, and a full 18-week activity plan.
                      </p>
                      <PlanSelectionCards
                        currentPlan={profile?.current_plan}
                        visiblePlans={['18_week_semi_guided', 'one_on_one_intensive']}
                        onPlanPurchased={handlePlanPurchased}
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
