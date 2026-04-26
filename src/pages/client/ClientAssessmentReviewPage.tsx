import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  BENCHMARK_QUESTIONS,
  BENCHMARK_TOTAL_QUESTIONS,
  formatBenchmarkAnswerLabel,
} from '@/data/benchmarkAssessment'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import { fetchClientBenchmarkDraftForReview } from '@/lib/clientBenchmarkDraft'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type AssessmentMode = 'supervised' | 'self'

function deriveMode(pathname: string): AssessmentMode {
  if (pathname.includes('/self/')) return 'self'
  return 'supervised'
}

export function ClientAssessmentReviewPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const mode = deriveMode(location.pathname)
  const isSelf = mode === 'self'
  const modeTitle = isSelf ? 'Self Assessment' : 'Supervised Assessment'
  const sessionPath = `/app/client/assessment/${mode}/session`

  const [loading, setLoading] = useState(true)
  const [hasDraft, setHasDraft] = useState(false)
  const [answers, setAnswers] = useState<
    Record<string, { value: number; swipe_direction: string; skipped: boolean }>
  >({})

  const staggerVisible = usePageStaggerVisible(!loading, `${user?.id ?? 'anon'}-${mode}-${hasDraft}`)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user?.id) {
        setLoading(false)
        setHasDraft(false)
        setAnswers({})
        return
      }
      if (isSelf) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('is_paid_customer')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (profErr) {
          console.error('[profiles self gate review]', profErr)
        } else if ((prof as { is_paid_customer?: boolean } | null)?.is_paid_customer) {
          toast.error(
            'Self assessment is not available after your therapist has marked you as a paid customer. Use the supervised assessment.'
          )
          setLoading(false)
          navigate('/app/client/assessment', { replace: true })
          return
        }
      }
      if (!isSelf) {
        const { data: paidProf, error: paidErr } = await supabase
          .from('profiles')
          .select('is_paid_customer')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (paidErr) {
          console.error('[profiles supervised gate review]', paidErr)
        } else if (!(paidProf as { is_paid_customer?: boolean } | null)?.is_paid_customer) {
          toast.error(
            'Supervised assessment is only available when your therapist has marked you as a paid customer.'
          )
          setLoading(false)
          navigate('/app/client/assessment', { replace: true })
          return
        }
      }
      setLoading(true)
      const draft = await fetchClientBenchmarkDraftForReview(user.id, mode)
      if (cancelled) return
      setHasDraft(draft != null)
      setAnswers(draft?.answers ?? {})
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user?.id, mode])

  const jumpToQuestion = (index: number) => {
    navigate(`${sessionPath}?q=${index}`)
  }

  if (!user?.id) {
    return (
      <div className="space-y-4 text-foreground">
        <p className="text-muted-foreground" style={pageStaggerItemStyle(0, staggerVisible)}>
          Sign in to view your assessment.
        </p>
        <div style={pageStaggerItemStyle(1, staggerVisible)}>
          <Button asChild variant="zenOutline">
            <Link to="/login/client">Sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p className="text-muted-foreground">Loading answers…</p>
      </div>
    )
  }

  if (!hasDraft) {
    return (
      <div className="space-y-6 text-foreground">
        <div
          className="flex flex-wrap items-start justify-between gap-4"
          style={pageStaggerItemStyle(0, staggerVisible)}
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Review answers</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              There isn&apos;t an assessment in progress yet. Start the assessment to record answers here.
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{modeTitle}</p>
            <p className="text-xs text-muted-foreground">0 / {BENCHMARK_TOTAL_QUESTIONS}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3" style={pageStaggerItemStyle(1, staggerVisible)}>
          <Button asChild variant="zen">
            <Link to={sessionPath}>Start assessment</Link>
          </Button>
        </div>
      </div>
    )
  }

  const answeredCount = BENCHMARK_QUESTIONS.filter(q => answers[q.id]).length

  return (
    <div className="space-y-6 text-foreground">
      <div
        className="flex flex-wrap items-start justify-between gap-4"
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Review answers</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Click any question to jump back and edit your answer.
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{modeTitle}</p>
          <p className="text-xs text-muted-foreground">
            {answeredCount} / {BENCHMARK_TOTAL_QUESTIONS}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3" style={pageStaggerItemStyle(1, staggerVisible)}>
        <Button asChild variant="zen">
          <Link to={sessionPath}>Continue assessment</Link>
        </Button>
      </div>

      <ol className="space-y-3 pb-8">
        {BENCHMARK_QUESTIONS.map((q, i) => {
          const a = answers[q.id]
          const label = formatBenchmarkAnswerLabel(a)
          const missing = !a
          return (
            <li key={q.id} style={pageStaggerItemStyle(i + 2, staggerVisible)}>
              <button
                type="button"
                onClick={() => jumpToQuestion(i)}
                className={cn(
                  'zen-glass-card w-full rounded-2xl px-4 py-3 text-left shadow-none transition-colors sm:px-5 sm:py-4',
                  'hover:ring-1 hover:ring-violet-400/40 cursor-pointer',
                  missing && 'zen-ring-secondary'
                )}
                style={!missing ? { boxShadow: '0 0 0 1.5px rgb(52 211 153 / 0.55)' } : undefined}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {i + 1}/{BENCHMARK_TOTAL_QUESTIONS}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      missing
                        ? 'border-white/20 bg-white/5 text-muted-foreground'
                        : 'border-white/25 bg-white/10 text-foreground/90'
                    )}
                  >
                    {label}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-snug text-foreground md:text-base">{q.text}</p>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  <span>{q.section}</span>
                  {q.category ? <span className="text-muted-foreground"> · {q.category}</span> : null}
                </p>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
