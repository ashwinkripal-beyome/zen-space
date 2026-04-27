import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CLIENT_OBSERVATION_QUESTIONS,
  emptyClientObservations,
  normalizeClientObservations,
  type ClientObservations,
} from '@/data/clientObservationOptions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Props {
  assessmentId: string
  onComplete: () => void
  submitting: boolean
}

export function ClientObservationsForm({ assessmentId, onComplete, submitting }: Props) {
  const [obs, setObs] = useState<ClientObservations>(emptyClientObservations)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function run() {
      const { data, error } = await supabase
        .from('assessments')
        .select('client_observations')
        .eq('id', assessmentId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error('[ClientObservationsForm load]', error)
        toast.error(error.message)
        setObs(emptyClientObservations())
      } else {
        setObs(normalizeClientObservations(data?.client_observations))
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [assessmentId])

  const toggleChip = (questionKey: string, chip: string, singleSelect?: boolean) => {
    setObs(prev => {
      const entry = prev[questionKey] ?? { selected: [], freeText: '' }
      const has = entry.selected.includes(chip)
      if (singleSelect) {
        return {
          ...prev,
          [questionKey]: {
            ...entry,
            selected: has ? [] : [chip],
          },
        }
      }
      return {
        ...prev,
        [questionKey]: {
          ...entry,
          selected: has
            ? entry.selected.filter(c => c !== chip)
            : [...entry.selected, chip],
        },
      }
    })
  }

  const setFreeText = (questionKey: string, text: string) => {
    setObs(prev => ({
      ...prev,
      [questionKey]: {
        ...(prev[questionKey] ?? { selected: [], freeText: '' }),
        freeText: text,
      },
    }))
  }

  const handleSaveAndContinue = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('save_client_observations', {
        p_assessment_id: assessmentId,
        p_observations: obs as unknown as Record<string, unknown>,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || submitting || loading

  if (loading) {
    return (
      <div
        className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-3 py-16"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-sky-300" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading your observations…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Your Observations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Help us understand you better. Select what applies and add your own thoughts.
        </p>
      </div>

      {CLIENT_OBSERVATION_QUESTIONS.map(q => {
        const entry = obs[q.key] ?? { selected: [], freeText: '' }
        return (
          <Card
            key={q.key}
            className="zen-glass-card zen-ring-secondary ring-0 shadow-none"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground/90 sm:text-lg">
                {q.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(q.type === 'chips_and_text' || q.type === 'chips_only') && q.options && (
                <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                  {q.options.map(chip => {
                    const active = entry.selected.includes(chip)
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleChip(q.key, chip, q.singleSelect)}
                        className={cn(
                          'flex w-full items-center justify-start text-left text-xs font-medium transition-colors sm:text-sm md:w-auto md:justify-center md:text-center',
                          'rounded-xl border px-3 py-2 md:rounded-full md:py-1.5',
                          active
                            ? 'border-violet-400/60 bg-violet-500/30 text-foreground'
                            : 'border-white/20 bg-white/5 text-muted-foreground hover:border-white/30 hover:bg-white/10'
                        )}
                      >
                        {chip}
                      </button>
                    )
                  })}
                </div>
              )}
              {q.type !== 'chips_only' && (
                <textarea
                  value={entry.freeText}
                  onChange={e => setFreeText(q.key, e.target.value)}
                  placeholder={q.placeholder}
                  rows={q.type === 'text_only' ? 4 : 2}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
                />
              )}
            </CardContent>
          </Card>
        )
      })}

      <div className="flex justify-center pb-8 pt-2">
        <Button
          type="button"
          variant="zen"
          size="lg"
          disabled={busy}
          onClick={() => void handleSaveAndContinue()}
          className="min-w-[200px]"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            'Save & Continue to Submit'
          )}
        </Button>
      </div>
    </div>
  )
}
