import { ChangePasswordCard } from '@/components/ChangePasswordCard'
import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'

export function AdminAccountPage() {
  const staggerVisible = usePageStaggerVisible(true)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground" style={pageStaggerItemStyle(0, staggerVisible)}>
        Account
      </h1>
      <ChangePasswordCard style={pageStaggerItemStyle(1, staggerVisible)} />
    </div>
  )
}
