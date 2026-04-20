import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Mail, Phone, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { supabase } from '@/lib/supabase'

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

export function ClientTherapistsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [therapists, setTherapists] = useState<TherapistInfo[]>([])
  const headerStagger = usePageStaggerVisible(true)
  const bodyStagger = usePageStaggerVisible(!loading, `${therapists.length}`)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data: links, error } = await supabase
        .from('therapist_clients')
        .select('therapist_id, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        toast.error(error.message)
        setTherapists([])
        return
      }

      const list = (links ?? []) as LinkRow[]
      const ids = [...new Set(list.map(l => l.therapist_id))]
      if (ids.length === 0) {
        setTherapists([])
        return
      }

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, name, email, gender, phone_number')
        .in('id', ids)

      if (pErr) {
        console.error(pErr)
        setTherapists([])
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
      setTherapists(result)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-start justify-between gap-4"
        style={pageStaggerItemStyle(0, headerStagger)}
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Therapists</h1>
          <p className="mt-2 text-muted-foreground">
            People you&apos;ve linked with your assessment code.
          </p>
        </div>
        <Button asChild variant="zen" className="shrink-0">
          <Link to="/app/client/otp" className="gap-2">
            <UserPlus className="size-4" aria-hidden />
            Add therapist
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground" style={pageStaggerItemStyle(0, bodyStagger)}>Loading…</p>
      ) : therapists.length === 0 ? (
        <Card
          className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          style={pageStaggerItemStyle(0, bodyStagger)}
        >
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-full bg-white/5 p-5 ring-1 ring-white/10">
              <Users className="size-8 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-muted-foreground">
              You haven&apos;t linked a therapist yet. Use{' '}
              <Link to="/app/client/otp" className="text-sky-300 underline underline-offset-2">
                Add therapist
              </Link>{' '}
              to enter their code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {therapists.map((t, i) => (
            <Card
              key={t.id}
              className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
              style={pageStaggerItemStyle(i, bodyStagger)}
            >
              <CardContent className="space-y-3 pt-6">
                <p className="text-lg font-semibold text-foreground">{t.name}</p>
                {t.gender && (
                  <p className="text-sm text-muted-foreground">{formatGender(t.gender)}</p>
                )}
                {t.phone && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5 text-sky-300/70" aria-hidden />
                    {t.phone}
                  </p>
                )}
                {t.email && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-3.5 text-sky-300/70" aria-hidden />
                    {t.email}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
