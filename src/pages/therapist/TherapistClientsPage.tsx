import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, Users } from 'lucide-react'
import { useTherapistOtpSessionDialog } from '@/components/therapist/TherapistOtpSessionDialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { formatAgeDisplay, formatClientDisplayName, formatGenderLabel } from '@/lib/clientDisplayName'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const glassCard = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')

/** PostgREST / JS may vary UUID string casing; Map lookups must be stable. */
function profileMapKey(id: string): string {
  return id.trim().toLowerCase()
}

type LinkedClientDisplay = {
  linkId: string
  clientId: string
  email: string
  displayName: string
  linkedAt: string
  role: string
  gender: string | null
  age: number | null
}

type ClientProfileFields = {
  id: string
  email: string
  name: string | null
  first_name: string | null
  last_name: string | null
  role: string
  gender: string | null
  age: number | null
}

export function TherapistClientsPage() {
  const { user } = useAuth()
  const [linkedClients, setLinkedClients] = useState<LinkedClientDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const { therapistOtpSessionDialog, generateOtpTriggerButton } = useTherapistOtpSessionDialog({
    activeOtpSessions: [],
  })

  const load = useCallback(async (silent = false) => {
    if (!user?.id) return
    if (!silent) setLoading(true)
    try {
      const { data: links, error } = await supabase
        .from('therapist_clients')
        .select('id, client_id, created_at')
        .eq('therapist_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[therapist_clients]', error)
        setLinkedClients([])
        return
      }

      const linkRows = links ?? []
      if (linkRows.length === 0) {
        setLinkedClients([])
        return
      }

      const clientIds = [...new Set(linkRows.map(r => r.client_id as string))]
      const { data: profs, error: profsError } = await supabase
        .from('profiles')
        .select('id, email, name, first_name, last_name, role, gender, age')
        .in('id', clientIds)

      if (profsError) {
        console.error('[profiles]', profsError)
      }

      const byId = new Map(
        (profs ?? []).map(p => {
          const row = p as ClientProfileFields
          return [profileMapKey(String(row.id)), row]
        })
      )
      setLinkedClients(
        linkRows.map(row => {
          const p = byId.get(profileMapKey(String(row.client_id)))
          return {
            linkId: String(row.id),
            clientId: String(row.client_id),
            email: p?.email?.trim() || '—',
            displayName: formatClientDisplayName(p),
            linkedAt: String(row.created_at),
            role: p?.role ?? 'client',
            gender: p?.gender ?? null,
            age: p?.age != null && Number.isFinite(Number(p.age)) ? Number(p.age) : null,
          }
        })
      )
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`therapist_clients_list:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'therapist_clients', filter: `therapist_id=eq.${user.id}` },
        () => void load(true)
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, load])

  useEffect(() => {
    if (!user?.id) return
    const id = window.setInterval(() => void load(true), 5000)
    return () => window.clearInterval(id)
  }, [user?.id, load])

  useEffect(() => {
    if (!user?.id) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user?.id, load])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return linkedClients
    return linkedClients.filter(
      c =>
        c.displayName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        formatGenderLabel(c.gender).toLowerCase().includes(q)
    )
  }, [linkedClients, search])

  const headerStagger = usePageStaggerVisible(true)
  const bodyStagger = usePageStaggerVisible(!loading, `${linkedClients.length}`)

  return (
    <div className="space-y-6">
      <div style={pageStaggerItemStyle(0, headerStagger)}>
        <h1 className="text-4xl font-bold text-foreground">Clients</h1>
        <p className="mt-2 text-lg text-muted-foreground">People linked after using your assessment code.</p>
      </div>

      <Card className={glassCard} style={pageStaggerItemStyle(1, headerStagger)}>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl text-foreground">My clients</CardTitle>
            <CardDescription className="text-muted-foreground">Open a client to view report and plan.</CardDescription>
          </div>
          <div className="w-full shrink-0 sm:w-auto">{generateOtpTriggerButton}</div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : linkedClients.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-4 py-14 text-center"
              style={pageStaggerItemStyle(0, bodyStagger)}
            >
              <div className="rounded-full bg-white/5 p-6 ring-1 ring-white/10">
                <Users className="size-10 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-muted-foreground">No clients yet. Share an assessment OTP from the dashboard.</p>
            </div>
          ) : (
            <>
              <div className="relative" style={pageStaggerItemStyle(0, bodyStagger)}>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, or gender…"
                  className="border-white/25 bg-white/10 py-5 pl-10 text-foreground placeholder:text-muted-foreground"
                  aria-label="Search clients"
                />
              </div>
              {filteredClients.length === 0 ? (
                <p
                  className="py-6 text-center text-sm text-muted-foreground"
                  style={pageStaggerItemStyle(1, bodyStagger)}
                >
                  No clients match your search.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {filteredClients.map((c, i) => {
                    const showEmailLine = c.email !== '—' && c.displayName !== c.email
                    return (
                      <li key={c.linkId} style={pageStaggerItemStyle(i + 1, bodyStagger)}>
                        <Link
                          to={`/app/therapist/clients/${c.clientId}`}
                          className={cn(
                            'group flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-5 shadow-sm',
                            'ring-1 ring-white/5 transition-all',
                            'hover:border-white/20 hover:bg-white/[0.08] hover:ring-white/15',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(167_139_250/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                                {c.displayName}
                              </p>
                              {showEmailLine ? (
                                <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.email}</p>
                              ) : null}
                            </div>
                            <ChevronRight
                              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                              aria-hidden
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10">
                              <span className="text-muted-foreground">Gender</span>{' '}
                              <span className="font-medium text-foreground/90">{formatGenderLabel(c.gender)}</span>
                            </span>
                            <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/10">
                              <span className="text-muted-foreground">Age</span>{' '}
                              <span className="font-medium text-foreground/90">{formatAgeDisplay(c.age)}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                            <p className="text-xs text-muted-foreground">
                              Linked{' '}
                              {new Date(c.linkedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </p>
                            <Badge
                              variant="outline"
                              className="border-white/25 bg-white/5 capitalize text-foreground/90"
                            >
                              {c.role}
                            </Badge>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {therapistOtpSessionDialog}
    </div>
  )
}
