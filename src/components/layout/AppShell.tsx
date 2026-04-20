import type { ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Mobile drawer: wider than the md sidebar column; md+ classes unused (drawer is `md:hidden`). */
export const appShellSidebarDrawerWidthClassName = 'w-[min(100vw-1rem,26rem)]'

/** Admin mobile drawer — slightly wider cap. */
export const appShellAdminSidebarDrawerWidthClassName = 'w-[min(100vw-1rem,28rem)]'

export const APP_MOBILE_NAV_ID = 'app-mobile-nav'

/** Shared frosted glass surface (page gradient shows through). Ring = --zen-ring-normal via .zen-shell-surface */
const glassSurface = cn(
  'rounded-2xl border-0 bg-white/[0.04]',
  'backdrop-blur-xl backdrop-saturate-125',
  'zen-shell-surface'
)

/** Sidebar inner — does not scroll; stays within viewport column. */
export const glassSidebarClassName = cn(glassSurface, 'p-4')

/**
 * Sidebar nav: active = softer glass (`.zen-sidebar-nav-active`) + secondary ring.
 * Idle: transparent; hover = full `.zen-glass-card` via `.zen-sidebar-nav-idle:hover` in `zen-tokens.css`.
 */
export function sidebarNavLinkClassName({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium md:py-2',
    'transition-[color,background-color,border-color,backdrop-filter,box-shadow]',
    isActive
      ? 'zen-sidebar-nav-active zen-ring-secondary ring-0 shadow-none text-foreground'
      : 'border border-transparent text-muted-foreground zen-sidebar-nav-idle hover:text-foreground'
  )
}

/** Report detail segmented control: outer outline matches active sidebar tab (secondary ring + glass). */
export const reportDetailTabListClassName = cn(
  'flex gap-1 rounded-xl p-1 print:hidden',
  'zen-glass-card zen-ring-secondary ring-0 shadow-none'
)

/** Active tab = softer `.zen-glass-card-active` + secondary ring; idle = `.zen-glass-card` + primary ring. */
export function reportDetailTabButtonClassName(active: boolean) {
  return cn(
    'flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm font-medium transition-[color,background-color,box-shadow,backdrop-filter] sm:px-4',
    active
      ? 'zen-glass-card-active zen-ring-secondary ring-0 shadow-none text-foreground'
      : 'zen-glass-card zen-ring-primary ring-0 shadow-none text-muted-foreground hover:text-foreground'
  )
}

/** Sidebar column: on md+, stretches full height so branding sits at the bottom (use with ZenSpaceSidebarBranding). */
export const appShellSidebarColumnClassName = cn(
  'flex min-h-0 w-full shrink-0 flex-col items-center md:h-full md:w-52 md:max-w-[14rem] lg:w-56'
)

export function ZenSpaceSidebarBranding() {
  return (
    <p className="mt-auto hidden w-full pt-8 text-center text-4xl font-bold tracking-tight text-foreground md:block">
      Zen Space
    </p>
  )
}

/** Glass top bar: hamburger + centered Zen Space (mobile only; layouts pass `mobileHeader` into `AppShellRow`). */
export function MobileZenHeaderBar({
  menuOpen,
  onMenuToggle,
  menuBadgeCount = 0,
}: {
  menuOpen: boolean
  onMenuToggle: () => void
  /** E.g. therapist pending notification count; shown on menu icon when closed and &gt; 0. */
  menuBadgeCount?: number
}) {
  const showMenuBadge = !menuOpen && menuBadgeCount > 0
  const menuAriaLabel =
    menuOpen
      ? 'Close menu'
      : menuBadgeCount > 0
        ? `Open menu, ${menuBadgeCount} notification${menuBadgeCount === 1 ? '' : 's'}`
        : 'Open menu'

  return (
    <div className="shrink-0 px-4 pt-4 pb-2 print:hidden md:hidden">
      <header
        className={cn(
          glassSurface,
          'grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-2.5 shadow-sm'
        )}
      >
        <div className="flex justify-start">
          <div className="relative inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onMenuToggle}
              aria-expanded={menuOpen}
              aria-controls={APP_MOBILE_NAV_ID}
              aria-label={menuAriaLabel}
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </Button>
            {showMenuBadge ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/90 px-1 text-[10px] font-bold tabular-nums text-foreground ring-2 ring-background/80"
                aria-hidden
              >
                {menuBadgeCount > 99 ? '99+' : menuBadgeCount}
              </span>
            ) : null}
          </div>
        </div>
        <span className="text-center text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
          Zen Space
        </span>
        <div className="flex justify-end" aria-hidden>
          <span className="inline-block size-9 shrink-0" />
        </div>
      </header>
    </div>
  )
}

const mobileNavScrimClassName = cn(
  'fixed inset-0 z-40 md:hidden print:hidden',
  'bg-background/50 backdrop-blur-sm',
  'transition-[opacity,backdrop-filter] duration-300 ease-out motion-reduce:transition-none'
)

const mobileNavDrawerShellClassName = cn(
  'fixed inset-y-0 left-0 z-50 md:hidden print:hidden',
  'transition-transform duration-300 ease-out motion-reduce:transition-none'
)

/** Mobile-only overlay + sliding drawer; keep mounted so open/close can animate. */
export function MobileNavLayer({
  open,
  onClose,
  drawerWidthClassName,
  children,
}: {
  open: boolean
  onClose: () => void
  drawerWidthClassName: string
  children: ReactNode
}) {
  return (
    <>
      <button
        type="button"
        className={cn(
          mobileNavScrimClassName,
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-label="Close menu"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        className={cn(
          mobileNavDrawerShellClassName,
          drawerWidthClassName,
          open ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
        )}
      >
        <aside
          id={APP_MOBILE_NAV_ID}
          className={cn(
            'flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden',
            'border-r border-white/10 bg-white/[0.03] shadow-[4px_0_32px_-8px_rgba(0,0,0,0.45)]',
            'backdrop-blur-xl backdrop-saturate-125'
          )}
          aria-hidden={!open}
          inert={!open}
        >
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/10 px-2 py-2.5">
            <span className="inline-block size-9 shrink-0 justify-self-start" aria-hidden />
            <span className="text-center text-base font-bold tracking-tight text-foreground whitespace-nowrap">
              Zen Space
            </span>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onClose}
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <div className="flex min-h-full flex-col [&>*]:min-h-full [&>*]:flex-1 [&>*]:flex [&>*]:flex-col">
              {children}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

/**
 * Main workspace: same glass as sidebar. Scrolls internally only (`overflow-y-auto`).
 */
export function AppContentPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        glassSurface,
        'app-content-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain text-foreground',
        'print:h-auto print:min-h-0 print:flex-none print:overflow-visible',
        'p-5 md:p-8',
        className
      )}
    >
      {children}
    </main>
  )
}

/**
 * Full viewport height, no document scroll; only `AppContentPanel` scrolls.
 */
export function AppShellRow({
  children,
  className,
  mobileHeader,
}: {
  children: ReactNode
  className?: string
  mobileHeader?: ReactNode
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden print:h-auto print:min-h-0 print:overflow-visible">
      {mobileHeader}
      <div
        className={cn(
          'box-border flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-4 md:flex-row md:gap-6 md:p-6 lg:p-8',
          'print:h-auto print:min-h-0 print:overflow-visible',
          mobileHeader != null && 'pt-2',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
