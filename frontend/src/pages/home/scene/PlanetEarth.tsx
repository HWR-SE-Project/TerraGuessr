import { useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import earthDayUrl from '../../../assets/home/scene/earth-day-4k.webp'
import earthDayMobileUrl from '../../../assets/home/scene/earth-day-2k.webp'
import earthCloudsUrl from '../../../assets/home/scene/earth-clouds-2k.webp'
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
  varying vec2 vUv;
  void main() {
    vUv = uv;
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

// Composite clouds directly on the lit surface. Separate low-poly transparent
// shells can intersect the planet near its grazing horizon and lose cloud detail.
const SURFACE_FRAGMENT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  uniform sampler2D dayMap;
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  uniform float cloudOffset;
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float sunlight = max(dot(n, normalize(sunDirection)), 0.0);
    vec3 surface = texture2D(dayMap, vUv).rgb;
    float clouds = texture2D(cloudMap, vec2(fract(vUv.x + cloudOffset), vUv.y)).r;
    surface = mix(surface, vec3(0.88, 0.93, 1.0), smoothstep(0.06, 0.8, clouds) * 0.86);
    surface *= 0.5 + sunlight * 0.9;
    float haze = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
    surface = mix(surface, vec3(0.13, 0.34, 0.56), haze * 0.44);
    gl_FragColor = vec4(surface, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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
  const [dayTextureUrl] = useState(() =>
    window.innerWidth <= 700 ? earthDayMobileUrl : earthDayUrl,
  )
  const [day, clouds] = useLoader(THREE.TextureLoader, [
    dayTextureUrl,
    earthCloudsUrl,
  ])
  // three.js textures are mutable GPU resources; configuring color space/filtering
  // on the loader's cached instance is the standard r3f pattern, not stray state mutation.
  // oxlint-disable-next-line react/immutability
  day.colorSpace = THREE.SRGBColorSpace
  // oxlint-disable-next-line react/immutability
  clouds.colorSpace = THREE.NoColorSpace
  // oxlint-disable-next-line react/immutability
  day.anisotropy = 4

  const rotatingGroup = useRef<THREE.Group>(null)
  const surfaceMaterial = useRef<THREE.ShaderMaterial>(null)
  const surfaceUniforms = useMemo(
    () => ({
      dayMap: { value: day },
      cloudMap: { value: clouds },
      sunDirection: { value: new THREE.Vector3(...SUN_DIRECTION) },
      cloudOffset: { value: 0 },
    }),
    [day, clouds],
  )

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
    if (rotatingGroup.current)
      rotatingGroup.current.rotation.y += delta * 0.0018
    if (surfaceMaterial.current)
      surfaceMaterial.current.uniforms.cloudOffset.value +=
        Math.min(delta, 0.1) * 0.00006
  })

  return (
    <group position={[0, centerY, -3.4]}>
      <group ref={rotatingGroup} rotation={[-0.65, 4.4, -0.2]}>
        <mesh>
          <sphereGeometry args={[radius, 128, 96]} />
          <shaderMaterial
            ref={surfaceMaterial}
            vertexShader={ATMOSPHERE_VERTEX}
            fragmentShader={SURFACE_FRAGMENT}
            uniforms={surfaceUniforms}
          />
        </mesh>
      </group>
      {/* Inner haze: sits just outside the textured surface and blends the glow
          into the day-side pixels near the limb instead of leaving a seam. */}
      <mesh scale={1.004}>
        <sphereGeometry args={[radius, 128, 96]} />
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
      <mesh scale={1.003}>
        <sphereGeometry args={[radius, 128, 96]} />
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
