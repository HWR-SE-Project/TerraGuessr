import { AvatarLighting } from './AvatarLighting'
import type { ComponentRef } from 'react'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useAvatarModel } from './useAvatarModel'
import type { AvatarConfig } from './avatarConfig'
import { usePrefersReducedMotion } from '../../scene/hooks'
import { SceneErrorBoundary } from '../../scene/SceneErrorBoundary'

export type PreviewCommand = { id: number; action: 'left' | 'right' | 'in' | 'out' | 'reset' }
function PreviewScene({ config, command, reducedMotion, onReady }: {
  config: AvatarConfig; command: PreviewCommand; reducedMotion: boolean; onReady: () => void
}) {
  const { model, bounds, dimensions } = useAvatarModel(config, reducedMotion)
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, size } = useThree()
  const scale = 3.5 / dimensions.y
  const distance = Math.max(6, dimensions.x * scale / (Math.max(1, size.width) / Math.max(1, size.height)) * 1.7)
  useEffect(() => { camera.position.set(0, 0, distance); controls.current?.update() }, [camera, distance])
  useEffect(onReady, [onReady])
  useEffect(() => {
    const orbit = controls.current
    if (!orbit || command.id === 0) return
    const offset = camera.position.clone().sub(orbit.target)
    if (command.action === 'reset') {
      camera.position.set(0, 0, distance)
      orbit.target.set(0, 0, 0)
    } else if (command.action === 'left' || command.action === 'right') {
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), command.action === 'left' ? -Math.PI / 6 : Math.PI / 6)
      camera.position.copy(orbit.target).add(offset)
    } else {
      offset.setLength(THREE.MathUtils.clamp(offset.length() * (command.action === 'in' ? 0.85 : 1.18), 4, distance * 1.65))
      camera.position.copy(orbit.target).add(offset)
    }
    orbit.update()
  }, [command, camera, distance])
  return <>
    <AvatarLighting />
    <group scale={scale}>
      <primitive object={model} position={[-center.x, -center.y, -center.z]} dispose={null} />
    </group>
    <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.09}
      minDistance={4} maxDistance={distance * 1.65} minPolarAngle={Math.PI * 0.28} maxPolarAngle={Math.PI * 0.65} />
  </>
}
export function AvatarPreview({ config, command, onReady, onError }: {
  config: AvatarConfig; command: PreviewCommand; onReady: () => void; onError: () => void
}) {
  const reducedMotion = usePrefersReducedMotion()
  return <SceneErrorBoundary fallback={null} onError={onError}>
    <Canvas aria-label="Interactive 3D avatar preview" dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 38 }}
      gl={{ antialias: true, alpha: true, toneMappingExposure: 1.15 }} onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', onError, { once: true })
      }}>
      <Suspense fallback={null}>
        <PreviewScene config={config} command={command} reducedMotion={reducedMotion} onReady={onReady} />
      </Suspense>
    </Canvas>
  </SceneErrorBoundary>
}
