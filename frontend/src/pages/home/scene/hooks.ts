import { useEffect, useRef, useState } from 'react'

/** Cheap synchronous capability check — no three.js import, safe to call eagerly. */
export function useWebGLSupport(): boolean {
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const canvas = document.createElement('canvas')
      return !!(
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      )
    } catch {
      return false
    }
  })
  return supported
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

export interface PointerState {
  x: number
  y: number
  targetX: number
  targetY: number
}

/** Tracks normalized pointer position (-1..1) in a mutable ref so useFrame can read it without re-renders. */
export function usePointerParallax(enabled: boolean) {
  const ref = useRef<PointerState>({ x: 0, y: 0, targetX: 0, targetY: 0 })
  useEffect(() => {
    if (!enabled) return
    function handleMove(event: PointerEvent) {
      ref.current.targetX = (event.clientX / window.innerWidth) * 2 - 1
      ref.current.targetY = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => window.removeEventListener('pointermove', handleMove)
  }, [enabled])
  return ref
}
