/** Lifecycle labels shown to therapists on the clients list and detail pages. */
export type ClientStatusLabel = 'new_user' | 'lead' | 'pro' | 'contacted' | 'dropped'

export type ClientStatusInputs = {
  /** Therapist-set manual status stored on profiles.client_status */
  clientStatus: string | null | undefined
  /** profiles.is_paid_customer – kept for backward compat */
  isPaidCustomer: boolean | null | undefined
  /** Whether the client has at least one completed self assessment */
  hasCompletedSelfAssessment: boolean
}

/**
 * Derives the single effective label for a client.
 *
 * Manual statuses take priority over derived ones.
 * 'pro' wins if either client_status === 'pro' OR is_paid_customer is true.
 */
export function computeClientStatus({
  clientStatus,
  isPaidCustomer,
  hasCompletedSelfAssessment,
}: ClientStatusInputs): ClientStatusLabel {
  if (clientStatus === 'contacted') return 'contacted'
  if (clientStatus === 'dropped') return 'dropped'
  if (clientStatus === 'pro' || isPaidCustomer === true) return 'pro'
  if (hasCompletedSelfAssessment) return 'lead'
  return 'new_user'
}

export type ClientStatusMeta = {
  label: string
  /** Tailwind classes for the badge */
  badgeClass: string
}

export const CLIENT_STATUS_META: Record<ClientStatusLabel, ClientStatusMeta> = {
  new_user: {
    label: 'New user',
    badgeClass:
      'border-white/20 bg-white/[0.06] text-muted-foreground',
  },
  lead: {
    label: 'Lead',
    badgeClass:
      'border-sky-400/35 bg-sky-500/15 text-sky-200',
  },
  pro: {
    label: 'Pro',
    badgeClass:
      'border-emerald-400/30 bg-emerald-500/20 text-emerald-200',
  },
  contacted: {
    label: 'Contacted',
    badgeClass:
      'border-violet-400/30 bg-violet-500/15 text-violet-200',
  },
  dropped: {
    label: 'Dropped',
    badgeClass:
      'border-rose-400/30 bg-rose-500/15 text-rose-200',
  },
}

export const ALL_STATUS_LABELS = Object.keys(CLIENT_STATUS_META) as ClientStatusLabel[]
