import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CreditCard, Loader2, Mail, Phone, RefreshCw, StickyNote, Trash2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'
import {
  formatAgeDisplay,
  formatClientDisplayName,
  formatGenderLabel,
  type ProfileNameFields,
} from '@/lib/clientDisplayName'
import { CLIENT_STATUS_META, computeClientStatus, type ClientStatusLabel } from '@/lib/clientStatus'
import {
  ReportGenerationWaitOverlay,
  type ReportGenerationWaitVariant,
} from '@/components/ReportGenerationWaitOverlay'
import { OneOnOneActivitySelector } from '@/components/OneOnOneActivitySelector'
import { PLAN_META } from '@/lib/planTiers'
import { startRazorpayCheckout } from '@/lib/razorpay'
import { messageFromFunctionInvokeFailure } from '@/lib/functionInvokeError'
import { assessZenGenerationHealth, type ZenGenerationHealth } from '@/lib/reportGenerationHealth'
import { supabase } from '@/lib/supabase'
import {
  computeSupervisedAssessmentEligibility,
  therapistSupervisedCooldownLabel,
  type SupervisedEligibility,
} from '@/lib/supervisedAssessmentEligibility'
import { cn } from '@/lib/utils'

const glassReport = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')
const glassPlan = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
const glassRegen = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')
const glassControls = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
const glassNotes = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')
const glassProfile = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')

const NOTE_BODY_MAX = 4000

function formatNoteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type TherapistNoteAuthor = ProfileNameFields & {
  email?: string | null
}

type ClientTherapistNoteRow = {
  id: string
  body: string
  created_at: string
  therapist_id: string
  therapist: TherapistNoteAuthor | TherapistNoteAuthor[] | null
}

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
  email: string
  gender: string | null
  age: number | null
  phone_number: string | null
  dob: string | null
  company: string | null
  company_department_name: string | null
  company_not_listed: boolean
  is_paid_customer: boolean
  client_status: string | null
  current_plan: string | null
}

type LifecycleOption = {
  value: 'contacted' | 'dropped' | 'stopped_pro'
  label: string
  description: string
  badgeClass: string
}

const LIFECYCLE_OPTIONS: LifecycleOption[] = [
  {
    value: 'stopped_pro',
    label: 'Stopped Pro',
    description: 'Revoke paid access without deleting their generated plan and ritual content.',
    badgeClass: CLIENT_STATUS_META.stopped_pro.badgeClass,
  },
  {
    value: 'contacted',
    label: 'Mark as contacted',
    description: 'Record that this client has been contacted.',
    badgeClass: CLIENT_STATUS_META.contacted.badgeClass,
  },
  {
    value: 'dropped',
    label: 'Mark as dropped',
    description: 'Mark this client as dropped from your pipeline.',
    badgeClass: CLIENT_STATUS_META.dropped.badgeClass,
  },
]

type PaidPlan = '18_week_semi_guided' | 'one_on_one_intensive'
type MarkAsStep = 'main' | 'paid-plan' | 'paid-method'

export function TherapistClientDetailPage() {
  const { user } = useAuth()
  const { clientId } = useParams<{ clientId: string }>()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [profile, setProfile] = useState<ClientProfileRow | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [markAsOpen, setMarkAsOpen] = useState(false)
  const [markAsStep, setMarkAsStep] = useState<MarkAsStep>('main')
  const [markAsPlan, setMarkAsPlan] = useState<PaidPlan | null>(null)
  const [razorpayStatus, setRazorpayStatus] = useState<string | null>(null)
  const [hasCompletedSelfAssessment, setHasCompletedSelfAssessment] = useState(false)
  const [notes, setNotes] = useState<ClientTherapistNoteRow[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [noteToDelete, setNoteToDelete] = useState<ClientTherapistNoteRow | null>(null)

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

      const [profResult, selfAssessmentResult] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, email, name, first_name, last_name, gender, age, phone_number, dob, company, company_not_listed, is_paid_customer, client_status, current_plan, company_department:company_departments(name)'
          )
          .eq('id', clientId!)
          .maybeSingle(),
        supabase
          .from('assessments')
          .select('id')
          .eq('client_id', clientId)
          .eq('assessment_mode', 'self')
          .eq('status', 'completed')
          .limit(1)
          .maybeSingle(),
      ])

      if (profResult.error) {
        console.error('[profiles]', profResult.error)
        setProfile(null)
        return
      }

      if (!profResult.data) {
        setProfile(null)
        return
      }

      const p = profResult.data as Record<string, unknown>
      const paid = Boolean(p.is_paid_customer)
      const departmentRel = p.company_department as { name?: string } | { name?: string }[] | null | undefined
      const departmentName = Array.isArray(departmentRel)
        ? typeof departmentRel[0]?.name === 'string'
          ? (departmentRel[0]!.name as string)
          : null
        : typeof departmentRel?.name === 'string'
          ? (departmentRel.name as string)
          : null
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
        company: typeof p.company === 'string' ? p.company : null,
        company_department_name: departmentName,
        company_not_listed: Boolean(p.company_not_listed),
        is_paid_customer: paid,
        client_status: typeof p.client_status === 'string' ? p.client_status : null,
        current_plan: typeof p.current_plan === 'string' ? p.current_plan : null,
      })
      setHasCompletedSelfAssessment(Boolean(selfAssessmentResult.data?.id))
    } finally {
      setLoading(false)
    }
  }, [user?.id, clientId])

  useEffect(() => {
    void load()
  }, [load])

  const loadNotes = useCallback(async () => {
    if (!clientId) {
      setNotes([])
      return
    }
    setNotesLoading(true)
    try {
      const { data, error } = await supabase
        .from('client_therapist_notes')
        .select(
          `
          id,
          body,
          created_at,
          therapist_id,
          therapist:profiles!client_therapist_notes_therapist_id_fkey (
            name,
            first_name,
            last_name,
            email
          )
        `
        )
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[client_therapist_notes]', error)
        toast.error(error.message)
        setNotes([])
        return
      }
      setNotes((data ?? []) as ClientTherapistNoteRow[])
    } finally {
      setNotesLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (profile && clientId) void loadNotes()
  }, [profile, clientId, loadNotes])

  const handleAddNote = async () => {
    if (!user?.id || !clientId) return
    const body = newNoteBody.trim()
    if (!body) {
      toast.error('Enter a note before saving')
      return
    }
    if (body.length > NOTE_BODY_MAX) {
      toast.error(`Note must be ${NOTE_BODY_MAX} characters or fewer`)
      return
    }
    setSavingNote(true)
    const { error } = await supabase.from('client_therapist_notes').insert({
      client_id: clientId,
      therapist_id: user.id,
      body,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Note added')
      setNewNoteBody('')
      void loadNotes()
    }
    setSavingNote(false)
  }

  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete) return
    const noteId = noteToDelete.id
    setDeletingNoteId(noteId)
    const { error } = await supabase.from('client_therapist_notes').delete().eq('id', noteId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Note deleted')
      setNotes(prev => prev.filter(n => n.id !== noteId))
      setNoteToDelete(null)
    }
    setDeletingNoteId(null)
  }

  const therapistLabelForNote = (note: ClientTherapistNoteRow): string => {
    const rel = note.therapist
    const author = Array.isArray(rel) ? rel[0] : rel
    if (author) return formatClientDisplayName(author)
    if (note.therapist_id === user?.id) return 'You'
    return 'Therapist'
  }

  // Assessment override controls
  const [selfLastCompleted, setSelfLastCompleted] = useState<string | null>(null)
  const [supervisedLastCompleted, setSupervisedLastCompleted] = useState<string | null>(null)
  const [supervisedEligibility, setSupervisedEligibility] = useState<SupervisedEligibility | null>(null)
  const [enablingSupervised, setEnablingSupervised] = useState(false)

  /** Generic target for plan generation — the latest report (any mode) that has a completed assessment. */
  type PlanTarget = {
    assessmentId: string
    reportId: string
    assessmentMode: 'self' | 'supervised'
    hasPlan: boolean
  }
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null)
  /** True when the latest report has no plan yet (needs generation). */
  const [planTargetNeedsGeneration, setPlanTargetNeedsGeneration] = useState<boolean>(false)
  const [zenGenerationHealth, setZenGenerationHealth] = useState<ZenGenerationHealth | null>(null)
  const [generationWait, setGenerationWait] = useState<ReportGenerationWaitVariant | null>(null)
  const [scrapConfirmOpen, setScrapConfirmOpen] = useState(false)
  const [latestReportLoaded, setLatestReportLoaded] = useState(false)
  const [hasLatestReport, setHasLatestReport] = useState(false)

  const loadZenGenerationHealth = useCallback(async () => {
    if (!clientId) {
      setPlanTarget(null)
      setPlanTargetNeedsGeneration(false)
      setZenGenerationHealth(null)
      return
    }

    // Query the latest report (any assessment mode), join its assessment.
    const { data: rep, error: repErr } = await supabase
      .from('reports')
      .select(
        'id, plan_section, report_section, content, final_narrative_section, report_client_info, report_key_concerns, report_current_state, report_balance_zone, report_blossom_zone, report_bliss_zone, report_integrated_interpretation, assessment_id, assessments ( id, assessment_mode, status )'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (repErr) {
      console.error('[loadZenGenerationHealth]', repErr)
      setPlanTarget(null)
      setPlanTargetNeedsGeneration(false)
      setZenGenerationHealth(null)
      return
    }
    if (!rep) {
      setPlanTarget(null)
      setPlanTargetNeedsGeneration(false)
      setZenGenerationHealth(null)
      return
    }

    // Resolve joined assessment row (Supabase may return array or object).
    const aJoin = rep.assessments as
      | { id: string; assessment_mode: string; status: string }
      | { id: string; assessment_mode: string; status: string }[]
      | null
    const aRow = Array.isArray(aJoin) ? aJoin[0] : aJoin
    const assessmentId = (aRow?.id ?? (rep.assessment_id as string | null | undefined)) as string | null
    const assessmentMode = ((aRow?.assessment_mode as string | undefined) ?? 'self') as 'self' | 'supervised'

    if (!assessmentId) {
      setPlanTarget(null)
      setPlanTargetNeedsGeneration(false)
      setZenGenerationHealth(null)
      return
    }

    const hasPlan = Boolean((rep.plan_section as string)?.trim())
    setPlanTarget({ assessmentId, reportId: rep.id as string, assessmentMode, hasPlan })
    setPlanTargetNeedsGeneration(!hasPlan)

    const health = assessZenGenerationHealth({
      assessmentId,
      assessmentMode,
      report: {
        id: rep.id as string,
        plan_section: (rep.plan_section as string) || null,
        report_section: (rep.report_section as string) || null,
        content: (rep.content as string) || null,
        final_narrative_section: (rep.final_narrative_section as string) || null,
        report_client_info: (rep.report_client_info as string) || null,
        report_key_concerns: (rep.report_key_concerns as string) || null,
        report_current_state: (rep.report_current_state as string) || null,
        report_balance_zone: (rep.report_balance_zone as string) || null,
        report_blossom_zone: (rep.report_blossom_zone as string) || null,
        report_integrated_interpretation: (rep.report_integrated_interpretation as string) || null,
      },
      expectPlanForSelfReport: profile?.is_paid_customer === true,
    })
    setZenGenerationHealth(health)
  }, [clientId, profile?.is_paid_customer])

  const invokeZenFunction = async (
    name: 'generate-zen-plan' | 'generate-zen-report-self',
    assessmentId: string,
    options?: { force?: boolean; scrapAndRegenerate?: boolean }
  ): Promise<{ ok: boolean; message?: string }> => {
    const { data, error, response: fnResponse } = await supabase.functions.invoke(name, {
      body: {
        assessment_id: assessmentId,
        force: options?.force === true,
        scrap_and_regenerate: options?.scrapAndRegenerate === true,
      },
    })
    if (error) {
      const msg = await messageFromFunctionInvokeFailure(error, fnResponse)
      return { ok: false, message: msg }
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return { ok: false, message: (data as { error?: string }).error ?? 'Unknown error' }
    }
    return { ok: true }
  }

  /** Find the latest report missing a plan (any assessment mode) and return its assessment id. */
  const fetchLatestAssessmentIdNeedingPlan = async (): Promise<string | null> => {
    if (!clientId) return null
    const { data: rep } = await supabase
      .from('reports')
      .select('assessment_id, plan_section')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (!rep?.length) return null
    for (const r of rep) {
      const ps = (r.plan_section as string) || ''
      if (ps.trim().length === 0) return r.assessment_id as string
    }
    return null
  }

  const handleScrapAndRegeneratePlan = async () => {
    if (!planTarget) return
    setScrapConfirmOpen(false)
    flushSync(() => setGenerationWait('plan'))
    try {
      const planResult = await invokeZenFunction('generate-zen-plan', planTarget.assessmentId, {
        force: true,
        scrapAndRegenerate: true,
      })
      if (!planResult.ok) {
        toast.error(`Regeneration failed: ${planResult.message ?? ''}`)
        return
      }
      toast.success('18-week plan and Fourfold ritual regenerated')
      void loadZenGenerationHealth()
      void loadOverrides()
    } catch (err) {
      console.error('[scrap regenerate plan]', err)
      toast.error('Regeneration failed unexpectedly')
    } finally {
      setGenerationWait(null)
    }
  }

  const showScrapRegenerateCard =
    profile?.is_paid_customer === true && Boolean(planTarget) && hasLatestReport

  const loadOverrides = useCallback(async () => {
    if (!user?.id || !clientId) return
    setLatestReportLoaded(false)

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
    setHasLatestReport(Boolean(reportId))
    setLatestReportLoaded(true)
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
    if (profile) void loadZenGenerationHealth()
  }, [profile, loadZenGenerationHealth])

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

  /** Lifecycle-only statuses (no plan selection needed). */
  const handleSetLifecycleStatus = async (newStatus: 'contacted' | 'dropped' | 'stopped_pro') => {
    if (!clientId) return
    setSavingStatus(true)
    const { error } = await supabase.rpc('set_client_status', {
      p_client_id: clientId,
      p_status: newStatus,
    })
    if (error) {
      toast.error(error.message)
    } else {
      const isPaid = false
      setProfile(p => (p ? { ...p, client_status: newStatus, is_paid_customer: isPaid } : p))
      const labels: Record<string, string> = {
        stopped_pro: 'Paid access revoked — existing plan content is preserved',
        contacted: 'Client marked as contacted',
        dropped: 'Client marked as dropped',
      }
      toast.success(labels[newStatus] ?? 'Status updated')
      void loadOverrides()
    }
    setSavingStatus(false)
    closeMarkAsDialog()
  }

  /** Cash payment: call RPC then auto-generate if semi-guided. */
  const handleMarkPaidCash = async (plan: PaidPlan) => {
    if (!clientId) return
    setSavingStatus(true)
    const { error } = await supabase.rpc('set_client_paid', {
      p_client_id: clientId,
      p_plan: plan,
    })
    if (error) {
      toast.error(error.message)
      setSavingStatus(false)
      return
    }
    setProfile(p => p ? { ...p, client_status: 'pro', is_paid_customer: true, current_plan: plan } : p)

    if (plan === '18_week_semi_guided') {
      const assessmentIdForPlan = await fetchLatestAssessmentIdNeedingPlan()
      if (assessmentIdForPlan) {
        flushSync(() => setGenerationWait('plan'))
        try {
          const planResult = await invokeZenFunction('generate-zen-plan', assessmentIdForPlan, { force: false })
          if (!planResult.ok) {
            toast.error(`Plan generation failed: ${planResult.message ?? ''}`)
          } else {
            toast.success('18-week plan generated automatically')
            void loadZenGenerationHealth()
          }
        } catch (planErr) {
          console.error('[auto plan generation on cash paid]', planErr)
          toast.error('Plan generation failed unexpectedly')
        } finally {
          setGenerationWait(null)
        }
      }
    }

    toast.success(plan === '18_week_semi_guided' ? 'Client marked as paid (18-week semi-guided)' : 'Client marked as paid (1-on-1 intensive)')
    void loadOverrides()
    setSavingStatus(false)
    closeMarkAsDialog()
  }

  /** Razorpay payment on behalf of the client (therapist-initiated checkout). */
  const handleMarkPaidRazorpay = async (plan: PaidPlan) => {
    if (!clientId || !profile) return
    setSavingStatus(true)
    setRazorpayStatus('Creating payment order…')

    const clientName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.name || ''
    const clientEmail = profile.email

    const result = await startRazorpayCheckout(
      plan,
      clientName,
      clientEmail,
      msg => setRazorpayStatus(msg),
      clientId
    )

    setRazorpayStatus(null)
    setSavingStatus(false)

    if (!result.ok) {
      if (result.error !== 'Payment cancelled') toast.error(result.error)
      return
    }

    setProfile(p => p ? { ...p, client_status: 'pro', is_paid_customer: true, current_plan: plan } : p)
    toast.success('Payment successful! Plan activated.')

    if (plan === '18_week_semi_guided') {
      const assessmentIdForPlan = await fetchLatestAssessmentIdNeedingPlan()
      if (assessmentIdForPlan) {
        flushSync(() => setGenerationWait('plan'))
        try {
          const planResult = await invokeZenFunction('generate-zen-plan', assessmentIdForPlan, { force: false })
          if (!planResult.ok) {
            toast.error(`Plan generation failed: ${planResult.message ?? ''}`)
          } else {
            toast.success('18-week plan generated')
            void loadZenGenerationHealth()
          }
        } catch {
          toast.error('Plan generation failed unexpectedly')
        } finally {
          setGenerationWait(null)
        }
      }
    }

    void loadOverrides()
    closeMarkAsDialog()
  }

  const openMarkAsDialog = () => {
    setMarkAsStep('main')
    setMarkAsPlan(null)
    setMarkAsOpen(true)
  }

  const closeMarkAsDialog = () => {
    setMarkAsOpen(false)
    setMarkAsStep('main')
    setMarkAsPlan(null)
  }

  const effectiveStatus: ClientStatusLabel = computeClientStatus({
    clientStatus: profile?.client_status,
    isPaidCustomer: profile?.is_paid_customer,
    hasCompletedSelfAssessment,
  })

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

  const statusMeta = CLIENT_STATUS_META[effectiveStatus]

  return (
    <div className="space-y-6">
      <ReportGenerationWaitOverlay open={generationWait !== null} variant={generationWait ?? 'plan'} />
      <div className="flex flex-wrap items-center gap-3" style={pageStaggerItemStyle(0, staggerVisible)}>
        <Button asChild variant="zenOutline" size="sm">
          <Link to="/app/therapist/clients">← Clients</Link>
        </Button>
      </div>

      <Card className={glassProfile} style={pageStaggerItemStyle(1, staggerVisible)}>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xl font-semibold text-foreground sm:text-2xl">{primaryLabel}</p>
            <Badge variant="outline" className={cn('capitalize', statusMeta.badgeClass)}>
              {statusMeta.label}
            </Badge>
          </div>
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
            <span className="text-muted-foreground">Company</span> ·{' '}
            {profile.company_not_listed
              ? 'Not listed'
              : profile.company?.trim() || '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-muted-foreground">Department</span> ·{' '}
            {profile.company_not_listed
              ? 'Not listed'
              : profile.company_department_name?.trim() || '—'}
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
            <CardDescription className="text-muted-foreground">
              {latestReportLoaded
                ? hasLatestReport
                  ? 'Zen Plan reports & assessment answers'
                  : 'This client has not taken an assessment yet.'
                : 'Checking assessment status…'}
            </CardDescription>
          </CardHeader>
          {latestReportLoaded && hasLatestReport ? (
            <CardContent className="mt-auto pt-0">
              <Button asChild variant="zen" className="w-full sm:w-auto">
                <Link to={`/app/therapist/clients/${clientId}/reports`}>Open reports</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
        <Card className={cn(glassPlan, 'h-full')} style={pageStaggerItemStyle(3, staggerVisible)}>
          <CardHeader className="flex-1">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CalendarDays className="size-4 text-sky-300" aria-hidden />
              Personalized Plan
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {latestReportLoaded
                ? hasLatestReport
                  ? zenGenerationHealth?.issues.length
                    ? zenGenerationHealth.issues.join(' · ')
                    : planTargetNeedsGeneration
                      ? 'This client has a report but no 18-week plan has been generated yet.'
                      : 'Plan progress and daily activities'
                  : 'This client does not have a personalized plan yet.'
                : 'Checking assessment status…'}
            </CardDescription>
          </CardHeader>
          {latestReportLoaded && hasLatestReport ? (
            <CardContent className="mt-auto flex flex-col gap-2 pt-0 sm:flex-row sm:flex-wrap">
              <Button asChild variant="zenOutline" className="w-full sm:w-auto">
                <Link to={`/app/therapist/clients/${clientId}/plan`}>Open plan</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>

      {/* 1-on-1 Intensive Guided — activity selection workflow */}
      {profile?.current_plan === 'one_on_one_intensive' ? (
        planTarget && !planTarget.hasPlan ? (
          <Card className={cn(glassControls, 'shadow-none')} style={pageStaggerItemStyle(4, staggerVisible)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CalendarDays className="size-4 text-violet-300" aria-hidden />
                1-on-1 Intensive — Activity selection
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Select one activity for each of the 18 weeks. Once all weeks are filled, generate the personalised plan.
                {planTarget.assessmentMode === 'supervised' && (
                  <span className="ml-1 text-violet-400">(Supervised assessment)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OneOnOneActivitySelector
                clientId={clientId}
                reportId={planTarget.reportId}
                assessmentId={planTarget.assessmentId}
                hasPlan={false}
                onPlanGenerated={() => {
                  void loadZenGenerationHealth()
                  toast.success('1-on-1 plan generated!')
                }}
              />
            </CardContent>
          </Card>
        ) : latestReportLoaded ? (
          <Card className={cn(glassControls, 'shadow-none')} style={pageStaggerItemStyle(4, staggerVisible)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CalendarDays className="size-4 text-violet-300" aria-hidden />
                1-on-1 Intensive — Activity selection
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {planTarget?.hasPlan
                  ? 'Plan generated for the current assessment cycle. Activity selection will reopen after the next supervised assessment report is created.'
                  : 'No report found for this client yet. Generate a supervised assessment report first, then return here to select 18 activities and build the personalised plan.'}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null
      ) : null}

      {showScrapRegenerateCard ? (
        <Card className={glassRegen} style={pageStaggerItemStyle(5, staggerVisible)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <RefreshCw className="size-4 text-sky-300" aria-hidden />
              Regenerate plan &amp; ritual
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Replaces the current 18-week plan and Fourfold Zen ritual with freshly generated content using the
              latest formatting. The wellness report body is kept. This can take 3–4 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              type="button"
              variant="zenOutline"
              disabled={generationWait !== null}
              onClick={() => setScrapConfirmOpen(true)}
            >
              <RefreshCw className="mr-1.5 size-4" aria-hidden />
              Scrap and regenerate
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={scrapConfirmOpen} onOpenChange={setScrapConfirmOpen}>
        <DialogContent className="zen-glass-card max-w-md border-white/15">
          <DialogHeader>
            <DialogTitle className="text-foreground">Regenerate plan and ritual?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will delete the existing 18-week plan and Fourfold Zen ritual for this client and generate new
              ones. The self-assessment report sections will stay as they are. You must stay on this page until
              generation finishes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="zenOutline" onClick={() => setScrapConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="zen" onClick={() => void handleScrapAndRegeneratePlan()}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className={glassNotes} style={pageStaggerItemStyle(5, staggerVisible)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <StickyNote className="size-4 text-sky-300" aria-hidden />
            Notes
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Shared notes for this client. Visible to all therapists; each note shows who added it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <textarea
              value={newNoteBody}
              onChange={e => setNewNoteBody(e.target.value)}
              placeholder="Add a note for other therapists…"
              rows={3}
              maxLength={NOTE_BODY_MAX}
              disabled={savingNote}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-400/50 focus:outline-none focus:ring-1 focus:ring-sky-400/30 disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {newNoteBody.length}/{NOTE_BODY_MAX}
              </p>
              <Button
                type="button"
                size="sm"
                variant="zen"
                disabled={savingNote || !newNoteBody.trim()}
                onClick={() => void handleAddNote()}
              >
                {savingNote ? <Loader2 className="size-3.5 animate-spin" /> : 'Add note'}
              </Button>
            </div>
          </div>

          {notesLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading notes…
            </div>
          ) : notes.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
              No notes yet. Add the first note above.
            </p>
          ) : (
            <ul className="space-y-3">
              {notes.map(note => (
                <li
                  key={note.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">{therapistLabelForNote(note)}</p>
                    <p className="text-xs text-muted-foreground">{formatNoteDate(note.created_at)}</p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="zenOutline"
                    className="shrink-0 self-end sm:self-start"
                    disabled={deletingNoteId === note.id}
                    onClick={() => setNoteToDelete(note)}
                    aria-label="Delete note"
                  >
                    {deletingNoteId === note.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="size-3.5" aria-hidden />
                        <span className="sr-only sm:not-sr-only sm:ml-1.5">Delete</span>
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
              <p className="text-sm font-medium text-foreground">Client status</p>
              <p className="text-xs text-muted-foreground">
                Current status:{' '}
                <Badge variant="outline" className={cn('ml-1 capitalize', statusMeta.badgeClass)}>
                  {statusMeta.label}
                </Badge>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="zen"
                disabled={savingStatus}
                onClick={openMarkAsDialog}
              >
                {savingStatus ? <Loader2 className="size-3.5 animate-spin" /> : 'Mark as'}
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
                    ? 'Until you mark this client as paid, they can start the one-time self assessment from the app. After you mark them as paid, they should use supervised assessments.'
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

      <Dialog
        open={noteToDelete != null}
        onOpenChange={open => {
          if (!open && deletingNoteId == null) setNoteToDelete(null)
        }}
      >
        <DialogContent className="zen-glass-card rounded-2xl border-white/15 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete note?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This note from {noteToDelete ? therapistLabelForNote(noteToDelete) : 'this therapist'} will be
              removed for all therapists. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {noteToDelete ? (
            <p className="line-clamp-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground">
              {noteToDelete.body}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="zenOutline"
              disabled={deletingNoteId != null}
              onClick={() => setNoteToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="zen"
              disabled={deletingNoteId != null}
              onClick={() => void handleConfirmDeleteNote()}
            >
              {deletingNoteId != null ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as dialog — multi-step */}
      <Dialog open={markAsOpen} onOpenChange={open => { if (!open && !savingStatus) closeMarkAsDialog() }}>
        <DialogContent className="zen-glass-card rounded-2xl border-white/15 text-foreground">
          <DialogHeader>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Client status
            </p>
            <DialogTitle className="text-foreground">
              {markAsStep === 'main' && 'Mark as'}
              {markAsStep === 'paid-plan' && 'Select plan'}
              {markAsStep === 'paid-method' && (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm font-normal text-muted-foreground hover:text-foreground"
                    onClick={() => setMarkAsStep('paid-plan')}
                  >
                    <ArrowLeft className="size-3.5" aria-hidden /> Back
                  </button>
                  <span className="ml-1">Payment method</span>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 — main options */}
          {markAsStep === 'main' && (
            <div className="space-y-3 py-1">
              {/* Mark as paid — goes to plan selection */}
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => setMarkAsStep('paid-plan')}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition-all',
                  'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                  effectiveStatus === 'pro'
                    ? 'border-white/25 bg-white/[0.06]'
                    : 'border-white/10 bg-white/[0.03]'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">Mark as paid</span>
                  {effectiveStatus === 'pro' && (
                    <Badge variant="outline" className={cn('shrink-0', CLIENT_STATUS_META.pro.badgeClass)}>
                      Current
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose a plan and payment method (cash or Razorpay).
                </p>
              </button>

              {/* Lifecycle options */}
              {LIFECYCLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={savingStatus}
                  onClick={() => void handleSetLifecycleStatus(opt.value)}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-left transition-all',
                    'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                    effectiveStatus === opt.value
                      ? 'border-white/25 bg-white/[0.06]'
                      : 'border-white/10 bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    {effectiveStatus === opt.value && (
                      <Badge variant="outline" className={cn('shrink-0', opt.badgeClass)}>
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — pick plan */}
          {markAsStep === 'paid-plan' && (
            <div className="space-y-3 py-1">
              {(['18_week_semi_guided', 'one_on_one_intensive'] as const).map(tier => {
                const meta = PLAN_META[tier]
                const isCurrent = profile?.current_plan === tier
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={savingStatus}
                    onClick={() => { setMarkAsPlan(tier); setMarkAsStep('paid-method') }}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-left transition-all',
                      'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                      isCurrent
                        ? 'border-white/25 bg-white/[0.06]'
                        : 'border-white/10 bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{meta.label}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{meta.priceLabel}</span>
                        {isCurrent && (
                          <Badge variant="outline" className={cn(CLIENT_STATUS_META.pro.badgeClass)}>
                            Current
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 3 — pick payment method */}
          {markAsStep === 'paid-method' && markAsPlan && (
            <div className="space-y-3 py-1">
              <p className="text-xs text-muted-foreground">
                Plan: <span className="font-medium text-foreground">{PLAN_META[markAsPlan].label}</span>
                {' · '}{PLAN_META[markAsPlan].priceLabel}
              </p>

              <button
                type="button"
                disabled={savingStatus}
                onClick={() => void handleMarkPaidCash(markAsPlan)}
                className={cn(
                  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all',
                  'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <Wallet className="size-4 shrink-0 text-emerald-300" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">Paid in cash</p>
                    <p className="text-xs text-muted-foreground">Mark as paid immediately — no payment gateway needed.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={savingStatus}
                onClick={() => void handleMarkPaidRazorpay(markAsPlan)}
                className={cn(
                  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all',
                  'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="size-4 shrink-0 text-sky-300" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">Razorpay</p>
                    <p className="text-xs text-muted-foreground">
                      Open payment checkout and record payment against this client's account.
                      {razorpayStatus && <span className="ml-1 text-sky-300">{razorpayStatus}</span>}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          <DialogFooter>
            {savingStatus && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {razorpayStatus ?? 'Saving…'}
              </span>
            )}
            <Button
              type="button"
              variant="zenOutline"
              disabled={savingStatus}
              onClick={closeMarkAsDialog}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
