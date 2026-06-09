/** Plan tier identifiers, labels, and display metadata. */
export type PlanTier = 'free' | '18_week_semi_guided' | 'one_on_one_intensive'

export type PlanMeta = {
  id: PlanTier
  label: string
  tagline: string
  description: string
  features: string[]
  priceLabel: string
  /** Whether a Razorpay checkout is required (free plan has no checkout). */
  requiresPayment: boolean
}

export const PLAN_META: Record<PlanTier, PlanMeta> = {
  free: {
    id: 'free',
    label: 'Free',
    tagline: 'Begin your wellness journey',
    description: 'First self-assessment report.',
    features: [
      'Zen wellness self-assessment',
      'Personal wellness report',
    ],
    priceLabel: '₹0',
    requiresPayment: false,
  },
  '18_week_semi_guided': {
    id: '18_week_semi_guided',
    label: '18-week semi-guided',
    tagline: 'Your personalised healing path',
    description: 'Full Fourfold Zen Ritual + 18-week personalised Zen Garden activity plan, generated automatically.',
    features: [
      'Personalised wellness report',
      'Full Fourfold Zen Ritual (all four steps)',
      'Personalised 18-week Zen Garden activity plan',
      'Supervised follow-up assessments',
      'PDF download of your complete plan',
    ],
    priceLabel: '₹2,299',
    requiresPayment: true,
  },
  one_on_one_intensive: {
    id: 'one_on_one_intensive',
    label: '1-on-1 intensive guided',
    tagline: 'Deep, personalised transformation',
    description: 'Your therapist hand-picks every weekly activity from the Zen Garden dataset, tailored specifically to you.',
    features: [
      'Everything in 18-week semi-guided',
      'Therapist individually selects each weekly activity',
      'Deeply personalised plan crafted for your unique profile',
    ],
    priceLabel: '₹2,999',
    requiresPayment: true,
  },
}

export const PAID_TIERS: PlanTier[] = ['18_week_semi_guided', 'one_on_one_intensive']

/** Returns true if the given plan string maps to a paid tier. */
export function isPaidTier(plan: string | null | undefined): boolean {
  return PAID_TIERS.includes(plan as PlanTier)
}
