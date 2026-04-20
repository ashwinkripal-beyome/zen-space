import { useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { ClientOnboardingGate } from '@/components/ClientOnboardingGate'
import { ClientOnboardingProvider } from '@/hooks/useClientOnboarding.tsx'
import { isClientProfileComplete } from '@/lib/clientProfileComplete'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { TherapistLayout } from '@/layouts/TherapistLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { MagicLinkPage } from '@/pages/auth/MagicLinkPage'
import { ClientDashboard } from '@/pages/client/ClientDashboard'
import { ClientProfilePage } from '@/pages/client/ClientProfilePage'
import { ClientOtpScreen } from '@/pages/ClientOtpScreen'
import { ClientAssessmentPage } from '@/pages/client/ClientAssessmentPage'
import { ClientAssessmentSessionPage } from '@/pages/client/ClientAssessmentSessionPage'
import { ClientAssessmentReviewPage } from '@/pages/client/ClientAssessmentReviewPage'
import { ClientReportPage } from '@/pages/client/ClientReportPage'
import { ClientReportDetailPage } from '@/pages/client/ClientReportDetailPage'
import { ClientPlanPage } from '@/pages/client/ClientPlanPage'
import { ClientSubscriptionLockedPage } from '@/pages/client/ClientSubscriptionLockedPage'
import { ClientTherapistsPage } from '@/pages/client/ClientTherapistsPage'
import { TherapistHomePage } from '@/pages/therapist/TherapistHomePage'
import { TherapistClientsPage } from '@/pages/therapist/TherapistClientsPage'
import { TherapistClientDetailPage } from '@/pages/therapist/TherapistClientDetailPage'
import { TherapistClientReportsPage } from '@/pages/therapist/TherapistClientReportsPage'
import { TherapistClientReportDetailPage } from '@/pages/therapist/TherapistClientReportDetailPage'
import { TherapistClientObservationsPage } from '@/pages/therapist/TherapistClientObservationsPage'
import { TherapistClientPlanPage } from '@/pages/therapist/TherapistClientPlanPage'
import { TherapistNotificationsPage } from '@/pages/therapist/TherapistNotificationsPage'
import { TherapistProfilePage } from '@/pages/therapist/TherapistProfilePage'
import { AdminSectionPage } from '@/pages/admin/AdminSectionPage'

function appPathForRole(role: 'admin' | 'therapist' | 'client'): string {
  switch (role) {
    case 'admin':
      return '/app/admin'
    case 'therapist':
      return '/app/therapist'
    case 'client':
    default:
      return '/app/client'
  }
}

function ClientPostLoginRedirect() {
  const { user, profile, profileLoading } = useAuth()
  const profileComplete =
    profile?.role === 'client' ? isClientProfileComplete(profile) : true

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl text-foreground">Loading...</p>
      </div>
    )
  }
  if (!profile) {
    return <Navigate to="/complete-profile" replace />
  }

  if (!profileComplete) {
    return <Navigate to="/app/client/profile" replace />
  }
  return <Navigate to="/app/client" replace />
}

function RoleHomeRedirect() {
  const { user, profile, profileLoading } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl text-foreground">Loading...</p>
      </div>
    )
  }
  if (!profile) {
    return <Navigate to="/complete-profile" replace />
  }
  if (profile.role === 'client') {
    return <ClientPostLoginRedirect />
  }
  return <Navigate to={appPathForRole(profile.role)} replace />
}

function TherapistLegacyReportRedirect() {
  const { clientId } = useParams<{ clientId: string }>()
  return (
    <Navigate
      to={clientId ? `/app/therapist/clients/${clientId}/reports` : '/app/therapist/clients'}
      replace
    />
  )
}

function CompleteProfileScreen() {
  const { signOut, user, profile, profileLoading, refetchProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!profileLoading && profile) {
      navigate('/', { replace: true })
    }
  }, [profile, profileLoading, navigate])

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground">Loading…</div>
    )
  }

  if (user && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center text-foreground">
        <h1 className="text-2xl font-semibold">We couldn&apos;t load your account</h1>
        <p className="max-w-md text-muted-foreground">
          Your sign-in worked, but your profile row isn&apos;t available yet. Try again, open profile setup, or sign
          out.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button type="button" variant="zenOutline" onClick={() => refetchProfile()}>
            Retry
          </Button>
          <Button asChild variant="zen">
            <Link to="/app/client/profile">Profile setup</Link>
          </Button>
          <Button type="button" variant="zenOutline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Complete your profile</h1>
      <p className="max-w-md text-muted-foreground">Sign in to continue.</p>
      <Button asChild variant="zenOutline">
        <Link to="/login">Go to login</Link>
      </Button>
    </div>
  )
}

function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl text-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <Router>
      <Toaster />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/client" element={<LoginPage />} />
          <Route path="/login/therapist" element={<LoginPage />} />
          <Route path="/login/admin" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/magic-link" element={<MagicLinkPage />} />
        </Route>

        <Route path="/" element={<RoleHomeRedirect />} />
        <Route path="/complete-profile" element={<CompleteProfileScreen />} />

        <Route
          path="/app/client"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientOnboardingProvider>
                <ClientLayout />
              </ClientOnboardingProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<ClientDashboard />} />
          <Route path="profile" element={<ClientProfilePage />} />
          <Route path="otp" element={<ClientOtpScreen />} />
          <Route path="therapists" element={<ClientTherapistsPage />} />
          <Route path="assessment" element={<ClientAssessmentPage />} />
          <Route path="assessment/self/session" element={<ClientAssessmentSessionPage />} />
          <Route path="assessment/self/review" element={<ClientAssessmentReviewPage />} />
          <Route path="report" element={<ClientReportPage />} />
          <Route path="report/:reportId" element={<ClientReportDetailPage />} />
          <Route path="plan" element={<ClientPlanPage />} />
          <Route path="subscription-locked" element={<ClientSubscriptionLockedPage />} />
          <Route element={<ClientOnboardingGate />}>
            <Route path="assessment/supervised/session" element={<ClientAssessmentSessionPage />} />
            <Route path="assessment/supervised/review" element={<ClientAssessmentReviewPage />} />
          </Route>
        </Route>

        <Route
          path="/app/therapist"
          element={
            <ProtectedRoute allowedRoles={['therapist']}>
              <TherapistLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TherapistHomePage />} />
          <Route path="clients" element={<TherapistClientsPage />} />
          <Route path="clients/:clientId" element={<TherapistClientDetailPage />} />
          <Route path="clients/:clientId/report" element={<TherapistLegacyReportRedirect />} />
          <Route path="clients/:clientId/reports" element={<TherapistClientReportsPage />} />
          <Route path="clients/:clientId/reports/:reportId" element={<TherapistClientReportDetailPage />} />
          <Route path="clients/:clientId/observations" element={<TherapistClientObservationsPage />} />
          <Route path="clients/:clientId/plan" element={<TherapistClientPlanPage />} />
          <Route path="clients/:clientId/otp" element={<Navigate to="/app/therapist" replace />} />
          <Route path="notifications" element={<TherapistNotificationsPage />} />
          <Route path="profile" element={<TherapistProfilePage />} />
        </Route>

        <Route
          path="/app/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminSectionPage title="Admin overview" />} />
          <Route path="users" element={<AdminSectionPage title="Users" />} />
          <Route path="clients" element={<AdminSectionPage title="All clients" />} />
          <Route path="therapists" element={<AdminSectionPage title="Therapists" />} />
          <Route path="reports" element={<AdminSectionPage title="Reports overview" />} />
          <Route path="subscriptions" element={<AdminSectionPage title="Subscriptions" />} />
        </Route>

        <Route
          path="/unauthorized"
          element={
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-foreground">
              <h1 className="text-2xl font-semibold">Unauthorized</h1>
              <p className="text-muted-foreground">You don&apos;t have access to this area.</p>
              <Button asChild variant="zenOutline">
                <Link to="/">Home</Link>
              </Button>
            </div>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
