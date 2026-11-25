import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoundScene } from '../../lib/contracts'
import { ISLAND_TOP_Y } from './IslandBase'
import { getBiomeLayout } from './layout'
import type { PropTransform } from './layout'
import { BIOME_PALETTES, LIGHTING_PALETTES } from './palettes'
import { randRange } from './prng'

/**
 * Deterministic, smoothly rounded stylized biome props scattered around the
 * central explorer pad. Uses smooth Lathe/Capsule/Sphere silhouettes instead
 * of harsh low-segment triangles.
 */
export function BiomeProps({
  scene,
  reducedMotion,
}: {
  scene: RoundScene
  reducedMotion: boolean
}) {
  const foliageRef = useRef<THREE.Group>(null)
  const palette = BIOME_PALETTES[scene.biome]
  const lighting = LIGHTING_PALETTES[scene.lighting]
  const snowy =
    scene.weather === 'snow' ||
    (scene.temperatureBand === 'freezing' && scene.biome !== 'desert')
  const windFactor =
    scene.windBand === 'windy' ? 0.048 : scene.windBand === 'breezy' ? 0.025 : 0.008

  const sharedGeos = useMemo(() => {
    // Smoothly rounded alpine peak (ordered bottom-to-top for outward normals)
    const peakProfile = [
      new THREE.Vector2(1.06, 0),
      new THREE.Vector2(0.95, 0.2),
      new THREE.Vector2(0.7, 0.72),
      new THREE.Vector2(0.45, 1.24),
      new THREE.Vector2(0.24, 1.62),
      new THREE.Vector2(0.11, 1.77),
      new THREE.Vector2(0, 1.82),
    ]
    const mountainPeak = new THREE.LatheGeometry(peakProfile, 28)

    // Smooth snow blanket matching the upper peak curve (bottom-to-top)
    const capProfile = [
      new THREE.Vector2(0.5, 1.22),
      new THREE.Vector2(0.45, 1.3),
      new THREE.Vector2(0.27, 1.62),
      new THREE.Vector2(0.13, 1.79),
      new THREE.Vector2(0, 1.85),
    ]
    const mountainCap = new THREE.LatheGeometry(capProfile, 28)

    // Rounded stylized evergreen tier (soft curved boughs, bottom-to-top)
    const pineTierProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.48, 0),
      new THREE.Vector2(0.56, 0.07),
      new THREE.Vector2(0.52, 0.2),
      new THREE.Vector2(0.32, 0.52),
      new THREE.Vector2(0.12, 0.76),
      new THREE.Vector2(0, 0.82),
    ]
    const pineTier = new THREE.LatheGeometry(pineTierProfile, 24)

    // Sculpted layered desert mesa with smoothly beveled rim (bottom-to-top)
    const mesaProfile = [
      new THREE.Vector2(0.94, 0),
      new THREE.Vector2(0.86, 0.16),
      new THREE.Vector2(0.72, 0.42),
      new THREE.Vector2(0.64, 0.62),
      new THREE.Vector2(0.58, 0.77),
      new THREE.Vector2(0.48, 0.82),
      new THREE.Vector2(0, 0.82),
    ]
    const mesa = new THREE.LatheGeometry(mesaProfile, 28)

    return { mountainPeak, mountainCap, pineTier, mesa }
  }, [])

  useEffect(
    () => () => {
      sharedGeos.mountainPeak.dispose()
      sharedGeos.mountainCap.dispose()
      sharedGeos.pineTier.dispose()
      sharedGeos.mesa.dispose()
    },
    [sharedGeos],
  )

  const layout = useMemo(
    () => getBiomeLayout({ seed: scene.seed, biome: scene.biome }),
    [scene.seed, scene.biome],
  )

  useFrame((state) => {
    if (!foliageRef.current) return
    const t = state.clock.elapsedTime
    foliageRef.current.children.forEach((plant) => {
      const phase = plant.position.x * 0.55 + plant.position.z * 0.32
      plant.rotation.z = reducedMotion ? 0 : Math.sin(t * (scene.windBand === 'windy' ? 2.1 : 1.2) + phase) * windFactor
    })
  })

  if (scene.biome === 'desert') {
    return (
      <group position={[0, ISLAND_TOP_Y, 0]}>
        {layout.primary.map((item, i) => (
          <group key={i} position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale}>
            {item.variant > 0.36 ? (
              <Cactus color={palette.accentA} hasBloom={item.variant > 0.7} />
            ) : (
              <Mesa geometry={sharedGeos.mesa} color={palette.accentB} />
            )}
          </group>
        ))}
        {layout.secondary.map((rock, i) => (
          <SmoothBoulder key={`r-${i}`} item={rock} color={palette.rock} />
        ))}
      </group>
    )
  }

  if (scene.biome === 'forest') {
    return (
      <group position={[0, ISLAND_TOP_Y, 0]}>
        <group ref={foliageRef}>
          {layout.primary.map((tree, i) =>
            tree.variant > 0.25 ? (
              <RoundedPineTree
                key={i}
                item={tree}
                tierGeo={sharedGeos.pineTier}
                color={i % 2 === 0 ? palette.accentA : palette.accentB}
                snowy={snowy}
              />
            ) : (
              <ForestBush
                key={i}
                item={tree}
                color={snowy ? '#dce9f2' : palette.accentB}
              />
            ),
          )}
        </group>
        {layout.secondary.map((rock, i) => (
          <SmoothBoulder key={`r-${i}`} item={rock} color={palette.rock} />
        ))}
      </group>
    )
  }

  if (scene.biome === 'mountains') {
    return (
      <group position={[0, ISLAND_TOP_Y, 0]}>
        {layout.primary.map((peak, i) => (
          <group key={i} position={[peak.x, 0, peak.z]} rotation={[0, peak.angle, 0]} scale={peak.scale}>
            {peak.variant > 0.3 ? (
              <RoundedAlpinePeak
                peakGeo={sharedGeos.mountainPeak}
                capGeo={sharedGeos.mountainCap}
                rockColor={palette.accentA}
                capColor={palette.accentB}
                snowCap={snowy || scene.temperatureBand === 'cold' || peak.scale > 1.02}
              />
            ) : (
              <RoundedPineTree
                item={{ ...peak, x: 0, z: 0, scale: 0.72 }}
                tierGeo={sharedGeos.pineTier}
                color="#3b7252"
                snowy={snowy}
              />
            )}
          </group>
        ))}
        {layout.secondary.map((rock, i) => (
          <SmoothBoulder key={`r-${i}`} item={rock} color={palette.rock} />
        ))}
      </group>
    )
  }

  if (scene.biome === 'tundra') {
    return (
      <group position={[0, ISLAND_TOP_Y, 0]}>
        {layout.primary.map((item, i) => (
          <group key={i} position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale}>
            {item.variant > 0.35 ? (
              <GlacierMound
                iceColor={i % 2 === 0 ? palette.accentA : palette.accentB}
                snowColor={palette.snowyGround}
              />
            ) : (
              <RoundedPineTree
                item={{ ...item, x: 0, z: 0, scale: 0.62 }}
                tierGeo={sharedGeos.pineTier}
                color="#5f8699"
                snowy
              />
            )}
          </group>
        ))}
        {layout.secondary.map((rock, i) => (
          <SmoothBoulder key={`r-${i}`} item={rock} color={palette.rock} />
        ))}
      </group>
    )
  }

  if (scene.biome === 'coast') {
    return (
      <group position={[0, ISLAND_TOP_Y, 0]}>
        <group ref={foliageRef}>
          {layout.primary.map((palm, i) => (
            <PalmTree key={i} item={palm} leafColor={palette.accentA} />
          ))}
        </group>
        {layout.secondary.map((rock, i) => (
          <SmoothBoulder key={`r-${i}`} item={rock} color={palette.rock} />
        ))}
        {/* Cozy rounded wooden pier with harbor lantern */}
        <group position={[3.35, -0.08, 1.35]} rotation={[0, -0.4, 0]}>
          {[-0.36, 0.36].map((dz, idx) => (
            <group key={idx}>
              <mesh position={[0, 0.28, dz]}>
                <capsuleGeometry args={[0.075, 0.54, 6, 12]} />
                <meshStandardMaterial color="#8c6445" roughness={0.85} />
              </mesh>
              <mesh position={[0.78, 0.24, dz]}>
                <capsuleGeometry args={[0.075, 0.46, 6, 12]} />
                <meshStandardMaterial color="#8c6445" roughness={0.85} />
              </mesh>
            </group>
          ))}
          <mesh position={[0.42, 0.38, 0]}>
            <boxGeometry args={[1.28, 0.08, 0.92]} />
            <meshStandardMaterial color="#b2865e" roughness={0.82} />
          </mesh>
          <mesh position={[0.78, 0.62, 0.36]}>
            <sphereGeometry args={[0.09, 14, 12]} />
            <meshStandardMaterial
              color={lighting.windowGlow ? '#ffe8a3' : '#e6edf7'}
              emissive={lighting.windowGlow ? '#ffc759' : '#000000'}
              emissiveIntensity={lighting.windowGlow ? 1.3 : 0}
              roughness={0.3}
            />
          </mesh>
          {lighting.windowGlow && (
            <mesh position={[0.78, 0.62, 0.36]}>
              <sphereGeometry args={[0.26, 12, 10]} />
              <meshBasicMaterial color="#ffd57a" transparent opacity={0.22} depthWrite={false} />
            </mesh>
          )}
        </group>
      </group>
    )
  }

  if (scene.biome === 'grasslands') {
    return (
      <group position={[0, ISLAND_TOP_Y, 0]}>
        <group ref={foliageRef}>
          {layout.primary.map((item, i) =>
            item.variant > 0.52 ? (
              <BroadleafTree
                key={i}
                item={item}
                canopyColor={snowy ? '#dce7ef' : item.variant > 0.76 ? palette.accentA : palette.accentB}
              />
            ) : (
              <MeadowShrub
                key={i}
                item={item}
                color={snowy ? '#c9dbe8' : palette.accentA}
                flowerColor={i % 2 === 0 ? '#ffd97d' : '#ff9eb5'}
                snowy={snowy}
              />
            ),
          )}
        </group>
        {layout.secondary.map((rock, i) => (
          <SmoothBoulder key={`r-${i}`} item={rock} color={palette.rock} />
        ))}
      </group>
    )
  }

  // Urban biome — stylized miniature cozy buildings + rounded street trees + globe lamps
  return (
    <group position={[0, ISLAND_TOP_Y, 0]}>
      {layout.primary.map((item, i) => {
        const height = 0.95 + item.variant * 1.65
        const width = 0.58 + (i % 3) * 0.14
        const depth = 0.56 + ((i + 1) % 3) * 0.14
        const colors = ['#9eaac0', '#c4a995', '#8798b0', '#ccbc9f', '#929eb4']
        const trimColors = ['#d8dfe9', '#ead9cb', '#cad4e2', '#ece2cf', '#d1d8e6']
        const buildingColor = colors[i % colors.length]!
        const trimColor = trimColors[i % trimColors.length]!
        const hasDome = item.variant > 0.72
        return (
          <group key={i} position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]}>
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={buildingColor} roughness={0.72} />
            </mesh>
            {/* Soft beveled roof cornice */}
            <mesh position={[0, height + 0.04, 0]}>
              <boxGeometry args={[width + 0.06, 0.08, depth + 0.06]} />
              <meshStandardMaterial color={snowy ? '#edf4fb' : trimColor} roughness={0.68} />
            </mesh>
            {hasDome && (
              <mesh position={[0, height + 0.07, 0]} scale={[1, 0.65, 1]}>
                <sphereGeometry args={[Math.min(width, depth) * 0.36, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={snowy ? '#edf4fb' : '#7b98b8'} roughness={0.55} />
              </mesh>
            )}
            <mesh position={[0, height * 0.54, depth / 2 + 0.01]}>
              <planeGeometry args={[width * 0.6, height * 0.52]} />
              <meshStandardMaterial
                color={lighting.windowGlow ? '#ffe28a' : '#4a5f7a'}
                emissive={lighting.windowGlow ? '#ffbe55' : '#000000'}
                emissiveIntensity={lighting.windowGlow ? 1.15 : 0}
                roughness={0.32}
              />
            </mesh>
          </group>
        )
      })}
      {layout.secondary.map((spot, i) =>
        i % 2 === 0 ? (
          <group key={`lamp-${i}`} position={[spot.x, 0, spot.z]}>
            <mesh position={[0, 0.44, 0]}>
              <cylinderGeometry args={[0.028, 0.04, 0.88, 12]} />
              <meshStandardMaterial color="#3c4352" roughness={0.6} metalness={0.25} />
            </mesh>
            <mesh position={[0, 0.92, 0]}>
              <sphereGeometry args={[0.095, 16, 14]} />
              <meshStandardMaterial
                color={lighting.windowGlow ? '#ffecaa' : '#dce3ef'}
                emissive={lighting.windowGlow ? '#ffd26a' : '#000000'}
                emissiveIntensity={lighting.windowGlow ? 1.4 : 0}
                roughness={0.25}
              />
            </mesh>
            {lighting.windowGlow && (
              <mesh position={[0, 0.92, 0]}>
                <sphereGeometry args={[0.28, 12, 10]} />
                <meshBasicMaterial color="#ffdb82" transparent opacity={0.2} depthWrite={false} />
              </mesh>
            )}
          </group>
        ) : (
          <ForestBush
            key={`planter-${i}`}
            item={{ ...spot, scale: spot.scale * 0.62 }}
            color={snowy ? '#dce7ef' : '#5e9e68'}
          />
        ),
      )}
    </group>
  )
}

function RoundedPineTree({
  item,
  tierGeo,
  color,
  snowy,
}: {
  item: PropTransform
  tierGeo: THREE.BufferGeometry
  color: string
  snowy: boolean
}) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale}>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.075, 0.115, 0.5, 14]} />
        <meshStandardMaterial color="#704e37" roughness={0.86} />
      </mesh>
      <mesh geometry={tierGeo} position={[0, 0.36, 0]} scale={[1.05, 0.96, 1.05]}>
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <mesh geometry={tierGeo} position={[0, 0.8, 0]} scale={[0.82, 0.88, 0.82]}>
        <meshStandardMaterial color={color} roughness={0.76} />
      </mesh>
      <mesh geometry={tierGeo} position={[0, 1.2, 0]} scale={[0.58, 0.78, 0.58]}>
        <meshStandardMaterial color={snowy ? '#e9f3fb' : color} roughness={0.72} />
      </mesh>
    </group>
  )
}

function ForestBush({ item, color }: { item: PropTransform; color: string }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale}>
      <mesh position={[0, 0.24, 0]} scale={[1.15, 0.88, 1.1]}>
        <sphereGeometry args={[0.34, 18, 14]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0.24, 0.18, 0.12]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh position={[-0.22, 0.17, -0.08]}>
        <sphereGeometry args={[0.21, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
    </group>
  )
}

function BroadleafTree({ item, canopyColor }: { item: PropTransform; canopyColor: string }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale}>
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry args={[0.07, 0.12, 0.9, 14]} />
        <meshStandardMaterial color="#78543a" roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.04, 0]} scale={[1.15, 0.88, 1.1]}>
        <sphereGeometry args={[0.46, 20, 16]} />
        <meshStandardMaterial color={canopyColor} roughness={0.76} />
      </mesh>
      <mesh position={[0.3, 0.92, 0.16]}>
        <sphereGeometry args={[0.32, 18, 14]} />
        <meshStandardMaterial color={canopyColor} roughness={0.78} />
      </mesh>
      <mesh position={[-0.28, 0.94, -0.14]}>
        <sphereGeometry args={[0.3, 18, 14]} />
        <meshStandardMaterial color={canopyColor} roughness={0.78} />
      </mesh>
    </group>
  )
}

function MeadowShrub({
  item,
  color,
  flowerColor,
  snowy,
}: {
  item: PropTransform
  color: string
  flowerColor: string
  snowy: boolean
}) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale * 0.85}>
      <mesh position={[0, 0.16, 0]} scale={[1.25, 0.72, 1.15]}>
        <sphereGeometry args={[0.26, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh position={[0.18, 0.12, 0.1]}>
        <sphereGeometry args={[0.16, 14, 10]} />
        <meshStandardMaterial color={color} roughness={0.84} />
      </mesh>
      {!snowy && (
        <>
          <mesh position={[-0.08, 0.34, 0.08]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={flowerColor} roughness={0.6} />
          </mesh>
          <mesh position={[0.12, 0.31, -0.06]}>
            <sphereGeometry args={[0.048, 10, 8]} />
            <meshStandardMaterial color="#fff4d6" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Cactus({ color, hasBloom }: { color: string; hasBloom: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.56, 0]}>
        <capsuleGeometry args={[0.15, 0.84, 10, 18]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <mesh position={[0.24, 0.64, 0]} rotation={[0, 0, -0.45]}>
        <capsuleGeometry args={[0.085, 0.3, 8, 14]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <mesh position={[-0.22, 0.5, 0]} rotation={[0, 0, 0.48]}>
        <capsuleGeometry args={[0.082, 0.26, 8, 14]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      {hasBloom && (
        <mesh position={[0, 1.14, 0]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial color="#ff9982" roughness={0.55} />
        </mesh>
      )}
    </group>
  )
}

function Mesa({ geometry, color }: { geometry: THREE.BufferGeometry; color: string }) {
  return (
    <mesh geometry={geometry} position={[0, 0, 0]}>
      <meshStandardMaterial color={color} roughness={0.88} />
    </mesh>
  )
}

function RoundedAlpinePeak({
  peakGeo,
  capGeo,
  rockColor,
  capColor,
  snowCap,
}: {
  peakGeo: THREE.BufferGeometry
  capGeo: THREE.BufferGeometry
  rockColor: string
  capColor: string
  snowCap: boolean
}) {
  return (
    <group>
      <mesh geometry={peakGeo} position={[0, 0, 0]}>
        <meshStandardMaterial color={rockColor} roughness={0.86} />
      </mesh>
      {/* Soft shoulder hill for a natural multi-ridge silhouette */}
      <mesh geometry={peakGeo} position={[0.52, -0.02, 0.22]} scale={[0.58, 0.54, 0.58]}>
        <meshStandardMaterial color={rockColor} roughness={0.88} />
      </mesh>
      {snowCap && (
        <mesh geometry={capGeo} position={[0, 0.01, 0]}>
          <meshStandardMaterial color={capColor} roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}

function GlacierMound({ iceColor, snowColor }: { iceColor: string; snowColor: string }) {
  return (
    <group>
      {/* Soft pillowy snowdrift base */}
      <mesh position={[0, 0.16, 0]} scale={[1.35, 0.55, 1.2]}>
        <sphereGeometry args={[0.58, 20, 14]} />
        <meshStandardMaterial color={snowColor} roughness={0.82} />
      </mesh>
      {/* Smooth rounded glacial ice formations */}
      <mesh position={[-0.1, 0.52, 0]} rotation={[0.1, 0, -0.08]}>
        <capsuleGeometry args={[0.24, 0.42, 10, 18]} />
        <meshStandardMaterial color={iceColor} roughness={0.28} metalness={0.08} />
      </mesh>
      <mesh position={[0.28, 0.34, 0.14]} rotation={[-0.14, 0.4, 0.18]}>
        <capsuleGeometry args={[0.16, 0.24, 8, 16]} />
        <meshStandardMaterial color={iceColor} roughness={0.3} metalness={0.08} />
      </mesh>
    </group>
  )
}

function PalmTree({ item, leafColor }: { item: PropTransform; leafColor: string }) {
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.angle, 0]} scale={item.scale}>
      <mesh position={[0, 0.685, 0]}>
        <cylinderGeometry args={[0.062, 0.115, 1.41, 14]} />
        <meshStandardMaterial color="#9a704c" roughness={0.86} />
      </mesh>
      <group position={[0, 1.26, 0]}>
        {/* Rounded coconuts */}
        {[0, 2.1, 4.2].map((a, idx) => (
          <mesh key={`c-${idx}`} position={[Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color="#6e472c" roughness={0.85} />
          </mesh>
        ))}
        {/* Softly arched rounded palm fronds */}
        {[0, 1.25, 2.5, 3.75, 5.0].map((rot, idx) => (
          <group key={idx} rotation={[0, rot, 0]}>
            <mesh position={[0, 0.02, 0.34]} rotation={[0.38, 0, 0]} scale={[0.24, 0.08, 0.62]}>
              <sphereGeometry args={[0.72, 14, 10]} />
              <meshStandardMaterial color={leafColor} roughness={0.72} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function SmoothBoulder({ item, color }: { item: PropTransform; color: string }) {
  const s = randRange(() => item.variant, 0.24, 0.4) * item.scale
  return (
    <mesh
      position={[item.x, s * 0.38, item.z]}
      rotation={[item.variant * 0.4, item.angle, 0]}
      scale={[s * 1.32, s * 0.72, s * 1.05]}
    >
      <sphereGeometry args={[1, 18, 14]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}
