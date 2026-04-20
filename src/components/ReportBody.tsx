import { ReportHtml } from '@/components/ReportHtml'
import { ReportMarkdown } from '@/components/ReportMarkdown'
import { isLikelyHtmlReportContent } from '@/lib/reportContentKind'

export function ReportBody({ content }: { content: string }) {
  const t = content.trim()
  if (!t) return null
  if (isLikelyHtmlReportContent(content)) {
    return <ReportHtml content={content} />
  }
  return <ReportMarkdown content={content} />
}
