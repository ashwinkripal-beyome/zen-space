import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCircle2,
  Stethoscope,
  FileStack,
  CreditCard,
} from 'lucide-react'
import {
  AppContentPanel,
  AppShellRow,
  MobileNavLayer,
  MobileZenHeaderBar,
  appShellAdminSidebarDrawerWidthClassName,
  glassSidebarClassName,
  sidebarNavLinkClassName,
} from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const links = [
  { to: '/app/admin', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/app/admin/users', label: 'Users', icon: Users },
  { to: '/app/admin/clients', label: 'Clients', icon: UserCircle2 },
  { to: '/app/admin/therapists', label: 'Therapists', icon: Stethoscope },
  { to: '/app/admin/reports', label: 'Reports', icon: FileStack },
  { to: '/app/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
]

export function AdminLayout() {
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
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
      <nav className="flex flex-col gap-1">
        {links.map(({ to, end, label, icon: Icon }) => (
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
        drawerWidthClassName={appShellAdminSidebarDrawerWidthClassName}
      >
        {sidebarInner(closeMobileNav)}
      </MobileNavLayer>
      <AppShellRow
        mobileHeader={
          <MobileZenHeaderBar menuOpen={mobileNavOpen} onMenuToggle={() => setMobileNavOpen((o) => !o)} />
        }
      >
        <aside className="hidden w-full shrink-0 self-start md:block md:w-52 md:max-w-[15rem] lg:w-60">
          {sidebarInner()}
        </aside>
        <AppContentPanel>
          <Outlet />
        </AppContentPanel>
      </AppShellRow>
    </div>
  )
}
