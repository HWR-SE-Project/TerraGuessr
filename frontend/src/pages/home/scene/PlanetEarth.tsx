import { useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import earthDayUrl from '../../../assets/home/scene/earth_day.jpg'
import earthNormalUrl from '../../../assets/home/scene/earth_normal.jpg'
import earthCloudsUrl from '../../../assets/home/scene/earth_clouds.png'
import { SUN_DIRECTION } from './composition'

// Thin, sun-aware rim glow: a tight bright core hugging the silhouette plus a
// soft outer bleed, tinted warm where the limb faces the sun and cool blue
// everywhere else — replaces the old flat, thick, view-independent ring.
// Fresnel computed from the true per-fragment view direction (world space),
// not a fixed camera-forward axis — required here because the globe is huge,
// close to the camera, and composed mostly off-axis/below the viewport, so a
// fixed-axis approximation drifts far from the actual silhouette and reads as
// a thick floating ring instead of a thin limb glow.
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
    float facing = clamp(dot(normalize(vWorldNormal), viewDir), -1.0, 1.0);
    float core = 1.0 - smoothstep(0.0, coreWidth, facing);
    float soft = 1.0 - smoothstep(0.0, softWidth, facing);
    float rim = core * 0.85 + soft * 0.3;
    float sunFacing = clamp(dot(normalize(vWorldNormal), normalize(sunDirection)), 0.0, 1.0);
    vec3 color = mix(glowColor, sunGlowColor, pow(sunFacing, 2.4));
    float alpha = clamp(rim, 0.0, 1.0) * intensity * mix(0.55, 1.0, pow(sunFacing, 1.6));
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`

export function PlanetEarth({
  centerY,
  radius,
  reducedMotion,
}: {
  centerY: number
  radius: number
  reducedMotion: boolean
}) {
  const [day, normal, clouds] = useLoader(THREE.TextureLoader, [
    earthDayUrl,
    earthNormalUrl,
    earthCloudsUrl,
  ])
  // three.js textures are mutable GPU resources; configuring color space/filtering
  // on the loader's cached instance is the standard r3f pattern, not stray state mutation.
  // oxlint-disable-next-line react/immutability
  day.colorSpace = THREE.SRGBColorSpace
  // oxlint-disable-next-line react/immutability
  clouds.colorSpace = THREE.SRGBColorSpace
  // oxlint-disable-next-line react/immutability
  day.anisotropy = 4

  const rotatingGroup = useRef<THREE.Group>(null)
  const cloudsMesh = useRef<THREE.Mesh>(null)

  const outerUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color('#79c3ff') },
      sunGlowColor: { value: new THREE.Color('#ffdba3') },
      sunDirection: { value: new THREE.Vector3(...SUN_DIRECTION) },
      intensity: { value: 1.3 },
      coreWidth: { value: 0.012 },
      softWidth: { value: 0.045 },
    }),
    [],
  )
  const innerUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color('#bfe0ff') },
      sunGlowColor: { value: new THREE.Color('#ffe6c2') },
      sunDirection: { value: new THREE.Vector3(...SUN_DIRECTION) },
      intensity: { value: 0.6 },
      coreWidth: { value: 0.015 },
      softWidth: { value: 0.05 },
    }),
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion) return
    if (rotatingGroup.current) rotatingGroup.current.rotation.y += delta * 0.014
    if (cloudsMesh.current) cloudsMesh.current.rotation.y += delta * 0.021
  })

  return (
    <group position={[0, centerY, -3.4]}>
      <group ref={rotatingGroup} rotation={[0.08, 1.15, 0]}>
        <mesh>
          <sphereGeometry args={[radius, 96, 96]} />
          <meshStandardMaterial
            map={day}
            normalMap={normal}
            normalScale={new THREE.Vector2(0.55, 0.55)}
            roughness={0.88}
            metalness={0}
          />
        </mesh>
        <mesh ref={cloudsMesh} scale={1.009}>
          <sphereGeometry args={[radius, 72, 72]} />
          <meshStandardMaterial
            map={clouds}
            transparent
            opacity={0.55}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      </group>
      {/* Inner haze: sits just outside the textured surface and blends the glow
          into the day-side pixels near the limb instead of leaving a seam. */}
      <mesh scale={1.004}>
        <sphereGeometry args={[radius, 96, 96]} />
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
      <mesh scale={1.022}>
        <sphereGeometry args={[radius, 96, 96]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={outerUniforms}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
