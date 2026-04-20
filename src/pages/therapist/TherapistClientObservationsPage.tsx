import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { ReportGenerationWaitOverlay } from '@/components/ReportGenerationWaitOverlay'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  THERAPIST_OBSERVATION_CATEGORIES,
  isObservationSuperseded,
  normalizeObservations,
  type TherapistObservations,
} from '@/data/therapistObservationOptions'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { messageFromFunctionInvokeFailure } from '@/lib/functionInvokeError'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type AssessmentRow = {
  id: string
  status: string
  completed_at: string | null
  assessment_kind: string
  therapist_observations: unknown
  reports: { id: string; created_at: string }[] | { id: string; created_at: string } | null
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function reportForAssessment(a: AssessmentRow): { id: string; created_at: string } | null {
  const r = a.reports
  if (!r) return null
  if (Array.isArray(r)) return r[0] ?? null
  return r
}

export function TherapistClientObservationsPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const { user } = useAuth()
  const [linkOk, setLinkOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  /** Completed assessments that do not have a Zen Plan report yet. */
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [completedAssessmentTotal, setCompletedAssessmentTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [observations, setObservations] = useState<TherapistObservations>({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const topStagger = usePageStaggerVisible(Boolean(clientId))
  const contentStagger = usePageStaggerVisible(Boolean(clientId) && !loading, assessments.length)

  const load = useCallback(async () => {
    if (!clientId || !user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLinkOk(null)
    try {
      const { data: link, error: linkErr } = await supabase
        .from('therapist_clients')
        .select('id')
        .eq('therapist_id', user.id)
        .eq('client_id', clientId)
        .maybeSingle()

      if (linkErr || !link) {
        if (linkErr) console.error('[therapist_clients link]', linkErr)
        setLinkOk(false)
        setAssessments([])
        setCompletedAssessmentTotal(0)
        return
      }
      setLinkOk(true)

      const { data, error } = await supabase
        .from('assessments')
        .select(
          `
          id,
          status,
          completed_at,
          assessment_kind,
          therapist_observations,
          reports ( id, created_at )
        `
        )
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (error) {
        console.error(error)
        toast.error(error.message)
        setAssessments([])
        setCompletedAssessmentTotal(0)
        return
      }

      const rows = (data ?? []) as AssessmentRow[]
      setCompletedAssessmentTotal(rows.length)
      const pending = rows.filter(
        a => !reportForAssessment(a) && !isObservationSuperseded(a.therapist_observations)
      )
      setAssessments(pending)
      setSelectedId(prev => {
        if (prev && pending.some(r => r.id === prev)) return prev
        return pending[0]?.id ?? null
      })
    } finally {
      setLoading(false)
    }
  }, [clientId, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => assessments.find(a => a.id === selectedId) ?? null,
    [assessments, selectedId]
  )

  useEffect(() => {
    if (!selected) {
      setObservations({})
      return
    }
    setObservations(normalizeObservations(selected.therapist_observations))
  }, [selected])

  const toggleTag = (key: keyof TherapistObservations, option: string) => {
    setObservations(prev => {
      const cur = [...(prev[key] ?? [])]
      const i = cur.indexOf(option)
      if (i >= 0) cur.splice(i, 1)
      else cur.push(option)
      return { ...prev, [key]: cur }
    })
  }

  const handleSaveObservations = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('save_therapist_observations', {
        p_assessment_id: selectedId,
        p_observations: observations,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Observations saved.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedId) return
    flushSync(() => {
      setGenerating(true)
    })
    try {
      const {
        data: { session },
        error: refreshErr,
      } = await supabase.auth.refreshSession()
      const accessToken = session?.access_token
      if (refreshErr || !accessToken) {
        toast.error(
          refreshErr?.message ??
            'Your session is missing or expired. Sign out and sign in again, then try generating the report.'
        )
        return
      }

      const { data, error, response: fnResponse } = await supabase.functions.invoke('generate-zen-report', {
        body: { assessment_id: selectedId },
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (error) {
        const msg = await messageFromFunctionInvokeFailure(error, fnResponse)
        console.error('[generate-zen-report]', { status: fnResponse?.status, error })
        toast.error(msg)
        return
      }
      const body = data as { error?: string; ok?: boolean; detail?: string } | null
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        toast.error(body.detail ? `${body.error}: ${body.detail}` : body.error)
        return
      }
      toast.success('Report generated.')
      await load()
    } finally {
      setGenerating(false)
    }
  }

  if (!clientId) {
    return null
  }

  if (loading && linkOk === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p>Loading…</p>
      </div>
    )
  }

  if (linkOk === false) {
    return (
      <div className="space-y-4 text-foreground">
        <Button asChild variant="zenOutline" size="sm">
          <Link to="/app/therapist/clients">← Clients</Link>
        </Button>
        <p className="text-muted-foreground">This client isn&apos;t linked to your practice.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div style={pageStaggerItemStyle(0, topStagger)}>
        <Button asChild variant="zenOutline" size="sm">
          <Link to={`/app/therapist/clients/${clientId}`}>← Client</Link>
        </Button>
      </div>

      <div style={pageStaggerItemStyle(1, topStagger)}>
        <h1 className="text-3xl font-bold text-foreground">Observations &amp; report generation</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Tag what you observed during the assessment, save, then generate the Zen Plan report. Open{' '}
          <Link to={`/app/therapist/clients/${clientId}/reports`} className="text-sky-300 underline underline-offset-2">
            Reports
          </Link>{' '}
          to read the full output.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading assessments…
        </div>
      ) : assessments.length === 0 ? (
        <Card
          className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          style={pageStaggerItemStyle(0, contentStagger)}
        >
          <CardContent className="space-y-3 py-10 text-center text-muted-foreground">
            <p>
              {completedAssessmentTotal === 0
                ? 'No completed assessments yet for this client.'
                : 'Every completed assessment already has a Zen Plan report. Open Reports to read them.'}
            </p>
            {completedAssessmentTotal > 0 ? (
              <Button asChild variant="zenOutline" size="sm">
                <Link to={`/app/therapist/clients/${clientId}/reports`}>Open reports</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card
            className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
            style={pageStaggerItemStyle(0, contentStagger)}
          >
            <CardHeader>
              <CardTitle>Select assessment</CardTitle>
              <CardDescription className="text-muted-foreground">
                Observations and generation apply to one completed assessment at a time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground" htmlFor="observation-assessment">
                  Completed assessment
                </Label>
                <Select
                  value={selectedId ?? undefined}
                  onValueChange={setSelectedId}
                >
                  <SelectTrigger id="observation-assessment" className="max-w-md w-full">
                    <SelectValue placeholder="Choose an assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {(a.assessment_kind || 'assessment').replace(/_/g, ' ')} ·{' '}
                        {formatWhen(a.completed_at)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selected && (
            <Card
              className="zen-glass-card zen-ring-primary ring-0 shadow-none"
              style={pageStaggerItemStyle(1, contentStagger)}
            >
              <CardHeader>
                <CardTitle>Therapist observations</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Quick-select tags that align with what you noticed. These feed the AI report together with scores.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {THERAPIST_OBSERVATION_CATEGORIES.map(cat => (
                  <div key={cat.key} className="space-y-3">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {cat.options.map(opt => {
                        const on = (observations[cat.key] ?? []).includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleTag(cat.key, opt)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-sm transition-colors',
                              on
                                ? 'border-violet-400/60 bg-violet-500/25 text-foreground'
                                : 'border-white/25 bg-white/5 text-muted-foreground hover:bg-white/10'
                            )}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    type="button"
                    disabled={saving}
                    variant="zen"
                    onClick={() => void handleSaveObservations()}
                  >
                    {saving ? 'Saving…' : 'Save observations'}
                  </Button>
                  <Button
                    type="button"
                    variant="zenOutline"
                    disabled={generating}
                    onClick={() => void handleGenerate()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 size-4" aria-hidden />
                        Generate Zen Plan report
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <ReportGenerationWaitOverlay open={generating} />
    </div>
  )
}
