import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { PlanTimeline } from '@/components/PlanTimeline'
import { ReportHtml } from '@/components/ReportHtml'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parsePlanPhases } from '@/lib/parsePlanDays'
import { fetchReportPlanProgress, saveReportPlanProgress } from '@/lib/reportPlanProgress'

type PlanChecklistProps = {
  html: string
  userId: string
  reportId: string
  /** Therapist (or other) view: show client progress without editing. */
  readOnly?: boolean
  /** Fires after load and whenever the client saves progress (for parent CTAs). */
  onProgressChange?: (completed: number[]) => void
}

function rowKey(phaseIndex: number, dayIndex: number) {
  return `${phaseIndex}-${dayIndex}`
}

export function PlanChecklist({
  html,
  userId,
  reportId,
  readOnly = false,
  onProgressChange,
}: PlanChecklistProps) {
  const phases = useMemo(() => parsePlanPhases(html), [html])
  const days = useMemo(() => phases.flatMap(p => p.days), [phases])

  const dayOrder = useMemo(() => {
    const seen = new Set<number>()
    const order: number[] = []
    for (const d of days) {
      if (!seen.has(d.day)) {
        seen.add(d.day)
        order.push(d.day)
      }
    }
    return order.sort((a, b) => a - b)
  }, [days])

  const [completed, setCompleted] = useState<number[]>([])
  const [progressLoading, setProgressLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    setProgressLoading(true)
    setExpandedRows(new Set())
    void (async () => {
      try {
        const { completed: c } = await fetchReportPlanProgress(userId, reportId)
        if (!cancelled) {
          setCompleted(c)
          onProgressChange?.(c)
        }
      } catch (e) {
        if (!cancelled) {
          setCompleted([])
          toast.error(e instanceof Error ? e.message : 'Could not load plan progress')
        }
      } finally {
        if (!cancelled) setProgressLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, reportId])

  const persist = useCallback(
    async (next: number[]) => {
      try {
        await saveReportPlanProgress(userId, reportId, next)
        setCompleted(next)
        onProgressChange?.(next)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save progress')
      }
    },
    [onProgressChange, reportId, userId]
  )

  const activeDay = useMemo(
    () => dayOrder.find(d => !completed.includes(d)) ?? null,
    [completed, dayOrder]
  )

  const toggleExpanded = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const markComplete = (day: number) => {
    if (day !== activeDay || completed.includes(day)) return
    void persist([...completed, day].sort((a, b) => a - b))
  }

  if (days.length === 0) {
    return <PlanTimeline html={html} />
  }

  if (progressLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-emerald-300" aria-hidden />
        <p>Loading plan progress…</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {phases.map((phase, phaseIndex) => (
        <section key={`${phase.title}-${phaseIndex}`} className="space-y-4">
          {phase.title ? (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{phase.title}</h2>
          ) : null}
          {phase.days.length === 0 ? null : (
            <div className="relative">
              <div
                className="absolute top-3 bottom-3 w-0.5 -translate-x-1/2 rounded-full bg-emerald-500/40 left-2.5 md:left-3"
                aria-hidden
              />
              <div className="space-y-2">
                {phase.days.map((block, dayIndex) => {
                  const key = rowKey(phaseIndex, dayIndex)
                  const isDone = completed.includes(block.day)
                  const isActive = activeDay === block.day
                  const isOpen = expandedRows.has(key)
                  const canMark = !readOnly && isActive && !isDone
                  const onPath = activeDay === null || block.day <= activeDay
                  const isFutureNode = !onPath

                  return (
                    <div key={key} className="flex gap-2 md:gap-3">
                      <div className="relative z-[1] flex w-5 shrink-0 items-center justify-center md:w-6">
                        <div
                          className={cn(
                            'size-3 shrink-0 rounded-full',
                            isFutureNode &&
                              'border-2 border-emerald-400/65 bg-transparent shadow-none',
                            !isFutureNode &&
                              'border-0 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]',
                            !isFutureNode && isDone && 'bg-emerald-600/80',
                            !isFutureNode && !isDone && isActive && 'bg-emerald-300',
                            !isFutureNode && !isDone && !isActive && 'bg-emerald-400'
                          )}
                          aria-hidden
                        />
                      </div>
                      <div
                        className={cn(
                          'min-w-0 flex-1 overflow-hidden rounded-xl border transition-colors',
                          isDone && 'border-white/10 bg-white/[0.03] opacity-70',
                          !isDone &&
                            isActive &&
                            'border-emerald-400/45 bg-emerald-500/[0.08] ring-1 ring-emerald-400/35',
                          !isDone && !isActive && 'border-white/15 bg-white/[0.04]'
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full flex-col px-3 py-3 text-left text-foreground md:flex-row md:items-start md:gap-3 md:px-4"
                          onClick={() => toggleExpanded(key)}
                          aria-expanded={isOpen}
                        >
                          <div className="flex w-full min-w-0 items-start gap-3">
                            <span
                              className={cn(
                                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                                isDone ? 'bg-emerald-600/50 text-foreground' : 'bg-white/10 text-foreground/90'
                              )}
                            >
                              {isDone ? <Check className="size-4" aria-hidden /> : block.day}
                            </span>
                            <span className="min-w-0 flex-1 pr-1 md:pr-0">
                              <span className="block text-sm font-medium text-foreground/95">
                                Week {block.day}
                              </span>
                              <span className="mt-0.5 block text-sm text-muted-foreground">
                                <span className="text-muted-foreground">Activities: </span>
                                {block.title}
                              </span>
                            </span>
                            <ChevronDown
                              className={cn(
                                'mt-1 hidden size-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none md:block',
                                isOpen && 'rotate-180'
                              )}
                              aria-hidden
                            />
                          </div>
                          <div className="flex justify-center pt-2 md:hidden" aria-hidden>
                            <ChevronDown
                              className={cn(
                                'size-5 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none',
                                isOpen && 'rotate-180'
                              )}
                            />
                          </div>
                        </button>
                        <div
                          className={cn(
                            'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          )}
                          aria-hidden={!isOpen}
                          inert={!isOpen || undefined}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="border-t border-white/10 px-3 pb-4 pt-2 md:px-4">
                              {block.innerHtml.trim() ? (
                                <ReportHtml content={block.innerHtml} className="text-sm" />
                              ) : null}
                              {canMark ? (
                                <Button
                                  type="button"
                                  variant="zenOutline"
                                  size="sm"
                                  className="mt-4 border-emerald-400/50 text-emerald-100 hover:bg-emerald-500/15"
                                  onClick={e => {
                                    e.stopPropagation()
                                    markComplete(block.day)
                                  }}
                                >
                                  Mark as complete
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
