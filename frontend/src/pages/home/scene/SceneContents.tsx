import { Suspense, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { computeSceneLayout, SUN_DIRECTION } from './composition'
import { PlanetEarth } from './PlanetEarth'
import { SpaceStars } from './SpaceStars'
import type { PointerState } from './hooks'

const SUN_POSITION: [number, number, number] = [
  SUN_DIRECTION[0] * 12,
  SUN_DIRECTION[1] * 12,
  SUN_DIRECTION[2] * 12,
]

function CameraRig({
  pointerRef,
  reducedMotion,
}: {
  pointerRef: React.RefObject<PointerState>
  reducedMotion: boolean
}) {
  useFrame((state) => {
    if (reducedMotion) return
    const pointer = pointerRef.current
    pointer.x += (pointer.targetX - pointer.x) * 0.045
    pointer.y += (pointer.targetY - pointer.y) * 0.045
    state.camera.position.x = pointer.x * 0.035
    state.camera.position.y = -pointer.y * 0.018
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

export function SceneContents({
  reducedMotion,
  pointerRef,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
}) {
  const size = useThree((state) => state.size)
  const aspect = size.width / Math.max(1, size.height)
  const layout = useMemo(() => computeSceneLayout(aspect), [aspect])

  return (
    <>
      <CameraRig pointerRef={pointerRef} reducedMotion={reducedMotion} />
      {/* One coherent "environment": a warm sun key + cool hemisphere fill shared
          by the Earth and the character, plus a faint cool kicker for depth. */}
      <hemisphereLight args={['#cfe3ff', '#0a0e1f', 0.8]} />
      <directionalLight
        position={SUN_POSITION}
        intensity={2.1}
        color="#fff3dd"
      />
      <directionalLight
        position={[-4, 1.2, 2.5]}
        intensity={0.22}
        color="#7f9bff"
      />
      <pointLight
        position={[0, 2.4, 6]}
        intensity={0.3}
        color="#dce8ff"
        distance={10}
        decay={2}
      />
      <SpaceStars reducedMotion={reducedMotion} />
      <Suspense fallback={null}>
        <PlanetEarth
          centerY={layout.earthCenterY}
          radius={layout.earthRadius}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </>
  )
}
