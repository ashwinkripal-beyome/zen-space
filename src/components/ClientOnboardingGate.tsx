import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'

/**
 * Blocks dashboard, assessment, report, and plan until the client has completed
 * profile fields and linked at least one therapist.
 */
export function ClientOnboardingGate() {
  const { profile } = useAuth()
  const { profileComplete, hasTherapists, therapistResolutionPending } = useClientOnboarding()

  if (profile?.role !== 'client') {
    return <Outlet />
  }

  if (!profileComplete) {
    return <Navigate to="/app/client/profile" replace />
  }

  if (therapistResolutionPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">Loading…</div>
    )
  }

  if (hasTherapists === false) {
    return <Navigate to="/app/client/otp" replace />
  }

  return <Outlet />
}
