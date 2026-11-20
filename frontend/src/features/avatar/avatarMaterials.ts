import * as THREE from 'three'
import type { AvatarConfig, AvatarPart } from './avatarConfig'

// GLB mesh nodes, not the identically named empty authoring placeholders.
const MESH_PARTS: Record<string, { part: AvatarPart; reference: number }> = {
  Object_44: { part: 'hairColor', reference: 0.16 }, // eyebrows
  Object_50: { part: 'hairColor', reference: 0.16 },
  Object_47: { part: 'eyeColor', reference: 0.05 },
  Object_56: { part: 'shoeColor', reference: 0.055 },
  Object_59: { part: 'shirtColor', reference: 0.5 },
  Object_62: { part: 'pantsColor', reference: 0.13 },
}

/** Tint both texture contributions. Editing only `color` leaves this GLB's
 * emissive atlas unchanged. The original maps/UVs and their shading remain;
 * iris UV masking preserves the whites of the eyes. Defaults bypass the tint. */
export function createAvatarMaterials(model: THREE.Object3D) {
  const bindings: Array<{
    part: AvatarPart
    material: THREE.MeshStandardMaterial
    color: { value: THREE.Color }
    enabled: { value: number }
  }> = []
  model.traverse(node => {
    const spec = MESH_PARTS[node.name]
    if (!spec || !(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return
    const material = node.material.clone()
    node.material = material
    const color = { value: new THREE.Color('#ffffff') }
    const enabled = { value: 0 }
    material.onBeforeCompile = shader => {
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
    dispose() { bindings.forEach(binding => binding.material.dispose()) },
  }
}
