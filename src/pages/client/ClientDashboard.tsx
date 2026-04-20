import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Mail, Phone, Sparkles, UserPlus } from 'lucide-react'
import { AnimatedScoreMeter } from '@/components/AnimatedScoreMeter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { extractAffirmationsFromRitual } from '@/lib/extractAffirmationsFromRitual'
import { parsePlanDays } from '@/lib/parsePlanDays'
import { fetchReportPlanProgress, saveReportPlanProgress } from '@/lib/reportPlanProgress'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { BENCHMARK_OVERALL_MAX_SCORE, BENCHMARK_ZONE_MAX_SCORE } from '@/data/benchmarkAssessment'
import { overallStatusLabel, zoneStatusLabel } from '@/lib/zenScoreLabels'

function dashboardGreetingFirstName(profile: { first_name?: string; name?: string } | null): string | null {
  if (!profile) return null
  const f = profile.first_name?.trim()
  if (f) return f
  const n = profile.name?.trim()?.split(/\s+/)[0]
  if (n) return n
  return null
}

const cardSupport = 'zen-glass-card ring-0 shadow-none zen-ring-secondary'
const cardPrimary = 'zen-glass-card ring-0 shadow-none zen-ring-primary'

const cardLayout = 'flex h-full min-h-[220px] flex-col sm:min-h-[236px]'

type LatestScores = {
  overall: number | null
  balance: number | null
  blossom: number | null
  bliss: number | null
  affirmations: string[] | null
  ritualSection: string | null
}

function parseLatestRow(row: Record<string, unknown>): LatestScores | null {
  const join = row.assessments as Record<string, unknown> | Record<string, unknown>[] | null
  const assessment = Array.isArray(join) ? join[0] : join
  const overall =
    typeof assessment?.score_total === 'number' ? assessment.score_total : null
  const balance = typeof row.imbalance_score === 'number' ? row.imbalance_score : null
  const blossom =
    typeof row.blossom_zone_emotional === 'number' ? row.blossom_zone_emotional : null
  const bliss = typeof row.bliss_zone_spiritual === 'number' ? row.bliss_zone_spiritual : null
  const aff = row.affirmations
  const affirmations = Array.isArray(aff) ? (aff as string[]).filter(Boolean) : null
  const ritualSection =
    typeof row.ritual_section === 'string' ? row.ritual_section : null

  if (overall == null && balance == null && blossom == null && bliss == null) return null

  return {
    overall,
    balance,
    blossom,
    bliss,
    affirmations,
    ritualSection,
  }
}

type DashboardNavCard = {
  title: string
  desc: string
  to: string
  label: string
  variant: 'zen' | 'zenRose' | 'zenOutline'
  className: string
  locked: boolean
}

type LinkRow = { therapist_id: string; created_at: string }

interface TherapistInfo {
  id: string
  name: string
  gender: string | null
  phone: string | null
  email: string | null
}

function displayTherapistName(row: {
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  email?: string | null
}): string {
  const fn = row.first_name?.trim()
  const ln = row.last_name?.trim()
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ')
  if (row.name?.trim()) return row.name.trim()
  if (row.email) return row.email.split('@')[0] ?? 'Therapist'
  return 'Therapist'
}

function formatGender(g: string | null): string | null {
  if (!g) return null
  return g.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function dayOrderFromParsed(days: ReturnType<typeof parsePlanDays>) {
  const seen = new Set<number>()
  const order: number[] = []
  for (const d of days) {
    if (!seen.has(d.day)) {
      seen.add(d.day)
      order.push(d.day)
    }
  }
  return order.sort((a, b) => a - b)
}

function formatActivityTitle(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.replace(/\s+/g, ' ').trim()
  const stripped = t
    .replace(/^activities:\s*/i, '')
    .replace(/^activity:\s*/i, '')
    .trim()
  return stripped || null
}

export function ClientDashboard() {
  const { profile, user } = useAuth()
  const { therapistSectionLocked, hasTherapists, therapistResolutionPending } = useClientOnboarding()
  const greetingFirst = dashboardGreetingFirstName(profile ?? null)
  const [stripLoading, setStripLoading] = useState(true)
  const [latestReportId, setLatestReportId] = useState<string | null>(null)
  const [planSection, setPlanSection] = useState<string | null>(null)
  const [latestScores, setLatestScores] = useState<LatestScores | null>(null)
  const [planProgressTick, setPlanProgressTick] = useState(0)
  const [planCompleted, setPlanCompleted] = useState<number[]>([])
  const [affirmationQuote, setAffirmationQuote] = useState<string | null>(null)
  const [confirmMarkOpen, setConfirmMarkOpen] = useState(false)
  const [linkedTherapists, setLinkedTherapists] = useState<TherapistInfo[]>([])
  const [therapistsLoading, setTherapistsLoading] = useState(true)

  const [phase, setPhase] = useState<'fade-in' | 'pause' | 'reveal'>('fade-in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('pause'), 100)
    const t2 = setTimeout(() => setPhase('reveal'), 800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const loadLinkedTherapists = useCallback(async () => {
    if (!user?.id) {
      setLinkedTherapists([])
      setTherapistsLoading(false)
      return
    }
    setTherapistsLoading(true)
    try {
      const { data: links, error } = await supabase
        .from('therapist_clients')
        .select('therapist_id, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setLinkedTherapists([])
        return
      }

      const list = (links ?? []) as LinkRow[]
      const ids = [...new Set(list.map(l => l.therapist_id))]
      if (ids.length === 0) {
        setLinkedTherapists([])
        return
      }

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, name, email, gender, phone_number')
        .in('id', ids)

      if (pErr) {
        setLinkedTherapists([])
        return
      }

      const result: TherapistInfo[] = (profiles ?? []).map(p => {
        const row = p as {
          id: string
          first_name?: string | null
          last_name?: string | null
          name?: string | null
          email?: string | null
          gender?: string | null
          phone_number?: string | null
        }
        return {
          id: row.id,
          name: displayTherapistName(row),
          gender: row.gender ?? null,
          phone: row.phone_number ?? null,
          email: row.email ?? null,
        }
      })
      setLinkedTherapists(result)
    } finally {
      setTherapistsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadLinkedTherapists()
  }, [loadLinkedTherapists])

  const loadDashboardStrip = useCallback(async () => {
    if (!user?.id) {
      setStripLoading(false)
      setLatestReportId(null)
      setPlanSection(null)
      setLatestScores(null)
      return
    }
    setStripLoading(true)

    let snapQuery = await supabase
      .from('reports')
      .select(
        'id, plan_section, imbalance_score, blossom_zone_emotional, bliss_zone_spiritual, affirmations, ritual_section, assessments ( score_total )'
      )
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (snapQuery.error) {
      snapQuery = await supabase
        .from('reports')
        .select(
          'id, content, imbalance_score, blossom_zone_emotional, bliss_zone_spiritual, assessments ( score_total )'
        )
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    }

    if (!snapQuery.error && snapQuery.data) {
      const row = snapQuery.data as Record<string, unknown>
      setLatestReportId(String(row.id ?? '') || null)
      const ps = (row.plan_section as string) || null
      setPlanSection(ps)
      setLatestScores(parseLatestRow(row))
    } else {
      setLatestReportId(null)
      setPlanSection(null)
      setLatestScores(null)
    }
    setStripLoading(false)
  }, [user?.id])

  useEffect(() => {
    void loadDashboardStrip()
  }, [loadDashboardStrip])

  useEffect(() => {
    if (!latestScores) {
      setAffirmationQuote(null)
      return
    }
    const pool = latestScores.affirmations?.length
      ? latestScores.affirmations
      : extractAffirmationsFromRitual(latestScores.ritualSection)
    if (!pool.length) {
      setAffirmationQuote(null)
      return
    }
    setAffirmationQuote(pool[Math.floor(Math.random() * pool.length)] ?? null)
  }, [latestScores])

  useEffect(() => {
    if (!user?.id || !latestReportId) {
      setPlanCompleted([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { completed } = await fetchReportPlanProgress(user.id, latestReportId)
        if (!cancelled) setPlanCompleted(completed)
      } catch {
        if (!cancelled) {
          setPlanCompleted([])
          toast.error('Could not load plan progress')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, latestReportId, planProgressTick])

  useEffect(() => {
    if (!user?.id || !latestReportId) return
    const bump = () => setPlanProgressTick(t => t + 1)
    window.addEventListener('focus', bump)
    return () => window.removeEventListener('focus', bump)
  }, [user?.id, latestReportId])

  const ongoing = useMemo(() => {
    if (!user?.id || !latestReportId || !planSection?.trim()) {
      return { activeDay: null as number | null, activityTitle: null as string | null, hasPlanDays: false }
    }
    const days = parsePlanDays(planSection)
    if (days.length === 0) {
      return { activeDay: null, activityTitle: null, hasPlanDays: false }
    }
    const order = dayOrderFromParsed(days)
    const activeDay = order.find(d => !planCompleted.includes(d)) ?? null
    const block = activeDay != null ? days.find(d => d.day === activeDay) : null
    return {
      activeDay,
      activityTitle: formatActivityTitle(block?.title ?? null),
      hasPlanDays: true,
    }
  }, [user?.id, latestReportId, planSection, planCompleted])

  const hasAnyScore =
    latestScores != null &&
    (latestScores.overall != null ||
      latestScores.balance != null ||
      latestScores.blossom != null ||
      latestScores.bliss != null)

  const showCards = phase === 'reveal'

  const dashboardStaggerVisible = usePageStaggerVisible(
    Boolean(showCards && user?.id && !stripLoading),
    stripLoading ? 'loading' : 'dashboard-content'
  )

  const therapistCardLockedEmpty =
    therapistSectionLocked && !therapistsLoading && linkedTherapists.length === 0

  const planTherapistLinked = hasTherapists === true

  const handleConfirmMarkComplete = async () => {
    if (!user?.id || !latestReportId || ongoing.activeDay == null) return
    if (planCompleted.includes(ongoing.activeDay)) return
    const next = [...planCompleted, ongoing.activeDay].sort((a, b) => a - b)
    try {
      await saveReportPlanProgress(user.id, latestReportId, next)
      setPlanCompleted(next)
      setConfirmMarkOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save progress')
    }
  }

  const canMarkTodayComplete =
    ongoing.hasPlanDays && ongoing.activeDay != null && user?.id && latestReportId

  const assessmentCard: DashboardNavCard = {
    title: 'Assessments',
    desc: 'Access reports and 18-day plans by taking a swipe-based assessment.',
    to: '/app/client/assessment',
    label: 'Go to assessments',
    variant: 'zen',
    className: cn(cardPrimary, cardLayout),
    locked: false,
  }

  const primaryTherapist = linkedTherapists[0] ?? null

  const renderNavCard = (card: DashboardNavCard, staggerIndex: number) => {
    const base = pageStaggerItemStyle(staggerIndex, dashboardStaggerVisible)
    const cardStyle =
      dashboardStaggerVisible && card.locked ? { ...base, opacity: 0.4 } : base
    return (
      <Card key={card.title} className={card.className} style={cardStyle}>
        <CardHeader className="shrink-0">
          <CardTitle className="text-xl">{card.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <p className="flex-1 text-pretty leading-relaxed text-muted-foreground">{card.desc}</p>
          {card.locked ? (
            <Button type="button" disabled variant={card.variant} className="mt-auto w-full">
              {card.label}
            </Button>
          ) : (
            <Button asChild variant={card.variant} className="mt-auto w-full">
              <Link to={card.to}>{card.label}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative min-h-[80vh]">
      <Dialog open={confirmMarkOpen} onOpenChange={setConfirmMarkOpen}>
        <DialogContent className="zen-glass-card rounded-2xl border-white/15 text-foreground ring-0 shadow-none">
          <DialogHeader>
            <DialogTitle className="text-foreground">Mark today complete?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {ongoing.activeDay != null ? (
                <>
                  This will mark <span className="text-foreground/90">Day {ongoing.activeDay}</span> as done
                  on your 18-day plan. You can still open the plan to review any day.
                </>
              ) : (
                'No active day to mark.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="zenOutline" onClick={() => setConfirmMarkOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="zen"
              disabled={!canMarkTodayComplete}
              onClick={() => void handleConfirmMarkComplete()}
            >
              Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          'text-center transition-all duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          phase === 'fade-in' && 'translate-y-[25vh] opacity-0',
          phase === 'pause' && 'translate-y-[25vh] opacity-100',
          phase === 'reveal' && 'translate-y-0 opacity-100',
        )}
      >
        <h1 className="text-4xl font-bold text-foreground">
          {greetingFirst ? `Hi ${greetingFirst}!` : 'Hello,'}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Welcome to Zen Space. Your mental wellness journey.
        </p>
      </div>

      {showCards && user?.id ? (
        <div
          className={cn(
            'mt-8 space-y-6 transition-all duration-[800ms] ease-out',
            showCards ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0',
          )}
        >
          {stripLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
              <p>Loading…</p>
            </div>
          ) : (
            <>
              <div style={pageStaggerItemStyle(0, dashboardStaggerVisible)}>
                <Card className="zen-glass-card zen-ring-primary ring-0 shadow-none">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-lg text-foreground">Latest assessment scores</CardTitle>
                        <CardDescription className="text-muted-foreground">
                          From your most recent Zen Plan report
                        </CardDescription>
                      </div>
                      <Button
                        asChild
                        variant="zen"
                        size="sm"
                        className="shrink-0 self-start sm:self-auto"
                      >
                        <Link to="/app/client/report">View Reports</Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {hasAnyScore && latestScores ? (
                      <>
                        {latestScores.overall != null ? (
                          <div>
                            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-sm font-medium text-foreground/90">Overall</span>
                              <span className="text-sm text-muted-foreground">
                                {latestScores.overall} / {BENCHMARK_OVERALL_MAX_SCORE} —{' '}
                                <span className="font-medium text-emerald-200/95">
                                  {overallStatusLabel(latestScores.overall)}
                                </span>
                              </span>
                            </div>
                            <AnimatedScoreMeter
                              variant="wellness"
                              value={latestScores.overall}
                              max={BENCHMARK_OVERALL_MAX_SCORE}
                              delayMs={80}
                            />
                          </div>
                        ) : null}

                        <div className="grid gap-5 sm:grid-cols-3">
                          {[
                            {
                              label: 'Balance',
                              value: latestScores.balance,
                              max: BENCHMARK_ZONE_MAX_SCORE,
                              delay: 160,
                            },
                            {
                              label: 'Blossom',
                              value: latestScores.blossom,
                              max: BENCHMARK_ZONE_MAX_SCORE,
                              delay: 240,
                            },
                            {
                              label: 'Bliss',
                              value: latestScores.bliss,
                              max: BENCHMARK_ZONE_MAX_SCORE,
                              delay: 320,
                            },
                          ].map(
                            z =>
                              z.value != null && (
                                <div key={z.label}>
                                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      {z.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {z.value}/{z.max}{' '}
                                      <span className="text-foreground/90">{zoneStatusLabel(z.value)}</span>
                                    </span>
                                  </div>
                                  <AnimatedScoreMeter variant="wellness" value={z.value} max={z.max} delayMs={z.delay} />
                                </div>
                              )
                          )}
                        </div>

                        {affirmationQuote ? (
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:px-5 sm:py-4">
                            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-300/90" aria-hidden />
                              <span className="font-medium uppercase tracking-wider">Affirmation</span>
                            </p>
                            <p className="mt-2 text-base leading-relaxed text-foreground/90">
                              &ldquo;{affirmationQuote}&rdquo;
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-pretty leading-relaxed text-muted-foreground">
                        You&apos;ll see your latest scores and affirmations here once you&apos;ve taken your
                        assessments.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card
                  className={cn(cardPrimary, cardLayout)}
                  style={pageStaggerItemStyle(1, dashboardStaggerVisible)}
                >
                  {therapistResolutionPending ? (
                    <CardContent className="flex flex-1 flex-col justify-center py-6">
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    </CardContent>
                  ) : !planTherapistLinked ? (
                    <CardContent className="flex flex-1 flex-col justify-center gap-3 py-6">
                      <p className="text-pretty leading-relaxed text-muted-foreground">
                        Connect with a Zen Specialist at your nearest Zen Garden to link your account and access your
                        18-day plan here.
                      </p>
                    </CardContent>
                  ) : !ongoing.hasPlanDays ? (
                    <CardContent className="flex flex-1 flex-col justify-center py-6">
                      <p className="text-pretty leading-relaxed text-muted-foreground">
                        No active plan. Take an assessment to create your 18-day plan.
                      </p>
                    </CardContent>
                  ) : ongoing.activeDay != null ? (
                    <>
                      <CardHeader className="shrink-0 pb-2">
                        <CardTitle className="text-xl text-foreground">Day {ongoing.activeDay}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                        <div className="flex-1">
                          {ongoing.activityTitle ? (
                            <p className="text-pretty leading-relaxed text-muted-foreground">{ongoing.activityTitle}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Open your plan for full details.</p>
                          )}
                        </div>
                        <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Button asChild variant="zenOutline" className="w-full sm:flex-1">
                            <Link to="/app/client/plan">Open 18-day plan</Link>
                          </Button>
                          <Button
                            type="button"
                            variant="secondaryBlue"
                            className="w-full sm:flex-1"
                            disabled={!canMarkTodayComplete}
                            onClick={() => setConfirmMarkOpen(true)}
                          >
                            Mark as complete
                          </Button>
                        </div>
                      </CardContent>
                    </>
                  ) : (
                    <>
                      <CardHeader className="shrink-0 pb-2">
                        <CardTitle className="text-xl text-foreground">Plan complete</CardTitle>
                      </CardHeader>
                      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                        <p className="flex-1 text-pretty leading-relaxed text-muted-foreground">
                          You&apos;ve marked all days complete for this plan. Nice work.
                        </p>
                        <Button asChild variant="zenOutline" className="mt-auto w-full">
                          <Link to="/app/client/plan">Review plan</Link>
                        </Button>
                      </CardContent>
                    </>
                  )}
                </Card>

                {renderNavCard(assessmentCard, 2)}

                <Card
                  className={cn(
                    cardSupport,
                    cardLayout,
                    therapistCardLockedEmpty && 'pointer-events-none opacity-40'
                  )}
                  style={pageStaggerItemStyle(3, dashboardStaggerVisible)}
                >
                  <CardHeader className="shrink-0">
                    <CardTitle className="text-xl">Therapist</CardTitle>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                    {therapistsLoading ? (
                      <p className="flex-1 text-sm text-muted-foreground">Loading…</p>
                    ) : primaryTherapist ? (
                      <div className="flex-1 space-y-3">
                        <p className="text-lg font-semibold text-foreground">{primaryTherapist.name}</p>
                        {primaryTherapist.gender ? (
                          <p className="text-sm text-muted-foreground">{formatGender(primaryTherapist.gender)}</p>
                        ) : null}
                        {primaryTherapist.phone ? (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="size-3.5 text-sky-300/70" aria-hidden />
                            {primaryTherapist.phone}
                          </p>
                        ) : null}
                        {primaryTherapist.email ? (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="size-3.5 text-sky-300/70" aria-hidden />
                            {primaryTherapist.email}
                          </p>
                        ) : null}
                        {linkedTherapists.length > 1 ? (
                          <p className="pt-1 text-xs text-muted-foreground">
                            <Link to="/app/client/therapists" className="text-sky-300 underline underline-offset-2">
                              View all linked therapists
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 text-pretty leading-relaxed text-muted-foreground">
                          Link a therapist with their code to share your progress.
                        </p>
                        {therapistSectionLocked ? (
                          <Button type="button" disabled variant="zenOutline" className="mt-auto w-full gap-2">
                            <UserPlus className="size-4" aria-hidden />
                            Add therapist
                          </Button>
                        ) : (
                          <Button asChild variant="zenOutline" className="mt-auto w-full">
                            <Link to="/app/client/otp" className="gap-2">
                              <UserPlus className="size-4" aria-hidden />
                              Add therapist
                            </Link>
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/*
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                Report + 18-Day Plan tiles — temporarily hidden
              </div>
              */}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
