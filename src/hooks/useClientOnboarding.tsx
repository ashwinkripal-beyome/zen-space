import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isClientProfileComplete } from '@/lib/clientProfileComplete'
import { supabase } from '@/lib/supabase'

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

/**
 * Single source of truth for therapist link + profile completion under `/app/client`.
 * Without this, each `useClientOnboarding()` call had isolated state and supervised
 * routes could redirect to OTP while the assessments page already showed “linked”.
 */
export function ClientOnboardingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const profileComplete = profile?.role === 'client' ? isClientProfileComplete(profile) : true
  const [hasTherapists, setHasTherapists] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  const checkTherapistClients = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      const signal = opts?.signal
      if (!user?.id || profile?.role !== 'client') {
        if (!signal?.aborted) {
          setHasTherapists(null)
          setLoading(false)
        }
        return
      }
      if (!profileComplete) {
        if (!signal?.aborted) {
          setHasTherapists(null)
          setLoading(false)
        }
        return
      }

      if (!signal?.aborted) setLoading(true)
      const { data, error } = await supabase
        .from('therapist_clients')
        .select('id')
        .eq('client_id', user.id)
        .limit(1)

      if (signal?.aborted) return
      if (error) {
        console.error('therapist_clients check', error)
        setHasTherapists(false)
      } else {
        setHasTherapists((data?.length ?? 0) > 0)
      }
      setLoading(false)
    },
    [user?.id, profile?.role, profileComplete, profile?.first_name, profile?.last_name, profile?.gender, profile?.age]
  )

  useEffect(() => {
    const ac = new AbortController()
    void checkTherapistClients({ signal: ac.signal })
    return () => ac.abort()
  }, [checkTherapistClients])

  const needsTherapist =
    profile?.role === 'client' && profileComplete && !loading && hasTherapists === false

  const therapistResolutionPending =
    profile?.role === 'client' && profileComplete && (loading || hasTherapists === null)

  const mainAppLocked =
    profile?.role === 'client' &&
    (!profileComplete || therapistResolutionPending || hasTherapists === false)

  const therapistSectionLocked = profile?.role === 'client' && !profileComplete

  const value = useMemo<ClientOnboardingContextValue>(
    () => ({
      profileComplete,
      hasTherapists,
      needsTherapist,
      mainAppLocked,
      therapistSectionLocked,
      therapistResolutionPending,
      refetchHasTherapists: () => {
        void checkTherapistClients()
      },
    }),
    [
      profileComplete,
      hasTherapists,
      needsTherapist,
      mainAppLocked,
      therapistSectionLocked,
      therapistResolutionPending,
      checkTherapistClients,
    ]
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
