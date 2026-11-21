import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { AvatarConfig, AvatarPart } from '../lib/contracts'
import modelUrl from '../assets/scene/puppet-kid.glb?url'

// Asset-specific avatar pipeline for puppet-kid.glb. The GLB's body parts are
// flat-colour meshes; we tint them by injecting a small uniform into each
// material's shader, preserving the authored maps and UVs (and iris UV masking
// keeps the whites of the eyes). Mesh names/references are intrinsic to the
// shipped asset, not app architecture.

const MESH_PARTS: Record<string, { part: AvatarPart; reference: number }> = {
  Object_44: { part: 'hairColor', reference: 0.16 },
  Object_50: { part: 'hairColor', reference: 0.16 },
  Object_47: { part: 'eyeColor', reference: 0.05 },
  Object_56: { part: 'shoeColor', reference: 0.055 },
  Object_59: { part: 'shirtColor', reference: 0.5 },
  Object_62: { part: 'pantsColor', reference: 0.13 },
}

interface TintBinding {
  part: AvatarPart
  material: THREE.MeshStandardMaterial
  color: { value: THREE.Color }
  enabled: { value: number }
}

function createAvatarMaterials(model: THREE.Object3D) {
  const bindings: TintBinding[] = []
  model.traverse((node) => {
    const spec = MESH_PARTS[node.name]
    if (!spec || !(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return
    const material = node.material.clone()
    node.material = material
    const color = { value: new THREE.Color('#ffffff') }
    const enabled = { value: 0 }
    material.onBeforeCompile = (shader) => {
      shader.uniforms.avatarColor = color
      shader.uniforms.avatarEnabled = enabled
      shader.fragmentShader = `uniform vec3 avatarColor;\nuniform float avatarEnabled;\n${shader.fragmentShader}`
      const tint = (sample: string, uv: string) => `
        float avatarMask = ${spec.part === 'eyeColor' ? `step(0.6, ${uv}.x)` : '1.0'};
        float avatarShade = clamp(max(max(${sample}.r, ${sample}.g), ${sample}.b) / ${spec.reference.toFixed(3)}, 0.35, 1.4);
        ${sample}.rgb = mix(${sample}.rgb, avatarColor * avatarShade, avatarEnabled * avatarMask);
      `
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          { ${tint('sampledDiffuseColor', 'vMapUv')} }
          diffuseColor *= sampledDiffuseColor;
        #endif`)
        .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
          vec4 avatarEmissive = texture2D(emissiveMap, vEmissiveMapUv);
          { ${tint('avatarEmissive', 'vEmissiveMapUv')} }
          totalEmissiveRadiance *= avatarEmissive.rgb;
        #endif`)
    }
    material.customProgramCacheKey = () => `avatar-tint-v1-${spec.part}`
    bindings.push({ part: spec.part, material, color, enabled })
  })
  return {
    apply(config: AvatarConfig) {
      for (const binding of bindings) {
        const value = config[binding.part]
        binding.enabled.value = value == null ? 0 : 1
        if (value) binding.color.value.set(value)
      }
    },
    dispose() {
      bindings.forEach((binding) => binding.material.dispose())
    },
  }
}

interface Prepared {
  model: THREE.Group
  idle: THREE.AnimationClip | null
  bounds: THREE.Box3
  dimensions: THREE.Vector3
}

function prepareModel(source: THREE.Group, clips: THREE.AnimationClip[]): Prepared {
  const model = clone(source) as THREE.Group
  // Reuse a single cloned skeleton per shared skin so 18 meshes need one bone texture.
  const sharedSkeletons = new Map<THREE.Skeleton, THREE.Skeleton>()
  model.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh)) return
    const original = source.getObjectByName(node.name)
    if (!(original instanceof THREE.SkinnedMesh)) return
    const shared = sharedSkeletons.get(original.skeleton)
    if (shared) node.skeleton = shared
    else sharedSkeletons.set(original.skeleton, node.skeleton)
  })
  const idle = clips.find((clip) => /^idle$/i.test(clip.name)) ?? null
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
  } else {
    measure()
  }
  return { model, idle, bounds, dimensions: bounds.getSize(new THREE.Vector3()) }
}

/** Shared hook: load, tint, animate and clean up the explorer character. */
export function useAvatarModel(config: AvatarConfig, reducedMotion: boolean) {
  const { scene, animations } = useGLTF(modelUrl)
  const prepared = useMemo(() => {
    const result = prepareModel(scene, animations)
    return { ...result, materials: createAvatarMaterials(result.model) }
  }, [scene, animations])
  const { model, idle, bounds, dimensions, materials } = prepared
  const { actions, mixer } = useAnimations(animations, model)

  useEffect(() => {
    materials.apply(config)
  }, [materials, config])

  useEffect(() => {
    const action = idle ? actions[idle.name] : undefined
    if (!action) return
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    mixer.update(0)
    return () => {
      action.stop()
    }
  }, [actions, idle, mixer])

  useFrame(() => {
    mixer.timeScale = reducedMotion ? 0 : 1
  }, -1)

  useEffect(
    () => () => {
      materials.dispose()
      const skeletons = new Set<THREE.Skeleton>()
      model.traverse((node) => {
        if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton)
      })
      skeletons.forEach((skeleton) => skeleton.dispose())
    },
    [materials, model],
  )

  return { model, bounds, dimensions }
}

useGLTF.preload(modelUrl)
