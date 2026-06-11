import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportGenerationWaitOverlay } from '@/components/ReportGenerationWaitOverlay'
import { supabase } from '@/lib/supabase'
import { ZEN_ACTIVITIES, ZEN_ZONES, type ZenActivity } from '@/data/zenGardenActivities'
import { cn } from '@/lib/utils'

type WeekSelection = {
  week: number
  activity_name: string
  zone: string
  corner: string
}

type OneOnOneActivitySelectorProps = {
  clientId: string
  /** Report ID for the latest self-assessment report; plan will be attached to this report's assessment. */
  reportId: string
  /** Latest completed self-assessment ID. */
  assessmentId: string
  /** Whether the plan has already been generated (used to show re-generate option). */
  hasPlan: boolean
  onPlanGenerated?: () => void
}

const PHASE_ZONES: Record<number, string> = {
  1: 'BALANCE', 2: 'BALANCE', 3: 'BALANCE', 4: 'BALANCE', 5: 'BALANCE', 6: 'BALANCE',
  7: 'BLOSSOM', 8: 'BLOSSOM', 9: 'BLOSSOM', 10: 'BLOSSOM', 11: 'BLOSSOM', 12: 'BLOSSOM',
  13: 'BLISS', 14: 'BLISS', 15: 'BLISS', 16: 'BLISS', 17: 'BLISS', 18: 'BLISS',
}

const PHASE_LABEL: Record<string, string> = {
  BALANCE: 'Phase 1 — Balance (Weeks 1–6)',
  BLOSSOM: 'Phase 2 — Blossom (Weeks 7–12)',
  BLISS: 'Phase 3 — Bliss (Weeks 13–18)',
}

export function OneOnOneActivitySelector({
  clientId,
  reportId,
  assessmentId,
  hasPlan,
  onPlanGenerated,
}: OneOnOneActivitySelectorProps) {
  const [selections, setSelections] = useState<Map<number, WeekSelection>>(new Map())
  const [saving, setSaving] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load existing selections from DB.
  const loadSelections = useCallback(async () => {
    const { data, error } = await supabase
      .from('one_on_one_activity_selections')
      .select('week_number, activity_name, zone, corner')
      .eq('report_id', reportId)
      .order('week_number', { ascending: true })

    if (error) {
      console.error('[one_on_one_activity_selections]', error)
      return
    }

    const map = new Map<number, WeekSelection>()
    for (const row of data ?? []) {
      const wn = row.week_number as number
      map.set(wn, {
        week: wn,
        activity_name: row.activity_name as string,
        zone: row.zone as string,
        corner: row.corner as string,
      })
    }
    setSelections(map)
    setLoaded(true)
  }, [reportId])

  useEffect(() => {
    void loadSelections()
  }, [loadSelections])

  const handleSelect = async (week: number, activityName: string) => {
    const activity = ZEN_ACTIVITIES.find(a => a.activity === activityName)
    if (!activity) return

    const selection: WeekSelection = {
      week,
      activity_name: activity.activity,
      zone: activity.zone,
      corner: activity.corner,
    }

    setSelections(prev => new Map(prev).set(week, selection))
    setSaving(week)

    const { error } = await supabase.rpc('upsert_activity_selection', {
      p_client_id: clientId,
      p_report_id: reportId,
      p_week_number: week,
      p_activity_name: activity.activity,
      p_zone: activity.zone,
      p_corner: activity.corner,
    })

    setSaving(null)
    if (error) {
      toast.error(`Week ${week}: ${error.message}`)
      // Revert optimistic update.
      void loadSelections()
    }
  }

  const allSelected = selections.size === 18

  const handleGenerate = async () => {
    if (!allSelected) {
      toast.error('Please select an activity for all 18 weeks before generating.')
      return
    }

    // Build the selections record for the edge function.
    const selectedActivities: Record<string, { activity_name: string; zone: string; corner: string }> = {}
    for (const [week, sel] of selections) {
      selectedActivities[String(week)] = {
        activity_name: sel.activity_name,
        zone: sel.zone,
        corner: sel.corner,
      }
    }

    flushSync(() => setGenerating(true))

    const { data, error } = await supabase.functions.invoke('generate-zen-plan', {
      body: {
        assessment_id: assessmentId,
        force: hasPlan,
        selected_activities: selectedActivities,
      },
    })

    setGenerating(false)

    if (error || (data && typeof data === 'object' && 'error' in data)) {
      const msg = (error as { message?: string })?.message ??
        String((data as Record<string, unknown>)?.error ?? 'Plan generation failed')
      toast.error(msg)
      return
    }

    toast.success('1-on-1 plan generated successfully!')
    onPlanGenerated?.()
  }

  const activitiesByZone = ZEN_ZONES.reduce<Record<string, ZenActivity[]>>(
    (acc, zone) => {
      acc[zone] = ZEN_ACTIVITIES.filter(a => a.zone === zone)
      return acc
    },
    {}
  )

  let lastPhase = ''

  return (
    <div className="relative space-y-4">
      <ReportGenerationWaitOverlay open={generating} variant="plan" />

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Select one activity for each of the 18 weeks. Activities follow the standard phase structure: Balance (1–6), Blossom (7–12), Bliss (13–18). Once all 18 weeks are selected, generate the personalised plan.
        </p>
      </div>

      {!loaded ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading selections…
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(week => {
            const expectedZone = PHASE_ZONES[week] ?? 'BALANCE'
            const showPhaseHeader = expectedZone !== lastPhase
            if (showPhaseHeader) lastPhase = expectedZone

            const sel = selections.get(week)
            const isSaving = saving === week
            const zoneActivities = activitiesByZone[expectedZone] ?? []

            // Group by corner for optgroup-style display.
            const corners = [...new Set(zoneActivities.map(a => a.corner))]

            return (
              <div key={week}>
                {showPhaseHeader && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {PHASE_LABEL[expectedZone]}
                    </p>
                  </div>
                )}
                <div
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between',
                    sel
                      ? 'border-emerald-400/20 bg-emerald-500/5'
                      : 'border-white/10 bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        sel
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/10 text-muted-foreground'
                      )}
                    >
                      {sel ? <Check className="size-3.5" aria-hidden /> : week}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Week {week}</p>
                      {sel && (
                        <p className="text-xs text-muted-foreground">{sel.corner}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    {isSaving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
                    <Select
                      value={sel?.activity_name ?? ''}
                      onValueChange={val => void handleSelect(week, val)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="w-full sm:w-64 text-sm">
                        <SelectValue placeholder="Select activity…" />
                      </SelectTrigger>
                      <SelectContent>
                        {corners.map(corner => (
                          <SelectGroup key={corner}>
                            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {corner}
                            </div>
                            {zoneActivities
                              .filter(a => a.corner === corner)
                              .map(a => (
                                <SelectItem key={a.activity} value={a.activity}>
                                  {a.activity}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            {allSelected ? (
              <span className="text-emerald-300">All 18 weeks selected — ready to generate.</span>
            ) : (
              `${selections.size}/18 weeks selected`
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="zen"
          disabled={!allSelected || generating}
          onClick={() => void handleGenerate()}
          className="gap-1.5"
        >
          {generating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {generating ? 'Generating…' : hasPlan ? 'Regenerate plan' : 'Generate 1-on-1 plan'}
        </Button>
      </div>
    </div>
  )
}
