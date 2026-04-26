/**
 * Removes legacy "18-DAY" or "18-WEEK" full-title heading nodes from plan HTML.
 * Used by PlanTimeline and print output.
 */
export function strip18WeekPlanHeadingNodes(root: HTMLElement): void {
  const candidates = root.querySelectorAll('h1, h2, h3, h4, p, div')
  const toRemove: Element[] = []
  candidates.forEach(el => {
    const t = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (/^18[-–]?\s*(?:DAY|WEEK)\s+PERSONALIZED\s+PLAN$/i.test(t)) {
      toRemove.push(el)
    }
  })
  toRemove.forEach(el => el.remove())
}

/** @deprecated Use strip18WeekPlanHeadingNodes */
export const strip18DayPlanHeadingNodes = strip18WeekPlanHeadingNodes
