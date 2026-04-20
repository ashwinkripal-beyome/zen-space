import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

const STAGGER_STEP_MS = 120
const STAGGER_TRANSITION = 'opacity 600ms ease, transform 600ms ease'

/** Fade + slide-up per block, staggered like the client dashboard tiles. */
export function pageStaggerItemStyle(index: number, visible: boolean): CSSProperties {
  return {
    transitionDelay: visible ? `${index * STAGGER_STEP_MS}ms` : '0ms',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: STAGGER_TRANSITION,
  }
}

/**
 * After `enabled` becomes true (or `animationKey` changes), briefly reset then reveal so transitions run reliably.
 */
export function usePageStaggerVisible(enabled: boolean, animationKey: string | number = 0) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return
    }
    setVisible(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [enabled, animationKey])

  return visible
}
