import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { SceneContents } from './SceneContents'
import { CAMERA_FOV, CAMERA_Z } from './composition'
import type { PointerState } from './hooks'

/** Cap decorative rendering at 30fps, and stop scheduling frames in hidden tabs. */
function AmbientFrames({ reducedMotion }: { reducedMotion: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => {
      if (!document.hidden) invalidate()
    }, 1000 / 30)
    return () => window.clearInterval(timer)
  }, [invalidate, reducedMotion])
  return null
}

export function Home3DSceneInner({
  reducedMotion,
  pointerRef,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
}) {
  return (
    <Canvas
      className="th-scene3d-canvas"
      dpr={[1, 1.5]}
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
      frameloop="demand"
    >
      <AmbientFrames reducedMotion={reducedMotion} />
      <Suspense fallback={null}>
        <SceneContents reducedMotion={reducedMotion} pointerRef={pointerRef} />
      </Suspense>
    </Canvas>
  )
}
