import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { Building2, Copy, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export const DEFAULT_MAX_CLIENTS = 200

export const THERAPIST_GENERATE_OTP_TRIGGER_BUTTON_CLASSNAME = cn(
  'w-full shrink-0 gap-2 bg-gradient-to-r from-[#5198ca] via-[#3398ca] to-[#337cca] text-foreground shadow-lg shadow-violet-900/30 sm:w-auto'
)

export type ActiveOtpSession = {
  localId: string
  serverId: string
  name: string
  otp: string
  expiresAt: number
  clientsUsed: number
  maxClients: number
  linkKind?: 'individual' | 'corporate'
  companyName?: string | null
}

type CreatedModalPayload = {
  serverId: string
  otp: string
  expiresAt: number
  clientsUsed: number
  maxClients: number
  sessionName: string
  linkKind?: 'individual' | 'corporate'
  companyLabel?: string | null
}

type CompanyRow = {
  id: string
  name: string
  created_by: string | null
}

function parseOtpFromRpc(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') {
    const digits = data.replace(/\D/g, '').slice(0, 12)
    return digits.length >= 6 ? digits : null
  }
  if (Array.isArray(data) && data.length > 0) {
    return parseOtpFromRpc(data[0])
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>
    for (const key of ['otp', 'code', 'otp_code', 'session_otp', 'join_code']) {
      const v = o[key]
      if (typeof v === 'string') {
        const digits = v.replace(/\D/g, '').slice(0, 12)
        if (digits.length >= 6) return digits
      }
      if (typeof v === 'number' && v >= 0) {
        const s = String(Math.floor(v)).padStart(6, '0').slice(-12)
        if (s.length >= 6) return s
      }
    }
  }
  return null
}

function parseExpiresAtMs(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return Math.floor(value)
    if (value > 1e9) return Math.floor(value * 1000)
    return null
  }
  if (typeof value === 'string') {
    const t = Date.parse(value)
    if (!Number.isNaN(t)) return t
  }
  return null
}

function parseCreateResponse(
  data: unknown,
  fallbackMax: number
): Omit<ActiveOtpSession, 'localId' | 'name'> & { sessionName: string } | null {
  const row = Array.isArray(data) && data.length > 0 ? data[0] : data
  if (typeof row !== 'object' || row === null) return null
  const o = row as Record<string, unknown>

  const otp = parseOtpFromRpc(row)
  if (!otp) return null

  let expiresAt =
    parseExpiresAtMs(o.expires_at) ??
    parseExpiresAtMs(o.expiresAt) ??
    parseExpiresAtMs(o.expiry) ??
    parseExpiresAtMs(o.session_expires_at)
  if (expiresAt == null) {
    expiresAt = Date.now() + 60 * 60 * 1000
  }

  let serverId: string = crypto.randomUUID()
  if (typeof o.session_id === 'string' && o.session_id) serverId = o.session_id
  else if (typeof o.id === 'string' && o.id) serverId = o.id

  let clientsUsed = 0
  if (typeof o.clients_used === 'number' && o.clients_used >= 0) clientsUsed = Math.floor(o.clients_used)
  else if (typeof o.used_count === 'number' && o.used_count >= 0) clientsUsed = Math.floor(o.used_count)

  let maxClients = fallbackMax
  if (typeof o.max_clients === 'number' && o.max_clients > 0) maxClients = Math.floor(o.max_clients)

  const sessionName =
    typeof o.session_name === 'string' && o.session_name.trim() ? o.session_name.trim() : 'Assessment'

  return { serverId, otp, expiresAt, clientsUsed, maxClients, sessionName }
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const dialogGlass = cn(
  'zen-glass-card ring-0 shadow-none zen-ring-primary backdrop-blur-lg',
  '[&_[data-slot=dialog-close]]:text-muted-foreground [&_[data-slot=dialog-close]]:hover:bg-white/10'
)

export function useTherapistOtpSessionDialog(options: {
  activeOtpSessions: ActiveOtpSession[]
  onAfterCreate?: () => void | Promise<void>
}) {
  const { user, profile } = useAuth()
  const { activeOtpSessions, onAfterCreate } = options
  const [createOpen, setCreateOpen] = useState(false)
  const [linkKind, setLinkKind] = useState<'individual' | 'corporate'>('individual')
  const [maxClientsInput, setMaxClientsInput] = useState(String(DEFAULT_MAX_CLIENTS))
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [companyEditId, setCompanyEditId] = useState<string | null>(null)
  const [companyNameDraft, setCompanyNameDraft] = useState('')
  const [departmentRows, setDepartmentRows] = useState<string[]>([''])
  const [savingCompany, setSavingCompany] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createdInModal, setCreatedInModal] = useState<CreatedModalPayload | null>(null)
  const [modalNow, setModalNow] = useState(() => Date.now())
  const createdModalRef = useRef<CreatedModalPayload | null>(null)
  createdModalRef.current = createdInModal

  useEffect(() => {
    if (!createOpen || !createdInModal) return
    const id = window.setInterval(() => setModalNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [createOpen, createdInModal])

  useEffect(() => {
    const prev = createdModalRef.current
    if (!prev?.serverId) return
    const row = activeOtpSessions.find(s => s.serverId === prev.serverId)
    if (!row) return
    setCreatedInModal(pm => {
      if (!pm || pm.serverId !== row.serverId) return pm
      if (pm.clientsUsed === row.clientsUsed && pm.maxClients === row.maxClients) return pm
      return { ...pm, clientsUsed: row.clientsUsed, maxClients: row.maxClients }
    })
  }, [activeOtpSessions])

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, created_by')
        .order('name', { ascending: true })
      if (error) {
        console.error('[companies]', error)
        toast.error('Could not load companies.')
        return
      }
      setCompanies((data ?? []) as CompanyRow[])
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  useEffect(() => {
    if (!createOpen) return
    void loadCompanies()
  }, [createOpen, loadCompanies])

  const resetModal = useCallback(() => {
    setMaxClientsInput(String(DEFAULT_MAX_CLIENTS))
    setLinkKind('individual')
    setCompanyId(null)
    setCreatedInModal(null)
    setCreating(false)
    setCompanyDialogOpen(false)
    setCompanyEditId(null)
    setCompanyNameDraft('')
    setDepartmentRows([''])
  }, [])

  const openAddCompany = () => {
    setCompanyEditId(null)
    setCompanyNameDraft('')
    setDepartmentRows(['', ''])
    setCompanyDialogOpen(true)
  }

  const openEditCompany = async () => {
    if (!companyId) return
    setCompanyEditId(companyId)
    const c = companies.find(x => x.id === companyId)
    setCompanyNameDraft(c?.name ?? '')
    setSavingCompany(true)
    try {
      const { data, error } = await supabase
        .from('company_departments')
        .select('name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) {
        toast.error('Could not load departments.')
        return
      }
      const names = (data ?? []).map(r => (typeof r.name === 'string' ? r.name : ''))
      setDepartmentRows(names.length > 0 ? names : [''])
      setCompanyDialogOpen(true)
    } finally {
      setSavingCompany(false)
    }
  }

  const saveCompany = async () => {
    const trimmedName = companyNameDraft.trim()
    const depts = departmentRows.map(d => d.trim()).filter(d => d.length > 0)
    if (!trimmedName) {
      toast.error('Enter a company name.')
      return
    }
    if (depts.length < 1) {
      toast.error('Add at least one department.')
      return
    }
    setSavingCompany(true)
    try {
      const { data, error } = await supabase.rpc('upsert_company_with_departments', {
        p_name: trimmedName,
        p_department_names: depts,
        p_company_id: companyEditId,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      const row = data as { company_id?: string } | null
      const newId = typeof row?.company_id === 'string' ? row.company_id : companyEditId
      await loadCompanies()
      if (newId) setCompanyId(newId)
      setCompanyDialogOpen(false)
      toast.success(companyEditId ? 'Company updated.' : 'Company created.')
    } finally {
      setSavingCompany(false)
    }
  }

  const canEditSelectedCompany =
    companyId != null &&
    (profile?.role === 'admin' || companies.find(c => c.id === companyId)?.created_by === user?.id)

  const openGenerateDialog = useCallback(() => {
    resetModal()
    setCreateOpen(true)
  }, [resetModal])

  const openExistingSessionInDialog = useCallback((session: ActiveOtpSession) => {
    setCreatedInModal({
      serverId: session.serverId,
      otp: session.otp,
      expiresAt: session.expiresAt,
      clientsUsed: session.clientsUsed,
      maxClients: session.maxClients,
      sessionName: session.name,
      linkKind: session.linkKind,
      companyLabel: session.companyName ?? null,
    })
    setCreateOpen(true)
  }, [])

  const handleCreate = async () => {
    if (!user?.id) {
      toast.error('You must be signed in.')
      return
    }
    if (linkKind === 'corporate' && !companyId) {
      toast.error('Select a company, or add a new one.')
      return
    }
    const parsed = Number.parseInt(maxClientsInput, 10)
    const maxClients = Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : DEFAULT_MAX_CLIENTS

    const corpLabel = companies.find(c => c.id === companyId)?.name ?? null
    setCreating(true)
    try {
      const { data, error } = await supabase.rpc('create_therapist_otp_session', {
        therapist_id: user.id,
        max_clients: maxClients,
        session_name: 'Assessment',
        p_link_kind: linkKind,
        p_company_id: linkKind === 'corporate' && companyId ? companyId : null,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      const parsedRes = parseCreateResponse(data, maxClients)
      if (!parsedRes) {
        toast.error('Could not read session from server.')
        return
      }
      setCreatedInModal({
        serverId: parsedRes.serverId,
        otp: parsedRes.otp,
        expiresAt: parsedRes.expiresAt,
        clientsUsed: parsedRes.clientsUsed,
        maxClients: parsedRes.maxClients,
        sessionName: parsedRes.sessionName,
        linkKind,
        companyLabel: linkKind === 'corporate' ? corpLabel : null,
      })
      await onAfterCreate?.()
      toast.success('Share this code with clients for the assessment.')
    } finally {
      setCreating(false)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied.')
    } catch {
      toast.error('Could not copy.')
    }
  }

  const modalCountdownSec =
    createdInModal != null ? Math.max(0, Math.ceil((createdInModal.expiresAt - modalNow) / 1000)) : 0

  const linkToggleClass = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors',
      active
        ? 'border-sky-400/50 bg-sky-500/20 text-foreground'
        : 'border-white/20 bg-white/5 text-muted-foreground hover:bg-white/10'
    )

  const therapistOtpSessionDialog = (
    <>
      <Dialog
        open={companyDialogOpen}
        onOpenChange={o => {
          setCompanyDialogOpen(o)
          if (!o) {
            setCompanyEditId(null)
            setCompanyNameDraft('')
            setDepartmentRows([''])
          }
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            dialogGlass,
            'app-content-scroll max-h-[min(88vh,720px)] overflow-y-auto sm:max-w-md'
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {companyEditId ? 'Edit company' : 'Add company'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Department names for this company. Clients pick their department when they use a corporate
              code.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="company-name-draft" className="text-foreground">
                Company name
              </Label>
              <Input
                id="company-name-draft"
                value={companyNameDraft}
                onChange={e => setCompanyNameDraft(e.target.value)}
                className="border-white/30 bg-white/15 text-foreground"
                placeholder="e.g. Acme Corporation"
                disabled={savingCompany}
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Departments</span>
                <Button
                  type="button"
                  size="sm"
                  variant="zenOutline"
                  className="h-8 gap-1"
                  onClick={() => setDepartmentRows(prev => [...prev, ''])}
                  disabled={savingCompany}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add row
                </Button>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {departmentRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={row}
                      onChange={e => {
                        const v = e.target.value
                        setDepartmentRows(prev => {
                          const next = [...prev]
                          next[i] = v
                          return next
                        })
                      }}
                      className="border-white/30 bg-white/15 text-foreground"
                      placeholder={`Department ${i + 1}`}
                      disabled={savingCompany}
                    />
                    {departmentRows.length > 1 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Remove row"
                        onClick={() =>
                          setDepartmentRows(prev => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))
                        }
                        disabled={savingCompany}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="zenOutline"
              onClick={() => setCompanyDialogOpen(false)}
              disabled={savingCompany}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-1"
              onClick={() => void saveCompany()}
              disabled={savingCompany}
            >
              {savingCompany ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={open => {
          setCreateOpen(open)
          if (!open) resetModal()
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            dialogGlass,
            'app-content-scroll max-h-[min(92vh,920px)] overflow-y-auto sm:max-w-lg'
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">
              {createdInModal ? 'Assessment code' : 'Generate OTP'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Set max participants and generate a code, or open an active code to share the QR and digits.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {!createdInModal ? (
              <>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Link type</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={linkToggleClass(linkKind === 'individual')}
                      onClick={() => {
                        setLinkKind('individual')
                        setCompanyId(null)
                      }}
                      disabled={creating}
                    >
                      <Users className="size-4" aria-hidden />
                      Individual
                    </button>
                    <button
                      type="button"
                      className={linkToggleClass(linkKind === 'corporate')}
                      onClick={() => setLinkKind('corporate')}
                      disabled={creating}
                    >
                      <Building2 className="size-4" aria-hidden />
                      Company
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="therapist-max-clients-otp" className="text-foreground">
                    Max participants (1–500)
                  </Label>
                  <Input
                    id="therapist-max-clients-otp"
                    type="number"
                    min={1}
                    max={500}
                    value={maxClientsInput}
                    onChange={e => setMaxClientsInput(e.target.value)}
                    className="border-white/30 bg-white/15 text-foreground"
                    disabled={creating}
                  />
                </div>
                {linkKind === 'corporate' ? (
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label className="text-foreground">Company</Label>
                        <Select
                          value={companyId ?? undefined}
                          onValueChange={v => setCompanyId(v)}
                          disabled={creating || loadingCompanies}
                        >
                          <SelectTrigger className="w-full border-white/30 bg-white/15">
                            <SelectValue placeholder={loadingCompanies ? 'Loading…' : 'Select a company'} />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="zenOutline"
                          size="default"
                          className="gap-1"
                          onClick={openAddCompany}
                          disabled={creating}
                        >
                          <Plus className="size-4" aria-hidden />
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="zenOutline"
                          className="gap-1"
                          onClick={() => void openEditCompany()}
                          disabled={creating || !companyId || !canEditSelectedCompany}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set department names in Add/Edit. Clients choose their department when they enter
                      the code.
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  disabled={creating}
                  className="w-full gap-2 bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500/90 py-6 text-base font-semibold text-foreground"
                  onClick={() => void handleCreate()}
                >
                  {creating ? 'Generating…' : 'Generate'}
                </Button>
              </>
            ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm text-foreground/90">{createdInModal.sessionName}</span>
                  {createdInModal.linkKind === 'corporate' && createdInModal.companyLabel ? (
                    <p className="truncate text-xs text-sky-200/90">{createdInModal.companyLabel}</p>
                  ) : null}
                </div>
                <Badge variant="outline" className="border-white/30 bg-white/10 text-foreground">
                  {createdInModal.clientsUsed}/{createdInModal.maxClients} joined
                </Badge>
                {modalCountdownSec > 0 && (
                  <Badge variant="outline" className="border-sky-400/35 bg-sky-500/12 text-sky-100 tabular-nums">
                    {formatCountdown(modalCountdownSec)} left
                  </Badge>
                )}
              </div>
              <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-600/40 to-cyan-500/25 p-8 text-center">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Code</p>
                <p className="font-mono text-6xl font-bold tracking-[0.15em] text-foreground">{createdInModal.otp}</p>
              </div>
              <div className="flex justify-center rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="rounded-xl bg-white p-3 shadow-lg ring-2 ring-white/20">
                  <QRCodeSVG value={createdInModal.otp} size={220} level="M" bgColor="#ffffff" fgColor="#0f172a" />
                </div>
              </div>
              <Button
                type="button"
                variant="zenOutline"
                className="w-full gap-2 py-6"
                onClick={() => void copyCode(createdInModal.otp)}
              >
                <Copy className="size-4" aria-hidden />
                Copy code
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="zenOutline"
            onClick={() => {
              setCreateOpen(false)
              resetModal()
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )

  const generateOtpTriggerButton = (
    <Button
      type="button"
      size="lg"
      className={THERAPIST_GENERATE_OTP_TRIGGER_BUTTON_CLASSNAME}
      onClick={openGenerateDialog}
    >
      <Sparkles className="size-4 opacity-90" aria-hidden />
      Generate OTP
    </Button>
  )

  return {
    therapistOtpSessionDialog,
    generateOtpTriggerButton,
    openGenerateDialog,
    openExistingSessionInDialog,
    copyCode,
  }
}
