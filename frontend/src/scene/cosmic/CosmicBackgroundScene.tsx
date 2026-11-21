import { lazy, Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CAMERA_FOV, CAMERA_Z } from '../home/composition'
import type { PointerState } from '../hooks'
import type { HomeSceneBinding } from './CosmicContext'
import { SpaceStars } from './SpaceStars'

const SceneContents = lazy(() => import('../home/SceneContents').then(module => ({
  default: module.SceneContents,
})))

/** Render tracking at display cadence, idle at 30fps, and stop in hidden tabs. */
function AmbientFrames({ enabled, reducedMotion, pointerRef }: { enabled: boolean; reducedMotion: boolean; pointerRef: React.RefObject<PointerState> }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (reducedMotion || !enabled) return
    let frame = 0
    let previous = 0
    const tick = (now: number) => {
      const tracking = now - pointerRef.current.lastMovedAt < 1500
      if (now - previous >= 1000 / (tracking ? 60 : 30) - 1) {
        invalidate()
        previous = now
      }
      frame = window.requestAnimationFrame(tick)
    }
    const visibility = () => {
      window.cancelAnimationFrame(frame)
      if (!document.hidden) {
        previous = 0
        frame = window.requestAnimationFrame(tick)
      }
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [invalidate, enabled, reducedMotion, pointerRef])
  return null
}

/** R3F sizes its cameras from the observed canvas container. Browser zoom also
 * changes DPR; update the existing renderer without remounting cached models. */
function ZoomPixelRatio() {
  const setDpr = useThree(state => state.setDpr)
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    const update = () => { setDpr(Math.min(1.5, Math.max(1, window.devicePixelRatio))); invalidate() }
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [setDpr, invalidate])
  return null
}

export function CosmicBackgroundScene({
  enabled,
  reducedMotion,
  pointerRef,
  home,
  isHome,
  layoutKey,
  onReady,
}: {
  enabled: boolean
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
  home: HomeSceneBinding | null
  isHome: boolean
  layoutKey: string
  onReady: () => void
}) {
  return (
    <Canvas
      className="th-scene3d-canvas"
      dpr={[1, 1.5]}
      resize={{ debounce: { resize: 0, scroll: 0 } }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
        toneMappingExposure: 1.15,
      }}
      camera={{
        fov: CAMERA_FOV,
        position: [0, 0, CAMERA_Z],
        near: 0.1,
        far: 200,
      }}
      frameloop={enabled ? 'demand' : 'never'}
      onCreated={onReady}
    >
      <ZoomPixelRatio />
      <AmbientFrames enabled={enabled} reducedMotion={reducedMotion} pointerRef={pointerRef} />
      <group visible={enabled}>
        <SpaceStars reducedMotion={reducedMotion} pointerRef={pointerRef} isHome={isHome} layoutKey={layoutKey} />
      </group>
      <Suspense fallback={null}>
        {home && <SceneContents
          reducedMotion={reducedMotion}
          pointerRef={pointerRef}
          onCharacterStatus={home.onCharacterStatus}
          onFeetOffset={home.onFeetOffset}
        />}
      </Suspense>
    </Canvas>
  )
}
