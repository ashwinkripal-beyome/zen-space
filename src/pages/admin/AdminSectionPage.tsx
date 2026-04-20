import { pageStaggerItemStyle, usePageStaggerVisible } from '@/hooks/usePageStaggerVisible'

export function AdminSectionPage({ title, description }: { title: string; description?: string }) {
  const staggerVisible = usePageStaggerVisible(true)
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-foreground" style={pageStaggerItemStyle(0, staggerVisible)}>
        {title}
      </h1>
      <p
        className="max-w-2xl text-muted-foreground"
        style={pageStaggerItemStyle(1, staggerVisible)}
      >
        {description ??
          'This section will use admin RLS policies and the tables defined in docs/DB_SCHEMA. Build CRUD here when ready.'}
      </p>
    </div>
  )
}
