import { useEffect, useRef, useState } from 'react'

let webGLSupport: boolean | undefined

/** Cheap synchronous capability check — no three.js import, safe to call eagerly. */
export function useWebGLSupport(): boolean {
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false
    if (webGLSupport !== undefined) return webGLSupport
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
      webGLSupport = !!context
      // A probe must not retain a second GPU context alongside the real canvas.
      context?.getExtension('WEBGL_lose_context')?.loseContext()
      return webGLSupport
    } catch {
      webGLSupport = false
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
  clientX: number
  clientY: number
  active: boolean
  lastMovedAt: number
}

/** Tracks normalized pointer position (-1..1) in a mutable ref so useFrame can read it without re-renders. */
export function usePointerParallax(enabled: boolean) {
  const ref = useRef<PointerState>({ x: 0, y: 0, targetX: 0, targetY: 0, clientX: 0, clientY: 0, active: false, lastMovedAt: 0 })
  useEffect(() => {
    const pointer = ref.current
    const reset = () => {
      pointer.active = false
      pointer.targetX = 0
      pointer.targetY = 0
      pointer.lastMovedAt = performance.now()
    }
    reset()
    if (!enabled) return
    function handleMove(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      pointer.clientX = event.clientX
      pointer.clientY = event.clientY
      pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1
      pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1
      pointer.active = true
      pointer.lastMovedAt = performance.now()
    }
    function handleOut(event: PointerEvent) {
      if (!event.relatedTarget) reset()
    }
    function handleVisibility() {
      if (document.hidden) reset()
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('pointerout', handleOut)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerout', handleOut)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', handleVisibility)
      reset()
    }
  }, [enabled])
  return ref
}
