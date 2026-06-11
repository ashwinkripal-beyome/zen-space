import { useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WHATSAPP_OTP_ENABLED } from '@/lib/featureFlags'
import { useAuth } from '@/hooks/useAuth'

/**
 * Blocking, one-time WhatsApp phone-verification gate for clients. Login stays
 * email + password; this additionally requires every client to prove ownership
 * of their WhatsApp number once. Renders nothing for non-clients or once
 * `profile.phone_verified_at` is set. While unverified it shows a
 * non-dismissible modal — the client cannot reach the app until they verify.
 *
 * Runs before ClientConsentGate (which defers until the phone is verified) so
 * the gates appear one at a time.
 */
export function ClientPhoneVerificationGate() {
  const { profile, phoneVerified, startPhoneVerification, confirmPhoneVerification, refetchProfile } =
    useAuth()
  const [step, setStep] = useState<'enter' | 'verify'>('enter')
  const [phone, setPhone] = useState(profile?.phone_number ?? '')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Only unverified clients are gated. Disabled entirely via feature flag.
  if (!WHATSAPP_OTP_ENABLED || !profile || profile.role !== 'client' || phoneVerified) {
    return null
  }

  const handleSend = async () => {
    if (submitting) return
    if (phone.replace(/[^\d]/g, '').length < 8) {
      toast.error('Enter a valid WhatsApp number with country code.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await startPhoneVerification(phone)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Code sent to your WhatsApp.')
      setStep('verify')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async () => {
    if (submitting) return
    if (code.trim().length < 4) {
      toast.error('Enter the code from WhatsApp.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await confirmPhoneVerification(phone, code)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('WhatsApp number verified.')
      refetchProfile()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogPrimitive.Root open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
        className="zen-glass-card flex flex-col gap-0 overflow-hidden rounded-2xl border-white/15 p-0 text-foreground sm:max-w-md"
      >
        <DialogHeader className="border-b border-white/10 px-6 pt-6 pb-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MessageCircle className="size-3.5" aria-hidden />
            WhatsApp verification
          </p>
          <DialogTitle className="text-xl text-foreground">
            {step === 'enter' ? 'Verify your WhatsApp number' : 'Enter the code'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {step === 'enter' ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                For your security we need to confirm your WhatsApp number once. We&apos;ll send a
                one-time code to this number on WhatsApp.
              </p>
              <div className="space-y-2">
                <Label htmlFor="wa-phone" className="text-foreground">
                  WhatsApp number
                </Label>
                <Input
                  id="wa-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleSend()
                  }}
                  className="border-white/30 bg-white/20 text-foreground placeholder:text-muted-foreground"
                  placeholder="+91 98765 43210"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">Include your country code (e.g. +91).</p>
              </div>
              <Button
                type="button"
                variant="zen"
                className="w-full"
                disabled={submitting}
                onClick={() => void handleSend()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  'Send code on WhatsApp'
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enter the code we sent on WhatsApp to{' '}
                <span className="font-medium text-foreground">{phone}</span>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="wa-code" className="text-foreground">
                  Verification code
                </Label>
                <Input
                  id="wa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleVerify()
                  }}
                  className="border-white/30 bg-white/20 text-center text-lg tracking-[0.4em] text-foreground placeholder:text-muted-foreground"
                  placeholder="123456"
                  maxLength={10}
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="zen"
                className="w-full"
                disabled={submitting}
                onClick={() => void handleVerify()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Verifying…
                  </>
                ) : (
                  'Verify number'
                )}
              </Button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  className="underline hover:text-foreground disabled:opacity-60"
                  disabled={submitting}
                  onClick={() => {
                    setCode('')
                    setStep('enter')
                  }}
                >
                  Change number
                </button>
                <button
                  type="button"
                  className="underline hover:text-foreground disabled:opacity-60"
                  disabled={submitting}
                  onClick={() => void handleSend()}
                >
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </DialogPrimitive.Root>
  )
}
