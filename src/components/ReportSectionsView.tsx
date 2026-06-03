import { ReportBody } from '@/components/ReportBody'
import type { ReportDisplayPart } from '@/lib/resolveReportSections'

export function ReportSectionsView({
  parts,
  className,
}: {
  parts: ReportDisplayPart[]
  className?: string
}) {
  if (parts.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No report content available.</p>
  }

  return (
    <div className={className ?? 'space-y-10'}>
      {parts.map(part => (
        <section key={part.id} className={part.id === 'final' ? 'border-t border-white/10 pt-8' : undefined}>
          <h2 className="mb-4 text-xl font-semibold text-foreground">{part.title}</h2>
          <ReportBody content={part.html} />
        </section>
      ))}
    </div>
  )
}
