import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { toast } from 'sonner'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SESSION_CLIENT_OTP_VERIFIED_KEY } from '@/lib/clientOtpSession'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'

const GROUP_ERROR = 'Invalid/expired/full code'

const glassCard =
  'zen-glass-card ring-0 shadow-[0_0_0_1px_var(--zen-ring-primary),0_8px_32px_rgba(0,0,0,0.2)]'

const otpInputClass =
  'zen-otp-cell h-12 w-10 sm:w-12 rounded-xl text-center text-lg font-semibold tabular-nums placeholder:text-muted-foreground'

type DepartmentOption = { id: string; name: string }

function parseJoinSessionResult(data: unknown): { sessionName: string; slotsRemaining: number } | null {
  const row = Array.isArray(data) && data.length > 0 ? data[0] : data
  if (row === true) {
    return { sessionName: 'your session', slotsRemaining: 0 }
  }
  if (typeof row !== 'object' || row === null) {
    return null
  }
  const o = row as Record<string, unknown>
  if (o.ok === false || o.success === false || o.joined === false) {
    return null
  }

  const name =
    (typeof o.session_name === 'string' && o.session_name.trim()) ||
    (typeof o.name === 'string' && o.name.trim()) ||
    null

  let slots: number | undefined
  if (typeof o.slots_remaining === 'number' && Number.isFinite(o.slots_remaining)) {
    slots = Math.max(0, Math.floor(o.slots_remaining))
  } else if (typeof o.spots_remaining === 'number' && Number.isFinite(o.spots_remaining)) {
    slots = Math.max(0, Math.floor(o.spots_remaining))
  } else if (typeof o.remaining_slots === 'number' && Number.isFinite(o.remaining_slots)) {
    slots = Math.max(0, Math.floor(o.remaining_slots))
  } else if (
    typeof o.max_clients === 'number' &&
    typeof o.clients_used === 'number' &&
    Number.isFinite(o.max_clients) &&
    Number.isFinite(o.clients_used)
  ) {
    slots = Math.max(0, Math.floor(o.max_clients - o.clients_used))
  }

  const explicitSuccess = o.success === true || o.joined === true || o.ok === true
  if (name != null && slots !== undefined) {
    return { sessionName: name, slotsRemaining: slots }
  }
  if (explicitSuccess && name != null) {
    return { sessionName: name, slotsRemaining: slots ?? 0 }
  }
  if (explicitSuccess && slots !== undefined) {
    return { sessionName: 'Group session', slotsRemaining: slots }
  }
  return null
}

function parseJoinRpcPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    return data[0] as Record<string, unknown>
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return null
}

export function ClientOtpScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refetchHasTherapists } = useClientOnboarding()
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: 6 }, () => ''))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shouldShake, setShouldShake] = useState(false)
  const [needsDepartment, setNeedsDepartment] = useState(false)
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const staggerVisible = usePageStaggerVisible(true)

  useEffect(() => {
    if (!shouldShake) return
    const t = window.setTimeout(() => setShouldShake(false), 480)
    return () => window.clearTimeout(t)
  }, [shouldShake])

  const focusIndex = useCallback((i: number) => {
    const el = inputsRef.current[i]
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  useEffect(() => {
    focusIndex(0)
  }, [focusIndex])

  useEffect(() => {
    setNeedsDepartment(false)
    setDepartmentOptions([])
    setSelectedDepartmentId(null)
  }, [digits.join('')])

  const handleChange = (index: number, raw: string) => {
    const d = raw.replace(/\D/g, '').slice(-1)
    setErrorMessage(null)
    setDigits(prev => {
      const next = [...prev]
      next[index] = d
      return next
    })
    if (d && index < 5) {
      window.requestAnimationFrame(() => focusIndex(index + 1))
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        setDigits(prev => {
          const next = [...prev]
          next[index] = ''
          return next
        })
      } else if (index > 0) {
        focusIndex(index - 1)
        setDigits(prev => {
          const next = [...prev]
          next[index - 1] = ''
          return next
        })
      }
      e.preventDefault()
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      focusIndex(index - 1)
      e.preventDefault()
    }
    if (e.key === 'ArrowRight' && index < 5) {
      focusIndex(index + 1)
      e.preventDefault()
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    setErrorMessage(null)
    const next = Array.from({ length: 6 }, (_, i) => text[i] ?? '')
    setDigits(next)
    const last = Math.min(text.length, 6) - 1
    if (last >= 0) focusIndex(last)
  }

  const triggerError = () => {
    setErrorMessage(GROUP_ERROR)
    setShouldShake(true)
  }

  const mapRpcError = (err: string | undefined) => {
    if (err === 'full') return 'This code is full. Ask your therapist for a new code.'
    if (err === 'expired') return 'This code has expired. Ask your therapist for a new code.'
    if (err === 'invalid_code') return GROUP_ERROR
    if (err === 'invalid_department' || err === 'unexpected_department') {
      return 'Could not use that department. Try again or contact your therapist.'
    }
    return GROUP_ERROR
  }

  const completeJoinFromPayload = async (data: unknown) => {
    const parsed = parseJoinSessionResult(data)
    if (!parsed) {
      triggerError()
      return
    }
    setNeedsDepartment(false)
    setDepartmentOptions([])
    setSelectedDepartmentId(null)
    try {
      sessionStorage.setItem(SESSION_CLIENT_OTP_VERIFIED_KEY, '1')
    } catch {
      /* ignore quota / private mode */
    }
    await refetchHasTherapists()
    toast.success(`Linked to ${parsed.sessionName}! ${parsed.slotsRemaining} spots left`)
    navigate('/app/client/therapists', { replace: true })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6 || !user?.id) return
    if (needsDepartment && !selectedDepartmentId) {
      setErrorMessage('Select your department.')
      return
    }
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase.rpc('join_therapist_session', {
        otp_code_param: code,
        p_company_department_id: needsDepartment && selectedDepartmentId ? selectedDepartmentId : null,
      })
      console.log('[join_therapist_session]', { data, error })
      if (error) {
        triggerError()
        return
      }
      const o = parseJoinRpcPayload(data)
      if (o == null) {
        triggerError()
        return
      }
      if (o.error === 'department_required' && o.success === false) {
        const raw = o.departments
        const opts: DepartmentOption[] = []
        if (Array.isArray(raw)) {
          for (const d of raw) {
            if (d != null && typeof d === 'object' && 'id' in d && 'name' in d) {
              const id = (d as { id: unknown }).id
              const name = (d as { name: unknown }).name
              if (typeof id === 'string' && typeof name === 'string') opts.push({ id, name })
            }
          }
        }
        if (opts.length === 0) {
          setErrorMessage('This company has no departments yet. Ask your therapist to set them up.')
        } else {
          setDepartmentOptions(opts)
          setNeedsDepartment(true)
        }
        return
      }
      if (o.success === false) {
        setErrorMessage(mapRpcError(typeof o.error === 'string' ? o.error : undefined))
        setShouldShake(true)
        return
      }
      await completeJoinFromPayload(data)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = () => {
    setDigits(Array.from({ length: 6 }, () => ''))
    setErrorMessage(null)
    setNeedsDepartment(false)
    setDepartmentOptions([])
    setSelectedDepartmentId(null)
    focusIndex(0)
  }

  const codeComplete = digits.every(d => d.length === 1)

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div
        className={cn('w-full max-w-md', shouldShake && 'animate-shake')}
        style={pageStaggerItemStyle(0, staggerVisible)}
      >
          <Card className={glassCard}>
            <CardHeader className="text-center space-y-1 pb-2">
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                Connect with your therapist
              </CardTitle>
              <CardDescription className="text-muted-foreground text-base">
                Enter the 6-digit code from your therapist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                  {digits.map((digit, i) => (
                    <Input
                      key={i}
                      ref={el => {
                        inputsRef.current[i] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      aria-label={`Digit ${i + 1} of 6`}
                      className={otpInputClass}
                      onChange={e => handleChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      onFocus={e => e.target.select()}
                    />
                  ))}
                </div>

                {errorMessage && (
                  <Alert
                    variant="destructive"
                    className="border-red-400/35 bg-red-950/40 text-red-50 backdrop-blur-md"
                  >
                    <CircleAlert className="size-4" aria-hidden />
                    <AlertTitle className="text-red-50">{errorMessage}</AlertTitle>
                  </Alert>
                )}

                {needsDepartment && departmentOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-foreground">Your department</Label>
                    <Select
                      value={selectedDepartmentId ?? undefined}
                      onValueChange={v => {
                        setSelectedDepartmentId(v)
                        setErrorMessage(null)
                      }}
                    >
                      <SelectTrigger className="w-full border-white/30 bg-white/10">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  disabled={!codeComplete || submitting}
                  variant="zen"
                  className="w-full"
                >
                  {submitting ? 'Joining…' : 'Link therapist'}
                </Button>
              </form>

              <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  onClick={handleClear}
                >
                  <RefreshCw className="size-4 opacity-80" aria-hidden />
                  Clear code
                </Button>
                <p className="text-center text-xs text-muted-foreground max-w-xs">
                  Codes expire when the session ends or fills up. Ask your therapist for a new code if needed.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  )
}
