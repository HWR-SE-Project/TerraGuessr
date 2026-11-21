import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CAMERA_FOV, CAMERA_Z } from '../home/composition'
import { seededRandom } from './cosmicRandom'
import {
  DUST_FRAGMENT, DUST_VERTEX, SATELLITE_FRAGMENT, SATELLITE_VERTEX,
  TRAIL_FRAGMENT, TRAIL_VERTEX,
} from './cosmicEventShaders'

type Kind = 'meteor' | 'comet' | 'satellite'
export interface CosmicSafetyUniforms {
  uResolution: THREE.IUniform<THREE.Vector2>
  uQuietRect: THREE.IUniform<THREE.Vector4>
  uFaceRect: THREE.IUniform<THREE.Vector4>
  uControlsRect: THREE.IUniform<THREE.Vector4>
}
interface Transit {
  kind: Kind
  start: number
  duration: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  length: number
  width: number
}

function satelliteGeometry() {
  const pieces: THREE.BufferGeometry[] = []
  function part(geometry: THREE.BufferGeometry, position: [number, number, number], color: [number, number, number], surface = 0) {
    geometry.translate(...position)
    const count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    const surfaces = new Float32Array(count).fill(surface)
    for (let i = 0; i < count; i++) colors.set(color, i * 3)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSurface', new THREE.BufferAttribute(surfaces, 1))
    pieces.push(geometry)
  }
  part(new THREE.BoxGeometry(0.21, 0.25, 0.18), [0, 0, 0], [0.56, 0.59, 0.65])
  part(new THREE.BoxGeometry(0.16, 0.15, 0.03), [0, 0, 0.105], [0.64, 0.5, 0.28])
  part(new THREE.BoxGeometry(0.9, 0.025, 0.025), [0, 0, 0], [0.45, 0.49, 0.57])
  part(new THREE.BoxGeometry(0.41, 0.29, 0.018), [-0.36, 0, 0], [0.09, 0.23, 0.46], 1)
  part(new THREE.BoxGeometry(0.41, 0.29, 0.018), [0.36, 0, 0], [0.09, 0.23, 0.46], 1)
  part(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 5), [0, 0.22, 0], [0.63, 0.67, 0.73])
  const dish = new THREE.SphereGeometry(0.075, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)
  dish.rotateX(Math.PI / 2)
  part(dish, [0, 0.27, 0.015], [0.7, 0.73, 0.76])
  part(new THREE.SphereGeometry(0.018, 6, 4), [0.1, 0.12, 0.11], [0.75, 0.95, 0.58], 2)
  const result = mergeGeometries(pieces)!
  pieces.forEach(geometry => geometry.dispose())
  return result
}

function makePool(shared: CosmicSafetyUniforms, lowQuality: boolean) {
  const root = new THREE.Group()
  root.name = 'cosmic-events'
  root.userData.counts = { meteor: 0, comet: 0, satellite: 0 }
  root.userData.history = []
  const plane = new THREE.PlaneGeometry(1, 1)
  // The leading tip sits at the group's origin, with the ribbon behind it.
  plane.translate(-0.44, 0, 0)
  const trailMaterial = (comet: boolean) => new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERTEX, fragmentShader: TRAIL_FRAGMENT,
    uniforms: { ...shared, uOpacity: { value: 0 }, uAspect: { value: 10 },
      uComet: { value: comet ? 1 : 0 }, uTint: { value: new THREE.Color(comet ? '#b8daff' : '#d8e8ff') } },
    transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const meteorMaterial = trailMaterial(false)
  const cometMaterial = trailMaterial(true)
  const meteor = new THREE.Group()
  meteor.name = 'cosmic-meteor'
  const meteorTail = new THREE.Mesh(plane, meteorMaterial)
  meteorTail.frustumCulled = false
  meteor.add(meteorTail)
  const comet = new THREE.Group()
  comet.name = 'cosmic-comet'
  const cometTail = new THREE.Mesh(plane, cometMaterial)
  cometTail.frustumCulled = false
  comet.add(cometTail)
  const dustGeometry = new THREE.BufferGeometry()
  const random = seededRandom(52390)
  const dust = new Float32Array((lowQuality ? 20 : 64) * 3)
  for (let i = 0; i < dust.length; i++) dust[i] = random()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3))
  const dustMaterial = new THREE.ShaderMaterial({
    vertexShader: DUST_VERTEX, fragmentShader: DUST_FRAGMENT,
    uniforms: { ...shared, uAge: { value: 0 }, uLength: { value: 1 }, uWidth: { value: 0.1 },
      uPixelRatio: { value: 1 }, uOpacity: { value: 0 } },
    transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const dustPoints = new THREE.Points(dustGeometry, dustMaterial)
  dustPoints.frustumCulled = false
  comet.add(dustPoints)
  const satelliteMaterial = new THREE.ShaderMaterial({
    vertexShader: SATELLITE_VERTEX, fragmentShader: SATELLITE_FRAGMENT,
    uniforms: { ...shared, uOpacity: { value: 0 }, uAge: { value: 0 } },
    transparent: true, depthTest: true, depthWrite: false,
  })
  const satellite = new THREE.Mesh(satelliteGeometry(), satelliteMaterial)
  satellite.name = 'cosmic-satellite'
  satellite.frustumCulled = false
  root.add(meteor, comet, satellite)
  root.children.forEach(child => { child.visible = false })
  return { root, meteor, comet, satellite, meteorTail, cometTail,
    meteorMaterial, cometMaterial, dustMaterial, satelliteMaterial,
    dispose() {
      plane.dispose(); dustGeometry.dispose(); satellite.geometry.dispose()
      meteorMaterial.dispose(); cometMaterial.dispose(); dustMaterial.dispose(); satelliteMaterial.dispose()
    } }
}

/** A preallocated pool: one transit at a time, no timers, allocations or React updates per frame. */
export function CosmicEvents({ reducedMotion, lowQuality, shared }: {
  reducedMotion: boolean
  lowQuality: boolean
  shared: CosmicSafetyUniforms
}) {
  const { size, gl } = useThree()
  const pool = useMemo(() => makePool(shared, lowQuality), [shared, lowQuality])
  const poolRef = useRef(pool)
  const scheduler = useRef({ time: 0, clearUntil: 0, active: null as Transit | null,
    next: { meteor: 10, comet: 55, satellite: 30 }, random: seededRandom(17841) })
  useEffect(() => {
    poolRef.current = pool
    const random = seededRandom(crypto.getRandomValues(new Uint32Array(1))[0])
    scheduler.current.random = random
    scheduler.current.active = null
    scheduler.current.next = {
      meteor: scheduler.current.time + 8 + random() * 12,
      comet: scheduler.current.time + 45 + random() * 23,
      satellite: scheduler.current.time + 26 + random() * 14,
    }
    return () => pool.dispose()
  }, [pool])

  useFrame((_, delta) => {
    const p = poolRef.current
    const state = scheduler.current
    p.root.visible = !reducedMotion
    if (reducedMotion || document.hidden) return
    state.time += Math.min(delta, 0.1)
    const time = state.time
    p.root.userData.time = time
    if (!state.active && time >= state.clearUntil) {
      const kind = (['comet', 'satellite', 'meteor'] as const).find(k => time >= state.next[k])
      if (kind) {
        const random = state.random
        const compact = size.width < 700
        const side = random() < 0.5 ? 1 : -1
        const mobileLane = (shared.uQuietRect.value.y + shared.uFaceRect.value.w) / 2
        const transit: Transit = {
          kind, start: time,
          duration: kind === 'meteor' ? 1.2 + random() * 0.6 : kind === 'comet' ? 7 + random() * 2 : 14 + random() * 4,
          fromX: side > 0 ? -0.1 : 1.1,
          toX: side > 0 ? 0.3 + random() * 0.06 : 0.7 - random() * 0.06,
          fromY: kind === 'satellite' ? 0.4 + random() * 0.08 : 0.75 + random() * 0.1,
          toY: kind === 'satellite' ? 0.57 + random() * 0.04 : 0.34 + random() * 0.13,
          length: kind === 'comet' ? 235 + random() * 65 : 100 + random() * 65,
          width: kind === 'comet' ? 38 : 14,
        }
        if (compact) {
          transit.toX = side > 0 ? 1.1 : -0.1
          transit.fromY = mobileLane + 0.005
          transit.toY = mobileLane - 0.005
          transit.length *= 0.55
          transit.width *= 0.7
        }
        state.active = transit
        state.next[kind] = time + (kind === 'meteor' ? 8 + random() * 12 : kind === 'comet' ? 45 + random() * 45 : 75 + random() * 45)
        p.root.userData.counts[kind]++
        p.root.userData.active = { kind, start: time, duration: transit.duration }
        p.root.userData.history.push({ kind, start: time, duration: transit.duration })
        if (p.root.userData.history.length > 12) p.root.userData.history.shift()
        p.meteorMaterial.uniforms.uTint.value.set(random() < 0.25 ? '#ffe6c0' : '#c6e1ff')
      }
    }
    const event = state.active
    p.meteor.visible = event?.kind === 'meteor'
    p.comet.visible = event?.kind === 'comet'
    p.satellite.visible = event?.kind === 'satellite'
    if (!event) return
    const progress = Math.min(1, (time - event.start) / event.duration)
    const fade = THREE.MathUtils.smoothstep(progress, 0, 0.14) * (1 - THREE.MathUtils.smoothstep(progress, 0.72, 1))
    const travel = event.kind === 'meteor' ? Math.pow(progress, 1.5) : event.kind === 'comet' ? Math.pow(progress, 1.12) : progress
    const distance = event.kind === 'satellite' ? 46 : event.kind === 'comet' ? 54 : 68
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)) * distance
    const aspect = size.width / Math.max(1, size.height)
    const pixelsPerWorld = size.height / (halfHeight * 2)
    const x = THREE.MathUtils.lerp(event.fromX, event.toX, travel)
    const y = THREE.MathUtils.lerp(event.fromY, event.toY, travel)
      + (event.kind === 'satellite' ? Math.sin(progress * Math.PI) * 0.018 : 0)
    const object = event.kind === 'meteor' ? p.meteor : event.kind === 'comet' ? p.comet : p.satellite
    object.position.set((x * 2 - 1) * halfHeight * aspect, (y * 2 - 1) * halfHeight, CAMERA_Z - distance)
    const age = time - event.start
    if (event.kind === 'satellite') {
      object.scale.setScalar((size.width < 700 ? 22 : lowQuality ? 30 : 36) / pixelsPerWorld / 1.13)
      object.rotation.set(0.3 + Math.sin(age * 0.16) * 0.14, -0.35 + age * 0.06, 0.22 + Math.sin(age * 0.1) * 0.12)
      p.satelliteMaterial.uniforms.uOpacity.value = fade * 0.9
      p.satelliteMaterial.uniforms.uAge.value = age
    } else {
      object.rotation.z = Math.atan2(event.toY - event.fromY, (event.toX - event.fromX) * aspect)
      const tail = event.kind === 'comet' ? p.cometTail : p.meteorTail
      const material = event.kind === 'comet' ? p.cometMaterial : p.meteorMaterial
      tail.scale.set(event.length / pixelsPerWorld, event.width / pixelsPerWorld, 1)
      material.uniforms.uOpacity.value = fade * (event.kind === 'comet' ? 0.9 : 0.85)
      material.uniforms.uAspect.value = event.length / event.width
      p.dustMaterial.uniforms.uAge.value = age
      p.dustMaterial.uniforms.uLength.value = event.length / pixelsPerWorld * 0.75
      p.dustMaterial.uniforms.uWidth.value = event.width / pixelsPerWorld * 0.4
      p.dustMaterial.uniforms.uPixelRatio.value = gl.getPixelRatio()
      p.dustMaterial.uniforms.uOpacity.value = fade
    }
    if (progress >= 1) {
      object.visible = false
      state.active = null
      state.clearUntil = time + 1.4 + state.random() * 1.6
      p.root.userData.active = null
    }
  })
  return <primitive object={pool.root} dispose={null} />
}
