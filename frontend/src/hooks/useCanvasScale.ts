import { useEffect, useRef, useState } from 'react'

/**
 * The Desktop* pages are exported from Figma as a fixed 1920×1200 canvas with
 * absolutely-positioned children. Below 1920px that canvas would otherwise get
 * silently center-cropped by the viewport (no scrollbar, content just missing).
 * This scales the canvas down to fit any width from the tablet/desktop
 * breakpoint (1024px) up to 1920px, and holds it at native size above that.
 */
export function useCanvasScale(canvasWidth: number, canvasHeight: number, maxScale = 1) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(maxScale)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(Math.min(el.clientWidth / canvasWidth, maxScale))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [canvasWidth, maxScale])

  return { containerRef, scale, scaledHeight: canvasHeight * scale }
}
