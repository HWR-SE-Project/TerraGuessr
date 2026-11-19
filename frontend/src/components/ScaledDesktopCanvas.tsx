import type { ReactNode } from 'react'
import { useCanvasScale } from '../hooks/useCanvasScale'

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1200

/** Scales a fixed 1920×1200 Figma-exported desktop canvas to fit its container instead of cropping. */
export function ScaledDesktopCanvas({ children }: { children: ReactNode }) {
  const { containerRef, scale, scaledHeight } = useCanvasScale(CANVAS_WIDTH, CANVAS_HEIGHT)

  return (
    <div ref={containerRef} style={{ width: '100%', height: scaledHeight, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top center', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}
