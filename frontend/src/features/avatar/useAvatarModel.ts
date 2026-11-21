import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import modelUrl from '../../assets/home/scene/puppet-kid.glb?url'
import { prepareModel } from './avatarModel'
import { createAvatarMaterials } from './avatarMaterials'
import type { AvatarConfig } from './avatarConfig'

/** Shared model, isolated rig/material instances, authored idle, and ownership. */
export function useAvatarModel(config: AvatarConfig, reducedMotion: boolean) {
  const { scene, animations } = useGLTF(modelUrl)
  // Construct the hierarchy and its materials atomically. A separate memo that
  // mutates the retained model can bind the discarded material pass in StrictMode.
  const prepared = useMemo(() => {
    const result = prepareModel(scene, animations)
    return { ...result, materials: createAvatarMaterials(result.model) }
  }, [scene, animations])
  const { model, idle, materials } = prepared
  const { actions, mixer } = useAnimations(animations, model)
  const invalidate = useThree(state => state.invalidate)
  const skipResumeDelta = useRef(false)
  useLayoutEffect(() => { materials.apply(config); invalidate() }, [materials, config, invalidate])
  useEffect(() => {
    const action = idle ? actions[idle.name] : undefined
    if (!action) return
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    mixer.update(0)
    return () => { action.stop() }
  }, [actions, idle, mixer])
  useEffect(() => {
    const action = idle ? actions[idle.name] : undefined
    // AnimationAction is an owned, mutable Three.js resource.
    // oxlint-disable-next-line react/immutability
    if (action) action.paused = reducedMotion
    skipResumeDelta.current = true
    invalidate()
  }, [actions, idle, reducedMotion, invalidate])
  useEffect(() => {
    const visibility = () => { skipResumeDelta.current = true; if (!document.hidden) invalidate() }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [invalidate])
  // Drei updates playback at priority 0. Keep authored 1× timing and discard
  // only the stale delta after a hidden tab or reduced-motion pause.
  useFrame(() => {
    // oxlint-disable-next-line react/immutability
    mixer.timeScale = reducedMotion || document.hidden || skipResumeDelta.current ? 0 : 1
    skipResumeDelta.current = false
  }, -1)
  useEffect(() => () => {
    materials.dispose()
    const skeletons = new Set<THREE.Skeleton>()
    model.traverse(node => { if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton) })
    skeletons.forEach(skeleton => skeleton.dispose())
  }, [materials, model])
  return { model, bounds: prepared.bounds, dimensions: prepared.dimensions }
}
