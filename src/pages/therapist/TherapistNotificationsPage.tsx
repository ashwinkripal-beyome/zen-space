import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Loader2, Mail, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useTherapistPendingRealtime } from '@/hooks/useTherapistPendingRealtime'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  fetchTherapistPendingDisplayRows,
  type TherapistPendingDisplayRow,
} from '@/lib/therapistPendingObservations'
import { cn } from '@/lib/utils'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

const cardClass = cn(
  'group flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-5 shadow-sm',
  'ring-1 ring-white/5 transition-all',
  'hover:border-white/20 hover:bg-white/[0.08] hover:ring-white/15'
)

export function TherapistNotificationsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<TherapistPendingDisplayRow[]>([])
  const [loading, setLoading] = useState(true)
  const headerStagger = usePageStaggerVisible(true)
  const bodyStagger = usePageStaggerVisible(!loading, items.length)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    if (!user?.id) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    const rows = await fetchTherapistPendingDisplayRows(user.id)
    setItems(rows)
    if (!silent) setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useTherapistPendingRealtime(user?.id, Boolean(user?.id), () => void load({ silent: true }), {
    channelScope: 'notifications-page',
  })

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load({ silent: true })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  return (
    <div className="space-y-6">
      <div style={pageStaggerItemStyle(0, headerStagger)}>
        <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Updates when supervised assessments need observations or self-assessment clients need follow-up.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
          <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
          <p>Loading…</p>
        </div>
      ) : items.length === 0 ? (
        <Card
          className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          style={pageStaggerItemStyle(0, bodyStagger)}
        >
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-full bg-white/5 p-5 ring-1 ring-white/10">
              <Bell className="size-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-muted-foreground">All caught up! Nothing is waiting in your queue.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.assessmentId}`} style={pageStaggerItemStyle(i, bodyStagger)}>
              {item.kind === 'supervised' ? (
                <Link to={`/app/therapist/clients/${item.clientId}/observations`} className={cardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold tracking-tight text-foreground">{item.clientName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Supervised assessment completed {formatDate(item.completedAt)}
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
              ) : (
                <div
                  className={cn(
                    cardClass,
                    'relative overflow-hidden p-0 hover:border-white/12 hover:bg-white/[0.05]'
                  )}
                >
                  <Link
                    to={`/app/therapist/clients/${item.clientId}`}
                    className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zen-ring-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    aria-label={`Open ${item.clientName} client details`}
                  />
                  <div className="p-5 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                          {item.clientName}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Self assessment completed {formatDate(item.completedAt)} · waiting for plan/status
                        </p>
                        <p className="mt-2 text-xs text-sky-200/80">Open client details</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-400/30 bg-amber-500/12 text-xs text-amber-100"
                      >
                        Follow up
                      </Badge>
                    </div>
                  </div>
                  <div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[0.02] px-5 py-3">
                    {item.email ? (
                      <Button variant="zenOutline" size="sm" className="pointer-events-auto gap-1.5" asChild>
                        <a href={`mailto:${item.email}`}>
                          <Mail className="size-3.5" aria-hidden />
                          Email
                        </a>
                      </Button>
                    ) : null}
                    {item.phone ? (
                      <Button variant="zenOutline" size="sm" className="pointer-events-auto gap-1.5" asChild>
                        <a href={`tel:${item.phone}`}>
                          <Phone className="size-3.5" aria-hidden />
                          Call
                        </a>
                      </Button>
                    ) : null}
                    {!item.email && !item.phone ? (
                      <p className="text-xs text-muted-foreground">No email or phone on file.</p>
                    ) : null}
                    <Button type="button" size="sm" className="pointer-events-auto gap-1.5" asChild>
                      <Link to={`/app/therapist/clients/${item.clientId}`}>Review & mark status</Link>
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
