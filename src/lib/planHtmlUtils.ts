/**
 * Removes legacy "18-DAY PERSONALIZED PLAN" heading nodes from plan HTML.
 * Used by PlanTimeline and print output.
 */
export function strip18DayPlanHeadingNodes(root: HTMLElement): void {
  const candidates = root.querySelectorAll('h1, h2, h3, h4, p, div')
  const toRemove: Element[] = []
  candidates.forEach(el => {
    const t = el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (/^18[-–]?\s*DAY\s+PERSONALIZED\s+PLAN$/i.test(t)) {
      toRemove.push(el)
    }
  })
  toRemove.forEach(el => el.remove())
}
