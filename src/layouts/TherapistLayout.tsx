import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LayoutDashboard, UserRound, Users } from 'lucide-react'
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
import { isTherapistProfileComplete } from '@/lib/therapistProfileComplete'
import { useTherapistPendingRealtime } from '@/hooks/useTherapistPendingRealtime'
import { fetchTherapistAllPending } from '@/lib/therapistPendingObservations'
import { cn } from '@/lib/utils'

export function TherapistLayout() {
  const { user, profile, profileLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const profileComplete = isTherapistProfileComplete(profile)
  const [pendingCount, setPendingCount] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const fetchPendingCount = useCallback(async () => {
    if (!user?.id) return
    const pending = await fetchTherapistAllPending(user.id)
    setPendingCount(pending.length)
  }, [user?.id])

  useEffect(() => {
    void fetchPendingCount()
  }, [fetchPendingCount, location.pathname])

  useTherapistPendingRealtime(
    user?.id,
    Boolean(user?.id && profile?.role === 'therapist' && profileComplete),
    fetchPendingCount,
    { channelScope: 'sidebar-badge' }
  )

  useEffect(() => {
    if (profile?.role !== 'therapist' || profileLoading) return
    if (!profileComplete && location.pathname !== '/app/therapist/profile') {
      navigate('/app/therapist/profile', { replace: true })
    }
  }, [profile?.role, profileLoading, profileComplete, location.pathname, navigate])

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

  const closeMobileNav = () => setMobileNavOpen(false)

  const sidebarInner = (afterNav?: () => void) => (
    <div className={cn(glassSidebarClassName, 'flex w-full flex-col')}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Therapist</p>
      <nav className="flex flex-col gap-1">
        {[
          { to: '/app/therapist', end: true, label: 'Dashboard', icon: LayoutDashboard, lock: true },
          { to: '/app/therapist/clients', label: 'Clients', icon: Users, lock: true },
          { to: '/app/therapist/notifications', label: 'Notifications', icon: Bell, lock: true, badge: pendingCount },
          { to: '/app/therapist/profile', label: 'Profile', icon: UserRound, lock: false },
        ].map(({ to, end, label, icon: Icon, lock, badge }) => {
          const isLocked = lock && !profileComplete
          if (isLocked) {
            return (
              <span
                key={to}
                className="flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground md:py-2"
                aria-disabled="true"
                title="Complete your profile to unlock"
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
              {badge != null && badge > 0 && (
                <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/85 text-[10px] font-bold text-foreground">
                  {badge}
                </span>
              )}
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
          <MobileZenHeaderBar
            menuOpen={mobileNavOpen}
            onMenuToggle={() => setMobileNavOpen((o) => !o)}
            menuBadgeCount={profileComplete ? pendingCount : 0}
          />
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
