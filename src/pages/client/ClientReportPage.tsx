import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Loader2, Sparkles } from 'lucide-react'
import { AnimatedScoreMeter } from '@/components/AnimatedScoreMeter'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { BENCHMARK_OVERALL_MAX_SCORE, BENCHMARK_ZONE_MAX_SCORE } from '@/data/benchmarkAssessment'
import { isObservationSuperseded } from '@/data/therapistObservationOptions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { overallStatusLabel } from '@/lib/zenScoreLabels'

function assessmentHasLinkedReport(row: { reports: unknown }): boolean {
  const r = row.reports
  if (!r) return false
  if (Array.isArray(r)) return r.length > 0 && Boolean((r[0] as { id?: string })?.id)
  return Boolean((r as { id?: string }).id)
}

type ReportTile = {
  id: string
  assessmentMode: string
  createdAt: string
  overall: number | null
  balance: number | null
  blossom: number | null
  bliss: number | null
}

function reportRowScores(row: Record<string, unknown>): Pick<
  ReportTile,
  'overall' | 'balance' | 'blossom' | 'bliss'
> {
  const join = row.assessments as Record<string, unknown> | Record<string, unknown>[] | null
  const assessment = Array.isArray(join) ? join[0] : join
  const overall =
    typeof assessment?.score_total === 'number' ? assessment.score_total : null
  const balance = typeof row.imbalance_score === 'number' ? row.imbalance_score : null
  const blossom =
    typeof row.blossom_zone_emotional === 'number' ? row.blossom_zone_emotional : null
  const bliss = typeof row.bliss_zone_spiritual === 'number' ? row.bliss_zone_spiritual : null
  return { overall, balance, blossom, bliss }
}

function formatReportDate(iso: string): string {
  try {
    const d = new Date(iso)
    const day = d.getDate()
    const suffix =
      day % 10 === 1 && day !== 11 ? 'st'
        : day % 10 === 2 && day !== 12 ? 'nd'
        : day % 10 === 3 && day !== 13 ? 'rd'
        : 'th'
    const month = d.toLocaleString(undefined, { month: 'short' })
    const year = d.getFullYear()
    return `${day}${suffix} ${month}, ${year}`
  } catch {
    return iso
  }
}

function assessmentLabel(mode: string): string {
  switch (mode) {
    case 'self':
      return 'Self Assessment'
    case 'supervised':
      return 'Supervised Assessment'
    default:
      return 'Assessment'
  }
}

type ReportCardProps = {
  report: ReportTile
  listIndex: number
  isFeatured: boolean
}

function ReportCard({ report, listIndex, isFeatured }: ReportCardProps) {
  return (
    <Card
      className={cn(
        'zen-glass-card h-full shadow-none transition-colors',
        isFeatured ? 'ring-0' : 'ring-0 zen-ring-primary group-hover:ring-1'
      )}
      style={
        isFeatured ? { boxShadow: '0 0 0 1.5px rgb(52 211 153 / 0.55)' } : undefined
      }
    >
      <CardHeader className="space-y-2 pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2 sm:p-2.5">
            <FileText className="size-6 text-sky-300 sm:size-7" />
          </div>
          {isFeatured ? (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-400/40 bg-emerald-500/15 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"
            >
              Latest
            </Badge>
          ) : null}
        </div>
        <CardTitle className="text-base leading-snug text-foreground sm:text-lg">
          {assessmentLabel(report.assessmentMode)}
        </CardTitle>
        {isFeatured ? (
          <CardDescription className="text-sm text-muted-foreground sm:text-[15px]">
            Your most recent report. Click to see the full report.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <CardDescription className="text-xs text-muted-foreground sm:text-sm">
          {formatReportDate(report.createdAt)}
        </CardDescription>
        {report.overall != null ||
        report.balance != null ||
        report.blossom != null ||
        report.bliss != null ? (
          <div className="space-y-2.5 border-t border-white/10 pt-2.5 sm:space-y-3 sm:pt-3">
            {report.overall != null ? (
              <div>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="font-medium text-muted-foreground">Overall</span>
                  <span className="font-medium text-emerald-200/90">
                    {overallStatusLabel(report.overall)}
                  </span>
                </div>
                <AnimatedScoreMeter
                  variant="wellness"
                  value={report.overall}
                  max={BENCHMARK_OVERALL_MAX_SCORE}
                  delayMs={60 + listIndex * 24}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {[
                {
                  label: 'Balance',
                  value: report.balance,
                  max: BENCHMARK_ZONE_MAX_SCORE,
                  d: 100,
                },
                {
                  label: 'Blossom',
                  value: report.blossom,
                  max: BENCHMARK_ZONE_MAX_SCORE,
                  d: 140,
                },
                {
                  label: 'Bliss',
                  value: report.bliss,
                  max: BENCHMARK_ZONE_MAX_SCORE,
                  d: 180,
                },
              ].map(
                z =>
                  z.value != null && (
                    <div key={z.label}>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {z.label}
                      </div>
                      <AnimatedScoreMeter
                        variant="wellness"
                        value={z.value}
                        max={z.max}
                        delayMs={z.d + listIndex * 24}
                      />
                    </div>
                  )
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ClientReportPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportTile[]>([])
  const [awaitingTherapistReport, setAwaitingTherapistReport] = useState(false)

  const staggerVisible = usePageStaggerVisible(
    !loading,
    `${reports.length}-${awaitingTherapistReport}`
  )

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [reportsRes, supervisedRes] = await Promise.all([
        (async () => {
          let { data, error } = await supabase
            .from('reports')
            .select(
              'id, created_at, imbalance_score, blossom_zone_emotional, bliss_zone_spiritual, assessments ( assessment_mode, score_total )'
            )
            .eq('client_id', user.id)
            .order('created_at', { ascending: false })

          if (error) {
            const fallback = await supabase
              .from('reports')
              .select('id, created_at, assessments ( assessment_mode )')
              .eq('client_id', user.id)
              .order('created_at', { ascending: false })
            if (fallback.error) {
              const minimal = await supabase
                .from('reports')
                .select('id, created_at')
                .eq('client_id', user.id)
                .order('created_at', { ascending: false })
              data = minimal.data as typeof data
              error = minimal.error
            } else {
              data = fallback.data as typeof data
              error = fallback.error
            }
          }
          return { data, error }
        })(),
        supabase
          .from('assessments')
          .select('therapist_observations, reports ( id )')
          .eq('client_id', user.id)
          .eq('status', 'completed')
          .eq('assessment_mode', 'supervised')
          .order('completed_at', { ascending: false }),
      ])

      const { data, error } = reportsRes
      if (error) {
        console.error(error)
        setReports([])
      } else {
        setReports(
          (data ?? []).map((row: Record<string, unknown>) => {
            const join = row.assessments as Record<string, unknown> | Record<string, unknown>[] | null
            const mode = Array.isArray(join)
              ? (join[0]?.assessment_mode as string) ?? ''
              : (join?.assessment_mode as string) ?? ''
            const scores = reportRowScores(row)
            return {
              id: String(row.id),
              assessmentMode: mode,
              createdAt: String(row.created_at),
              ...scores,
            }
          })
        )
      }

      if (supervisedRes.error) {
        console.error(supervisedRes.error)
        setAwaitingTherapistReport(false)
      } else {
        const waiting = (supervisedRes.data ?? []).some(
          row =>
            !isObservationSuperseded(
              (row as { therapist_observations?: unknown }).therapist_observations
            ) && !assessmentHasLinkedReport(row as { reports: unknown })
        )
        setAwaitingTherapistReport(waiting)
      }
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-violet-300" aria-hidden />
        <p>Loading reports…</p>
      </div>
    )
  }

  const latest = reports[0]
  const previous = reports.slice(1)
  const contentStart = awaitingTherapistReport ? 2 : 1

  return (
    <div className="space-y-6">
      <div style={pageStaggerItemStyle(0, staggerVisible)}>
        <h1 className="text-3xl font-bold text-foreground">Your Reports</h1>
        <p className="mt-2 text-muted-foreground">View your personalized Zen Plan reports.</p>
      </div>

      {awaitingTherapistReport ? (
        <Card
          className={cn(
            'zen-glass-card shadow-none',
            'border border-amber-400/25 bg-amber-500/[0.08] ring-1 ring-amber-400/20'
          )}
          style={pageStaggerItemStyle(1, staggerVisible)}
        >
          <CardContent className="flex gap-4 py-5 sm:gap-5 sm:py-6">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/15 sm:size-12"
              aria-hidden
            >
              <Sparkles className="size-5 text-amber-200 sm:size-6" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Your report is on the way</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                You&apos;ve finished your supervised assessment. Your therapist still needs to complete their
                observations and generate your Zen Plan report. It will show up here when it&apos;s ready.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {reports.length === 0 ? (
        <Card
          className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          style={pageStaggerItemStyle(contentStart, staggerVisible)}
        >
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-full bg-white/5 p-5 ring-1 ring-white/10">
              <FileText className="size-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-muted-foreground">
              No reports yet. Complete an assessment to generate your Zen Plan report.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <Link
              to={`/app/client/report/${latest.id}`}
              className="group block rounded-2xl transition-all hover:scale-[1.02] sm:col-span-2 lg:col-span-2"
              style={pageStaggerItemStyle(contentStart, staggerVisible)}
            >
              <ReportCard report={latest} listIndex={0} isFeatured />
            </Link>
          </div>

          {previous.length > 0 ? (
            <section className="space-y-4">
              <h2
                className="text-xl font-semibold tracking-tight text-foreground"
                style={pageStaggerItemStyle(contentStart + 1, staggerVisible)}
              >
                Previous Reports
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {previous.map((report, j) => (
                  <Link
                    key={report.id}
                    to={`/app/client/report/${report.id}`}
                    className="group block rounded-2xl transition-all hover:scale-[1.02]"
                    style={pageStaggerItemStyle(contentStart + 2 + j, staggerVisible)}
                  >
                    <ReportCard report={report} listIndex={j + 1} isFeatured={false} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
