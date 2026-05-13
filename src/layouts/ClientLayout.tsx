import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, UserRound, ClipboardList, FileText, CalendarDays } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const items: { to: string; end?: boolean; label: string; icon: typeof LayoutDashboard }[] = [
  { to: '/app/client', end: true, label: 'Home', icon: LayoutDashboard },
  { to: '/app/client/assessment', label: 'Assessments', icon: ClipboardList },
  { to: '/app/client/report', label: 'Report', icon: FileText },
  { to: '/app/client/plan', label: 'Personal Plan', icon: CalendarDays },
  { to: '/app/client/profile', label: 'Profile', icon: UserRound },
]

export function ClientLayout() {
  const { signOut } = useAuth()
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

  const closeMobileNav = () => setMobileNavOpen(false)

  const sidebarInner = (afterNav?: () => void) => (
    <div className={cn(glassSidebarClassName, 'flex w-full flex-col')}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
      <nav className="flex flex-col gap-1">
        {items.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} className={sidebarNavLinkClassName} onClick={() => afterNav?.()}>
            <Icon className="size-4 opacity-80" aria-hidden />
            {label}
          </NavLink>
        ))}
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
