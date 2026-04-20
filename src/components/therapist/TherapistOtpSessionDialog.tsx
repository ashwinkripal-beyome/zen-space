import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Sparkles } from 'lucide-react'
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
}

type CreatedModalPayload = {
  serverId: string
  otp: string
  expiresAt: number
  clientsUsed: number
  maxClients: number
  sessionName: string
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
  const { user } = useAuth()
  const { activeOtpSessions, onAfterCreate } = options
  const [createOpen, setCreateOpen] = useState(false)
  const [maxClientsInput, setMaxClientsInput] = useState(String(DEFAULT_MAX_CLIENTS))
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

  const resetModal = useCallback(() => {
    setMaxClientsInput(String(DEFAULT_MAX_CLIENTS))
    setCreatedInModal(null)
    setCreating(false)
  }, [])

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
    })
    setCreateOpen(true)
  }, [])

  const handleCreate = async () => {
    if (!user?.id) {
      toast.error('You must be signed in.')
      return
    }
    const parsed = Number.parseInt(maxClientsInput, 10)
    const maxClients = Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : DEFAULT_MAX_CLIENTS

    setCreating(true)
    try {
      const { data, error } = await supabase.rpc('create_therapist_otp_session', {
        therapist_id: user.id,
        max_clients: maxClients,
        session_name: 'Assessment',
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

  const therapistOtpSessionDialog = (
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
                <span className="text-sm text-foreground/90">{createdInModal.sessionName}</span>
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
