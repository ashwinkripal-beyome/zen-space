import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, UserRound, Users, ClipboardList, FileText, CalendarDays } from 'lucide-react'
import {
  AppContentPanel,
  AppShellRow,
  MobileNavLayer,
  MobileZenHeaderBar,
  ZenSpaceSidebarBranding,
  appShellSidebarColumnClassName,
  appShellSidebarDrawerWidthClassName,
  glassSidebarClassName,
  sidebarNavLinkClassName,
} from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useClientOnboarding } from '@/hooks/useClientOnboarding.tsx'
import { cn } from '@/lib/utils'

type LockMode = 'never' | 'main' | 'therapistTab'

const items: { to: string; end?: boolean; label: string; icon: typeof LayoutDashboard; lock: LockMode }[] = [
  { to: '/app/client', end: true, label: 'Home', icon: LayoutDashboard, lock: 'main' },
  { to: '/app/client/assessment', label: 'Assessments', icon: ClipboardList, lock: 'main' },
  { to: '/app/client/report', label: 'Report', icon: FileText, lock: 'main' },
  { to: '/app/client/plan', label: 'Personal Plan', icon: CalendarDays, lock: 'main' },
  { to: '/app/client/therapists', label: 'Therapists', icon: Users, lock: 'therapistTab' },
  { to: '/app/client/profile', label: 'Profile', icon: UserRound, lock: 'never' },
]

export function ClientLayout() {
  const { signOut, profile, profileLoading } = useAuth()
  const {
    therapistSectionLocked,
    profileComplete,
    hasTherapists,
    therapistResolutionPending,
  } = useClientOnboarding()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (profile?.role !== 'client' || profileLoading) return
    const path = location.pathname

    if (!profileComplete) {
      if (path !== '/app/client/profile') {
        navigate('/app/client/profile', { replace: true })
      }
      return
    }

    if (therapistResolutionPending) return

    if (hasTherapists === false) {
      const allowed = new Set([
        '/app/client/profile',
        '/app/client/otp',
        '/app/client/therapists',
        '/app/client',
        '/app/client/assessment',
        '/app/client/report',
        '/app/client/plan',
      ])
      const isAllowed = allowed.has(path)
        || path.startsWith('/app/client/assessment/self/')
        || path.startsWith('/app/client/report/')
      if (!isAllowed) {
        navigate('/app/client/otp', { replace: true })
      }
    }
  }, [
    profile?.role,
    profileLoading,
    profileComplete,
    hasTherapists,
    therapistResolutionPending,
    location.pathname,
    navigate,
  ])

  const locked = (mode: LockMode) => {
    if (mode === 'never') return false
    if (mode === 'main') return !profileComplete
    return therapistSectionLocked
  }

  const closeMobileNav = () => setMobileNavOpen(false)

  const sidebarInner = (afterNav?: () => void) => (
    <div className={cn(glassSidebarClassName, 'flex w-full flex-col')}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
      <nav className="flex flex-col gap-1">
        {items.map(({ to, end, label, icon: Icon, lock }) => {
          const isLocked = locked(lock)
          if (isLocked) {
            return (
              <span
                key={to}
                className={cn(
                          'flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground md:py-2'
                )}
                aria-disabled="true"
                title="Complete your profile or link a therapist to unlock"
              >
                <Icon className="size-4 opacity-50" aria-hidden />
                {label}
              </span>
            )
          }
          return (
            <NavLink key={to} to={to} end={end} className={sidebarNavLinkClassName} onClick={() => afterNav?.()}>
              <Icon className="size-4 opacity-80" aria-hidden />
              {label}
            </NavLink>
          )
        })}
      </nav>
      <Button
        type="button"
        variant="zenOutline"
        size="sm"
        className="mt-4 w-full"
        onClick={() => {
          afterNav?.()
          void signOut()
        }}
      >
        Sign out
      </Button>
    </div>
  )

  return (
    <div className="relative h-[100dvh] min-h-0 overflow-hidden print:h-auto print:min-h-0 print:overflow-visible">
      <MobileNavLayer
        open={mobileNavOpen}
        onClose={closeMobileNav}
        drawerWidthClassName={appShellSidebarDrawerWidthClassName}
      >
        {sidebarInner(closeMobileNav)}
      </MobileNavLayer>
      <AppShellRow
        mobileHeader={
          <MobileZenHeaderBar menuOpen={mobileNavOpen} onMenuToggle={() => setMobileNavOpen((o) => !o)} />
        }
      >
        <div className={cn(appShellSidebarColumnClassName, 'hidden print:hidden md:flex')}>
          <aside className="w-full shrink-0">
            {sidebarInner()}
          </aside>
          <ZenSpaceSidebarBranding />
        </div>
        <AppContentPanel>
          <Outlet />
        </AppContentPanel>
      </AppShellRow>
    </div>
  )
}
