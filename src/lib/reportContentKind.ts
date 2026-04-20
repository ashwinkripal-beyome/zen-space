/** Heuristic: new reports are HTML fragments; legacy rows are markdown/plain. */
export function isLikelyHtmlReportContent(content: string): boolean {
  const t = content.trim()
  if (!t) return false
  if (t.startsWith('<')) return true
  if (/<\/(p|h2|h3|ul|ol|li|div)>/i.test(t)) return true
  return false
}
