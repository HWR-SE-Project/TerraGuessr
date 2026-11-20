import type { ComponentRef } from 'react'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useAvatarModel } from './useAvatarModel'
import type { AvatarConfig } from './avatarConfig'
import { usePrefersReducedMotion } from '../../pages/home/scene/hooks'
import { SceneErrorBoundary } from '../../pages/home/scene/SceneErrorBoundary'

export type PreviewCommand = { id: number; action: 'left' | 'right' | 'in' | 'out' | 'reset' }
function PreviewScene({ config, command, reducedMotion, onReady }: {
  config: AvatarConfig; command: PreviewCommand; reducedMotion: boolean; onReady: () => void
}) {
  const { model, bounds, dimensions, mixer, idle, actions } = useAvatarModel(config)
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera, size } = useThree()
  const scale = 3.5 / dimensions.y
  const distance = Math.max(6, dimensions.x * scale / (Math.max(1, size.width) / Math.max(1, size.height)) * 1.7)
  useEffect(() => { camera.position.set(0, 0, distance); controls.current?.update() }, [camera, distance])
  useEffect(() => {
    const action = idle ? actions[idle.name] : null
    // AnimationAction is an owned mutable Three.js resource.
    // oxlint-disable-next-line react/immutability
    if (action) action.paused = reducedMotion
    onReady()
  }, [actions, idle, reducedMotion, onReady])
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
  // oxlint-disable-next-line react/immutability
  useFrame(() => { mixer.timeScale = reducedMotion || document.hidden ? 0 : 1 }, -1)
  return <>
    <hemisphereLight args={['#e7efff', '#394353', 0.7]} />
    <directionalLight position={[5, 5, 8]} color="#fff3df" intensity={2.1} />
    <directionalLight position={[-4, 2, 6]} color="#e0eaff" intensity={0.8} />
    <directionalLight position={[-3, 4, -5]} color="#b8d9ff" intensity={1.2} />
    <Environment resolution={64} frames={1} environmentIntensity={0.65}>
      <Lightformer position={[4, 5, 5]} rotation={[0, -Math.PI / 4, 0]} scale={[5, 5, 1]} intensity={2} color="#fff3df" />
      <Lightformer position={[-4, 2, 3]} rotation={[0, Math.PI / 4, 0]} scale={[4, 5, 1]} intensity={1} color="#e0eaff" />
      <Lightformer position={[0, 4, -4]} scale={[4, 3, 1]} intensity={1.5} color="#b8d9ff" />
    </Environment>
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
