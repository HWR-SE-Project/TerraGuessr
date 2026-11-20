import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import modelUrl from '../../../assets/home/scene/earth-origami.glb?url'
import { EARTH_Z, OCEAN_FILL, SUN_DIRECTION } from './composition'

// Thin, sun-aware rim glow: a tight bright core hugging the silhouette plus a
// soft outer bleed, tinted warm where the limb faces the sun and cool blue
// everywhere else — a thin horizon haze, not a thick floating ring. Sized off
// the model's own ocean-sphere radius (see useOrigamiEarth) so it hugs the
// actual low-poly globe regardless of the asset's native scale/units.
const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  uniform vec3 glowColor;
  uniform vec3 sunGlowColor;
  uniform vec3 sunDirection;
  uniform float intensity;
  uniform float coreWidth;
  uniform float softWidth;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float facing = abs(dot(normalize(vWorldNormal), viewDir));
    float core = 1.0 - smoothstep(0.0, coreWidth, facing);
    float soft = 1.0 - smoothstep(0.0, softWidth, facing);
    float rim = core * 0.85 + soft * 0.3;
    float sunFacing = clamp(dot(normalize(vWorldNormal), normalize(sunDirection)), 0.0, 1.0);
    vec3 color = mix(glowColor, sunGlowColor, pow(sunFacing, 2.4));
    float alpha = clamp(rim, 0.0, 1.0) * intensity * mix(0.55, 1.0, pow(sunFacing, 1.6));
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

/** A fixed starting yaw/tilt so the model's continents present an attractive
 * silhouette on first paint, independent of however the source FBX->glTF
 * export happened to orient the globe. */
const INITIAL_ROTATION: [number, number, number] = [-0.18, 1.55, 0.06]

/** One full spin every ~75s (within the 60-90s target band) — slow enough to
 * read as a stately drift rather than a spinning toy, fast enough that a
 * visitor who lingers on the page actually sees new continents rotate past. */
const ROTATION_RADIANS_PER_SECOND = (2 * Math.PI) / 75

/**
 * The source glTF is ~214 separate low-poly facet meshes (one small mesh per
 * folded "paper" piece: ocean, continents, and scattered tree/flower
 * decoration) sharing just 7 flat-color materials, each facet carrying its
 * own baked world transform from the original FBX import. Collapsing
 * same-material facets into a single merged mesh (7 draw calls total instead
 * of ~214) is a straightforward win and preserves the authored geometry,
 * materials and colors exactly — it only removes the unused UV channel (the
 * model has no textures to sample).
 *
 * Composition needs a reliable "planet radius", but the model's overall
 * bounding sphere is a poor proxy for it: tree/flower decoration is
 * scattered broadly across the globe's surface, so merging it inflates (or,
 * for a single sparse decoration mesh, can even deflate) the naive
 * bounding-sphere radius relative to the body of the planet. At the huge,
 * mostly-cropped, near-camera scale this scene uses, that mismatch is the
 * difference between the globe filling the frame correctly and the entire
 * model projecting below the visible viewport. The "Blue" ocean material is
 * the one true sphere in the asset — anchoring scale/centering on its own
 * bounding sphere instead reproduces the same reliable placement the
 * previous procedural (perfect-sphere) Earth relied on; decorations then
 * render at whatever size that implies, including poking above the nominal
 * silhouette, which reads as intentional texture rather than a composition
 * error.
 */
function useOrigamiEarth(source: THREE.Object3D) {
  const result = useMemo(() => {
    source.updateMatrixWorld(true)
    const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>()
    source.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      const material = Array.isArray(node.material) ? node.material[0] : node.material
      const base = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry
      const clean = new THREE.BufferGeometry()
      clean.setAttribute('position', base.getAttribute('position').clone())
      clean.setAttribute('normal', base.getAttribute('normal').clone())
      if (base !== node.geometry) base.dispose()
      clean.applyMatrix4(node.matrixWorld)
      const entry: { material: THREE.Material; geometries: THREE.BufferGeometry[] } =
        groups.get(material.uuid) ?? { material, geometries: [] }
      entry.geometries.push(clean)
      groups.set(material.uuid, entry)
    })

    const group = new THREE.Group()
    const ownedGeometries: THREE.BufferGeometry[] = []
    let anchor: THREE.Sphere | null = null
    groups.forEach(({ material, geometries }) => {
      const merged = mergeGeometries(geometries, false)
      geometries.forEach(geometry => geometry.dispose())
      if (!merged) return
      ownedGeometries.push(merged)
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, material)
      group.add(mesh)
      if (material.name === 'Blue' && merged.boundingSphere) anchor = merged.boundingSphere
    })
    if (group.children.length === 0) group.add(source.clone(true))

    const box = new THREE.Box3().setFromObject(group)
    const fallback = box.getBoundingSphere(new THREE.Sphere())
    return { group, sphere: anchor ?? fallback, ownedGeometries }
  }, [source])
  // The GLTF cache owns its source assets; this hook owns only the seven
  // merged buffers attached to the primitive (which R3F cannot auto-dispose).
  useEffect(() => () => result.ownedGeometries.forEach(geometry => geometry.dispose()), [result])
  return result
}

export function PlanetEarth({
  centerY,
  radius,
  reducedMotion,
}: {
  centerY: number
  radius: number
  reducedMotion: boolean
}) {
  const { scene } = useGLTF(modelUrl)
  const { group: earthModel, sphere } = useOrigamiEarth(scene)

  // The tallest decoration (mountains/trees) on this asset reaches roughly
  // 1.6-2x the ocean shell's own radius, so matching the ocean exactly to
  // `radius` (as a perfect sphere would be) over-scales the globe and lets
  // decoration dominate the frame. OCEAN_FILL (shared with composition.ts,
  // which relies on it to anchor the apex to the real rendered surface)
  // tunes the ocean shell to a fraction of `radius`, tuned against real
  // screenshots so the horizon, decoration scale, and character all read
  // correctly together.
  const modelScale = sphere.radius > 0 ? (radius * OCEAN_FILL) / sphere.radius : 1
  const modelOffset: [number, number, number] = [
    -sphere.center.x * modelScale,
    -sphere.center.y * modelScale,
    -sphere.center.z * modelScale,
  ]

  const rotatingGroup = useRef<THREE.Group>(null)

  const outerUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color('#79c3ff') },
      sunGlowColor: { value: new THREE.Color('#ffdba3') },
      sunDirection: { value: new THREE.Vector3(...SUN_DIRECTION) },
      intensity: { value: 0.65 },
      coreWidth: { value: 0.012 },
      softWidth: { value: 0.18 },
    }),
    [],
  )
  const innerUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color('#bfe0ff') },
      sunGlowColor: { value: new THREE.Color('#ffe6c2') },
      sunDirection: { value: new THREE.Vector3(...SUN_DIRECTION) },
      intensity: { value: 0.65 },
      coreWidth: { value: 0.03 },
      softWidth: { value: 0.3 },
    }),
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion) return
    if (rotatingGroup.current) rotatingGroup.current.rotation.y += delta * ROTATION_RADIANS_PER_SECOND
  })

  return (
    <group position={[0, centerY, EARTH_Z]}>
      <group ref={rotatingGroup} rotation={INITIAL_ROTATION}>
        <group scale={modelScale} position={modelOffset}>
          <primitive object={earthModel} dispose={null} />
        </group>
      </group>
      {/* Inner haze: sits just outside the ocean shell and blends the glow
          into the day-side facets near the limb instead of leaving a seam. */}
      <mesh scale={1.012}>
        <sphereGeometry args={[radius, 96, 72]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={innerUniforms}
          transparent
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Outer glow: soft bloom bleeding into space beyond the silhouette. */}
      <mesh scale={1.024}>
        <sphereGeometry args={[radius, 96, 72]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={outerUniforms}
          transparent
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload(modelUrl)
