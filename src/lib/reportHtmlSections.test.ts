import { describe, expect, it } from 'vitest'
import {
  parseReportDelimitersFromContent,
  parseRitualDelimitersFromContent,
  splitRitualReportHtml,
  splitWellnessReportHtml,
} from '@/lib/reportHtmlSections'

describe('parseReportDelimitersFromContent', () => {
  it('parses subsection delimiters in order', () => {
    const raw = [
      '---SECTION:CLIENT_INFO---',
      '<p>Name: Alex</p>',
      '---SECTION:KEY_CONCERNS---',
      '<ul><li>Stress</li></ul>',
      '---SECTION:CURRENT_STATE---',
      '<p>Overwhelmed</p>',
      '---SECTION:BALANCE_ZONE---',
      '<p>Balance body</p>',
      '---SECTION:BLOSSOM_ZONE---',
      '<p>Blossom body</p>',
      '---SECTION:BLISS_ZONE---',
      '<p>Bliss body</p>',
      '---SECTION:INTEGRATED---',
      '<p>Integrated story</p>',
      '---SECTION:FINAL---',
      '<p>Closing words</p>',
    ].join('\n\n')

    const p = parseReportDelimitersFromContent(raw)
    expect(p.clientInfo).toContain('Alex')
    expect(p.keyConcerns).toContain('Stress')
    expect(p.balanceZone).toContain('Balance')
    expect(p.finalNarrative).toContain('Closing')
  })
})

describe('parseRitualDelimitersFromContent', () => {
  it('parses five ritual subsections', () => {
    const raw = [
      '---SECTION:RITUAL_EXPLAIN---',
      '<p>Daily foundation</p>',
      '---SECTION:RITUAL_SOMATIC---',
      '<p>Mat steps</p>',
      '---SECTION:RITUAL_MENTAL---',
      '<p>Release statement</p><ol><li>I am calm</li></ol>',
      '---SECTION:RITUAL_DAILY---',
      '<p>Follow weekly plan</p>',
      '---SECTION:RITUAL_REFLECT---',
      '<p>Rate 1-5</p>',
    ].join('\n\n')

    const p = parseRitualDelimitersFromContent(raw)
    expect(p.explain).toContain('foundation')
    expect(p.somatic).toContain('Mat')
    expect(p.mental).toContain('Release')
    expect(p.daily).toContain('weekly')
    expect(p.reflect).toContain('Rate')
  })

  it('parses mental-only self-report slice', () => {
    const raw = '---SECTION:RITUAL_MENTAL---\n<p>Patterns</p>'
    const p = parseRitualDelimitersFromContent(raw)
    expect(p.mental).toContain('Patterns')
    expect(p.explain).toBeFalsy()
  })
})

describe('splitWellnessReportHtml', () => {
  it('splits legacy h2 report sections', () => {
    const html = [
      '<p>Name: Sam</p>',
      '<h2>Key Concerns</h2><ul><li>Worry</li></ul>',
      '<h2>Current State</h2><p>Busy mind</p>',
      '<h2>Balance Zone</h2><p>Score 12</p>',
    ].join('')
    const parts = splitWellnessReportHtml(html)
    expect(parts.clientInfo || parts.preamble).toBeTruthy()
    expect(parts.keyConcerns).toContain('Worry')
    expect(parts.currentState).toContain('Busy')
    expect(parts.balanceZone).toContain('Score')
  })
})

describe('splitRitualReportHtml', () => {
  it('splits legacy ritual h3 steps', () => {
    const html = [
      '<p>Intro why daily practice matters.</p>',
      '<h3>1. Somatic Release &amp; Grounding</h3><p>Mat work</p>',
      '<h3>2. Mental Reprogramming</h3><p>Affirm <ol><li>I choose peace</li></ol></p>',
      '<h3>3. Daily Zen Garden Practice</h3><p>Weekly schedule</p>',
      '<h3>4. Reflection &amp; Integration</h3><p>Gratitude</p>',
    ].join('')
    const parts = splitRitualReportHtml(html)
    expect(parts.explain).toContain('Intro')
    expect(parts.somatic).toContain('Mat')
    expect(parts.mental).toContain('Affirm')
    expect(parts.daily).toContain('schedule')
    expect(parts.reflect).toContain('Gratitude')
  })
})
