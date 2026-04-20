import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Loader2 } from 'lucide-react'
import { ReportBody } from '@/components/ReportBody'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  BENCHMARK_QUESTIONS,
  formatBenchmarkAnswerWithScore,
  type BenchmarkQuestion,
  type BenchmarkSection,
} from '@/data/benchmarkAssessment'
import { supabase } from '@/lib/supabase'
import {
  reportDetailTabButtonClassName,
  reportDetailTabListClassName,
} from '@/components/layout/AppShell'

type Tab = 'report' | 'ritual' | 'assessment'

type ReportData = {
  reportSection: string | null
  ritualSection: string | null
  finalNarrativeSection: string | null
  content: string | null
  assessmentId: string | null
}

type AnswerRow = {
  question_id: string
  answer_value: string | null
  skipped: boolean | null
}

export function TherapistClientReportDetailPage() {
  const { clientId, reportId } = useParams<{ clientId: string; reportId: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [answersLoading, setAnswersLoading] = useState(false)
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Map<string, AnswerRow>>(new Map())
  const [tab, setTab] = useState<Tab>('report')
  const staggerVisible = usePageStaggerVisible(!loading, `${reportId}-${Boolean(report)}-${forbidden}`)

  const load = useCallback(async () => {
    if (!user?.id || !clientId || !reportId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setForbidden(false)
    try {
      const { data: link, error: linkErr } = await supabase
        .from('therapist_clients')
        .select('id')
        .eq('therapist_id', user.id)
        .eq('client_id', clientId)
        .maybeSingle()

      if (linkErr || !link) {
        if (linkErr) console.error('[therapist_clients link]', linkErr)
        setForbidden(true)
        setReport(null)
        return
      }

      let { data, error } = await supabase
        .from('reports')
        .select(
          'report_section, ritual_section, final_narrative_section, content, assessment_id, client_id'
        )
        .eq('id', reportId)
        .eq('client_id', clientId)
        .maybeSingle()

      if (error) {
        const fallback = await supabase
          .from('reports')
          .select('report_section, ritual_section, content, assessment_id, client_id')
          .eq('id', reportId)
          .eq('client_id', clientId)
          .maybeSingle()
        data = fallback.data as typeof data
        error = fallback.error
      }

      if (error || !data) {
        if (error) console.error(error)
        setReport(null)
      } else {
        const row = data as Record<string, unknown>
        setReport({
          reportSection: (row.report_section as string) || null,
          ritualSection: (row.ritual_section as string) || null,
          finalNarrativeSection: (row.final_narrative_section as string) || null,
          content: (row.content as string) || null,
          assessmentId: typeof row.assessment_id === 'string' ? row.assessment_id : null,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [user?.id, clientId, reportId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const aid = report?.assessmentId
    if (!aid) {
      setAnswersByQuestionId(new Map())
      return
    }
    setAnswersLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from('assessment_answers')
        .select('question_id, answer_value, skipped')
        .eq('assessment_id', aid)

      if (error) {
        console.error('[assessment_answers]', error)
        setAnswersByQuestionId(new Map())
      } else {
        const m = new Map<string, AnswerRow>()
        for (const r of data ?? []) {
          const row = r as AnswerRow
          if (row.question_id) m.set(row.question_id, row)
        }
        setAnswersByQuestionId(m)
      }
      setAnswersLoading(false)
    })()
  }, [report?.assessmentId])

  const groupedQuestions = useMemo(() => {
    const order: BenchmarkSection[] = ['Balance', 'Blossom', 'Bliss']
    const map = new Map<BenchmarkSection, BenchmarkQuestion[]>()
    for (const s of order) map.set(s, [])
    for (const q of BENCHMARK_QUESTIONS) {
      map.get(q.section)?.push(q)
    }
    return order.map(section => ({ section, questions: map.get(section) ?? [] }))
  }, [])

  const handlePrintPdf = () => {
    window.print()
  }

  const listHref = clientId ? `/app/therapist/clients/${clientId}/reports` : '/app/therapist/clients'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading report…</p>
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

  if (!report) {
    return (
      <div className="space-y-4 text-foreground">
        <div style={pageStaggerItemStyle(0, staggerVisible)}>
          <Button asChild variant="zenOutline" size="sm">
            <Link to={listHref}>
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

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center justify-between gap-3 print:hidden"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <Button asChild variant="zenOutline" size="sm">
          <Link to={listHref}>
            <ChevronLeft className="mr-1 size-4" /> Back to reports
          </Link>
        </Button>
        <Button type="button" variant="zenOutline" size="sm" onClick={handlePrintPdf}>
          <Download className="mr-1.5 size-4" aria-hidden />
          Download PDF
        </Button>
      </div>

      <div
        className={reportDetailTabListClassName}
        style={pageStaggerItemStyle(1, staggerVisible)}
      >
        {(
          [
            ['report', 'Report'],
            ['ritual', 'Fourfold Zen Ritual'],
            ['assessment', 'Assessment'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={reportDetailTabButtonClassName(tab === key)}
          >
            {label}
          </button>
        ))}
      </div>

      <Card
        className="zen-glass-card zen-ring-primary ring-0 shadow-none print:hidden"
        style={pageStaggerItemStyle(2, staggerVisible)}
      >
        <CardContent className="pt-6">
          {tab === 'report' && (
            <>
              {reportContent ? (
                <ReportBody content={reportContent} />
              ) : (
                <p className="py-8 text-center text-muted-foreground">No report content available.</p>
              )}
              {finalContent ? (
                <div className="mt-10 border-t border-white/10 pt-8">
                  <h2 className="mb-4 text-xl font-semibold text-foreground">Final narrative</h2>
                  <ReportBody content={finalContent} />
                </div>
              ) : null}
            </>
          )}
          {tab === 'ritual' &&
            (ritualContent ? (
              <ReportBody content={ritualContent} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No ritual content available. The report may have been generated before section splitting was enabled.
              </p>
            ))}
          {tab === 'assessment' && (
            <div className="space-y-8">
              {!report.assessmentId ? (
                <p className="py-6 text-center text-muted-foreground">No assessment is linked to this report.</p>
              ) : answersLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                  Loading answers…
                </div>
              ) : (
                groupedQuestions.map(({ section, questions }) => {
                  if (questions.length === 0) return null
                  return (
                    <section key={section} className="space-y-4">
                      <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-foreground">{section}</h2>
                      <div className="space-y-4">
                        {questions.map((q, i) => {
                          const prev = questions[i - 1]
                          const showCat = !prev || prev.category !== q.category
                          const row = answersByQuestionId.get(q.id)
                          const answerLine = formatBenchmarkAnswerWithScore(row ?? null)
                          return (
                            <div key={q.id} className="space-y-2">
                              {showCat ? (
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {q.category}
                                </p>
                              ) : null}
                              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <p className="text-sm text-foreground/90">{q.text}</p>
                                <p className="mt-2 text-sm font-medium text-emerald-200/90">{answerLine}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="hidden print:block print-root space-y-10 text-black">
        <header className="border-b border-neutral-300 pb-4">
          <h1 className="text-2xl font-bold text-neutral-900">Zen Plan Report</h1>
          <p className="mt-1 text-sm text-neutral-600">Zen Space — confidential</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-neutral-900">Report</h2>
          <div className="report-print-html text-sm leading-relaxed text-neutral-800">
            {reportContent ? <ReportBody content={reportContent} /> : null}
          </div>
        </section>

        {finalContent ? (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900">Final narrative</h2>
            <div className="report-print-html text-sm leading-relaxed text-neutral-800">
              <ReportBody content={finalContent} />
            </div>
          </section>
        ) : null}

        {ritualContent ? (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-neutral-900">Fourfold Zen Ritual</h2>
            <div className="report-print-html text-sm leading-relaxed text-neutral-800">
              <ReportBody content={ritualContent} />
            </div>
          </section>
        ) : null}

        {report.assessmentId && !answersLoading ? (
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-900">Assessment</h2>
            <div className="space-y-6 text-sm leading-relaxed text-neutral-800">
              {groupedQuestions.map(({ section, questions }) =>
                questions.length === 0 ? null : (
                  <div key={section}>
                    <h3 className="mb-2 font-bold text-neutral-900">{section}</h3>
                    <ul className="list-none space-y-3 pl-0">
                      {questions.map((q, i) => {
                        const prev = questions[i - 1]
                        const showCat = !prev || prev.category !== q.category
                        const row = answersByQuestionId.get(q.id)
                        const answerLine = formatBenchmarkAnswerWithScore(row ?? null)
                        return (
                          <li key={q.id} className="border-b border-neutral-200 pb-2">
                            {showCat ? (
                              <div className="mb-1 text-xs font-semibold uppercase text-neutral-500">{q.category}</div>
                            ) : null}
                            {q.text}
                            <div className="mt-1 font-medium text-neutral-900">{answerLine}</div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
