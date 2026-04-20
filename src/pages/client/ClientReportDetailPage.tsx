import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Loader2 } from 'lucide-react'
import { ReportBody } from '@/components/ReportBody'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'
import {
  reportDetailTabButtonClassName,
  reportDetailTabListClassName,
} from '@/components/layout/AppShell'

type Tab = 'report' | 'ritual'

type ReportData = {
  reportSection: string | null
  ritualSection: string | null
  finalNarrativeSection: string | null
  content: string | null
}

export function ClientReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)
  const [tab, setTab] = useState<Tab>('report')
  const staggerVisible = usePageStaggerVisible(!loading, `${reportId}-${Boolean(report)}`)

  const load = useCallback(async () => {
    if (!user?.id || !reportId) {
      setLoading(false)
      return
    }
    setLoading(true)

    let { data, error } = await supabase
      .from('reports')
      .select('report_section, ritual_section, final_narrative_section, content')
      .eq('id', reportId)
      .eq('client_id', user.id)
      .maybeSingle()

    if (error) {
      const fallback = await supabase
        .from('reports')
        .select('report_section, ritual_section, content')
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
      setReport({
        reportSection: (row.report_section as string) || null,
        ritualSection: (row.ritual_section as string) || null,
        finalNarrativeSection: (row.final_narrative_section as string) || null,
        content: (row.content as string) || null,
      })
    }
    setLoading(false)
  }, [user?.id, reportId])

  useEffect(() => {
    void load()
  }, [load])

  const handlePrintPdf = () => {
    window.print()
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

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center justify-between gap-3 print:hidden"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <Button asChild variant="zenOutline" size="sm">
          <Link to="/app/client/report">
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
        <button
          type="button"
          onClick={() => setTab('report')}
          className={reportDetailTabButtonClassName(tab === 'report')}
        >
          Report
        </button>
        <button
          type="button"
          onClick={() => setTab('ritual')}
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
                No ritual content available. The report may have been generated before section
                splitting was enabled.
              </p>
            ))}
        </CardContent>
      </Card>

      {/* Print-only: combined PDF (report + final + ritual) */}
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
      </div>
    </div>
  )
}
