import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Loader2, Mail, Phone, RefreshCw, StickyNote, Trash2 } from 'lucide-react'
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
import { messageFromFunctionInvokeFailure } from '@/lib/functionInvokeError'
import { supabase } from '@/lib/supabase'
import {
  computeSupervisedAssessmentEligibility,
  therapistSupervisedCooldownLabel,
  type SupervisedEligibility,
} from '@/lib/supervisedAssessmentEligibility'
import { cn } from '@/lib/utils'

const glassReport = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-primary')
const glassPlan = cn('zen-glass-card ring-0 shadow-none', 'zen-ring-secondary')
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
  gender: string | null
  age: number | null
  phone_number: string | null
  dob: string | null
  company: string | null
  company_department_name: string | null
  company_not_listed: boolean
  is_paid_customer: boolean
  client_status: string | null
}

type MarkAsOption = {
  value: 'pro' | 'contacted' | 'dropped'
  label: string
  description: string
  badgeClass: string
}

const MARK_AS_OPTIONS: MarkAsOption[] = [
  {
    value: 'pro',
    label: 'Mark as paid',
    description: 'Mark this client as a paid customer to enable supervised assessments.',
    badgeClass: CLIENT_STATUS_META.pro.badgeClass,
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

export function TherapistClientDetailPage() {
  const { user } = useAuth()
  const { clientId } = useParams<{ clientId: string }>()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [profile, setProfile] = useState<ClientProfileRow | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [markAsOpen, setMarkAsOpen] = useState(false)
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
            'id, email, name, first_name, last_name, gender, age, phone_number, dob, company, company_not_listed, is_paid_customer, client_status, company_department:company_departments(name)'
          )
          .eq('id', clientId)
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

  /** Latest completed self assessment id when its report has no 18-week plan yet. */
  const [selfAssessmentNeedingPlan, setSelfAssessmentNeedingPlan] = useState<string | null>(null)
  const [latestReportLoaded, setLatestReportLoaded] = useState(false)
  const [hasLatestReport, setHasLatestReport] = useState(false)

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
    if (profile) void loadPlanCta()
  }, [profile, loadPlanCta])

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

  const handleSetStatus = async (newStatus: 'pro' | 'contacted' | 'dropped') => {
    if (!clientId) return
    setSavingStatus(true)
    const { error } = await supabase.rpc('set_client_status', {
      p_client_id: clientId,
      p_status: newStatus,
    })
    if (error) {
      toast.error(error.message)
    } else {
      const isPaid = newStatus === 'pro'
      setProfile(p => (p ? { ...p, client_status: newStatus, is_paid_customer: isPaid } : p))
      const labels: Record<string, string> = {
        pro: 'Client marked as paid (Pro)',
        contacted: 'Client marked as contacted',
        dropped: 'Client marked as dropped',
      }
      toast.success(labels[newStatus] ?? 'Status updated')
      void loadOverrides()

      // When marking as paid: auto-generate the 18-week plan if a self-assessment report
      // exists but has no plan yet.
      if (newStatus === 'pro') {
        void (async () => {
          try {
            const { data: selfA } = await supabase
              .from('assessments')
              .select('id')
              .eq('client_id', clientId)
              .eq('assessment_mode', 'self')
              .eq('status', 'completed')
              .order('completed_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (!selfA?.id) return

            const { data: rep } = await supabase
              .from('reports')
              .select('plan_section')
              .eq('assessment_id', selfA.id)
              .maybeSingle()

            // Only proceed if report exists but plan is missing
            if (!rep || ((rep.plan_section as string) ?? '').trim().length > 0) return

            const { data, error: planError, response: planFnResponse } = await supabase.functions.invoke(
              'generate-zen-plan',
              { body: { assessment_id: selfA.id } }
            )
            if (planError) {
              const msg = await messageFromFunctionInvokeFailure(planError, planFnResponse)
              toast.error(`Auto plan generation failed: ${msg}`)
              return
            }
            if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
              toast.error(
                `Auto plan generation failed: ${(data as { error?: string }).error ?? 'Unknown error'}`
              )
              return
            }
            toast.success('18-week plan generated automatically')
            setSelfAssessmentNeedingPlan(null)
            void loadOverrides()
          } catch (planErr) {
            console.error('[auto plan generation on paid]', planErr)
          }
        })()
      }
    }
    setSavingStatus(false)
    setMarkAsOpen(false)
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
                  ? selfAssessmentNeedingPlan
                    ? 'This client has a self-assessment report, but no 18-week plan has been generated yet.'
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

      <Card className={glassNotes} style={pageStaggerItemStyle(4, staggerVisible)}>
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
                onClick={() => setMarkAsOpen(true)}
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

      {/* Mark as dialog — styled like the assessment disclaimer */}
      <Dialog open={markAsOpen} onOpenChange={setMarkAsOpen}>
        <DialogContent
          className="zen-glass-card rounded-2xl border-white/15 text-foreground"
        >
          <DialogHeader>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Client status
            </p>
            <DialogTitle className="text-foreground">Mark as</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {MARK_AS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                disabled={savingStatus}
                onClick={() => void handleSetStatus(opt.value)}
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
                    <Badge variant="outline" className={cn('shrink-0 capitalize', opt.badgeClass)}>
                      Current
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="zenOutline"
              disabled={savingStatus}
              onClick={() => setMarkAsOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
