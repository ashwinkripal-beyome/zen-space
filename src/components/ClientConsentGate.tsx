import { useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { recordClientConsent } from '@/lib/clientConsent'
import { WHATSAPP_OTP_ENABLED } from '@/lib/featureFlags'
import { cn } from '@/lib/utils'

/**
 * Blocking informed-consent gate for clients. Renders nothing once the client
 * has consented (profile.consent_given_at set). While unconsented it shows a
 * non-dismissible modal: the client cannot reach the app until they accept.
 */
export function ClientConsentGate() {
  const { profile, phoneVerified, refetchProfile } = useAuth()
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Only clients are gated; render nothing for other roles or once consented.
  // When WhatsApp verification is enabled, defer until the phone is verified so
  // the gates show one at a time; when it's disabled, don't wait on it.
  if (
    !profile ||
    profile.role !== 'client' ||
    (WHATSAPP_OTP_ENABLED && !phoneVerified) ||
    profile.consent_given_at
  ) {
    return null
  }

  const handleAgree = async () => {
    if (!agreed || submitting) return
    setSubmitting(true)
    try {
      await recordClientConsent()
      refetchProfile()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not record your consent. Please try again.'
      toast.error(message)
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
        className="zen-glass-card flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl border-white/15 p-0 text-foreground sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-white/10 px-6 pt-6 pb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Zen Garden Wellness Assessment
          </p>
          <DialogTitle className="text-xl text-foreground">
            Informed Consent &amp; Participation Agreement
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground">
          <div className="space-y-3">
            <p>Welcome to the Zen Garden experience by Team Zariyaa.</p>
            <p>
              The Zen Garden Wellness Assessment is a holistic wellness and self-reflection
              framework designed to support emotional awareness, mindfulness, stress regulation,
              nervous system balance, personal growth, and overall well-being.
            </p>
            <p>
              The assessment helps facilitators better understand an individual&apos;s current
              emotional, mental, behavioral, and lifestyle patterns in order to provide
              personalized wellness guidance and supportive Zen Garden practices. These may include
              mindfulness exercises, breathwork, meditation, reflective practices, creative
              expression, sound healing, movement-based activities, relaxation techniques, and other
              wellness-oriented experiences.
            </p>
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
              Important Information
            </h3>
            <p>
              The Zen Garden Wellness Assessment is intended for wellness, self-development,
              mindfulness, and preventive well-being purposes. While the framework draws from
              principles related to emotional regulation, mindfulness, nervous system support, and
              holistic wellness, it is not designed to function as a medical, psychiatric, or
              clinical diagnostic tool or as a substitute for individualized healthcare or licensed
              mental health treatment where required.
            </p>
            <p>
              Participation in the assessment and related wellness activities does not establish a
              doctor-patient, therapist-client, or counselling relationship.
            </p>
            <p>
              Individuals experiencing significant emotional distress, ongoing mental health
              concerns, or medical conditions requiring clinical care are encouraged to seek support
              from appropriately qualified healthcare or mental health professionals alongside
              wellness-based practices where appropriate.
            </p>
            <p>Participation in the assessment and related activities is entirely voluntary.</p>
            <p>
              Participants may choose not to answer any question, decline participation in any
              activity, pause participation, or withdraw at any time.
            </p>
            <p>
              Participants are encouraged to engage at their own comfort level and honor their
              personal physical and emotional boundaries throughout the experience.
            </p>
            <p>
              Some questions explore emotionally sensitive areas. If at any point you feel
              overwhelmed, you are encouraged to pause, skip the question, or speak with the
              facilitator.
            </p>
            <p>
              Individual experiences and outcomes may vary based on personal circumstances,
              participation, openness, and readiness for growth.
            </p>
            <p>
              The recommendations and wellness plans provided are supportive in nature and intended
              to guide overall well-being and self-awareness.
            </p>
            <p>
              Participants are requested to inform facilitators of any relevant medical, physical,
              developmental, neurological, or psychological conditions that may affect
              participation.
            </p>
            <p>
              For participants below 18 years of age, consent must be provided by a parent,
              guardian, school authority, or authorized representative.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
              Confidentiality &amp; Privacy
            </h3>
            <p>
              We value and respect participant privacy. Personal information shared during the
              assessment or sessions will be handled with reasonable care and confidentiality and
              used only for purposes related to wellness support, personalized reporting, program
              facilitation, participant care, and internal service improvement.
            </p>
            <p>
              Zariyaa Happy Wellbeing Pvt Ltd, its facilitators, and representatives shall not be
              held liable for any physical, emotional, or psychological outcomes arising from
              voluntary participation in the Assessment and wellness activities, to the extent
              permitted by applicable law.
            </p>
            <p>
              Information shared during this assessment will not be intentionally disclosed without
              consent except where required by law, safeguarding obligations apply, or there is risk
              of harm to self or others. Participants are encouraged to mindfully support a safe,
              private, and trusting space for everyone involved.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
              Consent &amp; Acknowledgement
            </h3>
            <p>By agreeing below, I confirm that:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                I understand the nature and purpose of the Zen Garden Wellness Assessment and related
                wellness activities.
              </li>
              <li>I have had the opportunity to ask questions where needed.</li>
              <li>
                I have carefully read, understood, and voluntarily agreed to all the terms,
                conditions, clauses, and participation guidelines mentioned above.
              </li>
              <li>I agree to the terms and conditions mentioned above.</li>
            </ul>
          </section>
        </div>

        <div className="space-y-4 border-t border-white/10 px-6 py-5">
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            onClick={() => setAgreed(v => !v)}
            disabled={submitting}
            className="flex w-full items-start gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(167_139_250/0.45)] disabled:opacity-60"
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                agreed
                  ? 'border-violet-400 bg-violet-500/80 text-white'
                  : 'border-white/30 bg-transparent'
              )}
              aria-hidden
            >
              {agreed ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="text-sm font-medium text-foreground">
              I Agree to all the Terms &amp; Conditions Above
            </span>
          </button>

          <Button
            type="button"
            variant="zen"
            className="w-full"
            disabled={!agreed || submitting}
            onClick={() => void handleAgree()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Agree & Continue'
            )}
          </Button>
        </div>
      </DialogContent>
    </DialogPrimitive.Root>
  )
}
