const SECTION_MARKER_LINE_RE = /^---SECTION:[A-Z0-9_]+---\s*$/i

/** Strip delimiter marker lines from stored subsection HTML (display safety net). */
export function stripSectionDelimiterMarkers(text: string): string {
  if (!text?.trim()) return ''
  return text
    .split('\n')
    .filter(line => !SECTION_MARKER_LINE_RE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
