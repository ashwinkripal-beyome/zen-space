import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Loader2, Mail, Phone, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  formatAgeDisplay,
  formatClientDisplayName,
  formatGenderLabel,
  type ProfileNameFields,
} from '@/lib/clientDisplayName'
import { messageFromFunctionInvokeFailure } from '@/lib/functionInvokeError'
import { supabase } from '@/lib/supabase'
import {
  computeSupervisedAssessmentEligibility,
  therapistSupervisedCooldownLabel,
  type SupervisedEligibility,
} from '@/lib/supervisedAssessmentEligibility'
import { cn } from '@/lib/utils'

const glassReport = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')
const glassObs = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
const glassPlan = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
const glassControls = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
const glassProfile = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')

function formatDobDisplay(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—'
  try {
    const [y, m, d] = iso.split('-')
    const mi = parseInt(m, 10)
    const di = parseInt(d, 10)
    if (!y || !mi || !di) return iso
    const month = new Date(2000, mi - 1, 1).toLocaleString(undefined, { month: 'long' })
    return `${di} ${month}, ${y}`
  } catch {
    return iso
  }
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob?.trim()) return null
  const parts = dob.split('-').map(x => parseInt(x, 10))
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return null
  const today = new Date()
  let age = today.getFullYear() - y
  const cm = today.getMonth() + 1
  if (cm < m || (cm === m && today.getDate() < d)) age--
  return Number.isFinite(age) ? age : null
}

type ClientProfileRow = ProfileNameFields & {
  id: string
  gender: string | null
  age: number | null
  phone_number: string | null
  dob: string | null
  occupation: string | null
  company: string | null
  is_paid_customer: boolean
}

export function TherapistClientDetailPage() {
  const { user } = useAuth()
  const { clientId } = useParams<{ clientId: string }>()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [profile, setProfile] = useState<ClientProfileRow | null>(null)
  const [savingPaidCustomer, setSavingPaidCustomer] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id || !clientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setForbidden(false)
    try {
      const { data: link, error: linkErr } = await supabase
        .from('therapist_clients')
        .select('id')
        .eq('therapist_id', user.id)
        .eq('client_id', clientId)
        .maybeSingle()

      if (linkErr) {
        console.error('[therapist_clients link]', linkErr)
        setForbidden(true)
        setProfile(null)
        return
      }
      if (!link) {
        setForbidden(true)
        setProfile(null)
        return
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select(
          'id, email, name, first_name, last_name, gender, age, phone_number, dob, occupation, company, is_paid_customer'
        )
        .eq('id', clientId)
        .maybeSingle()

      if (profErr) {
        console.error('[profiles]', profErr)
        setProfile(null)
        return
      }

      if (!prof) {
        setProfile(null)
        return
      }

      const p = prof as Record<string, unknown>
      const paid = Boolean(p.is_paid_customer)
      setProfile({
        id: String(p.id),
        email: typeof p.email === 'string' ? p.email : '',
        name: typeof p.name === 'string' ? p.name : null,
        first_name: typeof p.first_name === 'string' ? p.first_name : null,
        last_name: typeof p.last_name === 'string' ? p.last_name : null,
        gender: typeof p.gender === 'string' ? p.gender : null,
        age: p.age != null && Number.isFinite(Number(p.age)) ? Number(p.age) : null,
        phone_number: typeof p.phone_number === 'string' ? p.phone_number : null,
        dob: typeof p.dob === 'string' ? p.dob : null,
        occupation: typeof p.occupation === 'string' ? p.occupation : null,
        company: typeof p.company === 'string' ? p.company : null,
        is_paid_customer: paid,
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id, clientId])

  useEffect(() => {
    void load()
  }, [load])

  // Assessment override controls
  const [selfLastCompleted, setSelfLastCompleted] = useState<string | null>(null)
  const [supervisedLastCompleted, setSupervisedLastCompleted] = useState<string | null>(null)
  const [supervisedEligibility, setSupervisedEligibility] = useState<SupervisedEligibility | null>(null)
  const [enablingSupervised, setEnablingSupervised] = useState(false)

  /** Latest completed self assessment id when its report has no 18-week plan yet (therapist can generate). */
  const [selfAssessmentNeedingPlan, setSelfAssessmentNeedingPlan] = useState<string | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)

  const loadPlanCta = useCallback(async () => {
    if (!clientId) {
      setSelfAssessmentNeedingPlan(null)
      return
    }
    const { data: selfA, error: selfErr } = await supabase
      .from('assessments')
      .select('id')
      .eq('client_id', clientId)
      .eq('assessment_mode', 'self')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (selfErr) {
      console.error('[assessments self for plan cta]', selfErr)
      setSelfAssessmentNeedingPlan(null)
      return
    }
    if (!selfA?.id) {
      setSelfAssessmentNeedingPlan(null)
      return
    }
    const { data: rep, error: repErr } = await supabase
      .from('reports')
      .select('plan_section')
      .eq('assessment_id', selfA.id)
      .maybeSingle()
    if (repErr) {
      console.error('[reports plan cta]', repErr)
      setSelfAssessmentNeedingPlan(null)
      return
    }
    if (!rep) {
      setSelfAssessmentNeedingPlan(null)
      return
    }
    const ps = (rep.plan_section as string) || ''
    setSelfAssessmentNeedingPlan(ps.trim().length === 0 ? selfA.id : null)
  }, [clientId])

  const loadOverrides = useCallback(async () => {
    if (!user?.id || !clientId) return

    const [selfA, supA, overrideLatest, latestReport] = await Promise.all([
      supabase
        .from('assessments')
        .select('completed_at')
        .eq('client_id', clientId)
        .eq('assessment_mode', 'self')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('assessments')
        .select('completed_at')
        .eq('client_id', clientId)
        .eq('assessment_mode', 'supervised')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('assessment_overrides')
        .select('created_at')
        .eq('client_id', clientId)
        .eq('assessment_mode', 'supervised')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('reports')
        .select('id, created_at, plan_section')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setSelfLastCompleted(selfA.data?.completed_at ?? null)
    setSupervisedLastCompleted(supA.data?.completed_at ?? null)

    const reportRow = latestReport.data as { id?: string; created_at?: string; plan_section?: string } | null
    const reportId = reportRow?.id
    let planCompletedDays: unknown = []
    if (reportId) {
      const prog = await supabase
        .from('report_plan_progress')
        .select('completed_days')
        .eq('client_id', clientId)
        .eq('report_id', reportId)
        .maybeSingle()
      planCompletedDays = prog.data?.completed_days ?? []
    }

    setSupervisedEligibility(
      computeSupervisedAssessmentEligibility({
        isPaidCustomer: profile?.is_paid_customer === true,
        supervisedCompletedAt: supA.data?.completed_at,
        supervisedOverrideCreatedAt: overrideLatest.data?.created_at ?? null,
        latestReportId: reportId ?? null,
        latestReportCreatedAt: reportRow?.created_at ?? null,
        planSectionHtml: reportRow?.plan_section ?? null,
        planCompletedDays,
      })
    )
  }, [user?.id, clientId, profile?.is_paid_customer])

  useEffect(() => {
    if (profile) void loadOverrides()
  }, [profile, loadOverrides])

  useEffect(() => {
    if (profile) void loadPlanCta()
  }, [profile, loadPlanCta])

  const handleGenerate18WeekPlanForSelf = async () => {
    if (!selfAssessmentNeedingPlan) return
    setGeneratingPlan(true)
    try {
      const { data, error, response: fnResponse } = await supabase.functions.invoke('generate-zen-plan', {
        body: { assessment_id: selfAssessmentNeedingPlan },
      })
      if (error) {
        const msg = await messageFromFunctionInvokeFailure(error, fnResponse)
        toast.error(msg)
        return
      }
      if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
        const err = (data as { error?: string }).error
        toast.error(typeof err === 'string' ? err : 'Plan generation failed')
        return
      }
      toast.success('18-week plan generated')
      setSelfAssessmentNeedingPlan(null)
    } finally {
      setGeneratingPlan(false)
    }
  }

  const handleEnableSupervisedAssessment = async () => {
    if (!user?.id || !clientId) return
    setEnablingSupervised(true)
    const { error } = await supabase
      .from('assessment_overrides')
      .upsert(
        {
          therapist_id: user.id,
          client_id: clientId,
          assessment_mode: 'supervised',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'therapist_id,client_id,assessment_mode' }
      )
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Supervised assessment enabled for this client')
      void loadOverrides()
    }
    setEnablingSupervised(false)
  }

  const handleSetPaidCustomer = async (paid: boolean) => {
    if (!clientId) return
    setSavingPaidCustomer(true)
    const { error } = await supabase.rpc('set_client_is_paid_customer', {
      p_client_id: clientId,
      p_is_paid: paid,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setProfile(p => (p ? { ...p, is_paid_customer: paid } : p))
      toast.success(
        paid
          ? 'This client is marked as a paid customer (visible to all linked therapists)'
          : 'Paid customer status removed (visible to all linked therapists)'
      )
      void loadOverrides()
    }
    setSavingPaidCustomer(false)
  }

  const primaryLabel = formatClientDisplayName(profile ?? undefined)
  const emailTrimmed = profile?.email?.trim() ?? ''
  const displayAge =
    profile?.age != null && Number.isFinite(Number(profile.age))
      ? profile.age
      : ageFromDob(profile?.dob ?? null)
  const staggerVisible = usePageStaggerVisible(!loading, `${clientId}-${Boolean(profile)}-${forbidden}`)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-foreground">
        <Loader2 className="size-10 animate-spin text-sky-300" aria-hidden />
        <p className="text-muted-foreground">Loading client…</p>
      </div>
    )
  }

  if (forbidden || !clientId) {
    return (
      <div className="space-y-6 text-foreground">
        <div style={pageStaggerItemStyle(0, staggerVisible)}>
          <Button asChild variant="zenOutline" size="sm">
            <Link to="/app/therapist/clients">← Clients</Link>
          </Button>
        </div>
        <p className="text-muted-foreground" style={pageStaggerItemStyle(1, staggerVisible)}>
          This client isn&apos;t linked to your practice, or the link could not be loaded.
        </p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6 text-foreground">
        <div style={pageStaggerItemStyle(0, staggerVisible)}>
          <Button asChild variant="zenOutline" size="sm">
            <Link to="/app/therapist/clients">← Clients</Link>
          </Button>
        </div>
        <p className="text-muted-foreground" style={pageStaggerItemStyle(1, staggerVisible)}>
          We couldn&apos;t load this client&apos;s profile. Try again in a moment.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3" style={pageStaggerItemStyle(0, staggerVisible)}>
        <Button asChild variant="zenOutline" size="sm">
          <Link to="/app/therapist/clients">← Clients</Link>
        </Button>
      </div>

      <Card className={glassProfile} style={pageStaggerItemStyle(1, staggerVisible)}>
        <CardContent className="space-y-3 pt-6">
          <p className="text-xl font-semibold text-foreground sm:text-2xl">{primaryLabel}</p>
          {emailTrimmed ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0 text-sky-300/70" aria-hidden />
              {emailTrimmed}
            </p>
          ) : null}
          {profile.phone_number?.trim() ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-3.5 shrink-0 text-sky-300/70" aria-hidden />
              {profile.phone_number.trim()}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="text-muted-foreground">Gender</span> · {formatGenderLabel(profile.gender)}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-muted-foreground">Age</span> · {formatAgeDisplay(displayAge)}
          </p>
          {profile.dob ? (
            <p className="text-sm text-muted-foreground">
              <span className="text-muted-foreground">Date of birth</span> · {formatDobDisplay(profile.dob)}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="text-muted-foreground">Occupation</span> · {profile.occupation?.trim() || '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-muted-foreground">Company</span> · {profile.company?.trim() || '—'}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
        <Card
          className={cn(glassReport, 'h-full')}
          style={pageStaggerItemStyle(2, staggerVisible)}
        >
          <CardHeader className="flex-1">
            <CardTitle className="text-foreground">Reports</CardTitle>
            <CardDescription className="text-muted-foreground">Zen Plan reports &amp; assessment answers</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button asChild variant="zen" className="w-full sm:w-auto">
              <Link to={`/app/therapist/clients/${clientId}/reports`}>Open reports</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className={cn(glassPlan, 'h-full')} style={pageStaggerItemStyle(3, staggerVisible)}>
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CalendarDays className="size-4 text-sky-300" aria-hidden />
              18-Week Plan
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {selfAssessmentNeedingPlan
                ? 'This client has a self-assessment report but no 18-week plan yet. You can generate it here.'
                : 'Plan progress and daily activities'}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-col gap-2 pt-0 sm:flex-row sm:flex-wrap">
            {selfAssessmentNeedingPlan ? (
              <Button
                type="button"
                variant="zen"
                className="w-full sm:w-auto"
                disabled={generatingPlan}
                onClick={() => void handleGenerate18WeekPlanForSelf()}
              >
                {generatingPlan ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  'Generate 18-week plan'
                )}
              </Button>
            ) : null}
            <Button asChild variant="zenOutline" className="w-full sm:w-auto">
              <Link to={`/app/therapist/clients/${clientId}/plan`}>Open plan</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className={cn(glassObs, 'h-full')} style={pageStaggerItemStyle(4, staggerVisible)}>
          <CardHeader className="flex-1">
            <CardTitle className="text-foreground">Observations</CardTitle>
            <CardDescription className="text-muted-foreground">
              Generate reports for completed supervised assessments
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button asChild variant="zenOutline" className="w-full sm:w-auto">
              <Link to={`/app/therapist/clients/${clientId}/observations`}>Open observations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className={glassControls} style={pageStaggerItemStyle(5, staggerVisible)}>
        <CardHeader>
          <CardTitle className="text-foreground">Assessment Controls</CardTitle>
          <CardDescription className="text-muted-foreground">
            Mark paid customers to enable supervised assessments on the client app. Self assessment is one-time and
            stays available for linked clients until you mark them as paid. You can unlock the next supervised
            reassessment early if the plan-completion and 16-week gate is not met yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Paid customer</p>
              <p className="text-xs text-muted-foreground">
                Mark this client as a paid customer to enable supervised assessments.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={profile.is_paid_customer ? 'zenOutline' : 'zen'}
                disabled={savingPaidCustomer}
                onClick={() => void handleSetPaidCustomer(!profile.is_paid_customer)}
              >
                {savingPaidCustomer ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : profile.is_paid_customer ? (
                  'Mark as unpaid customer'
                ) : (
                  'Mark as paid customer'
                )}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-sm font-medium text-foreground">Self Assessment</p>
            <p className="text-xs text-muted-foreground">
              {selfLastCompleted
                ? 'Completed — self assessment is one-time only.'
                : supervisedLastCompleted
                  ? "Not available — self assessment isn't offered after a supervised assessment."
                  : supervisedEligibility?.blockedReason === 'not_paid'
                    ? 'Until you mark this client as a paid customer, they can start the one-time self assessment from the app. After you mark them as paid, they should use supervised assessments.'
                    : 'The client can start a self assessment from their app until they have a completed self or supervised assessment.'}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Supervised Assessment</p>
              <p className="text-xs text-muted-foreground">
                {supervisedEligibility
                  ? therapistSupervisedCooldownLabel(supervisedEligibility)
                  : supervisedLastCompleted
                    ? 'Loading gate status…'
                    : 'Loading…'}
              </p>
            </div>
            {supervisedLastCompleted &&
              supervisedEligibility &&
              !supervisedEligibility.available &&
              supervisedEligibility.blockedReason !== 'not_paid' && (
                <Button
                  size="sm"
                  variant="zenOutline"
                  disabled={enablingSupervised}
                  onClick={() => void handleEnableSupervisedAssessment()}
                >
                  {enablingSupervised ? <RefreshCw className="size-3.5 animate-spin" /> : 'Enable'}
                </Button>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
