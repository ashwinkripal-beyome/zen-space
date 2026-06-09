import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, FileText, LayoutDashboard, Sparkles, UserRound } from 'lucide-react'
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
import { PLAN_META, isPaidTier } from '@/lib/planTiers'
import { cn } from '@/lib/utils'

const items: { to: string; end?: boolean; label: string; icon: typeof LayoutDashboard }[] = [
  { to: '/app/client', end: true, label: 'Home', icon: LayoutDashboard },
  { to: '/app/client/assessment', label: 'Assessments', icon: ClipboardList },
  { to: '/app/client/report', label: 'Report', icon: FileText },
  { to: '/app/client/plan', label: 'Personal Plan', icon: CalendarDays },
  { to: '/app/client/profile', label: 'Profile', icon: UserRound },
]

export function ClientLayout() {
  const { signOut, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
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

  const onPlan = isPaidTier(profile?.current_plan)
  const planMeta = onPlan && profile?.current_plan ? PLAN_META[profile.current_plan as keyof typeof PLAN_META] : null

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

      {/* Plan status / upgrade CTA */}
      <div className="mt-auto pt-4">
        {planMeta ? (
          /* On a paid plan — show which plan */
          <NavLink
            to="/app/client/plan"
            className="flex w-full items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-left text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15"
            onClick={() => afterNav?.()}
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="truncate font-semibold">{planMeta.label}</p>
              <p className="truncate text-[10px] font-normal text-emerald-300/70">Active plan</p>
            </div>
          </NavLink>
        ) : (
          /* Not on a paid plan — upgrade CTA */
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2.5 text-left text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/15"
            onClick={() => {
              afterNav?.()
              navigate('/app/client/subscription-locked')
            }}
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="truncate font-semibold">Upgrade to Pro</p>
              <p className="truncate text-[10px] font-normal text-sky-300/70">Unlock your full plan</p>
            </div>
          </button>
        )}
      </div>

      <Button
        type="button"
        variant="zenOutline"
        size="sm"
        className="mt-3 w-full"
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
