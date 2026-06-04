import { describe, expect, it } from 'vitest'
import { stripSectionDelimiterMarkers } from '@/lib/sectionDelimiterMarkers'

describe('stripSectionDelimiterMarkers', () => {
  it('removes delimiter lines from subsection HTML', () => {
    const raw = [
      '---SECTION:RITUAL_EXPLAIN---',
      '<p>This is your daily foundation practice.</p>',
    ].join('\n')
    expect(stripSectionDelimiterMarkers(raw)).toBe('<p>This is your daily foundation practice.</p>')
  })
})
