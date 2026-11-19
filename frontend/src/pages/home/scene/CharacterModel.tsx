import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PointerState } from './hooks'

const SKIN = '#e7a878'
const SKIN_SHADOW = '#d89669'
const HAIR = '#19181f'
const KHAKI = '#c6b283'
const SHOE = '#b9986a'

function useStripeTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const stripeHeight = 8
      for (let y = 0; y < canvas.height; y += stripeHeight * 2) {
        ctx.fillStyle = '#3c86d9'
        ctx.fillRect(0, y, canvas.width, stripeHeight)
        ctx.fillStyle = '#f3f6fb'
        ctx.fillRect(0, y + stripeHeight, canvas.width, stripeHeight)
      }
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(1, 1.6)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])
}

/** Hand-placed chunky dreadlock/puff clusters, swept to the character's right, matching the reference art. */
const HAIR_CHUNKS: Array<{
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
}> = [
  { position: [0, 2.28, -0.02], scale: [0.4, 0.32, 0.38] },
  { position: [-0.24, 2.16, 0.08], scale: [0.24, 0.26, 0.26] },
  { position: [0.26, 2.14, 0.06], scale: [0.26, 0.26, 0.26] },
  { position: [0.42, 1.98, 0.02], scale: [0.22, 0.28, 0.24], rotation: [0, 0, -0.3] },
  { position: [0.5, 1.76, -0.02], scale: [0.2, 0.26, 0.22], rotation: [0, 0, -0.5] },
  { position: [0.48, 1.56, -0.06], scale: [0.16, 0.22, 0.18], rotation: [0, 0, -0.6] },
  { position: [-0.38, 1.98, -0.06], scale: [0.2, 0.24, 0.22], rotation: [0, 0, 0.3] },
  { position: [-0.3, 1.74, -0.1], scale: [0.16, 0.2, 0.18], rotation: [0, 0, 0.45] },
  { position: [0.08, 2.0, -0.3], scale: [0.26, 0.24, 0.2] },
  { position: [-0.1, 2.3, 0.18], scale: [0.22, 0.2, 0.22] },
]

export function CharacterModel({
  scale,
  feetY,
  reducedMotion,
  pointerRef,
}: {
  scale: number
  feetY: number
  reducedMotion: boolean
  pointerRef: React.RefObject<PointerState>
}) {
  const stripeTexture = useStripeTexture()
  const rootRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    timeRef.current += delta
    const t = timeRef.current
    if (rootRef.current) {
      rootRef.current.position.y = feetY + Math.sin(t * 0.9) * 0.028
      rootRef.current.rotation.z = Math.sin(t * 0.6) * 0.012
      rootRef.current.rotation.y = Math.sin(t * 0.35) * 0.03
    }
    if (headRef.current) {
      const pointer = pointerRef.current
      headRef.current.rotation.y = pointer.x * 0.12
      headRef.current.rotation.x = -pointer.y * 0.08
    }
  })

  return (
    <group ref={rootRef} position={[0, feetY, 1.6]} scale={scale}>
      {/* shoes */}
      <mesh position={[-0.15, 0.09, 0.02]} scale={[1, 0.65, 1.15]} castShadow>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={SHOE} roughness={0.7} />
      </mesh>
      <mesh position={[0.15, 0.09, 0.02]} scale={[1, 0.65, 1.15]} castShadow>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={SHOE} roughness={0.7} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.15, 0.46, 0]} castShadow>
        <capsuleGeometry args={[0.145, 0.46, 4, 8]} />
        <meshStandardMaterial color={KHAKI} roughness={0.75} />
      </mesh>
      <mesh position={[0.15, 0.46, 0]} castShadow>
        <capsuleGeometry args={[0.145, 0.46, 4, 8]} />
        <meshStandardMaterial color={KHAKI} roughness={0.75} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 1.17, 0]} castShadow>
        <capsuleGeometry args={[0.34, 0.38, 4, 8]} />
        <meshStandardMaterial map={stripeTexture} roughness={0.65} />
      </mesh>
      {/* arms */}
      <mesh position={[-0.44, 1.14, 0]} rotation={[0, 0, 0.32]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      <mesh position={[0.44, 1.14, 0]} rotation={[0, 0, -0.32]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      {/* head group (independent rotation for subtle pointer tracking) */}
      <group ref={headRef} position={[0, 1.95, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.4, 32, 32]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.12, 0]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.4, 24, 24]} />
          <meshStandardMaterial color={SKIN_SHADOW} roughness={0.6} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.14, 0.02, 0.37]}>
          <sphereGeometry args={[0.038, 12, 12]} />
          <meshStandardMaterial color="#141217" roughness={0.3} />
        </mesh>
        <mesh position={[0.14, 0.02, 0.37]}>
          <sphereGeometry args={[0.038, 12, 12]} />
          <meshStandardMaterial color="#141217" roughness={0.3} />
        </mesh>
        {/* mouth */}
        <mesh position={[0, -0.12, 0.395]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.055, 0.012, 8, 16, Math.PI * 0.8]} />
          <meshStandardMaterial color="#8a5a46" roughness={0.5} />
        </mesh>
        {/* hair */}
        <group>
          {HAIR_CHUNKS.map((chunk, index) => (
            <mesh
              key={index}
              position={[chunk.position[0], chunk.position[1] - 1.95, chunk.position[2]]}
              scale={chunk.scale}
              rotation={chunk.rotation}
              castShadow
            >
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color={HAIR} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
