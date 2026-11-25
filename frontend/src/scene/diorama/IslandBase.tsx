import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoundScene } from '../../lib/contracts'
import { BIOME_PALETTES } from './palettes'
import { CONTACT_SHADOW_RADIUS, walkRadiusFor } from './layout'
import { createRng } from './prng'

export const ISLAND_RADIUS = 5.4
export const ISLAND_TOP_Y = 0.28

/** Average vertex normals across the LatheGeometry 0 / 2π seam for 360° smoothness. */
function weldLatheSeamNormals(geo: THREE.LatheGeometry, segments: number, profileLen: number) {
  const normal = geo.attributes.normal
  if (!normal) return
  const lastCol = segments * profileLen
  for (let j = 0; j < profileLen; j++) {
    const a = j
    const b = lastCol + j
    if (b >= normal.count) break
    const nx = normal.getX(a) + normal.getX(b)
    const ny = normal.getY(a) + normal.getY(b)
    const nz = normal.getZ(a) + normal.getZ(b)
    const len = Math.hypot(nx, ny, nz) || 1
    normal.setXYZ(a, nx / len, ny / len, nz / len)
    normal.setXYZ(b, nx / len, ny / len, nz / len)
  }
  normal.needsUpdate = true
}

/**
 * Smooth, softly rounded floating diorama island with a cushioned overhanging
 * terrain cap, gently rolling organic elevation, and a rounded pebble-like
 * earth bowl underneath (no sharp cones or triangular facets).
 */
export function IslandBase({
  scene,
  reducedMotion,
}: {
  scene: RoundScene
  reducedMotion: boolean
}) {
  const palette = BIOME_PALETTES[scene.biome]
  const snowy =
    scene.weather === 'snow' ||
    (scene.temperatureBand === 'freezing' && scene.biome !== 'desert')
  const topColor = snowy ? palette.snowyGround : palette.ground
  const isCoast = scene.biome === 'coast'
  const waterRef = useRef<THREE.Mesh>(null)
  const foamRef = useRef<THREE.Mesh>(null)

  const { topGeometry, bottomGeometry } = useMemo(() => {
    const rng = createRng(scene.seed ^ 0x9e3779b9)
    const phaseA = rng() * Math.PI * 2
    const phaseB = rng() * Math.PI * 2
    const topRadius = isCoast ? ISLAND_RADIUS * 0.78 : ISLAND_RADIUS

    const segments = 56
    // The inscribed circle of the flat polygon must contain the whole disk,
    // including when the explorer is standing at the walking boundary.
    const flatRadius = (walkRadiusFor(scene.biome) + CONTACT_SHADOW_RADIUS + 0.02) / Math.cos(Math.PI / segments)

    // Smooth cushioned top cap using a rounded LatheGeometry profile
    // (ordered bottom-to-top so all surface normals face outward/upward).
    const topProfile: THREE.Vector2[] = [
      new THREE.Vector2(0, ISLAND_TOP_Y - 0.56),
      new THREE.Vector2(topRadius * 0.88, ISLAND_TOP_Y - 0.56),
      new THREE.Vector2(topRadius * 0.98, ISLAND_TOP_Y - 0.46),
      new THREE.Vector2(topRadius * 1.02, ISLAND_TOP_Y - 0.3),
      new THREE.Vector2(topRadius * 1.0, ISLAND_TOP_Y - 0.14),
      new THREE.Vector2(topRadius * 0.93, ISLAND_TOP_Y - 0.04),
      new THREE.Vector2(flatRadius, ISLAND_TOP_Y),
      new THREE.Vector2(topRadius * 0.52, ISLAND_TOP_Y),
      new THREE.Vector2(topRadius * 0.26, ISLAND_TOP_Y),
      new THREE.Vector2(0, ISLAND_TOP_Y),
    ]
    const top = new THREE.LatheGeometry(topProfile, segments)

    // Apply gentle, smooth harmonic hills on the outer ring while keeping the
    // full walking and shadow footprint level.
    const pos = top.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const r = Math.hypot(x, z)
      if (y > ISLAND_TOP_Y - 0.18 && r > flatRadius + 0.001) {
        const edge = Math.min(1, (r - flatRadius) / (topRadius - flatRadius))
        const smoothEdge = edge * edge * (3 - 2 * edge)
        const wave =
          Math.sin(x * 0.55 + phaseA) * 0.55 +
          Math.cos(z * 0.62 + phaseB) * 0.45
        const bump =
          scene.biome === 'mountains'
            ? smoothEdge * (0.28 + wave * 0.16)
            : scene.biome === 'desert'
              ? smoothEdge * Math.sin(x * 0.65 + z * 0.42 + phaseA) * 0.2
              : scene.biome === 'urban'
                ? smoothEdge * 0.03
                : smoothEdge * wave * 0.14
        pos.setY(i, y + bump)
      }
    }
    top.computeVertexNormals()
    weldLatheSeamNormals(top, segments, topProfile.length)

    // Smooth rounded underside bowl (soft organic pebble silhouette instead of a sharp cone).
    const baseR = ISLAND_RADIUS * 0.93
    const bottomProfile: THREE.Vector2[] = [
      new THREE.Vector2(0, -2.15),
      new THREE.Vector2(baseR * 0.22, -2.1),
      new THREE.Vector2(baseR * 0.46, -1.9),
      new THREE.Vector2(baseR * 0.68, -1.52),
      new THREE.Vector2(baseR * 0.85, -1.04),
      new THREE.Vector2(baseR * 0.96, -0.58),
      new THREE.Vector2(baseR * 1.0, -0.22),
      new THREE.Vector2(baseR * 0.92, -0.14),
      new THREE.Vector2(0, -0.14),
    ]
    const bottom = new THREE.LatheGeometry(bottomProfile, 52)
    const bPos = bottom.attributes.position
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i)
      const y = bPos.getY(i)
      const z = bPos.getZ(i)
      if (y < -0.35 && y > -1.95) {
        const angle = Math.atan2(z, x)
        const organic =
          1 +
          Math.sin(angle * 3 + phaseA) * 0.035 +
          Math.cos(angle * 5 + phaseB) * 0.02
        bPos.setX(i, x * organic)
        bPos.setZ(i, z * organic)
      }
    }
    bottom.computeVertexNormals()
    weldLatheSeamNormals(bottom, 52, bottomProfile.length)

    return { topGeometry: top, bottomGeometry: bottom }
  }, [scene.seed, scene.biome, isCoast])

  useEffect(
    () => () => {
      topGeometry.dispose()
      bottomGeometry.dispose()
    },
    [topGeometry, bottomGeometry],
  )

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    const tide = Math.sin(t * 1.35)
    if (waterRef.current) {
      waterRef.current.position.y = 0.02 + tide * 0.025
    }
    if (foamRef.current) {
      foamRef.current.position.y = 0.205 + tide * 0.025
      const pulse = 1 + tide * 0.018
      foamRef.current.scale.set(pulse, pulse, 1)
    }
  })

  return (
    <group name="diorama-island">
      <mesh geometry={topGeometry} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color={topColor} roughness={0.84} metalness={0.03} />
      </mesh>
      <mesh geometry={bottomGeometry} position={[0, 0, 0]}>
        <meshStandardMaterial color={palette.underside} roughness={0.9} metalness={0.02} />
      </mesh>

      {isCoast && (
        <>
          <mesh ref={waterRef} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[ISLAND_RADIUS * 1.01, ISLAND_RADIUS * 0.94, 0.36, 56]} />
            <meshStandardMaterial
              color={palette.accentB}
              transparent
              opacity={0.82}
              roughness={0.22}
              metalness={0.14}
            />
          </mesh>
          <mesh
            ref={foamRef}
            position={[0, 0.205, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[ISLAND_RADIUS * 0.77, ISLAND_RADIUS * 0.83, 56]} />
            <meshBasicMaterial
              color="#eef9ff"
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  )
}
