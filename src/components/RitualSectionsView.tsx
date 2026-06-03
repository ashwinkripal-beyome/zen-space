import { ReportBody } from '@/components/ReportBody'
import type { ReportDisplayPart } from '@/lib/resolveReportSections'

export function RitualSectionsView({
  parts,
  className,
}: {
  parts: ReportDisplayPart[]
  className?: string
}) {
  if (parts.length === 0) {
    return null
  }

  return (
    <div className={className ?? 'space-y-10'}>
      {parts.map(part => (
        <section key={part.id}>
          {part.id !== 'legacy' ? (
            <h2 className="mb-4 text-xl font-semibold text-foreground">{part.title}</h2>
          ) : null}
          <ReportBody content={part.html} />
        </section>
      ))}
    </div>
  )
}
