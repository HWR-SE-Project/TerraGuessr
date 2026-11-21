import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import modelUrl from '../assets/scene/earth-origami.glb?url'

const EARTH_Z = -3.4
const OCEAN_FILL = 0.8
const ROTATION_RADIANS_PER_SECOND = (2 * Math.PI) / 75
const INITIAL_ROTATION: [number, number, number] = [-0.18, 1.55, 0.06]

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

// Collapse the ~214 authored facet meshes into one mesh per material (7 draw
// calls) so the hero stays cheap, preserving authored geometry and colours.
function useMergedEarth(source: THREE.Object3D) {
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
      const entry = groups.get(material.uuid) ?? { material, geometries: [] as THREE.BufferGeometry[] }
      entry.geometries.push(clean)
      groups.set(material.uuid, entry)
    })

    const group = new THREE.Group()
    const owned: THREE.BufferGeometry[] = []
    let anchor: THREE.Sphere | null = null
    groups.forEach(({ material, geometries }) => {
      const merged = mergeGeometries(geometries, false)
      geometries.forEach((geometry) => geometry.dispose())
      if (!merged) return
      owned.push(merged)
      merged.computeBoundingSphere()
      group.add(new THREE.Mesh(merged, material))
      if (material.name === 'Blue' && merged.boundingSphere) anchor = merged.boundingSphere
    })
    if (group.children.length === 0) group.add(source.clone(true))
    const box = new THREE.Box3().setFromObject(group)
    const fallback = box.getBoundingSphere(new THREE.Sphere())
    return { group, sphere: anchor ?? fallback, owned }
  }, [source])

  useEffect(() => () => result.owned.forEach((geometry) => geometry.dispose()), [result])
  return result
}

export function PlanetEarth({ radius, reducedMotion }: { radius: number; reducedMotion: boolean }) {
  const { scene } = useGLTF(modelUrl)
  const { group: earthModel, sphere } = useMergedEarth(scene)

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
      sunDirection: { value: new THREE.Vector3(0.52, 0.34, 0.79) },
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
      sunDirection: { value: new THREE.Vector3(0.52, 0.34, 0.79) },
      intensity: { value: 0.65 },
      coreWidth: { value: 0.03 },
      softWidth: { value: 0.3 },
    }),
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !rotatingGroup.current) return
    rotatingGroup.current.rotation.y += delta * ROTATION_RADIANS_PER_SECOND
  })

  return (
    <group name="planet" position={[0, 0, EARTH_Z]}>
      <group ref={rotatingGroup} rotation={INITIAL_ROTATION}>
        <group scale={modelScale} position={modelOffset}>
          <primitive object={earthModel} dispose={null} />
        </group>
      </group>
      <mesh scale={radius * 1.012}>
        <sphereGeometry args={[1, 96, 72]} />
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
      <mesh scale={radius * 1.024}>
        <sphereGeometry args={[1, 96, 72]} />
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
