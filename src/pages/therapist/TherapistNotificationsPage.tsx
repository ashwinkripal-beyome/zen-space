import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useTherapistPendingRealtime } from '@/hooks/useTherapistPendingRealtime'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { formatClientDisplayName } from '@/lib/clientDisplayName'
import { fetchTherapistPendingSupervisedAssessments } from '@/lib/therapistPendingObservations'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type PendingRow = {
  assessmentId: string
  clientId: string
  clientName: string
  completedAt: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function TherapistNotificationsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<PendingRow[]>([])
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

    const pending = await fetchTherapistPendingSupervisedAssessments(user.id)
    if (pending.length === 0) {
      setItems([])
      if (!silent) setLoading(false)
      return
    }

    const uniqueClientIds = [...new Set(pending.map(p => p.clientId))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name, first_name, last_name')
      .in('id', uniqueClientIds)

    const byId = new Map((profiles ?? []).map(p => [p.id, p]))

    setItems(
      pending.map(p => ({
        assessmentId: p.assessmentId,
        clientId: p.clientId,
        clientName: formatClientDisplayName(byId.get(p.clientId) ?? undefined),
        completedAt: p.completedAt,
      }))
    )
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
          Clients whose latest supervised assessment needs your observations and Zen Plan report generation.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Updates when a linked client&apos;s assessment or report changes. As a backup, the list also refreshes
          every five minutes while this page is open.
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
            <p className="text-muted-foreground">All caught up! No assessments waiting for observations or report generation.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={item.assessmentId} style={pageStaggerItemStyle(i, bodyStagger)}>
              <Link
                to={`/app/therapist/clients/${item.clientId}/observations`}
                className={cn(
                  'group flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-5 shadow-sm',
                  'ring-1 ring-white/5 transition-all',
                  'hover:border-white/20 hover:bg-white/[0.08] hover:ring-white/15'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                      {item.clientName}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Assessment completed {formatDate(item.completedAt)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-emerald-400/30 bg-emerald-500/15 text-xs text-emerald-200"
                  >
                    Action needed
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
