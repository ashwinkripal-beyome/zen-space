/** Client-side extraction when reports.affirmations is empty (display only). */

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractFromPlainLines(lines: string[]): string[] {
  const results: string[] = []
  for (const line of lines) {
    const cleaned = line
      .replace(/^[\d]+[.)]\s*/, '')
      .replace(/^[-*•🔹]\s*/, '')
      .replace(/^["'""]+/, '')
      .replace(/["'""]+$/, '')
      .trim()
    if (cleaned.length > 5) results.push(cleaned)
    if (results.length >= 15) break
  }
  return results
}

function extractFromMarkdownLines(lines: string[]): string[] {
  const results: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^#{1,3}\s/.test(line) || /^[🔹✨📅🧘🔗⚖🌸🌌]/.test(line)) {
      if (results.length > 0) break
      continue
    }
    const cleaned = line
      .replace(/^[\d]+[.)]\s*/, '')
      .replace(/^[-*•🔹]\s*/, '')
      .replace(/^["“]+/, '')
      .replace(/["”]+$/, '')
      .trim()
    if (cleaned.length > 5) results.push(cleaned)
    if (results.length >= 15) break
  }
  return results
}

export function extractAffirmationsFromRitual(ritual: string | null | undefined): string[] {
  if (!ritual) return []
  const affIdx = ritual.toLowerCase().indexOf('affirmation')
  if (affIdx === -1) return []

  const afterAff = ritual.slice(affIdx)

  if (afterAff.includes('<')) {
    const liMatches = [...afterAff.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    if (liMatches.length > 0) {
      const items = liMatches
        .map(m => stripHtmlTags(m[1] ?? ''))
        .filter(s => s.length > 5)
      if (items.length > 0) return items.slice(0, 15)
    }
    const plainLines = stripHtmlTags(afterAff)
      .split(/[\n.]+/)
      .map(s => s.trim())
      .filter(Boolean)
    return extractFromPlainLines(plainLines)
  }

  return extractFromMarkdownLines(afterAff.split('\n'))
}
