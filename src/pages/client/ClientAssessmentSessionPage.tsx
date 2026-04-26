import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ClientObservationsForm } from '@/components/ClientObservationsForm'
import { ReportGenerationWaitOverlay } from '@/components/ReportGenerationWaitOverlay'
import {
  BENCHMARK_QUESTIONS,
  BENCHMARK_TOTAL_QUESTIONS,
  benchmarkPointsForTotals,
  computeBenchmarkScores,
  type BenchmarkQuestion,
} from '@/data/benchmarkAssessment'
import { useAuth } from '@/hooks/useAuth'
import { parseBenchmarkAnswerValue } from '@/lib/benchmarkScoreUtils'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { messageFromFunctionInvokeFailure } from '@/lib/functionInvokeError'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'

const SWIPE_THRESHOLD = 72
const SAVE_DEBOUNCE_MS = 400

type LocalAnswer = {
  value: number
  swipe_direction: string
  skipped: boolean
}

type AssessmentMode = 'supervised' | 'self'

/** Compact row of four answers at card bottom */
const ANSWER_ROW_BTN =
  'h-auto min-h-8 flex-1 basis-0 flex-col gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-tight sm:min-h-9 sm:gap-0.5 sm:px-1.5 sm:text-[11px] md:text-xs'

/** End-of-drag position for exit animation (matches drag tilt). */
function exitFlyFromVars(fromDrag?: { x: number; y: number }): CSSProperties {
  const x = fromDrag?.x ?? 0
  const y = fromDrag?.y ?? 0
  return {
    '--assess-from-tx': `${x}px`,
    '--assess-from-ty': `${y}px`,
    '--assess-from-r': `${x * 0.025}deg`,
  } as CSSProperties
}

function exitFlyVars(
  direction: string,
  skipped: boolean,
  fromDrag?: { x: number; y: number }
): CSSProperties {
  const from = exitFlyFromVars(fromDrag)
  if (skipped) {
    return {
      ...from,
      '--assess-tx': '0px',
      '--assess-ty': '36px',
      '--assess-r': '0deg',
      '--assess-op': '0',
    } as CSSProperties
  }
  switch (direction) {
    case 'up':
      return {
        ...from,
        '--assess-tx': '0px',
        '--assess-ty': '-130%',
        '--assess-r': '-9deg',
        '--assess-op': '0',
      } as CSSProperties
    case 'down':
      return {
        ...from,
        '--assess-tx': '0px',
        '--assess-ty': '130%',
        '--assess-r': '9deg',
        '--assess-op': '0',
      } as CSSProperties
    case 'left':
      return {
        ...from,
        '--assess-tx': '-125%',
        '--assess-ty': '0px',
        '--assess-r': '-11deg',
        '--assess-op': '0',
      } as CSSProperties
    case 'right':
      return {
        ...from,
        '--assess-tx': '125%',
        '--assess-ty': '0px',
        '--assess-r': '11deg',
        '--assess-op': '0',
      } as CSSProperties
    default:
      return {
        ...from,
        '--assess-tx': '0px',
        '--assess-ty': '48px',
        '--assess-r': '0deg',
        '--assess-op': '0',
      } as CSSProperties
  }
}

function SwipeCard({
  question,
  onCommit,
  disabled,
  currentAnswer,
}: {
  question: BenchmarkQuestion
  onCommit: (value: number, direction: string, skipped: boolean) => void
  disabled: boolean
  currentAnswer?: LocalAnswer
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const pendingExit = useRef<{ value: number; direction: string; skipped: boolean } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [exitAnim, setExitAnim] = useState(false)
  const [exitStyle, setExitStyle] = useState<CSSProperties>({})
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const fn = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const reset = useCallback(() => {
    setOffset({ x: 0, y: 0 })
    start.current = null
    setDragging(false)
  }, [])

  useEffect(() => {
    reset()
    setExitAnim(false)
    setExitStyle({})
    pendingExit.current = null
  }, [question.id, reset])

  const beginCommit = useCallback(
    (value: number, direction: string, skipped: boolean, fromDrag?: { x: number; y: number }) => {
      if (disabled) return
      if (reduceMotion) {
        setDragging(false)
        onCommit(value, direction, skipped)
        return
      }
      if (exitAnim) return
      pendingExit.current = { value, direction, skipped }
      setDragging(false)
      setOffset({ x: 0, y: 0 })
      start.current = null
      setExitStyle(exitFlyVars(direction, skipped, fromDrag))
      setExitAnim(true)
    },
    [disabled, exitAnim, onCommit, reduceMotion]
  )

  const commitDirection = useCallback(
    (dx: number, dy: number) => {
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (Math.max(ax, ay) < SWIPE_THRESHOLD) {
        reset()
        return
      }
      const at = { x: dx, y: dy }
      if (ay >= ax) {
        if (dy < 0) beginCommit(3, 'up', false, at)
        else beginCommit(0, 'down', false, at)
      } else {
        if (dx < 0) beginCommit(1, 'left', false, at)
        else beginCommit(2, 'right', false, at)
      }
    },
    [beginCommit, reset]
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || exitAnim) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || disabled || exitAnim) return
    setOffset({
      x: e.clientX - start.current.x,
      y: e.clientY - start.current.y,
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      if (!start.current || disabled || exitAnim) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      commitDirection(dx, dy)
    } finally {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      setDragging(false)
    }
  }

  const handleExitEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (!exitAnim) return
    const names = e.animationName.split(',').map(s => s.trim())
    if (!names.includes('assessment-exit-fly')) return
    const p = pendingExit.current
    pendingExit.current = null
    if (p) onCommit(p.value, p.direction, p.skipped)
  }

  const dragTransform =
    !exitAnim && dragging
      ? `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.x * 0.025}deg)`
      : undefined

  return (
    <div className="mx-auto w-full max-w-lg touch-none select-none">
      <div
        className={cn(
          'relative max-md:z-10',
          dragging && 'z-20'
        )}
      >
        <div
          role="application"
          aria-label="Swipe to answer"
          className={cn(
            'relative cursor-grab active:cursor-grabbing touch-none',
            exitAnim && 'pointer-events-none'
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={reset}
          onLostPointerCapture={reset}
        >
          <div
            className={cn(
              'assessment-cardbg1 rounded-3xl border border-white/20 p-4 shadow-xl ring-1 ring-white/10 sm:p-4',
              question.section === 'Blossom' && 'assessment-cardbg2',
              question.section === 'Bliss' && 'assessment-cardbg3',
              !exitAnim && 'will-change-transform',
              !exitAnim && !dragging && 'assessment-card-entry',
              exitAnim && 'assessment-card-exit-fly'
            )}
            style={{
              ...exitStyle,
              ...(dragTransform ? { transform: dragTransform } : {}),
            }}
            onAnimationEnd={handleExitEnd}
          >
            <div className="flex min-h-[17rem] flex-col items-center justify-center gap-3 px-1 pt-2 text-center sm:min-h-[19rem] sm:px-3 sm:pt-4">
              <p className="text-balance text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl md:text-3xl">
                {question.text}
              </p>
              <div className="text-xs leading-snug text-muted-foreground sm:text-sm">
                <p className="text-center">
                  <span className="text-muted-foreground">{question.section}</span>
                  {question.category ? (
                    <span className="text-muted-foreground"> · {question.category}</span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative mt-3 flex w-full shrink-0 flex-wrap justify-center gap-1 max-md:z-0 sm:flex-nowrap sm:gap-1.5"
        onPointerDown={e => e.stopPropagation()}
      >
        <Button
          type="button"
          size="sm"
          variant="zenOutline"
          className={cn(ANSWER_ROW_BTN, currentAnswer?.value === 0 && 'zen-btn-outline-glass-active')}
          disabled={disabled || exitAnim}
          onClick={e => {
            e.stopPropagation()
            beginCommit(0, 'down', false)
          }}
        >
          <ArrowDown className="size-3 shrink-0 opacity-90 sm:size-3.5" aria-hidden />
          Not True
        </Button>
        <Button
          type="button"
          size="sm"
          variant="zenOutline"
          className={cn(ANSWER_ROW_BTN, currentAnswer?.value === 1 && 'zen-btn-outline-glass-active')}
          disabled={disabled || exitAnim}
          onClick={e => {
            e.stopPropagation()
            beginCommit(1, 'left', false)
          }}
        >
          <ArrowLeft className="size-3 shrink-0 opacity-90 sm:size-3.5" aria-hidden />
          A Little True
        </Button>
        <Button
          type="button"
          size="sm"
          variant="zenOutline"
          className={cn(ANSWER_ROW_BTN, currentAnswer?.value === 2 && 'zen-btn-outline-glass-active')}
          disabled={disabled || exitAnim}
          onClick={e => {
            e.stopPropagation()
            beginCommit(2, 'right', false)
          }}
        >
          <ArrowRight className="size-3 shrink-0 opacity-90 sm:size-3.5" aria-hidden />
          Mostly True
        </Button>
        <Button
          type="button"
          size="sm"
          variant="zenOutline"
          className={cn(ANSWER_ROW_BTN, currentAnswer?.value === 3 && 'zen-btn-outline-glass-active')}
          disabled={disabled || exitAnim}
          onClick={e => {
            e.stopPropagation()
            beginCommit(3, 'up', false)
          }}
        >
          <ArrowUp className="size-3 shrink-0 opacity-90 sm:size-3.5" aria-hidden />
          Completely True
        </Button>
      </div>

      <p className="mt-3 text-center text-[10px] text-muted-foreground sm:text-xs sm:text-muted-foreground">
        Swipe up / right / left / down, or tap a button.
      </p>
    </div>
  )
}

type SessionPhase = 'cards' | 'observations' | 'submit'

function deriveMode(pathname: string): AssessmentMode {
  if (pathname.includes('/self/')) return 'self'
  return 'supervised'
}

export function ClientAssessmentSessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const mode = deriveMode(location.pathname)
  const isSelf = mode === 'self'

  const [booting, setBooting] = useState(true)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase] = useState<SessionPhase>('cards')
  const [generating, setGenerating] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  /** 0 = intro copy, 1 = how to answer (both must be seen before starting). */
  const [disclaimerStep, setDisclaimerStep] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const modeTitle = isSelf ? 'Self Assessment' : 'Supervised Assessment'
  const reviewPath = `/app/client/assessment/${mode}/review`

  const sessionReady = !booting && Boolean(user?.id)
  const staggerVisible = usePageStaggerVisible(sessionReady, `${phase}-${assessmentId ?? ''}`)

  const flushSave = useCallback(
    async (
      aid: string,
      q: BenchmarkQuestion,
      value: number,
      swipeDirection: string,
      skipped: boolean
    ) => {
      setSaving(true)
      try {
        const { error } = await supabase.from('assessment_answers').upsert(
          {
            assessment_id: aid,
            question_id: q.id,
            question_text: q.text,
            answer_value: String(value),
            swipe_direction: swipeDirection,
            skipped,
          },
          { onConflict: 'assessment_id,question_id' }
        )
        if (error) {
          console.error('[assessment_answers upsert]', error)
          toast.error(error.message)
        }
      } finally {
        setSaving(false)
      }
    },
    []
  )

  const scheduleSave = useCallback(
    (aid: string, q: BenchmarkQuestion, value: number, swipeDirection: string, skipped: boolean) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void flushSave(aid, q, value, swipeDirection, skipped)
        saveTimer.current = null
      }, SAVE_DEBOUNCE_MS)
    },
    [flushSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (showDisclaimer) setDisclaimerStep(0)
  }, [showDisclaimer])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!user?.id) {
        setBooting(false)
        return
      }
      setBooting(true)
      try {
        if (isSelf) {
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('is_paid_customer')
            .eq('id', user.id)
            .maybeSingle()
          if (profErr) {
            console.error('[profiles self gate]', profErr)
          } else if ((prof as { is_paid_customer?: boolean } | null)?.is_paid_customer) {
            if (!cancelled) {
              toast.error(
                'Self assessment is not available after your therapist has marked you as a paid customer. Use the supervised assessment.'
              )
              navigate('/app/client/assessment', { replace: true })
            }
            return
          }
        }

        let therapistId: string | null = null
        if (!isSelf) {
          const [{ data: paidProf, error: paidErr }, { data: link, error: supLinkErr }] = await Promise.all([
            supabase.from('profiles').select('is_paid_customer').eq('id', user.id).maybeSingle(),
            supabase
              .from('therapist_clients')
              .select('therapist_id')
              .eq('client_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])
          if (paidErr) console.error('[profiles supervised gate]', paidErr)
          if (supLinkErr) console.error('[therapist_clients supervised gate]', supLinkErr)
          if (!(paidProf as { is_paid_customer?: boolean } | null)?.is_paid_customer) {
            if (!cancelled) {
              toast.error(
                'Supervised assessment is only available when your therapist has marked you as a paid customer. You can use the self assessment until then.'
              )
              navigate('/app/client/assessment', { replace: true })
            }
            return
          }
          therapistId = link?.therapist_id ?? null
        }

        const { data: draft } = await supabase
          .from('assessments')
          .select('id')
          .eq('client_id', user.id)
          .eq('assessment_kind', 'benchmark')
          .eq('assessment_mode', mode)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let id = draft?.id ?? null
        if (!id) {
          const { data: ins, error: insErr } = await supabase
            .from('assessments')
            .insert({
              client_id: user.id,
              therapist_id: therapistId,
              assessment_kind: 'benchmark',
              assessment_mode: mode,
              status: 'draft',
              started_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          if (insErr) {
            console.error('[assessments insert]', insErr)
            toast.error(insErr.message)
            return
          }
          id = ins.id
        }

        if (!id || cancelled) return

        const { data: rows } = await supabase
          .from('assessment_answers')
          .select('question_id, answer_value, swipe_direction, skipped')
          .eq('assessment_id', id)

        const map: Record<string, LocalAnswer> = {}
        for (const row of rows ?? []) {
          const qid = row.question_id as string
          const v = parseBenchmarkAnswerValue(row.answer_value as string)
          if (v === null) continue
          map[qid] = {
            value: benchmarkPointsForTotals(v),
            swipe_direction: (row.swipe_direction as string) ?? '',
            skipped: false,
          }
        }

        const answeredCount = Object.keys(map).length
        const allAnswered = answeredCount >= BENCHMARK_TOTAL_QUESTIONS

        // Check for ?q= query param to jump to a specific question
        const params = new URLSearchParams(location.search)
        const qParam = params.get('q')
        let startIdx = 0
        if (qParam !== null) {
          const qi = parseInt(qParam, 10)
          if (Number.isFinite(qi) && qi >= 0 && qi < BENCHMARK_TOTAL_QUESTIONS) {
            startIdx = qi
          }
        } else {
          for (let i = 0; i < BENCHMARK_TOTAL_QUESTIONS; i++) {
            if (!map[BENCHMARK_QUESTIONS[i].id]) {
              startIdx = i
              break
            }
            startIdx = i
          }
          if (allAnswered) {
            startIdx = BENCHMARK_TOTAL_QUESTIONS - 1
          }
        }

        setAssessmentId(id)
        setAnswers(map)
        setCurrentIndex(startIdx)
        if (allAnswered && qParam === null) {
          setPhase('observations')
        } else if (answeredCount === 0) {
          // Show intro for any draft with no answers yet (new or existing row).
          setShowDisclaimer(true)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode])

  const question = BENCHMARK_QUESTIONS[currentIndex]

  const handleCommit = useCallback(
    (value: number, direction: string, skipped: boolean) => {
      if (!assessmentId || !question) return
      const q = question
      const updated = {
        ...answers,
        [q.id]: { value, swipe_direction: direction, skipped },
      }
      setAnswers(updated)
      scheduleSave(assessmentId, q, value, direction, skipped)

      const allDone = BENCHMARK_QUESTIONS.every(bq => updated[bq.id])
      if (allDone) {
        setPhase('observations')
        return
      }

      for (let offset = 1; offset <= BENCHMARK_TOTAL_QUESTIONS; offset++) {
        const idx = (currentIndex + offset) % BENCHMARK_TOTAL_QUESTIONS
        if (!updated[BENCHMARK_QUESTIONS[idx].id]) {
          setCurrentIndex(idx)
          return
        }
      }
    },
    [assessmentId, question, answers, scheduleSave, currentIndex]
  )

  const handleBack = useCallback(() => {
    if (phase === 'observations') {
      setPhase('cards')
      setCurrentIndex(BENCHMARK_TOTAL_QUESTIONS - 1)
      return
    }
    if (phase === 'submit') {
      setPhase('observations')
      return
    }
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }, [currentIndex, phase])

  const handleObservationsComplete = () => {
    setPhase('submit')
  }

  const handleFinalize = async () => {
    if (!assessmentId || !user?.id) return

    // Self path: show wait UI on the same frame as the click (before validation / network).
    if (isSelf) {
      flushSync(() => {
        setSubmitting(true)
      })
    }

    const valueMap: Record<string, number> = {}
    for (const q of BENCHMARK_QUESTIONS) {
      const a = answers[q.id]
      if (!a) {
        if (isSelf) setSubmitting(false)
        toast.error('Please answer every question before submitting.')
        return
      }
      valueMap[q.id] = a.value
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }

    if (!isSelf) {
      flushSync(() => {
        setSubmitting(true)
      })
    }

    try {
      const lastQ = BENCHMARK_QUESTIONS[BENCHMARK_TOTAL_QUESTIONS - 1]
      const lastA = answers[lastQ.id]
      if (lastA) {
        await flushSave(assessmentId, lastQ, lastA.value, lastA.swipe_direction, lastA.skipped)
      }

      const scores = computeBenchmarkScores(valueMap)
      const score_data = {
        kind: 'benchmark' as const,
        zones: {
          balance: scores.balance,
          blossom: scores.blossom,
          bliss: scores.bliss,
        },
        overall: scores.overall,
      }

      const { error } = await supabase
        .from('assessments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          score_total: scores.overall.sum,
          score_data: score_data as unknown as Record<string, unknown>,
        })
        .eq('id', assessmentId)
        .eq('client_id', user.id)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Assessment complete!')

      if (isSelf) {
        setGenerating(true)
        try {
          const { data: reportData, error: reportErr } = await supabase.functions.invoke(
            'generate-zen-report-self',
            { body: { assessment_id: assessmentId } }
          )
          if (reportErr) {
            const msg = await messageFromFunctionInvokeFailure(reportErr)
            toast.error(msg)
            return
          }
          if (reportData?.error) {
            toast.error(
              typeof reportData.error === 'string' ? reportData.error : 'Report generation failed'
            )
            return
          }
          toast.success('Your Zen Plan report is ready!')
          navigate('/app/client/report', { replace: true })
        } finally {
          setGenerating(false)
        }
      } else {
        navigate('/app/client/report', { replace: true })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (booting || !user?.id) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p className="text-muted-foreground">Loading your assessment…</p>
      </div>
    )
  }

  if (!assessmentId) {
    return (
      <div className="space-y-4 text-foreground">
        <p className="text-muted-foreground" style={pageStaggerItemStyle(0, staggerVisible)}>
          Could not start an assessment. Try again from the assessments page.
        </p>
        <div style={pageStaggerItemStyle(1, staggerVisible)}>
          <Button asChild variant="zenOutline">
            <Link to="/app/client/assessment">Back</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'observations') {
    return (
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-6 md:min-h-[calc(100dvh-11rem)]">
        <div
          className="flex shrink-0 flex-wrap items-start justify-between gap-4"
          style={pageStaggerItemStyle(0, staggerVisible)}
        >
          <Button
            type="button"
            variant="zenOutline"
            size="sm"
            onClick={handleBack}
          >
            <ChevronLeft className="mr-1 size-4" aria-hidden />
            Back to questions
          </Button>
          <div className="shrink-0 text-right text-sm text-foreground/90">
            <p className="font-medium text-foreground">{modeTitle}</p>
            <p className="text-xs text-muted-foreground">Your observations</p>
          </div>
        </div>
        <div style={pageStaggerItemStyle(1, staggerVisible)}>
          <ClientObservationsForm
            assessmentId={assessmentId}
            onComplete={handleObservationsComplete}
            submitting={submitting}
          />
        </div>
      </div>
    )
  }

  if (phase === 'submit') {
    return (
      <>
        <div className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center gap-6 md:min-h-[calc(100dvh-11rem)]">
          <Card
            className="zen-glass-card zen-ring-primary w-full max-w-lg ring-0 shadow-none"
            style={pageStaggerItemStyle(0, staggerVisible)}
          >
            <CardHeader>
              <CardTitle>Ready to submit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                You&apos;ve answered all {BENCHMARK_TOTAL_QUESTIONS} questions and added your
                observations. Submit to finalize your assessment.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="zen"
                  disabled={submitting || generating}
                  onClick={() => void handleFinalize()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Generating Report…
                    </>
                  ) : submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Submitting…
                    </>
                  ) : (
                    'Submit assessment'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="zenOutline"
                  disabled={submitting || generating}
                  onClick={handleBack}
                >
                  Back to observations
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <ReportGenerationWaitOverlay open={isSelf && (submitting || generating)} />
      </>
    )
  }

  const displayNumerator = currentIndex + 1

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-6 md:min-h-[calc(100dvh-11rem)]">
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent
          showCloseButton={false}
          className="zen-glass-card rounded-2xl border-white/15 text-foreground"
          onPointerDownOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          {disclaimerStep === 0 ? (
            <>
              <DialogHeader>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 1 of 2</p>
                <DialogTitle className="text-foreground">Before you begin</DialogTitle>
                <DialogDescription className="leading-relaxed text-muted-foreground">
                  Please read each statement carefully and select the response that best reflects your
                  current experience. This is a self-reflection tool, not a diagnostic assessment, and
                  there are no right or wrong answers. Respond honestly based on how you feel most of the
                  time without overthinking, as your first instinct is often the most accurate.
                </DialogDescription>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your responses will remain confidential and will be used only to understand your
                  current patterns and guide a personalized plan.
                </p>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="zen" onClick={() => setDisclaimerStep(1)}>
                  Next
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 2 of 2</p>
                <DialogTitle className="text-foreground">How to answer</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                    <p>You can answer each question in two ways:</p>
                    <ul className="list-disc space-y-2 pl-5">
                      <li>
                        <span className="text-foreground/90">Swipe on the card:</span>
                        <div className="mt-2 space-y-1.5 font-bold text-foreground">
                          <p className="mb-0">Completely True - Swipe up</p>
                          <p className="mb-0">Mostly True - Swipe Right</p>
                          <p className="mb-0">A Little True - Swipe Left</p>
                          <p className="mb-0">Not True - Swipe Down</p>
                        </div>
                      </li>
                      <li>
                        <span className="text-foreground/90">Use the buttons</span> under the card — they match the
                        same four answers as the swipes.
                      </li>
                    </ul>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="zenOutline" onClick={() => setDisclaimerStep(0)}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="zen"
                  onClick={() => {
                    setShowDisclaimer(false)
                    setDisclaimerStep(0)
                  }}
                >
                  Continue to assessment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div
        className="flex shrink-0 flex-wrap items-start justify-between gap-4"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="zenOutline"
              size="sm"
              onClick={handleBack}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-1 size-4" aria-hidden />
              Previous
            </Button>
            <Button asChild variant="zenOutline" size="sm">
              <Link to={reviewPath}>Review answers</Link>
            </Button>
            {saving && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Saving draft…
              </span>
            )}
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
            Progress is saved as you go.
          </p>
        </div>
        <div className="shrink-0 text-right text-sm text-foreground/90">
          <p className="font-medium text-foreground">{modeTitle}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {displayNumerator} / {BENCHMARK_TOTAL_QUESTIONS}
          </p>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center"
        style={pageStaggerItemStyle(1, staggerVisible)}
      >
        {question && (
          <SwipeCard
            key={question.id}
            question={question}
            onCommit={handleCommit}
            disabled={submitting}
            currentAnswer={answers[question.id]}
          />
        )}
      </div>
    </div>
  )
}
