import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

/**
 * Simplified post-OTP-removal version.
 * All clients are auto-linked to all therapists via DB trigger, so hasTherapists
 * is always treated as true. Profile completion is no longer a route gate.
 */
type ClientOnboardingContextValue = {
  profileComplete: boolean
  hasTherapists: boolean | null
  needsTherapist: boolean
  mainAppLocked: boolean
  therapistSectionLocked: boolean
  therapistResolutionPending: boolean
  refetchHasTherapists: () => void
}

const ClientOnboardingContext = createContext<ClientOnboardingContextValue | null>(null)

export function ClientOnboardingProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ClientOnboardingContextValue>(
    () => ({
      profileComplete: true,
      hasTherapists: true,
      needsTherapist: false,
      mainAppLocked: false,
      therapistSectionLocked: false,
      therapistResolutionPending: false,
      refetchHasTherapists: () => {},
    }),
    []
  )

  return (
    <ClientOnboardingContext.Provider value={value}>{children}</ClientOnboardingContext.Provider>
  )
}

export function useClientOnboarding(): ClientOnboardingContextValue {
  const ctx = useContext(ClientOnboardingContext)
  if (!ctx) {
    throw new Error('useClientOnboarding must be used within ClientOnboardingProvider')
  }
  return ctx
}
