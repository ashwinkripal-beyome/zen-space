import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'therapist' | 'client')[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground">Loading...</div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Only block the page with a full-screen loader on the *initial* profile load.
  // Background refetches (e.g. after profile updates) keep the existing profile
  // in state, so we should keep rendering the current page instead of unmounting it.
  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground">Loading...</div>
    )
  }

  if (!profile) {
    return <Navigate to="/complete-profile" replace />
  }

  const roleAllowed =
    !allowedRoles ||
    profile.role === 'admin' ||
    allowedRoles.includes(profile.role)

  if (!roleAllowed) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
