import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

const ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'div']
const ALLOWED_ATTR = ['class', 'data-day']

const reportHtmlClass =
  'report-html max-w-none text-foreground/90 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground/95 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:text-foreground/90 [&_br]:block'

export function ReportHtml({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const safe = useMemo(
    () =>
      DOMPurify.sanitize(content, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
      }),
    [content]
  )

  if (!safe.trim()) return null

  return (
    <div
      className={cn(reportHtmlClass, className)}
      // eslint-disable-next-line react/no-danger -- sanitized with DOMPurify
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
