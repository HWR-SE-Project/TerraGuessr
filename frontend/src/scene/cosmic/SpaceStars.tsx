import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA_FOV, CAMERA_Z } from '../home/composition'
import { CosmicEvents } from './CosmicEvents'
import { seededRandom } from './cosmicRandom'
import type { PointerState } from '../hooks'
import { NEBULA_FRAGMENT, NEBULA_VERTEX, STAR_FRAGMENT, STAR_VERTEX } from './cosmicShaders'

interface StarLayer {
  name: string
  count: number
  depth: number
  spread: number
  size: [number, number]
  light: [number, number]
  parallax: number
  drift: number
  driftSpeed: number
}

const LAYERS: StarLayer[] = [
  { name: 'far', count: 6500, depth: 104, spread: 30, size: [2.7, 5.5], light: [0.12, 0.5], parallax: 0.2, drift: 0.8, driftSpeed: 1.2 },
  { name: 'mid', count: 2100, depth: 60, spread: 22, size: [4, 8.5], light: [0.23, 0.68], parallax: 0.5, drift: 1.05, driftSpeed: 1.9 },
  { name: 'near', count: 240, depth: 26, spread: 12, size: [7, 15], light: [0.38, 0.85], parallax: 0.6, drift: 1.25, driftSpeed: 2.4 },
  { name: 'dust', count: 320, depth: 42, spread: 18, size: [8, 15], light: [0.008, 0.025], parallax: 0.4, drift: 0.8, driftSpeed: 1.5 },
  { name: 'clusters', count: 1500, depth: 92, spread: 16, size: [2.4, 4.8], light: [0.12, 0.42], parallax: 0.18, drift: 0.13, driftSpeed: 0.7 },
]

function makeStars(layer: StarLayer, count: number, aspect: number, seed: number) {
  const random = seededRandom(seed)
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const brightness = new Float32Array(count)
  const tints = new Float32Array(count * 3)
  const phases = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Broad meandering density bands, with open voids. Rejection sampling avoids
    // the uniform noise appearance while keeping every point genuinely in 3D.
    let x = 0, y = 0
    for (let attempt = 0; attempt < 12; attempt++) {
      x = random() * 2.6 - 1.3
      y = random() * 2.6 - 1.3
      const band = Math.exp(-Math.pow((y - 0.26 * Math.sin(x * 3.1) - x * 0.22) / 0.46, 2))
      if (random() < 0.25 + band * 0.65) break
    }
    if (layer.name === 'clusters') {
      const centers = [[-0.76, 0.32], [0.72, 0.48], [-0.57, -0.36], [0.67, -0.22]]
      const center = centers[Math.floor(random() * centers.length)]
      const radius = Math.sqrt(-2 * Math.log(Math.max(0.0001, random()))) * 0.055
      const angle = random() * Math.PI * 2
      x = center[0] + Math.cos(angle) * radius * 1.4
      y = center[1] + Math.sin(angle) * radius
    }
    const distance = layer.depth + (random() - 0.5) * layer.spread
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * distance
    positions.set([x * halfHeight * aspect, y * halfHeight, CAMERA_Z - distance], i * 3)
    sizes[i] = THREE.MathUtils.lerp(...layer.size, Math.pow(random(), 1.9))
    brightness[i] = THREE.MathUtils.lerp(...layer.light, Math.pow(random(), 1.5))
    const tint = random()
    tints.set(tint < 0.12 ? [0.92, 0.82, 0.67] : tint < 0.55 ? [0.6, 0.72, 1] : [0.84, 0.9, 1], i * 3)
    phases.set([random() * Math.PI * 2, random() * Math.PI * 2, 0.22 + random() * 0.44], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1))
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 3))
  return geometry
}

/** Five GPU star buffers, atmospheric shading and a pooled celestial event system. */
export function SpaceStars({ reducedMotion, pointerRef, isHome, layoutKey }: {
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
  isHome: boolean
  layoutKey: string
}) {
  const { size, gl, invalidate } = useThree()
  const aspect = size.width / Math.max(size.height, 1)
  const compact = size.width < 700
  const lowQuality = compact || (navigator.hardwareConcurrency || 8) <= 4
    || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4
  const density = compact ? 0.18 : lowQuality ? 0.45 : 1
  const motion = useRef({ x: 0, y: 0, time: 0 })
  const shared = useMemo(() => ({
    uResolution: { value: new THREE.Vector2() },
    uQuietRect: { value: new THREE.Vector4(0.28, 0.6, 0.72, 0.83) },
    uFaceRect: { value: new THREE.Vector4(0.44, 0.36, 0.56, 0.62) },
    uControlsRect: { value: new THREE.Vector4(0.2, 0, 0.8, 0.2) },
  }), [])
  const resources = useMemo(() => LAYERS.map((layer, index) => {
    const geometry = makeStars(layer, Math.round(layer.count * density), aspect, 1701 + index * 101)
    const material = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: {
        ...shared,
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uDepth: { value: layer.depth },
        uAspect: { value: aspect },
        // Scale horizontal travel for narrow viewports; wrap only outside the frustum.
        uDriftAmplitude: { value: new THREE.Vector2(layer.drift * Math.min(1, aspect), layer.drift) },
        uDriftSpeed: { value: layer.driftSpeed },
        uParallax: { value: new THREE.Vector2() },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    })
    return { geometry, material, layer }
  }), [aspect, density, shared])
  const atmosphere = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERTEX,
    fragmentShader: NEBULA_FRAGMENT,
    uniforms: {
      ...shared,
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uParallax: { value: new THREE.Vector2() },
    },
    depthTest: true,
    depthWrite: false,
  }), [shared])

  useLayoutEffect(() => {
    const home = isHome ? document.querySelector('.th-home') : null
    const copy = home?.querySelector('.th-hero-copy')
    let disposed = false
    const update = () => {
      if (disposed) return
      const canvas = gl.domElement.getBoundingClientRect()
      if (!canvas.width || !canvas.height) return
      if (!isHome) {
        // Reuse the same shader safety masks for the actual foreground UI.
        // Offscreen defaults leave empty space available for celestial events.
        const protect = (selector: string, uniform: THREE.IUniform<THREE.Vector4>) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect()
          if (!rect) { uniform.value.set(-2, -2, -1, -1); return }
          uniform.value.set((rect.left - canvas.left - 12) / canvas.width,
            1 - (rect.bottom - canvas.top + 12) / canvas.height,
            (rect.right - canvas.left + 12) / canvas.width,
            1 - (rect.top - canvas.top - 12) / canvas.height)
        }
        protect('.geo-landing__hero, .cosmic-app h1', shared.uQuietRect)
        protect('.geo-landing__signup-card, .settings-panel, .tg-reset-card, .sp-results, .sp-welcome', shared.uFaceRect)
        protect('.tg-page-nav', shared.uControlsRect)
        invalidate()
        return
      }
      // Use the content's bounds; the copy wrapper itself spans the page width.
      const heading = copy?.querySelector('h1')?.getBoundingClientRect()
      const description = copy?.querySelector('p')?.getBoundingClientRect()
      if (heading && description) {
        // h1 is a block; constrain its desktop quiet zone to the centered text.
        const width = Math.min(heading.width, size.width < 700 ? 350 : 860)
        shared.uQuietRect.value.set(
          (heading.left + (heading.width - width) / 2 - canvas.left) / canvas.width,
          1 - (description.bottom - canvas.top + 14) / canvas.height,
          (heading.left + (heading.width + width) / 2 - canvas.left) / canvas.width,
          1 - (heading.top - canvas.top - 14) / canvas.height,
        )
      }
      const face = home?.querySelector('.th-character-slot')?.getBoundingClientRect()
      const controls = home?.querySelector('.th-game-modes')?.getBoundingClientRect()
      if (face) shared.uFaceRect.value.set(
        (face.left - canvas.left - 12) / canvas.width,
        1 - (face.top + face.height * 0.58 - canvas.top + 8) / canvas.height,
        (face.right - canvas.left + 12) / canvas.width,
        1 - (face.top - canvas.top - 8) / canvas.height,
      )
      if (controls) shared.uControlsRect.value.set(
        (controls.left - canvas.left - 12) / canvas.width,
        1 - (controls.bottom - canvas.top + 12) / canvas.height,
        (controls.right - canvas.left + 12) / canvas.width,
        1 - (controls.top - canvas.top - 12) / canvas.height,
      )
      invalidate()
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(gl.domElement)
    if (home) observer.observe(home)
    if (copy) observer.observe(copy)
    const app = document.querySelector('.cosmic-app')
    if (!isHome && app) observer.observe(app)
    // Route chunks, form switches and result panels can arrive after the canvas.
    const mutations = new MutationObserver(update)
    if (app) mutations.observe(app, { childList: true, subtree: true })
    window.addEventListener('scroll', update, { passive: true, capture: true })
    void document.fonts.ready.then(update)
    return () => {
      disposed = true
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('scroll', update, true)
    }
  }, [gl, size.width, size.height, shared, invalidate, isHome, layoutKey])

  useEffect(() => () => {
    resources.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose() })
  }, [resources])
  useEffect(() => () => atmosphere.dispose(), [atmosphere])
  useEffect(() => { invalidate() }, [reducedMotion, invalidate])

  useFrame((_, delta) => {
    const current = motion.current
    if (!reducedMotion && !document.hidden) current.time += Math.min(delta, 0.1)
    const target = pointerRef.current
    const dt = Math.min(delta, 0.1)
    // Private smoothing state: never write to the character's pointer or camera.
    current.x = reducedMotion ? 0 : THREE.MathUtils.damp(current.x, target.active ? target.targetX : 0, 2.4, dt)
    current.y = reducedMotion ? 0 : THREE.MathUtils.damp(current.y, target.active ? -target.targetY : 0, 2.4, dt)
    const dpr = gl.getPixelRatio()
    shared.uResolution.value.set(size.width * dpr, size.height * dpr)
    const time = reducedMotion ? 0 : current.time
    resources.forEach(({ material, layer }) => {
      material.uniforms.uTime.value = time
      material.uniforms.uPixelRatio.value = dpr
      material.uniforms.uParallax.value.set(current.x * layer.parallax, current.y * layer.parallax * 0.65)
    })
    // Shader uniforms are mutable GPU resources, not React-owned values.
    // oxlint-disable-next-line react/immutability
    atmosphere.uniforms.uTime.value = time
    atmosphere.uniforms.uAspect.value = aspect
    atmosphere.uniforms.uParallax.value.set(current.x * 0.002, current.y * 0.0015)
  })

  const nebulaDistance = 158
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * nebulaDistance
  return (
    <group name="home-cosmic-environment">
      <mesh name="cosmic-atmosphere" position={[0, 0, CAMERA_Z - nebulaDistance]} renderOrder={-1000} material={atmosphere}>
        <planeGeometry args={[halfHeight * 2 * aspect, halfHeight * 2]} />
      </mesh>
      <CosmicEvents reducedMotion={reducedMotion} lowQuality={lowQuality} shared={shared} />
      {resources.map(({ layer, geometry, material }) => (
        <points key={layer.name} name={`cosmic-${layer.name}`} geometry={geometry} material={material} frustumCulled={false} />
      ))}
    </group>
  )
}
