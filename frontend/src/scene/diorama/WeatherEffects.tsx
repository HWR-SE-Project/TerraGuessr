import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoundScene } from '../../lib/contracts'
import { LIGHTING_PALETTES } from './palettes'
import { createRng, randRange } from './prng'

interface ParticleData {
  x: number
  y: number
  z: number
  speed: number
  phase: number
  scale: number
}

const PRECIP_HEIGHT = 7.5
const PRECIP_RADIUS = 5.8

/**
 * Complete diorama atmosphere layer:
 * - Fog-exempt in-frustum twinkling starfield + shooting star (night & dusk)
 * - Stylized Moon / Sun with smooth shader-faded radial glow (no hard halo rings)
 * - Soft shader-faded northern aurora curtains (tundra/mountains at night, zero hard edges)
 * - Properly framed, unclipped clouds scaled by weather
 * - Instanced rain / snow precipitation & storm flashes
 * - Biome- & wind-driven ambient motes (fireflies, pollen/dust/ice/mist) and soaring birds
 */
export function WeatherEffects({
  scene,
  reducedMotion,
}: {
  scene: RoundScene
  reducedMotion: boolean
}) {
  const lighting = LIGHTING_PALETTES[scene.lighting]
  const isRain = scene.weather === 'rain' || scene.weather === 'storm'
  const isSnow = scene.weather === 'snow'
  const isFog = scene.weather === 'fog'
  const isNight = scene.lighting === 'night'
  const isClear = scene.weather === 'clear'

  const showClouds =
    scene.weather === 'cloudy' ||
    isRain ||
    isSnow ||
    (isClear && !isNight)

  const showAurora =
    isNight &&
    (scene.biome === 'tundra' || scene.biome === 'mountains') &&
    (isClear || scene.weather === 'cloudy' || isSnow)

  const showBirds =
    !isNight &&
    (scene.biome === 'coast' || scene.biome === 'grasslands') &&
    scene.weather !== 'storm' &&
    !isRain &&
    !isFog

  return (
    <group name="diorama-weather">
      {lighting.stars && (
        <StarDome
          seed={scene.seed}
          count={isNight ? 480 : 160}
          isNight={isNight}
          dimmed={isRain || isFog}
          reducedMotion={reducedMotion}
        />
      )}

      {!isFog && scene.weather !== 'storm' && (
        <CelestialBody
          lighting={scene.lighting}
          cloudy={scene.weather === 'cloudy' || isRain || isSnow}
          reducedMotion={reducedMotion}
        />
      )}

      {showAurora && <AuroraCurtains reducedMotion={reducedMotion} />}

      {showClouds && <CloudCluster scene={scene} reducedMotion={reducedMotion} />}

      {(isRain || isSnow) && (
        <Precipitation
          kind={isSnow ? 'snow' : 'rain'}
          windBand={scene.windBand}
          seed={scene.seed}
          reducedMotion={reducedMotion}
        />
      )}

      <AmbientMotes scene={scene} reducedMotion={reducedMotion} />

      {showBirds && <SoaringBirds seed={scene.seed} reducedMotion={reducedMotion} />}

      {scene.weather === 'storm' && !reducedMotion && <StormFlash />}
    </group>
  )
}

/**
 * In-frustum, fog-exempt 360° twinkling starfield rendered in 1 draw call.
 */
function StarDome({
  seed,
  count,
  isNight,
  dimmed,
  reducedMotion,
}: {
  seed: number
  count: number
  isNight: boolean
  dimmed: boolean
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const meteorRef = useRef<THREE.Mesh>(null)
  const dummyRef = useRef<THREE.Object3D | null>(null)

  const stars = useMemo(() => {
    const rng = createRng(seed ^ 0x7a12f3)
    const palette = ['#ffffff', '#dce9ff', '#fff2cf', '#c9d8ff', '#ffe2b8']
    return Array.from({ length: count }, (_, i) => {
      const theta = rng() * Math.PI * 2
      const u = randRange(rng, -0.22, 0.58)
      const phi = Math.acos(u)
      const radius = randRange(rng, 25, 38)
      return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
        baseScale: randRange(rng, 0.55, 1.55) * (dimmed ? 0.75 : 1),
        phase: rng() * Math.PI * 2,
        speed: randRange(rng, 0.9, 2.6),
        color: palette[i % palette.length]!,
      }
    })
  }, [seed, count, dimmed])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = (dummyRef.current ??= new THREE.Object3D())
    const color = new THREE.Color()
    stars.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z)
      dummy.scale.setScalar(s.baseScale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(s.color)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [stars])

  useFrame((state) => {
    const mesh = meshRef.current
    if (reducedMotion || !mesh) return
    const t = state.clock.elapsedTime
    const dummy = (dummyRef.current ??= new THREE.Object3D())
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i]!
      const twinkle = 0.65 + 0.35 * Math.sin(t * s.speed + s.phase)
      dummy.position.set(s.x, s.y, s.z)
      dummy.scale.setScalar(s.baseScale * twinkle)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    const meteor = meteorRef.current
    if (meteor && isNight) {
      const cycle = (t * 0.14) % 1
      if (cycle < 0.12) {
        const p = cycle / 0.12
        meteor.visible = true
        meteor.position.set(14 - p * 20, 4.4 - p * 2.1, -24)
        const fade = Math.sin(p * Math.PI)
        meteor.scale.set(0.7 + fade * 1.4, 0.7, 0.7)
      } else {
        meteor.visible = false
      }
    }
  })

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.075, 6, 6]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={dimmed ? 0.52 : isNight ? 0.95 : 0.65}
          fog={false}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>
      {isNight && !reducedMotion && (
        <mesh ref={meteorRef} visible={false} rotation={[0, 0, 0.14]}>
          <capsuleGeometry args={[0.025, 1.4, 4, 6]} />
          <meshBasicMaterial color="#eef6ff" transparent opacity={0.85} fog={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Stylized Moon (night) or Sun (day/dusk) with a smooth shader-feathered
 * radial halo (fades cleanly to zero with no hard concentric ring borders).
 */
function CelestialBody({
  lighting,
  cloudy,
  reducedMotion,
}: {
  lighting: RoundScene['lighting']
  cloudy: boolean
  reducedMotion: boolean
}) {
  const glowRef = useRef<THREE.Mesh>(null)
  const isNight = lighting === 'night'
  const isDusk = lighting === 'dusk'

  const position: [number, number, number] = isDusk
    ? [7.4, 2.0, -18.5]
    : isNight
      ? [7.0, 2.85, -18.5]
      : [7.2, 2.95, -18.5]

  const coreColor = isNight ? '#f4f7ff' : isDusk ? '#ffd08a' : '#fff8d6'
  const haloColor = isNight ? '#8fb6ff' : isDusk ? '#ff9d66' : '#ffe899'
  const radius = isNight ? 0.82 : isDusk ? 1.0 : 0.88
  const haloStrength = cloudy ? 0.28 : isNight ? 0.45 : 0.5

  const haloMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uColor: { value: new THREE.Color(haloColor) },
          uStrength: { value: haloStrength },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uStrength;
          varying vec2 vUv;
          void main() {
            float d = distance(vUv, vec2(0.5)) * 2.0;
            float alpha = pow(max(0.0, 1.0 - d), 2.4) * uStrength;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      }),
    [haloColor, haloStrength],
  )

  useEffect(() => () => haloMaterial.dispose(), [haloMaterial])

  useFrame((state) => {
    const glow = glowRef.current
    if (!glow) return
    glow.quaternion.copy(state.camera.quaternion)
    if (!reducedMotion) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04
      glow.scale.setScalar(pulse)
    }
  })

  return (
    <group position={position}>
      <mesh ref={glowRef} material={haloMaterial}>
        <planeGeometry args={[radius * 5.6, radius * 5.6]} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 28, 20]} />
        <meshBasicMaterial
          color={coreColor}
          transparent={cloudy}
          opacity={cloudy ? 0.78 : 1}
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/**
 * Softly feathered, organic shimmering aurora curtains for night tundra/mountains.
 * Uses a custom alpha-faded shader so all edges dissolve smoothly into the sky
 * (zero rectangular borders).
 */
function AuroraCurtains({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color('#52f2bf') },
          uColorB: { value: new THREE.Color('#8f7cff') },
        },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 pos = position;
            float wave = sin(uv.x * 6.2831 + uTime * 0.45) * 0.45
                       + cos(uv.x * 11.0 - uTime * 0.3) * 0.22;
            pos.z += wave;
            pos.y += sin(uv.x * 4.5 + uTime * 0.35) * 0.25;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          varying vec2 vUv;
          void main() {
            // Smoothly fade all 4 edges to zero so no plane border is ever visible.
            float edgeX = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
            float edgeY = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
            float rays = 0.55
              + 0.25 * sin(vUv.x * 24.0 + uTime * 0.7)
              + 0.20 * sin(vUv.x * 41.0 - uTime * 0.45);
            vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.85, vUv.y));
            float alpha = edgeX * edgeY * rays * 0.32;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    if (reducedMotion) return
    const mat = meshRef.current?.material
    if (mat instanceof THREE.ShaderMaterial && mat.uniforms.uTime) {
      mat.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <mesh ref={meshRef} position={[-1.2, 3.1, -15.5]} rotation={[0, 0.14, 0]} material={material}>
      <planeGeometry args={[15, 2.8, 48, 8]} />
    </mesh>
  )
}

/**
 * Fluffy stylized cumulus clouds placed on a distant sky ring outside the
 * camera orbit so complete clouds drift gracefully behind the horizon without
 * clipping or intersecting the island.
 */
function CloudCluster({
  scene,
  reducedMotion,
}: {
  scene: RoundScene
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const isClear = scene.weather === 'clear'
  const isStorm = scene.weather === 'storm'
  const isPrecip = scene.weather === 'rain' || scene.weather === 'snow' || isStorm

  const cloudColor = isStorm
    ? '#546078'
    : scene.lighting === 'dusk'
      ? isPrecip
        ? '#9d8699'
        : '#f7cbb2'
      : scene.lighting === 'night'
        ? isPrecip
          ? '#4a5a7a'
          : '#6b7fa3'
        : isPrecip
          ? '#bac7d6'
          : '#f5f9fe'

  const cloudCount = isClear ? 3 : isPrecip ? 9 : 7

  const clouds = useMemo(() => {
    const rng = createRng(scene.seed ^ 0xc10ad)
    return Array.from({ length: cloudCount }, (_, index) => {
      const baseAngle = (index / cloudCount) * Math.PI * 2 + (isClear ? 0.55 : 0.2)
      const angle = baseAngle + randRange(rng, -0.22, 0.22)
      const r = randRange(rng, 14.8, 18.2)
      return {
        x: Math.cos(angle) * r,
        y: isPrecip ? randRange(rng, 2.4, 3.6) : randRange(rng, 2.1, 3.4),
        z: Math.sin(angle) * r,
        scale: isClear ? randRange(rng, 0.95, 1.2) : randRange(rng, 1.15, 1.55),
        rotY: rng() * Math.PI * 2,
      }
    })
  }, [scene.seed, cloudCount, isClear, isPrecip])

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    const speed = scene.windBand === 'windy' ? 0.065 : scene.windBand === 'breezy' ? 0.035 : 0.016
    groupRef.current.rotation.y += Math.min(delta, 0.05) * speed
  })

  return (
    <group ref={groupRef}>
      {clouds.map((cloud, i) => (
        <group
          key={i}
          position={[cloud.x, cloud.y, cloud.z]}
          rotation={[0, cloud.rotY, 0]}
          scale={cloud.scale}
        >
          <mesh position={[0, 0.08, 0]} scale={[1.18, 0.84, 0.98]}>
            <sphereGeometry args={[0.62, 18, 14]} />
            <meshStandardMaterial
              color={cloudColor}
              roughness={0.92}
              fog={false}
              transparent={isClear}
              opacity={isClear ? 0.88 : 1}
            />
          </mesh>
          <mesh position={[0.56, -0.04, 0.08]} scale={[1.05, 0.78, 0.92]}>
            <sphereGeometry args={[0.46, 16, 12]} />
            <meshStandardMaterial
              color={cloudColor}
              roughness={0.92}
              fog={false}
              transparent={isClear}
              opacity={isClear ? 0.88 : 1}
            />
          </mesh>
          <mesh position={[-0.54, -0.06, -0.06]} scale={[1.0, 0.76, 0.9]}>
            <sphereGeometry args={[0.43, 16, 12]} />
            <meshStandardMaterial
              color={cloudColor}
              roughness={0.92}
              fog={false}
              transparent={isClear}
              opacity={isClear ? 0.88 : 1}
            />
          </mesh>
          <mesh position={[0.14, -0.08, -0.3]} scale={[1.0, 0.74, 0.88]}>
            <sphereGeometry args={[0.4, 16, 12]} />
            <meshStandardMaterial
              color={cloudColor}
              roughness={0.92}
              fog={false}
              transparent={isClear}
              opacity={isClear ? 0.88 : 1}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * Biome- & lighting-matched floating ambient particles (1 instanced draw call):
 * fireflies at night in vegetated biomes, sunlit pollen/dust/ice/mist sparkles by day.
 */
function AmbientMotes({
  scene,
  reducedMotion,
}: {
  scene: RoundScene
  reducedMotion: boolean
}) {
  const isFireflies =
    scene.lighting === 'night' &&
    (scene.biome === 'forest' || scene.biome === 'grasslands' || scene.biome === 'coast')
  const count = isFireflies ? 30 : 34

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const particlesRef = useRef<ParticleData[]>([])
  const dummyRef = useRef<THREE.Object3D | null>(null)

  const moteColor = isFireflies
    ? '#ffe57a'
    : scene.weather === 'fog'
      ? '#dce8f2'
      : scene.biome === 'desert'
        ? '#f7d399'
        : scene.biome === 'tundra' || scene.biome === 'mountains'
          ? '#e4f4ff'
          : scene.biome === 'urban'
            ? scene.lighting === 'day'
              ? '#f5f0dc'
              : '#ffdf9e'
            : scene.lighting === 'dusk'
              ? '#ffe0a8'
              : '#f6ffcf'

  const windDrift = scene.windBand === 'windy' ? 0.95 : scene.windBand === 'breezy' ? 0.48 : 0.14

  useEffect(() => {
    const rng = createRng(scene.seed ^ 0x4b01e9)
    const next: ParticleData[] = Array.from({ length: count }, () => {
      const theta = rng() * Math.PI * 2
      const r = randRange(rng, 1.2, 4.8)
      return {
        x: Math.cos(theta) * r,
        y: randRange(rng, 0.65, isFireflies ? 2.3 : 3.0),
        z: Math.sin(theta) * r,
        speed: randRange(rng, 0.35, 0.85),
        phase: rng() * Math.PI * 2,
        scale: randRange(rng, 0.65, 1.3),
      }
    })
    particlesRef.current = next
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = (dummyRef.current ??= new THREE.Object3D())
    next.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [count, scene.seed, isFireflies])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const particles = particlesRef.current
    if (reducedMotion || !mesh || particles.length === 0) return
    const dummy = (dummyRef.current ??= new THREE.Object3D())
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!
      p.x += (windDrift + Math.sin(t * 0.6 + p.phase) * 0.14) * dt
      if (p.x > 5.0) p.x = -5.0
      const bobY = p.y + Math.sin(t * p.speed + p.phase) * (isFireflies ? 0.24 : 0.16)
      const driftZ = p.z + Math.cos(t * 0.5 + p.phase) * 0.12
      const pulse = isFireflies
        ? 0.45 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.phase))
        : 0.7 + 0.3 * Math.sin(t * 1.4 + p.phase)
      dummy.position.set(p.x, bobY, driftZ)
      dummy.scale.setScalar(p.scale * pulse)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[isFireflies ? 0.044 : 0.022, 8, 8]} />
      <meshBasicMaterial
        color={moteColor}
        transparent
        opacity={isFireflies ? 0.92 : 0.4}
        toneMapped={!isFireflies}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

/** Tiny stylized soaring birds lazily circling above coastal/grassland islands. */
function SoaringBirds({ seed, reducedMotion }: { seed: number; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const birds = useMemo(() => {
    const rng = createRng(seed ^ 0xb14d5)
    return Array.from({ length: 3 }, (_, i) => ({
      radius: randRange(rng, 3.6, 5.1),
      height: randRange(rng, 2.75, 3.55),
      speed: randRange(rng, 0.24, 0.34),
      offset: (i / 3) * Math.PI * 2 + rng() * 0.8,
      flapSpeed: randRange(rng, 4.2, 5.6),
    }))
  }, [seed])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    group.children.forEach((bird, i) => {
      const cfg = birds[i]!
      const angle = cfg.offset + t * cfg.speed
      bird.position.set(
        Math.cos(angle) * cfg.radius,
        cfg.height + Math.sin(t * 1.1 + cfg.offset) * 0.14,
        Math.sin(angle) * cfg.radius,
      )
      bird.rotation.y = -angle
      const flap = reducedMotion ? 0.15 : Math.sin(t * cfg.flapSpeed + cfg.offset) * 0.38
      const leftWing = bird.children[0]
      const rightWing = bird.children[1]
      if (leftWing) leftWing.rotation.z = flap
      if (rightWing) rightWing.rotation.z = -flap
    })
  })

  return (
    <group ref={groupRef}>
      {birds.map((_, i) => (
        <group key={i}>
          <group>
            <mesh position={[-0.1, 0, 0]} scale={[1, 0.22, 0.45]}>
              <boxGeometry args={[0.2, 0.12, 0.18]} />
              <meshBasicMaterial color="#f5f8fc" />
            </mesh>
          </group>
          <group>
            <mesh position={[0.1, 0, 0]} scale={[1, 0.22, 0.45]}>
              <boxGeometry args={[0.2, 0.12, 0.18]} />
              <meshBasicMaterial color="#f5f8fc" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

function Precipitation({
  kind,
  windBand,
  seed,
  reducedMotion,
}: {
  kind: 'rain' | 'snow'
  windBand: RoundScene['windBand']
  seed: number
  reducedMotion: boolean
}) {
  const count = kind === 'rain' ? 210 : 160
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const particlesRef = useRef<ParticleData[]>([])
  const dummyRef = useRef<THREE.Object3D | null>(null)
  const windDrift = windBand === 'windy' ? 2.4 : windBand === 'breezy' ? 1.1 : 0.25
  const slant = kind === 'rain' ? Math.atan2(windDrift, 9.5) : 0

  useEffect(() => {
    const rng = createRng(seed ^ (kind === 'rain' ? 0x12345 : 0x54321))
    const nextParticles: ParticleData[] = Array.from({ length: count }, () => {
      const theta = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * PRECIP_RADIUS
      return {
        x: Math.cos(theta) * r,
        y: randRange(rng, 0.4, PRECIP_HEIGHT),
        z: Math.sin(theta) * r,
        speed: kind === 'rain' ? randRange(rng, 8.5, 13.0) : randRange(rng, 1.0, 2.0),
        phase: rng() * Math.PI * 2,
        scale: kind === 'rain' ? randRange(rng, 0.85, 1.35) : randRange(rng, 0.75, 1.35),
      }
    })
    particlesRef.current = nextParticles
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = (dummyRef.current ??= new THREE.Object3D())
    nextParticles.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(0, 0, slant)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [count, kind, seed, slant])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const particles = particlesRef.current
    if (reducedMotion || !mesh || particles.length === 0) return
    const dummy = (dummyRef.current ??= new THREE.Object3D())
    const dt = Math.min(delta, 0.05)
    const elapsed = state.clock.elapsedTime
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!
      p.y -= p.speed * dt
      p.x += (kind === 'rain' ? windDrift : windDrift * 0.4 + Math.sin(elapsed * 1.4 + p.phase) * 0.35) * dt
      if (p.y < 0.2) {
        p.y = PRECIP_HEIGHT
        p.x = ((p.x + PRECIP_RADIUS) % (PRECIP_RADIUS * 2)) - PRECIP_RADIUS
      }
      if (p.x > PRECIP_RADIUS) p.x -= PRECIP_RADIUS * 2
      if (p.x < -PRECIP_RADIUS) p.x += PRECIP_RADIUS * 2
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(0, 0, slant)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      {kind === 'rain' ? (
        <capsuleGeometry args={[0.015, 0.36, 4, 6]} />
      ) : (
        <sphereGeometry args={[0.055, 8, 8]} />
      )}
      <meshBasicMaterial
        color={kind === 'rain' ? '#cfe6ff' : '#ffffff'}
        transparent
        opacity={kind === 'rain' ? 0.58 : 0.9}
      />
    </instancedMesh>
  )
}

function StormFlash() {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const timer = useRef(3.2)

  useFrame((_, delta) => {
    const light = lightRef.current
    if (!light) return
    timer.current -= delta
    if (timer.current <= 0) {
      light.intensity = 4.2
      timer.current = 4.5 + Math.random() * 4.5
    } else if (light.intensity > 0) {
      light.intensity = Math.max(0, light.intensity - delta * 18)
    }
  })

  return <directionalLight ref={lightRef} position={[4, 14, 3]} color="#d6e8ff" intensity={0} />
}
