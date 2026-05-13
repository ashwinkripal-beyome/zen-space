import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

const STAGGER_STEP_MS = 120

/** Fade + slide-up per block, staggered like the client dashboard tiles. */
export function pageStaggerItemStyle(index: number, visible: boolean): CSSProperties {
  const delay = visible ? `${index * STAGGER_STEP_MS}ms` : '0ms'
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 600ms ease ${delay}, transform 600ms ease ${delay}`,
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
