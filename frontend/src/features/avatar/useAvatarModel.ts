import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import modelUrl from '../../assets/home/scene/puppet-kid.glb?url'
import { prepareModel } from './avatarModel'
import { createAvatarMaterials } from './avatarMaterials'
import type { AvatarConfig } from './avatarConfig'

/** Shared model, isolated rig/material instances, authored idle, and ownership. */
export function useAvatarModel(config: AvatarConfig) {
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
  useLayoutEffect(() => { materials.apply(config); invalidate() }, [materials, config, invalidate])
  useEffect(() => {
    const action = idle ? actions[idle.name] : undefined
    if (!action) return
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    mixer.update(0)
    return () => { action.stop() }
  }, [actions, idle, mixer])
  useEffect(() => () => {
    materials.dispose()
    const skeletons = new Set<THREE.Skeleton>()
    model.traverse(node => { if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton) })
    skeletons.forEach(skeleton => skeleton.dispose())
  }, [materials, model])
  return { ...prepared, actions, mixer }
}
