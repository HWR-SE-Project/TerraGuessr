import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Hud, Lightformer, OrthographicCamera, useAnimations, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import modelUrl from '../../../assets/home/scene/puppet-kid.glb?url'
import type { PointerState } from './hooks'
import { useHeadTracking } from './useHeadTracking'

export type CharacterStatus = 'loading' | 'ready' | 'error'

/** Measure actual skinned vertices over the idle cycle, including outlines.
 * Only the hierarchy/skeleton is cloned; cached geometry, materials and maps stay shared. */
function prepareModel(source: THREE.Group, clips: THREE.AnimationClip[]) {
  const model = clone(source)
  // SkeletonUtils clones a skeleton for every mesh, even when the GLB shares
  // one skin. Reuse that cloned skin so 18 meshes need only one bone texture.
  const sharedSkeletons = new Map<THREE.Skeleton, THREE.Skeleton>()
  model.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return
    const original = source.getObjectByName(node.name)
    if (!(original instanceof THREE.SkinnedMesh)) return
    const shared = sharedSkeletons.get(original.skeleton)
    if (shared) node.skeleton = shared
    else sharedSkeletons.set(original.skeleton, node.skeleton)
  })
  const idle = clips.find((clip) => /^idle$/i.test(clip.name))
  const bounds = new THREE.Box3()
  const measure = () => {
    model.updateMatrixWorld(true)
    model.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) node.skeleton.update()
    })
    bounds.union(new THREE.Box3().setFromObject(model, true))
  }
  if (idle) {
    const mixer = new THREE.AnimationMixer(model)
    mixer.clipAction(idle).play()
    for (let sample = 0; sample <= 24; sample++) {
      mixer.setTime((sample / 24) * idle.duration)
      measure()
    }
    mixer.stopAllAction()
    mixer.uncacheRoot(model)
  } else measure()
  return { model, idle, bounds, dimensions: bounds.getSize(new THREE.Vector3()) }
}

function Explorer({ reducedMotion, pointerRef, onStatus, onFeetPixelY }: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
  onStatus: (status: CharacterStatus) => void
  /** Reports the character's sole contact line (bottom of its animated bounding
   * box), in CSS pixels measured from the top of the canvas — the real
   * rendered foot position, not a DOM container's edge — so the planet in the
   * main scene can be anchored to where the feet actually are. */
  onFeetPixelY?: (y: number | null) => void
}) {
  const { scene, animations } = useGLTF(modelUrl)
  // eslint-disable-next-line no-console
  console.log('__DEBUG_CLIPS__', animations.map((clip) => clip.name))
  // eslint-disable-next-line no-console
  console.log('__DEBUG_IDLE_TRACKS__', animations.find((c) => /^idle$/i.test(c.name))?.tracks.map((t) => t.name))
  const { model, idle, bounds, dimensions } = useMemo(() => prepareModel(scene, animations), [scene, animations])
  // eslint-disable-next-line no-console
  console.log('__DEBUG_IDLE__', idle?.name, idle?.duration)
  // eslint-disable-next-line no-console
  console.log('__DEBUG_BONES__', (() => {
    const names: string[] = []
    model.traverse((n) => { if ((n as THREE.Bone).isBone) names.push(n.name) })
    return names
  })())
  const { actions, mixer } = useAnimations(animations, model)
  const skipResumeDelta = useRef(false)
  useHeadTracking(model, dimensions.y, pointerRef, reducedMotion)
  const { size, gl, invalidate, scene: hudScene } = useThree()
  const environmentTexture = useRef<THREE.Texture | null>(null)
  const [anchor, setAnchor] = useState({ x: 0, y: 0, scale: 0 })
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])

  useLayoutEffect(() => {
    const home = document.querySelector('.th-home')
    const slot = home?.querySelector('.th-character-slot')
    if (!slot) {
      onFeetPixelY?.(null)
      return
    }
    const update = () => {
      const canvas = gl.domElement.getBoundingClientRect()
      const target = slot.getBoundingClientRect()
      // Orthographic overlay units are CSS pixels. Fit both axes, retaining
      // room for the authored idle and the bounded pointer response.
      const scale = Math.min(target.width / dimensions.x, target.height / dimensions.y) * 0.94
      const slotCenterPx = target.top + target.height / 2 - canvas.top
      setAnchor({
        x: target.left + target.width / 2 - canvas.left - size.width / 2,
        y: size.height / 2 - slotCenterPx,
        scale,
      })
      // `dimensions`/`bounds` were unioned over the whole idle cycle (see
      // prepareModel), so this is the animated model's lowest sole point —
      // stable across frames, not recomputed per animation tick — projected
      // through the exact same fit transform the mesh itself renders with.
      onFeetPixelY?.(slotCenterPx + (dimensions.y / 2) * scale)
      invalidate()
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(slot)
    observer.observe(home!)
    return () => observer.disconnect()
  }, [size.width, size.height, gl, dimensions, invalidate, onFeetPixelY])

  useEffect(() => {
    const action = idle ? actions[idle.name] : undefined
    if (!action) return
    // Start only when the model/clip changes. Preference changes and status
    // callbacks must never restart the authored body movement.
    action.reset()
      .setLoop(THREE.LoopRepeat, Infinity)
      .setEffectiveWeight(1)
      .setEffectiveTimeScale(1)
      .play()
    mixer.update(0)
    return () => { action.stop() }
  }, [actions, idle, mixer])

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
      // The skeleton clone owns its bone texture; useGLTF owns shared assets.
      const skeletons = new Set<THREE.Skeleton>()
      model.traverse((node) => {
        if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton)
      })
      skeletons.forEach((skeleton) => skeleton.dispose())
      // Release the cached reflection derived from this HUD's owned texture.
      environmentTexture.current?.dispose()
    }
  }, [model])

  // Drei owns the sole playback update at priority 0. Preserve the authored
  // 1× timing even on slow visible frames; discard only the resume frame's
  // stale delta so a hidden tab never skips ahead in the idle cycle.
  const debugFrameCount = useRef(0)
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
    debugFrameCount.current += 1
    if (debugFrameCount.current % 20 === 0) {
      const action = idle ? actions[idle.name] : undefined
      // eslint-disable-next-line no-console
      console.log('__DEBUG_FRAME__', {
        frame: debugFrameCount.current,
        actionTime: action?.time,
        isRunning: action?.isRunning(),
        paused: action?.paused,
        enabled: action?.enabled,
        weight: action?.getEffectiveWeight(),
        timeScale: mixer.timeScale,
      })
    }
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
