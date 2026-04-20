import DOMPurify from 'dompurify'

export const REPORT_HTML_ALLOWED_TAGS = [
  'h2',
  'h3',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'br',
  'div',
] as const

export const REPORT_HTML_ALLOWED_ATTR = ['class', 'data-day'] as const

export function sanitizeReportHtmlFragment(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...REPORT_HTML_ALLOWED_TAGS],
    ALLOWED_ATTR: [...REPORT_HTML_ALLOWED_ATTR],
  })
}
