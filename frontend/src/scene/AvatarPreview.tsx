import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CharacterLighting } from './Character'
import { useAvatarModel } from './avatar'
import { usePrefersReducedMotion } from './hooks'
import type { AvatarConfig } from '../lib/contracts'

function PreviewModel({ config, reducedMotion }: { config: AvatarConfig; reducedMotion: boolean }) {
  const { model, bounds, dimensions } = useAvatarModel(config, reducedMotion)
  const { size, viewport } = useThree()
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])

  // Fit the character to the viewport with a small margin.
  const fit = Math.min((viewport.width * 0.62) / dimensions.x, (viewport.height * 0.7) / dimensions.y)
  const turntable = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (reducedMotion || !turntable.current) return
    turntable.current.rotation.y += delta * 0.5
  })

  void size

  return (
    <>
      <CharacterLighting />
      <group ref={turntable}>
        <group position={[0, -dimensions.y / 2 - 0.15, 0]} scale={fit}>
          <primitive object={model} position={[-center.x, -center.y, -center.z]} dispose={null} />
        </group>
      </group>
    </>
  )
}

/** Turntable preview of the explorer used in the avatar editor. */
export function AvatarPreview({ config }: { config: AvatarConfig }) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <Canvas
      camera={{ position: [0, 0.2, 5], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <PreviewModel config={config} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
