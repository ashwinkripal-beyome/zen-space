import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, ClipboardList, Mail, Phone, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useTherapistPendingRealtime } from '@/hooks/useTherapistPendingRealtime'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  fetchTherapistPendingDisplayRows,
  type TherapistPendingDisplayRow,
} from '@/lib/therapistPendingObservations'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type PendingNotificationRow = TherapistPendingDisplayRow

type ReportStats = { self_count: number; supervised_count: number }

function formatCompletedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Returns { year, month } for today's UTC month */
function todayYearMonth(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** Returns ISO date string "YYYY-MM-01" for the first day of given year/month */
function monthToIsoDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

const glassCard = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')

export function TherapistHomePage() {
  const { user } = useAuth()
  const [linkedClientCount, setLinkedClientCount] = useState(0)
  const [pendingItems, setPendingItems] = useState<PendingNotificationRow[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)

  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(todayYearMonth)
  const [reportStats, setReportStats] = useState<ReportStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const isCurrentMonth = useMemo(() => {
    const today = todayYearMonth()
    return selectedMonth.year === today.year && selectedMonth.month === today.month
  }, [selectedMonth])

  const loadPendingNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    if (!user?.id) {
      setPendingItems([])
      setPendingLoading(false)
      return
    }
    if (!silent) setPendingLoading(true)
    try {
      const rows = await fetchTherapistPendingDisplayRows(user.id)
      setPendingItems(rows)
    } finally {
      if (!silent) setPendingLoading(false)
    }
  }, [user?.id])

  const fetchLinkedClientCount = useCallback(async () => {
    if (!user?.id) return
    const { count } = await supabase
      .from('therapist_clients')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', user.id)
    if (count != null) setLinkedClientCount(count)
  }, [user?.id])

  const fetchReportStats = useCallback(async (year: number, month: number) => {
    if (!user?.id) return
    setStatsLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_monthly_report_generation_stats', {
        p_month: monthToIsoDate(year, month),
      })
      if (error) {
        console.error('[report stats]', error)
        setReportStats(null)
        return
      }
      const row = Array.isArray(data) ? (data[0] as ReportStats | undefined) : (data as ReportStats | null)
      if (row) {
        setReportStats({
          self_count: Number(row.self_count ?? 0),
          supervised_count: Number(row.supervised_count ?? 0),
        })
      } else {
        setReportStats({ self_count: 0, supervised_count: 0 })
      }
    } finally {
      setStatsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchLinkedClientCount()
  }, [fetchLinkedClientCount])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`therapist_dash:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'therapist_clients', filter: `therapist_id=eq.${user.id}` },
        () => void fetchLinkedClientCount()
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user?.id, fetchLinkedClientCount])

  useEffect(() => {
    void loadPendingNotifications()
  }, [loadPendingNotifications])

  useTherapistPendingRealtime(user?.id, Boolean(user?.id), () => void loadPendingNotifications({ silent: true }), {
    channelScope: 'therapist-home',
  })

  useEffect(() => {
    if (!user?.id) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadPendingNotifications({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.id, loadPendingNotifications])

  useEffect(() => {
    if (!user?.id) return
    const id = window.setInterval(() => void fetchLinkedClientCount(), 10000)
    return () => window.clearInterval(id)
  }, [user?.id, fetchLinkedClientCount])

  useEffect(() => {
    void fetchReportStats(selectedMonth.year, selectedMonth.month)
  }, [fetchReportStats, selectedMonth])

  const staggerVisible = usePageStaggerVisible(true)

  const sectionHeadingClass =
    'mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'

  return (
    <div className="space-y-8">
      <div style={pageStaggerItemStyle(0, staggerVisible)}>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Manage your clients, follow up on assessments, and track progress.
        </p>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3" style={pageStaggerItemStyle(1, staggerVisible)}>
          <h2 className={cn(sectionHeadingClass, 'mb-0')}>Report generation stats</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedMonth(m => shiftMonth(m.year, m.month, -1))}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="min-w-[9rem] text-center text-sm font-medium text-foreground">
              {monthLabel(selectedMonth.year, selectedMonth.month)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth(m => shiftMonth(m.year, m.month, 1))}
              disabled={isCurrentMonth}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={pageStaggerItemStyle(2, staggerVisible)}>
          <Card className={glassCard}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-muted-foreground">
                <ClipboardList className="size-3.5" aria-hidden />
                Self assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-3xl font-bold tabular-nums text-foreground/40">—</p>
              ) : (
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {reportStats?.self_count ?? 0}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">reports generated</p>
            </CardContent>
          </Card>
          <Card className={glassCard}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5 text-muted-foreground">
                <ClipboardList className="size-3.5" aria-hidden />
                Supervised assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <p className="text-3xl font-bold tabular-nums text-foreground/40">—</p>
              ) : (
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {reportStats?.supervised_count ?? 0}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">reports generated</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className={sectionHeadingClass} style={pageStaggerItemStyle(3, staggerVisible)}>
          Linked clients
        </h2>
        <Card className={glassCard} style={pageStaggerItemStyle(4, staggerVisible)}>
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Linked clients</CardTitle>
            <CardDescription className="text-muted-foreground">All clients linked to you</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-4xl font-bold tabular-nums text-foreground">{linkedClientCount}</p>
            <Button asChild variant="zenOutline" size="sm" className="shrink-0 gap-2 self-start sm:self-auto">
              <Link to="/app/therapist/clients">
                <Users className="size-4" aria-hidden />
                View all clients
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className={glassCard} style={pageStaggerItemStyle(5, staggerVisible)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-foreground">Notifications</CardTitle>
          <CardDescription className="text-muted-foreground">
            Supervised work needing observations, plus self-assessment clients waiting for follow-up
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <p className="text-sm">Loading notifications…</p>
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="rounded-full bg-white/5 p-4 ring-1 ring-white/10">
                <Bell className="size-7 text-muted-foreground" aria-hidden />
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                All caught up. Nothing in your queue right now.
              </p>
              <Button asChild variant="zenOutline" size="sm">
                <Link to="/app/therapist/notifications">Open notifications</Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2">
                {pendingItems.map(item => {
                  const homeCard = cn(
                    'group flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-5 shadow-sm',
                    'ring-1 ring-white/5 transition-all',
                    'hover:border-white/20 hover:bg-white/[0.08] hover:ring-white/15'
                  )
                  if (item.kind === 'supervised') {
                    return (
                      <li key={`supervised-${item.assessmentId}`}>
                        <Link to={`/app/therapist/clients/${item.clientId}/observations`} className={homeCard}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                                {item.clientName}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                Supervised · completed {formatCompletedDate(item.completedAt)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 border-sky-400/30 bg-sky-500/12 text-xs text-sky-100"
                            >
                              Observations
                            </Badge>
                          </div>
                        </Link>
                      </li>
                    )
                  }
                  return (
                    <li key={`self-${item.assessmentId}`}>
                      <div className={cn(homeCard, 'relative hover:border-white/12 hover:bg-white/[0.05]')}>
                        <Link
                          to={`/app/therapist/clients/${item.clientId}`}
                          className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zen-ring-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                          aria-label={`Open ${item.clientName} client details`}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                              {item.clientName}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              Self assessment · waiting for plan/status · {formatCompletedDate(item.completedAt)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-amber-400/30 bg-amber-500/12 text-xs text-amber-100"
                          >
                            Follow up
                          </Badge>
                        </div>
                        <div className="pointer-events-none relative z-10 flex flex-wrap gap-2 pt-0.5">
                          {item.email ? (
                            <Button variant="zenOutline" size="sm" className="pointer-events-auto h-8 gap-1" asChild>
                              <a href={`mailto:${item.email}`} onClick={e => e.stopPropagation()}>
                                <Mail className="size-3.5" aria-hidden />
                                Email
                              </a>
                            </Button>
                          ) : null}
                          {item.phone ? (
                            <Button variant="zenOutline" size="sm" className="pointer-events-auto h-8 gap-1" asChild>
                              <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()}>
                                <Phone className="size-3.5" aria-hidden />
                                Call
                              </a>
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" className="pointer-events-auto h-8 gap-1" asChild>
                            <Link to={`/app/therapist/clients/${item.clientId}`}>Review status</Link>
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="flex justify-end">
                <Button asChild variant="zenOutline" size="sm">
                  <Link to="/app/therapist/notifications">View all notifications</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
