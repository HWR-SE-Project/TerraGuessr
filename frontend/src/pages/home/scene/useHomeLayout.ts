import { useLayoutEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'

export interface HomeLayout {
  left: number
  top: number
  width: number
  height: number
}

/** One canvas-local CSS coordinate space for both render passes. Measure on
 * layout events, never in useFrame. RAF coalescing avoids ResizeObserver loops. */
export function useHomeLayout() {
  const { gl, size, invalidate } = useThree()
  const [layout, setLayout] = useState<HomeLayout | null>(null)
  useLayoutEffect(() => {
    const slot = document.querySelector('.th-character-slot')
    if (!slot) return
    let frame = 0
    let disposed = false
    const measure = () => {
      const canvas = gl.domElement.getBoundingClientRect()
      const target = slot.getBoundingClientRect()
      const next = { left: target.left - canvas.left, top: target.top - canvas.top,
        width: target.width, height: target.height }
      setLayout(previous => previous && Object.keys(next).every(key =>
        Math.abs(previous[key as keyof HomeLayout] - next[key as keyof HomeLayout]) < 0.1) ? previous : next)
      invalidate()
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    measure()
    const observer = new ResizeObserver(schedule)
    for (const target of [slot, slot.closest('.th-home'), document.querySelector('.th-header'), document.querySelector('.th-hero-copy'), gl.domElement]) {
      if (target) observer.observe(target)
    }
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    void document.fonts?.ready.then(() => { if (!disposed) schedule() })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [gl, size.width, size.height, invalidate])
  return layout
}
