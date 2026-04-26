import { Link } from 'react-router-dom'
import { Calendar, ClipboardCheck, Lock, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BENCHMARK_TOTAL_QUESTIONS } from '@/data/benchmarkAssessment'
import { useAuth } from '@/hooks/useAuth'
import { useAssessmentAvailability } from '@/hooks/useAssessmentAvailability'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { cn } from '@/lib/utils'

function displayFirstName(profile: { first_name?: string; name?: string } | null): string {
  if (!profile) return 'there'
  const f = profile.first_name?.trim()
  if (f) return f
  const n = profile.name?.trim()?.split(/\s+/)[0]
  if (n) return n
  return 'there'
}

function formatCooldownDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

type AssessmentTile = {
  id: string
  title: string
  description: string
  duration: string
  questions: number
  icon: React.ReactNode
  status: 'available' | 'locked' | 'cooldown' | 'coming_soon'
  statusLabel: string
  to?: string
}

export function ClientAssessmentPage() {
  const { profile } = useAuth()
  const { hasTherapists, therapistResolutionPending } = useClientOnboarding()
  const availability = useAssessmentAvailability()
  const name = displayFirstName(profile ?? null)

  const therapistLinked = hasTherapists === true
  const paidForSupervised = availability.isPaidForSupervised
  const staggerVisible = usePageStaggerVisible(true)
  const showTherapistBanner = !therapistLinked && !therapistResolutionPending
  const tileStaggerBase = showTherapistBanner ? 2 : 1

  const selfStatus = (): Pick<AssessmentTile, 'status' | 'statusLabel' | 'to'> => {
    if (therapistResolutionPending) return { status: 'locked', statusLabel: 'Loading…' }
    if (availability.loading) return { status: 'locked', statusLabel: 'Loading…' }
    if (therapistLinked && paidForSupervised) {
      return {
        status: 'locked',
        statusLabel: 'Use supervised assessment',
      }
    }
    if (!availability.self.available) {
      const reason = availability.self.selfUnavailableReason
      if (reason === 'supervised_first') {
        return {
          status: 'locked',
          statusLabel: 'Not available after a supervised assessment',
        }
      }
      if (reason === 'already_completed') {
        return { status: 'locked', statusLabel: 'Already completed' }
      }
      return { status: 'locked', statusLabel: 'Not available' }
    }
    return { status: 'available', statusLabel: 'Available', to: '/app/client/assessment/self/session' }
  }

  const supervisedStatus = (): Pick<AssessmentTile, 'status' | 'statusLabel' | 'to'> => {
    if (!therapistLinked) return { status: 'locked', statusLabel: 'Link therapist first' }
    if (availability.loading) return { status: 'locked', statusLabel: 'Loading…' }
    if (therapistLinked && !paidForSupervised) {
      return { status: 'locked', statusLabel: 'Your therapist will enable this for paid customers' }
    }
    if (!availability.supervised.available) {
      const br = availability.supervised.supervisedBlockedReason
      if (br === 'plan_incomplete') {
        return {
          status: 'cooldown',
          statusLabel: 'Mark every week complete on your 18-week plan first',
        }
      }
      if (br === 'no_plan') {
        return {
          status: 'cooldown',
          statusLabel: 'Waiting for your 18-week plan from your therapist',
        }
      }
      if (br === 'min_weeks' && availability.supervised.nextDate) {
        return {
          status: 'cooldown',
          statusLabel: `Available after ${formatCooldownDate(availability.supervised.nextDate)}`,
        }
      }
      return { status: 'cooldown', statusLabel: 'Not available yet' }
    }
    return { status: 'available', statusLabel: 'Available', to: '/app/client/assessment/supervised/session' }
  }

  const tiles: AssessmentTile[] = [
    {
      id: 'supervised',
      title: 'Supervised Assessment',
      description:
        'Complete the benchmark with your therapist involved. After you finish, your therapist will add professional observations and generate your personalized Zen Plan report.',
      duration: '~15 min',
      questions: BENCHMARK_TOTAL_QUESTIONS,
      icon: <ShieldCheck className="size-8 text-emerald-300" />,
      ...supervisedStatus(),
    },
    {
      id: 'self',
      title: 'Self Assessment',
      description:
        therapistLinked
          ? 'One-time self benchmark while you are linked and not yet on a paid program. After your therapist marks you as a paid customer, use the supervised assessment instead.'
          : 'Trial assessment before you link with a therapist: full benchmark on your own, your observations, and an instant Zen Plan report. When you are linked and on a paid program, use the supervised assessment instead.',
      duration: '~15 min',
      questions: BENCHMARK_TOTAL_QUESTIONS,
      icon: <ClipboardCheck className="size-8 text-sky-300" />,
      ...selfStatus(),
    },
  ]

  return (
    <div className="space-y-6">
      <div style={pageStaggerItemStyle(0, staggerVisible)}>
        <h1 className="text-3xl font-bold text-foreground">Assessments</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Hi {name}, choose an assessment to begin your journey.
        </p>
      </div>

      {showTherapistBanner && (
        <div
          className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90"
          style={pageStaggerItemStyle(1, staggerVisible)}
        >
          Some assessments require a linked therapist.{' '}
          <Link to="/app/client/otp" className="font-medium underline underline-offset-4 hover:text-foreground">
            Link a therapist
          </Link>{' '}
          to unlock them.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile, tileIndex) => {
          const disabled = tile.status !== 'available'
          const wrapperClass = cn(
            'group block rounded-2xl transition-all',
            !disabled && 'cursor-pointer hover:scale-[1.02]'
          )

          const badgeVariant =
            tile.status === 'available'
              ? 'default' as const
              : tile.status === 'cooldown'
                ? 'destructive' as const
                : tile.status === 'locked'
                  ? 'destructive' as const
                  : 'secondary' as const

          const card = (
            <Card
              className={cn(
                'zen-glass-card h-full ring-0 shadow-none transition-colors',
                !disabled && 'zen-ring-primary group-hover:ring-1',
                disabled && 'zen-ring-secondary'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                    {tile.icon}
                  </div>
                  <Badge
                    variant={badgeVariant}
                    className={cn(
                      'shrink-0 text-[10px]',
                      tile.status === 'available' &&
                        'border-emerald-400/30 bg-emerald-500/20 text-emerald-200',
                      tile.status === 'cooldown' &&
                        'border-blue-400/30 bg-blue-500/20 text-blue-200',
                      tile.status === 'locked' &&
                        'border-sky-400/35 bg-sky-500/15 text-sky-200',
                      tile.status === 'coming_soon' &&
                        'border-white/20 bg-white/10 text-muted-foreground'
                    )}
                  >
                    {tile.status === 'locked' && (
                      <Lock className="mr-1 size-2.5" aria-hidden />
                    )}
                    {tile.status === 'cooldown' && (
                      <Calendar className="mr-1 size-2.5" aria-hidden />
                    )}
                    {tile.statusLabel}
                  </Badge>
                </div>
                <CardTitle className="mt-3 text-lg text-foreground">{tile.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {tile.description}
                </CardDescription>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{tile.questions} questions</span>
                  <span className="text-foreground/20">·</span>
                  <span>{tile.duration}</span>
                </div>
              </CardContent>
            </Card>
          )

          const baseStagger = pageStaggerItemStyle(tileStaggerBase + tileIndex, staggerVisible)
          // Inline stagger opacity wins over Tailwind opacity-60; keep locked/cooldown tiles dimmer when visible.
          const staggerStyle =
            staggerVisible && disabled ? { ...baseStagger, opacity: 0.6 } : baseStagger

          if (tile.to && !disabled) {
            return (
              <Link key={tile.id} to={tile.to} className={wrapperClass} style={staggerStyle}>
                {card}
              </Link>
            )
          }

          return (
            <div key={tile.id} className={wrapperClass} style={staggerStyle}>
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}
