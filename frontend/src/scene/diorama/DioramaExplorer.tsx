import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RoundScene } from '../../lib/contracts'
import { useAvatar } from '../../state/avatar'
import { useAvatarModel } from '../avatar'
import { Icon } from '../../components/ui/Icon'
import { ISLAND_TOP_Y } from './IslandBase'
import { CONTACT_SHADOW_RADIUS, getBiomeLayout } from './layout'
import { ACTIVITY_DURATION, fieldActivity, groundMotion } from './fieldActivity'
import { ExplorerPlayback } from './explorerPlayback'
import { FieldProp } from './FieldProp'
import { createRng } from './prng'
import {
  BREATH_PUFF_COUNT,
  SWEAT_DROP_COUNT,
  SWEAT_DROP_RADIUS,
  UMBRELLA_ANCHOR,
  breathPuffMotion,
  sweatDropMotion,
  weatherFlagsForScene,
  wrapperBodyMotion,
} from './weatherReactions'

const TARGET_HEIGHT = 1.85
const GROUND_Y = ISLAND_TOP_Y + 0.01
const WALK_SPEED = 0.98

type ExplorerMode = 'idle' | 'walk' | 'inspect' | 'check_sky' | 'cozy' | 'jump' | 'field'

interface ExplorerBrain {
  mode: ExplorerMode
  timer: number
  x: number
  z: number
  yaw: number
  targetX: number
  targetZ: number
  lookAtX: number
  lookAtZ: number
  nextAfterWalk: ExplorerMode
  fieldDue: boolean
  lean: number
  pitch: number
  glanceYaw: number
  rng: () => number
}

function shortestAngleDiff(current: number, target: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

function createInitialBrain(seed: number): ExplorerBrain {
  return {
    mode: 'idle',
    timer: 2.0,
    x: 0,
    z: 0,
    yaw: 0,
    targetX: 0,
    targetZ: 0,
    lookAtX: 0,
    lookAtZ: 2,
    nextAfterWalk: 'inspect',
    fieldDue: true,
    lean: 0,
    pitch: 0,
    glanceYaw: 0,
    rng: createRng(seed ^ 0xe4910a),
  }
}

/**
 * Floating stylized sweat-drop particles positioned cleanly outside the head
 * radius during hot weather (zero head clipping).
 */
function HeatSweatDrops({ reducedMotion }: { reducedMotion: boolean }) {
  const dropRefs = useRef<(THREE.Group | null)[]>([])
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  useFrame((state) => {
    const t = reducedMotion ? 0.45 : state.clock.elapsedTime
    for (let i = 0; i < SWEAT_DROP_COUNT; i++) {
      const group = dropRefs.current[i]
      if (!group) continue
      const motion = sweatDropMotion(i, t)
      group.visible = motion.scale > 0.02
      group.position.set(motion.x, motion.y, motion.z)
      group.scale.setScalar(motion.scale)
      const mat = matRefs.current[i]
      if (mat) mat.opacity = motion.opacity
    }
  })

  return (
    <group name="heat-sweat-drops">
      {Array.from({ length: SWEAT_DROP_COUNT }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            dropRefs.current[i] = el
          }}
          visible={false}
        >
          <mesh scale={[0.85, 1.25, 0.85]}>
            <sphereGeometry args={[SWEAT_DROP_RADIUS, 10, 8]} />
            <meshStandardMaterial
              ref={(el) => {
                matRefs.current[i] = el
              }}
              color="#7fd8ff"
              roughness={0.2}
              metalness={0.05}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, SWEAT_DROP_RADIUS * 1.15, 0]}>
            <coneGeometry args={[SWEAT_DROP_RADIUS * 0.65, SWEAT_DROP_RADIUS * 1.1, 8]} />
            <meshStandardMaterial color="#a6e6ff" roughness={0.2} transparent opacity={0.82} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * Rhythmic translucent breath vapor puffs emitted cleanly in front of the
 * avatar's face during freezing / snowy weather (zero face or hair clipping).
 */
function BreathVaporPuffs({ reducedMotion }: { reducedMotion: boolean }) {
  const puffRefs = useRef<(THREE.Mesh | null)[]>([])
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame((state) => {
    const t = reducedMotion ? 0.5 : state.clock.elapsedTime
    for (let i = 0; i < BREATH_PUFF_COUNT; i++) {
      const mesh = puffRefs.current[i]
      if (!mesh) continue
      const motion = breathPuffMotion(i, t)
      mesh.visible = !reducedMotion && motion.visible
      if (mesh.visible) {
        mesh.position.set(motion.x, motion.y, motion.z)
        mesh.scale.setScalar(motion.radius)
        const mat = matRefs.current[i]
        if (mat) mat.opacity = motion.opacity
      }
    }
  })

  return (
    <group name="freezing-breath-vapor">
      {Array.from({ length: BREATH_PUFF_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            puffRefs.current[i] = el
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial
            ref={(el) => {
              matRefs.current[i] = el
            }}
            color="#eef7ff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Low-poly rain/storm umbrella planted firmly on the island ground beside the
 * explorer pad, with canopy rim strictly above Jump head clearance and zero
 * skeleton/arm-bone coupling.
 */
function RainUmbrella({
  isStorm,
  windBand,
  reducedMotion,
}: {
  isStorm: boolean
  windBand: RoundScene['windBand']
  reducedMotion: boolean
}) {
  const swayRef = useRef<THREE.Group>(null)
  const canopyColor = isStorm ? '#f0b443' : '#e05858'
  const trimColor = isStorm ? '#fbe19d' : '#ffd2c8'

  useFrame((state) => {
    const group = swayRef.current
    if (!group) return
    if (reducedMotion) {
      group.rotation.set(0.04, 0.25, -0.05)
      return
    }
    const t = state.clock.elapsedTime
    const amp = windBand === 'windy' ? 0.055 : windBand === 'breezy' ? 0.028 : 0.012
    const speed = windBand === 'windy' ? 2.4 : 1.5
    group.rotation.set(0.04, 0.25, -0.05 + Math.sin(t * speed) * amp)
  })

  return (
    <group name="rain-umbrella" position={[UMBRELLA_ANCHOR.x, ISLAND_TOP_Y, UMBRELLA_ANCHOR.z]}>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial
          color="#0a0918"
          transparent
          opacity={0.22}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <group ref={swayRef} rotation={[0.04, 0.25, -0.05]}>
        {/* Slender shaft planted cleanly into the ground */}
        <mesh position={[0, 1.13, 0]}>
          <cylinderGeometry args={[0.024, 0.028, 2.3, 10]} />
          <meshStandardMaterial color="#3c4352" roughness={0.55} metalness={0.35} />
        </mesh>
        {/* Cozy wooden handle grip near lower pole */}
        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.24, 10]} />
          <meshStandardMaterial color="#8c5a3c" roughness={0.78} />
        </mesh>
        {/* Low-poly 8-sided umbrella canopy strictly above head clearance (rim at y = 2.12) */}
        <mesh position={[0, UMBRELLA_ANCHOR.canopyRimY + 0.18, 0]}>
          <coneGeometry args={[UMBRELLA_ANCHOR.canopyRadius, 0.36, 8]} />
          <meshStandardMaterial color={canopyColor} roughness={0.62} flatShading side={THREE.DoubleSide} />
        </mesh>
        {/* Crisp trim ring along the canopy rim */}
        <mesh position={[0, UMBRELLA_ANCHOR.canopyRimY + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[UMBRELLA_ANCHOR.canopyRadius * 0.99, 0.018, 6, 8]} />
          <meshStandardMaterial color={trimColor} roughness={0.55} />
        </mesh>
        {/* Small top finial */}
        <mesh position={[0, UMBRELLA_ANCHOR.canopyRimY + 0.4, 0]}>
          <coneGeometry args={[0.026, 0.12, 8]} />
          <meshStandardMaterial color="#3c4352" roughness={0.5} metalness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

export function DioramaExplorer({
  scene,
  reducedMotion,
  onInteract,
  activeQuip,
  quipKey,
  onDismissQuip,
}: {
  scene: RoundScene
  reducedMotion: boolean
  onInteract: () => void
  activeQuip: string | null
  quipKey: number
  onDismissQuip: () => void
}) {
  const config = useAvatar()
  const { model, bounds, dimensions, actions, mixer } = useAvatarModel(config, reducedMotion)
  const rigRef = useRef<THREE.Group>(null)
  const leanRef = useRef<THREE.Group>(null)
  const yawRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const activity = fieldActivity(scene)
  const fieldRef = useRef<THREE.Group>(null)
  const playback = useRef<ExplorerPlayback | null>(null)
  const brainRef = useRef<ExplorerBrain | null>(null)
  const [hovered, setHovered] = useState(false)

  const layout = useMemo(
    () => getBiomeLayout({ seed: scene.seed, biome: scene.biome }),
    [scene.seed, scene.biome],
  )

  const weather = useMemo(() => weatherFlagsForScene(scene), [scene])

  const scale = dimensions.y > 0 ? TARGET_HEIGHT / dimensions.y : 1
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])
  const footOffsetY = -bounds.min.y * scale

  // The mixer is the only writer to this clone's skeleton. Reset all actions
  // together, including pending fades and the held final frame of Jump.
  useLayoutEffect(() => {
    mixer.stopAllAction()
    brainRef.current = createInitialBrain(scene.seed)
    if (actions.Idle && actions.Walk && actions.Jump) {
      playback.current = new ExplorerPlayback({ Idle: actions.Idle, Walk: actions.Walk, Jump: actions.Jump })
    }
    mixer.update(0)
    if (leanRef.current) leanRef.current.rotation.set(0, 0, 0)
    if (yawRef.current) yawRef.current.rotation.set(0, 0, 0)
    if (bodyRef.current) {
      bodyRef.current.position.set(0, footOffsetY, 0)
      bodyRef.current.rotation.set(0, 0, 0)
    }
    if (fieldRef.current) fieldRef.current.visible = false
    return () => {
      playback.current = null
      mixer.stopAllAction()
    }
  }, [
    mixer,
    actions,
    footOffsetY,
    scene.seed,
    scene.biome,
    scene.weather,
    scene.temperatureBand,
    scene.windBand,
    scene.lighting,
    reducedMotion,
  ])

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  function pickNextDestination(b: ExplorerBrain) {
    const rng = b.rng
    const maxR = layout.walkRadius
    const obstacles = layout.obstacles
    const avoidObstacles = weather.hasUmbrella
      ? [...obstacles, { x: UMBRELLA_ANCHOR.x, z: UMBRELLA_ANCHOR.z, radius: UMBRELLA_ANCHOR.obstacleRadius }]
      : obstacles
    const wantPropVisit = obstacles.length > 0 && rng() < 0.7

    // A clear destination alone is insufficient. Check the swept path so an
    // explorer heading to a landmark cannot walk straight through another.
    function pathClear(x: number, z: number) {
      const dx = x - b.x
      const dz = z - b.z
      const lengthSq = dx * dx + dz * dz
      return avoidObstacles.every((obstacle) => {
        const along = THREE.MathUtils.clamp(((obstacle.x - b.x) * dx + (obstacle.z - b.z) * dz) / lengthSq, 0, 1)
        return Math.hypot(b.x + along * dx - obstacle.x, b.z + along * dz - obstacle.z) >= obstacle.radius + 0.6
      })
    }

    if (wantPropVisit) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const prop = obstacles[Math.floor(rng() * obstacles.length)]!
        const distFromCenter = Math.hypot(prop.x, prop.z)
        if (distFromCenter < 0.5) continue
        const inwardAngle = Math.atan2(-prop.z, -prop.x) + (rng() - 0.5) * 1.0
        const standDist = prop.radius + 0.76
        const tx = prop.x + Math.cos(inwardAngle) * standDist
        const tz = prop.z + Math.sin(inwardAngle) * standDist
        const r = Math.hypot(tx, tz)
        if (r > maxR || Math.hypot(tx - b.x, tz - b.z) < 0.9) continue
        if (pathClear(tx, tz)) {
          b.targetX = tx
          b.targetZ = tz
          b.lookAtX = prop.x
          b.lookAtZ = prop.z
          b.nextAfterWalk = 'inspect'
          b.mode = 'walk'
          b.timer = 6.5
          return
        }
      }
    }

    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * (maxR * 0.82)
      const tx = Math.cos(angle) * r
      const tz = Math.sin(angle) * r
      if (Math.hypot(tx - b.x, tz - b.z) < 0.9) continue
      if (pathClear(tx, tz)) {
        b.targetX = tx
        b.targetZ = tz
        b.lookAtX = tx + Math.sin(angle) * 2
        b.lookAtZ = tz + Math.cos(angle) * 2
        b.nextAfterWalk = weather.isCold && rng() < 0.45 ? 'cozy' : 'check_sky'
        b.mode = 'walk'
        b.timer = 6.5
        return
      }
    }

    b.mode = weather.isCold ? 'cozy' : 'check_sky'
    b.timer = 3.2
  }

  useFrame((state, delta) => {
    const rig = rigRef.current
    const shadow = shadowRef.current
    const b = brainRef.current
    if (!rig || !b) return

    const dt = reducedMotion ? 0 : Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    b.timer -= dt

    if (b.mode === 'jump') {
      if (!actions.Jump?.isRunning()) {
        b.mode = 'idle'
        b.timer = 1.5
        playback.current?.play('Idle')
      }
    } else if (b.mode === 'walk') {
      playback.current?.play('Walk')
      const dx = b.targetX - b.x
      const dz = b.targetZ - b.z
      const dist = Math.hypot(dx, dz)

      if (dist < 0.14 || b.timer <= 0) {
        b.mode = dist < 0.14 ? b.nextAfterWalk : 'check_sky'
        b.timer = b.mode === 'inspect' ? 4.0 + b.rng() * 1.4 : 3.0 + b.rng() * 1.2
        playback.current?.play('Idle')
      } else {
        const dirX = dx / dist
        const dirZ = dz / dist
        const step = Math.min(dist, WALK_SPEED * dt)
        b.x += dirX * step
        b.z += dirZ * step

        const desiredYaw = Math.atan2(dirX, dirZ)
        b.yaw += shortestAngleDiff(b.yaw, desiredYaw) * Math.min(1, dt * 6.0)
      }
    } else if (b.mode === 'idle') {
      playback.current?.play('Idle')
      if (b.timer <= 0) {
        if (activity && b.fieldDue) {
          b.fieldDue = false
          b.mode = 'field'
          b.timer = ACTIVITY_DURATION
        } else if (b.rng() < 0.72) {
          b.fieldDue = true
          pickNextDestination(b)
        } else {
          b.fieldDue = true
          b.mode = weather.isCold && b.rng() < 0.5 ? 'cozy' : 'check_sky'
          b.timer = 3.2 + b.rng() * 1.2
        }
      }
    } else {
      playback.current?.play('Idle')
      if (b.mode === 'inspect') {
        const desiredYaw = Math.atan2(b.lookAtX - b.x, b.lookAtZ - b.z)
        b.yaw += shortestAngleDiff(b.yaw, desiredYaw) * Math.min(1, dt * 5.0)
      }
      if (b.timer <= 0) {
        b.mode = 'idle'
        b.timer = 1.8 + b.rng() * 1.6
      }
    }

    playback.current?.advance(dt)

    // Weather and observation reactions only move wrapper groups, never skeleton bones.
    const motion = wrapperBodyMotion(weather, b.mode, b.timer, t, reducedMotion)
    b.lean = THREE.MathUtils.damp(b.lean, motion.windLeanZ, 4.5, dt)
    b.pitch = THREE.MathUtils.damp(b.pitch, motion.pitchX, 5.0, dt)
    b.glanceYaw = THREE.MathUtils.damp(b.glanceYaw, motion.glanceYaw, 5.0, dt)

    rig.position.set(b.x, GROUND_Y, b.z)
    if (leanRef.current) leanRef.current.rotation.z = b.lean
    if (yawRef.current) yawRef.current.rotation.y = b.yaw + b.glanceYaw
    if (bodyRef.current) {
      bodyRef.current.position.set(motion.shiverX, footOffsetY, 0)
      bodyRef.current.rotation.set(b.pitch, 0, motion.shiverZ)
    }
    if (shadow) {
      shadow.position.set(b.x, ISLAND_TOP_Y + 0.008, b.z)
    }

    const prop = fieldRef.current
    if (prop && activity) {
      prop.visible = b.mode === 'field' && !reducedMotion
      if (prop.visible) {
        const ground = groundMotion(activity, ACTIVITY_DURATION - b.timer)
        prop.position.set(ground.x, ground.y, ground.z)
        prop.rotation.z = ground.roll
        prop.scale.setScalar(ground.scale)
      }
    }
  }, -0.5)

  function handleClick() {
    const b = brainRef.current
    if (b && !reducedMotion && b.mode !== 'jump' && actions.Jump) {
      b.mode = 'jump'
      playback.current?.play('Jump')
    }
    onInteract()
  }

  return (
    <group name="diorama-explorer">
      {/* Ground contact shadow tracking the explorer smoothly across the island */}
      <mesh
        name="explorer-contact-shadow"
        ref={shadowRef}
        position={[0, ISLAND_TOP_Y + 0.008, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[CONTACT_SHADOW_RADIUS, 32]} />
        <meshBasicMaterial
          color="#0a0918"
          transparent
          opacity={0.28}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {weather.hasUmbrella && (
        <RainUmbrella
          isStorm={scene.weather === 'storm'}
          windBand={scene.windBand}
          reducedMotion={reducedMotion}
        />
      )}

      <group
        name="explorer-rig"
        ref={rigRef}
        position={[0, GROUND_Y, 0]}
        onClick={(event) => {
          event.stopPropagation()
          handleClick()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Reliable invisible hit volume so clicks on the animated SkinnedMesh never miss */}
        <mesh name="explorer-hit-volume" position={[0, 0.96, 0]}>
          <cylinderGeometry args={[0.62, 0.44, 1.9, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <group name="explorer-lean" ref={leanRef}>
          <group name="explorer-yaw" ref={yawRef}>
            <group name="explorer-body" ref={bodyRef} scale={scale} position={[0, footOffsetY, 0]}>
              <primitive object={model} position={[-center.x, 0, -center.z]} dispose={null} />
            </group>

            {weather.isHot && <HeatSweatDrops reducedMotion={reducedMotion} />}
            {weather.isFreezing && <BreathVaporPuffs reducedMotion={reducedMotion} />}

            {activity && (
              <group name="ground-reaction" ref={fieldRef} visible={false}>
                <FieldProp activity={activity} />
              </group>
            )}
          </group>
        </group>

        {activeQuip && (
          <Html position={[0, 2.55, 0]} center zIndexRange={[20, 0]} wrapperClass="pointer-events-none">
            <div
              key={quipKey}
              role="status"
              aria-live="polite"
              className="surface-flat pointer-events-auto relative w-60 rounded-2xl border border-white/12 px-3.5 py-2.5 text-left shadow-card sm:w-64"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 font-display text-[10px] font-semibold uppercase tracking-widest text-lime-300">
                  <Icon name="sparkle" size={11} />
                  Explorer note
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDismissQuip()
                  }}
                  aria-label="Dismiss explorer note"
                  className="flex size-5 items-center justify-center rounded-full text-subtle transition-colors hover:bg-white/10 hover:text-cream"
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
              <p className="text-xs leading-relaxed font-medium text-cream sm:text-sm">“{activeQuip}”</p>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b border-white/12 bg-space-800"
              />
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}
