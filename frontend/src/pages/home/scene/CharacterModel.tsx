import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Hud, Lightformer, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PointerState } from './hooks'
import { useHeadTracking } from './useHeadTracking'
import { useAvatarModel } from '../../../features/avatar/useAvatarModel'
import { useSavedAvatar } from '../../../features/avatar/avatarConfigService'
import type { HomeLayout } from './useHomeLayout'

export type CharacterStatus = 'loading' | 'ready' | 'error'


function Explorer({ reducedMotion, pointerRef, onStatus, onFeetPixelY, layout }: {
  reducedMotion: boolean
  layout: HomeLayout | null
  pointerRef: React.RefObject<PointerState>
  onStatus: (status: CharacterStatus) => void
  /** Reports the character's sole contact line (bottom of its animated bounding
   * box), in CSS pixels measured from the top of the canvas — the real
   * rendered foot position, not a DOM container's edge — so the planet in the
   * main scene can be anchored to where the feet actually are. */
  onFeetPixelY?: (y: number | null) => void
}) {
  const config = useSavedAvatar()
  const { model, idle, bounds, dimensions, actions, mixer } = useAvatarModel(config)
  const skipResumeDelta = useRef(false)
  useHeadTracking(model, dimensions.y, pointerRef, reducedMotion)
  const { size, invalidate, scene: hudScene } = useThree()
  const environmentTexture = useRef<THREE.Texture | null>(null)
  const scale = layout ? Math.min(layout.width / dimensions.x, layout.height / dimensions.y) * 0.94 : 0
  const anchor = {
    x: layout ? layout.left + layout.width / 2 - size.width / 2 : 0,
    y: layout ? size.height / 2 - layout.top - layout.height / 2 : 0,
    scale,
  }
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])

  useLayoutEffect(() => {
    onFeetPixelY?.(layout ? layout.top + layout.height / 2 + dimensions.y * scale / 2 : null)
    invalidate()
  }, [layout, scale, dimensions.y, onFeetPixelY, invalidate])

  useEffect(() => {
    const action = idle ? actions[idle.name] : undefined
    if (action) {
      // AnimationAction is a mutable Three.js resource, not React state.
      // oxlint-disable-next-line react/immutability
      action.paused = reducedMotion
    }
    // Resume from the same clip time after a long reduced-motion pause,
    // rather than letting the first frame include time spent paused.
    skipResumeDelta.current = true
    invalidate()
  }, [actions, idle, reducedMotion, invalidate])

  useEffect(() => {
    onStatus('ready')
    invalidate()
  }, [onStatus, invalidate])

  useEffect(() => {
    const onVisibility = () => {
      skipResumeDelta.current = true
      if (!document.hidden) invalidate()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [invalidate])

  useEffect(() => {
    return () => {
      // Release the cached reflection derived from this HUD's owned texture.
      environmentTexture.current?.dispose()
    }
  }, [model])

  // Drei owns the sole playback update at priority 0. Preserve the authored
  // 1× timing even on slow visible frames; discard only the resume frame's
  // stale delta so a hidden tab never skips ahead in the idle cycle.
  useFrame(() => {
    if (hudScene.environment && environmentTexture.current !== hudScene.environment) {
      environmentTexture.current = hudScene.environment
      // This is a single-frame capture. Normalize its initial version so Three
      // uses the initial PMREM path that registers source-disposal cleanup.
      // The render-target update path omits that listener in Three r187.
      environmentTexture.current.pmremVersion = 0
    }
    // oxlint-disable-next-line react/immutability
    mixer.timeScale = reducedMotion || document.hidden || skipResumeDelta.current ? 0 : 1
    skipResumeDelta.current = false
  }, -1)

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 1000]} near={0.1} far={2000}
        left={-size.width / 2} right={size.width / 2} top={size.height / 2} bottom={-size.height / 2} />
      <hemisphereLight args={['#e7efff', '#394353', 0.7]} />
      <directionalLight position={[5, 5, 8]} color="#fff3df" intensity={2.1} />
      <directionalLight position={[-4, 2, 6]} color="#e0eaff" intensity={0.8} />
      <directionalLight position={[-3, 4, -5]} color="#b8d9ff" intensity={1.2} />
      {/* Local softboxes illuminate the original metallic/emissive material.
          No network HDRI or changes to the Earth's illumination. */}
      <Environment resolution={64} frames={1} environmentIntensity={0.65}>
        <Lightformer position={[4, 5, 5]} rotation={[0, -Math.PI / 4, 0]} scale={[5, 5, 1]} intensity={2} color="#fff3df" />
        <Lightformer position={[-4, 2, 3]} rotation={[0, Math.PI / 4, 0]} scale={[4, 5, 1]} intensity={1} color="#e0eaff" />
        <Lightformer position={[0, 4, -4]} scale={[4, 3, 1]} intensity={1.5} color="#b8d9ff" />
      </Environment>
      <group name="home-explorer-fit" position={[anchor.x, anchor.y, 0]} scale={anchor.scale}>
        <group name="home-explorer-motion">
          <primitive object={model} position={[-center.x, -center.y, -center.z]} dispose={null} />
        </group>
      </group>
    </>
  )
}

/** Separate depth pass in the existing WebGL context: a human-scale explorer
 * sits above the cinematic Earth without intersecting its huge mesh. */
export function CharacterModel(props: Parameters<typeof Explorer>[0]) {
  return <Hud><Explorer {...props} /></Hud>
}
