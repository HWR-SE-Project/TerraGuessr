import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { CharacterLighting } from './Character'
import { useAvatarModel } from './avatar'
import { usePrefersReducedMotion } from './hooks'
import type { AvatarConfig } from '../lib/contracts'

// The default Canvas camera keeps an identity rotation (it never auto-aims at the
// origin), so we explicitly look at the character's vertical center every frame —
// that keeps the fit math below honest about where the visible frame is centered.
const LOOK_TARGET = new THREE.Vector3(0, 0, 0)

function PreviewModel({ config, reducedMotion }: { config: AvatarConfig; reducedMotion: boolean }) {
  const { model, bounds, dimensions } = useAvatarModel(config, reducedMotion)
  const { viewport } = useThree()
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])

  // Fit the full body into the frame with headroom above and floor room for the shadow below.
  const fit = Math.min((viewport.width * 0.64) / dimensions.x, (viewport.height * 0.84) / dimensions.y)
  const feetY = -(fit * dimensions.y) / 2

  const rig = useRef<THREE.Group>(null)
  const elapsed = useRef(0)

  useFrame((state, delta) => {
    state.camera.lookAt(LOOK_TARGET)
    if (!rig.current) return
    if (reducedMotion) {
      rig.current.position.y = 0
      return
    }
    elapsed.current += delta
    rig.current.rotation.y += delta * 0.45
    rig.current.position.y = Math.sin(elapsed.current * 1.4) * 0.02
  })

  return (
    <>
      <CharacterLighting />
      <group ref={rig}>
        <group scale={fit}>
          <primitive object={model} position={[-center.x, -center.y, -center.z]} dispose={null} />
        </group>
      </group>
      <ContactShadows
        position={[0, feetY + 0.005, 0]}
        opacity={0.7}
        scale={Math.max(dimensions.x, dimensions.z) * fit * 1.6}
        blur={2.6}
        far={1.6}
        resolution={512}
        color="#050314"
        frames={reducedMotion ? 1 : Infinity}
      />
    </>
  )
}

/** Turntable preview of the explorer used in the avatar editor. */
export function AvatarPreview({ config }: { config: AvatarConfig }) {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <Canvas
      camera={{ position: [0, 0.3, 4.6], fov: 30 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <PreviewModel config={config} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
