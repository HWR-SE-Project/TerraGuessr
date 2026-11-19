import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import type * as THREE from 'three'

export function SpaceStars({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    groupRef.current.rotation.y += delta * 0.0025
    groupRef.current.rotation.x += delta * 0.0008
  })

  return (
    <group ref={groupRef}>
      <Stars
        radius={70}
        depth={40}
        count={1100}
        factor={2.4}
        saturation={0}
        fade
        speed={reducedMotion ? 0 : 0.35}
      />
    </group>
  )
}
