import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Copy, Loader2, Mail, Phone, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useTherapistOtpSessionDialog,
  type ActiveOtpSession,
} from '@/components/therapist/TherapistOtpSessionDialog'
import { useAuth } from '@/hooks/useAuth'
import { useTherapistPendingRealtime } from '@/hooks/useTherapistPendingRealtime'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  claimUnlinkedSelfLead,
  fetchTherapistPendingDisplayRows,
  type TherapistPendingDisplayRow,
} from '@/lib/therapistPendingObservations'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type PendingNotificationRow = TherapistPendingDisplayRow

function formatCompletedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const glassCard = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
const glassCardPremium = cn(
  'zen-glass-card ring-0',
  'shadow-[0_0_0_1px_var(--zen-ring-primary),0_8px_32px_rgba(0,0,0,0.12)]'
)

export function TherapistHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [activeOtpSessions, setActiveOtpSessions] = useState<ActiveOtpSession[]>([])
  const [linkedClientCount, setLinkedClientCount] = useState(0)
  const [pendingItems, setPendingItems] = useState<PendingNotificationRow[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)

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

  const fetchData = useCallback(async () => {
    if (!user?.id) return
    try {
      const [sessionsRes, countRes] = await Promise.all([
        supabase
          .from('therapist_otp_sessions')
          .select(
            'id, session_name, otp, max_clients, clients_used, expires_at, created_at, link_kind, company_id, companies ( name )'
          )
          .eq('therapist_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('therapist_clients')
          .select('id', { count: 'exact', head: true })
          .eq('therapist_id', user.id),
      ])

      if (sessionsRes.error) {
        console.error('[therapist_otp_sessions]', sessionsRes.error)
      } else if (sessionsRes.data?.length) {
        setActiveOtpSessions(
          sessionsRes.data.map(row => {
            const companies = row as {
              link_kind?: string
              companies?: { name: string } | { name: string }[] | null
            }
            const emb = companies.companies
            const companyName =
              emb == null
                ? null
                : Array.isArray(emb)
                  ? emb[0]?.name
                  : typeof emb === 'object' && 'name' in emb
                    ? (emb as { name: string }).name
                    : null
            return {
              localId: String(row.id),
              serverId: String(row.id),
              name: String(row.session_name),
              otp: String(row.otp),
              expiresAt: new Date(String(row.expires_at)).getTime(),
              clientsUsed: Number(row.clients_used),
              maxClients: Number(row.max_clients),
              linkKind: companies.link_kind === 'corporate' ? 'corporate' : 'individual',
              companyName: companyName != null && String(companyName).trim() ? String(companyName) : null,
            }
          })
        )
      } else {
        setActiveOtpSessions([])
      }

      if (countRes.error) {
        console.error('[therapist_clients count]', countRes.error)
      } else if (countRes.count != null) {
        setLinkedClientCount(countRes.count)
      }
    } catch (e) {
      console.error('[therapist home fetch]', e)
    }
  }, [user?.id])

  const {
    therapistOtpSessionDialog,
    generateOtpTriggerButton,
    openExistingSessionInDialog,
    copyCode,
  } = useTherapistOtpSessionDialog({
    activeOtpSessions,
    onAfterCreate: fetchData,
  })

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`therapist_dash:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'therapist_clients',
          filter: `therapist_id=eq.${user.id}`,
        },
        () => void fetchData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'therapist_otp_sessions',
          filter: `therapist_id=eq.${user.id}`,
        },
        () => void fetchData()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, fetchData])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

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

  // Realtime can be off or filtered in the project; poll + focus refetch keeps counts fresh.
  useEffect(() => {
    if (!user?.id) return
    const intervalMs = 5000
    const id = window.setInterval(() => void fetchData(), intervalMs)
    return () => window.clearInterval(id)
  }, [user?.id, fetchData])

  useEffect(() => {
    if (!user?.id) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.id, fetchData])

  const liveSessions = activeOtpSessions.filter(s => s.expiresAt > now)

  const staggerVisible = usePageStaggerVisible(true)

  const onClaimSelfLead = async (clientId: string) => {
    setClaimingId(clientId)
    try {
      const { error } = await claimUnlinkedSelfLead(clientId)
      if (error) {
        const msg = error.message?.toLowerCase() ?? ''
        if (msg.includes('already_link') || msg.includes('unique')) {
          toast.error('Another therapist already added this client.')
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success('Client added to your list.')
      void loadPendingNotifications({ silent: true })
      navigate(`/app/therapist/clients/${clientId}`, { replace: false })
    } finally {
      setClaimingId(null)
    }
  }

  const sectionHeadingClass =
    'mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'

  return (
    <div className="space-y-8">
      <div style={pageStaggerItemStyle(0, staggerVisible)}>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Manage linked clients, follow up on assessments, and share OTP codes for supervised sessions.
        </p>
      </div>

      <div>
        <h2 className={sectionHeadingClass} style={pageStaggerItemStyle(1, staggerVisible)}>
          Linked clients
        </h2>
        <Card className={glassCard} style={pageStaggerItemStyle(2, staggerVisible)}>
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Linked clients</CardTitle>
            <CardDescription className="text-muted-foreground">Connected via your assessment codes</CardDescription>
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

      <Card className={glassCard} style={pageStaggerItemStyle(3, staggerVisible)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-foreground">Notifications</CardTitle>
          <CardDescription className="text-muted-foreground">
            Supervised work for linked clients, plus self-assessments from unlinked clients you can add as a client
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
                      <div className={cn(homeCard, 'hover:border-white/12 hover:bg-white/[0.05]')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                              {item.clientName}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              Self assessment · {formatCompletedDate(item.completedAt)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-amber-400/30 bg-amber-500/12 text-xs text-amber-100"
                          >
                            New lead
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {item.email ? (
                            <Button variant="zenOutline" size="sm" className="h-8 gap-1" asChild>
                              <a href={`mailto:${item.email}`} onClick={e => e.stopPropagation()}>
                                <Mail className="size-3.5" aria-hidden />
                                Email
                              </a>
                            </Button>
                          ) : null}
                          {item.phone ? (
                            <Button variant="zenOutline" size="sm" className="h-8 gap-1" asChild>
                              <a href={`tel:${item.phone}`} onClick={e => e.stopPropagation()}>
                                <Phone className="size-3.5" aria-hidden />
                                Call
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 gap-1"
                            disabled={claimingId === item.clientId}
                            onClick={() => void onClaimSelfLead(item.clientId)}
                          >
                            {claimingId === item.clientId ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : (
                              <UserPlus className="size-3.5" aria-hidden />
                            )}
                            Add client
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

      <Card className={glassCard} style={pageStaggerItemStyle(4, staggerVisible)}>
        <CardHeader className="space-y-4 pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl text-foreground">Active codes</CardTitle>
              <CardDescription className="text-muted-foreground">
                {liveSessions.length} active {liveSessions.length === 1 ? 'code' : 'codes'} · share with clients before
                they expire
              </CardDescription>
            </div>
            {generateOtpTriggerButton}
          </div>
        </CardHeader>
        <CardContent>
          {liveSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] py-14 text-center">
              <p className="text-muted-foreground">
                No active assessment code. Use <span className="font-medium text-foreground/90">Generate OTP</span> above
                to create one to share.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {liveSessions.map((session, sessionIndex) => {
              const left = Math.max(0, Math.ceil((session.expiresAt - now) / 1000))
              return (
                <Card
                  key={session.localId}
                  role="button"
                  tabIndex={0}
                  aria-label={`View QR and full code for ${session.name}`}
                  className={cn(
                    glassCardPremium,
                    'cursor-pointer transition-colors outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-[var(--zen-ring-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
                  )}
                  style={pageStaggerItemStyle(5 + sessionIndex, staggerVisible)}
                  onClick={() => openExistingSessionInDialog(session)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openExistingSessionInDialog(session)
                    }
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-foreground">{session.name}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      <Badge variant="outline" className="border-white/25 bg-white/5 text-foreground/90">
                        {session.clientsUsed}/{session.maxClients} joined
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-violet-600/35 to-cyan-600/20 px-4 py-6 text-center">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Code</p>
                      <p className="font-mono text-4xl font-bold tracking-[0.2em] text-foreground sm:text-5xl">
                        {session.otp}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="border-sky-400/35 bg-sky-500/12 text-sky-100 tabular-nums"
                      >
                        Expires in {formatCountdown(left)}
                      </Badge>
                      <Button
                        type="button"
                        variant="zenOutline"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation()
                          void copyCode(session.otp)
                        }}
                      >
                        <Copy className="size-4" aria-hidden />
                        Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            </div>
          )}
        </CardContent>
      </Card>

      {therapistOtpSessionDialog}
    </div>
  )
}
