import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { SceneContents } from './SceneContents'
import { CAMERA_FOV, CAMERA_Z } from './composition'
import type { PointerState } from './hooks'

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
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMappingExposure: 1.15,
      }}
      camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 60 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
    >
      <Suspense fallback={null}>
        <SceneContents reducedMotion={reducedMotion} pointerRef={pointerRef} />
      </Suspense>
    </Canvas>
  )
}
